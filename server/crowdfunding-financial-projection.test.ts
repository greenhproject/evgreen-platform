import { describe, expect, it } from "vitest";
import {
  buildCrowdfundingProjectionSnapshot,
  getSelectedCrowdfundingProjection,
} from "../shared/crowdfunding-financial-projection";

describe("crowdfunding financial projection", () => {
  const assumptions = {
    investmentCop: 90_000_000,
    totalPowerKw: 120,
    salePricePerKwh: 1_800,
    energyCostPerKwh: 850,
    hostSharePercent: 10,
    investorSharePercent: 70,
    evgreenSharePercent: 30,
    efficiencyPercent: 92,
    fixedMonthlyExpenses: 0,
  };

  it("calcula pesimista, realista y optimista desde el mismo waterfall", () => {
    const snapshot = buildCrowdfundingProjectionSnapshot(assumptions, "REALISTIC");
    const pessimistic = snapshot.scenarios.PESSIMISTIC;
    const realistic = snapshot.scenarios.REALISTIC;
    const optimistic = snapshot.scenarios.OPTIMISTIC;

    expect(snapshot).toMatchObject({ version: 1, basis: "EVGREEN_CROWDFUNDING_SCENARIOS", selectedScenario: "REALISTIC" });
    expect(pessimistic.hoursPerDay).toBe(4);
    expect(realistic.hoursPerDay).toBe(6);
    expect(optimistic.hoursPerDay).toBe(9);
    expect(pessimistic.roiAnnualPercent).toBeLessThan(realistic.roiAnnualPercent);
    expect(realistic.roiAnnualPercent).toBeLessThan(optimistic.roiAnnualPercent);
    expect(pessimistic.paybackMonths).toBeGreaterThan(realistic.paybackMonths);
    expect(realistic.paybackMonths).toBeGreaterThan(optimistic.paybackMonths);
    expect(realistic.waterfall.grossRevenue - realistic.waterfall.energyCost)
      .toBe(realistic.waterfall.grossMargin);
    expect(realistic.waterfall.investorPool + realistic.waterfall.evgreenPool)
      .toBe(realistic.waterfall.netDistributableMargin);
  });

  it("toma ROI y payback exclusivamente del escenario seleccionado", () => {
    const snapshot = buildCrowdfundingProjectionSnapshot(assumptions, "PESSIMISTIC");
    expect(getSelectedCrowdfundingProjection(snapshot)).toEqual(snapshot.scenarios.PESSIMISTIC);
  });

  it("rechaza repartos o supuestos financieros inválidos", () => {
    expect(() => buildCrowdfundingProjectionSnapshot({ ...assumptions, investorSharePercent: 80 }, "REALISTIC"))
      .toThrow("debe sumar exactamente 100");
    expect(() => buildCrowdfundingProjectionSnapshot({ ...assumptions, investmentCop: 0 }, "REALISTIC"))
      .toThrow("inversión debe ser mayor");
  });
});
