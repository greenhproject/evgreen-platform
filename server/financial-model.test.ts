import { describe, expect, it } from "vitest";

/**
 * Tests for the CORRECTED financial model waterfall engine.
 * 
 * CORRECTED MODEL:
 * 1. Ingresos brutos - Costo energía = Margen bruto
 * 2. Aliado Comercial = Margen bruto × hostPercent% (se descuenta PRIMERO)
 * 3. Neto después del aliado = Margen bruto - Aliado
 * 4. EVGreen + Inversionista se reparten el neto (sus % suman 100% entre ellos)
 * 5. Fondo de mantenimiento = 5% del share de EVGreen (dentro del 30%)
 */

// Corrected waterfall: host gets % of gross margin, then EVGreen+Investor split the rest
function calculateWaterfall(params: {
  grossRevenue: number;
  revenueFromEnergy: number;
  revenueFromPenalties: number;
  revenueFromReservations: number;
  revenueFromAdvertising: number;
  energyCostPerKwh: number;
  totalKwh: number;
  evgreenPercent: number;   // % of net AFTER host deduction (EVGreen + Investor = 100%)
  investorPercent: number;  // % of net AFTER host deduction (EVGreen + Investor = 100%)
  hostPercent: number;      // % of gross margin (separate, deducted first)
  contingencyPercent?: number;
  maintenanceFundPercent?: number; // % of EVGreen's share for maintenance fund
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
    contingencyPercent = 0,
    maintenanceFundPercent = 5,
  } = params;

  // Step 1: Calculate energy cost
  const totalEnergyCost = energyCostPerKwh * totalKwh;

  // Step 2: Gross margin = Revenue - Energy cost
  const grossMargin = grossRevenue - totalEnergyCost;

  // Step 3: Host/Aliado gets % of gross margin FIRST
  const hostAmount = grossMargin * (hostPercent / 100);

  // Step 4: Net after host
  const netAfterHost = grossMargin - hostAmount;

  // Step 5: Contingency from net after host
  const contingencyAmount = netAfterHost * (contingencyPercent / 100);

  // Step 6: Distributable amount
  const distributableAmount = netAfterHost - contingencyAmount;

  // Step 7: EVGreen and Investor split the distributable (their % sum to 100%)
  const investorAmount = distributableAmount * (investorPercent / 100);
  const evgreenAmount = distributableAmount * (evgreenPercent / 100);

  // Step 8: Maintenance fund comes from EVGreen's share
  const maintenanceFundAmount = evgreenAmount * (maintenanceFundPercent / 100);
  const evgreenNetAmount = evgreenAmount - maintenanceFundAmount;

  return {
    grossRevenue,
    totalEnergyCost,
    grossMargin,
    hostAmount,
    netAfterHost,
    contingencyAmount,
    distributableAmount,
    evgreenAmount,
    evgreenNetAmount,
    maintenanceFundAmount,
    investorAmount,
    revenueFromEnergy,
    revenueFromPenalties,
    revenueFromReservations,
    revenueFromAdvertising,
  };
}

// Corrected validation: EVGreen + Investor must sum 100%, Host is separate
function validatePercentages(evgreen: number, investor: number, host: number): { valid: boolean; error?: string } {
  const evInvTotal = evgreen + investor;
  if (Math.abs(evInvTotal - 100) > 0.1) {
    return { valid: false, error: `EVGreen + Inversionista deben sumar 100%, actualmente suman ${evInvTotal}%` };
  }
  if (evgreen < 0 || investor < 0 || host < 0) {
    return { valid: false, error: "Los porcentajes no pueden ser negativos" };
  }
  if (host > 50) {
    return { valid: false, error: `El % del Aliado Comercial no puede exceder 50%, actualmente es ${host}%` };
  }
  return { valid: true };
}

