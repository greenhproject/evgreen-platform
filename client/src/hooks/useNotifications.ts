/**
 * Hook para manejar notificaciones push en el frontend
 * Usa Web Push nativo (VAPID) como método principal
 * con FCM como fallback si está configurado
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isPushSupported } from "@/lib/firebase";
import { isCapacitorNative } from "@/const";
import { initNativePush, unregisterNativePush } from "@/lib/native-push";
import {
  requestNotificationPermission,
  onForegroundMessage,
  areNotificationsEnabled,
  getNotificationPermission,
  getWebPushSubscriptionData,
  getFCMToken,
  initializeFirebase,
  showLocalNotification,
} from "@/lib/firebase";
import { toast } from "sonner";

interface NotificationPreferences {
  chargingComplete: boolean;
  lowBalance: boolean;
  promotions: boolean;
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default");
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queries y mutations de tRPC
  const preferencesQuery = trpc.push.getPreferences.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const registerSubscriptionMutation = trpc.push.registerSubscription.useMutation();
  const registerTokenMutation = trpc.push.registerToken.useMutation();
  const unregisterTokenMutation = trpc.push.unregisterToken.useMutation();
  const updatePreferencesMutation = trpc.push.updatePreferences.useMutation();
  const sendTestMutation = trpc.push.sendTestNotification.useMutation();

  // Inicializar estado
  useEffect(() => {
    const init = async () => {
      if (isCapacitorNative()) {
        // En nativo el soporte y el permiso se resuelven al activar (enableNotifications),
        // ya que Capacitor no expone el estado sin antes chequear/pedir permisos.
        setIsSupported(true);
        return;
      }

      const supported = isPushSupported();
      setIsSupported(supported);

      if (supported) {
        await initializeFirebase();
        const permission = getNotificationPermission();
        setPermissionStatus(permission);
        setIsEnabled(areNotificationsEnabled());
      } else {
        setPermissionStatus("unsupported");
      }
    };
    init();
  }, []);

  // Actualizar preferencias cuando se cargan
  useEffect(() => {
    if (preferencesQuery.data) {
      setPreferences({
        // @ts-ignore
        chargingComplete: preferencesQuery.data.chargingComplete,
        // @ts-ignore
        lowBalance: preferencesQuery.data.lowBalance,
        // @ts-ignore
        promotions: preferencesQuery.data.promotions,
      });
      setIsEnabled(preferencesQuery.data.pushEnabled);
    }
  }, [preferencesQuery.data]);

  // Escuchar notificaciones en primer plano
  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = onForegroundMessage((payload) => {
      toast.info(payload.title, {
        description: payload.body,
        duration: 5000,
      });
    });

    return unsubscribe;
  }, [isEnabled]);

  // Habilitar notificaciones - Web Push nativo primero, FCM como fallback
  const enableNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("[Push] Iniciando activación de notificaciones...");

      if (!isAuthenticated) {
        toast.error("Debes iniciar sesión para activar notificaciones");
        return;
      }

      // Rama nativa (Capacitor: iOS/Android) — usa el plugin de push nativo en vez de las APIs web
      if (isCapacitorNative()) {
        const nativeRegistered = await initNativePush({
          onToken: async (token) => {
            await registerTokenMutation.mutateAsync({ fcmToken: token });
            console.log("[Push] Token nativo registrado en el servidor");
          },
          onForegroundNotification: (title, body) => {
            toast.info(title, { description: body, duration: 5000 });
          },
          onNotificationTap: (path) => {
            window.location.href = path;
          },
        });

        setPermissionStatus(nativeRegistered ? "granted" : "denied");

        if (nativeRegistered) {
          setIsEnabled(true);
          toast.success("Notificaciones push activadas correctamente");
          preferencesQuery.refetch();
        } else {
          toast.error("Permiso de notificaciones denegado. Revisa la configuración de tu dispositivo.");
          setError("Permiso denegado");
        }
        return;
      }

      const granted = await requestNotificationPermission();
      setPermissionStatus(getNotificationPermission());

      if (!granted) {
        toast.error("Permiso de notificaciones denegado. Revisa la configuración de tu navegador.");
        setError("Permiso denegado");
        return;
      }

      console.log("[Push] Permiso concedido...");

      let registered = false;

      // 1. Intentar Web Push nativo (VAPID)
      try {
        console.log("[Push] Intentando Web Push nativo...");
        const subscriptionData = await getWebPushSubscriptionData();
        
        if (subscriptionData) {
          console.log("[Push] Suscripción obtenida, registrando en servidor...");
          await registerSubscriptionMutation.mutateAsync({
            subscription: subscriptionData,
          });
          registered = true;
          console.log("[Push] Registrado con Web Push nativo exitosamente");
        } else {
          console.warn("[Push] No se pudo obtener suscripción Web Push (subscriptionData es null)");
        }
      } catch (webPushError) {
        console.warn("[Push] Web Push nativo falló:", webPushError);
      }

      // 2. Fallback: FCM
      if (!registered) {
        try {
          console.log("[Push] Intentando FCM como fallback...");
          const token = await getFCMToken();
          if (token) {
            await registerTokenMutation.mutateAsync({ fcmToken: token });
            registered = true;
            console.log("[Push] Registrado con FCM");
          } else {
            console.warn("[Push] No se pudo obtener token FCM");
          }
        } catch (fcmError) {
          console.warn("[Push] FCM también falló:", fcmError);
        }
      }

      if (registered) {
        setIsEnabled(true);
        toast.success("Notificaciones push activadas correctamente");
        preferencesQuery.refetch();
      } else {
        // Intentar mostrar una notificación local como último recurso
        // para verificar que al menos las notificaciones del navegador funcionan
        const localShown = await showLocalNotification("EVGreen - Notificaciones", {
          body: "Las notificaciones locales están funcionando. La suscripción push se completará cuando el servidor esté disponible.",
          tag: "push-setup",
        });
        
        if (localShown) {
          toast.info("Notificaciones locales activadas. Las notificaciones push se sincronizarán pronto.");
          setIsEnabled(true);
        } else {
          toast.error("No se pudieron activar las notificaciones. Intenta de nuevo.");
          setError("Error al registrar suscripción");
        }
      }
    } catch (err) {
      console.error("Error enabling notifications:", err);
      toast.error("Error al activar notificaciones");
      setError("Error inesperado");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, registerSubscriptionMutation, registerTokenMutation, preferencesQuery]);

  // Deshabilitar notificaciones
  const disableNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        await unregisterTokenMutation.mutateAsync();
      }
      await unregisterNativePush();
      setIsEnabled(false);
      toast.success("Notificaciones desactivadas");
      preferencesQuery.refetch();
    } catch (err) {
      console.error("Error disabling notifications:", err);
      toast.error("Error al desactivar notificaciones");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, unregisterTokenMutation, preferencesQuery]);

  // Actualizar preferencias
  const updatePreferences = useCallback(
    async (newPrefs: Partial<NotificationPreferences>) => {
      try {
        await updatePreferencesMutation.mutateAsync(newPrefs);
        setPreferences((prev) => (prev ? { ...prev, ...newPrefs } : null));
        toast.success("Preferencias actualizadas");
      } catch (err) {
        console.error("Error updating preferences:", err);
        toast.error("Error al actualizar preferencias");
      }
    },
    [updatePreferencesMutation]
  );

  // Enviar notificación de prueba
  const sendTestNotification = useCallback(async () => {
    try {
      const result = await sendTestMutation.mutateAsync();
      if (result.success) {
        toast.success("Notificación de prueba enviada");
      } else {
        // Fallback: mostrar notificación local
        await showLocalNotification("Notificación de prueba - EVGreen", {
          body: `¡Hola ${user?.name || "Usuario"}! Las notificaciones están funcionando.`,
          tag: "test-notification",
        });
        toast.info("Notificación local mostrada como fallback");
      }
    } catch (err) {
      console.error("Error sending test notification:", err);
      // Intentar notificación local
      try {
        await showLocalNotification("Notificación de prueba - EVGreen", {
          body: "Las notificaciones locales están funcionando.",
          tag: "test-notification",
        });
        toast.info("Notificación local mostrada");
      } catch {
        toast.error("Error al enviar notificación de prueba");
      }
    }
  }, [sendTestMutation, user]);

  return {
    isSupported,
    isEnabled,
    isLoading,
    permissionStatus,
    preferences,
    error,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    sendTestNotification,
  };
}

export default useNotifications;
