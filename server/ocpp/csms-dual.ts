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
  private heartbeatInterval: number = 60; // segundos
  private isRunning: boolean = false;
  private transactionIdCounter: number = 1;
  private ocpp16Transactions: Map<number, string> = new Map(); // OCPP 1.6 transactionId -> internal transactionId
  private reconnectionGrace: Map<string, NodeJS.Timeout> = new Map(); // Grace period para reconexión
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map(); // Ping keepalive intervals
  private static GRACE_PERIOD_MS = 120000; // 2 minutos de gracia para reconexión
  private static PING_INTERVAL_MS = 30000; // Ping cada 30 segundos

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

      // Registrar la conexión
      const connection: ChargingStationConnection = {
        ws,
        stationId: null,
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

      // Log de conexión
      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "CONNECTION",
        payload: { url: req.url, protocol, ocppVersion },
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
      // AUTO-RESOLUCIÓN: Si conn.stationId es null (cargador reconectó sin BootNotification),
      // buscar la estación por ocppIdentity en la BD y asignarla automáticamente.
      // Esto es común en cargadores Wallbox que omiten BootNotification tras reconexión rápida.
      if (!conn.stationId && action !== "BootNotification") {
        const station = await db.getChargingStationByOcppIdentity(conn.ocppIdentity);
        if (station) {
          conn.stationId = station.id;
          console.log(`[CSMS-DUAL] Auto-resolved stationId=${station.id} for ${conn.ocppIdentity} (no BootNotification received)`);
          // También marcar como online
          await db.updateChargingStation(station.id, {
            isOnline: true,
          });
        } else {
          console.warn(`[CSMS-DUAL] Cannot resolve stationId for ${conn.ocppIdentity}: station not found in DB`);
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
      case "Authorize":
        return { idTokenInfo: { status: "Accepted" } };
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
    console.log(`[CSMS-DUAL] OCPP 1.6 StatusNotification from ${conn.ocppIdentity}:`, req);

    if (conn.stationId && req.connectorId > 0) {
      const evses = await db.getEvsesByStationId(conn.stationId);
      const evse = evses.find(e => e.evseIdLocal === req.connectorId);

      if (evse) {
        const statusMap: Record<string, any> = {
          Available: "AVAILABLE",
          Preparing: "AVAILABLE",
          Charging: "CHARGING",
          SuspendedEV: "CHARGING",
          SuspendedEVSE: "CHARGING",
          Finishing: "CHARGING",
          Reserved: "RESERVED",
          Unavailable: "UNAVAILABLE",
          Faulted: "FAULTED",
        };
        const status = statusMap[req.status] || "UNAVAILABLE";
        await db.updateEvseStatus(evse.id, status);
      }
    }

    return {};
  }

  private async handleOCPP16Authorize(conn: ChargingStationConnection, req: OCPP16AuthorizeRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 Authorize from ${conn.ocppIdentity}:`, req);
    // TODO: Verificar idTag en base de datos
    return {
      idTagInfo: {
        status: "Accepted",
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  private async handleOCPP16StartTransaction(conn: ChargingStationConnection, req: OCPP16StartTransactionRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 StartTransaction from ${conn.ocppIdentity}:`, req);

    if (!conn.stationId) {
      return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
    }

    const evses = await db.getEvsesByStationId(conn.stationId);
    const evse = evses.find(e => e.evseIdLocal === req.connectorId);

    if (!evse) {
      return { idTagInfo: { status: "Invalid" }, transactionId: 0 };
    }

    // PROTECCIÓN CONTRA DUPLICADOS: Verificar si ya hay una transacción IN_PROGRESS para este EVSE
    const existingTransaction = await db.getActiveTransaction(evse.id);
    if (existingTransaction) {
      // Ya hay una transacción activa para este conector, devolver el ID existente
      // Buscar el ocpp16TransactionId mapeado
      let existingOcpp16Id = 0;
      const txEntries = Array.from(this.ocpp16Transactions.entries());
      for (const [ocppId, internalId] of txEntries) {
        if (internalId === existingTransaction.ocppTransactionId) {
          existingOcpp16Id = ocppId;
          break;
        }
      }
      if (existingOcpp16Id === 0) {
        // Si no hay mapeo, crear uno nuevo
        existingOcpp16Id = this.transactionIdCounter++;
        this.ocpp16Transactions.set(existingOcpp16Id, existingTransaction.ocppTransactionId || "");
      }
      console.log(`[CSMS-DUAL] StartTransaction: DUPLICATE detected for EVSE ${evse.id}. Returning existing transactionId: ${existingOcpp16Id}`);
      return {
        idTagInfo: { status: "Accepted" },
        transactionId: existingOcpp16Id,
      };
    }

    // Buscar usuario por idTag
    let userId = 1; // Fallback
    let pendingSessionData: { sessionId: string; session: any } | null = null;
    
    // Buscar sesión pendiente de la app móvil para vincular (PRIORIDAD MÁXIMA)
    pendingSessionData = findPendingSessionByOcppIdentity(conn.ocppIdentity, req.connectorId);
    if (pendingSessionData && pendingSessionData.session) {
      userId = pendingSessionData.session.userId;
      console.log(`[CSMS-DUAL] StartTransaction: Linked with pending session from user ${userId} (sessionId: ${pendingSessionData.sessionId})`);
    } else {
      // Si no hay sesión pendiente, intentar buscar por idTag en la base de datos
      if (req.idTag) {
        const user = await db.getUserByIdTag(req.idTag);
        if (user) {
          userId = user.id;
          console.log(`[CSMS-DUAL] StartTransaction: Found user ${userId} by idTag ${req.idTag}`);
        } else {
          // Si el idTag tiene formato USER-{id}, extraer el userId
          const userIdMatch = req.idTag.match(/^USER-(\d+)$/);
          if (userIdMatch) {
            userId = parseInt(userIdMatch[1], 10);
            console.log(`[CSMS-DUAL] StartTransaction: Extracted userId ${userId} from idTag ${req.idTag}`);
          }
        }
      }
    }

    // Obtener tarifa activa (usa precios globales si no tiene tarifa propia)
    const effectivePrice = await db.getEffectiveStationPrice(conn.stationId);
    const tariff = await db.getActiveTariffByStationId(conn.stationId);
    const pricePerKwh = effectivePrice.pricePerKwh;

    // Generar ID de transacción OCPP 1.6 (entero)
    const ocpp16TransactionId = this.transactionIdCounter++;
    const internalTransactionId = nanoid();

    // Crear transacción con el userId correcto
    const transactionId = await db.createTransaction({
      evseId: evse.id,
      userId,
      stationId: conn.stationId,
      tariffId: tariff?.id,
      ocppTransactionId: internalTransactionId,
      startTime: new Date(req.timestamp),
      status: "IN_PROGRESS",
      meterStart: String(req.meterStart),
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
      });
      console.log(`[CSMS-DUAL] StartTransaction: Created basic active session for userId ${userId}, transactionId: ${transactionId}`);
    }

    return {
      idTagInfo: {
        status: "Accepted",
      },
      transactionId: ocpp16TransactionId,
    };
  }

  private async handleOCPP16StopTransaction(conn: ChargingStationConnection, req: OCPP16StopTransactionRequest): Promise<any> {
    console.log(`[CSMS-DUAL] OCPP 1.6 StopTransaction from ${conn.ocppIdentity}:`, req);

    const internalTransactionId = this.ocpp16Transactions.get(req.transactionId);
    if (!internalTransactionId) {
      return { idTagInfo: { status: "Invalid" } };
    }

    const transaction = await db.getTransactionByOcppId(internalTransactionId);
    if (!transaction) {
      return { idTagInfo: { status: "Invalid" } };
    }

    const meterStart = transaction.meterStart ? parseFloat(transaction.meterStart) : 0;
    let energyDelivered = (req.meterStop - meterStart) / 1000; // Wh a kWh
    
    // Si la energía entregada es 0 o negativa, intentar usar los datos de la sesión activa
    const activeSession = getActiveSessionById(transaction.id);
    if (energyDelivered <= 0 && activeSession && activeSession.currentKwh > 0) {
      energyDelivered = activeSession.currentKwh;
      console.log(`[CSMS-DUAL] StopTransaction: Using session energy ${energyDelivered} kWh (meterStop gave 0)`);
    }

    // Calcular costo - obtener tarifa
    const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
    const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
    
    // Para modo fixed_amount, usar el monto objetivo si la energía entregada lo cubre
    let totalCost = energyDelivered * pricePerKwh;
    if (activeSession?.chargeMode === "fixed_amount" && activeSession.targetValue > 0) {
      // Cobrar el menor entre el costo calculado y el monto objetivo
      totalCost = Math.min(totalCost, activeSession.targetValue);
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
    try {
      const user = await db.getUserById(transaction.userId);
      if (user?.fcmToken) {
        const station = conn.stationId ? await db.getChargingStationById(conn.stationId) : null;
        await sendChargingCompleteNotification(user.fcmToken, {
          stationName: station?.name || "Estación EVGreen",
          energyDelivered,
          totalCost: Math.round(totalCost),
          duration,
        });
        console.log(`[CSMS-DUAL] Push notification sent to user ${transaction.userId}`);
      }
    } catch (pushError) {
      console.error(`[CSMS-DUAL] Error sending push notification:`, pushError);
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
          const pricePerKwh = effectivePrice.pricePerKwh;
          
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
          
          const txId = await db.createTransaction({
            evseId: evse.id,
            userId,
            stationId: conn.stationId,
            tariffId: tariff?.id,
            ocppTransactionId: internalTxId,
            startTime: new Date(),
            status: "IN_PROGRESS",
            meterStart: String(meterStart),
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
            });
            
            // También actualizar kwhConsumed en la transacción de la BD
            await db.updateTransaction(transaction.id, {
              kwhConsumed: String(Math.round(consumedKwh * 100) / 100),
              totalCost: String(Math.round(currentCost)),
            });
            
            console.log(`[CSMS-DUAL] MeterValues updated session ${transaction.id}: ${consumedKwh.toFixed(2)} kWh, $${Math.round(currentCost)} COP, power: ${latestPowerKw?.toFixed(1) || 'N/A'} kW`);
            
            // ============================================================
            // AUTO-STOP: Verificar si se alcanzó el límite de carga
            // ============================================================
            let shouldAutoStop = false;
            let autoStopReason = "";
            
            if (activeSession.chargeMode === "fixed_amount" && activeSession.targetValue > 0) {
              // Modo monto fijo: detener cuando el costo alcanza el monto objetivo
              if (currentCost >= activeSession.targetValue) {
                shouldAutoStop = true;
                autoStopReason = `Monto objetivo alcanzado: $${Math.round(currentCost)} >= $${activeSession.targetValue}`;
              }
            } else if (activeSession.chargeMode === "percentage" && activeSession.targetValue > 0) {
              // Modo porcentaje: estimar kWh necesarios (batería 60 kWh por defecto)
              const batteryCapacity = 60; // kWh
              const startPercentage = 20; // Asumimos 20% de inicio
              const targetKwh = ((activeSession.targetValue - startPercentage) / 100) * batteryCapacity;
              if (consumedKwh >= targetKwh && targetKwh > 0) {
                shouldAutoStop = true;
                autoStopReason = `Porcentaje objetivo alcanzado: ${consumedKwh.toFixed(2)} kWh >= ${targetKwh.toFixed(2)} kWh (${activeSession.targetValue}%)`;
              }
            }
            // full_charge: no auto-stop, el cargador decide cuándo parar
            
            if (shouldAutoStop) {
              console.log(`[CSMS-DUAL] AUTO-STOP triggered for transaction ${transaction.id}: ${autoStopReason}`);
              
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
        const status = statusMap[req.connectorStatus] || "UNAVAILABLE";
        await db.updateEvseStatus(evse.id, status);
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

        await db.createTransaction({
          evseId: evse.id,
          userId: 1,
          stationId: conn.stationId,
          tariffId: tariff?.id,
          ocppTransactionId: req.transactionInfo.transactionId,
          startTime: new Date(req.timestamp),
          status: "IN_PROGRESS",
    
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
          const pricePerKwh = tariff201 ? parseFloat(tariff201.pricePerKwh) : 1800;
          let totalCost = energyDelivered * pricePerKwh;
          
          // Para modo fixed_amount, limitar al monto objetivo
          if (activeSession201?.chargeMode === "fixed_amount" && activeSession201.targetValue > 0) {
            totalCost = Math.min(totalCost, activeSession201.targetValue);
          }

          // Calcular distribución de ingresos
          const revenueConfig201 = await db.getRevenueShareConfig();
          const investorShare201 = totalCost * (revenueConfig201.investorPercent / 100);
          const platformFee201 = totalCost * (revenueConfig201.platformPercent / 100);

          const endTime201 = new Date(req.timestamp);
          const startTime201 = transaction.startTime ? new Date(transaction.startTime) : new Date();
          const duration201 = Math.floor((endTime201.getTime() - startTime201.getTime()) / 1000);

          await db.updateTransaction(transaction.id, {
            endTime: endTime201,
            kwhConsumed: energyDelivered.toString(),
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
          
          // Actualizar estado de conectores a UNAVAILABLE
          try {
            const evses = await db.getEvsesByStationId(conn.stationId!);
            for (const evse of evses) {
              await db.updateEvseStatus(evse.id, "UNAVAILABLE");
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
      throw new Error("Charging station not connected");
    }

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
    if (!conn || conn.ws.readyState !== 1) { // 1 = OPEN
      return false;
    }
    
    const message = [2, messageId, action, payload]; // CALL = 2
    conn.ws.send(JSON.stringify(message));
    console.log(`[CSMS-DUAL] Sent ${action} to ${ocppIdentity}`);
    return true;
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
