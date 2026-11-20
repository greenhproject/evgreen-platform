import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import sharp from "sharp";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFString, type PDFPage } from "pdf-lib";
import { ALLY_PLATFORM_BENEFIT_IMAGE_URLS, buildAllySpacePdfContent, generateAllySpacePdf, type AllySpacePdfData } from "./ally-space-pdf-service";

// Sólo datos sintéticos y medios locales: no BD, CDN, anexos ni red real.
vi.mock("axios", () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.mocked(axios.get).mockReset().mockRejectedValue(new Error("offline test"));
});

const data: AllySpacePdfData = {
  code: "SPE-CANON-LOCAL",
  spaceName: "Espacio de prueba local",
  spaceType: "parking",
  address: "Dirección sintética",
  city: "Bogotá",
  estimatedDailyVehicles: 700,
  estimatedEvPercent: 10,
  estimatedChargerCount: 2,
  estimatedPowerKw: 240,
  is24Hours: true,
  salePricePerKwh: 1800,
  energyCostPerKwh: 850,
  allySharePercent: 3.75,
  photos: [],
  generatedAt: new Date("2026-11-20T17:00:00Z"),
};

function pageStream(page: PDFPage): string {
  // jsPDF genera streams de página sin comprimir; no inspeccionamos bytes de imágenes.
  const contents = page.node.Contents();
  if (!(contents instanceof PDFRawStream)) throw new Error("Expected a jsPDF page stream");
  return Buffer.from(contents.contents).toString("latin1");
}

function pageText(page: PDFPage): string {
  // Cada línea puede ser un Tj distinto. Decodificar escapes permite comprobar fórmulas con paréntesis.
  return [...pageStream(page).matchAll(/\(((?:\\.|[^\\()])*)\) Tj/g)]
    .map(match => PDFString.of(match[1]).decodeText())
    .join(" ")
    .replace(/\s+/g, " ");
}

async function render(input: AllySpacePdfData) {
  const bytes = await generateAllySpacePdf(input);
  const pdf = await PDFDocument.load(bytes);
  const projectionPage = pdf.getPages().find(page => pageText(page).includes("PROYECCIÓN COMERCIAL PRELIMINAR"));
  expect(projectionPage).toBeDefined();
  return { pdf, page: projectionPage!, text: pageText(projectionPage!) };
}

