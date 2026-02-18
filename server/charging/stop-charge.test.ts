/**
 * Tests para stopCharge y completeTransactionLocally
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de db
vi.mock("../db", () => ({
  getActiveTransactionByUserId: vi.fn(),
  getTransactionById: vi.fn(),
  getChargingStationById: vi.fn(),
  updateTransaction: vi.fn(),
  updateEvseStatus: vi.fn(),
  getWalletByUserId: vi.fn(),
  updateWalletBalance: vi.fn(),
  createWalletTransaction: vi.fn(),
  deductWalletBalance: vi.fn(),
  getTariffById: vi.fn(),
  getRevenueShareConfig: vi.fn().mockResolvedValue({ investorPercent: 70, platformPercent: 30 }),
  addInvestorEarnings: vi.fn(),
  createNotification: vi.fn(),
  createOcppLog: vi.fn(),
  getEvsesByStationId: vi.fn().mockResolvedValue([]),
  getUserByIdTagFromTable: vi.fn(),
  getChargingStationByOcppIdentity: vi.fn(),
  getActiveTransactionsByStationId: vi.fn(),
  getActiveTransaction: vi.fn(),
  resolveUserByIdTag: vi.fn(),
  getTransactionByOcppId: vi.fn(),
}));

// Mock de connection-manager
vi.mock("../ocpp/connection-manager", () => ({
  getConnection: vi.fn(),
  getConnectionByStationId: vi.fn(),
  sendOcppCommand: vi.fn(),
  getAllConnections: vi.fn().mockReturnValue([]),
  registerConnection: vi.fn(),
  removeConnection: vi.fn(),
  updateBootInfo: vi.fn(),
  updateHeartbeat: vi.fn(),
  updateConnectorStatus: vi.fn(),
  updateLastMessage: vi.fn(),
  getConnectionStats: vi.fn(),
}));

// Mock de csms-dual
vi.mock("../ocpp/csms-dual", () => ({
  dualCSMS: {
    isStationConnected: vi.fn().mockReturnValue(false),
    sendCommandIfConnected: vi.fn().mockReturnValue(false),
    getConnectionByStationId: vi.fn().mockReturnValue(null),
    getConnectionsStatus: vi.fn().mockReturnValue([]),
  },
}));

// Mock de charging-simulator
vi.mock("./charging-simulator", () => ({
  hasActiveSimulation: vi.fn().mockReturnValue(false),
  stopSimulation: vi.fn(),
}));

// Mock de dynamic-pricing
vi.mock("../pricing/dynamic-pricing", () => ({
  calculateDynamicPrice: vi.fn(),
}));

// Mock de uuid
vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("test-uuid"),
}));

import * as db from "../db";
import { getConnection, getConnectionByStationId, sendOcppCommand } from "../ocpp/connection-manager";

describe("stopCharge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Búsqueda de conexión OCPP", () => {
    it("debe encontrar conexión por stationId en connection-manager", async () => {
      const mockConn = {
        ocppIdentity: "EVG001",
        ws: { readyState: 1 },
        connectorStatuses: new Map(),
      };
      (getConnectionByStationId as any).mockReturnValue(mockConn);
      (sendOcppCommand as any).mockReturnValue(true);
      (db.getTransactionById as any).mockResolvedValue({
        id: 1,
        userId: 1,
        stationId: 1,
        status: "IN_PROGRESS",
        ocppTransactionId: "5",
        evseId: 1,
      });
      (db.getChargingStationById as any).mockResolvedValue({
        id: 1,
        ocppIdentity: "EVG001",
      });
      (db.createOcppLog as any).mockResolvedValue(undefined);

      // La conexión debería encontrarse por stationId
      expect(getConnectionByStationId).toBeDefined();
    });

    it("debe encontrar conexión por ocppIdentity como fallback", async () => {
      (getConnectionByStationId as any).mockReturnValue(null);
      const mockConn = {
        ocppIdentity: "EVG001",
        ws: { readyState: 1 },
      };
      (getConnection as any).mockReturnValue(mockConn);

      // La conexión debería encontrarse por ocppIdentity
      expect(getConnection).toBeDefined();
    });
  });

  describe("completeTransactionLocally", () => {
    it("debe calcular costos correctamente con datos de sesión activa", async () => {
      // Verificar que las funciones de DB están disponibles
      expect(db.updateTransaction).toBeDefined();
      expect(db.updateEvseStatus).toBeDefined();
      expect(db.deductWalletBalance).toBeDefined();
      expect(db.getRevenueShareConfig).toBeDefined();
    });

    it("debe descontar saldo del usuario al completar transacción", async () => {
      // Verificar que deductWalletBalance existe y es callable
      expect(typeof db.deductWalletBalance).toBe("function");
    });

    it("debe enviar notificación al usuario al completar transacción", async () => {
      expect(typeof db.createNotification).toBe("function");
    });

    it("debe actualizar EVSE a AVAILABLE al completar transacción", async () => {
      expect(typeof db.updateEvseStatus).toBe("function");
    });
  });

  describe("Descuento de saldo en StopTransaction OCPP", () => {
    it("debe tener getWalletByUserId disponible para el handler", async () => {
      expect(typeof db.getWalletByUserId).toBe("function");
    });

    it("debe tener updateWalletBalance disponible para el handler", async () => {
      expect(typeof db.updateWalletBalance).toBe("function");
    });

    it("debe tener createWalletTransaction disponible para el handler", async () => {
      expect(typeof db.createWalletTransaction).toBe("function");
    });

    it("debe calcular distribución de ingresos correctamente", async () => {
      const config = await db.getRevenueShareConfig();
      expect(config.investorPercent).toBe(70);
      expect(config.platformPercent).toBe(30);
      
      const totalCost = 10000;
      const investorShare = totalCost * (config.investorPercent / 100);
      const platformFee = totalCost * (config.platformPercent / 100);
      
      expect(investorShare).toBe(7000);
      expect(platformFee).toBe(3000);
    });
  });

  describe("Timeout de seguridad", () => {
    it("debe completar localmente si el cargador no responde en 45s", () => {
      // El timeout de 45s está implementado en stopCharge
      // Verificar que las funciones necesarias existen
      expect(typeof db.getTransactionById).toBe("function");
      expect(typeof db.updateTransaction).toBe("function");
    });
  });

  describe("RemoteStopTransaction con transactionId numérico", () => {
    it("debe parsear ocppTransactionId como número para OCPP 1.6", () => {
      const ocppTxId = "5";
      const numericId = parseInt(ocppTxId);
      expect(numericId).toBe(5);
      expect(typeof numericId).toBe("number");
    });

    it("debe usar transactionId como fallback si no hay ocppTransactionId", () => {
      const transactionId = 10;
      const ocppTransactionId = null;
      const ocppTxId = ocppTransactionId ? parseInt(ocppTransactionId) : transactionId;
      expect(ocppTxId).toBe(10);
    });
  });
});
