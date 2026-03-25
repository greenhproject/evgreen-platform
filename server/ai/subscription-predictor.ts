/**
 * Subscription Predictor Service — Fase 3 IA Predictiva
 * 
 * Mejora las sugerencias de suscripción de Fase 2 con análisis predictivo:
 * 
 * 1. Proyección de consumo a 3, 6 y 12 meses basada en tendencia
 * 2. Cálculo de ahorro acumulado por tier con proyección
 * 3. Punto de equilibrio (breakeven) para cada tier
 * 4. Análisis de ROI de upgrade de suscripción
 * 5. Detección de cambios de patrón (usuario creciendo/decreciendo)
 * 
 * Usa regresión lineal simple sobre los datos mensuales para proyectar
 * la tendencia de consumo futuro.
 */

import { getDb } from "../db";
import {
  transactions,
  subscriptions,
  userConsumptionProfile,
  type UserConsumptionProfile,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

// ============================================================================
// TIPOS
// ============================================================================

export interface SubscriptionProjection {
  tier: string;
  monthlyPrice: number;
  discountPercent: number;
  projections: {
    months3: ProjectionPeriod;
    months6: ProjectionPeriod;
    months12: ProjectionPeriod;
  };
  breakEvenMonths: number | null;  // Meses hasta que el ahorro supera el costo
  roi12Months: number;              // ROI a 12 meses (%)
  isRecommended: boolean;
  recommendationReason: string;
}

export interface ProjectionPeriod {
  projectedSpending: number;       // Gasto proyectado sin suscripción
  projectedSpendingWithSub: number; // Gasto proyectado con suscripción
  subscriptionCost: number;         // Costo de la suscripción en el período
  netSavings: number;               // Ahorro neto (ahorro en energía - costo suscripción)
  savingsPercent: number;           // % de ahorro
}

export interface ConsumptionTrend {
  direction: "GROWING" | "STABLE" | "DECLINING";
  monthlyGrowthRate: number;        // % de cambio mensual
  projectedMonthlySpend: number[];  // Proyección de gasto mensual para los próximos 12 meses
  projectedMonthlyKwh: number[];    // Proyección de kWh mensual
  confidence: number;               // 0-100
}

export interface PredictiveSubscriptionResult {
  currentTier: string;
  consumptionTrend: ConsumptionTrend;
  projections: SubscriptionProjection[];
  bestRecommendation: {
    tier: string;
    reason: string;
    estimatedAnnualSavings: number;
  };
}

// Precios de suscripción mensuales en COP
const SUBSCRIPTION_TIERS: Record<string, { price: number; discount: number; freeReservations: number }> = {
  FREE: { price: 0, discount: 0, freeReservations: 0 },
  BASIC: { price: 29900, discount: 0.05, freeReservations: 2 },
  PREMIUM: { price: 59900, discount: 0.10, freeReservations: 5 },
  ENTERPRISE: { price: 149900, discount: 0.15, freeReservations: 999 },
};

// Valor promedio de una reserva en COP (ahorro por no pagar tarifa de reserva)
const AVG_RESERVATION_VALUE = 5000;

// ============================================================================
// FUNCIONES EXPORTADAS
// ============================================================================

/**
 * Genera una recomendación predictiva de suscripción completa para un usuario.
 */
export async function getPredictiveSubscriptionRecommendation(
  userId: number
): Promise<PredictiveSubscriptionResult | null> {
  const db = await getDb();
  if (!db) return null;

  // 1. Obtener perfil de consumo actual
  const [profile] = await db.select()
    .from(userConsumptionProfile)
    .where(eq(userConsumptionProfile.userId, userId))
    .limit(1);

  if (!profile || profile.totalSessions < 3) {
    return null; // No hay suficientes datos para predecir
  }

  // 2. Obtener historial mensual de gastos (últimos 6 meses)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyData = await getMonthlySpendingHistory(userId, sixMonthsAgo);

  // 3. Calcular tendencia de consumo
  const trend = calculateConsumptionTrend(monthlyData, profile);

  // 4. Obtener suscripción actual
  const [currentSub] = await db.select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.isActive, true),
    ))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const currentTier = currentSub?.tier || "FREE";

  // 5. Calcular proyecciones para cada tier
  const projections = Object.entries(SUBSCRIPTION_TIERS).map(([tier, config]) => {
    return calculateTierProjection(tier, config, trend, currentTier);
  });

  // 6. Encontrar la mejor recomendación
  const best = findBestRecommendation(projections, currentTier);

  return {
    currentTier,
    consumptionTrend: trend,
    projections,
    bestRecommendation: best,
  };
}

