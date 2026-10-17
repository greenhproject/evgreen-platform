/**
 * Normaliza un porcentaje ingresado en un campo numérico sin tratar 0 como
 * ausencia de valor. Retorna `undefined` únicamente para texto no numérico.
 */
export function parseBoundedPercentageInput(value: string, maximum = 100): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(maximum, Math.max(0, parsed));
}

/**
 * Variante para campos controlados: conserva el estado vacío mientras la
 * persona borra un número para escribir otro. El valor vacío no se interpreta
 * como 0 ni se reemplaza por un valor comercial por defecto.
 */
export function parseOptionalBoundedPercentageInput(value: string, maximum = 100): number | undefined {
  if (value.trim() === "") return undefined;
  return parseBoundedPercentageInput(value, maximum);
}

/** El reparto de margen neto solo es utilizable si ambas partes suman 100 %. */
export function isNetRevenueDistributionValid(
  investorSharePercent: number | undefined,
  platformSharePercent: number | undefined,
): boolean {
  return Number.isFinite(investorSharePercent)
    && Number.isFinite(platformSharePercent)
    && investorSharePercent! >= 0
    && platformSharePercent! >= 0
    && Math.abs(investorSharePercent! + platformSharePercent! - 100) < 0.001;
}
