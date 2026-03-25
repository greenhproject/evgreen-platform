/**
 * Consumption Profile Service — Fase 2 Inteligencia IA
 * 
 * Actualiza automáticamente el perfil de consumo del usuario después de cada
 * sesión de carga. El perfil incluye:
 * - Estadísticas acumuladas (kWh, gasto, duración promedio)
 * - Promedios mensuales (últimos 3 meses)
 * - Horarios y días preferidos de carga
 * - Estaciones favoritas top 3
 * - Tipo de carga y conector preferido
 * - Frecuencia de carga y predicción de próxima carga
 * - Score de usuario (frecuencia, gasto, puntualidad, lealtad)
 * - Recomendación de suscripción basada en consumo real
 */

import { getDb } from "../db";
import {
  transactions,
  chargingStations,
  evses,
  userConsumptionProfile,
  type UserConsumptionProfile,
  subscriptions,
  users,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

// Precios de suscripción mensuales en COP
const SUBSCRIPTION_PRICES: Record<string, number> = {
  FREE: 0,
  BASIC: 29900,
  PREMIUM: 59900,
  ENTERPRISE: 149900,
};

// Descuentos por kWh por tier
const SUBSCRIPTION_DISCOUNTS: Record<string, number> = {
  FREE: 0,
  BASIC: 0.05,    // 5%
  PREMIUM: 0.10,  // 10%
  ENTERPRISE: 0.15, // 15%
};

export interface ConsumptionProfileUpdate {
  userId: number;
  transactionId: number;
  stationId: number;
  kwhConsumed: number;
  totalCost: number;
  durationMinutes: number;
  chargeType?: string;    // AC or DC
  connectorType?: string; // CCS_2, TYPE_2, etc.
  chargePowerKw?: number;
  startTime: Date;
  endTime: Date;
  hadOverstay: boolean;   // Para calcular puntualidad
}

/**
 * Actualiza el perfil de consumo del usuario después de una sesión de carga.
 * Se llama automáticamente desde csms-dual.ts al completar una transacción.
 */
export async function updateConsumptionProfile(data: ConsumptionProfileUpdate): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // 1. Obtener todas las transacciones completadas del usuario
    const allTx = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, data.userId),
        eq(transactions.status, "COMPLETED")
      ))
      .orderBy(desc(transactions.startTime));

    const totalSessions = allTx.length;
    const totalKwh = allTx.reduce((sum, t) => sum + Number(t.kwhConsumed || 0), 0);
    const totalSpent = allTx.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
    const avgKwh = totalSessions > 0 ? totalKwh / totalSessions : 0;
    const avgCost = totalSessions > 0 ? totalSpent / totalSessions : 0;

    // Duración promedio
    const durations = allTx
      .filter(t => t.startTime && t.endTime)
      .map(t => (new Date(t.endTime!).getTime() - new Date(t.startTime).getTime()) / 60000);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // 2. Promedios mensuales (últimos 3 meses)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentTx = allTx.filter(t => t.startTime && new Date(t.startTime) >= threeMonthsAgo);
    const monthsSpan = Math.max(1, 3); // siempre dividir entre 3 meses
    const monthlyAvgSpent = recentTx.reduce((sum, t) => sum + Number(t.totalCost || 0), 0) / monthsSpan;
    const monthlyAvgKwh = recentTx.reduce((sum, t) => sum + Number(t.kwhConsumed || 0), 0) / monthsSpan;
    const monthlyAvgSessions = recentTx.length / monthsSpan;

    // 3. Horarios preferidos (top 3 horas)
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    for (const t of allTx) {
      if (t.startTime) {
        const d = new Date(t.startTime);
        const hour = d.getHours();
        const day = d.getDay(); // 0=domingo, 1=lunes, etc.
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    }
    const preferredHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h));
    const preferredDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => parseInt(d));

    // 4. Estaciones favoritas top 3
    const stationCounts: Record<number, { count: number; lastVisit: string }> = {};
    for (const t of allTx) {
      if (t.stationId) {
        if (!stationCounts[t.stationId]) {
          stationCounts[t.stationId] = { count: 0, lastVisit: '' };
        }
        stationCounts[t.stationId].count++;
        const txDate = t.startTime ? new Date(t.startTime).toISOString() : '';
        if (txDate > stationCounts[t.stationId].lastVisit) {
          stationCounts[t.stationId].lastVisit = txDate;
        }
      }
    }
    const topStationIds = Object.entries(stationCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3);

    const topStations: Array<{ stationId: number; name: string; visits: number; lastVisit: string }> = [];
    for (const [sid, info] of topStationIds) {
      const stationId = parseInt(sid);
      const [station] = await db.select({ name: chargingStations.name })
        .from(chargingStations)
        .where(eq(chargingStations.id, stationId))
        .limit(1);
      topStations.push({
        stationId,
        name: station?.name || `Estación #${stationId}`,
        visits: info.count,
        lastVisit: info.lastVisit,
      });
    }

    // 5. Tipo de carga y conector preferido
    const chargeTypeCounts: Record<string, number> = {};
    const connectorTypeCounts: Record<string, number> = {};
    const powerValues: number[] = [];
    // Obtener info de EVSEs para tipo de carga y conector
    const evseCache: Record<number, { chargeType: string; connectorType: string; powerKw: number }> = {};
    for (const t of allTx) {
      if (t.evseId && !evseCache[t.evseId]) {
        try {
          const [evse] = await db.select({
            chargeType: evses.chargeType,
            connectorType: evses.connectorType,
            powerKw: evses.powerKw,
          })
            .from(evses)
            .where(eq(evses.id, t.evseId))
            .limit(1);
          if (evse) {
            evseCache[t.evseId] = {
              chargeType: evse.chargeType,
              connectorType: evse.connectorType,
              powerKw: Number(evse.powerKw),
            };
          }
        } catch (_) { /* ignore */ }
      }
      const evseInfo = t.evseId ? evseCache[t.evseId] : null;
      if (evseInfo?.chargeType) {
        chargeTypeCounts[evseInfo.chargeType] = (chargeTypeCounts[evseInfo.chargeType] || 0) + 1;
      }
      if (evseInfo?.connectorType) {
        connectorTypeCounts[evseInfo.connectorType] = (connectorTypeCounts[evseInfo.connectorType] || 0) + 1;
      }
      if (evseInfo?.powerKw) powerValues.push(evseInfo.powerKw);
    }
    const preferredChargeType = Object.entries(chargeTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const preferredConnectorType = Object.entries(connectorTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const avgChargePower = powerValues.length > 0
      ? Math.round(powerValues.reduce((a, b) => a + b, 0) / powerValues.length * 100) / 100
      : 0;

    // 6. Frecuencia de carga y predicción
    let typicalFrequencyDays: number | null = null;
    let nextPredictedCharge: Date | null = null;
    if (allTx.length >= 2) {
      const sortedDates = allTx
        .filter(t => t.startTime)
        .map(t => new Date(t.startTime!).getTime())
        .sort((a, b) => b - a);
      
      const intervals: number[] = [];
      for (let i = 0; i < Math.min(sortedDates.length - 1, 10); i++) {
        intervals.push((sortedDates[i] - sortedDates[i + 1]) / (1000 * 60 * 60 * 24));
      }
      if (intervals.length > 0) {
        typicalFrequencyDays = Math.round(
          intervals.reduce((a, b) => a + b, 0) / intervals.length * 100
        ) / 100;
        
        // Predicción: última carga + frecuencia típica
        const lastChargeTime = sortedDates[0];
        nextPredictedCharge = new Date(lastChargeTime + typicalFrequencyDays * 24 * 60 * 60 * 1000);
      }
    }

    // 7. Score de usuario (0-100)
    const score = calculateUserScore({
      totalSessions,
      monthlyAvgSessions,
      monthlyAvgSpent,
      totalSpent,
      hadOverstay: data.hadOverstay,
      allTx,
      accountCreatedAt: null, // Se calcula abajo
    });

    // Obtener fecha de creación de cuenta para lealtad
    const [userRow] = await db.select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    if (userRow) {
      score.breakdown.loyalty = calculateLoyaltyScore(userRow.createdAt);
      score.total = Math.round(
        score.breakdown.frequency * 0.3 +
        score.breakdown.spending * 0.25 +
        score.breakdown.punctuality * 0.2 +
        score.breakdown.loyalty * 0.25
      );
    }

    // 8. Recomendación de suscripción
    const { recommendedTier, estimatedSavings } = calculateRecommendedSubscription(
      monthlyAvgSpent,
      monthlyAvgKwh,
      monthlyAvgSessions
    );

    // 9. Upsert del perfil
    const existing = await db.select()
      .from(userConsumptionProfile)
      .where(eq(userConsumptionProfile.userId, data.userId))
      .limit(1);

    const profileData = {
      totalSessions,
      totalKwh: totalKwh.toFixed(4),
      totalSpentCop: totalSpent.toFixed(2),
      avgKwhPerSession: avgKwh.toFixed(4),
      avgCostPerSession: avgCost.toFixed(2),
      avgSessionDurationMin: avgDuration,
      monthlyAvgSpent: monthlyAvgSpent.toFixed(2),
      monthlyAvgKwh: monthlyAvgKwh.toFixed(4),
      monthlyAvgSessions: monthlyAvgSessions.toFixed(2),
      preferredHours: preferredHours as any,
      preferredDays: preferredDays as any,
      topStations: topStations as any,
      preferredChargeType,
      preferredConnectorType,
      avgChargePowerKw: avgChargePower.toFixed(2),
      typicalChargeFrequencyDays: typicalFrequencyDays?.toFixed(2) || null,
      lastChargeAt: data.endTime,
      nextPredictedChargeAt: nextPredictedCharge,
      userScore: score.total,
      scoreBreakdown: score.breakdown as any,
      recommendedTier,
      estimatedMonthlySavingsWithUpgrade: estimatedSavings.toFixed(2),
    };

    if (existing.length > 0) {
      await db.update(userConsumptionProfile)
        .set(profileData)
        .where(eq(userConsumptionProfile.userId, data.userId));
    } else {
      await db.insert(userConsumptionProfile).values({
        userId: data.userId,
        ...profileData,
      });
    }

    console.log(`[ConsumptionProfile] Updated for user ${data.userId}: ${totalSessions} sessions, ${totalKwh.toFixed(1)} kWh, score=${score.total}/100, recommended=${recommendedTier}`);
  } catch (error) {
    console.error(`[ConsumptionProfile] Error updating profile for user ${data.userId}:`, error);
  }
}

