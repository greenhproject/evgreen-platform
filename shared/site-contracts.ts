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

export type ContractVariableName = (typeof DEFAULT_CONTRACT_VARIABLES)[number];

const CONTRACT_VARIABLE_LABEL_OVERRIDES: Partial<Record<ContractVariableName, string>> = {
  GHP_RAZON_SOCIAL: "Razón social de Green House Project",
  GHP_NIT: "NIT de Green House Project",
  GHP_REPRESENTANTE: "Representante legal de Green House Project",
  GHP_DOCUMENTO_REPRESENTANTE: "Documento del representante de Green House Project",
  GHP_CARGO_REPRESENTANTE: "Cargo del representante de Green House Project",
  GHP_CORREO_NOTIFICACIONES: "Correo de notificaciones de Green House Project",
  GHP_DIRECCION: "Dirección de Green House Project",
  GHP_TELEFONO: "Teléfono de Green House Project",
  ALIADO_RAZON_SOCIAL: "Razón social del aliado",
  ALIADO_NIT: "NIT del aliado",
  ALIADO_REPRESENTANTE: "Representante legal del aliado",
  ALIADO_DOCUMENTO_REPRESENTANTE: "Documento del representante del aliado",
  ALIADO_CARGO_REPRESENTANTE: "Cargo del representante del aliado",
  ALIADO_CORREO_NOTIFICACIONES: "Correo de notificaciones del aliado",
  ALIADO_DIRECCION_NOTIFICACIONES: "Dirección de notificaciones del aliado",
  ALIADO_TELEFONO: "Teléfono del aliado",
  SITIO_NOMBRE: "Nombre del sitio",
  SITIO_DIRECCION: "Dirección del sitio",
  AREA_CEDIDA_M2: "Área cedida en m²",
  PUESTOS_PARQUEO: "Puestos de parqueo cedidos",
  PARTICIPACION_ALIADO_PORCENTAJE: "Participación del aliado (%)",
  PLAZO_INICIAL_ANOS: "Plazo inicial (años)",
  PRORROGA_ANOS: "Prórroga (años)",
  PLAZO_PAGO_DIAS_HABILES: "Plazo de pago (días hábiles)",
  FECHA_CIERRE_LIQUIDACION: "Fecha de cierre de liquidación",
  VERSION_PLANTILLA: "Versión de la plantilla",
  HASH_DOCUMENTO: "Hash de integridad del documento",
  FIRMANTE_EDS: "Firmante del aliado / EDS",
  FIRMANTE_GHP: "Firmante de Green House Project",
  CIUDAD_FIRMA: "Ciudad de firma",
  FECHA_FIRMA: "Fecha de firma",
};

const CONTRACT_VARIABLE_SAMPLE_OVERRIDES: Partial<Record<ContractVariableName, string>> = {
  NUMERO_CONTRATO: "EVG-CON-2026-EJEMPLO",
  GHP_RAZON_SOCIAL: "GREEN HOUSE PROJECT S.A.S.",
  GHP_NIT: "901.447.678-0",
  GHP_REPRESENTANTE: "Representante legal de GHP",
  ALIADO_RAZON_SOCIAL: "ESTACIÓN DE SERVICIO ALIADA S.A.S.",
  ALIADO_NIT: "900.123.456-7",
  ALIADO_REPRESENTANTE: "Representante legal del aliado",
  ALIADO_DOCUMENTO_REPRESENTANTE: "1.000.000.000",
  ALIADO_DOMICILIO: "Bogotá D.C. — Colombia",
  ALIADO_CORREO_NOTIFICACIONES: "legal@aliado-ejemplo.com",
  ALIADO_TELEFONO: "+57 300 000 0000",
  ALIADO_DIRECCION_NOTIFICACIONES: "Dirección de notificaciones del aliado",
  SITIO_NOMBRE: "EDS Aliada de Ejemplo",
  SITIO_DIRECCION: "Dirección del sitio de ejemplo",
  PARTICIPACION_ALIADO_PORCENTAJE: "10",
  PLAZO_INICIAL_ANOS: "10",
  PRORROGA_ANOS: "5",
  PLAZO_PAGO_DIAS_HABILES: "15",
  FECHA_CIERRE_LIQUIDACION: "Último día calendario de cada mes",
  VERSION_PLANTILLA: "3.0",
  MARCA_COMERCIAL: "EVGreen",
};

