import { describe, expect, it } from "vitest";
import {
  buildChargingStartedNotification,
  type ChargingStartedNotificationInput,
} from "../../shared/charging-start-notification";

const snapshot: ChargingStartedNotificationInput = {
  transactionId: 201,
  userId: 88,
  stationName: "EVGreen Diamante",
  connectorId: 2,
  startTime: "2026-11-02 18:30:00",
  appliedPricePerKwh: "1450.50",
  appliedConnectionFee: "2500.00",
};

// No database/provider imports: this suite constructs values and nothing else.
describe("buildChargingStartedNotification", () => {
  it("incluye fecha, hora, zona, sesión y ambos componentes congelados", () => {
    const event = buildChargingStartedNotification(snapshot);
    expect(event.title).toBe("Carga iniciada");
    expect(event.body).toContain("02/11/2026 13:30:00 (America/Bogota)");
    expect(event.body).toContain("Sesión #201");
    expect(event.body).toContain("EVGreen Diamante · Conector 2");
    expect(event.body).toContain("Tarifa congelada: 1.450,5 COP/kWh");
    expect(event.body).toContain("Conexión: 2.500 COP");
    expect(event.data).toMatchObject({
      eventId: "charging.started:201",
      transactionId: "201",
      pricePerKwh: "1450.5",
      connectionFee: "2500",
      occurredAt: "2026-11-02T18:30:00.000Z",
      startTime: "2026-11-02T18:30:00.000Z",
      stationName: "EVGreen Diamante",
      notificationTag: "charging-started:88",
    });
    expect(Object.values(event.data).every(value => typeof value === "string")).toBe(true);
  });

  it("separa las sesiones del 2 y 3 de noviembre y sus precios, sin usar la hora actual", () => {
    const previous = buildChargingStartedNotification(snapshot);
    const current = buildChargingStartedNotification({
      ...snapshot,
      transactionId: 202,
      startTime: "2026-11-03T18:30:00Z",
      appliedPricePerKwh: "1800.00",
      appliedConnectionFee: "3000.00",
    });
    expect(previous.body).toContain("02/11/2026");
    expect(current.body).toContain("03/11/2026");
    expect(previous.data.pricePerKwh).toBe("1450.5");
    expect(current.data.pricePerKwh).toBe("1800");
    expect(previous.data.connectionFee).toBe("2500");
    expect(current.data.connectionFee).toBe("3000");
    expect(previous.data.eventId).not.toBe(current.data.eventId);
    expect(previous.data.notificationTag).toBe(current.data.notificationTag);
  });

  it("aplica la fecha local del día anterior al cruzar medianoche UTC", () => {
    const event = buildChargingStartedNotification({ ...snapshot, startTime: "2026-11-03 02:30:00" });
    expect(event.body).toContain("02/11/2026 21:30:00");
    expect(event.data.startTime).toBe("2026-11-03T02:30:00.000Z");
  });

  it.each([
    "2026-11-02 18:30:00",
    "2026-11-02T18:30:00Z",
    "2026-11-02T13:30:00-05:00",
    new Date("2026-11-02T18:30:00Z"),
    Date.parse("2026-11-02T18:30:00Z"),
  ])("normaliza el mismo instante sin depender de la zona del proceso: %s", startTime => {
    const event = buildChargingStartedNotification({ ...snapshot, startTime });
    expect(event.data.occurredAt).toBe("2026-11-02T18:30:00.000Z");
    expect(event.body).toContain("02/11/2026 13:30:00");
  });

  it("admite una zona explícita diferente de Bogotá", () => {
    const event = buildChargingStartedNotification({ ...snapshot, timeZone: "UTC" });
    expect(event.body).toContain("02/11/2026 18:30:00 (UTC)");
    expect(event.data.timeZone).toBe("UTC");
  });

  it.each([0, "0", "0.00"])("cero es una tarifa y una conexión válidas: %s", zero => {
    const event = buildChargingStartedNotification({ ...snapshot, appliedPricePerKwh: zero, appliedConnectionFee: zero });
    expect(event.body).toContain("Tarifa congelada: 0 COP/kWh");
    expect(event.body).toContain("Conexión: 0 COP");
    expect(event.data.pricePerKwh).toBe("0");
    expect(event.data.connectionFee).toBe("0");
  });

  it.each([null, undefined])("conexión histórica ausente se conserva desconocida, no gratuita: %s", appliedConnectionFee => {
    const event = buildChargingStartedNotification({ ...snapshot, appliedConnectionFee });
    expect(event.body).toContain("Conexión: no registrada en esta sesión");
    expect(event.body).not.toContain("Conexión: 0 COP");
    expect(event.data.connectionFee).toBe("");
  });

  it.each([null, undefined, "", " ", "NaN", "Infinity", "1.450,50", "0x10", "not-a-price", "-1", -1, NaN, Infinity])(
    "rechaza tarifa ausente o inválida sin fallback comercial: %s", appliedPricePerKwh => {
      expect(() => buildChargingStartedNotification({ ...snapshot, appliedPricePerKwh }))
        .toThrow("appliedPricePerKwh");
    },
  );

  it.each(["", "NaN", "-5", -5, Infinity])("rechaza una conexión capturada inválida: %s", appliedConnectionFee => {
    expect(() => buildChargingStartedNotification({ ...snapshot, appliedConnectionFee }))
      .toThrow("appliedConnectionFee");
  });

  it.each(["", "not-a-date", new Date(NaN), NaN])("rechaza fecha inválida sin sustituir por ahora: %s", startTime => {
    expect(() => buildChargingStartedNotification({ ...snapshot, startTime })).toThrow("startTime");
  });

  it("rechaza zona inválida y no cambia el input", () => {
    const frozen = Object.freeze({ ...snapshot });
    expect(buildChargingStartedNotification(frozen)).toEqual(buildChargingStartedNotification(snapshot));
    expect(() => buildChargingStartedNotification({ ...snapshot, timeZone: "Invalid/Timezone" })).toThrow();
  });
});
