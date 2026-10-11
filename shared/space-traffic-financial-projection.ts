import { calculateFinancialWaterfall, type FinancialWaterfall } from "./financial-waterfall";
import { getRevenueDistributionForSpaceType } from "./space-investment-scoring-policy";

export type SpaceTrafficProjectionScenario = "PESSIMISTIC" | "REALISTIC" | "OPTIMISTIC";

export type SpaceTrafficProjectionInput = {
  investmentCop: number;
  estimatedDailyVehicles: number;
  estimatedEvPercent: number;
  chargerCount: number;
  spaceType?: string | null;
  salePricePerKwh: number;
  energyCostPerKwh: number;
  hostSharePercent?: number;
  fixedMonthlyExpenses?: number;
  /** Valor observado: 843 sesiones en 21 días / dos mangueras activas. */
  benchmarkSessionsPerConnectorPerDay?: number;
  /** Valor observado del benchmark suministrado por EVGreen. */
  benchmarkKwhPerSession?: number;
};

export type SpaceTrafficProjectionResult = {
  key: SpaceTrafficProjectionScenario;
  label: string;
  trafficCapturePercent: number;
  eligibleEvVehiclesPerDay: number;
  unconstrainedSessionsPerDay: number;
  sessionsPerDay: number;
  capacitySessionsPerDay: number;
  capacityUtilizationPercent: number;
  energyKwhPerDay: number;
  energyKwhPerMonth: number;
  investorMonthlyCashflow: number;
  investorAnnualCashflow: number;
  roiAnnualPercent: number;
  paybackMonths: number;
  waterfall: FinancialWaterfall;
};

export type SpaceTrafficProjectionSnapshot = {
  version: 1;
  basis: "EVGREEN_SPACE_TRAFFIC_SCENARIOS";
  selectedScenario: SpaceTrafficProjectionScenario;
  assumptions: {
    investmentCop: number;
    estimatedDailyVehicles: number;
    estimatedEvPercent: number;
    chargerCount: number;
    connectorsPerCharger: number;
    benchmarkSessionsPerConnectorPerDay: number;
    benchmarkKwhPerSession: number;
    salePricePerKwh: number;
    energyCostPerKwh: number;
    hostSharePercent: number;
    investorSharePercent: number;
    evgreenSharePercent: number;
    fixedMonthlyExpenses: number;
  };
  scenarios: Record<SpaceTrafficProjectionScenario, SpaceTrafficProjectionResult>;
};

const SCENARIOS: ReadonlyArray<{ key: SpaceTrafficProjectionScenario; label: string; trafficCapturePercent: number }> = [
  { key: "PESSIMISTIC", label: "Pesimista", trafficCapturePercent: 20 },
  { key: "REALISTIC", label: "Realista", trafficCapturePercent: 45 },
  { key: "OPTIMISTIC", label: "Optimista", trafficCapturePercent: 70 },
] as const;

const CONNECTORS_PER_CHARGER = 2;
const DEFAULT_BENCHMARK_SESSIONS_PER_CONNECTOR_PER_DAY = 20.05;
const DEFAULT_BENCHMARK_KWH_PER_SESSION = 31.4;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finitePositive(value: unknown, field: string, allowZero = false): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || (allowZero ? numeric < 0 : numeric <= 0)) {
    throw new Error(`${field} debe ser un número ${allowZero ? "igual o mayor" : "mayor"} que cero`);
  }
  return numeric;
}

/**
 * Calcula un escenario comercial a partir de la demanda capturable de la EDS.
 * El flujo determina el número potencial de sesiones; los cargadores solo
 * limitan esa demanda por su capacidad física (dos mangueras por gabinete).
 */
