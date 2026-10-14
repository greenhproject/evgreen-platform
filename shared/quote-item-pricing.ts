export type QuoteItemSelection = {
  catalogItemId: number;
  quantity: number;
};

export type CatalogQuoteComponent = {
  id: number;
  name: string;
  powerKw: string | number;
  chargeType: string;
  connectorType: string;
  price: number;
  includesTransformer: number | boolean | null;
  cableMetersIncluded: number | null;
  imageUrl: string | null;
  commissionPercent: string | number | null;
};

export type PricedQuoteItem = {
  catalogItemId: number;
  productName: string;
  productPowerKw: string | number;
  productChargeType: string;
  productConnector: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  includesTransformer: number | boolean | null;
  cableMetersIncluded: number | null;
  productImageUrl: string | null;
  commissionPercent: string;
  commissionAmount: number;
};

export function priceQuoteItems(
  selections: QuoteItemSelection[],
  catalogItems: CatalogQuoteComponent[],
): { itemsToInsert: PricedQuoteItem[]; subtotal: number; totalCommission: number } {
  const requestedIds = selections.map((item) => item.catalogItemId);
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error("Cada componente solo puede aparecer una vez en la cotización.");
  }
  if (catalogItems.length !== requestedIds.length) {
    throw new Error("Uno o más productos no están disponibles.");
  }

  let subtotal = 0;
  let totalCommission = 0;
  const itemsToInsert = selections.map((item) => {
    const catalogItem = catalogItems.find((catalog) => catalog.id === item.catalogItemId);
    if (!catalogItem) throw new Error("Uno o más productos no están disponibles.");

    const lineTotal = catalogItem.price * item.quantity;
    const commissionPercent = Number.parseFloat(String(catalogItem.commissionPercent ?? "0")) || 0;
    const commissionAmount = Math.round((lineTotal * commissionPercent) / 100);
    subtotal += lineTotal;
    totalCommission += commissionAmount;

    return {
      catalogItemId: catalogItem.id,
      productName: catalogItem.name,
      productPowerKw: catalogItem.powerKw,
      productChargeType: catalogItem.chargeType,
      productConnector: catalogItem.connectorType,
      unitPrice: catalogItem.price,
      quantity: item.quantity,
      lineTotal,
      includesTransformer: catalogItem.includesTransformer,
      cableMetersIncluded: catalogItem.cableMetersIncluded,
      productImageUrl: catalogItem.imageUrl || null,
      commissionPercent: commissionPercent.toFixed(2),
      commissionAmount,
    };
  });

  return { itemsToInsert, subtotal, totalCommission };
}
