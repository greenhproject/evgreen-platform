/**
 * Firebase Client SDK - Configuración para notificaciones push en el navegador
 * Integración con Firebase Cloud Messaging (FCM)
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from "firebase/messaging";

// Configuración de Firebase para el cliente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "evgreen-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Estado de Firebase
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let fcmToken: string | null = null;

/**
 * Verificar si el navegador soporta notificaciones push
 */
export function isPushSupported(): boolean {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Verificar si las notificaciones están habilitadas
 */
export function areNotificationsEnabled(): boolean {
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
 * Inicializar Firebase App
 */
export function initializeFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  
  // Verificar si ya hay una app inicializada
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  // Verificar que las credenciales estén configuradas
  if (!firebaseConfig.projectId || !firebaseConfig.messagingSenderId) {
    console.log("[Firebase] Credenciales no configuradas - usando notificaciones locales");
    return null;
  }

  try {
    app = initializeApp(firebaseConfig);
    console.log("[Firebase] App inicializada correctamente");
    return app;
  } catch (error) {
    console.error("[Firebase] Error al inicializar:", error);
    return null;
  }
}

/**
 * Obtener instancia de Firebase Messaging
 */
export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;

  const firebaseApp = initializeFirebaseApp();
  if (!firebaseApp) return null;

  if (!isPushSupported()) {
    console.log("[Firebase] Push no soportado en este navegador");
    return null;
  }

  try {
    messaging = getMessaging(firebaseApp);
    console.log("[Firebase] Messaging inicializado");
    return messaging;
  } catch (error) {
    console.error("[Firebase] Error al inicializar Messaging:", error);
    return null;
  }
}

/**
 * Solicitar permiso para notificaciones
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[Firebase] Push notifications not supported");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      console.log("[Firebase] Notification permission granted");
      return true;
    } else {
      console.log("[Firebase] Notification permission denied");
      return false;
    }
  } catch (error) {
    console.error("[Firebase] Error requesting permission:", error);
    return false;
  }
}

/**
 * Obtener token FCM
 */
export async function getFCMToken(): Promise<string | null> {
  if (!areNotificationsEnabled()) {
    return null;
  }

  // Retornar token cacheado si existe
  if (fcmToken) {
    return fcmToken;
  }

  // Intentar obtener token de Firebase
  const messagingInstance = getFirebaseMessaging();
  
  if (messagingInstance) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
      
      const token = await getToken(messagingInstance, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        fcmToken = token;
        console.log("[Firebase] Token FCM obtenido:", token.substring(0, 20) + "...");
        return token;
      }
    } catch (error) {
      console.error("[Firebase] Error al obtener token FCM:", error);
    }
  }

  // Fallback: generar token local basado en push subscription
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
      ) as BufferSource,
    });
    
    fcmToken = btoa(subscription.endpoint).slice(0, 64);
    console.log("[Firebase] Token local generado");
    return fcmToken;
  } catch (error) {
    // Si falla la suscripción push, generar un token local único
    fcmToken = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log("[Firebase] Token local de respaldo generado");
    return fcmToken;
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
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(title, {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      vibrate: [100, 50, 100],
      ...options,
    } as NotificationOptions);
    
    return true;
  } catch (error) {
    console.error("[Firebase] Error showing notification:", error);
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
  const messagingInstance = getFirebaseMessaging();
  let unsubscribeFirebase: (() => void) | null = null;
  
  if (messagingInstance) {
    unsubscribeFirebase = onMessage(messagingInstance, (payload: MessagePayload) => {
      console.log("[Firebase] Mensaje recibido:", payload);
      callback({
        title: payload.notification?.title || "EVGreen",
        body: payload.notification?.body || "",
        data: payload.data as Record<string, string>,
      });
    });
  }

  // También escuchar mensajes del Service Worker
  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === "PUSH_NOTIFICATION") {
      callback({
        title: event.data.title || "EVGreen",
        body: event.data.body || "",
        data: event.data.data,
      });
    }
  };

  navigator.serviceWorker.addEventListener("message", handleMessage);

  // Retornar función para desuscribirse
  return () => {
    if (unsubscribeFirebase) {
      unsubscribeFirebase();
    }
    navigator.serviceWorker.removeEventListener("message", handleMessage);
  };
}

/**
 * Inicializar Firebase y Service Worker
 */
export async function initializeFirebase(): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[Firebase] Push not supported in this browser");
    return false;
  }

  try {
    // Registrar Service Worker si no está registrado
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[Firebase] Service Worker registered:", registration.scope);

    // Inicializar Firebase App
    initializeFirebaseApp();

    return true;
  } catch (error) {
    console.error("[Firebase] Error initializing:", error);
    return false;
  }
}

/**
 * Convertir VAPID key de base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
  getFirebaseMessaging,
};
