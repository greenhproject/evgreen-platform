/**
 * EVGreen SaaS Landing — Router de formularios públicos
 * Maneja solicitudes de demo y contacto desde la landing page /saas
 * Guarda en DB y envía notificación a evgreen@greenhproject.com
 * @author Green House Project
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { demoRequests, contactSubmissions } from "../../drizzle/schema";
import { Resend } from "resend";

const SAAS_EMAIL = "evgreen@greenhproject.com";
const FROM_EMAIL = "EVGreen for Business <noreply@evgreen.lat>";

function getResend() {
  const key = process.env.Resend;
  if (!key) return null;
  return new Resend(key);
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
  "": "Sin especificar",
};

const CHARGER_COUNT_LABELS: Record<string, string> = {
  "1-5": "1 a 5 cargadores",
  "6-20": "6 a 20 cargadores",
  "21-50": "21 a 50 cargadores",
  "50+": "Más de 50 cargadores",
  "": "Sin especificar",
};

export const saasRouter = router({
  /**
   * Solicitud de demo — guarda en DB y notifica al equipo de ventas
   */
  submitDemoRequest: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        company: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(30).optional().default(""),
        chargerCount: z.enum(["1-5", "6-20", "21-50", "50+", ""]).optional().default(""),
        plan: z.enum(["starter", "professional", "enterprise", ""]).optional().default(""),
        message: z.string().max(2000).optional().default(""),
      })
    )
    .mutation(async ({ input }) => {
      const { name, company, email, phone, chargerCount, plan, message } = input;

      // 1. Guardar en base de datos
      const drizzle = await getDb();
      if (drizzle) {
        await drizzle.insert(demoRequests).values({
          name,
          company,
          email,
          phone: phone || null,
          chargerCount: chargerCount || null,
          plan: plan || null,
          message: message || null,
          status: "pending",
        });
      }

      // 2. Enviar email de notificación al equipo de ventas
      const resend = getResend();
      const planLabel = PLAN_LABELS[plan ?? ""] ?? plan;
      const chargerLabel = CHARGER_COUNT_LABELS[chargerCount ?? ""] ?? chargerCount;

      const htmlNotification = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">🚀 EVGreen — Nueva solicitud de demo</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;margin-bottom:20px;">
      <strong style="color:#065f46;">✅ Nuevo prospecto — responder en menos de 2 horas</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;width:35%;">Nombre</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;">${name}</td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Empresa</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;">${company}</td></tr>
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;">Correo</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;"><a href="mailto:${email}" style="color:#10b981;">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Teléfono</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;">${phone || "—"}</td></tr>
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;">Plan de interés</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;"><strong style="color:#10b981;">${planLabel}</strong></td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Cargadores</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;">${chargerLabel}</td></tr>
    </table>
    ${message ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;"><p style="font-weight:600;margin:0 0 8px 0;color:#374151;">Mensaje adicional:</p><p style="margin:0;color:#6b7280;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></div>` : ""}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Solicitud recibida desde evgreen.lat/saas · EVGreen for Business</p>
  </div>
</body></html>`;

      if (resend) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: SAAS_EMAIL,
            replyTo: email,
            subject: `[Demo Request] ${company} — Plan ${planLabel} — ${chargerLabel}`,
            html: htmlNotification,
          });
        } catch (err) {
          console.error("[SaaS] Failed to send demo request notification:", err);
        }

        // Confirmación al prospecto
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: "Recibimos tu solicitud de demo — EVGreen for Business",
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">⚡ EVGreen for Business</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;font-weight:600;color:#111827;">Hola ${name},</p>
    <p style="color:#6b7280;line-height:1.6;">Recibimos tu solicitud de demo para <strong style="color:#111827;">${company}</strong>. Nuestro equipo se pondrá en contacto contigo en las próximas <strong style="color:#111827;">2-4 horas hábiles</strong>.</p>
    <p style="color:#6b7280;line-height:1.6;">Si tienes alguna pregunta urgente, escríbenos directamente a <a href="mailto:${SAAS_EMAIL}" style="color:#10b981;">${SAAS_EMAIL}</a>.</p>
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="font-weight:600;color:#065f46;margin:0 0 8px 0;">Tu solicitud:</p>
      <p style="color:#047857;margin:0;">Plan: <strong>${planLabel}</strong> · Cargadores: <strong>${chargerLabel}</strong></p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">EVGreen by Green House Project · Bogotá D.C., Colombia · <a href="https://evgreen.lat/saas" style="color:#10b981;">evgreen.lat/saas</a></p>
  </div>
</body></html>`,
          });
        } catch {
          console.warn("[SaaS] Could not send confirmation to:", email);
        }
      }

      return { success: true };
    }),

  /**
   * Formulario de contacto general desde la landing SaaS
   */
  submitContactForm: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(30).optional().default(""),
        subject: z.string().min(3).max(200),
        message: z.string().min(10).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email, phone, subject, message } = input;

      // 1. Guardar en base de datos
      const drizzle = await getDb();
      if (drizzle) {
        await drizzle.insert(contactSubmissions).values({
          name,
          email,
          phone: phone || null,
          subject,
          message,
          status: "unread",
        });
      }

      // 2. Notificar al equipo
      const resend = getResend();
      const htmlNotification = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">📩 EVGreen — Nuevo mensaje de contacto (SaaS)</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;width:30%;">Nombre</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;">${name}</td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Correo</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;"><a href="mailto:${email}" style="color:#10b981;">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;">Teléfono</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;">${phone || "—"}</td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Asunto</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;"><strong>${subject}</strong></td></tr>
    </table>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <p style="font-weight:600;margin:0 0 8px 0;color:#374151;">Mensaje:</p>
      <p style="margin:0;color:#6b7280;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Enviado desde evgreen.lat/saas</p>
  </div>
</body></html>`;

      if (resend) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: SAAS_EMAIL,
            replyTo: email,
            subject: `[Contacto SaaS] ${subject} — ${name}`,
            html: htmlNotification,
          });
        } catch (err) {
          console.error("[SaaS] Failed to send contact notification:", err);
        }

        // Confirmación al usuario
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: "Recibimos tu mensaje — EVGreen for Business",
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">⚡ EVGreen for Business</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;font-weight:600;color:#111827;">Hola ${name},</p>
    <p style="color:#6b7280;line-height:1.6;">Recibimos tu mensaje sobre <strong style="color:#111827;">"${subject}"</strong>. Te responderemos en un plazo máximo de <strong style="color:#111827;">2 días hábiles</strong>.</p>
    <p style="color:#6b7280;line-height:1.6;">Si tu consulta es urgente, escríbenos directamente a <a href="mailto:${SAAS_EMAIL}" style="color:#10b981;">${SAAS_EMAIL}</a>.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">EVGreen by Green House Project · Bogotá D.C., Colombia</p>
  </div>
</body></html>`,
          });
        } catch {
          console.warn("[SaaS] Could not send confirmation to:", email);
        }
      }

      return { success: true };
    }),
});
