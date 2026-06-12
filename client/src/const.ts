import { getBaseUrl } from "./lib/utils";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate login URL - detecta si estamos en Capacitor/Móvil para usar el flujo nativo
 */
export const getLoginUrl = () => {
  const isCapacitor = window.hasOwnProperty('Capacitor');
  const platformParam = isCapacitor ? '?platform=mobile' : '';
  return `${getBaseUrl()}/api/auth/login${platformParam}`;
};
