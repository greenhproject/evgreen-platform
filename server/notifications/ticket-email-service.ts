/**
 * Ticket Email Notification Service
 * Sends professional email notifications to admins when:
 * - A ticket is resolved
 * - A ticket is cancelled
 * - A critical ticket is created
 */

import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

const resendApiKey = process.env.RESEND_API_KEY || "re_VBTGfE43_MrkUuQ96ji8kyvY4ZrfEiy9b";
const resend = new Resend(resendApiKey);

const FROM_EMAIL = "EVGreen <admin@evgreen.lat>";
const ADMIN_CC = "gerencia@greenhproject.com";

interface TicketEmailParams {
  type: "resolved" | "cancelled" | "critical_created";
  ticketId: number;
  title: string;
  priority: string;
  stationId: number;
  stationName?: string;
  technicianName: string;
  resolution?: string;
  laborCost?: string;
}

async function getAdminEmails(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const admins = await db.select({ email: users.email })
      .from(users)
      .where(or(eq(users.role, "admin"), eq(users.role, "staff")));
    return admins.filter(a => a.email).map(a => a.email!);
  } catch (e) {
    console.error("[TicketEmail] Error getting admin emails:", e);
    return [];
  }
}

function getPriorityInfo(priority: string): { label: string; color: string; bgColor: string } {
  const map: Record<string, { label: string; color: string; bgColor: string }> = {
    CRITICAL: { label: "Cr\u00edtica", color: "#ef4444", bgColor: "#fef2f2" },
    HIGH: { label: "Alta", color: "#f97316", bgColor: "#fff7ed" },
    MEDIUM: { label: "Media", color: "#eab308", bgColor: "#fefce8" },
    LOW: { label: "Baja", color: "#6b7280", bgColor: "#f9fafb" },
  };
  return map[priority] || map.MEDIUM;
}

function getStatusInfo(type: string): { label: string; color: string; bgColor: string; emoji: string } {
  const map: Record<string, { label: string; color: string; bgColor: string; emoji: string }> = {
    resolved: { label: "Resuelto", color: "#22c55e", bgColor: "#f0fdf4", emoji: "\u2705" },
    cancelled: { label: "Cancelado", color: "#ef4444", bgColor: "#fef2f2", emoji: "\u274c" },
    critical_created: { label: "Cr\u00edtico Creado", color: "#ef4444", bgColor: "#fef2f2", emoji: "\ud83d\udea8" },
  };
  return map[type] || map.resolved;
}

function buildTicketEmailHtml(params: TicketEmailParams): string {
  const priority = getPriorityInfo(params.priority);
  const status = getStatusInfo(params.type);
  const stationLabel = params.stationName || `Estaci\u00f3n #${params.stationId}`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <tr><td style="background:linear-gradient(135deg,#0a2e1f 0%,#1a5c3a 100%);padding:32px 40px;text-align:center;">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/evgreen/email-assets/evgreen-logo-white.png" alt="EVGreen" width="140" style="margin-bottom:16px;" />
          <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:600;">${status.emoji} Ticket de Mantenimiento ${status.label}</h1>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:${status.bgColor};border-left:4px solid ${status.color};padding:16px 20px;border-radius:8px;">
              <p style="margin:0;font-size:14px;color:${status.color};font-weight:600;">Ticket #${params.ticketId} - ${status.label}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${params.type === "resolved" ? "El t\u00e9cnico ha completado este ticket de mantenimiento." : params.type === "cancelled" ? "Este ticket ha sido cancelado por el t\u00e9cnico." : "Se ha creado un nuevo ticket con prioridad CR\u00cdTICA que requiere atenci\u00f3n inmediata."}</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;">
          <h2 style="font-size:16px;color:#1f2937;margin:0 0 16px;font-weight:600;">Detalles del Ticket</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;width:140px;"><strong style="color:#374151;font-size:13px;">T\u00edtulo</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;"><span style="color:#1f2937;font-size:13px;">${params.title}</span></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;font-size:13px;">Estaci\u00f3n</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;"><span style="color:#1f2937;font-size:13px;">${stationLabel}</span></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;"><strong style="color:#374151;font-size:13px;">Prioridad</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;"><span style="display:inline-block;padding:2px 10px;border-radius:12px;background-color:${priority.bgColor};color:${priority.color};font-size:12px;font-weight:600;">${priority.label}</span></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;background-color:#f9fafb;${params.resolution || params.laborCost ? 'border-bottom:1px solid #e5e7eb;' : ''}"><strong style="color:#374151;font-size:13px;">T\u00e9cnico</strong></td>
              <td style="padding:12px 16px;${params.resolution || params.laborCost ? 'border-bottom:1px solid #e5e7eb;' : ''}"><span style="color:#1f2937;font-size:13px;">${params.technicianName}</span></td>
            </tr>
            ${params.resolution ? `<tr><td style="padding:12px 16px;background-color:#f9fafb;${params.laborCost ? 'border-bottom:1px solid #e5e7eb;' : ''}"><strong style="color:#374151;font-size:13px;">Resoluci\u00f3n</strong></td><td style="padding:12px 16px;${params.laborCost ? 'border-bottom:1px solid #e5e7eb;' : ''}"><span style="color:#1f2937;font-size:13px;">${params.resolution}</span></td></tr>` : ""}
            ${params.laborCost ? `<tr><td style="padding:12px 16px;background-color:#f9fafb;"><strong style="color:#374151;font-size:13px;">Costo M.O.</strong></td><td style="padding:12px 16px;"><span style="color:#1f2937;font-size:13px;">$${Number(params.laborCost).toLocaleString("es-CO")} COP</span></td></tr>` : ""}
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Este es un email autom\u00e1tico de la plataforma EVGreen.</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">\u00a9 ${new Date().getFullYear()} Green House Project S.A.S. Todos los derechos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildSubject(params: TicketEmailParams): string {
  switch (params.type) {
    case "resolved": return `Ticket #${params.ticketId} Resuelto - ${params.title}`;
    case "cancelled": return `Ticket #${params.ticketId} Cancelado - ${params.title}`;
    case "critical_created": return `ALERTA: Ticket Cr\u00edtico #${params.ticketId} - ${params.title}`;
    default: return `Actualizaci\u00f3n Ticket #${params.ticketId} - ${params.title}`;
  }
}

export async function sendTicketEmailToAdmin(params: TicketEmailParams): Promise<boolean> {
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) {
      console.warn("[TicketEmail] No admin emails found");
      return false;
    }

    const html = buildTicketEmailHtml(params);
    const subject = buildSubject(params);
    const allRecipients = Array.from(new Set([...adminEmails, ADMIN_CC]));

    for (const email of allRecipients) {
      try {
        await resend.emails.send(buildEmailParams({
          from: FROM_EMAIL,
          to: email,
          subject,
          html,
          replyTo: "soporte@evgreen.lat",
        }));
        console.log(`[TicketEmail] Sent ${params.type} notification to ${email} for ticket #${params.ticketId}`);
      } catch (err) {
        console.error(`[TicketEmail] Failed to send to ${email}:`, err);
      }
    }
    return true;
  } catch (error) {
    console.error("[TicketEmail] Error in sendTicketEmailToAdmin:", error);
    return false;
  }
}
