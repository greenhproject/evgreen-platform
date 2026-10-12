import { describe, expect, it } from "vitest";
import { buildAllyIncomeProjection } from "../shared/ally-space-income-projection";

describe("ally space income projection", () => {
  const baseInput = {
    estimatedDailyVehicles: 850,
    estimatedEvPercent: 10,
    chargerCount: 3,
    totalPowerKw: 360,
    operatingHoursPerDay: 24,
    efficiencyPercent: 92,
    salePricePerKwh: 1800,
    energyCostPerKwh: 850,
    allySharePercent: 10,
  };

  it("calcula escenarios 5%, 10% y 15% desde un supuesto base de 10% EV", () => {
    const snapshot = buildAllyIncomeProjection(baseInput);
    expect(snapshot.version).toBe(1);
    expect(snapshot.assumptions.configuredConnectors).toBe(6);
    expect(snapshot.scenarios.PESSIMISTIC.scenarioEvPercent).toBe(5);
    expect(snapshot.scenarios.REALISTIC.scenarioEvPercent).toBe(10);
    expect(snapshot.scenarios.OPTIMISTIC.scenarioEvPercent).toBe(15);
  });

  it("calcula mangueras y cargadores equivalentes y limita la atención por capacidad", () => {
    const snapshot = buildAllyIncomeProjection(baseInput);
    const pessimistic = snapshot.scenarios.PESSIMISTIC;
    const realistic = snapshot.scenarios.REALISTIC;
    const optimistic = snapshot.scenarios.OPTIMISTIC;

    expect(pessimistic.requiredConnectorsForDemand).toBe(3);
    expect(pessimistic.requiredChargersForDemand).toBe(2);
    expect(realistic.requiredConnectorsForDemand).toBe(5);
    expect(realistic.requiredChargersForDemand).toBe(3);
    expect(optimistic.requiredConnectorsForDemand).toBe(7);
    expect(optimistic.requiredChargersForDemand).toBe(4);
    expect(optimistic.sessionsPerDay).toBeLessThan(optimistic.unconstrainedSessionsPerDay);
    expect(optimistic.capacityLimited).toBe(true);
  });

  it("calcula ingreso bruto, margen bruto y equivalente del aliado sin información de inversionistas", () => {
    const snapshot = buildAllyIncomeProjection(baseInput);
    const realistic = snapshot.scenarios.REALISTIC;

    expect(realistic.energyKwhPerMonth).toBe(102000);
    expect(realistic.grossRevenueMonthly).toBe(183600000);
    expect(realistic.energyCostMonthly).toBe(86700000);
    expect(realistic.grossMarginMonthly).toBe(96900000);
    expect(realistic.allyIncomeMonthly).toBe(9690000);
    expect(realistic.allyIncomeAnnual).toBe(116280000);
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain("inversionista");
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain("waterfall");
  });

  it("usa costo energético solar solo cuando cobertura y costo están validados", () => {
    const snapshot = buildAllyIncomeProjection({
      ...baseInput,
      hasSolarPanels: true,
      solarCoveragePercent: 50,
      solarEnergyCostPerKwh: 250,
    });
    expect(snapshot.assumptions.solarCostApplied).toBe(true);
    expect(snapshot.assumptions.effectiveEnergyCostPerKwh).toBe(550);
  });
});
