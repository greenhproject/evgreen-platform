import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedDb = vi.hoisted(() => ({
  createCrowdfundingProject: vi.fn(),
  createChargingStation: vi.fn(),
  updateCrowdfundingProject: vi.fn(),
  createEvse: vi.fn(),
}));

vi.mock("./db", () => mockedDb);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (): TrpcContext => ({
  user: { id: 91, openId: "admin-projection", email: "admin@evgreen.lat", name: "Admin Finanzas", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
  res: { clearCookie: () => undefined } as any,
});

const baseProject = {
  name: "Proyecto escenario QA",
  city: "Bogotá",
  zone: "Norte",
  targetAmount: 90_000_000,
  totalPowerKw: 120,
  chargerCount: 1,
  chargerPowerKw: 120,
};

const financialProjection = {
  selectedScenario: "REALISTIC" as const,
  salePricePerKwh: 1800,
  energyCostPerKwh: 850,
  hostSharePercent: 10,
  investorSharePercent: 70,
  evgreenSharePercent: 30,
  efficiencyPercent: 92,
  fixedMonthlyExpenses: 0,
};

describe("crowdfunding.createProject - proyección financiera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.createCrowdfundingProject.mockResolvedValue(700);
    mockedDb.createChargingStation.mockResolvedValue(800);
    mockedDb.updateCrowdfundingProject.mockResolvedValue(undefined);
    mockedDb.createEvse.mockResolvedValue(900);
  });

  it("rechaza un proyecto nuevo sin escenario calculado", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.crowdfunding.createProject(baseProject)).rejects.toThrow("Aplica un escenario");
    expect(mockedDb.createCrowdfundingProject).not.toHaveBeenCalled();
  });

  it("calcula ROI/payback en servidor y guarda el snapshot del escenario", async () => {
    const caller = appRouter.createCaller(context());
    await caller.crowdfunding.createProject({ ...baseProject, financialProjection });

    expect(mockedDb.createCrowdfundingProject).toHaveBeenCalledWith(expect.objectContaining({
      targetAmount: 90_000_000,
      estimatedRoiPercent: expect.any(Number),
      estimatedPaybackMonths: expect.any(Number),
      financialProjectionScenario: "REALISTIC",
      financialProjectionSnapshot: expect.objectContaining({
        version: 1,
        basis: "EVGREEN_CROWDFUNDING_SCENARIOS",
        selectedScenario: "REALISTIC",
      }),
      financialProjectionUpdatedBy: 91,
    }));
    expect(mockedDb.createChargingStation).toHaveBeenCalledWith(expect.objectContaining({
      investorSharePercent: "70",
      evgreenSharePercent: "30",
      hostSharePercent: "10",
      energyPurchaseCostPerKwh: "850",
    }));
    expect(mockedDb.updateCrowdfundingProject).toHaveBeenCalledWith(700, { stationId: 800 });
  });
});
