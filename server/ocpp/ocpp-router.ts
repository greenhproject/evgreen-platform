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
    // Fuente principal: conexiones WebSocket activas en dualCSMS (tiempo real)
    const csmsConnections = dualCSMS.getConnectionsStatus();
    
    // Fuente secundaria: conexiones del connection-manager legacy
    const legacyConnections = ocppManager.getAllConnections();
    
    // Fuente terciaria: conexiones inferidas de logs de BD (persistente)
    const dbConnections = await db.getActiveConnectionsFromLogs();
    
    // Pre-cargar todas las estaciones para resolver stationId por ocppIdentity
    const allStations = await db.getAllChargingStations();
    const stationByOcppId = new Map<string, number>();
    for (const s of allStations) {
      if (s.ocppIdentity) stationByOcppId.set(s.ocppIdentity, s.id);
    }
    
    // Combinar: dualCSMS > legacy > BD
    const connectionMap = new Map<string, any>();
    
    // Primero agregar conexiones de BD (menor prioridad)
    for (const conn of dbConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    
    // Luego legacy connections
    for (const conn of legacyConnections) {
      connectionMap.set(conn.ocppIdentity, conn);
    }
    
    // Finalmente dualCSMS (mayor prioridad, fuente real)
    // Obtener connector statuses del connection-manager para cada conexión
    for (const conn of csmsConnections) {
      // Resolver stationId desde BD si es null
      const resolvedStationId = conn.stationId ?? stationByOcppId.get(conn.ocppIdentity) ?? null;
      // Obtener estados de conectores desde connection-manager
      const liveConn = ocppManager.getConnection(conn.ocppIdentity);
      const connectorStatuses: Record<string, string> = {};
      if (liveConn?.connectorStatuses) {
        for (const [k, v] of Object.entries(liveConn.connectorStatuses)) {
          connectorStatuses[k] = v as string;
        }
      }
      connectionMap.set(conn.ocppIdentity, {
        ocppIdentity: conn.ocppIdentity,
        ocppVersion: conn.ocppVersion,
        stationId: resolvedStationId,
        connectedAt: conn.connectedAt.toISOString(),
        lastHeartbeat: conn.lastHeartbeat.toISOString(),
        lastMessage: conn.lastHeartbeat.toISOString(),
        connectorStatuses,
        isConnected: true, // Si está en dualCSMS, está conectado
      });
    }
    
    return Array.from(connectionMap.values());
  }),

  /**
   * Obtener estadísticas de conexiones
   * Combina datos de memoria y BD
   */
  getConnectionStats: ocppProcedure.query(async () => {
    // Fuente principal: dualCSMS (conexiones WebSocket reales)
    const csmsConnections = dualCSMS.getConnectionsStatus();
    const legacyConnections = ocppManager.getAllConnections();
    const dbConnections = await db.getActiveConnectionsFromLogs();
    
    // Combinar: dualCSMS > legacy > BD
    const connectionMap = new Map<string, any>();
    for (const conn of dbConnections) {
      connectionMap.set(conn.ocppIdentity, { ...conn, source: 'db' });
    }
    for (const conn of legacyConnections) {
      connectionMap.set(conn.ocppIdentity, { ...conn, source: 'legacy' });
    }
    for (const conn of csmsConnections) {
      connectionMap.set(conn.ocppIdentity, {
        ocppIdentity: conn.ocppIdentity,
        ocppVersion: conn.ocppVersion,
        isConnected: true,
        source: 'csms',
      });
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
   * Obtener lista única de Charge Point IDs desde los logs (legacy)
   */
  getChargePointIds: ocppProcedure.query(async () => {
    return db.getOcppChargePointIds();
  }),

  /**
   * Obtener cargadores registrados en BD con estado OCPP en tiempo real
   * Fuente principal: tabla charging_stations (solo cargadores reales)
   * Enriquecido con: conexión WebSocket activa + último log reciente
   */
  getRegisteredChargers: ocppProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["all", "connected", "disconnected"]).default("all"),
      sortBy: z.enum(["name", "status", "lastActivity"]).default("status"),
    }).optional())
    .query(async ({ input }) => {
      const filters = input || { status: "all", sortBy: "status" };
      
      // 1. Obtener TODAS las estaciones registradas en BD
      const stations = await db.getAllChargingStations();
      
      // 2. Obtener conexiones WebSocket activas de dualCSMS
      const csmsConnections = dualCSMS.getConnectionsStatus();
      const csmsDiagnostics = dualCSMS.getDetailedDiagnostics();
      const csmsMap = new Map<string, any>();
      for (const conn of csmsConnections) {
        csmsMap.set(conn.ocppIdentity, conn);
      }
      const diagMap = new Map<string, any>();
      for (const diag of csmsDiagnostics) {
        diagMap.set(diag.ocppIdentity, diag);
      }
      
      // 2b. Obtener estados del connection-manager (incluye grace period)
      // Esto cubre el caso donde dualCSMS eliminó la conexión pero el cargador está reconectando
      const cmConnections = ocppManager.getAllConnections();
      const cmMap = new Map<string, any>();
      for (const conn of cmConnections) {
        cmMap.set(conn.ocppIdentity, conn);
      }
      
      // 3. Obtener última actividad de logs para cada estación (fallback si no hay WS)
      const recentActivityMap = new Map<string, { lastLogAt: Date; lastAction: string }>();
      for (const station of stations) {
        if (station.ocppIdentity) {
          try {
            const logs = await db.getOcppLogs({
              ocppIdentity: station.ocppIdentity,
              limit: 1,
              offset: 0,
            });
            if (logs.logs && logs.logs.length > 0) {
              const lastLog = logs.logs[0];
              recentActivityMap.set(station.ocppIdentity, {
                lastLogAt: new Date(lastLog.createdAt),
                lastAction: lastLog.messageType || "unknown",
              });
            }
          } catch (e) {
            // Ignore errors for individual stations
          }
        }
      }
      
      // 4. Construir lista enriquecida
      let chargers = stations
        .filter((s: any) => s.ocppIdentity) // Solo estaciones con OCPP identity
        .map((station: any) => {
          const ocppId = station.ocppIdentity!;
          const wsConn = csmsMap.get(ocppId);
          const diag = diagMap.get(ocppId);
          const recentActivity = recentActivityMap.get(ocppId);
          
          // Determinar estado de conexión:
          // 1. WebSocket activo en dualCSMS = conectado (fuente principal)
          // 2. Connection-manager en grace period = reconectando (cubre proxy cycling)
          // 3. Log reciente < 5 minutos = probablemente conectado (fallback)
          // 4. isOnline en BD = último estado conocido
          const hasActiveWs = !!wsConn;
          const cmConn = cmMap.get(ocppId);
          const isInGrace = ocppManager.isInGracePeriod(ocppId);
          const hasRecentLog = recentActivity 
            ? (Date.now() - recentActivity.lastLogAt.getTime()) < 5 * 60 * 1000 
            : false;
          const isConnected = hasActiveWs || isInGrace || hasRecentLog;
          const isReconnecting = !hasActiveWs && isInGrace;
          
          return {
            id: station.id,
            name: station.name,
            ocppIdentity: ocppId,
            address: station.address,
            city: station.city,
            manufacturer: station.manufacturer,
            model: station.model,
            isActive: station.isActive,
            isOnline: station.isOnline,
            // Estado de conexión
            isConnected,
            isReconnecting,
            connectionSource: hasActiveWs ? "websocket" : isInGrace ? "grace_period" : hasRecentLog ? "recent_log" : "none",
            // Datos de WebSocket (si hay conexión activa o en grace period)
            ocppVersion: wsConn?.ocppVersion || cmConn?.ocppVersion || null,
            connectedAt: wsConn?.connectedAt?.toISOString() || cmConn?.connectedAt || null,
            lastHeartbeat: wsConn?.lastHeartbeat?.toISOString() || cmConn?.lastHeartbeat || null,
            // Datos de diagnóstico
            wsReadyState: diag?.wsReadyState ?? (isInGrace ? 0 : null),
            uptimeSeconds: diag?.uptimeSeconds ?? (cmConn ? Math.floor((Date.now() - new Date(cmConn.connectedAt).getTime()) / 1000) : null),
            pendingCallsCount: diag?.pendingCallsCount ?? 0,
            isHealthy: diag?.isHealthy ?? isInGrace,
            // Última actividad de logs
            lastActivity: recentActivity?.lastLogAt?.toISOString() || station.lastBootNotification?.toISOString() || null,
            lastAction: recentActivity?.lastAction || null,
          };
        });
      
      // 5. Filtrar por búsqueda
      if (filters.search) {
        const q = filters.search.toLowerCase();
        chargers = chargers.filter((c: any) => 
          c.name.toLowerCase().includes(q) || 
          c.ocppIdentity.toLowerCase().includes(q) ||
          (c.address && c.address.toLowerCase().includes(q))
        );
      }
      
      // 6. Filtrar por estado
      if (filters.status === "connected") {
        chargers = chargers.filter((c: any) => c.isConnected);
      } else if (filters.status === "disconnected") {
        chargers = chargers.filter((c: any) => !c.isConnected);
      }
      
      // 7. Ordenar
      chargers.sort((a: any, b: any) => {
        if (filters.sortBy === "status") {
          // Conectados primero, luego por nombre
          if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
          return a.name.localeCompare(b.name);
        } else if (filters.sortBy === "lastActivity") {
          const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return bTime - aTime; // Más reciente primero
        } else {
          return a.name.localeCompare(b.name);
        }
      });
      
      // 8. Stats
      const allChargers = stations.filter((s: any) => s.ocppIdentity);
      const connectedCount = chargers.filter((c: any) => c.isConnected).length;
      
      return {
        chargers,
        stats: {
          total: allChargers.length,
          connected: connectedCount,
          disconnected: allChargers.length - connectedCount,
          healthy: chargers.filter((c: any) => c.isHealthy).length,
        },
      };
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
      // Intentar primero con dualCSMS (fuente real), luego legacy
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "Reset",
        { type: input.type }
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "Reset",
          { type: input.type }
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "UnlockConnector",
        { connectorId: input.connectorId }
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "UnlockConnector",
          { connectorId: input.connectorId }
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "RemoteStartTransaction",
        { connectorId: input.connectorId, idTag: input.idTag }
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "RemoteStartTransaction",
          { connectorId: input.connectorId, idTag: input.idTag }
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "RemoteStopTransaction",
        { transactionId: input.transactionId }
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "RemoteStopTransaction",
          { transactionId: input.transactionId }
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "ChangeAvailability",
        { connectorId: input.connectorId, type: input.type }
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "ChangeAvailability",
          { connectorId: input.connectorId, type: input.type }
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "GetConfiguration",
        payload
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "GetConfiguration",
          payload
        );
      }

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
      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "ChangeConfiguration",
        payload
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "ChangeConfiguration",
          payload
        );
      }

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

      let success = dualCSMS.sendCommandIfConnected(
        input.ocppIdentity,
        messageId,
        "TriggerMessage",
        payload
      );
      if (!success) {
        success = ocppManager.sendOcppCommand(
          input.ocppIdentity,
          messageId,
          "TriggerMessage",
          payload
        );
      }

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
  // DIAGNÓSTICO EN TIEMPO REAL
  // ============================================================================

  /**
   * Obtener diagnóstico detallado de todas las conexiones WebSocket activas
   * Incluye readyState, pendingCalls, uptime, heartbeat age
   */
  getDiagnostics: ocppProcedure.query(async () => {
    const diagnostics = dualCSMS.getDetailedDiagnostics();
    
    // Enriquecer con datos de BD (nombre, modelo, etc.)
    const enriched = await Promise.all(
      diagnostics.map(async (diag) => {
        const station = diag.stationId
          ? await db.getChargingStationById(diag.stationId)
          : await db.getChargingStationByOcppIdentity(diag.ocppIdentity);
        const evses = station ? await db.getEvsesByStationId(station.id) : [];
        return {
          ...diag,
          stationName: station?.name || diag.ocppIdentity,
          manufacturer: station?.manufacturer || null,
          model: station?.model || null,
          serialNumber: station?.serialNumber || null,
          firmwareVersion: station?.firmwareVersion || null,
          address: station?.address || null,
          connectors: evses.map(e => ({
            connectorId: e.evseIdLocal,
            status: e.status,
            connectorType: e.connectorType,
            powerKw: e.powerKw,
          })),
        };
      })
    );
    return enriched;
  }),

  /**
   * Obtener detalle completo de un cargador específico
   * Combina datos de conexión WebSocket + BD + logs recientes
   */
  getChargerDetail: ocppProcedure
    .input(z.object({ ocppIdentity: z.string() }))
    .query(async ({ input }) => {
      // Datos de conexión en tiempo real del connection-manager (fuente real de datos OCPP)
      const liveConn = ocppManager.getConnection(input.ocppIdentity);
      const liveConnInfo = ocppManager.getAllConnections().find(c => c.ocppIdentity === input.ocppIdentity);
      
      // Verificar si está en grace period (reconectando tras cierre cíclico del proxy)
      const inGracePeriod = ocppManager.isInGracePeriod(input.ocppIdentity);
      const persistentState = ocppManager.getPersistentState(input.ocppIdentity);
      
      // Datos de BD
      const station = await db.getChargingStationByOcppIdentity(input.ocppIdentity);
      const evses = station ? await db.getEvsesByStationId(station.id) : [];
      
      // Últimos 30 logs de este cargador
      const recentLogs = await db.getOcppLogs({
        ocppIdentity: input.ocppIdentity,
        limit: 30,
        offset: 0,
      });
      
      // Calcular campos derivados para el frontend
      // Si hay conexión activa, usar su readyState; si está en grace period, mostrar como RECONNECTING (no CLOSED)
      const wsReadyState = liveConn ? liveConn.ws.readyState : (inGracePeriod ? 0 : 3);
      const wsReadyStateLabels: Record<number, string> = { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' };
      const wsLabel = liveConn 
        ? (wsReadyStateLabels[liveConn.ws.readyState] || 'UNKNOWN')
        : (inGracePeriod ? 'RECONNECTING' : 'CLOSED');
      const now = Date.now();
      
      // Usar datos del estado persistente cuando está en grace period
      const effectiveConnInfo = liveConnInfo || (persistentState ? {
        ocppIdentity: persistentState.ocppIdentity,
        ocppVersion: persistentState.ocppVersion,
        stationId: persistentState.stationId,
        connectedAt: persistentState.originalConnectedAt.toISOString(),
        lastHeartbeat: persistentState.lastHeartbeat.toISOString(),
        lastMessage: persistentState.lastMessage.toISOString(),
        connectorStatuses: Object.fromEntries(persistentState.connectorStatuses),
        bootInfo: persistentState.bootInfo,
        isConnected: false,
        seamlessReconnections: persistentState.seamlessReconnections,
        lastSeamlessReconnect: persistentState.lastSeamlessReconnect?.toISOString() || null,
      } : null);
      
      const connectedAtMs = effectiveConnInfo ? new Date(effectiveConnInfo.connectedAt).getTime() : 0;
      const lastHeartbeatMs = effectiveConnInfo ? new Date(effectiveConnInfo.lastHeartbeat).getTime() : 0;
      
      const enrichedConnection = effectiveConnInfo ? {
        ...effectiveConnInfo,
        wsReadyState,
        wsReadyStateLabel: wsLabel,
        uptimeSeconds: Math.floor((now - connectedAtMs) / 1000),
        heartbeatAgeSeconds: lastHeartbeatMs > 0 ? Math.floor((now - lastHeartbeatMs) / 1000) : -1,
        pendingCallsCount: 0,
        isReconnecting: inGracePeriod,
      } : null;
      
      // isConnected: true si hay WS activo O si está en grace period (reconectando)
      const effectivelyConnected = (!!liveConn && liveConn.ws.readyState === 1) || inGracePeriod;
      
      return {
        ocppIdentity: input.ocppIdentity,
        isConnected: effectivelyConnected,
        isReconnecting: inGracePeriod,
        // Datos de conexión en tiempo real con campos calculados
        connection: enrichedConnection,
        // Datos de BD
        station: station ? {
          id: station.id,
          name: station.name,
          address: station.address,
          city: station.city,
          manufacturer: station.manufacturer,
          model: station.model,
          serialNumber: station.serialNumber,
          firmwareVersion: station.firmwareVersion,
          isOnline: station.isOnline,
          isActive: station.isActive,
          lastBootNotification: station.lastBootNotification,
        } : null,
        connectors: evses.map(e => {
          // Priorizar estado OCPP en tiempo real del connection-manager sobre la BD
          const liveStatus = liveConnInfo?.connectorStatuses?.[e.evseIdLocal];
          return {
            id: e.id,
            connectorId: e.evseIdLocal,
            status: liveStatus || e.status, // OCPP en tiempo real > BD
            dbStatus: e.status, // Siempre incluir estado de BD para referencia
            connectorType: e.connectorType,
            powerKw: e.powerKw,
          };
        }),
        recentLogs: recentLogs.logs || [],
        totalLogs: recentLogs.total || 0,
      };
    }),

  // ============================================================================
  // ALERTAS OCPP
  // ============================================================================

  /**
   * Obtener alertas OCPP activas (no resueltas)
   */
  getAlerts: ocppProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      includeAcknowledged: z.boolean().default(false),
      includeResolved: z.boolean().default(false),
      ocppIdentity: z.string().optional(),
      severity: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getOcppAlerts(input);
    }),

  /**
   * Obtener historial de alertas resueltas/reconocidas
   */
  getAlertHistory: ocppProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
      ocppIdentity: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getAlertHistory(input);
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
  // CONNECTION STABILITY MONITORING
  // ============================================================================

  /**
   * Obtener reporte de estabilidad de conexión de todas las estaciones
   * Incluye: uptime actual, reconexiones en 24h, duración promedio, score de estabilidad
   */
  getConnectionStability: ocppProcedure.query(async () => {
    const report = ocppManager.getConnectionStabilityReport();
    
    // Enriquecer con nombres de estaciones desde BD
    const enriched = await Promise.all(
      report.map(async (entry) => {
        let stationName = entry.ocppIdentity;
        let stationAddress = '';
        try {
          if (entry.stationId) {
            const station = await db.getChargingStationById(entry.stationId);
            if (station) {
              stationName = station.name;
              stationAddress = station.address || '';
            }
          } else {
            const station = await db.getChargingStationByOcppIdentity(entry.ocppIdentity);
            if (station) {
              stationName = station.name;
              stationAddress = station.address || '';
            }
          }
        } catch (e) {
          // Ignore
        }
        return {
          ...entry,
          stationName,
          stationAddress,
        };
      })
    );
    
    return enriched;
  }),

  /**
   * Obtener historial de sesiones de conexión de una estación específica
   */
  getConnectionHistory: ocppProcedure
    .input(z.object({
      ocppIdentity: z.string(),
    }))
    .query(async ({ input }) => {
      const history = ocppManager.getConnectionHistory(input.ocppIdentity);
      return history.map(session => ({
        ...session,
        connectedAt: session.connectedAt.toISOString(),
        disconnectedAt: session.disconnectedAt?.toISOString() || null,
      }));
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
