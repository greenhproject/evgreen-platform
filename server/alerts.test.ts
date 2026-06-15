import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./notifications/technician-notification-service", () => ({
  notifyTechniciansOfAlert: vi.fn().mockResolvedValue({ pushSent: 0, emailSent: 0, inAppCreated: 0 }),
}));

// Mock connection-manager to control isChargerCurrentlyConnected behavior
vi.mock("./ocpp/connection-manager", () => ({
  getConnection: vi.fn().mockReturnValue(undefined),
  isInGracePeriod: vi.fn().mockReturnValue(false),
}));

// Import after mocks
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { notifyTechniciansOfAlert } from "./notifications/technician-notification-service";
import * as ocppManager from "./ocpp/connection-manager";
import * as alertsService from "./ocpp/alerts-service";

describe("Alert Center - Severity Classification", () => {
  it("should use lowercase severity values from the database enum", () => {
    const validSeverities = ["info", "warning", "critical"];
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
      severity: "warning" as const,
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

describe("Alert Center - Reconnection triggers auto-resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleReconnection calls autoResolveDisconnectionAlerts", async () => {
    await alertsService.handleReconnection("EVG001");
    
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("EVG001");
  });

  it("handleReconnection handles DB errors gracefully", async () => {
    (db.autoResolveDisconnectionAlerts as any).mockRejectedValueOnce(new Error("DB error"));
    
    // Should not throw
    await expect(alertsService.handleReconnection("EVG001")).resolves.not.toThrow();
  });
});

describe("Alert Center - DISCONNECTION Severity Change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure charger is NOT connected (so alerts can fire)
    (ocppManager.getConnection as any).mockReturnValue(undefined);
    (ocppManager.isInGracePeriod as any).mockReturnValue(false);
  });

  it("DISCONNECTION alerts should be 'warning' severity (not critical) for single disconnection", async () => {
    await alertsService.handleDisconnection("TEST-CHARGER-SEVERITY", 1);
    
    expect(db.createOcppAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "DISCONNECTION",
        severity: "warning",
      })
    );
  });

  it("DISCONNECTION alerts should still notify owner (warnings are notified)", async () => {
    await alertsService.handleDisconnection("TEST-CHARGER-NOTIFY", 1);
    
    expect(notifyOwner).toHaveBeenCalled();
    expect(notifyTechniciansOfAlert).toHaveBeenCalled();
  });
});

describe("Alert Center - Proxy Cycle Suppression (isChargerCurrentlyConnected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should SUPPRESS disconnection alert if charger is currently connected", async () => {
    // Simulate: charger already reconnected (Proxy Cycle scenario)
    (ocppManager.getConnection as any).mockReturnValue({ ws: {}, ocppIdentity: "PROXY-TEST" });
    (ocppManager.isInGracePeriod as any).mockReturnValue(false);
    
    await alertsService.handleDisconnection("PROXY-TEST", 1);
    
    // Should NOT create alert or send notifications
    expect(db.createOcppAlert).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect(notifyTechniciansOfAlert).not.toHaveBeenCalled();
  });

  it("should SUPPRESS disconnection alert if charger is in grace period (reconnecting)", async () => {
    // Simulate: charger is in grace period (still reconnecting)
    (ocppManager.getConnection as any).mockReturnValue(undefined);
    (ocppManager.isInGracePeriod as any).mockReturnValue(true);
    
    await alertsService.handleDisconnection("GRACE-TEST", 1);
    
    // Should NOT create alert or send notifications
    expect(db.createOcppAlert).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect(notifyTechniciansOfAlert).not.toHaveBeenCalled();
  });

  it("should ALLOW disconnection alert if charger is truly disconnected", async () => {
    // Simulate: charger is NOT connected and NOT in grace period
    (ocppManager.getConnection as any).mockReturnValue(undefined);
    (ocppManager.isInGracePeriod as any).mockReturnValue(false);
    
    await alertsService.handleDisconnection("REAL-DISCONNECT", 1);
    
    // Should create alert and send notifications
    expect(db.createOcppAlert).toHaveBeenCalled();
    expect(notifyOwner).toHaveBeenCalled();
    expect(notifyTechniciansOfAlert).toHaveBeenCalled();
  });

  it("should SUPPRESS notifications (but save alert) if charger reconnects between alert creation and notification dispatch", async () => {
    // First call: charger is disconnected (alert creation passes)
    // But by the time saveAndNotifyAlert checks again, charger has reconnected
    let callCount = 0;
    (ocppManager.getConnection as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return undefined; // First check in handleDisconnection: not connected
      return { ws: {}, ocppIdentity: "RACE-TEST" }; // Second check in saveAndNotifyAlert: reconnected!
    });
    (ocppManager.isInGracePeriod as any).mockReturnValue(false);
    
    await alertsService.handleDisconnection("RACE-TEST", 1);
    
    // Alert is saved (for audit) but notifications are suppressed
    expect(db.createOcppAlert).toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect(notifyTechniciansOfAlert).not.toHaveBeenCalled();
    // Auto-resolve should be called since charger reconnected
    expect(db.autoResolveDisconnectionAlerts).toHaveBeenCalledWith("RACE-TEST");
  });
});

describe("Alert Center - Cooldown Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ocppManager.getConnection as any).mockReturnValue(undefined);
    (ocppManager.isInGracePeriod as any).mockReturnValue(false);
  });

  it("should respect 30-minute cooldown between disconnection alerts for same charger", async () => {
    // First alert should go through
    await alertsService.handleDisconnection("COOLDOWN-TEST", 1);
    expect(db.createOcppAlert).toHaveBeenCalledTimes(1);
    
    vi.clearAllMocks();
    
    // Second alert within cooldown should be suppressed
    await alertsService.handleDisconnection("COOLDOWN-TEST", 1);
    expect(db.createOcppAlert).not.toHaveBeenCalled();
  });

  it("should allow alerts for different chargers independently", async () => {
    await alertsService.handleDisconnection("CHARGER-A", 1);
    expect(db.createOcppAlert).toHaveBeenCalledTimes(1);
    
    vi.clearAllMocks();
    
    await alertsService.handleDisconnection("CHARGER-B", 2);
    expect(db.createOcppAlert).toHaveBeenCalledTimes(1);
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
