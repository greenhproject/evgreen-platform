import { RESERVATION_HOLD_WINDOW_MINUTES } from "./reservation-lifecycle-policy";

/**
 * Margen reservado para que una sesión compatible termine, se desconecte el vehículo
 * y el siguiente titular pueda usar el EVSE a la hora acordada.
 */
export const RESERVATION_CHARGE_RELEASE_BUFFER_MINUTES = RESERVATION_HOLD_WINDOW_MINUTES;

export type UpcomingConnectorReservation = {
  id?: number;
  userId: number;
  startTime: Date | string;
  endTime?: Date | string;
};

export type ReservationChargeProtection = {
  status: "NONE" | "OWNER" | "COMPATIBLE" | "BLOCKED";
  reservationId: number | null;
  reservationStartsAt: Date | null;
  releaseBy: Date | null;
  maxEstimatedMinutes: number | null;
  estimatedEndAt: Date;
  message: string | null;
};

/**
 * No corta una sesión ya existente. Antes de autorizar una nueva, impide que su
 * estimación invada la ventana de liberación de una reserva de otro usuario.
 */
export function evaluateReservationChargeProtection(input: {
  now?: Date;
  currentUserId: number;
  estimatedMinutes: number;
  nextReservation?: UpcomingConnectorReservation | null;
}): ReservationChargeProtection {
  const now = input.now ?? new Date();
  const estimatedMinutes = Math.max(0, Math.ceil(Number(input.estimatedMinutes) || 0));
  const estimatedEndAt = new Date(now.getTime() + estimatedMinutes * 60_000);
  const reservation = input.nextReservation;

  if (!reservation) {
    return {
      status: "NONE",
      reservationId: null,
      reservationStartsAt: null,
      releaseBy: null,
      maxEstimatedMinutes: null,
      estimatedEndAt,
      message: null,
    };
  }

  const reservationStartsAt = new Date(reservation.startTime);
  if (!Number.isFinite(reservationStartsAt.getTime()) || reservationStartsAt.getTime() <= now.getTime()) {
    return {
      status: "NONE",
      reservationId: reservation.id ?? null,
      reservationStartsAt: Number.isFinite(reservationStartsAt.getTime()) ? reservationStartsAt : null,
      releaseBy: null,
      maxEstimatedMinutes: null,
      estimatedEndAt,
      message: null,
    };
  }

  const releaseBy = new Date(
    reservationStartsAt.getTime() - RESERVATION_CHARGE_RELEASE_BUFFER_MINUTES * 60_000,
  );
  const maxEstimatedMinutes = Math.max(0, Math.floor((releaseBy.getTime() - now.getTime()) / 60_000));

  if (reservation.userId === input.currentUserId) {
    return {
      status: "OWNER",
      reservationId: reservation.id ?? null,
      reservationStartsAt,
      releaseBy,
      maxEstimatedMinutes,
      estimatedEndAt,
      message: null,
    };
  }

  if (estimatedEndAt.getTime() <= releaseBy.getTime()) {
    return {
      status: "COMPATIBLE",
      reservationId: reservation.id ?? null,
      reservationStartsAt,
      releaseBy,
      maxEstimatedMinutes,
      estimatedEndAt,
      message: `Este conector tiene una reserva posterior. Tu carga estimada finaliza antes de las ${formatTime(releaseBy)}.`,
    };
  }

  return {
    status: "BLOCKED",
    reservationId: reservation.id ?? null,
    reservationStartsAt,
    releaseBy,
    maxEstimatedMinutes,
    estimatedEndAt,
    message: maxEstimatedMinutes > 0
      ? `Este conector debe quedar libre a las ${formatTime(releaseBy)} por una reserva posterior. Reduce tu carga a máximo ${maxEstimatedMinutes} min o elige otro conector.`
      : "Este conector ya está protegido para una reserva próxima. Elige otro conector.",
  };
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}
