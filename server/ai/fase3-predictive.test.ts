/**
 * Tests para Fase 3 — IA Predictiva
 * 
 * Cubre:
 * 1. Demand Forecast Service (EWMA, tendencia, multiplicador)
 * 2. Ad Relevance Service (scoring multi-criterio)
 * 3. Subscription Predictor (regresión lineal, proyecciones)
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// 1. DEMAND FORECAST SERVICE
// ============================================================================

import {
  calculateEWMA,
  calculateTrend,
  calculateDemandMultiplierFromForecast,
} from "./demand-forecast-service";

describe("Demand Forecast — EWMA (Exponentially Weighted Moving Average)", () => {
  it("should return 0 for empty array", () => {
    expect(calculateEWMA([])).toBe(0);
  });

  it("should return the single value for array of length 1", () => {
    expect(calculateEWMA([5])).toBe(5);
  });

  it("should weight recent values more heavily", () => {
    // [10, 5, 5, 5] → semana 0 (10) tiene más peso que semanas 1-3 (5)
    const result = calculateEWMA([10, 5, 5, 5]);
    expect(result).toBeGreaterThan(5); // Más que el promedio simple
    expect(result).toBeLessThan(10);   // Menos que el valor más reciente
  });

  it("should handle all zeros", () => {
    expect(calculateEWMA([0, 0, 0, 0])).toBe(0);
  });

  it("should handle increasing trend", () => {
    // Valores más recientes son mayores → EWMA > promedio simple
    const values = [20, 15, 10, 5]; // [reciente → antiguo]
    const ewma = calculateEWMA(values);
    const simpleAvg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(ewma).toBeGreaterThan(simpleAvg);
  });

  it("should handle decreasing trend", () => {
    // Valores más recientes son menores → EWMA < promedio simple
    const values = [5, 10, 15, 20]; // [reciente → antiguo]
    const ewma = calculateEWMA(values);
    const simpleAvg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(ewma).toBeLessThan(simpleAvg);
  });
});

describe("Demand Forecast — Trend Calculation", () => {
  it("should return STABLE when both periods are zero", () => {
    const { trend, trendPercent } = calculateTrend(0, 0);
    expect(trend).toBe("STABLE");
    expect(trendPercent).toBe(0);
  });

  it("should return RISING when recent > older by >15%", () => {
    const { trend, trendPercent } = calculateTrend(20, 10);
    expect(trend).toBe("RISING");
    expect(trendPercent).toBe(100); // 100% increase
  });

  it("should return DECLINING when recent < older by >15%", () => {
    const { trend, trendPercent } = calculateTrend(5, 10);
    expect(trend).toBe("DECLINING");
    expect(trendPercent).toBe(-50); // 50% decrease
  });

  it("should return STABLE when change is within 15%", () => {
    const { trend } = calculateTrend(10, 9);
    expect(trend).toBe("STABLE");
  });

  it("should return RISING when older is 0 but recent has data", () => {
    const { trend, trendPercent } = calculateTrend(5, 0);
    expect(trend).toBe("RISING");
    expect(trendPercent).toBe(100);
  });
});

describe("Demand Forecast — Demand Multiplier From Forecast", () => {
  it("should give discount for low occupancy (<30%)", () => {
    const multiplier = calculateDemandMultiplierFromForecast(10, "STABLE", 0);
    expect(multiplier).toBeLessThan(1.0);
    expect(multiplier).toBeGreaterThanOrEqual(0.7);
  });

  it("should give neutral multiplier for normal occupancy (30-70%)", () => {
    const multiplier = calculateDemandMultiplierFromForecast(50, "STABLE", 0);
    expect(multiplier).toBeGreaterThanOrEqual(0.95);
    expect(multiplier).toBeLessThanOrEqual(1.1);
  });

  it("should give surge for high occupancy (70-90%)", () => {
    const multiplier = calculateDemandMultiplierFromForecast(80, "STABLE", 0);
    expect(multiplier).toBeGreaterThan(1.1);
    expect(multiplier).toBeLessThanOrEqual(1.4);
  });

  it("should give strong surge for critical occupancy (>90%)", () => {
    const multiplier = calculateDemandMultiplierFromForecast(95, "STABLE", 0);
    expect(multiplier).toBeGreaterThan(1.4);
    expect(multiplier).toBeLessThanOrEqual(2.0);
  });

  it("should boost multiplier for RISING trend", () => {
    const stableMultiplier = calculateDemandMultiplierFromForecast(50, "STABLE", 0);
    const risingMultiplier = calculateDemandMultiplierFromForecast(50, "RISING", 30);
    expect(risingMultiplier).toBeGreaterThan(stableMultiplier);
  });

  it("should reduce multiplier for DECLINING trend", () => {
    const stableMultiplier = calculateDemandMultiplierFromForecast(50, "STABLE", 0);
    const decliningMultiplier = calculateDemandMultiplierFromForecast(50, "DECLINING", -30);
    expect(decliningMultiplier).toBeLessThan(stableMultiplier);
  });

  it("should clamp to minimum 0.7", () => {
    const multiplier = calculateDemandMultiplierFromForecast(0, "DECLINING", -100);
    expect(multiplier).toBeGreaterThanOrEqual(0.7);
  });

  it("should clamp to maximum 2.0", () => {
    const multiplier = calculateDemandMultiplierFromForecast(100, "RISING", 100);
    expect(multiplier).toBeLessThanOrEqual(2.0);
  });
});

// ============================================================================
// 2. AD RELEVANCE SERVICE
// ============================================================================

import {
  calculateRelevanceScore,
  type UserAdProfile,
} from "./ad-relevance-service";
import type { Banner } from "../../drizzle/schema";

function createMockBanner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 1,
    title: "Test Banner",
    subtitle: null,
    description: null,
    imageUrl: "https://example.com/banner.jpg",
    imageUrlMobile: null,
    type: "PROMOTIONAL",
    linkUrl: null,
    linkType: null,
    linkTarget: null,
    ctaText: null,
    startDate: null,
    endDate: null,
    targetRoles: null,
    targetCities: null,
    targetSubscriptionTiers: null,
    priority: 0,
    displayDurationMs: 5000,
    isClosable: true,
    showOnce: false,
    status: "ACTIVE",
    impressions: 0,
    clicks: 0,
    uniqueViews: 0,
    advertiserName: null,
    advertiserContact: null,
    campaignId: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Banner;
}

function createMockUserProfile(overrides: Partial<UserAdProfile> = {}): UserAdProfile {
  return {
    userId: 1,
    consumptionProfile: null,
    currentSubscriptionTier: "FREE",
    city: "Bogotá",
    role: "user",
    currentHour: 14,
    currentDayOfWeek: 3, // Miércoles
    ...overrides,
  };
}

describe("Ad Relevance — Score Calculation", () => {
  it("should return a score between 0 and 100", () => {
    const banner = createMockBanner();
    const profile = createMockUserProfile();
    const score = calculateRelevanceScore(banner, profile);
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it("should have all breakdown components", () => {
    const banner = createMockBanner();
    const profile = createMockUserProfile();
    const score = calculateRelevanceScore(banner, profile);
    expect(score.breakdown).toHaveProperty("profileMatch");
    expect(score.breakdown).toHaveProperty("geoMatch");
    expect(score.breakdown).toHaveProperty("temporalMatch");
    expect(score.breakdown).toHaveProperty("subscriptionMatch");
    expect(score.breakdown).toHaveProperty("engagementScore");
    expect(score.breakdown).toHaveProperty("freshnessScore");
  });

  it("should give higher score for matching city", () => {
    const banner = createMockBanner({ targetCities: ["Bogotá", "Medellín"] as any });
    const matchProfile = createMockUserProfile({ city: "Bogotá" });
    const noMatchProfile = createMockUserProfile({ city: "Cali" });

    const matchScore = calculateRelevanceScore(banner, matchProfile);
    const noMatchScore = calculateRelevanceScore(banner, noMatchProfile);

    expect(matchScore.breakdown.geoMatch).toBeGreaterThan(noMatchScore.breakdown.geoMatch);
  });

  it("should give higher score for matching subscription tier", () => {
    const banner = createMockBanner({ targetSubscriptionTiers: ["PREMIUM"] as any });
    const matchProfile = createMockUserProfile({ currentSubscriptionTier: "PREMIUM" });
    const noMatchProfile = createMockUserProfile({ currentSubscriptionTier: "FREE" });

    const matchScore = calculateRelevanceScore(banner, matchProfile);
    const noMatchScore = calculateRelevanceScore(banner, noMatchProfile);

    expect(matchScore.breakdown.subscriptionMatch).toBeGreaterThan(noMatchScore.breakdown.subscriptionMatch);
  });

  it("should give higher freshness score for newer banners", () => {
    const newBanner = createMockBanner({ createdAt: new Date() });
    const oldBanner = createMockBanner({ createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) });
    const profile = createMockUserProfile();

    const newScore = calculateRelevanceScore(newBanner, profile);
    const oldScore = calculateRelevanceScore(oldBanner, profile);

    expect(newScore.breakdown.freshnessScore).toBeGreaterThan(oldScore.breakdown.freshnessScore);
  });

  it("should give novelty bonus for unseen banners", () => {
    const banner = createMockBanner();
    const profile = createMockUserProfile();

    // Sin engagement = nunca visto = bonus de novedad
    const score = calculateRelevanceScore(banner, profile);
    expect(score.breakdown.engagementScore).toBeGreaterThanOrEqual(10);
  });

  it("should penalize banners with high views but no clicks (ad fatigue)", () => {
    const banner = createMockBanner();
    const profile = createMockUserProfile();

    // Con muchas vistas pero sin clicks = fatiga publicitaria
    const score = calculateRelevanceScore(banner, profile, { views: 15, clicks: 0 });
    expect(score.breakdown.engagementScore).toBeLessThan(5);
  });

  it("should reward banners with good CTR", () => {
    const banner = createMockBanner();
    const profile = createMockUserProfile();

    const goodCTR = calculateRelevanceScore(banner, profile, { views: 10, clicks: 3 });
    const badCTR = calculateRelevanceScore(banner, profile, { views: 10, clicks: 0 });

    expect(goodCTR.breakdown.engagementScore).toBeGreaterThan(badCTR.breakdown.engagementScore);
  });

  it("should include reasons array", () => {
    const banner = createMockBanner({ targetCities: ["Bogotá"] as any });
    const profile = createMockUserProfile({ city: "Bogotá" });
    const score = calculateRelevanceScore(banner, profile);
    expect(score.reasons.length).toBeGreaterThan(0);
  });
});

describe("Ad Relevance — Targeting Metadata Parsing", () => {
  it("should parse targeting from description HTML comment", () => {
    const banner = createMockBanner({
      description: 'Gran promoción <!-- targeting: {"spendingMin": 100000, "spendingMax": 500000, "chargeType": "DC"} --> para usuarios DC',
    });
    const profile = createMockUserProfile({
      consumptionProfile: {
        id: 1,
        userId: 1,
        totalSessions: 20,
        monthlyAvgSpent: "200000",
        preferredChargeType: "DC",
      } as any,
    });

    const score = calculateRelevanceScore(banner, profile);
    // Should get high profile match because spending and charge type match
    expect(score.breakdown.profileMatch).toBeGreaterThan(15);
  });
});

// ============================================================================
// 3. SUBSCRIPTION PREDICTOR
// ============================================================================

import {
  linearRegression,
  calculateConsumptionTrend,
} from "./subscription-predictor";
import type { UserConsumptionProfile } from "../../drizzle/schema";

describe("Subscription Predictor — Linear Regression", () => {
  it("should return zero slope for constant values", () => {
    const result = linearRegression([10, 10, 10, 10]);
    expect(Math.abs(result.slope)).toBeLessThan(0.001);
    expect(result.intercept).toBeCloseTo(10, 1);
  });

  it("should detect positive slope for increasing values", () => {
    const result = linearRegression([10, 20, 30, 40]);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.slope).toBeCloseTo(10, 1);
  });

  it("should detect negative slope for decreasing values", () => {
    const result = linearRegression([40, 30, 20, 10]);
    expect(result.slope).toBeLessThan(0);
    expect(result.slope).toBeCloseTo(-10, 1);
  });

  it("should have R² close to 1 for perfect linear data", () => {
    const result = linearRegression([10, 20, 30, 40, 50]);
    expect(result.rSquared).toBeGreaterThan(0.99);
  });

  it("should have lower R² for noisy data", () => {
    const result = linearRegression([10, 50, 15, 45, 20]);
    expect(result.rSquared).toBeLessThan(0.5);
  });

  it("should handle single value", () => {
    const result = linearRegression([42]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(42);
  });

  it("should handle empty array", () => {
    const result = linearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
  });
});

describe("Subscription Predictor — Consumption Trend", () => {
  const mockProfile = {
    monthlyAvgSpent: "150000",
    monthlyAvgKwh: "100",
  } as UserConsumptionProfile;

  it("should detect GROWING trend when spending increases", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 100000, totalKwh: 70, sessions: 5 },
      { month: "2025-11", totalSpent: 120000, totalKwh: 80, sessions: 6 },
      { month: "2025-12", totalSpent: 140000, totalKwh: 90, sessions: 7 },
      { month: "2026-01", totalSpent: 160000, totalKwh: 100, sessions: 8 },
      { month: "2026-02", totalSpent: 180000, totalKwh: 110, sessions: 9 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.direction).toBe("GROWING");
    expect(trend.monthlyGrowthRate).toBeGreaterThan(0);
  });

  it("should detect DECLINING trend when spending decreases", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 200000, totalKwh: 130, sessions: 10 },
      { month: "2025-11", totalSpent: 170000, totalKwh: 110, sessions: 8 },
      { month: "2025-12", totalSpent: 140000, totalKwh: 90, sessions: 6 },
      { month: "2026-01", totalSpent: 110000, totalKwh: 70, sessions: 5 },
      { month: "2026-02", totalSpent: 80000, totalKwh: 50, sessions: 3 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.direction).toBe("DECLINING");
    expect(trend.monthlyGrowthRate).toBeLessThan(0);
  });

  it("should detect STABLE trend when spending is flat", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 150000, totalKwh: 100, sessions: 7 },
      { month: "2025-11", totalSpent: 148000, totalKwh: 99, sessions: 7 },
      { month: "2025-12", totalSpent: 152000, totalKwh: 101, sessions: 7 },
      { month: "2026-01", totalSpent: 149000, totalKwh: 100, sessions: 7 },
      { month: "2026-02", totalSpent: 151000, totalKwh: 100, sessions: 7 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.direction).toBe("STABLE");
  });

  it("should project 12 months of spending", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 100000, totalKwh: 70, sessions: 5 },
      { month: "2025-11", totalSpent: 110000, totalKwh: 75, sessions: 5 },
      { month: "2025-12", totalSpent: 120000, totalKwh: 80, sessions: 6 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.projectedMonthlySpend).toHaveLength(12);
    expect(trend.projectedMonthlyKwh).toHaveLength(12);
    // All projections should be positive
    trend.projectedMonthlySpend.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });

  it("should have confidence between 0 and 100", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 100000, totalKwh: 70, sessions: 5 },
      { month: "2025-11", totalSpent: 110000, totalKwh: 75, sessions: 5 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.confidence).toBeGreaterThanOrEqual(0);
    expect(trend.confidence).toBeLessThanOrEqual(100);
  });

  it("should fall back to profile averages with insufficient data", () => {
    const monthlyData = [
      { month: "2026-01", totalSpent: 150000, totalKwh: 100, sessions: 7 },
    ];

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);
    expect(trend.direction).toBe("STABLE");
    expect(trend.confidence).toBeLessThanOrEqual(30);
  });
});

describe("Subscription Predictor — Integration", () => {
  it("should project growing spending correctly", () => {
    const monthlyData = [
      { month: "2025-10", totalSpent: 100000, totalKwh: 70, sessions: 5 },
      { month: "2025-11", totalSpent: 130000, totalKwh: 85, sessions: 6 },
      { month: "2025-12", totalSpent: 160000, totalKwh: 100, sessions: 7 },
      { month: "2026-01", totalSpent: 190000, totalKwh: 115, sessions: 8 },
    ];

    const mockProfile = {
      monthlyAvgSpent: "145000",
      monthlyAvgKwh: "92",
    } as UserConsumptionProfile;

    const trend = calculateConsumptionTrend(monthlyData, mockProfile);

    // With growing trend, future projections should be higher than current
    expect(trend.projectedMonthlySpend[11]).toBeGreaterThan(trend.projectedMonthlySpend[0]);
    expect(trend.direction).toBe("GROWING");
  });
});
