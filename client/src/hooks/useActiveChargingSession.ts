/**
 * Hook para detectar si el usuario tiene una sesión de carga activa.
 * Se usa en el layout y en la redirección inicial para llevar al usuario
 * de vuelta al monitor de carga cuando cierra y reabre la app.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useActiveChargingSession() {
  const { user, isAuthenticated } = useAuth();

  const { data: session, isLoading, refetch } = trpc.charging.getActiveSession.useQuery(
    undefined,
    {
      enabled: !!isAuthenticated && !!user && user.role === "user",
      // Polling cada 30s para detectar cambios (no tan frecuente como el monitor)
      refetchInterval: 30000,
      // No mostrar errores al usuario si falla
      retry: 1,
      // Mantener datos previos mientras se recarga
      staleTime: 10000,
    }
  );

  const hasActiveSession = !isLoading && !!session && session.transactionId > 0;
  const isCharging = hasActiveSession && session?.status !== "COMPLETED";

  return {
    hasActiveSession: isCharging,
    session: isCharging ? session : null,
    isLoading,
    refetch,
  };
}
