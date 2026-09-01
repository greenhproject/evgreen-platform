import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { apiWebhooks } from "../../drizzle/schema";
import { getDb } from "../db";

export const WEBHOOK_EVENT_TYPES = ["charging.completed"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

type WebhookSubscription = {
  id: number;
  organizationId: number | null;
  url: string;
  events: unknown;
  secret: string | null;
};

export function isSafeWebhookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !url.hostname) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|0\.)/.test(host)) return false;
    const private172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    return !private172;
  } catch {
    return false;
  }
}

export function filterTenantWebhookSubscriptions(
  subscriptions: WebhookSubscription[],
  organizationId: number,
  eventType: WebhookEventType,
): WebhookSubscription[] {
  return subscriptions.filter((subscription) => {
    const events = Array.isArray(subscription.events)
      ? subscription.events
      : typeof subscription.events === "string"
        ? JSON.parse(subscription.events)
        : [];
    return Number(subscription.organizationId) === Number(organizationId)
      && Array.isArray(events)
      && events.includes(eventType)
      && isSafeWebhookUrl(subscription.url);
  });
}

export async function deliverWebhook(
  subscription: Pick<WebhookSubscription, "url" | "secret">,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const body = JSON.stringify({ event: eventType, occurredAt: new Date().toISOString(), data: payload });
  const signature = subscription.secret
    ? crypto.createHmac("sha256", subscription.secret).update(body).digest("hex")
    : undefined;
  const response = await fetcher(subscription.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "EVGreen-Webhooks/1.0",
      "x-evgreen-event": eventType,
      ...(signature ? { "x-evgreen-signature": `sha256=${signature}` } : {}),
    },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  return response.ok;
}

/**
 * Despacho no bloqueante y acotado a una empresa. Ningún webhook recibe datos
 * de otra organización aunque su propietario pertenezca a ambas empresas.
 */
export async function dispatchOrganizationWebhookEvent(
  organizationId: number | null | undefined,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
  dependencies: { getDatabase?: typeof getDb; fetcher?: typeof fetch } = {},
): Promise<void> {
  if (!organizationId) return;
  const database = await (dependencies.getDatabase ?? getDb)();
  if (!database) return;

  const subscriptions = await database.select({
    id: apiWebhooks.id,
    organizationId: apiWebhooks.organizationId,
    url: apiWebhooks.url,
    events: apiWebhooks.events,
    secret: apiWebhooks.secret,
  }).from(apiWebhooks).where(and(
    eq(apiWebhooks.organizationId, organizationId),
    eq(apiWebhooks.isActive, 1),
  ));

  const targets = filterTenantWebhookSubscriptions(subscriptions, organizationId, eventType);
  await Promise.allSettled(targets.map(async (subscription) => {
    try {
      const delivered = await deliverWebhook(subscription, eventType, payload, dependencies.fetcher);
      if (delivered) {
        await database.update(apiWebhooks).set({
          lastTriggeredAt: new Date().toISOString() as any,
          failCount: 0,
        }).where(eq(apiWebhooks.id, subscription.id));
      } else {
        await database.update(apiWebhooks).set({
          failCount: sql`${apiWebhooks.failCount} + 1`,
        }).where(eq(apiWebhooks.id, subscription.id));
      }
    } catch (error) {
      console.error(`[Webhook] Delivery failed for subscription ${subscription.id}:`, error);
      await database.update(apiWebhooks).set({
        failCount: sql`${apiWebhooks.failCount} + 1`,
      }).where(eq(apiWebhooks.id, subscription.id));
    }
  }));
}
