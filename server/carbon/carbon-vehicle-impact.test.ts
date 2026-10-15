import { describe, expect, it } from "vitest";
import { calculateVehicleProfiledImpact, normalizeVehicleKey, resolveVehicleBaselineFactor } from "../../shared/carbon-vehicle-impact";

const factor = {
  brandKey: "BYD",
  modelKey: "Sealion 7",
  displayName: "BYD Sealion 7 — segmento SUV",
  vehicleSegment: "SUV_LIGHT_TRUCK" as const,
  evConsumptionKwhPer100Km: 20,
  baselineFuelEconomyKmPerGallon: 22,
  baselineFuelEmissionKgCo2PerGallon: 8.808,
  gridFactorTco2ePerMwh: 0.22,
  dataQuality: "SEGMENT_CONSERVATIVE" as const,
  sourceUrl: "https://example.com/source",
  sourceTitle: "Fuente",
};

describe("matriz preauditada por vehículo", () => {
  it("normaliza acentos, espacios y mayúsculas para asociar un perfil", () => {
    expect(normalizeVehicleKey("  Ávatar-11  ")).toBe("avatar 11");
    expect(resolveVehicleBaselineFactor({ brand: "byd", model: "Sealion-7" }, [factor])).toEqual(factor);
  });

  it("estima únicamente kWh vinculados a perfiles y factores activos", () => {
    const result = calculateVehicleProfiledImpact({
      totalChargingKwh: 1_000,
      profiles: [
        { userId: 1, brand: "BYD", model: "Sealion 7", chargingKwh: 200 },
        { userId: 2, brand: "Otra", model: "Sin fuente", chargingKwh: 300 },
      ],
      factors: [factor],
    });

    expect(result.profiledChargingKwh).toBe(500);
    expect(result.eligibleChargingKwh).toBe(200);
    expect(result.unlinkedChargingKwh).toBe(500);
    expect(result.unmatchedProfileChargingKwh).toBe(300);
    expect(result.coveragePercent).toBe(20);
    expect(result.estimatedAvoidedTco2e).toBeGreaterThan(0);
  });

  it("no genera impacto cuando el único factor está inactivo", () => {
    const result = calculateVehicleProfiledImpact({
      totalChargingKwh: 120,
      profiles: [{ userId: 1, brand: "BYD", model: "Sealion 7", chargingKwh: 120 }],
      factors: [{ ...factor, isActive: false }],
    });

    expect(result.eligibleChargingKwh).toBe(0);
    expect(result.estimatedAvoidedTco2e).toBe(0);
  });
});
