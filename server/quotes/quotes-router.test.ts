/**
 * Tests para el módulo de cotizaciones EVGreen
 * Verifica la generación de HTML de PDF y email
 */
import { describe, it, expect } from "vitest";
import { generateQuoteHTML } from "./quote-pdf";
import { generateQuoteEmailHTML, generateQuoteEmailSubject } from "./quote-email";

const mockSettings = {
  companyName: "EVGreen S.A.S",
  companyNit: "901.447.678-0",
  companyPhone: "+57 310 123 4567",
  companyEmail: "ventas@evgreen.lat",
  companyWebsite: "evgreen.lat",
  evgreenFeePercent: 30,
  ownerSharePercent: 70,
  headerMessage: "Es un placer presentarle nuestra propuesta comercial.",
  footerMessage: "Quedamos atentos.",
  termsAndConditions: "Precios válidos por 30 días calendario.",
  exclusions: "No incluye obras civiles adicionales ni cableado superior a 10 metros.",
  benefitsDescription: JSON.stringify([
    "Operación y monitoreo 24/7",
    "Mantenimiento preventivo y correctivo",
    "Soporte técnico para usuarios",
    "Tecnología de inteligencia artificial",
    "Plataforma de gestión y reportes",
    "Actualizaciones de firmware",
  ]),
};

const mockQuoteData = {
  quoteNumber: "EVG-2026-0001",
  createdAt: new Date("2026-05-12"),
  expiresAt: new Date("2026-06-11"),
  clientName: "Juan Pérez",
  clientEmail: "juan@empresa.com",
  clientPhone: "+57 321 456 7890",
  clientCompany: "Empresa S.A.S",
  clientCity: "Bogotá",
  clientNotes: "Interesado en instalación para centro comercial.",
  advisorName: "Carlos Asesor",
  subtotal: 85000000,
  discount: 5000000,
  total: 80000000,
  items: [
    {
      productName: "Cargador DC 120 kW CCS2",
      productPowerKw: "120",
      productChargeType: "DC",
      productConnector: "CCS2",
      quantity: 1,
      unitPrice: 85000000,
      lineTotal: 85000000,
      includesTransformer: true,
      cableMetersIncluded: 10,
    },
  ],
  settings: mockSettings,
  publicUrl: "https://evgreen.lat/cotizacion/abc123token",
};

describe("Quote PDF Generation", () => {
  it("generates valid HTML with quote number", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("EVG-2026-0001");
    expect(html).toContain("Juan Pérez");
    expect(html).toContain("Empresa S.A.S");
  });

  it("includes product details in the HTML", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("Cargador DC 120 kW CCS2");
    expect(html).toContain("120 kW");
    expect(html).toContain("CCS2");
    expect(html).toContain("Incluye transformador");
  });

  it("includes the business model section with percentages", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("70%");
    expect(html).toContain("30%");
    expect(html).toContain("Operación y monitoreo 24/7");
  });

  it("includes exclusions and terms", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("No incluye obras civiles");
    expect(html).toContain("Precios válidos por 30 días");
  });

  it("includes the public URL link", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("https://evgreen.lat/cotizacion/abc123token");
  });

  it("includes company info in footer", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("901.447.678-0");
    expect(html).toContain("ventas@evgreen.lat");
    expect(html).toContain("+57 310 123 4567");
  });

  it("shows discount when present", async () => {
    const html = await generateQuoteHTML(mockQuoteData);
    expect(html).toContain("Descuento");
  });

  it("does not show discount section when zero", async () => {
    const noDiscountData = { ...mockQuoteData, discount: 0 };
    const html = await generateQuoteHTML(noDiscountData);
    expect(html).not.toContain("Descuento");
  });

  it("uses custom financial model percentages when provided", async () => {
    const customData = {
      ...mockQuoteData,
      financialModel: {
        evgreenSharePercent: 25,
        investorSharePercent: 75,
        hostSharePercent: 10,
      },
    };
    const html = await generateQuoteHTML(customData);
    expect(html).toContain("75%");
    expect(html).toContain("25%");
    expect(html).toContain("Aliado Comercial");
    expect(html).toContain("10%");
  });

  it("shows projection section when enabled", async () => {
    const projectionData = {
      ...mockQuoteData,
      financialModel: {
        evgreenSharePercent: 30,
        investorSharePercent: 70,
        hostSharePercent: 0,
      },
      projection: {
        show: true,
        energyCostPerKwh: 700,
        salePricePerKwh: 1800,
        dailyHours: 4,
        scenario: "realistic" as const,
        totalKw: 120,
      },
    };
    const html = await generateQuoteHTML(projectionData);
    expect(html).toContain("Proyecci\u00f3n de Ingresos Estimada");
    expect(html).toContain("Realista");
    expect(html).toContain("Recuperaci\u00f3n de inversi\u00f3n");
    expect(html).toContain("ROI anual estimado");
    expect(html).toContain("netamente informativa");
    expect(html).toContain("120 kW");
  });

  it("does not show projection when disabled", async () => {
    const noProjectionData = {
      ...mockQuoteData,
      projection: {
        show: false,
        energyCostPerKwh: 700,
        salePricePerKwh: 1800,
        dailyHours: 4,
        scenario: "realistic" as const,
        totalKw: 120,
      },
    };
    const html = await generateQuoteHTML(noProjectionData);
    expect(html).not.toContain("Proyecci\u00f3n de Ingresos Estimada");
  });

  it("does not show host share when zero", async () => {
    const noHostData = {
      ...mockQuoteData,
      financialModel: {
        evgreenSharePercent: 30,
        investorSharePercent: 70,
        hostSharePercent: 0,
      },
    };
    const html = await generateQuoteHTML(noHostData);
    expect(html).not.toContain("Aliado Comercial");
  });
});

