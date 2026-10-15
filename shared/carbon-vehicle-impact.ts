import { toFiniteNumber } from "./carbon-program-calculations";

export type CarbonVehicleBaselineFactor = {
  brandKey: string;
  modelKey: string;
  displayName: string;
  vehicleSegment: "PASSENGER_CAR" | "SUV_LIGHT_TRUCK" | "OTHER_LIGHT_EV";
  evConsumptionKwhPer100Km: number;
  baselineFuelEconomyKmPerGallon: number;
  baselineFuelEmissionKgCo2PerGallon: number;
  gridFactorTco2ePerMwh: number;
  dataQuality: "MODEL_SPECIFIC" | "SEGMENT_CONSERVATIVE" | "NEEDS_REVIEW";
  sourceUrl: string;
  sourceTitle: string;
  methodologyNote?: string | null;
  isActive?: boolean | number;
};

export type VehicleChargingProfile = {
  userId: number;
  brand: string | null | undefined;
  model: string | null | undefined;
  batteryCapacityKwh?: number | null;
  chargingKwh: number;
};

export function normalizeVehicleKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveVehicleBaselineFactor(
  profile: Pick<VehicleChargingProfile, "brand" | "model">,
  factors: CarbonVehicleBaselineFactor[],
): CarbonVehicleBaselineFactor | undefined {
  const brandKey = normalizeVehicleKey(profile.brand);
  const modelKey = normalizeVehicleKey(profile.model);
  const active = factors.filter((factor) => factor.isActive === undefined || Boolean(factor.isActive));

  return active.find((factor) => normalizeVehicleKey(factor.brandKey) === brandKey && normalizeVehicleKey(factor.modelKey) === modelKey)
    ?? active.find((factor) => normalizeVehicleKey(factor.brandKey) === "*" && normalizeVehicleKey(factor.modelKey) === modelKey)
    ?? active.find((factor) => normalizeVehicleKey(factor.brandKey) === "*" && normalizeVehicleKey(factor.modelKey) === "*");
}

export function calculateVehicleProfiledImpact(input: {
  totalChargingKwh: number;
  profiles: VehicleChargingProfile[];
  factors: CarbonVehicleBaselineFactor[];
}) {
  const totalChargingKwh = Math.max(0, toFiniteNumber(input.totalChargingKwh));
  let profiledChargingKwh = 0;
  let eligibleChargingKwh = 0;
  let estimatedAvoidedTco2e = 0;
  const breakdown: Array<{
    userId: number;
    brand: string;
    model: string;
    chargingKwh: number;
    factorName: string | null;
    dataQuality: CarbonVehicleBaselineFactor["dataQuality"] | null;
    estimatedAvoidedTco2e: number;
  }> = [];

  for (const profile of input.profiles) {
    const chargingKwh = Math.max(0, toFiniteNumber(profile.chargingKwh));
    if (chargingKwh <= 0) continue;
    profiledChargingKwh += chargingKwh;
    const factor = resolveVehicleBaselineFactor(profile, input.factors);
    if (!factor) {
      breakdown.push({
        userId: profile.userId,
        brand: profile.brand?.trim() || "Sin marca",
        model: profile.model?.trim() || "Sin modelo",
        chargingKwh,
        factorName: null,
        dataQuality: null,
        estimatedAvoidedTco2e: 0,
      });
      continue;
    }

    const evConsumptionKwhPer100Km = Math.max(0.0001, toFiniteNumber(factor.evConsumptionKwhPer100Km));
    const baselineFuelEconomyKmPerGallon = Math.max(0.0001, toFiniteNumber(factor.baselineFuelEconomyKmPerGallon));
    const baselineFuelEmissionKgCo2PerGallon = Math.max(0, toFiniteNumber(factor.baselineFuelEmissionKgCo2PerGallon));
    const gridFactorTco2ePerMwh = Math.max(0, toFiniteNumber(factor.gridFactorTco2ePerMwh));
    const baselineTco2ePerMwh = (baselineFuelEmissionKgCo2PerGallon / baselineFuelEconomyKmPerGallon) / (evConsumptionKwhPer100Km / 100);
    const avoidedTco2ePerMwh = Math.max(0, baselineTco2ePerMwh - gridFactorTco2ePerMwh);
    const profileAvoidedTco2e = (chargingKwh / 1000) * avoidedTco2ePerMwh;

    eligibleChargingKwh += chargingKwh;
    estimatedAvoidedTco2e += profileAvoidedTco2e;
    breakdown.push({
      userId: profile.userId,
      brand: profile.brand?.trim() || "Sin marca",
      model: profile.model?.trim() || "Sin modelo",
      chargingKwh,
      factorName: factor.displayName,
      dataQuality: factor.dataQuality,
      estimatedAvoidedTco2e: profileAvoidedTco2e,
    });
  }

  return {
    totalChargingKwh,
    profiledChargingKwh,
    eligibleChargingKwh,
    unlinkedChargingKwh: Math.max(0, totalChargingKwh - profiledChargingKwh),
    unmatchedProfileChargingKwh: Math.max(0, profiledChargingKwh - eligibleChargingKwh),
    coveragePercent: totalChargingKwh > 0 ? (eligibleChargingKwh / totalChargingKwh) * 100 : 0,
    estimatedAvoidedTco2e,
    profileCount: breakdown.length,
    eligibleProfileCount: breakdown.filter((row) => row.factorName !== null).length,
    breakdown,
  };
}
