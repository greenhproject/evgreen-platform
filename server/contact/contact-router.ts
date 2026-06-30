/**
 * EVGreen - Contact Router
 * Handles contact form submissions and sends emails via Resend to evgreen@greenhproject.com
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { Resend } from "resend";

const CONTACT_TO = "evgreen@greenhproject.com";
const CONTACT_FROM = "EVGreen Contacto <noreply@evgreen.lat>";

const TOPIC_LABELS: Record<string, string> = {
  soporte_tecnico: "Soporte técnico",
  facturacion: "Facturación y pagos",
  estaciones: "Estaciones de carga",
  cuenta: "Mi cuenta",
  empresas: "Soluciones para empresas",
  inversores: "Inversores / Alianzas",
  datos_personales: "Datos personales (HABEAS DATA)",
  otro: "Otro",
};

export const contactRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        topic: z.enum([
          "soporte_tecnico",
          "facturacion",
          "estaciones",
          "cuenta",
          "empresas",
          "inversores",
          "datos_personales",
          "otro",
        ]),
        message: z.string().min(10).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email, topic, message } = input;
      const topicLabel = TOPIC_LABELS[topic] ?? topic;
      const isUrgent = message.toLowerCase().includes("urgente");

      const resendKey = process.env.Resend;
      if (!resendKey) {
        console.warn("[Contact] Resend API key not configured. Message from:", email);
        console.info("[Contact] Message:", { name, email, topic, message });
        return { success: true };
      }

      const resend = new Resend(resendKey);
      const subject = `${isUrgent ? "🚨 URGENTE - " : ""}[EVGreen Contacto] ${topicLabel} - ${name}`;

      const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">⚡ EVGreen — Nuevo mensaje de contacto</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    ${isUrgent ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px;margin-bottom:16px;"><strong style="color:#dc2626;">🚨 MENSAJE URGENTE</strong></div>' : ""}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;width:30%;">Nombre</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;">${name}</td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Correo</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;"><a href="mailto:${email}" style="color:#10b981;">${email}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;font-weight:600;">Asunto</td><td style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;">${topicLabel}</td></tr>
    </table>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <p style="font-weight:600;margin:0 0 8px 0;color:#374151;">Mensaje:</p>
      <p style="margin:0;color:#6b7280;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Enviado desde el formulario de contacto de EVGreen (evgreen.lat). Responde directamente a este correo para contestar al usuario.</p>
  </div>
</body></html>`;

      try {
        await resend.emails.send({
          from: CONTACT_FROM,
          to: CONTACT_TO,
          replyTo: email,
          subject,
          html: htmlBody,
        });
      } catch (err) {
        console.error("[Contact] Failed to send email via Resend:", err);
        throw new Error("No se pudo enviar el mensaje. Por favor intenta más tarde o escríbenos directamente a evgreen@greenhproject.com");
      }

      // Confirmation email to user (non-critical)
      try {
        await resend.emails.send({
          from: CONTACT_FROM,
          to: email,
          subject: `Recibimos tu mensaje — EVGreen`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#10b981,#3b82f6);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">⚡ EVGreen</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;font-weight:600;color:#111827;">Hola ${name},</p>
    <p style="color:#6b7280;line-height:1.6;">Hemos recibido tu mensaje sobre <strong style="color:#111827;">${topicLabel}</strong> y te responderemos en un plazo máximo de <strong style="color:#111827;">2 días hábiles</strong>.</p>
    <p style="color:#6b7280;line-height:1.6;">Si tu consulta es urgente, puedes escribirnos directamente a <a href="mailto:${CONTACT_TO}" style="color:#10b981;">${CONTACT_TO}</a>.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">EVGreen by Green House Project · Bogotá D.C., Colombia</p>
  </div>
</body></html>`,
        });
      } catch {
        console.warn("[Contact] Could not send confirmation email to:", email);
      }

      return { success: true };
    }),
});
