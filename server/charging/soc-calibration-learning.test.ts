import { describe, expect, it } from "vitest";
import { learnEffectiveSocCapacity } from "../../shared/soc-calibration-learning";

describe("adaptive SOC calibration learning", () => {
  it("keeps the declared capacity as the first absolute calibration anchor", () => {
    expect(learnEffectiveSocCapacity({
      previousSoc: null,
      previousEnergyKwh: null,
      observedSoc: 35,
      currentEnergyKwh: 12,
      declaredCapacityKwh: 60,
      effectiveCapacityKwh: null,
      calibrationCount: null,
    })).toMatchObject({
      effectiveCapacityKwh: 60,
      calibrationCount: 0,
      learned: false,
      reason: "first_anchor",
    });
  });

  it("learns from a subsequent real vehicle observation instead of repeating the old error", () => {
    // 3 kWh raised the vehicle from 35% to 40%, equivalent to 60 kWh. The
    // current effective estimate was biased low at 50 kWh, so it must move up.
    const learned = learnEffectiveSocCapacity({
      previousSoc: 35,
      previousEnergyKwh: 12,
      observedSoc: 40,
      currentEnergyKwh: 15,
      declaredCapacityKwh: 60,
      effectiveCapacityKwh: 50,
      calibrationCount: 0,
    });

    expect(learned).toMatchObject({
      learned: true,
      candidateCapacityKwh: 60,
      calibrationCount: 1,
      reason: "learned",
    });
    expect(learned.effectiveCapacityKwh).toBeGreaterThan(50);
    expect(learned.effectiveCapacityKwh).toBeLessThanOrEqual(60);
  });

  it("rejects one physically implausible manual observation", () => {
    const learned = learnEffectiveSocCapacity({
      previousSoc: 40,
      previousEnergyKwh: 15,
      observedSoc: 41,
      currentEnergyKwh: 24,
      declaredCapacityKwh: 60,
      effectiveCapacityKwh: 60,
      calibrationCount: 1,
    });

    expect(learned).toMatchObject({
      learned: false,
      candidateCapacityKwh: null,
      effectiveCapacityKwh: 60,
      reason: "invalid_candidate",
    });
  });

  it("does not learn when the observation has not advanced enough to be reliable", () => {
    expect(learnEffectiveSocCapacity({
      previousSoc: 35,
      previousEnergyKwh: 12,
      observedSoc: 36,
      currentEnergyKwh: 12.1,
      declaredCapacityKwh: 60,
      effectiveCapacityKwh: 60,
      calibrationCount: 0,
    })).toMatchObject({ learned: false, reason: "insufficient_energy", effectiveCapacityKwh: 60 });
  });

  it("resets the learning baseline when an operator explicitly corrects battery capacity", () => {
    expect(learnEffectiveSocCapacity({
      previousSoc: 35,
      previousEnergyKwh: 12,
      observedSoc: 40,
      currentEnergyKwh: 15,
      declaredCapacityKwh: 72,
      effectiveCapacityKwh: 60,
      calibrationCount: 4,
      capacityWasExplicitlyProvided: true,
    })).toMatchObject({
      effectiveCapacityKwh: 72,
      calibrationCount: 0,
      learned: false,
      reason: "capacity_explicitly_set",
    });
  });
});
