/**
 * OCPP Connection Manager
 * Gestiona las conexiones WebSocket activas de los cargadores OCPP
 */

import { WebSocket } from "ws";

export interface OcppConnection {
  ws: WebSocket;
  ocppIdentity: string;
  ocppVersion: string;
  stationId: number | null;
  connectedAt: Date;
  lastHeartbeat: Date;
  lastMessage: Date;
  connectorStatuses: Map<number, string>;
  bootInfo?: {
    vendor: string;
    model: string;
    serialNumber?: string;
    firmwareVersion?: string;
  };
}

export interface OcppConnectionInfo {
  ocppIdentity: string;
  ocppVersion: string;
  stationId: number | null;
  connectedAt: string;
  lastHeartbeat: string;
  lastMessage: string;
  connectorStatuses: Record<number, string>;
  bootInfo?: {
    vendor: string;
    model: string;
    serialNumber?: string;
    firmwareVersion?: string;
  };
  isConnected: boolean;
}

// Almacén global de conexiones activas
const activeConnections = new Map<string, OcppConnection>();

// Historial de sesiones de conexión (para monitoreo de estabilidad)
export interface ConnectionSession {
  ocppIdentity: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  durationSeconds: number | null;
  closeCode: number | null;
  closeReason: string;
}

// Historial de sesiones por estación (mantener últimas 50 por estación)
const connectionHistory = new Map<string, ConnectionSession[]>();
const MAX_HISTORY_PER_STATION = 50;

/**
 * Registrar una desconexión en el historial
 */
export function recordDisconnection(
  ocppIdentity: string,
  connectedAt: Date,
  closeCode: number | null = null,
  closeReason: string = ''
): void {
  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - connectedAt.getTime()) / 1000);
  
  const session: ConnectionSession = {
    ocppIdentity,
    connectedAt,
    disconnectedAt: now,
    durationSeconds,
    closeCode,
    closeReason,
  };
  
  if (!connectionHistory.has(ocppIdentity)) {
    connectionHistory.set(ocppIdentity, []);
  }
  const history = connectionHistory.get(ocppIdentity)!;
  history.push(session);
  
  // Mantener solo las últimas MAX_HISTORY_PER_STATION sesiones
  if (history.length > MAX_HISTORY_PER_STATION) {
    history.splice(0, history.length - MAX_HISTORY_PER_STATION);
  }
}

/**
 * Obtener historial de conexiones de una estación
 */
export function getConnectionHistory(ocppIdentity: string): ConnectionSession[] {
  return connectionHistory.get(ocppIdentity) || [];
}

/**
 * Obtener monitoreo de estabilidad de conexión para todas las estaciones
 */
export function getConnectionStabilityReport(): Array<{
  ocppIdentity: string;
  stationId: number | null;
  isConnected: boolean;
  currentUptimeSeconds: number;
  connectedAt: string | null;
  lastHeartbeat: string | null;
  lastMessage: string | null;
  reconnectionCount24h: number;
  avgSessionDurationSeconds: number;
  longestSessionSeconds: number;
  shortestSessionSeconds: number;
  lastDisconnection: string | null;
  lastCloseCode: number | null;
  stabilityScore: number; // 0-100, 100 = perfecto
}> {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const results: any[] = [];
  
  // Obtener todas las estaciones que tienen historial O conexión activa
  const allIdentities = new Set<string>();
  Array.from(activeConnections.keys()).forEach(key => allIdentities.add(key));
  Array.from(connectionHistory.keys()).forEach(key => allIdentities.add(key));
  
  for (const ocppIdentity of Array.from(allIdentities)) {
    const conn = activeConnections.get(ocppIdentity);
    const history = connectionHistory.get(ocppIdentity) || [];
    
    // Filtrar reconexiones en las últimas 24h
    const recent24h = history.filter(s => 
      s.disconnectedAt && s.disconnectedAt.getTime() > twentyFourHoursAgo
    );
    
    // Calcular estadísticas de duración
    const durations = history
      .filter(s => s.durationSeconds !== null)
      .map(s => s.durationSeconds!);
    
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) 
      : 0;
    const longestSession = durations.length > 0 ? Math.max(...durations) : 0;
    const shortestSession = durations.length > 0 ? Math.min(...durations) : 0;
    
    // Última desconexión
    const lastDisconnection = history.length > 0 
      ? history[history.length - 1] 
      : null;
    
    // Uptime actual
    const currentUptime = conn 
      ? Math.round((now - conn.connectedAt.getTime()) / 1000) 
      : 0;
    
    // Calcular score de estabilidad (0-100)
    // - Menos reconexiones en 24h = mejor
    // - Mayor duración promedio = mejor
    // - Actualmente conectado = bonus
    let stabilityScore = 100;
    // Penalizar por reconexiones: -5 por cada reconexion en 24h (max -50)
    stabilityScore -= Math.min(recent24h.length * 5, 50);
    // Penalizar por sesiones cortas (< 5 min promedio): -20
    if (avgDuration > 0 && avgDuration < 300) stabilityScore -= 20;
    // Penalizar si no está conectado actualmente: -15
    if (!conn) stabilityScore -= 15;
    // Bonus por uptime largo actual (> 1 hora): +10
    if (currentUptime > 3600) stabilityScore = Math.min(stabilityScore + 10, 100);
    stabilityScore = Math.max(0, Math.min(100, stabilityScore));
    
    results.push({
      ocppIdentity,
      stationId: conn?.stationId || null,
      isConnected: !!conn && conn.ws.readyState === WebSocket.OPEN,
      currentUptimeSeconds: currentUptime,
      connectedAt: conn?.connectedAt?.toISOString() || null,
      lastHeartbeat: conn?.lastHeartbeat?.toISOString() || null,
      lastMessage: conn?.lastMessage?.toISOString() || null,
      reconnectionCount24h: recent24h.length,
      avgSessionDurationSeconds: avgDuration,
      longestSessionSeconds: longestSession,
      shortestSessionSeconds: shortestSession,
      lastDisconnection: lastDisconnection?.disconnectedAt?.toISOString() || null,
      lastCloseCode: lastDisconnection?.closeCode || null,
      stabilityScore,
    });
  }
  
  // Ordenar: conectados primero, luego por score descendente
  results.sort((a, b) => {
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    return b.stabilityScore - a.stabilityScore;
  });
  
  return results;
}

