/**
 * Utilidades de zona horaria para el servidor EVGreen.
 * Usa el campo `timezone` de la estación (IANA tz) para formatear fechas correctamente.
 * Por defecto: America/Bogota (UTC-5, Colombia)
 */

/** Mapa de países a zonas horarias IANA por defecto */
export const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  Colombia: "America/Bogota",
  México: "America/Mexico_City",
  Mexico: "America/Mexico_City",
  Argentina: "America/Argentina/Buenos_Aires",
  Brasil: "America/Sao_Paulo",
  Brazil: "America/Sao_Paulo",
  Chile: "America/Santiago",
  Perú: "America/Lima",
  Peru: "America/Lima",
  Venezuela: "America/Caracas",
  Ecuador: "America/Guayaquil",
  Paraguay: "America/Asuncion",
  Uruguay: "America/Montevideo",
  Bolivia: "America/La_Paz",
  España: "Europe/Madrid",
  Spain: "Europe/Madrid",
  "Estados Unidos": "America/New_York",
  "United States": "America/New_York",
  USA: "America/New_York",
};

/** Obtiene la zona horaria de una estación, con fallback a America/Bogota */
export function getStationTimezone(station: { timezone?: string | null; country?: string | null }): string {
  if (station.timezone && station.timezone.trim()) {
    return station.timezone.trim();
  }
  if (station.country) {
    return COUNTRY_TIMEZONE_MAP[station.country] ?? "America/Bogota";
  }
  return "America/Bogota";
}

/** Formatea una fecha en la zona horaria de la estación */
export function formatDateInTz(date: Date, timezone: string, locale = "es-CO"): string {
  return date.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
}

/** Formatea una hora en la zona horaria de la estación */
export function formatTimeInTz(date: Date, timezone: string, locale = "es-CO"): string {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** Formatea un rango de horas en la zona horaria de la estación */
export function formatTimeRangeInTz(start: Date, end: Date, timezone: string, locale = "es-CO"): string {
  return `${formatTimeInTz(start, timezone, locale)} - ${formatTimeInTz(end, timezone, locale)}`;
}
