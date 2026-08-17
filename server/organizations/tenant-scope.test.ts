import { describe, expect, it } from "vitest";
import { assertTenantOwnsResource } from "./tenant-scope";

describe("tenant resource scope", () => {
  it("permite acceder a recursos del tenant activo", () => {
    expect(() => assertTenantOwnsResource(10, 10, "Estación")).not.toThrow();
  });

  it("deniega recursos de otra empresa sin revelar su pertenencia", () => {
    try {
      assertTenantOwnsResource(10, 20, "Estación");
      throw new Error("Se esperaba un error de aislamiento");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Estación no encontrado");
    }
  });

  it("deniega recursos de plataforma no asignados al tenant", () => {
    expect(() => assertTenantOwnsResource(10, null, "Estación")).toThrow("Estación no encontrado");
  });
});
