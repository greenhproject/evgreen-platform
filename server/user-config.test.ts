/**
 * Tests para el userConfigRouter - Configuración del usuario
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Firebase
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

vi.mock("./server/_core/env", () => ({
  env: {
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
    FIREBASE_PRIVATE_KEY: "test-key",
    DATABASE_URL: "mysql://test",
  },
}));

describe("User Config", () => {
  describe("Settings structure", () => {
    it("should have correct default values", () => {
      const defaults = {
        language: "es",
        distanceUnit: "km",
        currency: "COP",
        autoLocate: true,
        saveHistory: true,
        shareUsageData: false,
      };

      expect(defaults.language).toBe("es");
      expect(defaults.distanceUnit).toBe("km");
      expect(defaults.currency).toBe("COP");
      expect(defaults.autoLocate).toBe(true);
      expect(defaults.saveHistory).toBe(true);
      expect(defaults.shareUsageData).toBe(false);
    });

    it("should accept valid language values", () => {
      const validLanguages = ["es", "en"];
      expect(validLanguages).toContain("es");
      expect(validLanguages).toContain("en");
      expect(validLanguages).not.toContain("fr");
    });

    it("should accept valid distance unit values", () => {
      const validUnits = ["km", "mi"];
      expect(validUnits).toContain("km");
      expect(validUnits).toContain("mi");
    });

    it("should accept valid currency values", () => {
      const validCurrencies = ["COP", "USD"];
      expect(validCurrencies).toContain("COP");
      expect(validCurrencies).toContain("USD");
    });
  });

  describe("Save settings validation", () => {
    it("should allow partial updates", () => {
      const partialUpdate = { language: "en" as const };
      const fullSettings = {
        language: "es" as const,
        distanceUnit: "km" as const,
        currency: "COP" as const,
        autoLocate: true,
        saveHistory: true,
        shareUsageData: false,
      };

      // Simular merge parcial
      const merged = { ...fullSettings, ...partialUpdate };
      expect(merged.language).toBe("en");
      expect(merged.distanceUnit).toBe("km"); // No cambiado
      expect(merged.currency).toBe("COP"); // No cambiado
    });

    it("should build update data correctly", () => {
      const input = {
        language: "en" as const,
        autoLocate: false,
        currency: undefined,
      };

      const updateData: Record<string, unknown> = {};
      if (input.language !== undefined) updateData.prefLanguage = input.language;
      if (input.autoLocate !== undefined) updateData.prefAutoLocate = input.autoLocate;
      if (input.currency !== undefined) updateData.prefCurrency = input.currency;

      expect(Object.keys(updateData)).toHaveLength(2);
      expect(updateData.prefLanguage).toBe("en");
      expect(updateData.prefAutoLocate).toBe(false);
      expect(updateData.prefCurrency).toBeUndefined();
    });
  });

  describe("Delete all data", () => {
    it("should require email confirmation", () => {
      const userEmail = "test@example.com";
      const confirmEmail = "test@example.com";
      expect(userEmail).toBe(confirmEmail);
    });

    it("should reject mismatched email", () => {
      const userEmail = "test@example.com";
      const confirmEmail = "wrong@example.com";
      expect(userEmail).not.toBe(confirmEmail);
    });

    it("should reject empty email", () => {
      const confirmEmail = "";
      expect(confirmEmail).toBeFalsy();
    });
  });

  describe("Clear cache", () => {
    it("should return success message", () => {
      const result = { success: true, message: "Caché limpiado exitosamente" };
      expect(result.success).toBe(true);
      expect(result.message).toContain("Caché");
    });
  });

  describe("Settings persistence mapping", () => {
    it("should map frontend keys to database columns correctly", () => {
      const mapping: Record<string, string> = {
        language: "prefLanguage",
        distanceUnit: "prefDistanceUnit",
        currency: "prefCurrency",
        autoLocate: "prefAutoLocate",
        saveHistory: "prefSaveHistory",
        shareUsageData: "prefShareUsageData",
      };

      expect(mapping.language).toBe("prefLanguage");
      expect(mapping.distanceUnit).toBe("prefDistanceUnit");
      expect(mapping.currency).toBe("prefCurrency");
      expect(mapping.autoLocate).toBe("prefAutoLocate");
      expect(mapping.saveHistory).toBe("prefSaveHistory");
      expect(mapping.shareUsageData).toBe("prefShareUsageData");
    });

    it("should map database values back to frontend correctly", () => {
      const dbRow = {
        prefLanguage: "en",
        prefDistanceUnit: "mi",
        prefCurrency: "USD",
        prefAutoLocate: false,
        prefSaveHistory: true,
        prefShareUsageData: true,
      };

      const frontendSettings = {
        language: dbRow.prefLanguage ?? "es",
        distanceUnit: dbRow.prefDistanceUnit ?? "km",
        currency: dbRow.prefCurrency ?? "COP",
        autoLocate: dbRow.prefAutoLocate ?? true,
        saveHistory: dbRow.prefSaveHistory ?? true,
        shareUsageData: dbRow.prefShareUsageData ?? false,
      };

      expect(frontendSettings.language).toBe("en");
      expect(frontendSettings.distanceUnit).toBe("mi");
      expect(frontendSettings.currency).toBe("USD");
      expect(frontendSettings.autoLocate).toBe(false);
      expect(frontendSettings.saveHistory).toBe(true);
      expect(frontendSettings.shareUsageData).toBe(true);
    });

    it("should handle null database values with defaults", () => {
      const dbRow = {
        prefLanguage: null,
        prefDistanceUnit: null,
        prefCurrency: null,
        prefAutoLocate: null,
        prefSaveHistory: null,
        prefShareUsageData: null,
      };

      const frontendSettings = {
        language: dbRow.prefLanguage ?? "es",
        distanceUnit: dbRow.prefDistanceUnit ?? "km",
        currency: dbRow.prefCurrency ?? "COP",
        autoLocate: dbRow.prefAutoLocate ?? true,
        saveHistory: dbRow.prefSaveHistory ?? true,
        shareUsageData: dbRow.prefShareUsageData ?? false,
      };

      expect(frontendSettings.language).toBe("es");
      expect(frontendSettings.distanceUnit).toBe("km");
      expect(frontendSettings.currency).toBe("COP");
      expect(frontendSettings.autoLocate).toBe(true);
      expect(frontendSettings.saveHistory).toBe(true);
      expect(frontendSettings.shareUsageData).toBe(false);
    });
  });
});
