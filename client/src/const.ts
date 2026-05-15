import { getBaseUrl } from "./lib/utils";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate login URL - ahora apunta a la ruta absoluta si estamos en Capacitor
 */
export const getLoginUrl = () => {
  return `${getBaseUrl()}/api/auth/login`;
};
