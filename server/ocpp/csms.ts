/**
 * CSMS (Charging Station Management System) - Servidor OCPP 2.0.1
 * 
 * Este módulo implementa un servidor CSMS compatible con OCPP 2.0.1
 * para comunicación bidireccional con estaciones de carga de vehículos eléctricos.
 * 
 * Cumple con la Resolución 40559 de 2025 del Ministerio de Minas y Energía de Colombia.
 */

// @ts-ignore - ocpp-rpc types are not fully compatible
import { RPCServer, RPCClient, createRPCError } from "ocpp-rpc";
import { WebSocketServer } from "ws";
import * as db from "../db";
import { nanoid } from "nanoid";

// ============================================================================
// TYPES
// ============================================================================

interface ChargingStationConnection {
  client: RPCClient;
  stationId: number | null;
  ocppIdentity: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

interface BootNotificationRequest {
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

interface TransactionEventRequest {
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

interface StatusNotificationRequest {
  timestamp: string;
  connectorStatus: string;
  evseId: number;
  connectorId: number;
}

interface MeterValuesRequest {
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

interface HeartbeatRequest {
  // Empty request
}

// ============================================================================
// CSMS CLASS
// ============================================================================

export class CSMS {
  private server: RPCServer;
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ChargingStationConnection> = new Map();
  private heartbeatInterval: number = 60; // segundos
  private isRunning: boolean = false;

  constructor() {
    this.server = new RPCServer({
      protocols: ["ocpp2.0.1"],
      strictMode: false,
    });

    this.setupHandlers();
  }

  /**
   * Inicia el servidor CSMS en el puerto especificado
   */
  async start(port: number = 9000): Promise<void> {
    if (this.isRunning) {
      console.log("[CSMS] Server already running");
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", async (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const ocppIdentity = url.pathname.split("/").pop() || "";

      console.log(`[CSMS] New connection from: ${ocppIdentity}`);

      // Crear cliente RPC para esta conexión
      // @ts-ignore - handleUpgrade signature varies
      const client = await this.server.handleUpgrade(ws, req, null) as RPCClient;

      // Registrar la conexión
      this.connections.set(ocppIdentity, {
        client,
        stationId: null,
        ocppIdentity,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      });

      // Manejar desconexión
      ws.on("close", () => {
        console.log(`[CSMS] Connection closed: ${ocppIdentity}`);
        this.handleDisconnection(ocppIdentity);
      });

      // Log de mensajes
      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "CONNECTION",
        payload: { url: req.url, headers: req.headers },
      });
    });

    this.isRunning = true;
    console.log(`[CSMS] OCPP 2.0.1 Server started on port ${port}`);
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
        conn.client.close();
      } catch (e) {
        console.error(`[CSMS] Error closing connection ${identity}:`, e);
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
    console.log("[CSMS] Server stopped");
  }

  /**
   * Configura los handlers para mensajes OCPP
   */
  private setupHandlers(): void {
    // BootNotification - Cuando un cargador se conecta
    this.server.on("BootNotification", async (req: BootNotificationRequest, client: RPCClient) => {
      const ocppIdentity = this.getIdentityByClient(client);
      console.log(`[CSMS] BootNotification from ${ocppIdentity}:`, req);

      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "BootNotification",
        payload: req,
      });

      // Buscar o crear la estación en la base de datos
      let station = await db.getChargingStationByOcppIdentity(ocppIdentity);

      if (station) {
        // Actualizar información de la estación
        await db.updateChargingStation(station.id, {
          isOnline: true,
          manufacturer: req.chargingStation.vendorName,
          model: req.chargingStation.model,
          serialNumber: req.chargingStation.serialNumber,
          firmwareVersion: req.chargingStation.firmwareVersion,
          lastBootNotification: new Date(),
        });

        // Actualizar la conexión con el ID de la estación
        const conn = this.connections.get(ocppIdentity);
        if (conn) {
          conn.stationId = station.id;
        }
      }

      const response = {
        currentTime: new Date().toISOString(),
        interval: this.heartbeatInterval,
        status: station ? "Accepted" : "Pending",
      };

      await db.createOcppLog({
        ocppIdentity,
        stationId: station?.id,
        direction: "OUT",
        messageType: "BootNotification",
        payload: response,
      });

      return response;
    });

