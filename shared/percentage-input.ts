/**
 * Normaliza un porcentaje ingresado en un campo numérico sin tratar 0 como
 * ausencia de valor. Retorna `undefined` únicamente para texto no numérico.
 */
export function parseBoundedPercentageInput(value: string, maximum = 100): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(maximum, Math.max(0, parsed));
}
