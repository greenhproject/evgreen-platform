/**
 * Firebase Client SDK - Configuración para notificaciones push en el navegador
 * Integración con Firebase Cloud Messaging (FCM)
 * 
 * MODO DUAL:
 * 1. Si las credenciales de Firebase están configuradas → usa FCM real
 * 2. Si no → usa notificaciones locales del Service Worker (funciona en PWA)
 */

let firebaseApp: any = null;
let messagingInstance: any = null;
let fcmToken: string | null = null;
let firebaseAvailable = false;

// Verificar si las credenciales de Firebase están configuradas
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
 * Verificar si el navegador soporta notificaciones push
 */
export function isPushSupported(): boolean {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator
  );
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
 * Inicializar Firebase App (solo si hay credenciales)
 */
export async function initializeFirebaseApp(): Promise<any> {
  if (firebaseApp) return firebaseApp;
  
  if (!hasFirebaseConfig) {
    console.log("[Push] Firebase no configurado - usando notificaciones locales del Service Worker");
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
    console.log("[Push] Firebase Messaging inicializado");
    return messagingInstance;
  } catch (error) {
    console.warn("[Push] Error al inicializar Messaging:", error);
    return null;
  }
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
 * Obtener token FCM o generar token local para el Service Worker
 */
export async function getFCMToken(): Promise<string | null> {
  if (!areNotificationsEnabled()) {
    return null;
  }

  // Retornar token cacheado si existe
  if (fcmToken) {
    return fcmToken;
  }

  // Intentar obtener token de Firebase si está configurado
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
        console.warn("[Push] Error al obtener token FCM, usando fallback local:", error);
      }
    }
  }

  // Fallback: generar token local único para identificar este dispositivo
  // El backend usará este token para enviar notificaciones via el notification system interno
  const storedToken = localStorage.getItem("evgreen_push_token");
  if (storedToken) {
    fcmToken = storedToken;
    return fcmToken;
  }

  // Generar nuevo token local
  const newToken = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("evgreen_push_token", newToken);
  fcmToken = newToken;
  console.log("[Push] Token local generado para notificaciones del SW");
  return fcmToken;
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
    const registration = await navigator.serviceWorker.ready;
    
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
    import("firebase/messaging").then(({ onMessage }) => {
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
    }).catch(() => {});
  }

  // Escuchar mensajes del Service Worker (funciona siempre)
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

  // Retornar función para desuscribirse
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
 * Inicializar Firebase y Service Worker
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
      if (reg.active?.scriptURL.includes("sw.js")) {
        hasRegistration = true;
        break;
      }
    }
    
    if (!hasRegistration) {
      await navigator.serviceWorker.register("/sw.js");
      console.log("[Push] Service Worker registrado");
    }

    // Inicializar Firebase App si hay credenciales
    if (hasFirebaseConfig) {
      await initializeFirebaseApp();
    }

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
  getFCMToken,
  showLocalNotification,
  onForegroundMessage,
  initializeFirebase,
  initializeFirebaseApp,
};
