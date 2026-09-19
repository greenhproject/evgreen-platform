/**
 * Servicio de notificaciones para reservas
 * Maneja recordatorios, confirmaciones y alertas de penalización
 */

import { notifyOwner } from "../_core/notification";
import { getActiveReservation, getDb, getNotificationByKey, updateEvseStatus } from "../db";
import { reservations, users, chargingStations, notifications, evses, whatsappNotificationLog } from "../../drizzle/schema";
import { eq, and, lte, gte, isNull, desc, or, sql } from "drizzle-orm";
import { dualCSMS } from "../ocpp/csms-dual";
import { getOcppConnectorId, isOcppReservationAccepted } from "../../shared/reservation-lifecycle-policy";
import {
  getReservationEventMessage,
  getReservationEventTitle,
  getReservationWhatsAppEventType,
  getReservationWhatsAppParameters,
  type ReservationMessageContext,
  type ReservationNotificationEvent,
} from "../../shared/reservation-notification-policy";

interface ReservationNotificationInput {
  userId: number;
  reservationId: number;
  userName?: string | null;
  userPhone?: string | null;
  event: ReservationNotificationEvent;
  context: ReservationMessageContext;
}

/**
 * Registra primero la alerta interna y luego intenta WhatsApp con una plantilla
 * Utility aprobada. Es idempotente por reserva y estado: una reejecución del
 * Heartbeat nunca duplica el aviso ni afirma una entrega que Meta no confirmó.
 */
export async function sendReservationLifecycleNotification(input: ReservationNotificationInput): Promise<boolean> {
  try {
    const db = (await getDb())!;
    if (!db) return false;
    const key = `reservation:${input.reservationId}:${input.event}`;
    const existing = await getNotificationByKey(input.userId, key);
    if (existing) return true;

    const title = getReservationEventTitle(input.event);
    const message = getReservationEventMessage(input.event, input.context);
    await db.insert(notifications).values({
      userId: input.userId,
      title,
      message,
      type: "RESERVATION",
      referenceId: input.reservationId,
      referenceType: "reservation",
      isRead: 0,
      data: JSON.stringify({ key, event: input.event }),
    } as any);

    if (input.userPhone) {
      const {
        getConfiguredReservationTemplate,
        sendWhatsAppTemplate,
      } = await import("../whatsapp/whatsapp-service");
      const template = await getConfiguredReservationTemplate();
      if (template.canSend) {
        await sendWhatsAppTemplate({
          toPhone: input.userPhone,
          templateName: template.name,
          parameters: getReservationWhatsAppParameters(input.userName, input.event, input.context),
          eventType: getReservationWhatsAppEventType(input.event),
          userId: input.userId,
          referenceId: input.reservationId,
          referenceType: "reservation",
        });
      } else {
        console.log(`[ReservationNotification] WhatsApp pendiente para reserva ${input.reservationId}: ${template.status}`);
      }
    }

    console.log(`[ReservationNotification] ${input.event} registrada para usuario ${input.userId}`);
    return true;
  } catch (error) {
    console.error("[ReservationNotification] Error sending notification:", error);
    return false;
  }
}

export async function sendReservationConfirmation(
  userId: number,
  reservationId: number,
  stationName: string,
  startTime: Date,
  reservationFee: number,
  user?: { name?: string | null; phone?: string | null },
  connectorLabel?: string | number | null,
): Promise<boolean> {
  return sendReservationLifecycleNotification({
    userId,
    reservationId,
    userName: user?.name,
    userPhone: user?.phone,
    event: "confirmed",
    context: { stationName, startTime, connectorLabel, reservationFee },
  });
}

/**
 * Envía recordatorio 30 minutos antes
 */
export async function sendReminder30Min(
  userId: number,
  reservationId: number,
  stationName: string,
  stationAddress: string,
  user?: { name?: string | null; phone?: string | null },
  connectorLabel?: string | number | null,
): Promise<boolean> {
  return sendReservationLifecycleNotification({
    userId,
    reservationId,
    userName: user?.name,
    userPhone: user?.phone,
    event: "reminder_30m",
    context: { stationName: stationAddress ? `${stationName} (${stationAddress})` : stationName, connectorLabel },
  });
}

