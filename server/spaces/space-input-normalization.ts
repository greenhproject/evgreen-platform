import { z } from "zod";

/** Convierte el valor de un input HTML en número sin transformar vacío en cero. */
export function normalizeOptionalNumberInput(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : Number(trimmed);
  }
  return value;
}

export const optionalFormNumber = () => z.preprocess(
  normalizeOptionalNumberInput,
  z.number().finite().optional(),
);

export const optionalFormInteger = () => z.preprocess(
  normalizeOptionalNumberInput,
  z.number().int().finite().optional(),
);
