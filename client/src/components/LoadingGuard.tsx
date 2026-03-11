/**
 * LoadingGuard - Componente de protección contra estados de carga infinitos
 * 
 * Problema: Si auth.me o cualquier query tarda demasiado o falla silenciosamente,
 * la app se queda mostrando "Cargando..." indefinidamente.
 * 
 * Solución: Después de un timeout configurable, muestra una UI de recuperación
 * que permite al usuario reintentar o continuar sin autenticación.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Wifi, WifiOff, RotateCcw, LogIn } from "lucide-react";
import { getLoginUrl } from "@/const";

interface LoadingGuardProps {
  /** Tiempo máximo de espera en ms antes de mostrar opciones de recuperación */
  timeoutMs?: number;
  /** Si true, está en estado de carga */
  isLoading: boolean;
  /** Función para reintentar la carga */
  onRetry?: () => void;
  /** Contenido a mostrar cuando no está cargando */
  children: React.ReactNode;
}

export function LoadingGuard({ 
  timeoutMs = 10000, 
  isLoading, 
  onRetry,
  children 
}: LoadingGuardProps) {
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // Monitorear estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Timer de timeout
  useEffect(() => {
    if (isLoading && !timedOut) {
      timeoutRef.current = setTimeout(() => {
        setTimedOut(true);
        console.warn(`[LoadingGuard] Timeout después de ${timeoutMs}ms. isOnline=${navigator.onLine}`);
      }, timeoutMs);
    } else if (!isLoading) {
      // Se resolvió la carga, limpiar todo
      setTimedOut(false);
      setRetrying(false);
      retryCountRef.current = 0;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, timedOut, timeoutMs]);

  // Auto-retry cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && timedOut && retryCountRef.current < 3) {
      handleRetry();
    }
  }, [isOnline]);

  const handleRetry = useCallback(() => {
    retryCountRef.current += 1;
    setRetrying(true);
    setTimedOut(false);
    
    // Limpiar caches del SW por si acaso
    if ('caches' in window) {
      caches.keys().then(names => 
        Promise.all(names.map(n => caches.delete(n)))
      ).catch(() => {});
    }

    if (onRetry) {
      onRetry();
    }

    // Si después de 3 reintentos sigue fallando, recargar la página
    if (retryCountRef.current >= 3) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }

    // Dar tiempo para que el retry surta efecto
    setTimeout(() => {
      setRetrying(false);
    }, 2000);
  }, [onRetry]);

  const handleHardReload = useCallback(() => {
    // Limpiar todo y recargar
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => 
        Promise.all(names.map(n => caches.delete(n)))
      ).then(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
          });
        }
        globalThis.location.reload();
      }).catch(() => {
        globalThis.location.reload();
      });
    } else {
      globalThis.location.reload();
    }
  }, []);

  // Si no está cargando, mostrar children normalmente
  if (!isLoading) {
    return <>{children}</>;
  }

  // Si está cargando pero no ha pasado el timeout, mostrar spinner normal
  if (!timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Timeout alcanzado - mostrar UI de recuperación
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        {isOnline ? (
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Wifi className="w-8 h-8 text-amber-500" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-500" />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {isOnline ? "La carga está tardando más de lo normal" : "Sin conexión a internet"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isOnline 
              ? "El servidor puede estar experimentando alta demanda. Puedes reintentar o recargar la página."
              : "Verifica tu conexión a internet e intenta de nuevo."
            }
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? "Reintentando..." : "Reintentar"}
          </button>

          <button
            onClick={handleHardReload}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
          >
            Recargar página completa
          </button>

          <a
            href={getLoginUrl()}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Ir a inicio de sesión
          </a>
        </div>

        {retryCountRef.current > 0 && (
          <p className="text-xs text-muted-foreground">
            Intentos: {retryCountRef.current}/3
          </p>
        )}
      </div>
    </div>
  );
}
