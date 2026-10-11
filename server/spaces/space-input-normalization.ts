import { z } from "zod";

/**
 * Admite la escritura habitual en Colombia: `1.500.000`, `1,500,000`,
 * `112,5` y `112.5`. No convierte vacío en cero ni permite NaN llegar a SQL.
 */
export function parseLocalizedNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return undefined;
  if (!/^[+-]?[\d.,]+$/.test(raw)) return undefined;

  const sign = raw.startsWith("-") ? "-" : raw.startsWith("+") ? "+" : "";
  const unsigned = sign ? raw.slice(1) : raw;
  const commas = [...unsigned.matchAll(/,/g)].map((match) => match.index ?? 0);
  const dots = [...unsigned.matchAll(/\./g)].map((match) => match.index ?? 0);

  let normalized: string;
  if (commas.length === 0 && dots.length === 0) {
    normalized = unsigned;
  } else if (commas.length > 0 && dots.length > 0) {
    // El último separador es el decimal; el otro se interpreta como miles.
    const decimalIndex = Math.max(commas.at(-1)!, dots.at(-1)!);
    const decimalSeparator = unsigned[decimalIndex];
    const integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "");
    normalized = `${integerPart}.${decimalPart}`;
    // Mantener la variable documenta explícitamente el criterio anterior.
    void decimalSeparator;
  } else {
    const separator = commas.length ? "," : ".";
    const separatorIndexes = commas.length ? commas : dots;
    const lastIndex = separatorIndexes.at(-1)!;
    const trailingDigits = unsigned.length - lastIndex - 1;
    // En formularios colombianos, un único separador con tres dígitos a la
    // derecha se interpreta como miles: `1.100` = 1100, no 1.1.
    const isThousandsGrouping = trailingDigits === 3;
    if (isThousandsGrouping) {
      normalized = unsigned.replace(/[.,]/g, "");
    } else if (separatorIndexes.length === 1) {
      normalized = `${unsigned.slice(0, lastIndex)}.${unsigned.slice(lastIndex + 1)}`;
    } else {
      // `1,500,25` no es una notación inequívoca: se rechaza con un error claro.
      return undefined;
    }
  }

  const result = Number(`${sign}${normalized}`);
  return Number.isFinite(result) ? result : undefined;
}

/** Convierte el valor de un input HTML en número sin transformar vacío en cero. */
export function normalizeOptionalNumberInput(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = parseLocalizedNumber(value);
  return parsed === undefined ? value : parsed;
}

export const optionalFormNumber = () => z.preprocess(
  normalizeOptionalNumberInput,
  z.number().finite().optional(),
).optional();

export const optionalFormInteger = () => z.preprocess(
  normalizeOptionalNumberInput,
  z.number().int().finite().optional(),
).optional();

/**
 * Drizzle conserva DECIMAL como string. Se recibe un número escrito en formato
 * local y se entrega al esquema en la forma SQL canónica, sin perder precisión.
 */
export const optionalLocalizedDecimalString = () => z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = parseLocalizedNumber(value);
  return parsed === undefined ? value : String(parsed);
}, z.string().regex(/^[+-]?\d+(?:\.\d+)?$/, "Ingresa un número válido usando punto o coma").optional()).optional();
