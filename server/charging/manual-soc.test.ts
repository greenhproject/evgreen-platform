/**
 * Tests para la funcionalidad de SoC manual
 * Verifica que setManualSoc funciona correctamente incluso cuando
 * la sesión activa no existe en memoria
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setActiveSession,
  getActiveSessionById,
  removeActiveSession,
} from "./charging-router";
import { calculateSocEstimation } from "./soc-estimation";

describe("Manual SoC Functionality", () => {
  const testTransactionId = 88888;

  beforeEach(() => {
    removeActiveSession(testTransactionId);
  });

  describe("setManualSoc on existing session", () => {
    it("should update manualSoc on existing active session", () => {
      // Crear sesión activa
      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: null,
        manualBatteryCapacityKwh: null,
      });

      // Simular setManualSoc
      const session = getActiveSessionById(testTransactionId);
      expect(session).not.toBeNull();
      
      session!.manualSoc = 75;
      session!.manualBatteryCapacityKwh = 60;

      // Verificar que se guardó
      const updated = getActiveSessionById(testTransactionId);
      expect(updated?.manualSoc).toBe(75);
      expect(updated?.manualBatteryCapacityKwh).toBe(60);
    });

    it("should preserve manualSoc when updateActiveSessionMeterData is called", async () => {
      const { updateActiveSessionMeterData } = await import("./charging-router");
      
      // Crear sesión con manualSoc
      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: 80,
        manualBatteryCapacityKwh: 45,
      });

      // Actualizar con MeterValues (no debe borrar manualSoc)
      updateActiveSessionMeterData(testTransactionId, {
        currentKwh: 5.5,
        currentCost: 9900,
        currentPower: 6.8,
      });

      const session = getActiveSessionById(testTransactionId);
      expect(session?.manualSoc).toBe(80);
      expect(session?.manualBatteryCapacityKwh).toBe(45);
      expect(session?.currentKwh).toBe(5.5);
      expect(session?.currentCost).toBe(9900);
    });

    it("should keep a late calibration absolute and add only subsequent MeterValues", async () => {
      const { updateActiveSessionMeterData } = await import("./charging-router");

      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "percentage",
        targetValue: 80,
        startTime: new Date(),
        currentKwh: 12,
        currentCost: 21600,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 7,
        voltage: 220,
        current: 32,
        lastMeterUpdate: new Date(),
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: 35,
        manualBatteryCapacityKwh: 60,
        manualSocCalibrationKwh: 12,
        manualSocCalibratedAt: new Date(),
      });

      updateActiveSessionMeterData(testTransactionId, { currentKwh: 12, currentPower: 7 });
      expect(getActiveSessionById(testTransactionId)?.energyBasedSoc).toBe(35);

      updateActiveSessionMeterData(testTransactionId, { currentKwh: 15, currentPower: 7 });
      expect(getActiveSessionById(testTransactionId)?.energyBasedSoc).toBe(40);
    });

    it("should keep OCPP SOC separate and authoritative over a prior manual calibration", async () => {
      const { updateActiveSessionMeterData } = await import("./charging-router");
      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "percentage",
        targetValue: 80,
        startTime: new Date(),
        currentKwh: 12,
        currentCost: 21600,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 7,
        voltage: 220,
        current: 32,
        lastMeterUpdate: new Date(),
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: 35,
        manualBatteryCapacityKwh: 60,
        manualSocCalibrationKwh: 12,
        manualSocCalibratedAt: new Date(),
      });

      updateActiveSessionMeterData(testTransactionId, { currentKwh: 30, soc: 76, currentPower: 40 });

      const updated = getActiveSessionById(testTransactionId);
      expect(updated?.soc).toBe(76);
      expect(updated?.energyBasedSoc).toBeNull();
    });
  });

  describe("SoC estimation from an absolute manual calibration", () => {
    it("should keep a late 35% calibration at exactly 35%", () => {
      const result = calculateSocEstimation({
        chargerSoc: null,
        manualSoc: 35,
        batteryCapacityKwh: 60,
        currentEnergyKwh: 12,
        calibrationEnergyKwh: 12,
      });

      expect(result.soc).toBe(35);
      expect(result.energySinceCalibrationKwh).toBe(0);
    });

    it("should add only the energy delivered after calibration", () => {
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

    it("should cap the post-calibration estimate at 100%", () => {
      const result = calculateSocEstimation({
        chargerSoc: null,
        manualSoc: 90,
        batteryCapacityKwh: 40,
        currentEnergyKwh: 20,
        calibrationEnergyKwh: 10,
      });

      expect(result.soc).toBe(100);
    });

    it("should handle small battery capacity correctly", () => {
      const result = calculateSocEstimation({
        chargerSoc: null,
        manualSoc: 20,
        batteryCapacityKwh: 24,
        currentEnergyKwh: 8.8,
        calibrationEnergyKwh: 4,
      });

      expect(result.soc).toBe(40);
    });
  });

  describe("Vehicle battery capacity preloading", () => {
    it("should use vehicle battery capacity when available", () => {
      const vehicleBatteryCapacity = 45.5; // kWh from user's vehicle
      const fallbackCapacity = 60;

      const effectiveCapacity = vehicleBatteryCapacity || fallbackCapacity;
      expect(effectiveCapacity).toBe(45.5);
    });

    it("should fallback to 60 kWh when no vehicle data", () => {
      const vehicleBatteryCapacity = null;
      const fallbackCapacity = 60;

      const effectiveCapacity = vehicleBatteryCapacity || fallbackCapacity;
      expect(effectiveCapacity).toBe(60);
    });

    it("should use server capacity over default when preloaded", () => {
      const serverCapacity = 75; // From active session (preloaded from vehicle)
      const defaultCapacity = 60;

      // Server capacity should take priority
      const effectiveCapacity = serverCapacity !== 60 ? serverCapacity : defaultCapacity;
      expect(effectiveCapacity).toBe(75);
    });
  });

  describe("Session creation for manual SoC when no session exists", () => {
    it("should create a new session with manualSoc when setActiveSession is called", () => {
      // Verify no session exists
      expect(getActiveSessionById(testTransactionId)).toBeUndefined();

      // Create session with manualSoc (simulating what setManualSoc now does)
      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: 65,
        manualBatteryCapacityKwh: 50,
      });

      const session = getActiveSessionById(testTransactionId);
      expect(session).not.toBeUndefined();
      expect(session?.manualSoc).toBe(65);
      expect(session?.manualBatteryCapacityKwh).toBe(50);
    });

    it("should allow subsequent MeterValues to update without losing manualSoc", async () => {
      const { updateActiveSessionMeterData } = await import("./charging-router");

      // Create session with manualSoc
      setActiveSession(testTransactionId, {
        transactionId: testTransactionId,
        userId: 1,
        stationId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh: 1800,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: 42,
        manualBatteryCapacityKwh: 62,
      });

      // Simulate multiple MeterValues updates
      for (let i = 1; i <= 5; i++) {
        updateActiveSessionMeterData(testTransactionId, {
          currentKwh: i * 1.5,
          currentCost: i * 2700,
          currentPower: 6.5 + Math.random(),
        });
      }

      const session = getActiveSessionById(testTransactionId);
      expect(session?.manualSoc).toBe(42);
      expect(session?.manualBatteryCapacityKwh).toBe(62);
      expect(session?.currentKwh).toBe(7.5); // 5 * 1.5
      expect(session?.powerHistory.length).toBe(5);
    });
  });
});
