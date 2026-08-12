import { describe, expect, it } from "vitest";
import { calculateGestorWaterfall, calculateGestorWaterfallFromAggregate, getColombiaDayBounds } from "./gestor-calculations";

describe("calculateGestorWaterfall", () => {
  it("preserva la bolsa del inversionista y descuenta la comisión solo de EVGreen", () => {
    const result = calculateGestorWaterfall({
      grossRevenue: 180_000,
      kwhConsumed: 100,
      energyPurchaseCostPerKwh: 850,
      hostSharePercent: 10,
      investorSharePercent: 70,
      evgreenSharePercent: 30,
      gestorCommissionPercent: 3.75,
    });

    expect(result.energyCost).toBe(85_000);
    expect(result.fixedExpenses).toBe(0);
    expect(result.grossMargin).toBe(95_000);
    expect(result.hostPayout).toBe(9_500);
    expect(result.netDistributableMargin).toBe(85_500);
    expect(result.investorPool).toBe(59_850);
    expect(result.evgreenPool).toBe(25_650);
    expect(result.gestorCommission).toBe(3_206.25);
    expect(result.evgreenRetained).toBe(22_443.75);
  });

  it("nunca permite que la comisión exceda la bolsa EVGreen", () => {
    const result = calculateGestorWaterfall({
      grossRevenue: 100_000,
      kwhConsumed: 0,
      energyPurchaseCostPerKwh: 0,
      hostSharePercent: 0,
      investorSharePercent: 70,
      evgreenSharePercent: 30,
      gestorCommissionPercent: 50,
    });

    expect(result.gestorCommission).toBe(30_000);
    expect(result.evgreenRetained).toBe(0);
  });

  it("reconcilia liquidaciones mensuales con un costo agregado verificado", () => {
    const result = calculateGestorWaterfallFromAggregate({
      grossRevenue: 180_000,
      energyCost: 85_000,
      fixedExpenses: 5_000,
      hostSharePercent: 10,
      investorSharePercent: 70,
      evgreenSharePercent: 30,
      gestorCommissionPercent: 3.75,
    });
    expect(result.netDistributableMargin).toBe(81_000);
    expect(result.gestorCommission).toBe(3_037.5);
  });
});

describe("getColombiaDayBounds", () => {
  it("crea un período diario de 24 horas que inicia a medianoche de Colombia", () => {
    const { start, end } = getColombiaDayBounds("2026-08-12");
    expect(start).toBe("2026-08-12T05:00:00.000Z");
    expect(end).toBe("2026-08-13T05:00:00.000Z");
  });
});
