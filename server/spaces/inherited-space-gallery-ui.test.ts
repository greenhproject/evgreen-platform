import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InheritedSpaceGallery } from "../../client/src/components/crowdfunding/InheritedSpaceGallery";

describe("InheritedSpaceGallery", () => {
  it("muestra miniaturas, conserva el orden de las fotos y usa sus captions heredados", () => {
    const html = renderToStaticMarkup(React.createElement(InheritedSpaceGallery, {
      photos: [
        { url: "https://example.com/acceso.jpg", type: "access_road", caption: "Acceso vehicular" },
        { url: "https://example.com/tablero.jpg", type: "electrical_panel", caption: "Tablero eléctrico" },
      ],
    }));

    expect(html).toContain("Galería heredada del sitio");
    expect(html).toContain("2 fotos");
    expect(html.indexOf("Acceso vehicular")).toBeLessThan(html.indexOf("Tablero eléctrico"));
    expect(html).toContain('src="https://example.com/acceso.jpg"');
    expect(html).toContain('src="https://example.com/tablero.jpg"');
  });
});
