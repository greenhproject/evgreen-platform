import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import sharp from "sharp";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import {
  ALLY_PLATFORM_BENEFIT_IMAGE_URLS,
  buildAllyPlatformBenefits,
  buildAllySpacePdfContent,
  generateAllySpacePdf,
  type AllySpacePdfData,
} from "./ally-space-pdf-service";

// QA completamente local: no descarga de medios, mapa, anexos ni acceso a BD.
vi.mock("axios", () => ({ default: { get: vi.fn().mockRejectedValue(new Error("offline test")) } }));

beforeEach(() => {
  vi.mocked(axios.get).mockReset().mockRejectedValue(new Error("offline test"));
});

function renderedText(bytes: Buffer): string {
  // jsPDF serializa cada línea como un Tj distinto: un salto no es pérdida de texto.
  return [...bytes.toString("latin1").matchAll(/\(((?:\\.|[^\\()])*)\) Tj/g)]
    .map(match => match[1]).join(" ");
}

async function mockBenefitImages(failedBenefit?: string) {
  const buffers = new Map<string, Buffer>();
  for (const [index, [id, url]] of Object.entries(ALLY_PLATFORM_BENEFIT_IMAGE_URLS).entries()) {
    if (id === failedBenefit) continue;
    buffers.set(url, await sharp({ create: {
      width: 120, height: 80, channels: 3,
      background: { r: 10 + index * 30, g: 100 + index * 20, b: 45 + index * 15 },
    } }).jpeg().toBuffer());
  }
  vi.mocked(axios.get).mockImplementation(async (url) => {
    const buffer = buffers.get(String(url));
    if (!buffer) throw new Error("local fixture unavailable");
    return { data: buffer, headers: { "content-type": "image/jpeg" } };
  });
}

const data: AllySpacePdfData = {
  code: "SPE-LOCAL-0018",
  spaceName: "Edificio de muestra local",
  spaceType: "parking",
  address: "Dirección de muestra",
  city: "Bogotá",
  department: "Cundinamarca",
  status: "approved",
  submitterName: "Aliado local",
  submitterCompany: "Empresa local",
  availableAreaM2: 80,
  parkingSpots: 6,
  nearbyAttractions: "Comercio cercano",
  estimatedChargerCount: 2,
  estimatedPowerKw: 240,
  estimatedDailyVehicles: 700,
  estimatedEvPercent: 10,
  is24Hours: true,
  salePricePerKwh: 1800,
  energyCostPerKwh: 850,
  allySharePercent: 10,
  solarProgramEnabled: false,
  photos: [],
  generatedAt: new Date("2026-11-13T17:00:00Z"),
};

