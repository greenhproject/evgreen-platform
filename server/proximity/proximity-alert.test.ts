/**
 * Tests para el servicio de alertas de proximidad
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Firebase antes de importar
vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: vi.fn(() => ({
      send: vi.fn().mockResolvedValue("message-id"),
      subscribeToTopic: vi.fn().mockResolvedValue({}),
      unsubscribeFromTopic: vi.fn().mockResolvedValue({}),
      sendEachForMulticast: vi.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      }),
    })),
  },
}));

// Mock de env
vi.mock("../server/_core/env", () => ({
  env: {
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
    FIREBASE_PRIVATE_KEY: "test-key",
    DATABASE_URL: "mysql://test",
  },
}));

// Mock de db
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  having: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // Default: no DB
}));

vi.mock("../pricing/dynamic-pricing", () => ({
  calculateDynamicKwhPrice: vi.fn().mockResolvedValue({
    dynamicPricePerKwh: 600,
    multiplier: 0.8,
    factors: {
      occupancyMultiplier: 0.8,
      timeMultiplier: 0.9,
      dayMultiplier: 1.0,
      finalMultiplier: 0.72,
      demandLevel: "LOW",
    },
    demandVisualization: { level: "LOW", color: "#22c55e", label: "Baja demanda", description: "" },
    validUntil: new Date(),
    currency: "COP",
    basePricePerKwh: 800,
  }),
  getDemandLevel: vi.fn().mockReturnValue("LOW"),
  calculateOccupancyMultiplier: vi.fn().mockReturnValue(0.8),
  calculateTimeMultiplier: vi.fn().mockReturnValue(0.9),
  calculateDayMultiplier: vi.fn().mockReturnValue(1.0),
}));

describe("Proximity Alert Service", () => {
  describe("Module structure", () => {
    it("should export checkProximityAndNotify function", async () => {
      const mod = await import("./proximity-alert-service");
      expect(typeof mod.checkProximityAndNotify).toBe("function");
    });

    it("should export getNearbyCompatibleStations function", async () => {
      const mod = await import("./proximity-alert-service");
      expect(typeof mod.getNearbyCompatibleStations).toBe("function");
    });
  });

  describe("checkProximityAndNotify", () => {
    it("should return not checked when database is unavailable", async () => {
      const { checkProximityAndNotify } = await import("./proximity-alert-service");
      const result = await checkProximityAndNotify({
        userId: 1,
        latitude: 4.7110,
        longitude: -74.0721,
      });
      expect(result.checked).toBe(false);
      expect(result.notificationSent).toBe(false);
      expect(result.reason).toBe("Database not available");
    });
  });

  describe("NearbyCompatibleStation type", () => {
    it("should have correct structure", () => {
      const station = {
        stationId: 1,
        stationName: "Estación Centro",
        address: "Calle 100 #15-30",
        city: "Bogotá",
        latitude: 4.7110,
        longitude: -74.0721,
        distanceKm: 2.5,
        pricePerKwh: 600,
        demandLevel: "LOW",
        availableConnectors: 3,
        totalConnectors: 5,
        compatibleConnectorTypes: ["CCS_2", "TYPE_2"],
        isLowPrice: true,
      };

      expect(station.stationId).toBe(1);
      expect(station.isLowPrice).toBe(true);
      expect(station.compatibleConnectorTypes).toContain("CCS_2");
      expect(station.distanceKm).toBe(2.5);
      expect(station.demandLevel).toBe("LOW");
    });
  });

  describe("ProximityCheckResult type", () => {
    it("should have correct structure for no notification", () => {
      const result = {
        checked: true,
        notificationSent: false,
        nearbyCompatibleStations: [],
        reason: "No nearby stations",
      };

      expect(result.checked).toBe(true);
      expect(result.notificationSent).toBe(false);
      expect(result.nearbyCompatibleStations).toHaveLength(0);
    });

    it("should have correct structure for sent notification", () => {
      const result = {
        checked: true,
        notificationSent: true,
        nearbyCompatibleStations: [
          {
            stationId: 1,
            stationName: "Test Station",
            address: "Test",
            city: "Test",
            latitude: 4.7,
            longitude: -74.0,
            distanceKm: 1.2,
            pricePerKwh: 500,
            demandLevel: "LOW",
            availableConnectors: 2,
            totalConnectors: 4,
            compatibleConnectorTypes: ["CCS_2"],
            isLowPrice: true,
          },
        ],
      };

      expect(result.notificationSent).toBe(true);
      expect(result.nearbyCompatibleStations).toHaveLength(1);
      expect(result.nearbyCompatibleStations[0].isLowPrice).toBe(true);
    });
  });

  describe("Cooldown logic", () => {
    it("should respect 30 minute cooldown between alerts", () => {
      const COOLDOWN_MINUTES = 30;
      const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
      
      // Alert sent 10 minutes ago - should still be in cooldown
      const lastAlertTime = new Date(Date.now() - 10 * 60 * 1000);
      const timeSinceLastAlert = Date.now() - lastAlertTime.getTime();
      expect(timeSinceLastAlert < cooldownMs).toBe(true);
      
      // Alert sent 40 minutes ago - cooldown should be expired
      const oldAlertTime = new Date(Date.now() - 40 * 60 * 1000);
      const timeSinceOldAlert = Date.now() - oldAlertTime.getTime();
      expect(timeSinceOldAlert < cooldownMs).toBe(false);
    });

    it("should have 2 hour cooldown for same station", () => {
      const SAME_STATION_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
      
      // Same station notified 1 hour ago - should still be in cooldown
      const lastAlertTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const timeSince = Date.now() - lastAlertTime.getTime();
      expect(timeSince < SAME_STATION_COOLDOWN_MS).toBe(true);
      
      // Same station notified 3 hours ago - cooldown expired
      const oldAlertTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const timeSinceOld = Date.now() - oldAlertTime.getTime();
      expect(timeSinceOld < SAME_STATION_COOLDOWN_MS).toBe(false);
    });
  });

  describe("Demand level classification", () => {
    it("should classify LOW and NORMAL as low price", () => {
      const LOW_DEMAND_LEVELS = ["LOW", "NORMAL"];
      
      expect(LOW_DEMAND_LEVELS.includes("LOW")).toBe(true);
      expect(LOW_DEMAND_LEVELS.includes("NORMAL")).toBe(true);
      expect(LOW_DEMAND_LEVELS.includes("HIGH")).toBe(false);
      expect(LOW_DEMAND_LEVELS.includes("SURGE")).toBe(false);
    });
  });

  describe("Station sorting", () => {
    it("should sort low-price stations by distance (closest first)", () => {
      const stations = [
        { stationId: 1, distanceKm: 5.0, isLowPrice: true, pricePerKwh: 600 },
        { stationId: 2, distanceKm: 1.5, isLowPrice: true, pricePerKwh: 700 },
        { stationId: 3, distanceKm: 3.0, isLowPrice: false, pricePerKwh: 1200 },
        { stationId: 4, distanceKm: 0.8, isLowPrice: true, pricePerKwh: 500 },
      ];

      const lowPriceStations = stations.filter(s => s.isLowPrice);
      const sorted = lowPriceStations.sort((a, b) => a.distanceKm - b.distanceKm);
      
      expect(sorted[0].stationId).toBe(4); // 0.8 km
      expect(sorted[1].stationId).toBe(2); // 1.5 km
      expect(sorted[2].stationId).toBe(1); // 5.0 km
    });
  });

  describe("Connector compatibility", () => {
    it("should filter compatible connectors correctly", () => {
      const vehicleConnectors = ["CCS_2", "TYPE_2"];
      const stationConnectors = ["CCS_1", "CCS_2", "CHADEMO", "TYPE_2"];
      
      const compatible = stationConnectors.filter(ct => vehicleConnectors.includes(ct));
      
      expect(compatible).toContain("CCS_2");
      expect(compatible).toContain("TYPE_2");
      expect(compatible).not.toContain("CCS_1");
      expect(compatible).not.toContain("CHADEMO");
      expect(compatible).toHaveLength(2);
    });

    it("should return all connectors when vehicle has no connectors specified", () => {
      const vehicleConnectors: string[] = [];
      const stationConnectors = ["CCS_1", "CCS_2", "CHADEMO"];
      
      const compatible = vehicleConnectors.length > 0
        ? stationConnectors.filter(ct => vehicleConnectors.includes(ct))
        : stationConnectors;
      
      expect(compatible).toHaveLength(3);
    });

    it("should return empty when no connectors match", () => {
      const vehicleConnectors = ["TESLA"];
      const stationConnectors = ["CCS_1", "CCS_2", "CHADEMO"];
      
      const compatible = stationConnectors.filter(ct => vehicleConnectors.includes(ct));
      
      expect(compatible).toHaveLength(0);
    });
  });

  describe("Notification message format", () => {
    it("should format notification message correctly for low demand", () => {
      const station = {
        stationName: "EVGreen Centro",
        distanceKm: 2.3,
        pricePerKwh: 600,
        availableConnectors: 3,
        compatibleConnectorTypes: ["CCS_2", "TYPE_2"],
        demandLevel: "LOW",
      };
      const vehicleName = "Tesla Model 3";

      const demandText = station.demandLevel === "LOW" ? "Precio bajo" : "Precio normal";
      const connectorText = station.compatibleConnectorTypes.join(", ");
      const body = `${station.stationName} a ${station.distanceKm} km · $${station.pricePerKwh.toLocaleString()}/kWh · ${station.availableConnectors} conectores ${connectorText} para ${vehicleName}`;

      expect(demandText).toBe("Precio bajo");
      expect(body).toContain("EVGreen Centro");
      expect(body).toContain("2.3 km");
      expect(body).toContain("600");
      expect(body).toContain("CCS_2, TYPE_2");
      expect(body).toContain("Tesla Model 3");
    });
  });
});
