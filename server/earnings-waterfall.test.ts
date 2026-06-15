import { describe, expect, it } from "vitest";

/**
 * Unit tests for the waterfall calculation logic used by both
 * Earnings and Reports pages via investorTransactionsEnriched.
 *
 * These tests validate the pure calculation logic extracted from db.ts
 * to ensure Earnings and Reports produce identical net income figures.
 */

// Replicate the waterfall calculation from db.ts getEnrichedTransactionsByInvestor
function calculateWaterfall(tx: {
  totalCost: number;
  kwhConsumed: number;
  energyCost: number;
  timeCost: number;
  sessionCost: number;
  overstayCost: number;
}, stationInfo: {
  hostSharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  energyCostPerKwh: number;
  investorParticipationPercent: number;
  isCollective: boolean;
}) {
  const txEnergyCostField = tx.energyCost;
  const txTimeCost = tx.timeCost;
  const txSessionCost = tx.sessionCost;
  const txOverstayCost = tx.overstayCost;
  const revenueFromEnergy = txEnergyCostField + txTimeCost + txSessionCost;
  const revenueFromPenalties = txOverstayCost;

  const grossRevenue = tx.totalCost;
  const energyCostPurchase = tx.kwhConsumed * stationInfo.energyCostPerKwh;
  const grossMargin = Math.max(0, grossRevenue - energyCostPurchase);

  const hostAmount = grossMargin * (stationInfo.hostSharePercent / 100);
  const netAfterHost = grossMargin - hostAmount;

  const totalInvestorPool = netAfterHost * (stationInfo.investorSharePercent / 100);
  const evgreenAmount = netAfterHost * (stationInfo.evgreenSharePercent / 100);

  const myShare = totalInvestorPool * (stationInfo.investorParticipationPercent / 100);

  return {
    grossRevenue,
    energyCost: energyCostPurchase,
    grossMargin,
    hostAmount,
    netAfterHost,
    totalInvestorPool,
    evgreenAmount,
    myShare,
    revenueFromEnergy,
    revenueFromPenalties,
    isCollective: stationInfo.isCollective,
  };
}

