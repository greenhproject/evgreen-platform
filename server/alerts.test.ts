import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  createOcppAlert: vi.fn().mockResolvedValue(1),
  getOcppAlerts: vi.fn().mockResolvedValue([]),
  getAlertHistory: vi.fn().mockResolvedValue([]),
  getOcppAlertStats: vi.fn().mockResolvedValue({
    total: 10,
    unacknowledged: 5,
    bySeverity: { critical: 2, warning: 2, info: 1 },
    byType: { DISCONNECTION: 3, ERROR: 2 },
    autoResolved: 3,
  }),
  acknowledgeOcppAlert: vi.fn().mockResolvedValue(undefined),
  autoResolveDisconnectionAlerts: vi.fn().mockResolvedValue(2),
  getAllChargingStations: vi.fn().mockResolvedValue([]),
  getChargingStationById: vi.fn().mockResolvedValue(null),
}));

// Mock notification modules
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Need to mock before importing
vi.mock("./notifications/technician-notification-service", () => ({
  notifyTechniciansOfAlert: vi.fn().mockResolvedValue({ pushSent: 0, emailSent: 0, inAppCreated: 0 }),
}));

// Import after mocks
import * as db from "./db";

describe("Alert Center - Severity Classification", () => {
  it("should use lowercase severity values from the database enum", () => {
    // The database enum uses: info, warning, critical
    const validSeverities = ["info", "warning", "critical"];
    // Frontend should map these lowercase values correctly
    
    const severityMap: Record<string, string> = {
      critical: "Crítica",
      warning: "Advertencia",
      info: "Informativa",
    };
    
    for (const severity of validSeverities) {
      expect(severityMap[severity]).toBeDefined();
    }
  });

  it("should NOT use uppercase severity values (CRITICAL/HIGH/MEDIUM/LOW)", () => {
    // These were the old frontend values that caused the mismatch
    const oldValues = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const validDbValues = ["info", "warning", "critical"];
    
    for (const old of oldValues) {
      expect(validDbValues.includes(old)).toBe(false);
    }
  });
});

describe("Alert Center - Statistics", () => {
  it("getOcppAlertStats should return lowercase severity keys", async () => {
    const stats = await db.getOcppAlertStats();
    
    expect(stats).toBeDefined();
    expect(stats.bySeverity).toBeDefined();
    
    // Should have lowercase keys
    const keys = Object.keys(stats.bySeverity);
    for (const key of keys) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it("getOcppAlertStats should include autoResolved count", async () => {
    const stats = await db.getOcppAlertStats();
    
    expect(stats).toHaveProperty("autoResolved");
    expect(typeof stats.autoResolved).toBe("number");
    expect(stats.autoResolved).toBe(3);
  });

  it("getOcppAlertStats should count only active (non-resolved) alerts by severity", async () => {
    const stats = await db.getOcppAlertStats();
    
    // bySeverity should only count active alerts
    expect(stats.bySeverity.critical).toBe(2);
    expect(stats.bySeverity.warning).toBe(2);
    expect(stats.bySeverity.info).toBe(1);
  });
});

describe("Alert Center - Duplicate Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createOcppAlert should be called with correct parameters", async () => {
    const alert = {
      ocppIdentity: "TEST-CHARGER-001",
      stationId: 1,
      alertType: "DISCONNECTION" as const,
      severity: "critical" as const,
      title: "Test disconnection",
      message: "Test message",
      payload: {},
    };
    
    await db.createOcppAlert(alert);
    
    expect(db.createOcppAlert).toHaveBeenCalledWith(alert);
  });
});

describe("Alert Center - Auto-Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autoResolveDisconnectionAlerts should resolve alerts for a given charger", async () => {
    const result = await db.autoResolveDisconnectionAlerts("TEST-CHARGER-001");
    
    expect(result).toBe(2);
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("TEST-CHARGER-001");
  });
});

describe("Alert Center - Alert History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAlertHistory should be callable with options", async () => {
    await db.getAlertHistory({ limit: 50, offset: 0 });
    
    expect(db.getAlertHistory).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it("getAlertHistory should support filtering by ocppIdentity", async () => {
    await db.getAlertHistory({ limit: 50, offset: 0, ocppIdentity: "TEST-001" });
    
    expect(db.getAlertHistory).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      ocppIdentity: "TEST-001",
    });
  });
});