export function buildSpaceTrafficProjection(
  input: SpaceTrafficProjectionInput,
  selectedScenario: SpaceTrafficProjectionScenario = "REALISTIC",
): SpaceTrafficProjectionSnapshot {
  const investmentCop = finitePositive(input.investmentCop, "La inversión");
  const estimatedDailyVehicles = finitePositive(input.estimatedDailyVehicles, "El flujo diario de vehículos");
  const estimatedEvPercent = finitePositive(input.estimatedEvPercent, "El porcentaje de vehículos eléctricos", true);
  if (estimatedEvPercent > 100) throw new Error("El porcentaje de vehículos eléctricos no puede ser superior a 100 %");
  const chargerCount = Math.max(1, Math.round(finitePositive(input.chargerCount, "La cantidad de cargadores")));
  const salePricePerKwh = finitePositive(input.salePricePerKwh, "El precio de venta por kWh");
  const energyCostPerKwh = finitePositive(input.energyCostPerKwh, "El costo de energía por kWh", true);
  const hostSharePercent = finitePositive(input.hostSharePercent ?? 10, "La participación del aliado", true);
  const fixedMonthlyExpenses = finitePositive(input.fixedMonthlyExpenses ?? 0, "Los gastos fijos", true);
  const benchmarkSessionsPerConnectorPerDay = finitePositive(
    input.benchmarkSessionsPerConnectorPerDay ?? DEFAULT_BENCHMARK_SESSIONS_PER_CONNECTOR_PER_DAY,
    "El benchmark de sesiones por manguera",
  );
  const benchmarkKwhPerSession = finitePositive(
    input.benchmarkKwhPerSession ?? DEFAULT_BENCHMARK_KWH_PER_SESSION,
    "El benchmark de energía por sesión",
  );
  const distribution = getRevenueDistributionForSpaceType(input.spaceType);
  const capacitySessionsPerDay = chargerCount * CONNECTORS_PER_CHARGER * benchmarkSessionsPerConnectorPerDay;
  const eligibleEvVehiclesPerDay = estimatedDailyVehicles * (estimatedEvPercent / 100);

  const scenarios = Object.fromEntries(SCENARIOS.map((scenario) => {
    const unconstrainedSessionsPerDay = eligibleEvVehiclesPerDay * (scenario.trafficCapturePercent / 100);
    const sessionsPerDay = Math.min(unconstrainedSessionsPerDay, capacitySessionsPerDay);
    const energyKwhPerDay = sessionsPerDay * benchmarkKwhPerSession;
    const energyKwhPerMonth = energyKwhPerDay * 30;
    const waterfall = calculateFinancialWaterfall({
      grossRevenue: energyKwhPerMonth * salePricePerKwh,
      totalKwh: energyKwhPerMonth,
      energyCostPerKwh,
      hostSharePercent,
      investorSharePercent: distribution.investorSharePercent,
      evgreenSharePercent: distribution.evgreenSharePercent,
      fixedExpenses: fixedMonthlyExpenses,
    });
    const investorMonthlyCashflow = waterfall.investorPool;
    const investorAnnualCashflow = investorMonthlyCashflow * 12;
    const roiAnnualPercent = (investorAnnualCashflow / investmentCop) * 100;
    const paybackMonths = investorMonthlyCashflow > 0 ? investmentCop / investorMonthlyCashflow : 0;

    const result: SpaceTrafficProjectionResult = {
      key: scenario.key,
      label: scenario.label,
      trafficCapturePercent: scenario.trafficCapturePercent,
      eligibleEvVehiclesPerDay: round(eligibleEvVehiclesPerDay),
      unconstrainedSessionsPerDay: round(unconstrainedSessionsPerDay),
      sessionsPerDay: round(sessionsPerDay),
      capacitySessionsPerDay: round(capacitySessionsPerDay),
      capacityUtilizationPercent: round(capacitySessionsPerDay > 0 ? (sessionsPerDay / capacitySessionsPerDay) * 100 : 0),
      energyKwhPerDay: round(energyKwhPerDay),
      energyKwhPerMonth: round(energyKwhPerMonth),
      investorMonthlyCashflow: round(investorMonthlyCashflow),
      investorAnnualCashflow: round(investorAnnualCashflow),
      roiAnnualPercent: round(roiAnnualPercent),
      paybackMonths: round(paybackMonths, 1),
      waterfall,
    };
    return [scenario.key, result];
  })) as Record<SpaceTrafficProjectionScenario, SpaceTrafficProjectionResult>;

  return {
    version: 1,
    basis: "EVGREEN_SPACE_TRAFFIC_SCENARIOS",
    selectedScenario,
    assumptions: {
      investmentCop,
      estimatedDailyVehicles,
      estimatedEvPercent,
      chargerCount,
      connectorsPerCharger: CONNECTORS_PER_CHARGER,
      benchmarkSessionsPerConnectorPerDay,
      benchmarkKwhPerSession,
      salePricePerKwh,
      energyCostPerKwh,
      hostSharePercent,
      investorSharePercent: distribution.investorSharePercent,
      evgreenSharePercent: distribution.evgreenSharePercent,
      fixedMonthlyExpenses,
    },
    scenarios,
  };
}

export function getSelectedSpaceTrafficProjection(snapshot: SpaceTrafficProjectionSnapshot): SpaceTrafficProjectionResult {
  return snapshot.scenarios[snapshot.selectedScenario];
}
