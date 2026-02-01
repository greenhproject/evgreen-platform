/**
 * Tests para el simulador de carga de vehículos eléctricos
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as simulator from "./charging-simulator";

// Mock de las funciones de db
vi.mock("../db", () => ({
  createTransaction: vi.fn().mockResolvedValue(1),
  updateEvseStatus: vi.fn().mockResolvedValue(undefined),
  createMeterValue: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  getWalletByUserId: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    balance: "100000",
  }),
  updateWalletBalance: vi.fn().mockResolvedValue(undefined),
  createWalletTransaction: vi.fn().mockResolvedValue(1),
  createNotification: vi.fn().mockResolvedValue(1),
  getEvseById: vi.fn().mockResolvedValue({
    id: 1,
    stationId: 1,
    connectorId: 1,
    connectorType: "TYPE_2",
    powerKw: "50", // 50 kW de potencia
    status: "AVAILABLE",
  }),
  getUserById: vi.fn().mockResolvedValue({
    id: 1,
    email: "info@greenhproject.com",
    name: "Test User",
    fcmToken: null,
  }),
  getChargingStationById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Station",
    address: "Test Address",
  }),
}));

describe("Charging Simulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isTestUser", () => {
    it("should return true for test user emails", () => {
      expect(simulator.isTestUser("info@greenhproject.com")).toBe(true);
      expect(simulator.isTestUser("test@evgreen.lat")).toBe(true);
      expect(simulator.isTestUser("demo@evgreen.lat")).toBe(true);
    });

    it("should return true regardless of case", () => {
      expect(simulator.isTestUser("INFO@GREENHPROJECT.COM")).toBe(true);
      expect(simulator.isTestUser("Test@EVGreen.lat")).toBe(true);
    });

    it("should return false for non-test user emails", () => {
      expect(simulator.isTestUser("user@example.com")).toBe(false);
      expect(simulator.isTestUser("random@gmail.com")).toBe(false);
      expect(simulator.isTestUser("")).toBe(false);
    });
  });

  describe("hasActiveSimulation", () => {
    it("should return false when no simulation is active", () => {
      expect(simulator.hasActiveSimulation(999)).toBe(false);
    });
  });

  describe("getSimulationStatus", () => {
    it("should return null when no simulation exists", () => {
      expect(simulator.getSimulationStatus(999)).toBe(null);
    });
  });

  describe("getActiveSimulationInfo", () => {
    it("should return null when no simulation is active", () => {
      expect(simulator.getActiveSimulationInfo(999)).toBe(null);
    });
  });

  describe("startSimulation", () => {
    it("should throw error for non-test users", async () => {
      await expect(
        simulator.startSimulation({
          userId: 1,
          userEmail: "regular@user.com",
          stationId: 1,
          evseId: 1,
          connectorId: 1,
          chargeMode: "fixed_amount",
          targetValue: 10000,
          pricePerKwh: 800,
        })
      ).rejects.toThrow("Solo usuarios de prueba pueden usar el simulador");
    });

    it("should start simulation for test users", async () => {
      const result = await simulator.startSimulation({
        userId: 100,
        userEmail: "info@greenhproject.com",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "fixed_amount",
        targetValue: 10000,
        pricePerKwh: 800,
      });

      expect(result.transactionId).toBe(1);
      expect(result.sessionId).toBeDefined();
      expect(simulator.hasActiveSimulation(100)).toBe(true);

      // Limpiar simulación
      await simulator.stopSimulation(100);
    });

    it("should throw error if simulation already active", async () => {
      // Iniciar primera simulación
      await simulator.startSimulation({
        userId: 101,
        userEmail: "test@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        pricePerKwh: 800,
      });

      // Intentar iniciar segunda simulación
      await expect(
        simulator.startSimulation({
          userId: 101,
          userEmail: "test@evgreen.lat",
          stationId: 1,
          evseId: 1,
          connectorId: 1,
          chargeMode: "full_charge",
          targetValue: 100,
          pricePerKwh: 800,
        })
      ).rejects.toThrow("Ya hay una simulación activa para este usuario");

      // Limpiar
      await simulator.stopSimulation(101);
    });

    it("should calculate correct target kWh for fixed_amount mode", async () => {
      const pricePerKwh = 800;
      const targetValue = 8000; // $8000 pesos

      await simulator.startSimulation({
        userId: 102,
        userEmail: "demo@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "fixed_amount",
        targetValue,
        pricePerKwh,
      });

      const info = simulator.getActiveSimulationInfo(102);
      expect(info).not.toBeNull();
      // targetKwh = 8000 / 800 = 10, pero limitado a min 2, max 15
      expect(info!.targetKwh).toBe(10);

      await simulator.stopSimulation(102);
    });

    it("should calculate correct target kWh for percentage mode", async () => {
      await simulator.startSimulation({
        userId: 103,
        userEmail: "info@greenhproject.com",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "percentage",
        targetValue: 80, // Cargar hasta 80%
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(103);
      expect(info).not.toBeNull();
      // (80 - 20) / 100 * 60 = 36 kWh, limitado a 15
      expect(info!.targetKwh).toBe(15);

      await simulator.stopSimulation(103);
    });

    it("should limit target kWh to maximum of 15", async () => {
      await simulator.startSimulation({
        userId: 104,
        userEmail: "test@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(104);
      expect(info).not.toBeNull();
      expect(info!.targetKwh).toBeLessThanOrEqual(15);

      await simulator.stopSimulation(104);
    });

    it("should ensure minimum target kWh of 2", async () => {
      await simulator.startSimulation({
        userId: 105,
        userEmail: "demo@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "fixed_amount",
        targetValue: 100, // Muy poco dinero
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(105);
      expect(info).not.toBeNull();
      expect(info!.targetKwh).toBeGreaterThanOrEqual(2);

      await simulator.stopSimulation(105);
    });
  });

  describe("stopSimulation", () => {
    it("should return null when no simulation exists", async () => {
      const result = await simulator.stopSimulation(999);
      expect(result).toBeNull();
    });

    it("should stop active simulation and return summary", async () => {
      await simulator.startSimulation({
        userId: 106,
        userEmail: "info@greenhproject.com",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "fixed_amount",
        targetValue: 10000,
        pricePerKwh: 800,
      });

      expect(simulator.hasActiveSimulation(106)).toBe(true);

      const result = await simulator.stopSimulation(106);
      expect(result).not.toBeNull();
      expect(result!.transactionId).toBeDefined();
      expect(result!.kwhConsumed).toBeGreaterThanOrEqual(0);
      expect(result!.totalCost).toBeGreaterThanOrEqual(0);

      expect(simulator.hasActiveSimulation(106)).toBe(false);
    });
  });

  describe("Simulation Info", () => {
    it("should return correct simulation info", async () => {
      await simulator.startSimulation({
        userId: 107,
        userEmail: "test@evgreen.lat",
        stationId: 5,
        evseId: 10,
        connectorId: 2,
        chargeMode: "fixed_amount",
        targetValue: 8000,
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(107);
      expect(info).not.toBeNull();
      expect(info!.status).toBe("connecting");
      expect(info!.currentKwh).toBe(0);
      expect(info!.currentCost).toBe(0);
      expect(info!.progress).toBe(0);
      expect(info!.pricePerKwh).toBe(800);
      expect(info!.chargeMode).toBe("fixed_amount");
      expect(info!.targetValue).toBe(8000);

      await simulator.stopSimulation(107);
    });

    it("should include chargeMode and targetValue for percentage mode", async () => {
      await simulator.startSimulation({
        userId: 111,
        userEmail: "info@greenhproject.com",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "percentage",
        targetValue: 80,
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(111);
      expect(info).not.toBeNull();
      expect(info!.chargeMode).toBe("percentage");
      expect(info!.targetValue).toBe(80);

      await simulator.stopSimulation(111);
    });

    it("should include chargeMode and targetValue for full_charge mode", async () => {
      await simulator.startSimulation({
        userId: 112,
        userEmail: "demo@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(112);
      expect(info).not.toBeNull();
      expect(info!.chargeMode).toBe("full_charge");
      expect(info!.targetValue).toBe(100);

      await simulator.stopSimulation(112);
    });
  });

  describe("Charge Mode Calculations", () => {
    it("should handle fixed_amount mode correctly", async () => {
      const pricePerKwh = 1000;
      const targetValue = 5000;

      await simulator.startSimulation({
        userId: 108,
        userEmail: "info@greenhproject.com",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "fixed_amount",
        targetValue,
        pricePerKwh,
      });

      const info = simulator.getActiveSimulationInfo(108);
      // 5000 / 1000 = 5 kWh
      expect(info!.targetKwh).toBe(5);

      await simulator.stopSimulation(108);
    });

    it("should handle percentage mode correctly", async () => {
      await simulator.startSimulation({
        userId: 109,
        userEmail: "demo@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "percentage",
        targetValue: 50, // Cargar hasta 50%
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(109);
      // (50 - 20) / 100 * 60 = 18 kWh, limitado a 15
      expect(info!.targetKwh).toBe(15);

      await simulator.stopSimulation(109);
    });

    it("should handle full_charge mode correctly", async () => {
      await simulator.startSimulation({
        userId: 110,
        userEmail: "test@evgreen.lat",
        stationId: 1,
        evseId: 1,
        connectorId: 1,
        chargeMode: "full_charge",
        targetValue: 100,
        pricePerKwh: 800,
      });

      const info = simulator.getActiveSimulationInfo(110);
      // 0.8 * 60 = 48 kWh, limitado a 15
      expect(info!.targetKwh).toBe(15);

      await simulator.stopSimulation(110);
    });
  });
});
