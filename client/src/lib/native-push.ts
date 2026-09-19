/**
 * Notificaciones Push nativas para iOS y Android. Reporta al backend la
 * recepción y apertura sólo cuando la app realmente observa dichos eventos.
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
  return NOTIFICATION_TYPE_ROUTES[data.type || "general"] || "/";
}

interface InitNativePushOptions {
  onToken: (token: string) => void | Promise<void>;
  onForegroundNotification: (title: string, body: string) => void;
  onNotificationTap: (path: string) => void;
  onDeliveryEvent: (deliveryId: string, event: "RECEIVED" | "OPENED") => void | Promise<void>;
}

function reportDeliveryEvent(
  data: Record<string, any> | undefined,
  event: "RECEIVED" | "OPENED",
  options: InitNativePushOptions,
) {
  const deliveryId = data?.deliveryId;
  if (typeof deliveryId !== "string" || deliveryId.length < 10) return;
  void Promise.resolve(options.onDeliveryEvent(deliveryId, event)).catch((error) => {
    console.warn("[NativePush] No se pudo confirmar el estado Push:", error);
  });
}

/**
 * Solicita permisos, registra el token FCM y engancha listeners nativos. El
 * resultado true exige permiso + token real: un permiso concedido sin token no
 * se anuncia como Push operativo.
 */
export async function initNativePush(options: InitNativePushOptions): Promise<boolean> {
  if (!isCapacitorNative()) return false;

  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    if (isAndroidNative()) {
      try {
        await FirebaseMessaging.createChannel({
          id: ANDROID_CHANNEL_ID,
          name: "EVGreen",
          description: "Notificaciones de carga, saldo y estaciones",
          importance: 4,
          visibility: 1,
          vibration: true,
        });
      } catch (error) {
        console.warn("[NativePush] No se pudo crear el canal de Android:", error);
      }
    }

    const current = await FirebaseMessaging.checkPermissions();
    let granted = current.receive === "granted";
    if (!granted && current.receive !== "denied") {
      const requested = await FirebaseMessaging.requestPermissions();
      granted = requested.receive === "granted";
    }
    if (!granted) return false;

    if (isAndroidNative()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.requestPermissions().catch(() => undefined);
      await LocalNotifications.removeAllListeners();
      LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const data = event.notification.extra as Record<string, any> | undefined;
        reportDeliveryEvent(data, "OPENED", options);
        options.onNotificationTap(getRouteForNotification(data));
      });
    }

    await FirebaseMessaging.removeAllListeners();
    FirebaseMessaging.addListener("tokenReceived", (event) => {
      void Promise.resolve(options.onToken(event.token)).catch((error) => {
        console.warn("[NativePush] No se pudo sincronizar el token renovado:", error);
      });
    });

    FirebaseMessaging.addListener("notificationReceived", (event) => {
      const data = event.notification.data as Record<string, any> | undefined;
      const title = event.notification.title || "EVGreen";
      const body = event.notification.body || "";
      reportDeliveryEvent(data, "RECEIVED", options);
      options.onForegroundNotification(title, body);

      // Android puede entregar mensajes data directamente al listener cuando
      // la app está visible. Publicamos una local para garantizar bandeja y
      // sonido; en background una notificación FCM la muestra el sistema.
      if (isAndroidNative()) {
        import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
          LocalNotifications.schedule({
            notifications: [{
              id: Date.now() % 2147483647,
              title,
              body,
              channelId: ANDROID_CHANNEL_ID,
              extra: data,
              isExactNotification: false,
            }],
          }).catch((error) => console.warn("[NativePush] No se pudo publicar la notificación local:", error));
        });
      }
    });

    FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const data = event.notification.data as Record<string, any> | undefined;
      reportDeliveryEvent(data, "OPENED", options);
      options.onNotificationTap(getRouteForNotification(data));
    });

    try {
      const { token } = await FirebaseMessaging.getToken();
      await options.onToken(token);
      return true;
    } catch (error) {
      console.error("[NativePush] Error obteniendo el token FCM:", error);
      return false;
    }
  } catch (error) {
    console.warn("[NativePush] Push nativo no disponible en este dispositivo:", error);
    return false;
  }
}

export async function unregisterNativePush(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    await FirebaseMessaging.deleteToken().catch(() => undefined);
    await FirebaseMessaging.removeAllListeners();
    if (isAndroidNative()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.removeAllListeners();
    }
  } catch (error) {
    console.warn("[NativePush] No se pudo desregistrar Push nativo:", error);
  }
}
