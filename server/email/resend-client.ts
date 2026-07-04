/**
 * resend-client.ts
 * Helper centralizado para obtener una instancia de Resend con la API key
 * configurada en la base de datos (platform_settings.resendApiKey).
 * Si no hay key en BD, usa la variable de entorno RESEND_API_KEY / Resend.
 */
import { Resend } from "resend";
import { getPlatformSettings } from "../db";

let _cachedKey: string | undefined;
let _cachedFrom: string | undefined;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minuto de caché

async function refreshCache() {
  const now = Date.now();
  if (_cachedKey !== undefined && now < _cacheExpiry) return;

  try {
    const settings = await getPlatformSettings();
    _cachedKey = (settings as any)?.resendApiKey || undefined;
    _cachedFrom = (settings as any)?.emailFrom || undefined;
  } catch (err) {
    console.warn("[ResendClient] Could not read settings from DB:", err);
    _cachedKey = undefined;
    _cachedFrom = undefined;
  }
  _cacheExpiry = now + CACHE_TTL_MS;
}

/**
 * Invalida el caché (llamar después de guardar una nueva key en BD).
 */
export function invalidateResendCache() {
  _cachedKey = undefined;
  _cachedFrom = undefined;
  _cacheExpiry = 0;
}

/**
 * Obtiene la API key activa: BD → env RESEND_API_KEY → env Resend
 */
export async function getResendApiKey(): Promise<string> {
  await refreshCache();
  return _cachedKey || process.env.RESEND_API_KEY || process.env.Resend || "";
}

/**
 * Obtiene el email remitente configurado en BD o usa el default.
 */
export async function getEmailFrom(): Promise<string> {
  await refreshCache();
  return _cachedFrom || "noreply@evgreen.lat";
}

/**
 * Crea y retorna una instancia de Resend con la key configurada.
 * Usar en lugar de `new Resend(process.env.RESEND_API_KEY)`.
 */
export async function getResendClient(): Promise<Resend> {
  const key = await getResendApiKey();
  if (!key) {
    throw new Error(
      "[ResendClient] No Resend API key configured. Set it in Admin → Configuración → Notificaciones."
    );
  }
  return new Resend(key);
}
