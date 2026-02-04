import { Resend } from 'resend';

// Inicializar Resend con la API key
const resend = new Resend(process.env.RESEND_API_KEY || 're_CeRTmETR_MHxYaF2sShjXcmSmZKE5qSzr');

const FROM_EMAIL = 'EVGreen <notificaciones@evgreen.lat>';
const SUPPORT_EMAIL = 'soporte@evgreen.lat';

interface PaymentNotificationData {
  userEmail: string;
  userName: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  newBalance?: number;
}

interface ChargingNotificationData {
  userEmail: string;
  userName: string;
  stationName: string;
  energyKwh: number;
  duration: string;
  cost: number;
  transactionId?: string;
}

// Formatear moneda COP
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Template de email para recarga de billetera exitosa
const walletRechargeTemplate = (data: PaymentNotificationData): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recarga Exitosa - EVGreen</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 255, 136, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #000000; font-size: 28px; font-weight: 700;">
                ⚡ EVGreen
              </h1>
              <p style="margin: 8px 0 0 0; color: #000000; font-size: 14px; opacity: 0.8;">
                Carga el Futuro
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #00ff88; font-size: 24px; font-weight: 600;">
                ¡Recarga Exitosa! ✓
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Hola <strong>${data.userName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #cccccc; font-size: 15px; line-height: 1.6;">
                Tu recarga de billetera ha sido procesada exitosamente. Aquí están los detalles de tu transacción:
              </p>
              
              <!-- Transaction Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">Monto recargado</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #00ff88; font-size: 20px; font-weight: 700;">${formatCurrency(data.amount)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">Método de pago</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #ffffff; font-size: 14px;">${data.paymentMethod}</span>
                        </td>
                      </tr>
                      ${data.transactionId ? `
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">ID de transacción</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #ffffff; font-size: 12px; font-family: monospace;">${data.transactionId}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.newBalance !== undefined ? `
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #888888; font-size: 14px;">Nuevo saldo</span>
                        </td>
                        <td style="padding: 12px 0; text-align: right;">
                          <span style="color: #ffffff; font-size: 18px; font-weight: 600;">${formatCurrency(data.newBalance)}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="https://evgreen.lat/wallet" style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); color: #000000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Ver mi billetera
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #666666; font-size: 13px; line-height: 1.6; text-align: center;">
                ¿Tienes preguntas? Contáctanos en <a href="mailto:${SUPPORT_EMAIL}" style="color: #00ff88; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 24px 30px; text-align: center; border-top: 1px solid #222222;">
              <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px;">
                © 2026 EVGreen. Todos los derechos reservados.
              </p>
              <p style="margin: 0; color: #444444; font-size: 11px;">
                Bogotá, Colombia | <a href="https://evgreen.lat" style="color: #00ff88; text-decoration: none;">evgreen.lat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Template de email para sesión de carga completada
const chargingCompleteTemplate = (data: ChargingNotificationData): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carga Completada - EVGreen</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 255, 136, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #000000; font-size: 28px; font-weight: 700;">
                ⚡ EVGreen
              </h1>
              <p style="margin: 8px 0 0 0; color: #000000; font-size: 14px; opacity: 0.8;">
                Carga el Futuro
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #00ff88; font-size: 24px; font-weight: 600;">
                ¡Carga Completada! 🔋
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Hola <strong>${data.userName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #cccccc; font-size: 15px; line-height: 1.6;">
                Tu sesión de carga ha finalizado. Aquí está el resumen:
              </p>
              
              <!-- Charging Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">Estación</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${data.stationName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">Energía entregada</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #00ff88; font-size: 18px; font-weight: 700;">${data.energyKwh.toFixed(2)} kWh</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333;">
                          <span style="color: #888888; font-size: 14px;">Duración</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #333333; text-align: right;">
                          <span style="color: #ffffff; font-size: 14px;">${data.duration}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #888888; font-size: 14px;">Costo total</span>
                        </td>
                        <td style="padding: 12px 0; text-align: right;">
                          <span style="color: #ffffff; font-size: 20px; font-weight: 700;">${formatCurrency(data.cost)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Environmental Impact -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a2f1a 0%, #0f1f0f 100%); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #00ff88; font-size: 14px; font-weight: 600;">
                      🌱 Impacto Ambiental
                    </p>
                    <p style="margin: 0; color: #cccccc; font-size: 13px;">
                      Ahorraste aproximadamente <strong style="color: #00ff88;">${(data.energyKwh * 0.4).toFixed(1)} kg de CO₂</strong> con esta carga
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="https://evgreen.lat/history" style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); color: #000000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Ver historial de cargas
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #666666; font-size: 13px; line-height: 1.6; text-align: center;">
                ¡Gracias por elegir EVGreen y contribuir a un futuro más limpio! 💚
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 24px 30px; text-align: center; border-top: 1px solid #222222;">
              <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px;">
                © 2026 EVGreen. Todos los derechos reservados.
              </p>
              <p style="margin: 0; color: #444444; font-size: 11px;">
                Bogotá, Colombia | <a href="https://evgreen.lat" style="color: #00ff88; text-decoration: none;">evgreen.lat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Enviar notificación de recarga de billetera
export async function sendWalletRechargeNotification(data: PaymentNotificationData): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      subject: `✓ Recarga exitosa de ${formatCurrency(data.amount)} - EVGreen`,
      html: walletRechargeTemplate(data),
    });

    if (error) {
      console.error('[PaymentNotification] Error sending wallet recharge email:', error);
      return false;
    }

    console.log(`[PaymentNotification] Wallet recharge notification sent to ${data.userEmail}`);
    return true;
  } catch (error) {
    console.error('[PaymentNotification] Exception sending wallet recharge email:', error);
    return false;
  }
}

// Enviar notificación de carga completada
export async function sendChargingCompleteNotification(data: ChargingNotificationData): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      subject: `🔋 Carga completada: ${data.energyKwh.toFixed(1)} kWh en ${data.stationName} - EVGreen`,
      html: chargingCompleteTemplate(data),
    });

    if (error) {
      console.error('[PaymentNotification] Error sending charging complete email:', error);
      return false;
    }

    console.log(`[PaymentNotification] Charging complete notification sent to ${data.userEmail}`);
    return true;
  } catch (error) {
    console.error('[PaymentNotification] Exception sending charging complete email:', error);
    return false;
  }
}

export { PaymentNotificationData, ChargingNotificationData };
