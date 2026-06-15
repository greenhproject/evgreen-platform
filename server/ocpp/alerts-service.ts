/**
 * Servicio de Alertas OCPP
 * Detecta y notifica eventos críticos de los cargadores
 * 
 * Flujo de notificación:
 * 1. Evento OCPP detectado (desconexión, error, falla, boot rechazado)
 * 2. VERIFICACIÓN: Si es desconexión, confirmar que el cargador NO está conectado actualmente
 *    (previene alertas falsas por Proxy Cycle / reconexiones transparentes)
 * 3. Alerta guardada en BD (tabla ocpp_alerts)
 * 4. Notificación al owner de la plataforma
 * 5. Notificación a técnicos activos (FCM push + email + in-app)
 *    - Respeta preferencias individuales de cada técnico
 *    - Respeta horario laboral y disponibilidad para emergencias
 */

import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { notifyTechniciansOfAlert } from "../notifications/technician-notification-service";
import * as ocppManager from "./connection-manager";

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
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre alertas del mismo tipo (default)
const DISCONNECT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos entre alertas de desconexión (evitar spam por reconexiones intermitentes)

// Contador de reconexiones para detectar inestabilidad
const reconnectionCounts = new Map<string, { count: number; firstSeen: number }>();
const RECONNECTION_WINDOW_MS = 60 * 60 * 1000; // Ventana de 1 hora para contar reconexiones

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
  // Usar cooldown más largo para desconexiones (30 min) vs otros tipos (5 min)
  const cooldown = alertType === "DISCONNECTION" ? DISCONNECT_COOLDOWN_MS : ALERT_COOLDOWN_MS;
  return Date.now() - lastAlert < cooldown;
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
function determineSeverity(alertType: OcppAlertType, _payload?: Record<string, unknown>): OcppAlertSeverity {
  switch (alertType) {
    case "FAULT":
    case "BOOT_REJECTED":
    case "TRANSACTION_ERROR":
      return "critical";
    case "DISCONNECTION":
      // Desconexiones son warning, no critical — muchas son temporales (proxy cycle)
      // Solo escalan a critical si hay múltiples desconexiones reales
      return "warning";
    case "ERROR":
      return "warning";
    case "OFFLINE_TIMEOUT":
      return "warning";
    default:
      return "info";
  }
}

/**
 * Busca el nombre de la estación por su ocppIdentity
 */
async function getStationName(ocppIdentity: string, stationId?: number | null): Promise<string | undefined> {
  try {
    if (stationId) {
      const station = await db.getChargingStationById(stationId);
      return station?.name;
    }
    // Intentar buscar por ocppIdentity
    const stations = await db.getAllChargingStations();
    const station = stations.find(s => s.ocppIdentity === ocppIdentity);
    return station?.name;
  } catch {
    return undefined;
  }
}

/**
 * Verifica si un cargador está actualmente conectado o en grace period (reconectando).
 * Si está conectado o reconectando, NO se debe generar alerta de desconexión.
 * 
 * Esta es la DEFENSA PRINCIPAL contra alertas falsas por Proxy Cycle:
 * - Proxy Cycle: el proxy recicla el WebSocket, el cargador se reconecta en ~0s
 * - El grace period (5 min) en connection-manager cubre la reconexión
 * - Si al momento de evaluar la alerta el cargador ya se reconectó, la alerta es falsa
 */
function isChargerCurrentlyConnected(ocppIdentity: string): boolean {
  const connection = ocppManager.getConnection(ocppIdentity);
  if (connection) {
    return true; // Tiene conexión WebSocket activa
  }
  const inGrace = ocppManager.isInGracePeriod(ocppIdentity);
  if (inGrace) {
    return true; // Está en grace period (reconectando)
  }
  return false;
}

/**
 * Procesa un evento de desconexión.
 * 
 * IMPORTANTE: Esta función SOLO debe llamarse después de que expire el grace period
 * y se confirme que el cargador NO se reconectó. Antes de generar la alerta,
 * hace una verificación adicional del estado actual de la conexión como safety net.
 */
