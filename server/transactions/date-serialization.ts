/**
 * Convierte los valores de fecha provenientes de MySQL/Drizzle a ISO sin
 * asumir que el driver devuelve una instancia de Date.
 */
export function toIsoDateOrEmpty(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
