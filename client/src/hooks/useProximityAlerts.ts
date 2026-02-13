/**
 * Hook para alertas de proximidad
 * Envía periódicamente la ubicación del usuario al backend para verificar
 * si hay estaciones cercanas compatibles con precio bajo.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

interface ProximityAlertState {
  isActive: boolean;
  lastCheck: Date | null;
  nearbyStations: number;
  error: string | null;
}

export function useProximityAlerts() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<ProximityAlertState>({
    isActive: false,
    lastCheck: null,
    nearbyStations: 0,
    error: null,
  });

  const proximityPrefs = trpc.push.getProximityPreferences.useQuery(undefined, {
    enabled: !!user,
  });

  const checkProximityMut = trpc.push.checkProximity.useMutation({
    onSuccess: (data) => {
      setState(prev => ({
        ...prev,
        lastCheck: new Date(),
        nearbyStations: data.nearbyCompatibleStations?.length || 0,
        error: null,
      }));
    },
    onError: (error) => {
      setState(prev => ({
        ...prev,
        error: error.message,
      }));
    },
  });

  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: "Geolocalización no soportada" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        checkProximityMut.mutate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        // No mostrar error si el usuario denegó permisos - es esperado
        if (error.code !== error.PERMISSION_DENIED) {
          setState(prev => ({ ...prev, error: "No se pudo obtener ubicación" }));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000, // Aceptar ubicación de hasta 1 minuto
      }
    );
  }, [checkProximityMut]);

  useEffect(() => {
    // Solo activar si: usuario logueado + alertas habilitadas + push habilitado
    const shouldBeActive = !!user && (proximityPrefs.data?.enabled ?? false);

    if (shouldBeActive && !state.isActive) {
      setState(prev => ({ ...prev, isActive: true }));

      // Primera verificación inmediata
      checkLocation();

      // Verificaciones periódicas
      intervalRef.current = setInterval(checkLocation, CHECK_INTERVAL_MS);
    } else if (!shouldBeActive && state.isActive) {
      setState(prev => ({ ...prev, isActive: false }));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, proximityPrefs.data?.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    checkNow: checkLocation,
    isChecking: checkProximityMut.isPending,
  };
}
