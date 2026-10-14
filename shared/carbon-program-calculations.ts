export type CarbonCostInput = {
  amountCop: number;
  costType: "FIXED" | "VARIABLE_PER_TCO2E" | "ONE_TIME";
  periodicity: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";
  status?: "ACTIVE" | "ARCHIVED";
};

export type CarbonProgramEconomicInput = {
  projectedTco2e: number;
  estimatedCreditPriceCopPerTco2e: number;
  registryCommissionPercent: number;
  costs: CarbonCostInput[];
};

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function monthlyFactor(periodicity: CarbonCostInput["periodicity"]): number {
  switch (periodicity) {
    case "MONTHLY": return 12;
    case "QUARTERLY": return 4;
    case "ANNUAL":
    case "ONE_TIME": return 1;
  }
}

/**
 * Calcula una proyección económica separada de la emisión de créditos. El
 * resultado jamás marca un crédito como emitido, validado o vendible.
 */
export function calculateCarbonProgramEconomics(input: CarbonProgramEconomicInput) {
  const projectedTco2e = Math.max(0, toFiniteNumber(input.projectedTco2e));
  const price = Math.max(0, toFiniteNumber(input.estimatedCreditPriceCopPerTco2e));
  const commissionPercent = Math.min(100, Math.max(0, toFiniteNumber(input.registryCommissionPercent)));

  const activeCosts = input.costs.filter((cost) => cost.status !== "ARCHIVED");
  const fixedAnnualCop = activeCosts
    .filter((cost) => cost.costType === "FIXED" || cost.costType === "ONE_TIME")
    .reduce((sum, cost) => sum + Math.max(0, toFiniteNumber(cost.amountCop)) * monthlyFactor(cost.periodicity), 0);
  const variableCostCopPerTco2e = activeCosts
    .filter((cost) => cost.costType === "VARIABLE_PER_TCO2E")
    .reduce((sum, cost) => sum + Math.max(0, toFiniteNumber(cost.amountCop)), 0);

  const registryCommissionCopPerTco2e = price * (commissionPercent / 100);
  const netContributionCopPerTco2e = price - registryCommissionCopPerTco2e - variableCostCopPerTco2e;
  const grossRevenueCop = projectedTco2e * price;
  const registryCommissionCop = projectedTco2e * registryCommissionCopPerTco2e;
  const variableCostsCop = projectedTco2e * variableCostCopPerTco2e;
  const projectedNetCop = grossRevenueCop - registryCommissionCop - variableCostsCop - fixedAnnualCop;
  const breakEvenTco2e = netContributionCopPerTco2e > 0
    ? fixedAnnualCop / netContributionCopPerTco2e
    : null;

  return {
    projectedTco2e,
    price,
    commissionPercent,
    fixedAnnualCop,
    variableCostCopPerTco2e,
    registryCommissionCopPerTco2e,
    netContributionCopPerTco2e,
    grossRevenueCop,
    registryCommissionCop,
    variableCostsCop,
    projectedNetCop,
    breakEvenTco2e,
    isEconomicallyViable: breakEvenTco2e !== null && projectedTco2e >= breakEvenTco2e,
  };
}

/** Evita doble atribución: solo se asigna generación solar medida y verificada. */
export function calculateSolarBackedImpact(input: {
  chargingKwh: number;
  verifiedSolarKwh: number;
  solarAvoidedFactorTco2ePerMwh: number;
}) {
  const chargingKwh = Math.max(0, toFiniteNumber(input.chargingKwh));
  const verifiedSolarKwh = Math.max(0, toFiniteNumber(input.verifiedSolarKwh));
  const solarBackedKwh = Math.min(chargingKwh, verifiedSolarKwh);
  const factor = Math.max(0, toFiniteNumber(input.solarAvoidedFactorTco2ePerMwh));
  const estimatedAvoidedTco2e = (solarBackedKwh / 1000) * factor;

  return {
    chargingKwh,
    verifiedSolarKwh,
    solarBackedKwh,
    solarCoveragePercent: chargingKwh > 0 ? (solarBackedKwh / chargingKwh) * 100 : 0,
    estimatedAvoidedTco2e,
  };
}

export function annualizeImpact(input: { estimatedAvoidedTco2e: number; observedDays: number }) {
  const observedDays = Math.max(0, toFiniteNumber(input.observedDays));
  const observedTco2e = Math.max(0, toFiniteNumber(input.estimatedAvoidedTco2e));
  return observedDays > 0 ? (observedTco2e / observedDays) * 365 : 0;
}
