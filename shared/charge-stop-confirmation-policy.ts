export const STOP_CONFIRMATION_TIMEOUT_MS = 60_000;

export type ChargeStopRequestStatus =
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "TIMED_OUT"
  | "CONFIRMED";

export function isAcceptedRemoteStopResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const status = (response as { status?: unknown }).status;
  return typeof status === "string" && status.trim().toLowerCase() === "accepted";
}

export function canRetryChargeStop(
  status: ChargeStopRequestStatus | null | undefined,
  requestedAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!status || status === "REJECTED" || status === "TIMED_OUT") return true;
  if (status === "CONFIRMED") return false;
  if (!requestedAt) return false;

  const requestedAtMs = new Date(requestedAt).getTime();
  return !Number.isFinite(requestedAtMs) || now - requestedAtMs >= STOP_CONFIRMATION_TIMEOUT_MS;
}

export function getChargeStopUiState(input: {
  transactionStatus: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "PENDING";
  stopRequestStatus?: ChargeStopRequestStatus | null;
  stopRequestedAt?: Date | string | null;
  now?: number;
}): "charging" | "finalizing" | "retryable" | "completed" {
  if (input.transactionStatus === "COMPLETED") return "completed";

  const status = input.stopRequestStatus;
  if (!status) return "charging";
  if (status === "REJECTED" || status === "TIMED_OUT") return "retryable";
  if (status === "CONFIRMED") return "completed";

  return canRetryChargeStop(status, input.stopRequestedAt, input.now)
    ? "retryable"
    : "finalizing";
}

export function getChargeStopMessage(
  status: ChargeStopRequestStatus | null | undefined,
): string {
  switch (status) {
    case "NONE":
      return "";
    case "REQUESTED":
      return "Orden enviada al cargador. Esperando su confirmación física.";
    case "ACCEPTED":
      return "El cargador aceptó la orden. Confirmando que la sesión terminó.";
    case "TIMED_OUT":
      return "El cargador no confirmó el fin de la carga. La sesión sigue abierta para proteger el cobro; puedes reintentar o contactar soporte.";
    case "REJECTED":
      return "El cargador no aceptó la orden de detención. Verifica el equipo y vuelve a intentarlo.";
    case "CONFIRMED":
      return "Carga finalizada y confirmada por el cargador.";
    default:
      return "";
  }
}

export function shouldMarkChargeStopTimedOut(input: {
  transactionStatus: string;
  stopRequestStatus?: ChargeStopRequestStatus | null;
  stopRequestedAt?: Date | string | null;
  now?: number;
}): boolean {
  if (input.transactionStatus !== "IN_PROGRESS") return false;
  if (input.stopRequestStatus !== "REQUESTED" && input.stopRequestStatus !== "ACCEPTED") return false;
  if (!input.stopRequestedAt) return false;

  const requestedAtMs = new Date(input.stopRequestedAt).getTime();
  if (!Number.isFinite(requestedAtMs)) return false;
  return (input.now ?? Date.now()) - requestedAtMs >= STOP_CONFIRMATION_TIMEOUT_MS;
}
