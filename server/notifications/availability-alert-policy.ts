export type AvailabilityPushStatus = "PENDING" | "SENT" | "FAILED" | "NOT_AVAILABLE" | "NOT_REQUESTED";
export type AvailabilityWhatsAppStatus = "PENDING" | "SENT" | "FAILED" | "WAITING_TEMPLATE" | "NO_PHONE" | "NOT_AVAILABLE" | "NOT_REQUESTED";

export type AvailabilityAttemptOutcome = {
  alertStatus: "PENDING" | "SENT" | "EXPIRED";
  nextDelayMinutes: number | null;
};

/**
 * Determina si un resultado por canal queda finalizado, se reintenta o expira.
 * El máximo de tres intentos aplica a fallos de proveedores; una plantilla en
 * revisión espera hasta 24 revisiones horarias para no convertir un proceso de
 * aprobación de Meta en una falsa entrega ni en reintentos agresivos.
 */
export function resolveAvailabilityAttempt(input: {
  attemptCount: number;
  pushStatus: AvailabilityPushStatus;
  whatsappStatus: AvailabilityWhatsAppStatus;
}): AvailabilityAttemptOutcome {
  const waitingTemplate = input.whatsappStatus === "WAITING_TEMPLATE";
  const deliveryFailure = input.pushStatus === "PENDING"
    || input.pushStatus === "FAILED"
    || input.whatsappStatus === "PENDING"
    || input.whatsappStatus === "FAILED";
  const hasSuccessfulChannel = input.pushStatus === "SENT" || input.whatsappStatus === "SENT";
  const canRetry = waitingTemplate
    ? input.attemptCount < 24
    : deliveryFailure && input.attemptCount < 3;

  if (canRetry) {
    return {
      alertStatus: "PENDING",
      nextDelayMinutes: waitingTemplate ? 60 : Math.min(Math.max(input.attemptCount, 1), 3) * 5,
    };
  }

  return { alertStatus: hasSuccessfulChannel ? "SENT" : "EXPIRED", nextDelayMinutes: null };
}
