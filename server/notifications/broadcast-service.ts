/**
 * Broadcast Notification Service
 * Servicio para enviar notificaciones masivas a usuarios de la plataforma
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { users, notifications } from "../../drizzle/schema";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { sendPushNotificationToMultiple, NotificationType } from "../firebase/fcm";

// Inicializar Resend con la API key
const resendApiKey = process.env.RESEND_API_KEY || "re_CeRTmETR_MHxYaF2sShjXcmSmZKE5qSzr";
const resend = new Resend(resendApiKey);

// Tipos de notificación del admin
export type AdminNotificationType = "INFO" | "SUCCESS" | "WARNING" | "ALERT" | "PROMOTION";

// Audiencias objetivo
export type TargetAudience = "all" | "users" | "investors" | "technicians" | "admins";

// Interfaz para crear notificación masiva
export interface BroadcastNotificationInput {
  title: string;
  message: string;
  type: AdminNotificationType;
  targetAudience: TargetAudience;
  linkUrl?: string;
  sendPush?: boolean;
  sendEmail?: boolean;
  sendInApp?: boolean;
}

// Resultado del envío
export interface BroadcastResult {
  totalUsers: number;
  pushSent: number;
  pushFailed: number;
  emailSent: number;
  emailFailed: number;
  inAppCreated: number;
  invalidTokens: string[];
}

// Mapeo de tipo admin a tipo FCM
const typeToFcmType: Record<AdminNotificationType, NotificationType> = {
  INFO: "system_alert",
  SUCCESS: "system_alert",
  WARNING: "system_alert",
  ALERT: "system_alert",
  PROMOTION: "promotion",
};

// Mapeo de audiencia a roles
const audienceToRoles: Record<TargetAudience, string[] | null> = {
  all: null, // null significa todos
  users: ["user"],
  investors: ["investor"],
  technicians: ["technician"],
  admins: ["admin", "staff"],
};

/**
 * Obtener usuarios según la audiencia objetivo
 */
async function getUsersByAudience(audience: TargetAudience) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const roles = audienceToRoles[audience];
  
  if (roles) {
    return db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        fcmToken: users.fcmToken,
        notifyPromotions: users.notifyPromotions,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.isActive, true), inArray(users.role, roles as any)));
  }

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      fcmToken: users.fcmToken,
      notifyPromotions: users.notifyPromotions,
      role: users.role,
    })
    .from(users)
    .where(eq(users.isActive, true));
}

/**
 * Enviar notificación masiva a usuarios
 */
