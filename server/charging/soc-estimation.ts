export type SocSource = "charger" | "manual" | "none";

export interface SocEstimationInput {
  chargerSoc: number | null | undefined;
  manualSoc: number | null | undefined;
  batteryCapacityKwh: number | null | undefined;
  currentEnergyKwh: number;
  calibrationEnergyKwh: number | null | undefined;
}

export interface SocEstimationResult {
  soc: number | null;
  source: SocSource;
  energySinceCalibrationKwh: number;
}

export type OperationalSocSource = SocSource | "power_detection";

export interface OperationalSocResult extends Omit<SocEstimationResult, "source"> {
  source: OperationalSocSource;
  manualSocAvailable: boolean;
  manualSocUnavailableReason: string | null;
}

function validSoc(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function nonNegative(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateSocEstimation(input: SocEstimationInput): SocEstimationResult {
  if (validSoc(input.chargerSoc)) {
    return {
      soc: input.chargerSoc,
      source: "charger",
      energySinceCalibrationKwh: 0,
    };
  }

  const capacity = input.batteryCapacityKwh;
  if (!validSoc(input.manualSoc) || !capacity || !Number.isFinite(capacity) || capacity <= 0) {
    return { soc: null, source: "none", energySinceCalibrationKwh: 0 };
  }

  const currentEnergy = nonNegative(input.currentEnergyKwh);
  const calibrationEnergy = Math.min(currentEnergy, nonNegative(input.calibrationEnergyKwh));
  const energySinceCalibrationKwh = Math.round(Math.max(0, currentEnergy - calibrationEnergy) * 10_000) / 10_000;
  const estimatedSoc = input.manualSoc + (energySinceCalibrationKwh / capacity) * 100;

  return {
    soc: Math.min(100, Math.max(0, Math.round(estimatedSoc * 10) / 10)),
    source: "manual",
    energySinceCalibrationKwh,
  };
}

export function getManualSocAvailability(input: {
  chargeType: string | null | undefined;
  chargerSoc: number | null | undefined;
}): { allowed: boolean; reason: string | null } {
  if (input.chargeType === "DC") {
    return {
      allowed: false,
      reason: "En cargadores DC el SOC proviene de la telemetría OCPP del vehículo y no admite calibración manual.",
    };
  }

  if (validSoc(input.chargerSoc)) {
    return {
      allowed: false,
      reason: "El cargador ya está reportando un SOC real por OCPP; ese valor tiene prioridad y no se reemplaza manualmente.",
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Proyección SOC autoritativa compartida por usuario final, NOC y monitores
 * técnicos. La detección conservadora por caída de potencia solo se usa cuando
 * el cargador no reporta SOC; nunca reemplaza telemetría OCPP válida.
 */
export function resolveOperationalSoc(input: SocEstimationInput & {
  chargeType: string | null | undefined;
  chargeCompleteDetected?: boolean;
}): OperationalSocResult {
  const estimation = calculateSocEstimation(input);
  const availability = getManualSocAvailability({
    chargeType: input.chargeType,
    chargerSoc: input.chargerSoc,
  });

  if (estimation.source === "charger") {
    return {
      ...estimation,
      manualSocAvailable: availability.allowed,
      manualSocUnavailableReason: availability.reason,
    };
  }

  if (input.chargeCompleteDetected) {
    return {
      soc: 100,
      source: "power_detection",
      energySinceCalibrationKwh: estimation.energySinceCalibrationKwh,
      manualSocAvailable: availability.allowed,
      manualSocUnavailableReason: availability.reason,
    };
  }

  return {
    ...estimation,
    manualSocAvailable: availability.allowed,
    manualSocUnavailableReason: availability.reason,
  };
}
