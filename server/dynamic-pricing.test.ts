import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  calculateOccupancyMultiplier,
  calculateTimeMultiplier,
  calculateDayMultiplier,
  getDemandLevel,
  getDemandVisualization,
  DEFAULT_PRICING_CONFIG,
  type PricingFactors,
} from "./pricing/dynamic-pricing";

describe("Dynamic Pricing - Occupancy Multiplier", () => {
  it("returns discount for low occupancy (< 30%)", () => {
    const multiplier = calculateOccupancyMultiplier(20, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(DEFAULT_PRICING_CONFIG.lowOccupancyDiscount);
    expect(multiplier).toBeLessThan(1);
  });

  it("returns normal multiplier for medium occupancy (30-70%)", () => {
    const multiplier = calculateOccupancyMultiplier(50, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.0);
  });

  it("returns surge multiplier for high occupancy (70-90%)", () => {
    const multiplier = calculateOccupancyMultiplier(80, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBeGreaterThan(1);
    expect(multiplier).toBeLessThan(DEFAULT_PRICING_CONFIG.criticalOccupancyMultiplier);
  });

  it("returns critical multiplier for very high occupancy (>= 90%)", () => {
    const multiplier = calculateOccupancyMultiplier(95, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(DEFAULT_PRICING_CONFIG.criticalOccupancyMultiplier);
  });

  it("handles edge cases at thresholds", () => {
    // Exactly at low threshold
    const atLow = calculateOccupancyMultiplier(30, DEFAULT_PRICING_CONFIG);
    expect(atLow).toBe(1.0);

    // Exactly at high threshold
    const atHigh = calculateOccupancyMultiplier(70, DEFAULT_PRICING_CONFIG);
    expect(atHigh).toBe(DEFAULT_PRICING_CONFIG.highOccupancyMultiplier);

    // Exactly at critical threshold
    const atCritical = calculateOccupancyMultiplier(90, DEFAULT_PRICING_CONFIG);
    expect(atCritical).toBe(DEFAULT_PRICING_CONFIG.criticalOccupancyMultiplier);
  });
});

describe("Dynamic Pricing - Time Multiplier", () => {
  it("returns peak multiplier during morning rush (7-9 AM)", () => {
    const morningPeak = new Date();
    morningPeak.setHours(8, 0, 0, 0);
    const multiplier = calculateTimeMultiplier(morningPeak, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.3);
  });

  it("returns peak multiplier during lunch (12-14)", () => {
    const lunchTime = new Date();
    lunchTime.setHours(13, 0, 0, 0);
    const multiplier = calculateTimeMultiplier(lunchTime, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.15);
  });

  it("returns highest peak multiplier during evening rush (17-20)", () => {
    const eveningPeak = new Date();
    eveningPeak.setHours(18, 0, 0, 0);
    const multiplier = calculateTimeMultiplier(eveningPeak, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.5);
  });

  it("returns discount during late night (0-6 AM)", () => {
    const lateNight = new Date();
    lateNight.setHours(3, 0, 0, 0);
    const multiplier = calculateTimeMultiplier(lateNight, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(0.85);
  });

  it("returns normal multiplier during off-peak hours", () => {
    const offPeak = new Date();
    offPeak.setHours(10, 0, 0, 0); // 10 AM - not peak
    const multiplier = calculateTimeMultiplier(offPeak, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.0);
  });
});

describe("Dynamic Pricing - Day Multiplier", () => {
  it("returns weekend multiplier on Saturday", () => {
    // Create a Saturday date (2026-01-17 is actually Friday in UTC, use 2026-01-24)
    const saturday = new Date("2026-01-24T12:00:00"); // This is a Saturday
    const multiplier = calculateDayMultiplier(saturday, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(DEFAULT_PRICING_CONFIG.weekendMultiplier);
  });

  it("returns weekend multiplier on Sunday", () => {
    // Create a Sunday date
    const sunday = new Date("2026-01-25T12:00:00"); // This is a Sunday
    const multiplier = calculateDayMultiplier(sunday, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(DEFAULT_PRICING_CONFIG.weekendMultiplier);
  });

  it("returns normal multiplier on weekdays", () => {
    // Create a Monday date
    const monday = new Date("2026-01-26T12:00:00"); // This is a Monday
    const multiplier = calculateDayMultiplier(monday, DEFAULT_PRICING_CONFIG);
    expect(multiplier).toBe(1.0);
  });
});

describe("Dynamic Pricing - Demand Level", () => {
  it("returns LOW for multiplier < 0.9", () => {
    expect(getDemandLevel(0.8)).toBe("LOW");
    expect(getDemandLevel(0.7)).toBe("LOW");
  });

  it("returns NORMAL for multiplier 0.9-1.2", () => {
    expect(getDemandLevel(0.9)).toBe("NORMAL");
    expect(getDemandLevel(1.0)).toBe("NORMAL");
    expect(getDemandLevel(1.19)).toBe("NORMAL");
  });

  it("returns HIGH for multiplier 1.2-1.6", () => {
    expect(getDemandLevel(1.2)).toBe("HIGH");
    expect(getDemandLevel(1.4)).toBe("HIGH");
    expect(getDemandLevel(1.59)).toBe("HIGH");
  });

  it("returns SURGE for multiplier >= 1.6", () => {
    expect(getDemandLevel(1.6)).toBe("SURGE");
    expect(getDemandLevel(2.0)).toBe("SURGE");
    expect(getDemandLevel(2.5)).toBe("SURGE");
  });
});

describe("Dynamic Pricing - Demand Visualization", () => {
  it("returns correct visualization for LOW demand", () => {
    const factors: PricingFactors = {
      occupancyMultiplier: 0.8,
      timeMultiplier: 0.85,
      dayMultiplier: 1.0,
      demandMultiplier: 1.0,
      finalMultiplier: 0.8,
      demandLevel: "LOW",
    };
    const viz = getDemandVisualization(factors);
    
    expect(viz.level).toBe("LOW");
    expect(viz.color).toBe("#22c55e"); // Green
    expect(viz.message).toContain("Baja demanda");
    expect(viz.savingsOrSurge).toContain("Ahorra");
  });

  it("returns correct visualization for NORMAL demand", () => {
    const factors: PricingFactors = {
      occupancyMultiplier: 1.0,
      timeMultiplier: 1.0,
      dayMultiplier: 1.0,
      demandMultiplier: 1.0,
      finalMultiplier: 1.0,
      demandLevel: "NORMAL",
    };
    const viz = getDemandVisualization(factors);
    
    expect(viz.level).toBe("NORMAL");
    expect(viz.color).toBe("#3b82f6"); // Blue
    expect(viz.message).toBe("Demanda normal");
    expect(viz.savingsOrSurge).toBe("Precio estándar");
  });

  it("returns correct visualization for HIGH demand", () => {
    const factors: PricingFactors = {
      occupancyMultiplier: 1.4,
      timeMultiplier: 1.3,
      dayMultiplier: 1.1,
      demandMultiplier: 1.0,
      finalMultiplier: 1.4,
      demandLevel: "HIGH",
    };
    const viz = getDemandVisualization(factors);
    
    expect(viz.level).toBe("HIGH");
    expect(viz.color).toBe("#f59e0b"); // Orange
    expect(viz.message).toContain("Alta demanda");
    expect(viz.savingsOrSurge).toContain("+");
  });

  it("returns correct visualization for SURGE demand", () => {
    const factors: PricingFactors = {
      occupancyMultiplier: 2.0,
      timeMultiplier: 1.5,
      dayMultiplier: 1.1,
      demandMultiplier: 1.0,
      finalMultiplier: 1.8,
      demandLevel: "SURGE",
    };
    const viz = getDemandVisualization(factors);
    
    expect(viz.level).toBe("SURGE");
    expect(viz.color).toBe("#ef4444"); // Red
    expect(viz.message).toContain("Demanda muy alta");
    expect(viz.savingsOrSurge).toContain("surge");
  });
});

describe("Dynamic Pricing - Configuration Limits", () => {
  it("has valid min/max multiplier range", () => {
    expect(DEFAULT_PRICING_CONFIG.minMultiplier).toBeGreaterThan(0);
    expect(DEFAULT_PRICING_CONFIG.maxMultiplier).toBeGreaterThan(DEFAULT_PRICING_CONFIG.minMultiplier);
    expect(DEFAULT_PRICING_CONFIG.minMultiplier).toBeLessThan(1);
    expect(DEFAULT_PRICING_CONFIG.maxMultiplier).toBeGreaterThan(1);
  });

  it("has valid occupancy thresholds", () => {
    expect(DEFAULT_PRICING_CONFIG.lowOccupancyThreshold).toBeLessThan(DEFAULT_PRICING_CONFIG.highOccupancyThreshold);
    expect(DEFAULT_PRICING_CONFIG.highOccupancyThreshold).toBeLessThan(DEFAULT_PRICING_CONFIG.criticalOccupancyThreshold);
    expect(DEFAULT_PRICING_CONFIG.criticalOccupancyThreshold).toBeLessThanOrEqual(100);
  });

  it("has valid peak hours configuration", () => {
    for (const peak of DEFAULT_PRICING_CONFIG.peakHours) {
      expect(peak.start).toBeGreaterThanOrEqual(0);
      expect(peak.start).toBeLessThan(24);
      expect(peak.end).toBeGreaterThan(peak.start);
      expect(peak.end).toBeLessThanOrEqual(24);
      expect(peak.multiplier).toBeGreaterThan(1);
    }
  });

  it("has valid reservation fees", () => {
    expect(DEFAULT_PRICING_CONFIG.reservationFeeBase).toBeGreaterThan(0);
    expect(DEFAULT_PRICING_CONFIG.noShowPenaltyBase).toBeGreaterThan(DEFAULT_PRICING_CONFIG.reservationFeeBase);
  });
});
