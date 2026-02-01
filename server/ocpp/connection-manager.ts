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
