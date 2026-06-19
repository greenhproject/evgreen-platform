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
import { sendUserPush } from "../push/unified-push";

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
  pricePerKwh: number; // Precio dinámico calculado al momento de iniciar la carga
  createdAt: Date;
  ocppIdentity: string;
}>();

// Tipo para un punto de datos en el historial de potencia
export type PowerHistoryPoint = {
  timestamp: number; // Unix ms
  power: number; // kW
  energy: number; // kWh acumulados
  soc: number | null; // % batería
};

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
  // Datos en tiempo real del cargador (MeterValues)
  soc: number | null; // State of Charge del vehículo (%)
  currentPower: number; // Potencia actual de carga (kW)
  voltage: number | null; // Voltaje (V)
  current: number | null; // Corriente (A)
  lastMeterUpdate: Date | null; // Timestamp del último MeterValues
  // Historial de potencia para gráfico en tiempo real
  powerHistory: PowerHistoryPoint[];
  // Control de notificación SoC objetivo
  socTargetNotified: boolean;
  // SoC manual ingresado por el usuario (cuando el cargador no lo reporta)
  manualSoc: number | null;
  manualBatteryCapacityKwh: number | null;
  // Detección de batería llena por caída de potencia
  lowPowerSince: Date | null; // Timestamp desde cuando la potencia está < umbral
  chargeCompleteDetected: boolean; // Si se detectó que la batería está llena
  chargeCompleteNotified: boolean; // Si ya se notificó al usuario
  autoStopSent: boolean; // Si ya se envió RemoteStopTransaction automático
  // SoC calculado por energía real del OCPP (independiente del manual)
  energyBasedSoc: number | null; // SoC calculado solo por kWh reales / capacidad batería
}>();

/**
 * Deferred RemoteStartTransaction: reintenta enviar el comando con backoff adaptativo.
 * 
 * Fase 1 (0-30s): Intenta cada 3 segundos (agresivo, para reconexiones rápidas)
 * Fase 2 (30-120s): Intenta cada 10 segundos (más espaciado)
 * 
 * También se usa cuando el comando se envió pero la conexión murió antes de
 * recibir la respuesta (el cargador pudo haber recibido el comando).
 */
const deferredRetryTimers = new Map<string, NodeJS.Timeout>();

function startDeferredRemoteStart(
  sessionId: string,
  ocppIdentity: string,
  connectorId: number,
  idTag: string,
  options?: { commandMaySentAlready?: boolean }
): void {
  let attempts = 0;
  const startTime = Date.now();
  const MAX_DURATION_MS = 120_000; // 2 minutos máximo
  const PHASE1_DURATION_MS = 30_000; // Primeros 30s: agresivo
  const PHASE1_INTERVAL = 3_000; // Cada 3s en fase 1
  const PHASE2_INTERVAL = 10_000; // Cada 10s en fase 2
  
  if (options?.commandMaySentAlready) {
    console.log(`[DeferredStart] Command may have been sent already to ${ocppIdentity}. Will check for StatusNotification before resending.`);
  }
  
  const scheduleNext = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_DURATION_MS) {
      console.log(`[DeferredStart] Max duration (${MAX_DURATION_MS / 1000}s) reached for session ${sessionId}. Giving up.`);
      deferredRetryTimers.delete(sessionId);
      return;
    }
    
    const interval = elapsed < PHASE1_DURATION_MS ? PHASE1_INTERVAL : PHASE2_INTERVAL;
    const phase = elapsed < PHASE1_DURATION_MS ? 1 : 2;
    
    const timer = setTimeout(async () => {
      attempts++;
      
      // Verificar si la sesión pendiente aún existe (puede haber sido promovida por StartTransaction)
      const session = pendingChargeSessions.get(sessionId);
      if (!session) {
        console.log(`[DeferredStart] Session ${sessionId} no longer pending (charger may have started). Stopping retry.`);
        deferredRetryTimers.delete(sessionId);
        return;
      }
      
      // Si el comando pudo haberse enviado, verificar si el EVSE ya está en CHARGING/PREPARING
      // (el cargador recibió el comando y empezó a cargar sin que el servidor lo supiera)
      if (options?.commandMaySentAlready) {
        try {
          const station = await db.getChargingStationByOcppIdentity(ocppIdentity);
          if (station) {
            const evses = await db.getEvsesByStationId(station.id);
            const targetEvse = evses.find((e: any) => e.evseIdLocal === connectorId);
            if (targetEvse && (targetEvse.status === "CHARGING" || targetEvse.status === "PREPARING" || targetEvse.status === "SUSPENDED_EV")) {
              console.log(`[DeferredStart] EVSE ${targetEvse.id} already in ${targetEvse.status} state. Charger received the command. Stopping retry.`);
              deferredRetryTimers.delete(sessionId);
              return;
            }
          }
        } catch (e) {
          // No crítico, continuar con el retry
        }
      }
      
      try {
        console.log(`[DeferredStart] Phase ${phase}, Attempt ${attempts}: Sending RemoteStartTransaction to ${ocppIdentity} for session ${sessionId}`);
        const response = await dualCSMS.requestStartTransaction(ocppIdentity, connectorId, idTag);
        console.log(`[DeferredStart] SUCCESS! RemoteStartTransaction sent to ${ocppIdentity}: ${JSON.stringify(response)}`);
        deferredRetryTimers.delete(sessionId);
        return; // Éxito, no programar más reintentos
      } catch (error: any) {
        console.log(`[DeferredStart] Phase ${phase}, Attempt ${attempts} failed for ${ocppIdentity}: ${error.message}`);
      }
      
      // Programar siguiente intento
      scheduleNext();
    }, interval);
    
    deferredRetryTimers.set(sessionId, timer);
  };
  
  // Iniciar el primer intento
  scheduleNext();
}