/**
 * Envía recordatorio 5 minutos antes
 */
export async function sendReminder5Min(
  userId: number,
  reservationId: number,
  stationName: string,
  user?: { name?: string | null; phone?: string | null },
  connectorLabel?: string | number | null,
): Promise<boolean> {
  return sendReservationLifecycleNotification({
    userId,
    reservationId,
    userName: user?.name,
    userPhone: user?.phone,
    event: "reminder_5m",
    context: { stationName, connectorLabel },
  });
}

/**
 * Envía advertencia de no show
 */
export async function sendNoShowWarning(
  userId: number,
  reservationId: number,
  stationName: string,
  graceMinutesLeft: number,
  user?: { name?: string | null; phone?: string | null },
  connectorLabel?: string | number | null,
): Promise<boolean> {
  return sendReservationLifecycleNotification({
    userId,
    reservationId,
    userName: user?.name,
    userPhone: user?.phone,
    event: "no_show_warning",
    context: { stationName, graceMinutesLeft, connectorLabel },
  });
}

/**
 * Envía notificación de penalización aplicada
 */
export async function sendPenaltyNotification(
  userId: number,
  reservationId: number,
  stationName: string,
  penaltyAmount: number,
  user?: { name?: string | null; phone?: string | null },
  connectorLabel?: string | number | null,
): Promise<boolean> {
  return sendReservationLifecycleNotification({
    userId,
    reservationId,
    userName: user?.name,
    userPhone: user?.phone,
    event: "no_show_penalty",
    context: { stationName, penaltyAmount, connectorLabel },
  });
}

/**
 * Job que procesa recordatorios pendientes
 * Debe ejecutarse cada minuto mediante un cron job
 */
