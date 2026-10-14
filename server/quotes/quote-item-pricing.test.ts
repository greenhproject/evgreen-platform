import { describe, expect, it } from "vitest";
import { priceQuoteItems } from "../../shared/quote-item-pricing";

const catalog = [
  {
    id: 10,
    name: "Cargador DC 120 kW",
    powerKw: "120.00",
    chargeType: "DC",
    connectorType: "CCS2",
    price: 85_000_000,
    includesTransformer: 1,
    cableMetersIncluded: 10,
    imageUrl: null,
    commissionPercent: "5.00",
  },
  {
    id: 11,
    name: "Cargador DC 60 kW",
    powerKw: "60.00",
    chargeType: "DC",
    connectorType: "CCS2",
    price: 52_000_000,
    includesTransformer: 0,
    cableMetersIncluded: 10,
    imageUrl: null,
    commissionPercent: "2.50",
  },
];

describe("priceQuoteItems", () => {
  it("recalcula snapshots, subtotal y comisión usando el catálogo vigente", () => {
    const result = priceQuoteItems([
      { catalogItemId: 10, quantity: 2 },
      { catalogItemId: 11, quantity: 1 },
    ], catalog);

    expect(result.subtotal).toBe(222_000_000);
    expect(result.totalCommission).toBe(9_800_000);
    expect(result.itemsToInsert).toEqual(expect.arrayContaining([
      expect.objectContaining({ catalogItemId: 10, quantity: 2, lineTotal: 170_000_000, commissionAmount: 8_500_000 }),
      expect.objectContaining({ catalogItemId: 11, quantity: 1, lineTotal: 52_000_000, commissionAmount: 1_300_000 }),
    ]));
  });

  it("rechaza componentes duplicados y componentes inactivos o inexistentes", () => {
    expect(() => priceQuoteItems([
      { catalogItemId: 10, quantity: 1 },
      { catalogItemId: 10, quantity: 2 },
    ], catalog)).toThrow("Cada componente");

    expect(() => priceQuoteItems([
      { catalogItemId: 99, quantity: 1 },
    ], catalog)).toThrow("no están disponibles");
  });
});
