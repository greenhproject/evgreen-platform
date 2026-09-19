import { describe, expect, it } from "vitest";
import {
  canReleasePhysicalReservation,
  canUserStartOnReservedConnector,
  getOcppConnectorId,
  isOcppReservationAccepted,
  isReservationHoldingConnector,
  RESERVATION_HOLD_WINDOW_MINUTES,
} from "../../shared/reservation-lifecycle-policy";

const NOW = new Date("2026-09-19T02:00:00.000Z");

function activeReservation(startOffsetMinutes: number, endOffsetMinutes: number) {
  return {
    reservationStatus: "ACTIVE",
    startTime: new Date(NOW.getTime() + startOffsetMinutes * 60_000),
    endTime: new Date(NOW.getTime() + endOffsetMinutes * 60_000),
  };
}

describe("reservation lifecycle policy", () => {
  it("only locks a connector from the configured hold window through the reservation end", () => {
    expect(isReservationHoldingConnector(activeReservation(RESERVATION_HOLD_WINDOW_MINUTES + 1, 90), NOW)).toBe(false);
    expect(isReservationHoldingConnector(activeReservation(RESERVATION_HOLD_WINDOW_MINUTES, 90), NOW)).toBe(true);
    expect(isReservationHoldingConnector(activeReservation(-5, 30), NOW)).toBe(true);
    expect(isReservationHoldingConnector(activeReservation(-90, -1), NOW)).toBe(false);
  });

  it("does not hold a connector for a cancelled or fulfilled reservation", () => {
    expect(isReservationHoldingConnector({ ...activeReservation(-5, 30), reservationStatus: "CANCELLED" }, NOW)).toBe(false);
    expect(isReservationHoldingConnector({ ...activeReservation(-5, 30), reservationStatus: "FULFILLED" }, NOW)).toBe(false);
  });

  it("allows only the reservation owner to start on a reserved connector", () => {
    expect(canUserStartOnReservedConnector(42, 42)).toBe(true);
    expect(canUserStartOnReservedConnector(42, 7)).toBe(false);
    expect(canUserStartOnReservedConnector(null, 42)).toBe(false);
  });

  it("requires an explicit OCPP acceptance before treating a physical reservation as active or released", () => {
    expect(isOcppReservationAccepted({ status: "Accepted" })).toBe(true);
    expect(isOcppReservationAccepted({ status: "Rejected" })).toBe(false);
    expect(canReleasePhysicalReservation(123, { status: "Accepted" })).toBe(true);
    expect(canReleasePhysicalReservation(123, { status: "Rejected" })).toBe(false);
    expect(canReleasePhysicalReservation(null, undefined)).toBe(true);
  });

  it("uses the local EVSE identifier for OCPP commands", () => {
    expect(getOcppConnectorId({ evseIdLocal: 3, connectorId: 1 })).toBe(3);
    expect(getOcppConnectorId({ connectorId: 2 })).toBe(2);
  });
});
