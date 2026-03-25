/**
 * Demand Forecast Service — Fase 3 IA Predictiva
 * 
 * Modelo de predicción de demanda por estación basado en historial real de
 * transacciones. Analiza patrones por hora del día y día de la semana para:
 * 
 * 1. Predecir ocupación futura de cada estación
 * 2. Calcular multiplicadores de demanda para pricing dinámico
 * 3. Detectar tendencias (creciente, estable, decreciente)
 * 4. Sugerir mejores horarios para cargar
 * 5. Alimentar el contexto del LLM con predicciones
 * 
 * El modelo usa media móvil ponderada exponencialmente (EWMA) para dar más
 * peso a las semanas recientes, con un factor de suavizado alpha = 0.3.
 */

import { getDb } from "../db";
import {
  transactions,
  chargingStations,
  evses,
  stationDemandForecast,
  type StationDemandForecast,
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

// ============================================================================
// CONFIGURACIÓN DEL MODELO
// ============================================================================

/** Factor de suavizado EWMA: 0.3 = las últimas semanas pesan 3x más */
const EWMA_ALPHA = 0.3;

/** Semanas de historial a analizar */
const HISTORY_WEEKS = 8;

/** Mínimo de datos para considerar la predicción confiable */
const MIN_SAMPLES_FOR_CONFIDENCE = 3;

/** Intervalo de recálculo: cada 6 horas */
const RECALCULATION_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ============================================================================
// FUNCIONES EXPORTADAS
// ============================================================================

/**
 * Recalcula las predicciones de demanda para TODAS las estaciones activas.
 * Se ejecuta periódicamente como cron job.
 */
export async function recalculateAllForecasts(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const activeStations = await db.select({ id: chargingStations.id })
      .from(chargingStations)
      .where(eq(chargingStations.isActive, true));

    console.log(`[DemandForecast] Recalculating forecasts for ${activeStations.length} stations...`);

    let updated = 0;
    for (const station of activeStations) {
      try {
        await recalculateStationForecast(station.id);
        updated++;
      } catch (err) {
        console.error(`[DemandForecast] Error for station ${station.id}:`, err);
      }
    }

    console.log(`[DemandForecast] Completed: ${updated}/${activeStations.length} stations updated`);
  } catch (error) {
    console.error("[DemandForecast] Error in recalculateAllForecasts:", error);
  }
}

/**
 * Recalcula las predicciones de demanda para una estación específica.
 * Analiza las últimas 8 semanas de transacciones agrupadas por día/hora.
 */