/**
 * Registrar una nueva conexión OCPP
 */
export function registerConnection(
  ocppIdentity: string,
  ws: WebSocket,
  ocppVersion: string
): OcppConnection {
  const connection: OcppConnection = {
    ws,
    ocppIdentity,
    ocppVersion,
    stationId: null,
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    lastMessage: new Date(),
    connectorStatuses: new Map(),
  };
  
  activeConnections.set(ocppIdentity, connection);
  console.log(`[OCPP Manager] Registered connection: ${ocppIdentity} (${ocppVersion})`);
  
  return connection;
}

/**
 * Actualizar información de boot del cargador
 */
export function updateBootInfo(
  ocppIdentity: string,
  bootInfo: OcppConnection["bootInfo"],
  stationId: number | null
): void {
  const connection = activeConnections.get(ocppIdentity);
  if (connection) {
    connection.bootInfo = bootInfo;
    connection.stationId = stationId;
    connection.lastMessage = new Date();
    console.log(`[OCPP Manager] Updated boot info for ${ocppIdentity}:`, bootInfo);
  }
}

/**
 * Actualizar timestamp de heartbeat
 */
export function updateHeartbeat(ocppIdentity: string): void {
  const connection = activeConnections.get(ocppIdentity);
  if (connection) {
    connection.lastHeartbeat = new Date();
    connection.lastMessage = new Date();
  }
}

/**
 * Actualizar estado de un conector
 */
export function updateConnectorStatus(
  ocppIdentity: string,
  connectorId: number,
  status: string
): void {
  const connection = activeConnections.get(ocppIdentity);
  if (connection) {
    connection.connectorStatuses.set(connectorId, status);
    connection.lastMessage = new Date();
    console.log(`[OCPP Manager] ${ocppIdentity} connector ${connectorId} status: ${status}`);
  }
}

/**
 * Actualizar timestamp del último mensaje
 */
export function updateLastMessage(ocppIdentity: string): void {
  const connection = activeConnections.get(ocppIdentity);
  if (connection) {
    connection.lastMessage = new Date();
  }
}

/**
 * Eliminar una conexión
 */
export function removeConnection(ocppIdentity: string): void {
  activeConnections.delete(ocppIdentity);
  console.log(`[OCPP Manager] Removed connection: ${ocppIdentity}`);
}

/**
 * Obtener una conexión por identidad
 */
export function getConnection(ocppIdentity: string): OcppConnection | undefined {
  return activeConnections.get(ocppIdentity);
}

/**
 * Obtener todas las conexiones activas (para API)
 */
export function getAllConnections(): OcppConnectionInfo[] {
  const connections: OcppConnectionInfo[] = [];
  
  for (const [identity, conn] of Array.from(activeConnections.entries())) {
    connections.push({
      ocppIdentity: identity,
      ocppVersion: conn.ocppVersion,
      stationId: conn.stationId,
      connectedAt: conn.connectedAt.toISOString(),
      lastHeartbeat: conn.lastHeartbeat.toISOString(),
      lastMessage: conn.lastMessage.toISOString(),
      connectorStatuses: Object.fromEntries(conn.connectorStatuses),
      bootInfo: conn.bootInfo,
      isConnected: conn.ws.readyState === WebSocket.OPEN,
    });
  }
  
  return connections;
}

/**
 * Obtener conexión por stationId
 */
export function getConnectionByStationId(stationId: number): OcppConnection | undefined {
  for (const conn of Array.from(activeConnections.values())) {
    if (conn.stationId === stationId) {
      return conn;
    }
  }
  return undefined;
}

/**
 * Enviar comando OCPP a un cargador
 */
export function sendOcppCommand(
  ocppIdentity: string,
  messageId: string,
  action: string,
  payload: any
): boolean {
  const connection = activeConnections.get(ocppIdentity);
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    console.log(`[OCPP Manager] Cannot send command to ${ocppIdentity}: not connected`);
    return false;
  }
  
  const message = [2, messageId, action, payload];
  connection.ws.send(JSON.stringify(message));
  console.log(`[OCPP Manager] Sent ${action} to ${ocppIdentity}`);
  return true;
}

/**
 * Obtener estadísticas de conexiones
 */
export function getConnectionStats(): {
  totalConnections: number;
  connectedCount: number;
  disconnectedCount: number;
  byVersion: Record<string, number>;
} {
  let connectedCount = 0;
  let disconnectedCount = 0;
  const byVersion: Record<string, number> = {};
  
  for (const conn of Array.from(activeConnections.values())) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      connectedCount++;
    } else {
      disconnectedCount++;
    }
    
    byVersion[conn.ocppVersion] = (byVersion[conn.ocppVersion] || 0) + 1;
  }
  
  return {
    totalConnections: activeConnections.size,
    connectedCount,
    disconnectedCount,
    byVersion,
  };
}
