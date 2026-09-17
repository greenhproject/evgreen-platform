/**
 * Dispatcher de Alertas de Disponibilidad de Estaciones
 * 
 * Se activa cuando OCPP reporta StatusNotification: Available en un EVSE.
 * Busca usuarios que hayan solicitado ser notificados para esa estación
 * y les envía notificación Push (FCM) y WhatsApp.
 */

import * as db from "../db";
import { sendUserPush } from "../push/unified-push";
import {
  getConfiguredStationAvailabilityTemplate,
  sendWhatsAppTemplate,
} from "../whatsapp/whatsapp-service";

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

    const availabilityTemplate = await getConfiguredStationAvailabilityTemplate();

    // Procesar cada alerta. claimAvailabilityAlert garantiza que una alerta no
    // se procesa dos veces cuando OCPP reintenta el mismo StatusNotification.
    for (const alert of relevantAlerts) {
      try {
        const claimedAlert = await db.claimAvailabilityAlert(alert.id);
        if (!claimedAlert) continue;

        const user = await db.getUserById(claimedAlert.userId);
        if (!user) continue;

        const stationName = claimedAlert.stationName || `Estación #${stationId}`;
        const connectorLabel = claimedAlert.connectorType || connectorType || "compatible";

        let pushStatus: "PENDING" | "SENT" | "FAILED" | "NOT_AVAILABLE" | "NOT_REQUESTED" = claimedAlert.pushStatus === "SENT"
          ? "SENT"
          : claimedAlert.sendPush ? "PENDING" : "NOT_REQUESTED";
        let whatsappStatus: "PENDING" | "SENT" | "FAILED" | "WAITING_TEMPLATE" | "NO_PHONE" | "NOT_AVAILABLE" | "NOT_REQUESTED" = claimedAlert.whatsappStatus === "SENT"
          ? "SENT"
          : claimedAlert.sendWhatsapp ? "PENDING" : "NOT_REQUESTED";
        let pushError: string | undefined;
        let whatsappError: string | undefined;

        // ── Push Notification (Web Push → FCM) ────────────────────────────────
        if (claimedAlert.sendPush && pushStatus !== "SENT") {
          const hasPushChannel = Boolean(user.pushSubscription || (user.fcmToken && !user.fcmToken.startsWith("local_")));
          if (!hasPushChannel) {
            pushStatus = "NOT_AVAILABLE";
            pushError = "El usuario no tiene una suscripción Push activa";
          } else {
            try {
              const sent = await sendUserPush(claimedAlert.userId, {
                type: "station_available",
                title: "¡Conector disponible!",
                body: `${stationName} tiene un conector ${connectorLabel} libre. Sujeto a disponibilidad al llegar.`,
                clickAction: "/map",
                data: {
                  stationId: String(stationId),
                  alertId: String(claimedAlert.id),
                },
              });
              pushStatus = sent ? "SENT" : "FAILED";
              if (!sent) pushError = "El proveedor Push no confirmó el envío";
            } catch (error) {
              pushStatus = "FAILED";
              pushError = error instanceof Error ? error.message : String(error);
            }
          }
        }

        // ── WhatsApp por plantilla de utilidad aprobada ───────────────────────
        if (claimedAlert.sendWhatsapp && whatsappStatus !== "SENT") {
          if (!claimedAlert.userPhone) {
            whatsappStatus = "NO_PHONE";
            whatsappError = "El usuario no cuenta con un número WhatsApp registrado";
          } else if (availabilityTemplate.status === "APPROVED" && availabilityTemplate.canSend) {
            try {
              const sent = await sendWhatsAppTemplate({
                toPhone: claimedAlert.userPhone,
                templateName: availabilityTemplate.name,
                parameters: [claimedAlert.userName || user.name || "Usuario", connectorLabel, stationName],
                eventType: "station_available",
                userId: claimedAlert.userId,
                referenceId: claimedAlert.id,
                referenceType: "availability_alert",
              });
              whatsappStatus = sent ? "SENT" : "FAILED";
              if (!sent) whatsappError = "Meta no confirmó la aceptación de la plantilla";
            } catch (error) {
              whatsappStatus = "FAILED";
              whatsappError = error instanceof Error ? error.message : String(error);
            }
          } else if (availabilityTemplate.status === "IN_REVIEW" || availabilityTemplate.status === "NOT_CONFIGURED") {
            whatsappStatus = "WAITING_TEMPLATE";
            whatsappError = availabilityTemplate.reason || "La plantilla de disponibilidad espera aprobación de Meta";
          } else if (availabilityTemplate.status === "ERROR") {
            whatsappStatus = "FAILED";
            whatsappError = availabilityTemplate.reason || "No fue posible verificar la disponibilidad de la plantilla en Meta";
          } else {
            whatsappStatus = "NOT_AVAILABLE";
            whatsappError = availabilityTemplate.reason || `La plantilla no está disponible (${availabilityTemplate.status})`;
          }
        }

        // Siempre queda un aviso dentro de la aplicación. Se crea sólo en el
        // primer intento para que los reintentos de proveedor no dupliquen inbox.
        if (Number(claimedAlert.attemptCount || 0) === 1) {
          try {
            await db.createNotification({
              userId: claimedAlert.userId,
              title: "¡Conector disponible!",
              message: `${stationName} tiene un conector ${connectorLabel} libre. La disponibilidad puede cambiar antes de tu llegada.`,
              type: "STATION_AVAILABLE",
              referenceId: claimedAlert.id,
              referenceType: "availability_alert",
            });
          } catch (error) {
            console.error(`[AvailabilityAlert] Error creando notificación interna para alerta ${claimedAlert.id}:`, error);
          }
        }

        await db.completeAvailabilityAlertAttempt({
          alertId: claimedAlert.id,
          pushStatus,
          whatsappStatus,
          pushError,
          whatsappError,
        });
        console.log(`[AvailabilityAlert] Alerta ${claimedAlert.id} procesada (push=${pushStatus}, wa=${whatsappStatus})`);

      } catch (alertErr) {
        console.error(`[AvailabilityAlert] Error procesando alerta ${alert.id}:`, alertErr);
      }
    }
  } catch (err) {
    console.error(`[AvailabilityAlert] Error general en dispatcher:`, err);
  }
}
