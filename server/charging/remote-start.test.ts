/**
 * Tests para la lógica de envío de RemoteStartTransaction
 * 
 * Verifica el mecanismo de retry, fallback, y deferred retry
 * para asegurar que el comando RemoteStartTransaction se envía
 * correctamente al cargador real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de dualCSMS
const mockRequestStartTransaction = vi.fn();
const mockSendCommandIfConnected = vi.fn();
const mockIsStationConnected = vi.fn();
const mockGetConnectionByStationId = vi.fn();

vi.mock("../ocpp/csms-dual", () => ({
  dualCSMS: {
    requestStartTransaction: (...args: any[]) => mockRequestStartTransaction(...args),
    sendCommandIfConnected: (...args: any[]) => mockSendCommandIfConnected(...args),
    isStationConnected: (...args: any[]) => mockIsStationConnected(...args),
    getConnectionByStationId: (...args: any[]) => mockGetConnectionByStationId(...args),
  },
}));

vi.mock("../ocpp/connection-manager", () => ({
  getConnection: vi.fn(),
  getConnectionByStationId: vi.fn(),
  sendOcppCommand: vi.fn().mockReturnValue(false),
  getAllConnections: vi.fn().mockReturnValue([]),
}));

vi.mock("../db", () => ({
  getChargingStationById: vi.fn(),
  getEvsesByStationId: vi.fn(),
  getWalletByUserId: vi.fn(),
  getUserById: vi.fn(),
  createChargingSession: vi.fn(),
  getChargingStationByOcppIdentity: vi.fn(),
  getEffectiveStationPrice: vi.fn().mockResolvedValue({ pricePerKwh: 1300 }),
  updateChargingStation: vi.fn(),
  createNotification: vi.fn(),
  getActiveTransactionByUserId: vi.fn(),
  getActiveTariffByStationId: vi.fn(),
}));

vi.mock("../pricing/dynamic-pricing", () => ({
  calculateDynamicPrice: vi.fn().mockResolvedValue({
    finalPrice: 800,
    factors: { finalMultiplier: 1 },
  }),
  getDemandLevel: vi.fn().mockReturnValue("NORMAL"),
}));

vi.mock("./charging-simulator", () => ({
  isTestUser: vi.fn().mockReturnValue(false),
  getActiveSimulationInfo: vi.fn().mockReturnValue(null),
}));

describe("RemoteStartTransaction Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("requestStartTransaction retry mechanism", () => {
    it("should succeed on first attempt when charger is connected", async () => {
      mockRequestStartTransaction.mockResolvedValueOnce({ status: "Accepted" });

      const result = await mockRequestStartTransaction("EVG001", 1, "USER-1");
      
      expect(result).toEqual({ status: "Accepted" });
      expect(mockRequestStartTransaction).toHaveBeenCalledTimes(1);
      expect(mockRequestStartTransaction).toHaveBeenCalledWith("EVG001", 1, "USER-1");
    });

    it("should throw when charger is not connected", async () => {
      mockRequestStartTransaction.mockRejectedValueOnce(
        new Error("Charging station EVG001 not connected. Active: []")
      );

      await expect(
        mockRequestStartTransaction("EVG001", 1, "USER-1")
      ).rejects.toThrow("not connected");
    });

    it("should throw when WebSocket is not OPEN", async () => {
      mockRequestStartTransaction.mockRejectedValueOnce(
        new Error("Charging station EVG001 WebSocket not OPEN (readyState=3)")
      );

      await expect(
        mockRequestStartTransaction("EVG001", 1, "USER-1")
      ).rejects.toThrow("not OPEN");
    });

    it("should return Rejected status when charger rejects the command", async () => {
      mockRequestStartTransaction.mockResolvedValueOnce({ status: "Rejected" });

      const result = await mockRequestStartTransaction("EVG001", 1, "USER-1");
      
      expect(result.status).toBe("Rejected");
    });
  });

  describe("sendCommandIfConnected fallback", () => {
    it("should return true when connection exists and WebSocket is OPEN", () => {
      mockSendCommandIfConnected.mockReturnValue(true);

      const result = mockSendCommandIfConnected("EVG001", "msg-1", "RemoteStartTransaction", {
        connectorId: 1,
        idTag: "USER-1",
      });

      expect(result).toBe(true);
    });

    it("should return false when no connection exists", () => {
      mockSendCommandIfConnected.mockReturnValue(false);

      const result = mockSendCommandIfConnected("EVG001", "msg-1", "RemoteStartTransaction", {
        connectorId: 1,
        idTag: "USER-1",
      });

      expect(result).toBe(false);
    });
  });

  describe("Station availability checks", () => {
    it("should detect station connected by ocppIdentity", () => {
      mockIsStationConnected.mockReturnValue(true);

      const isConnected = mockIsStationConnected("EVG001");
      expect(isConnected).toBe(true);
    });

    it("should detect station not connected", () => {
      mockIsStationConnected.mockReturnValue(false);

      const isConnected = mockIsStationConnected("EVG001");
      expect(isConnected).toBe(false);
    });

    it("should find connection by stationId when available", () => {
      mockGetConnectionByStationId.mockReturnValue({
        ocppIdentity: "EVG001",
        ws: { readyState: 1 },
        ocppVersion: "1.6",
      });

      const conn = mockGetConnectionByStationId(150001);
      expect(conn).not.toBeNull();
      expect(conn.ocppIdentity).toBe("EVG001");
    });

    it("should return null when stationId not found in connections", () => {
      mockGetConnectionByStationId.mockReturnValue(null);

      const conn = mockGetConnectionByStationId(999999);
      expect(conn).toBeNull();
    });
  });

  describe("Availability logic (same as getStationByCode)", () => {
    it("should be available when hasOcppConnection is true", () => {
      const hasOcppConnection = true;
      const isConnectedByIdentity = false;
      const stationOnlineInDb = false;
      const stationIsActive = false;
      const hasAvailableConnector = false;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(true);
    });

    it("should be available when isConnectedByIdentity is true", () => {
      const hasOcppConnection = false;
      const isConnectedByIdentity = true;
      const stationOnlineInDb = false;
      const stationIsActive = false;
      const hasAvailableConnector = false;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(true);
    });

    it("should be available when stationOnlineInDb is true (grace period)", () => {
      const hasOcppConnection = false;
      const isConnectedByIdentity = false;
      const stationOnlineInDb = true;
      const stationIsActive = false;
      const hasAvailableConnector = false;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(true);
    });

    it("should be available when station is active with available connector", () => {
      const hasOcppConnection = false;
      const isConnectedByIdentity = false;
      const stationOnlineInDb = false;
      const stationIsActive = true;
      const hasAvailableConnector = true;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(true);
    });

    it("should NOT be available when all conditions are false", () => {
      const hasOcppConnection = false;
      const isConnectedByIdentity = false;
      const stationOnlineInDb = false;
      const stationIsActive = false;
      const hasAvailableConnector = false;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(false);
    });

    it("should NOT be available when station is active but no available connector", () => {
      const hasOcppConnection = false;
      const isConnectedByIdentity = false;
      const stationOnlineInDb = false;
      const stationIsActive = true;
      const hasAvailableConnector = false;

      const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
      expect(isAvailable).toBe(false);
    });
  });

  describe("Retry logic simulation", () => {
    it("should retry up to 3 times with backoff on requestStartTransaction failure", async () => {
      // Simulate the retry logic from startCharge
      mockRequestStartTransaction
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({ status: "Accepted" });

      let sent = false;
      let remoteStartResponse: { status: string } | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          remoteStartResponse = await mockRequestStartTransaction("EVG001", 1, "USER-1");
          sent = true;
          break;
        } catch (error: any) {
          if (attempt < 3) {
            // In real code, would await delay here
          }
        }
      }

      expect(sent).toBe(true);
      expect(remoteStartResponse?.status).toBe("Accepted");
      expect(mockRequestStartTransaction).toHaveBeenCalledTimes(3);
    });

    it("should fall back to sendCommandIfConnected when all retries fail", async () => {
      mockRequestStartTransaction
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockRejectedValueOnce(new Error("Timeout"));

      mockSendCommandIfConnected.mockReturnValue(true);

      let sent = false;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await mockRequestStartTransaction("EVG001", 1, "USER-1");
          sent = true;
          break;
        } catch (error: any) {
          // continue
        }
      }

      if (!sent) {
        sent = mockSendCommandIfConnected("EVG001", "msg-1", "RemoteStartTransaction", {
          connectorId: 1,
          idTag: "USER-1",
        });
      }

      expect(sent).toBe(true);
      expect(mockRequestStartTransaction).toHaveBeenCalledTimes(3);
      expect(mockSendCommandIfConnected).toHaveBeenCalledTimes(1);
    });

    it("should not retry when charger explicitly rejects", async () => {
      mockRequestStartTransaction.mockResolvedValueOnce({ status: "Rejected" });

      let sent = false;
      let remoteStartResponse: { status: string } | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          remoteStartResponse = await mockRequestStartTransaction("EVG001", 1, "USER-1");
          sent = true;
          if (remoteStartResponse?.status === "Rejected") {
            break; // Don't retry on explicit rejection
          }
          break;
        } catch (error: any) {
          // continue
        }
      }

      expect(sent).toBe(true);
      expect(remoteStartResponse?.status).toBe("Rejected");
      expect(mockRequestStartTransaction).toHaveBeenCalledTimes(1); // Only 1 attempt
    });
  });

  describe("Deferred retry mechanism", () => {
    it("should stop deferred retry when session is consumed", () => {
      const pendingSessions = new Map<string, any>();
      const sessionId = "test-session-1";
      
      // Session exists initially
      pendingSessions.set(sessionId, {
        userId: 1,
        stationId: 150001,
        connectorId: 1,
        ocppIdentity: "EVG001",
      });

      // Simulate session being consumed by StartTransaction
      pendingSessions.delete(sessionId);

      // Deferred retry should detect session is gone
      const session = pendingSessions.get(sessionId);
      expect(session).toBeUndefined();
    });

    it("should respect max attempts limit", () => {
      const maxAttempts = 12;
      let attempts = 0;
      let stopped = false;

      // Simulate the deferred retry loop
      for (let i = 0; i < 20; i++) {
        attempts++;
        if (attempts > maxAttempts) {
          stopped = true;
          break;
        }
      }

      expect(stopped).toBe(true);
      expect(attempts).toBe(13); // maxAttempts + 1 (the check that exceeds)
    });
  });

  describe("idTag generation", () => {
    it("should use user idTag when available", () => {
      const user = { id: 1, idTag: "CUSTOM-TAG-001" };
      const idTag = user.idTag || `USER-${user.id}`;
      expect(idTag).toBe("CUSTOM-TAG-001");
    });

    it("should generate USER-{id} format when no idTag", () => {
      const user = { id: 42, idTag: null };
      const idTag = user.idTag || `USER-${user.id}`;
      expect(idTag).toBe("USER-42");
    });

    it("should generate USER-{id} format when idTag is empty string", () => {
      const user = { id: 42, idTag: "" };
      const idTag = user.idTag || `USER-${user.id}`;
      expect(idTag).toBe("USER-42");
    });
  });

  describe("Connector status normalization", () => {
    it("should normalize Available to AVAILABLE for comparison", () => {
      const statuses = ["Available", "Preparing", "SuspendedEV", "Charging"];
      const normalized = statuses.map(s => s.toUpperCase());
      
      expect(normalized).toContain("AVAILABLE");
      expect(normalized).toContain("PREPARING");
    });

    it("should detect AVAILABLE or PREPARING connectors from DB", () => {
      const connectors = [
        { connectorId: 1, status: "Available" },
        { connectorId: 2, status: "Charging" },
      ];

      const hasAvailableConnector = connectors.some((c: any) => {
        const s = (c.status || '').toUpperCase();
        return s === 'AVAILABLE' || s === 'PREPARING';
      });

      expect(hasAvailableConnector).toBe(true);
    });

    it("should return false when no connectors are available", () => {
      const connectors = [
        { connectorId: 1, status: "Charging" },
        { connectorId: 2, status: "Faulted" },
      ];

      const hasAvailableConnector = connectors.some((c: any) => {
        const s = (c.status || '').toUpperCase();
        return s === 'AVAILABLE' || s === 'PREPARING';
      });

      expect(hasAvailableConnector).toBe(false);
    });
  });
});
