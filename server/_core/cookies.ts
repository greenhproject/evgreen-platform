import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Extrae el dominio raíz para compartir cookies entre subdominios.
 * Ej: "app.evgreen.lat" → ".evgreen.lat"
 *     "prueba.evgreen.lat" → ".evgreen.lat"
 *     "localhost" → undefined
 */
function getRootDomain(hostname: string): string | undefined {
  if (!hostname || LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }
  // Manus sandbox domains (no compartir entre subdominios)
  if (hostname.includes("manus.computer") || hostname.includes("manuscdn.com")) {
    return undefined;
  }
  const parts = hostname.split(".");
  // Necesitamos al menos 2 partes para un dominio raíz (ej: evgreen.lat)
  if (parts.length < 2) return undefined;
  // Tomar las últimas 2 partes como dominio raíz y agregar punto al inicio
  const rootDomain = "." + parts.slice(-2).join(".");
  return rootDomain;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);
  const hostname = req.hostname;
  const domain = getRootDomain(hostname);

  return {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? "lax" : "none" as const,
    secure: isSecure,
    ...(domain ? { domain } : {}),
  };
}
