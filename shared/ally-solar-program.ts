export type AllySolarProgramInput = {
  enabled?: boolean | number | null;
  currentMonthlyBillCop?: number | null;
  savingsCoveragePercent?: number | null;
  agreementYears?: number | null;
  annualCpiPercent?: number | null;
  usefulLifeYears?: number | null;
  systemPowerKwp?: number | null;
  annualGenerationKwh?: number | null;
  selfConsumptionPercent?: number | null;
  exportPercent?: number | null;
  gridTariffCopPerKwh?: number | null;
};

export type AllySolarProgramSnapshot = {
  version: 1;
  basis: "EVGREEN_ALLY_SOLAR_SAVINGS_AND_COMBINED_BENEFIT";
  enabled: true;
  assumptions: {
    currentMonthlyBillCop: number;
    savingsCoveragePercent: number;
    agreementYears: number;
    annualCpiPercent: number;
    usefulLifeYears: number;
    systemPowerKwp: number | null;
    annualGenerationKwh: number | null;
    selfConsumptionPercent: number | null;
    exportPercent: number | null;
    gridTariffCopPerKwh: number | null;
  };
  initialMonthlySavingsCop: number;
  initialAnnualSavingsCop: number;
  initialMonthlyReplacementQuotaCop: number;
  agreementSavingsCop: number;
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

/**
 * Modela únicamente reducción de gasto energético del aliado. No es una
 * proyección de ventas solares ni una garantía contractual.
 *
 * La cuota mensual de sustitución se deriva como factura actual menos el
 * ahorro cubierto. El ahorro aumenta con el IPC durante el plazo indicado;
 * después del plazo se presenta como beneficio operativo referencial sujeto a
 * generación, consumo, degradación, mantenimiento y contrato de cesión.
 */
export function buildAllySolarProgram(input: AllySolarProgramInput): AllySolarProgramSnapshot | null {
  const enabled = input.enabled === true || Number(input.enabled) === 1;
  if (!enabled) return null;

  const currentMonthlyBillCop = bounded(input.currentMonthlyBillCop, 0, 1, 999_999_999_999, "La factura mensual promedio");
  const savingsCoveragePercent = bounded(input.savingsCoveragePercent, 0, 0, 100, "El porcentaje de ahorro solar");
  const agreementYears = Math.round(bounded(input.agreementYears, DEFAULT_AGREEMENT_YEARS, 1, 30, "El plazo del acuerdo solar"));
  const annualCpiPercent = bounded(input.annualCpiPercent, DEFAULT_ANNUAL_CPI_PERCENT, 0, 30, "El IPC anual del acuerdo solar");
  const usefulLifeYears = Math.round(bounded(input.usefulLifeYears, DEFAULT_USEFUL_LIFE_YEARS, agreementYears, 50, "La vida útil del sistema solar"));

  const systemPowerKwp = optionalFinite(input.systemPowerKwp);
  const annualGenerationKwh = optionalFinite(input.annualGenerationKwh);
  const selfConsumptionPercent = optionalFinite(input.selfConsumptionPercent);
  const exportPercent = optionalFinite(input.exportPercent);
  const gridTariffCopPerKwh = optionalFinite(input.gridTariffCopPerKwh);
  for (const [field, value] of [
    ["El autoconsumo solar", selfConsumptionPercent],
    ["La exportación solar", exportPercent],
  ] as const) {
    if (value !== null && (value < 0 || value > 100)) throw new Error(`${field} debe estar entre 0 y 100`);
  }
  if (systemPowerKwp !== null && systemPowerKwp <= 0) throw new Error("La potencia solar debe ser mayor que cero");
  if (annualGenerationKwh !== null && annualGenerationKwh <= 0) throw new Error("La generación solar anual debe ser mayor que cero");
  if (gridTariffCopPerKwh !== null && gridTariffCopPerKwh < 0) throw new Error("La tarifa de red no puede ser negativa");

  const initialMonthlySavingsCop = round(currentMonthlyBillCop * (savingsCoveragePercent / 100));
  const initialAnnualSavingsCop = round(initialMonthlySavingsCop * 12);
  const initialMonthlyReplacementQuotaCop = round(currentMonthlyBillCop - initialMonthlySavingsCop);

  let agreementSavingsCop = 0;
  for (let year = 0; year < agreementYears; year += 1) {
    agreementSavingsCop += initialAnnualSavingsCop * ((1 + annualCpiPercent / 100) ** year);
  }
  const postAgreementYears = usefulLifeYears - agreementYears;
  let postAgreementCumulativeSavingsCop = 0;
  for (let year = agreementYears; year < usefulLifeYears; year += 1) {
    postAgreementCumulativeSavingsCop += initialAnnualSavingsCop * ((1 + annualCpiPercent / 100) ** year);
  }
  const postAgreementAnnualSavingsCop = postAgreementYears > 0
    ? initialAnnualSavingsCop * ((1 + annualCpiPercent / 100) ** agreementYears)
    : 0;

  return {
    version: 1,
    basis: "EVGREEN_ALLY_SOLAR_SAVINGS_AND_COMBINED_BENEFIT",
    enabled: true,
    assumptions: {
      currentMonthlyBillCop: round(currentMonthlyBillCop),
      savingsCoveragePercent: round(savingsCoveragePercent, 2),
      agreementYears,
      annualCpiPercent: round(annualCpiPercent, 2),
      usefulLifeYears,
      systemPowerKwp: systemPowerKwp === null ? null : round(systemPowerKwp, 2),
      annualGenerationKwh: annualGenerationKwh === null ? null : round(annualGenerationKwh),
      selfConsumptionPercent: selfConsumptionPercent === null ? null : round(selfConsumptionPercent, 2),
      exportPercent: exportPercent === null ? null : round(exportPercent, 2),
      gridTariffCopPerKwh: gridTariffCopPerKwh === null ? null : round(gridTariffCopPerKwh),
    },
    initialMonthlySavingsCop,
    initialAnnualSavingsCop,
    initialMonthlyReplacementQuotaCop,
    agreementSavingsCop: round(agreementSavingsCop),
    postAgreementAnnualSavingsCop: round(postAgreementAnnualSavingsCop),
    postAgreementCumulativeSavingsCop: round(postAgreementCumulativeSavingsCop),
    totalReferenceSavingsCop: round(agreementSavingsCop + postAgreementCumulativeSavingsCop),
  };
}
