/**
 * Email de bienvenida para nuevas organizaciones SaaS activadas
 * Enviado automáticamente al activar una org o al crear una con usuario asignado
 */
import { Resend } from "resend";

const resend = new Resend(process.env.Resend ?? "");
const FROM_EMAIL = "EVGreen <admin@greenhproject.com>";
const BCC_EMAIL = "admin@greenhproject.com";

export interface OrgWelcomeEmailData {
  orgName: string;
  orgSlug: string;
  plan: "starter" | "professional" | "enterprise";
  contactName: string;
  contactEmail: string;
  portalUrl: string;
  stationCount: number;
  ocppUrl?: string;
  adminEmail?: string;
  adminPassword?: string; // Solo si se crea cuenta nueva
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  starter: "#6b7280",
  professional: "#8b5cf6",
  enterprise: "#f59e0b",
};

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Hasta 10 cargadores",
    "CSMS completo (OCPP 1.6/2.0)",
    "Dashboard de administración",
    "App EVGreen compartida",
    "Soporte por tickets",
  ],
  professional: [
    "Hasta 50 cargadores",
    "CSMS completo (OCPP 1.6/2.0)",
    "Dashboard completo + Analítica",
    "IA de precios dinámicos",
    "Reportes avanzados (PDF + Excel)",
    "Soporte prioritario",
  ],
  enterprise: [
    "Cargadores ilimitados",
    "CSMS completo (OCPP 1.6/2.0)",
    "Dashboard personalizado",
    "IA completa + personalizada",
    "API completa + Webhooks",
    "Facturación con NIT propio",
    "Soporte dedicado",
  ],
};

