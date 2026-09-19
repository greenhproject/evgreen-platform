export type SocCalibrationLearningInput = {
  /** Última observación manual, que actúa como ancla del tramo ya recorrido. */
  previousSoc: number | null | undefined;
  previousEnergyKwh: number | null | undefined;
  /** Nueva lectura que el operador observa directamente en el vehículo. */
  observedSoc: number;
  currentEnergyKwh: number;
  /** Capacidad declarada de la batería: no se modifica automáticamente. */
  declaredCapacityKwh: number;
  /** Capacidad efectiva que usa el estimador para esta sesión AC. */
  effectiveCapacityKwh: number | null | undefined;
  calibrationCount: number | null | undefined;
  /** Una capacidad escrita expresamente por el operador prevalece sobre el aprendizaje. */
  capacityWasExplicitlyProvided?: boolean;
};

export type SocCalibrationLearningResult = {
  effectiveCapacityKwh: number;
  calibrationCount: number;
  learned: boolean;
  candidateCapacityKwh: number | null;
  reason:
    | "capacity_explicitly_set"
    | "first_anchor"
    | "insufficient_energy"
    | "non_increasing_soc"
    | "invalid_candidate"
    | "learned";
};

const MIN_EFFECTIVE_CAPACITY_KWH = 10;
const MAX_EFFECTIVE_CAPACITY_KWH = 200;
const MIN_ENERGY_INTERVAL_KWH = 0.25;
const MIN_SOC_INTERVAL_PCT = 1;
const MAX_CANDIDATE_RATIO = 1.75;
const MIN_CANDIDATE_RATIO = 0.5;
const MAX_STEP_RATIO = 0.3;

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

function roundCapacity(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Ajusta suavemente la capacidad **efectiva** de una sesión AC a partir de dos
 * lecturas manuales reales del vehículo. No cambia la capacidad declarada del
 * vehículo; aprende una equivalencia energética para que el SOC siguiente se
 * acerque a lo observado sin reaccionar de forma brusca a una lectura aislada,
 * pérdidas de carga o redondeos del tablero.
 */
export function learnEffectiveSocCapacity(input: SocCalibrationLearningInput): SocCalibrationLearningResult {
  const declaredCapacity = clamp(input.declaredCapacityKwh, MIN_EFFECTIVE_CAPACITY_KWH, MAX_EFFECTIVE_CAPACITY_KWH);
  const currentEffective = clamp(
    finiteNumber(input.effectiveCapacityKwh) ?? declaredCapacity,
    MIN_EFFECTIVE_CAPACITY_KWH,
    MAX_EFFECTIVE_CAPACITY_KWH,
  );
  const count = Math.max(0, Math.floor(finiteNumber(input.calibrationCount) ?? 0));

  if (input.capacityWasExplicitlyProvided) {
    return {
      effectiveCapacityKwh: roundCapacity(declaredCapacity),
      calibrationCount: 0,
      learned: false,
      candidateCapacityKwh: null,
      reason: "capacity_explicitly_set",
    };
  }

  const previousSoc = finiteNumber(input.previousSoc);
  const previousEnergy = finiteNumber(input.previousEnergyKwh);
  if (previousSoc === null || previousEnergy === null) {
    return {
      effectiveCapacityKwh: roundCapacity(currentEffective),
      calibrationCount: count,
      learned: false,
      candidateCapacityKwh: null,
      reason: "first_anchor",
    };
  }

  const energyDelta = input.currentEnergyKwh - previousEnergy;
  const socDelta = input.observedSoc - previousSoc;
  if (!Number.isFinite(energyDelta) || energyDelta < MIN_ENERGY_INTERVAL_KWH) {
    return {
      effectiveCapacityKwh: roundCapacity(currentEffective),
      calibrationCount: count,
      learned: false,
      candidateCapacityKwh: null,
      reason: "insufficient_energy",
    };
  }
  if (!Number.isFinite(socDelta) || socDelta < MIN_SOC_INTERVAL_PCT) {
    return {
      effectiveCapacityKwh: roundCapacity(currentEffective),
      calibrationCount: count,
      learned: false,
      candidateCapacityKwh: null,
      reason: "non_increasing_soc",
    };
  }

  const rawCandidate = (energyDelta * 100) / socDelta;
  if (!Number.isFinite(rawCandidate) || rawCandidate < MIN_EFFECTIVE_CAPACITY_KWH || rawCandidate > MAX_EFFECTIVE_CAPACITY_KWH) {
    return {
      effectiveCapacityKwh: roundCapacity(currentEffective),
      calibrationCount: count,
      learned: false,
      candidateCapacityKwh: null,
      reason: "invalid_candidate",
    };
  }

  // Limita valores atípicos respecto a la capacidad efectiva actual antes de
  // incorporarlos. Así, cada nueva calibración mejora el modelo sin saltos que
  // puedan producir una sola lectura redondeada o una muestra OCPP tardía.
  const boundedCandidate = clamp(
    rawCandidate,
    currentEffective * MIN_CANDIDATE_RATIO,
    currentEffective * MAX_CANDIDATE_RATIO,
  );
  const maxStep = currentEffective * MAX_STEP_RATIO;
  const stepLimitedCandidate = clamp(
    boundedCandidate,
    currentEffective - maxStep,
    currentEffective + maxStep,
  );
  const learningRate = Math.max(0.2, 0.45 / (1 + count * 0.2));
  const learnedCapacity = currentEffective + (stepLimitedCandidate - currentEffective) * learningRate;

  return {
    effectiveCapacityKwh: roundCapacity(clamp(learnedCapacity, MIN_EFFECTIVE_CAPACITY_KWH, MAX_EFFECTIVE_CAPACITY_KWH)),
    calibrationCount: count + 1,
    learned: true,
    candidateCapacityKwh: roundCapacity(rawCandidate),
    reason: "learned",
  };
}

export const SOC_CALIBRATION_LEARNING_LIMITS = {
  MIN_EFFECTIVE_CAPACITY_KWH,
  MAX_EFFECTIVE_CAPACITY_KWH,
  MIN_ENERGY_INTERVAL_KWH,
  MIN_SOC_INTERVAL_PCT,
};