describe("Quote Email Generation", () => {
  const emailData = {
    clientName: "Juan Pérez",
    clientEmail: "juan@empresa.com",
    quoteNumber: "EVG-2026-0001",
    total: 80000000,
    advisorName: "Carlos Asesor",
    publicUrl: "https://evgreen.lat/cotizacion/abc123token",
    companyName: "EVGreen S.A.S",
    companyPhone: "+57 310 123 4567",
    companyEmail: "ventas@evgreen.lat",
    companyWebsite: "evgreen.lat",
    expiresAt: new Date("2026-06-11"),
  };

  it("generates email HTML with client greeting", () => {
    const html = generateQuoteEmailHTML(emailData);
    expect(html).toContain("Hola Juan");
  });

  it("includes quote number in email", () => {
    const html = generateQuoteEmailHTML(emailData);
    expect(html).toContain("EVG-2026-0001");
  });

  it("includes CTA button with public URL", () => {
    const html = generateQuoteEmailHTML(emailData);
    expect(html).toContain("https://evgreen.lat/cotizacion/abc123token");
    expect(html).toContain("Ver Cotización Completa");
  });

  it("includes key selling points", () => {
    const html = generateQuoteEmailHTML(emailData);
    expect(html).toContain("llave en mano");
    expect(html).toContain("70% del margen neto");
    expect(html).toContain("soporte 24/7");
    expect(html).toContain("inteligencia artificial");
  });

  it("includes advisor name", () => {
    const html = generateQuoteEmailHTML(emailData);
    expect(html).toContain("Carlos Asesor");
  });

  it("generates proper email subject", () => {
    const subject = generateQuoteEmailSubject({
      quoteNumber: "EVG-2026-0001",
      clientName: "Juan Pérez",
    });
    expect(subject).toContain("EVG-2026-0001");
    expect(subject).toContain("Juan Pérez");
    expect(subject).toContain("EVGreen");
  });
});

describe("Commission Calculations", () => {
  it("calculates commission amount correctly from percentage and line total", () => {
    const lineTotal = 85000000;
    const commissionPercent = 5;
    const commissionAmount = Math.round(lineTotal * commissionPercent / 100);
    expect(commissionAmount).toBe(4250000);
  });

  it("calculates zero commission when percent is zero", () => {
    const lineTotal = 85000000;
    const commissionPercent = 0;
    const commissionAmount = Math.round(lineTotal * commissionPercent / 100);
    expect(commissionAmount).toBe(0);
  });

  it("calculates total commission across multiple items", () => {
    const items = [
      { lineTotal: 85000000, commissionPercent: 5 },
      { lineTotal: 45000000, commissionPercent: 3 },
      { lineTotal: 120000000, commissionPercent: 2 },
    ];
    const totalCommission = items.reduce((sum, item) => {
      return sum + Math.round(item.lineTotal * item.commissionPercent / 100);
    }, 0);
    // 4,250,000 + 1,350,000 + 2,400,000 = 8,000,000
    expect(totalCommission).toBe(8000000);
  });

  it("handles decimal commission percentages", () => {
    const lineTotal = 100000000;
    const commissionPercent = 2.5;
    const commissionAmount = Math.round(lineTotal * commissionPercent / 100);
    expect(commissionAmount).toBe(2500000);
  });

  it("aggregates commission stats by quote status", () => {
    const allQuotes = [
      { status: "ACCEPTED", totalCommission: 4250000, total: 85000000 },
      { status: "SENT", totalCommission: 1350000, total: 45000000 },
      { status: "DRAFT", totalCommission: 2400000, total: 120000000 },
      { status: "REJECTED", totalCommission: 500000, total: 10000000 },
    ];

    const totalCommission = allQuotes.reduce((sum, q) => sum + (q.totalCommission || 0), 0);
    const acceptedCommission = allQuotes
      .filter(q => q.status === "ACCEPTED")
      .reduce((sum, q) => sum + (q.totalCommission || 0), 0);
    const pendingCommission = allQuotes
      .filter(q => ["SENT", "VIEWED", "DRAFT"].includes(q.status))
      .reduce((sum, q) => sum + (q.totalCommission || 0), 0);

    expect(totalCommission).toBe(8500000);
    expect(acceptedCommission).toBe(4250000);
    expect(pendingCommission).toBe(3750000);
  });

  it("parses commissionPercent from string correctly", () => {
    const commissionPercentStr = "5.00";
    const parsed = parseFloat(commissionPercentStr);
    expect(parsed).toBe(5);
    expect(parsed).toBeGreaterThan(0);
  });

  it("handles null/undefined totalCommission gracefully", () => {
    const allQuotes = [
      { status: "ACCEPTED", totalCommission: null, total: 85000000 },
      { status: "SENT", totalCommission: undefined, total: 45000000 },
      { status: "ACCEPTED", totalCommission: 2000000, total: 50000000 },
    ];

    const totalCommission = allQuotes.reduce((sum: number, q: any) => sum + (q.totalCommission || 0), 0);
    expect(totalCommission).toBe(2000000);
  });
});
