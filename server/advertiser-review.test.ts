import { describe, expect, it } from "vitest";
import {
  canApplyAdvertiserDecision,
  canCreateAdvertiserCampaign,
  canManageAdvertiserReviews,
  decisionTargetStatus,
} from "../shared/advertiser-review";

describe("decisiones administrativas de perfiles de anunciante", () => {
  it("reserva la revisión y aprobación exclusivamente para el rol admin", () => {
    expect(canManageAdvertiserReviews("admin")).toBe(true);
    expect(canManageAdvertiserReviews("staff")).toBe(false);
    expect(canManageAdvertiserReviews("advertiser")).toBe(false);
    expect(canManageAdvertiserReviews(null)).toBe(false);
  });

  it("bloquea la creación de campañas mientras el perfil no esté aprobado", () => {
    expect(canCreateAdvertiserCampaign("approved")).toBe(true);
    expect(canCreateAdvertiserCampaign("pending")).toBe(false);
    expect(canCreateAdvertiserCampaign("rejected")).toBe(false);
    expect(canCreateAdvertiserCampaign("suspended")).toBe(false);
  });

  it("solo permite aprobar perfiles pendientes, rechazados o suspendidos", () => {
    expect(canApplyAdvertiserDecision("pending", "approve")).toBe(true);
    expect(canApplyAdvertiserDecision("rejected", "approve")).toBe(true);
    expect(canApplyAdvertiserDecision("suspended", "approve")).toBe(true);
    expect(canApplyAdvertiserDecision("approved", "approve")).toBe(false);
  });

  it("permite rechazar exclusivamente un perfil pendiente y suspender uno aprobado", () => {
    expect(canApplyAdvertiserDecision("pending", "reject")).toBe(true);
    expect(canApplyAdvertiserDecision("approved", "reject")).toBe(false);
    expect(canApplyAdvertiserDecision("approved", "suspend")).toBe(true);
    expect(canApplyAdvertiserDecision("pending", "suspend")).toBe(false);
  });

  it("resuelve el estado objetivo de cada decisión administrativa", () => {
    expect(decisionTargetStatus("approve")).toBe("approved");
    expect(decisionTargetStatus("reject")).toBe("rejected");
    expect(decisionTargetStatus("suspend")).toBe("suspended");
  });
});
