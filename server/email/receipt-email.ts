import { getResendClient } from "./resend-client";
/**
 * Servicio de envío de recibos de carga por email
 * Usa Resend como proveedor de email
 */


const FROM_EMAIL = "EVGreen <admin@greenhproject.com>";
const BCC_EMAIL = "admin@greenhproject.com"; // Copia para trazabilidad

interface ReceiptEmailData {
  transactionId: number;
  userName: string;
  userEmail: string;
  userDocumentType?: string | null;
  userDocumentNumber?: string | null;
  stationName: string;
  stationAddress: string;
  stationCity: string;
  startTime: Date;
  endTime: Date;
  kwhConsumed: number;
  appliedPricePerKwh: number;
  energyCost: number;
  timeCost: number;
  sessionCost: number;
  overstayCost: number;
  totalCost: number;
  chargeMode: string;
  startMethod: string;
  stopReason: string;
  durationMinutes: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function getChargeModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    full_charge: "Carga completa",
    fixed_amount: "Monto fijo",
    percentage: "Porcentaje",
  };
  return labels[mode] || mode || "Carga completa";
}

function getStartMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    QR: "Código QR",
    NFC: "Tarjeta NFC",
    APP: "Aplicación",
    RFID: "RFID",
    REMOTE: "Remoto",
  };
  return labels[method] || method || "App";
}

function buildReceiptLineItems(data: ReceiptEmailData): { concept: string; detail: string; amount: number }[] {
  const items: { concept: string; detail: string; amount: number }[] = [];

  if (data.energyCost > 0 || data.kwhConsumed > 0) {
    const detail = data.appliedPricePerKwh > 0
      ? `${data.kwhConsumed.toFixed(2)} kWh x ${formatCurrency(data.appliedPricePerKwh)}/kWh`
      : `${data.kwhConsumed.toFixed(2)} kWh`;
    items.push({ concept: "Energía consumida", detail, amount: data.energyCost });
  }

  if (data.timeCost > 0) {
    items.push({ concept: "Cargo por tiempo", detail: "Tarifa por minuto", amount: data.timeCost });
  }

  if (data.sessionCost > 0) {
    items.push({ concept: "Cargo por conexión", detail: "Tarifa fija por sesión", amount: data.sessionCost });
  }

  if (data.overstayCost > 0) {
    items.push({ concept: "Penalización sobreestadía", detail: "Tiempo excedido post-carga", amount: data.overstayCost });
  }

  if (items.length === 0) {
    items.push({ concept: "Servicio de carga", detail: `${data.kwhConsumed.toFixed(2)} kWh`, amount: data.totalCost });
  }

  return items;
}

function buildReceiptHTML(data: ReceiptEmailData): string {
  const items = buildReceiptLineItems(data);
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 600; color: #1a1a1a; font-size: 14px;${item.concept.includes("Penalización") ? " color: #dc2626;" : ""}">${item.concept}</div>
        <div style="font-size: 12px; color: #888; margin-top: 2px;">${item.detail}</div>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; font-size: 14px;${item.concept.includes("Penalización") ? " color: #dc2626;" : " color: #1a1a1a;"}">${formatCurrency(item.amount)}</td>
    </tr>
  `).join("");

  const clientInfoHTML = data.userDocumentType && data.userDocumentNumber
    ? `<p style="margin: 4px 0; color: #666; font-size: 13px;">${data.userDocumentType}: ${data.userDocumentNumber}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo de Carga EVGreen #${data.transactionId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981, #0d9488); padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px;">⚡ EVGreen</h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Green House Project S.A.S. | NIT: 901.447.678-0</p>
    </div>

    <!-- Recibo badge -->
    <div style="text-align: center; padding: 20px 24px 0;">
      <div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 20px; padding: 6px 16px;">
        <span style="color: #16a34a; font-weight: 600; font-size: 14px;">Recibo de Carga #${data.transactionId}</span>
      </div>
    </div>

    <div style="padding: 20px 24px;">
      
      <!-- Cliente -->
      <div style="margin-bottom: 20px;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a; font-size: 15px;">Cliente: ${data.userName}</p>
        <p style="margin: 4px 0; color: #666; font-size: 13px;">${data.userEmail}</p>
        ${clientInfoHTML}
      </div>

      <!-- Estación -->
      <div style="background: #f8fafc; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: flex-start;">
          <div style="width: 36px; height: 36px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="font-size: 16px;">📍</span>
          </div>
          <div>
            <p style="margin: 0; font-weight: 600; color: #1a1a1a; font-size: 15px;">${data.stationName}</p>
            <p style="margin: 3px 0 0; color: #888; font-size: 13px;">${data.stationAddress || data.stationCity}</p>
          </div>
        </div>
      </div>

      <!-- Métricas principales -->
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; background: #eff6ff; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #2563eb;">${data.kwhConsumed.toFixed(2)}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">kWh consumidos</div>
        </div>
        <div style="flex: 1; background: #faf5ff; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #9333ea;">${formatDuration(data.durationMinutes)}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Duración</div>
        </div>
      </div>

      <!-- Info de sesión -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #888;">Fecha y hora</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1a1a1a;">${formatDate(data.startTime)}</td>
        </tr>
        ${data.appliedPricePerKwh > 0 ? `
        <tr>
          <td style="padding: 6px 0; color: #888;">Tarifa aplicada</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1a1a1a;">${formatCurrency(data.appliedPricePerKwh)}/kWh</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 6px 0; color: #888;">Modo de carga</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1a1a1a;">${getChargeModeLabel(data.chargeMode)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888;">Método de inicio</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1a1a1a;">${getStartMethodLabel(data.startMethod)}</td>
        </tr>
      </table>

      <!-- Detalle del cobro -->
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px; font-size: 15px; color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 8px;">Detalle del Cobro</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHTML}
        </table>
      </div>

      <!-- Total -->
      <div style="background: #f0fdf4; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 16px; font-weight: 700; color: #1a1a1a;">TOTAL</span>
        <span style="font-size: 24px; font-weight: 700; color: #10b981;">${formatCurrency(data.totalCost)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #888; font-size: 12px;">Gracias por usar EVGreen para cargar tu vehículo eléctrico.</p>
      <p style="margin: 6px 0 0; color: #aaa; font-size: 11px;">www.evgreen.lat | Energía para recarga de VE excluida de IVA (Concepto DIAN 840 de 2021)</p>
      <p style="margin: 6px 0 0; color: #aaa; font-size: 11px;">Green House Project S.A.S. | NIT: 901.447.678-0</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendChargingReceiptEmail(data: ReceiptEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.userEmail) {
      console.log(`[ReceiptEmail] No email for user, skipping receipt for tx=${data.transactionId}`);
      return { success: false, error: "No email address" };
    }

    const html = buildReceiptHTML(data);
    const subject = `Recibo de Carga EVGreen #${data.transactionId} - ${formatCurrency(data.totalCost)}`;

    const result = await (await getResendClient()).emails.send({
      from: FROM_EMAIL,
      to: data.userEmail,
      bcc: BCC_EMAIL,
      subject,
      html,
    });

    if (result.error) {
      console.error(`[ReceiptEmail] Resend error for tx=${data.transactionId}:`, result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[ReceiptEmail] Receipt sent to ${data.userEmail} for tx=${data.transactionId}, emailId=${result.data?.id}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[ReceiptEmail] Error sending receipt for tx=${data.transactionId}:`, err);
    return { success: false, error: err.message };
  }
}
