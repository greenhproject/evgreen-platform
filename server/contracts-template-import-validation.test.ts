import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { requireValidContractTemplateMarkers } from "./contracts/contracts-router";

describe("validación de marcadores durante la importación contractual", () => {
  it("acepta únicamente las variables reales presentes y permitidas", () => {
    expect(requireValidContractTemplateMarkers("<p>{{ALIADO_RAZON_SOCIAL}} · {{GHP_NIT}}</p>"))
      .toEqual(["ALIADO_RAZON_SOCIAL", "GHP_NIT"]);
  });

  it("rechaza una variable desconocida con un error de validación claro", () => {
    expect(() => requireValidContractTemplateMarkers("<p>{{CAMPO_DESCONOCIDO}}</p>"))
      .toThrowError(expect.objectContaining<Partial<TRPCError>>({
        code: "BAD_REQUEST",
        message: expect.stringContaining("CAMPO_DESCONOCIDO"),
      }));
  });

  it("rechaza sintaxis inválida y plantillas sin marcadores dinámicos", () => {
    expect(() => requireValidContractTemplateMarkers("<p>{{campo-con-guion}}</p>"))
      .toThrowError(expect.objectContaining<Partial<TRPCError>>({ code: "BAD_REQUEST" }));
    expect(() => requireValidContractTemplateMarkers("<p>Contrato completamente literal</p>"))
      .toThrowError(expect.objectContaining<Partial<TRPCError>>({ code: "BAD_REQUEST" }));
  });
});