export const chargingRouter = router({
  /**
   * Obtener estación por código QR (ocppIdentity o ID)
   */
  getStationByCode: protectedProcedure
    .input(z.object({
      code: z.string(),
    }))
    .query(async ({ ctx, input }) => {
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
      
      // ========== MODO DEMO: Estaciones de demostración ==========
      const stationOcppId = station.ocppIdentity || code;
      const isDemo = simulator.isDemoStation(stationOcppId);
      let demoTopUp = { topUpAmount: 0, newBalance: 0 };
      
      if (isDemo && ctx.user) {
        // Recargar saldo demo automáticamente
        demoTopUp = await simulator.topUpDemoWallet(ctx.user.id);
        if (demoTopUp.topUpAmount > 0) {
          console.log(`[Demo] Recargado saldo demo $${demoTopUp.topUpAmount} para usuario ${ctx.user.id}`);
          await db.createNotification({
            userId: ctx.user.id,
            title: "\u26a1 Saldo de demostraci\u00f3n acreditado",
            message: `Se te han acreditado $${Math.round(demoTopUp.topUpAmount).toLocaleString()} COP de saldo de demostraci\u00f3n para que pruebes la experiencia de carga EVGreen. \u00a1Disfruta!`,
            type: "WALLET",
          });
        }
      }
      // ========== FIN MODO DEMO ==========
      
      // Obtener conectores de la estación
      const connectors = await db.getEvsesByStationId(station.id);
      
      // Verificar si la estación está conectada al servidor OCPP
      const ocppConnection = getConnectionByStationId(station.id);
      const isOcppConnected = !!ocppConnection && ocppConnection.ws.readyState === 1;
      
      // La estación está online si:
      // 1. Es estación demo (siempre online), O
      // 2. Tiene conexión OCPP activa (WebSocket abierto), O
      // 3. Está en grace period (reconectando — mostrar como online para no confundir)
      // NOTA: Ya NO se usa station.isOnline de BD como fallback porque puede estar
      // desactualizado si el servidor se reinició sin actualizar la BD.
      const inGracePeriod = getConnection(stationOcppId) === undefined && 
        (await import('../ocpp/connection-manager')).isInGracePeriod(stationOcppId);
      const isOnline = isDemo || isOcppConnected || inGracePeriod;
      
      // Para estaciones demo, forzar conectores como AVAILABLE PERO respetar RESERVED
      // Para estaciones offline, marcar todos como UNAVAILABLE excepto CHARGING/RESERVED
      const mappedConnectors = connectors.map(c => {
        let effectiveStatus = c.status;
        if (isDemo && c.status !== 'RESERVED') {
          effectiveStatus = 'AVAILABLE' as typeof c.status;
        } else if (!isDemo && !isOnline) {
          // Offline: preservar solo sesiones activas
          if (c.status !== 'CHARGING' && c.status !== 'RESERVED') {
            effectiveStatus = 'UNAVAILABLE' as typeof c.status;
          }
        }
        return {
          ...c,
          status: effectiveStatus,
          ocppStatus: isDemo ? 'AVAILABLE' : effectiveStatus,
        };
      });
      
      // Verificar si el usuario tiene una reserva activa en esta estación
      let userActiveReservation = null;
      if (ctx.user) {
        const userReservations = await db.getReservationsByUserId(ctx.user.id);
        userActiveReservation = userReservations.find(
          (r: any) => r.stationId === station.id && r.status === 'ACTIVE'
        ) || null;
      }
      
      return {
        station,
        connectors: mappedConnectors,
        isOnline,
        ocppIdentity: ocppConnection?.ocppIdentity || station.ocppIdentity,
        isDemo,
        demoTopUp: isDemo ? demoTopUp : undefined,
        userActiveReservation,
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
      
      // Verificar si es estación demo
      const station = await db.getChargingStationById(stationId);
      const isDemo = station?.ocppIdentity ? simulator.isDemoStation(station.ocppIdentity) : false;
      
      // Determinar si la estación está online usando connection-manager
      const stationOcppIdForAvail = station?.ocppIdentity || '';
      const isOcppConnectedForAvail = !!ocppConnection && ocppConnection.ws.readyState === 1;
      const { isInGracePeriod: checkGrace } = await import('../ocpp/connection-manager');
      const inGracePeriodForAvail = !isOcppConnectedForAvail && stationOcppIdForAvail 
        ? checkGrace(stationOcppIdForAvail) : false;
      const stationIsOnline = isDemo || isOcppConnectedForAvail || inGracePeriodForAvail;

      // Combinar estado de BD con estado OCPP en tiempo real
      return connectors.map(c => {
        let realTimeStatus = c.status;
        
        // Para estaciones demo, forzar AVAILABLE PERO respetar RESERVED
        if (isDemo && realTimeStatus !== 'RESERVED') {
          realTimeStatus = 'AVAILABLE' as typeof c.status;
        } else if (!isDemo && !stationIsOnline) {
          // Estación offline: marcar como UNAVAILABLE excepto CHARGING/RESERVED
          if (realTimeStatus !== 'CHARGING' && realTimeStatus !== 'RESERVED') {
            realTimeStatus = 'UNAVAILABLE' as typeof c.status;
          }
        } else if (!isDemo && ocppConnection && ocppConnection.connectorStatuses.size > 0) {
          const ocppStatus = ocppConnection.connectorStatuses.get(c.evseIdLocal);
          if (ocppStatus) {
            // No sobreescribir RESERVED con AVAILABLE del OCPP
            if (realTimeStatus === 'RESERVED' && ocppStatus.toUpperCase() === 'AVAILABLE') {
              // Mantener RESERVED
            } else {
              realTimeStatus = ocppStatus as typeof c.status;
            }
          }
        }
        
        const normalizedStatus = realTimeStatus?.toUpperCase() || 'UNAVAILABLE';
        const isAvailable = normalizedStatus === "AVAILABLE";
        const isOccupied = ["PREPARING", "CHARGING", "SUSPENDED_EV", "SUSPENDED_EVSE", "FINISHING"].includes(normalizedStatus);
        
        return {
          id: c.id,
          evseId: c.id,
          connectorNumber: c.evseIdLocal,
          connectorId: c.evseIdLocal,
          type: c.connectorType,
          powerKw: c.powerKw,
          status: normalizedStatus,
          isAvailable,
          isOccupied,
          activeReservationId: (c as any).activeReservationId || null,
          activeReservationUserId: (c as any).activeReservationUserId || null,
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
      
      // Calcular precio usando la MISMA lógica que startCharge para evitar discrepancias
      const evsesForPrice = await db.getEvsesByStationId(stationId);
      const firstEvse = evsesForPrice[0];
      
      // Obtener tarifa de la estación para verificar si usa precio automático
      const tariff = await db.getActiveTariffByStationId(stationId);
      const useAutoPricing = tariff?.autoPricing || false;
      
      // Obtener el conector seleccionado para determinar tipo AC/DC
      const selectedConnector = evsesForPrice.find(c => c.connectorId === connectorId) || firstEvse;
      const evseId = selectedConnector?.id || firstEvse?.id;
      
      // Obtener el precio efectivo de la estación (tarifa propia o global)
      const effectivePriceData = await db.getEffectiveStationPrice(stationId);
      const tariffSource = effectivePriceData.source; // 'station' o 'global'
      
      let pricePerKwh: number;
      let dynamicMultiplier = 1;
      
      if (useAutoPricing && evseId) {
        // Usar precio dinámico calculado por IA
        const dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, evseId);
        dynamicMultiplier = dynamicPrice.factors?.finalMultiplier || 1;
        
        // CORREGIDO: Pasar tariffSource para NO sobreescribir con precios globales AC/DC
        const priceByType = await db.getPriceByConnectorType(evseId, dynamicPrice.finalPrice, tariffSource);
        pricePerKwh = priceByType.price;
        console.log(`[validateAndEstimate] Using dynamic pricing: $${pricePerKwh}/kWh (${priceByType.chargeType}, source: ${tariffSource}, multiplier: ${dynamicMultiplier.toFixed(2)})`);
      } else {
        // Usar precio fijo configurado por el inversionista
        const basePrice = effectivePriceData.pricePerKwh;
        if (evseId) {
          // CORREGIDO: Pasar tariffSource para respetar tarifa de estación
          const priceByType = await db.getPriceByConnectorType(evseId, basePrice, tariffSource);
          pricePerKwh = priceByType.price;
          console.log(`[validateAndEstimate] Using fixed pricing: $${pricePerKwh}/kWh (${priceByType.chargeType}, source: ${tariffSource})`);
        } else {
          pricePerKwh = basePrice;
          console.log(`[validateAndEstimate] Using fixed pricing: $${pricePerKwh}/kWh (source: ${tariffSource})`);
        }
      }
      
      // ====== APLICAR DESCUENTO DE SUSCRIPCIÓN ======
      let subscriptionDiscount = 0;
      try {
        const userSub = await db.getUserSubscription(ctx.user.id);
        if (userSub?.isActive && userSub.discountPercentage) {
          const discountPct = parseFloat(userSub.discountPercentage);
          if (discountPct > 0) {
            subscriptionDiscount = discountPct;
            const originalPrice = pricePerKwh;
            pricePerKwh = Math.round(pricePerKwh * (1 - discountPct / 100));
            console.log(`[validateAndEstimate] Subscription discount: ${discountPct}% off. Price: $${originalPrice} -> $${pricePerKwh}/kWh`);
          }
        }
      } catch (subErr) {
        console.warn(`[validateAndEstimate] Error checking subscription:`, subErr);
      }
      
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
        dynamicMultiplier,
        demandLevel: dynamicPricing.getDemandLevel(dynamicMultiplier),
        subscriptionDiscount, // % de descuento aplicado por suscripción (0 si no tiene)
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
      
      // Obtener el precio efectivo de la estación (tarifa propia o global)
      const effectivePriceData = await db.getEffectiveStationPrice(stationId);
      const tariffSource = effectivePriceData.source; // 'station' o 'global'
      
      let pricePerKwh: number;
      if (useAutoPricing && evseId) {
        // Usar precio dinámico calculado por IA
        // calculateDynamicPrice ya usa getEffectiveStationPrice internamente
        const dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, evseId);
        
        // CORREGIDO: Pasar tariffSource para que NO sobreescriba el precio dinámico
        // con el precio global AC/DC cuando la estación tiene tarifa propia
        const priceByType = await db.getPriceByConnectorType(evseId, dynamicPrice.finalPrice, tariffSource);
        pricePerKwh = priceByType.price;
        console.log(`[Charging] Using dynamic pricing: $${pricePerKwh}/kWh (${priceByType.chargeType}, source: ${tariffSource}, multiplier: ${dynamicPrice.factors.finalMultiplier.toFixed(2)})`);
      } else {
        // Usar precio fijo configurado por el inversionista
        const basePrice = effectivePriceData.pricePerKwh;
        if (evseId) {
          // CORREGIDO: Pasar tariffSource para respetar tarifa de estación
          const priceByType = await db.getPriceByConnectorType(evseId, basePrice, tariffSource);
          pricePerKwh = priceByType.price;
          console.log(`[Charging] Using fixed pricing: $${pricePerKwh}/kWh (${priceByType.chargeType}, source: ${tariffSource})`);
        } else {
          pricePerKwh = basePrice;
          console.log(`[Charging] Using fixed pricing: $${pricePerKwh}/kWh (source: ${tariffSource})`);
        }
      }
      
      // ====== APLICAR DESCUENTO DE SUSCRIPCIÓN ======
      // Si el usuario tiene una suscripción activa, aplicar el descuento en kWh
      let subscriptionDiscount = 0;
      try {
        const userSub = await db.getUserSubscription(ctx.user.id);
        if (userSub?.isActive && userSub.discountPercentage) {
          const discountPct = parseFloat(userSub.discountPercentage);
          if (discountPct > 0) {
            subscriptionDiscount = discountPct;
            const originalPrice = pricePerKwh;
            pricePerKwh = Math.round(pricePerKwh * (1 - discountPct / 100));
            console.log(`[Charging] Subscription discount applied: ${discountPct}% off. Price: $${originalPrice} -> $${pricePerKwh}/kWh (Plan: ${userSub.tier})`);
          }
        }
      } catch (subErr) {
        console.warn(`[Charging] Error checking subscription discount:`, subErr);
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
      
      // Check-in automático: si el usuario tiene una reserva activa para este EVSE, marcarla como FULFILLED
      if (evseId) {
        const activeReservation = await db.getActiveReservation(evseId);
        if (activeReservation && activeReservation.userId === ctx.user.id) {
          console.log(`[startCharge] Check-in automático: reserva ${activeReservation.id} para EVSE ${evseId} marcada como FULFILLED`);
          await db.updateReservation(activeReservation.id, { status: "FULFILLED" });
          // Notificar al usuario del check-in exitoso
          await db.createNotification({
            userId: ctx.user.id,
            title: "\u2705 Check-in exitoso",
            message: `Tu reserva ha sido confirmada. Se canceló la penalización por no-show. \u00a1Disfruta tu carga!`,
            type: "RESERVATION_CHECKIN",
          });
        }
      }
      
      // Verificar si es usuario de prueba o estación demo para usar simulador
      const userEmail = ctx.user.email || "";
      const stationForDemo = await db.getChargingStationById(stationId);
      const stationOcppId = stationForDemo?.ocppIdentity || "";
      const isDemo = simulator.isDemoStation(stationOcppId);
      const isTestUser = simulator.isTestUser(userEmail);
      const useSimulation = isTestUser || isDemo;
      
      // Verificar que la estación está conectada (solo si no es simulación)
      const ocppConnection = getConnectionByStationId(stationId);
      
      // Para estaciones reales: también permitir iniciar carga si el conector está RESERVED por el usuario actual
      // (el check-in ya marcó la reserva como FULFILLED arriba)
      
      if (!useSimulation) {
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
        
        // Verificar disponibilidad usando connection-manager (fuente de verdad):
        // La estación está disponible SOLO si tiene conexión OCPP activa o está en grace period.
        // Ya NO se usa isOnline de BD como fallback para evitar que estaciones offline
        // aparezcan como disponibles cuando el servidor se reinicia.
        const stationOcppIdForStart = ocppIdentityForCommand || stationData?.ocppIdentity || '';
        const { isInGracePeriod: checkGraceForStart } = await import('../ocpp/connection-manager');
        const inGracePeriodForStart = stationOcppIdForStart 
          ? checkGraceForStart(stationOcppIdForStart) : false;
        
        const isAvailable = hasOcppConnection || isConnectedByIdentity || inGracePeriodForStart;
        
        console.log(`[startCharge] Station ${stationId} availability: hasOcppConnection=${hasOcppConnection}, isConnectedByIdentity=${isConnectedByIdentity}, inGracePeriod=${inGracePeriodForStart}, isAvailable=${isAvailable}`);
        
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
            // Permitir RESERVED si es la reserva del usuario actual (ya fue marcada FULFILLED arriba)
            if (dbStatus && dbStatus !== 'AVAILABLE' && dbStatus !== 'PREPARING' && dbStatus !== 'RESERVED') {
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
        
        // Guardar sesión pendiente (memoria + BD para multi-instancia)
        console.log(`[startCharge] Creating pending session: sessionId=${sessionId}, userId=${ctx.user.id}, stationId=${stationId}, connectorId=${connectorId}, ocppIdentity=${ocppIdentityForCommand}`);
        pendingChargeSessions.set(sessionId, {
          userId: ctx.user.id,
          stationId,
          connectorId,
          chargeMode,
          targetValue,
          estimatedCost,
          pricePerKwh,
          createdAt: new Date(),
          ocppIdentity: ocppIdentityForCommand,
        });
        // Persistir en BD para que otras instancias puedan encontrarla
        await db.savePendingChargeSession({
          sessionId,
          userId: ctx.user.id,
          stationId,
          connectorId,
          ocppIdentity: ocppIdentityForCommand,
          chargeMode,
          targetValue,
          estimatedCost,
          pricePerKwh,
        });
        
        // Enviar RemoteStartTransaction al cargador usando el método robusto
        // que espera respuesta y registra logs OCPP
        const idTag = ctx.user.idTag || `USER-${ctx.user.id}`;
        
        let sent = false;
        let remoteStartResponse: { status: string } | null = null;
        
        // LOG DIAGNÓSTICO: Estado de conexiones antes de enviar
        const dualConnStatus = dualCSMS.isStationConnected(ocppIdentityForCommand);
        const dualDiag = dualCSMS.getDetailedDiagnostics();
        const connMgrConn = ocppConnection;
        console.log(`[startCharge] ===== PRE-SEND DIAGNOSTICS =====`);
        console.log(`[startCharge] ocppIdentity: ${ocppIdentityForCommand}`);
        console.log(`[startCharge] dualCSMS.isStationConnected: ${dualConnStatus}`);
        console.log(`[startCharge] dualCSMS connections: ${dualDiag.map(c => `${c.ocppIdentity}(ws=${c.wsReadyStateLabel})`).join(', ') || 'NONE'}`);
        console.log(`[startCharge] connection-manager: ${connMgrConn ? `${connMgrConn.ocppIdentity}(ws=${connMgrConn.ws.readyState})` : 'NOT FOUND'}`);
        console.log(`[startCharge] pricePerKwh: ${pricePerKwh}, chargeMode: ${chargeMode}, targetValue: ${targetValue}`);
        console.log(`[startCharge] ================================`);
        
        // Intentar enviar con requestStartTransaction (async, espera respuesta, registra logs)
        // Retry hasta 3 veces con backoff de 2s entre intentos
        // Track si el comando pudo haberse enviado pero la conexión murió antes de la respuesta
        let commandMaySentAlready = false;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`[startCharge] Attempt ${attempt}/3: Sending RemoteStartTransaction to ${ocppIdentityForCommand}, connectorId=${connectorId}, idTag=${idTag}`);
            remoteStartResponse = await dualCSMS.requestStartTransaction(
              ocppIdentityForCommand,
              connectorId,
              idTag
            );
            sent = true;
            console.log(`[startCharge] RemoteStartTransaction response from ${ocppIdentityForCommand}: ${JSON.stringify(remoteStartResponse)}`);
            
            // Verificar si el cargador aceptó el comando
            if (remoteStartResponse?.status === "Rejected") {
              console.warn(`[startCharge] Charger ${ocppIdentityForCommand} REJECTED RemoteStartTransaction`);
              break;
            }
            break; // Éxito, salir del loop
          } catch (error: any) {
            console.error(`[startCharge] Attempt ${attempt}/3 failed for ${ocppIdentityForCommand}: ${error.message}`);
            
            // Detectar si la conexión murió después de enviar ("Connection closed" o "Timeout")
            // En este caso, el cargador PUDO haber recibido el comando
            if (attempt === 1 && (error.message?.includes("Connection closed") || error.message?.includes("Timeout"))) {
              commandMaySentAlready = true;
              console.warn(`[startCharge] Connection died after sending command on attempt 1. Charger may have received it.`);
            }
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
          }
        }
        
        // Si requestStartTransaction falló, intentar con sendCommandIfConnected como último recurso
        if (!sent) {
          console.log(`[startCharge] requestStartTransaction failed, trying sendCommandIfConnected as fallback`);
          const messageId = uuidv4();
          sent = sendOcppCommand(
            ocppIdentityForCommand,
            messageId,
            "RemoteStartTransaction",
            { connectorId, idTag }
          );
          if (sent) {
            console.log(`[startCharge] Fallback sendCommandIfConnected succeeded for ${ocppIdentityForCommand}`);
          }
        }
        
        if (!sent) {
          // El comando no se pudo enviar por ningún medio.
          // PERO si commandMaySentAlready=true, el cargador pudo haberlo recibido
          // en el primer intento antes de que la conexión muriera.
          // En ese caso, NO lanzar error: iniciar deferred retry que verifica el estado del EVSE.
          
          if (commandMaySentAlready) {
            console.log(`[startCharge] Command may have been sent before connection died. Starting deferred retry with EVSE status check.`);
            startDeferredRemoteStart(sessionId, ocppIdentityForCommand, connectorId, idTag, { commandMaySentAlready: true });
          } else if (hasOcppConnection || isConnectedByIdentity) {
            // Había conexión pero el envío falló completamente - iniciar deferred retry en vez de error
            console.log(`[startCharge] Connection existed but send failed. Starting deferred retry for session ${sessionId}`);
            startDeferredRemoteStart(sessionId, ocppIdentityForCommand, connectorId, idTag);
          } else {
            // No hay conexión OCPP pero la estación tiene conector AVAILABLE en BD.
            console.log(`[startCharge] No OCPP connection available. Starting deferred retry for session ${sessionId}`);
            startDeferredRemoteStart(sessionId, ocppIdentityForCommand, connectorId, idTag);
          }
        }
        
        // Si el cargador rechazó explícitamente, limpiar y notificar
        if (remoteStartResponse?.status === "Rejected") {
          pendingChargeSessions.delete(sessionId);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El cargador rechazó la solicitud de inicio. Verifica que el vehículo esté correctamente conectado e intenta de nuevo.",
          });
        }
        
        // Crear notificación de inicio con precio dinámico formateado
        const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
        const stationNameForNotif = stationData?.name || "Estación EVGreen";
        await db.createNotification({
          userId: ctx.user.id,
          title: "Carga solicitada",
          message: `Se ha enviado la orden de carga al conector ${connectorId} de ${stationNameForNotif}. Tarifa: $${formattedPrice} COP/kWh. Conecta tu vehículo si aún no lo has hecho.`,
          type: "CHARGE_REQUESTED",
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
      
      // Flujo de simulación para usuarios de prueba o estaciones demo
      const simReason = isDemo ? `estación demo ${stationOcppId}` : `usuario de prueba ${userEmail}`;
      console.log(`[Charging] Simulación activada por ${simReason}`);
      
      if (!evseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se encontró el conector especificado.",
        });
      }
      
      // Para estaciones demo, recargar saldo si es necesario
      if (isDemo) {
        await simulator.topUpDemoWallet(ctx.user.id);
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
          isDemoMode: isDemo,
        });
        
        // Crear notificación de inicio
        const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
        const stationNameNotif = stationForDemo?.name || "Estación EVGreen";
        await db.createNotification({
          userId: ctx.user.id,
          title: isDemo ? "\u26a1 Carga de demostraci\u00f3n iniciada" : "Carga simulada iniciada",
          message: isDemo 
            ? `Experiencia de carga en ${stationNameNotif}, conector ${connectorId}. Tarifa: $${formattedPrice} COP/kWh. \u00a1Disfruta la experiencia EVGreen!`
            : `Simulaci\u00f3n de carga en conector ${connectorId}. Tarifa: $${formattedPrice} COP/kWh`,
          type: "charging",
        });
        
        return {
          sessionId: result.sessionId,
          transactionId: result.transactionId,
          status: "simulation_started",
          message: isDemo 
            ? "\u00a1Experiencia de carga EVGreen iniciada! Conecta tu veh\u00edculo" 
            : "Simulaci\u00f3n de carga iniciada (usuario de prueba)",
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
      
      // IMPORTANTE: Si hay transacción activa en BD, SIEMPRE priorizarla sobre sesiones pendientes
      // Esto evita race conditions donde la sesión pendiente aún no se eliminó pero StartTransaction ya se procesó
      if (activeTransaction) {
        // Limpiar cualquier sesión pendiente residual del mismo usuario
        const entries = Array.from(pendingChargeSessions.entries());
        for (const [sessionId, session] of entries) {
          if (session.userId === ctx.user.id) {
            pendingChargeSessions.delete(sessionId);
            console.log(`[getActiveSession] Cleaned up residual pending session ${sessionId} - transaction ${activeTransaction.id} already active`);
          }
        }
      }
      
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
            // CORREGIDO: Usar el precio dinámico de la sesión pendiente (calculado en startCharge)
            // En vez del precio base fijo de la estación
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
              pricePerKwh: session.pricePerKwh,
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
              pricePerKwh: lastCompleted.appliedPricePerKwh 
                ? parseFloat(String(lastCompleted.appliedPricePerKwh)) 
                : (await db.getEffectiveStationPrice(lastCompleted.stationId)).pricePerKwh,
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
      
      // Obtener el evse para el connectorId
      const evse = await db.getEvseById(activeTransaction.evseId);
      
      // Obtener información del conector para la potencia nominal
      const connectorType = evse?.connectorType || "TYPE_2";
      const nominalPowerKw = evse?.powerKw ? parseFloat(evse.powerKw) : 22;
      
      // Obtener tarifa para calcular costos
      const effectivePriceData = await db.getEffectiveStationPrice(activeTransaction.stationId);
      // Prioridad: 1) precio dinámico guardado en la transacción, 2) precio base de la estación
      let pricePerKwh = activeTransaction.appliedPricePerKwh 
        ? parseFloat(String(activeTransaction.appliedPricePerKwh)) 
        : effectivePriceData.pricePerKwh;
      const connectionFee = effectivePriceData.connectionFee || 0;
      
      // Priorizar datos en memoria (actualizados por MeterValues en tiempo real)
      // Si no hay sesión en memoria, usar datos de la BD como fallback
      let currentKwh: number;
      let currentCost: number;
      let soc: number | null = null;
      let currentPower: number = 0;
      let voltage: number | null = null;
      let currentAmp: number | null = null;
      
      if (activeSessionInfo) {
        // Datos actualizados en tiempo real desde MeterValues
        currentKwh = activeSessionInfo.currentKwh;
        currentCost = activeSessionInfo.currentCost;
        pricePerKwh = activeSessionInfo.pricePerKwh || pricePerKwh;
        soc = activeSessionInfo.soc;
        currentPower = activeSessionInfo.currentPower || 0;
        voltage = activeSessionInfo.voltage;
        currentAmp = activeSessionInfo.current;
      } else {
        // Fallback: leer de la BD (tabla meter_values)
        const lastMeterValue = await db.getLastMeterValue(activeTransaction.id);
        if (lastMeterValue) {
          const meterStart = activeTransaction.meterStart ? parseFloat(activeTransaction.meterStart) : 0;
          currentKwh = lastMeterValue.energyKwh 
            ? Math.max(0, parseFloat(lastMeterValue.energyKwh) - meterStart / 1000)
            : 0;
          soc = lastMeterValue.soc;
          currentPower = lastMeterValue.powerKw ? parseFloat(lastMeterValue.powerKw) : 0;
          voltage = lastMeterValue.voltage ? parseFloat(lastMeterValue.voltage) : null;
          currentAmp = lastMeterValue.current ? parseFloat(lastMeterValue.current) : null;
        } else {
          // Sin datos de MeterValues aún - usar datos de la transacción
          currentKwh = activeTransaction.kwhConsumed ? parseFloat(activeTransaction.kwhConsumed) : 0;
        }
        
        // Calcular costo: energía + tiempo + tarifa de conexión
        const durationMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
        const tariff = activeTransaction.tariffId ? await db.getTariffById(activeTransaction.tariffId) : null;
        // Solo usar tarifa base si no hay precio dinámico guardado en la transacción
        if (!activeTransaction.appliedPricePerKwh && tariff?.pricePerKwh) pricePerKwh = parseFloat(tariff.pricePerKwh);
        const pricePerMinute = tariff ? parseFloat(tariff.pricePerMinute || "0") : 0;
        const sessionFee = tariff ? parseFloat(tariff.pricePerSession || "0") : connectionFee;
        
        const energyCost = currentKwh * pricePerKwh;
        const timeCost = durationMinutes * pricePerMinute;
        currentCost = energyCost + timeCost + sessionFee;
      }
      
      // Si no hay potencia real del cargador, estimar basada en energía y tiempo
      if (currentPower <= 0 && elapsedMinutes > 0 && currentKwh > 0) {
        currentPower = currentKwh / (elapsedMinutes / 60);
      }
      
      // ============================================================
      // SoC MANUAL: Si el cargador no reporta SoC, usar el valor manual del usuario
      // Prioridad: 1) memoria, 2) DB (transacción), 3) vehículo del usuario
      // ============================================================
      let manualSoc = activeSessionInfo?.manualSoc ?? null;
      let manualBatteryCapacity = activeSessionInfo?.manualBatteryCapacityKwh ?? null;
      
      // Si no hay manualSoc en memoria, intentar restaurar desde la DB (transacción activa)
      if (manualSoc === null && activeTransaction.manualSoc !== null && activeTransaction.manualSoc !== undefined) {
        manualSoc = activeTransaction.manualSoc;
        // Restaurar también en la sesión en memoria para no volver a consultar la BD
        if (activeSessionInfo) {
          activeSessionInfo.manualSoc = manualSoc;
        }
        console.log(`[getActiveSession] Restored manualSoc=${manualSoc}% from DB for transaction ${activeTransaction.id}`);
      }
      
      if (manualBatteryCapacity === null && activeTransaction.manualBatteryCapacityKwh !== null && activeTransaction.manualBatteryCapacityKwh !== undefined) {
        manualBatteryCapacity = parseFloat(String(activeTransaction.manualBatteryCapacityKwh));
        if (activeSessionInfo) {
          activeSessionInfo.manualBatteryCapacityKwh = manualBatteryCapacity;
        }
        console.log(`[getActiveSession] Restored manualBatteryCapacity=${manualBatteryCapacity}kWh from DB for transaction ${activeTransaction.id}`);
      }
      
      // Si no hay capacidad de batería en la sesión ni en DB, intentar cargar del vehículo del usuario
      if (manualBatteryCapacity === null) {
        try {
          const defaultVehicle = await db.getDefaultVehicle(ctx.user.id);
          if (defaultVehicle?.batteryCapacityKwh) {
            manualBatteryCapacity = parseFloat(defaultVehicle.batteryCapacityKwh);
            // Guardar en la sesión activa para no volver a consultar la BD
            if (activeSessionInfo) {
              activeSessionInfo.manualBatteryCapacityKwh = manualBatteryCapacity;
            }
          }
        } catch (e) {
          // Ignorar errores al cargar vehículo
        }
      }
      
      // Fallback: 60 kWh si no hay datos del vehículo
      if (manualBatteryCapacity === null) manualBatteryCapacity = 60;
      
      const hasManualSoc = manualSoc !== null;
      
      // Calcular SoC estimado basado en manualSoc + kWh consumidos
      let estimatedSoc: number | null = null;
      if (soc !== null) {
        // SoC real del cargador - prioridad máxima
        estimatedSoc = soc;
      } else if (hasManualSoc) {
        // SoC manual del usuario + kWh consumidos para estimar SoC actual
        const kwhToSocPercent = (currentKwh / manualBatteryCapacity) * 100;
        estimatedSoc = Math.min(100, Math.round(manualSoc! + kwhToSocPercent));
      }
      
      // Estimar tiempo restante basado en la potencia actual
      // Restaurar chargeMode y targetValue: priorizar memoria, luego BD
      const chargeMode = activeSessionInfo?.chargeMode 
        || (activeTransaction.chargeMode as "fixed_amount" | "percentage" | "full_charge") 
        || "full_charge" as const;
      const targetValue = activeSessionInfo?.targetValue 
        ?? (activeTransaction.targetValue ? parseFloat(String(activeTransaction.targetValue)) : 0);
      
      // Calcular kWh estimados según modo de carga
      const batteryCapacity = manualBatteryCapacity;
      const startSocValue = estimatedSoc !== null ? manualSoc ?? estimatedSoc : 20;
      let estimatedTotalKwh = 0;
      if (chargeMode === "fixed_amount" && targetValue > 0) {
        estimatedTotalKwh = targetValue / pricePerKwh;
      } else if (chargeMode === "percentage" && targetValue > 0) {
        estimatedTotalKwh = ((targetValue - startSocValue) / 100) * batteryCapacity;
      } else {
        // full_charge: estimar según batería
        estimatedTotalKwh = ((100 - startSocValue) / 100) * batteryCapacity;
      }
      estimatedTotalKwh = Math.max(estimatedTotalKwh, currentKwh * 1.1); // Al menos 10% más que lo actual
      
      const remainingKwh = Math.max(0, estimatedTotalKwh - currentKwh);
      const estimatedMinutes = currentPower > 0 ? Math.ceil((remainingKwh / currentPower) * 60) : 30;
      
      // Calcular progreso basado en el modo de carga
      let progress = 0;
      if (chargeMode === "fixed_amount" && targetValue > 0) {
        progress = Math.min(100, Math.round((currentCost / targetValue) * 100));
      } else if (chargeMode === "percentage" && targetValue > 0 && estimatedSoc !== null) {
        progress = Math.min(100, Math.round((estimatedSoc / targetValue) * 100));
      } else if (chargeMode === "percentage" && targetValue > 0) {
        const targetKwh = ((targetValue - 20) / 100) * batteryCapacity;
        progress = targetKwh > 0 ? Math.min(100, Math.round((currentKwh / targetKwh) * 100)) : 0;
      } else {
        // full_charge: usar SoC estimado si está disponible
        if (estimatedSoc !== null) {
          progress = Math.round(estimatedSoc);
        } else {
          progress = estimatedTotalKwh > 0 ? Math.min(100, Math.round((currentKwh / estimatedTotalKwh) * 100)) : 0;
        }
      }
      
      // ============================================================
      // SoC INTELIGENTE: Prioridad de fuentes de datos
      // 1) SoC real del cargador (OCPP MeterValues con SoC)
      // 2) Batería llena detectada por caída de potencia
      // 3) SoC estimado por energía real + SoC manual
      // 4) SoC manual puro (sin corrección)
      // ============================================================
      const chargeCompleteDetected = activeSessionInfo?.chargeCompleteDetected || false;
      const energyBasedSoc = activeSessionInfo?.energyBasedSoc ?? null;
      
      let displaySoc: number | null;
      let socSource: string;
      
      if (soc !== null) {
        // Prioridad 1: SoC real del cargador
        displaySoc = soc;
        socSource = "charger";
      } else if (chargeCompleteDetected) {
        // Prioridad 2: Batería llena detectada por caída de potencia
        displaySoc = 100;
        socSource = "power_detection";
      } else if (energyBasedSoc !== null) {
        // Prioridad 3: SoC calculado por energía real del OCPP
        displaySoc = energyBasedSoc;
        socSource = hasManualSoc ? "manual" : "energy";
      } else if (estimatedSoc !== null) {
        // Prioridad 4: Estimación previa
        displaySoc = estimatedSoc;
        socSource = hasManualSoc ? "manual" : "none";
      } else {
        displaySoc = null;
        socSource = "none";
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
        connectionFee,
        powerKw: nominalPowerKw,
        currentPower: Math.round(currentPower * 10) / 10,
        status: activeTransaction.status,
        chargeMode,
        targetPercentage: chargeMode === "percentage" ? targetValue : 100,
        targetAmount: chargeMode === "fixed_amount" ? targetValue : currentCost * 2,
        startPercentage: hasManualSoc ? manualSoc : (soc !== null ? null : 20),
        soc: displaySoc, // SoC del vehículo (real o estimado desde manual)
        socSource, // "charger" | "manual" | "none"
        manualSoc: manualSoc, // SoC original ingresado por el usuario
        manualBatteryCapacityKwh: manualBatteryCapacity,
        voltage: voltage,
        currentAmp: currentAmp,
        progress,
        isSimulation: false,
        hasRealMeterData: activeSessionInfo?.lastMeterUpdate !== null && activeSessionInfo?.lastMeterUpdate !== undefined,
        powerHistory: (activeSessionInfo?.powerHistory || []).slice(-120),
        // Nuevos campos para detección de batería llena
        chargeCompleteDetected, // true si se detectó batería llena por caída de potencia
        energyBasedSoc, // SoC calculado por energía real del OCPP
        lowPowerMinutes: activeSessionInfo?.lowPowerSince 
          ? Math.round((Date.now() - activeSessionInfo.lowPowerSince.getTime()) / 60000) 
          : null, // Minutos en baja potencia (null si no aplica)
      };
    }),

  /**
   * Obtener historial completo de potencia de la sesión activa
   */
  getPowerHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
      if (!activeTransaction) return { history: [] };
      
      const session = getActiveSessionById(activeTransaction.id);
      return {
        history: session?.powerHistory || [],
      };
    }),

  /**
   * Establecer SoC manual del usuario (cuando el cargador no lo reporta)
   */
  setManualSoc: protectedProcedure
    .input(z.object({
      soc: z.number().min(0).max(100),
      batteryCapacityKwh: z.number().min(10).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
      if (!activeTransaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No hay una sesión de carga activa",
        });
      }
      
      let session = getActiveSessionById(activeTransaction.id);
      if (!session) {
        // Si no hay sesión en memoria, crear una básica con el SoC manual
        // Esto ocurre cuando el cargador inició la transacción por OCPP sin pasar por startCharge del frontend
        console.log(`[setManualSoc] No active session in memory for transaction ${activeTransaction.id}, creating one now`);
        // Priorizar precio dinámico guardado en la transacción, luego precio base
        const effectivePrice = await db.getEffectiveStationPrice(activeTransaction.stationId);
        const pricePerKwh = activeTransaction.appliedPricePerKwh 
          ? parseFloat(String(activeTransaction.appliedPricePerKwh)) 
          : (effectivePrice?.pricePerKwh || 1800);
        const startTime = new Date(activeTransaction.startTime);
        const currentKwh = activeTransaction.kwhConsumed ? parseFloat(activeTransaction.kwhConsumed) : 0;
        const currentCost = activeTransaction.totalCost ? parseFloat(activeTransaction.totalCost) : 0;
        
        // Restaurar chargeMode y targetValue desde la BD (NO hardcodear full_charge)
        const restoredChargeMode = (activeTransaction.chargeMode as "fixed_amount" | "percentage" | "full_charge") || "full_charge";
        const restoredTargetValue = activeTransaction.targetValue ? parseFloat(String(activeTransaction.targetValue)) : (restoredChargeMode === "full_charge" ? 100 : 0);
        console.log(`[setManualSoc] Restoring session from DB: chargeMode=${restoredChargeMode}, targetValue=${restoredTargetValue}`);
        
        setActiveSession(activeTransaction.id, {
          transactionId: activeTransaction.id,
          userId: ctx.user.id,
          stationId: activeTransaction.stationId,
          connectorId: activeTransaction.evseId,
          chargeMode: restoredChargeMode,
          targetValue: restoredTargetValue,
          startTime,
          currentKwh,
          currentCost,
          pricePerKwh,
          soc: null,
          currentPower: 0,
          voltage: null,
          current: null,
          lastMeterUpdate: null,
          powerHistory: [],
          socTargetNotified: false,
          manualSoc: input.soc,
          manualBatteryCapacityKwh: input.batteryCapacityKwh || 60,
          lowPowerSince: null,
          chargeCompleteDetected: false,
          chargeCompleteNotified: false,
          autoStopSent: false,
          energyBasedSoc: null,
        });
        session = getActiveSessionById(activeTransaction.id);
      } else {
        session.manualSoc = input.soc;
        if (input.batteryCapacityKwh) {
          session.manualBatteryCapacityKwh = input.batteryCapacityKwh;
        }
      }
      
      // Persistir en la base de datos para que sobreviva recargas de la app
      try {
        await db.updateTransaction(activeTransaction.id, {
          manualSoc: input.soc,
          manualBatteryCapacityKwh: (input.batteryCapacityKwh || 60).toFixed(2),
        });
        console.log(`[setManualSoc] Persisted to DB: transaction ${activeTransaction.id}, SoC=${input.soc}%, capacity=${input.batteryCapacityKwh || 60}kWh`);
      } catch (e) {
        console.error(`[setManualSoc] Error persisting to DB:`, e);
      }
      
      console.log(`[setManualSoc] User ${ctx.user.id} set manual SoC=${input.soc}%, batteryCapacity=${input.batteryCapacityKwh || 'default'}kWh for transaction ${activeTransaction.id}`);
      
      return { success: true, soc: input.soc };
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
        const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
        if (activeTransaction) {
          transactionId = activeTransaction.id;
        }
      }
      
      if (!transactionId) {
        const activeTransaction = await db.getActiveTransactionByUserId(ctx.user.id);
        if (activeTransaction) {
          transactionId = activeTransaction.id;
        }
      }
      
      if (!transactionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No se encontró una carga activa para detener",
        });
      }
      
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
      
      // Obtener ocppIdentity de la estación
      const station = await db.getChargingStationById(transaction.stationId);
      const ocppIdentity = station?.ocppIdentity || '';
      
      // === DIAGNÓSTICO DETALLADO ===
      const allConns = getAllConnections();
      console.log(`[stopCharge] ===== STOP CHARGE REQUEST =====`);
      console.log(`[stopCharge] userId=${ctx.user.id}, txId=${transactionId}, stationId=${transaction.stationId}, ocppIdentity="${ocppIdentity}"`);
      console.log(`[stopCharge] ocppTransactionId=${transaction.ocppTransactionId}`);
      console.log(`[stopCharge] Total active connections in connection-manager: ${allConns.length}`);
      allConns.forEach((c, i) => {
        console.log(`[stopCharge]   Connection[${i}]: identity="${c.ocppIdentity}", stationId=${c.stationId}, connected=${c.isConnected}, version=${c.ocppVersion}`);
      });
      
      // === BÚSQUEDA EXHAUSTIVA DE CONEXIÓN ===
      let ocppIdentityForCommand = '';
      let connectionWs: any = null;
      
      // Estrategia 1: Buscar por stationId en connection-manager
      const connByStation = legacyGetConnectionByStationId(transaction.stationId);
      if (connByStation && connByStation.ws.readyState === 1) {
        ocppIdentityForCommand = connByStation.ocppIdentity;
        connectionWs = connByStation.ws;
        console.log(`[stopCharge] ✓ Found connection via stationId: "${ocppIdentityForCommand}", readyState=${connByStation.ws.readyState}`);
      } else {
        console.log(`[stopCharge] ✗ No connection found via stationId=${transaction.stationId} (result=${connByStation ? `identity="${connByStation.ocppIdentity}", readyState=${connByStation.ws.readyState}` : 'null'})`);
      }
      
      // Estrategia 2: Buscar por ocppIdentity directamente
      if (!ocppIdentityForCommand && ocppIdentity) {
        const connByIdentity = getConnection(ocppIdentity);
        if (connByIdentity && connByIdentity.ws.readyState === 1) {
          ocppIdentityForCommand = ocppIdentity;
          connectionWs = connByIdentity.ws;
          console.log(`[stopCharge] ✓ Found connection via ocppIdentity: "${ocppIdentityForCommand}", readyState=${connByIdentity.ws.readyState}`);
        } else {
          console.log(`[stopCharge] ✗ No connection found via ocppIdentity="${ocppIdentity}" (result=${connByIdentity ? `readyState=${connByIdentity.ws.readyState}` : 'null'})`);
        }
      }
      
      // Estrategia 3: Buscar por variantes del ocppIdentity (case-insensitive, con/sin prefijo)
      if (!ocppIdentityForCommand && ocppIdentity) {
        for (const conn of allConns) {
          const identityLower = conn.ocppIdentity.toLowerCase();
          const searchLower = ocppIdentity.toLowerCase();
          if (identityLower === searchLower || 
              identityLower.includes(searchLower) || 
              searchLower.includes(identityLower)) {
            if (conn.isConnected) {
              const fullConn = getConnection(conn.ocppIdentity);
              if (fullConn && fullConn.ws.readyState === 1) {
                ocppIdentityForCommand = conn.ocppIdentity;
                connectionWs = fullConn.ws;
                console.log(`[stopCharge] ✓ Found connection via fuzzy match: "${ocppIdentityForCommand}" (searched for "${ocppIdentity}")`);
                break;
              }
            }
          }
        }
        if (!ocppIdentityForCommand) {
          console.log(`[stopCharge] ✗ No connection found via fuzzy match for "${ocppIdentity}"`);
        }
      }
      
      // Estrategia 4: dualCSMS como último recurso
      if (!ocppIdentityForCommand && ocppIdentity) {
        if (dualCSMS.isStationConnected(ocppIdentity)) {
          ocppIdentityForCommand = ocppIdentity;
          console.log(`[stopCharge] ✓ Found connection via dualCSMS: "${ocppIdentityForCommand}"`);
        } else {
          console.log(`[stopCharge] ✗ No connection found via dualCSMS for "${ocppIdentity}"`);
        }
      }
      
      // === ENVIAR RemoteStopTransaction ===
      let remoteStopSent = false;
      if (ocppIdentityForCommand) {
        const messageId = uuidv4();
        // OCPP 1.6 requiere transactionId numérico
        // Prioridad: 1) ocppNumericTxId (guardado al crear tx), 2) transactionId de la BD
        const ocppTxId = (transaction as any).ocppNumericTxId 
          || transactionId;
        
        if (!(transaction as any).ocppNumericTxId) {
          console.warn(`[stopCharge] ⚠️ ocppNumericTxId is NULL in DB for txId=${transactionId}. Using DB id=${transactionId} as fallback. This may not match the cargador's transactionId.`);
        }
        
        console.log(`[stopCharge] Sending RemoteStopTransaction to "${ocppIdentityForCommand}", ocppTxId=${ocppTxId}, messageId=${messageId}`);
        
        // Intentar enviar por connection-manager
        remoteStopSent = legacySendOcppCommand(
          ocppIdentityForCommand,
          messageId,
          "RemoteStopTransaction",
          { transactionId: ocppTxId }
        );
        
        if (!remoteStopSent) {
          console.log(`[stopCharge] legacySendOcppCommand failed, trying dualCSMS...`);
          remoteStopSent = dualCSMS.sendCommandIfConnected(
            ocppIdentityForCommand,
            messageId,
            "RemoteStopTransaction",
            { transactionId: ocppTxId }
          );
        }
        
        // Si aún no se envió y tenemos el ws directo, intentar enviar directamente
        if (!remoteStopSent && connectionWs && connectionWs.readyState === 1) {
          try {
            const directMessage = JSON.stringify([2, messageId, "RemoteStopTransaction", { transactionId: ocppTxId }]);
            connectionWs.send(directMessage);
            remoteStopSent = true;
            console.log(`[stopCharge] ✓ RemoteStopTransaction sent DIRECTLY via ws.send()`);
          } catch (directErr) {
            console.error(`[stopCharge] ✗ Direct ws.send() failed:`, directErr);
          }
        }
        
        if (remoteStopSent) {
          console.log(`[stopCharge] ✓✓ RemoteStopTransaction sent successfully to "${ocppIdentityForCommand}"`);
          
          // Registrar log OCPP
          try {
            await db.createOcppLog({
              ocppIdentity: ocppIdentityForCommand,
              stationId: transaction.stationId,
              direction: "OUT",
              messageType: "RemoteStopTransaction",
              payload: { transactionId: ocppTxId },
            });
          } catch (logErr) {
            console.error(`[stopCharge] Error logging OCPP:`, logErr);
          }
        } else {
          console.warn(`[stopCharge] ✗✗ ALL methods failed to send RemoteStopTransaction to "${ocppIdentityForCommand}"`);
        }
      } else {
        console.warn(`[stopCharge] ✗✗ NO OCPP CONNECTION FOUND AT ALL for station ${transaction.stationId} (ocppIdentity="${ocppIdentity}")`);
        console.warn(`[stopCharge] Available connections: ${allConns.map(c => `"${c.ocppIdentity}"(sid=${c.stationId},connected=${c.isConnected})`).join(', ') || 'NONE'}`);
      }
      
      // === COMPLETAR TRANSACCIÓN ===
      if (!remoteStopSent) {
        console.log(`[stopCharge] Completing transaction locally (no OCPP connection). txId=${transactionId}`);
        await completeTransactionLocally(transactionId, transaction);
        
        return {
          status: "completed",
          message: "Carga detenida (sin conexión al cargador). El cargador puede seguir activo - desconecte el cable manualmente.",
          isSimulation: false,
          transactionId: transactionId,
          warning: "remote_stop_failed",
        };
      }
      
      // Si se envió RemoteStopTransaction, programar timeout de seguridad (45s)
      setTimeout(async () => {
        try {
          const txCheck = await db.getTransactionById(transactionId!);
          if (txCheck && txCheck.status === "IN_PROGRESS") {
            console.warn(`[stopCharge] Timeout: StopTransaction not received after 45s for txId=${transactionId}. Completing locally.`);
            await completeTransactionLocally(transactionId!, txCheck);
          }
        } catch (err) {
          console.error(`[stopCharge] Timeout handler error:`, err);
        }
      }, 45000);
      
      return {
        status: "stopping",
        message: "Deteniendo la carga...",
        isSimulation: false,
        transactionId: transactionId,
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

  /**
   * Obtener historial de precisión de SoC del usuario
   */
  getSocAccuracyHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      const logs = await db.getSocAccuracyByUser(ctx.user.id, input.limit);
      return logs.map(l => ({
        id: l.id,
        transactionId: l.transactionId,
        vehicleId: l.vehicleId,
        manualSocStart: l.manualSocStart,
        manualBatteryCapacityKwh: l.manualBatteryCapacityKwh,
        realKwhDelivered: l.realKwhDelivered,
        calculatedSocEnd: l.calculatedSocEnd,
        chargerSocEnd: l.chargerSocEnd,
        batteryFullDetected: l.batteryFullDetected,
        detectionMethod: l.detectionMethod,
        estimatedErrorKwh: l.estimatedErrorKwh,
        estimatedErrorSocPct: l.estimatedErrorSocPct,
        createdAt: l.createdAt,
      }));
    }),

  /**
   * Obtener sugerencia de capacidad de batería basada en historial de precisión
   */
  getSocAccuracySuggestion: protectedProcedure
    .query(async ({ ctx }) => {
      const suggestion = await db.getSocAccuracySuggestion(ctx.user.id);
      if (!suggestion) return { hasSuggestion: false, message: null, suggestedCapacityKwh: null, avgErrorKwh: null, sampleCount: 0 };

      const { suggestedCapacityKwh, avgErrorKwh, sampleCount } = suggestion;
      const hasSuggestion = suggestedCapacityKwh !== null && Math.abs(avgErrorKwh ?? 0) > 2;

      let message: string | null = null;
      if (hasSuggestion && suggestedCapacityKwh !== null && avgErrorKwh !== null) {
        const direction = avgErrorKwh > 0 ? "sobreestimando" : "subestimando";
        const absError = Math.abs(avgErrorKwh);
        message = `Basado en tus últimas ${sampleCount} cargas, pareces estar ${direction} la capacidad de tu batería en ~${absError} kWh. Te sugerimos usar ${suggestedCapacityKwh} kWh como capacidad para mayor precisión.`;
      } else if (sampleCount >= 2) {
        message = `Tus estimaciones de SoC son precisas. Basado en ${sampleCount} cargas recientes.`;
      } else {
        message = `Necesitamos al menos 2 cargas con SoC manual para generar sugerencias.`;
      }

      return { hasSuggestion, message, suggestedCapacityKwh, avgErrorKwh, sampleCount };
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
 * Actualizar datos de MeterValues en la sesión activa en memoria
 * Llamado desde el handler OCPP real en _core/index.ts
 */
export function updateActiveSessionMeterData(transactionId: number, data: {
  currentKwh?: number;
  currentCost?: number;
  soc?: number | null;
  currentPower?: number;
  voltage?: number | null;
  current?: number | null;
}) {
  const session = activeChargeSessions.get(transactionId);
  if (!session) return false;
  
  if (data.currentKwh !== undefined) session.currentKwh = data.currentKwh;
  if (data.currentCost !== undefined) session.currentCost = data.currentCost;
  if (data.soc !== undefined) session.soc = data.soc;
  if (data.currentPower !== undefined) session.currentPower = data.currentPower;
  if (data.voltage !== undefined) session.voltage = data.voltage;
  if (data.current !== undefined) session.current = data.current;
  session.lastMeterUpdate = new Date();
  
  // ============================================================
  // AUTO-STOP POR VALOR FIJO ALCANZADO (fixed_amount)
  // Si el costo actual >= targetValue, detener la carga automáticamente
  // ============================================================
  if (session.chargeMode === "fixed_amount" && session.targetValue > 0 && !session.autoStopSent) {
    if (session.currentCost >= session.targetValue) {
      session.autoStopSent = true;
      console.log(`[AutoStop] Transaction ${transactionId}: FIXED_AMOUNT TARGET REACHED - cost $${session.currentCost.toFixed(0)} >= target $${session.targetValue}. Sending RemoteStopTransaction.`);
      
      // Enviar RemoteStopTransaction al cargador
      db.getTransactionById(transactionId).then(async (txRecord) => {
        if (!txRecord) {
          console.warn(`[AutoStop] Transaction ${transactionId}: skipped - not found in DB`);
          return;
        }
        const stationRecord = await db.getChargingStationById(session.stationId);
        const ocppIdentityStr = stationRecord?.ocppIdentity || null;
        const ocppTxId = txRecord.ocppNumericTxId || transactionId;
        
        if (ocppIdentityStr) {
          const messageId = uuidv4();
          const sent = sendOcppCommand(ocppIdentityStr, messageId, "RemoteStopTransaction", { transactionId: ocppTxId });
          if (sent) {
            console.log(`[AutoStop] Transaction ${transactionId}: RemoteStopTransaction sent (ocppTxId=${ocppTxId}) to "${ocppIdentityStr}"`);
          } else {
            console.warn(`[AutoStop] Transaction ${transactionId}: Failed to send RemoteStopTransaction to "${ocppIdentityStr}"`);
          }
        } else {
          console.warn(`[AutoStop] Transaction ${transactionId}: No OCPP identity for station ${session.stationId}`);
        }
        
        // Notificar al usuario que la carga se detuvo por alcanzar el monto
        if (session.userId) {
          const kwhDelivered = session.currentKwh.toFixed(2);
          sendUserPush(session.userId, {
            type: "charging_complete" as any,
            title: "✅ Carga completada - Monto alcanzado",
            body: `Tu carga se detuvo al alcanzar $${session.targetValue.toLocaleString()} COP. ${kwhDelivered} kWh entregados.`,
            clickAction: "/charging-monitor",
            data: {
              transactionId: transactionId.toString(),
              kwhDelivered,
              totalCost: Math.round(session.currentCost).toString(),
              detectionMethod: "fixed_amount_reached",
            },
          }).catch(err => console.error(`[AutoStop] Push notification error:`, err));
          
          db.createNotification({
            userId: session.userId,
            title: "✅ Carga completada",
            message: `Tu carga se detuvo automáticamente al alcanzar el monto de $${session.targetValue.toLocaleString()} COP. ${kwhDelivered} kWh entregados. Desconecta para evitar tarifa de ocupación.`,
            type: "CHARGING",
          }).catch(err => console.error(`[AutoStop] Notification error:`, err));
        }
      }).catch(err => console.error(`[AutoStop] Error:`, err));
    }
  }
  
  // ============================================================
  // CÁLCULO DE SoC BASADO EN ENERGÍA REAL DEL OCPP
  // Independiente del SoC manual - usa kWh reales / capacidad batería
  // ============================================================
  if (session.manualSoc !== null && session.manualBatteryCapacityKwh && session.manualBatteryCapacityKwh > 0) {
    const kwhToSocPercent = (session.currentKwh / session.manualBatteryCapacityKwh) * 100;
    session.energyBasedSoc = Math.min(100, Math.round(session.manualSoc + kwhToSocPercent));
  }
  
  // ============================================================
  // DETECCIÓN DE BATERÍA LLENA POR CAÍDA DE POTENCIA
  // En cargadores AC, la fase "taper" (CV) reduce la corriente gradualmente.
  // Un carro puede estar a 0.3-0.5 kW durante 15-30 min entre 85-100% SoC.
  // UMBRAL CONSERVADOR: Solo declarar batería llena si la potencia es casi cero
  // (< 0.15 kW = ~0.6A en 220V) durante al menos 10 minutos.
  // Esto evita falsos positivos durante la fase taper normal.
  // ============================================================
  const LOW_POWER_THRESHOLD_KW = 0.15; // kW - umbral MUY bajo (casi cero corriente)
  const LOW_POWER_DURATION_MS = 10 * 60 * 1000; // 10 minutos (antes era 5)
  const currentPowerVal = data.currentPower !== undefined ? data.currentPower : session.currentPower;
  
  if (currentPowerVal < LOW_POWER_THRESHOLD_KW && session.currentKwh > 0.5) {
    // La potencia está por debajo del umbral y ya se ha entregado algo de energía
    if (!session.lowPowerSince) {
      session.lowPowerSince = new Date();
      console.log(`[SoC] Transaction ${transactionId}: Low power detected (${currentPowerVal.toFixed(2)} kW < ${LOW_POWER_THRESHOLD_KW} kW). Monitoring...`);
    } else {
      const lowPowerDuration = Date.now() - session.lowPowerSince.getTime();
      if (lowPowerDuration >= LOW_POWER_DURATION_MS && !session.chargeCompleteDetected) {
        session.chargeCompleteDetected = true;
        // Forzar SoC a 100% ya que la batería está llena
        session.energyBasedSoc = 100;
        console.log(`[SoC] Transaction ${transactionId}: BATTERY FULL DETECTED - Low power for ${Math.round(lowPowerDuration/1000/60)} min. Setting SoC to 100%.`);
        
        // === NOTIFICACIÓN PUSH: Batería llena ===
        if (!session.chargeCompleteNotified) {
          session.chargeCompleteNotified = true;
          const kwhDelivered = session.currentKwh.toFixed(2);
          const cost = Math.round(session.currentCost).toLocaleString();
          // Enviar notificación push al usuario (Web Push + FCM)
          sendUserPush(session.userId, {
            type: "charging_complete",
            title: "⚡ ¡Batería llena!",
            body: `Tu vehículo ha completado la carga. ${kwhDelivered} kWh entregados por $${cost} COP. Desconecta para evitar tarifa de ocupación.`,
            clickAction: "/charging-monitor",
            data: {
              transactionId: transactionId.toString(),
              kwhDelivered,
              totalCost: cost,
              detectionMethod: "power_drop",
            },
          }).catch(err => console.error(`[SoC] Push notification error:`, err));
          // También crear notificación in-app
          db.createNotification({
            userId: session.userId,
            title: "⚡ ¡Batería llena!",
            message: `Tu vehículo ha completado la carga. ${kwhDelivered} kWh entregados. Desconecta para evitar la tarifa de ocupación ($500/min).`,
            type: "CHARGING",
          }).catch(err => console.error(`[SoC] Error creating in-app notification:`, err));
          console.log(`[SoC] Transaction ${transactionId}: Battery full notification sent to user ${session.userId}`);
        }
        
        // === AUTO-STOP: Enviar RemoteStopTransaction al cargador ===
        if (!session.autoStopSent) {
          session.autoStopSent = true;
          // Buscar la transacción en BD para obtener ocppIdentity y ocppNumericTxId
          db.getTransactionById(transactionId).then(async (txRecord) => {
            if (!txRecord) {
              console.warn(`[SoC] Transaction ${transactionId}: AUTO-STOP skipped - transaction not found in DB`);
              return;
            }
            // Obtener la estación para el ocppIdentity
            const stationRecord = await db.getChargingStationById(session.stationId);
            const ocppIdentityStr = stationRecord?.ocppIdentity || null;
            const ocppTxId = txRecord.ocppNumericTxId || transactionId;
            
            if (ocppIdentityStr) {
              const messageId = uuidv4();
              const sent = sendOcppCommand(ocppIdentityStr, messageId, "RemoteStopTransaction", { transactionId: ocppTxId });
              if (sent) {
                console.log(`[SoC] Transaction ${transactionId}: AUTO-STOP sent via RemoteStopTransaction (ocppTxId=${ocppTxId}) to "${ocppIdentityStr}"`);
              } else {
                // Intentar también por dualCSMS
                const sent2 = dualCSMS.sendCommandIfConnected(ocppIdentityStr, messageId, "RemoteStopTransaction", { transactionId: ocppTxId });
                if (sent2) {
                  console.log(`[SoC] Transaction ${transactionId}: AUTO-STOP sent via dualCSMS (ocppTxId=${ocppTxId}) to "${ocppIdentityStr}"`);
                } else {
                  console.warn(`[SoC] Transaction ${transactionId}: AUTO-STOP failed - could not send RemoteStopTransaction to "${ocppIdentityStr}"`);
                }
              }
            } else {
              console.warn(`[SoC] Transaction ${transactionId}: AUTO-STOP skipped - no OCPP identity available for station ${session.stationId}`);
            }
          }).catch(err => console.error(`[SoC] AUTO-STOP error:`, err));
        }
      }
    }
  } else if (currentPowerVal >= LOW_POWER_THRESHOLD_KW) {
    // La potencia volvió a subir - resetear el timer
    if (session.lowPowerSince) {
      console.log(`[SoC] Transaction ${transactionId}: Power recovered (${currentPowerVal.toFixed(2)} kW). Resetting low power timer.`);
      session.lowPowerSince = null;
    }
  }
  
  // Agregar punto al historial de potencia (máx 360 puntos = ~30 min a 5s interval)
  const power = data.currentPower !== undefined ? data.currentPower : session.currentPower;
  const energy = data.currentKwh !== undefined ? data.currentKwh : session.currentKwh;
  const soc = data.soc !== undefined ? data.soc : session.soc;
  
  if (!session.powerHistory) session.powerHistory = [];
  
  session.powerHistory.push({
    timestamp: Date.now(),
    power: power,
    energy: energy,
    soc: soc,
  });
  
  // Limitar a 360 puntos (mantener los más recientes)
  if (session.powerHistory.length > 360) {
    session.powerHistory = session.powerHistory.slice(-360);
  }
  
  return true;
}

/**
 * Obtener historial de potencia de una sesión activa
 */
export function getActiveSessionPowerHistory(transactionId: number): PowerHistoryPoint[] {
  const session = activeChargeSessions.get(transactionId);
  if (!session) return [];
  return session.powerHistory || [];
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
export function findPendingSessionByOcppIdentity(ocppIdentity: string, connectorId?: number): { sessionId: string; session: ReturnType<typeof getPendingSession> } | null {
  const entries = Array.from(pendingChargeSessions.entries());
  console.log(`[findPendingSession] Searching for ocppIdentity="${ocppIdentity}", connectorId=${connectorId ?? 'ANY'}. Total pending sessions: ${entries.length}`);
  for (let i = 0; i < entries.length; i++) {
    const [sessionId, session] = entries[i];
    console.log(`[findPendingSession] Checking session ${sessionId}: ocppIdentity="${session.ocppIdentity}", connectorId=${session.connectorId}, userId=${session.userId}`);
    // Si connectorId es undefined, buscar cualquier sesión para esta estación
    if (session.ocppIdentity === ocppIdentity && (connectorId === undefined || session.connectorId === connectorId)) {
      console.log(`[findPendingSession] MATCH FOUND in memory! sessionId=${sessionId}, userId=${session.userId}`);
      return { sessionId, session };
    }
  }
  console.log(`[findPendingSession] NO MATCH in memory for ocppIdentity="${ocppIdentity}", connectorId=${connectorId ?? 'ANY'}. Will check DB...`);
  return null; // El caller debe hacer fallback a DB con findPendingSessionFromDb
}

/**
 * Fallback: buscar sesión pendiente en BD cuando no se encuentra en memoria local.
 * Esto resuelve el problema de múltiples instancias donde la sesión se creó en otra instancia.
 */
export async function findPendingSessionFromDb(ocppIdentity: string, connectorId?: number): Promise<{ sessionId: string; session: any } | null> {
  const dbSession = await db.findPendingChargeSessionByOcppIdentity(ocppIdentity, connectorId);
  if (!dbSession) {
    console.log(`[findPendingSession] NO MATCH in DB either for ocppIdentity="${ocppIdentity}", connectorId=${connectorId ?? 'ANY'}`);
    return null;
  }
  console.log(`[findPendingSession] MATCH FOUND in DB! sessionId=${dbSession.sessionId}, userId=${dbSession.userId}, chargeMode=${dbSession.chargeMode}`);
  // Marcar como consumida en BD
  await db.consumePendingChargeSession(dbSession.sessionId);
  // Convertir al formato esperado
  return {
    sessionId: dbSession.sessionId,
    session: {
      userId: dbSession.userId,
      stationId: dbSession.stationId,
      connectorId: dbSession.connectorId,
      chargeMode: dbSession.chargeMode as ChargeMode,
      targetValue: Number(dbSession.targetValue),
      estimatedCost: Number(dbSession.estimatedCost),
      pricePerKwh: Number(dbSession.pricePerKwh),
      createdAt: dbSession.createdAt,
      ocppIdentity: dbSession.ocppIdentity,
    },
  };
}
/**
 * Completar una transacción localmente cuando no hay conexión OCPP
 * o cuando el cargador no responde con StopTransaction a tiempo.
 * Calcula costos basados en datos disponibles y descuenta del saldo del usuario.
 */
async function completeTransactionLocally(transactionId: number, transaction: any) {
  try {
    const endTime = new Date();
    const startTime = new Date(transaction.startTime);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    
    // Obtener datos de la sesión activa en memoria (si existe)
    const activeSession = activeChargeSessions.get(transactionId);
    
    // Calcular energía entregada
    let energyDelivered = 0;
    if (activeSession?.currentKwh && activeSession.currentKwh > 0) {
      energyDelivered = activeSession.currentKwh;
    } else if (transaction.meterEnd && transaction.meterStart) {
      energyDelivered = (parseFloat(transaction.meterEnd) - parseFloat(transaction.meterStart)) / 1000;
    } else if (transaction.kwhConsumed) {
      energyDelivered = parseFloat(transaction.kwhConsumed);
    }
    
    // Obtener tarifa
    const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
    const pricePerKwh = tariff ? parseFloat(tariff.pricePerKwh) : 1800;
    const pricePerMinute = tariff ? parseFloat(tariff.pricePerMinute || "0") : 0;
    const sessionFee = tariff ? parseFloat(tariff.pricePerSession || "0") : 0;
    
    // Calcular costos
    const energyCost = energyDelivered * pricePerKwh;
    const timeCost = durationMinutes * pricePerMinute;
    const totalCost = energyCost + timeCost + sessionFee;
    
    // Distribución de ingresos
    const revenueConfig = await db.getRevenueShareConfig();
    const investorShare = totalCost * (revenueConfig.investorPercent / 100);
    const platformFee = totalCost * (revenueConfig.platformPercent / 100);
    
    // Actualizar transacción en BD
    await db.updateTransaction(transactionId, {
      endTime,
      kwhConsumed: energyDelivered.toFixed(4),
      energyCost: energyCost.toFixed(2),
      timeCost: timeCost.toFixed(2),
      sessionCost: sessionFee.toFixed(2),
      totalCost: totalCost.toFixed(2),
      investorShare: investorShare.toFixed(2),
      platformFee: platformFee.toFixed(2),
      status: "COMPLETED",
      stopReason: "Local",
    });
    
    // Actualizar estado del EVSE
    try {
      await db.updateEvseStatus(transaction.evseId, "AVAILABLE");
    } catch (evseErr) {
      console.error(`[completeTransactionLocally] Error updating EVSE:`, evseErr);
    }
    
    // Descontar saldo del usuario
    if (totalCost > 0 && transaction.userId) {
      try {
        await db.deductWalletBalance(transaction.userId, totalCost, transactionId);
        console.log(`[completeTransactionLocally] Deducted $${totalCost.toFixed(0)} COP from user ${transaction.userId}`);
      } catch (walletErr) {
        console.error(`[completeTransactionLocally] Error deducting wallet:`, walletErr);
        // No lanzar error - la transacción ya se completó, el cobro se puede hacer después
      }
    }
    
    // Actualizar wallet del inversor
    try {
      const station = await db.getChargingStationById(transaction.stationId);
      if (station?.ownerId) {
        await db.addInvestorEarnings(station.ownerId, investorShare, transactionId);
        console.log(`[completeTransactionLocally] Added $${investorShare.toFixed(0)} COP to investor ${station.ownerId}`);
      }
    } catch (investorErr) {
      console.error(`[completeTransactionLocally] Error updating investor wallet:`, investorErr);
    }
    
    // Enviar notificación al usuario
    if (transaction.userId) {
      try {
        const station = await db.getChargingStationById(transaction.stationId);
        const stationName = station?.name || "Estación";
        await db.createNotification({
          userId: transaction.userId,
          title: "⚡ Carga completada",
          message: `Tu carga en ${stationName} ha finalizado. Consumiste ${energyDelivered.toFixed(2)} kWh por un total de $${totalCost.toLocaleString()} COP. Duración: ${Math.round(durationMinutes)} minutos.`,
          type: "CHARGE_COMPLETE",
          referenceId: transactionId,
          referenceType: "transaction",
        });
      } catch (notifErr) {
        console.error(`[completeTransactionLocally] Error sending notification:`, notifErr);
      }
    }
    
    // =========================================================================
    // REGISTRO DE PRECISIÓN DE SOC (mismo que csms-dual.ts StopTransaction)
    // =========================================================================
    try {
      const manualSocValue = transaction.manualSoc ?? activeSession?.manualSoc ?? null;
      const batteryCapKwh = transaction.manualBatteryCapacityKwh
        ? parseFloat(transaction.manualBatteryCapacityKwh)
        : activeSession?.manualBatteryCapacityKwh ?? null;

      if (manualSocValue !== null && batteryCapKwh && batteryCapKwh > 0 && energyDelivered > 0) {
        const calculatedSocEnd = Math.min(100, Math.round(manualSocValue + (energyDelivered / batteryCapKwh) * 100));
        const chargerSocEnd = activeSession?.soc ?? null;
        let estimatedErrorKwh: number | null = null;
        let estimatedErrorSocPct: number | null = null;
        if (chargerSocEnd !== null) {
          estimatedErrorSocPct = calculatedSocEnd - chargerSocEnd;
          estimatedErrorKwh = Math.round((estimatedErrorSocPct / 100) * batteryCapKwh * 10) / 10;
        }
        let vehicleId: number | null = null;
        try {
          const defaultVehicle = await db.getDefaultVehicle(transaction.userId);
          vehicleId = defaultVehicle?.id ?? null;
        } catch (_) { /* no-op */ }

        await db.createSocAccuracyLog({
          userId: transaction.userId,
          transactionId,
          vehicleId,
          manualSocStart: manualSocValue,
          manualBatteryCapacityKwh: batteryCapKwh,
          realKwhDelivered: Math.round(energyDelivered * 100) / 100,
          calculatedSocEnd,
          chargerSocEnd,
          batteryFullDetected: activeSession?.chargeCompleteDetected ?? false,
          detectionMethod: activeSession?.chargeCompleteDetected
            ? (activeSession.soc !== null ? 'charger_soc' : 'power_drop')
            : 'user_stop',
          estimatedErrorKwh,
          estimatedErrorSocPct,
        });
        console.log(`[completeTransactionLocally] SoC accuracy logged: tx=${transactionId}, manualSoc=${manualSocValue}%, calcEnd=${calculatedSocEnd}%, chargerEnd=${chargerSocEnd ?? 'N/A'}%`);
      } else {
        console.log(`[completeTransactionLocally] SoC accuracy skipped: manualSoc=${manualSocValue}, batteryCapKwh=${batteryCapKwh}, energyDelivered=${energyDelivered}`);
      }
    } catch (socAccErr) {
      console.error(`[completeTransactionLocally] Error logging SoC accuracy:`, socAccErr);
    }

    // Limpiar sesión activa de memoria
    activeChargeSessions.delete(transactionId);
    
    console.log(`[completeTransactionLocally] Transaction ${transactionId} completed: ${energyDelivered.toFixed(4)} kWh, $${totalCost.toFixed(0)} COP`);
  } catch (err) {
    console.error(`[completeTransactionLocally] Error completing transaction ${transactionId}:`, err);
    // Fallback: al menos marcar como completada para no dejar al usuario bloqueado
    try {
      await db.updateTransaction(transactionId, {
        endTime: new Date(),
        status: "COMPLETED",
        stopReason: "Error",
      });
    } catch (fallbackErr) {
      console.error(`[completeTransactionLocally] Fallback error:`, fallbackErr);
    }
  }
}

// Fix startCharge RemoteStartTransaction - deployed Mon Feb 17 2026
