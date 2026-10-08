import { calculateFinancialWaterfall, validateFinancialSplit, type FinancialWaterfall } from "./financial-waterfall";

export type CrowdfundingProjectionScenario = "PESSIMISTIC" | "REALISTIC" | "OPTIMISTIC";

export type CrowdfundingProjectionInput = {
  investmentCop: number;
  totalPowerKw: number;
  salePricePerKwh: number;
  energyCostPerKwh: number;
  hostSharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  efficiencyPercent: number;
  fixedMonthlyExpenses?: number;
};

export type CrowdfundingProjectionResult = {
  key: CrowdfundingProjectionScenario;
  label: string;
  hoursPerDay: number;
  energyKwhPerDay: number;
  energyKwhPerMonth: number;
  investorMonthlyCashflow: number;
  investorAnnualCashflow: number;
  roiAnnualPercent: number;
  paybackMonths: number;
  waterfall: FinancialWaterfall;
};

export type CrowdfundingProjectionSnapshot = {
  version: 1;
  basis: "EVGREEN_CROWDFUNDING_SCENARIOS";
  selectedScenario: CrowdfundingProjectionScenario;
  assumptions: CrowdfundingProjectionInput;
  scenarios: Record<CrowdfundingProjectionScenario, CrowdfundingProjectionResult>;
};

export const CROWDFUNDING_PROJECTION_SCENARIOS: ReadonlyArray<{
  key: CrowdfundingProjectionScenario;
  label: string;
  hoursPerDay: number;
}> = [
  { key: "PESSIMISTIC", label: "Pesimista", hoursPerDay: 4 },
  { key: "REALISTIC", label: "Realista", hoursPerDay: 6 },
  { key: "OPTIMISTIC", label: "Optimista", hoursPerDay: 9 },
] as const;

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function validateCrowdfundingProjectionInput(input: CrowdfundingProjectionInput): void {
  const numericValues = [
    input.investmentCop,
    input.totalPowerKw,
    input.salePricePerKwh,
    input.energyCostPerKwh,
    input.efficiencyPercent,
    input.fixedMonthlyExpenses ?? 0,
  ];
  if (!numericValues.every(Number.isFinite)) throw new Error("Los supuestos del simulador deben ser números válidos");
  if (input.investmentCop <= 0) throw new Error("La inversión debe ser mayor que cero");
  if (input.totalPowerKw <= 0) throw new Error("La potencia instalada debe ser mayor que cero");
  if (input.salePricePerKwh <= 0) throw new Error("El precio de venta debe ser mayor que cero");
  if (input.energyCostPerKwh < 0) throw new Error("El costo de energía no puede ser negativo");
  if (input.efficiencyPercent <= 0 || input.efficiencyPercent > 100) throw new Error("La eficiencia debe estar entre 0 % y 100 %");
  if ((input.fixedMonthlyExpenses ?? 0) < 0) throw new Error("Los gastos mensuales no pueden ser negativos");
  validateFinancialSplit(input);
}

export function calculateCrowdfundingProjectionScenario(
  input: CrowdfundingProjectionInput,
  scenario: CrowdfundingProjectionScenario,
): CrowdfundingProjectionResult {
  validateCrowdfundingProjectionInput(input);
  const definition = CROWDFUNDING_PROJECTION_SCENARIOS.find((item) => item.key === scenario);
  if (!definition) throw new Error("Escenario financiero no válido");

  const efficiency = input.efficiencyPercent / 100;
  const energyKwhPerDay = input.totalPowerKw * definition.hoursPerDay * efficiency;
  const energyKwhPerMonth = energyKwhPerDay * 30;
  const waterfall = calculateFinancialWaterfall({
    grossRevenue: energyKwhPerMonth * input.salePricePerKwh,
    totalKwh: energyKwhPerMonth,
    energyCostPerKwh: input.energyCostPerKwh,
    hostSharePercent: input.hostSharePercent,
    investorSharePercent: input.investorSharePercent,
    evgreenSharePercent: input.evgreenSharePercent,
    fixedExpenses: input.fixedMonthlyExpenses ?? 0,
  });
  const investorMonthlyCashflow = waterfall.investorPool;
  const investorAnnualCashflow = investorMonthlyCashflow * 12;
  const roiAnnualPercent = input.investmentCop > 0 ? (investorAnnualCashflow / input.investmentCop) * 100 : 0;
  const paybackMonths = investorMonthlyCashflow > 0 ? input.investmentCop / investorMonthlyCashflow : 0;

  return {
    key: definition.key,
    label: definition.label,
    hoursPerDay: definition.hoursPerDay,
    energyKwhPerDay: round(energyKwhPerDay),
    energyKwhPerMonth: round(energyKwhPerMonth),
    investorMonthlyCashflow: round(investorMonthlyCashflow),
    investorAnnualCashflow: round(investorAnnualCashflow),
    roiAnnualPercent: round(roiAnnualPercent),
    paybackMonths: round(paybackMonths, 1),
    waterfall,
  };
}

export function buildCrowdfundingProjectionSnapshot(
  input: CrowdfundingProjectionInput,
  selectedScenario: CrowdfundingProjectionScenario = "REALISTIC",
): CrowdfundingProjectionSnapshot {
  validateCrowdfundingProjectionInput(input);
  const scenarios = Object.fromEntries(
    CROWDFUNDING_PROJECTION_SCENARIOS.map((scenario) => [
      scenario.key,
      calculateCrowdfundingProjectionScenario(input, scenario.key),
    ]),
  ) as Record<CrowdfundingProjectionScenario, CrowdfundingProjectionResult>;

  return {
    version: 1,
    basis: "EVGREEN_CROWDFUNDING_SCENARIOS",
    selectedScenario,
    assumptions: { ...input, fixedMonthlyExpenses: input.fixedMonthlyExpenses ?? 0 },
    scenarios,
  };
}

export function getSelectedCrowdfundingProjection(snapshot: CrowdfundingProjectionSnapshot) {
  return snapshot.scenarios[snapshot.selectedScenario];
}
