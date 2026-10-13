export type AllySolarProgramInput = {
  enabled?: boolean | number | null;
  currentMonthlyBillCop?: number | null;
  /** Generación anual / consumo anual; indicador técnico, no ahorro de factura. */
  energyVsConsumptionPercent?: number | null;
  savingsCoveragePercent?: number | null;
  agreementYears?: number | null;
  annualCpiPercent?: number | null;
  usefulLifeYears?: number | null;
  systemPowerKwp?: number | null;
  annualGenerationKwh?: number | null;
  selfConsumptionPercent?: number | null;
  exportPercent?: number | null;
  gridTariffCopPerKwh?: number | null;
  /** Cuota periódica explícita de la propuesta OpenSolar, si existe. */
  monthlyFinancingPaymentCop?: number | null;
  /** Factura solar propuesta del año base; no es la cuota de financiación. */
  initialMonthlySolarBillCop?: number | null;
  /** Factura solar residual indicada para el inicio del periodo posterior al acuerdo. */
  postAgreementMonthlySolarBillCop?: number | null;
};

export type AllySolarProgramSnapshot = {
  version: 2;
  basis: "EVGREEN_ALLY_SOLAR_CASHFLOW_AND_POST_AGREEMENT_SAVINGS";
  enabled: true;
  assumptions: {
    currentMonthlyBillCop: number;
    /** Indicador técnico OpenSolar que puede exceder 100% por exportación. */
    energyVsConsumptionPercent: number | null;
    /** Ahorro de factura del año 1: cotizado por OpenSolar o derivado sólo si no hay propuesta. */
    savingsCoveragePercent: number;
    agreementYears: number;
    annualCpiPercent: number;
    usefulLifeYears: number;
    systemPowerKwp: number | null;
    annualGenerationKwh: number | null;
    selfConsumptionPercent: number | null;
    exportPercent: number | null;
    gridTariffCopPerKwh: number | null;
    monthlyFinancingPaymentCop: number | null;
    initialMonthlySolarBillCop: number | null;
    postAgreementMonthlySolarBillCop: number | null;
    financingPaymentSource: "OpenSolar" | "Derivada de cobertura" | "No disponible";
    solarBillSource: "OpenSolar" | "Derivada de cobertura" | "No disponible";
  };
  /** Ahorro energético bruto: factura de red menos factura solar residual, antes de cuota. */
  initialMonthlySavingsCop: number;
  initialAnnualSavingsCop: number;
  /** Alias conservado para compatibilidad; representa factura solar residual del año 1, no una cuota. */
  initialMonthlyReplacementQuotaCop: number;
  initialMonthlyFinancingPaymentCop: number | null;
  initialMonthlyNetCashflowCop: number;
  agreementSavingsCop: number;
  postAgreementMonthlyGridBillCop: number;
  postAgreementMonthlySolarBillCop: number;
  postAgreementMonthlyNetSavingsCop: number;
  postAgreementAnnualSavingsCop: number;
  postAgreementCumulativeSavingsCop: number;
  totalReferenceSavingsCop: number;
};

const DEFAULT_AGREEMENT_YEARS = 6;
const DEFAULT_ANNUAL_CPI_PERCENT = 3;
const DEFAULT_USEFUL_LIFE_YEARS = 30;

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function optionalFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function bounded(value: unknown, fallback: number, min: number, max: number, field: string): number {
  const numeric = optionalFinite(value) ?? fallback;
  if (numeric < min || numeric > max) {
    throw new Error(`${field} debe estar entre ${min} y ${max}`);
  }
  return numeric;
}

function positiveOrNull(value: unknown, field: string): number | null {
  const numeric = optionalFinite(value);
  if (numeric === null) return null;
  if (numeric < 0) throw new Error(`${field} no puede ser negativo`);
  return numeric;
}

/**
 * Modela el flujo de caja del programa solar del aliado sin confundir tres
 * conceptos distintos: factura de red evitada, factura solar residual y cuota
 * de financiación. Si OpenSolar expone estos valores, se usan literalmente;
 * sólo para registros históricos sin propuesta se conserva la aproximación por
 * cobertura y se etiqueta como derivada.
 */