export async function processReservationReminders(): Promise<void> {
  const db = (await getDb())!;
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
        evse: evses,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .leftJoin(evses, eq(reservations.evseId, evses.id))
      .where(
        and(
          eq(reservations.reservationStatus, "ACTIVE"),
          // @ts-ignore
          gte(reservations.startTime, now),
          // @ts-ignore
          lte(reservations.startTime, in30Min),
          isNull(reservations.reminder30MinSent)
        )
      );

    for (const { reservation, user, station, evse } of reservations30Min) {
      await sendReminder30Min(
        user.id,
        reservation.id,
        station.name,
        station.address,
        user,
        evse?.connectorId ?? reservation.evseId,
      );
      
      // Marcar como enviado
      await db
        .update(reservations)
        .set({ reminder30MinSent: now } as any)
        .where(eq(reservations.id, reservation.id));
    }

    // Buscar reservas que necesitan recordatorio de 5 min
    const reservations5Min = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
        evse: evses,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .leftJoin(evses, eq(reservations.evseId, evses.id))
      .where(
        and(
          eq(reservations.reservationStatus, "ACTIVE"),
          // @ts-ignore
          gte(reservations.startTime, now),
          // @ts-ignore
          lte(reservations.startTime, in5Min),
          isNull(reservations.reminder5MinSent)
        )
      );

    for (const { reservation, user, station, evse } of reservations5Min) {
      await sendReminder5Min(
        user.id,
        reservation.id,
        station.name,
        user,
        evse?.connectorId ?? reservation.evseId,
      );
      
      // Marcar como enviado
      await db
        .update(reservations)
        .set({ reminder5MinSent: now } as any)
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
  const db = (await getDb())!;
  if (!db) return;

  const now = new Date();
  // Una reserva sólo se evalúa para no-show cuando su ventana reservada ha finalizado (endTime <= now),
  // garantizando que el usuario tenga su tiempo completo de reserva sin cancelaciones prematuras.
  try {
    // 1. Notificación de aviso al iniciar la reserva (idempotente)
    const graceWindowReservations = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
        evse: evses,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .leftJoin(evses, eq(reservations.evseId, evses.id))
      .where(and(
        eq(reservations.reservationStatus, "ACTIVE"),
        sql`${reservations.startTime} <= UTC_TIMESTAMP()`,
        sql`${reservations.endTime} > UTC_TIMESTAMP()`
      ));

    for (const { reservation, user, station, evse } of graceWindowReservations) {
      const minutesSinceStart = Math.max(0, Math.floor((now.getTime() - new Date(reservation.startTime).getTime()) / 60_000));
      await sendNoShowWarning(
        user.id,
        reservation.id,
        station.name,
        Math.max(0, 15 - minutesSinceStart),
        user,
        evse?.connectorId ?? reservation.evseId,
      );
    }

    // 2. Evaluar expiración formal únicamente cuando el tiempo reservado ha finalizado
    const candidateReservations = await db
      .select({
        reservation: reservations,
        user: users,
        station: chargingStations,
        evse: evses,
      })
      .from(reservations)
      .innerJoin(users, eq(reservations.userId, users.id))
      .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
      .leftJoin(evses, eq(reservations.evseId, evses.id))
      .where(
        and(
          eq(reservations.reservationStatus, "ACTIVE"),
          sql`${reservations.endTime} <= UTC_TIMESTAMP()`
        )
      );

    for (const { reservation, user, station, evse } of candidateReservations) {
      // 1. Verificar si el usuario efectivamente inició una carga en este conector o estación
      const { transactions } = await import("../../drizzle/schema");
      const matchingTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, reservation.userId),
            eq(transactions.stationId, reservation.stationId),
            or(
              eq(transactions.status, "IN_PROGRESS"),
              eq(transactions.status, "COMPLETED")
            )
          )
        )
        .limit(1);

      if (matchingTxs.length > 0) {
        // El usuario sí utilizó la estación: marcar como FULFILLED, nunca como NO_SHOW
        await db
          .update(reservations)
          .set({
            reservationStatus: "FULFILLED",
            transactionId: matchingTxs[0].id,
          } as any)
          .where(eq(reservations.id, reservation.id));
        console.log(`[NoShowProtection] Reserva #${reservation.id} cumplida por transacción #${matchingTxs[0].id}`);
        continue;
      }

      // 2. Si no inició carga y su tiempo reservado terminó formalmente, marcar como NO_SHOW
      await db
        .update(reservations)
        .set({ 
          reservationStatus: "NO_SHOW",
          isPenaltyApplied: true,
        } as any)
        .where(eq(reservations.id, reservation.id));

      // Liberar el EVSE a AVAILABLE, conservando una posible reserva consecutiva.
      if (reservation.evseId) {
        const replacementReservation = await getActiveReservation(reservation.evseId);
        await updateEvseStatus(
          reservation.evseId,
          replacementReservation ? "RESERVED" : "AVAILABLE",
          {
            triggeredBy: "RESERVATION",
            reason: replacementReservation ? "Consecutive active reservation" : "Reservation no-show",
          },
        );
        console.log(`[NoShow] EVSE ${reservation.evseId} transitioned after no-show`);
      }

      // Aplicar penalización a la billetera (se descuenta del saldo)
      const penaltyAmount = Number(reservation.noShowPenalty) || Number(reservation.reservationFee) || 5000;
      
      // Descontar penalización de la billetera del usuario
      try {
        const { getWalletByUserId } = await import("../db");
        const wallet = await getWalletByUserId(reservation.userId);
        if (wallet) {
          const currentBalance = Number(wallet.balance) || 0;
          const newBalance = Math.max(0, currentBalance - penaltyAmount);
          const { wallets } = await import("../../drizzle/schema");
          await db.update(wallets)
            .set({ balance: newBalance.toString() } as any)
            .where(eq(wallets.userId, reservation.userId));
          console.log(`[NoShow] Deducted ${penaltyAmount} COP from user ${user.id} wallet (${currentBalance} -> ${newBalance})`);
        }
      } catch (e) {
        console.error(`[NoShow] Failed to deduct penalty from wallet:`, e);
      }
      
      // Enviar notificación
      await sendPenaltyNotification(
        user.id,
        reservation.id,
        station.name,
        penaltyAmount,
        user,
        evse?.connectorId ?? reservation.evseId,
      );

      console.log(`[NoShow] Applied penalty of ${penaltyAmount} COP to user ${user.id} for reservation ${reservation.id}`);
    }

    if (candidateReservations.length > 0) {
      console.log(`[NoShow] Processed ${candidateReservations.length} candidate reservations`);
    }
  } catch (error) {
    console.error("[NoShow] Error processing no-shows:", error);
  }
}

