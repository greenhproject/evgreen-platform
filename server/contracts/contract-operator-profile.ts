export type ContractOperatorProfile = {
  legalName: string;
  taxId: string;
  representativeName: string;
  representativeDocument: string;
  representativeTitle: string;
  email: string;
  phone: string;
  notificationAddress: string;
  domicile: string;
};

export const CONTRACT_OPERATOR_DEFAULTS: ContractOperatorProfile = {
  legalName: "Green House Project SAS",
  taxId: "901.447.678-0",
  representativeName: "",
  representativeDocument: "",
  representativeTitle: "Representante legal",
  email: "",
  phone: "",
  notificationAddress: "",
  domicile: "Colombia",
};

const REQUIRED_FIELDS: Array<{ key: keyof ContractOperatorProfile; label: string }> = [
  { key: "legalName", label: "Razón social" },
  { key: "taxId", label: "NIT" },
  { key: "representativeName", label: "Representante legal" },
  { key: "representativeDocument", label: "Documento del representante" },
  { key: "representativeTitle", label: "Cargo del representante" },
  { key: "email", label: "Correo para firma y notificaciones" },
  { key: "phone", label: "Teléfono" },
  { key: "notificationAddress", label: "Dirección de notificaciones" },
  { key: "domicile", label: "Domicilio" },
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function contractOperatorProfileFromSettings(settings: any): ContractOperatorProfile {
  return {
    legalName: text(settings?.contractOperatorLegalName) || text(settings?.companyName) || CONTRACT_OPERATOR_DEFAULTS.legalName,
    taxId: text(settings?.contractOperatorTaxId) || text(settings?.nit) || CONTRACT_OPERATOR_DEFAULTS.taxId,
    representativeName: text(settings?.contractOperatorRepresentativeName),
    representativeDocument: text(settings?.contractOperatorRepresentativeDocument),
    representativeTitle: text(settings?.contractOperatorRepresentativeTitle) || CONTRACT_OPERATOR_DEFAULTS.representativeTitle,
    email: text(settings?.contractOperatorEmail) || text(settings?.contactEmail),
    phone: text(settings?.contractOperatorPhone) || text(settings?.supportPhone),
    notificationAddress: text(settings?.contractOperatorNotificationAddress),
    domicile: text(settings?.contractOperatorDomicile) || CONTRACT_OPERATOR_DEFAULTS.domicile,
  };
}

export function getContractOperatorProfileStatus(settings: any) {
  const profile = contractOperatorProfileFromSettings(settings);
  const missingFields = REQUIRED_FIELDS.filter(field => profile[field.key].length < 2).map(field => field.label);
  const verifiedAt = text(settings?.contractOperatorVerifiedAt) || null;
  const verifiedBy = Number(settings?.contractOperatorVerifiedBy || 0) || null;
  return {
    profile,
    missingFields,
    isComplete: missingFields.length === 0,
    isVerified: missingFields.length === 0 && Boolean(verifiedAt && verifiedBy),
    verifiedAt,
    verifiedBy,
  };
}

export function mergeTemplateVariableSchema(existing: unknown, variables: string[]) {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  return { ...base, variables, required: variables };
}
