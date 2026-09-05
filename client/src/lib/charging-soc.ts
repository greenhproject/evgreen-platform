export type AuthoritativeSocSource = "charger" | "manual" | "power_detection" | "energy";

export function hasAuthoritativeSoc(
  soc: number | null | undefined,
  source: string | null | undefined,
): soc is number {
  return typeof soc === "number"
    && Number.isFinite(soc)
    && source !== null
    && source !== undefined
    && source !== "none";
}

export function shouldStopForSocTarget(input: {
  soc: number | null | undefined;
  source: string | null | undefined;
  chargeMode: string;
  targetPercentage: number;
}): boolean {
  if (!hasAuthoritativeSoc(input.soc, input.source)) return false;
  if (input.soc >= 100) return true;
  return input.chargeMode === "percentage" && input.soc >= input.targetPercentage;
}

