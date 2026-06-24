/**
 * Servicio de Notificaciones para Técnicos
 * 
 * Envía notificaciones a técnicos cuando ocurren alertas OCPP:
 * - Push notifications via FCM
 * - Email via Resend
 * - In-app notifications (tabla notifications)
 * 
 * Respeta las preferencias del técnico:
 * - techNotifyCriticalAlerts: si recibe alertas críticas
 * - techNotifyNewTickets: si recibe alertas de nuevos tickets
 * - techNotifyMaintenanceReminders: si recibe recordatorios
 * - techNotifyByPush: si recibe push notifications
 * - techNotifyByEmail: si recibe emails
 * - techAvailableForEmergencies: si recibe alertas fuera de horario
 * - techWorkingHoursStart/End: horario laboral
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { users, notifications } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendPushNotification, sendPushNotificationToMultiple } from "../firebase/fcm";
import { buildEmailParams } from "../utils/email-helper";
import type { OcppAlertSeverity, OcppAlertType } from "../ocpp/alerts-service";

const resend = new Resend(process.env.Resend ?? "");

const FROM_EMAIL = "EVGreen <alertas@evgreen.lat>";

// ============================================================================
// TIPOS
// ============================================================================

export interface TechnicianAlertPayload {
  alertType: OcppAlertType;
  severity: OcppAlertSeverity;
  title: string;
  message: string;
  ocppIdentity: string;
  stationId?: number | null;
  stationName?: string;
  payload?: Record<string, unknown>;
}

interface TechnicianPreferences {
  id: number;
  name: string | null;
  email: string | null;
  fcmToken: string | null;
  techNotifyCriticalAlerts: boolean | null;
  techNotifyNewTickets: boolean | null;
  techNotifyMaintenanceReminders: boolean | null;
  techNotifyByEmail: boolean | null;
  techNotifyByPush: boolean | null;
  techAvailableForEmergencies: boolean | null;
  techWorkingHoursStart: string | null;
  techWorkingHoursEnd: string | null;
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Verifica si el técnico está dentro de su horario laboral
 */
function isWithinWorkingHours(start: string, end: string): boolean {
  const now = new Date();
  // Usar hora de Colombia (UTC-5)
  const colombiaOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const colombiaMinutes = utcMinutes + colombiaOffset;
  const adjustedMinutes = colombiaMinutes < 0 ? colombiaMinutes + 1440 : colombiaMinutes % 1440;
  
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return adjustedMinutes >= startMinutes && adjustedMinutes <= endMinutes;
  }
  // Horario nocturno (ej: 22:00 - 06:00)
  return adjustedMinutes >= startMinutes || adjustedMinutes <= endMinutes;
}

/**
 * Determina si un técnico debe recibir una alerta según sus preferencias
 */
function shouldNotifyTechnician(
  tech: TechnicianPreferences,
  severity: OcppAlertSeverity,
  alertType: OcppAlertType
): boolean {
  // Si las alertas críticas están desactivadas y es una alerta crítica/warning, no notificar
  if (severity === "critical" || severity === "warning") {
    if (tech.techNotifyCriticalAlerts === false) return false;
  }
  
  // Si es info y no tiene alertas de mantenimiento activas, no notificar
  if (severity === "info" && tech.techNotifyMaintenanceReminders === false) {
    return false;
  }
  
  // Verificar horario laboral
  const start = tech.techWorkingHoursStart || "08:00";
  const end = tech.techWorkingHoursEnd || "18:00";
  const withinHours = isWithinWorkingHours(start, end);
  
  // Si está fuera de horario y NO está disponible para emergencias, no notificar
  if (!withinHours && tech.techAvailableForEmergencies === false) {
    return false;
  }
  
  // Si está fuera de horario pero disponible para emergencias, solo notificar si es critical
  if (!withinHours && severity !== "critical") {
    return false;
  }
  
  return true;
}

/**
 * Genera el HTML del email de alerta para técnicos
 */
