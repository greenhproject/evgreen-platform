import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

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
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// Eliminar splash screen con fade-out suave
requestAnimationFrame(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.style.transition = "opacity 0.4s ease-out";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  }
});

// Manejar errores de dynamic import globalmente (para imports fuera del ErrorBoundary)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed')
  ) {
    console.warn('[SW] Dynamic import failed globally, clearing cache and reloading...');
    const lastReload = sessionStorage.getItem('evgreen_last_reload');
    const now = Date.now();
    if (lastReload && (now - parseInt(lastReload)) < 10000) return;
    sessionStorage.setItem('evgreen_last_reload', now.toString());
    event.preventDefault();
    if ('caches' in window) {
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => window.location.reload())
        .catch(() => window.location.reload());
    } else {
      globalThis.location.reload();
    }
  }
});

// Detectar actualizaciones del Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[SW] Nueva versión activada, recargando...');
            // Limpiar cache viejo y recargar
            if ('caches' in window) {
              caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
                .then(() => window.location.reload());
            }
          }
        });
      }
    });
    // Verificar actualizaciones cada 5 minutos
    setInterval(() => registration.update(), 5 * 60 * 1000);
  });
}
