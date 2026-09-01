import { describe, expect, it } from "vitest";
import {
  USER_ONBOARDING_STEPS,
  USER_ONBOARDING_VERSION,
  canShowUserOnboarding,
  normalizeOnboardingName,
  shouldRequireBillingFields,
} from "../shared/user-onboarding";

describe("contrato del onboarding de usuario", () => {
  it("mantiene una secuencia de pasos explícita y versionada", () => {
    expect(USER_ONBOARDING_VERSION).toBe("2026-08-v1");
    expect(USER_ONBOARDING_STEPS).toEqual({
      welcome: 1,
      profile: 2,
      vehicle: 3,
      billing: 4,
      notifications: 5,
      complete: 6,
    });
  });

  it("solo muestra la activación a usuarios finales sin progreso terminado o aplazado", () => {
    expect(canShowUserOnboarding("user", null)).toBe(true);
    expect(canShowUserOnboarding("user", "IN_PROGRESS")).toBe(true);
    expect(canShowUserOnboarding("user", "COMPLETED")).toBe(false);
    expect(canShowUserOnboarding("user", "SKIPPED")).toBe(false);
    expect(canShowUserOnboarding("admin", null)).toBe(false);
    expect(canShowUserOnboarding("advertiser", "IN_PROGRESS")).toBe(false);
  });

  it("normaliza los nombres de usuario antes de persistirlos", () => {
    expect(normalizeOnboardingName("  Ana  ", "  María   Pérez ")).toBe("Ana María Pérez");
  });

  it("solicita datos tributarios solo cuando el usuario activa facturación electrónica", () => {
    expect(shouldRequireBillingFields(true)).toBe(true);
    expect(shouldRequireBillingFields(false)).toBe(false);
  });
});
