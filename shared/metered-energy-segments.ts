export type MeteredEnergySegmentsInput = {
  meterStartWh: number | string | null | undefined;
  startTime: Date | string | number;
  samples: Array<{
    timestamp: Date | string | number;
    energyKwh?: number | string | null;
  }>;
  /** Límite físico; si se omite o es inválido se usa 150 kW. */
  maxPowerKw?: number;
};

export type MeteredEnergySegmentsResult = {
  kwh: number | null;
  reference: "meter_start" | "first_session_sample" | "observed_segments" | "unavailable";
  meterStartConsistent: boolean | null;
  resetCount: number;
  rejectedJumpCount: number;
};

type EnergySample = { timestamp: number; energyKwh: number };

const DEFAULT_MAX_POWER_KW = 150;
const POWER_TOLERANCE = 1.25;
const QUANTIZATION_KWH = 0.0002;

function toNonnegativeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function toTimestamp(value: Date | string | number): number | null {
  let timestamp: number;
  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === "number") {
    timestamp = new Date(value).getTime();
  } else {
    const text = value.trim();
    if (!text) return null;
    // Las fechas ISO/SQL sin zona también se interpretan en UTC, no en la
    // zona horaria del servidor. Los offsets explícitos se conservan.
    const isUnzonedDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text);
    timestamp = Date.parse(isUnzonedDateTime ? `${text.replace(" ", "T")}Z` : text);
  }
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Suma exclusivamente incrementos medidos de una sesión, nunca potencia
 * integrada. Un retroceso inicia un nuevo segmento sin contar el cruce; un
 * salto físicamente imposible se descarta sin mover el último punto aceptado.
 * El resultado es un mínimo observado cuando la referencia inicial es inválida
 * o hubo resets. No modifica las muestras ni presume energía en huecos.
 */
export function resolveMeteredEnergySegments(
  input: MeteredEnergySegmentsInput,
): MeteredEnergySegmentsResult {
  const unavailable: MeteredEnergySegmentsResult = {
    kwh: null,
    reference: "unavailable",
    meterStartConsistent: null,
    resetCount: 0,
    rejectedJumpCount: 0,
  };
  const startTimestamp = toTimestamp(input.startTime);
  if (startTimestamp === null) return unavailable;

  // Duplicados idénticos se colapsan. Un timestamp con dos valores válidos
  // distintos se excluye entero, independientemente del orden de llegada.
  const byTimestamp = new Map<number, number | null>();
  for (const sample of input.samples) {
    const timestamp = toTimestamp(sample.timestamp);
    const energyKwh = toNonnegativeNumber(sample.energyKwh);
    if (timestamp === null || timestamp < startTimestamp || energyKwh === null) continue;
    if (!byTimestamp.has(timestamp)) {
      byTimestamp.set(timestamp, energyKwh);
    } else if (byTimestamp.get(timestamp) !== energyKwh) {
      byTimestamp.set(timestamp, null);
    }
  }
  const samples: EnergySample[] = [];
  for (const [timestamp, energyKwh] of byTimestamp) {
    if (energyKwh !== null) samples.push({ timestamp, energyKwh });
  }
  samples.sort((a, b) => a.timestamp - b.timestamp);
  if (samples.length === 0) return unavailable;

  const maxPowerKw = typeof input.maxPowerKw === "number"
    && Number.isFinite(input.maxPowerKw) && input.maxPowerKw >= 0
    ? input.maxPowerKw
    : DEFAULT_MAX_POWER_KW;
  const isPlausible = (previous: EnergySample, current: EnergySample): boolean => {
    const delta = current.energyKwh - previous.energyKwh;
    const elapsedHours = (current.timestamp - previous.timestamp) / 3_600_000;
    const limit = elapsedHours * maxPowerKw * POWER_TOLERANCE + QUANTIZATION_KWH;
    // Sólo corrige error binario al restar contadores acumulados grandes; no
    // añade tolerancia de consumo ni permite rebasar el límite físico.
    const roundoff = Number.EPSILON
      * Math.max(1, previous.energyKwh, current.energyKwh) * 4;
    return delta >= 0 && delta <= limit + roundoff;
  };

  const meterStartWh = toNonnegativeNumber(input.meterStartWh);
  const meterStartKwh = meterStartWh === null ? null : meterStartWh / 1000;
  const first = samples[0];
  let kwh = 0;
  let reference: MeteredEnergySegmentsResult["reference"] = "first_session_sample";
  let meterStartConsistent: boolean | null = null;
  let resetCount = 0;
  let rejectedJumpCount = 0;

  if (meterStartKwh !== null) {
    const baseline = { timestamp: startTimestamp, energyKwh: meterStartKwh };
    meterStartConsistent = isPlausible(baseline, first);
    if (meterStartConsistent) {
      kwh = first.energyKwh - meterStartKwh;
      reference = "meter_start";
    } else if (first.energyKwh > meterStartKwh) {
      // La primera muestra sí puede servir como referencia observada, pero
      // nunca se atribuye a la sesión el hueco inicial imposible.
      rejectedJumpCount += 1;
    }
  }

  let previous = first;
  for (const current of samples.slice(1)) {
    const delta = current.energyKwh - previous.energyKwh;
    if (delta < 0) {
      resetCount += 1;
      meterStartConsistent = false;
      reference = "observed_segments";
      previous = current;
    } else if (!isPlausible(previous, current)) {
      rejectedJumpCount += 1;
      // No actualizar energía NI timestamp: la recuperación se compara con
      // la última lectura aceptada, no con el pico descartado.
    } else {
      kwh += delta;
      previous = current;
    }
  }

  return {
    // Misma precisión de cuatro decimales de kWh que la telemetría persistida.
    kwh: Math.round(kwh * 10_000) / 10_000,
    reference,
    meterStartConsistent,
    resetCount,
    rejectedJumpCount,
  };
}
