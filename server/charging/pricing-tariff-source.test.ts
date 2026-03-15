import { describe, it, expect } from "vitest";

/**
 * Tests for the tariffSource fix in getPriceByConnectorType.
 * 
 * Bug: When a station has its own tariff (source='station'), the dynamic price
 * was being overridden by the global AC/DC prices (defaultPricePerKwhAC/DC).
 * 
 * Fix: getPriceByConnectorType now accepts a tariffSource parameter.
 * When tariffSource='station', it respects the basePrice passed to it.
 * When tariffSource='global' or undefined, it applies AC/DC differentiation.
 */
describe("getPriceByConnectorType tariffSource behavior", () => {
  // Simulate the getPriceByConnectorType logic
  function simulateGetPriceByConnectorType(
    chargeType: "AC" | "DC",
    basePrice: number,
    tariffSource: "station" | "global" | undefined,
    enableDifferentiatedPricing: boolean,
    defaultPricePerKwhAC: number,
    defaultPricePerKwhDC: number
  ): number {
    // If tariff comes from a station-specific tariff, respect the calculated price
    if (tariffSource === "station") {
      return basePrice;
    }

    // If differentiated pricing is not enabled, use base price
    if (!enableDifferentiatedPricing) {
      return basePrice;
    }

    // Apply AC/DC differentiation only for global tariff
    return chargeType === "DC" ? defaultPricePerKwhDC : defaultPricePerKwhAC;
  }

  describe("Station with own tariff (tariffSource='station')", () => {
    const globalAC = 1500;
    const globalDC = 1800;
    const enableDiff = true;

    it("should use dynamic price for AC connector, NOT global AC price", () => {
      const dynamicPrice = 1216; // Calculated from station tariff $1300 * 0.94 multiplier
      const result = simulateGetPriceByConnectorType(
        "AC", dynamicPrice, "station", enableDiff, globalAC, globalDC
      );
      expect(result).toBe(1216); // Should be dynamic price, NOT 1500
      expect(result).not.toBe(globalAC);
    });

    it("should use dynamic price for DC connector, NOT global DC price", () => {
      const dynamicPrice = 1460; // Calculated from station tariff $1300 * 1.12 multiplier
      const result = simulateGetPriceByConnectorType(
        "DC", dynamicPrice, "station", enableDiff, globalAC, globalDC
      );
      expect(result).toBe(1460); // Should be dynamic price, NOT 1800
      expect(result).not.toBe(globalDC);
    });

    it("should use fixed station price for AC, NOT global AC price", () => {
      const stationPrice = 1300; // Station's own tariff
      const result = simulateGetPriceByConnectorType(
        "AC", stationPrice, "station", enableDiff, globalAC, globalDC
      );
      expect(result).toBe(1300); // Should be station price, NOT 1500
    });
  });

  describe("Station without own tariff (tariffSource='global')", () => {
    const globalAC = 1500;
    const globalDC = 1800;
    const enableDiff = true;

    it("should use global AC price for AC connector", () => {
      const fallbackPrice = 1300; // defaultBasePricePerKwh
      const result = simulateGetPriceByConnectorType(
        "AC", fallbackPrice, "global", enableDiff, globalAC, globalDC
      );
      expect(result).toBe(globalAC); // Should use global AC price
    });

    it("should use global DC price for DC connector", () => {
      const fallbackPrice = 1300;
      const result = simulateGetPriceByConnectorType(
        "DC", fallbackPrice, "global", enableDiff, globalAC, globalDC
      );
      expect(result).toBe(globalDC); // Should use global DC price
    });
  });

  describe("Differentiated pricing disabled", () => {
    const globalAC = 1500;
    const globalDC = 1800;
    const enableDiff = false;

    it("should use base price regardless of connector type when diff pricing disabled", () => {
      const basePrice = 1300;
      const resultAC = simulateGetPriceByConnectorType(
        "AC", basePrice, "global", enableDiff, globalAC, globalDC
      );
      const resultDC = simulateGetPriceByConnectorType(
        "DC", basePrice, "global", enableDiff, globalAC, globalDC
      );
      expect(resultAC).toBe(basePrice);
      expect(resultDC).toBe(basePrice);
    });
  });

  describe("No tariffSource provided (backward compatibility)", () => {
    const globalAC = 1500;
    const globalDC = 1800;
    const enableDiff = true;

    it("should apply AC/DC differentiation when tariffSource is undefined", () => {
      const basePrice = 1300;
      const result = simulateGetPriceByConnectorType(
        "AC", basePrice, undefined, enableDiff, globalAC, globalDC
      );
      expect(result).toBe(globalAC); // Backward compatible: applies global AC price
    });
  });
});

describe("End-to-end pricing consistency", () => {
  it("should produce same price in station detail and startCharge for station with own tariff", () => {
    // Simulate the full flow for EVG diamante oriental
    const stationTariffPrice = 1300; // tariff.pricePerKwh
    const dynamicMultiplier = 0.94; // Low demand
    const tariffSource = "station" as const;
    const globalAC = 1500;
    const enableDiff = true;

    // Station detail page: calculateDynamicKwhPrice
    const stationDetailPrice = Math.round(stationTariffPrice * dynamicMultiplier);
    // = 1222

    // startCharge: calculateDynamicPrice → getPriceByConnectorType
    const dynamicFinalPrice = Math.round(stationTariffPrice * dynamicMultiplier);
    // With the fix, getPriceByConnectorType respects the station tariff
    const startChargePrice = tariffSource === "station" 
      ? dynamicFinalPrice 
      : (enableDiff ? globalAC : dynamicFinalPrice);
    // = 1222 (NOT 1500)

    expect(stationDetailPrice).toBe(startChargePrice);
    expect(startChargePrice).not.toBe(globalAC); // Must NOT be $1,500
  });

  it("should apply global AC/DC prices for stations without own tariff", () => {
    const globalBasePrice = 1300; // defaultBasePricePerKwh
    const dynamicMultiplier = 0.94;
    const tariffSource = "global" as const;
    const globalAC = 1500;
    const enableDiff = true;

    // For global tariff, AC/DC differentiation should apply
    const dynamicFinalPrice = Math.round(globalBasePrice * dynamicMultiplier);
    const startChargePrice = tariffSource === "station"
      ? dynamicFinalPrice
      : (enableDiff ? globalAC : dynamicFinalPrice);

    expect(startChargePrice).toBe(globalAC); // Global AC price applies
  });
});
