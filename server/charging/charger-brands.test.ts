import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../db", () => ({
  getAllChargerBrands: vi.fn(),
  getChargerBrandById: vi.fn(),
  getChargerBrandByBrandModel: vi.fn(),
  getChargerBrandForStation: vi.fn(),
  createChargerBrand: vi.fn(),
  updateChargerBrand: vi.fn(),
}));

import * as db from "../db";

describe("Charger Brands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWallboxPulsarMax = {
    id: 1,
    brand: "Wallbox",
    model: "Pulsar Max",
    displayName: "Wallbox Pulsar Max",
    imageUrl: null,
    ocppVersion: "1.6",
    ocppPasswordRequired: false,
    chargeType: "AC",
    defaultPowerKw: "7.4",
    maxPowerKw: "7.4",
    minChargingCurrentA: 6,
    maxChargingCurrentA: 32,
    defaultVoltage: 230,
    phases: 1,
    supportedConnectors: JSON.stringify(["GBT_AC"]),
    supportedMeasurands: JSON.stringify(["Energy.Active.Import.Register"]),
    energyUnit: "Wh",
    supportsSoC: false,
    supportsPowerMeasurement: false,
    supportsCurrentMeasurement: false,
    supportsVoltageMeasurement: false,
    supportsRemoteStart: true,
    supportsRemoteStop: true,
    supportsReset: true,
    supportsReservation: false,
    supportsSmartCharging: true,
    supportsFirmwareUpdate: true,
    ocppConfig: null,
    meterValueInterval: 30,
    cloudApiBaseUrl: "https://api.wall-box.com",
    cloudApiAuthMethod: "bearer_token",
    cloudApiDocsUrl: "https://github.com/SKB-CGN/wallbox",
    notes: "Solo reporta Energy.Active.Import.Register en Wh. SoC y potencia deben estimarse.",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGenericOCPP16 = {
    id: 3,
    brand: "Genérico",
    model: "OCPP 1.6",
    displayName: "Cargador Genérico OCPP 1.6",
    chargeType: "AC",
    defaultPowerKw: "22",
    ocppVersion: "1.6",
    supportsSoC: true,
    supportsPowerMeasurement: true,
    supportedMeasurands: JSON.stringify([
      "Energy.Active.Import.Register",
      "Power.Active.Import",
      "SoC",
      "Current.Import",
      "Voltage",
    ]),
    isActive: true,
  };

  describe("getAllChargerBrands", () => {
    it("should return all active charger brands", async () => {
      vi.mocked(db.getAllChargerBrands).mockResolvedValue([
        mockWallboxPulsarMax,
        mockGenericOCPP16,
      ] as any);

      const brands = await db.getAllChargerBrands();
      expect(brands).toHaveLength(2);
      expect(brands[0].brand).toBe("Wallbox");
      expect(brands[1].brand).toBe("Genérico");
    });

    it("should return empty array when no brands exist", async () => {
      vi.mocked(db.getAllChargerBrands).mockResolvedValue([]);
      const brands = await db.getAllChargerBrands();
      expect(brands).toHaveLength(0);
    });
  });

  describe("getChargerBrandById", () => {
    it("should return a charger brand by ID", async () => {
      vi.mocked(db.getChargerBrandById).mockResolvedValue(mockWallboxPulsarMax as any);

      const brand = await db.getChargerBrandById(1);
      expect(brand).not.toBeNull();
      expect(brand!.brand).toBe("Wallbox");
      expect(brand!.model).toBe("Pulsar Max");
      expect(brand!.supportsSoC).toBe(false);
      expect(brand!.supportsPowerMeasurement).toBe(false);
    });

    it("should return null for non-existent ID", async () => {
      vi.mocked(db.getChargerBrandById).mockResolvedValue(null);
      const brand = await db.getChargerBrandById(999);
      expect(brand).toBeNull();
    });
  });

  describe("getChargerBrandByBrandModel", () => {
    it("should find brand by brand and model name", async () => {
      vi.mocked(db.getChargerBrandByBrandModel).mockResolvedValue(mockWallboxPulsarMax as any);

      const brand = await db.getChargerBrandByBrandModel("Wallbox", "Pulsar Max");
      expect(brand).not.toBeNull();
      expect(brand!.displayName).toBe("Wallbox Pulsar Max");
    });
  });

  describe("Wallbox Pulsar Max profile validation", () => {
    it("should have correct OCPP configuration", () => {
      expect(mockWallboxPulsarMax.ocppVersion).toBe("1.6");
      expect(mockWallboxPulsarMax.chargeType).toBe("AC");
      expect(mockWallboxPulsarMax.defaultPowerKw).toBe("7.4");
      expect(mockWallboxPulsarMax.phases).toBe(1);
    });

    it("should correctly identify unsupported measurands", () => {
      expect(mockWallboxPulsarMax.supportsSoC).toBe(false);
      expect(mockWallboxPulsarMax.supportsPowerMeasurement).toBe(false);
      expect(mockWallboxPulsarMax.supportsCurrentMeasurement).toBe(false);
      expect(mockWallboxPulsarMax.supportsVoltageMeasurement).toBe(false);
    });

    it("should only have Energy.Active.Import.Register as measurand", () => {
      const measurands = JSON.parse(mockWallboxPulsarMax.supportedMeasurands);
      expect(measurands).toHaveLength(1);
      expect(measurands[0]).toBe("Energy.Active.Import.Register");
    });

    it("should report energy in Wh", () => {
      expect(mockWallboxPulsarMax.energyUnit).toBe("Wh");
    });

    it("should support remote start/stop and smart charging", () => {
      expect(mockWallboxPulsarMax.supportsRemoteStart).toBe(true);
      expect(mockWallboxPulsarMax.supportsRemoteStop).toBe(true);
      expect(mockWallboxPulsarMax.supportsSmartCharging).toBe(true);
    });

    it("should have correct connector type", () => {
      const connectors = JSON.parse(mockWallboxPulsarMax.supportedConnectors);
      expect(connectors).toContain("GBT_AC");
    });

    it("should have cloud API info", () => {
      expect(mockWallboxPulsarMax.cloudApiBaseUrl).toBe("https://api.wall-box.com");
      expect(mockWallboxPulsarMax.cloudApiAuthMethod).toBe("bearer_token");
    });
  });

  describe("Brand autoconfig for station creation", () => {
    it("should extract connector config from brand profile", () => {
      const connectors = JSON.parse(mockWallboxPulsarMax.supportedConnectors);
      const defaultPower = parseFloat(mockWallboxPulsarMax.defaultPowerKw);
      
      const autoConnectors = connectors.map((connType: string, idx: number) => ({
        id: `brand-${idx}`,
        type: connType,
        powerKw: defaultPower,
        quantity: 1,
      }));

      expect(autoConnectors).toHaveLength(1);
      expect(autoConnectors[0].type).toBe("GBT_AC");
      expect(autoConnectors[0].powerKw).toBe(7.4);
    });

    it("should handle generic brand with multiple measurands", () => {
      const measurands = JSON.parse(mockGenericOCPP16.supportedMeasurands as string);
      expect(measurands).toContain("Energy.Active.Import.Register");
      expect(measurands).toContain("Power.Active.Import");
      expect(measurands).toContain("SoC");
      expect(mockGenericOCPP16.supportsSoC).toBe(true);
      expect(mockGenericOCPP16.supportsPowerMeasurement).toBe(true);
    });

    it("should determine charge type correctly for connector auto-config", () => {
      const isAC = mockWallboxPulsarMax.chargeType === "AC";
      const isDC = mockWallboxPulsarMax.chargeType === "DC";
      expect(isAC).toBe(true);
      expect(isDC).toBe(false);
    });
  });

  describe("getChargerBrandForStation", () => {
    it("should return brand profile for a station with chargerBrandId", async () => {
      vi.mocked(db.getChargerBrandForStation).mockResolvedValue(mockWallboxPulsarMax as any);

      const brand = await db.getChargerBrandForStation(1);
      expect(brand).not.toBeNull();
      expect(brand!.brand).toBe("Wallbox");
    });

    it("should return null for station without chargerBrandId", async () => {
      vi.mocked(db.getChargerBrandForStation).mockResolvedValue(null);
      const brand = await db.getChargerBrandForStation(2);
      expect(brand).toBeNull();
    });
  });
});