function buildAlertEmailHtml(alert: TechnicianAlertPayload): string {
  const severityColors: Record<OcppAlertSeverity, { bg: string; text: string; label: string }> = {
    critical: { bg: "#fee2e2", text: "#dc2626", label: "CRÍTICA" },
    warning: { bg: "#fef3c7", text: "#d97706", label: "ADVERTENCIA" },
    info: { bg: "#dbeafe", text: "#2563eb", label: "INFORMACIÓN" },
  };
  
  const style = severityColors[alert.severity];
  const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:20px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:white;margin:0;font-size:20px;">⚡ EVGreen - Alerta Técnica</h1>
    </div>
    
    <!-- Severity Badge -->
    <div style="background:${style.bg};padding:12px 20px;border-left:4px solid ${style.text};">
      <span style="color:${style.text};font-weight:bold;font-size:14px;">${emoji} ${style.label}</span>
    </div>
    
    <!-- Content -->
    <div style="background:white;padding:24px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;margin:0 0 12px 0;font-size:18px;">${alert.title}</h2>
      <p style="color:#475569;margin:0 0 16px 0;font-size:14px;line-height:1.6;">${alert.message}</p>
      
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:40%;">Estación</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-weight:600;">${alert.stationName || alert.ocppIdentity}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Identificador OCPP</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${alert.ocppIdentity}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Tipo de alerta</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${alert.alertType}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#64748b;">Fecha y hora</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
        </tr>
      </table>
    </div>
    
    <!-- Footer -->
    <div style="background:#f1f5f9;padding:16px 20px;border-radius:0 0 12px 12px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Puedes gestionar tus preferencias de notificación en Configuración > Notificaciones
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Obtiene todos los técnicos activos con sus preferencias de notificación
 */
export async function getActiveTechnicians(): Promise<TechnicianPreferences[]> {
  const database = await getDb();
  if (!database) return [];
  
  const technicians = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      fcmToken: users.fcmToken,
      techNotifyCriticalAlerts: users.techNotifyCriticalAlerts,
      techNotifyNewTickets: users.techNotifyNewTickets,
      techNotifyMaintenanceReminders: users.techNotifyMaintenanceReminders,
      techNotifyByEmail: users.techNotifyByEmail,
      techNotifyByPush: users.techNotifyByPush,
      techAvailableForEmergencies: users.techAvailableForEmergencies,
      techWorkingHoursStart: users.techWorkingHoursStart,
      techWorkingHoursEnd: users.techWorkingHoursEnd,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "technician"),
        eq(users.isActive, true)
      )
    );
  
  return technicians;
}

/**
 * Envía notificaciones a todos los técnicos elegibles cuando ocurre una alerta OCPP
 * 
 * Flujo:
 * 1. Obtener técnicos activos
 * 2. Filtrar según preferencias y horario
 * 3. Enviar push FCM (si habilitado)
 * 4. Enviar email (si habilitado)
 * 5. Crear notificación in-app
 */
export async function notifyTechniciansOfAlert(
  alert: TechnicianAlertPayload
): Promise<{ pushSent: number; emailSent: number; inAppCreated: number }> {
  const result = { pushSent: 0, emailSent: 0, inAppCreated: 0 };
  
  try {
    const technicians = await getActiveTechnicians();
    
    if (technicians.length === 0) {
      console.log("[TechNotify] No active technicians found");
      return result;
    }
    
    // Filtrar técnicos que deben recibir esta alerta
    const eligibleTechs = technicians.filter(tech => 
      shouldNotifyTechnician(tech, alert.severity, alert.alertType)
    );
    
    if (eligibleTechs.length === 0) {
      console.log("[TechNotify] No eligible technicians for this alert");
      return result;
    }
    
    console.log(`[TechNotify] Notifying ${eligibleTechs.length}/${technicians.length} technicians for ${alert.severity} alert: ${alert.alertType}`);
    
    const database = await getDb();
    
    // Procesar cada técnico
    for (const tech of eligibleTechs) {
      try {
        // 1. Push notification via FCM
        if (tech.techNotifyByPush !== false && tech.fcmToken) {
          const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
          const pushSent = await sendPushNotification(tech.fcmToken, {
            type: "system_alert",
            title: `${emoji} ${alert.title}`,
            body: alert.message,
            data: {
              alertType: alert.alertType,
              severity: alert.severity,
              ocppIdentity: alert.ocppIdentity,
              stationId: String(alert.stationId || ""),
            },
          });
          if (pushSent) result.pushSent++;
        }
        
        // 2. Email via Resend
        if (tech.techNotifyByEmail !== false && tech.email) {
          try {
            const emailHtml = buildAlertEmailHtml(alert);
            const emailResult = await resend.emails.send(buildEmailParams({
              from: FROM_EMAIL,
              to: tech.email,
              subject: `${alert.severity === "critical" ? "🚨 CRÍTICA" : "⚠️ Alerta"}: ${alert.title} - EVGreen`,
              html: emailHtml,
            }));
            
            if (!emailResult.error) {
              result.emailSent++;
            } else {
              console.error(`[TechNotify] Email error for ${tech.email}:`, emailResult.error);
            }
          } catch (emailErr) {
            console.error(`[TechNotify] Email send failed for ${tech.email}:`, emailErr);
          }
        }
        
        // 3. In-app notification
        if (database) {
          try {
            await database.insert(notifications).values({
              userId: tech.id,
              title: alert.title,
              message: alert.message,
              type: "MAINTENANCE",
              referenceType: "ocpp_alert",
              referenceId: alert.stationId || undefined,
              isRead: false,
              pushSent: tech.techNotifyByPush !== false && !!tech.fcmToken,
              pushSentAt: tech.techNotifyByPush !== false && !!tech.fcmToken ? new Date() : undefined,
              data: JSON.stringify({
                alertType: alert.alertType,
                severity: alert.severity,
                ocppIdentity: alert.ocppIdentity,
                stationName: alert.stationName,
                payload: alert.payload,
              }),
            });
            result.inAppCreated++;
          } catch (dbErr) {
            console.error(`[TechNotify] DB notification insert failed for tech ${tech.id}:`, dbErr);
          }
        }
      } catch (techErr) {
        console.error(`[TechNotify] Error notifying technician ${tech.id}:`, techErr);
      }
    }
    
    console.log(`[TechNotify] Results: ${result.pushSent} push, ${result.emailSent} email, ${result.inAppCreated} in-app`);
    return result;
  } catch (error) {
    console.error("[TechNotify] Error in notifyTechniciansOfAlert:", error);
    return result;
  }
}