    // Heartbeat - Mantener conexión viva
    this.server.on("Heartbeat", async (_req: HeartbeatRequest, client: RPCClient) => {
      const ocppIdentity = this.getIdentityByClient(client);
      
      // Actualizar último heartbeat
      const conn = this.connections.get(ocppIdentity);
      if (conn) {
        conn.lastHeartbeat = new Date();
      }

      return {
        currentTime: new Date().toISOString(),
      };
    });

    // StatusNotification - Cambio de estado del conector
    this.server.on("StatusNotification", async (req: StatusNotificationRequest, client: RPCClient) => {
      const ocppIdentity = this.getIdentityByClient(client);
      console.log(`[CSMS] StatusNotification from ${ocppIdentity}:`, req);

      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "StatusNotification",
        payload: req,
      });

      const conn = this.connections.get(ocppIdentity);
      if (conn?.stationId) {
        // Buscar el EVSE correspondiente
        const evses = await db.getEvsesByStationId(conn.stationId);
        const evse = evses.find(e => e.evseIdLocal === req.evseId);

        if (evse) {
          // Mapear estado OCPP a estado interno
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
    });

    // TransactionEvent - Eventos de transacción (inicio, actualización, fin)
    this.server.on("TransactionEvent", async (req: TransactionEventRequest, client: RPCClient) => {
      const ocppIdentity = this.getIdentityByClient(client);
      console.log(`[CSMS] TransactionEvent from ${ocppIdentity}:`, req);

      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "TransactionEvent",
        payload: req,
      });

      const conn = this.connections.get(ocppIdentity);
      if (!conn?.stationId) {
        return { idTokenInfo: { status: "Invalid" } };
      }

      const station = await db.getChargingStationById(conn.stationId);
      if (!station) {
        return { idTokenInfo: { status: "Invalid" } };
      }

      // Obtener EVSE
      const evses = await db.getEvsesByStationId(conn.stationId);
      const evse = evses.find(e => e.evseIdLocal === req.evse?.id);

      if (!evse) {
        return { idTokenInfo: { status: "Invalid" } };
      }

