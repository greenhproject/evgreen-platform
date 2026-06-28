export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const isCapacitorNative = (): boolean =>
  typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

export const getLoginUrl = () => {
  const platformParam = isCapacitorNative() ? "?platform=mobile" : "";
  return `${window.location.origin}/api/auth/login${platformParam}`;
};
