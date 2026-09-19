/**
 * Servicio unificado de Push. Envía a cada canal/dispositivo registrado y
 * conserva la diferencia entre proveedor que acepta la orden y app que la
 * recibe o abre. El token histórico users.fcmToken se mantiene sólo como
 * respaldo durante la transición a push_devices.
 */

import { sendWebPush, isWebPushAvailable, type PushSubscriptionData } from "./web-push-service";
import { sendPushNotificationDetailed, type NotificationType, type PushNotificationData } from "../firebase/fcm";
import * as db from "../db";
import {
  createPushDeliveryEvent,
  createPushDeliveryId,
  getActivePushDevicesForUser,
  markPushDeliveryAccepted,
  markPushDeliveryFailed,
  markPushDeviceAccepted,
  markPushDeviceFailed,
} from "./push-device-service";

export interface UnifiedPushPayload {
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  clickAction?: string;
  data?: Record<string, string>;
}

export interface PushChannelAttempt {
  channel: "FCM" | "WEB_PUSH";
  deliveryId: string;
  deviceId?: number;
  accepted: boolean;
  errorCode?: string;
}

export interface UnifiedPushResult {
  accepted: boolean;
  attempted: number;
  acceptedCount: number;
  attempts: PushChannelAttempt[];
}

function buildFcmPayload(payload: UnifiedPushPayload, deliveryId: string): PushNotificationData {
  return {
    type: payload.type,
    title: payload.title,
    body: payload.body,
    imageUrl: payload.imageUrl,
    clickAction: payload.clickAction,
    data: {
      deliveryId,
      type: payload.type,
      ...(payload.data || {}),
    },
  };
}

/**
 * Envía a todos los dispositivos actuales del usuario. `accepted` significa
 * exclusivamente que FCM/Web Push aceptó la solicitud, nunca “entregado”.
 */
export async function sendUserPushDetailed(
  userId: number,
  payload: UnifiedPushPayload,
): Promise<UnifiedPushResult> {
  const attempts: PushChannelAttempt[] = [];

  try {
    const user = await db.getUserById(userId);
    if (!user) {
      console.log(`[UnifiedPush] User ${userId} not found`);
      return { accepted: false, attempted: 0, acceptedCount: 0, attempts };
    }

    // Web Push se mantiene separado de los tokens nativos (FCM).
    if (user.pushSubscription && isWebPushAvailable()) {
      const deliveryId = createPushDeliveryId();
      try {
        await createPushDeliveryEvent({
          deliveryId,
          userId,
          channel: "WEB_PUSH",
          notificationType: payload.type,
        });
        const subscription: PushSubscriptionData = JSON.parse(user.pushSubscription);
        const accepted = await sendWebPush(subscription, {
          title: payload.title,
          body: payload.body,
          image: payload.imageUrl,
          tag: payload.type,
          requireInteraction: ["low_balance", "charging_error", "overstay_alert"].includes(payload.type),
          data: {
            deliveryId,
            type: payload.type,
            url: payload.clickAction || "/",
            clickAction: payload.clickAction || "/",
            ...(payload.data || {}),
          },
        });

        if (accepted) {
          await markPushDeliveryAccepted({ deliveryId, userId });
        } else {
          await markPushDeliveryFailed({ deliveryId, userId, errorCode: "WEB_PUSH_REJECTED" });
        }
        attempts.push({ channel: "WEB_PUSH", deliveryId, accepted, errorCode: accepted ? undefined : "WEB_PUSH_REJECTED" });
      } catch (error: any) {
        await markPushDeliveryFailed({ deliveryId, userId, errorCode: "WEB_PUSH_ERROR", errorMessage: error?.message });
        attempts.push({ channel: "WEB_PUSH", deliveryId, accepted: false, errorCode: "WEB_PUSH_ERROR" });
      }
    }

    const registeredDevices = await getActivePushDevicesForUser(userId);
    const tokens = new Map<string, { id?: number; token: string }>();
    for (const device of registeredDevices) tokens.set(device.token, { id: device.id, token: device.token });
    if (user.fcmToken && !user.fcmToken.startsWith("local_") && !tokens.has(user.fcmToken)) {
      tokens.set(user.fcmToken, { token: user.fcmToken });
    }

    for (const device of tokens.values()) {
      const deliveryId = createPushDeliveryId();
      try {
        await createPushDeliveryEvent({
          deliveryId,
          userId,
          deviceId: device.id,
          channel: "FCM",
          notificationType: payload.type,
        });
        const fcmResult = await sendPushNotificationDetailed(device.token, buildFcmPayload(payload, deliveryId));
        if (fcmResult.accepted) {
          await markPushDeliveryAccepted({ deliveryId, userId, providerMessageId: fcmResult.providerMessageId });
          if (device.id) await markPushDeviceAccepted(device.id);
        } else {
          await markPushDeliveryFailed({
            deliveryId,
            userId,
            errorCode: fcmResult.errorCode,
            errorMessage: fcmResult.errorMessage,
          });
          if (device.id) await markPushDeviceFailed(device.id, fcmResult.errorCode);
        }
        attempts.push({
          channel: "FCM",
          deliveryId,
          deviceId: device.id,
          accepted: fcmResult.accepted,
          errorCode: fcmResult.errorCode,
        });
      } catch (error: any) {
        await markPushDeliveryFailed({ deliveryId, userId, errorCode: "PUSH_ROUTER_ERROR", errorMessage: error?.message });
        if (device.id) await markPushDeviceFailed(device.id, "PUSH_ROUTER_ERROR");
        attempts.push({ channel: "FCM", deliveryId, deviceId: device.id, accepted: false, errorCode: "PUSH_ROUTER_ERROR" });
      }
    }
  } catch (error) {
    console.error(`[UnifiedPush] Error sending Push to user ${userId}:`, error);
  }

  const acceptedCount = attempts.filter((attempt) => attempt.accepted).length;
  return { accepted: acceptedCount > 0, attempted: attempts.length, acceptedCount, attempts };
}

/** Compatibilidad para flujos existentes. */
export async function sendUserPush(userId: number, payload: UnifiedPushPayload): Promise<boolean> {
  return (await sendUserPushDetailed(userId, payload)).accepted;
}

export async function sendUserPushToMultiple(
  userIds: number[],
  payload: UnifiedPushPayload,
): Promise<{ success: number; failure: number }> {
  if (!userIds.length) return { success: 0, failure: 0 };

  const results = await Promise.allSettled(userIds.map((userId) => sendUserPush(userId, payload)));
  let success = 0;
  let failure = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) success++;
    else failure++;
  }
  console.log(`[UnifiedPush] Multicast: ${success} accepted, ${failure} without provider acknowledgement out of ${userIds.length} users`);
  return { success, failure };
}

export type { NotificationType } from "../firebase/fcm";
