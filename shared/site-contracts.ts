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
  "NUMERO_CONTRATO", "GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "GHP_DOCUMENTO_REPRESENTANTE", "GHP_CARGO_REPRESENTANTE", "GHP_DOMICILIO", "GHP_DIRECCION", "GHP_CORREO_NOTIFICACIONES", "GHP_TELEFONO", "MARCA_COMERCIAL",
  "ALIADO_RAZON_SOCIAL", "ALIADO_NIT", "ALIADO_REPRESENTANTE", "ALIADO_DOCUMENTO_REPRESENTANTE", "ALIADO_CARGO_REPRESENTANTE", "ALIADO_DOMICILIO", "ALIADO_DIRECCION_NOTIFICACIONES", "ALIADO_CORREO_NOTIFICACIONES", "ALIADO_TELEFONO", "ALIADO_CALIDAD_TENENCIA", "AUTORIZACION_PROPIETARIO_URL",
  "SITIO_NOMBRE", "SITIO_DIRECCION", "SITIO_CIUDAD", "SITIO_DEPARTAMENTO", "SITIO_TIPO", "AREA_CEDIDA_M2", "PUESTOS_PARQUEO", "PLANO_ANEXO_URL",
  "PARTICIPACION_ALIADO_PORCENTAJE", "PLAZO_INICIAL_ANOS", "PRORROGA_ANOS", "PLAZO_PAGO_DIAS_HABILES", "FECHA_CIERRE_LIQUIDACION",
  "VERSION_PLANTILLA", "HASH_DOCUMENTO", "FECHA_ENVIO", "FECHA_EXPIRACION", "FIRMANTE_EDS", "FIRMANTE_GHP", "CIUDAD_FIRMA", "FECHA_FIRMA",
] as const;

export type ContractVariables = Record<string, string>;

const CONTRACT_MARKER_PATTERN = /{{\s*([A-Za-z0-9_]+)\s*}}/g;
const ANY_CONTRACT_MARKER_PATTERN = /{{\s*([^{}]*?)\s*}}/g;

export function extractContractTemplateMarkers(templateHtml: string): string[] {
  const markers = Array.from(templateHtml.matchAll(CONTRACT_MARKER_PATTERN), match => match[1].toUpperCase());
  return [...new Set(markers)];
}

export function analyzeContractTemplateMarkers(templateHtml: string): {
  markers: string[];
  unknownMarkers: string[];
  malformedMarkers: string[];
} {
  const markers = extractContractTemplateMarkers(templateHtml);
  const allowed = new Set<string>(DEFAULT_CONTRACT_VARIABLES);
  const malformedMarkers = Array.from(templateHtml.matchAll(ANY_CONTRACT_MARKER_PATTERN), match => match[1].trim())
    .filter(marker => !/^[A-Za-z0-9_]+$/.test(marker));
  return {
    markers,
    unknownMarkers: markers.filter(marker => !allowed.has(marker)),
    malformedMarkers: [...new Set(malformedMarkers)],
  };
}

export function normalizeContractVariables(input: Record<string, unknown>): ContractVariables {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key.trim().toUpperCase(), String(value ?? "").trim()]));
}

export function unresolvedContractVariables(templateHtml: string, variables: ContractVariables): string[] {
  return extractContractTemplateMarkers(templateHtml).filter(name => !variables[name]);
}

export function renderContractTemplate(templateHtml: string, variables: ContractVariables): string {
  return templateHtml.replace(CONTRACT_MARKER_PATTERN, (_, key: string) => escapeHtml(variables[key.toUpperCase()] || ""));
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
