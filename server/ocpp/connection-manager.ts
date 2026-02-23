/**
 * OCPP Connection Manager - Reconexión Seamless
 * 
 * Diseñado para manejar desconexiones cíclicas del proxy (~180s) de forma transparente.
 * El estado OCPP (bootInfo, connectorStatuses, stationId, transacciones) se preserva
 * entre reconexiones. Solo se registra como "desconexión real" si el cargador no
 * se reconecta dentro del grace period.
 */

import { WebSocket } from "ws";

// ============================================================================
// INTERFACES
// ============================================================================

export interface OcppConnection {
  ws: WebSocket;
  ocppIdentity: string;
  ocppVersion: string;
  stationId: number | null;
  connectedAt: Date;           // Cuando se conectó por primera vez (o después de una desconexión real)
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
  seamlessReconnections: number;  // Reconexiones transparentes desde la última conexión real
  lastSeamlessReconnect: string | null;
}

/**
 * Estado persistente que sobrevive a las reconexiones del proxy.
 * Se mantiene mientras el cargador se reconecte dentro del grace period.
 */
interface PersistentState {
  ocppIdentity: string;
  ocppVersion: string;
  stationId: number | null;
  originalConnectedAt: Date;    // Timestamp de la conexión original (no se resetea en reconexiones)
  lastHeartbeat: Date;
  lastMessage: Date;
  connectorStatuses: Map<number, string>;
  bootInfo?: {
    vendor: string;
    model: string;
    serialNumber?: string;
    firmwareVersion?: string;
  };
  seamlessReconnections: number;   // Contador de reconexiones transparentes
  lastSeamlessReconnect: Date | null;
  isInGracePeriod: boolean;        // True cuando está desconectado pero dentro del grace period
  gracePeriodStart: Date | null;   // Cuando empezó el grace period actual
}

// ============================================================================
// HISTORIAL DE SESIONES (solo desconexiones REALES)
// ============================================================================

export interface ConnectionSession {
  ocppIdentity: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  durationSeconds: number | null;
  closeCode: number | null;
  closeReason: string;
  wasSeamless: boolean;  // true = reconexión transparente, false = desconexión real
}

// ============================================================================
// ALMACENES GLOBALES
// ============================================================================

// Conexiones WebSocket activas (solo cuando hay WS abierto)
const activeConnections = new Map<string, OcppConnection>();

// Estado persistente que sobrevive reconexiones (se mantiene durante grace period)
const persistentStates = new Map<string, PersistentState>();

// Historial de sesiones por estación
const connectionHistory = new Map<string, ConnectionSession[]>();
const MAX_HISTORY_PER_STATION = 50;

// Grace period: timeout para cada estación en grace period
const gracePeriodTimers = new Map<string, NodeJS.Timeout>();

// Configuración
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutos - cubre ~2.7 ciclos de proxy (181s)

// ============================================================================
// RECONEXIÓN SEAMLESS
// ============================================================================

/**
 * Registrar una nueva conexión OCPP.
 * Si hay un estado persistente (reconexión dentro del grace period),
 * restaura todo el estado anterior automáticamente.
 */
