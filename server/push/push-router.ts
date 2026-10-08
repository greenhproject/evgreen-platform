/**
 * Router de Notificaciones Push
 * Soporta Web Push nativo (VAPID) como método principal
 * y FCM como fallback si está configurado
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { pushDeliveryEvents, pushDevices, users } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import {
  subscribeToTopic,
  unsubscribeFromTopic,
} from "../firebase/fcm";
import { isWebPushAvailable, getVapidPublicKey } from "./web-push-service";
import { checkProximityAndNotify } from "../proximity/proximity-alert-service";
import { acknowledgePushDelivery, deactivatePushDevice, getActivePushDevicesForUser, registerPushDevice } from "./push-device-service";
import { sendUserPushDetailed } from "./unified-push";

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
      const db = (await getDb())!;
      if (!db) return { success: false, error: "Database not available" };

      const userId = ctx.user.id;

      // Guardar suscripción Web Push como JSON
      await db
        .update(users)
        .set({
          pushSubscription: JSON.stringify(input.subscription),
          // @ts-ignore
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
        platform: z.enum(["android", "ios", "web", "unknown"]).optional(),
        appVersion: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      if (!db) return { success: false, error: "Database not available" };

      const userId = ctx.user.id;

      if (input.fcmToken.startsWith("local_")) {
        return { success: false, error: "El token local de prueba no es válido para Push real" };
      }

      const device = await registerPushDevice({
        userId,
        token: input.fcmToken,
        platform: input.platform,
        appVersion: input.appVersion,
      });

      // Campo histórico conservado para versiones antiguas; el registro real
      // por dispositivo queda en push_devices.
      await db
        .update(users)
        .set({
          fcmToken: input.fcmToken,
          // @ts-ignore
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

      return { success: true, deviceId: device?.id };
    }),

  /**
   * Eliminar suscripción push (logout o desinstalar app)
   */
  unregisterToken: protectedProcedure.input(z.object({ fcmToken: z.string().min(1).optional() }).optional()).mutation(async ({ ctx, input }) => {
    const db = (await getDb())!;
    if (!db) return { success: false, error: "Database not available" };

    const userId = ctx.user.id;

    // La app actual envía su token antes de borrarlo localmente: así un usuario
    // conserva Push en su otro teléfono. Sin token se mantiene el reset global
    // utilizado por versiones antiguas al cerrar sesión.
    if (input?.fcmToken) {
      await deactivatePushDevice({ userId, token: input.fcmToken });
      await unsubscribeFromTopic(input.fcmToken, "evgreen_all");
      await unsubscribeFromTopic(input.fcmToken, "evgreen_promotions");
      return { success: true, scope: "device" as const };
    }

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

    return { success: true, scope: "all" as const };
  }),

  /**
   * Obtener preferencias de notificaciones
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
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

    const activeDevices = await getActivePushDevicesForUser(ctx.user.id);
    return {
      chargingComplete: user?.notifyChargingComplete ?? true,
      lowBalance: user?.notifyLowBalance ?? true,
      promotions: user?.notifyPromotions ?? true,
      pushEnabled: !!(user?.pushSubscription || user?.fcmToken || activeDevices.length),
      activeDeviceCount: activeDevices.length,
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
      const db = (await getDb())!;
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
    const db = (await getDb())!;
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
      const db = (await getDb())!;
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
    const db = (await getDb())!;
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

    const result = await sendUserPushDetailed(ctx.user.id, {
      type: "system_alert",
      title: "Notificación de prueba",
      body: `Hola ${user.name || "Usuario"}. EVGreen solicitó una prueba Push; el estado se actualizará cuando la app la reciba.`,
      clickAction: "/settings/notifications",
      data: { test: "true" },
    });

    return {
      success: result.accepted,
      state: result.accepted ? "ACCEPTED_BY_PROVIDER" as const : "NOT_ACCEPTED" as const,
      attempted: result.attempted,
      acceptedCount: result.acceptedCount,
      attempts: result.attempts.map(({ channel, deliveryId, deviceId, accepted, errorCode }) => ({ channel, deliveryId, deviceId, accepted, errorCode })),
      error: result.attempted === 0 ? "No hay un dispositivo Push real registrado" : undefined,
    };
  }),

  /** La app nativa confirma recepción/apertura; no se acepta de terceros. */
  acknowledgeDelivery: protectedProcedure
    .input(z.object({ deliveryId: z.string().min(10).max(80), event: z.enum(["RECEIVED", "OPENED"]) }))
    .mutation(async ({ ctx, input }) => acknowledgePushDelivery({ ...input, userId: ctx.user.id })),

  /** Diagnóstico sin exponer tokens ni datos sensibles del dispositivo. */
  getDeliveryHealth: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { devices: [], events: [] };
    const [devices, events] = await Promise.all([
      db.select({ id: pushDevices.id, platform: pushDevices.platform, appVersion: pushDevices.appVersion, status: pushDevices.status, registeredAt: pushDevices.registeredAt, lastSeenAt: pushDevices.lastSeenAt, lastAcceptedAt: pushDevices.lastAcceptedAt, lastReceivedAt: pushDevices.lastReceivedAt, lastOpenedAt: pushDevices.lastOpenedAt, lastErrorCode: pushDevices.lastErrorCode }).from(pushDevices).where(eq(pushDevices.userId, ctx.user.id)).orderBy(desc(pushDevices.lastSeenAt)).limit(10),
      db.select({ deliveryId: pushDeliveryEvents.deliveryId, channel: pushDeliveryEvents.channel, status: pushDeliveryEvents.status, notificationType: pushDeliveryEvents.notificationType, requestedAt: pushDeliveryEvents.requestedAt, acceptedAt: pushDeliveryEvents.acceptedAt, receivedAt: pushDeliveryEvents.receivedAt, openedAt: pushDeliveryEvents.openedAt, errorCode: pushDeliveryEvents.errorCode }).from(pushDeliveryEvents).where(eq(pushDeliveryEvents.userId, ctx.user.id)).orderBy(desc(pushDeliveryEvents.requestedAt)).limit(10),
    ]);
    return { devices, events };
  }),
});

export type PushRouter = typeof pushRouter;
