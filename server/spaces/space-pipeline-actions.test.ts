import { describe, expect, it } from "vitest";
import { getSpacePipelineAction } from "../../shared/space-pipeline-actions";

describe("acciones visibles del pipeline de espacios", () => {
  it("mantiene la formalización manual fuera del avance normal del pipeline", () => {
    expect(getSpacePipelineAction("letter_sent")).toMatchObject({
      kind: "await_external_signature",
      title: "Esperando firma externa",
    });
  });

  it("solo habilita la publicación normal después de la aceptación externa", () => {
    expect(getSpacePipelineAction("letter_accepted")).toMatchObject({ kind: "publish" });
    expect(getSpacePipelineAction("approved")).toMatchObject({ kind: "send_letter" });
  });

  it("identifica los hitos posteriores a la publicación como avances comerciales", () => {
    expect(getSpacePipelineAction("published")).toMatchObject({ kind: "advance_commercial" });
    expect(getSpacePipelineAction("operational")).toBeNull();
  });
});
