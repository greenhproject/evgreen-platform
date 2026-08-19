/**
 * Waterfall financiero canónico para proyecciones y liquidaciones EVGreen.
 *
 * Orden invariable:
 * ingreso bruto → costo de energía → margen bruto → aliado → margen neto
 * distribuible → participación de inversionista y EVGreen.
 */
export type FinancialWaterfallInput = {
  grossRevenue: number;
  totalKwh: number;
  energyCostPerKwh: number;
  hostSharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  fixedExpenses?: number;
};

export type FinancialWaterfall = {
  grossRevenue: number;
  totalKwh: number;
  energyCostPerKwh: number;
  energyCost: number;
  fixedExpenses: number;
  grossMargin: number;
  hostPayout: number;
  netDistributableMargin: number;
  investorPool: number;
  evgreenPool: number;
};

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const money = (value: number) => Math.round(value * 100) / 100;

export function validateFinancialSplit(input: Pick<FinancialWaterfallInput, "hostSharePercent" | "investorSharePercent" | "evgreenSharePercent">): void {
  const host = Number(input.hostSharePercent);
  const investor = Number(input.investorSharePercent);
  const evgreen = Number(input.evgreenSharePercent);

  if (![host, investor, evgreen].every(Number.isFinite)) {
    throw new Error("Los porcentajes financieros deben ser números válidos");
  }
  if (host < 0 || host > 50) {
    throw new Error("La participación del aliado debe estar entre 0 % y 50 % del margen bruto");
  }
  if (investor < 0 || evgreen < 0 || Math.abs(investor + evgreen - 100) > 0.001) {
    throw new Error("La participación de Inversionista y EVGreen debe sumar exactamente 100 % del margen neto");
  }
}

export function calculateFinancialWaterfall(input: FinancialWaterfallInput): FinancialWaterfall {
  validateFinancialSplit(input);

  const grossRevenue = money(nonNegative(input.grossRevenue));
  const totalKwh = money(nonNegative(input.totalKwh));
  const energyCostPerKwh = money(nonNegative(input.energyCostPerKwh));
  const energyCost = money(totalKwh * energyCostPerKwh);
  const fixedExpenses = money(nonNegative(input.fixedExpenses ?? 0));
  const grossMargin = money(Math.max(0, grossRevenue - energyCost - fixedExpenses));
  const hostPayout = money(grossMargin * (input.hostSharePercent / 100));
  const netDistributableMargin = money(Math.max(0, grossMargin - hostPayout));
  const investorPool = money(netDistributableMargin * (input.investorSharePercent / 100));
  const evgreenPool = money(netDistributableMargin - investorPool);

  return {
    grossRevenue,
    totalKwh,
    energyCostPerKwh,
    energyCost,
    fixedExpenses,
    grossMargin,
    hostPayout,
    netDistributableMargin,
    investorPool,
    evgreenPool,
  };
}
