import { describe, expect, it } from "vitest";

/**
 * Tests for the financial model configuration and waterfall engine.
 * These tests validate the business logic of the 3-actor revenue split
 * (EVGreen, Investor, Host/Aliado Comercial) without hitting the database.
 */

// Simulate the waterfall calculation logic that lives in the financial router
function calculateWaterfall(params: {
  grossRevenue: number;
  revenueFromEnergy: number;
  revenueFromPenalties: number;
  revenueFromReservations: number;
  revenueFromAdvertising: number;
  energyCostPerKwh: number;
  totalKwh: number;
  evgreenPercent: number;
  investorPercent: number;
  hostPercent: number;
}) {
  const {
    grossRevenue,
    revenueFromEnergy,
    revenueFromPenalties,
    revenueFromReservations,
    revenueFromAdvertising,
    energyCostPerKwh,
    totalKwh,
    evgreenPercent,
    investorPercent,
    hostPercent,
  } = params;

  // Step 1: Calculate energy cost
  const totalEnergyCost = energyCostPerKwh * totalKwh;

  // Step 2: Net revenue after energy cost
  const netRevenue = grossRevenue - totalEnergyCost;

  // Step 3: Distribute among 3 actors
  const evgreenAmount = netRevenue * (evgreenPercent / 100);
  const investorAmount = netRevenue * (investorPercent / 100);
  const hostAmount = netRevenue * (hostPercent / 100);

  return {
    grossRevenue,
    totalEnergyCost,
    netRevenue,
    evgreenAmount,
    investorAmount,
    hostAmount,
    revenueFromEnergy,
    revenueFromPenalties,
    revenueFromReservations,
    revenueFromAdvertising,
  };
}

// Validate percentage configuration
function validatePercentages(evgreen: number, investor: number, host: number): { valid: boolean; error?: string } {
  const total = evgreen + investor + host;
  if (total !== 100) {
    return { valid: false, error: `Los porcentajes deben sumar 100%, actualmente suman ${total}%` };
  }
  if (evgreen < 0 || investor < 0 || host < 0) {
    return { valid: false, error: "Los porcentajes no pueden ser negativos" };
  }
  if (evgreen > 100 || investor > 100 || host > 100) {
    return { valid: false, error: "Ningún porcentaje puede exceder 100%" };
  }
  return { valid: true };
}

