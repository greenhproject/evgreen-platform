export type ChargingTelemetryStatus = "live" | "delayed" | "stale" | "unavailable";
export type PowerTelemetrySource = "measured" | "estimated_from_energy" | "unavailable";
export type ChartEnergyReference = "meter_start" | "first_sample";

export const TELEMETRY_FRESH_AFTER_MS = 7 * 60 * 1000;
export const TELEMETRY_STALE_AFTER_MS = 15 * 60 * 1000;

function toTimestamp(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveChargingTelemetryFreshness(input: {
  sampleAt: Date | string | number | null | undefined;
  now?: Date | string | number;
  freshAfterMs?: number;
  staleAfterMs?: number;
}): {
  status: ChargingTelemetryStatus;
  ageSeconds: number | null;
  isFresh: boolean;
} {
  const sampleTimestamp = toTimestamp(input.sampleAt);
  if (sampleTimestamp === null) {
    return { status: "unavailable", ageSeconds: null, isFresh: false };
  }

  const nowTimestamp = toTimestamp(input.now ?? Date.now()) ?? Date.now();
  const ageMs = Math.max(0, nowTimestamp - sampleTimestamp);
  const freshAfterMs = input.freshAfterMs ?? TELEMETRY_FRESH_AFTER_MS;
  const staleAfterMs = Math.max(freshAfterMs, input.staleAfterMs ?? TELEMETRY_STALE_AFTER_MS);

  if (ageMs <= freshAfterMs) {
    return { status: "live", ageSeconds: Math.round(ageMs / 1000), isFresh: true };
  }
  if (ageMs <= staleAfterMs) {
    return { status: "delayed", ageSeconds: Math.round(ageMs / 1000), isFresh: false };
  }
  return { status: "stale", ageSeconds: Math.round(ageMs / 1000), isFresh: false };
}

export function estimatePowerFromEnergySamples(input: {
  previousEnergyKwh: number;
  currentEnergyKwh: number;
  previousSampleAt: Date | string | number;
  currentSampleAt: Date | string | number;
  maxPowerKw?: number;
}): number | null {
  const previousTimestamp = toTimestamp(input.previousSampleAt);
  const currentTimestamp = toTimestamp(input.currentSampleAt);
  if (previousTimestamp === null || currentTimestamp === null || currentTimestamp <= previousTimestamp) return null;

  const energyDeltaKwh = input.currentEnergyKwh - input.previousEnergyKwh;
  if (!Number.isFinite(energyDeltaKwh) || energyDeltaKwh < 0) return null;

  const elapsedHours = (currentTimestamp - previousTimestamp) / 3_600_000;
  if (elapsedHours <= 0) return null;

  const powerKw = energyDeltaKwh / elapsedHours;
  const maxPowerKw = input.maxPowerKw ?? 150;
  if (!Number.isFinite(powerKw) || powerKw < 0) return null;
  return Math.min(powerKw, maxPowerKw);
}

export type MeterValueHistoryInput = {
  timestamp: Date | string | number;
  energyKwh?: number | string | null;
  powerKw?: number | string | null;
  soc?: number | null;
};

export type PowerHistoryPoint = {
  timestamp: number;
  /** null significa que no hubo una medición ni una estimación válida para ese instante. */
  power: number | null;
  powerSource: PowerTelemetrySource;
  /**
   * Energía relativa únicamente para la curva. Nunca se usa para liquidar una
   * transacción ni modifica el consumo facturable persistido.
   */
  energy: number;
  energyReference: ChartEnergyReference;
  soc: number | null;
};

/**
 * Normaliza las lecturas del cargador para la gráfica del monitor.
 * Algunos cargadores AC no envían Power.Active.Import; en ese caso la potencia
 * se estima con el delta de energía y el timestamp real de cada MeterValue.
 */
export function buildPowerHistoryFromMeterValues(
  meterValues: MeterValueHistoryInput[],
  meterStartWh = 0,
): PowerHistoryPoint[] {
  type NormalizedValue = {
    timestamp: number;
    rawEnergy: number | null;
    power: number | null;
    soc: number | null;
  };

  const meterStartKwh = Number.isFinite(Number(meterStartWh)) ? Number(meterStartWh) / 1000 : 0;
  const normalized = meterValues
    .map((value): Omit<NormalizedValue, "timestamp"> & { timestamp: number | null } => {
      const timestamp = toTimestamp(value.timestamp);
      const rawEnergy = value.energyKwh === null || value.energyKwh === undefined
        ? null
        : Number(value.energyKwh);
      const rawPower = value.powerKw === null || value.powerKw === undefined
        ? null
        : Number(value.powerKw);
      const rawSoc = value.soc === null || value.soc === undefined ? null : Number(value.soc);

      return {
        timestamp,
        rawEnergy: rawEnergy !== null && Number.isFinite(rawEnergy)
          ? rawEnergy
          : null,
        power: rawPower !== null && Number.isFinite(rawPower) && rawPower >= 0 ? rawPower : null,
        soc: rawSoc !== null && Number.isFinite(rawSoc) ? rawSoc : null,
      };
    })
    .filter((value): value is NormalizedValue => value.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const firstRawEnergy = normalized.find((value) => value.rawEnergy !== null)?.rawEnergy ?? null;
  // Si el StartTransaction no concuerda con la serie (p. ej. es mayor que la
  // primera lectura), se conserva intacto para facturación y se usa la primera
  // muestra disponible SOLO como cero visual de la gráfica.
  const hasUsableMeterStart = firstRawEnergy !== null
    // Un contador puede comenzar legítimamente en 0 Wh. Sólo se considera
    // anómala una referencia posterior a la primera muestra disponible.
    && Number.isFinite(meterStartKwh)
    && meterStartKwh >= 0
    && meterStartKwh <= firstRawEnergy;
  const energyReference: ChartEnergyReference = hasUsableMeterStart ? "meter_start" : "first_sample";
  const chartEnergyBaseline = hasUsableMeterStart ? meterStartKwh : (firstRawEnergy ?? 0);

  let previousRawEnergy: number | null = null;
  let previousTimestamp: number | null = null;
  let previousChartEnergy = 0;

  return normalized.map((value) => {
    const energy = value.rawEnergy === null
      ? previousChartEnergy
      : previousRawEnergy !== null && value.rawEnergy < previousRawEnergy
        ? previousChartEnergy
        : Math.max(0, value.rawEnergy - chartEnergyBaseline);

    // Versiones anteriores almacenaban 0.00 cuando Power.Active.Import no
    // venía en el payload. Si la energía creció durante el intervalo, ese cero
    // no puede tratarse como medición instantánea y se recupera la potencia por
    // delta. Las nuevas ingestas persisten null cuando no hay potencia medida.
    const legacyZeroWithoutPower = value.power === 0
      && value.rawEnergy !== null
      && previousRawEnergy !== null
      && value.rawEnergy > previousRawEnergy;
    const measuredPower = legacyZeroWithoutPower ? null : value.power;
    const estimatedPower = measuredPower === null
      && value.rawEnergy !== null
      && previousRawEnergy !== null
      && previousTimestamp !== null
      ? estimatePowerFromEnergySamples({
          previousEnergyKwh: previousRawEnergy,
          currentEnergyKwh: value.rawEnergy,
          previousSampleAt: previousTimestamp,
          currentSampleAt: value.timestamp,
        })
      : null;

    if (value.rawEnergy !== null) {
      previousRawEnergy = value.rawEnergy;
      previousTimestamp = value.timestamp;
    }
    previousChartEnergy = energy;

    const powerSource: PowerTelemetrySource = measuredPower !== null
      ? "measured"
      : estimatedPower !== null
        ? "estimated_from_energy"
        : "unavailable";

    return {
      timestamp: value.timestamp,
      power: measuredPower ?? estimatedPower,
      powerSource,
      energy,
      energyReference,
      soc: value.soc,
    };
  });
}

export function shouldAdvanceTelemetrySample(
  currentSampleAt: Date | string | number | null | undefined,
  incomingSampleAt: Date | string | number | null | undefined,
): boolean {
  const incomingTimestamp = toTimestamp(incomingSampleAt);
  if (incomingTimestamp === null) return false;
  const currentTimestamp = toTimestamp(currentSampleAt);
  return currentTimestamp === null || incomingTimestamp > currentTimestamp;
}

export function formatTelemetryAge(ageSeconds: number | null): string {
  if (ageSeconds === null) return "sin lecturas";
  if (ageSeconds < 60) return "hace menos de 1 min";
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `hace ${hours} h ${remainingMinutes} min` : `hace ${hours} h`;
}