export function registerConnection(
  ocppIdentity: string,
  ws: WebSocket,
  ocppVersion: string
): OcppConnection {
  const existingState = persistentStates.get(ocppIdentity);
  const wasInGracePeriod = existingState?.isInGracePeriod === true;
  
  let connection: OcppConnection;
  
  if (existingState && wasInGracePeriod) {
    // *** RECONEXIÓN SEAMLESS ***
    // El cargador se reconectó dentro del grace period
    // Restaurar TODO el estado anterior
    existingState.seamlessReconnections++;
    existingState.lastSeamlessReconnect = new Date();
    existingState.isInGracePeriod = false;
    existingState.gracePeriodStart = null;
    
    connection = {
      ws,
      ocppIdentity,
      ocppVersion: existingState.ocppVersion,
      stationId: existingState.stationId,
      connectedAt: existingState.originalConnectedAt,  // Mantener el timestamp original
      lastHeartbeat: new Date(),
      lastMessage: new Date(),
      connectorStatuses: existingState.connectorStatuses,  // Restaurar estados de conectores
      bootInfo: existingState.bootInfo,                     // Restaurar info de boot
    };
    
    // Registrar la reconexión seamless en el historial (marcada como seamless)
    recordSessionEvent(ocppIdentity, existingState.gracePeriodStart || new Date(), 1006, '', true);
    
    console.log(`[OCPP Manager] ⚡ SEAMLESS RECONNECTION #${existingState.seamlessReconnections}: ${ocppIdentity} ` +
      `(stationId=${existingState.stationId}, connectors=${existingState.connectorStatuses.size}, ` +
      `originalUptime=${Math.round((Date.now() - existingState.originalConnectedAt.getTime()) / 1000)}s)`);
  } else {
    // *** CONEXIÓN NUEVA ***
    // Primera conexión o reconexión después de que expiró el grace period
    connection = {
      ws,
      ocppIdentity,
      ocppVersion,
      stationId: null,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      lastMessage: new Date(),
      connectorStatuses: new Map(),
    };
    
    // Crear nuevo estado persistente
    persistentStates.set(ocppIdentity, {
      ocppIdentity,
      ocppVersion,
      stationId: null,
      originalConnectedAt: new Date(),
      lastHeartbeat: new Date(),
      lastMessage: new Date(),
      connectorStatuses: new Map(),
      seamlessReconnections: 0,
      lastSeamlessReconnect: null,
      isInGracePeriod: false,
      gracePeriodStart: null,
    });
    
    console.log(`[OCPP Manager] New connection: ${ocppIdentity} (${ocppVersion})`);
  }
  
  // Cancelar grace period timer si existe
  const existingTimer = gracePeriodTimers.get(ocppIdentity);
  if (existingTimer) {
    clearTimeout(existingTimer);
    gracePeriodTimers.delete(ocppIdentity);
  }
  
  activeConnections.set(ocppIdentity, connection);
  return connection;
}

/**
 * Manejar desconexión de un WebSocket.
 * NO elimina el estado persistente inmediatamente.
 * Inicia un grace period para reconexión seamless.
 * 
 * @returns true si se inició grace period (reconexión esperada), false si es desconexión real
 */
export function handleDisconnection(
  ocppIdentity: string,
  closeCode: number | null = null,
  closeReason: string = ''
): { isGracePeriod: boolean; wasSeamless: boolean } {
  const connection = activeConnections.get(ocppIdentity);
  const state = persistentStates.get(ocppIdentity);
  
  // Remover la conexión WebSocket activa (el socket ya está cerrado)
  activeConnections.delete(ocppIdentity);
  
  if (!state) {
    // Sin estado persistente, es una desconexión de algo que no rastreábamos
    return { isGracePeriod: false, wasSeamless: false };
  }
  
  // Actualizar estado persistente con los últimos datos de la conexión
  if (connection) {
    state.stationId = connection.stationId;
    state.connectorStatuses = connection.connectorStatuses;
    state.bootInfo = connection.bootInfo;
    state.lastHeartbeat = connection.lastHeartbeat;
    state.lastMessage = connection.lastMessage;
  }
  
  // Marcar como en grace period
  state.isInGracePeriod = true;
  state.gracePeriodStart = new Date();
  
  // Cancelar timer anterior si existe
  const existingTimer = gracePeriodTimers.get(ocppIdentity);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Iniciar grace period timer
  const graceTimer = setTimeout(() => {
    // Grace period expiró sin reconexión → desconexión REAL
    const expiredState = persistentStates.get(ocppIdentity);
    if (expiredState && expiredState.isInGracePeriod) {
      console.log(`[OCPP Manager] ❌ Grace period expired for ${ocppIdentity} - REAL DISCONNECTION ` +
        `(was connected for ${Math.round((Date.now() - expiredState.originalConnectedAt.getTime()) / 1000)}s, ` +
        `${expiredState.seamlessReconnections} seamless reconnections)`);
      
      // Registrar como desconexión REAL en el historial
      recordSessionEvent(
        ocppIdentity, 
        expiredState.originalConnectedAt, 
        closeCode, 
        closeReason, 
        false  // NO es seamless, es desconexión real
      );
      
      // Limpiar estado persistente
      persistentStates.delete(ocppIdentity);
    }
    gracePeriodTimers.delete(ocppIdentity);
  }, GRACE_PERIOD_MS);
  
  gracePeriodTimers.set(ocppIdentity, graceTimer);
  
  console.log(`[OCPP Manager] 🔄 Grace period started for ${ocppIdentity} (${GRACE_PERIOD_MS / 1000}s) - ` +
    `closeCode=${closeCode}, seamlessReconnections=${state.seamlessReconnections}`);
  
  return { isGracePeriod: true, wasSeamless: false };
}

