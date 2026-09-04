import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("siembra de plantilla contractual inicial", () => {
  it("conserva la fuente DOCX entregada y deja la versión bajo revisión jurídica", () => {
    const source = readFileSync("server/contracts/seed-initial-contract-template.ts", "utf8");
    expect(source).toContain("Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx");
    expect(source).toContain('TEMPLATE_VERSION = "2.3-dinamica"');
    expect(source).toContain('status: "DRAFT"');
    expect(source).toContain("analyzeContractTemplateMarkers");
    expect(source).toContain("markerAnalysis.markers");
    expect(source).toContain("Requiere aprobación jurídica antes de activarse");
  });
});
