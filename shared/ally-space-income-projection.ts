import {
  CONNECTORS_PER_CHARGER,
  DEFAULT_BENCHMARK_KWH_PER_SESSION,
  DEFAULT_BENCHMARK_SESSIONS_PER_CONNECTOR_PER_DAY,
  SPACE_TRAFFIC_PROJECTION_SCENARIOS,
  calculateSolarBlendedEnergyCost,
  type SpaceTrafficProjectionScenario,
} from "./space-traffic-financial-projection";

export type AllyIncomeProjectionInput = {
  estimatedDailyVehicles: number;
  estimatedEvPercent: number;
  chargerCount: number;
  totalPowerKw?: number | null;
  operatingHoursPerDay?: number | null;
  efficiencyPercent?: number | null;
  hasSolarPanels?: boolean | number | null;
  solarCoveragePercent?: number | null;
  solarEnergyCostPerKwh?: number | null;
  salePricePerKwh: number;
  energyCostPerKwh: number;
  allySharePercent?: number;
  benchmarkSessionsPerConnectorPerDay?: number;
  benchmarkKwhPerSession?: number;
  daysPerMonth?: number;
};

export type AllyIncomeProjectionScenario = {
  key: SpaceTrafficProjectionScenario;
  label: string;
  evDemandMultiplierPercent: number;
  scenarioEvPercent: number;
  eligibleEvVehiclesPerDay: number;
  unconstrainedSessionsPerDay: number;
  requiredConnectorsForDemand: number;
  requiredChargersForDemand: number;
  configuredConnectorCapacity: number;
  connectorCapacitySessionsPerDay: number;
  powerCapacityKwhPerDay: number | null;
  powerCapacitySessionsPerDay: number | null;
  capacitySessionsPerDay: number;
  sessionsPerDay: number;
  capacityLimited: boolean;
  capacityConstraint: "CONNECTORS" | "POWER" | "BOTH" | "UNSPECIFIED";
  energyKwhPerDay: number;
  energyKwhPerMonth: number;
  grossRevenueMonthly: number;
  energyCostMonthly: number;
  grossMarginMonthly: number;
  allySharePercent: number;
  allyIncomeMonthly: number;
  allyIncomeAnnual: number;
};

export type AllyIncomeProjectionSnapshot = {
  version: 1;
  basis: "EVGREEN_ALLY_DEMAND_AND_INCOME_SCENARIOS";
  selectedScenario: "REALISTIC";
  assumptions: {
    estimatedDailyVehicles: number;
    estimatedEvPercent: number;
    chargerCount: number;
    configuredConnectors: number;
    connectorsPerCharger: number;
    benchmarkSessionsPerConnectorPerDay: number;
    benchmarkKwhPerSession: number;
    daysPerMonth: number;
    totalPowerKw: number | null;
    operatingHoursPerDay: number | null;
    efficiencyPercent: number | null;
    salePricePerKwh: number;
    energyCostPerKwh: number;
    effectiveEnergyCostPerKwh: number;
    solarCoveragePercent: number;
    solarEnergyCostPerKwh: number | null;
    solarCostApplied: boolean;
    allySharePercent: number;
  };
  scenarios: Record<SpaceTrafficProjectionScenario, AllyIncomeProjectionScenario>;
};

const DEFAULT_ALLY_SHARE_PERCENT = 10;
const DEFAULT_DAYS_PER_MONTH = 30;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function positive(value: unknown, field: string, allowZero = false): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || (allowZero ? numeric < 0 : numeric <= 0)) {
    throw new Error(`${field} debe ser un número ${allowZero ? "igual o mayor" : "mayor"} que cero`);
  }
  return numeric;
}

function capacityConstraint(
  connectorCapacitySessionsPerDay: number,
  powerCapacitySessionsPerDay: number | null,
): AllyIncomeProjectionScenario["capacityConstraint"] {
  if (powerCapacitySessionsPerDay === null) return "UNSPECIFIED";
  if (Math.abs(connectorCapacitySessionsPerDay - powerCapacitySessionsPerDay) < 0.01) return "BOTH";
  return connectorCapacitySessionsPerDay < powerCapacitySessionsPerDay ? "CONNECTORS" : "POWER";
}

/**
 * Proyección comercial para el aliado basada exclusivamente en demanda y operación.
 * No calcula ni retorna CAPEX, ROI, payback, waterfall ni distribución del inversionista.
 */
