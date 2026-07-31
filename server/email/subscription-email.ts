/**
 * subscription-email.ts — Emails transaccionales de suscripción EVGreen
 *
 * Tipos de email:
 *  - renewal_reminder    → D-3 antes del vencimiento
 *  - renewal_success     → Renovación exitosa
 *  - renewal_failed      → Fallo de renovación (con reintentos)
 *  - cancelled_non_payment → Cancelación por falta de pago
 *  - cancelled_by_user   → Cancelación voluntaria completada
 *  - cancellation_confirmed → Confirmación de solicitud de cancelación
 */

import { getResendClient, getEmailFrom } from "./resend-client";
const APP_URL = "https://app.evgreen.lat";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EmailType =
  | "renewal_reminder"
  | "renewal_success"
  | "renewal_failed"
  | "cancelled_non_payment"
  | "cancelled_by_user"
  | "cancellation_confirmed";

interface BaseEmailParams {
  type: EmailType;
  to: string;
  userName: string;
  planName: string;
  amount: number;
}

interface RenewalReminderParams extends BaseEmailParams {
  type: "renewal_reminder";
  walletBalance: number;
  dueDate: Date;
  hasSufficientBalance: boolean;
}

interface RenewalSuccessParams extends BaseEmailParams {
  type: "renewal_success";
  paymentMethod: string;
  reference: string;
  nextBillingDate: Date;
  walletBalance?: number;
}

interface RenewalFailedParams extends BaseEmailParams {
  type: "renewal_failed";
  walletBalance: number;
  shortfall: number;
  failedCount: number;
  remainingAttempts: number;
  nextRetryDate: Date;
}

interface CancelledNonPaymentParams extends BaseEmailParams {
  type: "cancelled_non_payment";
}

interface CancelledByUserParams extends BaseEmailParams {
  type: "cancelled_by_user";
}

interface CancellationConfirmedParams extends BaseEmailParams {
  type: "cancellation_confirmed";
  effectiveDate: Date;
}

type SubscriptionEmailParams =
  | RenewalReminderParams
  | RenewalSuccessParams
  | RenewalFailedParams
  | CancelledNonPaymentParams
  | CancelledByUserParams
  | CancellationConfirmedParams;

// ─── Función principal ────────────────────────────────────────────────────────
export async function sendSubscriptionEmail(params: SubscriptionEmailParams): Promise<void> {
  const { subject, html } = buildEmail(params);
  try {
    const resend = await getResendClient();
    const fromEmail = await getEmailFrom();
    const FROM_EMAIL = `EVGreen <${fromEmail}>`;
    await resend.emails.send({ from: FROM_EMAIL, to: params.to, subject, html });
    console.log(`[Email] Enviado: ${params.type} → ${params.to}`);
  } catch (err) {
    console.error(`[Email] Error enviando ${params.type}:`, err);
  }
}

// ─── Builder de emails ────────────────────────────────────────────────────────
function buildEmail(params: SubscriptionEmailParams): { subject: string; html: string } {
  switch (params.type) {
    case "renewal_reminder":   return buildRenewalReminder(params);
    case "renewal_success":    return buildRenewalSuccess(params);
    case "renewal_failed":     return buildRenewalFailed(params);
    case "cancelled_non_payment": return buildCancelledNonPayment(params);
    case "cancelled_by_user":  return buildCancelledByUser(params);
    case "cancellation_confirmed": return buildCancellationConfirmed(params);
  }
}

