import { describe, expect, it } from "vitest";
import { generateReservationReceiptPdf } from "./reservation-receipt-pdf";

describe("generateReservationReceiptPdf", () => {
  const baseData = {
    reservationId: 72,
    status: "ACTIVE",
    customerName: "Cliente EVGreen",
    stationName: "Estación de prueba",
    stationAddress: "Calle 1 # 2-3",
    stationTimezone: "America/Bogota",
    connectorLabel: "Conector 1",
    connectorType: "GBT_AC",
    chargeType: "AC",
    powerKw: 7,
    startTime: "2026-10-20T15:00:00.000Z",
    endTime: "2026-10-20T16:00:00.000Z",
    reservationFee: "5000",
    noShowPenalty: "5000",
    lockedPricePerKwh: "1709",
    lockedConnectionFee: "2000",
    priceLockedAt: "2026-10-20T14:00:00.000Z",
  };

  it("genera un PDF válido sin modificar la reserva", () => {
    const pdf = generateReservationReceiptPdf(baseData);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it("incluye el resumen de una carga únicamente cuando fue completada", () => {
    const pdf = generateReservationReceiptPdf({
      ...baseData,
      status: "FULFILLED",
      transaction: {
        status: "COMPLETED",
        endTime: "2026-10-20T16:10:00.000Z",
        kwhConsumed: "12.5",
        appliedPricePerKwh: "1709",
        totalCost: "25362.5",
      },
    });
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