describe("Ficha del aliado: beneficios del ecosistema", () => {
  it("incluye exactamente los cinco beneficios pedidos, sin duplicados", () => {
    const benefits = buildAllyPlatformBenefits();
    expect(benefits.map(b => b.id)).toEqual([
      "dashboard", "dynamic-pricing", "carbon-impact", "loyalty", "branding",
    ]);
    expect(buildAllySpacePdfContent(data).platformBenefits).toEqual(benefits);
  });

  it("no promete al host un listado operativo que aún no está habilitado", () => {
    const benefit = buildAllyPlatformBenefits()[0];
    expect(benefit.description).toContain("portal financiero");
    expect(benefit.description).toContain("requiere habilitación específica");
  });

  it("presenta tarifas opcionales por estación y límites, sin rentabilidad garantizada", () => {
    const benefit = buildAllyPlatformBenefits()[1];
    expect(benefit.description).toContain("opcionales");
    expect(benefit.description).toContain("ocupación de la estación");
    expect(benefit.description).toContain("límites configurados");
    expect(benefit.description).toContain("tarifa fija");
  });

  it("distingue impacto estimado y solar atribuible sin inventar certificados por sesión", () => {
    const benefit = buildAllyPlatformBenefits()[2];
    expect(benefit.description).toContain("CO2 evitado estimado");
    expect(benefit.description).toContain("factores documentados");
    expect(benefit.description).toContain("solar atribuible");
    expect(benefit.description).not.toContain("certificado por recarga");
  });

  it("distingue el canje actual a saldo de la expansión a servicios afiliados", () => {
    const benefit = buildAllyPlatformBenefits()[3];
    expect(benefit.description).toContain("saldo para futuras recargas");
    expect(benefit.description).toContain("servicios afiliados");
    expect(benefit.description).toContain("convenios");
    expect(benefit.description).toContain("integración del catálogo");
  });

  it("conserva el branding sujeto al diseño y no expone información financiera privada", () => {
    const benefits = buildAllyPlatformBenefits();
    expect(benefits[4].description).toContain("manual de marca y el diseño aprobado");
    const text = JSON.stringify(benefits).toLowerCase();
    for (const term of ["capex", "payback", "waterfall", "inversionista", "opensolar", "garantizado", "1800", "850"]) {
      expect(text).not.toContain(term);
    }
  });

  it("mantiene las proyecciones originales del aliado y el programa solar desactivado", () => {
    const content = buildAllySpacePdfContent(data);
    expect(content.incomeProjection?.scenarios.PESSIMISTIC.allyIncomeMonthly).toBe(3_990_000);
    expect(content.incomeProjection?.scenarios.REALISTIC.allyIncomeMonthly).toBe(7_980_000);
    expect(content.incomeProjection?.scenarios.OPTIMISTIC.allyIncomeMonthly).toBe(9_165_600);
    expect(content.solarProgram).toBeNull();
  });

  it("genera una página de beneficios íntegra después de la portada incluso sin imágenes", async () => {
    const bytes = await generateAllySpacePdf(data);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(10);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // jsPDF usa streams sin compresión: estos rótulos ASCII deben estar en la salida real.
    const serialized = bytes.toString("latin1");
    expect(serialized).toContain("EL VALOR DEL ECOSISTEMA EVGREEN");
    expect(renderedText(bytes)).toContain("CO2 evitado estimado");
    expect(serialized).toContain("ECOSISTEMA EVGREEN");
    expect(serialized).not.toContain("CONTINUACI");
    expect(serialized).toContain("Ficha del Aliado EVGreen");
  });

  it("dispone de una URL HTTPS externa diferente para cada beneficio", () => {
    const urls = Object.values(ALLY_PLATFORM_BENEFIT_IMAGE_URLS);
    expect(urls).toHaveLength(5);
    expect(new Set(urls).size).toBe(5);
    for (const url of urls) expect(url).toMatch(/^https:\/\/files\.manuscdn\.com\/.+\.jpg$/);
  });

  it("inserta los cinco visuales en una sola hoja y los identifica como conceptuales", async () => {
    await mockBenefitImages();
    const bytes = await generateAllySpacePdf(data);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(10);
    const resources = pdf.getPages()[1].node.Resources()!;
    expect(resources.lookup(PDFName.of("XObject"), PDFDict).keys()).toHaveLength(5);
    const serialized = bytes.toString("latin1");
    expect(serialized.match(/\/I\d+ Do/g)).toHaveLength(5);
    expect(serialized).toContain("no son capturas");
    expect(serialized).not.toContain("CONTINUACI");
    for (const url of Object.values(ALLY_PLATFORM_BENEFIT_IMAGE_URLS)) {
      expect(axios.get).toHaveBeenCalledWith(url, expect.objectContaining({ responseType: "arraybuffer", timeout: 10000 }));
    }
  });

  it("conserva la hoja, el texto y los otros cuatro visuales si falla un recurso", async () => {
    await mockBenefitImages("loyalty");
    const bytes = await generateAllySpacePdf(data);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(10);
    const resources = pdf.getPages()[1].node.Resources()!;
    expect(resources.lookup(PDFName.of("XObject"), PDFDict).keys()).toHaveLength(4);
    const serialized = bytes.toString("latin1");
    expect(serialized.match(/\/I\d+ Do/g)).toHaveLength(4);
    expect(renderedText(bytes)).toContain("saldo para futuras recargas");
    expect(serialized).not.toContain("CONTINUACI");
  });
});
