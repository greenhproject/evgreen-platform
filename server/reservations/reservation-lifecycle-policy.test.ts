import { describe, expect, it } from "vitest";
import {
  calculateReservationExpiryTime,
  canReleasePhysicalReservation,
  canUserStartOnReservedConnector,
  getOcppConnectorId,
  isOcppReservationAccepted,
  isReservationActiveNow,
  isReservationHoldingConnector,
  RESERVATION_HOLD_WINDOW_MINUTES,
  shouldMarkReservationAsNoShow,
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

  it("identifies when a reservation is currently in session (active now)", () => {
    // En curso: empezó hace 10 min y termina en 50 min
    expect(isReservationActiveNow(activeReservation(-10, 50), NOW)).toBe(true);
    // Futura: empieza en 15 min
    expect(isReservationActiveNow(activeReservation(15, 75), NOW)).toBe(false);
    // Pasada: terminó hace 5 min
    expect(isReservationActiveNow(activeReservation(-65, -5), NOW)).toBe(false);
  });

  it("prevents premature no-show while the user is still within their reserved time window", () => {
    // A los 16 minutos de haber iniciado una reserva de 60 minutos: NO debe marcarse como no-show
    expect(shouldMarkReservationAsNoShow(activeReservation(-16, 44), NOW)).toBe(false);
    // Cuando la ventana completa terminó: SÍ se marca como no-show
    expect(shouldMarkReservationAsNoShow(activeReservation(-61, -1), NOW)).toBe(true);
  });

  it("calculates expiry time matching full reservation duration", () => {
    const start = new Date("2026-09-19T02:00:00.000Z");
    const end = new Date("2026-09-19T03:00:00.000Z");
    const expiry = calculateReservationExpiryTime(start, end);
    expect(expiry.getTime()).toBe(end.getTime());
  });
});