export function buildAllySolarProgram(input: AllySolarProgramInput): AllySolarProgramSnapshot | null {
  const enabled = input.enabled === true || Number(input.enabled) === 1;
  if (!enabled) return null;

  const currentMonthlyBillCop = bounded(input.currentMonthlyBillCop, 0, 1, 999_999_999_999, "La factura mensual promedio");
  const energyVsConsumptionPercent = optionalFinite(input.energyVsConsumptionPercent);
  const savingsCoveragePercent = bounded(input.savingsCoveragePercent, 0, 0, 100, "El porcentaje de ahorro solar");
  const agreementYears = Math.round(bounded(input.agreementYears, DEFAULT_AGREEMENT_YEARS, 1, 30, "El plazo del acuerdo solar"));
  const annualCpiPercent = bounded(input.annualCpiPercent, DEFAULT_ANNUAL_CPI_PERCENT, 0, 30, "El IPC anual del acuerdo solar");
  const usefulLifeYears = Math.round(bounded(input.usefulLifeYears, DEFAULT_USEFUL_LIFE_YEARS, agreementYears, 50, "La vida útil del sistema solar"));

  const systemPowerKwp = optionalFinite(input.systemPowerKwp);
  const annualGenerationKwh = optionalFinite(input.annualGenerationKwh);
  const selfConsumptionPercent = optionalFinite(input.selfConsumptionPercent);
  const exportPercent = optionalFinite(input.exportPercent);
  const gridTariffCopPerKwh = optionalFinite(input.gridTariffCopPerKwh);
  const monthlyFinancingPaymentCop = positiveOrNull(input.monthlyFinancingPaymentCop, "La cuota mensual de financiación");
  const providedInitialSolarBillCop = positiveOrNull(input.initialMonthlySolarBillCop, "La factura solar residual inicial");
  const providedPostAgreementSolarBillCop = positiveOrNull(input.postAgreementMonthlySolarBillCop, "La factura solar residual posterior al acuerdo");

  for (const [field, value] of [
    ["El autoconsumo solar", selfConsumptionPercent],
    ["La exportación solar", exportPercent],
  ] as const) {
    if (value !== null && (value < 0 || value > 100)) throw new Error(`${field} debe estar entre 0 y 100`);
  }
  if (systemPowerKwp !== null && systemPowerKwp <= 0) throw new Error("La potencia solar debe ser mayor que cero");
  if (annualGenerationKwh !== null && annualGenerationKwh <= 0) throw new Error("La generación solar anual debe ser mayor que cero");
  if (gridTariffCopPerKwh !== null && gridTariffCopPerKwh < 0) throw new Error("La tarifa de red no puede ser negativa");
  if (energyVsConsumptionPercent !== null && (energyVsConsumptionPercent < 0 || energyVsConsumptionPercent > 1000)) {
    throw new Error("La energía frente al consumo debe estar entre 0 y 1000");
  }

  const derivedInitialSolarBillCop = round(currentMonthlyBillCop * (1 - savingsCoveragePercent / 100));
  const initialMonthlySolarBillCop = providedInitialSolarBillCop ?? derivedInitialSolarBillCop;
  const initialMonthlySavingsCop = round(Math.max(0, currentMonthlyBillCop - initialMonthlySolarBillCop));
  const initialAnnualSavingsCop = round(initialMonthlySavingsCop * 12);
  const initialMonthlyNetCashflowCop = round(initialMonthlySavingsCop - (monthlyFinancingPaymentCop ?? 0));
  const annualRate = annualCpiPercent / 100;

  let agreementSavingsCop = 0;
  for (let year = 0; year < agreementYears; year += 1) {
    const currentMonthlyGridBill = currentMonthlyBillCop * ((1 + annualRate) ** year);
    // La cuota OpenSolar explícita es una cuota contractual mensual; no se le
    // aplica IPC salvo que OpenSolar exponga una cuota distinta por periodo.
    const yearlyFinancingPayment = (monthlyFinancingPaymentCop ?? 0) * 12;
    const projectedSolarBill = providedInitialSolarBillCop === null
      ? currentMonthlyGridBill * (1 - savingsCoveragePercent / 100)
      : initialMonthlySolarBillCop * ((1 + annualRate) ** year);
    agreementSavingsCop += ((currentMonthlyGridBill - projectedSolarBill) * 12) - yearlyFinancingPayment;
  }

  const postAgreementYears = usefulLifeYears - agreementYears;
  const postAgreementMonthlyGridBillCop = round(currentMonthlyBillCop * ((1 + annualRate) ** agreementYears));
  const postAgreementMonthlySolarBillCop = round(
    providedPostAgreementSolarBillCop
      ?? initialMonthlySolarBillCop * ((1 + annualRate) ** agreementYears),
  );
  const postAgreementMonthlyNetSavingsCop = round(Math.max(0, postAgreementMonthlyGridBillCop - postAgreementMonthlySolarBillCop));
  const postAgreementAnnualSavingsCop = postAgreementYears > 0 ? round(postAgreementMonthlyNetSavingsCop * 12) : 0;
  let postAgreementCumulativeSavingsCop = 0;
  for (let year = agreementYears; year < usefulLifeYears; year += 1) {
    const gridBill = currentMonthlyBillCop * ((1 + annualRate) ** year);
    const solarBill = providedPostAgreementSolarBillCop !== null
      ? providedPostAgreementSolarBillCop * ((1 + annualRate) ** (year - agreementYears))
      : initialMonthlySolarBillCop * ((1 + annualRate) ** year);
    postAgreementCumulativeSavingsCop += Math.max(0, gridBill - solarBill) * 12;
  }

  return {
    version: 2,
    basis: "EVGREEN_ALLY_SOLAR_CASHFLOW_AND_POST_AGREEMENT_SAVINGS",
    enabled: true,
    assumptions: {
      currentMonthlyBillCop: round(currentMonthlyBillCop),
      energyVsConsumptionPercent: energyVsConsumptionPercent === null ? null : round(energyVsConsumptionPercent, 2),
      savingsCoveragePercent: round(savingsCoveragePercent, 2),
      agreementYears,
      annualCpiPercent: round(annualCpiPercent, 2),
      usefulLifeYears,
      systemPowerKwp: systemPowerKwp === null ? null : round(systemPowerKwp, 2),
      annualGenerationKwh: annualGenerationKwh === null ? null : round(annualGenerationKwh),
      selfConsumptionPercent: selfConsumptionPercent === null ? null : round(selfConsumptionPercent, 2),
      exportPercent: exportPercent === null ? null : round(exportPercent, 2),
      gridTariffCopPerKwh: gridTariffCopPerKwh === null ? null : round(gridTariffCopPerKwh),
      monthlyFinancingPaymentCop: monthlyFinancingPaymentCop === null ? null : round(monthlyFinancingPaymentCop),
      initialMonthlySolarBillCop: round(initialMonthlySolarBillCop),
      postAgreementMonthlySolarBillCop: providedPostAgreementSolarBillCop === null ? null : round(providedPostAgreementSolarBillCop),
      financingPaymentSource: monthlyFinancingPaymentCop === null ? "No disponible" : "OpenSolar",
      solarBillSource: providedInitialSolarBillCop === null ? "Derivada de cobertura" : "OpenSolar",
    },
    initialMonthlySavingsCop,
    initialAnnualSavingsCop,
    initialMonthlyReplacementQuotaCop: round(initialMonthlySolarBillCop),
    initialMonthlyFinancingPaymentCop: monthlyFinancingPaymentCop === null ? null : round(monthlyFinancingPaymentCop),
    initialMonthlyNetCashflowCop,
    agreementSavingsCop: round(agreementSavingsCop),
    postAgreementMonthlyGridBillCop,
    postAgreementMonthlySolarBillCop,
    postAgreementMonthlyNetSavingsCop,
    postAgreementAnnualSavingsCop,
    postAgreementCumulativeSavingsCop: round(postAgreementCumulativeSavingsCop),
    totalReferenceSavingsCop: round(agreementSavingsCop + postAgreementCumulativeSavingsCop),
  };
}
