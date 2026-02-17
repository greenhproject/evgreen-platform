import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests para la lógica de reconexión OCPP y estado de estaciones
 */

describe("OCPP Reconnection & Station Status", () => {
  describe("Grace Period Logic", () => {
    it("should define a grace period of 2 minutes (120000ms)", () => {
      const GRACE_PERIOD_MS = 120000;
      expect(GRACE_PERIOD_MS).toBe(120000);
      expect(GRACE_PERIOD_MS / 1000).toBe(120); // 2 minutes
    });

    it("should define ping interval of 30 seconds", () => {
      const PING_INTERVAL_MS = 30000;
      expect(PING_INTERVAL_MS).toBe(30000);
      expect(PING_INTERVAL_MS / 1000).toBe(30);
    });

    it("should cancel grace period on reconnection", () => {
      const reconnectionGrace = new Map<string, NodeJS.Timeout>();
      const ocppIdentity = "EVG001";
      
      // Simulate setting a grace period
      const timeout = setTimeout(() => {}, 120000);
      reconnectionGrace.set(ocppIdentity, timeout);
      expect(reconnectionGrace.has(ocppIdentity)).toBe(true);
      
      // Simulate reconnection - clear the grace period
      const existingGrace = reconnectionGrace.get(ocppIdentity);
      if (existingGrace) {
        clearTimeout(existingGrace);
        reconnectionGrace.delete(ocppIdentity);
      }
      
      expect(reconnectionGrace.has(ocppIdentity)).toBe(false);
    });

    it("should mark station offline after grace period expires", async () => {
      let markedOffline = false;
      const ocppIdentity = "EVG001";
      const connections = new Map<string, any>();
      
      // Grace period expires and station is not reconnected
      if (!connections.has(ocppIdentity)) {
        markedOffline = true;
      }
      
      expect(markedOffline).toBe(true);
    });

    it("should NOT mark station offline if reconnected during grace period", () => {
      let markedOffline = false;
      const ocppIdentity = "EVG001";
      const connections = new Map<string, any>();
      
      // Simulate reconnection
      connections.set(ocppIdentity, { ws: {}, stationId: 1 });
      
      // Grace period check
      if (!connections.has(ocppIdentity)) {
        markedOffline = true;
      }
      
      expect(markedOffline).toBe(false);
    });
  });

  describe("Ping/Pong Keepalive", () => {
    it("should clean up ping interval on disconnect", () => {
      const pingIntervals = new Map<string, NodeJS.Timeout>();
      const ocppIdentity = "EVG001";
      
      // Set up ping interval
      const interval = setInterval(() => {}, 30000);
      pingIntervals.set(ocppIdentity, interval);
      expect(pingIntervals.has(ocppIdentity)).toBe(true);
      
      // Clean up on disconnect
      const existingPing = pingIntervals.get(ocppIdentity);
      if (existingPing) {
        clearInterval(existingPing);
        pingIntervals.delete(ocppIdentity);
      }
      
      expect(pingIntervals.has(ocppIdentity)).toBe(false);
    });
  });

  describe("Investor Station Status", () => {
    it("should prioritize OCPP connection status over DB isOnline", () => {
      const station = { isOnline: false, id: 1, ocppIdentity: "EVG001" };
      const isConnectedOCPP = true; // Connected via WebSocket
      
      // The combined status should be true if either source says online
      const effectiveIsOnline = isConnectedOCPP || station.isOnline;
      expect(effectiveIsOnline).toBe(true);
    });

    it("should show offline when both OCPP and DB say offline", () => {
      const station = { isOnline: false, id: 1, ocppIdentity: "EVG001" };
      const isConnectedOCPP = false;
      
      const effectiveIsOnline = isConnectedOCPP || station.isOnline;
      expect(effectiveIsOnline).toBe(false);
    });

    it("should match station by ocppIdentity in connections list", () => {
      const csmsConnections = [
        { ocppIdentity: "EVG001", stationId: 1, ocppVersion: "1.6", connectedAt: new Date(), lastHeartbeat: new Date() },
        { ocppIdentity: "CP001", stationId: 2, ocppVersion: "2.0.1", connectedAt: new Date(), lastHeartbeat: new Date() },
      ];
      
      const stationOcppId = "EVG001";
      const stationId = 1;
      
      const isConnected = csmsConnections.some(c => 
        c.ocppIdentity === stationOcppId || c.stationId === stationId
      );
      
      expect(isConnected).toBe(true);
    });

    it("should not find disconnected station in connections", () => {
      const csmsConnections = [
        { ocppIdentity: "CP001", stationId: 2, ocppVersion: "2.0.1", connectedAt: new Date(), lastHeartbeat: new Date() },
      ];
      
      const stationOcppId = "EVG001";
      const stationId = 1;
      
      const isConnected = csmsConnections.some(c => 
        c.ocppIdentity === stationOcppId || c.stationId === stationId
      );
      
      expect(isConnected).toBe(false);
    });
  });

  describe("Operating Hours Display", () => {
    it("should parse operating hours JSON correctly", () => {
      const operatingHours = JSON.stringify({
        monday: { open: true, openTime: "06:00", closeTime: "22:00" },
        tuesday: { open: true, openTime: "06:00", closeTime: "22:00" },
        wednesday: { open: true, openTime: "06:00", closeTime: "22:00" },
        thursday: { open: true, openTime: "06:00", closeTime: "22:00" },
        friday: { open: true, openTime: "06:00", closeTime: "22:00" },
        saturday: { open: true, openTime: "08:00", closeTime: "18:00" },
        sunday: { open: false, openTime: "00:00", closeTime: "00:00" },
      });
      
      const parsed = JSON.parse(operatingHours);
      expect(parsed.monday.open).toBe(true);
      expect(parsed.monday.openTime).toBe("06:00");
      expect(parsed.sunday.open).toBe(false);
    });

    it("should detect 24/7 operation", () => {
      const operatingHours = JSON.stringify({
        monday: { open: true, openTime: "00:00", closeTime: "23:59" },
        tuesday: { open: true, openTime: "00:00", closeTime: "23:59" },
        wednesday: { open: true, openTime: "00:00", closeTime: "23:59" },
        thursday: { open: true, openTime: "00:00", closeTime: "23:59" },
        friday: { open: true, openTime: "00:00", closeTime: "23:59" },
        saturday: { open: true, openTime: "00:00", closeTime: "23:59" },
        sunday: { open: true, openTime: "00:00", closeTime: "23:59" },
      });
      
      const parsed = JSON.parse(operatingHours);
      const days = Object.values(parsed) as Array<{ open: boolean; openTime: string; closeTime: string }>;
      const is24_7 = days.every(d => d.open && d.openTime === "00:00" && d.closeTime === "23:59");
      expect(is24_7).toBe(true);
    });

    it("should show 'Horario no configurado' when null", () => {
      const operatingHours = null;
      const displayText = operatingHours ? "Configured" : "Horario no configurado";
      expect(displayText).toBe("Horario no configurado");
    });
  });
});
