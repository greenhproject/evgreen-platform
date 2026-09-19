export const RESERVATION_HOLD_WINDOW_MINUTES = 15;

export type ReservationWindow = {
  reservationStatus?: string;
  status?: string;
  startTime: Date | string;
  endTime: Date | string;
};

/**
 * Una reserva puede bloquear un conector únicamente durante su ventana operativa:
 * desde 15 minutos antes de la hora acordada hasta su finalización. Esta regla evita
 * que una reserva futura, cancelada o vencida deje un conector bloqueado.
 */
export function isReservationHoldingConnector(
  reservation: ReservationWindow | null | undefined,
  now = new Date(),
): boolean {
  if (!reservation) return false;
  const status = (reservation.reservationStatus || reservation.status || "").trim().toUpperCase();
  if (status !== "ACTIVE") return false;

  const startTime = new Date(reservation.startTime).getTime();
  const endTime = new Date(reservation.endTime).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= now.getTime()) {
    return false;
  }

  const holdStartsAt = startTime - RESERVATION_HOLD_WINDOW_MINUTES * 60_000;
  return now.getTime() >= holdStartsAt;
}

/** OCPP sólo confirma una reserva física cuando responde Accepted. */
export function isOcppReservationAccepted(response: { status?: string } | null | undefined): boolean {
  return response?.status?.trim().toUpperCase() === "ACCEPTED";
}

/** Una reserva activa protege el conector frente a terceros, nunca frente a su titular. */
export function canUserStartOnReservedConnector(
  reservationUserId: number | null | undefined,
  currentUserId: number,
): boolean {
  return reservationUserId != null && reservationUserId === currentUserId;
}

/** Sólo una respuesta Accepted permite liberar inmediatamente un bloqueo físico OCPP. */
export function canReleasePhysicalReservation(
  ocppReservationId: number | null | undefined,
  response: { status?: string } | null | undefined,
): boolean {
  return !ocppReservationId || isOcppReservationAccepted(response);
}

/** OCPP usa el identificador local del EVSE; connectorId es el fallback para equipos legacy. */
export function getOcppConnectorId(evse: { evseIdLocal?: number | null; connectorId?: number | null }): number {
  return evse.evseIdLocal ?? evse.connectorId ?? 1;
}

/**
 * Determina si la reserva está actualmente en curso (la hora actual está entre startTime y endTime).
 */
export function isReservationActiveNow(
  reservation: ReservationWindow | null | undefined,
  now = new Date(),
): boolean {
  if (!reservation) return false;
  const status = (reservation.reservationStatus || reservation.status || "").trim().toUpperCase();
  if (status !== "ACTIVE") return false;

  const startTime = new Date(reservation.startTime).getTime();
  const endTime = new Date(reservation.endTime).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return false;

  const nowMs = now.getTime();
  return nowMs >= startTime && nowMs <= endTime;
}

/**
 * Calcula el tiempo de expiración formal de una reserva.
 * La reserva debe permanecer vigente durante toda su duración (endTime).
 */
export function calculateReservationExpiryTime(
  startTime: Date | string,
  endTime: Date | string,
): Date {
  const end = new Date(endTime);
  if (Number.isFinite(end.getTime())) {
    return end;
  }
  const start = new Date(startTime);
  // Fallback seguro: al menos 60 minutos desde el inicio
  return new Date(start.getTime() + 60 * 60 * 1000);
}

/**
 * Evalúa si una reserva debe considerarse como no-show:
 * Sólo cuando la ventana completa reservada haya finalizado (now >= endTime),
 * para no cancelar prematuramente a un usuario que se retrasa unos minutos en llegar.
 */
export function shouldMarkReservationAsNoShow(
  reservation: ReservationWindow | null | undefined,
  now = new Date(),
): boolean {
  if (!reservation) return false;
  const status = (reservation.reservationStatus || reservation.status || "").trim().toUpperCase();
  if (status !== "ACTIVE") return false;

  const endTime = new Date(reservation.endTime).getTime();
  if (!Number.isFinite(endTime)) return false;

  // La reserva sólo se considera no-show cuando su tiempo total reservado ha finalizado
  return now.getTime() >= endTime;
}