export async function sendOrgWelcomeEmail(data: OrgWelcomeEmailData): Promise<boolean> {
  const planLabel = PLAN_LABELS[data.plan] || data.plan;
  const planColor = PLAN_COLORS[data.plan] || "#22c55e";
  const features = PLAN_FEATURES[data.plan] || PLAN_FEATURES.starter;
  const host = data.portalUrl.replace(/^https?:\/\//, "").split("/")[0];
  const wsUrl = data.ocppUrl || `wss://${host}/ocpp/{CHARGE_POINT_ID}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a EVGreen - ${data.orgName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#052e16 100%);padding:40px 40px 32px;text-align:center;">
              <div style="display:inline-block;background:#22c55e;border-radius:12px;padding:12px 20px;margin-bottom:20px;">
                <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">⚡ EVGreen</span>
              </div>
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;line-height:1.2;">¡Bienvenido a la red EVGreen!</h1>
              <p style="margin:12px 0 0;color:#86efac;font-size:16px;">${data.orgName} ya está activo en la plataforma</p>
            </td>
          </tr>

          <!-- Plan Badge -->
          <tr>
            <td style="padding:24px 40px 0;text-align:center;">
              <span style="display:inline-block;background:${planColor}22;color:${planColor};border:1px solid ${planColor}44;border-radius:20px;padding:6px 20px;font-size:14px;font-weight:600;">
                Plan ${planLabel} activado ✓
              </span>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 40px;">
              <p style="margin:0;font-size:16px;color:#d1d5db;line-height:1.6;">
                Hola <strong style="color:#fff;">${data.contactName}</strong>,
              </p>
              <p style="margin:12px 0 0;font-size:15px;color:#9ca3af;line-height:1.7;">
                Tu plataforma de gestión de carga eléctrica está lista. Tienes acceso completo al portal de administración con <strong style="color:#22c55e;">${data.stationCount} estación${data.stationCount !== 1 ? "es" : ""} asignada${data.stationCount !== 1 ? "s" : ""}</strong>.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 40px 24px;text-align:center;">
              <a href="${data.portalUrl}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                Acceder a mi portal →
              </a>
              <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">${data.portalUrl}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="height:1px;background:#1f2937;"></div></td></tr>

          <!-- Steps -->
          <tr>
            <td style="padding:28px 40px;">
              <h2 style="margin:0 0 20px;color:#fff;font-size:18px;font-weight:600;">🚀 Primeros pasos para operar</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 14px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;height:32px;background:#22c55e;border-radius:50%;text-align:center;vertical-align:middle;font-weight:700;color:#fff;font-size:14px;">1</td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">Accede a tu portal</p>
                          <p style="margin:2px 0 0;color:#9ca3af;font-size:13px;">Inicia sesión con tu cuenta en el enlace de arriba</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;height:32px;background:#3b82f6;border-radius:50%;text-align:center;vertical-align:middle;font-weight:700;color:#fff;font-size:14px;">2</td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">Conecta tus cargadores</p>
                          <p style="margin:2px 0 0;color:#9ca3af;font-size:13px;">En Estaciones → Configurar → Tab OCPP encontrarás las credenciales para cada cargador</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;height:32px;background:#8b5cf6;border-radius:50%;text-align:center;vertical-align:middle;font-weight:700;color:#fff;font-size:14px;">3</td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">Configura tus tarifas</p>
                          <p style="margin:2px 0 0;color:#9ca3af;font-size:13px;">Define el precio por kWh para cada estación desde el portal</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:32px;height:32px;background:#f59e0b;border-radius:50%;text-align:center;vertical-align:middle;font-weight:700;color:#fff;font-size:14px;">4</td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">¡Listo para operar!</p>
                          <p style="margin:2px 0 0;color:#9ca3af;font-size:13px;">Los conductores ya pueden cargar sus vehículos en tus estaciones</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="height:1px;background:#1f2937;"></div></td></tr>

          <!-- OCPP Credentials -->
          <tr>
            <td style="padding:28px 40px;">
              <h2 style="margin:0 0 16px;color:#fff;font-size:18px;font-weight:600;">🔌 URL de conexión OCPP</h2>
              <p style="margin:0 0 12px;color:#9ca3af;font-size:14px;">El técnico instalador necesita esta URL para configurar cada cargador físico:</p>
              <div style="background:#0f172a;border:1px solid #22c55e33;border-radius:10px;padding:16px;font-family:monospace;font-size:13px;color:#86efac;word-break:break-all;">
                ${wsUrl}
              </div>
              <p style="margin:10px 0 0;color:#6b7280;font-size:12px;">Reemplaza <code style="color:#fbbf24;">{CHARGE_POINT_ID}</code> con el ID OCPP de cada cargador. Encuéntralo en el portal: Estaciones → Configurar → Tab OCPP.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="height:1px;background:#1f2937;"></div></td></tr>

          <!-- Plan Features -->
          <tr>
            <td style="padding:28px 40px;">
              <h2 style="margin:0 0 16px;color:#fff;font-size:18px;font-weight:600;">✅ Incluido en tu plan ${planLabel}</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${features.map(f => `
                <tr>
                  <td style="padding:5px 0;">
                    <span style="color:#22c55e;margin-right:10px;font-size:16px;">✓</span>
                    <span style="color:#d1d5db;font-size:14px;">${f}</span>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="background:#1f2937;border-radius:10px;padding:16px 20px;">
                <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
                  ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@evgreen.lat" style="color:#22c55e;text-decoration:none;">soporte@evgreen.lat</a> o abre un ticket desde tu portal en <strong>Soporte / Tickets</strong>. Nuestro equipo responde en menos de 24 horas hábiles.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d1117;padding:24px 40px;text-align:center;border-top:1px solid #1f2937;">
              <p style="margin:0;color:#4b5563;font-size:12px;">
                © ${new Date().getFullYear()} EVGreen · Green House Project S.A.S. · NIT 901.447.678-0
              </p>
              <p style="margin:6px 0 0;color:#374151;font-size:11px;">
                Este correo fue enviado a ${data.contactEmail} porque tu organización fue activada en la plataforma EVGreen.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.contactEmail,
      bcc: BCC_EMAIL,
      subject: `🎉 ¡${data.orgName} ya está activo en EVGreen! — Tus credenciales de acceso`,
      html,
    });
    if (result.error) {
      console.error("[OrgWelcomeEmail] Resend error:", result.error);
      return false;
    }
    console.log("[OrgWelcomeEmail] Sent to", data.contactEmail, "id:", result.data?.id);
    return true;
  } catch (err) {
    console.error("[OrgWelcomeEmail] Exception:", err);
    return false;
  }
}
