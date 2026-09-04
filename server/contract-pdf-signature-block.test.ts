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

  it("reemplaza el cierre de firmas heredado por un único bloque institucional", () => {
    const legalBody = `<p>${"Contenido legal íntegro. ".repeat(120)}</p>`;
    const legacy = `${legalBody}<p>En señal de aceptación, las partes firman.</p>
      <p><strong>EL OPERADOR: </strong></p><p>GREEN HOUSE PROJECT S.A.S.</p><p>________________</p>
      <p><strong>EL ALIADO COMERCIAL:</strong></p><p>EDS Prueba</p><p>________________</p>`;
    const rendered = appendContractSignatureBlocks(legacy, parties);
    expect(rendered).toContain(legalBody);
    expect(rendered).toContain("En señal de aceptación");
    expect(rendered).not.toContain("GREEN HOUSE PROJECT S.A.S.");
    expect(rendered.match(/aria-label="Bloques de firma"/g)).toHaveLength(1);
    expect(rendered).toContain("Firmas de las partes");
  });

  it("no confunde la identificación inicial de las partes con el bloque final de firmas", () => {
    const contract = `<p><strong>EL OPERADOR:</strong></p><p>Green House Project SAS</p>
      <p><strong>EL ALIADO COMERCIAL:</strong></p><p>EDS Prueba</p>
      <p>${"Cláusula sustancial que debe conservarse. ".repeat(180)}</p>`;
    const rendered = appendContractSignatureBlocks(contract, parties);
    expect(rendered).toContain("Cláusula sustancial que debe conservarse.");
    expect(rendered.match(/aria-label="Bloques de firma"/g)).toHaveLength(1);
  });
});
