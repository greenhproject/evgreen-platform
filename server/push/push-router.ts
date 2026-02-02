/**
 * Router de Notificaciones Push
 * Endpoints para gestionar tokens FCM y preferencias de notificaciones
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { 
  subscribeToTopic, 
  unsubscribeFromTopic,
  sendPushNotification 
} from "../firebase/fcm";

export const pushRouter = router({
  /**
   * Registrar token FCM del dispositivo
   */
  registerToken: protectedProcedure
    .input(z.object({
      fcmToken: z.string().min(1),
    }))
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
        // Suscribir a topic general de EVGreen
        await subscribeToTopic(input.fcmToken, "evgreen_all");
        
        // Suscribir a promociones si está habilitado
        if (user.notifyPromotions) {
          await subscribeToTopic(input.fcmToken, "evgreen_promotions");
        }
      }

      return { success: true };
    }),

  /**
   * Eliminar token FCM (logout o desinstalar app)
   */
  unregisterToken: protectedProcedure
    .mutation(async ({ ctx }) => {
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
        // Desuscribir de todos los topics
        await unsubscribeFromTopic(user.fcmToken, "evgreen_all");
        await unsubscribeFromTopic(user.fcmToken, "evgreen_promotions");
      }

      // Eliminar token
      await db
        .update(users)
        .set({
          fcmToken: null,
          fcmTokenUpdatedAt: null,
        })
        .where(eq(users.id, userId));

      return { success: true };
    }),

  /**
   * Obtener preferencias de notificaciones
   */
  getPreferences: protectedProcedure
    .query(async ({ ctx }) => {
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
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      return {
        chargingComplete: user?.notifyChargingComplete ?? true,
        lowBalance: user?.notifyLowBalance ?? true,
        promotions: user?.notifyPromotions ?? true,
        pushEnabled: !!user?.fcmToken,
      };
    }),

  /**
   * Actualizar preferencias de notificaciones
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      chargingComplete: z.boolean().optional(),
      lowBalance: z.boolean().optional(),
      promotions: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const userId = ctx.user.id;
      
      // Obtener usuario actual
      const [user] = await db
        .select({ 
          fcmToken: users.fcmToken, 
          notifyPromotions: users.notifyPromotions 
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Actualizar preferencias
      const updateData: Record<string, boolean> = {};
      if (input.chargingComplete !== undefined) {
        updateData.notifyChargingComplete = input.chargingComplete;
      }
      if (input.lowBalance !== undefined) {
        updateData.notifyLowBalance = input.lowBalance;
      }
      if (input.promotions !== undefined) {
        updateData.notifyPromotions = input.promotions;
        
        // Actualizar suscripción a topic de promociones
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
   * Enviar notificación de prueba (solo para desarrollo)
   */
  sendTestNotification: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const [user] = await db
        .select({ fcmToken: users.fcmToken, name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.fcmToken) {
        return { success: false, error: "No hay token FCM registrado" };
      }

      const result = await sendPushNotification(user.fcmToken, {
        type: "system_alert",
        title: "Notificación de prueba",
        body: `¡Hola ${user.name || "Usuario"}! Las notificaciones push están funcionando correctamente.`,
        clickAction: "/profile",
      });

      return { success: result };
    }),
});

export type PushRouter = typeof pushRouter;
