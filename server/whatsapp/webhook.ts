import crypto from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { whatsappConfig, whatsappNotificationLog } from "../../drizzle/schema";
import { getDb } from "../db";

type MetaMessageStatus = "sent" | "delivered" | "read" | "failed";

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }>;
        }>;
      };
    }>;
  }>;
};

function safeEqual(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function parseStatus(value: string | undefined): MetaMessageStatus | null {
  const normalized = String(value || "").toLowerCase();
  return normalized === "sent" || normalized === "delivered" || normalized === "read" || normalized === "failed"
    ? normalized
    : null;
}

function getFailureMessage(status: { errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }> }): string | null {
  const error = status.errors?.[0];
  if (!error) return null;
  return error.error_data?.details || error.message || error.title || "Meta no entregó el mensaje";
}

/**
 * Meta verifies this route once through the challenge handshake. The verification
 * token is configured by an administrator and is never exposed by the API.
 */
export async function verifyWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const database = await getDb();
  if (!database) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }
  const [cfg] = await database.select().from(whatsappConfig).where(eq(whatsappConfig.id, 1)).limit(1);
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");
  if (mode === "subscribe" && challenge && cfg?.verifyToken && safeEqual(token, cfg.verifyToken)) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ error: "Invalid webhook verification" });
}

/**
 * Processes only signed `messages` status callbacks. A 200 response makes
 * retries safe; updates are idempotent by Meta's `wamid` message identifier.
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = typeof req.body === "string" ? req.body : "";
  const signature = String(req.get("x-hub-signature-256") || "");
  const database = await getDb();
  if (!database) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }
  const [cfg] = await database.select().from(whatsappConfig).where(eq(whatsappConfig.id, 1)).limit(1);
  if (!cfg?.appSecret || !signature.startsWith("sha256=")) {
    res.status(401).json({ error: "Webhook signature is not configured" });
    return;
  }

  const expectedSignature = `sha256=${crypto.createHmac("sha256", cfg.appSecret).update(rawBody, "utf8").digest("hex")}`;
  if (!safeEqual(signature, expectedSignature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  if (payload.object !== "whatsapp_business_account") {
    res.status(200).json({ ok: true, ignored: "unsupported_object" });
    return;
  }

  let updates = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (cfg.phoneNumberId && phoneNumberId && cfg.phoneNumberId !== phoneNumberId) continue;
      for (const statusPayload of change.value?.statuses ?? []) {
        if (!statusPayload.id) continue;
        const status = parseStatus(statusPayload.status);
        if (!status) continue;
        await database.update(whatsappNotificationLog).set({
          status,
          ...(status === "failed" && { errorMessage: getFailureMessage(statusPayload) || "Meta reportó un fallo de entrega" }),
        } as any).where(and(
          eq(whatsappNotificationLog.wamid, statusPayload.id),
          inArray(whatsappNotificationLog.status, ["sent", "delivered", "read", "failed"]),
        ));
        updates++;
      }
    }
  }

  res.status(200).json({ ok: true, updates });
}