/**
 * Genera texto de recomendación predictiva para el LLM.
 */
export async function formatPredictiveSubscriptionForLLM(userId: number): Promise<string> {
  const result = await getPredictiveSubscriptionRecommendation(userId);
  if (!result) return "";

  const { consumptionTrend, bestRecommendation, currentTier, projections } = result;

  let text = `## Análisis Predictivo de Suscripción\n`;
  text += `- Suscripción actual: ${currentTier}\n`;

  // Tendencia
  const trendEmoji = consumptionTrend.direction === "GROWING" ? "📈" : 
                     consumptionTrend.direction === "DECLINING" ? "📉" : "➡️";
  text += `- Tendencia de consumo: ${trendEmoji} ${consumptionTrend.direction} (${consumptionTrend.monthlyGrowthRate > 0 ? '+' : ''}${consumptionTrend.monthlyGrowthRate.toFixed(1)}% mensual)\n`;

  // Proyección a 12 meses
  const totalProjected12m = consumptionTrend.projectedMonthlySpend
    .reduce((sum, v) => sum + v, 0);
  text += `- Gasto proyectado próximos 12 meses: ~$${Math.round(totalProjected12m).toLocaleString('es-CO')} COP\n`;

  // Recomendación
  if (bestRecommendation.tier !== currentTier) {
    text += `\n### 💡 Recomendación: Cambiar a ${bestRecommendation.tier}\n`;
    text += `- Razón: ${bestRecommendation.reason}\n`;
    text += `- Ahorro anual estimado: ~$${Math.round(bestRecommendation.estimatedAnnualSavings).toLocaleString('es-CO')} COP\n`;

    // Detalles del tier recomendado
    const recProjection = projections.find(p => p.tier === bestRecommendation.tier);
    if (recProjection) {
      text += `- Precio mensual: $${recProjection.monthlyPrice.toLocaleString('es-CO')} COP\n`;
      text += `- Descuento en energía: ${recProjection.discountPercent * 100}%\n`;
      if (recProjection.breakEvenMonths) {
        text += `- Punto de equilibrio: ${recProjection.breakEvenMonths} meses\n`;
      }
      text += `- ROI a 12 meses: ${recProjection.roi12Months.toFixed(0)}%\n`;
    }
  } else {
    text += `\n✅ La suscripción actual (${currentTier}) es la óptima para tu nivel de consumo.\n`;
  }

  text += `\nUsa estos datos para explicar al usuario con números concretos por qué le conviene (o no) cambiar de suscripción.\n`;

  return text;
}

// ============================================================================
// FUNCIONES INTERNAS
// ============================================================================

interface MonthlyData {
  month: string;       // "2026-01", "2026-02", etc.
  totalSpent: number;
  totalKwh: number;
  sessions: number;
}

async function getMonthlySpendingHistory(
  userId: number,
  since: Date
): Promise<MonthlyData[]> {
  const db = await getDb();
  if (!db) return [];

  const allTx = await db.select({
    startTime: transactions.startTime,
    totalCost: transactions.totalCost,
    kwhConsumed: transactions.kwhConsumed,
  })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.status, "COMPLETED"),
      gte(transactions.startTime, since),
    ))
    .orderBy(transactions.startTime);

  // Agrupar por mes
  const monthlyMap: Record<string, MonthlyData> = {};
  for (const tx of allTx) {
    if (!tx.startTime) continue;
    const d = new Date(tx.startTime);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, totalSpent: 0, totalKwh: 0, sessions: 0 };
    }
    monthlyMap[monthKey].totalSpent += Number(tx.totalCost || 0);
    monthlyMap[monthKey].totalKwh += Number(tx.kwhConsumed || 0);
    monthlyMap[monthKey].sessions++;
  }

  return Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calcula la tendencia de consumo usando regresión lineal simple.
 */
