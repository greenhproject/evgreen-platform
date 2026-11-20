import { getRevenueDistributionForSpaceType } from "./space-investment-scoring-policy";
import { validateFinancialSplit } from "./financial-waterfall";

export type SpaceCommercialDistribution = {
  allySharePercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  source: "SPACE" | "PROJECT" | "DEFAULT";
};
export type DistributionFields = {
  allySharePercent?: unknown;
  investorSharePercent?: unknown;
  evgreenSharePercent?: unknown;
  spaceType?: string | null;
};
export type ProjectDistributionFields = {
  hostSharePercent?: unknown;
  investorSharePercent?: unknown;
  evgreenSharePercent?: unknown;
  financialProjectionSnapshot?: unknown;
};

const defined = (value: unknown) => value !== undefined && value !== null && value !== "";

/** Prioridad explícita: acuerdo del espacio > proyecto vinculado > sugerencia.
 * Los ceros son acuerdos válidos. Una configuración inválida nunca se oculta
 * sustituyéndola por valores predeterminados.
 */
export function resolveSpaceCommercialDistribution(
  space: DistributionFields,
  project?: ProjectDistributionFields | null,
  defaultAllySharePercent: unknown = 10,
): SpaceCommercialDistribution {
  const suggested = getRevenueDistributionForSpaceType(space.spaceType);
  const snapshot = typeof project?.financialProjectionSnapshot === "string"
    ? JSON.parse(project.financialProjectionSnapshot)
    : project?.financialProjectionSnapshot as { assumptions?: ProjectDistributionFields } | undefined;
  // Crowdfunding guarda estos acuerdos en assumptions del JSON, no en columnas
  // propias. Los campos directos solo mantienen compatibilidad de objetos legacy.
  const inherited = snapshot?.assumptions ?? project;
  const choose = (local: unknown, inherited: unknown, fallback: unknown) =>
    Number(defined(local) ? local : defined(inherited) ? inherited : fallback);
  const resolved = {
    allySharePercent: choose(space.allySharePercent, inherited?.hostSharePercent, defaultAllySharePercent ?? 10),
    investorSharePercent: choose(space.investorSharePercent, inherited?.investorSharePercent, suggested.investorSharePercent),
    evgreenSharePercent: choose(space.evgreenSharePercent, inherited?.evgreenSharePercent, suggested.evgreenSharePercent),
    source: [space.allySharePercent, space.investorSharePercent, space.evgreenSharePercent].some(defined)
      ? "SPACE" as const
      : [inherited?.hostSharePercent, inherited?.investorSharePercent, inherited?.evgreenSharePercent].some(defined)
        ? "PROJECT" as const : "DEFAULT" as const,
  };
  validateFinancialSplit({
    hostSharePercent: resolved.allySharePercent,
    investorSharePercent: resolved.investorSharePercent,
    evgreenSharePercent: resolved.evgreenSharePercent,
  });
  return resolved;
}

/** Enviar los tres valores juntos evita acuerdos parciales o parejas incoherentes. */
export function validateSpaceDistributionPatch(input: DistributionFields): boolean {
  const fields = [input.allySharePercent, input.investorSharePercent, input.evgreenSharePercent];
  const supplied = fields.map(defined);
  if (!supplied.some(Boolean)) return true;
  if (!supplied.every(Boolean)) return false;
  if (!fields.every(value => Number.isFinite(Number(value)) && Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.000001)) return false;
  try {
    resolveSpaceCommercialDistribution(input);
    return true;
  } catch {
    return false;
  }
}

export function spaceDistributionColumns(distribution: SpaceCommercialDistribution) {
  return {
    allySharePercent: distribution.allySharePercent.toFixed(2),
    investorSharePercent: distribution.investorSharePercent.toFixed(2),
    evgreenSharePercent: distribution.evgreenSharePercent.toFixed(2),
  };
}
