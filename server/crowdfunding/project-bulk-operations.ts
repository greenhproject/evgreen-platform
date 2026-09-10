import { inArray } from "drizzle-orm";
import {
  crowdfundingParticipations,
  crowdfundingProjects,
  spaceSubmissions,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  evaluateCrowdfundingBulkAction,
  type CrowdfundingBulkAction,
  type CrowdfundingProjectSafetySnapshot,
  type CrowdfundingProjectStatus,
} from "./project-bulk-policy";

type BulkProjectResultItem = { id: number; name: string; reason?: string };

export type CrowdfundingBulkResult = {
  affected: BulkProjectResultItem[];
  skipped: BulkProjectResultItem[];
};

export async function manageCrowdfundingProjectsBulk(input: {
  projectIds: number[];
  action: CrowdfundingBulkAction;
  actorId: number;
  reason?: string;
}): Promise<CrowdfundingBulkResult> {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");

  const projectIds = [...new Set(input.projectIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (projectIds.length === 0) return { affected: [], skipped: [] };

  const projects = await db.select({
    id: crowdfundingProjects.id,
    name: crowdfundingProjects.name,
    status: crowdfundingProjects.status,
    raisedAmount: crowdfundingProjects.raisedAmount,
    targetAmount: crowdfundingProjects.targetAmount,
    minimumInvestment: crowdfundingProjects.minimumInvestment,
    totalPowerKw: crowdfundingProjects.totalPowerKw,
    chargerCount: crowdfundingProjects.chargerCount,
    stationId: crowdfundingProjects.stationId,
  }).from(crowdfundingProjects).where(inArray(crowdfundingProjects.id, projectIds));

  const participationRows = await db.select({
    projectId: crowdfundingParticipations.projectId,
    paymentStatus: crowdfundingParticipations.paymentStatus,
  }).from(crowdfundingParticipations).where(inArray(crowdfundingParticipations.projectId, projectIds));

  const participationMetrics = new Map<number, { total: number; completed: number }>();
  for (const row of participationRows) {
    const current = participationMetrics.get(row.projectId) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (row.paymentStatus === "COMPLETED") current.completed += 1;
    participationMetrics.set(row.projectId, current);
  }

  const foundIds = new Set(projects.map((project) => project.id));
  const skipped: BulkProjectResultItem[] = projectIds
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, name: `Proyecto #${id}`, reason: "El proyecto ya no existe." }));
  const allowedProjects: typeof projects = [];

  for (const project of projects) {
    const metrics = participationMetrics.get(project.id) ?? { total: 0, completed: 0 };
    const snapshot: CrowdfundingProjectSafetySnapshot = {
      id: project.id,
      status: project.status as CrowdfundingProjectStatus,
      raisedAmount: Number(project.raisedAmount),
      targetAmount: Number(project.targetAmount),
      minimumInvestment: Number(project.minimumInvestment),
      totalPowerKw: project.totalPowerKw,
      chargerCount: project.chargerCount,
      stationId: project.stationId,
      participationCount: metrics.total,
      completedParticipationCount: metrics.completed,
    };
    const decision = evaluateCrowdfundingBulkAction(snapshot, input.action);
    if (decision.allowed) allowedProjects.push(project);
    else skipped.push({ id: project.id, name: project.name, reason: decision.reason });
  }

  const affected = allowedProjects.map((project) => ({ id: project.id, name: project.name }));
  const allowedIds = allowedProjects.map((project) => project.id);
  if (allowedIds.length === 0) return { affected, skipped };

  await db.transaction(async (tx) => {
    if (input.action.type === "DELETE") {
      await tx.update(spaceSubmissions)
        .set({ crowdfundingProjectId: null })
        .where(inArray(spaceSubmissions.crowdfundingProjectId, allowedIds));
      await tx.delete(crowdfundingProjects).where(inArray(crowdfundingProjects.id, allowedIds));
    } else if (input.action.type === "CANCEL") {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await tx.update(crowdfundingProjects)
        .set({
          status: "CANCELLED",
          cancellationReason: input.action.reason.trim(),
          cancelledAt: now,
          cancelledBy: input.actorId,
        })
        .where(inArray(crowdfundingProjects.id, allowedIds));
    } else {
      const nextStatus = input.action.type === "PUBLISH" ? "OPEN" : input.action.status;
      const updatePayload: Record<string, any> = { status: nextStatus };
      const rawReason = "reason" in input.action ? (input.action as any).reason : undefined;
      if (nextStatus === "CANCELLED" && rawReason) {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        updatePayload.cancellationReason = String(rawReason).trim();
        updatePayload.cancelledAt = now;
        updatePayload.cancelledBy = input.actorId;
      }
      await tx.update(crowdfundingProjects)
        .set(updatePayload)
        .where(inArray(crowdfundingProjects.id, allowedIds));
    }
  });

  console.info("[CrowdfundingBulk] Acción administrativa completada", {
    actorId: input.actorId,
    action: input.action,
    affectedIds: allowedIds,
    skippedIds: skipped.map((project) => project.id),
  });
  return { affected, skipped };
}
