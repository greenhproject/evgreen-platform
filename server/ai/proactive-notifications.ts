/**
 * Proactive Notifications Service — Fase 2 Inteligencia IA
 * 
 * Envía notificaciones inteligentes basadas en el perfil de consumo:
 * 1. Precio bajo en estación favorita → "Tu estación X tiene descuento ahora"
 * 2. Hora habitual de carga → "Es tu hora habitual de carga, ¿necesitas cargar?"
 * 3. Predicción de carga → "Según tu patrón, deberías necesitar cargar pronto"
 * 4. Sugerencia de suscripción → "Con Plan Premium ahorrarías $X/mes"
 * 
 * Se ejecuta como un cron job cada 30 minutos.
 */

import { getDb } from "../db";
import * as dbOps from "../db";
import {
  userConsumptionProfile,
  chargingStations,
  evses,
  tariffs,
  users,
  notifications,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql, ne, isNotNull } from "drizzle-orm";
import {
  calculateOccupancyMultiplier,
  calculateTimeMultiplier,
  calculateDayMultiplier,
  getDemandLevel,
  DEFAULT_PRICING_CONFIG,
} from "../pricing/dynamic-pricing";

// Evitar enviar la misma notificación más de una vez al día
const sentNotifications = new Map<string, number>(); // key: `${userId}-${type}`, value: timestamp

const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas entre notificaciones del mismo tipo

/**
 * Verifica en la BD si ya se envió una notificación WhatsApp de este tipo
 * en las últimas 24 horas para este usuario. Persiste entre reinicios.
 */
async function wasRecentlySentInDb(userId: number, eventType: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const { whatsappNotificationLog } = await import("../../drizzle/schema");
    const { and, eq, gte } = await import("drizzle-orm");
    const since = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);
    const rows = await db.select({ id: whatsappNotificationLog.id })
      .from(whatsappNotificationLog)
      .where(and(
        eq(whatsappNotificationLog.userId, userId),
        eq(whatsappNotificationLog.eventType, eventType),
        gte(whatsappNotificationLog.createdAt, since),
      ))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Verifica si ya se envió una notificación similar recientemente
 */
function wasRecentlySent(userId: number, type: string): boolean {
  const key = `${userId}-${type}`;
  const lastSent = sentNotifications.get(key);
  if (!lastSent) return false;
  return Date.now() - lastSent < NOTIFICATION_COOLDOWN_MS;
}

function markAsSent(userId: number, type: string): void {
  sentNotifications.set(`${userId}-${type}`, Date.now());
}

/**
 * Limpia notificaciones antiguas del cache (evitar memory leak)
 */
function cleanupCache(): void {
  const now = Date.now();
  const entries = Array.from(sentNotifications.entries());
  for (const [key, timestamp] of entries) {
    if (now - timestamp > NOTIFICATION_COOLDOWN_MS * 2) {
      sentNotifications.delete(key);
    }
  }
}

// ============================================================================
// NOTIFICACIÓN 1: Precio bajo en estación favorita
// ============================================================================