/**
 * Envía notificación a técnicos cuando se crea un nuevo ticket de mantenimiento
 */
export async function notifyTechniciansOfNewTicket(ticket: {
  id: number;
  stationName: string;
  priority: string;
  description: string;
  assignedToId?: number;
}): Promise<void> {
  try {
    const technicians = await getActiveTechnicians();
    
    // Si hay un técnico asignado, notificar solo a él
    const targetTechs = ticket.assignedToId 
      ? technicians.filter(t => t.id === ticket.assignedToId)
      : technicians.filter(t => t.techNotifyNewTickets !== false);
    
    if (targetTechs.length === 0) return;
    
    const emoji = ticket.priority === "CRITICAL" ? "🚨" : ticket.priority === "HIGH" ? "🔴" : "🔧";
    const title = `${emoji} Nuevo ticket: ${ticket.stationName}`;
    const body = `Prioridad: ${ticket.priority}. ${ticket.description.substring(0, 100)}`;
    
    const database = await getDb();
    
    for (const tech of targetTechs) {
      // Push
      if (tech.techNotifyByPush !== false && tech.fcmToken) {
        await sendPushNotification(tech.fcmToken, {
          type: "system_alert",
          title,
          body,
          data: { ticketId: String(ticket.id), priority: ticket.priority },
        });
      }
      
      // Email
      if (tech.techNotifyByEmail !== false && tech.email) {
        try {
          await resend.emails.send(buildEmailParams({
            from: FROM_EMAIL,
            to: tech.email,
            subject: `${title} - EVGreen`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#059669,#10b981);padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:20px;">🔧 Nuevo Ticket de Mantenimiento</h1>
                </div>
                <div style="background:white;padding:24px;border:1px solid #e2e8f0;">
                  <h2 style="color:#1e293b;margin:0 0 8px;">${ticket.stationName}</h2>
                  <p style="color:#dc2626;font-weight:bold;margin:0 0 12px;">Prioridad: ${ticket.priority}</p>
                  <p style="color:#475569;line-height:1.6;">${ticket.description}</p>
                </div>
                <div style="background:#f1f5f9;padding:16px;border-radius:0 0 12px 12px;text-align:center;">
                  <p style="color:#94a3b8;font-size:12px;margin:0;">EVGreen - Sistema de Mantenimiento</p>
                </div>
              </div>
            `,
          }));
        } catch (e) {
          console.error(`[TechNotify] Email failed for ticket notification to ${tech.email}:`, e);
        }
      }
      
      // In-app
      if (database) {
        await database.insert(notifications).values({
          userId: tech.id,
          title,
          message: body,
          type: "MAINTENANCE",
          referenceType: "maintenance_ticket",
          referenceId: ticket.id,
          isRead: false,
        });
      }
    }
    
    console.log(`[TechNotify] Ticket #${ticket.id} notification sent to ${targetTechs.length} technicians`);
  } catch (error) {
    console.error("[TechNotify] Error notifying ticket:", error);
  }
}