export function calculateConsumptionTrend(
  monthlyData: MonthlyData[],
  profile: UserConsumptionProfile
): ConsumptionTrend {
  // Si hay pocos datos, usar el promedio del perfil
  if (monthlyData.length < 2) {
    const avgMonthly = Number(profile.monthlyAvgSpent || 0);
    const avgKwh = Number(profile.monthlyAvgKwh || 0);
    return {
      direction: "STABLE",
      monthlyGrowthRate: 0,
      projectedMonthlySpend: Array(12).fill(avgMonthly),
      projectedMonthlyKwh: Array(12).fill(avgKwh),
      confidence: 20,
    };
  }

  // Regresión lineal sobre los gastos mensuales
  const spendValues = monthlyData.map(m => m.totalSpent);
  const kwhValues = monthlyData.map(m => m.totalKwh);

  const spendRegression = linearRegression(spendValues);
  const kwhRegression = linearRegression(kwhValues);

  // Calcular tasa de crecimiento mensual
  const avgSpend = spendValues.reduce((a, b) => a + b, 0) / spendValues.length;
  const monthlyGrowthRate = avgSpend > 0 ? (spendRegression.slope / avgSpend) * 100 : 0;

  // Determinar dirección
  let direction: "GROWING" | "STABLE" | "DECLINING";
  if (monthlyGrowthRate > 5) direction = "GROWING";
  else if (monthlyGrowthRate < -5) direction = "DECLINING";
  else direction = "STABLE";

  // Proyectar próximos 12 meses
  const n = monthlyData.length;
  const projectedMonthlySpend: number[] = [];
  const projectedMonthlyKwh: number[] = [];

  for (let i = 0; i < 12; i++) {
    const futureIndex = n + i;
    const projSpend = Math.max(0, spendRegression.intercept + spendRegression.slope * futureIndex);
    const projKwh = Math.max(0, kwhRegression.intercept + kwhRegression.slope * futureIndex);
    projectedMonthlySpend.push(projSpend);
    projectedMonthlyKwh.push(projKwh);
  }

  // Confianza basada en cantidad de datos y R²
  const confidence = Math.min(100, Math.round(
    (monthlyData.length / 6) * 50 + // Más meses = más confianza (max 50)
    spendRegression.rSquared * 50     // Mejor ajuste = más confianza (max 50)
  ));

  return {
    direction,
    monthlyGrowthRate,
    projectedMonthlySpend,
    projectedMonthlyKwh,
    confidence,
  };
}

/**
 * Calcula la proyección de ahorro para un tier de suscripción.
 */
