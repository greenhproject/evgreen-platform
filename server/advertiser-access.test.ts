import { describe, expect, it } from "vitest";
import { resolveAdvertiserAccess } from "../shared/advertiser-access";

describe("resolveAdvertiserAccess", () => {
  it("envía visitantes no autenticados al inicio de sesión del registro", () => {
    expect(resolveAdvertiserAccess(false, null)).toBe("login");
  });

  it("envía una cuenta de usuario al registro de anunciante, no a la landing", () => {
    expect(resolveAdvertiserAccess(true, "user")).toBe("register");
  });

  it("permite el portal solo a anunciantes y Administración", () => {
    expect(resolveAdvertiserAccess(true, "advertiser")).toBe("portal");
    expect(resolveAdvertiserAccess(true, "admin")).toBe("portal");
  });

  it("no permite que otros roles entren ni sobrescriban su rol", () => {
    expect(resolveAdvertiserAccess(true, "investor")).toBe("forbidden");
    expect(resolveAdvertiserAccess(true, "comercial")).toBe("forbidden");
  });
});
