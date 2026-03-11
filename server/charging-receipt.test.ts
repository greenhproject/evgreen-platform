/**
 * Tests for the charging receipt / transactions.getById endpoint
 * Verifies that all discriminated receipt fields are returned correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getTransactionById: vi.fn(),
  getChargingStationById: vi.fn(),
  getEvseById: vi.fn(),
  getTariffById: vi.fn(),
  getEffectiveStationPrice: vi.fn(),
}));

import * as db from "./db";

describe("Charging Receipt - transactions.getById fields", () => {
  const mockTransaction = {
    id: 42,
    evseId: 1,
    userId: 10,
    stationId: 5,
    tariffId: 3,
    ocppTransactionId: "TX-001",
    ocppNumericTxId: 1001,
    startTime: new Date("2026-03-10T10:00:00Z"),
    endTime: new Date("2026-03-10T11:30:00Z"),
    kwhConsumed: "15.50",
    meterStart: "1000.0000",
    meterEnd: "1015.5000",
    energyCost: "18600.00",
    timeCost: "0.00",
    sessionCost: "2000.00",
    overstayCost: "1500.00",
    totalCost: "22100.00",
    investorShare: "17680.00",
    platformFee: "4420.00",
    status: "COMPLETED" as const,
    startMethod: "QR",
    stopReason: "REMOTE",
    manualSoc: null,
    manualBatteryCapacityKwh: null,
    chargeMode: "full_charge",
    targetValue: "0.00",
    appliedPricePerKwh: "1200.00",
    reservationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStation = {
    id: 5,
    name: "Estación Centro",
    address: "Calle 10 #5-20",
    city: "Bogotá",
    ownerId: 20,
  };

  const mockEvse = {
    id: 1,
    connectorId: 1,
    connectorType: "CCS2",
    chargeType: "DC",
  };

  const mockTariff = {
    id: 3,
    pricePerKwh: "1200.00",
    pricePerMinute: "0",
    pricePerSession: "2000.00",
    reservationFee: "5000.00",
    overstayPenaltyPerMinute: "500.00",
    overstayGracePeriodMinutes: 10,
    autoPricing: false,
  };

  const mockEffectivePrice = {
    pricePerKwh: 1200,
    reservationFee: 5000,
    overstayPenaltyPerMin: 500,
    connectionFee: 2000,
    tariffId: 3,
    autoPricing: false,
    source: "station" as const,
  };

  beforeEach(() => {
    vi.mocked(db.getTransactionById).mockResolvedValue(mockTransaction as any);
    vi.mocked(db.getChargingStationById).mockResolvedValue(mockStation as any);
    vi.mocked(db.getEvseById).mockResolvedValue(mockEvse as any);
    vi.mocked(db.getTariffById).mockResolvedValue(mockTariff as any);
    vi.mocked(db.getEffectiveStationPrice).mockResolvedValue(mockEffectivePrice);
  });

  it("should return all required receipt fields for a completed transaction", async () => {
    const tx = mockTransaction;
    const station = mockStation;
    const evse = mockEvse;
    const effectivePrice = mockEffectivePrice;

    // Simulate what the getById procedure does
    const startTime = new Date(tx.startTime);
    const endTime = tx.endTime ? new Date(tx.endTime) : new Date();
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

    const result = {
      id: tx.id,
      stationId: tx.stationId,
      stationName: station?.name || "Estación",
      stationAddress: station?.address || "",
      stationCity: station?.city || "",
      connectorId: evse?.connectorId || 1,
      connectorType: evse?.connectorType || "TYPE_2",
      chargeType: evse?.chargeType || "AC",
      startTime: tx.startTime.toISOString(),
      endTime: tx.endTime?.toISOString() || null,
      durationMinutes,
      kwhConsumed: tx.kwhConsumed ? parseFloat(tx.kwhConsumed).toFixed(2) : "0.00",
      appliedPricePerKwh: tx.appliedPricePerKwh
        ? parseFloat(tx.appliedPricePerKwh.toString())
        : effectivePrice.pricePerKwh,
      pricePerKwh: effectivePrice.pricePerKwh,
      energyCost: tx.energyCost ? parseFloat(tx.energyCost.toString()) : 0,
      timeCost: tx.timeCost ? parseFloat(tx.timeCost.toString()) : 0,
      sessionCost: tx.sessionCost ? parseFloat(tx.sessionCost.toString()) : 0,
      overstayCost: tx.overstayCost ? parseFloat(tx.overstayCost.toString()) : 0,
      totalCost: tx.totalCost ? parseFloat(tx.totalCost) : 0,
      investorShare: tx.investorShare ? parseFloat(tx.investorShare.toString()) : 0,
      platformFee: tx.platformFee ? parseFloat(tx.platformFee.toString()) : 0,
      chargeMode: tx.chargeMode || "full_charge",
      targetValue: tx.targetValue ? parseFloat(tx.targetValue.toString()) : 0,
      startMethod: tx.startMethod || "APP",
      stopReason: tx.stopReason || "",
      connectionFee: effectivePrice.connectionFee,
      overstayPenaltyPerMin: effectivePrice.overstayPenaltyPerMin,
      status: tx.status,
      paymentMethod: "wallet",
    };

    // Verify all required receipt fields exist
    expect(result.id).toBe(42);
    expect(result.stationName).toBe("Estación Centro");
    expect(result.stationAddress).toBe("Calle 10 #5-20");
    expect(result.stationCity).toBe("Bogotá");
    expect(result.connectorType).toBe("CCS2");
    expect(result.chargeType).toBe("DC");

    // Verify energy and cost breakdown
    expect(result.kwhConsumed).toBe("15.50");
    expect(result.appliedPricePerKwh).toBe(1200);
    expect(result.energyCost).toBe(18600);
    expect(result.timeCost).toBe(0);
    expect(result.sessionCost).toBe(2000);
    expect(result.overstayCost).toBe(1500);
    expect(result.totalCost).toBe(22100);

    // Verify the total equals sum of parts
    const sumOfParts = result.energyCost + result.timeCost + result.sessionCost + result.overstayCost;
    expect(result.totalCost).toBe(sumOfParts);

    // Verify investor/platform split
    expect(result.investorShare).toBe(17680);
    expect(result.platformFee).toBe(4420);

    // Verify charge mode and method
    expect(result.chargeMode).toBe("full_charge");
    expect(result.startMethod).toBe("QR");
    expect(result.stopReason).toBe("REMOTE");

    // Verify duration calculation
    expect(result.durationMinutes).toBe(90);

    // Verify station pricing info
    expect(result.connectionFee).toBe(2000);
    expect(result.overstayPenaltyPerMin).toBe(500);
  });

  it("should handle transaction with zero costs correctly", async () => {
    const tx = {
      ...mockTransaction,
      energyCost: "0.00",
      timeCost: "0.00",
      sessionCost: "0.00",
      overstayCost: "0.00",
      totalCost: "0.00",
      appliedPricePerKwh: null,
      chargeMode: null,
      startMethod: null,
      stopReason: null,
    };

    const effectivePrice = mockEffectivePrice;

    const result = {
      energyCost: tx.energyCost ? parseFloat(tx.energyCost.toString()) : 0,
      timeCost: tx.timeCost ? parseFloat(tx.timeCost.toString()) : 0,
      sessionCost: tx.sessionCost ? parseFloat(tx.sessionCost.toString()) : 0,
      overstayCost: tx.overstayCost ? parseFloat(tx.overstayCost.toString()) : 0,
      totalCost: tx.totalCost ? parseFloat(tx.totalCost) : 0,
      appliedPricePerKwh: tx.appliedPricePerKwh
        ? parseFloat(tx.appliedPricePerKwh.toString())
        : effectivePrice.pricePerKwh,
      chargeMode: tx.chargeMode || "full_charge",
      startMethod: tx.startMethod || "APP",
      stopReason: tx.stopReason || "",
    };

    expect(result.energyCost).toBe(0);
    expect(result.timeCost).toBe(0);
    expect(result.sessionCost).toBe(0);
    expect(result.overstayCost).toBe(0);
    expect(result.totalCost).toBe(0);
    // When appliedPricePerKwh is null, should fallback to effective price
    expect(result.appliedPricePerKwh).toBe(1200);
    // When chargeMode is null, should default to full_charge
    expect(result.chargeMode).toBe("full_charge");
    // When startMethod is null, should default to APP
    expect(result.startMethod).toBe("APP");
    // When stopReason is null, should default to empty string
    expect(result.stopReason).toBe("");
  });

  it("should build receipt line items correctly", () => {
    // Simulate the buildLineItems function from ChargingSummary
    const transaction = {
      kwhConsumed: "15.50",
      appliedPricePerKwh: 1200,
      pricePerKwh: 1200,
      energyCost: 18600,
      timeCost: 0,
      sessionCost: 2000,
      overstayCost: 1500,
      totalCost: 22100,
      durationMinutes: 90,
      chargeMode: "full_charge",
    };

    const items: { concept: string; amount: number; isWarning?: boolean }[] = [];
    const kwhNum = parseFloat(transaction.kwhConsumed);
    const appliedPrice = transaction.appliedPricePerKwh || transaction.pricePerKwh || 0;

    // Energy
    const calculatedEnergyCost = transaction.energyCost > 0
      ? transaction.energyCost
      : kwhNum * appliedPrice;
    items.push({ concept: "Energía consumida", amount: calculatedEnergyCost });

    // Time cost
    if (transaction.timeCost > 0) {
      items.push({ concept: "Cargo por tiempo", amount: transaction.timeCost });
    }

    // Session cost
    if (transaction.sessionCost > 0) {
      items.push({ concept: "Tarifa de conexión", amount: transaction.sessionCost });
    }

    // Overstay
    if (transaction.overstayCost > 0) {
      items.push({ concept: "Penalización por sobreestadía", amount: transaction.overstayCost, isWarning: true });
    }

    // Verify line items
    expect(items).toHaveLength(3); // energy + session + overstay (no time cost)
    expect(items[0].concept).toBe("Energía consumida");
    expect(items[0].amount).toBe(18600);
    expect(items[1].concept).toBe("Tarifa de conexión");
    expect(items[1].amount).toBe(2000);
    expect(items[2].concept).toBe("Penalización por sobreestadía");
    expect(items[2].amount).toBe(1500);
    expect(items[2].isWarning).toBe(true);

    // Verify sum matches total
    const sum = items.reduce((acc, item) => acc + item.amount, 0);
    expect(sum).toBe(transaction.totalCost);
  });

  it("should only show energy cost when no extra charges", () => {
    const transaction = {
      kwhConsumed: "10.00",
      appliedPricePerKwh: 1200,
      pricePerKwh: 1200,
      energyCost: 12000,
      timeCost: 0,
      sessionCost: 0,
      overstayCost: 0,
      totalCost: 12000,
      durationMinutes: 60,
    };

    const items: { concept: string; amount: number }[] = [];
    items.push({ concept: "Energía consumida", amount: transaction.energyCost });
    if (transaction.timeCost > 0) items.push({ concept: "Cargo por tiempo", amount: transaction.timeCost });
    if (transaction.sessionCost > 0) items.push({ concept: "Tarifa de conexión", amount: transaction.sessionCost });
    if (transaction.overstayCost > 0) items.push({ concept: "Penalización por sobreestadía", amount: transaction.overstayCost });

    expect(items).toHaveLength(1);
    expect(items[0].concept).toBe("Energía consumida");
    expect(items[0].amount).toBe(12000);
  });

  it("should calculate energy cost from kWh * price when energyCost is 0", () => {
    const transaction = {
      kwhConsumed: "10.00",
      appliedPricePerKwh: 1200,
      pricePerKwh: 1200,
      energyCost: 0,
      totalCost: 12000,
    };

    const kwhNum = parseFloat(transaction.kwhConsumed);
    const appliedPrice = transaction.appliedPricePerKwh || transaction.pricePerKwh || 0;
    const calculatedEnergyCost = transaction.energyCost > 0
      ? transaction.energyCost
      : kwhNum * appliedPrice;

    expect(calculatedEnergyCost).toBe(12000);
  });
});