export async function recalculateStationForecast(stationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const historyStart = new Date(now.getTime() - HISTORY_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const midpoint = new Date(now.getTime() - (HISTORY_WEEKS / 2) * 7 * 24 * 60 * 60 * 1000);

  // Obtener todas las transacciones completadas de la estación en el período
  const stationTx = await db.select({
    startTime: transactions.startTime,
    endTime: transactions.endTime,
    kwhConsumed: transactions.kwhConsumed,
    totalCost: transactions.totalCost,
  })
    .from(transactions)
    .where(and(
      eq(transactions.stationId, stationId),
      eq(transactions.status, "COMPLETED"),
      gte(transactions.startTime, historyStart),
    ));

  // Obtener total de EVSEs para calcular tasa de ocupación
  const stationEvses = await db.select({ id: evses.id })
    .from(evses)
    .where(and(eq(evses.stationId, stationId), eq(evses.isActive, true)));
  const totalEvses = Math.max(1, stationEvses.length);

  // Agrupar transacciones por (dayOfWeek, hourOfDay) con EWMA
  // Estructura: slots[day][hour] = { recentWeeks: [...], olderWeeks: [...] }
  const slots: Record<string, {
    sessions: number[];      // sesiones por semana
    kwhValues: number[];     // kWh por semana
    revenueValues: number[]; // revenue por semana
    weekTimestamps: number[]; // para EWMA weighting
    recentSessions: number;  // últimas 4 semanas
    olderSessions: number;   // 4 semanas anteriores
  }> = {};

  // Inicializar todos los slots (7 días x 24 horas = 168 slots)
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      slots[`${day}-${hour}`] = {
        sessions: [],
        kwhValues: [],
        revenueValues: [],
        weekTimestamps: [],
        recentSessions: 0,
        olderSessions: 0,
      };
    }
  }

  // Clasificar cada transacción en su slot
  for (const tx of stationTx) {
    if (!tx.startTime) continue;
    const d = new Date(tx.startTime);
    const day = d.getDay();
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    const slot = slots[key];
    if (!slot) continue;

    // Determinar a qué semana pertenece
    const weekIndex = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Asegurar que el array tiene espacio para esta semana
    while (slot.sessions.length <= weekIndex) {
      slot.sessions.push(0);
      slot.kwhValues.push(0);
      slot.revenueValues.push(0);
      slot.weekTimestamps.push(0);
    }

    slot.sessions[weekIndex]++;
    slot.kwhValues[weekIndex] += Number(tx.kwhConsumed || 0);
    slot.revenueValues[weekIndex] += Number(tx.totalCost || 0);
    slot.weekTimestamps[weekIndex] = d.getTime();

    // Clasificar en reciente vs anterior para tendencia
    if (d >= midpoint) {
      slot.recentSessions++;
    } else {
      slot.olderSessions++;
    }
  }

  // Calcular predicciones para cada slot y hacer upsert
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const slot = slots[key];

      // Calcular EWMA para sesiones, kWh y revenue
      const avgSessions = calculateEWMA(slot.sessions);
      const avgKwh = calculateEWMA(slot.kwhValues);
      const avgRevenue = calculateEWMA(slot.revenueValues);

      // Calcular tasa de ocupación estimada
      // Si en promedio hay X sesiones por hora y hay Y EVSEs,
      // la ocupación estimada es (X / Y) * 100, con cap en 100
      const avgOccupancy = Math.min(100, (avgSessions / totalEvses) * 100);

      // Calcular tendencia
      const { trend, trendPercent } = calculateTrend(slot.recentSessions, slot.olderSessions);

      // Calcular multiplicador de demanda sugerido
      const demandMultiplier = calculateDemandMultiplierFromForecast(avgOccupancy, trend, trendPercent);

      // Calcular confianza (0-100)
      const weeksWithData = slot.sessions.filter(s => s > 0).length;
      const confidenceScore = Math.min(100, Math.round((weeksWithData / HISTORY_WEEKS) * 100));

      // Upsert en la tabla
      const existing = await db.select()
        .from(stationDemandForecast)
        .where(and(
          eq(stationDemandForecast.stationId, stationId),
          eq(stationDemandForecast.dayOfWeek, day),
          eq(stationDemandForecast.hourOfDay, hour),
        ))
        .limit(1);

      const forecastData = {
        avgSessionsPerSlot: avgSessions.toFixed(4),
        avgOccupancyRate: avgOccupancy.toFixed(2),
        avgKwhPerSlot: avgKwh.toFixed(4),
        avgRevenuePerSlot: avgRevenue.toFixed(2),
        trend,
        trendPercent: trendPercent.toFixed(2),
        suggestedDemandMultiplier: demandMultiplier.toFixed(3),
        confidenceScore,
        sampleSize: weeksWithData,
        lastCalculatedAt: now,
      };

      if (existing.length > 0) {
        await db.update(stationDemandForecast)
          .set(forecastData)
          .where(eq(stationDemandForecast.id, existing[0].id));
      } else {
        await db.insert(stationDemandForecast).values({
          stationId,
          dayOfWeek: day,
          hourOfDay: hour,
          ...forecastData,
        });
      }
    }
  }
}

/**
 * Obtiene la predicción de demanda para una estación en un momento dado.
 * Usado por el pricing dinámico para reemplazar el demandMultiplier hardcodeado.
 */
export async function getDemandForecast(
  stationId: number,
  targetDate: Date = new Date()
): Promise<{ multiplier: number; confidence: number; trend: string; avgOccupancy: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const dayOfWeek = targetDate.getDay();
  const hourOfDay = targetDate.getHours();

  const [forecast] = await db.select()
    .from(stationDemandForecast)
    .where(and(
      eq(stationDemandForecast.stationId, stationId),
      eq(stationDemandForecast.dayOfWeek, dayOfWeek),
      eq(stationDemandForecast.hourOfDay, hourOfDay),
    ))
    .limit(1);

  if (!forecast || forecast.confidenceScore === 0) return null;

  return {
    multiplier: Number(forecast.suggestedDemandMultiplier),
    confidence: forecast.confidenceScore ?? 0,
    trend: forecast.trend ?? "STABLE",
    avgOccupancy: Number(forecast.avgOccupancyRate),
  };
}