/**
 * Obtener el perfil de consumo de un usuario
 */
export async function getConsumptionProfile(userId: number): Promise<UserConsumptionProfile | null> {
  const db = await getDb();
  if (!db) return null;
  const [profile] = await db.select()
    .from(userConsumptionProfile)
    .where(eq(userConsumptionProfile.userId, userId))
    .limit(1);
  return profile || null;
}

// ============================================================================
// FUNCIONES INTERNAS
// ============================================================================

interface ScoreInput {
  totalSessions: number;
  monthlyAvgSessions: number;
  monthlyAvgSpent: number;
  totalSpent: number;
  hadOverstay: boolean;
  allTx: any[];
  accountCreatedAt: Date | null;
}

function calculateUserScore(input: ScoreInput): { total: number; breakdown: { frequency: number; spending: number; punctuality: number; loyalty: number } } {
  // Frecuencia (0-100): basado en sesiones mensuales
  // 0 sesiones = 0, 1-2 = 30, 3-5 = 50, 6-10 = 70, 11-20 = 85, 20+ = 100
  let frequency = 0;
  if (input.monthlyAvgSessions >= 20) frequency = 100;
  else if (input.monthlyAvgSessions >= 11) frequency = 85;
  else if (input.monthlyAvgSessions >= 6) frequency = 70;
  else if (input.monthlyAvgSessions >= 3) frequency = 50;
  else if (input.monthlyAvgSessions >= 1) frequency = 30;
  else frequency = Math.round(input.monthlyAvgSessions * 30);

  // Gasto (0-100): basado en gasto mensual promedio
  // $0 = 0, $50K = 30, $100K = 50, $200K = 70, $500K = 85, $1M+ = 100
  let spending = 0;
  if (input.monthlyAvgSpent >= 1000000) spending = 100;
  else if (input.monthlyAvgSpent >= 500000) spending = 85;
  else if (input.monthlyAvgSpent >= 200000) spending = 70;
  else if (input.monthlyAvgSpent >= 100000) spending = 50;
  else if (input.monthlyAvgSpent >= 50000) spending = 30;
  else spending = Math.round(input.monthlyAvgSpent / 50000 * 30);

  // Puntualidad (0-100): basado en % de sesiones sin overstay
  const overstayTx = input.allTx.filter(t => Number(t.overstayCost || 0) > 0).length;
  const punctuality = input.totalSessions > 0
    ? Math.round(((input.totalSessions - overstayTx) / input.totalSessions) * 100)
    : 100;

  // Lealtad se calcula después con la fecha de creación de cuenta
  const loyalty = 0;

  const total = Math.round(
    frequency * 0.3 +
    spending * 0.25 +
    punctuality * 0.2 +
    loyalty * 0.25
  );

  return {
    total,
    breakdown: { frequency, spending, punctuality, loyalty },
  };
}

