import { describe, expect, it } from "vitest";
import { hasAuthoritativeSoc, shouldStopForSocTarget } from "../../client/src/lib/charging-soc";

describe("charging monitor SOC stopping rules", () => {
  it("never stops from a percentage when the server has no SOC source", () => {
    expect(shouldStopForSocTarget({
      soc: 100,
      source: "none",
      chargeMode: "percentage",
      targetPercentage: 80,
    })).toBe(false);
  });

  it("does not stop immediately after an absolute late calibration below target", () => {
    expect(shouldStopForSocTarget({
      soc: 35,
      source: "manual",
      chargeMode: "percentage",
      targetPercentage: 80,
    })).toBe(false);
  });

  it("stops when an authoritative manual estimate reaches the target", () => {
    expect(shouldStopForSocTarget({
      soc: 80,
      source: "manual",
      chargeMode: "percentage",
      targetPercentage: 80,
    })).toBe(true);
  });

  it("accepts OCPP and power-detection SOC as authoritative", () => {
    expect(hasAuthoritativeSoc(76, "charger")).toBe(true);
    expect(hasAuthoritativeSoc(100, "power_detection")).toBe(true);
  });
});
