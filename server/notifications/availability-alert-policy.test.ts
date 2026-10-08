import { describe, expect, it } from "vitest";
import { resolveAvailabilityAttempt } from "./availability-alert-policy";

describe("resolveAvailabilityAttempt", () => {
  it("finaliza cuando al menos un canal solicitado se confirma, sin reintentos", () => {
    expect(resolveAvailabilityAttempt({ attemptCount: 1, pushStatus: "SENT", whatsappStatus: "NOT_REQUESTED" }))
      .toEqual({ alertStatus: "SENT", nextDelayMinutes: null });
  });

  it("reintenta un fallo temporal de proveedor con backoff acotado", () => {
    expect(resolveAvailabilityAttempt({ attemptCount: 1, pushStatus: "FAILED", whatsappStatus: "NOT_REQUESTED" }))
      .toEqual({ alertStatus: "PENDING", nextDelayMinutes: 5 });
    expect(resolveAvailabilityAttempt({ attemptCount: 3, pushStatus: "FAILED", whatsappStatus: "NOT_REQUESTED" }))
      .toEqual({ alertStatus: "EXPIRED", nextDelayMinutes: null });
  });

  it("mantiene una alerta para WhatsApp mientras la plantilla de Meta sigue en revisión", () => {
    expect(resolveAvailabilityAttempt({ attemptCount: 1, pushStatus: "NOT_REQUESTED", whatsappStatus: "WAITING_TEMPLATE" }))
      .toEqual({ alertStatus: "PENDING", nextDelayMinutes: 60 });
    expect(resolveAvailabilityAttempt({ attemptCount: 24, pushStatus: "NOT_REQUESTED", whatsappStatus: "WAITING_TEMPLATE" }))
      .toEqual({ alertStatus: "EXPIRED", nextDelayMinutes: null });
  });

  it("no confunde la ausencia de canales con una entrega exitosa", () => {
    expect(resolveAvailabilityAttempt({ attemptCount: 1, pushStatus: "NOT_AVAILABLE", whatsappStatus: "NO_PHONE" }))
      .toEqual({ alertStatus: "EXPIRED", nextDelayMinutes: null });
  });
});
