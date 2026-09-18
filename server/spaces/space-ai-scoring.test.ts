import { describe, expect, it } from "vitest";
import { __testables } from "./space-ai-scoring";

const modelResponse = {
  summary: "Predio con contexto comercial favorable.",
  strengths: ["Acceso visible desde la vía principal."],
  weaknesses: ["Pendiente validar la carga existente."],
  recommendation: "Instalar un cargador rápido DC.",
  estimatedChargers: 1,
  estimatedPowerKw: 120,
  investmentAppeal: "alto" as const,
  scoreComponents: {
    technical: 20,
    traffic: 12,
    visualSite: 16,
    demandContext: 12,
    operatingAccess: 9,
  },
  visualAnalysis: {
    usableArea: "Se aprecia área de parqueo utilizable.",
    accessRoads: "Acceso vehicular visible.",
    circulationSafety: "Requiere demarcación final.",
    electricalEvidence: "No se observa placa del transformador.",
    confidence: "media" as const,
    findings: ["El acceso principal es visible."],
  },
  evidenceLimitations: ["No se entregó estudio de carga."],
};

describe("normalización del scoring multimodal de espacios", () => {
  it("impone la infraestructura DC y la distribución 60/40 para una EDS", () => {
    const analysis = __testables.normalizeModelAnalysis(modelResponse, {
      spaceType: "gas_station",
      transformerCapacityKva: 112.5,
      estimatedPowerKw: null,
      estimatedChargerCount: null,
    });

    expect(analysis.score).toBe(75);
    expect(analysis.scoreComponents.traffic).toBe(18);
    expect(analysis.estimatedPowerKw).toBe(120);
    expect(analysis.dcInfrastructure.requiredTransformerKva).toBe(150);
    expect(analysis.electricalViability).toBe("requires_upgrade");
    expect(analysis.revenueDistribution).toMatchObject({ investorSharePercent: 60, evgreenSharePercent: 40 });
    expect(analysis.recommendation).toContain("transformador dedicado");
  });

  it("conserva una potencia DC manual superior y usa la distribución 70/30 fuera de EDS", () => {
    const analysis = __testables.normalizeModelAnalysis({
      ...modelResponse,
      estimatedPowerKw: 120,
      estimatedChargers: 1,
    }, {
      spaceType: "mall",
      transformerCapacityKva: null,
      estimatedPowerKw: 240,
      estimatedChargerCount: 2,
    });

    expect(analysis.estimatedPowerKw).toBe(240);
    expect(analysis.estimatedChargers).toBe(2);
    expect(analysis.dcInfrastructure.requiredTransformerKva).toBe(300);
    expect(analysis.revenueDistribution).toMatchObject({ investorSharePercent: 70, evgreenSharePercent: 30 });
  });
});
