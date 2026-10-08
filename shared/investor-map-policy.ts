export type InvestorMapCoordinates = {
  latitude: unknown;
  longitude: unknown;
};

/**
 * Public investor markers require a real geographical coordinate pair.
 * Coercion is deliberately narrow: it accepts database decimals serialized as
 * strings, but rejects absent, malformed and out-of-range values.
 */
export function hasValidInvestorMapCoordinates({ latitude, longitude }: InvestorMapCoordinates): boolean {
  if (latitude === null || latitude === undefined || latitude === ""
    || longitude === null || longitude === undefined || longitude === "") {
    return false;
  }

  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  return Number.isFinite(normalizedLatitude)
    && Number.isFinite(normalizedLongitude)
    && Math.abs(normalizedLatitude) <= 90
    && Math.abs(normalizedLongitude) <= 180;
}

export function toInvestorMapPosition({ latitude, longitude }: InvestorMapCoordinates): { lat: number; lng: number } | null {
  if (!hasValidInvestorMapCoordinates({ latitude, longitude })) return null;
  return { lat: Number(latitude), lng: Number(longitude) };
}
