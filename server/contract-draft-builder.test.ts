import { describe, expect, it } from "vitest";
import { buildContractDraft, UnresolvedContractVariablesError } from "./contracts/contract-draft-builder";

const party = {
  legalName: "Empresa de prueba S.A.S.",
  taxId: "900.000.000-1",
  representativeName: "Representante de prueba",
  representativeDocument: "1.000.000",
  representativeTitle: "Representante legal",
  email: "legal@empresa.test",
  phone: "+57 300 000 0000",
  notificationAddress: "Dirección de prueba",
  domicile: "Bogotá D.C.",
};

describe("constructor único de contrato y vista previa", () => {
  it("sustituye variables, inserta un único bloque de firmas y calcula el hash", () => {
    const result = buildContractDraft({
      contractNumber: "EVG-PREV-2026-ABC123",
      templateVersion: "2.3-dinamica",
      templateHtml: "<p>{{VERSION_PLANTILLA}} · {{SITIO_NOMBRE}} · {{PARTICIPACION_ALIADO_PORCENTAJE}}%</p><p>EVG_SIGNATURE_BLOCK_HERE</p>",
      variables: { PARTICIPACION_ALIADO_PORCENTAJE: "10" },
      ally: party,
      operator: { ...party, legalName: "Green House Project SAS" },
      space: { spaceName: "EDS Prueba", address: "Km 1", city: "Bogotá D.C." },
    });
    expect(result.contractHtml).toContain("2.3-dinamica · EDS Prueba · 10%");
    expect(result.contractHtml.match(/aria-label="Bloques de firma"/g)).toHaveLength(1);
    expect(result.contractHtml).not.toContain("{{");
    expect(result.contentHash).toHaveLength(64);
  });

  it("rechaza una vista previa con variables obligatorias pendientes", () => {
    expect(() => buildContractDraft({
      contractNumber: "EVG-PREV-2026-ABC123",
      templateVersion: "2.3-dinamica",
      templateHtml: "<p>{{PLANO_ANEXO_URL}}</p>",
      variables: {},
      ally: party,
      operator: party,
      space: { spaceName: "EDS Prueba", address: "Km 1", city: "Bogotá D.C." },
    })).toThrowError(UnresolvedContractVariablesError);
  });
});
