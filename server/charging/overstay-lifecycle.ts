/**
 * Estado efímero y reglas de seguridad para el monitor de sobretiempo.
 * Una señal física Available siempre prevalece sobre cualquier cron, lock o timer.
 */
export type OverstayChargeDecision = "ALLOW" | "CANCEL";

export function getOverstayChargeDecision(input: {
  isCancelled: boolean;
  connectorStatus: string | null | undefined;
}): OverstayChargeDecision {
  if (input.isCancelled) return "CANCEL";
  return String(input.connectorStatus ?? "").toUpperCase() === "FINISHING" ? "ALLOW" : "CANCEL";
}

export function createOverstayLifecycle() {
  const cancelledEvseIds = new Set<number>();

  return {
    markFinishing(evseId: number) {
      cancelledEvseIds.delete(evseId);
    },
    markDisconnected(evseId: number) {
      cancelledEvseIds.add(evseId);
    },
    markStationDisconnected(evseIds: number[]) {
      evseIds.forEach((evseId) => cancelledEvseIds.add(evseId));
    },
    isCancelled(evseId: number) {
      return cancelledEvseIds.has(evseId);
    },
    reset() {
      cancelledEvseIds.clear();
    },
    getChargeDecision(evseId: number, connectorStatus: string | null | undefined) {
      return getOverstayChargeDecision({
        isCancelled: cancelledEvseIds.has(evseId),
        connectorStatus,
      });
    },
  };
}
