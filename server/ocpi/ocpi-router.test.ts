import { describe, expect, it } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { getOcpiActivationError, getOcpiManualPublishDecision } from "./ocpi-router";
import { buildOcpiRouter } from "./ocpi-router";

describe("activación administrativa de OCPI", () => {
  it("impide activar OCPI sin el paquete mínimo de alta CargaME", () => {
    expect(getOcpiActivationError({ enabled: true, versionsUrl: "", partyId: "EVG", token: "" }, false))
      .toContain("Versions URL");
  });

  it("acepta activar cuando el token ya está cifrado y la identidad es válida", () => {
    expect(getOcpiActivationError({ enabled: true, versionsUrl: "https://sandbox.cargame.example/ocpi/versions", partyId: "EVG" }, true))
      .toBeNull();
  });

  it("bloquea endpoint inseguro aunque la integración permanezca desactivada", () => {
    expect(getOcpiActivationError({ enabled: false, versionsUrl: "http://127.0.0.1/ocpi/versions", partyId: "EVG" }, true))
      .toContain("HTTPS");
  });

  it("deniega el centro OCPI a roles que no son administradores antes de consultar secretos", async () => {
    const t = initTRPC.context<{ role: string }>().create();
    const adminProcedure = t.procedure.use(({ ctx, next }) => {
      if (ctx.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return next();
    });
    const caller = buildOcpiRouter(t.router, adminProcedure).createCaller({ role: "user" });
    await expect(caller.getConfig()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("mantiene la publicación manual en modo seguro sin tráfico externo si OCPI no está activo", () => {
    expect(getOcpiManualPublishDecision({ enabled: false })).toEqual({
      status: "SKIPPED", externalRequest: false,
      message: "OCPI no está activado o faltan credenciales. No se envió tráfico externo.",
    });
    expect(getOcpiManualPublishDecision({ enabled: true, versionsUrl: "https://sandbox.example/versions", tokenEncrypted: "ciphertext" })).toMatchObject({ status: "PENDING", externalRequest: false });
  });
});
