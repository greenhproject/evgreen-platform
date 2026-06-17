import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ============================================
// QueryClient con defaults robustos
// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // No reintentar indefinidamente - máximo 2 reintentos
      retry: 2,
      // Timeout de 15 segundos para queries
      staleTime: 30_000,
      // No refetch agresivo que pueda causar loops
      refetchOnWindowFocus: false,
    },
  },
});

// Rutas donde NUNCA se debe redirigir automáticamente a login
const NO_REDIRECT_PATHS = ["/", "/landing", "/partners", "/investors", "/saas", "/gracias-inversionistas", "/postula-tu-espacio", "/cotizacion", "/carta-intencion", "/crowdfunding", "/c/", "/terms", "/privacy", "/contact"];

function isNoRedirectPath(): boolean {
  const path = window.location.pathname;
  return NO_REDIRECT_PATHS.some(p => path === p || path.startsWith(p + "/") || (p.endsWith("/") && path.startsWith(p)));
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // NO redirigir si estamos en una ruta pública o en la landing
  if (isNoRedirectPath()) return;

  // NO redirigir si no hay evidencia de sesión previa (usuario nunca logueado)
  const hadSession = document.cookie.includes('session') || localStorage.getItem('manus-runtime-user-info') !== 'null';
  if (!hadSession) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Agregar AbortController con timeout de 15s para evitar peticiones colgadas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    }),
  ],
});

// ============================================
// MONTAR REACT
// ============================================
createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// ============================================
// POST-MOUNT: Limpiar splash screen
// ============================================
// Cancelar el timeout de auto-recuperación del splash
if ((window as any).__evgreenSplashTimeout) {
  clearTimeout((window as any).__evgreenSplashTimeout);
  delete (window as any).__evgreenSplashTimeout;
}
sessionStorage.removeItem('evgreen_recovery');

// Eliminar splash screen con transición suave
const splashMinTime = 1500;
const splashStart = performance.now();

requestAnimationFrame(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    const elapsed = performance.now() - splashStart;
    const remaining = Math.max(0, splashMinTime - elapsed);
    
    setTimeout(() => {
      splash.style.transition = "opacity 0.6s ease-out";
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 600);
    }, remaining);
  }
});

// ============================================
// ERROR HANDLING: Dynamic imports fallidos
// ============================================
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed')
  ) {
    console.warn('[App] Dynamic import failed, reloading page...');
    // Solo recargar si no lo hicimos recientemente (evitar loop)
    const lastReload = sessionStorage.getItem('evgreen_last_reload');
    const now = Date.now();
    if (lastReload && (now - parseInt(lastReload)) < 15000) return;
    sessionStorage.setItem('evgreen_last_reload', now.toString());
    event.preventDefault();
    globalThis.location.reload();
  }
});

// ============================================
// SERVICE WORKER: Registro simple, sin reload agresivo
// ============================================
if ('serviceWorker' in navigator) {
  // Registrar SW solo después de que la página cargue completamente
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registrado:', registration.scope);
        
        // Verificar actualizaciones periódicamente (cada 10 minutos)
        setInterval(() => registration.update(), 10 * 60 * 1000);
        
        // Cuando hay una actualización, NO recargar automáticamente
        // Solo notificar al usuario la próxima vez que abra la app
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW] Nueva versión disponible. Se aplicará en la próxima visita.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('[SW] Error al registrar:', error);
      });
  });
}