/**
 * Obtiene las predicciones de las próximas 24 horas para una estación.
 * Usado por el endpoint de "mejor horario para cargar".
 */
export async function get24HourForecast(
  stationId: number,
  startDate: Date = new Date()
): Promise<Array<{
  hour: number;
  dayOfWeek: number;
  time: Date;
  avgOccupancy: number;
  demandMultiplier: number;
  trend: string;
  confidence: number;
  recommendation: "BEST" | "GOOD" | "AVOID";
}>> {
  const db = await getDb();
  if (!db) return [];

  const results: Array<{
    hour: number;
    dayOfWeek: number;
    time: Date;
    avgOccupancy: number;
    demandMultiplier: number;
    trend: string;
    confidence: number;
    recommendation: "BEST" | "GOOD" | "AVOID";
  }> = [];

  for (let i = 0; i < 24; i++) {
    const slotTime = new Date(startDate.getTime() + i * 60 * 60 * 1000);
    const dayOfWeek = slotTime.getDay();
    const hourOfDay = slotTime.getHours();

    const [forecast] = await db.select()
      .from(stationDemandForecast)
      .where(and(
        eq(stationDemandForecast.stationId, stationId),
        eq(stationDemandForecast.dayOfWeek, dayOfWeek),
        eq(stationDemandForecast.hourOfDay, hourOfDay),
      ))
      .limit(1);

    const avgOccupancy = forecast ? Number(forecast.avgOccupancyRate) : 50;
    const demandMultiplier = forecast ? Number(forecast.suggestedDemandMultiplier) : 1.0;
    const trend = forecast?.trend ?? "STABLE";
    const confidence = forecast?.confidenceScore ?? 0;

    let recommendation: "BEST" | "GOOD" | "AVOID";
    if (demandMultiplier < 0.95) recommendation = "BEST";
    else if (demandMultiplier < 1.2) recommendation = "GOOD";
    else recommendation = "AVOID";

    results.push({
      hour: hourOfDay,
      dayOfWeek,
      time: slotTime,
      avgOccupancy,
      demandMultiplier,
      trend,
      confidence,
      recommendation,
    });
  }

  return results;
}

/**
 * Genera texto de predicción de demanda para inyectar al prompt del LLM.
 */
export async function formatDemandForecastForLLM(stationId: number): Promise<string> {
  const forecast24h = await get24HourForecast(stationId);
  if (forecast24h.length === 0) return "";

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const bestSlots = forecast24h
    .filter(s => s.recommendation === "BEST")
    .slice(0, 3);
  const avoidSlots = forecast24h
    .filter(s => s.recommendation === "AVOID")
    .slice(0, 3);

  let text = `## Predicción de Demanda (próximas 24h)\n`;

  if (bestSlots.length > 0) {
    text += `- Mejores horarios para cargar: ${bestSlots.map(s => `${s.hour}:00 (${dayNames[s.dayOfWeek]}, ocupación ~${s.avgOccupancy.toFixed(0)}%)`).join(', ')}\n`;
  }
  if (avoidSlots.length > 0) {
    text += `- Horarios a evitar (alta demanda): ${avoidSlots.map(s => `${s.hour}:00 (${dayNames[s.dayOfWeek]}, ocupación ~${s.avgOccupancy.toFixed(0)}%)`).join(', ')}\n`;
  }

  // Tendencia general
  const risingCount = forecast24h.filter(s => s.trend === "RISING").length;
  const decliningCount = forecast24h.filter(s => s.trend === "DECLINING").length;
  if (risingCount > decliningCount * 2) {
    text += `- Tendencia general: CRECIENTE — la demanda en esta estación está subiendo\n`;
  } else if (decliningCount > risingCount * 2) {
    text += `- Tendencia general: DECRECIENTE — hay menos demanda que semanas anteriores\n`;
  } else {
    text += `- Tendencia general: ESTABLE\n`;
  }

  text += `\nUsa estas predicciones para recomendar al usuario el mejor momento para cargar, evitando horas pico y aprovechando descuentos por baja demanda.\n`;

  return text;
}

