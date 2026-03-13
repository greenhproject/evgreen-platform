/**
 * LoadingGuard v2 - Protección contra estados de carga infinitos
 * 
 * Mejoras v2:
 * - Detecta si el servidor está caído (503) y muestra UI específica
 * - Auto-retry con verificación de salud del servidor
 * - Timeout más corto (8s) para detectar problemas rápido
 * - Reintento automático cuando el servidor vuelve a estar disponible
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Wifi, WifiOff, RotateCcw, LogIn, ServerCrash, RefreshCw } from "lucide-react";
import { getLoginUrl } from "@/const";
import { checkServerHealth } from "@/lib/app-health-check";

interface LoadingGuardProps {
  timeoutMs?: number;
  isLoading: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}

type ServerState = 'checking' | 'online' | 'offline' | 'server-down';

export function LoadingGuard({ 
  timeoutMs = 8000, 
  isLoading, 
  onRetry,
  children 
}: LoadingGuardProps) {
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverState, setServerState] = useState<ServerState>('checking');
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const autoRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        console.warn(`[LoadingGuard] Timeout después de ${timeoutMs}ms`);
        // Inmediatamente verificar salud del servidor
        checkServerHealth().then(result => {
          if (!result.healthy) {
            if (!navigator.onLine) {
              setServerState('offline');
            } else {
              setServerState('server-down');
              // Iniciar auto-retry
              startAutoRetry();
            }
          } else {
            setServerState('online');
          }
        });
      }, timeoutMs);
    } else if (!isLoading) {
      setTimedOut(false);
      setRetrying(false);
      setServerState('checking');
      setAutoRetryCount(0);
      retryCountRef.current = 0;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (autoRetryRef.current) {
        clearInterval(autoRetryRef.current);
        autoRetryRef.current = null;
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, timedOut, timeoutMs]);

  // Limpiar auto-retry al desmontar
  useEffect(() => {
    return () => {
      if (autoRetryRef.current) {
        clearInterval(autoRetryRef.current);
        autoRetryRef.current = null;
      }
    };
  }, []);

  // Auto-retry: verificar cada 10s si el servidor vuelve
  const startAutoRetry = useCallback(() => {
    if (autoRetryRef.current) return; // Ya está corriendo
    
    autoRetryRef.current = setInterval(async () => {
      setAutoRetryCount(prev => prev + 1);
      const result = await checkServerHealth();
      
      if (result.healthy) {
        console.log('[LoadingGuard] Servidor disponible de nuevo. Recargando...');
        if (autoRetryRef.current) {
          clearInterval(autoRetryRef.current);
          autoRetryRef.current = null;
        }
        // Servidor está de vuelta - recargar la página
        window.location.reload();
      }
    }, 10000); // Cada 10 segundos
  }, []);

  // Auto-retry cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && timedOut) {
      checkServerHealth().then(result => {
        if (result.healthy) {
          window.location.reload();
        } else {
          setServerState('server-down');
          startAutoRetry();
        }
      });
    }
  }, [isOnline, timedOut, startAutoRetry]);

  const handleRetry = useCallback(() => {
    retryCountRef.current += 1;
    setRetrying(true);
    
    // Limpiar caches del SW
    if ('caches' in window) {
      caches.keys().then(names => 
        Promise.all(names.map(n => caches.delete(n)))
      ).catch(() => {});
    }

    if (onRetry) {
      onRetry();
    }

    // Si después de 3 reintentos sigue fallando, recargar
    if (retryCountRef.current >= 3) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }

    setTimeout(() => {
      setRetrying(false);
    }, 2000);
  }, [onRetry]);

  const handleHardReload = useCallback(() => {
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

  // Si está cargando pero no ha pasado el timeout, mostrar spinner
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

  // ============================================
  // TIMEOUT - Mostrar UI de recuperación según el estado
  // ============================================
  
  // Caso 1: Servidor caído (503)
  if (serverState === 'server-down') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <ServerCrash className="w-8 h-8 text-amber-500" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Servidor en mantenimiento
            </h2>
            <p className="text-sm text-muted-foreground">
              El servidor está reiniciándose. La página se recargará automáticamente cuando esté disponible.
            </p>
          </div>

          {/* Auto-retry indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Verificando cada 10s... (intento {autoRetryCount})</span>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar ahora
            </button>

            <button
              onClick={handleHardReload}
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              Limpiar caché y recargar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Caso 2: Sin conexión
  if (!isOnline || serverState === 'offline') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-500" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Sin conexión a internet
            </h2>
            <p className="text-sm text-muted-foreground">
              Verifica tu conexión WiFi o datos móviles e intenta de nuevo.
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
          </div>
        </div>
      </div>
    );
  }

  // Caso 3: Online pero lento (servidor responde pero auth tarda)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Wifi className="w-8 h-8 text-amber-500" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            La carga está tardando más de lo normal
          </h2>
          <p className="text-sm text-muted-foreground">
            El servidor puede estar experimentando alta demanda. Puedes reintentar o recargar la página.
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
