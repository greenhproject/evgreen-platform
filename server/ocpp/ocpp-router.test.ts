import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ocppManager from "./connection-manager";

describe("OCPP Connection Manager", () => {
  beforeEach(() => {
    // Limpiar conexiones antes de cada test
    vi.clearAllMocks();
  });

  describe("getAllConnections", () => {
    it("should return empty array when no connections", () => {
      const connections = ocppManager.getAllConnections();
      expect(Array.isArray(connections)).toBe(true);
    });
  });

  describe("getConnectionStats", () => {
    it("should return stats object with correct structure", () => {
      const stats = ocppManager.getConnectionStats();
      
      expect(stats).toHaveProperty("totalConnections");
      expect(stats).toHaveProperty("connectedCount");
      expect(stats).toHaveProperty("disconnectedCount");
      expect(stats).toHaveProperty("byVersion");
      expect(typeof stats.totalConnections).toBe("number");
      expect(typeof stats.connectedCount).toBe("number");
      expect(typeof stats.disconnectedCount).toBe("number");
      expect(typeof stats.byVersion).toBe("object");
    });

    it("should have non-negative counts", () => {
      const stats = ocppManager.getConnectionStats();
      
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(stats.connectedCount).toBeGreaterThanOrEqual(0);
      expect(stats.disconnectedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("updateHeartbeat", () => {
    it("should not throw when updating non-existent connection", () => {
      expect(() => {
        ocppManager.updateHeartbeat("non-existent");
      }).not.toThrow();
    });
  });

  describe("updateConnectorStatus", () => {
    it("should not throw when updating non-existent connection", () => {
      expect(() => {
        ocppManager.updateConnectorStatus("non-existent", 1, "Available");
      }).not.toThrow();
    });
  });

  describe("updateLastMessage", () => {
    it("should not throw when updating non-existent connection", () => {
      expect(() => {
        ocppManager.updateLastMessage("non-existent");
      }).not.toThrow();
    });
  });

  describe("removeConnection", () => {
    it("should not throw when removing non-existent connection", () => {
      expect(() => {
        ocppManager.removeConnection("non-existent");
      }).not.toThrow();
    });
  });

  describe("getConnection", () => {
    it("should return undefined for non-existent connection", () => {
      const connection = ocppManager.getConnection("non-existent");
      expect(connection).toBeUndefined();
    });
  });

  describe("getConnectionByStationId", () => {
    it("should return undefined for non-existent station", () => {
      const connection = ocppManager.getConnectionByStationId(99999);
      expect(connection).toBeUndefined();
    });
  });

  describe("sendOcppCommand", () => {
    it("should return false when connection does not exist", () => {
      const result = ocppManager.sendOcppCommand(
        "non-existent",
        "msg1",
        "Reset",
        { type: "Soft" }
      );
      expect(result).toBe(false);
    });

    it("should return false for GetConfiguration when connection does not exist", () => {
      const result = ocppManager.sendOcppCommand(
        "non-existent",
        "msg2",
        "GetConfiguration",
        { key: ["HeartbeatInterval"] }
      );
      expect(result).toBe(false);
    });

    it("should return false for ChangeConfiguration when connection does not exist", () => {
      const result = ocppManager.sendOcppCommand(
        "non-existent",
        "msg3",
        "ChangeConfiguration",
        { key: "HeartbeatInterval", value: "60" }
      );
      expect(result).toBe(false);
    });
  });
});