/**
 * Inicia el cron job de recálculo de predicciones de demanda.
 */
export function startDemandForecastJob(): void {
  console.log(`[DemandForecast] Starting demand forecast job (every ${RECALCULATION_INTERVAL_MS / 3600000}h)`);

  // Ejecutar inmediatamente al iniciar (con delay de 30s para no sobrecargar el arranque)
  setTimeout(() => {
    recalculateAllForecasts().catch(err =>
      console.error("[DemandForecast] Initial calculation error:", err)
    );
  }, 30_000);

  // Ejecutar periódicamente
  setInterval(() => {
    recalculateAllForecasts().catch(err =>
      console.error("[DemandForecast] Periodic calculation error:", err)
    );
  }, RECALCULATION_INTERVAL_MS);
}

// ============================================================================
// FUNCIONES INTERNAS
// ============================================================================

/**
 * Calcula la media móvil ponderada exponencialmente (EWMA).
 * Las semanas más recientes (índice 0) tienen más peso.
 * 
 * @param values Array de valores por semana, donde [0] = semana más reciente
 * @returns Promedio ponderado
 */
export function calculateEWMA(values: number[]): number {
  if (values.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < values.length; i++) {
    // Peso exponencial: semana 0 = 1.0, semana 1 = 0.7, semana 2 = 0.49, etc.
    const weight = Math.pow(1 - EWMA_ALPHA, i);
    weightedSum += values[i] * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Calcula la tendencia comparando período reciente vs anterior.
 */
export function calculateTrend(
  recentSessions: number,
  olderSessions: number
): { trend: string; trendPercent: number } {
  if (olderSessions === 0 && recentSessions === 0) {
    return { trend: "STABLE", trendPercent: 0 };
  }

  if (olderSessions === 0) {
    return { trend: "RISING", trendPercent: 100 };
  }

  const changePercent = ((recentSessions - olderSessions) / olderSessions) * 100;

  if (changePercent > 15) {
    return { trend: "RISING", trendPercent: changePercent };
  } else if (changePercent < -15) {
    return { trend: "DECLINING", trendPercent: changePercent };
  }

  return { trend: "STABLE", trendPercent: changePercent };
}

/**
 * Calcula el multiplicador de demanda sugerido basado en la predicción.
 * 
 * Ocupación baja (<30%) → descuento (0.8-0.9)
 * Ocupación normal (30-70%) → neutral (0.95-1.1)
 * Ocupación alta (70-90%) → surge leve (1.1-1.4)
 * Ocupación crítica (>90%) → surge fuerte (1.4-2.0)
 * 
 * La tendencia modifica el multiplicador:
 * - RISING: +5-10% (anticipar mayor demanda)
 * - DECLINING: -5% (incentivar uso)
 */
export function calculateDemandMultiplierFromForecast(
  avgOccupancy: number,
  trend: string,
  trendPercent: number
): number {
  let multiplier: number;

  if (avgOccupancy < 30) {
    // Baja ocupación: descuento proporcional
    multiplier = 0.8 + (avgOccupancy / 30) * 0.15; // 0.80 - 0.95
  } else if (avgOccupancy < 70) {
    // Normal: ligeramente por encima de 1.0
    const progress = (avgOccupancy - 30) / 40;
    multiplier = 0.95 + progress * 0.15; // 0.95 - 1.10
  } else if (avgOccupancy < 90) {
    // Alta: surge progresivo
    const progress = (avgOccupancy - 70) / 20;
    multiplier = 1.1 + progress * 0.3; // 1.10 - 1.40
  } else {
    // Crítica: surge fuerte
    const progress = Math.min(1, (avgOccupancy - 90) / 10);
    multiplier = 1.4 + progress * 0.6; // 1.40 - 2.00
  }

  // Ajustar por tendencia
  if (trend === "RISING") {
    const trendBoost = Math.min(0.1, Math.abs(trendPercent) / 100 * 0.1);
    multiplier += trendBoost;
  } else if (trend === "DECLINING") {
    const trendDiscount = Math.min(0.05, Math.abs(trendPercent) / 100 * 0.05);
    multiplier -= trendDiscount;
  }

  // Clamp entre 0.7 y 2.0
  return Math.max(0.7, Math.min(2.0, Math.round(multiplier * 1000) / 1000));
}
