import { describe, expect, it } from "vitest";
import { buildSpaceTrafficProjection } from "../../shared/space-traffic-financial-projection";

const base = {
  investmentCop: 180_000_000,
  estimatedDailyVehicles: 1_000,
  estimatedEvPercent: 10,
  chargerCount: 4,
  totalPowerKw: 480,
  operatingHoursPerDay: 16,
  efficiencyPercent: 92,
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

    expect(projection.basis).toBe("EVGREEN_SPACE_DEMAND_CAPACITY_SCENARIOS");
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

  it("limita sesiones por el menor techo entre mangueras y potencia instalada", () => {
    const oneCharger = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, estimatedEvPercent: 5, chargerCount: 1, totalPowerKw: 120 });
    const fourChargers = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, estimatedEvPercent: 5, chargerCount: 4, totalPowerKw: 480 });

    expect(oneCharger.scenarios.REALISTIC.unconstrainedSessionsPerDay).toBe(200);
    expect(oneCharger.scenarios.REALISTIC.capacitySessionsPerDay).toBe(40.2);
    expect(oneCharger.scenarios.REALISTIC.connectorCapacitySessionsPerDay).toBe(40.2);
    expect(oneCharger.scenarios.REALISTIC.powerCapacitySessionsPerDay).toBeCloseTo(44.16, 2);
    expect(oneCharger.scenarios.REALISTIC.capacityConstraint).toBe("CONNECTORS");
    expect(oneCharger.scenarios.REALISTIC.sessionsPerDay).toBe(40.2);
    expect(oneCharger.scenarios.REALISTIC.capacityLimited).toBe(true);
    expect(fourChargers.scenarios.REALISTIC.capacitySessionsPerDay).toBe(160.8);
    expect(fourChargers.scenarios.REALISTIC.sessionsPerDay).toBe(160.8);
    expect(fourChargers.scenarios.REALISTIC.capacityLimited).toBe(true);
  });

  it("reduce capacidad cuando la ventana y potencia no permiten servir todas las mangueras", () => {
    const lowPowerWindow = buildSpaceTrafficProjection({
      ...base,
      chargerCount: 1,
      totalPowerKw: 120,
      operatingHoursPerDay: 6,
    }).scenarios.REALISTIC;

    expect(lowPowerWindow.connectorCapacitySessionsPerDay).toBe(40.2);
    expect(lowPowerWindow.powerCapacityKwhPerDay).toBe(662.4);
    expect(lowPowerWindow.powerCapacitySessionsPerDay).toBeCloseTo(16.56, 2);
    expect(lowPowerWindow.capacitySessionsPerDay).toBeCloseTo(16.56, 2);
    expect(lowPowerWindow.capacityConstraint).toBe("POWER");
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
