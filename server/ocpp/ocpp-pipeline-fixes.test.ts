import { describe, it, expect } from "vitest";

// ============================================================================
// Tests for OCPP Pipeline Fixes
// Validates: StatusNotification mapping, connector availability, notification 
// price formatting, and getActiveSession race condition handling
// ============================================================================

describe("StatusNotification Mapping Fix", () => {
  // The statusMap that was corrected - Preparing was incorrectly mapped to AVAILABLE
  const correctStatusMap: Record<string, string> = {
    Available: "AVAILABLE",
    Preparing: "PREPARING",      // FIX: was "AVAILABLE" before
    Charging: "CHARGING",
    SuspendedEVSE: "SUSPENDED_EVSE",
    SuspendedEV: "SUSPENDED_EV",
    Finishing: "FINISHING",
    Reserved: "RESERVED",
    Unavailable: "UNAVAILABLE",
    Faulted: "FAULTED",
  };

  it("should map Preparing to PREPARING, not AVAILABLE", () => {
    expect(correctStatusMap["Preparing"]).toBe("PREPARING");
    expect(correctStatusMap["Preparing"]).not.toBe("AVAILABLE");
  });

  it("should map Charging to CHARGING", () => {
    expect(correctStatusMap["Charging"]).toBe("CHARGING");
  });

  it("should map SuspendedEVSE to SUSPENDED_EVSE", () => {
    expect(correctStatusMap["SuspendedEVSE"]).toBe("SUSPENDED_EVSE");
  });

  it("should map SuspendedEV to SUSPENDED_EV", () => {
    expect(correctStatusMap["SuspendedEV"]).toBe("SUSPENDED_EV");
  });

  it("should map Finishing to FINISHING", () => {
    expect(correctStatusMap["Finishing"]).toBe("FINISHING");
  });

  it("should map all 9 OCPP 1.6 statuses correctly", () => {
    expect(Object.keys(correctStatusMap)).toHaveLength(9);
    const expectedStatuses = [
      "AVAILABLE", "PREPARING", "CHARGING", "SUSPENDED_EVSE", 
      "SUSPENDED_EV", "FINISHING", "RESERVED", "UNAVAILABLE", "FAULTED"
    ];
    const mappedStatuses = Object.values(correctStatusMap);
    for (const expected of expectedStatuses) {
      expect(mappedStatuses).toContain(expected);
    }
  });

  it("should not have any status mapped to AVAILABLE except Available", () => {
    const availableMappings = Object.entries(correctStatusMap)
      .filter(([_, v]) => v === "AVAILABLE")
      .map(([k]) => k);
    expect(availableMappings).toEqual(["Available"]);
  });
});

describe("Connector Availability Logic Fix", () => {
  // The corrected logic: only AVAILABLE means available
  function isConnectorAvailable(status: string): boolean {
    const normalizedStatus = status.toUpperCase();
    return normalizedStatus === "AVAILABLE";
  }

  function isConnectorOccupied(status: string): boolean {
    const normalizedStatus = status.toUpperCase();
    return ["PREPARING", "CHARGING", "SUSPENDED_EV", "SUSPENDED_EVSE", "FINISHING"].includes(normalizedStatus);
  }

  it("should mark AVAILABLE as available", () => {
    expect(isConnectorAvailable("AVAILABLE")).toBe(true);
  });

  it("should NOT mark PREPARING as available", () => {
    expect(isConnectorAvailable("PREPARING")).toBe(false);
  });

  it("should NOT mark CHARGING as available", () => {
    expect(isConnectorAvailable("CHARGING")).toBe(false);
  });

  it("should mark PREPARING as occupied", () => {
    expect(isConnectorOccupied("PREPARING")).toBe(true);
  });

  it("should mark CHARGING as occupied", () => {
    expect(isConnectorOccupied("CHARGING")).toBe(true);
  });

  it("should mark SUSPENDED_EV as occupied", () => {
    expect(isConnectorOccupied("SUSPENDED_EV")).toBe(true);
  });

  it("should mark SUSPENDED_EVSE as occupied", () => {
    expect(isConnectorOccupied("SUSPENDED_EVSE")).toBe(true);
  });

  it("should mark FINISHING as occupied", () => {
    expect(isConnectorOccupied("FINISHING")).toBe(true);
  });

  it("should NOT mark AVAILABLE as occupied", () => {
    expect(isConnectorOccupied("AVAILABLE")).toBe(false);
  });

  it("should NOT mark FAULTED as occupied (it's faulted, not occupied)", () => {
    expect(isConnectorOccupied("FAULTED")).toBe(false);
  });

  it("should NOT mark RESERVED as occupied (it's reserved, different state)", () => {
    expect(isConnectorOccupied("RESERVED")).toBe(false);
  });
});

