import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";
import { getApiUrl } from "./utils";
import { Capacitor } from "@capacitor/core";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Obtener la URL de login - apunta a la ruta de Auth0 en el servidor
 */
export function getLoginUrl(): string {
  const platformParam = Capacitor.isNativePlatform() ? "?platform=mobile" : "";
  return getApiUrl(`/api/auth/login${platformParam}`);
}
