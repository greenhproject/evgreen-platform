/**
 * Servicio de alertas de cambio de precio dinámico
 * Notifica a usuarios cuando el precio baja significativamente en estaciones cercanas
 */

import * as db from "./db";

// Umbral de cambio de precio para notificar (20% por defecto)
const PRICE_DROP_THRESHOLD = 0.20;

// Cache de precios anteriores por estación
const previousPrices: Map<number, number> = new Map();

// Cache de últimas notificaciones enviadas (para evitar spam)
const lastNotifications: Map<string, number> = new Map();
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos entre notificaciones

export interface PriceChangeAlert {
  stationId: number;
  stationName: string;
  previousPrice: number;
  currentPrice: number;
  percentageChange: number;
  multiplier: number;
}

/**
 * Verifica si el precio de una estación ha bajado significativamente
 */
export async function checkPriceChange(
  stationId: number,
  currentMultiplier: number,
  basePrice: number
): Promise<PriceChangeAlert | null> {
  const currentPrice = basePrice * currentMultiplier;
  const previousPrice = previousPrices.get(stationId);
  
  // Actualizar cache
  previousPrices.set(stationId, currentPrice);
  
  // Si no hay precio anterior, no podemos comparar
  if (previousPrice === undefined) {
    return null;
  }
  
  // Calcular cambio porcentual
  const percentageChange = (previousPrice - currentPrice) / previousPrice;
  
  // Solo alertar si el precio bajó más del umbral
  if (percentageChange >= PRICE_DROP_THRESHOLD) {
    const station = await db.getChargingStationById(stationId);
    if (station) {
      return {
        stationId,
        stationName: station.name,
        previousPrice,
        currentPrice,
        percentageChange,
        multiplier: currentMultiplier,
      };
    }
  }
  
  return null;
}

/**
 * Notifica a usuarios sobre una baja de precio
 */
export async function notifyPriceDrop(alert: PriceChangeAlert): Promise<number> {
  let notificationsSent = 0;
  
  // Obtener usuarios que han cargado en esta estación recientemente (últimos 30 días)
  const recentUsers = await db.getUsersWithRecentTransactions(alert.stationId, 30);
  
  for (const user of recentUsers) {
    // Verificar cooldown de notificaciones
    const notificationKey = `price_${alert.stationId}_${user.id}`;
    const lastNotification = lastNotifications.get(notificationKey);
    
    if (lastNotification && Date.now() - lastNotification < NOTIFICATION_COOLDOWN_MS) {
      continue; // Saltar si ya notificamos recientemente
    }
    
    try {
      const percentageText = Math.round(alert.percentageChange * 100);
      await db.createNotification({
        userId: user.id,
        title: "💰 ¡Precio reducido!",
        message: `El precio en ${alert.stationName} ha bajado un ${percentageText}%. Ahora está a $${alert.currentPrice.toLocaleString()} COP/kWh (antes $${alert.previousPrice.toLocaleString()} COP/kWh). ¡Buen momento para cargar!`,
        type: "PRICE_DROP",
        referenceId: alert.stationId,
        referenceType: "station",
      });
      
      lastNotifications.set(notificationKey, Date.now());
      notificationsSent++;
      
      console.log(`[PriceAlert] Notified user ${user.id} about price drop at station ${alert.stationId}`);
    } catch (error) {
      console.error(`[PriceAlert] Error notifying user ${user.id}:`, error);
    }
  }
  
  return notificationsSent;
}

/**
 * Procesa un cambio de precio y notifica si es significativo
 */
export async function processPriceUpdate(
  stationId: number,
  currentMultiplier: number,
  basePrice: number
): Promise<void> {
  const alert = await checkPriceChange(stationId, currentMultiplier, basePrice);
  
  if (alert) {
    const notificationsSent = await notifyPriceDrop(alert);
    console.log(`[PriceAlert] Station ${stationId}: Price dropped ${Math.round(alert.percentageChange * 100)}%, notified ${notificationsSent} users`);
  }
}

/**
 * Obtiene el estado actual del servicio de alertas
 */
export function getAlertServiceStatus() {
  return {
    trackedStations: previousPrices.size,
    activeNotificationCooldowns: lastNotifications.size,
    priceDropThreshold: PRICE_DROP_THRESHOLD * 100,
    cooldownMinutes: NOTIFICATION_COOLDOWN_MS / (60 * 1000),
  };
}
