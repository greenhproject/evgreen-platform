import { calculateFinancialWaterfall, type FinancialWaterfall } from "./financial-waterfall";
import { getRevenueDistributionForSpaceType } from "./space-investment-scoring-policy";

export type SpaceTrafficProjectionScenario = "PESSIMISTIC" | "REALISTIC" | "OPTIMISTIC";

export type SpaceTrafficProjectionInput = {
  investmentCop: number;
  estimatedDailyVehicles: number;
  /**
   * Porcentaje de flujo diario que se estima atendible como sesiones EV en el
   * escenario REALISTA. Ej.: 1.000 vehículos × 10 % = 100 sesiones potenciales/día.
   */
  estimatedEvPercent: number;
  chargerCount: number;
  /** Potencia DC total disponible para los cargadores del espacio. */
  totalPowerKw?: number | null;
  /** Ventana comercial efectiva en la que el sitio puede despachar energía. */
  operatingHoursPerDay?: number | null;
  /** Eficiencia de entrega DC usada para convertir potencia a kWh útiles. */
  efficiencyPercent?: number | null;
  /** Alcance técnico; por sí solo no reduce el costo de la energía. */
  hasSolarPanels?: boolean | number | null;
  /** Parte del kWh vendido respaldada por generación solar autoconsumida. */
  solarCoveragePercent?: number | null;
  /** Costo variable solar por kWh autoconsumido, validado para este sitio. */
  solarEnergyCostPerKwh?: number | null;
  spaceType?: string | null;
  salePricePerKwh: number;
  energyCostPerKwh: number;
  hostSharePercent?: number;
  fixedMonthlyExpenses?: number;
  /** Capacidad demostrada o aprobada por manguera; por defecto, benchmark EVGreen. */
  benchmarkSessionsPerConnectorPerDay?: number;
  /** Energía facturada promedio por sesión; por defecto, benchmark EVGreen. */
  benchmarkKwhPerSession?: number;
};

export type SpaceTrafficProjectionResult = {
  key: SpaceTrafficProjectionScenario;
  label: string;
  /** Multiplicador aplicado al supuesto EV declarado para construir el escenario. */
  evDemandMultiplierPercent: number;
  /** Participación EV/sesiones atendibles resultante para el escenario. */
  scenarioEvPercent: number;
  /** Vehículos EV potenciales por día según flujo × participación EV del escenario. */
  eligibleEvVehiclesPerDay: number;
  /** Sesiones potenciales antes de limitar por mangueras disponibles. */
  unconstrainedSessionsPerDay: number;
  /** Sesiones modeladas: demanda potencial limitada solamente por capacidad técnica. */
  sessionsPerDay: number;
  connectorCapacitySessionsPerDay: number;
  powerCapacityKwhPerDay: number | null;
  powerCapacitySessionsPerDay: number | null;
  capacitySessionsPerDay: number;
  capacityUtilizationPercent: number;
  capacityLimited: boolean;
  capacityConstraint: "CONNECTORS" | "POWER" | "BOTH" | "UNSPECIFIED";
  energyKwhPerDay: number;
  energyKwhPerMonth: number;
  investorMonthlyCashflow: number;
  investorAnnualCashflow: number;
  roiAnnualPercent: number;
  paybackMonths: number;
  waterfall: FinancialWaterfall;
};

export type SpaceTrafficProjectionSnapshot = {
  version: 3;
  basis: "EVGREEN_SPACE_DEMAND_CAPACITY_SCENARIOS";
  selectedScenario: SpaceTrafficProjectionScenario;
  assumptions: {
    investmentCop: number;
    estimatedDailyVehicles: number;
    /** Base del escenario REALISTA. */
    estimatedEvPercent: number;
    chargerCount: number;
    connectorsPerCharger: number;
    benchmarkSessionsPerConnectorPerDay: number;
    benchmarkKwhPerSession: number;
    totalPowerKw: number | null;
    operatingHoursPerDay: number | null;
    efficiencyPercent: number | null;
    hasSolarPanels: boolean;
    solarCoveragePercent: number;
    solarEnergyCostPerKwh: number | null;
    effectiveEnergyCostPerKwh: number;
    solarCostApplied: boolean;
    salePricePerKwh: number;
    energyCostPerKwh: number;
    hostSharePercent: number;
    investorSharePercent: number;
    evgreenSharePercent: number;
    fixedMonthlyExpenses: number;
  };
  scenarios: Record<SpaceTrafficProjectionScenario, SpaceTrafficProjectionResult>;
};

/**
 * El administrador declara la participación EV/sesiones atendibles que considera
 * realista. Los escenarios escalan ese supuesto de forma transparente: 50 %,
 * 100 % y 150 %. Cada uno sigue sujeto al límite físico de cargadores y mangueras.
 */
