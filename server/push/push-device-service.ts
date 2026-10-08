import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pushDeliveryEvents, pushDevices } from "../../drizzle/schema";

export type NativePushPlatform = "android" | "ios" | "web" | "unknown";
export type PushDeliveryChannel = "FCM" | "WEB_PUSH";
export type PushDeliveryStatus = "REQUESTED" | "ACCEPTED" | "RECEIVED" | "OPENED" | "FAILED";

export function hashPushToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizePlatform(platform?: string): NativePushPlatform {
  if (platform === "android" || platform === "ios" || platform === "web") return platform;
  return "unknown";
}

export async function registerPushDevice(input: {
  userId: number;
  token: string;
  platform?: string;
  appVersion?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date().toISOString();
  const tokenHash = hashPushToken(input.token);
  const platform = normalizePlatform(input.platform);

  await db
    .insert(pushDevices)
    .values({
      userId: input.userId,
      token: input.token,
      tokenHash,
      platform,
      appVersion: input.appVersion?.slice(0, 50) || null,
      status: "ACTIVE",
      registeredAt: now,
      lastSeenAt: now,
      lastErrorCode: null,
      lastErrorAt: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: input.userId,
        token: input.token,
        platform,
        appVersion: input.appVersion?.slice(0, 50) || null,
        status: "ACTIVE",
        lastSeenAt: now,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });

  const [device] = await db
    .select()
    .from(pushDevices)
    .where(eq(pushDevices.tokenHash, tokenHash))
    .limit(1);

  return device ?? null;
}

export async function getActivePushDevicesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pushDevices)
    .where(and(eq(pushDevices.userId, userId), eq(pushDevices.status, "ACTIVE")))
    .orderBy(desc(pushDevices.lastSeenAt));
}

export async function deactivatePushDevice(input: { userId: number; token: string }) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(pushDevices)
    .set({ status: "INACTIVE", lastSeenAt: new Date().toISOString() })
    .where(
      and(
        eq(pushDevices.userId, input.userId),
        eq(pushDevices.tokenHash, hashPushToken(input.token)),
      ),
    );
}

export async function markPushDeviceAccepted(deviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushDevices)
    .set({ lastAcceptedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), lastErrorCode: null, lastErrorAt: null })
    .where(eq(pushDevices.id, deviceId));
}

export async function markPushDeviceFailed(deviceId: number, errorCode?: string) {
  const db = await getDb();
  if (!db) return;
  const invalid = errorCode === "messaging/invalid-registration-token" || errorCode === "messaging/registration-token-not-registered";
  await db
    .update(pushDevices)
    .set({
      status: invalid ? "INVALID" : "ACTIVE",
      lastErrorCode: errorCode?.slice(0, 128) || "UNKNOWN",
      lastErrorAt: new Date().toISOString(),
    })
    .where(eq(pushDevices.id, deviceId));
}

export async function createPushDeliveryEvent(input: {
  deliveryId: string;
  userId: number;
  deviceId?: number | null;
  channel: PushDeliveryChannel;
  notificationType: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(pushDeliveryEvents)
    .values({
      deliveryId: input.deliveryId,
      userId: input.userId,
      deviceId: input.deviceId ?? null,
      channel: input.channel,
      status: "REQUESTED",
      notificationType: input.notificationType,
      requestedAt: new Date().toISOString(),
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "REQUESTED",
        requestedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
      },
    });
}

export async function markPushDeliveryAccepted(input: { deliveryId: string; userId: number; providerMessageId?: string }) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushDeliveryEvents)
    .set({
      status: "ACCEPTED",
      providerMessageId: input.providerMessageId?.slice(0, 255) || null,
      acceptedAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    })
    .where(and(eq(pushDeliveryEvents.deliveryId, input.deliveryId), eq(pushDeliveryEvents.userId, input.userId)));
}

export async function markPushDeliveryFailed(input: { deliveryId: string; userId: number; errorCode?: string; errorMessage?: string }) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushDeliveryEvents)
    .set({
      status: "FAILED",
      errorCode: input.errorCode?.slice(0, 128) || "UNKNOWN",
      errorMessage: input.errorMessage?.slice(0, 2000) || null,
      failedAt: new Date().toISOString(),
    })
    .where(and(eq(pushDeliveryEvents.deliveryId, input.deliveryId), eq(pushDeliveryEvents.userId, input.userId)));
}

/**
 * Sólo el usuario dueño del evento puede confirmar recepción o apertura.
 * "RECEIVED" significa que la app nativa ejecutó el listener; "OPENED" que el
 * usuario tocó la notificación. Ninguno se inventa a partir del ACK de FCM.
 */
export async function acknowledgePushDelivery(input: {
  deliveryId: string;
  userId: number;
  event: "RECEIVED" | "OPENED";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(pushDeliveryEvents)
    .where(and(eq(pushDeliveryEvents.deliveryId, input.deliveryId), eq(pushDeliveryEvents.userId, input.userId)))
    .limit(1);

  if (!existing) return { acknowledged: false, reason: "NOT_FOUND" as const };

  const isAlreadyOpened = existing.status === "OPENED";
  const nextStatus = input.event === "OPENED" || isAlreadyOpened ? "OPENED" : "RECEIVED";
  await db
    .update(pushDeliveryEvents)
    .set({
      status: nextStatus,
      receivedAt: existing.receivedAt || new Date().toISOString(),
      openedAt: nextStatus === "OPENED" ? existing.openedAt || new Date().toISOString() : existing.openedAt,
    })
    .where(eq(pushDeliveryEvents.id, existing.id));

  if (existing.deviceId) {
    await db
      .update(pushDevices)
      .set(nextStatus === "OPENED"
        ? { lastOpenedAt: new Date().toISOString(), lastReceivedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() }
        : { lastReceivedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() })
      .where(eq(pushDevices.id, existing.deviceId));
  }

  return { acknowledged: true, status: nextStatus };
}

export async function getPushDeliveryEvent(input: { deliveryId: string; userId: number }) {
  const db = await getDb();
  if (!db) return null;
  const [event] = await db
    .select()
    .from(pushDeliveryEvents)
    .where(and(eq(pushDeliveryEvents.deliveryId, input.deliveryId), eq(pushDeliveryEvents.userId, input.userId)))
    .limit(1);
  return event ?? null;
}

export function createPushDeliveryId(): string {
  return `push_${crypto.randomUUID().replace(/-/g, "")}`;
}
