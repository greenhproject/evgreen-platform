import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("siembra de plantilla contractual inicial", () => {
  it("conserva la fuente DOCX entregada y deja la versión bajo revisión jurídica", () => {
    const source = readFileSync("server/contracts/seed-initial-contract-template.ts", "utf8");
    expect(source).toContain("Contrato_Aliado_Comercial_EVGreen_V2.docx");
    expect(source).toContain('status: "DRAFT"');
    expect(source).toContain("DEFAULT_CONTRACT_VARIABLES");
    expect(source).toContain("Requiere aprobación jurídica antes de activarse");
  });
});
