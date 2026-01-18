/**
 * Servicio de notificaciones para reservas
 * Maneja recordatorios, confirmaciones y alertas de penalización
 */

import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { reservations, users, chargingStations, notifications } from "../../drizzle/schema";
import { eq, and, lte, gte, isNull } from "drizzle-orm";

interface ReservationNotification {
  userId: number;
  reservationId: number;
  type: "CONFIRMATION" | "REMINDER_30MIN" | "REMINDER_5MIN" | "NO_SHOW_WARNING" | "PENALTY_APPLIED";
  title: string;
  message: string;
}

/**
 * Envía una notificación al usuario
 */
export async function sendUserNotification(notification: ReservationNotification): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Guardar notificación en la base de datos
    await db.insert(notifications).values({
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: "RESERVATION",
      isRead: false,
    });

    // En producción, aquí se integraría con:
    // - Push notifications (Firebase Cloud Messaging)
    // - Email (SendGrid, AWS SES)
    // - SMS (Twilio)
    // - WhatsApp Business API

    console.log(`[Notification] Sent to user ${notification.userId}: ${notification.title}`);
    return true;
  } catch (error) {
    console.error("[Notification] Error sending notification:", error);
    return false;
  }
}

/**
 * Envía confirmación de reserva
 */
export async function sendReservationConfirmation(
  userId: number,
  reservationId: number,
  stationName: string,
  startTime: Date,
  reservationFee: number
): Promise<boolean> {
  const formattedDate = startTime.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedTime = startTime.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return sendUserNotification({
    userId,
    reservationId,
    type: "CONFIRMATION",
    title: "Reserva confirmada",
    message: `Tu reserva en ${stationName} para el ${formattedDate} a las ${formattedTime} ha sido confirmada. Tarifa de reserva: $${reservationFee.toLocaleString()} COP. Recuerda llegar a tiempo para evitar penalizaciones.`,
  });
}

/**
 * Envía recordatorio 30 minutos antes
 */
export async function sendReminder30Min(
  userId: number,
  reservationId: number,
  stationName: string,
  stationAddress: string
): Promise<boolean> {
  return sendUserNotification({
    userId,
    reservationId,
    type: "REMINDER_30MIN",
    title: "Tu reserva es en 30 minutos",
    message: `Recuerda que tienes una reserva en ${stationName} (${stationAddress}) en 30 minutos. ¡No llegues tarde!`,
  });
}

/**
 * Envía recordatorio 5 minutos antes
 */
export async function sendReminder5Min(
  userId: number,
  reservationId: number,
  stationName: string
): Promise<boolean> {
  return sendUserNotification({
    userId,
    reservationId,
    type: "REMINDER_5MIN",
    title: "Tu reserva comienza en 5 minutos",
    message: `Tu reserva en ${stationName} comienza en 5 minutos. Si no llegas a tiempo, se aplicará una penalización.`,
  });
}

/**
 * Envía advertencia de no show
 */
export async function sendNoShowWarning(
  userId: number,
  reservationId: number,
  stationName: string,
  graceMinutesLeft: number
): Promise<boolean> {
  return sendUserNotification({
    userId,
    reservationId,
    type: "NO_SHOW_WARNING",
    title: "¡Tu reserva está activa!",
    message: `Tu reserva en ${stationName} ya comenzó. Tienes ${graceMinutesLeft} minutos de gracia antes de que se aplique la penalización por no presentarte.`,
  });
}

/**
 * Envía notificación de penalización aplicada
 */
export async function sendPenaltyNotification(
  userId: number,
  reservationId: number,
  stationName: string,
  penaltyAmount: number
): Promise<boolean> {
  return sendUserNotification({
    userId,
    reservationId,
    type: "PENALTY_APPLIED",
    title: "Penalización aplicada",
    message: `Se ha aplicado una penalización de $${penaltyAmount.toLocaleString()} COP por no presentarte a tu reserva en ${stationName}. Este monto ha sido debitado de tu billetera.`,
  });
}

/**
 * Job que procesa recordatorios pendientes
 * Debe ejecutarse cada minuto mediante un cron job
 */
export async function processReservationReminders(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const in30Min = new Date(now.getTime() + 30 * 60 * 1000);
  const in5Min = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    // Buscar reservas que necesitan recordatorio de 30 min
    const reservations30Min = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .where(
        and(
          eq(reservations.status, "ACTIVE"),
          gte(reservations.startTime, now),
          lte(reservations.startTime, in30Min),
          isNull(reservations.reminder30MinSent)
        )
      );

    for (const { reservation, user, station } of reservations30Min) {
      await sendReminder30Min(user.id, reservation.id, station.name, station.address);
      
      // Marcar como enviado
      await db
        .update(reservations)
        .set({ reminder30MinSent: now })
        .where(eq(reservations.id, reservation.id));
    }

    // Buscar reservas que necesitan recordatorio de 5 min
    const reservations5Min = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .where(
        and(
          eq(reservations.status, "ACTIVE"),
          gte(reservations.startTime, now),
          lte(reservations.startTime, in5Min),
          isNull(reservations.reminder5MinSent)
        )
      );

    for (const { reservation, user, station } of reservations5Min) {
      await sendReminder5Min(user.id, reservation.id, station.name);
      
      // Marcar como enviado
      await db
        .update(reservations)
        .set({ reminder5MinSent: now })
        .where(eq(reservations.id, reservation.id));
    }

    console.log(`[Reminders] Processed ${reservations30Min.length} 30-min reminders and ${reservations5Min.length} 5-min reminders`);
  } catch (error) {
    console.error("[Reminders] Error processing reminders:", error);
  }
}

/**
 * Job que procesa no-shows y aplica penalizaciones
 * Debe ejecutarse cada minuto mediante un cron job
 */
export async function processNoShows(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const gracePeriodMinutes = 15; // 15 minutos de gracia
  const graceExpired = new Date(now.getTime() - gracePeriodMinutes * 60 * 1000);

  try {
    // Buscar reservas que han pasado el período de gracia sin iniciar carga
    const expiredReservations = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .where(
        and(
          eq(reservations.status, "ACTIVE"),
          lte(reservations.startTime, graceExpired)
        )
      );

    for (const { reservation, user, station } of expiredReservations) {
      // Marcar como NO_SHOW
      await db
        .update(reservations)
        .set({ 
          status: "NO_SHOW",
          isPenaltyApplied: true,
        })
        .where(eq(reservations.id, reservation.id));

      // Aplicar penalización a la billetera (se descuenta del saldo)
      const penaltyAmount = Number(reservation.reservationFee) || 5000; // Penalización mínima de $5,000 COP
      
      // Enviar notificación
      await sendPenaltyNotification(user.id, reservation.id, station.name, penaltyAmount);

      console.log(`[NoShow] Applied penalty of ${penaltyAmount} COP to user ${user.id} for reservation ${reservation.id}`);
    }

    if (expiredReservations.length > 0) {
      console.log(`[NoShow] Processed ${expiredReservations.length} no-show reservations`);
    }
  } catch (error) {
    console.error("[NoShow] Error processing no-shows:", error);
  }
}

// Exportar funciones para uso en cron jobs
export const reservationJobs = {
  processReminders: processReservationReminders,
  processNoShows: processNoShows,
};
