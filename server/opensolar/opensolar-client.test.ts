import { afterEach, describe, expect, it, vi } from "vitest";
import { getOpenSolarBearerToken, verifyOpenSolarOrganization } from "./opensolar-client";

describe("diagnóstico OpenSolar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("intercambia credenciales temporalmente por un Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "bearer-prueba" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOpenSolarBearerToken({
      username: "admin@example.com",
      password: "contraseña-temporal",
      mfaToken: "123456",
    });

    expect(result).toMatchObject({ success: true, status: 200, bearerToken: "bearer-prueba" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opensolar.com/api-token-auth/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ username: "admin@example.com", password: "contraseña-temporal", token: "123456" }),
      }),
    );
  });

  it("no llama a OpenSolar sin usuario y contraseña", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenSolarBearerToken({ username: "", password: "contraseña" })).resolves.toMatchObject({ success: false, status: 0 });
    await expect(getOpenSolarBearerToken({ username: "admin@example.com", password: "" })).resolves.toMatchObject({ success: false, status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifica únicamente la organización configurada con Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "org-evgreen", name: "EVGreen Solar" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOpenSolarOrganization({ bearerToken: "token-prueba", orgId: "org-evgreen" });

    expect(result).toMatchObject({ success: true, status: 200, organizationId: "org-evgreen", organizationName: "EVGreen Solar" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opensolar.com/api/orgs/org-evgreen/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-prueba", Accept: "application/json" }),
      }),
    );
  });

  it("no acepta una organización diferente a la configurada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "other-org", name: "Otra organización" }), { status: 200 })));

    await expect(verifyOpenSolarOrganization({ bearerToken: "token-prueba", orgId: "org-evgreen" })).resolves.toMatchObject({
      success: false,
      status: 200,
      message: "La respuesta de OpenSolar no corresponde al ID de organización configurado.",
    });
  });
});
