/**
 * Dispatcher de Alertas de Disponibilidad de Estaciones
 * 
 * Se activa cuando OCPP reporta StatusNotification: Available en un EVSE.
 * Busca usuarios que hayan solicitado ser notificados para esa estación
 * y les envía notificación Push (FCM) y WhatsApp.
 */

import * as db from "../db";
import { sendPushNotification } from "../firebase/fcm";
import { sendWhatsAppMessage } from "../whatsapp/whatsapp-service";

/**
 * Disparar alertas de disponibilidad para una estación/EVSE que acaba de quedar libre.
 * Llamar desde el handler de StatusNotification de OCPP cuando status === "Available".
 * 
 * @param stationId - ID numérico de la estación
 * @param connectorType - Tipo de conector del EVSE que quedó libre (ej: "GBT_AC", "CCS2")
 */
export async function dispatchAvailabilityAlerts(
  stationId: number,
  connectorType?: string
): Promise<void> {
  try {
    // Obtener alertas pendientes para esta estación
    const pendingAlerts = await db.getPendingAlertsByStation(stationId);
    if (pendingAlerts.length === 0) return;

    console.log(`[AvailabilityAlert] Estación ${stationId} disponible — ${pendingAlerts.length} alertas pendientes`);

    // Filtrar por tipo de conector si se especificó
    const relevantAlerts = connectorType
      ? pendingAlerts.filter(a =>
          !a.connectorType ||
          a.connectorType === connectorType ||
          a.connectorType === "ANY"
        )
      : pendingAlerts;

    if (relevantAlerts.length === 0) {
      console.log(`[AvailabilityAlert] Sin alertas para conector ${connectorType}`);
      return;
    }

    // Procesar cada alerta
    for (const alert of relevantAlerts) {
      try {
        const user = await db.getUserById(alert.userId);
        if (!user) continue;

        const stationName = alert.stationName || `Estación #${stationId}`;
        const connectorLabel = alert.connectorType || "disponible";

        let pushSent = false;
        let waSent = false;

        // ── Push Notification (FCM) ──────────────────────────────────────────
        if (alert.sendPush && user.fcmToken) {
          try {
            pushSent = await sendPushNotification(user.fcmToken, {
              type: "station_available",
              title: "¡Cargador disponible!",
              body: `${stationName} tiene un conector ${connectorLabel} libre. ¡Ve a cargar ahora!`,
              clickAction: "/map",
              data: {
                stationId: String(stationId),
                alertId: String(alert.id),
              },
            });
            if (pushSent) {
              console.log(`[AvailabilityAlert] Push enviado al usuario ${alert.userId} para estación ${stationId}`);
            }
          } catch (err) {
            console.error(`[AvailabilityAlert] Error enviando push al usuario ${alert.userId}:`, err);
          }
        }

        // ── WhatsApp ─────────────────────────────────────────────────────────
        if (alert.sendWhatsapp && alert.userPhone) {
          try {
            const waMessage =
              `🔌 *¡Cargador disponible!*\n\n` +
              `Hola ${alert.userName || user.name || ""}! 👋\n\n` +
              `La estación *${stationName}* que estabas esperando ya tiene un conector libre.\n\n` +
              `⚡ *Conector:* ${connectorLabel}\n` +
              `📍 *Estación:* ${stationName}\n\n` +
              `¡Date prisa, puede ocuparse pronto! Abre la app EVGreen para iniciar tu carga.`;

            waSent = await sendWhatsAppMessage({
              toPhone: alert.userPhone,
              message: waMessage,
              eventType: "charge_start", // Usar tipo existente como proxy
              skipConfigCheck: true,     // Siempre enviar alertas de disponibilidad
            });

            if (waSent) {
              console.log(`[AvailabilityAlert] WhatsApp enviado al usuario ${alert.userId} (${alert.userPhone})`);
            }
          } catch (err) {
            console.error(`[AvailabilityAlert] Error enviando WhatsApp al usuario ${alert.userId}:`, err);
          }
        }

        // ── Marcar alerta como enviada ────────────────────────────────────────
        await db.markAlertSent(alert.id);
        console.log(`[AvailabilityAlert] Alerta ${alert.id} marcada como SENT (push=${pushSent}, wa=${waSent})`);

      } catch (alertErr) {
        console.error(`[AvailabilityAlert] Error procesando alerta ${alert.id}:`, alertErr);
      }
    }
  } catch (err) {
    console.error(`[AvailabilityAlert] Error general en dispatcher:`, err);
  }
}
