/**
 * OCPP Router - Endpoints para monitoreo y control de cargadores OCPP
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as ocppManager from "./connection-manager";
import * as db from "../db";
import { nanoid } from "nanoid";
import { dualCSMS } from "./csms-dual";
import { storagePut } from "../storage";
import { checkStationHealth, generateOfflineAlerts } from "./station-health-monitor";

// Procedimiento para admin y técnicos
const ocppProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "technician" && ctx.user.role !== "engineer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de administrador, ingeniero o técnico.",
    });
  }
  return next({ ctx });
});

export const ocppRouter = router({
  /**
   * Obtener todas las conexiones OCPP activas
   * Combina conexiones en memoria con conexiones inferidas de logs de BD
   */
  getActiveConnections: ocppProcedure.query(async () => {
    // Obtener conexiones en memoria (tiempo real)
    const memoryConnections = ocppManager.getAllConnections();
    
    // Obtener conexiones desde logs de BD (persistente)
    const dbConnections = await db.getActiveConnectionsFromLogs();
    
    // Combinar: usar memoria como fuente principal, BD como respaldo
    const connectionMap = new Map<string, any>();
    
    // Primero agregar conexiones de BD
    for (const conn of dbConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    
    // Luego sobrescribir con conexiones en memoria (más actualizadas)
    for (const conn of memoryConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    
    return Array.from(connectionMap.values());
  }),

  /**
   * Obtener estadísticas de conexiones
   * Combina datos de memoria y BD
   */
  getConnectionStats: ocppProcedure.query(async () => {
    // Obtener conexiones combinadas
    const memoryConnections = ocppManager.getAllConnections();
    const dbConnections = await db.getActiveConnectionsFromLogs();
    
    // Combinar
    const connectionMap = new Map<string, any>();
    for (const conn of dbConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    for (const conn of memoryConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    
    const allConnections = Array.from(connectionMap.values());
    
    let connectedCount = 0;
    let disconnectedCount = 0;
    const byVersion: Record<string, number> = {};
    
    for (const conn of allConnections) {
      if (conn.isConnected) {
        connectedCount++;
      } else {
        disconnectedCount++;
      }
      
      const version = conn.ocppVersion || '1.6';
      byVersion[version] = (byVersion[version] || 0) + 1;
    }
    
    return {
      totalConnections: allConnections.length,
      connectedCount,
      disconnectedCount,
      byVersion,
    };
  }),

  /**
   * Obtener logs OCPP con filtros
   */
  getLogs: ocppProcedure
    .input(z.object({
      stationId: z.number().optional(),
      ocppIdentity: z.string().optional(),
      messageType: z.string().optional(),
      direction: z.enum(["IN", "OUT"]).optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return db.getOcppLogs(input);
    }),

  /**
   * Obtener logs por estación
   */
  getLogsByStation: ocppProcedure
    .input(z.object({
      stationId: z.number(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input }) => {
      return db.getOcppLogsByStation(input.stationId, input.limit);
    }),

  /**
   * Obtener tipos de mensajes únicos (para filtros)
   */
  getMessageTypes: ocppProcedure.query(async () => {
    return db.getOcppMessageTypes();
  }),

  /**
   * Enviar comando Reset a un cargador
   */
  sendReset: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      type: z.enum(["Soft", "Hard"]).default("Soft"),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "Reset",
        { type: input.type }
      );

      // Registrar el comando en logs
      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "Reset",
        messageId,
        payload: { type: input.type, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando UnlockConnector
   */
  sendUnlockConnector: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      connectorId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "UnlockConnector",
        { connectorId: input.connectorId }
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "UnlockConnector",
        messageId,
        payload: { connectorId: input.connectorId, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando RemoteStartTransaction
   */
  sendRemoteStart: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      connectorId: z.number(),
      idTag: z.string().default("ADMIN"),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "RemoteStartTransaction",
        { connectorId: input.connectorId, idTag: input.idTag }
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "RemoteStartTransaction",
        messageId,
        payload: { connectorId: input.connectorId, idTag: input.idTag, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando RemoteStopTransaction
   */
  sendRemoteStop: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      transactionId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "RemoteStopTransaction",
        { transactionId: input.transactionId }
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "RemoteStopTransaction",
        messageId,
        payload: { transactionId: input.transactionId, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando ChangeAvailability
   */
  sendChangeAvailability: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      connectorId: z.number(),
      type: z.enum(["Operative", "Inoperative"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "ChangeAvailability",
        { connectorId: input.connectorId, type: input.type }
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "ChangeAvailability",
        messageId,
        payload: { connectorId: input.connectorId, type: input.type, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando GetConfiguration
   */
  sendGetConfiguration: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      keys: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const payload = input.keys ? { key: input.keys } : {};
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "GetConfiguration",
        payload
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "GetConfiguration",
        messageId,
        payload: { ...payload, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando ChangeConfiguration
   */
  sendChangeConfiguration: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      key: z.string(),
      value: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const payload = { key: input.key, value: input.value };
      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "ChangeConfiguration",
        payload
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "ChangeConfiguration",
        messageId,
        payload: { ...payload, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  /**
   * Enviar comando TriggerMessage (solicitar mensaje específico)
   */
  sendTriggerMessage: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
      requestedMessage: z.enum([
        "BootNotification",
        "DiagnosticsStatusNotification",
        "FirmwareStatusNotification",
        "Heartbeat",
        "MeterValues",
        "StatusNotification",
      ]),
      connectorId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const messageId = nanoid(8);
      const payload: any = { requestedMessage: input.requestedMessage };
      if (input.connectorId !== undefined) {
        payload.connectorId = input.connectorId;
      }

      const success = ocppManager.sendOcppCommand(
        input.ocppIdentity,
        messageId,
        "TriggerMessage",
        payload
      );

      await db.createOcppLog({
        ocppIdentity: input.ocppIdentity,
        direction: "OUT",
        messageType: "TriggerMessage",
        messageId,
        payload: { ...payload, sentBy: ctx.user.email },
      });

      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador no está conectado",
        });
      }

      return { success: true, messageId };
    }),

  // ============================================================================
  // ALERTAS OCPP
  // ============================================================================

  /**
   * Obtener alertas OCPP
   */
  getAlerts: ocppProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      includeAcknowledged: z.boolean().default(false),
      ocppIdentity: z.string().optional(),
      severity: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getOcppAlerts(input);
    }),

  /**
   * Obtener estadísticas de alertas
   */
  getAlertStats: ocppProcedure.query(async () => {
    return db.getOcppAlertStats();
  }),

  /**
   * Reconocer una alerta
   */
  acknowledgeAlert: ocppProcedure
    .input(z.object({
      alertId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.acknowledgeOcppAlert(input.alertId, ctx.user.id);
      return { success: true };
    }),

  // ============================================================================
  // MÉTRICAS OCPP
  // ============================================================================

  /**
   * Obtener métricas de conexiones
   */
  getConnectionMetrics: ocppProcedure
    .input(z.object({
      startDate: z.string().transform(s => new Date(s)),
      endDate: z.string().transform(s => new Date(s)),
      granularity: z.enum(["hour", "day"]).default("hour"),
    }))
    .query(async ({ input }) => {
      return db.getOcppConnectionMetrics(input.startDate, input.endDate, input.granularity);
    }),

  /**
   * Obtener métricas de mensajes OCPP
   */
  getMessageMetrics: ocppProcedure
    .input(z.object({
      startDate: z.string().transform(s => new Date(s)),
      endDate: z.string().transform(s => new Date(s)),
      granularity: z.enum(["hour", "day"]).default("hour"),
    }))
    .query(async ({ input }) => {
      return db.getOcppMessageMetrics(input.startDate, input.endDate, input.granularity);
    }),

  /**
   * Obtener métricas de transacciones
   */
  getTransactionMetrics: ocppProcedure
    .input(z.object({
      startDate: z.string().transform(s => new Date(s)),
      endDate: z.string().transform(s => new Date(s)),
      granularity: z.enum(["hour", "day"]).default("day"),
    }))
    .query(async ({ input }) => {
      return db.getTransactionMetrics(input.startDate, input.endDate, input.granularity);
    }),

  // ============================================================================
  // FIRMWARE MANAGEMENT
  // ============================================================================

  /**
   * Upload firmware file and start update on a charger
   */
  uploadAndStartFirmware: ocppProcedure
    .input(z.object({
      stationId: z.number(),
      ocppIdentity: z.string(),
      fileName: z.string(),
      fileBase64: z.string(),
      fileSize: z.number(),
      version: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Upload firmware to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `firmware/${Date.now()}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, "application/octet-stream");

      // Create firmware update record
      const id = await db.createFirmwareUpdate({
        stationId: input.stationId,
        ocppIdentity: input.ocppIdentity,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileUrl,
        version: input.version,
        initiatedBy: ctx.user.id,
        notes: input.notes,
      });

      // Send OCPP UpdateFirmware command
      try {
        await dualCSMS.updateFirmware(input.ocppIdentity, fileUrl);
        await db.updateFirmwareStatus(id, "DOWNLOADING", 10);
      } catch (error: any) {
        await db.updateFirmwareStatus(id, "FAILED", 0, error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `No se pudo enviar el firmware: ${error.message}`,
        });
      }

      return { id, status: "DOWNLOADING" };
    }),

  /**
   * Get firmware update history
   */
  getFirmwareHistory: ocppProcedure
    .input(z.object({
      stationId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      if (input.stationId) {
        return db.getFirmwareUpdatesByStation(input.stationId, input.limit);
      }
      return db.getAllFirmwareUpdates(input.limit);
    }),

  /**
   * Get active firmware updates (in progress)
   */
  getActiveFirmwareUpdates: ocppProcedure.query(async () => {
    return db.getActiveFirmwareUpdates();
  }),

  /**
   * Cancel a firmware update
   */
  cancelFirmwareUpdate: ocppProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateFirmwareStatus(
        input.id,
        "CANCELLED",
        0,
        input.reason || "Cancelado por el técnico"
      );
      return { success: true };
    }),

  // ============================================================================
  // STATION HEALTH MONITORING
  // ============================================================================

  /**
   * Obtener estado de salud de todas las estaciones
   * Detecta estaciones offline sin depender de conexión OCPP previa
   */
  getStationHealth: ocppProcedure.query(async () => {
    return checkStationHealth();
  }),

  /**
   * Generar alertas para estaciones offline
   * Se puede llamar manualmente o periódicamente
   */
  generateOfflineAlerts: ocppProcedure.mutation(async () => {
    const count = await generateOfflineAlerts();
    return { alertsGenerated: count };
  }),
});
