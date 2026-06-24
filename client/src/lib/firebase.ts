import { getApiUrl } from "./utils";

/**
 * Push Notifications Client - Web Push nativo con VAPID
 * 
 * MÉTODO PRINCIPAL: Web Push API nativa con VAPID keys
 * FALLBACK: Firebase Cloud Messaging (si está configurado)
 * 
 * La Web Push API funciona directamente con el Service Worker,
 * sin necesidad de Firebase en el frontend.
 */

let firebaseApp: any = null;
let messagingInstance: any = null;
let fcmToken: string | null = null;
let firebaseAvailable = false;

// VAPID public key para Web Push nativo
let VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// Firebase config (fallback)
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const hasFirebaseConfig = !!(
  FIREBASE_CONFIG.apiKey &&
  FIREBASE_CONFIG.messagingSenderId &&
  FIREBASE_CONFIG.appId
);

/**
 * Convertir VAPID key de base64 URL-safe a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verificar si el navegador soporta notificaciones push
 */
export function isPushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Verificar si las notificaciones están habilitadas
 */
export function areNotificationsEnabled(): boolean {
  if (!isPushSupported()) return false;
  return Notification.permission === "granted";
}

/**
 * Obtener el estado del permiso de notificaciones
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Solicitar permiso para notificaciones
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[Push] Notificaciones no soportadas en este navegador");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      console.log("[Push] Permiso de notificaciones concedido");
      return true;
    } else {
      console.log("[Push] Permiso de notificaciones denegado:", permission);
      return false;
    }
  } catch (error) {
    console.error("[Push] Error solicitando permiso:", error);
    return false;
  }
}

/**
 * Esperar a que el Service Worker esté listo con timeout
 */
async function waitForServiceWorker(timeoutMs: number = 10000): Promise<ServiceWorkerRegistration | null> {
  try {
    // Primero asegurar que el SW está registrado
    const registrations = await navigator.serviceWorker.getRegistrations();
    let hasActiveSW = false;
    
    for (const reg of registrations) {
      if (reg.active || reg.installing || reg.waiting) {
        hasActiveSW = true;
        break;
      }
    }
    
    if (!hasActiveSW) {
      console.log("[Push] No hay Service Worker registrado, registrando...");
      await navigator.serviceWorker.register("/sw.js");
    }
    
    // Esperar con timeout
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    
    if (!registration) {
      console.error("[Push] Timeout esperando Service Worker ready");
      return null;
    }
    
    return registration;
  } catch (error) {
    console.error("[Push] Error esperando Service Worker:", error);
    return null;
  }
}

/**
 * Obtener suscripción Web Push nativa
 * Retorna la suscripción PushSubscription del Service Worker
 */
export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.log("[Push] No hay VAPID_PUBLIC_KEY configurada");
    return null;
  }

  // Verificar que el permiso está concedido (ya debería estarlo en este punto)
  if (Notification.permission !== "granted") {
    console.log("[Push] Permiso de notificaciones no concedido:", Notification.permission);
    return null;
  }

  try {
    const registration = await waitForServiceWorker();
    if (!registration) {
      console.error("[Push] No se pudo obtener Service Worker registration");
      return null;
    }

    // Verificar si ya hay una suscripción
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log("[Push] Suscripción Web Push existente encontrada");
      return subscription;
    }

    // Crear nueva suscripción
    // IMPORTANTE: Pasar Uint8Array directamente, no .buffer
    // Algunos navegadores tienen problemas con ArrayBuffer
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    console.log("[Push] Creando nueva suscripción Web Push...", {
      keyLength: applicationServerKey.length,
      endpoint: "pushManager.subscribe"
    });
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log("[Push] Nueva suscripción Web Push creada:", subscription.endpoint.substring(0, 50) + "...");
    return subscription;
  } catch (error) {
    console.error("[Push] Error obteniendo suscripción Web Push:", error);
    return null;
  }
}

/**
 * Obtener los datos de suscripción en formato para enviar al backend
 */
export async function getWebPushSubscriptionData(): Promise<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
} | null> {
  const subscription = await getWebPushSubscription();
  if (!subscription) {
    console.log("[Push] No se obtuvo suscripción Web Push");
    return null;
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    console.error("[Push] Suscripción incompleta:", json);
    return null;
  }

  console.log("[Push] Datos de suscripción obtenidos:", {
    endpoint: json.endpoint.substring(0, 50) + "...",
    hasP256dh: !!json.keys.p256dh,
    hasAuth: !!json.keys.auth,
  });

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

/**
 * Obtener token FCM (legacy fallback)
 */
export async function getFCMToken(): Promise<string | null> {
  if (!areNotificationsEnabled()) {
    return null;
  }

  if (fcmToken) {
    return fcmToken;
  }

  if (hasFirebaseConfig) {
    const msg = await getFirebaseMessaging();
    if (msg) {
      try {
        const { getToken } = await import("firebase/messaging");
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

        const token = await getToken(msg, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          fcmToken = token;
          console.log("[Push] Token FCM obtenido:", token.substring(0, 20) + "...");
          return token;
        }
      } catch (error) {
        console.warn("[Push] Error al obtener token FCM:", error);
      }
    }
  }

  return null;
}

/**
 * Inicializar Firebase App (solo si hay credenciales)
 */
export async function initializeFirebaseApp(): Promise<any> {
  if (firebaseApp) return firebaseApp;

  if (!hasFirebaseConfig) {
    return null;
  }

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      firebaseApp = initializeApp(FIREBASE_CONFIG);
    }
    firebaseAvailable = true;
    console.log("[Push] Firebase App inicializada correctamente");
    return firebaseApp;
  } catch (error) {
    console.warn("[Push] Error al inicializar Firebase:", error);
    return null;
  }
}

