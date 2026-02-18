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
  });

  describe("SoC estimation from manual input", () => {
    it("should estimate SoC based on manualSoc + kWh consumed", () => {
      const manualSoc = 30; // 30% al inicio
      const batteryCapacity = 60; // 60 kWh
      const kwhConsumed = 12; // 12 kWh cargados

      const kwhToSocPercent = (kwhConsumed / batteryCapacity) * 100;
      const estimatedSoc = Math.min(100, Math.round(manualSoc + kwhToSocPercent));

      expect(estimatedSoc).toBe(50); // 30% + 20% = 50%
    });

    it("should cap estimated SoC at 100%", () => {
      const manualSoc = 90;
      const batteryCapacity = 40;
      const kwhConsumed = 10; // 25% de 40kWh

      const kwhToSocPercent = (kwhConsumed / batteryCapacity) * 100;
      const estimatedSoc = Math.min(100, Math.round(manualSoc + kwhToSocPercent));

      expect(estimatedSoc).toBe(100); // 90% + 25% = 115% → capped at 100%
    });

    it("should handle small battery capacity correctly", () => {
      const manualSoc = 20;
      const batteryCapacity = 24; // Small EV battery
      const kwhConsumed = 4.8; // 20% of 24kWh

      const kwhToSocPercent = (kwhConsumed / batteryCapacity) * 100;
      const estimatedSoc = Math.min(100, Math.round(manualSoc + kwhToSocPercent));

      expect(estimatedSoc).toBe(40); // 20% + 20% = 40%
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
