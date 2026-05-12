/**
 * Generación de HTML profesional para cotizaciones EVGreen
 * Diseño premium con estética futurista/eléctrica de la marca
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
 * Genera el HTML premium de la cotización
 */
export function generateQuoteHTML(data: QuotePDFData): string {
  let benefits: string[] = [];
  try {
    benefits = data.settings.benefitsDescription ? JSON.parse(data.settings.benefitsDescription) : [];
  } catch { benefits = []; }

  const itemsRows = data.items.map((item) => `
    <div class="product-card">
      <div class="product-header">
        ${item.productImageUrl ? `<div class="product-image"><img src="${item.productImageUrl}" alt="${item.productName}" /></div>` : `<div class="product-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`}
        <div class="product-info">
          <h4>${item.productName}</h4>
          <div class="product-specs">
            <span class="spec-badge">${item.productPowerKw} kW</span>
            <span class="spec-badge">${item.productChargeType}</span>
            <span class="spec-badge">${item.productConnector}</span>
          </div>
        </div>
        <div class="product-price">
          <span class="qty">×${item.quantity}</span>
          <span class="price">${formatCOP(item.lineTotal)}</span>
        </div>
      </div>
      <div class="product-features">
        ${item.includesTransformer ? '<span class="feature-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Incluye transformador</span>' : ''}
        <span class="feature-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Hasta ${item.cableMetersIncluded}m de cableado</span>
      </div>
    </div>
  `).join("");

  const benefitsList = benefits.map((b) => `
    <div class="benefit-item">
      <div class="benefit-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <span>${b}</span>
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --green: #22c55e;
      --green-dark: #16a34a;
      --green-glow: rgba(34, 197, 94, 0.3);
      --cyan: #06b6d4;
      --dark: #0a0f1a;
      --dark-card: #111827;
      --dark-border: #1f2937;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--dark);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 0;
    }

    /* === HERO HEADER === */
    .hero-header {
      background: linear-gradient(135deg, #0a0f1a 0%, #0d1b2a 50%, #0a2e1a 100%);
      padding: 48px 48px 40px;
      position: relative;
      overflow: hidden;
      border-bottom: 1px solid var(--dark-border);
    }

    .hero-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, var(--green-glow) 0%, transparent 70%);
      opacity: 0.4;
    }

    .hero-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--green), transparent);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      position: relative;
      z-index: 1;
      margin-bottom: 32px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--green), var(--cyan));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px var(--green-glow);
    }

    .brand-text h1 {
      font-family: 'Montserrat', sans-serif;
      font-size: 26px;
      font-weight: 800;
      background: linear-gradient(135deg, #fff, #22c55e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }

    .brand-text p {
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-weight: 500;
    }

    .quote-badge {
      text-align: right;
    }

    .quote-badge .label {
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .quote-badge .number {
      font-size: 20px;
      font-weight: 700;
      font-family: 'Montserrat', monospace;
      color: var(--green);
      margin-top: 2px;
    }

    .hero-title {
      position: relative;
      z-index: 1;
    }

    .hero-title h2 {
      font-family: 'Montserrat', sans-serif;
      font-size: 36px;
      font-weight: 900;
      color: #fff;
      margin-bottom: 6px;
      letter-spacing: -1px;
    }

    .hero-title .subtitle {
      font-size: 16px;
      color: var(--green);
      font-weight: 500;
    }

    /* === CLIENT SECTION === */
    .client-section {
      background: var(--dark-card);
      padding: 32px 48px;
      border-bottom: 1px solid var(--dark-border);
    }

    .client-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    .client-field .label {
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }

    .client-field .value {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }

    .validity-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: var(--green);
      margin-top: 16px;
    }

    /* === CONTENT === */
    .content {
      padding: 40px 48px;
      background: var(--dark);
    }

    .intro-message {
      font-size: 15px;
      color: var(--text-muted);
      padding: 20px 24px;
      border-left: 3px solid var(--green);
      background: rgba(34, 197, 94, 0.05);
      border-radius: 0 8px 8px 0;
      margin-bottom: 36px;
    }

    /* === PRODUCTS === */
    .section-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title .icon {
      width: 32px;
      height: 32px;
      background: rgba(34, 197, 94, 0.15);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .product-card {
      background: var(--dark-card);
      border: 1px solid var(--dark-border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }

    .product-card:hover {
      border-color: rgba(34, 197, 94, 0.3);
    }

    .product-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .product-icon {
      width: 44px;
      height: 44px;
      background: rgba(34, 197, 94, 0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .product-image {
      width: 80px;
      height: 80px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      border: 1px solid var(--dark-border);
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-info {
      flex: 1;
    }

    .product-info h4 {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }

    .product-specs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .spec-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 4px;
      background: rgba(6, 182, 212, 0.1);
      color: var(--cyan);
      border: 1px solid rgba(6, 182, 212, 0.2);
    }

    .product-price {
      text-align: right;
      flex-shrink: 0;
    }

    .product-price .qty {
      display: block;
      font-size: 12px;
      color: var(--text-dim);
      margin-bottom: 2px;
    }

    .product-price .price {
      font-size: 20px;
      font-weight: 800;
      color: var(--green);
      font-family: 'Montserrat', sans-serif;
    }

    .product-features {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--dark-border);
    }

    .feature-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--green);
      font-weight: 500;
    }

    /* === TOTALS === */
    .totals-card {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(6, 182, 212, 0.05));
      border: 1px solid rgba(34, 197, 94, 0.25);
      border-radius: 16px;
      padding: 28px 32px;
      margin: 24px 0 40px;
      position: relative;
      overflow: hidden;
    }

    .totals-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--green), var(--cyan), var(--green));
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }

    .totals-row.sub { color: var(--text-muted); font-size: 14px; }
    .totals-row.discount { color: var(--green); font-size: 14px; }

    .totals-row.main {
      padding-top: 14px;
      margin-top: 10px;
      border-top: 1px solid rgba(34, 197, 94, 0.2);
    }

    .totals-row.main .label {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }

    .totals-row.main .amount {
      font-family: 'Montserrat', sans-serif;
      font-size: 32px;
      font-weight: 900;
      background: linear-gradient(135deg, #22c55e, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .totals-note {
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 10px;
      text-align: right;
    }

    /* === INCLUDES === */
    .includes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 40px;
    }

    .include-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--dark-card);
      border: 1px solid var(--dark-border);
      border-radius: 8px;
      font-size: 13px;
      color: var(--text);
    }

    .include-item .check-icon {
      width: 20px;
      height: 20px;
      background: rgba(34, 197, 94, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* === MODEL === */
    .model-card {
      background: var(--dark-card);
      border: 1px solid var(--dark-border);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 40px;
    }

    .model-shares {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .share-box {
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }

    .share-box.owner {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .share-box.evgreen {
      background: rgba(100, 116, 139, 0.1);
      border: 1px solid var(--dark-border);
    }

    .share-box .percent {
      font-family: 'Montserrat', sans-serif;
      font-size: 42px;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 4px;
    }

    .share-box.owner .percent {
      background: linear-gradient(135deg, #22c55e, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .share-box.evgreen .percent { color: var(--text-muted); }

    .share-box .share-label {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .share-box .share-sublabel {
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 2px;
    }

    .benefits-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--green);
      margin-bottom: 12px;
    }

    .benefit-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    .benefit-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* === EXCLUSIONS === */
    .exclusions-card {
      background: rgba(245, 158, 11, 0.05);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 40px;
    }

    .exclusions-card h4 {
      font-size: 14px;
      font-weight: 700;
      color: #f59e0b;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .exclusions-card p {
      font-size: 13px;
      color: #fbbf24;
      line-height: 1.7;
    }

    /* === TERMS === */
    .terms-card {
      background: var(--dark-card);
      border: 1px solid var(--dark-border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 40px;
    }

    .terms-card h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .terms-card p {
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.7;
    }

    /* === NOTES === */
    .notes-card {
      background: rgba(6, 182, 212, 0.05);
      border: 1px solid rgba(6, 182, 212, 0.2);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 40px;
    }

    .notes-card h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--cyan);
      margin-bottom: 8px;
    }

    .notes-card p {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* === CTA === */
    .cta-section {
      text-align: center;
      padding: 32px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(6, 182, 212, 0.05));
      border: 1px solid var(--dark-border);
      border-radius: 16px;
      margin-bottom: 40px;
    }

    .cta-section p {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }

    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, var(--green), var(--green-dark));
      color: #fff;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none;
      box-shadow: 0 4px 20px var(--green-glow);
    }

    /* === FOOTER === */
    .footer {
      padding: 32px 48px;
      background: var(--dark-card);
      border-top: 1px solid var(--dark-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-brand {
      font-size: 13px;
      color: var(--text-muted);
    }

    .footer-brand strong {
      color: #fff;
      display: block;
      margin-bottom: 2px;
    }

    .footer-contact {
      text-align: right;
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.8;
    }

    .footer-advisor {
      text-align: center;
      padding: 16px 48px;
      background: var(--dark);
      font-size: 12px;
      color: var(--text-dim);
      border-top: 1px solid var(--dark-border);
    }

    @media print {
      body { background: #fff; color: #1f2937; }
      .hero-header { background: #111827 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .product-card, .model-card, .totals-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HERO HEADER -->
    <div class="hero-header">
      <div class="header-top">
        <div class="brand">
          <div class="brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div class="brand-text">
            <h1>EVGreen</h1>
            <p>Estaciones de Carga Inteligentes</p>
          </div>
        </div>
        <div class="quote-badge">
          <div class="label">Cotización</div>
          <div class="number">${data.quoteNumber}</div>
        </div>
      </div>
      <div class="hero-title">
        <h2>Propuesta Comercial</h2>
        <div class="subtitle">Estación de Carga para Vehículos Eléctricos</div>
      </div>
    </div>

    <!-- CLIENT INFO -->
    <div class="client-section">
      <div class="client-grid">
        <div class="client-field">
          <div class="label">Preparada para</div>
          <div class="value">${data.clientName}</div>
        </div>
        ${data.clientCompany ? `<div class="client-field"><div class="label">Empresa</div><div class="value">${data.clientCompany}</div></div>` : `<div class="client-field"><div class="label">Email</div><div class="value">${data.clientEmail}</div></div>`}
        <div class="client-field">
          <div class="label">Fecha</div>
          <div class="value">${formatDate(data.createdAt)}</div>
        </div>
        <div class="client-field">
          <div class="label">Válida hasta</div>
          <div class="value">${formatDate(data.expiresAt)}</div>
        </div>
      </div>
      <div class="validity-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Oferta vigente por 30 días
      </div>
    </div>

    <!-- CONTENT -->
    <div class="content">
      <!-- Intro message -->
      ${data.settings.headerMessage ? `<div class="intro-message">${data.settings.headerMessage}</div>` : ''}

      <!-- Products -->
      <div class="section-title">
        <div class="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        Equipos Cotizados
      </div>
      ${itemsRows}

      <!-- Totals -->
      <div class="totals-card">
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
        <div class="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        ¿Qué incluye el precio?
      </div>
      <div class="includes-grid">
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Cargador(es) de última generación
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Transformador eléctrico (cuando aplique)
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Hasta 10 metros de cableado y tubería
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Instalación llave en mano completa
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Configuración y puesta en marcha
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Garantía de 2 años en equipos
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Registro ante UPME y CárgaME
        </div>
        <div class="include-item">
          <div class="check-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          Capacitación de uso y operación
        </div>
      </div>

      <!-- Business Model -->
      ${benefits.length > 0 ? `
      <div class="section-title">
        <div class="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        Modelo de Operación EVGreen
      </div>
      <div class="model-card">
        <div class="model-shares">
          <div class="share-box owner">
            <div class="percent">${data.settings.ownerSharePercent}%</div>
            <div class="share-label">Para usted (dueño)</div>
            <div class="share-sublabel">Del margen neto de operación</div>
          </div>
          <div class="share-box evgreen">
            <div class="percent">${data.settings.evgreenFeePercent}%</div>
            <div class="share-label">EVGreen (operación)</div>
            <div class="share-sublabel">Soporte, tecnología y mantenimiento</div>
          </div>
        </div>
        <div class="benefits-title">¿Qué cubre el fee de EVGreen?</div>
        ${benefitsList}
      </div>
      ` : ''}

      <!-- Exclusions -->
      ${data.settings.exclusions ? `
      <div class="exclusions-card">
        <h4>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Importante — No incluye
        </h4>
        <p>${data.settings.exclusions}</p>
      </div>
      ` : ''}

      <!-- Terms -->
      ${data.settings.termsAndConditions ? `
      <div class="terms-card">
        <h4>Términos y Condiciones</h4>
        <p>${data.settings.termsAndConditions}</p>
      </div>
      ` : ''}

      <!-- Notes -->
      ${data.clientNotes ? `
      <div class="notes-card">
        <h4>Nota del asesor</h4>
        <p>${data.clientNotes}</p>
      </div>
      ` : ''}

      <!-- CTA -->
      <div class="cta-section">
        <p>¿Listo para dar el paso hacia la movilidad eléctrica?</p>
        <a href="${data.publicUrl}" class="cta-button">Ver Cotización Online →</a>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-brand">
        <strong>${data.settings.companyName}</strong>
        NIT: ${data.settings.companyNit}
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
