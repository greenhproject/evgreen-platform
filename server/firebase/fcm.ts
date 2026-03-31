/**
 * Firebase Cloud Messaging Service
 * Servicio para enviar notificaciones push a dispositivos móviles
 */

import admin from "firebase-admin";
import { env } from "../_core/env";

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  projectId: env.FIREBASE_PROJECT_ID || "evgreen-app",
  clientEmail: env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
};

// Inicializar Firebase Admin SDK solo si las credenciales están configuradas
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return true;
  
  // Verificar si ya hay una app inicializada
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }
  
  if (!firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
    console.log("[FCM] Firebase credentials not configured - push notifications disabled");
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: firebaseConfig.clientEmail,
        privateKey: firebaseConfig.privateKey,
      }),
    });
    firebaseInitialized = true;
    console.log("[FCM] Firebase initialized successfully");
    return true;
  } catch (error: any) {
    // Si el error es porque ya existe la app, marcar como inicializado
    if (error.code === "app/duplicate-app") {
      firebaseInitialized = true;
      return true;
    }
    console.error("[FCM] Failed to initialize Firebase:", error);
    return false;
  }
}

// Tipos de notificaciones
export type NotificationType = 
  | "charging_complete"      // Carga completada
  | "charging_started"       // Carga iniciada
  | "charging_error"         // Error en la carga
  | "low_balance"            // Saldo bajo
  | "balance_added"          // Saldo agregado
  | "promotion"              // Promoción disponible
  | "station_available"      // Estación disponible
  | "reservation_reminder"   // Recordatorio de reserva
  | "overstay_alert"          // Alerta de ocupación (overstay)
  | "support_new_ticket"     // Nuevo ticket de soporte
  | "support_user_reply"     // Usuario respondió en ticket
  | "support_agent_reply"    // Agente/técnico respondió en ticket
  | "support_ticket_resolved" // Ticket resuelto
  | "system_alert";          // Alerta del sistema

