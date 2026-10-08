export type ReservationNotificationEvent =
  | "confirmed"
  | "reminder_30m"
  | "reminder_5m"
  | "check_in"
  | "cancelled"
  | "no_show_warning"
  | "no_show_penalty"
  | "service_issue";

export type ReservationMessageContext = {
  stationName: string;
  startTime?: Date | string;
  endTime?: Date | string;
  connectorLabel?: string | number | null;
  reservationFee?: number;
  refundAmount?: number;
  penaltyAmount?: number;
  graceMinutesLeft?: number;
};

const formatMoney = (amount: number) => `$${Math.round(amount).toLocaleString("es-CO")} COP`;

function formatReservationTime(value?: Date | string): string {
  if (!value) return "la hora programada";
  return new Date(value).toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getReservationEventTitle(event: ReservationNotificationEvent): string {
  const titles: Record<ReservationNotificationEvent, string> = {
    confirmed: "Reserva confirmada",
    reminder_30m: "Tu reserva es en 30 minutos",
    reminder_5m: "Tu reserva comienza en 5 minutos",
    check_in: "Reserva utilizada correctamente",
    cancelled: "Reserva cancelada",
    no_show_warning: "Tu reserva está activa",
    no_show_penalty: "Penalización por no presentarte",
    service_issue: "Tu reserva fue afectada por una carga en curso",
  };
  return titles[event];
}

export function getReservationEventMessage(
  event: ReservationNotificationEvent,
  context: ReservationMessageContext,
): string {
  const connector = context.connectorLabel ? ` Conector: ${context.connectorLabel}.` : "";
  switch (event) {
    case "confirmed":
      return `Tu reserva en ${context.stationName} para ${formatReservationTime(context.startTime)} fue confirmada.${connector} Revísala o adminístrala desde EVGreen.`;
    case "reminder_30m":
      return `Tu reserva en ${context.stationName} comienza en 30 minutos.${connector} Planea tu llegada para usar el conector a tiempo.`;
    case "reminder_5m":
      return `Tu reserva en ${context.stationName} comienza en 5 minutos.${connector} Abre EVGreen para llegar e iniciar la carga.`;
    case "check_in":
      return `Tu reserva en ${context.stationName} fue vinculada a la carga iniciada correctamente.${connector}`;
    case "cancelled":
      return `Tu reserva en ${context.stationName} fue cancelada.${context.refundAmount && context.refundAmount > 0 ? ` Reembolso aplicado: ${formatMoney(context.refundAmount)}.` : " No aplica reembolso según la política vigente."}`;
    case "no_show_warning":
      return `Tu reserva en ${context.stationName} ya está activa.${context.graceMinutesLeft ? ` Tienes ${context.graceMinutesLeft} minutos para iniciar la carga antes de que se aplique la política de no presentación.` : " Abre EVGreen para iniciar la carga."}`;
    case "no_show_penalty":
      return `La reserva en ${context.stationName} terminó sin una carga iniciada.${context.penaltyAmount ? ` Se aplicó ${formatMoney(context.penaltyAmount)} según la política de no presentación.` : ""}`;
    case "service_issue":
      return `Tu reserva en ${context.stationName} fue afectada porque el conector seguía ocupado. No se aplicará penalidad ni se marcará como no presentación. Busca otro conector desde EVGreen; el equipo de operación queda informado.`;
  }
}

/** Parámetros para una única plantilla Utility aprobable por Meta. */
export function getReservationWhatsAppParameters(
  userName: string | null | undefined,
  event: ReservationNotificationEvent,
  context: ReservationMessageContext,
): string[] {
  return [
    userName?.trim().split(/\s+/)[0] || "cliente",
    getReservationWhatsAppStatusLabel(event),
    context.stationName,
  ];
}

/** Valores breves para parámetros Utility de Meta, sin perder el estado real. */
export function getReservationWhatsAppStatusLabel(event: ReservationNotificationEvent): string {
  const labels: Record<ReservationNotificationEvent, string> = {
    confirmed: "Confirmada",
    reminder_30m: "En 30 minutos",
    reminder_5m: "En 5 minutos",
    check_in: "Carga iniciada",
    cancelled: "Cancelada",
    no_show_warning: "Reserva activa",
    no_show_penalty: "No presentación",
    service_issue: "Incidencia de servicio",
  };
  return labels[event];
}

export function getReservationWhatsAppEventType(event: ReservationNotificationEvent):
  | "reservation_confirmed"
  | "reservation_reminder"
  | "reservation_started"
  | "reservation_cancelled"
  | "reservation_no_show"
  | "reservation_service_issue" {
  if (event === "confirmed") return "reservation_confirmed";
  if (event === "reminder_30m" || event === "reminder_5m" || event === "no_show_warning") return "reservation_reminder";
  if (event === "check_in") return "reservation_started";
  if (event === "cancelled") return "reservation_cancelled";
  if (event === "service_issue") return "reservation_service_issue";
  return "reservation_no_show";
}
