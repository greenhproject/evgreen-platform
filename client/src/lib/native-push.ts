/**
 * Notificaciones push nativas (Capacitor) para iOS y Android.
 * Contraparte nativa de lib/firebase.ts (que solo cubre Web Push/PWA).
 * Se activa únicamente cuando isCapacitorNative() es true.
 */
import { isCapacitorNative, isAndroidNative } from "@/const";

const ANDROID_CHANNEL_ID = "evgreen_notifications";

const NOTIFICATION_TYPE_ROUTES: Record<string, string> = {
  test: "/settings/notifications",
  charging_complete: "/charging-monitor",
  charging_started: "/charging-monitor",
  charging_error: "/charging-monitor",
  overstay_alert: "/overstay",
  low_balance: "/wallet",
  payment_received: "/wallet",
  payment_failed: "/wallet",
  reservation_reminder: "/reservations",
  reservation_confirmed: "/reservations",
  station_available: "/map",
  system_alert: "/settings/notifications",
  general: "/",
};

function getRouteForNotification(data: Record<string, any> | undefined): string {
  if (!data) return "/";
  const explicit = data.clickAction || data.url || data.actionUrl;
  if (typeof explicit === "string" && explicit.startsWith("/")) return explicit;
  const type = data.type || "general";
  return NOTIFICATION_TYPE_ROUTES[type] || "/";
}

interface InitNativePushOptions {
  onToken: (token: string) => void | Promise<void>;
  onForegroundNotification: (title: string, body: string) => void;
  onNotificationTap: (path: string) => void;
}

/**
 * Solicita permiso, registra el dispositivo y engancha los listeners nativos.
 * No-op en web (isCapacitorNative() es false).
 */
export async function initNativePush(options: InitNativePushOptions): Promise<boolean> {
  if (!isCapacitorNative()) return false;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  if (isAndroidNative()) {
    try {
      await PushNotifications.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: "EVGreen",
        description: "Notificaciones de carga, saldo y estaciones",
        importance: 4, // IMPORTANCE_HIGH
        visibility: 1,
        vibration: true,
      });
    } catch (err) {
      console.warn("[NativePush] No se pudo crear el canal de Android:", err);
    }
  }

  const permStatus = await PushNotifications.checkPermissions();
  let granted = permStatus.receive === "granted";

  if (!granted && permStatus.receive !== "denied") {
    const requested = await PushNotifications.requestPermissions();
    granted = requested.receive === "granted";
  }

  if (!granted) {
    console.warn("[NativePush] Permiso de notificaciones denegado");
    return false;
  }

  await PushNotifications.removeAllListeners();

  PushNotifications.addListener("registration", (token) => {
    console.log("[NativePush] Token nativo obtenido");
    options.onToken(token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[NativePush] Error de registro:", err.error);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const title = notification.title || "EVGreen";
    const body = notification.body || "";
    options.onForegroundNotification(title, body);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const path = getRouteForNotification(action.notification.data);
    options.onNotificationTap(path);
  });

  await PushNotifications.register();
  return true;
}

export async function unregisterNativePush(): Promise<void> {
  if (!isCapacitorNative()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.removeAllListeners();
}