// Interfaz para datos de notificación
export interface PushNotificationData {
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

// Iconos y colores por tipo de notificación
const notificationStyles: Record<NotificationType, { icon: string; color: string }> = {
  charging_complete: { icon: "✅", color: "#22c55e" },
  charging_started: { icon: "⚡", color: "#3b82f6" },
  charging_error: { icon: "❌", color: "#ef4444" },
  low_balance: { icon: "💰", color: "#f59e0b" },
  balance_added: { icon: "💵", color: "#22c55e" },
  promotion: { icon: "🎉", color: "#8b5cf6" },
  station_available: { icon: "📍", color: "#06b6d4" },
  reservation_reminder: { icon: "⏰", color: "#f97316" },
  overstay_alert: { icon: "🚨", color: "#dc2626" },
  support_new_ticket: { icon: "🎫", color: "#8b5cf6" },
  support_user_reply: { icon: "💬", color: "#3b82f6" },
  support_agent_reply: { icon: "🛠️", color: "#059669" },
  support_ticket_resolved: { icon: "✅", color: "#22c55e" },
  system_alert: { icon: "🔔", color: "#64748b" },
};

/**
 * Enviar notificación push a un dispositivo específico
 */
export async function sendPushNotification(
  fcmToken: string,
  notification: PushNotificationData
): Promise<boolean> {
  if (!initializeFirebase()) {
    console.log("[FCM] Cannot send notification - Firebase not initialized");
    return false;
  }

  const style = notificationStyles[notification.type];

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: `${style.icon} ${notification.title}`,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        type: notification.type,
        clickAction: notification.clickAction || "/",
        ...notification.data,
      },
      android: {
        priority: "high",
        notification: {
          color: style.color,
          clickAction: notification.clickAction || "FLUTTER_NOTIFICATION_CLICK",
          channelId: "evgreen_notifications",
        },
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400",
        },
        notification: {
          title: `${style.icon} ${notification.title}`,
          body: notification.body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          vibrate: [200, 100, 200] as any,
          tag: notification.type,
          renotify: true,
          requireInteraction: notification.type === "low_balance" || notification.type === "charging_error" || notification.type === "overstay_alert",
          data: {
            type: notification.type,
            url: notification.clickAction || "/",
            ...notification.data,
          },
        },
        fcmOptions: {
          link: notification.clickAction || "/",
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] Notification sent successfully: ${response}`);
    return true;
  } catch (error: any) {
    console.error("[FCM] Error sending notification:", error.message);
    
    // Si el token es inválido, retornar false para que se pueda limpiar
    if (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered") {
      return false;
    }
    
    return false;
  }
}

/**
 * Enviar notificación push a múltiples dispositivos
 */
export async function sendPushNotificationToMultiple(
  fcmTokens: string[],
  notification: PushNotificationData
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  if (!initializeFirebase()) {
    console.log("[FCM] Cannot send notifications - Firebase not initialized");
    return { success: 0, failure: fcmTokens.length, invalidTokens: [] };
  }

  if (fcmTokens.length === 0) {
    return { success: 0, failure: 0, invalidTokens: [] };
  }

  const style = notificationStyles[notification.type];
  const invalidTokens: string[] = [];

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: `${style.icon} ${notification.title}`,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        type: notification.type,
        clickAction: notification.clickAction || "/",
        ...notification.data,
      },
      android: {
        priority: "high",
        notification: {
          color: style.color,
          channelId: "evgreen_notifications",
        },
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400",
        },
        notification: {
          title: `${style.icon} ${notification.title}`,
          body: notification.body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          vibrate: [200, 100, 200] as any,
          tag: notification.type,
          renotify: true,
          data: {
            type: notification.type,
            url: notification.clickAction || "/",
            ...notification.data,
          },
        },
        fcmOptions: {
          link: notification.clickAction || "/",
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Identificar tokens inválidos
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        if (resp.error.code === "messaging/invalid-registration-token" ||
            resp.error.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    console.log(`[FCM] Multicast result: ${response.successCount} success, ${response.failureCount} failures`);
    
    return {
      success: response.successCount,
      failure: response.failureCount,
      invalidTokens,
    };
  } catch (error: any) {
    console.error("[FCM] Error sending multicast notification:", error.message);
    return { success: 0, failure: fcmTokens.length, invalidTokens: [] };
  }
}

/**
 * Enviar notificación de carga completada
 */
export async function sendChargingCompleteNotification(
  fcmToken: string,
  data: {
    stationName: string;
    energyDelivered: number;
    totalCost: number;
    duration: number;
  }
): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    type: "charging_complete",
    title: "¡Carga completada!",
    body: `Tu vehículo está listo. ${data.energyDelivered.toFixed(2)} kWh en ${data.stationName}. Total: $${data.totalCost.toLocaleString()}`,
    clickAction: "/history",
    data: {
      stationName: data.stationName,
      energyDelivered: data.energyDelivered.toString(),
      totalCost: data.totalCost.toString(),
      duration: data.duration.toString(),
    },
  });
}

/**
 * Enviar notificación de carga iniciada
 */
export async function sendChargingStartedNotification(
  fcmToken: string,
  data: {
    stationName: string;
    connectorType: string;
  }
): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    type: "charging_started",
    title: "Carga iniciada",
    body: `Tu sesión de carga ha comenzado en ${data.stationName} (${data.connectorType})`,
    clickAction: "/charging-monitor",
    data: {
      stationName: data.stationName,
      connectorType: data.connectorType,
    },
  });
}

/**
 * Enviar notificación de saldo bajo
 */
export async function sendLowBalanceNotification(
  fcmToken: string,
  currentBalance: number
): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    type: "low_balance",
    title: "Saldo bajo",
    body: `Tu saldo actual es de $${currentBalance.toLocaleString()}. Recarga para seguir cargando tu vehículo.`,
    clickAction: "/wallet",
    data: {
      currentBalance: currentBalance.toString(),
    },
  });
}

/**
 * Enviar notificación de promoción
 */
export async function sendPromotionNotification(
  fcmTokens: string[],
  data: {
    title: string;
    description: string;
    discount?: number;
    validUntil?: string;
  }
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  return sendPushNotificationToMultiple(fcmTokens, {
    type: "promotion",
    title: data.title,
    body: data.description,
    clickAction: "/wallet",
    data: {
      discount: data.discount?.toString() || "",
      validUntil: data.validUntil || "",
    },
  });
}

/**
 * Suscribir dispositivo a un tema (topic)
 */
export async function subscribeToTopic(
  fcmToken: string,
  topic: string
): Promise<boolean> {
  if (!initializeFirebase()) return false;

  try {
    await admin.messaging().subscribeToTopic(fcmToken, topic);
    console.log(`[FCM] Subscribed to topic: ${topic}`);
    return true;
  } catch (error: any) {
    console.error(`[FCM] Error subscribing to topic ${topic}:`, error.message);
    return false;
  }
}

/**
 * Desuscribir dispositivo de un tema
 */
export async function unsubscribeFromTopic(
  fcmToken: string,
  topic: string
): Promise<boolean> {
  if (!initializeFirebase()) return false;

  try {
    await admin.messaging().unsubscribeFromTopic(fcmToken, topic);
    console.log(`[FCM] Unsubscribed from topic: ${topic}`);
    return true;
  } catch (error: any) {
    console.error(`[FCM] Error unsubscribing from topic ${topic}:`, error.message);
    return false;
  }
}

/**
 * Enviar notificación a un tema
 */
export async function sendToTopic(
  topic: string,
  notification: PushNotificationData
): Promise<boolean> {
  if (!initializeFirebase()) return false;

  const style = notificationStyles[notification.type];

  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title: `${style.icon} ${notification.title}`,
        body: notification.body,
      },
      data: {
        type: notification.type,
        clickAction: notification.clickAction || "/",
        ...notification.data,
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] Topic notification sent: ${response}`);
    return true;
  } catch (error: any) {
    console.error(`[FCM] Error sending to topic ${topic}:`, error.message);
    return false;
  }
}