export async function sendBroadcastNotification(
  input: BroadcastNotificationInput
): Promise<BroadcastResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: BroadcastResult = {
    totalUsers: 0,
    pushSent: 0,
    pushFailed: 0,
    emailSent: 0,
    emailFailed: 0,
    inAppCreated: 0,
    invalidTokens: [],
  };

  try {
    // Obtener usuarios según audiencia
    const targetUsers = await getUsersByAudience(input.targetAudience);
    result.totalUsers = targetUsers.length;

    if (targetUsers.length === 0) {
      console.log("[Broadcast] No users found for audience:", input.targetAudience);
      return result;
    }

    // 1. Crear notificaciones in-app para todos los usuarios
    if (input.sendInApp !== false) {
      const notificationValues = targetUsers.map((user) => ({
        userId: user.id,
        title: input.title,
        message: input.message,
        type: input.type,
        isRead: false,
        data: JSON.stringify({
          broadcastType: input.type,
          linkUrl: input.linkUrl || null,
          targetAudience: input.targetAudience,
        }),
      }));

      // Insertar en lotes de 100
      const batchSize = 100;
      for (let i = 0; i < notificationValues.length; i += batchSize) {
        const batch = notificationValues.slice(i, i + batchSize);
        await db.insert(notifications).values(batch);
        result.inAppCreated += batch.length;
      }
      console.log("[Broadcast] Created " + result.inAppCreated + " in-app notifications");
    }

    // 2. Enviar notificaciones push
    if (input.sendPush !== false) {
      // Filtrar usuarios con token FCM y que aceptan promociones (si es promoción)
      const usersWithPush = targetUsers.filter((user) => {
        if (!user.fcmToken) return false;
        if (input.type === "PROMOTION" && !user.notifyPromotions) return false;
        return true;
      });

      if (usersWithPush.length > 0) {
        const fcmTokens = usersWithPush.map((u) => u.fcmToken!);
        
        // Enviar en lotes de 500 (límite de FCM)
        const fcmBatchSize = 500;
        for (let i = 0; i < fcmTokens.length; i += fcmBatchSize) {
          const batch = fcmTokens.slice(i, i + fcmBatchSize);
          const pushResult = await sendPushNotificationToMultiple(batch, {
            type: typeToFcmType[input.type],
            title: input.title,
            body: input.message,
            clickAction: input.linkUrl || "/notifications",
          });
          
          result.pushSent += pushResult.success;
          result.pushFailed += pushResult.failure;
          result.invalidTokens.push(...pushResult.invalidTokens);
        }
        console.log("[Broadcast] Push notifications: " + result.pushSent + " sent, " + result.pushFailed + " failed");
      }
    }

    // 3. Enviar emails
    if (input.sendEmail) {
      const usersWithEmail = targetUsers.filter((user) => user.email);
      
      // Enviar emails en lotes de 50 para evitar rate limits
      const emailBatchSize = 50;
      for (let i = 0; i < usersWithEmail.length; i += emailBatchSize) {
        const batch = usersWithEmail.slice(i, i + emailBatchSize);
        
        for (const user of batch) {
          try {
            await resend.emails.send({
              from: "EVGreen <notificaciones@evgreen.lat>",
              to: user.email!,
              subject: input.title,
              html: generateEmailTemplate(input, user.name || "Usuario"),
            });
            result.emailSent++;
          } catch (error) {
            console.error("[Broadcast] Email failed for " + user.email + ":", error);
            result.emailFailed++;
          }
        }
        
        // Pequeña pausa entre lotes para evitar rate limits
        if (i + emailBatchSize < usersWithEmail.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      console.log("[Broadcast] Emails: " + result.emailSent + " sent, " + result.emailFailed + " failed");
    }

    // Limpiar tokens inválidos de la base de datos
    if (result.invalidTokens.length > 0) {
      console.log("[Broadcast] Cleaning " + result.invalidTokens.length + " invalid FCM tokens");
      for (const token of result.invalidTokens) {
        await db
          .update(users)
          .set({ fcmToken: null, fcmTokenUpdatedAt: null })
          .where(eq(users.fcmToken, token));
      }
    }

    return result;
  } catch (error) {
    console.error("[Broadcast] Error sending broadcast notification:", error);
    throw error;
  }
}

/**
 * Generar template de email para notificación
 */
function generateEmailTemplate(input: BroadcastNotificationInput, userName: string): string {
  const typeColors: Record<AdminNotificationType, string> = {
    INFO: "#3b82f6",
    SUCCESS: "#22c55e",
    WARNING: "#f59e0b",
    ALERT: "#ef4444",
    PROMOTION: "#8b5cf6",
  };

  const typeIcons: Record<AdminNotificationType, string> = {
    INFO: "ℹ️",
    SUCCESS: "✅",
    WARNING: "⚠️",
    ALERT: "🚨",
    PROMOTION: "🎉",
  };

  const color = typeColors[input.type];
  const icon = typeIcons[input.type];

  const linkButton = input.linkUrl 
    ? '<div style="text-align: center; margin-top: 30px;"><a href="' + input.linkUrl + '" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Ver más detalles →</a></div>'
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + input.title + '</title></head><body style="margin: 0; padding: 0; font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a;"><tr><td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center;"><img src="https://evgreen.lat/logo-white.png" alt="EVGreen" style="height: 40px; margin-bottom: 10px;"><h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">' + icon + ' ' + input.title + '</h1></td></tr><tr><td style="padding: 40px 30px;"><p style="color: #a0a0a0; font-size: 16px; margin: 0 0 20px 0;">Hola <strong style="color: #ffffff;">' + userName + '</strong>,</p><div style="background-color: #252525; border-left: 4px solid ' + color + '; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0;">' + input.message + '</p></div>' + linkButton + '</td></tr><tr><td style="background-color: #151515; padding: 25px 30px; border-top: 1px solid #2a2a2a;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #666; font-size: 13px;"><p style="margin: 0 0 10px 0;"><strong style="color: #22c55e;">EVGreen</strong> - Carga el Futuro</p><p style="margin: 0; color: #555;">Este correo fue enviado desde el Centro de Notificaciones de EVGreen.</p></td><td align="right" style="color: #666; font-size: 12px;"><a href="https://evgreen.lat" style="color: #22c55e; text-decoration: none;">evgreen.lat</a></td></tr></table></td></tr></table></td></tr></table></body></html>';
}

/**
 * Obtener estadísticas de notificaciones
 */
export async function getNotificationStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Total de notificaciones enviadas (últimos 30 días)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalSentResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(sql`${notifications.createdAt} >= ${thirtyDaysAgo}`);

  const [readResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(
      sql`${notifications.createdAt} >= ${thirtyDaysAgo}`,
      eq(notifications.isRead, true)
    ));

  const [activeUsersResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.isActive, true));

  const [pendingResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, false));

  const totalSent = totalSentResult?.count || 0;
  const readCount = readResult?.count || 0;
  const readRate = totalSent > 0 ? (readCount / totalSent) * 100 : 0;

  return {
    totalSent,
    readRate: Math.round(readRate * 10) / 10,
    activeUsers: activeUsersResult?.count || 0,
    pendingNotifications: pendingResult?.count || 0,
  };
}

/**
 * Obtener historial de notificaciones broadcast
 */
export async function getBroadcastHistory(limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Obtener notificaciones únicas por título y fecha (agrupadas)
  const results = await db
    .select({
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      data: notifications.data,
      createdAt: notifications.createdAt,
      totalSent: sql<number>`COUNT(*)`,
      readCount: sql<number>`SUM(CASE WHEN ${notifications.isRead} = true THEN 1 ELSE 0 END)`,
    })
    .from(notifications)
    .where(sql`JSON_EXTRACT(${notifications.data}, '$.broadcastType') IS NOT NULL`)
    .groupBy(notifications.title, notifications.message, notifications.type, notifications.data, notifications.createdAt)
    .orderBy(sql`${notifications.createdAt} DESC`)
    .limit(limit);

  return results.map((r, index) => {
    const data = r.data ? JSON.parse(r.data) : {};
    return {
      id: index + 1,
      title: r.title,
      message: r.message,
      type: data.broadcastType || r.type,
      targetAudience: data.targetAudience || "all",
      sentAt: r.createdAt,
      readCount: Number(r.readCount) || 0,
      totalSent: Number(r.totalSent) || 0,
    };
  });
}

export default {
  sendBroadcastNotification,
  getNotificationStats,
  getBroadcastHistory,
};
