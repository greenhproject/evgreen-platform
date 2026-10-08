import { eq, inArray, isNotNull } from "drizzle-orm";
import {
  chargingStations,
  crowdfundingParticipations,
  crowdfundingProjects,
  crowdfundingStationLinkRepairs,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type OrphanedStationLinkItem = {
  id: number;
  name: string;
  status: string;
  stationId: number;
  raisedAmount: number;
  participationCount: number;
  canRepair: boolean;
  blockReason?: string;
};

type RepairResultItem = OrphanedStationLinkItem & { reason?: string };

export type OrphanedStationLinkRepairResult = {
  affected: RepairResultItem[];
  skipped: RepairResultItem[];
};

async function loadOrphanedLinks(projectIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");

  const normalizedIds = projectIds?.length
    ? [...new Set(projectIds.filter((id) => Number.isInteger(id) && id > 0))]
    : undefined;

  const projectRows = await db
    .select({
      id: crowdfundingProjects.id,
      name: crowdfundingProjects.name,
      status: crowdfundingProjects.status,
      stationId: crowdfundingProjects.stationId,
      raisedAmount: crowdfundingProjects.raisedAmount,
      stationExists: chargingStations.id,
    })
    .from(crowdfundingProjects)
    .leftJoin(chargingStations, eq(chargingStations.id, crowdfundingProjects.stationId))
    .where(
      normalizedIds
        ? inArray(crowdfundingProjects.id, normalizedIds)
        : isNotNull(crowdfundingProjects.stationId),
    );

  const orphanedProjects = projectRows.filter(
    (project) => project.stationId !== null && project.stationExists === null,
  );
  if (orphanedProjects.length === 0) return { db, items: [] as OrphanedStationLinkItem[] };

  const participationRows = await db
    .select({ projectId: crowdfundingParticipations.projectId })
    .from(crowdfundingParticipations)
    .where(inArray(crowdfundingParticipations.projectId, orphanedProjects.map((project) => project.id)));
  const participationCounts = new Map<number, number>();
  for (const row of participationRows) {
    participationCounts.set(row.projectId, (participationCounts.get(row.projectId) ?? 0) + 1);
  }

  const items: OrphanedStationLinkItem[] = orphanedProjects.map((project) => {
    const participationCount = participationCounts.get(project.id) ?? 0;
    const raisedAmount = Number(project.raisedAmount);
    const hasFinancialActivity = raisedAmount !== 0 || participationCount > 0;
    const hasTerminalStatus = project.status === "FUNDED" || project.status === "COMPLETED";
    const blockReason = hasFinancialActivity
      ? "Tiene recaudo o participaciones; requiere revisión financiera antes de desvincular."
      : hasTerminalStatus
        ? `El estado ${project.status} es terminal; requiere revisión administrativa antes de desvincular.`
        : undefined;

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      stationId: project.stationId as number,
      raisedAmount,
      participationCount,
      canRepair: !blockReason,
      ...(blockReason ? { blockReason } : {}),
    };
  });

  return { db, items };
}

export async function listOrphanedCrowdfundingStationLinks(): Promise<OrphanedStationLinkItem[]> {
  const { items } = await loadOrphanedLinks();
  return items;
}

export async function repairOrphanedCrowdfundingStationLinks(input: {
  projectIds?: number[];
  reason: string;
  actorId: number;
}): Promise<OrphanedStationLinkRepairResult> {
  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new Error("La justificación de reparación debe tener al menos 10 caracteres.");
  }

  const { db, items } = await loadOrphanedLinks(input.projectIds);
  const selectedIds = input.projectIds?.length
    ? new Set(input.projectIds.filter((id) => Number.isInteger(id) && id > 0))
    : null;
  const skipped: RepairResultItem[] = items
    .filter((item) => !item.canRepair || (selectedIds && !selectedIds.has(item.id)))
    .map((item) => ({
      ...item,
      reason: item.blockReason || "El proyecto no fue seleccionado para reparar.",
    }));
  const affected = items.filter((item) => item.canRepair && (!selectedIds || selectedIds.has(item.id)));

  if (affected.length === 0) return { affected: [], skipped };

  await db.transaction(async (tx) => {
    for (const item of affected) {
      await tx
        .update(crowdfundingProjects)
        .set({ stationId: null })
        .where(eq(crowdfundingProjects.id, item.id));
      await tx.insert(crowdfundingStationLinkRepairs).values({
        projectId: item.id,
        orphanedStationId: item.stationId,
        action: "ORPHAN_LINK_REPAIRED",
        reason,
        actorId: input.actorId,
      });
    }
  });

  console.info("[CrowdfundingStationLinks] Vínculos huérfanos reparados", {
    actorId: input.actorId,
    affectedIds: affected.map((item) => item.id),
    skippedIds: skipped.map((item) => item.id),
  });

  return { affected, skipped };
}
