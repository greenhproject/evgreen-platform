/**
 * Reglas puras del tramo comercial del pipeline de espacios EVGreen.
 * Las etapas sensibles de formalización se procesan por sus flujos propios:
 * envío de carta, firma externa y publicación con meta de inversión.
 */
export const SPACE_PIPELINE_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "letter_sent",
  "letter_accepted",
  "published",
  "funded",
  "in_construction",
  "operational",
] as const;

export type SpacePipelineStatus = (typeof SPACE_PIPELINE_STATUSES)[number];

const COMMERCIAL_NEXT_STATUS: Partial<Record<SpacePipelineStatus, SpacePipelineStatus>> = {
  published: "funded",
  funded: "in_construction",
  in_construction: "operational",
};

/** Devuelve el siguiente hito que el equipo comercial puede confirmar directamente. */
export function getCommercialNextStatus(currentStatus: SpacePipelineStatus): SpacePipelineStatus | null {
  return COMMERCIAL_NEXT_STATUS[currentStatus] ?? null;
}

/** Evita saltos y retrocesos que dejarían la oferta en un estado inconsistente. */
export function assertCommercialTransition(
  currentStatus: SpacePipelineStatus,
  targetStatus: SpacePipelineStatus,
): void {
  const expectedStatus = getCommercialNextStatus(currentStatus);
  if (!expectedStatus || targetStatus !== expectedStatus) {
    throw new Error("La etapa comercial solo puede avanzar al siguiente hito del pipeline.");
  }
}
