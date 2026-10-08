import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  chargingStations,
  crowdfundingProjects,
  crowdfundingStationLinkRepairs,
} from "../../drizzle/schema";
import { appRouter } from "../routers";
import { createChargingStation, createCrowdfundingProject, getDb } from "../db";
import type { TrpcContext } from "../_core/context";

const FIXTURE_PREFIX = "QA Orphan Link Test";

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "qa-admin-orphan-links",
      email: "admin@evgreen.lat",
      name: "Admin QA",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("reparación y prevención de vínculos huérfanos entre proyectos y estaciones", () => {
  let safeProjectId = 0;
  let syncStationId = 0;
  let syncProjectId = 0;

  beforeAll(async () => {
    safeProjectId = await createCrowdfundingProject({
      name: `${FIXTURE_PREFIX} Safe`,
      city: "Bogotá",
      zone: "Norte",
      targetAmount: 300_000_000,
      minimumInvestment: 30_000_000,
      totalPowerKw: 120,
      chargerCount: 1,
      chargerPowerKw: 120,
      status: "DRAFT",
      createdById: 1,
    });

    const db = await getDb();
    await db!.update(crowdfundingProjects)
      .set({ stationId: 99112233 })
      .where(eq(crowdfundingProjects.id, safeProjectId));

    syncStationId = await createChargingStation({
      ownerId: 1,
      name: `${FIXTURE_PREFIX} Station`,
      address: "Calle 100 # 15-20",
      city: "Bogotá",
      department: "Cundinamarca",
      latitude: "4.6800",
      longitude: "-74.0500",
    });

    syncProjectId = await createCrowdfundingProject({
      name: `${FIXTURE_PREFIX} Auto Unlink`,
      city: "Bogotá",
      zone: "Norte",
      targetAmount: 400_000_000,
      minimumInvestment: 40_000_000,
      totalPowerKw: 120,
      chargerCount: 1,
      chargerPowerKw: 120,
      status: "DRAFT",
      createdById: 1,
    });

    await db!.update(crowdfundingProjects)
      .set({ stationId: syncStationId })
      .where(eq(crowdfundingProjects.id, syncProjectId));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (safeProjectId) {
      await db.delete(crowdfundingProjects).where(eq(crowdfundingProjects.id, safeProjectId));
      await db.delete(crowdfundingStationLinkRepairs).where(eq(crowdfundingStationLinkRepairs.projectId, safeProjectId));
    }
    if (syncProjectId) {
      await db.delete(crowdfundingProjects).where(eq(crowdfundingProjects.id, syncProjectId));
      await db.delete(crowdfundingStationLinkRepairs).where(eq(crowdfundingStationLinkRepairs.projectId, syncProjectId));
    }
    if (syncStationId) {
      await db.delete(chargingStations).where(eq(chargingStations.id, syncStationId));
    }
  });

  it("detecta el vínculo huérfano y permite desvincularlo con justificación", async () => {
    const caller = appRouter.createCaller(adminContext());
    const orphaned = await caller.crowdfunding.listOrphanedStationLinks();
    const target = orphaned.find((item) => item.id === safeProjectId);

    expect(target).toBeDefined();
    expect(target?.canRepair).toBe(true);
    expect(target?.stationId).toBe(99112233);

    const repairResult = await caller.crowdfunding.repairOrphanedStationLinks({
      projectIds: [safeProjectId],
      reason: "Estación física retirada durante la normalización de inventario.",
    });

    expect(repairResult.affected.map((item) => item.id)).toContain(safeProjectId);

    const db = await getDb();
    const [projectRow] = await db!.select({ stationId: crowdfundingProjects.stationId })
      .from(crowdfundingProjects)
      .where(eq(crowdfundingProjects.id, safeProjectId))
      .limit(1);
    expect(projectRow?.stationId).toBeNull();

    const [auditRow] = await db!.select({
      action: crowdfundingStationLinkRepairs.action,
      orphanedStationId: crowdfundingStationLinkRepairs.orphanedStationId,
    })
      .from(crowdfundingStationLinkRepairs)
      .where(eq(crowdfundingStationLinkRepairs.projectId, safeProjectId))
      .limit(1);
    expect(auditRow?.action).toBe("ORPHAN_LINK_REPAIRED");
    expect(auditRow?.orphanedStationId).toBe(99112233);
  });

  it("desvincula automáticamente el proyecto sin actividad financiera cuando se elimina la estación física", async () => {
    const caller = appRouter.createCaller(adminContext());
    await caller.stations.delete({ id: syncStationId });

    const db = await getDb();
    const [projectRow] = await db!.select({ stationId: crowdfundingProjects.stationId })
      .from(crowdfundingProjects)
      .where(eq(crowdfundingProjects.id, syncProjectId))
      .limit(1);
    expect(projectRow?.stationId).toBeNull();

    const [stationRow] = await db!.select({ id: chargingStations.id })
      .from(chargingStations)
      .where(eq(chargingStations.id, syncStationId))
      .limit(1);
    expect(stationRow).toBeUndefined();

    const [auditRow] = await db!.select({ action: crowdfundingStationLinkRepairs.action })
      .from(crowdfundingStationLinkRepairs)
      .where(eq(crowdfundingStationLinkRepairs.projectId, syncProjectId))
      .limit(1);
    expect(auditRow?.action).toBe("PHYSICAL_STATION_DELETED_AUTO_UNLINKED");
  });
});
