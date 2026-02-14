import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getAllChargingStations: vi.fn(),
  getOcppAlerts: vi.fn(),
  createOcppAlert: vi.fn(),
}));

vi.mock("./notifications/technician-notification-service", () => ({
  notifyTechniciansOfAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { checkStationHealth, StationHealthStatus } from "./ocpp/station-health-monitor";

describe("Station Health Monitor - Map Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkStationHealth returns coordinates", () => {
    it("should include latitude and longitude for each station", async () => {
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Estación Mosquera",
          ocppIdentity: "CP001",
          isOnline: true,
          isActive: true,
          lastBootNotification: new Date(),
          latitude: "4.70770000",
          longitude: "-74.23110000",
          address: "Cra 1 Este No 2-26",
          city: "Mosquera",
        },
        {
          id: 2,
          name: "Estación Bogotá",
          ocppIdentity: "CP002",
          isOnline: false,
          isActive: true,
          lastBootNotification: null,
          latitude: "4.71100000",
          longitude: "-74.07210000",
          address: "Calle 85",
          city: "Bogotá",
        },
      ]);

      const result = await checkStationHealth();

      expect(result.stations).toHaveLength(2);
      
      // First station - online with coordinates
      expect(result.stations[0].latitude).toBe(4.7077);
      expect(result.stations[0].longitude).toBe(-74.2311);
      expect(result.stations[0].address).toBe("Cra 1 Este No 2-26");
      expect(result.stations[0].city).toBe("Mosquera");
      expect(result.stations[0].healthStatus).toBe("healthy");
      
      // Second station - offline/critical with coordinates
      expect(result.stations[1].latitude).toBe(4.711);
      expect(result.stations[1].longitude).toBe(-74.0721);
      expect(result.stations[1].address).toBe("Calle 85");
      expect(result.stations[1].city).toBe("Bogotá");
      expect(result.stations[1].healthStatus).toBe("critical");
    });

    it("should handle stations without coordinates (null lat/lng)", async () => {
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 3,
          name: "Estación Sin Coords",
          ocppIdentity: "CP003",
          isOnline: true,
          isActive: true,
          lastBootNotification: new Date(),
          latitude: null,
          longitude: null,
        },
      ]);

      const result = await checkStationHealth();

      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].latitude).toBeNull();
      expect(result.stations[0].longitude).toBeNull();
      expect(result.stations[0].address).toBeUndefined();
    });

    it("should correctly parse string coordinates to numbers", async () => {
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Test Station",
          ocppIdentity: "CP001",
          isOnline: true,
          isActive: true,
          lastBootNotification: new Date(),
          latitude: "4.70770000",
          longitude: "-74.23110000",
        },
      ]);

      const result = await checkStationHealth();

      expect(typeof result.stations[0].latitude).toBe("number");
      expect(typeof result.stations[0].longitude).toBe("number");
      expect(result.stations[0].latitude).toBeCloseTo(4.7077, 4);
      expect(result.stations[0].longitude).toBeCloseTo(-74.2311, 4);
    });

    it("should classify online stations as healthy", async () => {
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 1,
          name: "Online Station",
          ocppIdentity: "CP001",
          isOnline: true,
          isActive: true,
          lastBootNotification: new Date(),
          latitude: "4.7077",
          longitude: "-74.2311",
        },
      ]);

      const result = await checkStationHealth();
      expect(result.stations[0].healthStatus).toBe("healthy");
      expect(result.online).toBe(1);
      expect(result.offline).toBe(0);
    });

    it("should classify never-connected stations as critical", async () => {
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 2,
          name: "Never Connected",
          ocppIdentity: null,
          isOnline: false,
          isActive: true,
          lastBootNotification: null,
          latitude: "4.711",
          longitude: "-74.072",
        },
      ]);

      const result = await checkStationHealth();
      expect(result.stations[0].healthStatus).toBe("critical");
      expect(result.stations[0].issue).toContain("nunca se ha conectado");
      expect(result.critical).toBe(1);
    });

    it("should classify recently disconnected stations as warning", async () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 3,
          name: "Recently Disconnected",
          ocppIdentity: "CP003",
          isOnline: false,
          isActive: true,
          lastBootNotification: thirtyMinutesAgo,
          latitude: "4.65",
          longitude: "-74.10",
        },
      ]);

      const result = await checkStationHealth();
      expect(result.stations[0].healthStatus).toBe("warning");
      expect(result.stations[0].issue).toContain("Desconectada recientemente");
    });

    it("should classify long-offline stations as critical", async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      (db.getAllChargingStations as any).mockResolvedValue([
        {
          id: 4,
          name: "Long Offline",
          ocppIdentity: "CP004",
          isOnline: false,
          isActive: true,
          lastBootNotification: twoDaysAgo,
          latitude: "4.60",
          longitude: "-74.05",
        },
      ]);

      const result = await checkStationHealth();
      expect(result.stations[0].healthStatus).toBe("critical");
      expect(result.stations[0].issue).toContain("Sin conexión por más de");
      expect(result.critical).toBe(1);
    });

    it("should return correct summary counts", async () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000);
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      (db.getAllChargingStations as any).mockResolvedValue([
        { id: 1, name: "Online 1", isOnline: true, isActive: true, lastBootNotification: new Date(), latitude: "4.7", longitude: "-74.2" },
        { id: 2, name: "Online 2", isOnline: true, isActive: true, lastBootNotification: new Date(), latitude: "4.8", longitude: "-74.1" },
        { id: 3, name: "Warning", isOnline: false, isActive: true, lastBootNotification: recentDate, latitude: "4.6", longitude: "-74.0" },
        { id: 4, name: "Critical", isOnline: false, isActive: true, lastBootNotification: null, latitude: "4.5", longitude: "-73.9" },
      ]);

      const result = await checkStationHealth();
      expect(result.totalActive).toBe(4);
      expect(result.online).toBe(2);
      expect(result.offline).toBe(2);
      expect(result.critical).toBe(1);
    });
  });

  describe("StationHealthStatus interface", () => {
    it("should have all required fields for map rendering", () => {
      const status: StationHealthStatus = {
        stationId: 1,
        stationName: "Test",
        ocppIdentity: "CP001",
        isOnline: true,
        isActive: true,
        lastBootNotification: new Date(),
        healthStatus: "healthy",
        latitude: 4.7077,
        longitude: -74.2311,
        address: "Cra 1",
        city: "Mosquera",
      };

      expect(status.latitude).toBeDefined();
      expect(status.longitude).toBeDefined();
      expect(status.address).toBeDefined();
      expect(status.city).toBeDefined();
      expect(status.healthStatus).toBe("healthy");
    });
  });
});