function calculateTierProjection(
  tier: string,
  config: { price: number; discount: number; freeReservations: number },
  trend: ConsumptionTrend,
  currentTier: string
): SubscriptionProjection {
  const { price, discount, freeReservations } = config;

  // Calcular para cada período
  const months3 = calculatePeriodProjection(trend, 3, price, discount, freeReservations);
  const months6 = calculatePeriodProjection(trend, 6, price, discount, freeReservations);
  const months12 = calculatePeriodProjection(trend, 12, price, discount, freeReservations);

  // Calcular punto de equilibrio
  let breakEvenMonths: number | null = null;
  if (price > 0) {
    let cumulativeSavings = 0;
    for (let m = 0; m < 24; m++) {
      const monthSpend = trend.projectedMonthlySpend[Math.min(m, 11)];
      const energySavings = monthSpend * discount;
      const reservationSavings = freeReservations * AVG_RESERVATION_VALUE;
      cumulativeSavings += (energySavings + reservationSavings) - price;
      if (cumulativeSavings > 0 && breakEvenMonths === null) {
        breakEvenMonths = m + 1;
      }
    }
  }

  // ROI a 12 meses
  const totalInvestment = price * 12;
  const totalSavings = months12.netSavings;
  const roi12Months = totalInvestment > 0 ? (totalSavings / totalInvestment) * 100 : 0;

  // Determinar si es recomendado
  const isRecommended = months12.netSavings > 0 && (breakEvenMonths === null || breakEvenMonths <= 3);

  let recommendationReason = "";
  if (tier === "FREE") {
    recommendationReason = "Sin costo, pero sin descuentos en energía";
  } else if (isRecommended) {
    recommendationReason = `Ahorro neto de $${Math.round(months12.netSavings).toLocaleString('es-CO')} COP/año`;
    if (breakEvenMonths) {
      recommendationReason += ` (recuperas la inversión en ${breakEvenMonths} meses)`;
    }
  } else if (months12.netSavings > 0) {
    recommendationReason = `Ahorro positivo pero tarda ${breakEvenMonths || '>24'} meses en recuperar inversión`;
  } else {
    recommendationReason = "Tu consumo actual no justifica este tier";
  }

  return {
    tier,
    monthlyPrice: price,
    discountPercent: discount,
    projections: { months3, months6, months12 },
    breakEvenMonths,
    roi12Months,
    isRecommended,
    recommendationReason,
  };
}

function calculatePeriodProjection(
  trend: ConsumptionTrend,
  months: number,
  monthlyPrice: number,
  discount: number,
  freeReservations: number
): ProjectionPeriod {
  let projectedSpending = 0;
  for (let i = 0; i < months; i++) {
    projectedSpending += trend.projectedMonthlySpend[Math.min(i, 11)];
  }

  const energySavings = projectedSpending * discount;
  const reservationSavings = freeReservations * AVG_RESERVATION_VALUE * months;
  const subscriptionCost = monthlyPrice * months;
  const projectedSpendingWithSub = projectedSpending - energySavings;
  const netSavings = energySavings + reservationSavings - subscriptionCost;
  const savingsPercent = projectedSpending > 0
    ? (netSavings / projectedSpending) * 100
    : 0;

  return {
    projectedSpending: Math.round(projectedSpending),
    projectedSpendingWithSub: Math.round(projectedSpendingWithSub),
    subscriptionCost: Math.round(subscriptionCost),
    netSavings: Math.round(netSavings),
    savingsPercent: Math.round(savingsPercent * 100) / 100,
  };
}

function findBestRecommendation(
  projections: SubscriptionProjection[],
  currentTier: string
): { tier: string; reason: string; estimatedAnnualSavings: number } {
  // Encontrar el tier con mayor ahorro neto a 12 meses
  let bestTier = currentTier;
  let bestSavings = 0;
  let bestReason = "Tu suscripción actual es la óptima para tu nivel de consumo";

  for (const proj of projections) {
    if (proj.projections.months12.netSavings > bestSavings) {
      bestTier = proj.tier;
      bestSavings = proj.projections.months12.netSavings;
      bestReason = proj.recommendationReason;
    }
  }

  // Si el mejor es FREE y el usuario ya está en FREE, mantener
  if (bestTier === "FREE" && currentTier === "FREE") {
    bestReason = "Tu consumo actual no justifica una suscripción de pago";
  }

  return {
    tier: bestTier,
    reason: bestReason,
    estimatedAnnualSavings: bestSavings,
  };
}

// ============================================================================
// UTILIDADES MATEMÁTICAS
// ============================================================================

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

/**
 * Regresión lineal simple: y = mx + b
 * x = índice del mes (0, 1, 2, ...)
 * y = valor (gasto o kWh)
 */
export function linearRegression(values: number[]): LinearRegressionResult {
  const n = values.length;
  if (n < 2) {
    return { slope: 0, intercept: values[0] || 0, rSquared: 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R² (coeficiente de determinación)
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, rSquared: Math.max(0, rSquared) };
}
