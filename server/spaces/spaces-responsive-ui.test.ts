import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const spacesSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/Spaces.tsx"), "utf8");
const lightboxSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/spaces/SpacePhotoLightbox.tsx"), "utf8");

describe("Espacios mobile-first", () => {
  it("convierte detalle, creación, edición y prospecto en superficies seguras para móvil", () => {
    expect(spacesSource).toContain("!h-[100dvh]");
    expect(spacesSource).toContain("!w-screen");
    expect(spacesSource).toContain("overflow-y-auto overscroll-contain");
    expect(spacesSource).toContain("pt-[max(0.75rem,env(safe-area-inset-top))]");
    expect(spacesSource).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(spacesSource).toContain("Generar Prospecto de Inversión");
  });

  it("mantiene las acciones primarias visibles y el expediente fácil de abrir en móvil", () => {
    expect(spacesSource).toContain("sticky bottom-0 z-10");
    expect(spacesSource).toContain("Guardar cambios");
    expect(spacesSource).toContain("Crear Espacio");
    expect(spacesSource).toContain("Generar y Descargar");
    expect(spacesSource).toContain("<Eye className=\"mr-1 h-3.5 w-3.5\" /> Ver");
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
