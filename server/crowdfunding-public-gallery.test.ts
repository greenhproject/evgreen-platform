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
});