function cop(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function expectTextWithinMargins(page: PDFPage) {
  const unit = 72 / 25.4;
  const minimumY = 22 * unit; // reserva del footer
  for (const block of pageStream(page).matchAll(/BT\s([\s\S]*?)ET/g)) {
    const source = block[1];
    if (!source.includes(" Tj") || source.includes("Ficha del Aliado EVGreen")) continue;
    const firstPosition = /([-\d.]+) ([-\d.]+) Td/.exec(source);
    if (!firstPosition) throw new Error("Text without initial coordinates");
    const x = Number(firstPosition[1]);
    let y = Number(firstPosition[2]);
    const leading = Number(/([-\d.]+) TL/.exec(source)?.[1] ?? 0);
    expect(x).toBeGreaterThanOrEqual(18 * unit - 1);
    expect(x).toBeLessThanOrEqual(page.getWidth() - 18 * unit + 1);
    for (const line of source.matchAll(/T\*|\((?:\\.|[^\\()])*\) Tj/g)) {
      if (line[0] === "T*") y -= leading;
      else expect(y).toBeGreaterThanOrEqual(minimumY);
    }
  }
}

describe("Canon configurable en el PDF del aliado", () => {
  it.each([3.75, 0, 15])("aplica y renderiza %s %% sin sustituir el cero ni redondear el porcentaje", async allySharePercent => {
    const input = { ...data, allySharePercent };
    const content = buildAllySpacePdfContent(input);
    const remuneration = content.remuneration!;
    const percent = `${allySharePercent.toLocaleString("es-CO")} %`;
    expect(content.incomeProjection!.assumptions.allySharePercent).toBe(allySharePercent);
    expect(remuneration.configuredPercent).toBe(`${percent} del margen bruto de energía`);
    expect(remuneration.remunerationPerKwhCop).toBeCloseTo((1800 - 850) * allySharePercent / 100, 8);
    for (const scenario of Object.values(content.incomeProjection!.scenarios)) {
      const monthly = Math.round(scenario.energyKwhPerMonth * (1800 - 850) * allySharePercent) / 100;
      expect(scenario.allyIncomeMonthly).toBe(monthly);
      expect(scenario.allyIncomeAnnual).toBe(monthly * 12);
    }

    const { pdf, page, text } = await render(input);
    expect(text).toContain("Retribución del aliado / canon del espacio");
    expect(text).toContain(`Porcentaje configurado: ${percent}`);
    expect(text).toContain("Precio de venta");
    expect(text).toContain("Costo energético efectivo");
    expect(text).toContain("Retribución del aliado por kWh");
    expect(text).toContain(remuneration.salePrice);
    expect(text).toContain(remuneration.effectiveEnergyCost);
    expect(text).toContain(remuneration.remunerationPerKwh);
    expect(text).toContain("Base: margen bruto de energía = kWh vendidos × (precio de venta - costo energético efectivo).");
    expect(text).toContain(`Canon mensual = margen bruto de energía del mes × ${percent}`);
    expect(text).toContain("Canon anualizado = canon mensual × 12 meses");
    expect(text).toContain("No se calcula sobre la venta total");
    for (const scenario of Object.values(content.incomeProjection!.scenarios)) {
      expect(text).toContain(cop(scenario.allyIncomeMonthly));
      expect(pdf.getPages().map(pageText).join(" ")).toContain(cop(scenario.allyIncomeAnnual));
    }
    expect(pdf.getPageCount()).toBe(10); // ninguna hoja extra para explicar el canon
    expectTextWithinMargins(page);
    for (const p of pdf.getPages()) expect(pageText(p).length).toBeGreaterThan(100);
    if (allySharePercent === 0) {
      expect(remuneration.remunerationPerKwh).toBe("$0 COP/kWh");
      expect(Object.values(content.incomeProjection!.scenarios).every(s => s.allyIncomeMonthly === 0 && s.allyIncomeAnnual === 0)).toBe(true);
      const annualPage = pdf.getPages().find(p => pageText(p).includes("VALOR MENSUAL Y ANUALIZADO PARA EL ALIADO"))!;
      expect(pageText(annualPage).match(/\$0/g)!.length).toBeGreaterThanOrEqual(9);
    }
  });

  it("diferencia el canon mensual y anual para 3,75 %, 0 % y 15 % sin alterar la demanda", () => {
    const snapshots = [3.75, 0, 15].map(allySharePercent => buildAllySpacePdfContent({ ...data, allySharePercent }).incomeProjection!);
    expect(snapshots.map(p => p.scenarios.REALISTIC.energyKwhPerMonth)).toEqual([84000, 84000, 84000]);
    expect(snapshots.map(p => p.scenarios.REALISTIC.allyIncomeMonthly)).toEqual([2_992_500, 0, 11_970_000]);
    expect(snapshots.map(p => p.scenarios.REALISTIC.allyIncomeAnnual)).toEqual([35_910_000, 0, 143_640_000]);
  });

  it("muestra la mezcla solar ya aplicada y mantiene los cinco visuales y la hoja solar", async () => {
    const fixture = await sharp({ create: {
      width: 120, height: 80, channels: 3, background: { r: 20, g: 100, b: 60 },
    } }).jpeg().toBuffer();
    const benefitFixtures = new Map<string, Buffer>();
    for (const [index, url] of Object.values(ALLY_PLATFORM_BENEFIT_IMAGE_URLS).entries()) {
      benefitFixtures.set(url, await sharp({ create: {
        width: 120, height: 80, channels: 3, background: { r: 40 + index * 30, g: 120, b: 60 },
      } }).jpeg().toBuffer());
    }
    vi.mocked(axios.get).mockImplementation(async url => ({
      data: benefitFixtures.get(String(url)) ?? fixture, headers: { "content-type": "image/jpeg" },
    }));
    const input = {
      ...data,
      hasSolarPanels: true,
      solarCoveragePercent: 50,
      solarEnergyCostPerKwh: 250,
      solarProgramEnabled: true,
      solarProgramCurrentBillCop: 2_184_000,
      solarProgramSavingsCoveragePercent: 39.54,
      solarProgramMonthlyFinancingPaymentCop: 2_162_043,
      solarProgramInitialMonthlySolarBillCop: 142_394,
      solarProgramPostAgreementMonthlySolarBillCop: 423_835,
      solarProgramTotalEnergySavingsCop: 394_162_273,
      solarProgramAnnualReturnPercent: 15.9,
      solarProgramAgreementYears: 6,
    };
    const content = buildAllySpacePdfContent(input);
    expect(content.incomeProjection!.assumptions.effectiveEnergyCostPerKwh).toBe(550);
    expect(content.remuneration!.remunerationPerKwhCop).toBe(46.875);
    expect(content.incomeProjection!.scenarios.REALISTIC.allyIncomeMonthly).toBe(3_937_500);
    expect(content.combinedBenefit!.combinedMonthlyCop).toBe(3_937_500 - 120_437);
    const { pdf, page, text } = await render(input);
    expect(text).toContain("$550 COP/kWh");
    expect(text).toContain("$46,875 COP/kWh");
    expect(text).toContain("Costo efectivo = 50 % red × $850 COP/kWh + 50 % solar × $250 COP/kWh");
    expect(text).toContain("sin sumarla otra vez como ahorro");
    expect(pdf.getPageCount()).toBe(11);
    // Logo del header + los cinco visuales (todos distintos) en la hoja premium.
    expect(pdf.getPages()[1].node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).keys()).toHaveLength(6);
    expect(pageStream(pdf.getPages()[1]).match(/\/I\d+ Do/g)).toHaveLength(6);
    expectTextWithinMargins(page);
    const fullText = pdf.getPages().map(pageText).join(" ");
    expect(fullText).toContain("Pago estable de energía con acuerdo solar");
    expect(fullText).toContain("Tasa de rendimiento anual de la inversión");
    expect(fullText).toContain("15,9%");
  });

  it.each([
    { hasSolarPanels: false, solarCoveragePercent: 50, solarEnergyCostPerKwh: 250 },
    { hasSolarPanels: true, solarCoveragePercent: 50, solarEnergyCostPerKwh: null },
  ])("no inventa descuento solar sin alcance y costo válidos (%j)", overrides => {
    const content = buildAllySpacePdfContent({ ...data, ...overrides });
    expect(content.remuneration!.effectiveEnergyCost).toBe("$850 COP/kWh");
    expect(content.remuneration!.energyCostNote).toContain("no se aplica reducción solar");
    expect(content.incomeProjection!.scenarios.REALISTIC.allyIncomeMonthly).toBe(2_992_500);
  });

  it("no paga canon sobre un margen negativo", async () => {
    const input = { ...data, salePricePerKwh: 800, energyCostPerKwh: 850, allySharePercent: 15 };
    const content = buildAllySpacePdfContent(input);
    expect(content.remuneration!.remunerationPerKwhCop).toBe(0);
    expect(content.remuneration!.remunerationPerKwh).toBe("$0 COP/kWh");
    expect(Object.values(content.incomeProjection!.scenarios).every(s => s.allyIncomeMonthly === 0)).toBe(true);
    const { text } = await render(input);
    expect(text).toContain("mínimo $0");
  });

  it("mantiene indicadores y participaciones de terceros fuera del PDF renderizado", async () => {
    const { pdf } = await render({
      ...data,
      // Runtime payload mal formado: nunca debe renderizar estos campos privados.
      ...{ capex: 987654321, roi: 88.888, tir: 77.777, payback: 17.77, investorSharePercent: 61.23, evgreenSharePercent: 34.56 },
    });
    const text = pdf.getPages().map(pageText).join(" ").toLowerCase();
    for (const term of [
      "capex", "roi", "tir", "payback", "waterfall", "inversionista", "inversor",
      "meta de inversión", "participación de evgreen", "participación del inversionista", "rendimiento anual de la inversión",
    ]) expect(text).not.toMatch(new RegExp(`\\b${term}\\b`, "i"));
    for (const amount of ["987.654.321", "88,888", "77,777", "61,23", "34,56"]) expect(text).not.toContain(amount);
    // Tampoco imprime importes agregados de venta o margen: sólo base, unidades y canon.
    expect(text).not.toContain("$151.200.000");
    expect(text).not.toContain("$79.800.000");
  });
});