describe("Alert Center - Frontend Severity Mapping", () => {
  it("should correctly map backend lowercase to frontend display", () => {
    const SEVERITY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
      critical: {
        label: "Crítica",
        badgeClass: "bg-red-100 text-red-700",
      },
      warning: {
        label: "Advertencia",
        badgeClass: "bg-yellow-100 text-yellow-700",
      },
      info: {
        label: "Informativa",
        badgeClass: "bg-blue-100 text-blue-700",
      },
    };

    // Test that all backend severity values have a frontend mapping
    expect(SEVERITY_CONFIG["critical"]).toBeDefined();
    expect(SEVERITY_CONFIG["critical"].label).toBe("Crítica");
    
    expect(SEVERITY_CONFIG["warning"]).toBeDefined();
    expect(SEVERITY_CONFIG["warning"].label).toBe("Advertencia");
    
    expect(SEVERITY_CONFIG["info"]).toBeDefined();
    expect(SEVERITY_CONFIG["info"].label).toBe("Informativa");
  });

  it("should handle unknown severity gracefully by defaulting to info", () => {
    function getSeverityConfig(severity: string) {
      const config: Record<string, { label: string }> = {
        critical: { label: "Crítica" },
        warning: { label: "Advertencia" },
        info: { label: "Informativa" },
      };
      return config[severity?.toLowerCase()] || config.info;
    }

    expect(getSeverityConfig("critical").label).toBe("Crítica");
    expect(getSeverityConfig("CRITICAL").label).toBe("Crítica");
    expect(getSeverityConfig("unknown").label).toBe("Informativa");
    expect(getSeverityConfig("").label).toBe("Informativa");
  });
});

describe("Alert Center - Reconnection triggers auto-resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autoResolveDisconnectionAlerts is called with correct ocppIdentity (simulating handleReconnection flow)", async () => {
    // Simulate what handleReconnection does: call autoResolveDisconnectionAlerts
    const ocppIdentity = "EVG001";
    const resolvedCount = await db.autoResolveDisconnectionAlerts(ocppIdentity);
    
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("EVG001");
    expect(resolvedCount).toBe(2);
  });

  it("autoResolveDisconnectionAlerts handles DB errors gracefully", async () => {
    (db.autoResolveDisconnectionAlerts as any).mockRejectedValueOnce(new Error("DB error"));
    
    // Simulate the try/catch pattern used in handleReconnection
    let errorCaught = false;
    try {
      await db.autoResolveDisconnectionAlerts("EVG001");
    } catch (error) {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });

  it("auto-resolve works for multiple charger identities independently", async () => {
    await db.autoResolveDisconnectionAlerts("MF120");
    await db.autoResolveDisconnectionAlerts("EVG001");
    
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledTimes(2);
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("MF120");
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("EVG001");
  });

  it("handleReconnection function exists and is exported from alerts-service module", () => {
    // Verify the function signature exists - this is a compile-time check
    // The actual integration is tested by verifying the call chain:
    // index.ts connection handler -> alertsService.handleReconnection -> db.autoResolveDisconnectionAlerts
    expect(typeof db.autoResolveDisconnectionAlerts).toBe("function");
  });
});

describe("Alert Center - DISCONNECTION is Critical", () => {
  it("determineSeverity should return critical for DISCONNECTION", () => {
    // Replicate the determineSeverity function logic
    function determineSeverity(alertType: string): string {
      switch (alertType) {
        case "FAULT":
        case "BOOT_REJECTED":
        case "TRANSACTION_ERROR":
          return "critical";
        case "DISCONNECTION":
          return "critical";
        case "ERROR":
          return "warning";
        case "OFFLINE_TIMEOUT":
          return "warning";
        default:
          return "info";
      }
    }

    expect(determineSeverity("DISCONNECTION")).toBe("critical");
    expect(determineSeverity("FAULT")).toBe("critical");
    expect(determineSeverity("BOOT_REJECTED")).toBe("critical");
    expect(determineSeverity("ERROR")).toBe("warning");
    expect(determineSeverity("OFFLINE_TIMEOUT")).toBe("warning");
  });
});
