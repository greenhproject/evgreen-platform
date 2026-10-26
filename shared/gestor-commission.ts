/**
 * Política de entrada para la comisión comercial de un gestor.
 *
 * El valor predeterminado sirve únicamente al crear/vincular por primera vez;
 * nunca debe sustituir una edición explícita del administrador.
 */
export const DEFAULT_GESTOR_COMMISSION_PERCENT = 3.75;
export const MAX_GESTOR_COMMISSION_PERCENT = 30;

/**
 * Interpreta una comisión escrita por una persona. Acepta punto o coma decimal,
 * conserva 0 como valor válido y deja el campo vacío como estado temporal para
 * que el input controlado pueda borrarse antes de escribir un valor nuevo.
 */
export function parseGestorCommissionPercentInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return undefined;

  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_GESTOR_COMMISSION_PERCENT) {
    return undefined;
  }

  return parsed;
}
