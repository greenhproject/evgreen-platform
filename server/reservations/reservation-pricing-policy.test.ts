import { describe, expect, it } from "vitest";
import { resolveReservationPricing } from "../../shared/reservation-pricing-policy";

describe("política de tarifa de reserva", () => {
  it("conserva precio y conexión bloqueados aunque la tarifa actual cambie", () => {
    expect(resolveReservationPricing({
      lockedPricePerKwh: "1709",
      lockedConnectionFee: "2000",
      pendingPricePerKwh: "1800",
      currentPricePerKwh: 2200,
      currentConnectionFee: 3500,
    })).toEqual({
      pricePerKwh: 1709,
      connectionFee: 2000,
      usesLockedPrice: true,
      usesLockedConnectionFee: true,
    });
  });

  it("respeta un cargo congelado de cero", () => {
    expect(resolveReservationPricing({
      lockedPricePerKwh: 1850,
      lockedConnectionFee: 0,
      currentPricePerKwh: 2000,
      currentConnectionFee: 2000,
    })).toMatchObject({
      pricePerKwh: 1850,
      connectionFee: 0,
      usesLockedPrice: true,
      usesLockedConnectionFee: true,
    });
  });

  it("mantiene compatibilidad con reservas históricas sin snapshot", () => {
    expect(resolveReservationPricing({
      lockedPricePerKwh: null,
      lockedConnectionFee: null,
      pendingPricePerKwh: 1750,
      currentPricePerKwh: 1900,
      currentConnectionFee: 1000,
    })).toEqual({
      pricePerKwh: 1750,
      connectionFee: 1000,
      usesLockedPrice: false,
      usesLockedConnectionFee: false,
    });
  });
});
