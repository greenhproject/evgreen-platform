export const RESERVATION_HOLD_WINDOW_MINUTES = 15;

export type ReservationWindow = {
  reservationStatus: string;
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
  if (!reservation || reservation.reservationStatus !== "ACTIVE") return false;

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
