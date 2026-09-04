import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTRACT_VARIABLES,
  CONTRACT_VARIABLE_CATALOG,
  analyzeContractTemplateMarkers,
  detectContractTemplateMarkers,
  extractContractTemplateMarkers,
  normalizeContractTemplateMarkerMappings,
  renderContractTemplate,
  unresolvedContractVariables,
} from "../shared/site-contracts";

describe("marcadores de la plantilla contractual dinámica", () => {
  it("incluye los datos de ambas partes, sitio y firma usados en el DOCX etiquetado", () => {
    const required = [
      "GHP_RAZON_SOCIAL", "GHP_NIT", "GHP_REPRESENTANTE", "GHP_DOMICILIO",
      "ALIADO_RAZON_SOCIAL", "ALIADO_NIT", "ALIADO_REPRESENTANTE", "ALIADO_DIRECCION_NOTIFICACIONES",
      "SITIO_NOMBRE", "SITIO_DIRECCION", "AREA_CEDIDA_M2", "PUESTOS_PARQUEO",
      "PARTICIPACION_ALIADO_PORCENTAJE", "PLAZO_INICIAL_ANOS", "PRORROGA_ANOS",
      "PLAZO_PAGO_DIAS_HABILES", "FECHA_CIERRE_LIQUIDACION",
      "VERSION_PLANTILLA", "CIUDAD_FIRMA", "FECHA_FIRMA",
    ];
    for (const marker of required) expect(DEFAULT_CONTRACT_VARIABLES).toContain(marker);
    expect(new Set(DEFAULT_CONTRACT_VARIABLES).size).toBe(DEFAULT_CONTRACT_VARIABLES.length);
  });

  it("extrae solo los marcadores presentes, normaliza minúsculas y elimina duplicados", () => {
    const html = "<p>{{ aliado_razon_social }}</p><p>{{GHP_NIT}}</p><p>{{ALIADO_RAZON_SOCIAL}}</p>";
    expect(extractContractTemplateMarkers(html)).toEqual(["ALIADO_RAZON_SOCIAL", "GHP_NIT"]);
  });

  it("rechaza marcadores desconocidos o con sintaxis diferente a {{VARIABLE}}", () => {
    const analysis = analyzeContractTemplateMarkers("<p>{{ALIADO_RAZON_SOCIAL}}</p><p>{{CAMPO_INVENTADO}}</p><p>{{campo-con-guion}}</p>");
    expect(analysis.markers).toEqual(["ALIADO_RAZON_SOCIAL", "CAMPO_INVENTADO"]);
    expect(analysis.unknownMarkers).toEqual(["CAMPO_INVENTADO"]);
    expect(analysis.malformedMarkers).toEqual(["campo-con-guion"]);
  });

  it("renderiza marcadores normalizados y reporta únicamente los valores pendientes", () => {
    const html = "<p>{{ aliado_razon_social }} · {{GHP_NIT}}</p>";
    const values = { ALIADO_RAZON_SOCIAL: "EDS & Aliado" };
    expect(unresolvedContractVariables(html, values)).toEqual(["GHP_NIT"]);
    expect(renderContractTemplate(html, values)).toContain("EDS &amp; Aliado");
  });

  it("sugiere automáticamente los ocho alias usados por la plantilla v3.0 real", () => {
    const html = "{{Aliado}} {{Nit-aliado}} {{Rep_legal_aliado}} {{Cedula_rep_legal_aliado}} {{Domicilio_aliado}} {{Correo_aliado}} {{Tel_aliado}} {{Dir_aliado}}";
    expect(detectContractTemplateMarkers(html).map(marker => [marker.rawName, marker.suggestedVariable])).toEqual([
      ["Aliado", "ALIADO_RAZON_SOCIAL"],
      ["Nit-aliado", "ALIADO_NIT"],
      ["Rep_legal_aliado", "ALIADO_REPRESENTANTE"],
      ["Cedula_rep_legal_aliado", "ALIADO_DOCUMENTO_REPRESENTANTE"],
      ["Domicilio_aliado", "ALIADO_DOMICILIO"],
      ["Correo_aliado", "ALIADO_CORREO_NOTIFICACIONES"],
      ["Tel_aliado", "ALIADO_TELEFONO"],
      ["Dir_aliado", "ALIADO_DIRECCION_NOTIFICACIONES"],
    ]);
  });

  it("normaliza el documento solo cuando todos los marcadores fueron asociados", () => {
    const result = normalizeContractTemplateMarkerMappings("<p>{{Aliado}} · {{Nit-aliado}}</p>", {
      Aliado: "ALIADO_RAZON_SOCIAL",
      "Nit-aliado": "ALIADO_NIT",
    });
    expect(result.htmlContent).toBe("<p>{{ALIADO_RAZON_SOCIAL}} · {{ALIADO_NIT}}</p>");
    expect(result.variables).toEqual(["ALIADO_RAZON_SOCIAL", "ALIADO_NIT"]);
    expect(() => normalizeContractTemplateMarkerMappings("{{Aliado}} {{Nit-aliado}}", { Aliado: "ALIADO_RAZON_SOCIAL" })).toThrow("Nit-aliado");
  });

  it("expone etiquetas y valores de ejemplo para construir el asistente visual", () => {
    expect(CONTRACT_VARIABLE_CATALOG.find(item => item.name === "ALIADO_NIT")).toEqual({
      name: "ALIADO_NIT",
      label: "NIT del aliado",
      sampleValue: "900.123.456-7",
    });
  });
});
