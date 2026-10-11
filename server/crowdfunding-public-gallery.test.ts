import { describe, expect, it } from "vitest";
import { resolveInheritedProjectPhotos } from "../shared/project-gallery";

describe("galería pública heredada de crowdfunding", () => {
  it("prioriza las fotografías heredadas que entrega el proyecto público", () => {
    expect(resolveInheritedProjectPhotos({
      inheritedPhotos: [{ url: "https://cdn.evgreen.lat/site.jpg", type: "general", caption: "Fachada" }],
      spaceInheritanceSnapshot: { photos: [{ url: "https://cdn.evgreen.lat/old.jpg", type: "other" }] },
    })).toEqual([{ url: "https://cdn.evgreen.lat/site.jpg", type: "general", caption: "Fachada" }]);
  });

  it("recupera la galería de snapshots históricos y descarta entradas inválidas", () => {
    expect(resolveInheritedProjectPhotos({
      spaceInheritanceSnapshot: JSON.stringify({
        photos: [{ url: "https://cdn.evgreen.lat/site.jpg", type: "parking_area" }, { url: "", type: "general" }],
      }),
    })).toEqual([{ url: "https://cdn.evgreen.lat/site.jpg", type: "parking_area" }]);
  });

  it("prioriza la portada y conserva la etiqueta de render conceptual", () => {
    expect(resolveInheritedProjectPhotos({
      inheritedPhotos: [
        { url: "https://cdn.evgreen.lat/general.jpg", type: "general", isConceptual: true },
        { url: "https://cdn.evgreen.lat/render.jpg", type: "general", isCover: 1, isConceptual: 1 },
      ],
    })).toEqual([
      { url: "https://cdn.evgreen.lat/render.jpg", type: "general", isCover: true, isConceptual: true },
      { url: "https://cdn.evgreen.lat/general.jpg", type: "general", isConceptual: true },
    ]);
  });
});
