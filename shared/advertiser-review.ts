export const ADVERTISER_DECISIONS = ["approve", "reject", "suspend"] as const;

export type AdvertiserDecision = (typeof ADVERTISER_DECISIONS)[number];
export type AdvertiserProfileStatus = "pending" | "approved" | "rejected" | "suspended";
export type AdvertiserDecisionTargetStatus = Exclude<AdvertiserProfileStatus, "pending">;

export function canManageAdvertiserReviews(role: string | null | undefined) {
  return role === "admin";
}

export function canCreateAdvertiserCampaign(status: AdvertiserProfileStatus) {
  return status === "approved";
}

const VALID_PREVIOUS_STATUSES: Record<AdvertiserDecision, readonly AdvertiserProfileStatus[]> = {
  approve: ["pending", "rejected", "suspended"],
  reject: ["pending"],
  suspend: ["approved"],
};

export function canApplyAdvertiserDecision(
  currentStatus: AdvertiserProfileStatus,
  decision: AdvertiserDecision,
) {
  return VALID_PREVIOUS_STATUSES[decision].includes(currentStatus);
}

export function decisionTargetStatus(decision: AdvertiserDecision): AdvertiserDecisionTargetStatus {
  switch (decision) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "suspend":
      return "suspended";
  }
}
