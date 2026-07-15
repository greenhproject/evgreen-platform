import { getBaseUrl } from "./lib/utils";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const isCapacitorNative = (): boolean =>
  typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

export const isAndroidNative = (): boolean =>
  isCapacitorNative() && (window as any).Capacitor?.getPlatform?.() === 'android';

export const getLoginUrl = () => {
  const platformParam = isCapacitorNative() ? "?platform=mobile" : "";
  return `${getBaseUrl()}/api/auth/login${platformParam}`;
};

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
    localStorage.setItem('login_sk', sk);

    const url = getLoginUrl() + `&sk=${sk}`;
    console.log("[Auth] openLoginBrowser →", url);

    const { Browser } = await import('@capacitor/browser');
    try { await Browser.close(); } catch (_) { /* already closed */ }
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.href = getLoginUrl();
  }
}
