import { describe, expect, it } from "vitest";
import { resolveOverstayPolicy } from "./overstay-policy";

describe("política autoritativa de sobreestadía", () => {
  it("respeta $0 configurado en la estación y no cae a la tarifa histórica de $500", () => {
    expect(resolveOverstayPolicy({
      stationOccupancyRatePerMinute: 0,
      tariffPenaltyPerMinute: 500,
      globalPenaltyPerMinute: 500,
      tariffGracePeriodMinutes: 10,
      globalGracePeriodMinutes: 10,
    })).toEqual({
      penaltyPerMinute: 0,
      gracePeriodMinutes: 10,
      source: "station",
      enabled: false,
    });
  });

  it("usa una tarifa positiva configurada directamente en la estación", () => {
    const policy = resolveOverstayPolicy({
      stationOccupancyRatePerMinute: "700",
      tariffPenaltyPerMinute: 500,
      globalPenaltyPerMinute: 400,
      tariffGracePeriodMinutes: 8,
      globalGracePeriodMinutes: 10,
    });

    expect(policy).toMatchObject({ penaltyPerMinute: 700, source: "station", enabled: true });
  });

  it("solo usa tarifa o global cuando la estación no tiene un valor heredado", () => {
    expect(resolveOverstayPolicy({
      stationOccupancyRatePerMinute: null,
      tariffPenaltyPerMinute: 350,
      globalPenaltyPerMinute: 500,
      tariffGracePeriodMinutes: null,
      globalGracePeriodMinutes: 12,
    })).toMatchObject({ penaltyPerMinute: 350, gracePeriodMinutes: 12, source: "tariff" });

    expect(resolveOverstayPolicy({
      stationOccupancyRatePerMinute: undefined,
      tariffPenaltyPerMinute: undefined,
      globalPenaltyPerMinute: 450,
      tariffGracePeriodMinutes: undefined,
      globalGracePeriodMinutes: 15,
    })).toMatchObject({ penaltyPerMinute: 450, gracePeriodMinutes: 15, source: "global" });
  });
});
