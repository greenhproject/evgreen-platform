import { describe, expect, it } from "vitest";
import {
  DC_TRANSFORMER_POWER_FACTOR,
  MINIMUM_DC_CHARGER_POWER_KW,
  getRevenueDistributionForSpaceType,
  resolveDcInfrastructureRequirement,
} from "./space-investment-scoring-policy";

describe("política de inversión para espacios EVGreen", () => {
  it("fija un mínimo de 120 kW DC y un transformador dedicado de 150 kVA para un cargador de 120 kW", () => {
    const requirement = resolveDcInfrastructureRequirement({
      requestedPowerKw: 120,
      chargerCount: 1,
      transformerCapacityKva: 112.5,
    });

    expect(MINIMUM_DC_CHARGER_POWER_KW).toBe(120);
    expect(DC_TRANSFORMER_POWER_FACTOR).toBe(0.8);
    expect(requirement.requiredTransformerKva).toBe(150);
    expect(requirement.requiresDedicatedTransformer).toBe(true);
    expect(requirement.requiresGridUpgrade).toBe(true);
    expect(requirement.meetsDcMinimum).toBe(true);
    expect(requirement.reason).toContain("120 kW");
    expect(requirement.reason).toContain("150 kVA");
  });

  it("no permite que una recomendación inferior a 120 kW se trate como diseño DC compatible", () => {
    const requirement = resolveDcInfrastructureRequirement({
      requestedPowerKw: 80,
      chargerCount: 1,
      transformerCapacityKva: 150,
    });

    expect(requirement.meetsDcMinimum).toBe(false);
    expect(requirement.requiredTransformerKva).toBe(150);
    expect(requirement.reason).toContain("ajustarse al mínimo EVGreen");
  });

  it("aplica 60/40 en EDS y 70/30 en los demás tipos de ubicación", () => {
    expect(getRevenueDistributionForSpaceType("gas_station")).toMatchObject({
      basis: "EDS",
      investorSharePercent: 60,
      evgreenSharePercent: 40,
    });
    expect(getRevenueDistributionForSpaceType("mall")).toMatchObject({
      basis: "STANDARD",
      investorSharePercent: 70,
      evgreenSharePercent: 30,
    });
  });
});
