import { z } from "zod";
import { MAX_GESTOR_COMMISSION_PERCENT } from "../../shared/gestor-commission";

export const gestorCommissionPercentSchema = z.number()
  .finite()
  .min(0)
  .max(MAX_GESTOR_COMMISSION_PERCENT)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "La comisión del gestor puede tener máximo dos decimales.",
  });

/**
 * Contrato estricto: evita que una clave con nombre incorrecto sea descartada y
 * sustituida silenciosamente por un valor predeterminado.
 */
export const spaceGestorAssignmentInput = z.object({
  spaceId: z.number().int(),
  gestorId: z.number().int().nullable(),
  gestorCommissionPercent: gestorCommissionPercentSchema,
}).strict();

export const stationGestorAssignmentInput = z.object({
  stationId: z.number().int(),
  gestorId: z.number().int().nullable(),
  gestorCommissionPercent: gestorCommissionPercentSchema,
}).strict();
