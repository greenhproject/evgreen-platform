import { describe, expect, it } from "vitest";
import { evaluateCrowdfundingBulkAction, type CrowdfundingProjectSafetySnapshot } from "./project-bulk-policy";

function project(overrides: Partial<CrowdfundingProjectSafetySnapshot> = {}): CrowdfundingProjectSafetySnapshot {
  return {
    id: 1,
    status: "DRAFT",
    raisedAmount: 0,
    targetAmount: 1_000_000_000,
    minimumInvestment: 50_000_000,
    totalPowerKw: 120,
    chargerCount: 1,
    stationId: null,
    participationCount: 0,
    completedParticipationCount: 0,
    ...overrides,
  };
}

describe("política de gestión masiva de crowdfunding", () => {
  it("publica un borrador completo", () => {
    expect(evaluateCrowdfundingBulkAction(project(), { type: "PUBLISH" })).toEqual({
      allowed: true,
      nextStatus: "OPEN",
    });
  });

  it("bloquea publicar un borrador sin potencia", () => {
    expect(evaluateCrowdfundingBulkAction(project({ totalPowerKw: null }), { type: "PUBLISH" }).allowed).toBe(false);
  });

  it("solo elimina borradores o cancelados sin actividad financiera ni estación", () => {
    expect(evaluateCrowdfundingBulkAction(project(), { type: "DELETE" }).allowed).toBe(true);
    expect(evaluateCrowdfundingBulkAction(project({ status: "OPEN" }), { type: "DELETE" }).allowed).toBe(false);
    expect(evaluateCrowdfundingBulkAction(project({ participationCount: 1 }), { type: "DELETE" }).allowed).toBe(false);
    expect(evaluateCrowdfundingBulkAction(project({ raisedAmount: 1 }), { type: "DELETE" }).allowed).toBe(false);
    expect(evaluateCrowdfundingBulkAction(project({ stationId: 15 }), { type: "DELETE" }).allowed).toBe(false);
  });

  it("impide cancelar proyectos con participaciones o recaudo", () => {
    const action = { type: "SET_STATUS", status: "CANCELLED" } as const;
    expect(evaluateCrowdfundingBulkAction(project({ status: "OPEN", participationCount: 1 }), action).allowed).toBe(false);
    expect(evaluateCrowdfundingBulkAction(project({ status: "OPEN", raisedAmount: 500 }), action).allowed).toBe(false);
  });

  it("solo permite financiar o completar cuando se alcanzó la meta", () => {
    const funded = { type: "SET_STATUS", status: "FUNDED" } as const;
    expect(evaluateCrowdfundingBulkAction(project({ status: "IN_PROGRESS", raisedAmount: 900 }), funded).allowed).toBe(false);
    expect(evaluateCrowdfundingBulkAction(project({ status: "IN_PROGRESS", raisedAmount: 1_000_000_000 }), funded).allowed).toBe(true);
  });
});
