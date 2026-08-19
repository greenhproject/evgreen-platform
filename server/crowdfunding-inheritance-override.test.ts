import { describe, expect, it, beforeEach, vi } from "vitest";

const mockedDb = vi.hoisted(() => ({
  getCrowdfundingProjectById: vi.fn(),
  recordCrowdfundingFinancialOverride: vi.fn(),
  updateCrowdfundingProject: vi.fn(),
}));

vi.mock("./db", () => mockedDb);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminContext(): TrpcContext {
  return {
    user: { id: 91, openId: "admin-finanzas", email: "admin@evgreen.lat", name: "Admin Finanzas", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: () => undefined } as any,
  };
}

const inheritedProject = {
  id: 501,
  spaceSubmissionId: 71,
  targetAmount: 900000000,
  minimumInvestment: 10000000,
  totalPowerKw: 240,
  chargerCount: 2,
  chargerPowerKw: 120,
  estimatedRoiPercent: "76.25",
  estimatedPaybackMonths: 22,
  spaceInheritanceSnapshot: { targetAmount: 900000000, photos: [{ url: "https://example.com/site.jpg" }] },
};

describe("crowdfunding.updateProject - excepciones heredadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.getCrowdfundingProjectById.mockResolvedValue(inheritedProject);
    mockedDb.updateCrowdfundingProject.mockResolvedValue(undefined);
    mockedDb.recordCrowdfundingFinancialOverride.mockResolvedValue(undefined);
  });

  it("rechaza cambios financieros heredados sin motivo y no altera el snapshot", async () => {
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.crowdfunding.updateProject({ id: 501, targetAmount: 950000000 })).rejects.toThrow("Indica el motivo");
    expect(mockedDb.recordCrowdfundingFinancialOverride).not.toHaveBeenCalled();
    expect(mockedDb.updateCrowdfundingProject).not.toHaveBeenCalled();
    expect(inheritedProject.spaceInheritanceSnapshot.photos).toHaveLength(1);
  });

  it("registra excepción y solo actualiza datos cuando el motivo es válido", async () => {
    const caller = appRouter.createCaller(adminContext());
    await caller.crowdfunding.updateProject({
      id: 501,
      targetAmount: 950000000,
      financialOverrideReason: "Cotización actualizada tras validar la potencia disponible en sitio.",
    });
    expect(mockedDb.recordCrowdfundingFinancialOverride).toHaveBeenCalledWith(501, expect.objectContaining({
      reason: "Cotización actualizada tras validar la potencia disponible en sitio.",
      byUserId: 91,
    }));
    expect(mockedDb.updateCrowdfundingProject).toHaveBeenCalledWith(501, { targetAmount: 950000000 });
    expect(inheritedProject.spaceInheritanceSnapshot.photos).toHaveLength(1);
  });

  it("permite cambios no financieros sin abrir una excepción", async () => {
    const caller = appRouter.createCaller(adminContext());
    await caller.crowdfunding.updateProject({ id: 501, city: "Medellín" });
    expect(mockedDb.recordCrowdfundingFinancialOverride).not.toHaveBeenCalled();
    expect(mockedDb.updateCrowdfundingProject).toHaveBeenCalledWith(501, { city: "Medellín" });
  });
});
