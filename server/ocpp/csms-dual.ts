/**
 * CSMS (Charging Station Management System) - Servidor OCPP Dual (1.6J y 2.0.1)
 * 
 * Este módulo implementa un servidor CSMS compatible con OCPP 1.6J y OCPP 2.0.1
 * para comunicación bidireccional con estaciones de carga de vehículos eléctricos.
 * 
 * La detección de protocolo se realiza automáticamente basándose en el subprotocolo
 * WebSocket negociado durante la conexión.
 * 
 * Cumple con la Resolución 40559 de 2025 del Ministerio de Minas y Energía de Colombia.
 */

import { WebSocketServer, WebSocket } from "ws";
import * as db from "../db";
import { nanoid } from "nanoid";
import { findPendingSessionByOcppIdentity, removePendingSession, setActiveSession, getActiveSessionById, removeActiveSession } from "../charging/charging-router";
import { sendChargingCompleteNotification } from "../firebase/fcm";
import * as alertsService from "./alerts-service";
import mysql from "mysql2/promise";

// BUILD VERSION para diagnóstico de deploys
const BUILD_VERSION = "v2026.02.18.B";
console.log(`[CSMS-DUAL] Module loaded, BUILD_VERSION=${BUILD_VERSION}`);

/**
 * Fallback: resolver stationId usando SQL directo (sin Drizzle)
 * Esto es un safety net en caso de que Drizzle/getDb falle silenciosamente
 */
async function resolveStationIdDirectSQL(ocppIdentity: string): Promise<{id: number; name: string} | null> {
  if (!process.env.DATABASE_URL) {
    console.error(`[CSMS-DUAL] resolveStationIdDirectSQL: DATABASE_URL not set`);
    return null;
  }
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [rows] = await conn.query(
      'SELECT id, name FROM charging_stations WHERE ocppIdentity = ? LIMIT 1',
      [ocppIdentity]
    ) as any;
    if (rows && rows.length > 0) {
      return { id: rows[0].id, name: rows[0].name };
    }
    return null;
  } catch (err) {
    console.error(`[CSMS-DUAL] resolveStationIdDirectSQL FAILED for "${ocppIdentity}":`, err);
    return null;
  } finally {
    if (conn) {
      try { await conn.end(); } catch (e) { /* ignore */ }
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

type OCPPVersion = "1.6" | "2.0.1";

interface ChargingStationConnection {
  ws: WebSocket;
  stationId: number | null;
  ocppIdentity: string;
  ocppVersion: OCPPVersion;
  connectedAt: Date;
  lastHeartbeat: Date;
  messageIdCounter: number;
  pendingCalls: Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }>;
}

// OCPP Message Types
const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

// ============================================================================
// OCPP 1.6J MESSAGE INTERFACES
// ============================================================================

interface OCPP16BootNotificationRequest {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterType?: string;
  meterSerialNumber?: string;
}

interface OCPP16StartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp: string;
  reservationId?: number;
}

interface OCPP16StopTransactionRequest {
  idTag?: string;
  meterStop: number;
  timestamp: string;
  transactionId: number;
  reason?: string;
  transactionData?: Array<{
    timestamp: string;
    sampledValue: Array<{
      value: string;
      context?: string;
      format?: string;
      measurand?: string;
      phase?: string;
      location?: string;
      unit?: string;
    }>;
  }>;
}

interface OCPP16StatusNotificationRequest {
  connectorId: number;
  errorCode: string;
  status: string;
  timestamp?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

interface OCPP16MeterValuesRequest {
  connectorId: number;
  transactionId?: number;
  meterValue: Array<{
    timestamp: string;
    sampledValue: Array<{
      value: string;
      context?: string;
      format?: string;
      measurand?: string;
      phase?: string;
      location?: string;
      unit?: string;
    }>;
  }>;
}

interface OCPP16AuthorizeRequest {
  idTag: string;
}

interface OCPP16HeartbeatRequest {
  // Empty
}

// ============================================================================
// OCPP 2.0.1 MESSAGE INTERFACES
// ============================================================================

interface OCPP201BootNotificationRequest {
  chargingStation: {
    serialNumber?: string;
    model: string;
    vendorName: string;
    firmwareVersion?: string;
    modem?: {
      iccid?: string;
      imsi?: string;
    };
  };
  reason: string;
}

interface OCPP201TransactionEventRequest {
  eventType: "Started" | "Updated" | "Ended";
  timestamp: string;
  triggerReason: string;
  seqNo: number;
  transactionInfo: {
    transactionId: string;
    chargingState?: string;
    timeSpentCharging?: number;
    stoppedReason?: string;
    remoteStartId?: number;
  };
  evse?: {
    id: number;
    connectorId?: number;
  };
  idToken?: {
    idToken: string;
    type: string;
  };
  meterValue?: Array<{
    timestamp: string;
    sampledValue: Array<{
      value: number;
      context?: string;
      measurand?: string;
      phase?: string;
      location?: string;
      unit?: string;
    }>;
  }>;
}

interface OCPP201StatusNotificationRequest {
  timestamp: string;
  connectorStatus: string;
  evseId: number;
  connectorId: number;
}

interface OCPP201MeterValuesRequest {
  evseId: number;
  meterValue: Array<{
    timestamp: string;
    sampledValue: Array<{
      value: number;
      context?: string;
      measurand?: string;
      phase?: string;
      location?: string;
      unit?: string;
    }>;
  }>;
}

// ============================================================================
// DUAL CSMS CLASS
// ============================================================================

export class DualCSMS {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ChargingStationConnection> = new Map();
  private heartbeatInterval: number = 30; // segundos (reducido de 60 para mantener proxy activo)
  private isRunning: boolean = false;
  private transactionIdCounter: number = 1;
  private ocpp16Transactions: Map<number, string> = new Map(); // OCPP 1.6 transactionId -> internal transactionId
  private reconnectionGrace: Map<string, NodeJS.Timeout> = new Map(); // Grace period para reconexión
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map(); // Ping keepalive intervals
  private static GRACE_PERIOD_MS = 300000; // 5 minutos de gracia para reconexión (evitar notificaciones por desconexiones temporales)
  private static PING_INTERVAL_MS = 20000; // Ping cada 20 segundos (debe ser < timeout del proxy ~120-180s)

  constructor() {
    // Initialize
  }

  /**
   * Inicia el servidor CSMS dual en el puerto especificado
   */
  async start(port: number = 9000): Promise<void> {
    if (this.isRunning) {
      console.log("[CSMS-DUAL] Server already running");
      return;
    }

    this.wss = new WebSocketServer({ 
      port,
      handleProtocols: (protocols: Set<string>) => {
        // Priorizar OCPP 2.0.1, pero aceptar 1.6J si es lo único disponible
        if (protocols.has("ocpp2.0.1")) {
          return "ocpp2.0.1";
        }
        if (protocols.has("ocpp2.0")) {
          return "ocpp2.0";
        }
        if (protocols.has("ocpp1.6")) {
          return "ocpp1.6";
        }
        // Default a 1.6 para compatibilidad máxima
        return "ocpp1.6";
      }
    });

    this.wss.on("connection", async (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const ocppIdentity = url.pathname.split("/").pop() || "";
      const protocol = ws.protocol || "ocpp1.6";
      const ocppVersion: OCPPVersion = protocol.includes("2.0") ? "2.0.1" : "1.6";

      console.log(`[CSMS-DUAL] New ${ocppVersion} connection from: ${ocppIdentity}`);

      // Si hay un grace period activo para este cargador, cancelarlo (reconexión exitosa)
      const existingGrace = this.reconnectionGrace.get(ocppIdentity);
      if (existingGrace) {
        clearTimeout(existingGrace);
        this.reconnectionGrace.delete(ocppIdentity);
        console.log(`[CSMS-DUAL] Reconnection within grace period for: ${ocppIdentity}`);
      }

      // Limpiar ping interval anterior si existe
      const existingPing = this.pingIntervals.get(ocppIdentity);
      if (existingPing) {
        clearInterval(existingPing);
        this.pingIntervals.delete(ocppIdentity);
      }

      // PRE-RESOLVER stationId INMEDIATAMENTE en la conexión
      // Esto es CRÍTICO: si esperamos a handleCall, puede fallar silenciosamente
      console.log(`[CSMS-DUAL][${BUILD_VERSION}] Pre-resolving stationId for "${ocppIdentity}"...`);
      let preResolvedStationId: number | null = null;
      
      // INTENTO 1: Drizzle ORM
      try {
        const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
        if (station) {
          preResolvedStationId = station.id;
          console.log(`[CSMS-DUAL] Pre-resolved via Drizzle: stationId=${station.id} for ${ocppIdentity}`);
          await db.updateChargingStation(station.id, { isOnline: true });
        } else {
          console.warn(`[CSMS-DUAL] Drizzle returned null for ocppIdentity="${ocppIdentity}"`);
        }
      } catch (err) {
        console.error(`[CSMS-DUAL] Drizzle pre-resolve FAILED for ${ocppIdentity}:`, err);
      }
      
      // INTENTO 2: SQL directo (fallback si Drizzle falló)
      if (!preResolvedStationId) {
        console.log(`[CSMS-DUAL] Trying direct SQL fallback for "${ocppIdentity}"...`);
        const directResult = await resolveStationIdDirectSQL(ocppIdentity);
        if (directResult) {
          preResolvedStationId = directResult.id;
          console.log(`[CSMS-DUAL] Pre-resolved via direct SQL: stationId=${directResult.id} (${directResult.name}) for ${ocppIdentity}`);
          // Intentar marcar online también
          try {
            await db.updateChargingStation(directResult.id, { isOnline: true });
          } catch (e) {
            console.warn(`[CSMS-DUAL] Could not mark station online via Drizzle, but stationId is resolved`);
          }
        } else {
          console.error(`[CSMS-DUAL] BOTH Drizzle AND direct SQL failed to resolve stationId for "${ocppIdentity}"`);
        }
      }

      // Registrar la conexión con stationId ya resuelto
      const connection: ChargingStationConnection = {
        ws,
        stationId: preResolvedStationId,
        ocppIdentity,
        ocppVersion,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        messageIdCounter: 0,
        pendingCalls: new Map(),
      };
      this.connections.set(ocppIdentity, connection);

      // Configurar ping keepalive para mantener la conexión activa
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
          this.pingIntervals.delete(ocppIdentity);
        }
      }, DualCSMS.PING_INTERVAL_MS);
      this.pingIntervals.set(ocppIdentity, pingInterval);

