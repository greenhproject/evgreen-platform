/**
 * Servicio de email para cotizaciones EVGreen
 * Envía cotizaciones con diseño HTML premium y PDF adjunto
 */

interface QuoteEmailData {
  clientName: string;
  clientEmail: string;
  quoteNumber: string;
  total: number;
  advisorName: string | null;
  publicUrl: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  expiresAt: Date | string | null;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Genera el HTML del email de cotización
 */
export function generateQuoteEmailHTML(data: QuoteEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${data.quoteNumber} - EVGreen</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header Verde -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px 40px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">⚡ EVGreen</h1>
                    <p style="margin: 4px 0 0; color: #d1fae5; font-size: 13px;">Estaciones de Carga Inteligentes</p>
                  </td>
                  <td align="right">
                    <p style="margin: 0; color: #d1fae5; font-size: 12px;">Cotización</p>
                    <p style="margin: 4px 0 0; color: #ffffff; font-size: 18px; font-weight: 700; font-family: monospace;">${data.quoteNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <h2 style="margin: 0 0 12px; color: #111827; font-size: 20px;">
                Hola ${data.clientName.split(" ")[0]},
              </h2>
              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                Es un placer presentarle nuestra propuesta comercial para su estación de carga de vehículos eléctricos. 
                En EVGreen nos especializamos en soluciones de carga inteligentes que generan ingresos desde el primer día.
              </p>
            </td>
          </tr>

          <!-- Resumen de la Cotización -->
          <tr>
            <td style="padding: 24px 40px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Inversión Total</p>
                          <p style="margin: 4px 0 0; color: #059669; font-size: 28px; font-weight: 700;">${formatCOP(data.total)}</p>
                        </td>
                        <td align="right" valign="bottom">
                          <p style="margin: 0; color: #6b7280; font-size: 12px;">Válida hasta</p>
                          <p style="margin: 4px 0 0; color: #374151; font-size: 14px; font-weight: 600;">${formatDate(data.expiresAt)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Beneficios Clave -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">¿Por qué EVGreen?</h3>
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 24px; vertical-align: top;"><span style="color: #10b981; font-weight: bold;">✓</span></td>
                        <td style="color: #374151; font-size: 14px;">Instalación <strong>llave en mano</strong> — usted no se preocupa por nada</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 24px; vertical-align: top;"><span style="color: #10b981; font-weight: bold;">✓</span></td>
                        <td style="color: #374151; font-size: 14px;"><strong>70% del margen neto</strong> para usted como propietario</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 24px; vertical-align: top;"><span style="color: #10b981; font-weight: bold;">✓</span></td>
                        <td style="color: #374151; font-size: 14px;">Operación, monitoreo y <strong>soporte 24/7</strong> incluido</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 24px; vertical-align: top;"><span style="color: #10b981; font-weight: bold;">✓</span></td>
                        <td style="color: #374151; font-size: 14px;">Tecnología de <strong>inteligencia artificial</strong> para optimizar ingresos</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px;" align="center">
              <table cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #059669, #10b981); border-radius: 8px;">
                    <a href="${data.publicUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">
                      Ver Cotización Completa →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px;">
                También adjuntamos el PDF de la cotización para su comodidad.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <p style="margin: 0; color: #374151; font-size: 13px; font-weight: 600;">${data.companyName}</p>
                    <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">
                      ${data.companyPhone ? `📞 ${data.companyPhone}` : ''}
                      ${data.companyEmail ? ` · ✉️ ${data.companyEmail}` : ''}
                    </p>
                    ${data.companyWebsite ? `<p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">🌐 ${data.companyWebsite}</p>` : ''}
                  </td>
                  <td align="right" valign="top">
                    ${data.advisorName ? `<p style="margin: 0; color: #6b7280; font-size: 12px;">Su asesor:</p><p style="margin: 2px 0 0; color: #374151; font-size: 13px; font-weight: 600;">${data.advisorName}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 16px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Esta cotización fue generada automáticamente por EVGreen. Si no solicitó esta información, puede ignorar este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Genera el asunto del email
 */
export function generateQuoteEmailSubject(data: { quoteNumber: string; clientName: string }): string {
  return `Cotización ${data.quoteNumber} — Estación de Carga EVGreen para ${data.clientName}`;
}
