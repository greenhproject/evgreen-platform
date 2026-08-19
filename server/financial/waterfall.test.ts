import { describe, expect, it } from "vitest";
import { calculateFinancialWaterfall, validateFinancialSplit } from "./waterfall";

describe("waterfall financiero canónico", () => {
  it("calcula el retorno del inversionista únicamente después de energía y aliado", () => {
    const result = calculateFinancialWaterfall({
      grossRevenue: 155_520_000,
      totalKwh: 86_400,
      energyCostPerKwh: 700,
      hostSharePercent: 10,
      investorSharePercent: 70,
      evgreenSharePercent: 30,
    });

    expect(result.energyCost).toBe(60_480_000);
    expect(result.grossMargin).toBe(95_040_000);
    expect(result.hostPayout).toBe(9_504_000);
    expect(result.netDistributableMargin).toBe(85_536_000);
    expect(result.investorPool).toBe(59_875_200);
    expect(result.evgreenPool).toBe(25_660_800);
    expect(result.investorPool + result.evgreenPool).toBe(result.netDistributableMargin);
  });

  it("no distribuye retorno cuando el costo energético absorbe el ingreso", () => {
    const result = calculateFinancialWaterfall({
      grossRevenue: 70_000,
      totalKwh: 100,
      energyCostPerKwh: 700,
      hostSharePercent: 10,
      investorSharePercent: 70,
      evgreenSharePercent: 30,
    });

    expect(result.grossMargin).toBe(0);
    expect(result.hostPayout).toBe(0);
    expect(result.investorPool).toBe(0);
    expect(result.evgreenPool).toBe(0);
  });

  it("rechaza un reparto neto que no suma 100 %", () => {
    expect(() => validateFinancialSplit({
      hostSharePercent: 10,
      investorSharePercent: 70,
      evgreenSharePercent: 20,
    })).toThrow("debe sumar exactamente 100 %");
  });
});
