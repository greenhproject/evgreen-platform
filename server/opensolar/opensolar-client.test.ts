import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyOpenSolarOrganization } from "./opensolar-client";

describe("diagnóstico OpenSolar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("verifica únicamente la organización configurada con Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "org-evgreen", name: "EVGreen Solar" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOpenSolarOrganization({ apiKey: "token-prueba", orgId: "org-evgreen" });

    expect(result).toMatchObject({ success: true, status: 200, organizationId: "org-evgreen", organizationName: "EVGreen Solar" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.opensolar.com/api/orgs/org-evgreen/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-prueba", Accept: "application/json" }),
      }),
    );
  });

  it("no llama a OpenSolar sin token o ID de organización", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyOpenSolarOrganization({ apiKey: "", orgId: "org-evgreen" })).resolves.toMatchObject({ success: false, status: 0 });
    await expect(verifyOpenSolarOrganization({ apiKey: "token-prueba", orgId: "" })).resolves.toMatchObject({ success: false, status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no acepta una organización diferente a la configurada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "other-org", name: "Otra organización" }), { status: 200 })));

    await expect(verifyOpenSolarOrganization({ apiKey: "token-prueba", orgId: "org-evgreen" })).resolves.toMatchObject({
      success: false,
      status: 200,
      message: "La respuesta de OpenSolar no corresponde al ID de organización configurado.",
    });
  });
});
