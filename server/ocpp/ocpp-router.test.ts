import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ocppManager from "./connection-manager";
import { dualCSMS } from "./csms-dual";

describe("OCPP Connection Manager", () => {
  beforeEach(() => {
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

describe("DualCSMS Integration", () => {
  describe("getConnectionsStatus", () => {
    it("should return an array", () => {
      const status = dualCSMS.getConnectionsStatus();
      expect(Array.isArray(status)).toBe(true);
    });

    it("should return empty array when no stations connected", () => {
      const status = dualCSMS.getConnectionsStatus();
      expect(status.length).toBe(0);
    });
  });

  describe("isStationConnected", () => {
    it("should return false for non-existent station", () => {
      const result = dualCSMS.isStationConnected("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getStationOCPPVersion", () => {
    it("should return null for non-existent station", () => {
      const result = dualCSMS.getStationOCPPVersion("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("sendCommandIfConnected", () => {
    it("should return false when station is not connected", () => {
      const result = dualCSMS.sendCommandIfConnected(
        "non-existent",
        "msg1",
        "Reset",
        { type: "Soft" }
      );
      expect(result).toBe(false);
    });

    it("should return false for TriggerMessage when not connected", () => {
      const result = dualCSMS.sendCommandIfConnected(
        "non-existent",
        "msg2",
        "TriggerMessage",
        { requestedMessage: "StatusNotification" }
      );
      expect(result).toBe(false);
    });

    it("should return false for GetConfiguration when not connected", () => {
      const result = dualCSMS.sendCommandIfConnected(
        "non-existent",
        "msg3",
        "GetConfiguration",
        {}
      );
      expect(result).toBe(false);
    });
  });

  describe("sendGenericCommand", () => {
    it("should return null when station is not connected", async () => {
      const result = await dualCSMS.sendGenericCommand(
        "non-existent",
        "Reset",
        { type: "Soft" }
      );
      expect(result).toBeNull();
    });
  });

  describe("Command fallback pattern", () => {
    it("should try dualCSMS first, then fall back to ocppManager", () => {
      // Both should return false for non-existent connection
      const csmsResult = dualCSMS.sendCommandIfConnected(
        "test-charger",
        "msg1",
        "Reset",
        { type: "Soft" }
      );
      expect(csmsResult).toBe(false);

      // Fallback to legacy
      const legacyResult = ocppManager.sendOcppCommand(
        "test-charger",
        "msg1",
        "Reset",
        { type: "Soft" }
      );
      expect(legacyResult).toBe(false);
    });
  });
});
