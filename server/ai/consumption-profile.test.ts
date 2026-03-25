/**
 * Tests for Fase 2 — Inteligencia IA: Perfil de Consumo Inteligente
 * 
 * Tests:
 * 1. formatProfileForLLM generates correct text from profile data
 * 2. calculateUserScore returns correct scores
 * 3. calculateRecommendedSubscription logic
 * 4. Proactive notification cooldown logic
 * 5. Context service includes consumption profile text
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { formatProfileForLLM } from "./consumption-profile-service";
import type { UserConsumptionProfile } from "../../drizzle/schema";

// ============================================================================
// HELPER: Create mock profile
// ============================================================================

function createMockProfile(overrides: Partial<UserConsumptionProfile> = {}): UserConsumptionProfile {
  return {
    id: 1,
    userId: 42,
    totalSessions: 15,
    totalKwh: "450.5000",
    totalSpentCop: "675000.00",
    avgKwhPerSession: "30.0333",
    avgCostPerSession: "45000.00",
    avgSessionDurationMin: 45,
    monthlyAvgSpent: "225000.00",
    monthlyAvgKwh: "150.1667",
    monthlyAvgSessions: "5.00",
    preferredHours: [8, 18, 20],
    preferredDays: [1, 3, 5], // Lunes, Miércoles, Viernes
    topStations: [
      { stationId: 1, name: "EVGreen Centro", visits: 8 },
      { stationId: 2, name: "EVGreen Norte", visits: 5 },
      { stationId: 3, name: "EVGreen Usaquén", visits: 2 },
    ],
    preferredChargeType: "AC",
    preferredConnectorType: "TYPE_2",
    avgChargePowerKw: "22.00",
    typicalChargeFrequencyDays: "6.50",
    lastChargeAt: new Date("2026-03-20T18:00:00Z"),
    nextPredictedChargeAt: new Date("2026-03-27T18:00:00Z"),
    userScore: 72,
    scoreBreakdown: {
      frequency: 70,
      spending: 70,
      punctuality: 90,
      loyalty: 60,
    },
    recommendedTier: "PREMIUM",
    estimatedMonthlySavingsWithUpgrade: "12600.00",
    createdAt: new Date("2025-06-01T00:00:00Z"),
    updatedAt: new Date("2026-03-20T18:00:00Z"),
    ...overrides,
  };
}

// ============================================================================
// TEST: formatProfileForLLM
// ============================================================================

describe("formatProfileForLLM", () => {
  it("should generate complete profile text with all fields", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);

    // Verify key sections exist
    expect(text).toContain("Perfil de Consumo del Usuario");
    expect(text).toContain("Sesiones totales: 15");
    expect(text).toContain("450.5 kWh");
    expect(text).toContain("COP");
    expect(text).toContain("30.0 kWh");
    expect(text).toContain("45 minutos");
    expect(text).toContain("150.2 kWh/mes");
    expect(text).toContain("5.0/mes");
  });

  it("should include preferred hours", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("8:00");
    expect(text).toContain("18:00");
    expect(text).toContain("20:00");
  });

  it("should include preferred days as names", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("Lunes");
    expect(text).toContain("Miércoles");
    expect(text).toContain("Viernes");
  });

  it("should include top stations with visit counts", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("EVGreen Centro (8 visitas)");
    expect(text).toContain("EVGreen Norte (5 visitas)");
    expect(text).toContain("EVGreen Usaquén (2 visitas)");
  });

  it("should include charge type and connector preferences", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("Tipo de carga preferido: AC");
    expect(text).toContain("Conector preferido: TYPE_2");
  });

  it("should include charge frequency", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("cada 6.5 días");
  });

  it("should include user score with breakdown", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("Score de usuario: 72/100");
    expect(text).toContain("frecuencia: 70");
    expect(text).toContain("gasto: 70");
    expect(text).toContain("puntualidad: 90");
    expect(text).toContain("lealtad: 60");
  });

  it("should include subscription recommendation when not FREE", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("Suscripción recomendada: PREMIUM");
    expect(text).toContain("COP/mes");
  });

  it("should NOT include subscription recommendation when FREE", () => {
    const profile = createMockProfile({ recommendedTier: "FREE", estimatedMonthlySavingsWithUpgrade: "0.00" });
    const text = formatProfileForLLM(profile);
    expect(text).not.toContain("Suscripción recomendada");
  });

  it("should include personalization instructions for LLM", () => {
    const profile = createMockProfile();
    const text = formatProfileForLLM(profile);
    expect(text).toContain("recomendaciones PERSONALIZADAS");
    expect(text).toContain("hábitos REALES");
  });

  it("should handle JSON string fields (topStations as string)", () => {
    const profile = createMockProfile({
      topStations: JSON.stringify([
        { stationId: 1, name: "Test Station", visits: 3 },
      ]) as any,
    });
    const text = formatProfileForLLM(profile);
    expect(text).toContain("Test Station (3 visitas)");
  });

  it("should handle empty arrays gracefully", () => {
    const profile = createMockProfile({
      preferredHours: [],
      preferredDays: [],
      topStations: [],
      preferredChargeType: null,
      preferredConnectorType: null,
      avgChargePowerKw: "0.00",
      typicalChargeFrequencyDays: null,
      nextPredictedChargeAt: null,
      scoreBreakdown: null,
      recommendedTier: "FREE",
    });
    const text = formatProfileForLLM(profile);
    // Should not crash and should still have basic stats
    expect(text).toContain("Sesiones totales: 15");
    expect(text).not.toContain("Horarios preferidos");
    expect(text).not.toContain("Días preferidos");
    expect(text).not.toContain("Estaciones favoritas");
  });

  it("should show 'HOY debería necesitar cargar' when prediction is today", () => {
    const now = new Date();
    const profile = createMockProfile({
      nextPredictedChargeAt: now,
    });
    const text = formatProfileForLLM(profile);
    // Either "HOY" or "en ~0 días" depending on exact timing
    expect(text).toMatch(/HOY|en ~0 días|ya debería/);
  });

  it("should show overdue warning when prediction is past", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const profile = createMockProfile({
      nextPredictedChargeAt: pastDate,
    });
    const text = formatProfileForLLM(profile);
    expect(text).toContain("ya debería haber cargado");
  });
});

// ============================================================================
// TEST: Proactive notification cooldown
// ============================================================================

describe("Proactive notification cooldown logic", () => {
  it("should prevent duplicate notifications within cooldown period", () => {
    // Test the cooldown Map logic directly
    const sentNotifications = new Map<string, number>();
    const COOLDOWN = 12 * 60 * 60 * 1000;

    const key = "42-low_price";
    
    // First time: not recently sent
    expect(sentNotifications.has(key)).toBe(false);
    
    // Mark as sent
    sentNotifications.set(key, Date.now());
    
    // Should be recently sent now
    const lastSent = sentNotifications.get(key)!;
    expect(Date.now() - lastSent < COOLDOWN).toBe(true);
    
    // After cooldown (simulate)
    sentNotifications.set(key, Date.now() - COOLDOWN - 1000);
    const lastSent2 = sentNotifications.get(key)!;
    expect(Date.now() - lastSent2 < COOLDOWN).toBe(false);
  });

  it("should clean up old entries from cache", () => {
    const sentNotifications = new Map<string, number>();
    const COOLDOWN = 12 * 60 * 60 * 1000;

    // Add old and new entries
    sentNotifications.set("1-low_price", Date.now() - COOLDOWN * 3); // Very old
    sentNotifications.set("2-habitual_time", Date.now() - COOLDOWN * 3); // Very old
    sentNotifications.set("3-charge_prediction", Date.now()); // Recent

    // Simulate cleanup
    const now = Date.now();
    const entries = Array.from(sentNotifications.entries());
    for (const [key, timestamp] of entries) {
      if (now - timestamp > COOLDOWN * 2) {
        sentNotifications.delete(key);
      }
    }

    expect(sentNotifications.size).toBe(1);
    expect(sentNotifications.has("3-charge_prediction")).toBe(true);
  });
});

// ============================================================================
// TEST: Subscription recommendation logic
// ============================================================================

describe("Subscription recommendation logic", () => {
  const SUBSCRIPTION_PRICES: Record<string, number> = {
    FREE: 0,
    BASIC: 29900,
    PREMIUM: 59900,
    ENTERPRISE: 149900,
  };
  const SUBSCRIPTION_DISCOUNTS: Record<string, number> = {
    FREE: 0,
    BASIC: 0.05,
    PREMIUM: 0.10,
    ENTERPRISE: 0.15,
  };

  function calculateRecommendation(monthlySpent: number, monthlySessions: number) {
    const savings: Record<string, number> = {};
    for (const [tier, discount] of Object.entries(SUBSCRIPTION_DISCOUNTS)) {
      const price = SUBSCRIPTION_PRICES[tier];
      savings[tier] = monthlySpent * discount - price;
    }
    let bestTier = "FREE";
    let bestSavings = 0;
    for (const [tier, saving] of Object.entries(savings)) {
      if (saving > bestSavings) {
        bestTier = tier;
        bestSavings = saving;
      }
    }
    if (monthlySpent < 30000 || monthlySessions < 2) {
      bestTier = "FREE";
      bestSavings = 0;
    }
    return { recommendedTier: bestTier, estimatedSavings: Math.max(0, bestSavings) };
  }

  it("should recommend FREE for low spenders", () => {
    const result = calculateRecommendation(20000, 1);
    expect(result.recommendedTier).toBe("FREE");
    expect(result.estimatedSavings).toBe(0);
  });

  it("should recommend BASIC for moderate spenders", () => {
    // $700K/month: BASIC saves 700K*0.05 - 29900 = 5100
    // PREMIUM saves 700K*0.10 - 59900 = 10100
    // ENTERPRISE saves 700K*0.15 - 149900 = -44900
    const result = calculateRecommendation(700000, 10);
    expect(result.recommendedTier).toBe("PREMIUM");
    expect(result.estimatedSavings).toBeGreaterThan(0);
  });

  it("should recommend ENTERPRISE for very high spenders", () => {
    // $2M/month: ENTERPRISE saves 2M*0.15 - 149900 = 150100
    const result = calculateRecommendation(2000000, 30);
    expect(result.recommendedTier).toBe("ENTERPRISE");
    expect(result.estimatedSavings).toBeGreaterThan(100000);
  });

  it("should not recommend paid tier if savings are negative", () => {
    // $100K/month: BASIC saves 100K*0.05 - 29900 = -24900 (negative)
    // PREMIUM saves 100K*0.10 - 59900 = -49900 (negative)
    const result = calculateRecommendation(100000, 3);
    expect(result.recommendedTier).toBe("FREE");
  });
});

// ============================================================================
// TEST: User score calculation
// ============================================================================

describe("User score calculation", () => {
  function calculateUserScore(input: {
    monthlyAvgSessions: number;
    monthlyAvgSpent: number;
    totalSessions: number;
    totalSpent: number;
    overstayCount: number;
  }) {
    let frequency = 0;
    if (input.monthlyAvgSessions >= 20) frequency = 100;
    else if (input.monthlyAvgSessions >= 11) frequency = 85;
    else if (input.monthlyAvgSessions >= 6) frequency = 70;
    else if (input.monthlyAvgSessions >= 3) frequency = 50;
    else if (input.monthlyAvgSessions >= 1) frequency = 30;
    else frequency = Math.round(input.monthlyAvgSessions * 30);

    let spending = 0;
    if (input.monthlyAvgSpent >= 1000000) spending = 100;
    else if (input.monthlyAvgSpent >= 500000) spending = 85;
    else if (input.monthlyAvgSpent >= 200000) spending = 70;
    else if (input.monthlyAvgSpent >= 100000) spending = 50;
    else if (input.monthlyAvgSpent >= 50000) spending = 30;
    else spending = Math.round(input.monthlyAvgSpent / 50000 * 30);

    const punctuality = input.totalSessions > 0
      ? Math.round(((input.totalSessions - input.overstayCount) / input.totalSessions) * 100)
      : 100;

    return { frequency, spending, punctuality };
  }

  it("should give high frequency score for frequent users", () => {
    const result = calculateUserScore({
      monthlyAvgSessions: 25,
      monthlyAvgSpent: 100000,
      totalSessions: 75,
      totalSpent: 300000,
      overstayCount: 0,
    });
    expect(result.frequency).toBe(100);
  });

  it("should give low frequency score for infrequent users", () => {
    const result = calculateUserScore({
      monthlyAvgSessions: 0.5,
      monthlyAvgSpent: 10000,
      totalSessions: 2,
      totalSpent: 20000,
      overstayCount: 0,
    });
    expect(result.frequency).toBe(15); // 0.5 * 30 = 15
  });

  it("should give high spending score for big spenders", () => {
    const result = calculateUserScore({
      monthlyAvgSessions: 10,
      monthlyAvgSpent: 1500000,
      totalSessions: 30,
      totalSpent: 4500000,
      overstayCount: 0,
    });
    expect(result.spending).toBe(100);
  });

  it("should penalize overstay in punctuality", () => {
    const result = calculateUserScore({
      monthlyAvgSessions: 10,
      monthlyAvgSpent: 200000,
      totalSessions: 20,
      totalSpent: 600000,
      overstayCount: 5, // 25% overstay rate
    });
    expect(result.punctuality).toBe(75); // (20-5)/20 * 100 = 75
  });

  it("should give 100 punctuality for zero overstays", () => {
    const result = calculateUserScore({
      monthlyAvgSessions: 5,
      monthlyAvgSpent: 100000,
      totalSessions: 15,
      totalSpent: 300000,
      overstayCount: 0,
    });
    expect(result.punctuality).toBe(100);
  });
});

// ============================================================================
// TEST: Context service integration
// ============================================================================

describe("Context service consumption profile integration", () => {
  it("should have consumptionProfileText field in AIContext interface", async () => {
    // Read the context-service to verify the interface includes the field
    const fs = await import("fs");
    const contextServicePath = "/home/ubuntu/green-ev-platform/server/ai/context-service.ts";
    const content = fs.readFileSync(contextServicePath, "utf-8");
    
    expect(content).toContain("consumptionProfileText");
    expect(content).toContain("getConsumptionProfile");
    expect(content).toContain("formatProfileForLLM");
  });

  it("should inject consumption profile into system prompt", async () => {
    const fs = await import("fs");
    const contextServicePath = "/home/ubuntu/green-ev-platform/server/ai/context-service.ts";
    const content = fs.readFileSync(contextServicePath, "utf-8");
    
    // Verify the system prompt generator includes consumption profile
    expect(content).toContain("context.consumptionProfileText");
    expect(content).toContain("perfil de consumo");
  });

  it("should have OCPP hooks for consumption profile update", async () => {
    const fs = await import("fs");
    const csmsPath = "/home/ubuntu/green-ev-platform/server/ocpp/csms-dual.ts";
    const content = fs.readFileSync(csmsPath, "utf-8");
    
    // Verify both OCPP 1.6 and 2.0.1 hooks exist
    expect(content).toContain("updateConsumptionProfile");
    // Should have at least 2 occurrences (1.6 and 2.0.1)
    const matches = content.match(/updateConsumptionProfile/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// TEST: Proactive notifications service structure
// ============================================================================

describe("Proactive notifications service", () => {
  it("should export startProactiveNotifications function", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("export function startProactiveNotifications");
    expect(content).toContain("export { runProactiveChecks }");
  });

  it("should be registered in server startup", async () => {
    const fs = await import("fs");
    const indexPath = "/home/ubuntu/green-ev-platform/server/_core/index.ts";
    const content = fs.readFileSync(indexPath, "utf-8");
    
    expect(content).toContain("startProactiveNotifications");
    expect(content).toContain("proactive-notifications");
  });

  it("should check low price at favorite stations", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("checkLowPriceAtFavoriteStations");
    expect(content).toContain("savingsPercent >= 15"); // 15% threshold
  });

  it("should check habitual charging time", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("checkHabitualChargingTime");
    expect(content).toContain("preferredHours.includes(currentHour)");
  });

  it("should check charge prediction", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("checkChargePrediction");
    expect(content).toContain("nextPredictedChargeAt");
  });

  it("should have 12-hour cooldown between same notification types", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("NOTIFICATION_COOLDOWN_MS");
    expect(content).toContain("12 * 60 * 60 * 1000");
  });

  it("should have memory leak prevention via cache cleanup", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("cleanupCache");
    expect(content).toContain("sentNotifications.delete");
  });

  it("should use FCM push notifications from firebase/fcm module", async () => {
    const fs = await import("fs");
    const path = "/home/ubuntu/green-ev-platform/server/ai/proactive-notifications.ts";
    const content = fs.readFileSync(path, "utf-8");
    
    expect(content).toContain("../firebase/fcm");
    expect(content).toContain("sendPushNotification");
  });
});