const CONTRACT_VARIABLE_ALIASES: Partial<Record<ContractVariableName, string[]>> = {
  ALIADO_RAZON_SOCIAL: ["ALIADO", "RAZON_SOCIAL_ALIADO", "NOMBRE_ALIADO"],
  ALIADO_NIT: ["NIT_ALIADO", "NIT-ALIADO"],
  ALIADO_REPRESENTANTE: ["REP_LEGAL_ALIADO", "REPRESENTANTE_LEGAL_ALIADO"],
  ALIADO_DOCUMENTO_REPRESENTANTE: ["CEDULA_REP_LEGAL_ALIADO", "DOCUMENTO_REP_LEGAL_ALIADO", "CEDULA_ALIADO"],
  ALIADO_DOMICILIO: ["DOMICILIO_ALIADO"],
  ALIADO_CORREO_NOTIFICACIONES: ["CORREO_ALIADO", "EMAIL_ALIADO"],
  ALIADO_TELEFONO: ["TEL_ALIADO", "TELEFONO_ALIADO"],
  ALIADO_DIRECCION_NOTIFICACIONES: ["DIR_ALIADO", "DIRECCION_ALIADO"],
};

function humanizeContractVariable(name: string): string {
  return name.toLowerCase().replaceAll("_", " ").replace(/^./, character => character.toUpperCase());
}

export function normalizeContractMarkerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

const CONTRACT_ALIAS_TO_VARIABLE = new Map<string, ContractVariableName>();
for (const variable of DEFAULT_CONTRACT_VARIABLES) {
  CONTRACT_ALIAS_TO_VARIABLE.set(normalizeContractMarkerName(variable), variable);
  for (const alias of CONTRACT_VARIABLE_ALIASES[variable] || []) {
    CONTRACT_ALIAS_TO_VARIABLE.set(normalizeContractMarkerName(alias), variable);
  }
}

export const CONTRACT_VARIABLE_CATALOG = DEFAULT_CONTRACT_VARIABLES.map(name => ({
  name,
  label: CONTRACT_VARIABLE_LABEL_OVERRIDES[name] || humanizeContractVariable(name),
  sampleValue: CONTRACT_VARIABLE_SAMPLE_OVERRIDES[name] || `[${CONTRACT_VARIABLE_LABEL_OVERRIDES[name] || humanizeContractVariable(name)}]`,
}));

export type DetectedContractMarker = {
  rawName: string;
  normalizedName: string;
  suggestedVariable: ContractVariableName | null;
  occurrences: number;
};

export function detectContractTemplateMarkers(templateHtml: string): DetectedContractMarker[] {
  const byRawName = new Map<string, DetectedContractMarker>();
  for (const match of templateHtml.matchAll(ANY_CONTRACT_MARKER_PATTERN)) {
    const rawName = match[1].trim();
    if (!rawName) continue;
    const existing = byRawName.get(rawName);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    const normalizedName = normalizeContractMarkerName(rawName);
    byRawName.set(rawName, {
      rawName,
      normalizedName,
      suggestedVariable: CONTRACT_ALIAS_TO_VARIABLE.get(normalizedName) || null,
      occurrences: 1,
    });
  }
  return [...byRawName.values()];
}

export function normalizeContractTemplateMarkerMappings(
  templateHtml: string,
  mappings: Record<string, string>,
): { htmlContent: string; variables: ContractVariableName[] } {
  const allowed = new Set<string>(DEFAULT_CONTRACT_VARIABLES);
  const detected = detectContractTemplateMarkers(templateHtml);
  const missing = detected.filter(marker => !mappings[marker.rawName]);
  if (missing.length) throw new Error(`Faltan asociaciones para: ${missing.map(marker => marker.rawName).join(", ")}.`);
  const invalid = detected
    .map(marker => mappings[marker.rawName]?.trim().toUpperCase())
    .filter((variable): variable is string => Boolean(variable) && !allowed.has(variable));
  if (invalid.length) throw new Error(`Variables canónicas no permitidas: ${[...new Set(invalid)].join(", ")}.`);
  const normalizedHtml = templateHtml.replace(ANY_CONTRACT_MARKER_PATTERN, (fullMatch, rawName: string) => {
    const mapped = mappings[rawName.trim()]?.trim().toUpperCase();
    return mapped ? `{{${mapped}}}` : fullMatch;
  });
  return {
    htmlContent: normalizedHtml,
    variables: extractContractTemplateMarkers(normalizedHtml) as ContractVariableName[],
  };
}

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
