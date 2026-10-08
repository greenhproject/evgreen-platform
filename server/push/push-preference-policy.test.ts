import { describe, expect, it } from "vitest";
import { isPushNotificationAllowed } from "./push-preference-policy";

describe("Push notification preference policy", () => {
  it("suppresses only charge-complete Push when the user disables it", () => {
    expect(isPushNotificationAllowed({ notifyChargingComplete: 0 }, "charging_complete")).toBe(false);
    expect(isPushNotificationAllowed({ notifyChargingComplete: 0 }, "charging_started")).toBe(true);
    expect(isPushNotificationAllowed({ notifyChargingComplete: 0 }, "overstay_alert")).toBe(true);
  });

  it("suppresses only low-balance Push when the user disables it", () => {
    expect(isPushNotificationAllowed({ notifyLowBalance: false }, "low_balance")).toBe(false);
    expect(isPushNotificationAllowed({ notifyLowBalance: false }, "charging_error")).toBe(true);
    expect(isPushNotificationAllowed({ notifyLowBalance: false }, "balance_added")).toBe(true);
  });

  it("honors the promotions preference while preserving critical alerts", () => {
    expect(isPushNotificationAllowed({ notifyPromotions: 0 }, "promotion")).toBe(false);
    expect(isPushNotificationAllowed({ notifyPromotions: 0 }, "payment_failed")).toBe(true);
  });

  it("keeps existing users opted in when a preference is missing", () => {
    expect(isPushNotificationAllowed({}, "charging_complete")).toBe(true);
    expect(isPushNotificationAllowed({}, "low_balance")).toBe(true);
    expect(isPushNotificationAllowed({}, "promotion")).toBe(true);
  });
});
