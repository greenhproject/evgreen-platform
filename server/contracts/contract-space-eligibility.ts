export type ContractFormalizationSource = "DIGITAL_LETTER" | "MANUAL_FORMALIZATION";

type FormalizedSpace = {
  letterAcceptedAt?: string | Date | null;
  manualFormalizedAt?: string | Date | null;
};

type ExistingContract = {
  id: number;
  contractNumber: string;
  status: string;
} | null;

export function getContractSpaceEligibility(space: FormalizedSpace, existingContract: ExistingContract = null) {
  const formalizationSource: ContractFormalizationSource | null = space.letterAcceptedAt
    ? "DIGITAL_LETTER"
    : space.manualFormalizedAt
      ? "MANUAL_FORMALIZATION"
      : null;
  const formalizedAt = space.letterAcceptedAt || space.manualFormalizedAt || null;

  if (!formalizationSource) {
    return {
      isFormalized: false,
      formalizationSource: null,
      formalizedAt: null,
      canCreateContract: false,
      eligibilityReason: "El espacio todavía no tiene una carta firmada ni una formalización manual registrada.",
      existingContractId: null,
      existingContractNumber: null,
      existingContractStatus: null,
    } as const;
  }

  if (existingContract) {
    return {
      isFormalized: true,
      formalizationSource,
      formalizedAt,
      canCreateContract: false,
      eligibilityReason: `Ya existe el expediente ${existingContract.contractNumber} (${existingContract.status}).`,
      existingContractId: existingContract.id,
      existingContractNumber: existingContract.contractNumber,
      existingContractStatus: existingContract.status,
    } as const;
  }

  return {
    isFormalized: true,
    formalizationSource,
    formalizedAt,
    canCreateContract: true,
    eligibilityReason: formalizationSource === "DIGITAL_LETTER"
      ? "Carta de intención firmada digitalmente."
      : "Negocio formalizado manualmente por Administración con evidencia registrada.",
    existingContractId: null,
    existingContractNumber: null,
    existingContractStatus: null,
  } as const;
}
