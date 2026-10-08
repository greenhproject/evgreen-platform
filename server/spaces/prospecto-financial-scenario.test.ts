import { describe, expect, it } from "vitest";
import {
  assertProspectoFinancialScenarioIsDocumented,
  buildProspectoFinancialScenario,
  resolveProspectoTechnicalCondition,
} from "../../shared/prospecto-financial-scenario";

const baseInput = {
  investmentCop: 170_000_000,
  totalPowerKw: 240,
  salePricePerKwh: 1_800,
  energyCostPerKwh: 850,
  hostSharePercent: 10,
  investorSharePercent: 70,
  evgreenSharePercent: 30,
  efficiencyPercent: 92,
  fixedMonthlyExpenses: 0,
};

describe("escenario financiero de prospecto", () => {
  it("marca una potencia de 240 kW con transformador declarado de 112 kVA como condicionada a ampliación", () => {
    const technicalCondition = resolveProspectoTechnicalCondition({
      totalPowerKw: 240,
      transformerCapacityKva: 112,
      electricalViability: "requires_upgrade",
    });

    expect(technicalCondition.requiresGridUpgrade).toBe(true);
    expect(technicalCondition.reason).toContain("240 kW");
    expect(technicalCondition.reason).toContain("112 kVA");
    expect(() => assertProspectoFinancialScenarioIsDocumented({
      technicalCondition,
      capexIncludesGridUpgrade: false,
      technicalConditionNote: "",
    })).toThrow("requiere ampliación eléctrica");
  });

  it("usa los costos y el waterfall canónico para que los tres escenarios cambien en la dirección correcta", () => {
    const { projection } = buildProspectoFinancialScenario({
      ...baseInput,
      transformerCapacityKva: 500,
      electricalViability: "viable",
    });

    const pessimistic = projection.scenarios.PESSIMISTIC;
    const realistic = projection.scenarios.REALISTIC;
    const optimistic = projection.scenarios.OPTIMISTIC;
    expect(pessimistic.waterfall.energyCost).toBe(22_521_600);
    expect(pessimistic.roiAnnualPercent).toBeCloseTo(111.94, 2);
    expect(pessimistic.paybackMonths).toBeCloseTo(10.7, 1);
    expect(realistic.roiAnnualPercent).toBeGreaterThan(pessimistic.roiAnnualPercent);
    expect(optimistic.roiAnnualPercent).toBeGreaterThan(realistic.roiAnnualPercent);
    expect(optimistic.paybackMonths).toBeLessThan(realistic.paybackMonths);
  });

  it("descuenta gastos fijos antes del aliado y del reparto al inversionista", () => {
    const { projection } = buildProspectoFinancialScenario({
      ...baseInput,
      fixedMonthlyExpenses: 1_000_000,
      transformerCapacityKva: 500,
      electricalViability: "viable",
    });

    const pessimistic = projection.scenarios.PESSIMISTIC;
    expect(pessimistic.waterfall.grossMargin).toBe(24_171_200);
    expect(pessimistic.waterfall.hostPayout).toBe(2_417_120);
    expect(pessimistic.investorMonthlyCashflow).toBe(15_227_856);
    expect(pessimistic.roiAnnualPercent).toBeCloseTo(107.49, 2);
  });

  it("reconcilia las cifras publicadas de SPE-2026-0067 con el costo vigente y las métricas simples", () => {
    const { projection } = buildProspectoFinancialScenario({
      ...baseInput,
      fixedMonthlyExpenses: 350_000,
      transformerCapacityKva: 112,
      electricalViability: "requires_upgrade",
    });

    const pessimistic = projection.scenarios.PESSIMISTIC;
    const realistic = projection.scenarios.REALISTIC;
    const optimistic = projection.scenarios.OPTIMISTIC;

    expect(pessimistic.energyKwhPerMonth).toBe(26_496);
    expect(pessimistic.investorMonthlyCashflow).toBe(15_637_356);
    expect(pessimistic.roiAnnualPercent).toBe(110.38);
    expect(pessimistic.paybackMonths).toBe(10.9);
    expect(realistic.investorAnnualCashflow).toBe(282_795_408);
    expect(realistic.roiAnnualPercent).toBe(166.35);
    expect(optimistic.investorAnnualCashflow).toBe(425_516_112);
    expect(optimistic.paybackMonths).toBe(4.8);
  });
});
