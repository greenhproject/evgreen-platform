/**
 * Generación de HTML profesional para cotizaciones EVGreen
 * Diseño PRINT-FIRST: optimizado para generar PDFs limpios
 * Fondo blanco, texto oscuro, logo negro - compatible con impresión
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
    productImageUrl?: string | null;
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
 * Descarga una imagen desde URL y la convierte a base64 data URI
 * para que se renderice correctamente al imprimir/generar PDF
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return url; // fallback a URL original
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return url; // fallback a URL original si falla
  }
}

/**
 * Genera el HTML premium de la cotización - OPTIMIZADO PARA PDF
 * Las imágenes de producto se convierten a base64 para garantizar renderizado en print
 */
export async function generateQuoteHTML(data: QuotePDFData): Promise<string> {
  let benefits: string[] = [];
  try {
    benefits = data.settings.benefitsDescription ? JSON.parse(data.settings.benefitsDescription) : [];
  } catch { benefits = []; }

  const benefitsList = benefits.map((b: string) => `
    <div class="benefit-item">
      <span class="benefit-check">✓</span>
      <span>${b}</span>
    </div>
  `).join("");

  // Convertir imágenes de producto a base64 para que se rendericen al imprimir
  const itemsWithBase64 = await Promise.all(
    data.items.map(async (item) => ({
      ...item,
      imageBase64: item.productImageUrl ? await imageUrlToBase64(item.productImageUrl) : null,
    }))
  );

  const itemsRows = itemsWithBase64.map((item) => `
    <div class="product-card">
      <div class="product-row">
        ${item.imageBase64 ? `<div class="product-img"><img src="${item.imageBase64}" alt="${item.productName}" /></div>` : `<div class="product-img-placeholder"><span>⚡</span></div>`}
        <div class="product-details">
          <h4>${item.productName}</h4>
          <div class="specs">
            <span class="spec">${item.productPowerKw} kW</span>
            <span class="spec">${item.productChargeType}</span>
            <span class="spec">${item.productConnector}</span>
          </div>
          <div class="features">
            ${item.includesTransformer ? `<span class="feature">✓ Incluye transformador</span>` : ''}
            <span class="feature">✓ Hasta ${item.cableMetersIncluded}m de cableado</span>
          </div>
        </div>
        <div class="product-pricing">
          <span class="qty">×${item.quantity}</span>
          <span class="price">${formatCOP(item.lineTotal)}</span>
        </div>
      </div>
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cotización ${data.quoteNumber} - EVGreen</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    /* === PRINT-FIRST RESET === */
    @page {
      margin: 0;
      size: A4;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 0;
    }

    /* === HEADER === */
    .header {
      background: linear-gradient(135deg, #0a1628 0%, #0d2818 100%);
      padding: 36px 40px 32px;
      position: relative;
      overflow: hidden;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #22c55e, #06b6d4, #22c55e);
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .brand-logo {
      height: 44px;
      width: auto;
    }

    .quote-number {
      text-align: right;
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .quote-number strong {
      display: block;
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #22c55e;
      margin-top: 2px;
    }

    .header-title h1 {
      font-family: 'Montserrat', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .header-title .subtitle {
      font-size: 14px;
      color: #22c55e;
      font-weight: 500;
      margin-top: 4px;
    }

    /* === CLIENT INFO === */
    .client-bar {
      background: #f8fafc;
      padding: 24px 40px;
      border-bottom: 1px solid #e2e8f0;
    }

    .client-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 12px;
    }

    .client-field label {
      display: block;
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }

    .client-field span {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .validity {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 5px 12px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      color: #059669;
    }

    /* === CONTENT === */
    .content {
      padding: 28px 40px 16px;
    }

    .intro-msg {
      font-size: 14px;
      color: #475569;
      padding: 16px 20px;
      border-left: 3px solid #22c55e;
      background: #f0fdf4;
      border-radius: 0 8px 8px 0;
      margin-bottom: 28px;
    }

    /* === SECTION TITLES === */
    .section-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      page-break-after: avoid;
    }

    .section-title .icon {
      color: #22c55e;
      font-size: 18px;
    }

    /* === PRODUCTS === */
    .product-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      background: #fafbfc;
    }

    .product-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .product-img {
      width: 70px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      background: #fff;
    }

    .product-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-img-placeholder {
      width: 70px;
      height: 70px;
      border-radius: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 24px;
    }

    .product-details {
      flex: 1;
    }

    .product-details h4 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }

    .specs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .spec {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .features {
      display: flex;
      gap: 12px;
    }

    .feature {
      font-size: 11px;
      color: #059669;
      font-weight: 500;
    }

    .product-pricing {
      text-align: right;
      flex-shrink: 0;
    }

    .product-pricing .qty {
      display: block;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 2px;
    }

    .product-pricing .price {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #059669;
    }

    /* === TOTALS === */
    .totals-box {
      background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);
      border: 2px solid #22c55e;
      border-radius: 12px;
      padding: 24px 28px;
      margin: 20px 0 32px;
      page-break-inside: avoid;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .totals-row.sub {
      font-size: 13px;
      color: #64748b;
    }

    .totals-row.discount {
      font-size: 13px;
      color: #059669;
    }

    .totals-row.main {
      padding-top: 12px;
      margin-top: 8px;
      border-top: 2px solid #22c55e;
    }

    .totals-row.main .label {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    .totals-row.main .amount {
      font-family: 'Montserrat', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: #059669;
    }

    .totals-note {
      font-size: 10px;
      color: #64748b;
      margin-top: 8px;
      text-align: right;
    }

    /* === INCLUDES GRID === */
    .includes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 32px;
    }

    .include-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #334155;
      page-break-inside: avoid;
    }

    .include-item .check {
      color: #22c55e;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }

    /* === MODEL SECTION === */
    .model-section {
      page-break-inside: avoid;
      margin-bottom: 24px;
    }

    .model-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      background: #fafbfc;
    }

    .shares-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .share-box {
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }

    .share-box.owner {
      background: #ecfdf5;
      border: 2px solid #22c55e;
    }

    .share-box.evgreen {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
    }

    .share-box .percent {
      font-family: 'Montserrat', sans-serif;
      font-size: 36px;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 4px;
    }

    .share-box.owner .percent {
      color: #059669;
    }

    .share-box.evgreen .percent {
      color: #64748b;
    }

    .share-box .share-label {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    .share-box .share-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    .benefits-title {
      font-size: 13px;
      font-weight: 700;
      color: #059669;
      margin-bottom: 10px;
    }

    .benefit-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 5px 0;
      font-size: 12px;
      color: #475569;
    }

    .benefit-check {
      color: #22c55e;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* === EXCLUSIONS === */
    .exclusions-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 14px 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    .exclusions-box h4 {
      font-size: 13px;
      font-weight: 700;
      color: #b45309;
      margin-bottom: 6px;
    }

    .exclusions-box p {
      font-size: 12px;
      color: #92400e;
      line-height: 1.7;
    }

    /* === TERMS === */
    .terms-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    .terms-box h4 {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 6px;
    }

    .terms-box p {
      font-size: 11px;
      color: #64748b;
      line-height: 1.7;
    }

    /* === NOTES === */
    .notes-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 14px 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    .notes-box h4 {
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 6px;
    }

    .notes-box p {
      font-size: 12px;
      color: #475569;
    }

    /* === CTA (hidden in print) === */
    .cta-section {
      text-align: center;
      padding: 24px;
      background: #f0fdf4;
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      margin-bottom: 32px;
    }

    .cta-section p {
      font-size: 13px;
      color: #475569;
      margin-bottom: 12px;
    }

    .cta-button {
      display: inline-block;
      background: #22c55e;
      color: #fff;
      padding: 12px 28px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
    }

    /* === FOOTER === */
    .footer {
      padding: 20px 40px;
      background: #f8fafc;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
      margin-top: 0;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .footer-brand svg {
      height: 28px;
      width: auto;
    }

    .footer-brand span {
      font-size: 11px;
      color: #64748b;
    }

    .footer-contact {
      text-align: right;
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
    }

    .footer-advisor {
      text-align: center;
      padding: 10px 40px;
      background: #f1f5f9;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }

    .footer-advisor strong {
      color: #0f172a;
    }

    /* === PRINT OVERRIDES === */
    @media print {
      @page {
        margin: 0;
        size: A4;
      }

      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .page {
        max-width: 100%;
      }

      .header {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .content {
        padding-bottom: 16px;
      }

      .product-card,
      .totals-box,
      .model-section,
      .model-card,
      .exclusions-box,
      .terms-box,
      .notes-box,
      .includes-grid {
        page-break-inside: avoid;
      }

      .footer,
      .footer-advisor {
        page-break-inside: avoid;
        page-break-before: avoid;
      }

      .section-title {
        page-break-after: avoid;
      }

      .cta-section {
        display: none !important;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="header-row">
        <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/zbDIWjuOCDapFXwo.webp" alt="EVGreen" class="brand-logo" />
        <div class="quote-number">
          Cotización
          <strong>${data.quoteNumber}</strong>
        </div>
      </div>
      <div class="header-title">
        <h1>Propuesta Comercial</h1>
        <div class="subtitle">Estación de Carga para Vehículos Eléctricos</div>
      </div>
    </div>

    <!-- CLIENT INFO -->
    <div class="client-bar">
      <div class="client-grid">
        <div class="client-field">
          <label>Preparada para</label>
          <span>${data.clientName}</span>
        </div>
        ${data.clientCompany ? `<div class="client-field"><label>Empresa</label><span>${data.clientCompany}</span></div>` : `<div class="client-field"><label>Email</label><span>${data.clientEmail}</span></div>`}
        <div class="client-field">
          <label>Fecha</label>
          <span>${formatDate(data.createdAt)}</span>
        </div>
        <div class="client-field">
          <label>Válida hasta</label>
          <span>${formatDate(data.expiresAt)}</span>
        </div>
      </div>
      <div class="validity">⏱ Oferta vigente por 30 días</div>
    </div>

    <!-- CONTENT -->
    <div class="content">
      ${data.settings.headerMessage ? `<div class="intro-msg">${data.settings.headerMessage}</div>` : ''}

      <!-- Products -->
      <div class="section-title">
        <span class="icon">⚡</span>
        Equipos Cotizados
      </div>
      ${itemsRows}

      <!-- Totals -->
      <div class="totals-box">
        ${data.discount > 0 ? `
          <div class="totals-row sub"><span>Subtotal</span><span>${formatCOP(data.subtotal)}</span></div>
          <div class="totals-row discount"><span>Descuento aplicado</span><span>-${formatCOP(data.discount)}</span></div>
        ` : ''}
        <div class="totals-row main">
          <span class="label">Total Inversión</span>
          <span class="amount">${formatCOP(data.total)}</span>
        </div>
        <div class="totals-note">* Precios incluyen IVA. Instalación llave en mano.</div>
      </div>

      <!-- Includes -->
      <div class="section-title">
        <span class="icon">✓</span>
        ¿Qué incluye el precio?
      </div>
      <div class="includes-grid">
        <div class="include-item"><span class="check">✓</span> Cargador(es) de última generación</div>
        <div class="include-item"><span class="check">✓</span> Transformador eléctrico (cuando aplique)</div>
        <div class="include-item"><span class="check">✓</span> Hasta 10 metros de cableado y tubería</div>
        <div class="include-item"><span class="check">✓</span> Instalación llave en mano completa</div>
        <div class="include-item"><span class="check">✓</span> Configuración y puesta en marcha</div>
        <div class="include-item"><span class="check">✓</span> Garantía de 2 años en equipos</div>
        <div class="include-item"><span class="check">✓</span> Registro ante UPME y CárgaME</div>
        <div class="include-item"><span class="check">✓</span> Capacitación de uso y operación</div>
      </div>

      <!-- Business Model -->
      ${benefits.length > 0 ? `
      <div class="model-section">
        <div class="section-title">
          <span class="icon">🛡</span>
          Modelo de Operación EVGreen
        </div>
        <div class="model-card">
          <div class="shares-row">
            <div class="share-box owner">
              <div class="percent">${data.settings.ownerSharePercent}%</div>
              <div class="share-label">Para usted (dueño)</div>
              <div class="share-sub">Del margen neto de operación</div>
            </div>
            <div class="share-box evgreen">
              <div class="percent">${data.settings.evgreenFeePercent}%</div>
              <div class="share-label">EVGreen (operación)</div>
              <div class="share-sub">Soporte, tecnología y mantenimiento</div>
            </div>
          </div>
          <div class="benefits-title">¿Qué cubre el fee de EVGreen?</div>
          ${benefitsList}
        </div>
      </div>
      ` : ''}

      <!-- Exclusions -->
      ${data.settings.exclusions ? `
      <div class="exclusions-box">
        <h4>⚠ Importante — No incluye</h4>
        <p>${data.settings.exclusions}</p>
      </div>
      ` : ''}

      <!-- Terms -->
      ${data.settings.termsAndConditions ? `
      <div class="terms-box">
        <h4>Términos y Condiciones</h4>
        <p>${data.settings.termsAndConditions}</p>
      </div>
      ` : ''}

      <!-- Notes -->
      ${data.clientNotes ? `
      <div class="notes-box">
        <h4>Nota del asesor</h4>
        <p>${data.clientNotes}</p>
      </div>
      ` : ''}

      <!-- CTA (hidden in print) -->
      <div class="cta-section">
        <p>¿Listo para dar el paso hacia la movilidad eléctrica?</p>
        <a href="${data.publicUrl}" class="cta-button">Ver Cotización Online →</a>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-brand">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" height="28">
          <defs>
            <linearGradient id="footerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#22c55e"/>
              <stop offset="100%" style="stop-color:#16a34a"/>
            </linearGradient>
          </defs>
          <path d="M10 40 C10 40 8 25 18 18 C22 14 28 16 30 20 C32 14 38 10 44 14 C48 17 46 24 44 28 C50 22 56 20 60 24 C64 28 60 36 56 40 Z" fill="url(#footerGrad)" opacity="0.9"/>
          <text x="65" y="35" font-family="Montserrat, sans-serif" font-weight="800" font-size="24" fill="#1a1a2e">EV</text>
          <text x="95" y="35" font-family="Montserrat, sans-serif" font-weight="800" font-size="24" fill="#22c55e">Green</text>
        </svg>
        <span>NIT: ${data.settings.companyNit}</span>
      </div>
      <div class="footer-contact">
        ${data.settings.companyPhone ? `${data.settings.companyPhone}<br/>` : ''}
        ${data.settings.companyEmail ? `${data.settings.companyEmail}<br/>` : ''}
        ${data.settings.companyWebsite ? `${data.settings.companyWebsite}` : ''}
      </div>
    </div>
    ${data.advisorName ? `<div class="footer-advisor">Cotización preparada por: <strong>${data.advisorName}</strong></div>` : ''}
  </div>
</body>
</html>
  `.trim();
}
