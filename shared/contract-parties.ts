export type ContractPartyField =
  | "legalName"
  | "taxId"
  | "representativeName"
  | "representativeDocument"
  | "representativeTitle"
  | "email"
  | "phone"
  | "notificationAddress"
  | "domicile";

export type ContractPartyData = Record<ContractPartyField, string>;

export const EMPTY_CONTRACT_PARTY: ContractPartyData = {
  legalName: "",
  taxId: "",
  representativeName: "",
  representativeDocument: "",
  representativeTitle: "Representante legal",
  email: "",
  phone: "",
  notificationAddress: "",
  domicile: "",
};

export const CONTRACT_PARTY_FIELD_LABELS: Record<ContractPartyField, string> = {
  legalName: "Razón social del aliado",
  taxId: "NIT del aliado",
  representativeName: "Representante autorizado",
  representativeDocument: "Documento del representante",
  representativeTitle: "Cargo del representante",
  email: "Correo para firma",
  phone: "Teléfono",
  notificationAddress: "Dirección de notificaciones",
  domicile: "Domicilio",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContractParty(input: Partial<ContractPartyData>): ContractPartyData {
  return Object.fromEntries(
    (Object.keys(EMPTY_CONTRACT_PARTY) as ContractPartyField[]).map(key => [key, String(input[key] ?? "").trim()]),
  ) as ContractPartyData;
}

export function validateContractParty(input: Partial<ContractPartyData>) {
  const data = normalizeContractParty(input);
  const fieldErrors: Partial<Record<ContractPartyField, string>> = {};
  const minimums: Partial<Record<ContractPartyField, number>> = {
    legalName: 3,
    taxId: 3,
    representativeName: 3,
    representativeDocument: 3,
    notificationAddress: 5,
  };
  for (const [field, minimum] of Object.entries(minimums) as Array<[ContractPartyField, number]>) {
    if (data[field].length < minimum) fieldErrors[field] = `${CONTRACT_PARTY_FIELD_LABELS[field]} debe tener al menos ${minimum} caracteres.`;
  }
  if (!EMAIL_PATTERN.test(data.email)) fieldErrors.email = "Ingrese un correo válido para la firma.";
  if (data.representativeTitle.length > 120) fieldErrors.representativeTitle = "El cargo no puede superar 120 caracteres.";
  if (data.phone.length > 50) fieldErrors.phone = "El teléfono no puede superar 50 caracteres.";
  if (data.domicile.length > 160) fieldErrors.domicile = "El domicilio no puede superar 160 caracteres.";
  const invalidFields = Object.keys(fieldErrors) as ContractPartyField[];
  return { valid: invalidFields.length === 0, data, fieldErrors, invalidFields };
}

export function contractPartyValidationMessage(input: Partial<ContractPartyData>): string | null {
  const result = validateContractParty(input);
  if (result.valid) return null;
  const labels = result.invalidFields.map(field => CONTRACT_PARTY_FIELD_LABELS[field]);
  return `Complete los datos obligatorios del aliado: ${labels.join(", ")}.`;
}