/**
 * Registrar un evento de sesión en el historial
 */
function recordSessionEvent(
  ocppIdentity: string,
  connectedAt: Date,
  closeCode: number | null,
  closeReason: string,
  wasSeamless: boolean
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
    wasSeamless,
  };
  
  if (!connectionHistory.has(ocppIdentity)) {
    connectionHistory.set(ocppIdentity, []);
  }
  const history = connectionHistory.get(ocppIdentity)!;
  history.push(session);
  
  if (history.length > MAX_HISTORY_PER_STATION) {
    history.splice(0, history.length - MAX_HISTORY_PER_STATION);
  }
}

// Mantener compatibilidad con el código existente
export function recordDisconnection(
  ocppIdentity: string,
  connectedAt: Date,
  closeCode: number | null = null,
  closeReason: string = ''
): void {
  // Ya no registra directamente - handleDisconnection maneja esto
  // Esta función se mantiene por compatibilidad pero es un no-op
  // El registro real ocurre en handleDisconnection y al expirar el grace period
}

// ============================================================================
// CONSULTAS DE ESTADO
// ============================================================================

/**
 * Obtener historial de conexiones de una estación
 */
export function getConnectionHistory(ocppIdentity: string): ConnectionSession[] {
  return connectionHistory.get(ocppIdentity) || [];
}

/**
 * Verificar si una estación está en grace period (reconectándose)
 */
export function isInGracePeriod(ocppIdentity: string): boolean {
  const state = persistentStates.get(ocppIdentity);
  return state?.isInGracePeriod === true;
}

/**
 * Obtener el estado persistente de una estación (incluso durante grace period)
 */
export function getPersistentState(ocppIdentity: string): PersistentState | undefined {
  return persistentStates.get(ocppIdentity);
}

/**
 * Obtener monitoreo de estabilidad de conexión para todas las estaciones
 */
