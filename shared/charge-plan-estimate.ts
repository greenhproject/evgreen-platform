export type ChargeMode = "fixed_amount" | "percentage" | "full_charge";

export type ChargePlanEstimateInput = {
  chargeMode: ChargeMode;
  targetValue: number;
  pricePerKwh: number;
  powerKw: number;
  batteryCapacityKwh?: number;
  startingSocPercent?: number;
};

export type ChargePlanEstimate = {
  estimatedKwh: number;
  estimatedCost: number;
  estimatedTimeMinutes: number;
};

export const DEFAULT_ESTIMATED_BATTERY_CAPACITY_KWH = 60;
export const DEFAULT_ESTIMATED_STARTING_SOC_PERCENT = 20;

/**
 * Estimación consistente para el selector y la autorización del inicio de carga.
 * Es una proyección de planificación —no sustituye los MeterValues ni el SOC OCPP.
 */
export function estimateChargePlan(input: ChargePlanEstimateInput): ChargePlanEstimate {
  const pricePerKwh = Math.max(0, Number(input.pricePerKwh) || 0);
  const powerKw = Math.max(0.1, Number(input.powerKw) || 0.1);
  const capacityKwh = Math.max(1, Number(input.batteryCapacityKwh) || DEFAULT_ESTIMATED_BATTERY_CAPACITY_KWH);
  const startingSoc = Math.min(100, Math.max(0, Number(input.startingSocPercent) || DEFAULT_ESTIMATED_STARTING_SOC_PERCENT));
  const requestedValue = Math.max(0, Number(input.targetValue) || 0);

  let estimatedKwh = 0;
  let estimatedCost = 0;

  switch (input.chargeMode) {
    case "fixed_amount":
      estimatedCost = requestedValue;
      estimatedKwh = pricePerKwh > 0 ? estimatedCost / pricePerKwh : 0;
      break;
    case "percentage": {
      const targetSoc = Math.min(100, requestedValue);
      estimatedKwh = Math.max(0, ((targetSoc - startingSoc) / 100) * capacityKwh);
      estimatedCost = estimatedKwh * pricePerKwh;
      break;
    }
    case "full_charge":
      estimatedKwh = Math.max(0, ((100 - startingSoc) / 100) * capacityKwh);
      estimatedCost = estimatedKwh * pricePerKwh;
      break;
  }

  return {
    estimatedKwh: Math.round(estimatedKwh * 100) / 100,
    estimatedCost: Math.round(estimatedCost),
    estimatedTimeMinutes: Math.max(0, Math.ceil((estimatedKwh / powerKw) * 60)),
  };
}
