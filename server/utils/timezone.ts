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

/**
 * Devuelve una fecha ISO corta (yyyy-MM-dd) en la zona horaria indicada.
 * No debe usarse toISOString().slice(0, 10) para fechas contables: eso siempre
 * interpreta el día en UTC y puede adelantar la fecha para Colombia.
 */
export function formatIsoDateInTz(date: Date, timezone = "America/Bogota"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

/**
 * Desplazamiento (en minutos) de `timezone` respecto a UTC en el instante `date`.
 * Positivo si la zona está adelante de UTC. Calculado por el instante dado
 * (no fijo) para que funcione también en zonas con horario de verano.
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  // Intl.DateTimeFormat no reporta milisegundos: comparar un `date` con
  // fracción de segundo contra un `asUtc` truncado a segundos enteros
  // metía hasta 999ms de error en el offset. Se trunca `date` primero para
  // que ambos lados de la resta tengan la misma precisión.
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(truncated).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUtc - truncated) / 60000;
}

/**
 * Convierte un día calendario local ("YYYY-MM-DD", tal como lo entrega un
 * <input type="date"> sin ninguna marca de zona) al instante UTC real de su
 * inicio (00:00:00.000) en `timezone`. Usar siempre para filtros de fecha
 * admin-facing: comparar ese string directo contra una columna UTC adelanta
 * o atrasa el límite según la hora de ejecución (ver formatIsoDateInTz arriba).
 */
export function startOfDayInTz(dateStr: string, timezone = "America/Bogota"): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const guessUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(guessUtc, timezone);
  return new Date(guessUtc.getTime() - offsetMinutes * 60000);
}

/** Igual que startOfDayInTz, pero para el último milisegundo (23:59:59.999) del día local. */
export function endOfDayInTz(dateStr: string, timezone = "America/Bogota"): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const guessUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const offsetMinutes = getTimezoneOffsetMinutes(guessUtc, timezone);
  return new Date(guessUtc.getTime() - offsetMinutes * 60000);
}
