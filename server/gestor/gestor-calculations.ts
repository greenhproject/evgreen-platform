/**
 * Cálculos centralizados del Portal Comercial.
 *
 * La comisión se calcula sobre el margen distribuible de cada transacción:
 * ingreso cobrado - costo de energía - participación del aliado comercial.
 * El importe se limita a la bolsa EVGreen para que nunca afecte la participación
 * configurada para inversionistas.
 */
export type GestorWaterfallInput = {
  grossRevenue: number;
  kwhConsumed: number;
  energyPurchaseCostPerKwh: number;
  hostSharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  gestorCommissionPercent: number;
};

export type GestorWaterfall = {
  grossRevenue: number;
  energyCost: number;
  fixedExpenses: number;
  grossMargin: number;
  hostPayout: number;
  netDistributableMargin: number;
  investorPool: number;
  evgreenPool: number;
  gestorCommission: number;
  evgreenRetained: number;
};

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const roundMoney = (value: number) => Math.round(value * 100) / 100;

type GestorWaterfallBaseInput = Omit<GestorWaterfallInput, "kwhConsumed" | "energyPurchaseCostPerKwh"> & {
  energyCost: number;
  fixedExpenses?: number;
};

function calculateFromEnergyCost(input: GestorWaterfallBaseInput): GestorWaterfall {
  const grossRevenue = nonNegative(input.grossRevenue);
  const energyCost = roundMoney(nonNegative(input.energyCost));
  const fixedExpenses = roundMoney(nonNegative(input.fixedExpenses ?? 0));
  const grossMargin = roundMoney(nonNegative(grossRevenue - energyCost - fixedExpenses));
  const hostPayout = roundMoney(grossMargin * (nonNegative(input.hostSharePercent) / 100));
  const netDistributableMargin = roundMoney(nonNegative(grossMargin - hostPayout));
  const investorPool = roundMoney(netDistributableMargin * (nonNegative(input.investorSharePercent) / 100));
  const evgreenPool = roundMoney(netDistributableMargin * (nonNegative(input.evgreenSharePercent) / 100));
  const requestedCommission = roundMoney(netDistributableMargin * (nonNegative(input.gestorCommissionPercent) / 100));
  const gestorCommission = roundMoney(Math.min(requestedCommission, evgreenPool));

  return {
    grossRevenue,
    energyCost,
    fixedExpenses,
    grossMargin,
    hostPayout,
    netDistributableMargin,
    investorPool,
    evgreenPool,
    gestorCommission,
    evgreenRetained: roundMoney(nonNegative(evgreenPool - gestorCommission)),
  };
}

export function calculateGestorWaterfall(input: GestorWaterfallInput): GestorWaterfall {
  return calculateFromEnergyCost({
    ...input,
    energyCost: nonNegative(input.kwhConsumed) * nonNegative(input.energyPurchaseCostPerKwh),
  });
}

export function calculateGestorWaterfallFromAggregate(
  input: GestorWaterfallBaseInput,
): GestorWaterfall {
  return calculateFromEnergyCost(input);
}

/** Colombia no utiliza horario de verano: UTC-5 durante todo el año. */
export function getColombiaDayBounds(dateKey: string) {
  const start = new Date(`${dateKey}T05:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getColombiaMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 5, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}
