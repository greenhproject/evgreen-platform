/**
 * Web Push Service - Notificaciones push nativas sin Firebase
 * Usa la Web Push API con VAPID keys propias
 */

import webpush from "web-push";
import { env } from "../_core/env";

// Configurar VAPID
const VAPID_PUBLIC_KEY = env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = env.VAPID_PRIVATE_KEY || "";

let webPushInitialized = false;

function initializeWebPush(): boolean {
  if (webPushInitialized) return true;
  
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("[WebPush] VAPID keys not configured - web push disabled");
    return false;
  }

  try {
    webpush.setVapidDetails(
      "mailto:soporte@evgreen.lat",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    webPushInitialized = true;
    console.log("[WebPush] Initialized successfully with VAPID keys");
    return true;
  } catch (error) {
    console.error("[WebPush] Failed to initialize:", error);
    return false;
  }
}

// Inicializar al importar
initializeWebPush();

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WebPushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, string>;
  actions?: Array<{ action: string; title: string }>;
  vibrate?: number[];
  requireInteraction?: boolean;
}

/**
 * Enviar notificación push a una suscripción
 */
export async function sendWebPush(
  subscription: PushSubscriptionData,
  notification: WebPushNotification
): Promise<boolean> {
  if (!initializeWebPush()) {
    console.log("[WebPush] Cannot send - not initialized");
    return false;
  }

  try {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || "/icons/icon-192x192.png",
      badge: notification.badge || "/icons/badge-72x72.png",
      image: notification.image,
      tag: notification.tag || "evgreen-notification",
      data: notification.data || {},
      actions: notification.actions || [],
      vibrate: notification.vibrate || [200, 100, 200],
      requireInteraction: notification.requireInteraction || false,
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      payload,
      {
        TTL: 60 * 60, // 1 hora
        urgency: "high",
      }
    );

    console.log("[WebPush] Notification sent successfully");
    return true;
  } catch (error: any) {
    console.error("[WebPush] Error sending notification:", error.message);
    
    // Si la suscripción expiró o es inválida
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log("[WebPush] Subscription expired or invalid");
      return false;
    }
    
    return false;
  }
}

/**
 * Enviar notificación a múltiples suscripciones
 */
export async function sendWebPushToMultiple(
  subscriptions: PushSubscriptionData[],
  notification: WebPushNotification
): Promise<{ success: number; failure: number; invalidSubscriptions: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendWebPush(sub, notification))
  );

  const invalidSubscriptions: string[] = [];
  let success = 0;
  let failure = 0;

  results.forEach((result, idx) => {
    if (result.status === "fulfilled" && result.value) {
      success++;
    } else {
      failure++;
      invalidSubscriptions.push(subscriptions[idx].endpoint);
    }
  });

  return { success, failure, invalidSubscriptions };
}

export function isWebPushAvailable(): boolean {
  return webPushInitialized;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