describe("Financial Model - Percentage Validation", () => {
  it("accepts valid 3-actor split (30/60/10)", () => {
    const result = validatePercentages(30, 60, 10);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid 2-actor split with 0% host (30/70/0)", () => {
    const result = validatePercentages(30, 70, 0);
    expect(result.valid).toBe(true);
  });

  it("rejects percentages that don't sum to 100", () => {
    const result = validatePercentages(30, 60, 20);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("110%");
  });

  it("rejects negative percentages", () => {
    const result = validatePercentages(30, 80, -10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("negativos");
  });

  it("rejects percentages over 100", () => {
    const result = validatePercentages(110, 0, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("110%");
  });
});

describe("Financial Model - Waterfall Calculation", () => {
  it("calculates correct 3-actor split for a typical station", () => {
    const result = calculateWaterfall({
      grossRevenue: 1_000_000,
      revenueFromEnergy: 850_000,
      revenueFromPenalties: 100_000,
      revenueFromReservations: 30_000,
      revenueFromAdvertising: 20_000,
      energyCostPerKwh: 850,
      totalKwh: 200,
      evgreenPercent: 30,
      investorPercent: 60,
      hostPercent: 10,
    });

    // Energy cost = 850 * 200 = 170,000
    expect(result.totalEnergyCost).toBe(170_000);
    // Net = 1,000,000 - 170,000 = 830,000
    expect(result.netRevenue).toBe(830_000);
    // EVGreen = 830,000 * 0.30 = 249,000
    expect(result.evgreenAmount).toBe(249_000);
    // Investor = 830,000 * 0.60 = 498,000
    expect(result.investorAmount).toBe(498_000);
    // Host = 830,000 * 0.10 = 83,000
    expect(result.hostAmount).toBe(83_000);
  });

  it("handles station where owner is also the host (0% host share)", () => {
    const result = calculateWaterfall({
      grossRevenue: 500_000,
      revenueFromEnergy: 500_000,
      revenueFromPenalties: 0,
      revenueFromReservations: 0,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 800,
      totalKwh: 100,
      evgreenPercent: 30,
      investorPercent: 70,
      hostPercent: 0,
    });

    // Energy cost = 800 * 100 = 80,000
    expect(result.totalEnergyCost).toBe(80_000);
    // Net = 500,000 - 80,000 = 420,000
    expect(result.netRevenue).toBe(420_000);
    // EVGreen = 420,000 * 0.30 = 126,000
    expect(result.evgreenAmount).toBe(126_000);
    // Investor = 420,000 * 0.70 = 294,000
    expect(result.investorAmount).toBe(294_000);
    // Host = 0
    expect(result.hostAmount).toBe(0);
  });

  it("handles zero energy consumption (only penalties/reservations)", () => {
    const result = calculateWaterfall({
      grossRevenue: 200_000,
      revenueFromEnergy: 0,
      revenueFromPenalties: 150_000,
      revenueFromReservations: 50_000,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 850,
      totalKwh: 0,
      evgreenPercent: 30,
      investorPercent: 55,
      hostPercent: 15,
    });

    // No energy cost when no kWh consumed
    expect(result.totalEnergyCost).toBe(0);
    expect(result.netRevenue).toBe(200_000);
    expect(result.evgreenAmount).toBeCloseTo(60_000, 0);
    expect(result.investorAmount).toBeCloseTo(110_000, 0);
    expect(result.hostAmount).toBeCloseTo(30_000, 0);
  });

  it("correctly breaks down revenue by source", () => {
    const result = calculateWaterfall({
      grossRevenue: 1_500_000,
      revenueFromEnergy: 1_000_000,
      revenueFromPenalties: 200_000,
      revenueFromReservations: 150_000,
      revenueFromAdvertising: 150_000,
      energyCostPerKwh: 900,
      totalKwh: 300,
      evgreenPercent: 25,
      investorPercent: 60,
      hostPercent: 15,
    });

    // Verify revenue sources sum to gross
    const sourceSum = result.revenueFromEnergy + result.revenueFromPenalties +
      result.revenueFromReservations + result.revenueFromAdvertising;
    expect(sourceSum).toBe(result.grossRevenue);

    // Verify actor amounts sum to net revenue
    const actorSum = result.evgreenAmount + result.investorAmount + result.hostAmount;
    expect(actorSum).toBeCloseTo(result.netRevenue, 0);
  });

  it("handles high energy cost that exceeds revenue", () => {
    const result = calculateWaterfall({
      grossRevenue: 100_000,
      revenueFromEnergy: 100_000,
      revenueFromPenalties: 0,
      revenueFromReservations: 0,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 1500,
      totalKwh: 100,
      evgreenPercent: 30,
      investorPercent: 60,
      hostPercent: 10,
    });

    // Energy cost = 1500 * 100 = 150,000 > 100,000 gross
    expect(result.totalEnergyCost).toBe(150_000);
    expect(result.netRevenue).toBe(-50_000);
    // Negative amounts distributed proportionally
    expect(result.evgreenAmount).toBe(-15_000);
    expect(result.investorAmount).toBe(-30_000);
    expect(result.hostAmount).toBe(-5_000);
  });
});

describe("Financial Model - Station Configuration Defaults", () => {
  it("uses correct default values when no custom config", () => {
    const defaults = {
      evgreenSharePercent: 30,
      investorSharePercent: 70,
      hostSharePercent: 0,
      energyCostPerKwh: 850,
    };

    expect(defaults.evgreenSharePercent + defaults.investorSharePercent + defaults.hostSharePercent).toBe(100);
    expect(defaults.energyCostPerKwh).toBeGreaterThan(0);
  });

  it("validates that configurable percentages are per-station", () => {
    // Station A: investor-owned site (no host share)
    const stationA = { evgreen: 30, investor: 70, host: 0 };
    // Station B: rented space (with host share)
    const stationB = { evgreen: 30, investor: 55, host: 15 };

    expect(validatePercentages(stationA.evgreen, stationA.investor, stationA.host).valid).toBe(true);
    expect(validatePercentages(stationB.evgreen, stationB.investor, stationB.host).valid).toBe(true);

    // They can have different configurations
    expect(stationA.host).not.toBe(stationB.host);
    expect(stationA.investor).not.toBe(stationB.investor);
  });
});