      // ANTI-PROXY-TIMEOUT: Enviar TriggerMessage(Heartbeat) cada 90s para generar tráfico de datos reales
      // Los frames de control (ping/pong) NO resetean el proxy_read_timeout en muchos proxies
      let dualKeepaliveCount = 0;
      const ocppKeepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          dualKeepaliveCount++;
          try {
            const msgId = `keepalive-dual-${Date.now()}-${dualKeepaliveCount}`;
            const triggerMsg = JSON.stringify([2, msgId, "TriggerMessage", { requestedMessage: "Heartbeat" }]);
            ws.send(triggerMsg);
          } catch (err) {
            console.error(`[CSMS-DUAL] Error sending keepalive to ${ocppIdentity}:`, err);
          }
        } else {
          clearInterval(ocppKeepalive);
        }
      }, 90000); // 90 segundos
      // Limpiar en close
      ws.on("close", () => clearInterval(ocppKeepalive));

      // Configurar pong handler para actualizar lastHeartbeat
      ws.on("pong", () => {
        const conn = this.connections.get(ocppIdentity);
        if (conn) {
          conn.lastHeartbeat = new Date();
        }
      });

      // Manejar mensajes
      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ocppIdentity, message);
        } catch (error) {
          console.error(`[CSMS-DUAL] Error parsing message from ${ocppIdentity}:`, error);
        }
      });

      // Manejar desconexión
      ws.on("close", () => {
        console.log(`[CSMS-DUAL] Connection closed: ${ocppIdentity}`);
        this.handleDisconnection(ocppIdentity);
      });

      ws.on("error", (error) => {
        console.error(`[CSMS-DUAL] WebSocket error from ${ocppIdentity}:`, error);
      });

      // Log de conexión (incluir stationId resuelto)
      await db.createOcppLog({
        ocppIdentity,
        stationId: preResolvedStationId,
        direction: "IN",
        messageType: "CONNECTION",
        payload: { url: req.url, protocol, ocppVersion, preResolvedStationId },
      });
    });

    this.isRunning = true;
    console.log(`[CSMS-DUAL] OCPP 1.6J/2.0.1 Dual Server started on port ${port}`);
  }

  /**
   * Detiene el servidor CSMS
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.wss) {
      return;
    }

    // Cerrar todas las conexiones
    for (const [identity, conn] of Array.from(this.connections.entries())) {
      try {
        conn.ws.close();
        // Limpiar pending calls
        conn.pendingCalls.forEach((pending) => {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Server shutting down"));
        });
      } catch (e) {
        console.error(`[CSMS-DUAL] Error closing connection ${identity}:`, e);
      }
    }

    this.connections.clear();

    // Cerrar el servidor WebSocket
    await new Promise<void>((resolve) => {
      this.wss?.close(() => {
        resolve();
      });
    });

    this.isRunning = false;
    console.log("[CSMS-DUAL] Server stopped");
  }

  /**
   * Maneja un mensaje OCPP entrante
   */
  private async handleMessage(ocppIdentity: string, message: any[]): Promise<void> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) return;

    const messageType = message[0];

    if (messageType === CALL) {
      // [2, messageId, action, payload]
      const [, messageId, action, payload] = message;
      await this.handleCall(conn, messageId, action, payload);
    } else if (messageType === CALLRESULT) {
      // [3, messageId, payload]
      const [, messageId, payload] = message;
      this.handleCallResult(conn, messageId, payload);
    } else if (messageType === CALLERROR) {
      // [4, messageId, errorCode, errorDescription, errorDetails]
      const [, messageId, errorCode, errorDescription] = message;
      this.handleCallError(conn, messageId, errorCode, errorDescription);
    }
  }

  /**
   * Maneja una llamada OCPP (CALL)
   */
  private async handleCall(conn: ChargingStationConnection, messageId: string, action: string, payload: any): Promise<void> {
    let response: any;

    try {
      // AUTO-RESOLUCIÓN REDUNDANTE: Si conn.stationId sigue null (no se resolvió en conexión),
      // intentar de nuevo con Drizzle + fallback SQL directo.
      if (!conn.stationId && action !== "BootNotification") {
        console.log(`[CSMS-DUAL][${BUILD_VERSION}] stationId is null for ${conn.ocppIdentity} on action=${action}, attempting auto-resolve...`);
        
        // Intento 1: Drizzle
        try {
          const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
          if (station) {
            conn.stationId = station.id;
            console.log(`[CSMS-DUAL] handleCall auto-resolved via Drizzle: stationId=${station.id} for ${conn.ocppIdentity}`);
            await db.updateChargingStation(station.id, { isOnline: true });
          } else {
            console.warn(`[CSMS-DUAL] handleCall Drizzle returned null for "${conn.ocppIdentity}"`);
          }
        } catch (resolveErr) {
          console.error(`[CSMS-DUAL] handleCall Drizzle auto-resolve failed:`, resolveErr);
        }
        
        // Intento 2: SQL directo
        if (!conn.stationId) {
          console.log(`[CSMS-DUAL] handleCall trying direct SQL fallback for "${conn.ocppIdentity}"...`);
          const directResult = await resolveStationIdDirectSQL(conn.ocppIdentity);
          if (directResult) {
            conn.stationId = directResult.id;
            console.log(`[CSMS-DUAL] handleCall auto-resolved via direct SQL: stationId=${directResult.id} for ${conn.ocppIdentity}`);
            try { await db.updateChargingStation(directResult.id, { isOnline: true }); } catch (e) { /* ignore */ }
          } else {
            console.error(`[CSMS-DUAL] handleCall BOTH methods failed for "${conn.ocppIdentity}" on action=${action}`);
          }
        }
      }

      await db.createOcppLog({
        ocppIdentity: conn.ocppIdentity,
        stationId: conn.stationId,
        direction: "IN",
        messageType: action,
        payload,
      });

      if (conn.ocppVersion === "1.6") {
        response = await this.handleOCPP16Call(conn, action, payload);
      } else {
        response = await this.handleOCPP201Call(conn, action, payload);
      }

      // Enviar respuesta
      this.sendCallResult(conn, messageId, response);

      await db.createOcppLog({
        ocppIdentity: conn.ocppIdentity,
        stationId: conn.stationId,
        direction: "OUT",
        messageType: action,
        payload: response,
      });
    } catch (error: any) {
      console.error(`[CSMS-DUAL] Error handling ${action}:`, error);
      this.sendCallError(conn, messageId, "InternalError", error.message || "Internal error");
    }
  }

  /**
   * Maneja llamadas OCPP 1.6J
   */
  private async handleOCPP16Call(conn: ChargingStationConnection, action: string, payload: any): Promise<any> {
    switch (action) {
      case "BootNotification":
        return this.handleOCPP16BootNotification(conn, payload as OCPP16BootNotificationRequest);
      case "Heartbeat":
        return this.handleHeartbeat(conn);
      case "StatusNotification":
        return this.handleOCPP16StatusNotification(conn, payload as OCPP16StatusNotificationRequest);
      case "Authorize":
        return this.handleOCPP16Authorize(conn, payload as OCPP16AuthorizeRequest);
      case "StartTransaction":
        return this.handleOCPP16StartTransaction(conn, payload as OCPP16StartTransactionRequest);
      case "StopTransaction":
        return this.handleOCPP16StopTransaction(conn, payload as OCPP16StopTransactionRequest);
      case "MeterValues":
        return this.handleOCPP16MeterValues(conn, payload as OCPP16MeterValuesRequest);
      case "DataTransfer":
        return { status: "Accepted" };
      case "DiagnosticsStatusNotification":
        return {};
      case "FirmwareStatusNotification":
        return this.handleFirmwareStatusNotification(conn, payload);
      default:
        console.warn(`[CSMS-DUAL] Unknown OCPP 1.6 action: ${action}`);
        return {};
    }
  }

  /**
   * Maneja llamadas OCPP 2.0.1
   */
  private async handleOCPP201Call(conn: ChargingStationConnection, action: string, payload: any): Promise<any> {
    switch (action) {
      case "BootNotification":
        return this.handleOCPP201BootNotification(conn, payload as OCPP201BootNotificationRequest);
      case "Heartbeat":
        return this.handleHeartbeat(conn);
      case "StatusNotification":
        return this.handleOCPP201StatusNotification(conn, payload as OCPP201StatusNotificationRequest);
      case "TransactionEvent":
        return this.handleOCPP201TransactionEvent(conn, payload as OCPP201TransactionEventRequest);
      case "MeterValues":
        return this.handleOCPP201MeterValues(conn, payload as OCPP201MeterValuesRequest);
      case "Authorize": {
        const authReq = payload as any;
        const idToken = authReq?.idToken?.idToken || authReq?.idTag || "";
        console.log(`[CSMS-DUAL] OCPP 2.0.1 Authorize from ${conn.ocppIdentity}: idToken="${idToken}"`);
        if (idToken) {
          try {
            const validation = await db.validateIdTag(idToken);
            if (validation.valid) {
              console.log(`[CSMS-DUAL] Authorize 2.0.1: idToken "${idToken}" ACCEPTED (userId=${validation.userId})`);
              if (conn.stationId) await db.recordIdTagUsage(idToken, conn.stationId);
            } else {
              console.warn(`[CSMS-DUAL] Authorize 2.0.1: idToken "${idToken}" not found (${validation.reason}). ACCEPTING in permissive mode.`);
            }
          } catch (e) { /* no-op, accept anyway */ }
        }
        return { idTokenInfo: { status: "Accepted" } };
      }
      case "NotifyReport":
        return {};
      case "NotifyEvent":
        return {};
      case "LogStatusNotification":
        return {};
      case "FirmwareStatusNotification":
        return this.handleFirmwareStatusNotification(conn, payload);
      case "SecurityEventNotification":
        return {};
      default:
        console.warn(`[CSMS-DUAL] Unknown OCPP 2.0.1 action: ${action}`);
        return {};
    }
  }

  // ============================================================================
  // OCPP 1.6J HANDLERS
  // ============================================================================

  private async handleOCPP16BootNotification(conn: ChargingStationConnection, req: OCPP16BootNotificationRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 BootNotification from ${conn.ocppIdentity}:`, req);

    let station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);

    if (station) {
      await db.updateChargingStation(station.id, {
        isOnline: true,
        manufacturer: req.chargePointVendor,
        model: req.chargePointModel,
        serialNumber: req.chargePointSerialNumber || req.chargeBoxSerialNumber,
        firmwareVersion: req.firmwareVersion,
        lastBootNotification: new Date(),
      });
      conn.stationId = station.id;
    }

    return {
      currentTime: new Date().toISOString(),
      interval: this.heartbeatInterval,
      status: station ? "Accepted" : "Pending",
    };
  }

  private async handleOCPP16StatusNotification(conn: ChargingStationConnection, req: OCPP16StatusNotificationRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 StatusNotification from ${conn.ocppIdentity}: connector=${req.connectorId}, status=${req.status}, errorCode=${req.errorCode}`);

    // Resolver stationId si no está asignado aún
    let stationId = conn.stationId;
    if (!stationId && conn.ocppIdentity) {
      try {
        const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
        if (station) {
          stationId = station.id;
          conn.stationId = station.id;
          console.log(`[CSMS-DUAL] StatusNotification: Resolved stationId=${stationId} from ocppIdentity=${conn.ocppIdentity}`);
        }
      } catch (err) {
        console.error(`[CSMS-DUAL] StatusNotification: Failed to resolve stationId for ${conn.ocppIdentity}:`, err);
      }
    }

    if (stationId && req.connectorId > 0) {
      const evses = await db.getEvsesByStationId(stationId);
      const evse = evses.find((e: any) => e.evseIdLocal === req.connectorId);

      if (evse) {
        // Mapeo CORRECTO: cada estado OCPP 1.6 se mapea a su equivalente exacto en BD
        const statusMap: Record<string, string> = {
          Available: "AVAILABLE",
          Preparing: "PREPARING",       // Cable conectado, esperando autorización
          Charging: "CHARGING",         // Cargando activamente
          SuspendedEV: "SUSPENDED_EV",  // Suspendido por el vehículo
          SuspendedEVSE: "SUSPENDED_EVSE", // Suspendido por el cargador
          Finishing: "FINISHING",        // Carga terminada, cable aún conectado
          Reserved: "RESERVED",
          Unavailable: "UNAVAILABLE",
          Faulted: "FAULTED",
        };
        const newStatus = (statusMap[req.status] || "UNAVAILABLE") as "AVAILABLE" | "PREPARING" | "CHARGING" | "SUSPENDED_EVSE" | "SUSPENDED_EV" | "FINISHING" | "RESERVED" | "UNAVAILABLE" | "FAULTED";
        const oldStatus = evse.status;
        
        // NO sobreescribir RESERVED→AVAILABLE si hay una reserva activa para este EVSE
        if (newStatus === "AVAILABLE" && oldStatus === "RESERVED") {
          const activeRes = await db.getActiveReservation(evse.id);
          if (activeRes) {
            console.log(`[CSMS-DUAL] StatusNotification: Ignoring AVAILABLE for EVSE ${evse.id} - has active reservation #${activeRes.id}`);
            return {};
          }
        }
        
        await db.updateEvseStatus(evse.id, newStatus);
        console.log(`[CSMS-DUAL] StatusNotification: EVSE ${evse.id} (connector ${req.connectorId}) status changed: ${oldStatus} → ${newStatus}`);

        // Si el conector pasa a Preparing, actualizar también isOnline de la estación
        if (req.status === "Preparing" || req.status === "Charging") {
          try {
            await db.updateChargingStation(stationId, { isOnline: true });
          } catch (e) {
            // No es crítico
          }
        }

        // Si hay una sesión pendiente y el cargador reporta Preparing o Charging,
        // esto confirma que el vehículo se conectó correctamente
        if (req.status === "Charging" || req.status === "SuspendedEV" || req.status === "SuspendedEVSE") {
          // Verificar si hay una transacción activa para este EVSE y actualizar su estado
          try {
            const activeTx = await db.getActiveTransaction(evse.id);
            if (activeTx && activeTx.status === "PENDING") {
              await db.updateTransaction(activeTx.id, { status: "IN_PROGRESS" });
              console.log(`[CSMS-DUAL] StatusNotification: Transaction ${activeTx.id} promoted from PENDING to IN_PROGRESS (charger is ${req.status})`);
            }
          } catch (e) {
            console.error(`[CSMS-DUAL] StatusNotification: Error updating transaction status:`, e);
          }
        }

        // === OVERSTAY MONITOR: detectar Finishing y Available ===
        if (req.status === "Finishing" && stationId) {
          try {
            const { onChargingFinished } = await import("../charging/overstay-monitor");
            await onChargingFinished(evse.id, stationId);
            console.log(`[CSMS-DUAL] StatusNotification: Overstay tracking started for EVSE ${evse.id}`);
          } catch (e) {
            console.error(`[CSMS-DUAL] StatusNotification: Error starting overstay tracking:`, e);
          }
        }
        if (req.status === "Available" && oldStatus === "FINISHING") {
          try {
            const { onCableDisconnected } = await import("../charging/overstay-monitor");
            await onCableDisconnected(evse.id);
            console.log(`[CSMS-DUAL] StatusNotification: Overstay finalized for EVSE ${evse.id} (cable disconnected)`);
          } catch (e) {
            console.error(`[CSMS-DUAL] StatusNotification: Error finalizing overstay:`, e);
          }
        }

        // Generar alerta si hay error
        if (req.errorCode && req.errorCode !== "NoError") {
          console.warn(`[CSMS-DUAL] StatusNotification: Error reported by ${conn.ocppIdentity} connector ${req.connectorId}: ${req.errorCode} - ${req.info || ''}`);
        }
      } else {
        console.warn(`[CSMS-DUAL] StatusNotification: EVSE not found for stationId=${stationId}, connectorId=${req.connectorId}`);
      }
    } else if (req.connectorId === 0) {
      // ConnectorId 0 = estado general del cargador (no de un conector específico)
      console.log(`[CSMS-DUAL] StatusNotification: General station status for ${conn.ocppIdentity}: ${req.status}`);
      if (stationId) {
        try {
          const isOnline = req.status !== "Unavailable" && req.status !== "Faulted";
          await db.updateChargingStation(stationId, { isOnline });
        } catch (e) {
          // No es crítico
        }
      }
    } else {
      console.warn(`[CSMS-DUAL] StatusNotification: Cannot process - stationId=${stationId}, connectorId=${req.connectorId}`);
    }

    return {};
  }

  private async handleOCPP16Authorize(conn: ChargingStationConnection, req: OCPP16AuthorizeRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 Authorize from ${conn.ocppIdentity}: idTag="${req.idTag}"`);

    // Auto-resolución de stationId si es necesario
    if (!conn.stationId) {
      try {
        const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
        if (station) {
          conn.stationId = station.id;
          console.log(`[CSMS-DUAL] Authorize: Auto-resolved stationId=${station.id} for ${conn.ocppIdentity}`);
        }
      } catch (e) { /* no-op */ }
    }

    try {
      // Validar el idTag en la tabla id_tags
      const validation = await db.validateIdTag(req.idTag);
      
      if (validation.valid) {
        console.log(`[CSMS-DUAL] Authorize: idTag "${req.idTag}" ACCEPTED (userId=${validation.userId}, type=${validation.tagType})`);
        
        // Registrar uso del idTag
        if (conn.stationId) {
          await db.recordIdTagUsage(req.idTag, conn.stationId);
        }
        
        return {
          idTagInfo: {
            status: "Accepted",
            expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        };
      }
      
      // Si el tag no está en id_tags, buscar en tabla users (legacy)
      const userLegacy = await db.getUserByIdTag(req.idTag);
      if (userLegacy) {
        console.log(`[CSMS-DUAL] Authorize: idTag "${req.idTag}" ACCEPTED via legacy users table (userId=${userLegacy.id})`);
        
        // Sincronizar a la nueva tabla id_tags
        await db.syncUserIdTag(userLegacy.id, req.idTag);
        
        return {
          idTagInfo: {
            status: "Accepted",
            expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        };
      }

      // Buscar si hay una sesión pendiente de la app para esta estación
      const pendingSession = findPendingSessionByOcppIdentity(conn.ocppIdentity);
      if (pendingSession && pendingSession.session) {
        console.log(`[CSMS-DUAL] Authorize: idTag "${req.idTag}" ACCEPTED - pending session found (userId=${pendingSession.session.userId})`);
        return {
          idTagInfo: {
            status: "Accepted",
            expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        };
      }

      // MODO PERMISIVO: Aceptar idTags desconocidos para no bloquear carga física
      // En el futuro esto puede ser configurable por estación (strict vs permissive)
      console.warn(`[CSMS-DUAL] Authorize: idTag "${req.idTag}" NOT FOUND in DB. Reason: ${validation.reason}. ACCEPTING in permissive mode.`);
      return {
        idTagInfo: {
          status: "Accepted",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    } catch (error: any) {
      console.error(`[CSMS-DUAL] Authorize: Error validating idTag "${req.idTag}":`, error.message);
      // En caso de error de BD, aceptar para no bloquear la carga
      return {
        idTagInfo: {
          status: "Accepted",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    }
  }

  private async handleOCPP16StartTransaction(conn: ChargingStationConnection, req: OCPP16StartTransactionRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 StartTransaction from ${conn.ocppIdentity}:`, JSON.stringify(req));

    // =========================================================================
    // PASO 1: Auto-resolución redundante de stationId
    // Si handleCall no pudo resolver (race condition, error de BD), intentar aquí
    // =========================================================================
    if (!conn.stationId) {
      console.warn(`[CSMS-DUAL] StartTransaction: stationId is null for ${conn.ocppIdentity}, attempting auto-resolution...`);
      try {
        const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
        if (station) {
          conn.stationId = station.id;
          console.log(`[CSMS-DUAL] StartTransaction: Auto-resolved stationId=${station.id} for ${conn.ocppIdentity}`);
          await db.updateChargingStation(station.id, { isOnline: true });
        } else {
          console.error(`[CSMS-DUAL] StartTransaction: CRITICAL - Station ${conn.ocppIdentity} not found in DB. Cannot process transaction.`);
          return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
        }
      } catch (resolveError: any) {
        console.error(`[CSMS-DUAL] StartTransaction: Error resolving stationId for ${conn.ocppIdentity}:`, resolveError.message);
        return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
      }
    }

    // =========================================================================
    // PASO 2: Buscar EVSE/conector
    // =========================================================================
    const evseList = await db.getEvsesByStationId(conn.stationId);
    let evse = evseList.find(e => e.evseIdLocal === req.connectorId);

    // Fallback: si connectorId=1 y no hay match exacto, usar el primer EVSE disponible
    if (!evse && evseList.length > 0) {
      evse = evseList[0];
      console.warn(`[CSMS-DUAL] StartTransaction: No EVSE with evseIdLocal=${req.connectorId}, using first EVSE (id=${evse.id}, evseIdLocal=${evse.evseIdLocal})`);
    }

    if (!evse) {
      console.error(`[CSMS-DUAL] StartTransaction: No EVSEs found for station ${conn.stationId} (${conn.ocppIdentity})`);
      return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
    }

    // =========================================================================
    // PASO 3: Protección contra duplicados
    // =========================================================================
    const existingTransaction = await db.getActiveTransaction(evse.id);
    if (existingTransaction) {
      let existingOcpp16Id = 0;
      const txEntries = Array.from(this.ocpp16Transactions.entries());
      for (const [ocppId, internalId] of txEntries) {
        if (internalId === existingTransaction.ocppTransactionId) {
          existingOcpp16Id = ocppId;
          break;
        }
      }
      if (existingOcpp16Id === 0) {
        existingOcpp16Id = this.transactionIdCounter++;
        this.ocpp16Transactions.set(existingOcpp16Id, existingTransaction.ocppTransactionId || "");
      }
      console.log(`[CSMS-DUAL] StartTransaction: DUPLICATE detected for EVSE ${evse.id}. Returning existing transactionId: ${existingOcpp16Id}`);
      return {
        idTagInfo: { status: "Accepted" },
        transactionId: existingOcpp16Id,
      };
    }

    // =========================================================================
    // PASO 4: Resolver usuario - Múltiples estrategias
    // Prioridad: sesión pendiente > idTag en id_tags > idTag en users > formato USER-{id} > fallback
    // =========================================================================
    let userId: number | null = null;
    let pendingSessionData: { sessionId: string; session: any } | null = null;
    let userResolutionSource = "none";
    
    // 4a. Buscar sesión pendiente de la app por ocppIdentity + connectorId (PRIORIDAD MÁXIMA)
    pendingSessionData = findPendingSessionByOcppIdentity(conn.ocppIdentity, req.connectorId);
    if (pendingSessionData && pendingSessionData.session) {
      userId = pendingSessionData.session.userId;
      userResolutionSource = "pending_session";
      console.log(`[CSMS-DUAL] StartTransaction: [RESOLVE] User ${userId} from pending session (sessionId: ${pendingSessionData.sessionId})`);
    }
    
    // 4b. Si no hay sesión pendiente, buscar por idTag en tabla id_tags (soporta APP + RFID + NFC)
    if (!userId && req.idTag) {
      try {
        const resolved = await db.resolveUserByIdTag(req.idTag);
        if (resolved.user) {
          userId = resolved.user.id;
          userResolutionSource = resolved.source;
          console.log(`[CSMS-DUAL] StartTransaction: [RESOLVE] User ${userId} from idTag "${req.idTag}" via ${resolved.source}`);
        } else {
          console.warn(`[CSMS-DUAL] StartTransaction: [RESOLVE] idTag "${req.idTag}" not found in any table (source: ${resolved.source})`);
        }
      } catch (resolveErr: any) {
        console.error(`[CSMS-DUAL] StartTransaction: [RESOLVE] Error resolving idTag "${req.idTag}":`, resolveErr.message);
      }
    }
    
    // 4c. Si no hay sesión pendiente por connectorId, buscar cualquier sesión pendiente para esta estación
    if (!userId) {
      pendingSessionData = findPendingSessionByOcppIdentity(conn.ocppIdentity);
      if (pendingSessionData && pendingSessionData.session) {
        userId = pendingSessionData.session.userId;
        userResolutionSource = "pending_session_any_connector";
        console.log(`[CSMS-DUAL] StartTransaction: [RESOLVE] User ${userId} from pending session (any connector, sessionId: ${pendingSessionData.sessionId})`);
      }
    }

    // 4d. DECISIÓN CRÍTICA: ¿Aceptar o rechazar si no se encontró usuario?
    // Para RFID futuro: SIEMPRE aceptar la transacción incluso sin usuario conocido.
    // El cargador ya decidió cargar (el usuario pasó su tarjeta), nosotros debemos registrar.
    if (!userId) {
      console.warn(`[CSMS-DUAL] StartTransaction: [RESOLVE] No user found for idTag "${req.idTag}". Accepting transaction with fallback userId=0 (unassigned).`);
      userId = 0; // userId=0 indica transacción sin usuario asignado (RFID desconocido, walk-up, etc.)
      userResolutionSource = "fallback_unassigned";
    }

    console.log(`[CSMS-DUAL] StartTransaction: [SUMMARY] station=${conn.stationId}, evse=${evse.id}, userId=${userId}, idTag=${req.idTag}, source=${userResolutionSource}`);

    // Registrar uso del idTag
    if (req.idTag) {
      try {
        await db.recordIdTagUsage(req.idTag, conn.stationId);
      } catch (e) { /* no-op */ }
    }

    // Obtener tarifa activa (usa precios globales si no tiene tarifa propia)
    const effectivePrice = await db.getEffectiveStationPrice(conn.stationId);
    const tariff = await db.getActiveTariffByStationId(conn.stationId);
    // IMPORTANTE: Usar el precio dinámico de la sesión pendiente si existe,
    // ya que fue calculado al momento de iniciar la carga (incluye tarifa dinámica IA)
    const pricePerKwh = pendingSessionData?.session?.pricePerKwh || effectivePrice.pricePerKwh;

    // Generar ID de transacción OCPP 1.6 (entero)
    const ocpp16TransactionId = this.transactionIdCounter++;
    const internalTransactionId = nanoid();

    // Crear transacción con el userId correcto (incluir chargeMode y targetValue para restaurar sesión)
    const sessionChargeMode = pendingSessionData?.session?.chargeMode || "full_charge";
    const sessionTargetValue = pendingSessionData?.session?.targetValue || 0;
    const transactionId = await db.createTransaction({
      evseId: evse.id,
      userId,
      stationId: conn.stationId,
      tariffId: tariff?.id,
      ocppTransactionId: internalTransactionId,
      ocppNumericTxId: ocpp16TransactionId, // ID numérico OCPP 1.6 para RemoteStopTransaction
      startTime: new Date(req.timestamp),
      status: "IN_PROGRESS",
      meterStart: String(req.meterStart),
      chargeMode: sessionChargeMode,
      targetValue: String(sessionTargetValue),
      appliedPricePerKwh: String(pricePerKwh),
    });

    // Mapear ID de transacción OCPP 1.6 a interno
    this.ocpp16Transactions.set(ocpp16TransactionId, internalTransactionId);

    // Actualizar estado del EVSE
    await db.updateEvseStatus(evse.id, "CHARGING");
    
    // Siempre crear sesión activa en memoria (para tracking de MeterValues)
    if (pendingSessionData && pendingSessionData.session) {
      // Vincular con la sesión pendiente de la app
      const session = pendingSessionData.session;
      
      setActiveSession(transactionId, {
        transactionId,
        userId: session.userId,
        stationId: conn.stationId,
        connectorId: req.connectorId,
        chargeMode: session.chargeMode,
        targetValue: session.targetValue,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: null,
        manualBatteryCapacityKwh: null,
        lowPowerSince: null,
        chargeCompleteDetected: false,
        chargeCompleteNotified: false,
          autoStopSent: false,
        energyBasedSoc: null,
      });
      
      removePendingSession(pendingSessionData.sessionId);
      console.log(`[CSMS-DUAL] StartTransaction: Activated session for user ${session.userId}, transactionId: ${transactionId}`);
    } else {
      // Crear sesión activa básica incluso sin sesión pendiente (para tracking)
      setActiveSession(transactionId, {
        transactionId,
        userId,
        stationId: conn.stationId,
        connectorId: req.connectorId,
        chargeMode: "full_charge" as const,
        targetValue: 100,
        startTime: new Date(),
        currentKwh: 0,
        currentCost: 0,
        pricePerKwh,
        soc: null,
        currentPower: 0,
        voltage: null,
        current: null,
        lastMeterUpdate: null,
        powerHistory: [],
        socTargetNotified: false,
        manualSoc: null,
        manualBatteryCapacityKwh: null,
        lowPowerSince: null,
        chargeCompleteDetected: false,
        chargeCompleteNotified: false,
          autoStopSent: false,
        energyBasedSoc: null,
      });
      console.log(`[CSMS-DUAL] StartTransaction: Created basic active session for userId ${userId}, transactionId: ${transactionId}`);
    }

    // Notificar al usuario que la carga ha iniciado exitosamente
    try {
      const station = await db.getChargingStationById(conn.stationId);
      const stationName = station?.name || conn.ocppIdentity;
      // Usar precio dinámico efectivo para la notificación
      const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
      await db.createNotification({
        userId,
        title: "Carga iniciada",
        message: `Tu sesión de carga ha comenzado en ${stationName} (conector #${req.connectorId}). Tarifa: $${formattedPrice} COP/kWh. Puedes monitorear el progreso en tiempo real.`,
        type: "CHARGING_STARTED",
        referenceId: transactionId,
        referenceType: "transaction",
      });
      console.log(`[CSMS-DUAL] StartTransaction: Notification sent to user ${userId} for charging started at $${formattedPrice}/kWh`);
    } catch (notifError: any) {
      console.error(`[CSMS-DUAL] StartTransaction: Failed to send notification to user ${userId}:`, notifError.message);
    }

    return {
      idTagInfo: {
        status: "Accepted",
      },
      transactionId: ocpp16TransactionId,
    };
  }

  private async handleOCPP16StopTransaction(conn: ChargingStationConnection, req: OCPP16StopTransactionRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 StopTransaction from ${conn.ocppIdentity}:`, JSON.stringify(req));

    // =========================================================================
    // PASO 1: Resolver la transacción - Múltiples estrategias
    // =========================================================================
    let transaction: any = null;

    // 1a. Buscar por mapeo en memoria (flujo normal)
    const internalTransactionId = this.ocpp16Transactions.get(req.transactionId);
    if (internalTransactionId) {
      transaction = await db.getTransactionByOcppId(internalTransactionId);
      if (transaction) {
        console.log(`[CSMS-DUAL] StopTransaction: Found transaction via ocpp16Transactions map: tx=${transaction.id}, ocppTxId=${internalTransactionId}`);
      }
    }

    // 1b. Si transactionId=0 o no se encontró en el mapa, buscar transacción activa por estación
    if (!transaction && conn.stationId) {
      console.warn(`[CSMS-DUAL] StopTransaction: transactionId=${req.transactionId} not in memory map. Searching active transactions for station ${conn.stationId}...`);
      const evseList = await db.getEvsesByStationId(conn.stationId);
      for (const evse of evseList) {
        const activeTx = await db.getActiveTransaction(evse.id);
        if (activeTx) {
          transaction = activeTx;
          console.log(`[CSMS-DUAL] StopTransaction: Found active transaction via EVSE search: tx=${transaction.id}, evse=${evse.id}`);
          break;
        }
      }
    }

    // 1c. Si aún no se encontró, buscar por idTag del request
    if (!transaction && req.idTag && conn.stationId) {
      console.warn(`[CSMS-DUAL] StopTransaction: Trying to find transaction by idTag "${req.idTag}"...`);
      try {
        const resolved = await db.resolveUserByIdTag(req.idTag);
        if (resolved.user) {
          const userActiveTx = await db.getActiveTransactionByUserId(resolved.user.id);
          if (userActiveTx) {
            transaction = userActiveTx;
            console.log(`[CSMS-DUAL] StopTransaction: Found active transaction via idTag: tx=${transaction.id}, userId=${resolved.user.id}`);
          }
        }
      } catch (e: any) {
        console.error(`[CSMS-DUAL] StopTransaction: Error resolving by idTag:`, e.message);
      }
    }

    // 1d. Auto-resolución de stationId si falta
    if (!transaction && !conn.stationId) {
      try {
        const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
        if (station) {
          conn.stationId = station.id;
          console.log(`[CSMS-DUAL] StopTransaction: Auto-resolved stationId=${station.id} for ${conn.ocppIdentity}`);
          const evseList = await db.getEvsesByStationId(station.id);
          for (const evse of evseList) {
            const activeTx = await db.getActiveTransaction(evse.id);
            if (activeTx) {
              transaction = activeTx;
              console.log(`[CSMS-DUAL] StopTransaction: Found active transaction after auto-resolve: tx=${transaction.id}`);
              break;
            }
          }
        }
      } catch (e: any) {
        console.error(`[CSMS-DUAL] StopTransaction: Error auto-resolving stationId:`, e.message);
      }
    }

    if (!transaction) {
      console.error(`[CSMS-DUAL] StopTransaction: CRITICAL - No transaction found for transactionId=${req.transactionId}, station=${conn.ocppIdentity}. Accepting anyway to not confuse charger.`);
      // Aceptar de todas formas para no confundir al cargador
      // También marcar todos los EVSEs de esta estación como AVAILABLE
      if (conn.stationId) {
        try {
          const evseList = await db.getEvsesByStationId(conn.stationId);
          for (const evse of evseList) {
            if (evse.status !== "AVAILABLE" && evse.status !== "RESERVED") {
              // No resetear EVSEs con reservas activas
              const activeRes = await db.getActiveReservation(evse.id);
              if (!activeRes) {
                await db.updateEvseStatus(evse.id, "AVAILABLE");
                console.log(`[CSMS-DUAL] StopTransaction: Reset EVSE ${evse.id} to AVAILABLE (orphan cleanup)`);
              } else {
                console.log(`[CSMS-DUAL] StopTransaction: Skipping EVSE ${evse.id} reset - has active reservation #${activeRes.id}`);
              }
            }
          }
        } catch (e) { /* no-op */ }
      }
      return { idTagInfo: { status: "Accepted" } };
    }

    const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
    let energyDelivered = (req.meterStop - meterStart) / 1000; // Wh a kWh
    
    // Si la energía entregada es 0 o negativa, intentar usar los datos de la sesión activa
    const activeSession = getActiveSessionById(transaction.id);
    if (energyDelivered <= 0 && activeSession && activeSession.currentKwh > 0) {
      energyDelivered = activeSession.currentKwh;
      console.log(`[CSMS-DUAL] StopTransaction: Using session energy ${energyDelivered} kWh (meterStop gave 0)`);
    }

    // Calcular costo - usar precio dinámico de la sesión activa (que fue calculado al iniciar la carga)
    // Si no hay sesión activa, usar la tarifa de la BD como fallback
    const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
    const pricePerKwh = activeSession?.pricePerKwh || (tariff ? parseFloat(tariff.pricePerKwh) : 1800);
    const pricePerMinute = tariff ? parseFloat(tariff.pricePerMinute || "0") : 0;
    const connectionFee = tariff ? parseFloat(tariff.pricePerSession || "0") : 0;
    
    // Calcular costos desglosados
    const energyCost = energyDelivered * pricePerKwh;
    const endTime_calc = new Date(req.timestamp);
    const startTime_calc = transaction.startTime ? new Date(transaction.startTime) : new Date();
    const durationMinutes = (endTime_calc.getTime() - startTime_calc.getTime()) / (1000 * 60);
    const timeCost = durationMinutes * pricePerMinute;
    
    // Total = energía + tiempo + tarifa de conexión
    let totalCost = energyCost + timeCost + connectionFee;
    if (activeSession?.chargeMode === "fixed_amount" && activeSession.targetValue > 0) {
      // Cobrar el menor entre el costo calculado y el monto objetivo (pero siempre incluir connectionFee)
      totalCost = Math.min(energyCost + timeCost, activeSession.targetValue) + connectionFee;
    }

    // Calcular distribución de ingresos según configuración del admin
    const revenueConfig = await db.getRevenueShareConfig();
    const investorShare = totalCost * (revenueConfig.investorPercent / 100);
    const platformFee = totalCost * (revenueConfig.platformPercent / 100);

    // Calcular duración
    const endTime = new Date(req.timestamp);
    const startTime = transaction.startTime ? new Date(transaction.startTime) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Actualizar transacción
    await db.updateTransaction(transaction.id, {
      endTime,
      meterEnd: String(req.meterStop),
      kwhConsumed: energyDelivered.toString(),
      energyCost: energyCost.toFixed(2),
      timeCost: timeCost.toFixed(2),
      sessionCost: connectionFee.toFixed(2),
      totalCost: totalCost.toString(),
      investorShare: investorShare.toString(),
      platformFee: platformFee.toString(),
      status: "COMPLETED",
      stopReason: req.reason,
    });

    // Actualizar estado del EVSE
    await db.updateEvseStatus(transaction.evseId, "AVAILABLE");

    // Descontar de la billetera del usuario
    try {
      const wallet = await db.getWalletByUserId(transaction.userId);
      if (wallet) {
        let currentBalance = parseFloat(wallet.balance);

        // Auto-cobro: si el saldo es insuficiente y tiene tarjeta inscrita
        if (currentBalance < totalCost) {
          try {
            const { autoChargeIfNeeded } = await import("../wompi/auto-charge");
            const autoResult = await autoChargeIfNeeded(transaction.userId, totalCost);
            if (autoResult?.success) {
              currentBalance = autoResult.newBalance;
              console.log(`[CSMS-DUAL] Auto-cobro exitoso: $${autoResult.amountCharged} cobrados a tarjeta`);
            } else if (autoResult) {
              console.log(`[CSMS-DUAL] Auto-cobro fallido: ${autoResult.error}`);
            }
          } catch (autoErr) {
            console.warn(`[CSMS-DUAL] Error en auto-cobro:`, autoErr);
          }
        }

        const newBalance = Math.max(0, currentBalance - totalCost);
        await db.updateWalletBalance(transaction.userId, newBalance.toString());

        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: transaction.userId,
          type: "CHARGE_PAYMENT",
          amount: (-totalCost).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          referenceId: transaction.id,
          referenceType: "TRANSACTION",
          status: "COMPLETED",
          description: `Pago por carga de ${energyDelivered.toFixed(2)} kWh`,
        });
        
        console.log(`[CSMS-DUAL] Wallet deducted: $${Math.round(totalCost)} from user ${transaction.userId}. Balance: $${currentBalance} -> $${newBalance}`);
      }
    } catch (walletError) {
      console.error(`[CSMS-DUAL] Error deducting wallet for user ${transaction.userId}:`, walletError);
    }

    // Crear notificación en BD
    try {
      await db.createNotification({
        userId: transaction.userId,
        title: "Carga completada",
        message: `Tu carga ha finalizado. Consumo: ${energyDelivered.toFixed(2)} kWh. Total: $${Math.round(totalCost).toLocaleString()} COP`,
        type: "CHARGING",
        referenceId: transaction.id,
      });
    } catch (notifError) {
      console.error(`[CSMS-DUAL] Error creating notification:`, notifError);
    }

    // Enviar notificación push FCM
    let userForEmail: any = null;
    let stationForEmail: any = null;
    try {
      userForEmail = await db.getUserById(transaction.userId);
      stationForEmail = conn.stationId ? await db.getChargingStationById(conn.stationId) : null;
      if (userForEmail?.fcmToken) {
        await sendChargingCompleteNotification(userForEmail.fcmToken, {
          stationName: stationForEmail?.name || "Estación EVGreen",
          energyDelivered,
          totalCost: Math.round(totalCost),
          duration,
        });
        console.log(`[CSMS-DUAL] Push notification sent to user ${transaction.userId}`);
      }
    } catch (pushError) {
      console.error(`[CSMS-DUAL] Error sending push notification:`, pushError);
    }

    // Enviar recibo por email
    try {
      if (userForEmail?.email) {
        const { sendChargingReceiptEmail } = await import("../email/receipt-email");
        await sendChargingReceiptEmail({
          transactionId: transaction.id,
          userName: userForEmail.name || "Cliente",
          userEmail: userForEmail.email,
          userDocumentType: userForEmail.documentType || null,
          userDocumentNumber: userForEmail.documentNumber || null,
          stationName: stationForEmail?.name || "Estación EVGreen",
          stationAddress: stationForEmail?.address || "",
          stationCity: stationForEmail?.city || "Colombia",
          startTime: startTime,
          endTime: endTime,
          kwhConsumed: energyDelivered,
          appliedPricePerKwh: pricePerKwh,
          energyCost,
          timeCost,
          sessionCost: connectionFee,
          overstayCost: 0, // Se calcula después en overstay checker
          totalCost,
          chargeMode: activeSession?.chargeMode || transaction.chargeMode || "full_charge",
          startMethod: transaction.startMethod || "APP",
          stopReason: req.reason || "Unknown",
          durationMinutes: durationMinutes,
        });
        console.log(`[CSMS-DUAL] Receipt email sent to ${userForEmail.email} for tx=${transaction.id}`);
      }
    } catch (emailError) {
      console.error(`[CSMS-DUAL] Error sending receipt email:`, emailError);
    }

    // =========================================================================
    // REGISTRO DE PRECISIÓN DE SOC
    // =========================================================================
    try {
      const manualSocValue = transaction.manualSoc ?? activeSession?.manualSoc ?? null;
      const batteryCapKwh = transaction.manualBatteryCapacityKwh
        ? parseFloat(transaction.manualBatteryCapacityKwh)
        : activeSession?.manualBatteryCapacityKwh ?? null;

      if (manualSocValue !== null && batteryCapKwh && batteryCapKwh > 0 && energyDelivered > 0) {
        // SoC calculado al finalizar: SoC inicio + (kWh reales / capacidad) * 100
        const calculatedSocEnd = Math.min(100, Math.round(manualSocValue + (energyDelivered / batteryCapKwh) * 100));
        // SoC reportado por el cargador (si disponible en MeterValues)
        const chargerSocEnd = activeSession?.soc ?? null;
        // Error estimado: si el cargador reportó SoC, comparar con el calculado
        let estimatedErrorKwh: number | null = null;
        let estimatedErrorSocPct: number | null = null;
        if (chargerSocEnd !== null) {
          estimatedErrorSocPct = calculatedSocEnd - chargerSocEnd;
          estimatedErrorKwh = Math.round((estimatedErrorSocPct / 100) * batteryCapKwh * 10) / 10;
        }
        // Obtener vehicleId del vehículo por defecto del usuario
        let vehicleId: number | null = null;
        try {
          const defaultVehicle = await db.getDefaultVehicle(transaction.userId);
          vehicleId = defaultVehicle?.id ?? null;
        } catch (_) { /* no-op */ }

        await db.createSocAccuracyLog({
          userId: transaction.userId,
          transactionId: transaction.id,
          vehicleId,
          manualSocStart: manualSocValue,
          manualBatteryCapacityKwh: batteryCapKwh,
          realKwhDelivered: Math.round(energyDelivered * 100) / 100,
          calculatedSocEnd,
          chargerSocEnd,
          batteryFullDetected: activeSession?.chargeCompleteDetected ?? false,
          detectionMethod: activeSession?.chargeCompleteDetected
            ? (activeSession.soc !== null ? 'charger_soc' : 'power_drop')
            : (req.reason === 'Remote' ? 'target_reached' : 'user_stop'),
          estimatedErrorKwh,
          estimatedErrorSocPct,
        });
        console.log(`[CSMS-DUAL] SoC accuracy logged: tx=${transaction.id}, manualSoc=${manualSocValue}%, calcEnd=${calculatedSocEnd}%, chargerEnd=${chargerSocEnd ?? 'N/A'}%`);
      }
    } catch (socAccErr) {
      console.error(`[CSMS-DUAL] Error logging SoC accuracy:`, socAccErr);
    }

    // Limpiar sesión activa en memoria
    removeActiveSession(transaction.id);

    // Limpiar mapeo OCPP 1.6
    this.ocpp16Transactions.delete(req.transactionId);
    
    console.log(`[CSMS-DUAL] StopTransaction completed: tx=${transaction.id}, user=${transaction.userId}, ${energyDelivered.toFixed(2)} kWh, $${Math.round(totalCost)} COP`);

    return {
      idTagInfo: {
        status: "Accepted",
      },
    };
  }

  private async handleOCPP16MeterValues(conn: ChargingStationConnection, req: OCPP16MeterValuesRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 MeterValues from ${conn.ocppIdentity}: connectorId=${req.connectorId}, transactionId=${req.transactionId}`);
    
    // RECUPERACIÓN DE TRANSACCIONES HUÉRFANAS:
    // Cuando transactionId=0 (cargador ignoró respuesta Invalid y cargó de todos modos),
    // intentar crear/recuperar la transacción automáticamente.
    if (!req.transactionId && req.transactionId !== undefined && conn.stationId) {
      console.log(`[CSMS-DUAL] MeterValues with transactionId=0 detected for ${conn.ocppIdentity}. Attempting orphan recovery...`);
      
      const evses = await db.getEvsesByStationId(conn.stationId);
      const evse = evses.find(e => e.evseIdLocal === req.connectorId);
      
      if (evse) {
        // Verificar si ya hay una transacción activa para este EVSE
        const existingTx = await db.getActiveTransaction(evse.id);
        if (existingTx) {
          // Ya hay transacción, vincular los MeterValues
          console.log(`[CSMS-DUAL] Orphan recovery: Found existing transaction ${existingTx.id} for EVSE ${evse.id}`);
          req.transactionId = undefined; // Forzar procesamiento directo
          
          // Procesar MeterValues directamente para esta transacción
          for (const mv of req.meterValue) {
            for (const sv of mv.sampledValue) {
              const measurand = sv.measurand || "Energy.Active.Import.Register";
              const rawValue = parseFloat(String(sv.value));
              const unit = (sv.unit || "").toLowerCase();
              let energyKwh: string | null = null;
              let powerKw: string | null = null;
              
              if (measurand.includes("Energy")) {
                const kwhValue = unit === "wh" ? rawValue / 1000 : rawValue;
                energyKwh = String(kwhValue);
              } else if (measurand.includes("Power")) {
                const kwValue = unit === "w" ? rawValue / 1000 : rawValue;
                powerKw = String(kwValue);
              }
              
              await db.createMeterValue({
                transactionId: existingTx.id,
                evseId: existingTx.evseId,
                timestamp: new Date(mv.timestamp),
                measurand,
                energyKwh: energyKwh || String(sv.value),
                powerKw: powerKw || undefined,
                context: sv.context,
              });
            }
          }
          
          // Actualizar sesión activa si existe
          const activeSession = getActiveSessionById(existingTx.id);
          if (activeSession && req.meterValue.length > 0) {
            const meterStart = existingTx.meterStart ? parseFloat(existingTx.meterStart) : 0;
            for (const mv of req.meterValue) {
              for (const sv of mv.sampledValue) {
                if ((sv.measurand || "Energy.Active.Import.Register").includes("Energy")) {
                  const rawVal = parseFloat(String(sv.value));
                  const unit = (sv.unit || "").toLowerCase();
                  const kwhVal = unit === "wh" ? rawVal / 1000 : rawVal;
                  const consumed = Math.max(0, kwhVal - meterStart);
                  const cost = consumed * activeSession.pricePerKwh;
                  setActiveSession(existingTx.id, {
                    ...activeSession,
                    currentKwh: Math.round(consumed * 100) / 100,
                    currentCost: Math.round(cost),
                    lastMeterUpdate: new Date(),
                  });
                  await db.updateTransaction(existingTx.id, {
                    kwhConsumed: String(Math.round(consumed * 100) / 100),
                    totalCost: String(Math.round(cost)),
                  });
                  console.log(`[CSMS-DUAL] Orphan recovery: Updated session ${existingTx.id}: ${consumed.toFixed(2)} kWh, $${Math.round(cost)} COP`);
                }
              }
            }
          }
          return {};
        } else {
          // No hay transacción activa - crear una nueva (transacción huérfana)
          console.log(`[CSMS-DUAL] Orphan recovery: No active transaction for EVSE ${evse.id}. Creating orphan transaction...`);
          
          // Buscar sesión pendiente
          const pendingSession = findPendingSessionByOcppIdentity(conn.ocppIdentity, req.connectorId);
          let userId = 1;
          if (pendingSession?.session) {
            userId = pendingSession.session.userId;
          }
          
          const effectivePrice = await db.getEffectiveStationPrice(conn.stationId);
          const tariff = await db.getActiveTariffByStationId(conn.stationId);
          // Usar precio dinámico de la sesión pendiente si existe
          const pricePerKwh = pendingSession?.session?.pricePerKwh || effectivePrice.pricePerKwh;
          
          // Obtener meterStart del primer MeterValue
          let meterStart = 0;
          for (const mv of req.meterValue) {
            for (const sv of mv.sampledValue) {
              if ((sv.measurand || "Energy.Active.Import.Register").includes("Energy")) {
                const rawVal = parseFloat(String(sv.value));
                const unit = (sv.unit || "").toLowerCase();
                meterStart = unit === "wh" ? rawVal / 1000 : rawVal;
              }
            }
          }
          
          const internalTxId = nanoid();
          const ocpp16TxId = this.transactionIdCounter++;
          
          const orphanChargeMode = pendingSession?.session?.chargeMode || "full_charge";
          const orphanTargetValue = pendingSession?.session?.targetValue || 0;
          const txId = await db.createTransaction({
            evseId: evse.id,
            userId,
            stationId: conn.stationId,
            tariffId: tariff?.id,
            ocppTransactionId: internalTxId,
            ocppNumericTxId: ocpp16TxId, // ID numérico OCPP 1.6 para RemoteStopTransaction
            startTime: new Date(),
            status: "IN_PROGRESS",
            meterStart: String(meterStart),
            chargeMode: orphanChargeMode,
            targetValue: String(orphanTargetValue),
            appliedPricePerKwh: String(pricePerKwh),
          });
          
          this.ocpp16Transactions.set(ocpp16TxId, internalTxId);
          await db.updateEvseStatus(evse.id, "CHARGING");
          
          setActiveSession(txId, {
            transactionId: txId,
            userId,
            stationId: conn.stationId,
            connectorId: req.connectorId,
            chargeMode: pendingSession?.session?.chargeMode || "full_charge" as const,
            targetValue: pendingSession?.session?.targetValue || 100,
            startTime: new Date(),
            currentKwh: 0,
            currentCost: 0,
            pricePerKwh,
            soc: null,
            currentPower: 0,
            voltage: null,
            current: null,
            lastMeterUpdate: null,
            powerHistory: [],
            socTargetNotified: false,
            manualSoc: null,
            manualBatteryCapacityKwh: null,
            lowPowerSince: null,
            chargeCompleteDetected: false,
            chargeCompleteNotified: false,
          autoStopSent: false,
            energyBasedSoc: null,
          });
          
          if (pendingSession) {
            removePendingSession(pendingSession.sessionId);
          }
          
          console.log(`[CSMS-DUAL] Orphan recovery: Created transaction ${txId} for EVSE ${evse.id}, userId=${userId}`);
          return {};
        }
      }
    }
    
    if (req.transactionId) {
      const internalTransactionId = this.ocpp16Transactions.get(req.transactionId);
      if (internalTransactionId) {
        const transaction = await db.getTransactionByOcppId(internalTransactionId);
        if (transaction) {
          // Variables para actualizar la sesión activa en memoria
          let latestEnergyKwh: number | null = null;
          let latestPowerKw: number | null = null;
          let latestSoc: number | null = null;
          let latestVoltage: number | null = null;
          let latestCurrent: number | null = null;
          let latestTemperature: number | null = null;
          
          for (const mv of req.meterValue) {
            for (const sv of mv.sampledValue) {
              const measurand = sv.measurand || "Energy.Active.Import.Register";
              const rawValue = parseFloat(String(sv.value));
              const unit = (sv.unit || "").toLowerCase();
              
              // Determinar valores según el measurand
              let energyKwh: string | null = null;
              let powerKw: string | null = null;
              let voltage: string | null = null;
              let current: string | null = null;
              let soc: number | null = null;
              let temperature: string | null = null;
              
              if (measurand.includes("Energy")) {
                // Convertir Wh a kWh si es necesario
                const kwhValue = unit === "wh" ? rawValue / 1000 : rawValue;
                energyKwh = String(kwhValue);
                latestEnergyKwh = kwhValue;
              } else if (measurand.includes("Power")) {
                // Convertir W a kW si es necesario
                const kwValue = unit === "w" ? rawValue / 1000 : rawValue;
                powerKw = String(kwValue);
                latestPowerKw = kwValue;
              } else if (measurand === "SoC" || measurand.includes("SoC")) {
                soc = Math.round(rawValue);
                latestSoc = soc;
              } else if (measurand.includes("Voltage")) {
                voltage = String(rawValue);
                latestVoltage = rawValue;
              } else if (measurand.includes("Current")) {
                current = String(rawValue);
                latestCurrent = rawValue;
              } else if (measurand.includes("Temperature")) {
                temperature = String(rawValue);
                latestTemperature = rawValue;
              }
              
              // Guardar en BD
              await db.createMeterValue({
                transactionId: transaction.id,
                evseId: transaction.evseId,
                timestamp: new Date(mv.timestamp),
                measurand,
                energyKwh: energyKwh || String(sv.value),
                powerKw: powerKw || undefined,
                voltage: voltage || undefined,
                current: current || undefined,
                soc: soc ?? undefined,
                temperature: temperature || undefined,
                context: sv.context,
              });
            }
          }
          
          // Actualizar sesión activa en memoria con los datos más recientes
          const activeSession = getActiveSessionById(transaction.id);
          if (activeSession) {
            const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
            let consumedKwh: number;
            
            if (latestEnergyKwh !== null) {
              // Cálculo directo desde el medidor de energía
              consumedKwh = Math.max(0, latestEnergyKwh - meterStart);
            } else if (latestPowerKw !== null && latestPowerKw > 0) {
              // Estimación basada en potencia: si el cargador solo envía Power sin Energy,
              // estimar la energía acumulada usando potencia * tiempo transcurrido
              const elapsedHours = (Date.now() - activeSession.startTime.getTime()) / (1000 * 3600);
              consumedKwh = Math.max(0, latestPowerKw * elapsedHours);
              console.log(`[CSMS-DUAL] Energy estimated from power: ${latestPowerKw.toFixed(1)} kW * ${elapsedHours.toFixed(3)} h = ${consumedKwh.toFixed(3)} kWh`);
            } else {
              // Sin datos de energía ni potencia, mantener el valor actual
              consumedKwh = activeSession.currentKwh;
            }
            
            const currentCost = consumedKwh * activeSession.pricePerKwh;
            
            // Actualizar la sesión en memoria
            setActiveSession(transaction.id, {
              ...activeSession,
              currentKwh: Math.round(consumedKwh * 100) / 100,
              currentCost: Math.round(currentCost),
              lastMeterUpdate: new Date(),
            });
            
            // También actualizar kwhConsumed en la transacción de la BD
            await db.updateTransaction(transaction.id, {
              kwhConsumed: String(Math.round(consumedKwh * 100) / 100),
              totalCost: String(Math.round(currentCost)),
            });
            
            console.log(`[CSMS-DUAL] MeterValues updated session ${transaction.id}: ${consumedKwh.toFixed(2)} kWh, $${Math.round(currentCost)} COP, power: ${latestPowerKw?.toFixed(1) || 'N/A'} kW`);
            
            // ============================================================
            // NOTIFICACIÓN: SoC alcanzó el porcentaje objetivo del usuario
            // ============================================================
            if (latestSoc !== null && transaction.userId && !activeSession.socTargetNotified) {
              const targetPercentage = activeSession.chargeMode === "percentage" 
                ? activeSession.targetValue 
                : 100;
              
              if (latestSoc >= targetPercentage) {
                activeSession.socTargetNotified = true;
                
                const notificationKey = `soc_target_reached_${transaction.id}`;
                const existingNotification = await db.getNotificationByKey(transaction.userId, notificationKey);
                
                if (!existingNotification) {
                  await db.createNotification({
                    userId: transaction.userId,
                    type: "soc_target_reached",
                    title: `🔋 ¡Batería al ${latestSoc}%! Objetivo alcanzado`,
                    message: `Tu vehículo ha alcanzado el ${latestSoc}% de carga (objetivo: ${targetPercentage}%). Puedes desconectar cuando lo desees.`,
                    data: JSON.stringify({
                      transactionId: transaction.id,
                      soc: latestSoc,
                      targetPercentage,
                      key: notificationKey,
                    }),
                  });
                  console.log(`[CSMS-DUAL] SoC target notification sent: user=${transaction.userId}, soc=${latestSoc}%, target=${targetPercentage}%`);
                }
              }
            }
            
            // ============================================================
            // AUTO-STOP: Verificar si se alcanzó el límite de carga
            // ============================================================
            let shouldAutoStop = false;
            let autoStopReason = "";
            
            // REGLA: lo que ocurra primero detiene la carga
            // Solo verificar si no se ha enviado ya un auto-stop
            if (activeSession.autoStopSent) {
              // Ya se envió un auto-stop, no verificar de nuevo
            } else {
            
            // 1. Verificar SoC al 100% (aplica a TODOS los modos) - si el cargador reporta SoC
            if (activeSession.soc !== null && activeSession.soc !== undefined && activeSession.soc >= 100) {
              shouldAutoStop = true;
              autoStopReason = `Batería al 100% (SoC reportado por cargador)`;
            }
            
            // 2. Verificar por monto fijo
            if (!shouldAutoStop && activeSession.chargeMode === "fixed_amount" && activeSession.targetValue > 0) {
              if (currentCost >= activeSession.targetValue) {
                shouldAutoStop = true;
                autoStopReason = `Monto objetivo alcanzado: $${Math.round(currentCost)} >= $${activeSession.targetValue}`;
              }
            }
            
            // 3. Verificar por porcentaje objetivo
            if (!shouldAutoStop && activeSession.chargeMode === "percentage" && activeSession.targetValue > 0) {
              const batteryCapacity = activeSession.manualBatteryCapacityKwh || 60; // Usar capacidad real del vehículo
              const startPercentage = activeSession.manualSoc || 20;
              const targetKwh = ((activeSession.targetValue - startPercentage) / 100) * batteryCapacity;
              if (consumedKwh >= targetKwh && targetKwh > 0) {
                shouldAutoStop = true;
                autoStopReason = `Porcentaje objetivo alcanzado: ${consumedKwh.toFixed(2)} kWh >= ${targetKwh.toFixed(2)} kWh (${activeSession.targetValue}%)`;
              }
            }
            // full_charge: no auto-stop por lógica de negocio, se detecta por caída de potencia en AC
            
            if (shouldAutoStop) {
              console.log(`[CSMS-DUAL] AUTO-STOP triggered for transaction ${transaction.id}: ${autoStopReason}`);
              activeSession.autoStopSent = true;
              
              // Buscar el OCPP transactionId numérico para enviar RemoteStopTransaction
              let ocpp16TxId: number | null = null;
              const txEntries = Array.from(this.ocpp16Transactions.entries());
              for (const [ocppId, internalId] of txEntries) {
                if (internalId === transaction.ocppTransactionId) {
                  ocpp16TxId = ocppId;
                  break;
                }
              }
              
              if (ocpp16TxId !== null) {
                try {
                  console.log(`[CSMS-DUAL] Sending RemoteStopTransaction for OCPP txId ${ocpp16TxId}`);
                  await this.sendCall(conn, "RemoteStopTransaction", {
                    transactionId: ocpp16TxId,
                  });
                  
                  await db.createOcppLog({
                    ocppIdentity: conn.ocppIdentity,
                    stationId: conn.stationId,
                    direction: "OUT",
                    messageType: "RemoteStopTransaction",
                    payload: { transactionId: ocpp16TxId, reason: autoStopReason },
                  });
                } catch (stopError) {
                  console.error(`[CSMS-DUAL] Error sending auto-stop RemoteStopTransaction:`, stopError);
                }
              } else {
                console.warn(`[CSMS-DUAL] Could not find OCPP 1.6 transactionId for internal ${transaction.ocppTransactionId}`);
              }
            }
            } // close else for autoStopSent check
          }
        }
      }
    }
    return {};
  }

  // ============================================================================
  // OCPP 2.0.1 HANDLERS
  // ============================================================================

  private async handleOCPP201BootNotification(conn: ChargingStationConnection, req: OCPP201BootNotificationRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 2.0.1 BootNotification from ${conn.ocppIdentity}:`, req);

    let station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);

    if (station) {
      await db.updateChargingStation(station.id, {
        isOnline: true,
        manufacturer: req.chargingStation.vendorName,
        model: req.chargingStation.model,
        serialNumber: req.chargingStation.serialNumber,
        firmwareVersion: req.chargingStation.firmwareVersion,
        lastBootNotification: new Date(),
      });
      conn.stationId = station.id;
    }

    return {
      currentTime: new Date().toISOString(),
      interval: this.heartbeatInterval,
      status: station ? "Accepted" : "Pending",
    };
  }

  private async handleOCPP201StatusNotification(conn: ChargingStationConnection, req: OCPP201StatusNotificationRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 2.0.1 StatusNotification from ${conn.ocppIdentity}:`, req);

    if (conn.stationId) {
      const evses = await db.getEvsesByStationId(conn.stationId);
      const evse = evses.find(e => e.evseIdLocal === req.evseId);

      if (evse) {
        const statusMap: Record<string, any> = {
          Available: "AVAILABLE",
          Occupied: "CHARGING",
          Reserved: "RESERVED",
          Unavailable: "UNAVAILABLE",
          Faulted: "FAULTED",
        };
        const newStatus = statusMap[req.connectorStatus] || "UNAVAILABLE";
        
        // NO sobreescribir RESERVED→AVAILABLE si hay una reserva activa
        if (newStatus === "AVAILABLE" && evse.status === "RESERVED") {
          const activeRes = await db.getActiveReservation(evse.id);
          if (activeRes) {
            console.log(`[CSMS-DUAL] OCPP 2.0.1 StatusNotification: Ignoring AVAILABLE for EVSE ${evse.id} - has active reservation #${activeRes.id}`);
            return {};
          }
        }
        
        await db.updateEvseStatus(evse.id, newStatus);
      }
    }

    return {};
  }

  private async handleOCPP201TransactionEvent(conn: ChargingStationConnection, req: OCPP201TransactionEventRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 2.0.1 TransactionEvent from ${conn.ocppIdentity}:`, req);

    if (!conn.stationId) {
      return { idTokenInfo: { status: "Invalid" } };
    }

    const evses = await db.getEvsesByStationId(conn.stationId);
    const evse = evses.find(e => e.evseIdLocal === req.evse?.id);

    if (!evse) {
      return { idTokenInfo: { status: "Invalid" } };
    }

    switch (req.eventType) {
      case "Started": {
        const tariff = await db.getActiveTariffByStationId(conn.stationId);

        const pricePerKwh201 = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
        await db.createTransaction({
          evseId: evse.id,
          userId: 1,
          stationId: conn.stationId,
          tariffId: tariff?.id,
          ocppTransactionId: req.transactionInfo.transactionId,
          startTime: new Date(req.timestamp),
          status: "IN_PROGRESS",
          chargeMode: "full_charge",
          targetValue: "0",
          appliedPricePerKwh: String(pricePerKwh201),
        });

        await db.updateEvseStatus(evse.id, "CHARGING");
        break;
      }

      case "Updated": {
        // Procesar meter values si están presentes
        if (req.meterValue) {
          const transaction = await db.getTransactionByOcppId(req.transactionInfo.transactionId);
          if (transaction) {
          for (const mv of req.meterValue) {
            for (const sv of mv.sampledValue) {
              await db.createMeterValue({
                transactionId: transaction.id,
                evseId: transaction.evseId,
                timestamp: new Date(mv.timestamp),
                measurand: sv.measurand || "Energy.Active.Import.Register",
                energyKwh: String(sv.value),
                context: sv.context,
              });
            }
          }
          }
        }
        break;
      }

      case "Ended": {
        const transaction = await db.getTransactionByOcppId(req.transactionInfo.transactionId);
        if (transaction) {
          let energyDelivered = 0;
          if (req.meterValue) {
            const energyValue = req.meterValue
              .flatMap(mv => mv.sampledValue)
              .find(sv => sv.measurand === "Energy.Active.Import.Register");
            if (energyValue) {
              energyDelivered = energyValue.value / 1000;
            }
          }
          
          // Fallback: usar datos de la sesión activa si no hay energía del medidor
          const activeSession201 = getActiveSessionById(transaction.id);
          if (energyDelivered <= 0 && activeSession201 && activeSession201.currentKwh > 0) {
            energyDelivered = activeSession201.currentKwh;
          }

          const tariff201 = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
          // Priorizar precio dinámico guardado en la transacción
          const pricePerKwh201 = transaction.appliedPricePerKwh 
            ? parseFloat(String(transaction.appliedPricePerKwh))
            : (tariff201 ? parseFloat(tariff201.pricePerKwh) : 1800);
          const pricePerMinute201 = tariff201 ? parseFloat(tariff201.pricePerMinute || "0") : 0;
          const connectionFee201 = tariff201 ? parseFloat(tariff201.pricePerSession || "0") : 0;
          
          const endTime201 = new Date(req.timestamp);
          const startTime201 = transaction.startTime ? new Date(transaction.startTime) : new Date();
          const duration201 = Math.floor((endTime201.getTime() - startTime201.getTime()) / 1000);
          const durationMinutes201 = duration201 / 60;
          
          const energyCost201 = energyDelivered * pricePerKwh201;
          const timeCost201 = durationMinutes201 * pricePerMinute201;
          let totalCost = energyCost201 + timeCost201 + connectionFee201;
          
          // Para modo fixed_amount, limitar al monto objetivo (pero siempre incluir connectionFee)
          if (activeSession201?.chargeMode === "fixed_amount" && activeSession201.targetValue > 0) {
            totalCost = Math.min(energyCost201 + timeCost201, activeSession201.targetValue) + connectionFee201;
          }

          // Calcular distribución de ingresos
          const revenueConfig201 = await db.getRevenueShareConfig();
          const investorShare201 = totalCost * (revenueConfig201.investorPercent / 100);
          const platformFee201 = totalCost * (revenueConfig201.platformPercent / 100);

          await db.updateTransaction(transaction.id, {
            endTime: endTime201,
            kwhConsumed: energyDelivered.toString(),
            energyCost: energyCost201.toFixed(2),
            timeCost: timeCost201.toFixed(2),
            sessionCost: connectionFee201.toFixed(2),
            totalCost: totalCost.toString(),
            investorShare: investorShare201.toString(),
            platformFee: platformFee201.toString(),
            status: "COMPLETED",
            stopReason: req.transactionInfo.stoppedReason,
          });

          await db.updateEvseStatus(evse.id, "AVAILABLE");

          // Descontar de la billetera del usuario
          try {
            const wallet201 = await db.getWalletByUserId(transaction.userId);
            if (wallet201) {
              let currentBalance201 = parseFloat(wallet201.balance);
              if (currentBalance201 < totalCost) {
                try {
                  const { autoChargeIfNeeded } = await import("../wompi/auto-charge");
                  const autoResult201 = await autoChargeIfNeeded(transaction.userId, totalCost);
                  if (autoResult201?.success) {
                    currentBalance201 = autoResult201.newBalance;
                  }
                } catch (autoErr201) {
                  console.warn(`[CSMS-DUAL] 2.0.1 Error en auto-cobro:`, autoErr201);
                }
              }
              const newBalance201 = Math.max(0, currentBalance201 - totalCost);
              await db.updateWalletBalance(transaction.userId, newBalance201.toString());
              await db.createWalletTransaction({
                walletId: wallet201.id,
                userId: transaction.userId,
                type: "CHARGE_PAYMENT",
                amount: (-totalCost).toString(),
                balanceBefore: currentBalance201.toString(),
                balanceAfter: newBalance201.toString(),
                referenceId: transaction.id,
                referenceType: "TRANSACTION",
                status: "COMPLETED",
                description: `Pago por carga de ${energyDelivered.toFixed(2)} kWh`,
              });
              console.log(`[CSMS-DUAL] 2.0.1 Wallet deducted: $${Math.round(totalCost)} from user ${transaction.userId}`);
            }
          } catch (walletErr201) {
            console.error(`[CSMS-DUAL] 2.0.1 Error deducting wallet:`, walletErr201);
          }

          // Crear notificación en BD
          try {
            await db.createNotification({
              userId: transaction.userId,
              title: "Carga completada",
              message: `Tu carga ha finalizado. Consumo: ${energyDelivered.toFixed(2)} kWh. Total: $${Math.round(totalCost).toLocaleString()} COP`,
              type: "CHARGING",
              referenceId: transaction.id,
            });
          } catch (notifErr201) {
            console.error(`[CSMS-DUAL] 2.0.1 Error creating notification:`, notifErr201);
          }

          // Enviar notificación push FCM
          try {
            const user201 = await db.getUserById(transaction.userId);
            if (user201?.fcmToken) {
              const station201 = conn.stationId ? await db.getChargingStationById(conn.stationId) : null;
              await sendChargingCompleteNotification(user201.fcmToken, {
                stationName: station201?.name || "Estación EVGreen",
                energyDelivered,
                totalCost: Math.round(totalCost),
                duration: duration201,
              });
            }
          } catch (pushErr201) {
            console.error(`[CSMS-DUAL] 2.0.1 Error sending push:`, pushErr201);
          }

          // Limpiar sesión activa
          removeActiveSession(transaction.id);
          console.log(`[CSMS-DUAL] 2.0.1 StopTransaction completed: tx=${transaction.id}, ${energyDelivered.toFixed(2)} kWh, $${Math.round(totalCost)} COP`);
        }
        break;
      }
    }

    return { idTokenInfo: { status: "Accepted" } };
  }

  private async handleOCPP201MeterValues(conn: ChargingStationConnection, req: OCPP201MeterValuesRequest): Promise<any> {
    // Los meter values en 2.0.1 generalmente vienen en TransactionEvent
    return {};
  }

  // ============================================================================
  // COMMON HANDLERS
  // ============================================================================

  private handleHeartbeat(conn: ChargingStationConnection): any {
    conn.lastHeartbeat = new Date();
    return {
      currentTime: new Date().toISOString(),
    };
  }

  // ============================================================================
  // MESSAGE SENDING
  // ============================================================================

  private sendCallResult(conn: ChargingStationConnection, messageId: string, payload: any): void {
    const message = [CALLRESULT, messageId, payload];
    conn.ws.send(JSON.stringify(message));
  }

  private sendCallError(conn: ChargingStationConnection, messageId: string, errorCode: string, errorDescription: string): void {
    const message = [CALLERROR, messageId, errorCode, errorDescription, {}];
    conn.ws.send(JSON.stringify(message));
  }

  private async sendCall(conn: ChargingStationConnection, action: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = nanoid(8);
      const message = [CALL, messageId, action, payload];

      const timeout = setTimeout(() => {
        conn.pendingCalls.delete(messageId);
        reject(new Error(`Timeout waiting for response to ${action}`));
      }, 30000);

      conn.pendingCalls.set(messageId, { resolve, reject, timeout });
      conn.ws.send(JSON.stringify(message));
    });
  }

  private handleCallResult(conn: ChargingStationConnection, messageId: string, payload: any): void {
    const pending = conn.pendingCalls.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      conn.pendingCalls.delete(messageId);
      pending.resolve(payload);
    }
  }

  private handleCallError(conn: ChargingStationConnection, messageId: string, errorCode: string, errorDescription: string): void {
    const pending = conn.pendingCalls.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      conn.pendingCalls.delete(messageId);
      pending.reject(new Error(`${errorCode}: ${errorDescription}`));
    }
  }

  // ============================================================================
  // DISCONNECTION HANDLING
  // ============================================================================

  private async handleDisconnection(ocppIdentity: string): Promise<void> {
    const conn = this.connections.get(ocppIdentity);
    
    // Limpiar ping interval
    const pingInterval = this.pingIntervals.get(ocppIdentity);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(ocppIdentity);
    }
    
    // Limpiar pending calls
    if (conn) {
      conn.pendingCalls.forEach((pending) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Connection closed"));
      });
    }
    
    // Eliminar la conexión del mapa inmediatamente
    this.connections.delete(ocppIdentity);

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn?.stationId,
      direction: "IN",
      messageType: "DISCONNECTION",
      payload: {},
    });

    // En lugar de marcar offline inmediatamente, usar grace period
    // Esto permite que el cargador se reconecte sin parpadeo de estado
    if (conn?.stationId) {
      console.log(`[CSMS-DUAL] Starting ${DualCSMS.GRACE_PERIOD_MS / 1000}s grace period for: ${ocppIdentity}`);
      
      const graceTimeout = setTimeout(async () => {
        // Verificar si el cargador se reconectó durante el grace period
        const currentConn = this.connections.get(ocppIdentity);
        if (!currentConn) {
          // No se reconectó, ahora sí marcar como offline
          console.log(`[CSMS-DUAL] Grace period expired, marking offline: ${ocppIdentity}`);
          await db.updateStationOnlineStatus(ocppIdentity, false);
          
          // Generar alerta de desconexión SOLO después del grace period (desconexión real confirmada)
          alertsService.handleDisconnection(ocppIdentity, conn.stationId ?? undefined)
            .catch(err => console.error("[CSMS-DUAL] Error sending disconnect alert:", err));
          
          // Actualizar estado de conectores a UNAVAILABLE (excepto los que tienen reserva activa)
          try {
            const evses = await db.getEvsesByStationId(conn.stationId!);
            for (const evse of evses) {
              const activeRes = await db.getActiveReservation(evse.id);
              if (!activeRes) {
                await db.updateEvseStatus(evse.id, "UNAVAILABLE");
              } else {
                // Mantener RESERVED para EVSEs con reservas activas
                await db.updateEvseStatus(evse.id, "RESERVED");
                console.log(`[CSMS-DUAL] Disconnect: Keeping EVSE ${evse.id} as RESERVED - has active reservation #${activeRes.id}`);
              }
            }
          } catch (err) {
            console.error(`[CSMS-DUAL] Error updating EVSE status on disconnect:`, err);
          }
        } else {
          console.log(`[CSMS-DUAL] Charger reconnected during grace period: ${ocppIdentity}`);
        }
        this.reconnectionGrace.delete(ocppIdentity);
      }, DualCSMS.GRACE_PERIOD_MS);
      
      this.reconnectionGrace.set(ocppIdentity, graceTimeout);
    }
  }

  // ============================================================================
  // REMOTE COMMANDS (CS → CP)
  // ============================================================================

  /**
   * Inicia una transacción remotamente
   */
  async requestStartTransaction(
    ocppIdentity: string,
    connectorId: number,
    idTag: string
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      console.log(`[CSMS-DUAL] requestStartTransaction: No connection for ${ocppIdentity}. Active connections: [${Array.from(this.connections.keys()).join(', ')}]`);
      throw new Error(`Charging station ${ocppIdentity} not connected. Active: [${Array.from(this.connections.keys()).join(', ')}]`);
    }
    if (conn.ws.readyState !== 1) {
      console.log(`[CSMS-DUAL] requestStartTransaction: Connection for ${ocppIdentity} exists but WebSocket readyState=${conn.ws.readyState} (not OPEN)`);
      throw new Error(`Charging station ${ocppIdentity} WebSocket not OPEN (readyState=${conn.ws.readyState})`);
    }
    console.log(`[CSMS-DUAL] requestStartTransaction: Sending to ${ocppIdentity} (stationId=${conn.stationId}, ocppVersion=${conn.ocppVersion}, connectorId=${connectorId}, idTag=${idTag})`);
    

    let response: any;
    if (conn.ocppVersion === "1.6") {
      response = await this.sendCall(conn, "RemoteStartTransaction", {
        connectorId,
        idTag,
      });
    } else {
      response = await this.sendCall(conn, "RequestStartTransaction", {
        evseId: connectorId,
        idToken: { idToken: idTag, type: "Central" },
        remoteStartId: Date.now(),
      });
    }

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: conn.ocppVersion === "1.6" ? "RemoteStartTransaction" : "RequestStartTransaction",
      payload: response,
    });

    return response;
  }

  /**
   * Detiene una transacción remotamente
   */
  async requestStopTransaction(
    ocppIdentity: string,
    transactionId: string | number
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    let response: any;
    if (conn.ocppVersion === "1.6") {
      // En OCPP 1.6, necesitamos el transactionId numérico
      const numericId = typeof transactionId === "number" ? transactionId : parseInt(transactionId);
      response = await this.sendCall(conn, "RemoteStopTransaction", {
        transactionId: numericId,
      });
    } else {
      response = await this.sendCall(conn, "RequestStopTransaction", {
        transactionId: String(transactionId),
      });
    }

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: conn.ocppVersion === "1.6" ? "RemoteStopTransaction" : "RequestStopTransaction",
      payload: response,
    });

    return response;
  }

  /**
   * Reserva un conector
   */
  async reserveNow(
    ocppIdentity: string,
    connectorId: number,
    reservationId: number,
    expiryDate: Date,
    idTag: string
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    let response: any;
    if (conn.ocppVersion === "1.6") {
      response = await this.sendCall(conn, "ReserveNow", {
        connectorId,
        expiryDate: expiryDate.toISOString(),
        idTag,
        reservationId,
      });
    } else {
      response = await this.sendCall(conn, "ReserveNow", {
        id: reservationId,
        expiryDateTime: expiryDate.toISOString(),
        idToken: { idToken: idTag, type: "Central" },
        evseId: connectorId,
      });
    }

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "ReserveNow",
      payload: response,
    });

    return response;
  }

  /**
   * Cancela una reserva
   */
  async cancelReservation(
    ocppIdentity: string,
    reservationId: number
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await this.sendCall(conn, "CancelReservation", {
      reservationId,
    });

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "CancelReservation",
      payload: response,
    });

    return response;
  }

  /**
   * Reinicia el cargador
   */
  async reset(
    ocppIdentity: string,
    type: "Soft" | "Hard" | "Immediate" | "OnIdle"
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    let resetType: string;
    if (conn.ocppVersion === "1.6") {
      resetType = type === "Immediate" || type === "Hard" ? "Hard" : "Soft";
    } else {
      resetType = type === "Soft" || type === "OnIdle" ? "OnIdle" : "Immediate";
    }

    const response = await this.sendCall(conn, "Reset", { type: resetType });

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "Reset",
      payload: response,
    });

    return response;
  }

  /**
   * Desbloquea un conector
   */
  async unlockConnector(
    ocppIdentity: string,
    connectorId: number
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    let response: any;
    if (conn.ocppVersion === "1.6") {
      response = await this.sendCall(conn, "UnlockConnector", { connectorId });
    } else {
      response = await this.sendCall(conn, "UnlockConnector", { evseId: connectorId, connectorId: 1 });
    }

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "UnlockConnector",
      payload: response,
    });

    return response;
  }

  // ============================================================================
  // STATUS METHODS
  // ============================================================================

  /**
   * Obtiene el estado de todas las conexiones
   */
  getConnectionsStatus(): Array<{
    ocppIdentity: string;
    ocppVersion: OCPPVersion;
    stationId: number | null;
    connectedAt: Date;
    lastHeartbeat: Date;
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      ocppIdentity: conn.ocppIdentity,
      ocppVersion: conn.ocppVersion,
      stationId: conn.stationId,
      connectedAt: conn.connectedAt,
      lastHeartbeat: conn.lastHeartbeat,
    }));
  }

  /**
   * Obtiene diagnóstico detallado de todas las conexiones activas
   * Incluye readyState, pendingCalls, uptime, bootInfo
   */
  getDetailedDiagnostics(): Array<{
    ocppIdentity: string;
    ocppVersion: string;
    stationId: number | null;
    connectedAt: string;
    lastHeartbeat: string;
    uptimeSeconds: number;
    heartbeatAgeSeconds: number;
    wsReadyState: number;
    wsReadyStateLabel: string;
    pendingCallsCount: number;
    pendingCallIds: string[];
    isHealthy: boolean;
  }> {
    const now = Date.now();
    const readyStateLabels: Record<number, string> = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED',
    };
    return Array.from(this.connections.values()).map(conn => {
      const uptimeSeconds = Math.floor((now - conn.connectedAt.getTime()) / 1000);
      const heartbeatAgeSeconds = Math.floor((now - conn.lastHeartbeat.getTime()) / 1000);
      const wsReadyState = conn.ws.readyState;
      const pendingCallIds = Array.from(conn.pendingCalls.keys());
      return {
        ocppIdentity: conn.ocppIdentity,
        ocppVersion: conn.ocppVersion,
        stationId: conn.stationId,
        connectedAt: conn.connectedAt.toISOString(),
        lastHeartbeat: conn.lastHeartbeat.toISOString(),
        uptimeSeconds,
        heartbeatAgeSeconds,
        wsReadyState,
        wsReadyStateLabel: readyStateLabels[wsReadyState] || 'UNKNOWN',
        pendingCallsCount: conn.pendingCalls.size,
        pendingCallIds,
        isHealthy: wsReadyState === 1 && heartbeatAgeSeconds < 120,
      };
    });
  }

  /**
   * Verifica si una estación está conectada
   */
  isStationConnected(ocppIdentity: string): boolean {
    return this.connections.has(ocppIdentity);
  }

  /**
   * Obtiene la versión OCPP de una estación conectada
   */
  getStationOCPPVersion(ocppIdentity: string): OCPPVersion | null {
    const conn = this.connections.get(ocppIdentity);
    return conn?.ocppVersion || null;
  }

  /**
   * Envía un comando OCPP genérico a un cargador conectado
   * Usado por el router para comandos como TriggerMessage, GetConfiguration, etc.
   */
  async sendGenericCommand(
    ocppIdentity: string,
    action: string,
    payload: any
  ): Promise<any> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      return null; // No conectado en dualCSMS
    }
    
    try {
      const response = await this.sendCall(conn, action, payload);
      return response;
    } catch (error) {
      console.error(`[CSMS-DUAL] Error sending ${action} to ${ocppIdentity}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene la conexión de un cargador por su stationId de la BD
   */
  getConnectionByStationId(stationId: number): { ocppIdentity: string; ws: WebSocket; ocppVersion: OCPPVersion } | null {
    const entries = Array.from(this.connections.entries());
    for (let i = 0; i < entries.length; i++) {
      const [identity, conn] = entries[i];
      if (conn.stationId === stationId && conn.ws.readyState === 1) {
        return {
          ocppIdentity: identity,
          ws: conn.ws,
          ocppVersion: conn.ocppVersion,
        };
      }
    }
    return null;
  }

  /**
   * Envía un comando genérico si el cargador está conectado.
   * Retorna true si el comando fue enviado, false si no está conectado
   */
  sendCommandIfConnected(
    ocppIdentity: string,
    messageId: string,
    action: string,
    payload: any
  ): boolean {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      console.log(`[CSMS-DUAL] sendCommandIfConnected: No connection found for ${ocppIdentity}. Active connections: [${Array.from(this.connections.keys()).join(', ')}]`);
      return false;
    }
    if (conn.ws.readyState !== 1) { // 1 = OPEN
      console.log(`[CSMS-DUAL] sendCommandIfConnected: Connection for ${ocppIdentity} exists but WebSocket readyState=${conn.ws.readyState} (not OPEN). stationId=${conn.stationId}`);
      return false;
    }
    
    const message = [2, messageId, action, payload]; // CALL = 2
    try {
      conn.ws.send(JSON.stringify(message));
      console.log(`[CSMS-DUAL] sendCommandIfConnected: Sent ${action} to ${ocppIdentity} (stationId=${conn.stationId})`);
      return true;
    } catch (error: any) {
      console.error(`[CSMS-DUAL] sendCommandIfConnected: Error sending ${action} to ${ocppIdentity}: ${error.message}`);
      return false;
    }
  }

  // ============================================================================
  // FIRMWARE UPDATE
  // ============================================================================

  private async handleFirmwareStatusNotification(conn: ChargingStationConnection, payload: any): Promise<any> {
    const ocppStatus = payload.status || payload.firmwareStatus;
    console.log(`[CSMS-DUAL] FirmwareStatusNotification from ${conn.ocppIdentity}: ${ocppStatus}`);

    const statusMap: Record<string, string> = {
      Downloading: "DOWNLOADING",
      Downloaded: "DOWNLOADED",
      Installing: "INSTALLING",
      Installed: "INSTALLED",
      InstallationFailed: "INSTALLATION_FAILED",
      DownloadFailed: "DOWNLOAD_FAILED",
      Idle: "IDLE",
      DownloadScheduled: "PENDING",
      DownloadPaused: "DOWNLOADING",
      SignatureVerified: "DOWNLOADED",
      InvalidSignature: "DOWNLOAD_FAILED",
    };

    const progressMap: Record<string, number> = {
      PENDING: 0, DOWNLOADING: 25, DOWNLOADED: 50,
      INSTALLING: 75, INSTALLED: 100,
      INSTALLATION_FAILED: 0, DOWNLOAD_FAILED: 0, IDLE: 0,
    };

    const dbStatus = statusMap[ocppStatus] || "PENDING";
    const progress = progressMap[dbStatus] ?? 0;
    const errorStatuses = ["INSTALLATION_FAILED", "DOWNLOAD_FAILED"];
    const errorMsg = errorStatuses.includes(dbStatus) ? `Firmware update failed: ${ocppStatus}` : undefined;

    try {
      await db.updateFirmwareStatusByIdentity(conn.ocppIdentity, dbStatus, progress, errorMsg);
      await db.createOcppLog({
        stationId: conn.stationId || 0,
        ocppIdentity: conn.ocppIdentity,
        direction: "IN",
        messageType: "FirmwareStatusNotification",
        payload: payload,
      });
    } catch (error) {
      console.error(`[CSMS-DUAL] Error updating firmware status:`, error);
    }

    return {};
  }

  async updateFirmware(ocppIdentity: string, firmwareUrl: string, retrieveDate?: Date): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error(`Charger ${ocppIdentity} is not connected`);
    }

    const retrieve = retrieveDate || new Date();
    let response: any;

    if (conn.ocppVersion === "1.6") {
      response = await this.sendCall(conn, "UpdateFirmware", {
        location: firmwareUrl,
        retrieveDate: retrieve.toISOString(),
      });
    } else {
      response = await this.sendCall(conn, "UpdateFirmware", {
        requestId: Date.now(),
        firmware: {
          location: firmwareUrl,
          retrieveDateTime: retrieve.toISOString(),
        },
      });
    }

    return { status: response?.status || "Accepted" };
  }
}

// Singleton instance
export const dualCSMS = new DualCSMS();
