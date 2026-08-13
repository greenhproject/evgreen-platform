/**
 * Reglas puras de transición para el monitor de sobretiempo.
 * El monitor solo puede iniciar mediante un estado físico FINISHING emitido por OCPP.
 */
export type OverstayStatusAction = "START" | "CANCEL" | "NONE";

export function getOverstayStatusAction(status: string | null | undefined): OverstayStatusAction {
  switch (String(status ?? "").trim().toUpperCase()) {
    case "FINISHING":
      return "START";
    case "AVAILABLE":
      return "CANCEL";
    default:
      return "NONE";
  }
}

/**
 * StopTransaction confirma el cierre financiero, no el estado físico del cable.
 * Por seguridad a favor del usuario, no inicia sobretiempo por sí solo.
 */
export function shouldStartOverstayFromStopTransaction(): boolean {
  return false;
}

/** OCPP 1.6 reason=EVDisconnected es una confirmación explícita de retiro físico. */
export function shouldCancelOverstayFromStopReason(reason: string | null | undefined): boolean {
  return String(reason ?? "").trim().toUpperCase() === "EVDISCONNECTED";
}
