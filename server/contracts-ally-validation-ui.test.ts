import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("client/src/pages/admin/Contracts.tsx"), "utf8");

describe("validación guiada de la parte aliada", () => {
  it("prioriza el firmante de la carta y reinicia datos al cambiar de espacio", () => {
    expect(source).toContain("space.letterSignerName || space.submitterName");
    expect(source).toContain("space.letterSignerDocument || space.submitterDocument");
    expect(source).toContain("setAlly({ ...emptyParty");
  });

  it("bloquea localmente, enfoca el primer campo y no muestra errores Zod crudos", () => {
    expect(source).toContain("validateContractParty(ally)");
    expect(source).toContain("data-contract-field");
    expect(source).toContain("readableContractError(error.message)");
    expect(source).toContain("Complete los datos del aliado antes de continuar");
  });
});
