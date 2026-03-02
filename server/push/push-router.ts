/**
 * Router de Notificaciones Push
 * Soporta Web Push nativo (VAPID) como método principal
 * y FCM como fallback si está configurado
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  subscribeToTopic,
  unsubscribeFromTopic,
  sendPushNotification,
} from "../firebase/fcm";
import { sendWebPush, isWebPushAvailable, getVapidPublicKey, type PushSubscriptionData } from "./web-push-service";
import { checkProximityAndNotify } from "../proximity/proximity-alert-service";

export const pushRouter = router({
  /**
   * Obtener la clave pública VAPID para suscripción Web Push
   */
  getVapidKey: publicProcedure.query(() => {
    return {
      vapidPublicKey: getVapidPublicKey(),
      webPushAvailable: isWebPushAvailable(),
    };
  }),

  /**
   * Registrar suscripción Web Push del dispositivo
   */
  registerSubscription: protectedProcedure
    .input(
      z.object({
        subscription: z.object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const userId = ctx.user.id;

      // Guardar suscripción Web Push como JSON
      await db
        .update(users)
        .set({
          pushSubscription: JSON.stringify(input.subscription),
          fcmTokenUpdatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      console.log(`[Push] Web Push subscription registered for user ${userId}`);
      return { success: true };
    }),

  /**
   * Registrar token FCM del dispositivo (legacy/fallback)
   */
  registerToken: protectedProcedure
    .input(
      z.object({
        fcmToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const userId = ctx.user.id;

      // Actualizar token FCM del usuario
      await db
        .update(users)
        .set({
          fcmToken: input.fcmToken,
          fcmTokenUpdatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Obtener usuario para verificar preferencias
      const [user] = await db
        .select({
          notifyPromotions: users.notifyPromotions,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        await subscribeToTopic(input.fcmToken, "evgreen_all");
        if (user.notifyPromotions) {
          await subscribeToTopic(input.fcmToken, "evgreen_promotions");
        }
      }

      return { success: true };
    }),

  /**
   * Eliminar suscripción push (logout o desinstalar app)
   */
  unregisterToken: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const userId = ctx.user.id;

    // Obtener token actual antes de eliminarlo
    const [user] = await db
      .select({ fcmToken: users.fcmToken })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.fcmToken) {
      await unsubscribeFromTopic(user.fcmToken, "evgreen_all");
      await unsubscribeFromTopic(user.fcmToken, "evgreen_promotions");
    }

    // Eliminar ambos: token FCM y suscripción Web Push
    await db
      .update(users)
      .set({
        fcmToken: null,
        fcmTokenUpdatedAt: null,
        pushSubscription: null,
      })
      .where(eq(users.id, userId));

    return { success: true };
  }),

  /**
   * Obtener preferencias de notificaciones
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        chargingComplete: true,
        lowBalance: true,
        promotions: true,
        pushEnabled: false,
      };
    }

    const [user] = await db
      .select({
        notifyChargingComplete: users.notifyChargingComplete,
        notifyLowBalance: users.notifyLowBalance,
        notifyPromotions: users.notifyPromotions,
        fcmToken: users.fcmToken,
        pushSubscription: users.pushSubscription,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      chargingComplete: user?.notifyChargingComplete ?? true,
      lowBalance: user?.notifyLowBalance ?? true,
      promotions: user?.notifyPromotions ?? true,
      pushEnabled: !!(user?.pushSubscription || user?.fcmToken),
    };
  }),

  /**
   * Actualizar preferencias de notificaciones
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        chargingComplete: z.boolean().optional(),
        lowBalance: z.boolean().optional(),
        promotions: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const userId = ctx.user.id;

      const [user] = await db
        .select({
          fcmToken: users.fcmToken,
          notifyPromotions: users.notifyPromotions,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const updateData: Record<string, boolean> = {};
      if (input.chargingComplete !== undefined) {
        updateData.notifyChargingComplete = input.chargingComplete;
      }
      if (input.lowBalance !== undefined) {
        updateData.notifyLowBalance = input.lowBalance;
      }
      if (input.promotions !== undefined) {
        updateData.notifyPromotions = input.promotions;

        if (user?.fcmToken) {
          if (input.promotions) {
            await subscribeToTopic(user.fcmToken, "evgreen_promotions");
          } else {
            await unsubscribeFromTopic(user.fcmToken, "evgreen_promotions");
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId));
      }

      return { success: true };
    }),

  /**
   * Verificar proximidad con estaciones compatibles y precio bajo
   */
  checkProximity: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await checkProximityAndNotify({
        userId: ctx.user.id,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      return result;
    }),

  /**
   * Obtener preferencias de proximidad
   */
  getProximityPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        enabled: true,
        radiusKm: 5,
      };
    }

    const [user] = await db
      .select({
        notifyProximity: users.notifyProximity,
        proximityRadiusKm: users.proximityRadiusKm,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      enabled: user?.notifyProximity ?? true,
      radiusKm: user?.proximityRadiusKm ?? 5,
    };
  }),

  /**
   * Actualizar preferencias de proximidad
   */
  updateProximityPreferences: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        radiusKm: z.number().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const updateData: Record<string, unknown> = {};
      if (input.enabled !== undefined) {
        updateData.notifyProximity = input.enabled;
      }
      if (input.radiusKm !== undefined) {
        updateData.proximityRadiusKm = input.radiusKm;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));
      }

      return { success: true };
    }),

  /**
   * Enviar notificación de prueba
   */
  sendTestNotification: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const [user] = await db
      .select({
        fcmToken: users.fcmToken,
        pushSubscription: users.pushSubscription,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      return { success: false, error: "Usuario no encontrado" };
    }

    // Intentar Web Push nativo primero
    if (user.pushSubscription && isWebPushAvailable()) {
      try {
        const subscription: PushSubscriptionData = JSON.parse(user.pushSubscription);
        const result = await sendWebPush(subscription, {
          title: "Notificación de prueba - EVGreen",
          body: `¡Hola ${user.name || "Usuario"}! Las notificaciones push están funcionando correctamente.`,
          tag: "test-notification",
          data: { type: "test", url: "/perfil" },
        });
        if (result) {
          return { success: true };
        }
      } catch (error) {
        console.error("[Push] Error sending Web Push test:", error);
      }
    }

    // Fallback a FCM
    if (user.fcmToken) {
      const result = await sendPushNotification(user.fcmToken, {
        type: "system_alert",
        title: "Notificación de prueba",
        body: `¡Hola ${user.name || "Usuario"}! Las notificaciones push están funcionando correctamente.`,
        clickAction: "/profile",
      });
      return { success: result };
    }

    return { success: false, error: "No hay suscripción push registrada" };
  }),
});

export type PushRouter = typeof pushRouter;
