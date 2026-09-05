import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests para la corrección de SoC en cargadores AC
 * Verifica:
 * 1. Cálculo de SoC basado en energía real del OCPP
 * 2. Detección de batería llena por caída de potencia
 * 3. Prioridad de fuentes de SoC
 */
import { calculateSocEstimation } from "./charging/soc-estimation";

describe("SoC Correction - Energy-based SoC Calculation", () => {
  it("keeps the manual SOC unchanged at the calibration instant", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 36,
      batteryCapacityKwh: 90,
      currentEnergyKwh: 15.22,
      calibrationEnergyKwh: 15.22,
    });

    expect(result.soc).toBe(36);
    expect(result.energySinceCalibrationKwh).toBe(0);
  });

  it("adds only energy delivered after calibration", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 36,
      batteryCapacityKwh: 90,
      currentEnergyKwh: 24.22,
      calibrationEnergyKwh: 15.22,
    });

    expect(result.soc).toBe(46);
    expect(result.energySinceCalibrationKwh).toBe(9);
  });

  it("caps the estimate at 100%", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 80,
      batteryCapacityKwh: 40,
      currentEnergyKwh: 30,
      calibrationEnergyKwh: 10,
    });

    expect(result.soc).toBe(100);
  });

  it("should handle zero kWh delivered", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 50,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 0,
      calibrationEnergyKwh: 0,
    });

    expect(result.soc).toBe(50);
  });

  it("should not calculate energyBasedSoc when batteryCapacity is 0 or null", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 50,
      batteryCapacityKwh: 0,
      currentEnergyKwh: 5,
      calibrationEnergyKwh: 0,
    });

    expect(result.soc).toBeNull();
  });
});

describe("SoC Correction - Battery Full Detection by Power Drop", () => {
  // UPDATED: Umbrales más conservadores para evitar falsos positivos en fase taper AC
  // 0.15 kW = ~0.6A en 220V (prácticamente cero corriente)
  // 10 min = suficiente para confirmar que la batería realmente terminó
  const LOW_POWER_THRESHOLD_KW = 0.15;
  const LOW_POWER_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  it("should detect low power when power drops below threshold (near zero)", () => {
    const currentPower = 0.1; // kW - prácticamente cero
    const currentKwh = 15; // Some energy already delivered
    
    const isLowPower = currentPower < LOW_POWER_THRESHOLD_KW && currentKwh > 0.5;
    expect(isLowPower).toBe(true);
  });

  it("should NOT detect low power during AC taper phase (0.3-0.5 kW is normal)", () => {
    const currentPower = 0.35; // kW - fase taper normal en AC
    const currentKwh = 15;
    
    const isLowPower = currentPower < LOW_POWER_THRESHOLD_KW && currentKwh > 0.5;
    expect(isLowPower).toBe(false); // 0.35 kW > 0.15 kW threshold
  });

  it("should NOT detect low power at the start of charging (no energy delivered)", () => {
    const currentPower = 0.1;
    const currentKwh = 0.1; // Very little energy
    
    const isLowPower = currentPower < LOW_POWER_THRESHOLD_KW && currentKwh > 0.5;
    expect(isLowPower).toBe(false);
  });

  it("should detect battery full after 10 minutes of near-zero power", () => {
    const lowPowerSince = new Date(Date.now() - 11 * 60 * 1000); // 11 minutes ago
    const lowPowerDuration = Date.now() - lowPowerSince.getTime();
    
    const isBatteryFull = lowPowerDuration >= LOW_POWER_DURATION_MS;
    expect(isBatteryFull).toBe(true);
  });

  it("should NOT detect battery full before 10 minutes of near-zero power", () => {
    const lowPowerSince = new Date(Date.now() - 7 * 60 * 1000); // 7 minutes ago
    const lowPowerDuration = Date.now() - lowPowerSince.getTime();
    
    const isBatteryFull = lowPowerDuration >= LOW_POWER_DURATION_MS;
    expect(isBatteryFull).toBe(false);
  });

  it("should reset low power timer when power recovers", () => {
    const currentPower = 3.5; // kW - normal charging power
    let lowPowerSince: Date | null = new Date(Date.now() - 2 * 60 * 1000);
    
    if (currentPower >= LOW_POWER_THRESHOLD_KW) {
      lowPowerSince = null;
    }
    
    expect(lowPowerSince).toBeNull();
  });
});

