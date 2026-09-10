export const CROWDFUNDING_FINANCIAL_FIELDS = [
  "targetAmount",
  "minimumInvestment",
  "totalPowerKw",
  "chargerCount",
  "chargerPowerKw",
  "estimatedRoiPercent",
  "estimatedPaybackMonths",
] as const;

export function hasCrowdfundingFinancialChanges(
  current: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): boolean {
  if (!current) return false;
  return CROWDFUNDING_FINANCIAL_FIELDS.some((field) => {
    if (next[field] === undefined) return false;
    return Number(next[field]) !== Number(current[field]);
  });
}
