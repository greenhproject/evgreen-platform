import { describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("../email/resend-client", () => ({
  getResendClient: async () => ({ emails: { send: sendEmail } }),
}));

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { spaceSubmissions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function adminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-reenvio-carta", email: "admin@evgreen.lat", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: () => undefined } as any,
  };
}

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any, res: { clearCookie: () => undefined } as any };
}

async function createSubmission() {
  const caller = appRouter.createCaller(publicContext());
  return caller.spaces.submit({
    submitterName: "Seguimiento Administrativo",
    submitterEmail: "seguimiento-admin@example.com",
    submitterPhone: "3001234567",
    spaceName: "Espacio para reenvío administrativo",
    spaceType: "parking",
    address: "Calle 72 # 10-20",
    city: "Bogotá",
  });
}

describe("reenvío administrativo de carta", () => {
  it("permite reenviar una carta pendiente, rota el vínculo y reinicia la entrega", async () => {
    sendEmail.mockResolvedValue({ data: { id: "email-admin-reenvio-nuevo" }, error: null });
    const { submissionId } = await createSubmission();
    const db = await getDb();
    await db!.update(spaceSubmissions).set({
      spaceStatus: "letter_sent",
      letterToken: "token-admin-anterior",
      letterEmailId: "email-admin-anterior",
      letterDeliveryStatus: "DELIVERED",
      letterDeliveryUpdatedAt: "2026-08-18 10:00:00",
    }).where(eq(spaceSubmissions.id, submissionId));

    const result = await appRouter.createCaller(adminContext()).spaces.admin.sendLetter({ id: submissionId });
    const [persisted] = await db!.select({
      letterToken: spaceSubmissions.letterToken,
      letterEmailId: spaceSubmissions.letterEmailId,
      letterDeliveryStatus: spaceSubmissions.letterDeliveryStatus,
      letterDeliveryUpdatedAt: spaceSubmissions.letterDeliveryUpdatedAt,
    }).from(spaceSubmissions).where(eq(spaceSubmissions.id, submissionId)).limit(1);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result.emailId).toBe("email-admin-reenvio-nuevo");
    expect(persisted.letterToken).not.toBe("token-admin-anterior");
    expect(persisted.letterToken).toBe(result.acceptUrl.split("/").pop());
    expect(persisted).toMatchObject({ letterEmailId: "email-admin-reenvio-nuevo", letterDeliveryStatus: "SENT" });
    expect(persisted.letterDeliveryUpdatedAt).not.toBe("2026-08-18 10:00:00");
  });

  it("rechaza el reenvío en un estado no elegible sin modificar datos de entrega", async () => {
    const { submissionId } = await createSubmission();
    const db = await getDb();
    await db!.update(spaceSubmissions).set({
      spaceStatus: "pending",
      letterEmailId: "email-debe-conservarse",
      letterDeliveryStatus: "BOUNCED",
      letterDeliveryUpdatedAt: "2026-08-18 11:00:00",
    }).where(eq(spaceSubmissions.id, submissionId));

    await expect(appRouter.createCaller(adminContext()).spaces.admin.sendLetter({ id: submissionId })).rejects.toThrow("Solo se puede enviar o reenviar carta");
    const [persisted] = await db!.select({
      letterEmailId: spaceSubmissions.letterEmailId,
      letterDeliveryStatus: spaceSubmissions.letterDeliveryStatus,
      letterDeliveryUpdatedAt: spaceSubmissions.letterDeliveryUpdatedAt,
    }).from(spaceSubmissions).where(eq(spaceSubmissions.id, submissionId)).limit(1);
    expect(persisted).toMatchObject({ letterEmailId: "email-debe-conservarse", letterDeliveryStatus: "BOUNCED", letterDeliveryUpdatedAt: "2026-08-18 11:00:00" });
  });
});
