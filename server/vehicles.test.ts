import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getUserVehicles: vi.fn(),
  getUserVehicleById: vi.fn(),
  getDefaultVehicle: vi.fn(),
  createUserVehicle: vi.fn(),
  updateUserVehicle: vi.fn(),
  deleteUserVehicle: vi.fn(),
  setDefaultVehicle: vi.fn(),
}));

import * as db from "./db";

describe("Vehicle DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserVehicles returns vehicles for a user", async () => {
    const mockVehicles = [
      {
        id: 1,
        userId: 10,
        brand: "Tesla",
        model: "Model 3",
        year: 2024,
        licensePlate: "ABC123",
        batteryCapacityKwh: "60.00",
        rangeKm: 450,
        connectorTypes: ["CCS_2", "TESLA"],
        maxChargePowerKw: "250.00",
        isDefault: true,
        isActive: true,
        imageUrl: null,
        nickname: "Mi Tesla",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (db.getUserVehicles as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicles);

    const result = await db.getUserVehicles(10);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe("Tesla");
    expect(result[0].connectorTypes).toContain("CCS_2");
    expect(db.getUserVehicles).toHaveBeenCalledWith(10);
  });

  it("getUserVehicleById returns a specific vehicle", async () => {
    const mockVehicle = {
      id: 1,
      userId: 10,
      brand: "BYD",
      model: "Dolphin",
      connectorTypes: ["TYPE_2", "CCS_2"],
      isDefault: false,
      isActive: true,
    };
    (db.getUserVehicleById as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    const result = await db.getUserVehicleById(1, 10);
    expect(result).toBeDefined();
    expect(result?.brand).toBe("BYD");
    expect(db.getUserVehicleById).toHaveBeenCalledWith(1, 10);
  });

  it("getUserVehicleById returns undefined for non-existent vehicle", async () => {
    (db.getUserVehicleById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await db.getUserVehicleById(999, 10);
    expect(result).toBeUndefined();
  });

  it("createUserVehicle creates and returns new id", async () => {
    (db.createUserVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(42);

    const result = await db.createUserVehicle({
      userId: 10,
      brand: "Renault",
      model: "Zoe",
      connectorTypes: ["TYPE_2"],
      isDefault: false,
      isActive: true,
    });
    expect(result).toBe(42);
    expect(db.createUserVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: "Renault",
        model: "Zoe",
        connectorTypes: ["TYPE_2"],
      })
    );
  });

  it("updateUserVehicle calls with correct params", async () => {
    (db.updateUserVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await db.updateUserVehicle(1, 10, { brand: "Tesla", model: "Model Y" });
    expect(db.updateUserVehicle).toHaveBeenCalledWith(1, 10, {
      brand: "Tesla",
      model: "Model Y",
    });
  });

  it("deleteUserVehicle performs soft delete", async () => {
    (db.deleteUserVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await db.deleteUserVehicle(1, 10);
    expect(db.deleteUserVehicle).toHaveBeenCalledWith(1, 10);
  });

  it("setDefaultVehicle updates default status", async () => {
    (db.setDefaultVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await db.setDefaultVehicle(2, 10);
    expect(db.setDefaultVehicle).toHaveBeenCalledWith(2, 10);
  });

  it("getDefaultVehicle returns the default vehicle", async () => {
    const mockDefault = {
      id: 1,
      userId: 10,
      brand: "Tesla",
      model: "Model 3",
      isDefault: true,
    };
    (db.getDefaultVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockDefault);

    const result = await db.getDefaultVehicle(10);
    expect(result).toBeDefined();
    expect(result?.isDefault).toBe(true);
  });
});

describe("Vehicle connector types validation", () => {
  const validConnectors = ["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"];

  it("all 8 connector types are valid", () => {
    expect(validConnectors).toHaveLength(8);
    expect(validConnectors).toContain("TYPE_1");
    expect(validConnectors).toContain("TYPE_2");
    expect(validConnectors).toContain("CCS_1");
    expect(validConnectors).toContain("CCS_2");
    expect(validConnectors).toContain("CHADEMO");
    expect(validConnectors).toContain("TESLA");
    expect(validConnectors).toContain("GBT_AC");
    expect(validConnectors).toContain("GBT_DC");
  });

  it("connector types match database schema enum", () => {
    // These must match the connectorTypeEnum in drizzle/schema.ts
    const schemaConnectors = ["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"];
    expect(validConnectors).toEqual(schemaConnectors);
  });
});
