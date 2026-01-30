/**
 * OCPP Router - Endpoints para monitoreo y control de cargadores OCPP
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as ocppManager from "./connection-manager";
import * as db from "../db";
import { nanoid } from "nanoid";

// Procedimiento para admin y técnicos
const ocppProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "technician") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de administrador o técnico.",
    });
  }
  return next({ ctx });
});

export const ocppRouter = router({
  /**
   * Obtener todas las conexiones OCPP activas
   */
  getActiveConnections: ocppProcedure.query(async () => {
    return ocppManager.getAllConnections();
  }),

  /**
   * Obtener estadísticas de conexiones
   */
  getConnectionStats: ocppProcedure.query(async () => {
    return ocppManager.getConnectionStats();
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
});
