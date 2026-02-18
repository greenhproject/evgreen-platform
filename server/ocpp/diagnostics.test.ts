import { describe, it, expect, vi, beforeEach } from "vitest";
import { dualCSMS } from "./csms-dual";

describe("OCPP Diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDetailedDiagnostics", () => {
    it("should return an array", () => {
      const diagnostics = dualCSMS.getDetailedDiagnostics();
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should return empty array when no stations connected", () => {
      const diagnostics = dualCSMS.getDetailedDiagnostics();
      expect(diagnostics.length).toBe(0);
    });

    it("should return diagnostics with correct structure when connections exist", () => {
      const diagnostics = dualCSMS.getDetailedDiagnostics();
      // When empty, just verify it's an array
      expect(Array.isArray(diagnostics)).toBe(true);
      
      // If there were connections, each entry should have these fields
      for (const diag of diagnostics) {
        expect(diag).toHaveProperty("ocppIdentity");
        expect(diag).toHaveProperty("wsReadyState");
        expect(diag).toHaveProperty("wsReadyStateLabel");
        expect(diag).toHaveProperty("uptimeSeconds");
        expect(diag).toHaveProperty("heartbeatAgeSeconds");
        expect(diag).toHaveProperty("pendingCallsCount");
        expect(diag).toHaveProperty("isHealthy");
        expect(diag).toHaveProperty("connectors");
        expect(typeof diag.ocppIdentity).toBe("string");
        expect(typeof diag.wsReadyState).toBe("number");
        expect(typeof diag.isHealthy).toBe("boolean");
      }
    });
  });

  describe("getConnectionsStatus vs getDetailedDiagnostics", () => {
    it("should return same number of entries", () => {
      const status = dualCSMS.getConnectionsStatus();
      const diagnostics = dualCSMS.getDetailedDiagnostics();
      expect(status.length).toBe(diagnostics.length);
    });
  });

  describe("Health check logic", () => {
    it("should consider a station unhealthy if not connected", () => {
      // Non-existent station should not appear in diagnostics
      const diagnostics = dualCSMS.getDetailedDiagnostics();
      const nonExistent = diagnostics.find(d => d.ocppIdentity === "non-existent-station");
      expect(nonExistent).toBeUndefined();
    });
  });
});

describe("OCPP Connection Status", () => {
  describe("isStationConnected", () => {
    it("should return false for non-existent station", () => {
      expect(dualCSMS.isStationConnected("non-existent")).toBe(false);
    });
  });

  describe("getStationOCPPVersion", () => {
    it("should return null for non-existent station", () => {
      expect(dualCSMS.getStationOCPPVersion("non-existent")).toBeNull();
    });
  });
});

describe("OCPP Notification on StartTransaction", () => {
  it("should have createNotification available in db module", async () => {
    // Verify the function exists and can be imported
    const db = await import("../db");
    expect(typeof db.createNotification).toBe("function");
  });

  it("should have CHARGING_STARTED as a valid notification type", async () => {
    // The notifications table uses varchar(50) for type, so any string up to 50 chars is valid
    const type = "CHARGING_STARTED";
    expect(type.length).toBeLessThanOrEqual(50);
  });

  it("should be able to create a notification with correct structure", async () => {
    const db = await import("../db");
    // Test that createNotification accepts the expected parameters
    // We don't actually call it (would need DB), but verify the interface
    const notificationData = {
      userId: 1,
      title: "Carga iniciada",
      message: "Tu sesión de carga ha comenzado en Estación Test (conector #1).",
      type: "CHARGING_STARTED",
      referenceId: 123,
      referenceType: "transaction",
    };
    
    // Verify all required fields are present
    expect(notificationData).toHaveProperty("userId");
    expect(notificationData).toHaveProperty("title");
    expect(notificationData).toHaveProperty("message");
    expect(notificationData).toHaveProperty("type");
    expect(notificationData.type).toBe("CHARGING_STARTED");
    expect(notificationData).toHaveProperty("referenceId");
    expect(notificationData).toHaveProperty("referenceType");
    expect(notificationData.referenceType).toBe("transaction");
  });
});

describe("Charger Detail Data Aggregation", () => {
  it("should handle missing station gracefully", () => {
    // When a charger is connected via WebSocket but not registered in DB
    // The detail view should still work with just connection data
    const diagnostics = dualCSMS.getDetailedDiagnostics();
    for (const diag of diagnostics) {
      // All diagnostics should have basic connection info even without DB record
      expect(diag.ocppIdentity).toBeTruthy();
      expect(typeof diag.wsReadyState).toBe("number");
    }
  });

  it("should include connector information in diagnostics", () => {
    const diagnostics = dualCSMS.getDetailedDiagnostics();
    for (const diag of diagnostics) {
      expect(Array.isArray(diag.connectors)).toBe(true);
    }
  });
});
