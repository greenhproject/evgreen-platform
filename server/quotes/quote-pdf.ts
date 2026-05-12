/**
 * Generación de PDF profesional para cotizaciones EVGreen
 * Usa jsPDF para crear un documento ejecutivo con diseño premium
 */

interface QuotePDFData {
  quoteNumber: string;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientCompany: string | null;
  clientCity: string | null;
  clientNotes: string | null;
  advisorName: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: Array<{
    productName: string;
    productPowerKw: string;
    productChargeType: string;
    productConnector: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    includesTransformer: boolean;
    cableMetersIncluded: number;
  }>;
  settings: {
    companyName: string;
    companyNit: string;
    companyPhone: string;
    companyEmail: string;
    companyWebsite: string;
    evgreenFeePercent: number;
    ownerSharePercent: number;
    headerMessage: string;
    footerMessage: string;
    termsAndConditions: string;
    exclusions: string;
    benefitsDescription: string;
  };
  publicUrl: string;
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
 * Genera el HTML de la cotización para conversión a PDF
 */
export function generateQuoteHTML(data: QuotePDFData): string {
  let benefits: string[] = [];
  try {
    benefits = data.settings.benefitsDescription ? JSON.parse(data.settings.benefitsDescription) : [];
  } catch { benefits = []; }

  const itemsRows = data.items.map((item) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.productName}</strong><br/>
        <span style="color: #6b7280; font-size: 12px;">${item.productPowerKw} kW · ${item.productChargeType} · ${item.productConnector}</span>
        ${item.includesTransformer ? '<br/><span style="color: #3b82f6; font-size: 11px;">✓ Incluye transformador</span>' : ''}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCOP(item.unitPrice)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCOP(item.lineTotal)}</td>
    </tr>
  `).join("");

  const benefitsList = benefits.map((b) => `
    <li style="padding: 4px 0; display: flex; align-items: flex-start; gap: 8px;">
      <span style="color: #10b981; font-weight: bold;">⚡</span>
      <span>${b}</span>
    </li>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #10b981; }
    .logo-section h1 { font-size: 28px; color: #10b981; margin-bottom: 4px; }
    .logo-section p { color: #6b7280; font-size: 13px; }
    .quote-info { text-align: right; }
    .quote-info .number { font-size: 18px; font-weight: 700; color: #1f2937; font-family: monospace; }
    .quote-info .date { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .title-section { margin-bottom: 30px; }
    .title-section h2 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .title-section .subtitle { color: #10b981; font-size: 16px; }
    .client-info { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .client-info h3 { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .client-grid .field { font-size: 14px; }
    .client-grid .label { color: #6b7280; }
    .client-grid .value { font-weight: 600; }
    .intro-message { font-size: 15px; color: #374151; margin-bottom: 30px; padding-left: 16px; border-left: 4px solid #10b981; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { background: #111827; color: white; padding: 12px 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:first-child { border-radius: 8px 0 0 0; text-align: left; }
    thead th:last-child { border-radius: 0 8px 0 0; }
    .totals { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .total-row { font-size: 22px; font-weight: 700; color: #059669; padding-top: 8px; border-top: 2px solid #a7f3d0; margin-top: 8px; }
    .section { margin-bottom: 30px; }
    .section h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #111827; display: flex; align-items: center; gap: 8px; }
    .includes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .includes-grid .item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
    .includes-grid .item .check { color: #10b981; font-weight: bold; }
    .model-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    .model-shares { display: flex; gap: 20px; margin-bottom: 16px; }
    .share-item { flex: 1; text-align: center; padding: 12px; border-radius: 8px; }
    .share-item.owner { background: #ecfdf5; border: 1px solid #a7f3d0; }
    .share-item.evgreen { background: #f3f4f6; border: 1px solid #e5e7eb; }
    .share-item .percent { font-size: 28px; font-weight: 700; }
    .share-item.owner .percent { color: #059669; }
    .share-item .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .benefits-list { list-style: none; padding: 0; font-size: 13px; color: #374151; }
    .exclusions-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; font-size: 13px; color: #92400e; }
    .terms-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 12px; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .footer .company { font-size: 13px; color: #6b7280; }
    .footer .contact { font-size: 12px; color: #6b7280; }
    .validity-badge { display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .online-link { text-align: center; margin-top: 20px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 12px; color: #6b7280; }
    .online-link a { color: #059669; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        <h1>⚡ EVGreen</h1>
        <p>Estaciones de Carga Inteligentes</p>
        <p style="font-size: 11px; margin-top: 4px;">${data.settings.companyName} · NIT: ${data.settings.companyNit}</p>
      </div>
      <div class="quote-info">
        <div class="number">${data.quoteNumber}</div>
        <div class="date">${formatDate(data.createdAt)}</div>
        <div style="margin-top: 8px;">
          <span class="validity-badge">Válida hasta: ${formatDate(data.expiresAt)}</span>
        </div>
      </div>
    </div>

    <!-- Título -->
    <div class="title-section">
      <h2>Propuesta Comercial</h2>
      <div class="subtitle">Estación de Carga para Vehículos Eléctricos</div>
    </div>

    <!-- Datos del Cliente -->
    <div class="client-info">
      <h3>Preparada para</h3>
      <div class="client-grid">
        <div class="field"><span class="label">Nombre: </span><span class="value">${data.clientName}</span></div>
        <div class="field"><span class="label">Email: </span><span class="value">${data.clientEmail}</span></div>
        ${data.clientCompany ? `<div class="field"><span class="label">Empresa: </span><span class="value">${data.clientCompany}</span></div>` : ''}
        ${data.clientPhone ? `<div class="field"><span class="label">Teléfono: </span><span class="value">${data.clientPhone}</span></div>` : ''}
        ${data.clientCity ? `<div class="field"><span class="label">Ciudad: </span><span class="value">${data.clientCity}</span></div>` : ''}
      </div>
    </div>

    <!-- Mensaje introductorio -->
    ${data.settings.headerMessage ? `<p class="intro-message">${data.settings.headerMessage}</p>` : ''}

    <!-- Tabla de Productos -->
    <div class="section">
      <h3>⚡ Equipos Cotizados</h3>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Producto</th>
            <th style="text-align: center;">Cant.</th>
            <th style="text-align: right;">Precio Unit.</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totales -->
      <div class="totals">
        ${data.discount > 0 ? `
          <div class="row"><span>Subtotal</span><span>${formatCOP(data.subtotal)}</span></div>
          <div class="row" style="color: #059669;"><span>Descuento</span><span>-${formatCOP(data.discount)}</span></div>
        ` : ''}
        <div class="row total-row"><span>Total Inversión</span><span>${formatCOP(data.total)}</span></div>
      </div>
      <p style="font-size: 11px; color: #6b7280;">* Precios incluyen IVA. Instalación llave en mano.</p>
    </div>

    <!-- Qué incluye -->
    <div class="section">
      <h3>✓ ¿Qué incluye el precio?</h3>
      <div class="includes-grid">
        <div class="item"><span class="check">✓</span> Cargador(es) de última generación</div>
        <div class="item"><span class="check">✓</span> Transformador eléctrico (cuando aplique)</div>
        <div class="item"><span class="check">✓</span> Hasta 10 metros de cableado y tubería</div>
        <div class="item"><span class="check">✓</span> Instalación llave en mano completa</div>
        <div class="item"><span class="check">✓</span> Configuración y puesta en marcha</div>
        <div class="item"><span class="check">✓</span> Garantía de 2 años en equipos</div>
        <div class="item"><span class="check">✓</span> Registro ante UPME y CárgaME</div>
        <div class="item"><span class="check">✓</span> Capacitación de uso</div>
      </div>
    </div>

    <!-- Modelo de Negocio -->
    ${benefits.length > 0 ? `
    <div class="section">
      <h3>🛡️ Modelo de Operación EVGreen</h3>
      <div class="model-box">
        <div class="model-shares">
          <div class="share-item owner">
            <div class="percent">${data.settings.ownerSharePercent}%</div>
            <div class="label">Para usted (dueño)<br/>Del margen neto</div>
          </div>
          <div class="share-item evgreen">
            <div class="percent">${data.settings.evgreenFeePercent}%</div>
            <div class="label">EVGreen (operación)<br/>Soporte y tecnología</div>
          </div>
        </div>
        <p style="font-size: 13px; font-weight: 600; color: #059669; margin-bottom: 8px;">¿Qué cubre el fee de EVGreen?</p>
        <ul class="benefits-list">
          ${benefitsList}
        </ul>
      </div>
    </div>
    ` : ''}

    <!-- Exclusiones -->
    ${data.settings.exclusions ? `
    <div class="section">
      <h3>⚠️ Importante - No incluye</h3>
      <div class="exclusions-box">${data.settings.exclusions}</div>
    </div>
    ` : ''}

    <!-- Términos -->
    ${data.settings.termsAndConditions ? `
    <div class="section">
      <h3>📋 Términos y Condiciones</h3>
      <div class="terms-box">${data.settings.termsAndConditions}</div>
    </div>
    ` : ''}

    <!-- Notas del asesor -->
    ${data.clientNotes ? `
    <div class="section">
      <h3>📝 Nota del asesor</h3>
      <p style="font-size: 14px; color: #374151; padding: 12px; background: #f9fafb; border-radius: 8px;">${data.clientNotes}</p>
    </div>
    ` : ''}

    <!-- Link online -->
    <div class="online-link">
      <p>Ver esta cotización online: <a href="${data.publicUrl}">${data.publicUrl}</a></p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="company">
        <strong>${data.settings.companyName}</strong><br/>
        NIT: ${data.settings.companyNit}
      </div>
      <div class="contact" style="text-align: right;">
        ${data.settings.companyPhone ? `📞 ${data.settings.companyPhone}<br/>` : ''}
        ${data.settings.companyEmail ? `✉️ ${data.settings.companyEmail}<br/>` : ''}
        ${data.settings.companyWebsite ? `🌐 ${data.settings.companyWebsite}` : ''}
      </div>
    </div>
    ${data.advisorName ? `<p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">Cotización preparada por: ${data.advisorName}</p>` : ''}
  </div>
</body>
</html>
  `.trim();
}
