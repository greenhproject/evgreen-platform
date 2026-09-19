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

export type NativePushResult = "granted" | "denied" | "unavailable";

/**
 * Solicita permiso, registra el dispositivo y engancha los listeners nativos.
 * No-op en web (isCapacitorNative() es false).
 *
 * Todo el cuerpo va envuelto en un try/catch: en dispositivos sin Google Play
 * Services (p. ej. Huawei sin GMS), el SDK nativo de Firebase Cloud Messaging
 * no puede inicializar y cualquiera de estas llamadas puede rechazar la
 * promesa. Eso no es un error de la app ni algo que el usuario pueda resolver,
 * así que se resuelve como "unavailable" en vez de propagar la excepción.
 */
export async function initNativePush(options: InitNativePushOptions): Promise<NativePushResult> {
  if (!isCapacitorNative()) return "unavailable";

  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    if (isAndroidNative()) {
      try {
        await FirebaseMessaging.createChannel({
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

    const permStatus = await FirebaseMessaging.checkPermissions();
    let granted = permStatus.receive === "granted";

    if (!granted && permStatus.receive !== "denied") {
      const requested = await FirebaseMessaging.requestPermissions();
      granted = requested.receive === "granted";
    }

    if (!granted) {
      console.warn("[NativePush] Permiso de notificaciones denegado");
      return "denied";
    }

    // En Android, el SDK de FCM a veces entrega el mensaje directamente a la app
    // (en vez de dejar que el SO lo muestre solo) incluso recién minimizada, por
    // una ventana de gracia de detección de foreground. Cuando eso pasa, si no
    // publicamos nosotros mismos una notificación nativa, el usuario nunca ve
    // nada. Publicamos siempre una notificación local en Android para que quede
    // en la bandeja del sistema igual que en iOS (donde el SO ya lo hace solo).
    if (isAndroidNative()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.requestPermissions().catch(() => {});
      await LocalNotifications.removeAllListeners();
      LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const path = getRouteForNotification(event.notification.extra as Record<string, any> | undefined);
        options.onNotificationTap(path);
      });
    }

    await FirebaseMessaging.removeAllListeners();

    FirebaseMessaging.addListener("tokenReceived", (event) => {
      console.log("[NativePush] Token FCM obtenido");
      options.onToken(event.token);
    });

    FirebaseMessaging.addListener("notificationReceived", (event) => {
      const title = event.notification.title || "EVGreen";
      const body = event.notification.body || "";
      options.onForegroundNotification(title, body);

      if (isAndroidNative()) {
        import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
          LocalNotifications.schedule({
            notifications: [
              {
                id: Date.now() % 2147483647,
                title,
                body,
                channelId: ANDROID_CHANNEL_ID,
                extra: event.notification.data,
                // No necesitamos precisión de alarma (se muestra de inmediato, no
                // agendada a futuro), y una exacta requiere un permiso que en
                // Android 13+ el usuario debe conceder a mano — si la app está
                // minimizada ni siquiera se puede mostrar ese diálogo.
                isExactNotification: false,
              },
            ],
          }).catch((err) => console.warn("[NativePush] No se pudo publicar la notificación local:", err));
        });
      }
    });

    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const path = getRouteForNotification(event.notification.data as Record<string, any> | undefined);
      options.onNotificationTap(path);
    });

    // getToken() resuelve el intercambio APNs -> FCM en iOS internamente y
    // dispara "tokenReceived" (también lo devuelve directo aquí).
    try {
      const { token } = await FirebaseMessaging.getToken();
      options.onToken(token);
    } catch (err) {
      console.error("[NativePush] Error obteniendo el token FCM:", err);
    }

    return "granted";
  } catch (err) {
    console.warn("[NativePush] Push nativo no disponible en este dispositivo (¿sin Google Play Services?):", err);
    return "unavailable";
  }
}

export async function unregisterNativePush(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    await FirebaseMessaging.deleteToken().catch(() => {});
    await FirebaseMessaging.removeAllListeners();

    if (isAndroidNative()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.removeAllListeners();
    }
  } catch (err) {
    console.warn("[NativePush] No se pudo desregistrar el push nativo (¿sin Google Play Services?):", err);
  }
}
