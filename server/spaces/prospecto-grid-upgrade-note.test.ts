import { describe, expect, it } from "vitest";
import { buildProspectoGridUpgradeNote } from "./prospecto-grid-upgrade-note";

describe("nota de ampliación para prospecto", () => {
  it("preserva la nota manual y revela el transformador propuesto almacenado", () => {
    const note = buildProspectoGridUpgradeNote(
      JSON.stringify({ requiresNewTransformer: true, proposedTransformerKva: 300 }),
      "CAPEX total incluye la ampliación eléctrica.",
    );

    expect(note).toContain("CAPEX total incluye la ampliación eléctrica.");
    expect(note).toContain("transformador propuesto de 300 kVA");
    expect(note).toContain("aprobación del operador de red");
  });

  it("no inventa especificaciones cuando las notas históricas son texto libre", () => {
    expect(buildProspectoGridUpgradeNote("Tablero cercano; verificar acometida.", "Nota técnica validada.")).toBe("Nota técnica validada.");
  });
});
