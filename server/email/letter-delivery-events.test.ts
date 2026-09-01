import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { letterEmailEvents, spaceSubmissions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { recordLetterDeliveryEvent } from "./letter-delivery-events";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any, res: { clearCookie: () => undefined } as any };
}

function adminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-email-events", email: "admin@evgreen.lat", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: () => undefined } as any,
  };
}

async function createTrackedLetter() {
  const caller = appRouter.createCaller(publicContext());
  const { submissionId } = await caller.spaces.submit({
    submitterName: "Entrega de correo",
    submitterEmail: "entrega-correo@example.com",
    submitterPhone: "3001234567",
    spaceName: "Espacio prueba de entrega",
    spaceType: "parking",
    address: "Calle 80 # 20-30",
    city: "Bogotá",
  });
  const providerEmailId = `email-${submissionId}-${Date.now()}`;
  const db = await getDb();
  await db!.update(spaceSubmissions).set({
    spaceStatus: "letter_sent",
    letterEmailId: providerEmailId,
    letterDeliveryStatus: "SENT",
    letterDeliveryUpdatedAt: "2026-08-18 10:00:00",
  }).where(eq(spaceSubmissions.id, submissionId));
  return { submissionId, providerEmailId };
}

describe("eventos de entrega de cartas", () => {
  it("guarda un evento, evita duplicados y no retrocede el estado con eventos atrasados", async () => {
    const { submissionId, providerEmailId } = await createTrackedLetter();
    const delivered = await recordLetterDeliveryEvent(`svix-delivered-${submissionId}`, {
      type: "email.delivered",
      created_at: "2026-08-18T10:10:00.000Z",
      data: { email_id: providerEmailId, to: ["entrega-correo@example.com"] },
    });
    expect(delivered).toMatchObject({ recorded: true, submissionId, status: "DELIVERED" });

    const duplicate = await recordLetterDeliveryEvent(`svix-delivered-${submissionId}`, {
      type: "email.delivered",
      created_at: "2026-08-18T10:10:00.000Z",
      data: { email_id: providerEmailId },
    });
    expect(duplicate).toMatchObject({ duplicate: true });

    await recordLetterDeliveryEvent(`svix-sent-late-${submissionId}`, {
      type: "email.sent",
      created_at: "2026-08-18T10:01:00.000Z",
      data: { email_id: providerEmailId },
    });
    const db = await getDb();
    const [submission] = await db!.select({ status: spaceSubmissions.letterDeliveryStatus }).from(spaceSubmissions).where(eq(spaceSubmissions.id, submissionId)).limit(1);
    expect(submission.status).toBe("DELIVERED");
    const rows = await db!.select({ id: letterEmailEvents.id }).from(letterEmailEvents).where(eq(letterEmailEvents.submissionId, submissionId));
    expect(rows).toHaveLength(2);

    const adminCaller = appRouter.createCaller(adminContext());
    const history = await adminCaller.spaces.admin.getLetterDeliveryHistory({ id: submissionId });
    expect(history[0]).toMatchObject({ eventType: "email.delivered", deliveryStatus: "DELIVERED" });
    expect(history[0]).not.toHaveProperty("providerEventId");
    expect(history[0]).not.toHaveProperty("providerEmailId");
  });

  it("ignora eventos de correos que no pertenecen a una carta de intención", async () => {
    const result = await recordLetterDeliveryEvent("svix-unrelated-email", {
      type: "email.bounced",
      created_at: "2026-08-18T11:00:00.000Z",
      data: { email_id: "email-ajeno-a-carta" },
    });
    expect(result).toMatchObject({ recorded: false, ignored: true, reason: "unrelated_email" });
  });
});
