import { describe, expect, it } from "vitest";
import { buildAllySpacePdfContent, type AllySpacePdfData } from "./ally-space-pdf-service";

const sampleData: AllySpacePdfData = {
  code: "SPE-TEST-0001",
  spaceName: "EDS Aliada NQS",
  spaceType: "gas_station",
  address: "Carrera 30 # 80-20",
  city: "Bogotá",
  department: "Cundinamarca",
  country: "Colombia",
  status: "letter_accepted",
  submitterName: "María Aliada",
  submitterCompany: "EDS Aliada S.A.S.",
  availableAreaM2: 42,
  parkingSpots: 4,
  transformerCapacityKva: 150,
  hasElectricalPanel: true,
  hasSolarPanels: false,
  electricalDistance: 35,
  hasInternet: true,
  operatingHoursStart: "06:00",
  operatingHoursEnd: "22:00",
  is24Hours: false,
  estimatedDailyVehicles: 700,
  estimatedEvPercent: 10,
  nearbyAttractions: "NQS y comercio de la zona",
  socioeconomicStratum: 4,
  electricalViability: "requires_upgrade",
  estimatedPowerKw: 120,
  estimatedChargerCount: 2,
  recommendedChargerType: "CCS2",
  photos: [],
  generatedAt: new Date("2026-10-11T20:00:00.000Z"),
};

describe("buildAllySpacePdfContent", () => {
  it("construye una ficha útil con datos técnicos y responsabilidades", () => {
    const content = buildAllySpacePdfContent(sampleData);
    const allText = JSON.stringify(content);

    expect(content.statusLabel).toBe("Carta aceptada");
    expect(content.profileRows).toContainEqual(["Nombre del espacio", "EDS Aliada NQS"]);
    expect(content.technicalRows).toContainEqual(["Potencia proyectada", "120 kW DC"]);
    expect(content.operatingRows).toContainEqual(["Vehículos por día", "700"]);
    expect(content.allyResponsibilities.length).toBeGreaterThanOrEqual(4);
    expect(content.evgreenResponsibilities.length).toBeGreaterThanOrEqual(4);
    expect(content.nextSteps.length).toBeGreaterThanOrEqual(4);
    expect(allText).toContain("contrato");
    expect(allText).toContain("Carta aceptada");
  });

  it("no expone conceptos reservados del prospecto de inversión", () => {
    const content = buildAllySpacePdfContent({
      ...sampleData,
      // Estos campos no forman parte de AllySpacePdfData a propósito.
      // El test protege el contrato de datos que llega al documento.
    });
    const allText = JSON.stringify(content).toLowerCase();
    const forbiddenTerms = [
      "roi",
      "payback",
      "waterfall",
      "inversionista",
      "inversor",
      "meta de inversión",
      "capital total",
      "participación del inversionista",
    ];

    for (const term of forbiddenTerms) {
      expect(allText).not.toContain(term);
    }
  });
});
