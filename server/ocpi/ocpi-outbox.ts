import { eq, sql } from "drizzle-orm";
import { ocpiOutboxEvents } from "../../drizzle/schema";

export type OcpiOutboxEventType = "LOCATION_UPSERT" | "TARIFF_UPSERT" | "SESSION_UPSERT" | "EVSE_STATUS";

export type StageOcpiEventInput = {
  eventType: OcpiOutboxEventType;
  organizationId?: number | null;
  stationId?: number | null;
  dedupeKey: string;
  payload: Record<string, unknown>;
};

/**
 * Guarda el estado más reciente de un recurso OCPI. No realiza solicitudes de red:
 * el envío real se habilitará únicamente después del onboarding y certificación SIEM.
 */
export async function stageOcpiEvent(db: any, input: StageOcpiEventInput) {
  const now = new Date().toISOString();
  await db.insert(ocpiOutboxEvents).values({
    scope: "SIEM",
    eventType: input.eventType,
    organizationId: input.organizationId ?? null,
    stationId: input.stationId ?? null,
    dedupeKey: input.dedupeKey,
    payload: input.payload,
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    sentAt: null,
  } as any).onDuplicateKeyUpdate({
    set: {
      organizationId: input.organizationId ?? null,
      stationId: input.stationId ?? null,
      payload: input.payload,
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: null,
      lastError: null,
      sentAt: null,
      updatedAt: now,
    } as any,
  });
  return { staged: true, externalRequest: false };
}

export function getLocationDedupeKey(stationId: number) {
  return `SIEM:LOCATION_UPSERT:station:${stationId}`;
}

export function sanitizeOcpiOutboxError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Error de sincronización OCPI");
  return message
    .replace(/\b(Bearer|Token)\s+[^\s,;]+/gi, "$1 [REDACTED]")
    .replace(/([?&](?:token|api[_-]?key|authorization)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 500);
}

/**
 * Registra el resultado de un intento futuro de despacho. Esta función no envía
 * nada por red; el adaptador certificado la invocará una vez obtenga respuesta.
 */
export async function recordOcpiOutboxAttempt(db: any, input: { id: number; success: boolean; terminal?: boolean; error?: unknown }) {
  const now = new Date().toISOString();
  const status = input.success ? "SENT" : input.terminal ? "DEAD" : "FAILED";
  const lastError = input.success ? null : sanitizeOcpiOutboxError(input.error);
  await db.update(ocpiOutboxEvents).set({
    status,
    attemptCount: sql`${ocpiOutboxEvents.attemptCount} + 1`,
    nextAttemptAt: null,
    lastError,
    sentAt: input.success ? now : null,
    updatedAt: now,
  } as any).where(eq(ocpiOutboxEvents.id, input.id));
  return { status, externalRequest: false };
}
