import { getBaseUrl } from "./lib/utils";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const isCapacitorNative = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export const getLoginUrl = () => {
  const platformParam = isCapacitorNative() ? '?platform=mobile' : '';
  return `${getBaseUrl()}/api/auth/login${platformParam}`;
};

// En nativo abre SFSafariViewController (el WKWebView principal queda intacto).
// En web hace la navegación normal.
export async function openLoginBrowser(): Promise<void> {
  const url = getLoginUrl();
  console.log("[Auth] openLoginBrowser →", url, "| nativo:", isCapacitorNative());
  if (isCapacitorNative()) {
    const { Browser } = await import('@capacitor/browser');
    // Close any orphaned SFSafariViewController left open from a previous session
    // (e.g., page reloaded during logout while Auth0 browser was still open).
    // Browser.close() on an already-closed browser is a safe no-op.
    try { await Browser.close(); } catch (_) { /* already closed */ }
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.href = url;
  }
}
