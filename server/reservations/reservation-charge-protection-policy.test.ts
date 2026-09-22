import { describe, expect, it } from "vitest";
import {
  evaluateReservationChargeProtection,
  RESERVATION_CHARGE_RELEASE_BUFFER_MINUTES,
} from "../../shared/reservation-charge-protection-policy";
import { estimateChargePlan } from "../../shared/charge-plan-estimate";

describe("reservation charge protection", () => {
  const now = new Date("2026-09-22T22:30:00.000Z");

  it("blocks a full charge that would invade another user's reserved release window", () => {
    const protection = evaluateReservationChargeProtection({
      now,
      currentUserId: 10,
      estimatedMinutes: 60,
      nextReservation: {
        id: 88,
        userId: 20,
        startTime: "2026-09-22T23:00:00.000Z",
      },
    });

    expect(RESERVATION_CHARGE_RELEASE_BUFFER_MINUTES).toBe(15);
    expect(protection.status).toBe("BLOCKED");
    expect(protection.maxEstimatedMinutes).toBe(15);
    expect(protection.reservationId).toBe(88);
  });

  it("allows a compatible short charge before the 15-minute release buffer", () => {
    const protection = evaluateReservationChargeProtection({
      now,
      currentUserId: 10,
      estimatedMinutes: 15,
      nextReservation: {
        userId: 20,
        startTime: "2026-09-22T23:00:00.000Z",
      },
    });

    expect(protection.status).toBe("COMPATIBLE");
  });

  it("does not restrict the reservation owner using their own future slot", () => {
    const protection = evaluateReservationChargeProtection({
      now,
      currentUserId: 20,
      estimatedMinutes: 60,
      nextReservation: {
        userId: 20,
        startTime: "2026-09-22T23:00:00.000Z",
      },
    });

    expect(protection.status).toBe("OWNER");
  });

  it("derives the same duration used by the charge planner", () => {
    const plan = estimateChargePlan({
      chargeMode: "full_charge",
      targetValue: 100,
      pricePerKwh: 1800,
      powerKw: 120,
    });

    expect(plan.estimatedKwh).toBe(48);
    expect(plan.estimatedTimeMinutes).toBe(24);
    expect(plan.estimatedCost).toBe(86400);
  });
});
