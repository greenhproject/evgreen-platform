import { describe, expect, it } from "vitest";
import { annualizeImpact, calculateCarbonProgramEconomics, calculateEvDisplacementImpact, calculateSolarBackedImpact } from "../../shared/carbon-program-calculations";

describe("impacto solar asignable", () => {
  it("no atribuye más kWh solares que la carga o la medición verificada", () => {
    expect(calculateSolarBackedImpact({
      chargingKwh: 1000,
      verifiedSolarKwh: 1250,
      solarAvoidedFactorTco2ePerMwh: 0.66,
    })).toMatchObject({
      solarBackedKwh: 1000,
      solarCoveragePercent: 100,
      estimatedAvoidedTco2e: 0.66,
    });

    expect(calculateSolarBackedImpact({
      chargingKwh: 1000,
      verifiedSolarKwh: 250,
      solarAvoidedFactorTco2ePerMwh: 0.66,
    })).toMatchObject({
      solarBackedKwh: 250,
      solarCoveragePercent: 25,
      estimatedAvoidedTco2e: 0.165,
    });
  });

  it("no anualiza cuando no hay período observado", () => {
    expect(annualizeImpact({ estimatedAvoidedTco2e: 2.3, observedDays: 0 })).toBe(0);
    expect(annualizeImpact({ estimatedAvoidedTco2e: 2.3, observedDays: 365 })).toBe(2.3);
  });
});

describe("impacto operativo por movilidad eléctrica", () => {
  it("estima movilidad sobre todos los kWh entregados solo cuando el factor está habilitado", () => {
    const impact = calculateEvDisplacementImpact({
      chargingKwh: 9_735.7,
      enabled: true,
      displacementFactorTco2ePerMwh: 0.5,
    });
    expect(impact).toMatchObject({
      chargingKwh: 9_735.7,
      factorApplied: 0.5,
      isEnabled: true,
    });
    expect(impact.estimatedAvoidedTco2e).toBeCloseTo(4.86785, 8);
  });

  it("no genera una estimación operativa si no existe una metodología/factor habilitado", () => {
    expect(calculateEvDisplacementImpact({
      chargingKwh: 9_735.7,
      enabled: false,
      displacementFactorTco2ePerMwh: 0.5,
    })).toMatchObject({
      factorApplied: 0,
      isEnabled: false,
      estimatedAvoidedTco2e: 0,
    });
  });
});

describe("economía de créditos en preauditoría", () => {
  it("incluye costos fijos, variables y comisión en el punto de equilibrio", () => {
    const result = calculateCarbonProgramEconomics({
      projectedTco2e: 20,
      estimatedCreditPriceCopPerTco2e: 100000,
      registryCommissionPercent: 10,
      costs: [
        { amountCop: 500000, costType: "FIXED", periodicity: "ANNUAL" },
        { amountCop: 5000, costType: "VARIABLE_PER_TCO2E", periodicity: "ONE_TIME" },
      ],
    });

    expect(result.netContributionCopPerTco2e).toBe(85000);
    expect(result.fixedAnnualCop).toBe(500000);
    expect(result.breakEvenTco2e).toBeCloseTo(500000 / 85000, 8);
    expect(result.projectedNetCop).toBe(1200000);
    expect(result.isEconomicallyViable).toBe(true);
  });

  it("no recomienda venta si cada crédito deja una contribución no positiva", () => {
    const result = calculateCarbonProgramEconomics({
      projectedTco2e: 100,
      estimatedCreditPriceCopPerTco2e: 1000,
      registryCommissionPercent: 50,
      costs: [{ amountCop: 750, costType: "VARIABLE_PER_TCO2E", periodicity: "ONE_TIME" }],
    });

    expect(result.breakEvenTco2e).toBeNull();
    expect(result.isEconomicallyViable).toBe(false);
  });
});
