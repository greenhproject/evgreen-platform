export type ReservationPricingInput = {
  lockedPricePerKwh?: string | number | null;
  lockedConnectionFee?: string | number | null;
  pendingPricePerKwh?: string | number | null;
  currentPricePerKwh: string | number;
  currentConnectionFee?: string | number | null;
};

export type ResolvedReservationPricing = {
  pricePerKwh: number;
  connectionFee: number;
  usesLockedPrice: boolean;
  usesLockedConnectionFee: boolean;
};

function nonNegativeFinite(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Resuelve el precio comercial de una sesión. La oferta aceptada durante una
 * reserva prevalece inclusive si después cambia la demanda, una tarifa o una
 * suscripción. Cero es un importe válido (por ejemplo, cargo de conexión cero).
 */
export function resolveReservationPricing(input: ReservationPricingInput): ResolvedReservationPricing {
  const lockedPrice = nonNegativeFinite(input.lockedPricePerKwh);
  const lockedConnectionFee = nonNegativeFinite(input.lockedConnectionFee);
  const pendingPrice = nonNegativeFinite(input.pendingPricePerKwh);
  const currentPrice = nonNegativeFinite(input.currentPricePerKwh) ?? 0;
  const currentConnectionFee = nonNegativeFinite(input.currentConnectionFee) ?? 0;

  return {
    pricePerKwh: lockedPrice ?? pendingPrice ?? currentPrice,
    connectionFee: lockedConnectionFee ?? currentConnectionFee,
    usesLockedPrice: lockedPrice !== null,
    usesLockedConnectionFee: lockedConnectionFee !== null,
  };
}
