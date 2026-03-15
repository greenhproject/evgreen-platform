import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Obtener la URL de login - apunta a la ruta de Auth0 en el servidor
 */
export function getLoginUrl(): string {
  return `${window.location.origin}/api/auth/login`;
}
