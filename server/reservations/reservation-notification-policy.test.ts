import { describe, expect, it } from "vitest";
import {
  getReservationEventMessage,
  getReservationWhatsAppEventType,
  getReservationWhatsAppParameters,
} from "../../shared/reservation-notification-policy";

describe("reservation notification policy", () => {
  const context = {
    stationName: "EVG Diamante",
    startTime: new Date("2026-09-20T15:30:00.000Z"),
    connectorLabel: "CCS2 · 1",
  };

  it("creates a clear confirmation without claiming a delivery channel", () => {
    const message = getReservationEventMessage("confirmed", context);
    expect(message).toContain("EVG Diamante");
    expect(message).toContain("fue confirmada");
    expect(message).not.toContain("WhatsApp");
  });

  it("provides concise positional utility-template parameters for every reservation event", () => {
    const parameters = getReservationWhatsAppParameters("María José", "reminder_5m", context);
    expect(parameters).toHaveLength(3);
    expect(parameters[0]).toBe("María");
    expect(parameters[1]).toBe("En 5 minutos");
    expect(parameters[2]).toBe("EVG Diamante");
  });

  it("maps each lifecycle event to an auditable WhatsApp log type", () => {
    expect(getReservationWhatsAppEventType("confirmed")).toBe("reservation_confirmed");
    expect(getReservationWhatsAppEventType("reminder_30m")).toBe("reservation_reminder");
    expect(getReservationWhatsAppEventType("check_in")).toBe("reservation_started");
    expect(getReservationWhatsAppEventType("cancelled")).toBe("reservation_cancelled");
    expect(getReservationWhatsAppEventType("no_show_penalty")).toBe("reservation_no_show");
  });
});
