export type ContractTemplateStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export function getTemplateDeletionEligibility(status: ContractTemplateStatus, contractCount: number) {
  if (status !== "DRAFT") {
    return {
      canDelete: false,
      deletionBlockReason: "Solo se pueden eliminar versiones en borrador.",
    } as const;
  }
  if (contractCount > 0) {
    return {
      canDelete: false,
      deletionBlockReason: `Esta versión está vinculada a ${contractCount} contrato${contractCount === 1 ? "" : "s"} y debe conservarse por trazabilidad.`,
    } as const;
  }
  return {
    canDelete: true,
    deletionBlockReason: null,
  } as const;
}
