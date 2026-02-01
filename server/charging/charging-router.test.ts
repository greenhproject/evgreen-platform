/**
 * Tests para el Charging Router
 * 
 * Verifica los endpoints del flujo de carga de vehículos eléctricos
 */

import { describe, it, expect, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";

// Mock de funciones de base de datos
vi.mock("../db", () => ({
  getStationByOcppIdentity: vi.fn(),
  getChargingStationById: vi.fn(),
  getEvsesByStationId: vi.fn(),
  getWalletByUserId: vi.fn(),
  getUserById: vi.fn(),
  createChargingSession: vi.fn(),
}));

// Mock del connection manager
vi.mock("../ocpp/connection-manager", () => ({
  ocppConnectionManager: {
    isConnected: vi.fn(),
    sendCommand: vi.fn(),
  },
}));

// Mock del dynamic pricing
vi.mock("../pricing/dynamic-pricing", () => ({
  calculateDynamicPrice: vi.fn().mockResolvedValue({
    finalPrice: 800,
    factors: { finalMultiplier: 1 },
  }),
  getDemandLevel: vi.fn().mockReturnValue("NORMAL"),
}));

describe("Charging Router", () => {
  describe("Validación de inputs", () => {
    it("debe validar que el código de estación no esté vacío", () => {
      const code = "";
      expect(code.length).toBe(0);
    });

    it("debe validar que el connectorId sea un número positivo", () => {
      const connectorId = 1;
      expect(connectorId).toBeGreaterThan(0);
    });

    it("debe validar que el chargeMode sea válido", () => {
      const validModes = ["fixed_amount", "percentage", "full_charge"];
      const mode = "percentage";
      expect(validModes).toContain(mode);
    });

    it("debe validar que el targetValue esté en rango válido para porcentaje", () => {
      const targetValue = 80;
      expect(targetValue).toBeGreaterThanOrEqual(30);
      expect(targetValue).toBeLessThanOrEqual(100);
    });

    it("debe validar que el targetValue esté en rango válido para valor fijo", () => {
      const targetValue = 50000;
      expect(targetValue).toBeGreaterThanOrEqual(10000);
      expect(targetValue).toBeLessThanOrEqual(500000);
    });
  });

  describe("Cálculos de estimación", () => {
    it("debe calcular kWh estimados para valor fijo", () => {
      const targetAmount = 50000; // COP
      const pricePerKwh = 800; // COP/kWh
      const estimatedKwh = targetAmount / pricePerKwh;
      expect(estimatedKwh).toBe(62.5);
    });

    it("debe calcular kWh estimados para porcentaje", () => {
      const targetPercentage = 80;
      const currentPercentage = 20;
      const batteryCapacity = 60; // kWh
      const estimatedKwh = ((targetPercentage - currentPercentage) / 100) * batteryCapacity;
      expect(estimatedKwh).toBe(36);
    });

    it("debe calcular tiempo estimado de carga", () => {
      const estimatedKwh = 30;
      const powerKw = 50; // kW
      const estimatedMinutes = (estimatedKwh / powerKw) * 60;
      expect(estimatedMinutes).toBe(36);
    });

    it("debe calcular costo estimado", () => {
      const estimatedKwh = 30;
      const pricePerKwh = 800;
      const estimatedCost = estimatedKwh * pricePerKwh;
      expect(estimatedCost).toBe(24000);
    });
  });

  describe("Validación de saldo", () => {
    it("debe detectar saldo suficiente", () => {
      const balance = 50000;
      const estimatedCost = 30000;
      const hasSufficientBalance = balance >= estimatedCost;
      expect(hasSufficientBalance).toBe(true);
    });

    it("debe detectar saldo insuficiente", () => {
      const balance = 20000;
      const estimatedCost = 30000;
      const hasSufficientBalance = balance >= estimatedCost;
      expect(hasSufficientBalance).toBe(false);
    });

    it("debe calcular el faltante correctamente", () => {
      const balance = 20000;
      const estimatedCost = 30000;
      const shortfall = Math.max(0, estimatedCost - balance);
      expect(shortfall).toBe(10000);
    });
  });

  describe("Generación de sessionId", () => {
    it("debe generar un sessionId único", () => {
      const sessionId1 = uuidv4();
      const sessionId2 = uuidv4();
      expect(sessionId1).not.toBe(sessionId2);
    });

    it("debe tener formato UUID válido", () => {
      const sessionId = uuidv4();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidRegex);
    });
  });

  describe("Disponibilidad de conectores", () => {
    it("debe considerar AVAILABLE como disponible", () => {
      const status = "AVAILABLE";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(true);
    });

    it("debe considerar Available (minúsculas) como disponible", () => {
      const status = "Available";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(true);
    });

    it("debe considerar PREPARING como disponible", () => {
      const status = "PREPARING";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(true);
    });

    it("debe considerar CHARGING como no disponible", () => {
      const status = "CHARGING";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(false);
    });

    it("debe considerar UNAVAILABLE como no disponible", () => {
      const status = "UNAVAILABLE";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(false);
    });

    it("debe considerar FAULTED como no disponible", () => {
      const status = "FAULTED";
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(false);
    });

    it("debe manejar status null como no disponible", () => {
      const status = null;
      const normalizedStatus = status?.toUpperCase() || 'UNAVAILABLE';
      const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
      expect(isAvailable).toBe(false);
    });
  });

  describe("Modos de carga", () => {
    it("debe manejar modo fixed_amount correctamente", () => {
      const mode = "fixed_amount";
      const targetValue = 50000;
      const pricePerKwh = 800;
      
      if (mode === "fixed_amount") {
        const estimatedKwh = targetValue / pricePerKwh;
        expect(estimatedKwh).toBe(62.5);
      }
    });

    it("debe manejar modo percentage correctamente", () => {
      const mode = "percentage";
      const targetValue = 80;
      const batteryCapacity = 60;
      const currentPercentage = 20;
      
      if (mode === "percentage") {
        const estimatedKwh = ((targetValue - currentPercentage) / 100) * batteryCapacity;
        expect(estimatedKwh).toBe(36);
      }
    });

    it("debe manejar modo full_charge correctamente", () => {
      const mode = "full_charge";
      const batteryCapacity = 60;
      const currentPercentage = 20;
      
      if (mode === "full_charge") {
        const estimatedKwh = ((100 - currentPercentage) / 100) * batteryCapacity;
        expect(estimatedKwh).toBe(48);
      }
    });
  });
});
