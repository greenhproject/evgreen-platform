import { describe, expect, it } from "vitest";
import { getTemplateDeletionEligibility } from "./contracts/template-deletion";

describe("eliminación segura de plantillas contractuales", () => {
  it("permite eliminar únicamente un borrador sin contratos asociados", () => {
    expect(getTemplateDeletionEligibility("DRAFT", 0)).toEqual({ canDelete: true, deletionBlockReason: null });
  });

  it.each(["ACTIVE", "RETIRED"] as const)("protege una plantilla %s aunque no esté asociada", status => {
    expect(getTemplateDeletionEligibility(status, 0)).toMatchObject({ canDelete: false });
  });

  it("protege un borrador histórico que ya fue utilizado", () => {
    expect(getTemplateDeletionEligibility("DRAFT", 2)).toEqual({
      canDelete: false,
      deletionBlockReason: "Esta versión está vinculada a 2 contratos y debe conservarse por trazabilidad.",
    });
  });
});
