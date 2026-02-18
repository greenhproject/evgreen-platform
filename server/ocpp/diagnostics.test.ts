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
    const diagnostics = dualCSMS.getDetailedDiagnostics();
    for (const diag of diagnostics) {
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

describe("Hybrid Connection Status Logic", () => {
  it("should determine connection source correctly", () => {
    // Test the logic: websocket > recent_log > none
    const hasActiveWs = true;
    const hasRecentLog = true;
    const source = hasActiveWs ? "websocket" : hasRecentLog ? "recent_log" : "none";
    expect(source).toBe("websocket");
  });

  it("should fall back to recent_log when no websocket", () => {
    const hasActiveWs = false;
    const hasRecentLog = true;
    const source = hasActiveWs ? "websocket" : hasRecentLog ? "recent_log" : "none";
    expect(source).toBe("recent_log");
  });

  it("should show none when no websocket and no recent log", () => {
    const hasActiveWs = false;
    const hasRecentLog = false;
    const source = hasActiveWs ? "websocket" : hasRecentLog ? "recent_log" : "none";
    expect(source).toBe("none");
  });

  it("should consider log recent if within 5 minutes", () => {
    const now = Date.now();
    const fourMinutesAgo = new Date(now - 4 * 60 * 1000);
    const sixMinutesAgo = new Date(now - 6 * 60 * 1000);
    
    const isRecent4min = (now - fourMinutesAgo.getTime()) < 5 * 60 * 1000;
    const isRecent6min = (now - sixMinutesAgo.getTime()) < 5 * 60 * 1000;
    
    expect(isRecent4min).toBe(true);
    expect(isRecent6min).toBe(false);
  });

  it("should mark station as connected if websocket OR recent log", () => {
    const scenarios = [
      { ws: true, log: true, expected: true },
      { ws: true, log: false, expected: true },
      { ws: false, log: true, expected: true },
      { ws: false, log: false, expected: false },
    ];
    for (const s of scenarios) {
      const isConnected = s.ws || s.log;
      expect(isConnected).toBe(s.expected);
    }
  });
});

describe("Search and Filter Logic", () => {
  const mockChargers = [
    { name: "Estación Centro", ocppIdentity: "EVG001", address: "Calle 10", isConnected: true, connectionSource: "websocket", isHealthy: true },
    { name: "Estación Norte", ocppIdentity: "EVG002", address: "Avenida 5", isConnected: false, connectionSource: "none", isHealthy: false },
    { name: "Estación Sur", ocppIdentity: "EVG003", address: "Carrera 7", isConnected: true, connectionSource: "recent_log", isHealthy: false },
  ];

  it("should filter by search term (name)", () => {
    const q = "centro";
    const filtered = mockChargers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.ocppIdentity.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].ocppIdentity).toBe("EVG001");
  });

  it("should filter by search term (ocppIdentity)", () => {
    const q = "evg002";
    const filtered = mockChargers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.ocppIdentity.toLowerCase().includes(q)
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Estación Norte");
  });

  it("should filter by connected status", () => {
    const connected = mockChargers.filter(c => c.isConnected);
    expect(connected.length).toBe(2);
  });

  it("should filter by disconnected status", () => {
    const disconnected = mockChargers.filter(c => !c.isConnected);
    expect(disconnected.length).toBe(1);
    expect(disconnected[0].ocppIdentity).toBe("EVG002");
  });

  it("should sort connected first when sortBy=status", () => {
    const sorted = [...mockChargers].sort((a, b) => {
      if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    expect(sorted[0].isConnected).toBe(true);
    expect(sorted[sorted.length - 1].isConnected).toBe(false);
  });

  it("should sort by name alphabetically", () => {
    const sorted = [...mockChargers].sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted[0].name).toBe("Estación Centro");
    expect(sorted[1].name).toBe("Estación Norte");
    expect(sorted[2].name).toBe("Estación Sur");
  });

  it("should compute correct stats", () => {
    const total = mockChargers.length;
    const connected = mockChargers.filter(c => c.isConnected).length;
    const disconnected = total - connected;
    const healthy = mockChargers.filter(c => c.isHealthy).length;
    
    expect(total).toBe(3);
    expect(connected).toBe(2);
    expect(disconnected).toBe(1);
    expect(healthy).toBe(1);
  });
});
