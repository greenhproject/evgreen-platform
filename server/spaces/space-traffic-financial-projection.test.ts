import { describe, expect, it } from "vitest";
import { buildSpaceTrafficProjection } from "../../shared/space-traffic-financial-projection";

const base = {
  investmentCop: 180_000_000,
  estimatedDailyVehicles: 900,
  estimatedEvPercent: 5,
  chargerCount: 1,
  spaceType: "gas_station",
  salePricePerKwh: 1_800,
  energyCostPerKwh: 700,
};

describe("proyección financiera por tráfico de espacios", () => {
  it("separa la demanda capturable de la capacidad física de cargadores duales", () => {
    const projection = buildSpaceTrafficProjection(base);
    const realistic = projection.scenarios.REALISTIC;

    expect(realistic.eligibleEvVehiclesPerDay).toBe(45);
    expect(realistic.unconstrainedSessionsPerDay).toBeCloseTo(20.25, 2);
    expect(realistic.capacitySessionsPerDay).toBeCloseTo(40.1, 2);
    expect(realistic.sessionsPerDay).toBeCloseTo(20.25, 2);
    expect(realistic.sessionsPerDay).toBeLessThan(realistic.capacitySessionsPerDay);
  });

  it("aumenta el techo de atención al agregar cargadores, sin inventar demanda", () => {
    const oneCharger = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, chargerCount: 1 });
    const fourChargers = buildSpaceTrafficProjection({ ...base, estimatedDailyVehicles: 4_000, chargerCount: 4 });

    expect(oneCharger.scenarios.OPTIMISTIC.capacitySessionsPerDay).toBeCloseTo(40.1, 2);
    expect(fourChargers.scenarios.OPTIMISTIC.capacitySessionsPerDay).toBeCloseTo(160.4, 2);
    expect(oneCharger.scenarios.OPTIMISTIC.sessionsPerDay).toBeCloseTo(40.1, 2);
    expect(fourChargers.scenarios.OPTIMISTIC.sessionsPerDay).toBeGreaterThan(oneCharger.scenarios.OPTIMISTIC.sessionsPerDay);
  });

  it("calcula ROI y payback desde el waterfall EDS, no desde valores escritos manualmente", () => {
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
