export const CROWDFUNDING_PROJECT_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "FUNDED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CrowdfundingProjectStatus = typeof CROWDFUNDING_PROJECT_STATUSES[number];

export type CrowdfundingBulkAction =
  | { type: "PUBLISH" }
  | { type: "SET_STATUS"; status: CrowdfundingProjectStatus }
  | { type: "DELETE" };

export type CrowdfundingProjectSafetySnapshot = {
  id: number;
  status: CrowdfundingProjectStatus;
  raisedAmount: number;
  targetAmount: number;
  minimumInvestment: number;
  totalPowerKw: number | null;
  chargerCount: number | null;
  stationId: number | null;
  participationCount: number;
  completedParticipationCount: number;
};

export type BulkProjectDecision = {
  allowed: boolean;
  nextStatus?: CrowdfundingProjectStatus;
  reason?: string;
};

const STATUS_TRANSITIONS: Record<CrowdfundingProjectStatus, CrowdfundingProjectStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "FUNDED", "CANCELLED"],
  FUNDED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: ["DRAFT"],
};

function validatePublication(project: CrowdfundingProjectSafetySnapshot): string | null {
  if (project.targetAmount <= 0) return "La meta de inversión debe ser mayor que cero.";
  if (project.minimumInvestment <= 0) return "La inversión mínima debe ser mayor que cero.";
  if (!project.totalPowerKw || project.totalPowerKw <= 0) return "Falta definir la potencia total.";
  if (!project.chargerCount || project.chargerCount <= 0) return "Falta definir el número de cargadores.";
  return null;
}

export function evaluateCrowdfundingBulkAction(
  project: CrowdfundingProjectSafetySnapshot,
  action: CrowdfundingBulkAction,
): BulkProjectDecision {
  if (action.type === "DELETE") {
    if (project.status !== "DRAFT" && project.status !== "CANCELLED") {
      return { allowed: false, reason: "Solo pueden eliminarse proyectos borrador o cancelados." };
    }
    if (project.participationCount > 0) {
      return { allowed: false, reason: "El proyecto tiene participaciones registradas." };
    }
    if (project.raisedAmount !== 0) {
      return { allowed: false, reason: "El proyecto tiene dinero recaudado." };
    }
    if (project.stationId !== null) {
      return { allowed: false, reason: "El proyecto está vinculado a una estación física." };
    }
    return { allowed: true };
  }

  const nextStatus = action.type === "PUBLISH" ? "OPEN" : action.status;
  if (project.status === nextStatus) {
    return { allowed: false, reason: `El proyecto ya se encuentra en estado ${nextStatus}.` };
  }
  if (!STATUS_TRANSITIONS[project.status].includes(nextStatus)) {
    return {
      allowed: false,
      reason: `No se permite cambiar de ${project.status} a ${nextStatus} de forma masiva.`,
    };
  }
  if (nextStatus === "OPEN") {
    const publicationError = validatePublication(project);
    if (publicationError) return { allowed: false, reason: publicationError };
  }
  if (nextStatus === "DRAFT" && (project.participationCount > 0 || project.raisedAmount !== 0)) {
    return { allowed: false, reason: "No puede volver a borrador porque tiene actividad financiera." };
  }
  if (nextStatus === "CANCELLED" && (project.participationCount > 0 || project.raisedAmount !== 0)) {
    return { allowed: false, reason: "No puede cancelarse masivamente porque tiene participaciones o recaudo." };
  }
  if ((nextStatus === "FUNDED" || nextStatus === "COMPLETED") && (
    project.targetAmount <= 0 || project.raisedAmount < project.targetAmount
  )) {
    return { allowed: false, reason: "El recaudo aún no alcanza la meta del proyecto." };
  }
  return { allowed: true, nextStatus };
}
