import { describe, expect, it } from "vitest";
import {
  getHorizontalSwipeDirection,
  moveGalleryIndex,
  wrapGalleryIndex,
} from "../../shared/photo-gallery";

describe("photo gallery navigation", () => {
  it("envuelve la navegación al inicio y al final", () => {
    expect(moveGalleryIndex(0, 4, "previous")).toBe(3);
    expect(moveGalleryIndex(3, 4, "next")).toBe(0);
    expect(wrapGalleryIndex(6, 4)).toBe(2);
  });

  it("mantiene una galería de una sola imagen en el mismo índice", () => {
    expect(moveGalleryIndex(0, 1, "next")).toBe(0);
    expect(moveGalleryIndex(0, 1, "previous")).toBe(0);
  });

  it("detecta gestos horizontales intencionales", () => {
    expect(getHorizontalSwipeDirection({ x: 250, y: 100 }, { x: 120, y: 110 })).toBe("next");
    expect(getHorizontalSwipeDirection({ x: 120, y: 100 }, { x: 250, y: 105 })).toBe("previous");
  });

  it("ignora desplazamientos cortos o principalmente verticales", () => {
    expect(getHorizontalSwipeDirection({ x: 100, y: 100 }, { x: 130, y: 105 })).toBeNull();
    expect(getHorizontalSwipeDirection({ x: 100, y: 100 }, { x: 160, y: 220 })).toBeNull();
  });
});
