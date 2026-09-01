export type AdvertiserAccess = "login" | "register" | "portal" | "forbidden";

/**
 * Centraliza la decisión de entrada al portal publicitario.
 * Solo un anunciante registrado o Administración acceden a campañas;
 * una cuenta de usuario ve el registro y un visitante el inicio de sesión.
 */
export function resolveAdvertiserAccess(
  isAuthenticated: boolean,
  role: string | null | undefined,
): AdvertiserAccess {
  if (!isAuthenticated) return "login";
  if (role === "advertiser" || role === "admin") return "portal";
  if (role === "user") return "register";
  return "forbidden";
}
