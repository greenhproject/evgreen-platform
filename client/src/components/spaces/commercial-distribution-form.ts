import { resolveSpaceCommercialDistribution } from "@shared/space-commercial-distribution";

export type CommercialDistributionValues = {
  allySharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
};
export type CommercialDistributionSource = "SPACE" | "PROJECT" | "DEFAULT";
export type ResolvedCommercialDistribution = CommercialDistributionValues & { source: CommercialDistributionSource };
export type CommercialDistributionDraft = { [K in keyof CommercialDistributionValues]: string };

export function suggestedCommercialDistribution(spaceType?: string | null): ResolvedCommercialDistribution {
  return resolveSpaceCommercialDistribution({ spaceType });
}

/** Consume el reparto resuelto por getById; no intenta inferir acuerdos desde análisis IA. */
export function commercialDistributionForForm(space: {
  spaceType?: string | null;
  commercialDistribution?: ResolvedCommercialDistribution | null;
}): ResolvedCommercialDistribution {
  return space.commercialDistribution ?? suggestedCommercialDistribution(space.spaceType);
}

export function commercialDistributionToDraft(values: CommercialDistributionValues): CommercialDistributionDraft {
  return {
    allySharePercent: String(values.allySharePercent),
    investorSharePercent: String(values.investorSharePercent),
    evgreenSharePercent: String(values.evgreenSharePercent),
  };
}

/** Conserva incluso '', '3,' y '3.75': la conversión sólo se usa para validar/calcular. */
export function changeCommercialDistributionDraft(
  draft: CommercialDistributionDraft,
  field: keyof CommercialDistributionDraft,
  text: string,
): CommercialDistributionDraft {
  return { ...draft, [field]: text };
}

export function parseCommercialPercentage(text: string, maximum: number): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(trimmed)) return undefined;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= maximum ? value : undefined;
}

export function validateCommercialDistributionDraft(draft: CommercialDistributionDraft): {
  values?: CommercialDistributionValues;
  errors: Partial<Record<keyof CommercialDistributionDraft | "total", string>>;
} {
  const ally = parseCommercialPercentage(draft.allySharePercent, 50);
  const investor = parseCommercialPercentage(draft.investorSharePercent, 100);
  const evgreen = parseCommercialPercentage(draft.evgreenSharePercent, 100);
  const errors: Partial<Record<keyof CommercialDistributionDraft | "total", string>> = {};
  if (ally === undefined) errors.allySharePercent = "Aliado: completa un valor entre 0 y 50%, con máximo 2 decimales.";
  if (investor === undefined) errors.investorSharePercent = "Inversionista: completa un valor entre 0 y 100%, con máximo 2 decimales.";
  if (evgreen === undefined) errors.evgreenSharePercent = "EVGreen: completa un valor entre 0 y 100%, con máximo 2 decimales.";
  // Suma en centésimas para evitar errores binarios con decimales válidos.
  if (investor !== undefined && evgreen !== undefined && Math.round(investor * 100) + Math.round(evgreen * 100) !== 10000) {
    errors.total = "Inversionista y EVGreen deben sumar exactamente 100% del margen neto.";
  }
  return {
    errors,
    ...(Object.keys(errors).length === 0 ? { values: { allySharePercent: ally!, investorSharePercent: investor!, evgreenSharePercent: evgreen! } } : {}),
  };
}

export function requireCommercialDistribution(draft: CommercialDistributionDraft): CommercialDistributionValues {
  const result = validateCommercialDistributionDraft(draft);
  if (!result.values) throw new Error(Object.values(result.errors)[0]);
  return result.values;
}

export function commercialDistributionChanged(draft: CommercialDistributionDraft, saved: CommercialDistributionValues): boolean {
  const result = validateCommercialDistributionDraft(draft);
  return !result.values || (Object.keys(result.values) as Array<keyof CommercialDistributionValues>).some(key => result.values![key] !== saved[key]);
}

/** Si el guardado falla, nunca genera un documento con un reparto sólo local. */
export async function saveCommercialDistributionBeforePdf<T>(options: {
  draft: CommercialDistributionDraft;
  saved: CommercialDistributionValues;
  save: (values: CommercialDistributionValues) => Promise<unknown>;
  generate: () => Promise<T>;
}): Promise<T> {
  const values = requireCommercialDistribution(options.draft);
  if (commercialDistributionChanged(options.draft, options.saved)) await options.save(values);
  return options.generate();
}
