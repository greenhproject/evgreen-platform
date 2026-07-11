/**
 * ============================================================================
 * EVGreen Platform - Servicio Unificado de Push Notifications
 * ============================================================================
 * 
 * Este módulo proporciona una función unificada para enviar notificaciones push
 * a los usuarios, independientemente del método de suscripción que hayan usado.
 * 
 * FLUJO DE ENVÍO:
 * 1. Verificar si el usuario tiene suscripción Web Push nativa (VAPID) → enviar
 * 2. Si no, verificar si tiene token FCM → enviar vía Firebase
 * 3. Si ninguno está disponible, retornar false silenciosamente
 * 
 * IMPORTANTE: Todos los módulos que envían notificaciones push deben usar
 * sendUserPush() en lugar de llamar directamente a sendPushNotification() o
 * sendWebPush(), para garantizar que las notificaciones lleguen sin importar
 * el método de registro del usuario.
 * 
 * @module unified-push
 */

import { sendWebPush, isWebPushAvailable, type PushSubscriptionData } from "./web-push-service";
import { sendPushNotification, type NotificationType, type PushNotificationData } from "../firebase/fcm";
import * as db from "../db";

/**
 * Interfaz unificada para notificaciones push
 * Compatible con ambos sistemas (Web Push nativo y FCM)
 */
export interface UnifiedPushPayload {
  /** Tipo de notificación para categorización y routing */
  type: NotificationType;
  /** Título visible de la notificación */
  title: string;
  /** Cuerpo/descripción de la notificación */
  body: string;
  /** URL de imagen opcional (para notificaciones expandidas) */
  imageUrl?: string;
  /** URL a la que navegar al hacer clic en la notificación */
  clickAction?: string;
  /** Datos adicionales como key-value strings */
  data?: Record<string, string>;
}

/**
 * Enviar notificación push a un usuario por su ID.
 * Intenta Web Push nativo primero, luego FCM como fallback.
 * 
 * @param userId - ID del usuario en la base de datos
 * @param payload - Datos de la notificación
 * @returns true si se envió exitosamente por cualquier método, false si falló
 * 
 * @example
 * ```ts
 * await sendUserPush(userId, {
 *   type: "charging_complete",
 *   title: "⚡ ¡Carga completada!",
 *   body: "Tu vehículo está listo. 15.2 kWh entregados.",
 *   clickAction: "/charging-monitor",
 *   data: { transactionId: "123" },
 * });
 * ```
 */
export async function sendUserPush(
  userId: number,
  payload: UnifiedPushPayload
): Promise<boolean> {
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      console.log(`[UnifiedPush] User ${userId} not found`);
      return false;
    }

    // 1. Intentar Web Push nativo (VAPID) - método preferido
    if (user.pushSubscription && isWebPushAvailable()) {
      try {
        const subscription: PushSubscriptionData = JSON.parse(user.pushSubscription);
        
        // Detectar endpoint FCM legacy (/fcm/send/) — deprecado desde junio 2024
        // Chrome en Android generaba estos endpoints antes; ya no funcionan con VAPID
        const isLegacyFcmEndpoint = subscription.endpoint?.includes('/fcm/send/');
        if (isLegacyFcmEndpoint) {
          console.warn(`[UnifiedPush] User ${userId} has legacy FCM endpoint (deprecated since Jun 2024) — skipping Web Push, trying FCM token`);
        } else {
          const sent = await sendWebPush(subscription, {
            title: payload.title,
            body: payload.body,
            image: payload.imageUrl,
            tag: payload.type,
            requireInteraction: ["low_balance", "charging_error", "overstay_alert"].includes(payload.type),
            data: {
              type: payload.type,
              url: payload.clickAction || "/",
              clickAction: payload.clickAction || "/",
              ...payload.data,
            },
          });

          if (sent) {
            console.log(`[UnifiedPush] Web Push sent to user ${userId}: "${payload.title}"`);
            return true;
          }
          console.warn(`[UnifiedPush] Web Push failed for user ${userId}, trying FCM fallback...`);
        }
      } catch (parseError) {
        console.error(`[UnifiedPush] Invalid pushSubscription JSON for user ${userId}:`, parseError);
      }
    }

    // 2. Fallback: FCM (Firebase Cloud Messaging)
    if (user.fcmToken && !user.fcmToken.startsWith("local_")) {
      const fcmPayload: PushNotificationData = {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
        clickAction: payload.clickAction,
        data: payload.data,
      };

      const sent = await sendPushNotification(user.fcmToken, fcmPayload);
      if (sent) {
        console.log(`[UnifiedPush] FCM sent to user ${userId}: "${payload.title}"`);
        return true;
      }
      console.warn(`[UnifiedPush] FCM also failed for user ${userId}`);
    }

    // 3. Ningún método disponible
    if (!user.pushSubscription && !user.fcmToken) {
      // Silencioso: el usuario no tiene push registrado
      return false;
    }

    console.log(`[UnifiedPush] All push methods failed for user ${userId}`);
    return false;
  } catch (error) {
    console.error(`[UnifiedPush] Error sending push to user ${userId}:`, error);
    return false;
  }
}

/**
 * Enviar notificación push a múltiples usuarios.
 * Procesa en paralelo para mejor rendimiento.
 * 
 * @param userIds - Array de IDs de usuarios
 * @param payload - Datos de la notificación (mismo para todos)
 * @returns Resumen de envíos exitosos y fallidos
 */
export async function sendUserPushToMultiple(
  userIds: number[],
  payload: UnifiedPushPayload
): Promise<{ success: number; failure: number }> {
  if (userIds.length === 0) {
    return { success: 0, failure: 0 };
  }

  const results = await Promise.allSettled(
    userIds.map((userId) => sendUserPush(userId, payload))
  );

  let success = 0;
  let failure = 0;

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      success++;
    } else {
      failure++;
    }
  }

  console.log(`[UnifiedPush] Multicast: ${success} success, ${failure} failures out of ${userIds.length} users`);
  return { success, failure };
}

// Re-exportar tipos para conveniencia
export type { NotificationType } from "../firebase/fcm";
