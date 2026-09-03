export const CONTRACT_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;
export type ContractTemplateStatus = (typeof CONTRACT_TEMPLATE_STATUSES)[number];

export const SITE_CONTRACT_STATUSES = [
  "DRAFT", "READY", "DOCUSIGN_SENT", "DOCUSIGN_COMPLETED", "DOCUSIGN_DECLINED", "DOCUSIGN_VOIDED", "DOCUSIGN_EXPIRED",
  "MANUAL_PDF_ISSUED", "MANUAL_PDF_RETURNED", "MANUAL_PDF_VERIFIED", "MANUAL_PDF_REJECTED", "CANCELLED",
] as const;
export type SiteContractStatus = (typeof SITE_CONTRACT_STATUSES)[number];

export const CONTRACT_PARTY_ROLES = ["OPERATOR", "ALLY"] as const;
export type ContractPartyRole = (typeof CONTRACT_PARTY_ROLES)[number];

export const DEFAULT_CONTRACT_VARIABLES = [
  "GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "GHP_DOCUMENTO_REPRESENTANTE", "GHP_DIRECCION", "GHP_CORREO_NOTIFICACIONES", "GHP_TELEFONO",
  "ALIADO_RAZON_SOCIAL", "ALIADO_NIT", "ALIADO_REPRESENTANTE", "ALIADO_DOCUMENTO_REPRESENTANTE", "ALIADO_DIRECCION_NOTIFICACIONES", "ALIADO_CORREO_NOTIFICACIONES", "ALIADO_TELEFONO",
  "SITIO_NOMBRE", "SITIO_DIRECCION", "SITIO_CIUDAD", "SITIO_DEPARTAMENTO", "SITIO_TIPO", "AREA_CEDIDA_M2", "PUESTOS_PARQUEO",
  "PARTICIPACION_ALIADO_PORCENTAJE", "PLAZO_INICIAL_ANOS", "PRORROGA_ANOS", "PLAZO_PAGO_DIAS_HABILES", "FECHA_CIERRE_LIQUIDACION",
] as const;

export type ContractVariables = Record<string, string>;

export function normalizeContractVariables(input: Record<string, unknown>): ContractVariables {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key.trim().toUpperCase(), String(value ?? "").trim()]));
}

export function unresolvedContractVariables(templateHtml: string, variables: ContractVariables): string[] {
  const placeholders = Array.from(templateHtml.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g)).map(match => match[1]);
  return [...new Set(placeholders.filter(name => !variables[name]))];
}

export function renderContractTemplate(templateHtml: string, variables: ContractVariables): string {
  return templateHtml.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_, key: string) => escapeHtml(variables[key] || ""));
}

export function canIssueManualPdf(status: SiteContractStatus): boolean {
  return status === "READY" || status === "MANUAL_PDF_ISSUED";
}

export function canSendToDocuSign(status: SiteContractStatus): boolean {
  return status === "READY";
}

export function isContractFinal(status: SiteContractStatus): boolean {
  return status === "DOCUSIGN_COMPLETED" || status === "MANUAL_PDF_VERIFIED";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}
