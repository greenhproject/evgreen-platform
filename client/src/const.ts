import { getBaseUrl } from "./lib/utils";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const NATIVE_LOGIN_SESSION_KEY = "login_sk";
export const NATIVE_LOGIN_ACTIVE_KEY = "evgreen_native_login_active";

export const isCapacitorNative = (): boolean =>
  typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

export const isAndroidNative = (): boolean =>
  isCapacitorNative() && (window as any).Capacitor?.getPlatform?.() === 'android';

export const getLoginUrl = () => {
  const platformParam = isCapacitorNative() ? "?platform=mobile" : "";
  return `${getBaseUrl()}/api/auth/login${platformParam}`;
};

export function clearNativeLoginAttempt(sessionKey?: string | null) {
  if (!sessionKey || localStorage.getItem(NATIVE_LOGIN_SESSION_KEY) === sessionKey) {
    localStorage.removeItem(NATIVE_LOGIN_SESSION_KEY);
  }
  if (!sessionKey || sessionStorage.getItem(NATIVE_LOGIN_ACTIVE_KEY) === sessionKey) {
    sessionStorage.removeItem(NATIVE_LOGIN_ACTIVE_KEY);
  }
}

// En nativo abre SFSafariViewController (el WKWebView principal queda intacto).
// En web hace la navegación normal.
export async function openLoginBrowser(): Promise<void> {
  if (isCapacitorNative()) {
    // Generate a session key so the server can store the token server-side and
    // the app can claim it via /api/auth/claim once the CCT closes.
    // This avoids relying on deep links (Chrome 83+ blocks script-initiated
    // navigation to custom URL schemes from CCT).
    const sk = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(NATIVE_LOGIN_SESSION_KEY, sk);
    // Un browserFinished tardío de Wallet o de un intento anterior no debe
    // consumir esta llave mientras la nueva Custom Tab aún se está abriendo.
    sessionStorage.removeItem(NATIVE_LOGIN_ACTIVE_KEY);

    const url = getLoginUrl() + `&sk=${sk}`;
    console.log("[Auth] openLoginBrowser →", url);

    const { Browser } = await import('@capacitor/browser');
    try {
      // No cerrar preventivamente: en Android el cierre es asíncrono y puede
      // disparar browserFinished sobre la llave recién creada, dejando la UI
      // en "Iniciando sesión…" antes de que Auth0 se abra.
      await Browser.open({ url, presentationStyle: 'popover' });
      sessionStorage.setItem(NATIVE_LOGIN_ACTIVE_KEY, sk);
    } catch (error) {
      clearNativeLoginAttempt(sk);
      throw error;
    }
  } else {
    window.location.href = getLoginUrl();
  }
}
