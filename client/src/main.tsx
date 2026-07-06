import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG, COOKIE_NAME, ONE_YEAR_MS, NATIVE_TOKEN_KEY } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { getApiUrl } from "@/lib/utils";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ============================================
// DETECCIÓN DE PLATAFORMA NATIVA
// Capacitor se detecta por la presencia de window.Capacitor
// NO se importa estáticamente para no romper el bundle web
// ============================================

function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

function getNativePlatform(): string {
  if (typeof (window as any).Capacitor === 'undefined') return 'web';
  return (window as any).Capacitor?.getPlatform?.() || 'web';
}

const setAuthCookie = (token: string) => {
  const expires = new Date(Date.now() + ONE_YEAR_MS).toUTCString();
  document.cookie = `${COOKIE_NAME}=${token}; expires=${expires}; path=/; SameSite=Lax`;
  // document.cookie no funciona en custom URL schemes (evgreen://) de WKWebView → localStorage como respaldo
  localStorage.setItem(NATIVE_TOKEN_KEY, token);
};

const extractToken = (urlStr: string): string | null => {
  try {
    return new URL(urlStr).searchParams.get('token');
  } catch {
    return null;
  }
};

// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
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
  if (isNoRedirectPath()) return;

  // On native, navigating WKWebView to the Auth0 login URL causes a black screen
  // because Auth0 eventually redirects to the custom URL scheme (evgreen://).
  // RoleBasedRedirect already handles showing Landing when not authenticated.
  if (isNativePlatform()) return;

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
      url: getApiUrl("/api/trpc"),
      transformer: superjson,
      fetch(input, init) {
        const cookies = document.cookie.split('; ').reduce((prev: any, current) => {
          const [name, ...rest] = current.split('=');
          prev[name] = rest.join('=');
          return prev;
        }, {});
        // localStorage como respaldo cuando document.cookie no funciona en custom URL schemes
        const token = cookies[COOKIE_NAME] || localStorage.getItem(NATIVE_TOKEN_KEY) || '';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers: {
            ...(init?.headers ?? {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    }),
  ],
});

function mountReact() {
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// ============================================
// BOOTSTRAP ASYNC: Capacitor setup ANTES de montar React (solo en nativo)
// En web, monta React directamente sin imports de Capacitor
// ============================================
async function bootstrap() {
  const platform = getNativePlatform();
  const isNative = isNativePlatform();

  if (!isNative) {
    // WEB: montar React directamente, sin ningún import de Capacitor
    mountReact();
    return;
  }

  // NATIVO (iOS/Android): cargar Capacitor dinámicamente
  try {
    // Configurar StatusBar
    if (platform === 'ios' || platform === 'android') {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        if (platform === 'ios') {
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
        await StatusBar.setBackgroundColor({ color: '#052E16' });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (e) {
        console.warn('[StatusBar] setup error:', e);
      }
    }

    // Registrar listener de deep links (appUrlOpen)
    const { App: CapacitorApp } = await import('@capacitor/app');

    CapacitorApp.addListener('appUrlOpen', async (data: { url: string }) => {
      console.log("[Auth] appUrlOpen recibido:", data.url);

      // Wompi payment return: com.greenhproject.evgreen://wallet?payment=wompi&reference=xxx
      if (data.url.includes("payment=wompi")) {
        const refMatch = data.url.match(/reference=([^&]+)/);
        if (refMatch) {
          console.log("[Wompi] Deep link de pago recibido, referencia:", refMatch[1]);
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch {}
          window.location.href = `/wallet?payment=wompi&reference=${refMatch[1]}`;
          return;
        }
      }

      const token = extractToken(data.url);
      if (!token) {
        console.warn("[Auth] appUrlOpen sin token:", data.url);
        return;
      }
      console.log("[Auth] Token recibido vía appUrlOpen:", token.substring(0, 10) + "...");

      // Signal auth change immediately so browserFinished retry timer is cancelled
      window.dispatchEvent(new Event('evgreen-auth-updated'));

      // Close SFSafariViewController
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch (e) {
        console.warn("[Auth] Browser.close error:", e);
      }

      // Exchange token for session cookie via server (sets cookie in WKWebView store)
      let exchangeOk = false;
      try {
        const apiBase = (import.meta.env.VITE_API_URL as string) || window.location.origin;
        const resp = await fetch(`${apiBase}/api/auth/mobile-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        exchangeOk = resp.ok;
        console.log("[Auth] mobile-token exchange:", exchangeOk ? "ok" : "failed");
      } catch (e) {
        console.warn("[Auth] mobile-token POST failed:", e);
      }

      // Fallback: store in localStorage so Authorization: Bearer header works
      if (!exchangeOk) {
        setAuthCookie(token);
      }

      queryClient.invalidateQueries();
    });

    // Verificar deep link de lanzamiento
    try {
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        const token = extractToken(launchUrl.url);
        if (token) {
          // If the user just logged out, skip deep-link re-auth and go straight to login screen
          if (sessionStorage.getItem('evgreen_logout')) {
            sessionStorage.removeItem('evgreen_logout');
            mountReact();
            return;
          }
          setAuthCookie(token);
          // getLaunchUrl() persiste entre recargas — sessionStorage evita el loop infinito
          const sessionKey = 'dl_token_processed';
          const tokenSuffix = token.slice(-12);
          if (sessionStorage.getItem(sessionKey) !== tokenSuffix) {
            console.log("[Auth] Token recibido vía Deep Link (launch):", token.substring(0, 10) + "...");
            sessionStorage.setItem(sessionKey, tokenSuffix);
            window.location.href = "/";
            return; // Page reloads — on next load cookie is already set
          }
          // Segunda carga: cookie ya estaba seteada arriba, React puede montar
        }
      }
    } catch (e) {
      console.warn("[Auth] getLaunchUrl error:", e);
    }
  } catch (e) {
    console.warn("[Capacitor] Error al cargar módulos nativos:", e);
  }

  mountReact();
}

bootstrap();

// ============================================
// POST-MOUNT: Limpiar splash screen
// ============================================
if ((window as any).__evgreenSplashTimeout) {
  clearTimeout((window as any).__evgreenSplashTimeout);
  delete (window as any).__evgreenSplashTimeout;
}
sessionStorage.removeItem('evgreen_recovery');

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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registrado:', registration.scope);

        setInterval(() => registration.update(), 10 * 60 * 1000);

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