async function checkLowPriceAtFavoriteStations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Obtener todos los perfiles con estaciones favoritas
  const profiles = await db.select()
    .from(userConsumptionProfile)
    .where(isNotNull(userConsumptionProfile.topStations));

  for (const profile of profiles) {
    if (wasRecentlySent(profile.userId, 'low_price')) continue;
    if (await wasRecentlySentInDb(profile.userId, 'low_price')) continue;

    const topStations = (typeof profile.topStations === 'string'
      ? JSON.parse(profile.topStations)
      : profile.topStations || []) as Array<{ stationId: number; name: string; visits: number }>;

    if (topStations.length === 0) continue;

    // Verificar precio actual de cada estación favorita
    for (const favStation of topStations) {
      try {
        const [station] = await db.select()
          .from(chargingStations)
          .where(eq(chargingStations.id, favStation.stationId))
          .limit(1);
        if (!station || !station.isActive) continue;

        const stationEvses = await db.select()
          .from(evses)
          .where(and(eq(evses.stationId, station.id), eq(evses.isActive, true)));

        const totalEvses = stationEvses.length;
        const availableEvses = stationEvses.filter(e => e.status === 'AVAILABLE').length;
        if (availableEvses === 0) continue;

        // Calcular precio dinámico actual
        const [tariff] = await db.select()
          .from(tariffs)
          .where(eq(tariffs.stationId, station.id))
          .limit(1);
        if (!tariff) continue;

        const basePrice = parseFloat(tariff.pricePerKwh);
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();

        const occupancyRate = totalEvses > 0 ? (totalEvses - availableEvses) / totalEvses : 0;
        const occupancyMult = calculateOccupancyMultiplier(occupancyRate, DEFAULT_PRICING_CONFIG);
        const timeMult = calculateTimeMultiplier(new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour), DEFAULT_PRICING_CONFIG);
        const dayMult = calculateDayMultiplier(new Date(now.getFullYear(), now.getMonth(), now.getDate()), DEFAULT_PRICING_CONFIG);

        const dynamicPrice = Math.round(basePrice * occupancyMult * timeMult * dayMult);
        const avgCostPerSession = Number(profile.avgCostPerSession || 0);
        const avgKwh = Number(profile.avgKwhPerSession || 0);

        // Si el precio actual es al menos 15% menor que el promedio histórico del usuario
        if (avgKwh > 0 && avgCostPerSession > 0) {
          const historicalPricePerKwh = avgCostPerSession / avgKwh;
          const savingsPercent = ((historicalPricePerKwh - dynamicPrice) / historicalPricePerKwh) * 100;

          if (savingsPercent >= 15) {
            const estimatedSavings = Math.round(avgKwh * (historicalPricePerKwh - dynamicPrice));
            
            await dbOps.createNotification({
              userId: profile.userId,
              title: "💰 Precio bajo en tu estación favorita",
              message: `${favStation.name} tiene un precio de $${dynamicPrice.toLocaleString('es-CO')}/kWh (${Math.round(savingsPercent)}% menos que tu promedio). Ahorrarías ~$${estimatedSavings.toLocaleString('es-CO')} COP en tu carga típica. ¡Buen momento para cargar!`,
              type: "PROMOTION",
              referenceId: favStation.stationId,
            });

            // Enviar push si tiene FCM token
            try {
              const { sendUserPush } = await import("../push/unified-push");
              await sendUserPush(profile.userId, {
                type: 'promotion',
                title: "💰 Precio bajo en tu estación favorita",
                body: `${favStation.name}: $${dynamicPrice.toLocaleString('es-CO')}/kWh (${Math.round(savingsPercent)}% menos). ¡Buen momento para cargar!`,
              });
            } catch (_) { /* push optional */ }

            markAsSent(profile.userId, 'low_price');
            console.log(`[ProactiveNotif] Low price alert sent to user ${profile.userId}: ${favStation.name} at $${dynamicPrice}/kWh (${Math.round(savingsPercent)}% savings)`);
            break; // Solo una notificación de precio por usuario
          }
        }
      } catch (err) {
        console.error(`[ProactiveNotif] Error checking station ${favStation.stationId}:`, err);
      }
    }
  }
}

// ============================================================================
// NOTIFICACIÓN 2: Hora habitual de carga
// ============================================================================

/**
 * Verifica en la tabla notifications si ya se envió una notificación
 * de tipo habitual_time HOY para este usuario. Persiste entre reinicios.
 */
