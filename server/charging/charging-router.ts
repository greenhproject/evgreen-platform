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
  getConnectionByStationId as legacyGetConnectionByStationId, 
  sendOcppCommand as legacySendOcppCommand,
  getAllConnections 
} from "../ocpp/connection-manager";
import { dualCSMS } from "../ocpp/csms-dual";
import { v4 as uuidv4 } from "uuid";
import * as simulator from "./charging-simulator";

// Helper: buscar conexión por stationId en dualCSMS primero, luego fallback a legacy
function getConnectionByStationId(stationId: number) {
  const dualConn = dualCSMS.getConnectionByStationId(stationId);
  if (dualConn) {
    return {
      ocppIdentity: dualConn.ocppIdentity,
      ws: dualConn.ws,
      connectorStatuses: new Map<number, string>(), // dualCSMS no trackea esto directamente
    };
  }
  return legacyGetConnectionByStationId(stationId);
}

// Helper: enviar comando OCPP por dualCSMS primero, luego fallback a legacy
function sendOcppCommand(ocppIdentity: string, messageId: string, action: string, payload: any): boolean {
  const sent = dualCSMS.sendCommandIfConnected(ocppIdentity, messageId, action, payload);
  if (sent) return true;
  return legacySendOcppCommand(ocppIdentity, messageId, action, payload);
}

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
      const isOcppConnected = !!ocppConnection && ocppConnection.ws.readyState === 1;
      
      // La estación está online si:
      // 1. Tiene conexión OCPP activa (WebSocket abierto), O
      // 2. Está marcada como online en la BD (puede estar en grace period de reconexión), O
      // 3. La estación está activa Y tiene al menos un conector disponible en la BD
      const hasAvailableConnector = connectors.some(c => c.status === 'AVAILABLE');
      const isOnline = isOcppConnected || station.isOnline || (station.isActive && hasAvailableConnector);
      
      // Obtener estados de conectores: usar BD directamente (dualCSMS actualiza la BD en StatusNotification)
      // No depender del mapa en memoria que puede estar vacío
      return {
        station,
        connectors: connectors.map(c => ({
          ...c,
          ocppStatus: c.status, // Usar estado de BD que es actualizado por OCPP StatusNotification
        })),
        isOnline,
        ocppIdentity: ocppConnection?.ocppIdentity || station.ocppIdentity,
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
      // dualCSMS actualiza la BD directamente en StatusNotification, así que c.status ya es el estado real
      return connectors.map(c => {
        let realTimeStatus = c.status;
        if (ocppConnection && ocppConnection.connectorStatuses.size > 0) {
          // Solo usar mapa en memoria si tiene datos (legacy connection-manager)
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
      let dynamicPrice: dynamicPricing.DynamicPrice;
      if (firstEvse) {
        dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, firstEvse.id);
      } else {
        // Sin EVSE, usar precio efectivo de la estación (global si no tiene tarifa propia)
        const effectivePrice = await db.getEffectiveStationPrice(stationId);
        dynamicPrice = { finalPrice: effectivePrice.pricePerKwh, factors: { finalMultiplier: 1 } } as dynamicPricing.DynamicPrice;
      }
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
      
      // Obtener tarifa de la estación para verificar si usa precio automático
      const tariff = await db.getActiveTariffByStationId(stationId);
      const useAutoPricing = tariff?.autoPricing || false;
      
      // Obtener el conector seleccionado para determinar tipo AC/DC
      const selectedConnector = evsesForPrice.find(c => c.connectorId === connectorId) || firstEvse;
      const evseId = selectedConnector?.id || firstEvse?.id;
      
      let pricePerKwh: number;
      if (useAutoPricing && evseId) {
        // Usar precio dinámico calculado por IA
        const dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, evseId);
        
        // Aplicar diferenciación AC/DC si está habilitada
        const priceByType = await db.getPriceByConnectorType(evseId, dynamicPrice.finalPrice);
        pricePerKwh = priceByType.price;
        console.log(`[Charging] Using dynamic pricing: $${pricePerKwh}/kWh (${priceByType.chargeType}, multiplier: ${dynamicPrice.factors.finalMultiplier.toFixed(2)})`);
      } else {
        // Usar precio fijo configurado por el inversionista
        // Pero aplicar diferenciación AC/DC si está habilitada
        // Usar precio efectivo (tarifa de estación o global)
        const effectivePriceData = await db.getEffectiveStationPrice(stationId);
        const basePrice = effectivePriceData.pricePerKwh;
        if (evseId) {
          const priceByType = await db.getPriceByConnectorType(evseId, basePrice);
          pricePerKwh = priceByType.price;
          console.log(`[Charging] Using fixed pricing with AC/DC differentiation: $${pricePerKwh}/kWh (${priceByType.chargeType})`);
        } else {
          pricePerKwh = basePrice;
          console.log(`[Charging] Using fixed pricing: $${pricePerKwh}/kWh`);
        }
      }
      
      // Usar el conector ya obtenido arriba (selectedConnector) para cálculos de potencia
      
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
        // Obtener datos de la estación y conectores de la BD
        const stationData = await db.getChargingStationById(stationId);
        const connectors = await db.getEvsesByStationId(stationId);
        
        // Buscar conexión OCPP: primero por stationId, luego por ocppIdentity
        const hasOcppConnection = !!ocppConnection && ocppConnection.ws.readyState === 1;
        let ocppIdentityForCommand = ocppConnection?.ocppIdentity || stationData?.ocppIdentity || '';
        
        // Si no hay conexión por stationId, intentar por ocppIdentity directamente
        let isConnectedByIdentity = false;
        if (!hasOcppConnection && ocppIdentityForCommand) {
          isConnectedByIdentity = dualCSMS.isStationConnected(ocppIdentityForCommand);
          if (isConnectedByIdentity) {
            console.log(`[startCharge] No connection by stationId but found by ocppIdentity: ${ocppIdentityForCommand}`);
          }
        }
        
        // Verificar disponibilidad usando la MISMA lógica que getStationByCode:
        // isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector)
        // Esto asegura que si la estación aparece como disponible en la app,
        // también permita iniciar la carga.
        const stationOnlineInDb = !!stationData?.isOnline;
        const stationIsActive = !!stationData?.isActive;
        const hasAvailableConnector = connectors.some((c: any) => {
          const s = (c.status || '').toUpperCase();
          return s === 'AVAILABLE' || s === 'PREPARING';
        });
        
        const isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector);
        
        console.log(`[startCharge] Station ${stationId} availability: hasOcppConnection=${hasOcppConnection}, isConnectedByIdentity=${isConnectedByIdentity}, stationOnlineInDb=${stationOnlineInDb}, stationIsActive=${stationIsActive}, hasAvailableConnector=${hasAvailableConnector}, isAvailable=${isAvailable}`);
        
        if (!isAvailable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La estación no está disponible en este momento. Intenta de nuevo.",
          });
        }
        
        // Verificar que el conector específico está disponible
        if (hasOcppConnection) {
          const connectorStatus = ocppConnection!.connectorStatuses.get(connectorId);
          if (connectorStatus && connectorStatus !== "Available" && connectorStatus !== "AVAILABLE" && connectorStatus !== "Preparing" && connectorStatus !== "PREPARING") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `El conector no está disponible. Estado actual: ${connectorStatus}`,
            });
          }
        } else {
          const connector = connectors.find((c: any) => c.connectorId === connectorId || c.evseIdLocal === connectorId);
          if (connector) {
            const dbStatus = (connector.status || '').toUpperCase();
            if (dbStatus && dbStatus !== 'AVAILABLE' && dbStatus !== 'PREPARING') {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `El conector no está disponible. Estado actual: ${dbStatus}`,
              });
            }
          }
        }
        
        // Determinar la identidad OCPP a usar para enviar el comando
        if (!ocppIdentityForCommand) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No se pudo determinar la identidad OCPP de la estación.",
          });
        }
        
        // Generar ID único para la sesión
        const sessionId = uuidv4();
        
        // Guardar sesión pendiente
        console.log(`[startCharge] Creating pending session: sessionId=${sessionId}, userId=${ctx.user.id}, stationId=${stationId}, connectorId=${connectorId}, ocppIdentity=${ocppIdentityForCommand}`);
        pendingChargeSessions.set(sessionId, {
          userId: ctx.user.id,
          stationId,
          connectorId,
          chargeMode,
          targetValue,
          estimatedCost,
          createdAt: new Date(),
          ocppIdentity: ocppIdentityForCommand,
        });
        
        // Enviar RemoteStartTransaction al cargador
        const messageId = uuidv4();
        const idTag = ctx.user.idTag || `USER-${ctx.user.id}`;
        
        const payload = {
          connectorId,
          idTag,
        };
        
        const sent = sendOcppCommand(
          ocppIdentityForCommand,
          messageId,
          "RemoteStartTransaction",
          payload
        );
        
        if (!sent) {
          // El comando no se pudo enviar por WebSocket.
          // Si la estación fue considerada disponible por tener conector AVAILABLE en BD
          // (pero sin conexión OCPP activa), el cargador puede estar conectado pero
          // el servidor aún no tiene la conexión WebSocket restablecida.
          if (hasOcppConnection || isConnectedByIdentity) {
            // Había conexión pero el envío falló - error temporal
            pendingChargeSessions.delete(sessionId);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Error temporal al comunicarse con el cargador. Espera unos segundos e intenta de nuevo.",
            });
          }
          
          // No hay conexión OCPP pero la estación tiene conector AVAILABLE en BD.
          // Mantenemos la sesión pendiente - informamos al usuario.
          console.log(`[startCharge] Command not sent via WebSocket but station has AVAILABLE connector. Session ${sessionId} created as pending.`);
        }
        
        // Auto-corregir isOnline en BD si la estación tiene conector disponible pero isOnline=0
        if (!stationOnlineInDb && hasAvailableConnector && stationData) {
          console.log(`[startCharge] Correcting isOnline for station ${stationId}: setting to true (has AVAILABLE connector)`);
          await db.updateChargingStation(stationId, { isOnline: true });
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
          message: sent ? "Conecta tu vehículo al cargador" : "Conecta tu vehículo y presenta tu tarjeta en el cargador para iniciar",
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
      // Verificar primero si hay una simulación activa (incluyendo completadas recientes)
      const simulationInfo = simulator.getActiveSimulationInfo(ctx.user.id);
      if (simulationInfo) {
        // Obtener transacción de la simulación usando el transactionId del simulador
        const transaction = await db.getTransactionById(simulationInfo.transactionId);
        const station = transaction 
          ? await db.getChargingStationById(transaction.stationId)
          : null;
        const evse = transaction
          ? await db.getEvseById(transaction.evseId)
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
        
        // Usar el transactionId del simulador que es el correcto
        const transactionId = simulationInfo.transactionId;
        
        console.log(`[getActiveSession] Simulation info: status=${simulationInfo.status}, transactionId=${transactionId}, progress=${simulationInfo.progress}%`);
        
        return {
          transactionId,
          stationId: transaction?.stationId || 0,
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
          progress: isCompleted ? 100 : simulationInfo.progress, // Asegurar 100% cuando está completado
          isSimulation: true,
          simulationStatus: simulationInfo.status,
          completedAt: simulationInfo.completedAt, // Agregar timestamp de completado
        };
      }
      
      // Buscar transacción activa del usuario
      const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
      
      console.log(`[getActiveSession] userId=${ctx.user.id}, activeTransaction=${activeTransaction ? `id=${activeTransaction.id}, status=${activeTransaction.status}` : 'null'}, pendingSessions=${pendingChargeSessions.size}, activeSessions=${activeChargeSessions.size}`);
      
      if (!activeTransaction) {
        // Verificar si hay una sesión pendiente (esperando que el cargador confirme StartTransaction)
        const entries = Array.from(pendingChargeSessions.entries());
        for (let i = 0; i < entries.length; i++) {
          const [sessionId, session] = entries[i];
          if (session.userId === ctx.user.id) {
            // Verificar que no haya expirado (máximo 2 minutos)
            const elapsed = Date.now() - session.createdAt.getTime();
            if (elapsed > 120000) {
              pendingChargeSessions.delete(sessionId);
              continue;
            }
            
            const station = await db.getChargingStationById(session.stationId);
            // Obtener tipo de conector real desde la BD
            const evses = await db.getEvsesByStationId(session.stationId);
            const evse = evses.find((e: any) => e.evseIdLocal === session.connectorId || e.connectorId === session.connectorId);
            // Obtener tarifa real de la estación
            const effectivePrice = await db.getEffectiveStationPrice(session.stationId);
            return {
              transactionId: 0,
              stationId: session.stationId,
              stationName: station?.name || "Estación",
              connectorId: session.connectorId,
              connectorType: evse?.connectorType || "GBT_AC",
              startTime: session.createdAt.toISOString(),
              elapsedMinutes: 0,
              estimatedMinutes: 0,
              currentKwh: 0,
              estimatedKwh: 0,
              currentCost: 0,
              pricePerKwh: effectivePrice.pricePerKwh,
              powerKw: evse?.powerKw ? parseFloat(String(evse.powerKw)) : 7,
              currentPower: 0,
              status: "CONNECTING",
              chargeMode: session.chargeMode,
              targetPercentage: session.chargeMode === "percentage" ? session.targetValue : 100,
              targetAmount: session.chargeMode === "fixed_amount" ? session.targetValue : 0,
              startPercentage: 20,
              progress: 0,
              isSimulation: false,
              simulationStatus: "connecting",
            };
          }
        }
        
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
              pricePerKwh: (await db.getEffectiveStationPrice(lastCompleted.stationId)).pricePerKwh,
              powerKw: 7,
              currentPower: 0,
              status: "COMPLETED",
              chargeMode: "full_charge" as const,
              targetPercentage: 100,
              targetAmount: 0,
              startPercentage: 20,
              progress: 100,
              isSimulation: false,
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
      
      // Obtener info de sesión activa en memoria (actualizada en tiempo real por MeterValues)
      const activeSessionInfo = getActiveSessionById(activeTransaction.id);
      
      // Priorizar datos en memoria (actualizados por MeterValues en tiempo real)
      // Si no hay sesión en memoria, usar datos de la BD como fallback
      let currentKwh: number;
      let currentCost: number;
      let pricePerKwh: number;
      
      if (activeSessionInfo && activeSessionInfo.currentKwh > 0) {
        // Datos actualizados en tiempo real desde MeterValues
        currentKwh = activeSessionInfo.currentKwh;
        currentCost = activeSessionInfo.currentCost;
        pricePerKwh = activeSessionInfo.pricePerKwh;
      } else {
        // Fallback: leer de la BD
        const lastMeterValue = await db.getLastMeterValue(activeTransaction.id);
        currentKwh = lastMeterValue?.energyKwh 
          ? parseFloat(lastMeterValue.energyKwh) - (activeTransaction.meterStart ? parseFloat(activeTransaction.meterStart) : 0)
          : 0;
        
        const tariffs = await db.getTariffsByStationId(activeTransaction.stationId);
        const tariff = tariffs[0];
        if (tariff?.pricePerKwh) {
          pricePerKwh = parseFloat(tariff.pricePerKwh);
        } else {
          // Sin tarifa de estación, usar precio global
          const effectivePriceData = await db.getEffectiveStationPrice(activeTransaction.stationId);
          pricePerKwh = effectivePriceData.pricePerKwh;
        }
        currentCost = currentKwh * pricePerKwh;
      }
      
      // Obtener el evse para el connectorId
      const evse = await db.getEvseById(activeTransaction.evseId);
      
      // Obtener información del conector para la potencia
      const connectorType = evse?.connectorType || "TYPE_2";
      const powerKw = evse?.powerKw ? parseFloat(evse.powerKw) : 22;
      
      // Obtener potencia actual desde el último MeterValue de potencia
      const lastPowerMeter = await db.getLastMeterValue(activeTransaction.id);
      let currentPower = 0;
      if (lastPowerMeter?.powerKw) {
        currentPower = parseFloat(lastPowerMeter.powerKw);
      } else if (elapsedMinutes > 0 && currentKwh > 0) {
        // Estimar potencia basada en energía y tiempo
        currentPower = currentKwh / (elapsedMinutes / 60);
      } else {
        currentPower = powerKw; // Usar potencia nominal del conector
      }
      
      // Estimar tiempo restante basado en la potencia actual
      const estimatedTotalKwh = activeTransaction.kwhConsumed 
        ? parseFloat(activeTransaction.kwhConsumed)
        : Math.max(currentKwh * 2, 30); // Estimación simple de al menos 30 kWh
      const remainingKwh = Math.max(0, estimatedTotalKwh - currentKwh);
      const estimatedMinutes = currentPower > 0 ? Math.ceil((remainingKwh / currentPower) * 60) : 30;
      
      // Obtener SoC si está disponible
      const chargeMode = activeSessionInfo?.chargeMode || "full_charge" as const;
      const targetValue = activeSessionInfo?.targetValue || 0;
      
      // Calcular progreso basado en el modo de carga
      let progress = 0;
      if (chargeMode === "fixed_amount" && targetValue > 0) {
        progress = Math.min(100, Math.round((currentCost / targetValue) * 100));
      } else if (chargeMode === "percentage" && targetValue > 0) {
        const batteryCapacity = 60; // kWh estimado
        const targetKwh = ((targetValue - 20) / 100) * batteryCapacity;
        progress = targetKwh > 0 ? Math.min(100, Math.round((currentKwh / targetKwh) * 100)) : 0;
      } else {
        // full_charge: estimar basado en kWh estimados
        progress = estimatedTotalKwh > 0 ? Math.min(100, Math.round((currentKwh / estimatedTotalKwh) * 100)) : 0;
      }
      
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
        chargeMode,
        targetPercentage: chargeMode === "percentage" ? targetValue : 100,
        targetAmount: chargeMode === "fixed_amount" ? targetValue : currentCost * 2,
        startPercentage: 20,
        progress,
        isSimulation: false,
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

/**
 * Buscar sesión pendiente por stationId y connectorId (para vincular con StartTransaction OCPP)
 */
export function findPendingSessionByStation(stationId: number, connectorId: number): { sessionId: string; session: ReturnType<typeof getPendingSession> } | null {
  const entries = Array.from(pendingChargeSessions.entries());
  for (let i = 0; i < entries.length; i++) {
    const [sessionId, session] = entries[i];
    if (session.stationId === stationId && session.connectorId === connectorId) {
      return { sessionId, session };
    }
  }
  return null;
}

/**
 * Buscar sesión pendiente por ocppIdentity y connectorId
 */
export function findPendingSessionByOcppIdentity(ocppIdentity: string, connectorId: number): { sessionId: string; session: ReturnType<typeof getPendingSession> } | null {
  const entries = Array.from(pendingChargeSessions.entries());
  console.log(`[findPendingSession] Searching for ocppIdentity="${ocppIdentity}", connectorId=${connectorId}. Total pending sessions: ${entries.length}`);
  for (let i = 0; i < entries.length; i++) {
    const [sessionId, session] = entries[i];
    console.log(`[findPendingSession] Checking session ${sessionId}: ocppIdentity="${session.ocppIdentity}", connectorId=${session.connectorId}, userId=${session.userId}`);
    if (session.ocppIdentity === ocppIdentity && session.connectorId === connectorId) {
      console.log(`[findPendingSession] MATCH FOUND! sessionId=${sessionId}, userId=${session.userId}`);
      return { sessionId, session };
    }
  }
  console.log(`[findPendingSession] NO MATCH found for ocppIdentity="${ocppIdentity}", connectorId=${connectorId}`);
  return null;
}
// Fix startCharge availability - deployed Tue Feb 17 19:37:22 EST 2026