/**
 * Procesar reservas próximas: marcar conectores como RESERVED cuando falten 15 min o menos
 * y liberar conectores cuando la reserva haya terminado
 */
async function processUpcomingReservations(): Promise<void> {
  try {
    const db = (await getDb())!;
    if (!db) return;
    const now = new Date();
    const in15Min = new Date(now.getTime() + 15 * 60 * 1000);

    // 1. Buscar reservas ACTIVAS que empiezan en los próximos 15 minutos
    const upcomingReservations = await db
      .select({
        id: reservations.id,
        evseId: reservations.evseId,
        stationId: reservations.stationId,
        userId: reservations.userId,
        startTime: reservations.startTime,
        endTime: reservations.endTime,
        expiryTime: reservations.expiryTime,
        ocppReservationId: reservations.ocppReservationId,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.reservationStatus, "ACTIVE"),
          sql`${reservations.startTime} <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`,
          sql`${reservations.endTime} >= UTC_TIMESTAMP()`
        )
      );

    for (const res of upcomingReservations) {
      // Verificar estado actual del EVSE
      const [evse] = await db
        .select({
          connectorStatus: evses.connectorStatus,
          evseIdLocal: evses.evseIdLocal,
          connectorId: evses.connectorId,
        })
        .from(evses)
        .where(eq(evses.id, res.evseId));

      if (evse) {
        // Intento OCPP idempotente: sólo se persiste el identificador cuando el
        // cargador confirma Accepted. La reserva de plataforma permanece visible
        // si el equipo está offline, sin declarar un bloqueo físico inexistente.
        if (!res.ocppReservationId) {
          const [stationRows, userRows] = await Promise.all([
            db.select({ ocppIdentity: chargingStations.ocppIdentity })
              .from(chargingStations)
              .where(eq(chargingStations.id, res.stationId))
              .limit(1),
            db.select({ idTag: users.idTag })
              .from(users)
              .where(eq(users.id, res.userId))
              .limit(1),
          ]);
          const station = stationRows[0];
          const user = userRows[0];
          const ocppIdentity = station?.ocppIdentity;
          const idTag = user?.idTag || `USER-${res.userId}`;
          if (ocppIdentity && dualCSMS.isStationOnline(ocppIdentity)) {
            try {
              const response = await dualCSMS.reserveNow(
                ocppIdentity,
                getOcppConnectorId(evse),
                res.id,
                new Date(res.expiryTime),
                idTag,
              );
              if (isOcppReservationAccepted(response)) {
                await db.update(reservations)
                  .set({ ocppReservationId: res.id } as any)
                  .where(eq(reservations.id, res.id));
                console.log(`[ReservationActivation] OCPP reservation accepted for #${res.id}`);
              } else {
                console.warn(`[ReservationActivation] OCPP reservation rejected for #${res.id}: ${response.status}`);
              }
            } catch (error: any) {
              console.warn(`[ReservationActivation] OCPP reservation pending for #${res.id}: ${error.message}`);
            }
          }
        }

        if (evse.connectorStatus === "AVAILABLE") {
          await updateEvseStatus(res.evseId, "RESERVED", {
            triggeredBy: "RESERVATION",
            reason: `Reservation #${res.id} hold window opened`,
          });
          console.log(`[ReservationActivation] EVSE ${res.evseId} marcado como RESERVED (reserva #${res.id} inicia pronto)`);
        }
      }
    }

    // 2. Liberar conectores cuya reserva ya terminó y no están en uso
    const expiredReservations = await db
      .select({
        id: reservations.id,
        evseId: reservations.evseId,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.reservationStatus, "ACTIVE"),
          sql`${reservations.endTime} <= UTC_TIMESTAMP()`
        )
      );

    for (const res of expiredReservations) {
      const [evse] = await db
        .select({ connectorStatus: evses.connectorStatus })
        .from(evses)
        .where(eq(evses.id, res.evseId));

      // Solo liberar si está RESERVED (no si está CHARGING u otro estado activo)
      if (evse && evse.connectorStatus === "RESERVED") {
        await updateEvseStatus(res.evseId, "AVAILABLE", {
          triggeredBy: "RESERVATION",
          reason: `Reservation #${res.id} ended`,
        });
        console.log(`[ReservationActivation] EVSE ${res.evseId} liberado a AVAILABLE (reserva #${res.id} terminó)`);
      }
    }

    if (upcomingReservations.length > 0 || expiredReservations.length > 0) {
      console.log(`[ReservationActivation] Processed ${upcomingReservations.length} upcoming, ${expiredReservations.length} expired`);
    }
  } catch (error) {
    console.error("[ReservationActivation] Error:", error);
  }
}

