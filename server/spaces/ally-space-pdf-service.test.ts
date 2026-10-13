import { describe, expect, it } from "vitest";
import { buildAllyProjectionDisclosure, buildAllySpacePdfContent, requiresDedicatedOperatingPage, type AllySpacePdfData } from "./ally-space-pdf-service";

const sampleData: AllySpacePdfData = {
  code: "SPE-TEST-0001",
  spaceName: "EDS Aliada NQS",
  spaceType: "gas_station",
  address: "Carrera 30 # 80-20",
  city: "Bogotá",
  department: "Cundinamarca",
  country: "Colombia",
  latitude: 4.686947,
  longitude: -74.126475,
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
  salePricePerKwh: 1800,
  energyCostPerKwh: 850,
  efficiencyPercent: 92,
  allySharePercent: 10,
  solarProgramEnabled: true,
  solarProgramCurrentBillCop: 15_000_000,
  solarProgramSavingsCoveragePercent: 40,
  solarProgramAgreementYears: 6,
  solarProgramAnnualCpiPercent: 3,
  solarProgramUsefulLifeYears: 30,
  solarSystemPowerKwp: 112,
  solarAnnualGenerationKwh: 140870,
  solarSelfConsumptionPercent: 40,
  solarExportPercent: 60,
  solarGridTariffCopPerKwh: 910,
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
    expect(content.incomeProjection?.scenarios.PESSIMISTIC.scenarioEvPercent).toBe(5);
    expect(content.incomeProjection?.scenarios.REALISTIC.scenarioEvPercent).toBe(10);
    expect(content.incomeProjection?.scenarios.OPTIMISTIC.scenarioEvPercent).toBe(15);
    expect(content.incomeProjection?.scenarios.REALISTIC.grossRevenueMonthly).toBeGreaterThan(0);
    expect(content.incomeProjection?.scenarios.REALISTIC.allyIncomeMonthly).toBeGreaterThan(0);
    expect(content.incomeProjection?.scenarios.REALISTIC.allyIncomeAnnual).toBe(content.incomeProjection?.scenarios.REALISTIC.allyIncomeMonthly! * 12);
    expect(content.solarProgram?.initialMonthlySavingsCop).toBe(6_000_000);
    expect(content.solarProgram?.initialAnnualSavingsCop).toBe(72_000_000);
    expect(content.combinedBenefit?.combinedAnnualCop).toBeGreaterThan(72_000_000);
    expect(buildAllyProjectionDisclosure(content.incomeProjection!.assumptions).toLowerCase()).not.toContain("margen bruto");
    expect(buildAllyProjectionDisclosure(content.incomeProjection!.assumptions).toLowerCase()).not.toContain("ingreso bruto");
    expect(content.allyResponsibilities.length).toBeGreaterThanOrEqual(4);
    expect(content.evgreenResponsibilities.length).toBeGreaterThanOrEqual(4);
    expect(content.nextSteps.length).toBeGreaterThanOrEqual(4);
    expect(allText).toContain("contrato");
    expect(allText).toContain("Carta aceptada");
    expect(allText.toLowerCase()).not.toContain("nano banana");
    expect(allText).toContain("140870");
  });

  it("mueve operación a una hoja segura cuando el perfil técnico alcanzaría el pie", () => {
    const content = buildAllySpacePdfContent(sampleData);

    expect(requiresDedicatedOperatingPage(content.profileRows, content.technicalRows, content.operatingRows)).toBe(true);
  });

  it("conserva operación en el perfil cuando hay holgura real antes del pie", () => {
    expect(requiresDedicatedOperatingPage(
      [["Nombre", "Espacio"]],
      [["Potencia", "120 kW"]],
      [["Horario", "24 horas"]],
    )).toBe(false);
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
      "ingreso bruto",
      "margen bruto",
    ];

    for (const term of forbiddenTerms) {
      expect(allText).not.toContain(term);
    }
  });

  it("mantiene la presentación del aliado aislada de los valores upstream", () => {
    const content = buildAllySpacePdfContent(sampleData);
    const disclosure = buildAllyProjectionDisclosure(content.incomeProjection!.assumptions).toLowerCase();
    expect(disclosure).not.toContain("precio de venta");
    expect(disclosure).not.toContain("costo energético");
    expect(disclosure).not.toContain("del margen");
    expect(disclosure).toContain("estimación mensual del aliado");
  });

  it("identifica el proyecto solar de la electrolinera sin confundirlo con el programa del aliado", () => {
    const content = buildAllySpacePdfContent({
      ...sampleData,
      hasSolarPanels: true,
      chargingSolarOpenSolarProjectId: "CARGA-101",
      chargingSolarOpenSolarProjectTitle: "Solar electrolinera EDS NQS",
      chargingSolarSystemPowerKwp: 120,
      chargingSolarAnnualGenerationKwh: 180_000,
      allySolarOpenSolarProjectId: "ALIADO-202",
      allySolarOpenSolarProjectTitle: "Solar cubierta EDS NQS",
      allySolarOpenSolarAnnualConsumptionKwh: 96_000,
    });

    expect(content.technicalRows).toContainEqual(["Proyecto solar de carga", "Solar electrolinera EDS NQS"]);
    expect(content.technicalRows).toContainEqual(["Potencia solar de carga", "120 kWp"]);
    expect(content.technicalRows).toContainEqual(["Generación solar de carga", "180.000 kWh/año"]);
    expect(content.technicalRows.flat().join(" ").toLowerCase()).not.toContain("opensolar");
    expect(content.solarProgram?.assumptions.systemPowerKwp).toBe(112);
  });

  it("refleja el pago estable y el ahorro neto posterior sin confundirlos con la factura solar", () => {
    const content = buildAllySpacePdfContent({
      ...sampleData,
      solarProgramCurrentBillCop: 2_184_000,
      solarProgramEnergyOffsetPercent: 104.68,
      solarProgramSavingsCoveragePercent: 39.54,
      solarProgramMonthlyFinancingPaymentCop: 2_162_043,
      solarProgramInitialMonthlySolarBillCop: 142_394,
      solarProgramPostAgreementMonthlySolarBillCop: 423_835,
      solarProgramTotalEnergySavingsCop: 394_162_273,
      solarProgramAnnualReturnPercent: 15.9,
    });

    expect(content.solarProgram?.initialMonthlySavingsCop).toBe(2_041_606);
    expect(content.solarProgram?.initialMonthlyFinancingPaymentCop).toBe(2_162_043);
    expect(content.solarProgram?.initialMonthlyNetCashflowCop).toBe(-120_437);
    expect(content.solarProgram?.postAgreementMonthlyNetSavingsCop).toBe(2_183_975);
    expect(content.combinedBenefit?.solarMonthlyNetCashflowCop).toBe(-120_437);
    expect(content.combinedBenefit?.postAgreementSolarMonthlyNetSavingsCop).toBe(2_183_975);
    expect(content.combinedBenefit?.postAgreementCombinedMonthlyCop).toBeGreaterThan(content.combinedBenefit?.chargerMonthlyCop ?? 0);
    expect(content.solarProgram?.totalEnergySavingsCop).toBe(394_162_273);
    expect(content.solarProgram?.annualInvestmentReturnPercent).toBe(15.9);
  });
});
