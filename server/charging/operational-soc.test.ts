import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEvseById: vi.fn(),
  getLastMeterValue: vi.fn(),
  getDefaultVehicle: vi.fn(),
  getEffectiveStationPrice: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock("../db", () => mocks);

import {
  getActiveSessionById,
  getAllActiveSessionsPower,
  recalibrateManualSocTransaction,
  removeActiveSession,
  setActiveSession,
} from "./charging-router";

const baseTransaction = {
  id: 91001,
  userId: 44,
  stationId: 8,
  evseId: 12,
  status: "IN_PROGRESS",
  transactionStatus: "IN_PROGRESS",
  startTime: new Date("2026-09-05T12:00:00Z"),
  meterStart: "0",
  kwhConsumed: "12.0000",
  totalCost: "21600",
  appliedPricePerKwh: "1800",
  chargeMode: "percentage",
  targetValue: "80",
  manualSoc: null,
  manualBatteryCapacityKwh: "60.00",
  manualSocCalibrationKwh: null,
  manualSocCalibratedAt: null,
} as any;

function seedSession(transactionId: number, soc: number | null = null) {
  setActiveSession(transactionId, {
    transactionId,
    userId: baseTransaction.userId,
    stationId: baseTransaction.stationId,
    connectorId: baseTransaction.evseId,
    chargeMode: "percentage",
    targetValue: 80,
    startTime: new Date(baseTransaction.startTime),
    currentKwh: 12,
    currentCost: 21600,
    pricePerKwh: 1800,
    soc,
    currentPower: 7.2,
    voltage: 220,
    current: 32,
    lastMeterUpdate: new Date(),
    powerHistory: [],
    socTargetNotified: false,
    manualSoc: null,
    manualBatteryCapacityKwh: 60,
    manualSocCalibrationKwh: null,
    manualSocCalibratedAt: null,
    lowPowerSince: null,
    chargeCompleteDetected: false,
    chargeCompleteNotified: false,
    autoStopSent: false,
    energyBasedSoc: null,
  });
}

describe("Operational SOC recalibration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLastMeterValue.mockResolvedValue(null);
    mocks.getDefaultVehicle.mockResolvedValue({ batteryCapacityKwh: "60" });
    mocks.getEffectiveStationPrice.mockResolvedValue({ pricePerKwh: 1800 });
    mocks.updateTransaction.mockResolvedValue(undefined);
  });

  afterEach(() => removeActiveSession(baseTransaction.id));

  it("anchors an AC calibration at the current energy and publishes it to the live projection", async () => {
    mocks.getEvseById.mockResolvedValue({ id: 12, chargeType: "AC" });
    seedSession(baseTransaction.id);

    const result = await recalibrateManualSocTransaction({
      transaction: baseTransaction,
      soc: 35,
      actorUserId: 7,
    });

    expect(result.soc).toBe(35);
    expect(result.calibrationEnergyKwh).toBe(12);
    expect(getActiveSessionById(baseTransaction.id)).toMatchObject({
      manualSoc: 35,
      manualBatteryCapacityKwh: 60,
      manualSocCalibrationKwh: 12,
      energyBasedSoc: 35,
    });
    expect(getAllActiveSessionsPower().get(baseTransaction.id)).toMatchObject({
      currentKwh: 12,
      manualSoc: 35,
      manualSocCalibrationKwh: 12,
    });
    expect(mocks.updateTransaction).toHaveBeenCalledWith(baseTransaction.id, expect.objectContaining({
      manualSoc: 35,
      manualSocCalibrationKwh: "12.0000",
    }));
  });

  it("rejects manual SOC for a DC session without changing persisted data", async () => {
    mocks.getEvseById.mockResolvedValue({ id: 12, chargeType: "DC" });
    seedSession(baseTransaction.id);

    await expect(recalibrateManualSocTransaction({
      transaction: baseTransaction,
      soc: 35,
      actorUserId: 7,
    })).rejects.toThrow("En cargadores DC el SOC proviene de la telemetría OCPP");

    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });

  it("rejects manual SOC when the charger already reports an OCPP value", async () => {
    mocks.getEvseById.mockResolvedValue({ id: 12, chargeType: "AC" });
    seedSession(baseTransaction.id, 64);

    await expect(recalibrateManualSocTransaction({
      transaction: baseTransaction,
      soc: 35,
      actorUserId: 7,
    })).rejects.toThrow("SOC real por OCPP");

    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });
});
