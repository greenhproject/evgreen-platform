import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Obtener la URL de login de OAuth
 */
export function getLoginUrl(): string {
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://manus.im";
  const appId = import.meta.env.VITE_APP_ID || "";
  const redirectUrl = `${window.location.origin}/api/oauth/callback`;
  return `${portalUrl}/oauth/authorize?app_id=${appId}&redirect_url=${encodeURIComponent(redirectUrl)}`;
}
