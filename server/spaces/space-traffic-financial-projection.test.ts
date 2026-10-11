import { describe, expect, it } from "vitest";
import { buildSpaceTrafficProjection } from "../../shared/space-traffic-financial-projection";

const base = {
  investmentCop: 180_000_000,
  estimatedDailyVehicles: 1_000,
  estimatedEvPercent: 10,
  chargerCount: 4,
  spaceType: "gas_station",
  salePricePerKwh: 1_800,
  energyCostPerKwh: 700,
};

describe("proyección financiera por demanda vehicular de espacios", () => {
  it("usa el flujo y porcentaje EV declarado como demanda realista, no horas equivalentes", () => {
    const projection = buildSpaceTrafficProjection(base);
    const pessimistic = projection.scenarios.PESSIMISTIC;
    const realistic = projection.scenarios.REALISTIC;
    const optimistic = projection.scenarios.OPTIMISTIC;

    expect(projection.basis).toBe("EVGREEN_SPACE_DEMAND_SCENARIOS");
    expect(projection.assumptions.benchmarkKwhPerSession).toBe(40);
    expect(pessimistic.scenarioEvPercent).toBe(5);
    expect(realistic.scenarioEvPercent).toBe(10);
    expect(optimistic.scenarioEvPercent).toBe(15);
    expect(pessimistic.sessionsPerDay).toBe(50);
    expect(realistic.sessionsPerDay).toBe(100);
    expect(optimistic.sessionsPerDay).toBe(150);
    expect(realistic.energyKwhPerDay).toBe(4_000);
    expect(realistic.energyKwhPerMonth).toBe(120_000);
  });

  it("reconcilia venta, costo de energía y participación del aliado con el ejemplo operativo", () => {
    const realistic = buildSpaceTrafficProjection(base).scenarios.REALISTIC;

    expect(realistic.waterfall.grossRevenue).toBe(216_000_000);
    expect(realistic.waterfall.energyCost).toBe(84_000_000);
    expect(realistic.waterfall.grossMargin).toBe(132_000_000);
    expect(realistic.waterfall.hostPayout).toBe(13_200_000);
    expect(realistic.waterfall.netDistributableMargin).toBe(118_800_000);
    expect(realistic.waterfall.investorPool).toBe(71_280_000);
    expect(realistic.waterfall.evgreenPool).toBe(47_520_000);
  });

  it("limita sesiones únicamente por capacidad física de cargadores duales", () => {
    const oneCharger = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, estimatedEvPercent: 5, chargerCount: 1 });
    const fourChargers = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, estimatedEvPercent: 5, chargerCount: 4 });

    expect(oneCharger.scenarios.REALISTIC.unconstrainedSessionsPerDay).toBe(200);
    expect(oneCharger.scenarios.REALISTIC.capacitySessionsPerDay).toBe(42);
    expect(oneCharger.scenarios.REALISTIC.sessionsPerDay).toBe(42);
    expect(oneCharger.scenarios.REALISTIC.capacityLimited).toBe(true);
    expect(fourChargers.scenarios.REALISTIC.capacitySessionsPerDay).toBe(168);
    expect(fourChargers.scenarios.REALISTIC.sessionsPerDay).toBe(168);
    expect(fourChargers.scenarios.REALISTIC.capacityLimited).toBe(true);
  });

  it("calcula ROI y recuperación desde la cascada financiera, con dirección correcta entre escenarios", () => {
    const projection = buildSpaceTrafficProjection(base);
    const pessimistic = projection.scenarios.PESSIMISTIC;
    const realistic = projection.scenarios.REALISTIC;
    const optimistic = projection.scenarios.OPTIMISTIC;

    expect(projection.assumptions.investorSharePercent).toBe(60);
    expect(projection.assumptions.evgreenSharePercent).toBe(40);
    expect(realistic.roiAnnualPercent).toBeGreaterThan(pessimistic.roiAnnualPercent);
    expect(optimistic.roiAnnualPercent).toBeGreaterThan(realistic.roiAnnualPercent);
    expect(optimistic.paybackMonths).toBeLessThan(realistic.paybackMonths);
  });
});
