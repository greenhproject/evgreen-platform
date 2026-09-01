import { describe, expect, it } from "vitest";
import { canManageCommercialPipeline, canManageSpaceAdministration } from "./pipeline-access";

describe("permisos del pipeline de espacios", () => {
  it("reserva acciones administrativas para admin y staff", () => {
    expect(canManageSpaceAdministration("admin")).toBe(true);
    expect(canManageSpaceAdministration("staff")).toBe(true);
    expect(canManageSpaceAdministration("comercial")).toBe(false);
    expect(canManageSpaceAdministration("user")).toBe(false);
  });

  it("habilita el pipeline comercial sin abrirlo a perfiles no autorizados", () => {
    expect(canManageCommercialPipeline("admin")).toBe(true);
    expect(canManageCommercialPipeline("staff")).toBe(true);
    expect(canManageCommercialPipeline("comercial")).toBe(true);
    expect(canManageCommercialPipeline("technician")).toBe(false);
    expect(canManageCommercialPipeline(undefined)).toBe(false);
  });
});