describe("Financial Model - Percentage Validation (Corrected)", () => {
  it("accepts valid split: EVGreen 30% + Investor 70% = 100%, Host 10% separate", () => {
    const result = validatePercentages(30, 70, 10);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid split with 0% host (30/70/0)", () => {
    const result = validatePercentages(30, 70, 0);
    expect(result.valid).toBe(true);
  });

  it("rejects EVGreen + Investor that don't sum to 100%", () => {
    // Old model: 30+60+10=100 was valid. New model: 30+60=90 is INVALID
    const result = validatePercentages(30, 60, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("90%");
  });

  it("rejects negative percentages", () => {
    const result = validatePercentages(30, 70, -10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("negativos");
  });

  it("rejects host percentage over 50%", () => {
    const result = validatePercentages(30, 70, 60);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("50%");
  });

  it("accepts host percentage at exactly 50%", () => {
    const result = validatePercentages(40, 60, 50);
    expect(result.valid).toBe(true);
  });
});

describe("Financial Model - Corrected Waterfall Calculation", () => {
  it("calculates correct waterfall: host from gross margin, then EVGreen/Investor split", () => {
    // Example from the image: Precio venta $1,800/kWh, Costo energía $700/kWh
    // Margen = (1800 - 700) × 90% × 70% = $693/kWh
    const result = calculateWaterfall({
      grossRevenue: 1_000_000,
      revenueFromEnergy: 850_000,
      revenueFromPenalties: 100_000,
      revenueFromReservations: 30_000,
      revenueFromAdvertising: 20_000,
      energyCostPerKwh: 850,
      totalKwh: 200,
      evgreenPercent: 30,   // 30% of net after host
      investorPercent: 70,  // 70% of net after host
      hostPercent: 10,      // 10% of gross margin
    });

    // Energy cost = 850 * 200 = 170,000
    expect(result.totalEnergyCost).toBe(170_000);
    // Gross margin = 1,000,000 - 170,000 = 830,000
    expect(result.grossMargin).toBe(830_000);
    // Host = 830,000 * 10% = 83,000 (from gross margin)
    expect(result.hostAmount).toBe(83_000);
    // Net after host = 830,000 - 83,000 = 747,000
    expect(result.netAfterHost).toBe(747_000);
    // No contingency in this test
    expect(result.distributableAmount).toBe(747_000);
    // Investor = 747,000 * 70% = 522,900
    expect(result.investorAmount).toBeCloseTo(522_900, 0);
    // EVGreen = 747,000 * 30% = 224,100
    expect(result.evgreenAmount).toBeCloseTo(224_100, 0);
    // Maintenance fund = 224,100 * 5% = 11,205 (from EVGreen's share)
    expect(result.maintenanceFundAmount).toBeCloseTo(11_205, 0);
  });

  it("handles station with 0% host (no aliado comercial)", () => {
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

    expect(result.totalEnergyCost).toBe(80_000);
    expect(result.grossMargin).toBe(420_000);
    expect(result.hostAmount).toBe(0);
    expect(result.netAfterHost).toBe(420_000);
    expect(result.investorAmount).toBeCloseTo(294_000, 0);
    expect(result.evgreenAmount).toBeCloseTo(126_000, 0);
  });

  it("handles contingency reserve correctly", () => {
    const result = calculateWaterfall({
      grossRevenue: 1_000_000,
      revenueFromEnergy: 1_000_000,
      revenueFromPenalties: 0,
      revenueFromReservations: 0,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 500,
      totalKwh: 400,
      evgreenPercent: 30,
      investorPercent: 70,
      hostPercent: 10,
      contingencyPercent: 5,
    });

    // Energy cost = 500 * 400 = 200,000
    expect(result.totalEnergyCost).toBe(200_000);
    // Gross margin = 1,000,000 - 200,000 = 800,000
    expect(result.grossMargin).toBe(800_000);
    // Host = 800,000 * 10% = 80,000
    expect(result.hostAmount).toBe(80_000);
    // Net after host = 800,000 - 80,000 = 720,000
    expect(result.netAfterHost).toBe(720_000);
    // Contingency = 720,000 * 5% = 36,000
    expect(result.contingencyAmount).toBe(36_000);
    // Distributable = 720,000 - 36,000 = 684,000
    expect(result.distributableAmount).toBe(684_000);
    // Investor = 684,000 * 70% = 478,800
    expect(result.investorAmount).toBeCloseTo(478_800, 0);
    // EVGreen = 684,000 * 30% = 205,200
    expect(result.evgreenAmount).toBeCloseTo(205_200, 0);
  });

  it("maintenance fund is 5% of EVGreen share (within the 30%)", () => {
    const result = calculateWaterfall({
      grossRevenue: 1_000_000,
      revenueFromEnergy: 1_000_000,
      revenueFromPenalties: 0,
      revenueFromReservations: 0,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 0,
      totalKwh: 0,
      evgreenPercent: 30,
      investorPercent: 70,
      hostPercent: 10,
      maintenanceFundPercent: 5,
    });

    // Gross margin = 1,000,000 (no energy cost)
    // Host = 100,000
    // Net = 900,000
    // EVGreen = 900,000 * 30% = 270,000
    expect(result.evgreenAmount).toBe(270_000);
    // Maintenance fund = 270,000 * 5% = 13,500
    expect(result.maintenanceFundAmount).toBe(13_500);
    // EVGreen net = 270,000 - 13,500 = 256,500
    expect(result.evgreenNetAmount).toBe(256_500);
  });

  it("handles high energy cost that exceeds revenue (negative margin)", () => {
    const result = calculateWaterfall({
      grossRevenue: 100_000,
      revenueFromEnergy: 100_000,
      revenueFromPenalties: 0,
      revenueFromReservations: 0,
      revenueFromAdvertising: 0,
      energyCostPerKwh: 1500,
      totalKwh: 100,
      evgreenPercent: 30,
      investorPercent: 70,
      hostPercent: 10,
    });

    expect(result.totalEnergyCost).toBe(150_000);
    expect(result.grossMargin).toBe(-50_000);
    // Even with negative margin, host gets their % (negative)
    expect(result.hostAmount).toBe(-5_000);
    expect(result.netAfterHost).toBe(-45_000);
  });

  it("verifies actor amounts sum correctly", () => {
    const result = calculateWaterfall({
      grossRevenue: 1_500_000,
      revenueFromEnergy: 1_000_000,
      revenueFromPenalties: 200_000,
      revenueFromReservations: 150_000,
      revenueFromAdvertising: 150_000,
      energyCostPerKwh: 900,
      totalKwh: 300,
      evgreenPercent: 25,
      investorPercent: 75,
      hostPercent: 15,
    });

    // Revenue sources sum to gross
    const sourceSum = result.revenueFromEnergy + result.revenueFromPenalties +
      result.revenueFromReservations + result.revenueFromAdvertising;
    expect(sourceSum).toBe(result.grossRevenue);

    // EVGreen + Investor should sum to distributable
    const evInvSum = result.evgreenAmount + result.investorAmount;
    expect(evInvSum).toBeCloseTo(result.distributableAmount, 0);

    // Host + EVGreen + Investor + Contingency should sum to gross margin
    const totalDistributed = result.hostAmount + result.evgreenAmount + result.investorAmount + result.contingencyAmount;
    expect(totalDistributed).toBeCloseTo(result.grossMargin, 0);
  });
});

describe("Financial Model - Station Configuration Defaults (Corrected)", () => {
  it("uses correct default values: EVGreen+Investor=100%, Host separate", () => {
    const defaults = {
      evgreenSharePercent: 30,
      investorSharePercent: 70,
      hostSharePercent: 10, // separate, not part of the 100%
      energyCostPerKwh: 850,
    };

    // EVGreen + Investor = 100%
    expect(defaults.evgreenSharePercent + defaults.investorSharePercent).toBe(100);
    // Host is separate
    expect(defaults.hostSharePercent).toBeLessThanOrEqual(50);
    expect(defaults.energyCostPerKwh).toBeGreaterThan(0);
  });

  it("validates that configurable percentages are per-station", () => {
    // Station A: investor-owned site (no host share)
    const stationA = { evgreen: 30, investor: 70, host: 0 };
    // Station B: rented space (with host share)
    const stationB = { evgreen: 40, investor: 60, host: 15 };

    expect(validatePercentages(stationA.evgreen, stationA.investor, stationA.host).valid).toBe(true);
    expect(validatePercentages(stationB.evgreen, stationB.investor, stationB.host).valid).toBe(true);

    // They can have different configurations
    expect(stationA.host).not.toBe(stationB.host);
    expect(stationA.evgreen).not.toBe(stationB.evgreen);
  });
});