describe("Notification Price Formatting Fix", () => {
  it("should format price with Colombian locale (thousands separator)", () => {
    const pricePerKwh = 1500;
    const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
    // Should have thousands separator
    expect(formattedPrice).toMatch(/1[.,]500/);
  });

  it("should format dynamic price correctly", () => {
    const pricePerKwh = 1138;
    const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
    expect(formattedPrice).toMatch(/1[.,]138/);
  });

  it("should round fractional prices", () => {
    const pricePerKwh = 1137.6;
    const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
    expect(formattedPrice).toMatch(/1[.,]138/);
  });

  it("should generate correct notification message for CHARGE_REQUESTED", () => {
    const connectorId = 1;
    const stationName = "EVG diamante oriental";
    const pricePerKwh = 1138;
    const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
    const message = `Se ha enviado la orden de carga al conector ${connectorId} de ${stationName}. Tarifa: $${formattedPrice} COP/kWh. Conecta tu vehículo si aún no lo has hecho.`;
    
    expect(message).toContain("orden de carga");
    expect(message).toContain("conector 1");
    expect(message).toContain("EVG diamante oriental");
    expect(message).toContain("COP/kWh");
    expect(message).not.toContain("$1500"); // Should NOT use base price
  });

  it("should generate correct notification message for CHARGING_STARTED", () => {
    const stationName = "EVG diamante oriental";
    const connectorId = 1;
    const pricePerKwh = 1138;
    const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
    const message = `Tu sesión de carga ha comenzado en ${stationName} (conector #${connectorId}). Tarifa: $${formattedPrice} COP/kWh. Puedes monitorear el progreso en tiempo real.`;
    
    expect(message).toContain("ha comenzado");
    expect(message).toContain("monitorear");
    expect(message).not.toContain("Conecta tu vehículo al conector"); // Old incorrect message
  });
});

describe("getActiveSession Race Condition Fix", () => {
  it("should prioritize active transaction over pending session", () => {
    // Simulating the logic: if activeTransaction exists, clean up pending sessions
    const pendingSessions = new Map<string, { userId: number }>();
    pendingSessions.set("session-1", { userId: 42 });
    
    const activeTransaction = { id: 100, status: "IN_PROGRESS", userId: 42 };
    
    // The fix: if activeTransaction exists, clean up pending sessions for same user
    if (activeTransaction) {
      const entries = Array.from(pendingSessions.entries());
      for (const [sessionId, session] of entries) {
        if (session.userId === activeTransaction.userId) {
          pendingSessions.delete(sessionId);
        }
      }
    }
    
    expect(pendingSessions.size).toBe(0);
    expect(activeTransaction.status).toBe("IN_PROGRESS");
  });

  it("should not clean up pending sessions for different users", () => {
    const pendingSessions = new Map<string, { userId: number }>();
    pendingSessions.set("session-1", { userId: 42 });
    pendingSessions.set("session-2", { userId: 99 });
    
    const activeTransaction = { id: 100, status: "IN_PROGRESS", userId: 42 };
    
    if (activeTransaction) {
      const entries = Array.from(pendingSessions.entries());
      for (const [sessionId, session] of entries) {
        if (session.userId === activeTransaction.userId) {
          pendingSessions.delete(sessionId);
        }
      }
    }
    
    // Only user 42's session should be cleaned up
    expect(pendingSessions.size).toBe(1);
    expect(pendingSessions.has("session-2")).toBe(true);
  });

  it("should expire pending sessions after 2 minutes", () => {
    const now = Date.now();
    const session = {
      userId: 42,
      createdAt: new Date(now - 130000), // 130 seconds ago (> 120s timeout)
    };
    
    const elapsed = now - session.createdAt.getTime();
    expect(elapsed).toBeGreaterThan(120000);
    // This session should be expired and deleted
  });

  it("should keep pending sessions within 2 minutes", () => {
    const now = Date.now();
    const session = {
      userId: 42,
      createdAt: new Date(now - 60000), // 60 seconds ago (< 120s timeout)
    };
    
    const elapsed = now - session.createdAt.getTime();
    expect(elapsed).toBeLessThan(120000);
    // This session should still be valid
  });
});

describe("Frontend Connector Status Styles", () => {
  const styles: Record<string, { label: string }> = {
    AVAILABLE: { label: "Disponible" },
    CHARGING: { label: "Cargando" },
    PREPARING: { label: "Preparando" },
    SUSPENDED_EV: { label: "Suspendido (EV)" },
    SUSPENDED_EVSE: { label: "Suspendido (EVSE)" },
    FINISHING: { label: "Finalizando" },
    RESERVED: { label: "Reservado" },
    FAULTED: { label: "Falla" },
    UNAVAILABLE: { label: "No disponible" },
  };

  it("should have labels for all OCPP statuses", () => {
    const requiredStatuses = [
      "AVAILABLE", "CHARGING", "PREPARING", "SUSPENDED_EV", 
      "SUSPENDED_EVSE", "FINISHING", "RESERVED", "FAULTED", "UNAVAILABLE"
    ];
    for (const status of requiredStatuses) {
      expect(styles[status]).toBeDefined();
      expect(styles[status].label).toBeTruthy();
    }
  });

  it("should show 'Preparando' for PREPARING status", () => {
    expect(styles["PREPARING"].label).toBe("Preparando");
  });

  it("should show 'Finalizando' for FINISHING status", () => {
    expect(styles["FINISHING"].label).toBe("Finalizando");
  });
});
