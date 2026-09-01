import { describe, expect, it } from "vitest";
import { resolveNocScope } from "./noc-access";

describe("resolveNocScope", () => {
  it("mantiene la visión financiera global exclusivamente para administración", () => {
    expect(resolveNocScope({ role: "admin" })).toEqual({
      mode: "global", organizationId: null, canViewFinancials: true, canViewPersonalActivity: true,
    });
  });

  it("permite a soporte y operación una vista global sin dinero ni PII", () => {
    for (const role of ["staff", "engineer", "technician"]) {
      expect(resolveNocScope({ role })).toEqual({
        mode: "global", organizationId: null, canViewFinancials: false, canViewPersonalActivity: false,
      });
    }
  });

  it("limita al usuario SaaS a la organización resuelta en su contexto", () => {
    expect(resolveNocScope({ role: "user", organizationId: 17 })).toEqual({
      mode: "organization", organizationId: 17, canViewFinancials: true, canViewPersonalActivity: false,
    });
    expect(resolveNocScope({ role: "user" })).toBeNull();
  });
});