function calculateLoyaltyScore(createdAt: Date): number {
  const monthsActive = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsActive >= 24) return 100;
  if (monthsActive >= 12) return 80;
  if (monthsActive >= 6) return 60;
  if (monthsActive >= 3) return 40;
  if (monthsActive >= 1) return 20;
  return Math.round(monthsActive * 20);
}

function calculateRecommendedSubscription(
  monthlySpent: number,
  monthlyKwh: number,
  monthlySessions: number
): { recommendedTier: string; estimatedSavings: number } {
  // Calcular ahorro estimado con cada tier
  const savings: Record<string, number> = {};
  
  for (const [tier, discount] of Object.entries(SUBSCRIPTION_DISCOUNTS)) {
    const price = SUBSCRIPTION_PRICES[tier];
    const energySavings = monthlySpent * discount;
    savings[tier] = energySavings - price; // Ahorro neto = descuento en energía - costo de suscripción
  }

  // Recomendar el tier con mayor ahorro neto positivo
  let bestTier = "FREE";
  let bestSavings = 0;
  for (const [tier, saving] of Object.entries(savings)) {
    if (saving > bestSavings) {
      bestTier = tier;
      bestSavings = saving;
    }
  }

  // Si el usuario gasta poco, mantener en FREE
  if (monthlySpent < 30000 || monthlySessions < 2) {
    bestTier = "FREE";
    bestSavings = 0;
  }

  return {
    recommendedTier: bestTier,
    estimatedSavings: Math.max(0, bestSavings),
  };
}

