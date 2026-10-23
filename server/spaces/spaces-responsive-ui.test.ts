import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const spacesSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/Spaces.tsx"), "utf8");
const lightboxSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/spaces/SpacePhotoLightbox.tsx"), "utf8");
const editDialogStart = spacesSource.indexOf("{/* Edit Dialog — EXPANDIDO */}");
const editDialogEnd = spacesSource.indexOf("{/* Delete Confirmation Dialog */}", editDialogStart);
const editDialogSource = spacesSource.slice(editDialogStart, editDialogEnd);
const detailDialogStart = spacesSource.indexOf("function SpaceDetailDialog");
const detailDialogEnd = spacesSource.indexOf("{/* Edit Dialog — EXPANDIDO */}", detailDialogStart);
const detailDialogSource = spacesSource.slice(detailDialogStart, detailDialogEnd);

describe("Espacios mobile-first", () => {
  it("convierte detalle, creación, edición y prospecto en superficies seguras para móvil", () => {
    expect(spacesSource).toContain("!h-[100dvh]");
    expect(spacesSource).toContain("!w-screen");
    expect(spacesSource).toContain("overflow-y-auto overscroll-contain");
    expect(spacesSource).toContain("pt-[max(0.75rem,env(safe-area-inset-top))]");
    expect(spacesSource).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(spacesSource).toContain("Generar Prospecto de Inversión");
  });

  it("separa las acciones del cuerpo desplazable para no cubrir la carga de fotos en móvil", () => {
    expect(editDialogStart).toBeGreaterThanOrEqual(0);
    expect(editDialogEnd).toBeGreaterThan(editDialogStart);
    expect(editDialogSource).toContain("!flex !h-[100dvh]");
    expect(editDialogSource).toContain("!flex-col !gap-0 !overflow-hidden");
    expect(editDialogSource).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(editDialogSource).toContain("Agregar nuevas fotos");
    expect(editDialogSource).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(editDialogSource).not.toContain("sticky bottom-0");
    expect(editDialogSource).not.toContain("sticky top-0");
    expect(editDialogSource).toContain("Guardar cambios");
    expect(spacesSource).toContain("Crear Espacio");
    expect(spacesSource).toContain("Generar y Descargar");
    expect(spacesSource).toContain("<Eye className=\"mr-1 h-3.5 w-3.5\" /> Ver");
  });

  it("aprovecha el ancho y alto de una tablet antes de limitar el editor en escritorio grande", () => {
    expect(editDialogSource).toContain("sm:!h-[calc(100dvh-2rem)]");
    expect(editDialogSource).toContain("sm:!w-[calc(100vw-2rem)]");
    expect(editDialogSource).toContain("sm:!max-w-none");
    expect(editDialogSource).toContain("xl:!max-w-[72rem]");
    expect(editDialogSource).not.toContain("sm:!max-w-2xl");
  });

  it("aprovecha la misma superficie de trabajo en el detalle de tablet", () => {
    expect(detailDialogStart).toBeGreaterThanOrEqual(0);
    expect(detailDialogEnd).toBeGreaterThan(detailDialogStart);
    expect(detailDialogSource).toContain("sm:!h-[calc(100dvh-2rem)]");
    expect(detailDialogSource).toContain("sm:!w-[calc(100vw-2rem)]");
    expect(detailDialogSource).toContain("sm:!max-w-none");
    expect(detailDialogSource).toContain("xl:!max-w-[72rem]");
    expect(detailDialogSource).not.toContain("sm:!max-w-4xl");
  });

  it("mantiene la galería compacta, táctil y accesible", () => {
    expect(lightboxSource).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(lightboxSource).toContain("touch-pan-y");
    expect(lightboxSource).toContain("getHorizontalSwipeDirection");
    expect(lightboxSource).toContain("h-12 w-12");
    expect(lightboxSource).toContain("h-12 w-16");
    expect(lightboxSource).toContain("scrollIntoView");
    expect(lightboxSource).toContain("Cerrar galería y volver al detalle del espacio");
  });
});
