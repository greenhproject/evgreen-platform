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
        return {};
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
        return {};
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

    // Obtener tarifa activa
    const tariff = await db.getActiveTariffByStationId(conn.stationId);

    // Generar ID de transacción OCPP 1.6 (entero)
    const ocpp16TransactionId = this.transactionIdCounter++;
    const internalTransactionId = nanoid();

    // Crear transacción
    const transactionId = await db.createTransaction({
      evseId: evse.id,
      userId: 1, // TODO: Buscar usuario por idTag
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
    const energyDelivered = (req.meterStop - meterStart) / 1000; // Wh a kWh

    // Calcular costo - obtener tarifa
    const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
    const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
    const totalCost = energyDelivered * pricePerKwh;

    // Actualizar transacción
    await db.updateTransaction(transaction.id, {
      endTime: new Date(req.timestamp),
      meterEnd: String(req.meterStop),
      kwhConsumed: energyDelivered.toString(),
      totalCost: totalCost.toString(),
      status: "COMPLETED",
      stopReason: req.reason,
    });

    // Actualizar estado del EVSE
    await db.updateEvseStatus(transaction.evseId, "AVAILABLE");

    // Limpiar mapeo
    this.ocpp16Transactions.delete(req.transactionId);

    return {
      idTagInfo: {
        status: "Accepted",
      },
    };
  }

  private async handleOCPP16MeterValues(conn: ChargingStationConnection, req: OCPP16MeterValuesRequest): Promise<any> {
    if (req.transactionId) {
      const internalTransactionId = this.ocpp16Transactions.get(req.transactionId);
      if (internalTransactionId) {
        const transaction = await db.getTransactionByOcppId(internalTransactionId);
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

          const tariff201 = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
          const pricePerKwh = tariff201 ? parseFloat(tariff201.pricePerKwh) : 1800;
          const totalCost = energyDelivered * pricePerKwh;

          await db.updateTransaction(transaction.id, {
            endTime: new Date(req.timestamp),
            kwhConsumed: energyDelivered.toString(),
            totalCost: totalCost.toString(),
            status: "COMPLETED",
            stopReason: req.transactionInfo.stoppedReason,
          });

          await db.updateEvseStatus(evse.id, "AVAILABLE");
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
    if (conn?.stationId) {
      await db.updateStationOnlineStatus(ocppIdentity, false);
    }
    
    // Limpiar pending calls
    if (conn) {
      conn.pendingCalls.forEach((pending) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Connection closed"));
      });
    }
    
    this.connections.delete(ocppIdentity);

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn?.stationId,
      direction: "IN",
      messageType: "DISCONNECTION",
      payload: {},
    });
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
}

// Singleton instance
export const dualCSMS = new DualCSMS();
