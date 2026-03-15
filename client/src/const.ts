export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate login URL - now points to the server-side Auth0 login route
 * The server handles the full OAuth2/OIDC flow with Auth0
 */
export const getLoginUrl = () => {
  return `${window.location.origin}/api/auth/login`;
};