async function wasHabitualNotifSentToday(userId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    // Inicio del día en hora local Colombia (UTC-5)
    const nowUtc = Date.now();
    const colombiaOffset = -5 * 60 * 60 * 1000;
    const nowColombia = new Date(nowUtc + colombiaOffset);
    const startOfDayColombia = new Date(
      nowColombia.getUTCFullYear(),
      nowColombia.getUTCMonth(),
      nowColombia.getUTCDate(),
      0, 0, 0, 0
    );
    // Convertir de vuelta a UTC para comparar con la BD
    const startOfDayUtc = new Date(startOfDayColombia.getTime() - colombiaOffset);

    const rows = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "CHARGING"),
        sql`${notifications.title} LIKE '%hora habitual%'`,
        gte(notifications.createdAt, startOfDayUtc),
      ))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function checkHabitualChargingTime(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const currentHour = now.getHours();

  const profiles = await db.select()
    .from(userConsumptionProfile)
    .where(isNotNull(userConsumptionProfile.preferredHours));

  for (const profile of profiles) {
    // Deduplicación 1: cache en memoria (rápido, para el mismo proceso)
    if (wasRecentlySent(profile.userId, 'habitual_time')) continue;
    // Deduplicación 2: tabla notifications en BD (persiste entre reinicios de Railway)
    if (await wasHabitualNotifSentToday(profile.userId)) continue;
    // Deduplicación 3: tabla whatsappNotificationLog (para WhatsApp)
    if (await wasRecentlySentInDb(profile.userId, 'charging_reminder')) continue;
    if (profile.totalSessions < 3) continue; // Necesita al menos 3 sesiones para patrones

    const preferredHours = (typeof profile.preferredHours === 'string'
      ? JSON.parse(profile.preferredHours)
      : profile.preferredHours || []) as number[];

    // Si la hora actual coincide con una hora preferida del usuario
    if (preferredHours.includes(currentHour)) {
      // Verificar que no haya cargado hoy
      if (profile.lastChargeAt) {
        const lastCharge = new Date(profile.lastChargeAt);
        const today = new Date();
        if (lastCharge.toDateString() === today.toDateString()) continue; // Ya cargó hoy
      }

      // Verificar si según la frecuencia, debería necesitar cargar
      const freqDays = Number(profile.typicalChargeFrequencyDays || 0);
      if (freqDays > 0 && profile.lastChargeAt) {
        const daysSinceLastCharge = (Date.now() - new Date(profile.lastChargeAt).getTime()) / (1000 * 60 * 60 * 24);
        // Solo notificar si está cerca o pasó su frecuencia típica
        if (daysSinceLastCharge < freqDays * 0.7) continue;
      }

      const topStations = (typeof profile.topStations === 'string'
        ? JSON.parse(profile.topStations)
        : profile.topStations || []) as Array<{ stationId: number; name: string }>;

      const stationHint = topStations.length > 0
        ? ` Tu estación favorita "${topStations[0].name}" podría ser una buena opción.`
        : '';

      await dbOps.createNotification({
        userId: profile.userId,
        title: "⚡ Es tu hora habitual de carga",
        message: `Normalmente cargas alrededor de las ${currentHour}:00. ¿Necesitas cargar hoy?${stationHint}`,
        type: "CHARGING",
      });

      // Push notification (Web Push + FCM)
      try {
        const { sendUserPush } = await import("../push/unified-push");
        await sendUserPush(profile.userId, {
          type: 'station_available',
          title: "⚡ Es tu hora habitual de carga",
          body: `Normalmente cargas a las ${currentHour}:00.${stationHint}`,
        });
      } catch (_) { /* push optional */ }

      // WhatsApp: recordatorio de carga (plantilla aprobada)
      try {
        const userForWa = await dbOps.getUserById(profile.userId);
        if (userForWa?.phone) {
          const { sendWhatsAppTemplate, WA_TEMPLATE_NAMES } = await import("../whatsapp/whatsapp-service");
          sendWhatsAppTemplate({
            toPhone: userForWa.phone,
            templateName: WA_TEMPLATE_NAMES.recordatorio_carga,
            parameters: [
              userForWa.name?.split(" ")[0] || "Usuario",
              String(currentHour).padStart(2, "0"),
            ],
            eventType: "charging_reminder",
            userId: profile.userId,
          }).catch((e: Error) => console.error("[WhatsApp] charging_reminder error:", e.message));
        }
      } catch (waErr) {
        console.error("[WhatsApp] charging_reminder trigger error:", waErr);
      }

      markAsSent(profile.userId, 'habitual_time');
      console.log(`[ProactiveNotif] Habitual time alert sent to user ${profile.userId} at ${currentHour}:00`);
    }
  }
}

// ============================================================================
// NOTIFICACIÓN 3: Predicción de carga necesaria
// ============================================================================

