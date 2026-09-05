import { describe, expect, it } from "vitest";
import { calculateSocEstimation, getManualSocAvailability } from "./soc-estimation";

describe("SOC estimation with absolute AC recalibration", () => {
  it("does not add energy delivered before a late calibration", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 35,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 12,
      calibrationEnergyKwh: 12,
    });

    expect(result).toEqual({ soc: 35, source: "manual", energySinceCalibrationKwh: 0 });
  });

  it("continues estimating only with energy delivered after calibration", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 35,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 15,
      calibrationEnergyKwh: 12,
    });

    expect(result.soc).toBe(40);
    expect(result.energySinceCalibrationKwh).toBe(3);
  });

  it("supports multiple recalibrations without compounding the previous estimate", () => {
    const first = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 35,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 15,
      calibrationEnergyKwh: 12,
    });
    const recalibrated = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 42,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 15,
      calibrationEnergyKwh: 15,
    });

    expect(first.soc).toBe(40);
    expect(recalibrated.soc).toBe(42);
  });

  it("keeps backward compatibility when an old transaction has no calibration anchor", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 20,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 12,
      calibrationEnergyKwh: null,
    });

    expect(result.soc).toBe(40);
  });

  it("always prioritizes a valid SOC reported by OCPP", () => {
    const result = calculateSocEstimation({
      chargerSoc: 76,
      manualSoc: 95,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 30,
      calibrationEnergyKwh: 0,
    });

    expect(result).toEqual({ soc: 76, source: "charger", energySinceCalibrationKwh: 0 });
  });

  it("blocks manual calibration for DC and for any active OCPP SOC", () => {
    expect(getManualSocAvailability({ chargeType: "DC", chargerSoc: null }).allowed).toBe(false);
    expect(getManualSocAvailability({ chargeType: "AC", chargerSoc: 55 }).allowed).toBe(false);
    expect(getManualSocAvailability({ chargeType: "AC", chargerSoc: null }).allowed).toBe(true);
  });
});

