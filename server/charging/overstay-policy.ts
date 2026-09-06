export type OverstayRateSource = "station" | "tariff" | "global";

type NumericValue = number | string | null | undefined;

export interface ResolveOverstayPolicyInput {
  stationOccupancyRatePerMinute: NumericValue;
  tariffPenaltyPerMinute: NumericValue;
  globalPenaltyPerMinute: NumericValue;
  tariffGracePeriodMinutes: NumericValue;
  globalGracePeriodMinutes: NumericValue;
}

export interface ResolvedOverstayPolicy {
  penaltyPerMinute: number;
  gracePeriodMinutes: number;
  source: OverstayRateSource;
  enabled: boolean;
}

function parseNonNegative(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

/**
 * Resuelve una única tarifa de sobreestadía.
 *
 * La configuración directa de la estación es autoritativa, incluido el valor
 * cero: $0 significa que el cobro está deshabilitado y nunca debe activar un
 * fallback histórico. Tarifa y configuración global solo aplican si el nivel
 * anterior realmente no tiene valor (compatibilidad con registros heredados).
 */
export function resolveOverstayPolicy(input: ResolveOverstayPolicyInput): ResolvedOverstayPolicy {
  const stationRate = parseNonNegative(input.stationOccupancyRatePerMinute);
  const tariffRate = parseNonNegative(input.tariffPenaltyPerMinute);
  const globalRate = parseNonNegative(input.globalPenaltyPerMinute) ?? 0;
  const tariffGrace = parseNonNegative(input.tariffGracePeriodMinutes);
  const globalGrace = parseNonNegative(input.globalGracePeriodMinutes) ?? 10;

  const resolvedRate = stationRate !== null
    ? { penaltyPerMinute: stationRate, source: "station" as const }
    : tariffRate !== null
      ? { penaltyPerMinute: tariffRate, source: "tariff" as const }
      : { penaltyPerMinute: globalRate, source: "global" as const };

  return {
    ...resolvedRate,
    gracePeriodMinutes: tariffGrace ?? globalGrace,
    enabled: resolvedRate.penaltyPerMinute > 0,
  };
}