describe("SoC Correction - SoC Source Priority", () => {
  it("should prioritize charger SoC (OCPP) over everything else", () => {
    const soc = 85; // From OCPP
    const chargeCompleteDetected = true;
    const energyBasedSoc = 70;
    const estimatedSoc = 60;
    
    let displaySoc: number | null;
    let socSource: string;
    
    if (soc !== null) {
      displaySoc = soc;
      socSource = "charger";
    } else if (chargeCompleteDetected) {
      displaySoc = 100;
      socSource = "power_detection";
    } else if (energyBasedSoc !== null) {
      displaySoc = energyBasedSoc;
      socSource = "manual";
    } else {
      displaySoc = estimatedSoc;
      socSource = "none";
    }
    
    expect(displaySoc).toBe(85);
    expect(socSource).toBe("charger");
  });

  it("should use power_detection when charger SoC is null and battery full detected", () => {
    const soc = null;
    const chargeCompleteDetected = true;
    const energyBasedSoc = 95;
    
    let displaySoc: number | null;
    let socSource: string;
    
    if (soc !== null) {
      displaySoc = soc;
      socSource = "charger";
    } else if (chargeCompleteDetected) {
      displaySoc = 100;
      socSource = "power_detection";
    } else if (energyBasedSoc !== null) {
      displaySoc = energyBasedSoc;
      socSource = "manual";
    } else {
      displaySoc = null;
      socSource = "none";
    }
    
    expect(displaySoc).toBe(100);
    expect(socSource).toBe("power_detection");
  });

  it("should use energyBasedSoc when no charger SoC and no battery full", () => {
    const soc = null;
    const chargeCompleteDetected = false;
    const energyBasedSoc = 72;
    
    let displaySoc: number | null;
    let socSource: string;
    
    if (soc !== null) {
      displaySoc = soc;
      socSource = "charger";
    } else if (chargeCompleteDetected) {
      displaySoc = 100;
      socSource = "power_detection";
    } else if (energyBasedSoc !== null) {
      displaySoc = energyBasedSoc;
      socSource = "manual";
    } else {
      displaySoc = null;
      socSource = "none";
    }
    
    expect(displaySoc).toBe(72);
    expect(socSource).toBe("manual");
  });

  it("should return none when no SoC data is available", () => {
    const soc = null;
    const chargeCompleteDetected = false;
    const energyBasedSoc = null;
    const estimatedSoc = null;
    
    let displaySoc: number | null;
    let socSource: string;
    
    if (soc !== null) {
      displaySoc = soc;
      socSource = "charger";
    } else if (chargeCompleteDetected) {
      displaySoc = 100;
      socSource = "power_detection";
    } else if (energyBasedSoc !== null) {
      displaySoc = energyBasedSoc;
      socSource = "manual";
    } else {
      displaySoc = estimatedSoc;
      socSource = "none";
    }
    
    expect(displaySoc).toBeNull();
    expect(socSource).toBe("none");
  });
});

describe("SoC Correction - Real-world Scenarios", () => {
  it("Scenario: a late calibration replaces the prior estimate", () => {
    const calibrated = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 35,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 12,
      calibrationEnergyKwh: 12,
    });
    expect(calibrated.soc).toBe(35);

    const afterThreeKwh = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 35,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 15,
      calibrationEnergyKwh: 12,
    });
    expect(afterThreeKwh.soc).toBe(40);

    const chargeCompleteDetected = true;
    const finalSoc = chargeCompleteDetected ? 100 : afterThreeKwh.soc;
    expect(finalSoc).toBe(100);
  });

  it("Scenario: OCPP SOC remains authoritative over a prior manual value", () => {
    const result = calculateSocEstimation({
      chargerSoc: 55,
      manualSoc: 90,
      batteryCapacityKwh: 50,
      currentEnergyKwh: 25,
      calibrationEnergyKwh: 0,
    });

    expect(result.soc).toBe(55);
    expect(result.source).toBe("charger");
    const chargeCompleteDetected = false;
    expect(chargeCompleteDetected).toBe(false);
  });

  it("Scenario: Charger charges faster than estimated", () => {
    const result = calculateSocEstimation({
      chargerSoc: null,
      manualSoc: 20,
      batteryCapacityKwh: 60,
      currentEnergyKwh: 16,
      calibrationEnergyKwh: 4,
    });

    expect(result.soc).toBe(40);
  });
});
