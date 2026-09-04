import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/Contracts.tsx"), "utf8");

describe("formulario contractual responsive", () => {
  it("usa casi todo el viewport y conserva scroll interno sin desbordamiento horizontal", () => {
    expect(source).toContain("max-h-[calc(100dvh-0.75rem)]");
    expect(source).toContain("w-[calc(100vw-0.75rem)]");
    expect(source).toContain("sm:max-w-[calc(100vw-2rem)]");
    expect(source).toContain("xl:max-w-[1400px]");
    expect(source).toContain("overflow-y-auto overflow-x-hidden");
    expect(source).toContain('className="w-full sm:w-auto"');
    expect(source).not.toContain('max-h-[92vh] max-w-5xl overflow-y-auto bg-[#09130f]');
  });

  it("apila las partes hasta pantallas extra grandes y evita columnas estrechas en tablet", () => {
    expect(source).toContain("2xl:grid-cols-2");
    expect(source).toContain("md:grid-cols-2");
    expect(source).toContain("Documento del representante");
  });

  it("muestra el origen de formalización y protege espacios con expediente existente", () => {
    expect(source).toContain("Espacio con carta firmada o formalización registrada");
    expect(source).toContain('selectedSpace.formalizationSource === "DIGITAL_LETTER"');
    expect(source).toContain("disabled={!space.canCreateContract}");
    expect(source).toContain("selectedSpace?.eligibilityReason");
  });

  it("presenta el asistente de importación como flujo responsive de fuente, mapeo y vista previa", () => {
    expect(source).toContain("Importar y mapear plantilla contractual");
    expect(source).toContain('label: "Fuente"');
    expect(source).toContain('label: "Mapeo"');
    expect(source).toContain('label: "Vista previa"');
    expect(source).toContain("max-w-[calc(100vw-1rem)]");
    expect(source).toContain("xl:max-w-6xl");
    expect(source).toContain("overflow-y-auto overflow-x-hidden");
  });

  it("bloquea el guardado hasta mapear y previsualizar todos los marcadores", () => {
    expect(source).toContain("Asocie los ${pending.length} campos pendientes");
    expect(source).toContain("Genere y revise la vista previa antes de guardar");
    expect(source).toContain("previewFingerprint: preview.fingerprint");
    expect(source).toContain("Guardar como borrador");
    expect(source).toContain("mappedCount !== analysis?.markers.length");
  });
});