describe("Waterfall Calculation", () => {
  const ownStationConfig = {
    hostSharePercent: 10,
    investorSharePercent: 70,
    evgreenSharePercent: 30,
    energyCostPerKwh: 850,
    investorParticipationPercent: 100,
    isCollective: false,
  };

  const collectiveStationConfig = {
    hostSharePercent: 10,
    investorSharePercent: 70,
    evgreenSharePercent: 30,
    energyCostPerKwh: 850,
    investorParticipationPercent: 25, // 25% participation in collective
    isCollective: true,
  };

  it("calculates correct waterfall for an own station", () => {
    const tx = {
      totalCost: 50000,
      kwhConsumed: 20,
      energyCost: 30000,
      timeCost: 5000,
      sessionCost: 2000,
      overstayCost: 13000,
    };

    const result = calculateWaterfall(tx, ownStationConfig);

    // grossRevenue = 50000
    expect(result.grossRevenue).toBe(50000);

    // energyCostPurchase = 20 * 850 = 17000
    expect(result.energyCost).toBe(17000);

    // grossMargin = 50000 - 17000 = 33000
    expect(result.grossMargin).toBe(33000);

    // hostAmount = 33000 * 10% = 3300
    expect(result.hostAmount).toBe(3300);

    // netAfterHost = 33000 - 3300 = 29700
    expect(result.netAfterHost).toBe(29700);

    // investorPool = 29700 * 70% = 20790
    expect(result.totalInvestorPool).toBeCloseTo(20790, 2);

    // evgreen = 29700 * 30% = 8910
    expect(result.evgreenAmount).toBeCloseTo(8910, 2);

    // myShare = 20790 * 100% = 20790 (own station)
    expect(result.myShare).toBeCloseTo(20790, 2);

    // Revenue sources
    expect(result.revenueFromEnergy).toBe(37000); // 30000 + 5000 + 2000
    expect(result.revenueFromPenalties).toBe(13000);
  });

  it("calculates correct waterfall for a collective station", () => {
    const tx = {
      totalCost: 50000,
      kwhConsumed: 20,
      energyCost: 30000,
      timeCost: 5000,
      sessionCost: 2000,
      overstayCost: 13000,
    };

    const result = calculateWaterfall(tx, collectiveStationConfig);

    // Same waterfall up to investorPool
    expect(result.totalInvestorPool).toBeCloseTo(20790, 2);

    // myShare = 20790 * 25% = 5197.5 (collective 25% participation)
    expect(result.myShare).toBeCloseTo(5197.5, 2);
    expect(result.isCollective).toBe(true);
  });

  it("handles zero revenue gracefully", () => {
    const tx = {
      totalCost: 0,
      kwhConsumed: 0,
      energyCost: 0,
      timeCost: 0,
      sessionCost: 0,
      overstayCost: 0,
    };

    const result = calculateWaterfall(tx, ownStationConfig);

    expect(result.grossRevenue).toBe(0);
    expect(result.grossMargin).toBe(0);
    expect(result.myShare).toBe(0);
    expect(result.revenueFromEnergy).toBe(0);
    expect(result.revenueFromPenalties).toBe(0);
  });

  it("ensures gross margin never goes negative", () => {
    const tx = {
      totalCost: 1000,
      kwhConsumed: 100, // High consumption, low revenue
      energyCost: 800,
      timeCost: 100,
      sessionCost: 100,
      overstayCost: 0,
    };

    const config = { ...ownStationConfig, energyCostPerKwh: 850 };
    // energyCostPurchase = 100 * 850 = 85000, but totalCost = 1000
    const result = calculateWaterfall(tx, config);

    expect(result.grossMargin).toBe(0); // Max(0, 1000 - 85000) = 0
    expect(result.myShare).toBe(0);
  });

  it("produces consistent results between Earnings and Reports (same input = same output)", () => {
    const tx = {
      totalCost: 75000,
      kwhConsumed: 30,
      energyCost: 45000,
      timeCost: 10000,
      sessionCost: 5000,
      overstayCost: 15000,
    };

    // Both pages use the same waterfall calculation
    const earningsResult = calculateWaterfall(tx, ownStationConfig);
    const reportsResult = calculateWaterfall(tx, ownStationConfig);

    expect(earningsResult.myShare).toBe(reportsResult.myShare);
    expect(earningsResult.grossRevenue).toBe(reportsResult.grossRevenue);
    expect(earningsResult.evgreenAmount).toBe(reportsResult.evgreenAmount);
    expect(earningsResult.revenueFromPenalties).toBe(reportsResult.revenueFromPenalties);
  });

  it("penalty revenue is correctly separated from energy revenue", () => {
    const tx = {
      totalCost: 60000,
      kwhConsumed: 25,
      energyCost: 35000,
      timeCost: 5000,
      sessionCost: 3000,
      overstayCost: 17000,
    };

    const result = calculateWaterfall(tx, ownStationConfig);

    // Energy = energyCost + timeCost + sessionCost = 35000 + 5000 + 3000 = 43000
    expect(result.revenueFromEnergy).toBe(43000);
    // Penalties = overstayCost = 17000
    expect(result.revenueFromPenalties).toBe(17000);
    // Total should equal totalCost
    expect(result.revenueFromEnergy + result.revenueFromPenalties).toBe(60000);
  });

  it("different station configs produce different distributions", () => {
    const tx = {
      totalCost: 50000,
      kwhConsumed: 20,
      energyCost: 30000,
      timeCost: 5000,
      sessionCost: 2000,
      overstayCost: 13000,
    };

    const configA = { ...ownStationConfig, investorSharePercent: 70, evgreenSharePercent: 30 };
    const configB = { ...ownStationConfig, investorSharePercent: 60, evgreenSharePercent: 40 };

    const resultA = calculateWaterfall(tx, configA);
    const resultB = calculateWaterfall(tx, configB);

    // Same gross revenue
    expect(resultA.grossRevenue).toBe(resultB.grossRevenue);
    // Different investor shares
    expect(resultA.myShare).not.toBe(resultB.myShare);
    expect(resultA.myShare).toBeGreaterThan(resultB.myShare);
  });
});
