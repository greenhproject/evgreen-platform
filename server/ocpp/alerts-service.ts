/**
 * Servicio de Alertas OCPP
 * Detecta y notifica eventos críticos de los cargadores
 */

import { notifyOwner } from "../_core/notification";
import * as db from "../db";

// Tipos de alertas
export type OcppAlertType = 
  | "DISCONNECTION"
  | "ERROR"
  | "FAULT"
  | "OFFLINE_TIMEOUT"
  | "BOOT_REJECTED"
  | "TRANSACTION_ERROR";

export type OcppAlertSeverity = "info" | "warning" | "critical";

export interface OcppAlert {
  id?: number;
  ocppIdentity: string;
  stationId?: number | null;
  alertType: OcppAlertType;
  severity: OcppAlertSeverity;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: Date;
}

// Cache de alertas recientes para evitar duplicados
const recentAlerts = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre alertas del mismo tipo

/**
 * Genera una clave única para una alerta
 */
function getAlertKey(ocppIdentity: string, alertType: OcppAlertType): string {
  return `${ocppIdentity}:${alertType}`;
}

/**
 * Verifica si una alerta está en cooldown
 */
function isInCooldown(ocppIdentity: string, alertType: OcppAlertType): boolean {
  const key = getAlertKey(ocppIdentity, alertType);
  const lastAlert = recentAlerts.get(key);
  if (!lastAlert) return false;
  return Date.now() - lastAlert < ALERT_COOLDOWN_MS;
}

/**
 * Registra una alerta en el cache
 */
function registerAlert(ocppIdentity: string, alertType: OcppAlertType): void {
  const key = getAlertKey(ocppIdentity, alertType);
  recentAlerts.set(key, Date.now());
}

/**
 * Determina la severidad basada en el tipo de alerta y datos
 */
function determineSeverity(alertType: OcppAlertType, payload?: Record<string, unknown>): OcppAlertSeverity {
  switch (alertType) {
    case "FAULT":
    case "BOOT_REJECTED":
    case "TRANSACTION_ERROR":
      return "critical";
    case "ERROR":
    case "DISCONNECTION":
      return "warning";
    case "OFFLINE_TIMEOUT":
      return "warning";
    default:
      return "info";
  }
}

/**
 * Procesa un evento de desconexión
 */
export async function handleDisconnection(
  ocppIdentity: string,
  stationId?: number
): Promise<void> {
  if (isInCooldown(ocppIdentity, "DISCONNECTION")) return;
  
  const alert: OcppAlert = {
    ocppIdentity,
    stationId,
    alertType: "DISCONNECTION",
    severity: "warning",
    title: `Cargador ${ocppIdentity} desconectado`,
    message: `El cargador ${ocppIdentity} se ha desconectado del servidor OCPP.`,
    acknowledged: false,
    createdAt: new Date(),
  };
  
  await saveAndNotifyAlert(alert);
  registerAlert(ocppIdentity, "DISCONNECTION");
}

/**
 * Procesa un StatusNotification con error
 */
export async function handleStatusError(
  ocppIdentity: string,
  stationId: number | undefined,
  connectorId: number,
  errorCode: string,
  status: string,
  vendorErrorCode?: string,
  info?: string
): Promise<void> {
  // Ignorar si no hay error
  if (errorCode === "NoError") return;
  
  const alertType: OcppAlertType = status === "Faulted" ? "FAULT" : "ERROR";
  if (isInCooldown(ocppIdentity, alertType)) return;
  
  const severity = determineSeverity(alertType);
  
  const alert: OcppAlert = {
    ocppIdentity,
    stationId,
    alertType,
    severity,
    title: `${alertType === "FAULT" ? "Falla" : "Error"} en ${ocppIdentity} - Conector ${connectorId}`,
    message: `Error: ${errorCode}${vendorErrorCode ? ` (${vendorErrorCode})` : ""}${info ? ` - ${info}` : ""}. Estado: ${status}`,
    payload: { connectorId, errorCode, status, vendorErrorCode, info },
    acknowledged: false,
    createdAt: new Date(),
  };
  
  await saveAndNotifyAlert(alert);
  registerAlert(ocppIdentity, alertType);
}

/**
 * Procesa un BootNotification rechazado
 */
export async function handleBootRejected(
  ocppIdentity: string,
  stationId?: number,
  reason?: string
): Promise<void> {
  if (isInCooldown(ocppIdentity, "BOOT_REJECTED")) return;
  
  const alert: OcppAlert = {
    ocppIdentity,
    stationId,
    alertType: "BOOT_REJECTED",
    severity: "critical",
    title: `Boot rechazado: ${ocppIdentity}`,
    message: `El cargador ${ocppIdentity} fue rechazado durante el proceso de boot.${reason ? ` Razón: ${reason}` : ""}`,
    payload: { reason },
    acknowledged: false,
    createdAt: new Date(),
  };
  
  await saveAndNotifyAlert(alert);
  registerAlert(ocppIdentity, "BOOT_REJECTED");
}

/**
 * Guarda la alerta en BD y envía notificación
 */
async function saveAndNotifyAlert(alert: OcppAlert): Promise<void> {
  try {
    // Guardar en BD
    await db.createOcppAlert(alert);
    
    // Enviar notificación al owner solo para alertas críticas o warnings
    if (alert.severity === "critical" || alert.severity === "warning") {
      const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
      await notifyOwner({
        title: `${emoji} ${alert.title}`,
        content: `${alert.message}\n\nFecha: ${alert.createdAt.toLocaleString()}\nIdentificador: ${alert.ocppIdentity}`,
      });
    }
    
    console.log(`[OCPP Alert] ${alert.severity.toUpperCase()}: ${alert.title}`);
  } catch (error) {
    console.error("[OCPP Alert] Error saving/notifying alert:", error);
  }
}

/**
 * Obtiene alertas recientes
 */
export async function getRecentAlerts(
  limit: number = 50,
  includeAcknowledged: boolean = false
) {
  return db.getOcppAlerts({ limit, includeAcknowledged });
}

/**
 * Marca una alerta como reconocida
 */
export async function acknowledgeAlert(alertId: number): Promise<void> {
  await db.acknowledgeOcppAlert(alertId);
}

/**
 * Obtiene estadísticas de alertas
 */
export async function getAlertStats(): Promise<{
  total: number;
  unacknowledged: number;
  bySeverity: Record<OcppAlertSeverity, number>;
  byType: Record<OcppAlertType, number>;
}> {
  return db.getOcppAlertStats();
}
