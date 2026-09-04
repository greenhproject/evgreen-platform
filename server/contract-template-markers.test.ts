import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTRACT_VARIABLES,
  analyzeContractTemplateMarkers,
  extractContractTemplateMarkers,
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
});
