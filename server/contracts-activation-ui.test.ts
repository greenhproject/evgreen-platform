import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("client/src/pages/admin/Contracts.tsx"), "utf8");

describe("activación contractual guiada", () => {
  it("explica los tres requisitos y envía el contenido actual al activar", () => {
    expect(source).toContain("Requisitos para activar");
    expect(source).toContain("Marcadores válidos");
    expect(source).toContain("Datos legales GHP");
    expect(source).toContain("Aprobación documentada");
    expect(source).toContain("activate.mutate({ id: template.id, htmlContent, legalReviewNote })");
  });

  it("muestra el operador como perfil central no editable durante la emisión", () => {
    expect(source).toContain("Estos datos se administran una sola vez");
    expect(source).not.toContain('title="Parte 2 · Green House Project SAS" value={operator}');
    expect(source).toContain("!operatorProfile?.isVerified");
  });
});