export const SPACE_TRAFFIC_PROJECTION_SCENARIOS: ReadonlyArray<{
  key: SpaceTrafficProjectionScenario;
  label: string;
  evDemandMultiplierPercent: number;
}> = [
  { key: "PESSIMISTIC", label: "Pesimista", evDemandMultiplierPercent: 50 },
  { key: "REALISTIC", label: "Realista", evDemandMultiplierPercent: 100 },
  { key: "OPTIMISTIC", label: "Optimista", evDemandMultiplierPercent: 150 },
] as const;

export const CONNECTORS_PER_CHARGER = 2;
/** Benchmark EDS observado: 20,1 sesiones por manguera/día. */
export const DEFAULT_BENCHMARK_SESSIONS_PER_CONNECTOR_PER_DAY = 20.1;
/** Promedio de energía facturada por sesión comunicado para esta proyección. */
export const DEFAULT_BENCHMARK_KWH_PER_SESSION = 40;
const DAYS_PER_MONTH = 30;

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

export type SolarBlendedEnergyCost = {
  gridEnergyCostPerKwh: number;
  solarCoveragePercent: number;
  solarEnergyCostPerKwh: number | null;
  effectiveEnergyCostPerKwh: number;
  solarCostApplied: boolean;
};

/**
 * Calcula el costo efectivo sin crear un ahorro solar ficticio. El checkbox de
 * solar no cambia cifras hasta que cobertura y costo solar hayan sido validados
 * para ese sitio; el saldo conserva el costo de la red.
 */
export function calculateSolarBlendedEnergyCost(input: {
  gridEnergyCostPerKwh: number;
  hasSolarPanels?: boolean | number | null;
  solarCoveragePercent?: number | null;
  solarEnergyCostPerKwh?: number | null;
}): SolarBlendedEnergyCost {
  const gridEnergyCostPerKwh = finitePositive(input.gridEnergyCostPerKwh, "El costo de energía de red", true);
  const hasSolarPanels = input.hasSolarPanels === true || Number(input.hasSolarPanels) === 1;
  const requestedCoverage = Number(input.solarCoveragePercent ?? 0);
  const solarCoveragePercent = Number.isFinite(requestedCoverage) && requestedCoverage > 0
    ? Math.min(100, requestedCoverage)
    : 0;
  const requestedSolarCost = input.solarEnergyCostPerKwh;
  const solarEnergyCostPerKwh = requestedSolarCost !== null && requestedSolarCost !== undefined && Number.isFinite(Number(requestedSolarCost)) && Number(requestedSolarCost) >= 0
    ? Number(requestedSolarCost)
    : null;
  const solarCostApplied = hasSolarPanels && solarCoveragePercent > 0 && solarEnergyCostPerKwh !== null;
  const effectiveEnergyCostPerKwh = solarCostApplied
    ? gridEnergyCostPerKwh * (1 - solarCoveragePercent / 100) + solarEnergyCostPerKwh * (solarCoveragePercent / 100)
    : gridEnergyCostPerKwh;

  return {
    gridEnergyCostPerKwh: round(gridEnergyCostPerKwh),
    solarCoveragePercent: round(solarCostApplied ? solarCoveragePercent : 0),
    solarEnergyCostPerKwh: solarCostApplied ? round(solarEnergyCostPerKwh!) : null,
    effectiveEnergyCostPerKwh: round(effectiveEnergyCostPerKwh),
    solarCostApplied,
  };
}

