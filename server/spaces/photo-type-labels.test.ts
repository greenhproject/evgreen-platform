import { describe, expect, it } from "vitest";
import { getPhotoMarkerLabel, getPhotoTypeLabel } from "../../shared/photo-type-labels";

describe("photo type labels", () => {
  it("normaliza las etiquetas técnicas conocidas", () => {
    expect(getPhotoTypeLabel("access_road")).toBe("Vía de acceso");
    expect(getPhotoTypeLabel("electrical_panel")).toBe("Tablero eléctrico");
    expect(getPhotoTypeLabel("transformer")).toBe("Transformador");
  });

  it("mantiene legibles los tipos heredados o nuevos", () => {
    expect(getPhotoTypeLabel("parking")).toBe("Zona de parqueo");
    expect(getPhotoTypeLabel("custom_view")).toBe("custom view");
    expect(getPhotoTypeLabel(null)).toBe("Vista general");
  });

  it("combina etiqueta técnica y descripción sin perder el contexto", () => {
    expect(getPhotoMarkerLabel("transformer", "Costado oriental")).toBe("Transformador · Costado oriental");
    expect(getPhotoMarkerLabel("access_road", null)).toBe("Vía de acceso");
  });
});