async function checkChargePrediction(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const profiles = await db.select()
    .from(userConsumptionProfile)
    .where(isNotNull(userConsumptionProfile.nextPredictedChargeAt));

  const now = new Date();

  for (const profile of profiles) {
    if (wasRecentlySent(profile.userId, 'charge_prediction')) continue;
    if (await wasRecentlySentInDb(profile.userId, 'charge_prediction')) continue;
    if (!profile.nextPredictedChargeAt) continue;
    if (profile.totalSessions < 5) continue; // Necesita suficiente historial

    const predicted = new Date(profile.nextPredictedChargeAt);
    const hoursUntilPredicted = (predicted.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Notificar si la predicción es para hoy o mañana (0-24 horas)
    if (hoursUntilPredicted >= -6 && hoursUntilPredicted <= 24) {
      let timeText = '';
      if (hoursUntilPredicted <= 0) {
        timeText = 'Según tu patrón de uso, ya deberías necesitar cargar';
      } else if (hoursUntilPredicted <= 6) {
        timeText = 'Según tu patrón, necesitarás cargar en las próximas horas';
      } else {
        timeText = 'Según tu patrón, mañana necesitarás cargar';
      }

      const avgKwh = Number(profile.avgKwhPerSession || 0);
      const costHint = avgKwh > 0
        ? ` Tu carga típica es de ${avgKwh.toFixed(1)} kWh (~$${Math.round(Number(profile.avgCostPerSession || 0)).toLocaleString('es-CO')} COP).`
        : '';

      await dbOps.createNotification({
        userId: profile.userId,
        title: "🔋 Predicción: Carga necesaria pronto",
        message: `${timeText}.${costHint} ¿Quieres ver las estaciones disponibles?`,
        type: "CHARGING",
      });

      markAsSent(profile.userId, 'charge_prediction');
      console.log(`[ProactiveNotif] Charge prediction sent to user ${profile.userId}: ${hoursUntilPredicted.toFixed(0)}h until predicted charge`);
    }
  }
}

// ============================================================================
// NOTIFICACIÓN 4: Sugerencia de suscripción
// ============================================================================

async function checkSubscriptionSuggestion(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const profiles = await db.select()
    .from(userConsumptionProfile)
    .where(isNotNull(userConsumptionProfile.recommendedTier));

  for (const profile of profiles) {
    if (wasRecentlySent(profile.userId, 'subscription_suggestion')) continue;
    if (!profile.recommendedTier || profile.recommendedTier === 'FREE') continue;
    if (Number(profile.estimatedMonthlySavingsWithUpgrade || 0) < 5000) continue; // Al menos $5K ahorro

    const savings = Math.round(Number(profile.estimatedMonthlySavingsWithUpgrade));
    const tier = profile.recommendedTier;

    await dbOps.createNotification({
      userId: profile.userId,
      title: `💎 Ahorra con el Plan ${tier}`,
      message: `Basado en tu consumo de ${Number(profile.monthlyAvgKwh).toFixed(0)} kWh/mes, con el Plan ${tier} ahorrarías ~$${savings.toLocaleString('es-CO')} COP al mes. ¿Quieres ver los beneficios?`,
      type: "PROMOTION",
    });

    markAsSent(profile.userId, 'subscription_suggestion');
    console.log(`[ProactiveNotif] Subscription suggestion sent to user ${profile.userId}: ${tier} (saves $${savings}/month)`);
  }
}

// ============================================================================
// CRON JOB PRINCIPAL
// ============================================================================

let proactiveInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia el servicio de notificaciones proactivas.
 * Se ejecuta cada 30 minutos.
 */
export function startProactiveNotifications(): void {
  if (proactiveInterval) {
    clearInterval(proactiveInterval);
  }

  console.log("[ProactiveNotif] Starting proactive notification service (every 30 min)");

  // Ejecutar después de 2 minutos del inicio (dar tiempo a que todo cargue)
  setTimeout(runProactiveChecks, 2 * 60 * 1000);

  // Luego cada 30 minutos
  proactiveInterval = setInterval(runProactiveChecks, 30 * 60 * 1000);
}

async function runProactiveChecks(): Promise<void> {
  try {
    console.log("[ProactiveNotif] Running proactive checks...");
    
    await checkLowPriceAtFavoriteStations();
    await checkHabitualChargingTime();
    await checkChargePrediction();
    
    // Sugerencia de suscripción solo una vez al día (verificar hora)
    const hour = new Date().getHours();
    if (hour === 10 || hour === 18) { // Solo a las 10am o 6pm
      await checkSubscriptionSuggestion();
    }

    cleanupCache();
    console.log("[ProactiveNotif] Proactive checks completed");
  } catch (error) {
    console.error("[ProactiveNotif] Error in proactive checks:", error);
  }
}

export { runProactiveChecks };