/**
 * Genera texto de perfil de consumo para inyectar al prompt del LLM
 */
export function formatProfileForLLM(profile: UserConsumptionProfile): string {
  const topStations = (typeof profile.topStations === 'string' 
    ? JSON.parse(profile.topStations) 
    : profile.topStations || []) as Array<{ stationId: number; name: string; visits: number }>;
  
  const preferredHours = (typeof profile.preferredHours === 'string'
    ? JSON.parse(profile.preferredHours)
    : profile.preferredHours || []) as number[];
  
  const preferredDays = (typeof profile.preferredDays === 'string'
    ? JSON.parse(profile.preferredDays)
    : profile.preferredDays || []) as number[];

  const scoreBreakdown = (typeof profile.scoreBreakdown === 'string'
    ? JSON.parse(profile.scoreBreakdown)
    : profile.scoreBreakdown) as { frequency: number; spending: number; punctuality: number; loyalty: number } | null;

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const daysStr = preferredDays.map(d => dayNames[d] || `Día ${d}`).join(', ');
  const hoursStr = preferredHours.map(h => `${h}:00`).join(', ');
  const stationsStr = topStations.map(s => `${s.name} (${s.visits} visitas)`).join(', ');

  let text = `## Perfil de Consumo del Usuario (Aprendizaje Progresivo)
- Sesiones totales: ${profile.totalSessions}
- Energía total: ${Number(profile.totalKwh).toFixed(1)} kWh
- Gasto total: $${Math.round(Number(profile.totalSpentCop)).toLocaleString('es-CO')} COP
- Promedio por carga: ${Number(profile.avgKwhPerSession).toFixed(1)} kWh / $${Math.round(Number(profile.avgCostPerSession)).toLocaleString('es-CO')} COP
- Duración promedio: ${profile.avgSessionDurationMin} minutos
- Gasto mensual promedio: $${Math.round(Number(profile.monthlyAvgSpent)).toLocaleString('es-CO')} COP
- Energía mensual: ${Number(profile.monthlyAvgKwh).toFixed(1)} kWh/mes
- Sesiones mensuales: ${Number(profile.monthlyAvgSessions).toFixed(1)}/mes
`;

  if (hoursStr) text += `- Horarios preferidos de carga: ${hoursStr}\n`;
  if (daysStr) text += `- Días preferidos: ${daysStr}\n`;
  if (stationsStr) text += `- Estaciones favoritas: ${stationsStr}\n`;
  if (profile.preferredChargeType) text += `- Tipo de carga preferido: ${profile.preferredChargeType}\n`;
  if (profile.preferredConnectorType) text += `- Conector preferido: ${profile.preferredConnectorType}\n`;
  if (Number(profile.avgChargePowerKw) > 0) text += `- Potencia promedio: ${Number(profile.avgChargePowerKw).toFixed(0)} kW\n`;
  
  if (profile.typicalChargeFrequencyDays) {
    const freq = Number(profile.typicalChargeFrequencyDays);
    text += `- Frecuencia típica: cada ${freq.toFixed(1)} días\n`;
  }
  if (profile.nextPredictedChargeAt) {
    const nextDate = new Date(profile.nextPredictedChargeAt);
    const now = new Date();
    const daysUntil = Math.round((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0) {
      text += `- Próxima carga estimada: en ~${daysUntil} días (${nextDate.toLocaleDateString('es-CO')})\n`;
    } else if (daysUntil === 0) {
      text += `- ⚡ Según su patrón, HOY debería necesitar cargar\n`;
    } else {
      text += `- ⚠️ Según su patrón, ya debería haber cargado hace ${Math.abs(daysUntil)} días\n`;
    }
  }

  text += `- Score de usuario: ${profile.userScore}/100`;
  if (scoreBreakdown) {
    text += ` (frecuencia: ${scoreBreakdown.frequency}, gasto: ${scoreBreakdown.spending}, puntualidad: ${scoreBreakdown.punctuality}, lealtad: ${scoreBreakdown.loyalty})`;
  }
  text += `\n`;

  if (profile.recommendedTier && profile.recommendedTier !== 'FREE') {
    text += `- 💡 Suscripción recomendada: ${profile.recommendedTier} (ahorraría ~$${Math.round(Number(profile.estimatedMonthlySavingsWithUpgrade)).toLocaleString('es-CO')} COP/mes)\n`;
  }

  text += `\nUsa este perfil para dar recomendaciones PERSONALIZADAS basadas en los hábitos REALES del usuario:
- Sugiere estaciones que ya conoce y le gustan
- Recomienda horarios que coincidan con sus hábitos
- Si está retrasado en su frecuencia de carga, recuérdalo proactivamente
- Si le conviene una suscripción superior, explica el ahorro concreto
- Compara precios actuales con su promedio histórico para indicar si es buen momento
`;

  return text;
}
