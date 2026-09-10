import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { crowdfundingProjects } from "../../drizzle/schema";
import { appRouter } from "../routers";
import { createCrowdfundingProject, getDb } from "../db";
import type { TrpcContext } from "../_core/context";

const FIXTURE_NAME = "QA Bulk Crowdfunding Cleanup";
let projectId = 0;

function context(role: "admin" | "staff"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `qa-bulk-${role}`,
      email: `${role}@evgreen.lat`,
      name: role,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

async function removeFixture() {
  const db = await getDb();
  if (!db) return;
  await db.delete(crowdfundingProjects).where(eq(crowdfundingProjects.name, FIXTURE_NAME));
}

describe("gestión masiva de proyectos de crowdfunding", () => {
  beforeAll(async () => {
    await removeFixture();
    projectId = await createCrowdfundingProject({
      name: FIXTURE_NAME,
      city: "Bogotá",
      zone: "QA",
      targetAmount: 1_000_000_000,
      minimumInvestment: 50_000_000,
      totalPowerKw: 120,
      chargerCount: 1,
      chargerPowerKw: 120,
      status: "DRAFT",
      createdById: 1,
    });
  });

  afterAll(removeFixture);

  it("bloquea las acciones financieras masivas al rol Staff", async () => {
    const caller = appRouter.createCaller(context("staff"));
    await expect(caller.crowdfunding.bulkManageProjects({
      projectIds: [projectId],
      action: { type: "PUBLISH" },
    })).rejects.toThrow("requiere rol Administrador");
  });

  it("permite a Admin publicar, cancelar y eliminar un proyecto seguro", async () => {
    const caller = appRouter.createCaller(context("admin"));
    const published = await caller.crowdfunding.bulkManageProjects({
      projectIds: [projectId],
      action: { type: "PUBLISH" },
    });
    expect(published.affected.map((item) => item.id)).toContain(projectId);

    const cancelled = await caller.crowdfunding.bulkManageProjects({
      projectIds: [projectId],
      action: { type: "SET_STATUS", status: "CANCELLED" },
    });
    expect(cancelled.affected.map((item) => item.id)).toContain(projectId);

    const deleted = await caller.crowdfunding.bulkManageProjects({
      projectIds: [projectId],
      action: { type: "DELETE" },
    });
    expect(deleted.affected.map((item) => item.id)).toContain(projectId);

    const db = await getDb();
    const [persisted] = await db!.select({ id: crowdfundingProjects.id })
      .from(crowdfundingProjects)
      .where(eq(crowdfundingProjects.id, projectId))
      .limit(1);
    expect(persisted).toBeUndefined();
  });
});
