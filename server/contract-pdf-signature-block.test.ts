import { describe, expect, it } from "vitest";
import { appendContractSignatureBlocks } from "./contracts/contract-pdf-service";

const parties = {
  allyName: "EDS Prueba S.A.S.",
  allyRepresentative: "Representante Aliado",
  allyDocument: "90000000",
  operatorName: "Green House Project S.A.S.",
  operatorRepresentative: "Representante GHP",
  operatorDocument: "10000000",
};

describe("bloque único de firmas contractuales", () => {
  it("reemplaza el ancla DOCX y no duplica el bloque de firmas", () => {
    const rendered = appendContractSignatureBlocks("<h1>Contrato</h1><p>EVG_SIGNATURE_BLOCK_HERE</p>", parties);
    expect(rendered).not.toContain("EVG_SIGNATURE_BLOCK_HERE");
    expect(rendered.match(/aria-label="Bloques de firma"/g)).toHaveLength(1);
    expect(rendered).toContain("EVG_ALLY_SIGN_HERE");
    expect(rendered).toContain("EVG_OPERATOR_SIGN_HERE");
  });

  it("mantiene compatibilidad con plantillas antiguas sin ancla", () => {
    const rendered = appendContractSignatureBlocks("<h1>Contrato legado</h1>", parties);
    expect(rendered.match(/aria-label="Bloques de firma"/g)).toHaveLength(1);
  });
});
