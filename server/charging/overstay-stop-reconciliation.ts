import { shouldCancelOverstayFromStopReason } from "./overstay-guards";

/**
 * Aplica el único efecto de sobretiempo permitido al cerrar una transacción.
 * StopTransaction no inicia penalidades; EVDisconnected sí cancela explícitamente
 * cualquier monitor o lock que pudiera haber quedado en carrera.
 */
export async function reconcileOverstayAfterStopTransaction(input: {
  stopReason: string | null | undefined;
  evseId: number;
  markEvseAvailable: (evseId: number) => Promise<void>;
  cancelOverstay: (evseId: number) => Promise<void>;
}): Promise<boolean> {
  if (!shouldCancelOverstayFromStopReason(input.stopReason)) return false;
  await input.markEvseAvailable(input.evseId);
  await input.cancelOverstay(input.evseId);
  return true;
}