export async function handleDisconnection(
  ocppIdentity: string,
  stationId?: number
): Promise<void> {
  // SAFETY NET: Verificar que el cargador realmente NO está conectado
  // Esto previene alertas falsas por race conditions entre el grace period timer
  // y la reconexión del cargador (especialmente en Proxy Cycle)
  if (isChargerCurrentlyConnected(ocppIdentity)) {
    console.log(`[OCPP Alert] SUPPRESSED disconnection alert for ${ocppIdentity}: charger is currently connected or in grace period (likely Proxy Cycle)`);
    return;
  }
  
  if (isInCooldown(ocppIdentity, "DISCONNECTION")) {
    console.log(`[OCPP Alert] Disconnection alert for ${ocppIdentity} is in cooldown (30 min), skipping`);
    return;
  }
  
  // Rastrear reconexiones frecuentes
  const now = Date.now();
  let reconnInfo = reconnectionCounts.get(ocppIdentity);
  if (!reconnInfo || (now - reconnInfo.firstSeen > RECONNECTION_WINDOW_MS)) {
    reconnInfo = { count: 1, firstSeen: now };
  } else {
    reconnInfo.count++;
  }
  reconnectionCounts.set(ocppIdentity, reconnInfo);
  
  // Determinar severidad basada en el número de desconexiones
  // 1 desconexión = warning, 3+ desconexiones en 1 hora = critical (inestabilidad real)
  const severity: OcppAlertSeverity = reconnInfo.count >= 3 ? "critical" : "warning";
  
  // Construir mensaje con info de estabilidad
  let message = `El cargador ${ocppIdentity} se ha desconectado del servidor OCPP.`;
  if (reconnInfo.count > 1) {
    message += ` (${reconnInfo.count} desconexiones reales en la última hora - conexión inestable)`;
  }
  message += ` Esta alerta se generó después de confirmar que el cargador no se reconectó dentro del período de gracia de 5 minutos.`;
  
  const alert: OcppAlert = {
    ocppIdentity,
    stationId,
    alertType: "DISCONNECTION",
    severity,
    title: `Cargador ${ocppIdentity} desconectado`,
    message,
    payload: { disconnectionCount: reconnInfo.count, windowHours: 1 },
    acknowledged: false,
    createdAt: new Date(),
  };
  
  await saveAndNotifyAlert(alert);
  registerAlert(ocppIdentity, "DISCONNECTION");
}

/**
 * Registra que un cargador se reconectó exitosamente
 * Auto-resuelve alertas de desconexión activas y las deja en historial
 */
export async function handleReconnection(ocppIdentity: string): Promise<void> {
  const reconnInfo = reconnectionCounts.get(ocppIdentity);
  if (reconnInfo) {
    console.log(`[OCPP Alert] ${ocppIdentity} reconnected (${reconnInfo.count} disconnections in current window)`);
  }
  
  // Auto-resolver alertas de desconexión activas para este cargador
  try {
    const resolvedCount = await db.autoResolveDisconnectionAlerts(ocppIdentity);
    if (resolvedCount > 0) {
      console.log(`[OCPP Alert] Auto-resolved ${resolvedCount} disconnection alert(s) for ${ocppIdentity} (charger reconnected)`);
    }
  } catch (error) {
    console.error(`[OCPP Alert] Error auto-resolving alerts for ${ocppIdentity}:`, error);
  }
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
 * Guarda la alerta en BD y envía notificaciones a owner + técnicos.
 * 
 * Para alertas de DISCONNECTION, hace una verificación final antes de notificar:
 * si el cargador ya se reconectó entre el momento de crear la alerta y el momento
 * de enviar la notificación, suprime la notificación (la alerta queda en BD pero
 * no se envía spam al owner/técnicos).
 */
async function saveAndNotifyAlert(alert: OcppAlert): Promise<void> {
  try {
    // Guardar en BD (siempre, para auditoría)
    await db.createOcppAlert(alert);
    
    // VERIFICACIÓN FINAL para desconexiones: si el cargador ya se reconectó
    // entre la creación de la alerta y ahora, NO enviar notificaciones
    if (alert.alertType === "DISCONNECTION") {
      if (isChargerCurrentlyConnected(alert.ocppIdentity)) {
        console.log(`[OCPP Alert] SUPPRESSED notifications for ${alert.ocppIdentity}: charger reconnected before notification dispatch`);
        // Auto-resolver la alerta que acabamos de crear
        try {
          await db.autoResolveDisconnectionAlerts(alert.ocppIdentity);
        } catch (e) {
          // Ignorar error de auto-resolve
        }
        return;
      }
    }
    
    // Obtener nombre de la estación para las notificaciones
    const stationName = await getStationName(alert.ocppIdentity, alert.stationId);
    
    // Enviar notificación al owner solo para alertas críticas o warnings
    if (alert.severity === "critical" || alert.severity === "warning") {
      const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
      await notifyOwner({
        title: `${emoji} ${alert.title}`,
        content: `${alert.message}\n\nFecha: ${alert.createdAt.toLocaleString()}\nIdentificador: ${alert.ocppIdentity}`,
      });
    }
    
    // Notificar a técnicos activos (FCM push + email + in-app)
    // Solo para alertas critical y warning
    if (alert.severity === "critical" || alert.severity === "warning") {
      const techResult = await notifyTechniciansOfAlert({
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        ocppIdentity: alert.ocppIdentity,
        stationId: alert.stationId,
        stationName: stationName || alert.ocppIdentity,
        payload: alert.payload,
      });
      
      console.log(`[OCPP Alert] Tech notifications: ${techResult.pushSent} push, ${techResult.emailSent} email, ${techResult.inAppCreated} in-app`);
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
