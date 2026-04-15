/**
 * EVGreen - Servicio de Email de Bienvenida para Inversionistas
 * Envía emails premium HTML usando Resend cuando se confirma una inversión
 */
import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";
import * as db from "../db";

// Resend API key - same pattern as ticket-email-service
const resendApiKey = process.env.RESEND_API_KEY || "re_VBTGfE43_MrkUuQ96ji8kyvY4ZrfEiy9b";
const resend = new Resend(resendApiKey);

const FROM_EMAIL = "EVGreen <admin@evgreen.lat>";
const CC_EMAIL = "gerencia@greenhproject.com"; // Copia para trazabilidad

interface WelcomeEmailData {
  investorName: string;
  investorEmail: string;
  investmentAmount: number; // COP
  investmentType: "individual" | "collective";
  stationName?: string;
  projectName?: string;
  participationPercent?: number;
  onboardingUrl: string;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function generateWelcomeEmailHTML(data: WelcomeEmailData): string {
  const isIndividual = data.investmentType === "individual";
  
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a EVGreen</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">
          
          <!-- Header con logo y gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%); border-radius: 16px 16px 0 0; padding: 48px 40px; text-align: center;">
              <!-- Logo EVGreen -->
              <div style="margin-bottom: 24px;">
                <span style="font-size: 42px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                  <span style="color: #ffffff;">EV</span><span style="color: #d1fae5;">Green</span>
                </span>
              </div>
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">&#9889;</span>
              </div>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; line-height: 1.3;">
                &#127881; Bienvenido al futuro de la<br>movilidad el&eacute;ctrica
              </h1>
              <p style="color: rgba(255,255,255,0.85); font-size: 16px; margin: 0; font-weight: 400;">
                Tu inversi&oacute;n ha sido confirmada exitosamente
              </p>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="background-color: #111111; padding: 40px;">
              
              <!-- Saludo personalizado -->
              <p style="color: #e5e5e5; font-size: 18px; margin: 0 0 24px; line-height: 1.6;">
                Hola <strong style="color: #34d399;">${data.investorName}</strong>,
              </p>
              <p style="color: #a3a3a3; font-size: 15px; margin: 0 0 32px; line-height: 1.7;">
                Nos emociona darte la bienvenida como ${isIndividual ? "propietario de estaci&oacute;n" : "inversionista"} en la red EVGreen. 
                Tu compromiso con la movilidad sostenible est&aacute; transformando Colombia. &#127470;&#127476;
              </p>