export function getConnectionStabilityReport(): Array<{
  ocppIdentity: string;
  stationId: number | null;
  isConnected: boolean;
  isReconnecting: boolean;  // true = en grace period, esperando reconexión
  currentUptimeSeconds: number;
  connectedAt: string | null;
  lastHeartbeat: string | null;
  lastMessage: string | null;
  reconnectionCount24h: number;      // Solo desconexiones REALES en 24h
  seamlessReconnections: number;     // Reconexiones transparentes totales
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
  
  // Obtener todas las estaciones que tienen historial, conexión activa, o estado persistente
  const allIdentities = new Set<string>();
  Array.from(activeConnections.keys()).forEach(key => allIdentities.add(key));
  Array.from(connectionHistory.keys()).forEach(key => allIdentities.add(key));
  Array.from(persistentStates.keys()).forEach(key => allIdentities.add(key));
  
  for (const ocppIdentity of Array.from(allIdentities)) {
    const conn = activeConnections.get(ocppIdentity);
    const state = persistentStates.get(ocppIdentity);
    const history = connectionHistory.get(ocppIdentity) || [];
    
    // Filtrar solo desconexiones REALES en las últimas 24h (no seamless)
    const realDisconnections24h = history.filter(s => 
      !s.wasSeamless && 
      s.disconnectedAt && 
      s.disconnectedAt.getTime() > twentyFourHoursAgo
    );
    
    // Calcular estadísticas de duración (solo sesiones reales)
    const realSessions = history.filter(s => !s.wasSeamless && s.durationSeconds !== null);
    const durations = realSessions.map(s => s.durationSeconds!);
    
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) 
      : 0;
    const longestSession = durations.length > 0 ? Math.max(...durations) : 0;
    const shortestSession = durations.length > 0 ? Math.min(...durations) : 0;
    
    // Última desconexión REAL
    const realDisconnections = history.filter(s => !s.wasSeamless);
    const lastRealDisconnection = realDisconnections.length > 0 
      ? realDisconnections[realDisconnections.length - 1] 
      : null;
    
    // Uptime: usar originalConnectedAt del estado persistente si existe
    const effectiveConnectedAt = state?.originalConnectedAt || conn?.connectedAt;
    const currentUptime = effectiveConnectedAt 
      ? Math.round((now - effectiveConnectedAt.getTime()) / 1000) 
      : 0;
    
    const isConnected = !!conn && conn.ws.readyState === WebSocket.OPEN;
    const isReconnecting = state?.isInGracePeriod === true;
    
    // Score de estabilidad mejorado:
    // - Solo penaliza por desconexiones REALES (no seamless)
    // - Bonus por reconexiones seamless exitosas
    let stabilityScore = 100;
    // Penalizar por desconexiones REALES: -10 por cada una en 24h (max -50)
    stabilityScore -= Math.min(realDisconnections24h.length * 10, 50);
    // Penalizar si no está conectado Y no está en grace period: -15
    if (!isConnected && !isReconnecting) stabilityScore -= 15;
    // Bonus por uptime largo (> 1 hora): +10
    if (currentUptime > 3600) stabilityScore = Math.min(stabilityScore + 10, 100);
    // Bonus por reconexiones seamless exitosas (sistema funciona bien): +5
    if (state && state.seamlessReconnections > 0) stabilityScore = Math.min(stabilityScore + 5, 100);
    stabilityScore = Math.max(0, Math.min(100, stabilityScore));
    
    results.push({
      ocppIdentity,
      stationId: state?.stationId || conn?.stationId || null,
      isConnected,
      isReconnecting,
      currentUptimeSeconds: currentUptime,
      connectedAt: effectiveConnectedAt?.toISOString() || null,
      lastHeartbeat: (conn?.lastHeartbeat || state?.lastHeartbeat)?.toISOString() || null,
      lastMessage: (conn?.lastMessage || state?.lastMessage)?.toISOString() || null,
      reconnectionCount24h: realDisconnections24h.length,
      seamlessReconnections: state?.seamlessReconnections || 0,
      avgSessionDurationSeconds: avgDuration,
      longestSessionSeconds: longestSession,
      shortestSessionSeconds: shortestSession,
      lastDisconnection: lastRealDisconnection?.disconnectedAt?.toISOString() || null,
      lastCloseCode: lastRealDisconnection?.closeCode || null,
      stabilityScore,
    });
  }
  
  // Ordenar: conectados primero, luego reconectando, luego por score
  results.sort((a, b) => {
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    if (a.isReconnecting !== b.isReconnecting) return a.isReconnecting ? -1 : 1;
    return b.stabilityScore - a.stabilityScore;
  });
  
  return results;
}

// ============================================================================
// OPERACIONES DE CONEXIÓN
// ============================================================================

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
  }
  // También actualizar estado persistente
  const state = persistentStates.get(ocppIdentity);
  if (state) {
    state.bootInfo = bootInfo;
    state.stationId = stationId;
    state.lastMessage = new Date();
  }
  console.log(`[OCPP Manager] Updated boot info for ${ocppIdentity}:`, bootInfo);
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
  const state = persistentStates.get(ocppIdentity);
  if (state) {
    state.lastHeartbeat = new Date();
    state.lastMessage = new Date();
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
  }
  // También actualizar estado persistente
  const state = persistentStates.get(ocppIdentity);
  if (state) {
    state.connectorStatuses.set(connectorId, status);
    state.lastMessage = new Date();
  }
  console.log(`[OCPP Manager] ${ocppIdentity} connector ${connectorId} status: ${status}`);
}

