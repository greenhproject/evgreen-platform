/**
 * Charging Router - Endpoints para el flujo de carga de vehículos eléctricos
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import * as dynamicPricing from "../pricing/dynamic-pricing";
import { 
  getConnection, 
  getConnectionByStationId, 
  sendOcppCommand,
  getAllConnections 
} from "../ocpp/connection-manager";
import { v4 as uuidv4 } from "uuid";
import * as simulator from "./charging-simulator";

// Tipos de carga disponibles
export type ChargeMode = "fixed_amount" | "percentage" | "full_charge";

// Almacén temporal de sesiones de carga pendientes (esperando conexión del vehículo)
const pendingChargeSessions = new Map<string, {
  userId: number;
  stationId: number;
  connectorId: number;
  chargeMode: ChargeMode;
  targetValue: number; // $ para fixed_amount, % para percentage, 100 para full_charge
  estimatedCost: number;
  createdAt: Date;
  ocppIdentity: string;
}>();

// Almacén de sesiones de carga activas
const activeChargeSessions = new Map<number, {
  transactionId: number;
  userId: number;
  stationId: number;
  connectorId: number;
  chargeMode: ChargeMode;
  targetValue: number;
  startTime: Date;
  currentKwh: number;
  currentCost: number;
  pricePerKwh: number;
}>();

export const chargingRouter = router({
  /**
   * Obtener estación por código QR (ocppIdentity o ID)
   */
  getStationByCode: protectedProcedure
    .input(z.object({
      code: z.string(),
    }))
    .query(async ({ input }) => {
      const { code } = input;
      
      // Intentar buscar por ocppIdentity primero
      let station = await db.getStationByOcppIdentity(code);
      
      // Si no se encuentra, intentar por ID numérico
      if (!station && /^\d+$/.test(code)) {
        station = await db.getChargingStationById(parseInt(code)) || null;
      }
      
      if (!station) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estación no encontrada. Verifica el código QR.",
        });
      }
      
      // Obtener conectores de la estación
      const connectors = await db.getEvsesByStationId(station.id);
      
      // Verificar si la estación está conectada al servidor OCPP
      const ocppConnection = getConnectionByStationId(station.id);
      const isOnline = !!ocppConnection && ocppConnection.ws.readyState === 1;
      
      // Obtener estados de conectores desde OCPP si está conectado
      let connectorStatuses: Record<number, string> = {};
      if (ocppConnection) {
        connectorStatuses = Object.fromEntries(ocppConnection.connectorStatuses);
      }
      
      return {
        station,
        connectors: connectors.map(c => ({
          ...c,
          ocppStatus: connectorStatuses[c.connectorId] || c.status,
        })),
        isOnline,
        ocppIdentity: ocppConnection?.ocppIdentity,
      };
    }),

  /**
   * Obtener conectores disponibles de una estación
   */
  getAvailableConnectors: protectedProcedure
    .input(z.object({
      stationId: z.number(),
    }))
    .query(async ({ input }) => {
      const { stationId } = input;
      
      const connectors = await db.getEvsesByStationId(stationId);
      const ocppConnection = getConnectionByStationId(stationId);
      
      // Combinar estado de BD con estado OCPP en tiempo real
      return connectors.map(c => {
        let realTimeStatus = c.status;
        if (ocppConnection) {
          // Usar evseIdLocal para buscar el estado OCPP (el cargador reporta por connectorId que es evseIdLocal)
          const ocppStatus = ocppConnection.connectorStatuses.get(c.evseIdLocal);
          if (ocppStatus) {
            realTimeStatus = ocppStatus as typeof c.status;
          }
        }
        
        // Normalizar estado para comparación
        const normalizedStatus = realTimeStatus?.toUpperCase() || 'UNAVAILABLE';
        // Un conector está disponible si está en estado AVAILABLE o Available
        const isAvailable = normalizedStatus === "AVAILABLE" || normalizedStatus === "PREPARING";
        
        return {
          id: c.id,
          evseId: c.id, // ID de la BD
          connectorNumber: c.evseIdLocal, // Número visible del conector (1, 2, 3...)
          connectorId: c.evseIdLocal, // Para compatibilidad con el frontend
          type: c.connectorType,
          powerKw: c.powerKw,
          status: normalizedStatus,
          isAvailable,
        };
      });
    }),

  /**
   * Validar saldo del usuario y calcular estimación de carga
   */
  validateAndEstimate: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      connectorId: z.number(),
      chargeMode: z.enum(["fixed_amount", "percentage", "full_charge"]),
      targetValue: z.number(), // $ para fixed_amount, % para percentage
    }))
    .query(async ({ ctx, input }) => {
      const { stationId, connectorId, chargeMode, targetValue } = input;
      
      // Obtener saldo del usuario
      const wallet = await db.getWalletByUserId(ctx.user.id);
      const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;
      
      // Obtener tarifa de la estación
      const station = await db.getChargingStationById(stationId);
      if (!station) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estación no encontrada",
        });
      }
      
      // Calcular precio dinámico actual
      // Obtener primer EVSE para calcular precio dinámico
      const evsesForPrice = await db.getEvsesByStationId(stationId);
      const firstEvse = evsesForPrice[0];
      const dynamicPrice = firstEvse 
        ? await dynamicPricing.calculateDynamicPrice(stationId, firstEvse.id)
        : { finalPrice: 800, factors: { finalMultiplier: 1 } } as dynamicPricing.DynamicPrice;
      const pricePerKwh = dynamicPrice.finalPrice;
      
      // Calcular estimación según modo de carga
      let estimatedKwh = 0;
      let estimatedCost = 0;
      let estimatedTime = 0; // en minutos
      
      // Obtener potencia del conector
      const connectors = await db.getEvsesByStationId(stationId);
      const connector = connectors.find(c => c.connectorId === connectorId);
      const powerKw = connector?.powerKw ? parseFloat(connector.powerKw) : 22; // Default 22kW
      
      switch (chargeMode) {
        case "fixed_amount":
          // Usuario quiere gastar X pesos
          estimatedCost = targetValue;
          estimatedKwh = estimatedCost / pricePerKwh;
          estimatedTime = (estimatedKwh / powerKw) * 60;
          break;
          
        case "percentage":
          // Usuario quiere cargar hasta X% (asumiendo batería promedio de 60kWh)
          const batteryCapacity = 60; // kWh promedio
          const currentPercent = 20; // Asumimos 20% inicial (esto vendría del vehículo en un caso real)
          const targetPercent = targetValue;
          estimatedKwh = ((targetPercent - currentPercent) / 100) * batteryCapacity;
          estimatedCost = estimatedKwh * pricePerKwh;
          estimatedTime = (estimatedKwh / powerKw) * 60;
          break;
          
        case "full_charge":
          // Carga completa (asumiendo de 20% a 100%)
          const fullBatteryCapacity = 60;
          estimatedKwh = 0.8 * fullBatteryCapacity; // 80% de la batería
          estimatedCost = estimatedKwh * pricePerKwh;
          estimatedTime = (estimatedKwh / powerKw) * 60;
          break;
      }
      
      const hasSufficientBalance = balance >= estimatedCost;
      
      return {
        balance,
        pricePerKwh,
        estimatedKwh: Math.round(estimatedKwh * 100) / 100,
        estimatedCost: Math.round(estimatedCost),
        estimatedTime: Math.round(estimatedTime),
        hasSufficientBalance,
        shortfall: hasSufficientBalance ? 0 : Math.ceil(estimatedCost - balance),
        dynamicMultiplier: dynamicPrice.factors?.finalMultiplier || 1,
        demandLevel: dynamicPricing.getDemandLevel(dynamicPrice.factors?.finalMultiplier || 1),
      };
    }),

  /**
   * Iniciar sesión de carga (envía RemoteStartTransaction al cargador o usa simulador)
   */
  startCharge: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      connectorId: z.number(),
      chargeMode: z.enum(["fixed_amount", "percentage", "full_charge"]),
      targetValue: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { stationId, connectorId, chargeMode, targetValue } = input;
      
      // Validar saldo
      const wallet = await db.getWalletByUserId(ctx.user.id);
      const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;
      
      // Calcular costo estimado
      const evsesForPrice = await db.getEvsesByStationId(stationId);
      const firstEvse = evsesForPrice[0];
      const dynamicPrice = firstEvse 
        ? await dynamicPricing.calculateDynamicPrice(stationId, firstEvse.id)
        : { finalPrice: 800, factors: { finalMultiplier: 1 } } as dynamicPricing.DynamicPrice;
      const pricePerKwh = dynamicPrice.finalPrice;
      
      // Obtener potencia del conector para cálculos
      const connectors = await db.getEvsesByStationId(stationId);
      const connector = connectors.find(c => c.connectorId === connectorId);
      const evseId = connector?.id || firstEvse?.id;
      
      let estimatedCost = 0;
      switch (chargeMode) {
        case "fixed_amount":
          estimatedCost = targetValue;
          break;
        case "percentage":
          const batteryCapacity = 60;
          const estimatedKwh = ((targetValue - 20) / 100) * batteryCapacity;
          estimatedCost = estimatedKwh * pricePerKwh;
          break;
        case "full_charge":
          estimatedCost = 0.8 * 60 * pricePerKwh;
          break;
      }
      
      if (balance < estimatedCost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente. Necesitas $${Math.ceil(estimatedCost - balance)} más.`,
        });
      }
      
      // Verificar si es usuario de prueba para usar simulador
      const userEmail = ctx.user.email || "";
      const isTestUser = simulator.isTestUser(userEmail);
      
      // Verificar que la estación está conectada (solo si no es usuario de prueba)
      const ocppConnection = getConnectionByStationId(stationId);
      
      if (!isTestUser) {
        // Flujo normal: requiere cargador conectado
        if (!ocppConnection || ocppConnection.ws.readyState !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La estación no está disponible en este momento. Intenta de nuevo.",
          });
        }
        
        // Verificar que el conector está disponible
        const connectorStatus = ocppConnection.connectorStatuses.get(connectorId);
        if (connectorStatus && connectorStatus !== "Available" && connectorStatus !== "AVAILABLE" && connectorStatus !== "Preparing" && connectorStatus !== "PREPARING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El conector no está disponible. Estado actual: ${connectorStatus}`,
          });
        }
        
        // Generar ID único para la sesión
        const sessionId = uuidv4();
        
        // Guardar sesión pendiente
        pendingChargeSessions.set(sessionId, {
          userId: ctx.user.id,
          stationId,
          connectorId,
          chargeMode,
          targetValue,
          estimatedCost,
          createdAt: new Date(),
          ocppIdentity: ocppConnection.ocppIdentity,
        });
        
        // Enviar RemoteStartTransaction al cargador
        const messageId = uuidv4();
        const idTag = ctx.user.idTag || `USER-${ctx.user.id}`;
        
        const payload = {
          connectorId,
          idTag,
        };
        
        const sent = sendOcppCommand(
          ocppConnection.ocppIdentity,
          messageId,
          "RemoteStartTransaction",
          payload
        );
        
        if (!sent) {
          pendingChargeSessions.delete(sessionId);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No se pudo enviar el comando al cargador. Intenta de nuevo.",
          });
        }
        
        // Crear notificación de inicio
        await db.createNotification({
          userId: ctx.user.id,
          title: "Carga iniciada",
          message: `Conecta tu vehículo al conector ${connectorId}. Tarifa actual: $${pricePerKwh}/kWh`,
          type: "charging",
        });
        
        return {
          sessionId,
          status: "pending_connection",
          message: "Conecta tu vehículo al cargador",
          estimatedCost,
          pricePerKwh,
          connectorId,
          isSimulation: false,
        };
      }
      
      // Flujo de simulación para usuarios de prueba
      console.log(`[Charging] Usuario de prueba ${userEmail} - iniciando simulación`);
      
      if (!evseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se encontró el conector especificado.",
        });
      }
      
      try {
        const result = await simulator.startSimulation({
          userId: ctx.user.id,
          userEmail,
          stationId,
          evseId,
          connectorId,
          chargeMode,
          targetValue,
          pricePerKwh,
        });
        
        // Crear notificación de inicio (simulación)
        await db.createNotification({
          userId: ctx.user.id,
          title: "Carga simulada iniciada",
          message: `Simulación de carga en conector ${connectorId}. Tarifa: $${pricePerKwh}/kWh`,
          type: "charging",
        });
        
        return {
          sessionId: result.sessionId,
          transactionId: result.transactionId,
          status: "simulation_started",
          message: "Simulación de carga iniciada (usuario de prueba)",
          estimatedCost,
          pricePerKwh,
          connectorId,
          isSimulation: true,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Error al iniciar la simulación",
        });
      }
    }),

  /**
   * Obtener estado de la sesión de carga activa del usuario
   */
  getActiveSession: protectedProcedure
    .query(async ({ ctx }) => {
      // Verificar primero si hay una simulación activa
      const simulationInfo = simulator.getActiveSimulationInfo(ctx.user.id);
      if (simulationInfo) {
        // Obtener transacción de la simulación
        const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
        const station = activeTransaction 
          ? await db.getChargingStationById(activeTransaction.stationId)
          : null;
        const evse = activeTransaction
          ? await db.getEvseById(activeTransaction.evseId)
          : null;
        
        // Si la simulación está completada o terminando, marcar como completada
        const isCompleted = simulationInfo.status === "completed" || simulationInfo.status === "finishing";
        
        // Calcular targetPercentage y targetAmount basados en el modo de carga
        let targetPercentage = 100;
        let targetAmount = simulationInfo.targetKwh * simulationInfo.pricePerKwh;
        
        if (simulationInfo.chargeMode === "percentage") {
          targetPercentage = simulationInfo.targetValue;
        } else if (simulationInfo.chargeMode === "fixed_amount") {
          targetAmount = simulationInfo.targetValue;
        }
        
        return {
          transactionId: activeTransaction?.id || 0,
          stationId: activeTransaction?.stationId || 0,
          stationName: station?.name || "Estación de Prueba",
          connectorId: evse?.connectorId || 1,
          connectorType: evse?.connectorType || "TYPE_2",
          startTime: new Date(Date.now() - simulationInfo.elapsedSeconds * 1000).toISOString(),
          elapsedMinutes: Math.floor(simulationInfo.elapsedSeconds / 60),
          estimatedMinutes: Math.ceil((simulationInfo.targetKwh / simulationInfo.powerKw) * 60), // Usar potencia real
          currentKwh: simulationInfo.currentKwh,
          estimatedKwh: simulationInfo.targetKwh,
          currentCost: simulationInfo.currentCost,
          pricePerKwh: simulationInfo.pricePerKwh,
          powerKw: simulationInfo.powerKw, // Potencia real del cargador
          currentPower: simulationInfo.powerKw * (0.95 + Math.random() * 0.1), // Variación realista ±5%
          status: isCompleted ? "COMPLETED" : (simulationInfo.status === "charging" ? "IN_PROGRESS" : simulationInfo.status.toUpperCase()),
          chargeMode: simulationInfo.chargeMode,
          targetPercentage,
          targetAmount,
          startPercentage: 20,
          progress: simulationInfo.progress,
          isSimulation: true,
          simulationStatus: simulationInfo.status,
        };
      }
      
      // Buscar transacción activa del usuario
      const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
      
      if (!activeTransaction) {
        // Verificar si hay una transacción recién completada (para redirigir al resumen)
        const lastCompleted = await db.getLastCompletedTransactionByUserId(ctx.user.id);
        if (lastCompleted) {
          // Verificar si se completó en los últimos 30 segundos
          const completedAt = lastCompleted.endTime ? new Date(lastCompleted.endTime).getTime() : 0;
          const now = Date.now();
          if (now - completedAt < 30000) {
            // Transacción recién completada, devolver con estado COMPLETED
            const station = await db.getChargingStationById(lastCompleted.stationId);
            const evse = await db.getEvseById(lastCompleted.evseId);
            
            return {
              transactionId: lastCompleted.id,
              stationId: lastCompleted.stationId,
              stationName: station?.name || "Estación",
              connectorId: evse?.connectorId || 1,
              connectorType: evse?.connectorType || "TYPE_2",
              startTime: lastCompleted.startTime.toISOString(),
              elapsedMinutes: 0,
              estimatedMinutes: 0,
              currentKwh: lastCompleted.kwhConsumed ? parseFloat(lastCompleted.kwhConsumed) : 0,
              estimatedKwh: lastCompleted.kwhConsumed ? parseFloat(lastCompleted.kwhConsumed) : 0,
              currentCost: lastCompleted.totalCost ? parseFloat(lastCompleted.totalCost) : 0,
              pricePerKwh: 800,
              powerKw: 7,
              currentPower: 0,
              status: "COMPLETED",
              chargeMode: "full_charge" as const,
              targetPercentage: 100,
              targetAmount: 0,
              startPercentage: 20,
              progress: 100,
              isSimulation: true,
              simulationStatus: "completed",
            };
          }
        }
        return null;
      }
      
      // Obtener información de la estación
      const station = await db.getChargingStationById(activeTransaction.stationId);
      
      // Calcular tiempo transcurrido
      const startTime = new Date(activeTransaction.startTime);
      const elapsedMinutes = Math.floor((Date.now() - startTime.getTime()) / 60000);
      
      // Obtener último valor de medición
      const lastMeterValue = await db.getLastMeterValue(activeTransaction.id);
      const currentKwh = lastMeterValue?.energyKwh 
        ? parseFloat(lastMeterValue.energyKwh) - (activeTransaction.meterStart ? parseFloat(activeTransaction.meterStart) : 0)
        : 0;
      
      // Obtener tarifa de la estación para calcular costo
      const tariffs = await db.getTariffsByStationId(activeTransaction.stationId);
      const tariff = tariffs[0];
      const pricePerKwh = tariff?.pricePerKwh ? parseFloat(tariff.pricePerKwh) : 800;
      const currentCost = currentKwh * pricePerKwh;
      
      // Obtener el evse para el connectorId
      const evse = await db.getEvseById(activeTransaction.evseId);
      
      // Obtener información del conector para la potencia
      const connectorType = evse?.connectorType || "TYPE_2";
      const powerKw = evse?.powerKw ? parseFloat(evse.powerKw) : 22;
      
      // Calcular potencia actual basada en el tiempo y energía
      const currentPower = elapsedMinutes > 0 ? (currentKwh / (elapsedMinutes / 60)) : powerKw;
      
      // Estimar tiempo restante basado en la potencia actual
      // Usar kwhConsumed si está disponible, sino estimar
      const estimatedTotalKwh = activeTransaction.kwhConsumed 
        ? parseFloat(activeTransaction.kwhConsumed)
        : Math.max(currentKwh * 2, 30); // Estimación simple de al menos 30 kWh
      const remainingKwh = Math.max(0, estimatedTotalKwh - currentKwh);
      const estimatedMinutes = currentPower > 0 ? Math.ceil((remainingKwh / currentPower) * 60) : 30;
      
      return {
        transactionId: activeTransaction.id,
        stationId: activeTransaction.stationId,
        stationName: station?.name || "Estación",
        connectorId: evse?.connectorId || 1,
        connectorType,
        startTime: startTime.toISOString(),
        elapsedMinutes,
        estimatedMinutes: elapsedMinutes + estimatedMinutes,
        currentKwh: Math.round(currentKwh * 100) / 100,
        estimatedKwh: Math.round(estimatedTotalKwh * 100) / 100,
        currentCost: Math.round(currentCost),
        pricePerKwh,
        powerKw,
        currentPower: Math.round(currentPower * 10) / 10,
        status: activeTransaction.status,
        chargeMode: "full_charge" as const, // TODO: Obtener del registro de sesión
        targetPercentage: 100,
        targetAmount: currentCost * 2,
        startPercentage: 20,
      };
    }),

  /**
   * Detener sesión de carga manualmente
   */
  stopCharge: protectedProcedure
    .input(z.object({
      sessionId: z.string().optional(),
      transactionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar primero si hay una simulación activa
      if (simulator.hasActiveSimulation(ctx.user.id)) {
        const result = await simulator.stopSimulation(ctx.user.id);
        if (result) {
          return {
            status: "completed",
            message: "Simulación de carga detenida",
            kwhConsumed: result.kwhConsumed,
            totalCost: result.totalCost,
            isSimulation: true,
          };
        }
      }
      
      // Obtener transactionId desde sessionId o directamente
      let transactionId = input.transactionId;
      
      if (!transactionId && input.sessionId) {
        // Buscar transacción activa del usuario
        const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
        if (activeTransaction) {
          transactionId = activeTransaction.id;
        }
      }
      
      if (!transactionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Se requiere sessionId o transactionId",
        });
      }
      
      // Verificar que la transacción pertenece al usuario
      const transaction = await db.getTransactionById(transactionId);
      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transacción no encontrada",
        });
      }
      
      if (transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tienes permiso para detener esta carga",
        });
      }
      
      if (transaction.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta carga ya ha finalizado",
        });
      }
      
      // Obtener conexión OCPP
      const ocppConnection = getConnectionByStationId(transaction.stationId);
      if (!ocppConnection || ocppConnection.ws.readyState !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se puede comunicar con el cargador en este momento",
        });
      }
      
      // Enviar RemoteStopTransaction
      const messageId = uuidv4();
      const sent = sendOcppCommand(
        ocppConnection.ocppIdentity,
        messageId,
        "RemoteStopTransaction",
        { transactionId: transaction.ocppTransactionId || transactionId.toString() }
      );
      
      if (!sent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo enviar el comando de parada. Intenta de nuevo.",
        });
      }
      
      return {
        status: "stopping",
        message: "Deteniendo la carga...",
        isSimulation: false,
      };
    }),

  /**
   * Obtener historial de cargas del usuario
   */
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      offset: z.number().optional().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const transactions = await db.getUserTransactions(ctx.user.id, input.limit, input.offset);
      
      return transactions.map(t => ({
        id: t.id,
        stationName: t.stationName || "Estación",
        startTime: t.startTime,
        endTime: t.endTime,
        energyKwh: t.energyDelivered ? parseFloat(t.energyDelivered) / 1000 : 0,
        totalCost: t.totalCost ? parseFloat(t.totalCost) : 0,
        status: t.status,
        duration: t.endTime && t.startTime 
          ? Math.floor((new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000)
          : null,
      }));
    }),
});

// Exportar funciones para uso interno
export function getPendingSession(sessionId: string) {
  return pendingChargeSessions.get(sessionId);
}

export function removePendingSession(sessionId: string) {
  pendingChargeSessions.delete(sessionId);
}

export function setActiveSession(transactionId: number, session: typeof activeChargeSessions extends Map<number, infer V> ? V : never) {
  activeChargeSessions.set(transactionId, session);
}

export function getActiveSessionById(transactionId: number) {
  return activeChargeSessions.get(transactionId);
}

export function removeActiveSession(transactionId: number) {
  activeChargeSessions.delete(transactionId);
}