              <!-- Card de resumen de inversión -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 28px;">
                    <p style="color: #6ee7b7; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px;">
                      Resumen de tu inversi&oacute;n
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                          <span style="color: #a7f3d0; font-size: 13px;">Tipo de inversi&oacute;n</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
                          <span style="color: #ffffff; font-size: 14px; font-weight: 600;">
                            ${isIndividual ? "Estaci&oacute;n Individual" : "Estaci&oacute;n Colectiva"}
                          </span>
                        </td>
                      </tr>
                      ${data.stationName || data.projectName ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                          <span style="color: #a7f3d0; font-size: 13px;">${isIndividual ? "Estaci&oacute;n" : "Proyecto"}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
                          <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${data.stationName || data.projectName}</span>
                        </td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                          <span style="color: #a7f3d0; font-size: 13px;">Monto invertido</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">
                          <span style="color: #34d399; font-size: 18px; font-weight: 700;">${formatCOP(data.investmentAmount)}</span>
                        </td>
                      </tr>
                      ${data.participationPercent ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #a7f3d0; font-size: 13px;">Participaci&oacute;n</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${data.participationPercent}%</span>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Siguiente paso: Onboarding -->
              <p style="color: #e5e5e5; font-size: 16px; margin: 0 0 8px; font-weight: 600;">
                &#128640; Tu pr&oacute;ximo paso
              </p>
              <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 24px; line-height: 1.7;">
                Hemos preparado un proceso de configuraci&oacute;n r&aacute;pido para que puedas empezar a monitorear 
                tu inversi&oacute;n de inmediato. Solo toma 3 minutos:
              </p>

              <!-- Pasos del onboarding -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #059669; border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="color: white; font-size: 14px; font-weight: 700;">1</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <span style="color: #e5e5e5; font-size: 14px; font-weight: 500;">Completa tu perfil personal y datos de empresa</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #059669; border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="color: white; font-size: 14px; font-weight: 700;">2</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <span style="color: #e5e5e5; font-size: 14px; font-weight: 500;">Registra tus datos bancarios para recibir rendimientos</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 36px; height: 36px; background: #059669; border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="color: white; font-size: 14px; font-weight: 700;">3</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <span style="color: #e5e5e5; font-size: 14px; font-weight: 500;">Explora tu dashboard y empieza a monitorear</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${data.onboardingUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 48px; border-radius: 12px; letter-spacing: 0.5px;">
                      Completar mi configuraci&oacute;n &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Beneficios -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1a1a1a; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #6ee7b7; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px;">
                      Lo que puedes hacer en tu portal
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #34d399; font-size: 14px;">&#10003;</span>
                          <span style="color: #d4d4d4; font-size: 13px; padding-left: 8px;">Monitoreo en tiempo real de tus estaciones</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #34d399; font-size: 14px;">&#10003;</span>
                          <span style="color: #d4d4d4; font-size: 13px; padding-left: 8px;">Reportes de ingresos y estad&iacute;sticas detalladas</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #34d399; font-size: 14px;">&#10003;</span>
                          <span style="color: #d4d4d4; font-size: 13px; padding-left: 8px;">Liquidaciones autom&aacute;ticas y transparentes</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #34d399; font-size: 14px;">&#10003;</span>
                          <span style="color: #d4d4d4; font-size: 13px; padding-left: 8px;">Asistente de IA para an&aacute;lisis predictivo</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <span style="color: #34d399; font-size: 14px;">&#10003;</span>
                          <span style="color: #d4d4d4; font-size: 13px; padding-left: 8px;">Exportaci&oacute;n de reportes en Excel y PDF</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Soporte -->
              <p style="color: #737373; font-size: 13px; margin: 0; line-height: 1.7; text-align: center;">
                &iquest;Tienes preguntas? Escr&iacute;benos a 
                <a href="mailto:gerencia@greenhproject.com" style="color: #34d399; text-decoration: none;">gerencia@greenhproject.com</a>
                o ll&aacute;manos al <a href="tel:+573001234567" style="color: #34d399; text-decoration: none;">+57 300 123 4567</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 32px 40px; text-align: center; border-top: 1px solid #262626;">
              <p style="color: #525252; font-size: 12px; margin: 0 0 8px;">
                &copy; ${new Date().getFullYear()} EVGreen by Green House Project S.A.S.
              </p>
              <p style="color: #525252; font-size: 11px; margin: 0;">
                NIT: 901.447.678-0 | Bogot&aacute;, Colombia
              </p>
              <p style="color: #404040; font-size: 11px; margin: 12px 0 0;">
                Este email fue enviado a ${data.investorEmail} porque realizaste una inversi&oacute;n en EVGreen.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  try {
    const html = generateWelcomeEmailHTML(data);
    const subject = `Bienvenido a EVGreen, ${data.investorName} - Tu inversion ha sido confirmada`;
    
    // Send to investor - using buildEmailParams like ticket-email-service
    const recipients = [data.investorEmail, CC_EMAIL];
    
    for (const email of recipients) {
      try {
        await resend.emails.send(buildEmailParams({
          from: FROM_EMAIL,
          to: email,
          subject,
          html,
          replyTo: "gerencia@greenhproject.com",
        }));
        console.log(`[Onboarding Email] Welcome email sent to ${email}`);
      } catch (err) {
        console.error(`[Onboarding Email] Failed to send to ${email}:`, err);
      }
    }

    return true;
  } catch (error) {
    console.error(`[Onboarding Email] Failed to send welcome email to ${data.investorEmail}:`, error);
    return false;
  }
}

/**
 * Trigger completo: enviar email + marcar en BD
 */
export async function triggerInvestorWelcome(
  userId: number,
  investmentData: Omit<WelcomeEmailData, "onboardingUrl">
): Promise<boolean> {
  try {
    // Construir URL de onboarding
    const baseUrl = process.env.VITE_APP_URL || "https://app.evgreen.lat";
    const onboardingUrl = `${baseUrl}/investor/onboarding`;

    // Enviar email
    const emailSent = await sendWelcomeEmail({
      ...investmentData,
      onboardingUrl,
    });

    // Marcar en BD que se envió el email y se inició el onboarding
    if (emailSent) {
      await db.updateUser(userId, {
        welcomeEmailSent: true,
        onboardingStep: 1,
        onboardingStartedAt: new Date(),
      } as any);
    }

    return emailSent;
  } catch (error) {
    console.error("[Onboarding] Failed to trigger investor welcome:", error);
    return false;
  }
}
