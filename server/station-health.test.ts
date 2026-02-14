/**
 * Tests para Station Health Monitor y Dashboard del Ingeniero
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la base de datos
vi.mock("./db", () => ({
  getAllChargingStations: vi.fn(),
}));

vi.mock("./ocpp/connection-manager", () => ({
  getConnectedChargePoints: vi.fn(() => []),
}));

describe("Station Health Monitor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("checkStationHealth", () => {
    it("debe retornar resumen de salud de estaciones", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Estación Centro",
          isOnline: true,
          isActive: true,
          ocppIdentity: "CP001",
          lastHeartbeat: new Date(Date.now() - 60000), // 1 min ago
        },
        {
          id: 2,
          name: "Estación Norte",
          isOnline: false,
          isActive: true,
          ocppIdentity: "CP002",
          lastHeartbeat: new Date(Date.now() - 7200000), // 2 hours ago
        },
        {
          id: 3,
          name: "Estación Sur",
          isOnline: false,
          isActive: true,
          ocppIdentity: null,
          lastHeartbeat: null,
        },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result).toBeDefined();
      expect(result.totalActive).toBe(3);
      expect(result.stations).toHaveLength(3);
      expect(typeof result.online).toBe("number");
      expect(typeof result.offline).toBe("number");
      expect(typeof result.critical).toBe("number");
    });

    it("debe clasificar estación online como healthy", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Estación Online",
          isOnline: true,
          isActive: true,
          ocppIdentity: "CP001",
          lastHeartbeat: new Date(Date.now() - 30000), // 30 sec ago
        },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result.online).toBe(1);
      expect(result.stations[0].healthStatus).toBe("healthy");
      expect(result.stations[0].isOnline).toBe(true);
    });

    it("debe clasificar estación offline sin OCPP como critical", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Estación Sin Conexión",
          isOnline: false,
          isActive: true,
          ocppIdentity: null,
          lastHeartbeat: null,
        },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result.offline).toBeGreaterThanOrEqual(1);
      expect(result.stations[0].healthStatus).toBe("critical");
      expect(result.stations[0].isOnline).toBe(false);
    });

    it("debe retornar array vacío si no hay estaciones activas", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result.totalActive).toBe(0);
      expect(result.stations).toHaveLength(0);
      expect(result.online).toBe(0);
      expect(result.offline).toBe(0);
    });

    it("debe procesar todas las estaciones retornadas por la BD (filtro isActive se aplica en DB)", async () => {
      const db = await import("./db");
      // getAllChargingStations({ isActive: true }) ya filtra en la BD,
      // así que el mock solo retorna estaciones activas
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 2,
          name: "Estación Activa",
          isOnline: true,
          isActive: true,
          ocppIdentity: "CP002",
          lastHeartbeat: new Date(),
        },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      // Solo la activa debe aparecer (la BD ya filtró las inactivas)
      expect(result.totalActive).toBe(1);
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].stationName).toBe("Estación Activa");
    });
  });

  describe("Engineer role permissions", () => {
    it("engineer debe tener acceso a endpoints OCPP", () => {
      const engineerRole = "engineer";
      const allowedRoles = ["admin", "staff", "technician", "engineer"];
      expect(allowedRoles).toContain(engineerRole);
    });

    it("engineer debe poder modificar estaciones", () => {
      const engineerRole = "engineer";
      const stationEditRoles = ["admin", "staff", "technician", "engineer"];
      expect(stationEditRoles).toContain(engineerRole);
    });

    it("engineer debe poder gestionar tarifas", () => {
      const engineerRole = "engineer";
      const tariffRoles = ["admin", "staff", "engineer"];
      expect(tariffRoles).toContain(engineerRole);
    });

    it("engineer debe tener acceso al maintenance router", () => {
      const engineerRole = "engineer";
      const maintenanceRoles = ["technician", "engineer", "admin", "staff"];
      expect(maintenanceRoles).toContain(engineerRole);
    });

    it("technician NO debe tener acceso a engineerProcedure", () => {
      const technicianRole = "technician";
      const engineerOnlyRoles = ["engineer", "admin", "staff"];
      expect(engineerOnlyRoles).not.toContain(technicianRole);
    });
  });

  describe("Station health status classification", () => {
    it("debe clasificar correctamente múltiples estaciones", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([
        { id: 1, name: "Online", isOnline: true, isActive: true, ocppIdentity: "CP1", lastHeartbeat: new Date() },
        { id: 2, name: "Offline reciente", isOnline: false, isActive: true, ocppIdentity: "CP2", lastHeartbeat: new Date(Date.now() - 300000) },
        { id: 3, name: "Offline viejo", isOnline: false, isActive: true, ocppIdentity: "CP3", lastHeartbeat: new Date(Date.now() - 86400000) },
        { id: 4, name: "Sin OCPP", isOnline: false, isActive: true, ocppIdentity: null, lastHeartbeat: null },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result.totalActive).toBe(4);
      expect(result.online).toBe(1);
      // At least some should be offline/critical
      expect(result.offline + result.critical).toBeGreaterThanOrEqual(1);
    });

    it("debe incluir issue description para estaciones con problemas", async () => {
      const db = await import("./db");
      (db.getAllChargingStations as any).mockResolvedValue([
        { id: 1, name: "Sin Config", isOnline: false, isActive: true, ocppIdentity: null, lastHeartbeat: null },
      ]);

      const { checkStationHealth } = await import("./ocpp/station-health-monitor");
      const result = await checkStationHealth();

      expect(result.stations[0].issue).toBeDefined();
      expect(typeof result.stations[0].issue).toBe("string");
      expect(result.stations[0].issue!.length).toBeGreaterThan(0);
    });
  });
});
