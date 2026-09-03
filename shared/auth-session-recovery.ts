/**
 * Identifica respuestas que indican que el servidor ya no reconoce la sesión.
 * Se mantiene independiente de tRPC para poder probarla y usarla en web/nativo.
 */
export function isRejectedSessionMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const normalized = message.trim().toLowerCase();
  return normalized.includes("please login")
    || normalized.includes("invalid session cookie")
    || normalized.includes("invalid session")
    || normalized.includes("unauthorized");
}
