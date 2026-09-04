import {
  normalizeContractVariables,
  renderContractTemplate,
  unresolvedContractVariables,
  type ContractVariables,
} from "../../shared/site-contracts";
import { appendContractSignatureBlocks, sha256 } from "./contract-pdf-service";

export type ContractDraftParty = {
  legalName: string;
  taxId: string;
  representativeName: string;
  representativeDocument: string;
  representativeTitle?: string;
  email: string;
  phone?: string;
  notificationAddress: string;
  domicile?: string;
};

export type ContractDraftSpace = {
  spaceName: string;
  address: string;
  city: string;
  department?: string | null;
  spaceType?: string | null;
  availableAreaM2?: string | number | null;
  parkingSpots?: string | number | null;
};

export class UnresolvedContractVariablesError extends Error {
  constructor(readonly variables: string[]) {
    super(`Faltan variables obligatorias: ${variables.join(", ")}`);
    this.name = "UnresolvedContractVariablesError";
  }
}

export function buildContractDraft(input: {
  contractNumber: string;
  templateVersion: string;
  templateHtml: string;
  variables: Record<string, string>;
  ally: ContractDraftParty;
  operator: ContractDraftParty;
  space: ContractDraftSpace;
}): { variables: ContractVariables; contractHtml: string; contentHash: string } {
  const variables = normalizeContractVariables({
    ...input.variables,
    NUMERO_CONTRATO: input.contractNumber,
    GHP_RAZON_SOCIAL: input.operator.legalName,
    GHP_NIT: input.operator.taxId,
    GHP_REPRESENTANTE: input.operator.representativeName,
    GHP_DOCUMENTO_REPRESENTANTE: input.operator.representativeDocument,
    GHP_CARGO_REPRESENTANTE: input.operator.representativeTitle || "Representante legal",
    GHP_DOMICILIO: input.operator.domicile || "Colombia",
    GHP_DIRECCION: input.operator.notificationAddress,
    GHP_CORREO_NOTIFICACIONES: input.operator.email,
    GHP_TELEFONO: input.operator.phone || "",
    ALIADO_RAZON_SOCIAL: input.ally.legalName,
    ALIADO_NIT: input.ally.taxId,
    ALIADO_REPRESENTANTE: input.ally.representativeName,
    ALIADO_DOCUMENTO_REPRESENTANTE: input.ally.representativeDocument,
    ALIADO_CARGO_REPRESENTANTE: input.ally.representativeTitle || "Representante legal",
    ALIADO_DOMICILIO: input.ally.domicile || input.space.city,
    ALIADO_DIRECCION_NOTIFICACIONES: input.ally.notificationAddress,
    ALIADO_CORREO_NOTIFICACIONES: input.ally.email,
    ALIADO_TELEFONO: input.ally.phone || "",
    SITIO_NOMBRE: input.space.spaceName,
    SITIO_DIRECCION: input.space.address,
    SITIO_CIUDAD: input.space.city,
    SITIO_DEPARTAMENTO: input.space.department || "",
    SITIO_TIPO: input.space.spaceType || input.variables.SITIO_TIPO || "Espacio comercial para electrolinera",
    AREA_CEDIDA_M2: input.variables.AREA_CEDIDA_M2 || input.space.availableAreaM2?.toString() || "",
    PUESTOS_PARQUEO: input.variables.PUESTOS_PARQUEO || input.space.parkingSpots?.toString() || "",
    PLANO_ANEXO_URL: input.variables.PLANO_ANEXO_URL || "",
    MARCA_COMERCIAL: input.variables.MARCA_COMERCIAL || "EVGreen",
    PARTICIPACION_ALIADO_PORCENTAJE: input.variables.PARTICIPACION_ALIADO_PORCENTAJE || "10",
    PLAZO_INICIAL_ANOS: input.variables.PLAZO_INICIAL_ANOS || "10",
    PRORROGA_ANOS: input.variables.PRORROGA_ANOS || "5",
    PLAZO_PAGO_DIAS_HABILES: input.variables.PLAZO_PAGO_DIAS_HABILES || "15",
    FECHA_CIERRE_LIQUIDACION: input.variables.FECHA_CIERRE_LIQUIDACION || "Último día calendario de cada mes",
    VERSION_PLANTILLA: input.templateVersion,
    CIUDAD_FIRMA: input.variables.CIUDAD_FIRMA || input.space.city,
    FECHA_FIRMA: input.variables.FECHA_FIRMA || "pendiente de firma",
  });
  const missing = unresolvedContractVariables(input.templateHtml, variables);
  if (missing.length) throw new UnresolvedContractVariablesError(missing);

  const filledHtml = renderContractTemplate(input.templateHtml, variables);
  const contractHtml = appendContractSignatureBlocks(filledHtml, {
    allyName: input.ally.legalName,
    allyRepresentative: input.ally.representativeName,
    allyDocument: input.ally.representativeDocument,
    operatorName: input.operator.legalName,
    operatorRepresentative: input.operator.representativeName,
    operatorDocument: input.operator.representativeDocument,
  });
  return { variables, contractHtml, contentHash: sha256(contractHtml) };
}