export function buildAllyIncomeProjection(input: AllyIncomeProjectionInput): AllyIncomeProjectionSnapshot {
  const estimatedDailyVehicles = positive(input.estimatedDailyVehicles, "El flujo diario de vehículos");
  const estimatedEvPercent = positive(input.estimatedEvPercent, "El porcentaje de vehículos eléctricos", true);
  if (estimatedEvPercent > 100) throw new Error("El porcentaje de vehículos eléctricos no puede ser superior a 100 %");

  const chargerCount = Math.max(1, Math.round(positive(input.chargerCount, "La cantidad de cargadores")));
  const salePricePerKwh = positive(input.salePricePerKwh, "El precio de venta por kWh");
  const energyCostPerKwh = positive(input.energyCostPerKwh, "El costo de energía por kWh", true);
  const allySharePercent = positive(input.allySharePercent ?? DEFAULT_ALLY_SHARE_PERCENT, "La participación preliminar del aliado", true);
  if (allySharePercent > 50) throw new Error("La participación preliminar del aliado no puede superar 50 %");

  const benchmarkSessionsPerConnectorPerDay = positive(
    input.benchmarkSessionsPerConnectorPerDay ?? DEFAULT_BENCHMARK_SESSIONS_PER_CONNECTOR_PER_DAY,
    "El benchmark de sesiones por manguera",
  );
  const benchmarkKwhPerSession = positive(
    input.benchmarkKwhPerSession ?? DEFAULT_BENCHMARK_KWH_PER_SESSION,
    "El benchmark de energía por sesión",
  );
  const daysPerMonth = positive(input.daysPerMonth ?? DEFAULT_DAYS_PER_MONTH, "Los días del mes");
  const solarEnergy = calculateSolarBlendedEnergyCost({
    gridEnergyCostPerKwh: energyCostPerKwh,
    hasSolarPanels: input.hasSolarPanels,
    solarCoveragePercent: input.solarCoveragePercent,
    solarEnergyCostPerKwh: input.solarEnergyCostPerKwh,
  });

  const hasDeclaredPower = input.totalPowerKw !== undefined && input.totalPowerKw !== null && Number(input.totalPowerKw) > 0;
  const totalPowerKw = hasDeclaredPower ? positive(input.totalPowerKw, "La potencia total") : null;
  const operatingHoursPerDay = hasDeclaredPower
    ? positive(input.operatingHoursPerDay ?? 16, "Las horas de operación diarias")
    : null;
  const efficiencyPercent = hasDeclaredPower
    ? positive(input.efficiencyPercent ?? 92, "La eficiencia de entrega", true)
    : null;
  if (operatingHoursPerDay !== null && operatingHoursPerDay > 24) throw new Error("Las horas de operación no pueden superar 24");
  if (efficiencyPercent !== null && (efficiencyPercent <= 0 || efficiencyPercent > 100)) throw new Error("La eficiencia debe estar entre 0 % y 100 %");

  const configuredConnectors = chargerCount * CONNECTORS_PER_CHARGER;
  const connectorCapacitySessionsPerDay = configuredConnectors * benchmarkSessionsPerConnectorPerDay;
  const powerCapacityKwhPerDay = totalPowerKw !== null && operatingHoursPerDay !== null && efficiencyPercent !== null
    ? totalPowerKw * operatingHoursPerDay * (efficiencyPercent / 100)
    : null;
  const powerCapacitySessionsPerDay = powerCapacityKwhPerDay === null
    ? null
    : powerCapacityKwhPerDay / benchmarkKwhPerSession;
  const capacitySessionsPerDay = powerCapacitySessionsPerDay === null
    ? connectorCapacitySessionsPerDay
    : Math.min(connectorCapacitySessionsPerDay, powerCapacitySessionsPerDay);
  const constraint = capacityConstraint(connectorCapacitySessionsPerDay, powerCapacitySessionsPerDay);

  const scenarios = Object.fromEntries(SPACE_TRAFFIC_PROJECTION_SCENARIOS.map((scenario) => {
    const scenarioEvPercent = Math.min(100, estimatedEvPercent * (scenario.evDemandMultiplierPercent / 100));
    const eligibleEvVehiclesPerDay = estimatedDailyVehicles * (scenarioEvPercent / 100);
    const unconstrainedSessionsPerDay = eligibleEvVehiclesPerDay;
    const requiredConnectorsForDemand = Math.ceil(unconstrainedSessionsPerDay / benchmarkSessionsPerConnectorPerDay);
    const requiredChargersForDemand = Math.ceil(requiredConnectorsForDemand / CONNECTORS_PER_CHARGER);
    const sessionsPerDay = Math.min(unconstrainedSessionsPerDay, capacitySessionsPerDay);
    const energyKwhPerDay = sessionsPerDay * benchmarkKwhPerSession;
    const energyKwhPerMonth = energyKwhPerDay * daysPerMonth;
    const grossRevenueMonthly = energyKwhPerMonth * salePricePerKwh;
    const energyCostMonthly = energyKwhPerMonth * solarEnergy.effectiveEnergyCostPerKwh;
    const grossMarginMonthly = Math.max(0, grossRevenueMonthly - energyCostMonthly);
    const allyIncomeMonthly = round(grossMarginMonthly * (allySharePercent / 100));
    const result: AllyIncomeProjectionScenario = {
      key: scenario.key,
      label: scenario.label,
      evDemandMultiplierPercent: scenario.evDemandMultiplierPercent,
      scenarioEvPercent: round(scenarioEvPercent),
      eligibleEvVehiclesPerDay: round(eligibleEvVehiclesPerDay),
      unconstrainedSessionsPerDay: round(unconstrainedSessionsPerDay),
      requiredConnectorsForDemand,
      requiredChargersForDemand,
      configuredConnectorCapacity: configuredConnectors,
      connectorCapacitySessionsPerDay: round(connectorCapacitySessionsPerDay),
      powerCapacityKwhPerDay: powerCapacityKwhPerDay === null ? null : round(powerCapacityKwhPerDay),
      powerCapacitySessionsPerDay: powerCapacitySessionsPerDay === null ? null : round(powerCapacitySessionsPerDay),
      capacitySessionsPerDay: round(capacitySessionsPerDay),
      sessionsPerDay: round(sessionsPerDay),
      capacityLimited: unconstrainedSessionsPerDay > capacitySessionsPerDay,
      capacityConstraint: constraint,
      energyKwhPerDay: round(energyKwhPerDay),
      energyKwhPerMonth: round(energyKwhPerMonth),
      grossRevenueMonthly: round(grossRevenueMonthly),
      energyCostMonthly: round(energyCostMonthly),
      grossMarginMonthly: round(grossMarginMonthly),
      allySharePercent: round(allySharePercent),
      allyIncomeMonthly,
      allyIncomeAnnual: round(allyIncomeMonthly * 12),
    };
    return [scenario.key, result];
  })) as Record<SpaceTrafficProjectionScenario, AllyIncomeProjectionScenario>;

  return {
    version: 1,
    basis: "EVGREEN_ALLY_DEMAND_AND_INCOME_SCENARIOS",
    selectedScenario: "REALISTIC",
    assumptions: {
      estimatedDailyVehicles: round(estimatedDailyVehicles),
      estimatedEvPercent: round(estimatedEvPercent),
      chargerCount,
      configuredConnectors,
      connectorsPerCharger: CONNECTORS_PER_CHARGER,
      benchmarkSessionsPerConnectorPerDay: round(benchmarkSessionsPerConnectorPerDay, 1),
      benchmarkKwhPerSession: round(benchmarkKwhPerSession),
      daysPerMonth: round(daysPerMonth),
      totalPowerKw: totalPowerKw === null ? null : round(totalPowerKw),
      operatingHoursPerDay: operatingHoursPerDay === null ? null : round(operatingHoursPerDay, 1),
      efficiencyPercent: efficiencyPercent === null ? null : round(efficiencyPercent),
      salePricePerKwh: round(salePricePerKwh),
      energyCostPerKwh: solarEnergy.gridEnergyCostPerKwh,
      effectiveEnergyCostPerKwh: solarEnergy.effectiveEnergyCostPerKwh,
      solarCoveragePercent: solarEnergy.solarCoveragePercent,
      solarEnergyCostPerKwh: solarEnergy.solarEnergyCostPerKwh,
      solarCostApplied: solarEnergy.solarCostApplied,
      allySharePercent: round(allySharePercent),
    },
    scenarios,
  };
}