/**
 * Construye una proyección de preinversión a partir de la demanda diaria del
 * predio, no de horas teóricas de potencia.
 *
 * Fórmula de demanda del escenario REALISTA:
 * flujo vehicular diario × porcentaje EV declarado = sesiones potenciales/día.
 *
 * La infraestructura no crea demanda: impone el menor techo entre mangueras
 * disponibles y la energía que la potencia instalada puede entregar en la
 * ventana comercial declarada.
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
  const solarEnergy = calculateSolarBlendedEnergyCost({
    gridEnergyCostPerKwh: energyCostPerKwh,
    hasSolarPanels: input.hasSolarPanels,
    solarCoveragePercent: input.solarCoveragePercent,
    solarEnergyCostPerKwh: input.solarEnergyCostPerKwh,
  });
  const hasDeclaredPower = input.totalPowerKw !== undefined && input.totalPowerKw !== null && Number(input.totalPowerKw) > 0;
  const totalPowerKw = hasDeclaredPower ? finitePositive(input.totalPowerKw, "La potencia total instalada") : null;
  const operatingHoursPerDay = hasDeclaredPower
    ? finitePositive(input.operatingHoursPerDay ?? 16, "Las horas de operación diarias")
    : null;
  const efficiencyPercent = hasDeclaredPower
    ? finitePositive(input.efficiencyPercent ?? 92, "La eficiencia de entrega", true)
    : null;
  if (operatingHoursPerDay !== null && operatingHoursPerDay > 24) throw new Error("Las horas de operación diarias no pueden superar 24");
  if (efficiencyPercent !== null && (efficiencyPercent <= 0 || efficiencyPercent > 100)) throw new Error("La eficiencia de entrega debe estar entre 0 % y 100 %");
  const distribution = getRevenueDistributionForSpaceType(input.spaceType);
  const connectorCapacitySessionsPerDay = chargerCount * CONNECTORS_PER_CHARGER * benchmarkSessionsPerConnectorPerDay;
  const powerCapacityKwhPerDay = totalPowerKw !== null && operatingHoursPerDay !== null && efficiencyPercent !== null
    ? totalPowerKw * operatingHoursPerDay * (efficiencyPercent / 100)
    : null;
  const powerCapacitySessionsPerDay = powerCapacityKwhPerDay !== null
    ? powerCapacityKwhPerDay / benchmarkKwhPerSession
    : null;
  const capacitySessionsPerDay = powerCapacitySessionsPerDay === null
    ? connectorCapacitySessionsPerDay
    : Math.min(connectorCapacitySessionsPerDay, powerCapacitySessionsPerDay);
  const capacityConstraint = powerCapacitySessionsPerDay === null
    ? "UNSPECIFIED" as const
    : Math.abs(connectorCapacitySessionsPerDay - powerCapacitySessionsPerDay) < 0.01
      ? "BOTH" as const
      : connectorCapacitySessionsPerDay < powerCapacitySessionsPerDay
        ? "CONNECTORS" as const
        : "POWER" as const;

  const scenarios = Object.fromEntries(SPACE_TRAFFIC_PROJECTION_SCENARIOS.map((scenario) => {
    const scenarioEvPercent = Math.min(100, estimatedEvPercent * (scenario.evDemandMultiplierPercent / 100));
    const eligibleEvVehiclesPerDay = estimatedDailyVehicles * (scenarioEvPercent / 100);
    const unconstrainedSessionsPerDay = eligibleEvVehiclesPerDay;
    const sessionsPerDay = Math.min(unconstrainedSessionsPerDay, capacitySessionsPerDay);
    const energyKwhPerDay = sessionsPerDay * benchmarkKwhPerSession;
    const energyKwhPerMonth = energyKwhPerDay * DAYS_PER_MONTH;
    const waterfall = calculateFinancialWaterfall({
      grossRevenue: energyKwhPerMonth * salePricePerKwh,
      totalKwh: energyKwhPerMonth,
      energyCostPerKwh: solarEnergy.effectiveEnergyCostPerKwh,
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
      evDemandMultiplierPercent: scenario.evDemandMultiplierPercent,
      scenarioEvPercent: round(scenarioEvPercent, 2),
      eligibleEvVehiclesPerDay: round(eligibleEvVehiclesPerDay),
      unconstrainedSessionsPerDay: round(unconstrainedSessionsPerDay),
      sessionsPerDay: round(sessionsPerDay),
      connectorCapacitySessionsPerDay: round(connectorCapacitySessionsPerDay),
      powerCapacityKwhPerDay: powerCapacityKwhPerDay === null ? null : round(powerCapacityKwhPerDay),
      powerCapacitySessionsPerDay: powerCapacitySessionsPerDay === null ? null : round(powerCapacitySessionsPerDay),
      capacitySessionsPerDay: round(capacitySessionsPerDay),
      capacityUtilizationPercent: round(capacitySessionsPerDay > 0 ? (sessionsPerDay / capacitySessionsPerDay) * 100 : 0),
      capacityLimited: unconstrainedSessionsPerDay > capacitySessionsPerDay,
      capacityConstraint,
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
    version: 3,
    basis: "EVGREEN_SPACE_DEMAND_CAPACITY_SCENARIOS",
    selectedScenario,
    assumptions: {
      investmentCop,
      estimatedDailyVehicles,
      estimatedEvPercent,
      chargerCount,
      connectorsPerCharger: CONNECTORS_PER_CHARGER,
      benchmarkSessionsPerConnectorPerDay,
      benchmarkKwhPerSession,
      totalPowerKw,
      operatingHoursPerDay,
      efficiencyPercent,
      hasSolarPanels: input.hasSolarPanels === true || Number(input.hasSolarPanels) === 1,
      solarCoveragePercent: solarEnergy.solarCoveragePercent,
      solarEnergyCostPerKwh: solarEnergy.solarEnergyCostPerKwh,
      effectiveEnergyCostPerKwh: solarEnergy.effectiveEnergyCostPerKwh,
      solarCostApplied: solarEnergy.solarCostApplied,
      salePricePerKwh,
      energyCostPerKwh: solarEnergy.gridEnergyCostPerKwh,
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