/**
 * Obtener instancia de Firebase Messaging
 */
async function getFirebaseMessaging(): Promise<any> {
  if (messagingInstance) return messagingInstance;

  const app = await initializeFirebaseApp();
  if (!app || !isPushSupported()) return null;

  try {
    const { getMessaging } = await import("firebase/messaging");
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (error) {
    console.warn("[Push] Error al inicializar Messaging:", error);
    return null;
  }
}

/**
 * Mostrar notificación local usando el Service Worker
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (!areNotificationsEnabled()) {
    return false;
  }

  try {
    const registration = await waitForServiceWorker(5000);
    if (!registration) return false;

    await registration.showNotification(title, {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      vibrate: [100, 50, 100],
      ...options,
    } as NotificationOptions);

    return true;
  } catch (error) {
    console.error("[Push] Error mostrando notificación:", error);
    return false;
  }
}

/**
 * Escuchar mensajes en primer plano
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  if (!isPushSupported()) {
    return () => {};
  }

  // Escuchar mensajes de Firebase si está configurado
  let unsubscribeFirebase: (() => void) | null = null;

  if (hasFirebaseConfig && messagingInstance) {
    import("firebase/messaging")
      .then(({ onMessage }) => {
        if (messagingInstance) {
          unsubscribeFirebase = onMessage(messagingInstance, (payload: any) => {
            console.log("[Push] Mensaje Firebase recibido:", payload);
            callback({
              title: payload.notification?.title || "EVGreen",
              body: payload.notification?.body || "",
              data: payload.data as Record<string, string>,
            });
          });
        }
      })
      .catch(() => {});
  }

  // Escuchar mensajes del Service Worker (funciona siempre para Web Push nativo)
  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === "PUSH_NOTIFICATION") {
      callback({
        title: event.data.title || "EVGreen",
        body: event.data.body || "",
        data: event.data.data,
      });
    }
  };

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", handleMessage);
  }

  return () => {
    if (unsubscribeFirebase) {
      unsubscribeFirebase();
    }
    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    }
  };
}

/**
 * Inicializar sistema de push (Service Worker + Firebase si disponible)
 */
export async function initializeFirebase(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[Push] Notificaciones no soportadas en este navegador");
    return false;
  }

  try {
    // Registrar Service Worker si no está registrado
    const registrations = await navigator.serviceWorker.getRegistrations();
    let hasRegistration = false;

    for (const reg of registrations) {
      // Verificar cualquier estado del SW, no solo active
      const swUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
      if (swUrl && swUrl.includes("sw.js")) {
        hasRegistration = true;
        break;
      }
    }

    if (!hasRegistration) {
      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("[Push] Service Worker registrado, estado:", reg.active?.state || reg.installing?.state || "pending");
    }

    // Inicializar Firebase App si hay credenciales (fallback)
    if (hasFirebaseConfig) {
      await initializeFirebaseApp();
    }

    // Si no tenemos VAPID key del env, intentar obtenerla del servidor
    if (!VAPID_PUBLIC_KEY) {
      try {
        const response = await fetch(getApiUrl("/api/trpc/push.getVapidKey"));
        if (response.ok) {
          const data = await response.json();
          const vapidKey = data?.result?.data?.vapidPublicKey;
          if (vapidKey) {
            VAPID_PUBLIC_KEY = vapidKey;
            console.log("[Push] VAPID key obtenida del servidor");
          }
        }
      } catch (e) {
        console.warn("[Push] No se pudo obtener VAPID key del servidor:", e);
      }
    }

    console.log("[Push] Sistema de push inicializado", {
      webPush: !!VAPID_PUBLIC_KEY,
      vapidKeyLength: VAPID_PUBLIC_KEY.length,
      firebase: hasFirebaseConfig,
    });

    return true;
  } catch (error) {
    console.error("[Push] Error inicializando:", error);
    return false;
  }
}

export default {
  isPushSupported,
  areNotificationsEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  getWebPushSubscription,
  getWebPushSubscriptionData,
  getFCMToken,
  showLocalNotification,
  onForegroundMessage,
  initializeFirebase,
  initializeFirebaseApp,
};