      switch (req.eventType) {
        case "Started": {
          // Buscar usuario por idToken
          let userId = 1; // Default para pruebas
          if (req.idToken) {
            // TODO: Buscar usuario por token RFID o app
          }

          // Obtener tarifa activa
          const tariff = await db.getActiveTariffByStationId(conn.stationId);

          // Crear transacción
          const transactionId = await db.createTransaction({
            evseId: evse.id,
            userId,
            stationId: conn.stationId,
            tariffId: tariff?.id,
            ocppTransactionId: req.transactionInfo.transactionId,
            startTime: new Date(req.timestamp),
            status: "IN_PROGRESS",
            startMethod: req.idToken?.type || "LOCAL",
          });

          // Actualizar estado del EVSE
          await db.updateEvse(evse.id, {
            status: "CHARGING",
            currentTransactionId: transactionId,
            currentUserId: userId,
          });

          // Guardar meter values iniciales
          if (req.meterValue) {
            for (const mv of req.meterValue) {
              for (const sv of mv.sampledValue) {
                await db.createMeterValue({
                  transactionId,
                  evseId: evse.id,
                  timestamp: new Date(mv.timestamp),
                  energyKwh: sv.measurand === "Energy.Active.Import.Register" ? (sv.value / 1000).toString() : undefined,
                  powerKw: sv.measurand === "Power.Active.Import" ? (sv.value / 1000).toString() : undefined,
                  context: sv.context,
                  measurand: sv.measurand,
                });
              }
            }
          }

          return {
            idTokenInfo: { status: "Accepted" },
            updatedPersonalMessage: {
              format: "UTF8",
              content: "Carga iniciada. ¡Bienvenido a Green EV!",
            },
          };
        }

        case "Updated": {
          // Buscar transacción activa
          const transaction = await db.getTransactionByOcppId(req.transactionInfo.transactionId);
          if (!transaction) {
            return { idTokenInfo: { status: "Invalid" } };
          }

          // Guardar meter values
          if (req.meterValue) {
            for (const mv of req.meterValue) {
              for (const sv of mv.sampledValue) {
                await db.createMeterValue({
                  transactionId: transaction.id,
                  evseId: evse.id,
                  timestamp: new Date(mv.timestamp),
                  energyKwh: sv.measurand === "Energy.Active.Import.Register" ? (sv.value / 1000).toString() : undefined,
                  powerKw: sv.measurand === "Power.Active.Import" ? (sv.value / 1000).toString() : undefined,
                  voltage: sv.measurand === "Voltage" ? sv.value.toString() : undefined,
                  current: sv.measurand === "Current.Import" ? sv.value.toString() : undefined,
                  soc: sv.measurand === "SoC" ? sv.value : undefined,
                  context: sv.context,
                  measurand: sv.measurand,
                });
              }
            }
          }

          return {};
        }

        case "Ended": {
          // Buscar transacción
          const transaction = await db.getTransactionByOcppId(req.transactionInfo.transactionId);
          if (!transaction) {
            return { idTokenInfo: { status: "Invalid" } };
          }

          // Calcular consumo total
          const meterValues = await db.getMeterValuesByTransactionId(transaction.id);
          let totalKwh = 0;
          if (meterValues.length > 0) {
            const lastMeter = meterValues[meterValues.length - 1];
            const firstMeter = meterValues[0];
            totalKwh = parseFloat(lastMeter.energyKwh || "0") - parseFloat(firstMeter.energyKwh || "0");
          }

          // Obtener tarifa
          const tariff = await db.getTariffById(transaction.tariffId || 0);
          const pricePerKwh = parseFloat(tariff?.pricePerKwh || "0");

          // Calcular costos
          const energyCost = totalKwh * pricePerKwh;
          const totalCost = energyCost; // TODO: Agregar otros costos (tiempo, sesión)

          // Distribución de ingresos según configuración del admin
          const revenueConfig = await db.getRevenueShareConfig();
          const investorShare = totalCost * (revenueConfig.investorPercent / 100);
          const platformFee = totalCost * (revenueConfig.platformPercent / 100);

          // Actualizar transacción
          await db.updateTransaction(transaction.id, {
            endTime: new Date(req.timestamp),
            kwhConsumed: totalKwh.toString(),
            energyCost: energyCost.toString(),
            totalCost: totalCost.toString(),
            investorShare: investorShare.toString(),
            platformFee: platformFee.toString(),
            status: "COMPLETED",
            stopReason: req.transactionInfo.stoppedReason || req.triggerReason,
          });

          // Actualizar estado del EVSE
          await db.updateEvse(evse.id, {
            status: "AVAILABLE",
            currentTransactionId: null,
            currentUserId: null,
          });

          // Descontar de la billetera del usuario
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
                  console.log(`[OCPP] Auto-cobro exitoso: $${autoResult.amountCharged} cobrados a tarjeta`);
                } else if (autoResult) {
                  console.log(`[OCPP] Auto-cobro fallido: ${autoResult.error}`);
                }
              } catch (autoErr) {
                console.warn(`[OCPP] Error en auto-cobro:`, autoErr);
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
              description: `Pago por carga de ${totalKwh.toFixed(2)} kWh`,
            });
          }

          // Crear notificación
          await db.createNotification({
            userId: transaction.userId,
            title: "Carga completada",
            message: `Tu carga ha finalizado. Consumo: ${totalKwh.toFixed(2)} kWh. Total: $${totalCost.toLocaleString()} COP`,
            type: "CHARGE_COMPLETE",
            referenceId: transaction.id,
            referenceType: "TRANSACTION",
          });

          return {
            totalCost: totalCost,
            idTokenInfo: { status: "Accepted" },
          };
        }
      }

      return {};
    });

    // MeterValues - Valores de medición periódicos
    this.server.on("MeterValues", async (req: MeterValuesRequest, client: RPCClient) => {
      const ocppIdentity = this.getIdentityByClient(client);

      await db.createOcppLog({
        ocppIdentity,
        direction: "IN",
        messageType: "MeterValues",
        payload: req,
      });

      const conn = this.connections.get(ocppIdentity);
      if (!conn?.stationId) {
        return {};
      }

      // Buscar EVSE y transacción activa
      const evses = await db.getEvsesByStationId(conn.stationId);
      const evse = evses.find(e => e.evseIdLocal === req.evseId);

      if (evse?.currentTransactionId) {
        for (const mv of req.meterValue) {
          for (const sv of mv.sampledValue) {
            await db.createMeterValue({
              transactionId: evse.currentTransactionId,
              evseId: evse.id,
              timestamp: new Date(mv.timestamp),
              energyKwh: sv.measurand === "Energy.Active.Import.Register" ? (sv.value / 1000).toString() : undefined,
              powerKw: sv.measurand === "Power.Active.Import" ? (sv.value / 1000).toString() : undefined,
              voltage: sv.measurand === "Voltage" ? sv.value.toString() : undefined,
              current: sv.measurand === "Current.Import" ? sv.value.toString() : undefined,
              soc: sv.measurand === "SoC" ? sv.value : undefined,
              context: sv.context,
              measurand: sv.measurand,
            });
          }
        }
      }

      return {};
    });
  }

  /**
   * Obtiene la identidad OCPP de un cliente
   */
  private getIdentityByClient(client: RPCClient): string {
    for (const [identity, conn] of Array.from(this.connections.entries())) {
      if (conn.client === client) {
        return identity;
      }
    }
    return "unknown";
  }

  /**
   * Maneja la desconexión de una estación
   */
  private async handleDisconnection(ocppIdentity: string): Promise<void> {
    const conn = this.connections.get(ocppIdentity);
    if (conn?.stationId) {
      await db.updateStationOnlineStatus(ocppIdentity, false);
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
  // COMANDOS REMOTOS (CSMS -> Charging Station)
  // ============================================================================

  /**
   * Inicia una carga de forma remota
   */
  async requestStartTransaction(
    ocppIdentity: string,
    evseId: number,
    idToken: string,
    remoteStartId?: number
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("RequestStartTransaction", {
      evseId,
      idToken: {
        idToken,
        type: "Central",
      },
      remoteStartId: remoteStartId || Math.floor(Math.random() * 1000000),
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "RequestStartTransaction",
      payload: { evseId, idToken, remoteStartId },
    });

    return response;
  }

  /**
   * Detiene una carga de forma remota
   */
  async requestStopTransaction(
    ocppIdentity: string,
    transactionId: string
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("RequestStopTransaction", {
      transactionId,
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "RequestStopTransaction",
      payload: { transactionId },
    });

    return response;
  }

  /**
   * Reserva un conector
   */
  async reserveNow(
    ocppIdentity: string,
    evseId: number,
    reservationId: number,
    expiryDateTime: Date,
    idToken: string
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("ReserveNow", {
      id: reservationId,
      evseId,
      expiryDateTime: expiryDateTime.toISOString(),
      idToken: {
        idToken,
        type: "Central",
      },
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "ReserveNow",
      payload: { reservationId, evseId, expiryDateTime, idToken },
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

    const response = await conn.client.call("CancelReservation", {
      reservationId,
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "CancelReservation",
      payload: { reservationId },
    });

    return response;
  }

  /**
   * Configura un perfil de carga
   */
  async setChargingProfile(
    ocppIdentity: string,
    evseId: number,
    chargingProfile: {
      id: number;
      stackLevel: number;
      chargingProfilePurpose: string;
      chargingProfileKind: string;
      chargingSchedule: Array<{
        id: number;
        chargingRateUnit: string;
        chargingSchedulePeriod: Array<{
          startPeriod: number;
          limit: number;
        }>;
      }>;
    }
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("SetChargingProfile", {
      evseId,
      chargingProfile,
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "SetChargingProfile",
      payload: { evseId, chargingProfile },
    });

    return response;
  }

  /**
   * Reinicia una estación de carga
   */
  async reset(
    ocppIdentity: string,
    type: "Immediate" | "OnIdle"
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("Reset", { type }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "Reset",
      payload: { type },
    });

    return response;
  }

  /**
   * Actualiza el firmware de una estación
   */
  async updateFirmware(
    ocppIdentity: string,
    location: string,
    retrieveDateTime: Date,
    requestId: number
  ): Promise<{ status: string }> {
    const conn = this.connections.get(ocppIdentity);
    if (!conn) {
      throw new Error("Charging station not connected");
    }

    const response = await conn.client.call("UpdateFirmware", {
      requestId,
      location,
      retrieveDateTime: retrieveDateTime.toISOString(),
    }) as { status: string };

    await db.createOcppLog({
      ocppIdentity,
      stationId: conn.stationId,
      direction: "OUT",
      messageType: "UpdateFirmware",
      payload: { requestId, location, retrieveDateTime },
    });

    return response;
  }

  /**
   * Obtiene el estado de todas las conexiones
   */
  getConnectionsStatus(): Array<{
    ocppIdentity: string;
    stationId: number | null;
    connectedAt: Date;
    lastHeartbeat: Date;
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      ocppIdentity: conn.ocppIdentity,
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
}

// Singleton instance
let csmsInstance: CSMS | null = null;

export function getCSMS(): CSMS {
  if (!csmsInstance) {
    csmsInstance = new CSMS();
  }
  return csmsInstance;
}

export async function startCSMS(port: number = 9000): Promise<CSMS> {
  const csms = getCSMS();
  await csms.start(port);
  return csms;
}