export default {
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendChargingCompleteNotification,
  sendChargingStartedNotification,
  sendLowBalanceNotification,
  sendPromotionNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendToTopic,
};


/**
 * Enviar notificación de demanda alta a inversionista
 */
export async function sendHighDemandNotification(
  fcmToken: string,
  data: {
    stationName: string;
    demandLevel: string;
    occupancyRate: number;
    currentPrice: number;
  }
): Promise<boolean> {
  const levelText = {
    HIGH: "Alta demanda",
    SURGE: "Demanda crítica",
  }[data.demandLevel] || "Alta demanda";
  
  return sendPushNotification(fcmToken, {
    type: "system_alert",
    title: `📈 ${levelText} en ${data.stationName}`,
    body: `Ocupación: ${data.occupancyRate.toFixed(0)}%. Precio actual: $${data.currentPrice.toLocaleString()}/kWh. ¡Tus ingresos están aumentando!`,
    clickAction: "/investor/stations",
    data: {
      stationName: data.stationName,
      demandLevel: data.demandLevel,
      occupancyRate: data.occupancyRate.toString(),
      currentPrice: data.currentPrice.toString(),
    },
  });
}

/**
 * Enviar notificación de demanda baja a inversionista (oportunidad de promoción)
 */
export async function sendLowDemandNotification(
  fcmToken: string,
  data: {
    stationName: string;
    occupancyRate: number;
    suggestedDiscount: number;
  }
): Promise<boolean> {
  return sendPushNotification(fcmToken, {
    type: "promotion",
    title: `💡 Oportunidad en ${data.stationName}`,
    body: `Baja demanda (${data.occupancyRate.toFixed(0)}% ocupación). Considera activar una promoción del ${data.suggestedDiscount}% para atraer más usuarios.`,
    clickAction: "/investor/stations",
    data: {
      stationName: data.stationName,
      occupancyRate: data.occupancyRate.toString(),
      suggestedDiscount: data.suggestedDiscount.toString(),
    },
  });
}
