import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { letterEmailEvents, spaceSubmissions } from "../../drizzle/schema";

export const LETTER_DELIVERY_EVENT_TYPES = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED",
  "email.failed": "FAILED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.complained": "COMPLAINED",
  "email.suppressed": "SUPPRESSED",
} as const;

export type LetterDeliveryStatus = typeof LETTER_DELIVERY_EVENT_TYPES[keyof typeof LETTER_DELIVERY_EVENT_TYPES];

type ResendEmailEvent = {
  type: string;
  created_at: string;
  data?: { email_id?: string; to?: string[] | string };
};

export function getLetterDeliveryStatus(eventType: string): LetterDeliveryStatus | null {
  return LETTER_DELIVERY_EVENT_TYPES[eventType as keyof typeof LETTER_DELIVERY_EVENT_TYPES] ?? null;
}

function isDuplicateEvent(error: unknown) {
  let current: any = error;
  for (let depth = 0; current && depth < 3; depth++, current = current.cause) {
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes("letter_email_events_provider_event_unique") || message.includes("Duplicate entry") || current?.code === "ER_DUP_ENTRY") return true;
  }
  return false;
}

export async function recordLetterDeliveryEvent(providerEventId: string, event: ResendEmailEvent) {
  const status = getLetterDeliveryStatus(event.type);
  const providerEmailId = event.data?.email_id;
  if (!status || !providerEmailId || !providerEventId) return { recorded: false, ignored: true, reason: "unsupported_or_incomplete" };

  const db = (await getDb())!;
  const [submission] = await db.select({
    id: spaceSubmissions.id,
    letterDeliveryUpdatedAt: spaceSubmissions.letterDeliveryUpdatedAt,
  }).from(spaceSubmissions).where(eq(spaceSubmissions.letterEmailId, providerEmailId)).limit(1);
  if (!submission) return { recorded: false, ignored: true, reason: "unrelated_email" };

  const occurredAt = new Date(event.created_at);
  if (Number.isNaN(occurredAt.getTime())) return { recorded: false, ignored: true, reason: "invalid_timestamp" };
  const recipient = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to;

  try {
    await db.insert(letterEmailEvents).values({
      submissionId: submission.id,
      providerEventId,
      providerEmailId,
      eventType: event.type,
      deliveryStatus: status,
      recipientEmail: recipient ?? null,
      occurredAt: occurredAt.toISOString().slice(0, 19).replace("T", " "),
    });
  } catch (error) {
    if (isDuplicateEvent(error)) return { recorded: false, duplicate: true };
    throw error;
  }

  const currentUpdatedAt = submission.letterDeliveryUpdatedAt ? new Date(submission.letterDeliveryUpdatedAt).getTime() : 0;
  if (occurredAt.getTime() >= currentUpdatedAt) {
    await db.update(spaceSubmissions).set({
      letterDeliveryStatus: status,
      letterDeliveryUpdatedAt: occurredAt.toISOString().slice(0, 19).replace("T", " "),
    }).where(eq(spaceSubmissions.id, submission.id));
  }
  return { recorded: true, submissionId: submission.id, status };
}
