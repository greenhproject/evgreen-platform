export const DEFAULT_STATION_TIMEZONE = "America/Bogota";

type StationDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function toNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

/**
 * Las estaciones almacenan su zona IANA; nunca se debe interpretar un horario de
 * reserva con la zona del teléfono, el navegador o el proceso Node.
 */
export function normalizeStationTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || DEFAULT_STATION_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_STATION_TIMEZONE;
  }
}

export function getStationDateTimeParts(value: Date | string | number, timezone?: string | null): StationDateTimeParts {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeStationTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: toNumber(parts, "year"),
    month: toNumber(parts, "month"),
    day: toNumber(parts, "day"),
    hour: toNumber(parts, "hour"),
    minute: toNumber(parts, "minute"),
    second: toNumber(parts, "second"),
  };
}

export function formatStationDate(value: Date | string | number, timezone?: string | null): string {
  const parts = getStationDateTimeParts(value, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatStationTime(value: Date | string | number, timezone?: string | null): string {
  const parts = getStationDateTimeParts(value, timezone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/** Muestra una fecha/hora utilizando la zona del activo, no la del dispositivo. */
export function formatStationDateTime(
  value: Date | string | number,
  timezone?: string | null,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: normalizeStationTimezone(timezone),
    ...options,
    hourCycle: "h23",
  }).format(value instanceof Date ? value : new Date(value));
}

function offsetAt(date: Date, timezone: string): number {
  const parts = getStationDateTimeParts(date, timezone);
  const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return renderedAsUtc - date.getTime();
}

/**
 * Convierte un valor de los controles `date` + `time` que el usuario seleccionó
 * para la estación a UTC. Evita que una app con reloj/zona distinta desplace la
 * reserva: `2026-09-22 / 21:25` en Bogotá siempre persiste como 02:25 UTC.
 */
export function stationLocalDateTimeToUtc(dateValue: string, timeValue: string, timezone?: string | null): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    throw new Error("Fecha u hora de reserva inválida");
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("Fecha u hora de reserva inválida");
  }

  const zone = normalizeStationTimezone(timezone);
  const localPartsAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = new Date(localPartsAsUtc - offsetAt(new Date(localPartsAsUtc), zone));
  // Recalcular el offset para fechas próximas a cambios de horario estacional.
  result = new Date(localPartsAsUtc - offsetAt(result, zone));
  return result;
}

export function stationLocalTimeAfter(value: Date | string | number, minutes: number, timezone?: string | null): Date {
  const start = value instanceof Date ? value : new Date(value);
  return new Date(start.getTime() + minutes * 60_000);
}