const RESERVATION_EVENTS: ReservationNotificationEvent[] = [
  "confirmed",
  "reminder_30m",
  "reminder_5m",
  "check_in",
  "cancelled",
  "no_show_warning",
  "no_show_penalty",
];

/**
 * Reintenta sólo avisos internos que nunca llegaron a Meta. Esto cubre eventos
 * creados mientras la plantilla estaba en revisión y evita duplicar cualquier
 * `wamid` ya registrado, incluso si Meta reintenta su propio webhook.
 */
export async function retryPendingReservationWhatsAppNotifications(): Promise<{ attempted: number; skipped: number }> {
  const db = (await getDb())!;
  if (!db) return { attempted: 0, skipped: 0 };
  const { getConfiguredReservationTemplate, sendWhatsAppTemplate } = await import("../whatsapp/whatsapp-service");
  const template = await getConfiguredReservationTemplate();
  if (!template.canSend) return { attempted: 0, skipped: 0 };

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const candidates = await db
    .select({ notification: notifications, user: users, station: chargingStations, evse: evses })
    .from(notifications)
    .innerJoin(reservations, eq(notifications.referenceId, reservations.id))
    .innerJoin(users, eq(notifications.userId, users.id))
    .innerJoin(chargingStations, eq(reservations.stationId, chargingStations.id))
    .leftJoin(evses, eq(reservations.evseId, evses.id))
    .where(and(
      eq(notifications.type, "RESERVATION"),
      eq(notifications.referenceType, "reservation"),
      gte(notifications.createdAt, cutoff),
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(200);

  let attempted = 0;
  let skipped = 0;
  for (const { notification, user, station, evse } of candidates) {
    let event: ReservationNotificationEvent | null = null;
    try {
      const parsed = notification.data ? JSON.parse(notification.data) : null;
      event = RESERVATION_EVENTS.includes(parsed?.event) ? parsed.event : null;
    } catch {
      event = null;
    }
    if (!event || !user.phone || !notification.referenceId) {
      skipped++;
      continue;
    }
    const eventType = getReservationWhatsAppEventType(event);
    const [priorProviderAttempt] = await db.select({ id: whatsappNotificationLog.id })
      .from(whatsappNotificationLog)
      .where(and(
        eq(whatsappNotificationLog.referenceId, notification.referenceId),
        eq(whatsappNotificationLog.referenceType, "reservation"),
        eq(whatsappNotificationLog.eventType, eventType),
      ))
      .limit(1);
    if (priorProviderAttempt) {
      skipped++;
      continue;
    }
    const accepted = await sendWhatsAppTemplate({
      toPhone: user.phone,
      templateName: template.name,
      parameters: getReservationWhatsAppParameters(user.name, event, { stationName: station.name, connectorLabel: evse?.connectorId }),
      eventType,
      userId: user.id,
      referenceId: notification.referenceId,
      referenceType: "reservation",
    });
    if (accepted) attempted++;
    else skipped++;
  }
  return { attempted, skipped };
}

// Exportar funciones para uso en cron jobs
export const reservationJobs = {
  processReminders: processReservationReminders,
  processNoShows: processNoShows,
  processUpcomingReservations: processUpcomingReservations,
  retryPendingWhatsApp: retryPendingReservationWhatsAppNotifications,
};
