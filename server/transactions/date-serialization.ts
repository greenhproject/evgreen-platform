/**
 * Convierte los valores de fecha provenientes de MySQL/Drizzle a ISO sin
 * asumir que el driver devuelve una instancia de Date.
 */
export function toIsoDateOrEmpty(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  const text = typeof value === "string" ? value.trim() : null;
  if (text === "") return "";
  // TIMESTAMP mode:string devuelve texto SQL sin offset. La persistencia es
  // UTC: no interpretarlo en la zona local del proceso o del dispositivo.
  const unzoned = text !== null && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text);
  const date = value instanceof Date ? value : new Date(unzoned ? `${text!.replace(" ", "T")}Z` : value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