// ─── Plantilla base HTML ──────────────────────────────────────────────────────
function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EVGreen</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d2b1a 0%,#0a1f14 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;border-bottom:2px solid #1a4d2e;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:10px;display:inline-block;line-height:40px;text-align:center;font-size:20px;">⚡</div>
                <span style="color:#22c55e;font-size:24px;font-weight:700;letter-spacing:-0.5px;">EVGreen</span>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background:#0f1923;padding:40px;border-radius:0 0 16px 16px;">
              ${content}
              <!-- Footer -->
              <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1e2d3d;text-align:center;">
                <p style="color:#4a5568;font-size:13px;margin:0 0 8px;">Green House Project S.A.S. · NIT 901.447.678-0</p>
                <p style="color:#4a5568;font-size:12px;margin:0;">
                  <a href="${APP_URL}/subscription" style="color:#22c55e;text-decoration:none;">Gestionar suscripción</a>
                  &nbsp;·&nbsp;
                  <a href="${APP_URL}/wallet" style="color:#22c55e;text-decoration:none;">Recargar billetera</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:soporte@evgreen.lat" style="color:#22c55e;text-decoration:none;">Soporte</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string, color = "#22c55e"): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">${text}</a>
  </div>`;
}

function infoBox(content: string, borderColor = "#22c55e"): string {
  return `<div style="background:#0d1f2d;border:1px solid ${borderColor};border-left:4px solid ${borderColor};border-radius:10px;padding:20px 24px;margin:20px 0;">
    ${content}
  </div>`;
}

// ─── Recordatorio D-3 ─────────────────────────────────────────────────────────
function buildRenewalReminder(p: RenewalReminderParams): { subject: string; html: string } {
  const shortfall = p.amount - p.walletBalance;
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">🔔 Tu ${p.planName} vence en 3 días</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, te recordamos que tu plan se renovará próximamente.</p>

    ${infoBox(`
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Plan</span>
        <span style="color:#f0f4f8;font-weight:600;">${p.planName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Fecha de renovación</span>
        <span style="color:#f0f4f8;font-weight:600;">${formatDate(p.dueDate)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Valor a cobrar</span>
        <span style="color:#22c55e;font-weight:700;font-size:16px;">${formatCOP(p.amount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#8899aa;font-size:14px;">Saldo en billetera</span>
        <span style="color:${p.hasSufficientBalance ? "#22c55e" : "#f59e0b"};font-weight:600;">${formatCOP(p.walletBalance)}</span>
      </div>
    `)}

    ${p.hasSufficientBalance
      ? `<div style="background:#0d2b1a;border:1px solid #166534;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center;">
          <span style="color:#22c55e;font-size:14px;">✅ Tu billetera tiene saldo suficiente. La renovación se procesará automáticamente.</span>
        </div>`
      : `<div style="background:#2d1b00;border:1px solid #92400e;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <p style="color:#f59e0b;font-weight:600;margin:0 0 6px;">⚠️ Saldo insuficiente</p>
          <p style="color:#d97706;font-size:14px;margin:0;">Necesitas recargar <strong>${formatCOP(shortfall)}</strong> más para asegurar tu renovación automática.</p>
        </div>
        ${ctaButton("Recargar billetera ahora", `${APP_URL}/wallet`, "#f59e0b")}`
    }
  `;

  return {
    subject: `🔔 Tu ${p.planName} EVGreen vence en 3 días`,
    html: baseTemplate(content),
  };
}

// ─── Renovación exitosa ───────────────────────────────────────────────────────
function buildRenewalSuccess(p: RenewalSuccessParams): { subject: string; html: string } {
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">✅ Tu ${p.planName} fue renovado</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, tu suscripción se renovó exitosamente.</p>

    ${infoBox(`
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Plan renovado</span>
        <span style="color:#f0f4f8;font-weight:600;">${p.planName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Monto cobrado</span>
        <span style="color:#22c55e;font-weight:700;font-size:16px;">${formatCOP(p.amount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Método de pago</span>
        <span style="color:#f0f4f8;font-weight:600;">${p.paymentMethod}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Referencia</span>
        <span style="color:#6b7280;font-size:13px;font-family:monospace;">${p.reference}</span>
      </div>
      <div style="display:flex;justify-content:space-between;${p.walletBalance !== undefined ? "margin-bottom:12px;" : ""}">
        <span style="color:#8899aa;font-size:14px;">Próxima renovación</span>
        <span style="color:#f0f4f8;font-weight:600;">${formatDate(p.nextBillingDate)}</span>
      </div>
      ${p.walletBalance !== undefined ? `
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#8899aa;font-size:14px;">Saldo restante</span>
        <span style="color:#22c55e;font-weight:600;">${formatCOP(p.walletBalance)}</span>
      </div>` : ""}
    `)}

    ${ctaButton("Ver mi suscripción", `${APP_URL}/subscription`)}
  `;

  return {
    subject: `✅ ${p.planName} EVGreen renovado exitosamente`,
    html: baseTemplate(content),
  };
}

// ─── Fallo de renovación ──────────────────────────────────────────────────────
function buildRenewalFailed(p: RenewalFailedParams): { subject: string; html: string } {
  const isFinal = p.remainingAttempts === 0;
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">⚠️ No pudimos renovar tu ${p.planName}</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, intentamos renovar tu suscripción pero no fue posible.</p>

    ${infoBox(`
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Plan</span>
        <span style="color:#f0f4f8;font-weight:600;">${p.planName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Valor requerido</span>
        <span style="color:#f0f4f8;font-weight:600;">${formatCOP(p.amount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Saldo en billetera</span>
        <span style="color:#f59e0b;font-weight:600;">${formatCOP(p.walletBalance)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Faltante</span>
        <span style="color:#ef4444;font-weight:700;">${formatCOP(p.shortfall)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#8899aa;font-size:14px;">Intentos</span>
        <span style="color:#f0f4f8;">${p.failedCount} de 3</span>
      </div>
    `, "#f59e0b")}

    ${isFinal
      ? `<div style="background:#2d0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <p style="color:#ef4444;font-weight:600;margin:0 0 6px;">❌ Último intento fallido</p>
          <p style="color:#dc2626;font-size:14px;margin:0;">Tu plan será cancelado en los próximos días si no regularizas el pago. Recarga tu billetera para reactivarlo.</p>
        </div>`
      : `<div style="background:#1a1a00;border:1px solid #713f12;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <p style="color:#f59e0b;font-size:14px;margin:0;">Lo intentaremos de nuevo el <strong>${formatDate(p.nextRetryDate)}</strong>. Recarga tu billetera antes de esa fecha.</p>
        </div>`
    }

    ${ctaButton("Recargar billetera", `${APP_URL}/wallet`, "#f59e0b")}
    <p style="text-align:center;margin-top:8px;"><a href="${APP_URL}/subscription" style="color:#6b7280;font-size:13px;">Gestionar suscripción</a></p>
  `;

  return {
    subject: `⚠️ No pudimos renovar tu ${p.planName} EVGreen`,
    html: baseTemplate(content),
  };
}

// ─── Cancelación por falta de pago ───────────────────────────────────────────
function buildCancelledNonPayment(p: CancelledNonPaymentParams): { subject: string; html: string } {
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">❌ Tu ${p.planName} fue cancelado</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, lamentamos informarte que tu suscripción fue cancelada por falta de pago.</p>

    <div style="background:#2d0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:20px 24px;margin:20px 0;">
      <p style="color:#dc2626;font-size:14px;margin:0;">Realizamos 3 intentos de cobro sin éxito. Tu plan ha sido cancelado y ya no tienes acceso a los beneficios del ${p.planName}.</p>
    </div>

    <p style="color:#8899aa;font-size:14px;margin:20px 0;">¿Quieres volver a disfrutar de los beneficios? Puedes reactivar tu plan en cualquier momento recargando tu billetera.</p>

    ${ctaButton("Reactivar mi plan", `${APP_URL}/subscription`)}
  `;

  return {
    subject: `❌ Tu ${p.planName} EVGreen fue cancelado`,
    html: baseTemplate(content),
  };
}

// ─── Cancelación voluntaria completada ───────────────────────────────────────
function buildCancelledByUser(p: CancelledByUserParams): { subject: string; html: string } {
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">Tu ${p.planName} ha finalizado</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, tu suscripción ha llegado a su fin según lo solicitado.</p>

    <div style="background:#0d1f2d;border:1px solid #1e3a5f;border-radius:10px;padding:20px 24px;margin:20px 0;">
      <p style="color:#8899aa;font-size:14px;margin:0;">Tu plan ha sido cancelado. Ya no se realizarán cobros automáticos. Puedes reactivarlo en cualquier momento.</p>
    </div>

    ${ctaButton("Reactivar mi plan", `${APP_URL}/subscription`)}
  `;

  return {
    subject: `Tu ${p.planName} EVGreen ha finalizado`,
    html: baseTemplate(content),
  };
}

// ─── Confirmación de solicitud de cancelación ─────────────────────────────────
function buildCancellationConfirmed(p: CancellationConfirmedParams): { subject: string; html: string } {
  const content = `
    <h2 style="color:#f0f4f8;font-size:22px;font-weight:700;margin:0 0 8px;">Cancelación programada</h2>
    <p style="color:#8899aa;font-size:15px;margin:0 0 24px;">Hola ${p.userName}, recibimos tu solicitud de cancelación.</p>

    ${infoBox(`
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#8899aa;font-size:14px;">Plan</span>
        <span style="color:#f0f4f8;font-weight:600;">${p.planName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#8899aa;font-size:14px;">Activo hasta</span>
        <span style="color:#22c55e;font-weight:600;">${formatDate(p.effectiveDate)}</span>
      </div>
    `)}

    <p style="color:#8899aa;font-size:14px;margin:16px 0;">Tu plan seguirá activo con todos sus beneficios hasta la fecha indicada. Después no se realizarán más cobros.</p>
    <p style="color:#8899aa;font-size:14px;margin:0;">¿Cambiaste de opinión? Puedes reactivar tu plan antes de esa fecha.</p>

    ${ctaButton("Reactivar mi plan", `${APP_URL}/subscription`)}
  `;

  return {
    subject: `Cancelación de ${p.planName} EVGreen confirmada`,
    html: baseTemplate(content),
  };
}
