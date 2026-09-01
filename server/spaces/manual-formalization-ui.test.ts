import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManualFormalizationAudit, ManualFormalizationFields } from "../../client/src/components/spaces/ManualFormalizationAudit";

describe("resumen visible de formalización manual", () => {
  it("muestra motivo, evidencia, fecha y la advertencia de que no suplanta una firma externa", () => {
    const html = renderToStaticMarkup(createElement(ManualFormalizationAudit, {
      reason: "Acuerdo comercial aprobado en comité interno.",
      evidence: "Acta Comité Comercial 2026-08-19.",
      formalizedAt: "2026-08-19T14:30:00.000Z",
    }));

    expect(html).toContain("Formalización interna manual");
    expect(html).toContain("Acuerdo comercial aprobado");
    expect(html).toContain("Acta Comité Comercial");
    expect(html).toContain("La firma externa del cliente no fue sustituida");
    expect(html).toContain("2026");
  });

  it("renderiza el diálogo con motivo y evidencia obligatorios", () => {
    const html = renderToStaticMarkup(createElement(ManualFormalizationFields, {
      reason: "",
      evidence: "",
      onReasonChange: () => undefined,
      onEvidenceChange: () => undefined,
    }));

    expect(html).toContain("Formalización interna excepcional");
    expect(html).toContain("Motivo de aprobación interna *");
    expect(html).toContain("Evidencia o referencia de aprobación *");
    expect(html).toContain("Esta acción no suplanta la firma del cliente");
  });
});