/**
 * Actualizar timestamp del último mensaje
 */
export function updateLastMessage(ocppIdentity: string): void {
  const connection = activeConnections.get(ocppIdentity);
  if (connection) {
    connection.lastMessage = new Date();
  }
  const state = persistentStates.get(ocppIdentity);
  if (state) {
    state.lastMessage = new Date();
  }
}

/**
 * Eliminar una conexión (solo para limpieza manual, NO usar en close handler)
 */
export function removeConnection(ocppIdentity: string): void {
  activeConnections.delete(ocppIdentity);
  // NO eliminar estado persistente aquí - handleDisconnection lo maneja
  console.log(`[OCPP Manager] Removed active connection: ${ocppIdentity}`);
}

/**
 * Obtener una conexión por identidad
 */
export function getConnection(ocppIdentity: string): OcppConnection | undefined {
  return activeConnections.get(ocppIdentity);
}

/**
 * Obtener todas las conexiones activas (para API).
 * Incluye estaciones en grace period como "reconectando".
 */
export function getAllConnections(): OcppConnectionInfo[] {
  const connections: OcppConnectionInfo[] = [];
  
  // Conexiones activas
  for (const [identity, conn] of Array.from(activeConnections.entries())) {
    const state = persistentStates.get(identity);
    connections.push({
      ocppIdentity: identity,
      ocppVersion: conn.ocppVersion,
      stationId: conn.stationId,
      connectedAt: (state?.originalConnectedAt || conn.connectedAt).toISOString(),
      lastHeartbeat: conn.lastHeartbeat.toISOString(),
      lastMessage: conn.lastMessage.toISOString(),
      connectorStatuses: Object.fromEntries(conn.connectorStatuses),
      bootInfo: conn.bootInfo,
      isConnected: conn.ws.readyState === WebSocket.OPEN,
      seamlessReconnections: state?.seamlessReconnections || 0,
      lastSeamlessReconnect: state?.lastSeamlessReconnect?.toISOString() || null,
    });
  }
  
  // Estaciones en grace period (reconectando) - mostrar como "reconectando"
  for (const [identity, state] of Array.from(persistentStates.entries())) {
    if (state.isInGracePeriod && !activeConnections.has(identity)) {
      connections.push({
        ocppIdentity: identity,
        ocppVersion: state.ocppVersion,
        stationId: state.stationId,
        connectedAt: state.originalConnectedAt.toISOString(),
        lastHeartbeat: state.lastHeartbeat.toISOString(),
        lastMessage: state.lastMessage.toISOString(),
        connectorStatuses: Object.fromEntries(state.connectorStatuses),
        bootInfo: state.bootInfo,
        isConnected: false,  // No está conectado pero está reconectando
        seamlessReconnections: state.seamlessReconnections,
        lastSeamlessReconnect: state.lastSeamlessReconnect?.toISOString() || null,
      });
    }
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
  reconnectingCount: number;
  disconnectedCount: number;
  byVersion: Record<string, number>;
  totalSeamlessReconnections: number;
} {
  let connectedCount = 0;
  let reconnectingCount = 0;
  let disconnectedCount = 0;
  let totalSeamless = 0;
  const byVersion: Record<string, number> = {};
  
  for (const conn of Array.from(activeConnections.values())) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      connectedCount++;
    } else {
      disconnectedCount++;
    }
    byVersion[conn.ocppVersion] = (byVersion[conn.ocppVersion] || 0) + 1;
  }
  
  // Contar estaciones en grace period
  for (const [identity, state] of Array.from(persistentStates.entries())) {
    if (state.isInGracePeriod && !activeConnections.has(identity)) {
      reconnectingCount++;
    }
    totalSeamless += state.seamlessReconnections;
  }
  
  return {
    totalConnections: activeConnections.size + reconnectingCount,
    connectedCount,
    reconnectingCount,
    disconnectedCount,
    byVersion,
    totalSeamlessReconnections: totalSeamless,
  };
}
