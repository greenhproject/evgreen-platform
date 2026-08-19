import { describe, expect, it } from "vitest";
import { buildCrowdfundingProjectInheritanceUpdate, getCrowdfundingInheritanceSnapshot, mapInheritedSpacePhotos, requiresFinancialOverride } from "./crowdfunding-inheritance";

describe("getCrowdfundingInheritanceSnapshot", () => {
  it("preserva todos los valores financieros aprobados del espacio sin valores ficticios", () => {
    const snapshot = getCrowdfundingInheritanceSnapshot({
      spaceName: "Terminal Verde",
      city: "Duitama",
      department: "Boyacá",
      address: "Calle 1 # 2-3",
      estimatedInvestmentCop: 1500000000,
      minimumInvestmentCop: 25000000,
      estimatedPowerKw: 500,
      estimatedChargerCount: 4,
      estimatedRoiPercent: "102.50",
      estimatedPaybackMonths: 18,
      recommendedChargerType: "DC CCS2",
      technicalScore: 88,
    });

    expect(snapshot).toMatchObject({
      targetAmount: 1500000000,
      minimumInvestment: 25000000,
      totalPowerKw: 500,
      chargerCount: 4,
      chargerPowerKw: 125,
      estimatedRoiPercent: "102.50",
      estimatedPaybackMonths: 18,
      isFinancialProjectionComplete: true,
    });
  });

  it("identifica las proyecciones faltantes para que no se rellenen con defaults ficticios", () => {
    const snapshot = getCrowdfundingInheritanceSnapshot({
      spaceName: "Espacio sin proyección",
      city: "Bogotá",
      address: "Calle 1",
    });

    expect(snapshot.targetAmount).toBeNull();
    expect(snapshot.missingFinancialFields).toEqual([
      "meta de inversión",
      "inversión mínima",
      "ROI estimado",
      "payback estimado",
    ]);
  });

  it("sincroniza los campos aprobados sin sobreescribir con defaults financieros cuando están ausentes", () => {
    const update = buildCrowdfundingProjectInheritanceUpdate({
      spaceName: "EDS Norte",
      city: "Bogotá",
      department: "Cundinamarca",
      address: "Autopista Norte",
      estimatedInvestmentCop: 900000000,
      minimumInvestmentCop: 10000000,
      estimatedRoiPercent: "76.25",
      estimatedPaybackMonths: 22,
      estimatedPowerKw: 240,
      estimatedChargerCount: 2,
    });

    expect(update).toMatchObject({
      name: "Punto de Carga - EDS Norte",
      targetAmount: 900000000,
      minimumInvestment: 10000000,
      estimatedRoiPercent: "76.25",
      estimatedPaybackMonths: 22,
      totalPowerKw: 240,
      chargerCount: 2,
      chargerPowerKw: 120,
    });
    expect(update).not.toHaveProperty("hasSolarPanels");
  });

  it("mantiene las fotos del espacio en orden y con captions para la galería de crowdfunding", () => {
    const photos = mapInheritedSpacePhotos([
      { submissionId: 8, url: "https://img/transformador.jpg", type: "transformer", caption: "Transformador existente", sortOrder: 2 },
      { submissionId: 8, url: "https://img/fachada.jpg", type: "general", caption: "Fachada del sitio", sortOrder: 0 },
      { submissionId: 8, url: "https://img/parqueadero.jpg", type: "parking_area", caption: null, sortOrder: 1 },
    ]);

    expect(photos[8]).toEqual([
      { url: "https://img/fachada.jpg", type: "general", caption: "Fachada del sitio" },
      { url: "https://img/parqueadero.jpg", type: "parking_area", caption: null },
      { url: "https://img/transformador.jpg", type: "transformer", caption: "Transformador existente" },
    ]);
  });

  it("conserva en el snapshot todos los datos técnicos, comerciales, de IA y visuales del espacio", () => {
    const snapshot = getCrowdfundingInheritanceSnapshot({
      id: 77,
      code: "SPE-2026-0077",
      spaceName: "Centro Comercial Verde",
      spaceType: "mall",
      city: "Bogotá",
      department: "Cundinamarca",
      address: "Calle 100 # 15-20",
      latitude: "4.682",
      longitude: "-74.051",
      technicalNotes: "Transformador cercano y tablero disponible.",
      electricalViability: "viable",
      availableAreaM2: "68.5",
      parkingSpots: 35,
      transformerCapacityKva: "500",
      hasElectricalPanel: true,
      electricalDistance: 18,
      hasInternet: true,
      is24Hours: true,
      estimatedDailyVehicles: 650,
      estimatedEvPercent: 7,
      socioeconomicStratum: 5,
      nearbyAttractions: "Oficinas y restaurantes",
      investmentType: "colectiva",
      aiAnalysis: "Evaluación IA favorable",
      financialProjectionUpdatedAt: "2026-08-18 12:00:00",
    }, [
      { submissionId: 77, url: "https://img/site.jpg", type: "general", caption: "Vista del sitio", sortOrder: 1 },
      { submissionId: 77, url: "https://img/panel.jpg", type: "electrical_panel", caption: "Tablero", sortOrder: 0 },
    ]);

    expect(snapshot).toMatchObject({
      source: "SPACE",
      spaceId: 77,
      spaceCode: "SPE-2026-0077",
      spaceType: "mall",
      department: "Cundinamarca",
      electricalViability: "viable",
      availableAreaM2: "68.5",
      parkingSpots: 35,
      transformerCapacityKva: "500",
      electricalDistanceM: 18,
      estimatedDailyVehicles: 650,
      estimatedEvPercent: 7,
      investmentType: "colectiva",
      aiAnalysis: "Evaluación IA favorable",
    });
    expect(snapshot.photos).toEqual([
      { url: "https://img/panel.jpg", type: "electrical_panel", caption: "Tablero" },
      { url: "https://img/site.jpg", type: "general", caption: "Vista del sitio" },
    ]);
  });

  it("solo exige motivo cuando una edición cambia realmente valores financieros heredados", () => {
    const project = {
      spaceSubmissionId: 8,
      targetAmount: 900000000,
      minimumInvestment: 10000000,
      estimatedRoiPercent: "76.25",
      estimatedPaybackMonths: 22,
      totalPowerKw: 240,
      chargerCount: 2,
      chargerPowerKw: 120,
    };

    expect(requiresFinancialOverride(project, { city: "Bogotá" })).toBe(false);
    expect(requiresFinancialOverride(project, { targetAmount: 900000000, estimatedRoiPercent: 76.25 })).toBe(false);
    expect(requiresFinancialOverride(project, { targetAmount: 950000000 })).toBe(true);
    expect(requiresFinancialOverride({ ...project, spaceSubmissionId: null }, { targetAmount: 950000000 })).toBe(false);
  });
});
