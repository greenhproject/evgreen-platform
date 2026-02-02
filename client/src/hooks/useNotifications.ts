/**
 * Hook para manejar notificaciones push en el frontend
 * Integra con Firebase y el backend de EVGreen
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isPushSupported } from "@/lib/firebase";
import {
  requestNotificationPermission,
  onForegroundMessage,
  areNotificationsEnabled,
  getNotificationPermission,
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

  const registerTokenMutation = trpc.push.registerToken.useMutation();
  const unregisterTokenMutation = trpc.push.unregisterToken.useMutation();
  const updatePreferencesMutation = trpc.push.updatePreferences.useMutation();
  const sendTestMutation = trpc.push.sendTestNotification.useMutation();

  // Inicializar estado
  useEffect(() => {
    const init = async () => {
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
        chargingComplete: preferencesQuery.data.chargingComplete,
        lowBalance: preferencesQuery.data.lowBalance,
        promotions: preferencesQuery.data.promotions,
      });
      setIsEnabled(preferencesQuery.data.pushEnabled);
    }
  }, [preferencesQuery.data]);

  // Escuchar notificaciones en primer plano
  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Mostrar toast cuando llega una notificación en primer plano
      toast.info(payload.title, {
        description: payload.body,
        duration: 5000,
      });
    });

    return unsubscribe;
  }, [isEnabled]);

  // Habilitar notificaciones
  const enableNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const granted = await requestNotificationPermission();
      setPermissionStatus(getNotificationPermission());

      if (granted) {
        const token = await getFCMToken();
        
        if (token && isAuthenticated) {
          await registerTokenMutation.mutateAsync({ fcmToken: token });
          setIsEnabled(true);
          toast.success("Notificaciones activadas");
          preferencesQuery.refetch();
        }
      } else {
        toast.error("Permiso de notificaciones denegado");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Error al activar notificaciones");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, registerTokenMutation, preferencesQuery]);

  // Deshabilitar notificaciones
  const disableNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        await unregisterTokenMutation.mutateAsync();
      }
      setIsEnabled(false);
      toast.success("Notificaciones desactivadas");
      preferencesQuery.refetch();
    } catch (error) {
      console.error("Error disabling notifications:", error);
      toast.error("Error al desactivar notificaciones");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, unregisterTokenMutation, preferencesQuery]);

  // Actualizar preferencias
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      await updatePreferencesMutation.mutateAsync(newPrefs);
      setPreferences((prev) => prev ? { ...prev, ...newPrefs } : null);
      toast.success("Preferencias actualizadas");
    } catch (error) {
      console.error("Error updating preferences:", error);
      toast.error("Error al actualizar preferencias");
    }
  }, [updatePreferencesMutation]);

  // Enviar notificación de prueba
  const sendTestNotification = useCallback(async () => {
    try {
      const result = await sendTestMutation.mutateAsync();
      if (result.success) {
        toast.success("Notificación de prueba enviada");
      } else {
        // Mostrar notificación local como fallback
        await showLocalNotification("Notificación de prueba", {
          body: `¡Hola ${user?.name || "Usuario"}! Las notificaciones están funcionando.`,
          tag: "test-notification",
        });
        toast.info("Notificación local mostrada");
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      // Intentar notificación local
      await showLocalNotification("Notificación de prueba", {
        body: "Las notificaciones locales están funcionando.",
        tag: "test-notification",
      });
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
