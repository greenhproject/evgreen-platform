import { describe, expect, it } from "vitest";
import { removePendingSpacePhoto, setPendingSpacePhotoCover } from "../../client/src/pages/admin/space-photo-selection";

const photos = [
  { file: {} as File, preview: "blob:first", photoType: "general", isCover: true },
  { file: {} as File, preview: "blob:second", photoType: "parking_area" },
  { file: {} as File, preview: "blob:third", photoType: "access_road" },
];

describe("selección local de fotos de Espacios", () => {
  it("promueve de forma determinista la primera foto restante si se retira la portada en creación", () => {
    const result = removePendingSpacePhoto(photos, 0, { ensureCover: true });

    expect(result.removed?.preview).toBe("blob:first");
    expect(result.photos).toEqual([
      expect.objectContaining({ preview: "blob:second", isCover: true }),
      expect.objectContaining({ preview: "blob:third", isCover: false }),
    ]);
  });

  it("no inventa una portada nueva al retirar una foto aún no guardada durante edición", () => {
    const result = removePendingSpacePhoto(photos, 1, { ensureCover: false });

    expect(result.removed?.preview).toBe("blob:second");
    expect(result.photos.map((photo) => Boolean(photo.isCover))).toEqual([true, false]);
  });

  it("no modifica la selección cuando el índice es inválido", () => {
    const result = removePendingSpacePhoto(photos, 9, { ensureCover: true });

    expect(result.removed).toBeNull();
    expect(result.photos).toEqual(photos);
  });

  it("asigna una única portada al elegir otra foto", () => {
    expect(setPendingSpacePhotoCover(photos, 2).map((photo) => Boolean(photo.isCover))).toEqual([false, false, true]);
  });
});
