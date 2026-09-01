import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn(async () => ({ data: { id: "email-reenviado-prueba" }, error: null }));
vi.mock("../email/resend-client", () => ({
  getResendClient: async () => ({ emails: { send: sendEmail } }),
}));

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { spaceSubmissions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function contextFor(role: "comercial" | "user", id: number): TrpcContext {
  return {
    user: { id, openId: `user-${id}`, email: `user-${id}@example.com`, name: `Usuario ${id}`, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: { origin: "https://app.evgreen.lat" }, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any, res: { clearCookie: vi.fn() } as any };
}

describe("seguimiento comercial de cartas", () => {
  beforeEach(() => sendEmail.mockClear());

  async function createAssignedLetter(gestorId = 81001) {
    const publicCaller = appRouter.createCaller(publicContext());
    const { submissionId } = await publicCaller.spaces.submit({
      submitterName: "Contacto Comercial",
      submitterEmail: "contacto-comercial@example.com",
      submitterPhone: "3001234567",
      spaceName: "Espacio seguimiento comercial",
      spaceType: "parking",
      address: "Carrera 20 # 10-20",
      city: "Bogotá",
    });
    const db = await getDb();
    const previousToken = `gestor-old-${submissionId}`;
    await db!.update(spaceSubmissions).set({ gestorId, spaceStatus: "letter_sent", letterToken: previousToken }).where(eq(spaceSubmissions.id, submissionId));
    return { submissionId, previousToken };
  }

  it("permite al gestor asignado reenviar la carta y revoca el token anterior", async () => {
    const { submissionId, previousToken } = await createAssignedLetter();
    const caller = appRouter.createCaller(contextFor("comercial", 81001));

    const result = await caller.gestor.reenviarCartaSeguimiento({ spaceId: submissionId });
    expect(result.revokedPreviousLink).toBe(true);
    expect(result.acceptUrl).not.toContain(previousToken);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const db = await getDb();
    const [persisted] = await db!.select({ letterToken: spaceSubmissions.letterToken }).from(spaceSubmissions).where(eq(spaceSubmissions.id, submissionId)).limit(1);
    expect(persisted.letterToken).toBe(result.acceptUrl.split("/").pop());

    const publicCaller = appRouter.createCaller(publicContext());
    await expect(publicCaller.spaces.acceptLetter({ token: previousToken, signerName: "Firmante Prueba", signerDocument: "123456789" }))
      .rejects.toThrow("Token de carta de intención inválido o expirado");
  });

  it("no expone ni permite gestionar cartas asignadas a otro comercial", async () => {
    const { submissionId } = await createAssignedLetter(81001);
    const foreignCaller = appRouter.createCaller(contextFor("comercial", 81002));

    await expect(foreignCaller.gestor.getCartaSeguimiento({ spaceId: submissionId }))
      .rejects.toThrow("Espacio no disponible para tu seguimiento comercial.");
    await expect(foreignCaller.gestor.rotarCartaSeguimiento({ spaceId: submissionId }))
      .rejects.toThrow("Espacio no disponible para tu seguimiento comercial.");
    await expect(foreignCaller.gestor.reenviarCartaSeguimiento({ spaceId: submissionId }))
      .rejects.toThrow("Espacio no disponible para tu seguimiento comercial.");
  });

  it("no permite al comercial aprobar, editar ni eliminar mediante rutas administrativas", async () => {
    const commercialCaller = appRouter.createCaller(contextFor("comercial", 81001));

    await expect(commercialCaller.spaces.admin.updateStatus({ id: 1, status: "approved" }))
      .rejects.toThrow("Se requiere rol de administrador.");
    await expect(commercialCaller.spaces.admin.updateSpace({ id: 1, spaceName: "Edición no autorizada" }))
      .rejects.toThrow("Se requiere rol de administrador.");
    await expect(commercialCaller.spaces.admin.deleteSpace({ id: 1 }))
      .rejects.toThrow("Se requiere rol de administrador.");
  });
});
