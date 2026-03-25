/**
 * Ad Relevance Service — Fase 3 IA Predictiva
 * 
 * Algoritmo de relevancia publicitaria que calcula un score multi-criterio
 * entre cada usuario y cada campaña/banner. Reemplaza el filtrado estático
 * por prioridad con un ranking personalizado basado en:
 * 
 * 1. Matching de perfil de consumo (tipo de carga, gasto, frecuencia)
 * 2. Matching geográfico (estaciones favoritas, ciudad)
 * 3. Matching temporal (horarios preferidos, día de la semana)
 * 4. Matching de suscripción (tier actual vs target)
 * 5. Engagement previo (clicks, vistas, CTR histórico)
 * 6. Frescura de la campaña (penalizar campañas viejas)
 * 
 * El score final (0-100) determina el orden de los banners mostrados.
 */

import { getDb } from "../db";
import {
  banners,
  bannerViews,
  userConsumptionProfile,
  subscriptions,
  type Banner,
  type UserConsumptionProfile,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ============================================================================
// TIPOS
// ============================================================================

export interface AdRelevanceScore {
  bannerId: number;
  totalScore: number;       // 0-100
  breakdown: {
    profileMatch: number;    // 0-25 — matching de perfil de consumo
    geoMatch: number;        // 0-20 — matching geográfico
    temporalMatch: number;   // 0-15 — matching temporal
    subscriptionMatch: number; // 0-15 — matching de suscripción
    engagementScore: number; // 0-15 — engagement previo
    freshnessScore: number;  // 0-10 — frescura de la campaña
  };
  reasons: string[];         // Razones legibles de por qué es relevante
}

export interface UserAdProfile {
  userId: number;
  consumptionProfile: UserConsumptionProfile | null;
  currentSubscriptionTier: string;
  city: string | null;
  role: string;
  currentHour: number;
  currentDayOfWeek: number;
  currentStationId?: number;
}

// ============================================================================
// FUNCIONES EXPORTADAS
// ============================================================================

/**
 * Rankea una lista de banners por relevancia para un usuario específico.
 * Retorna los banners ordenados de mayor a menor relevancia.
 */
export async function rankBannersByRelevance(
  activeBanners: Banner[],
  userProfile: UserAdProfile
): Promise<Array<Banner & { relevanceScore: AdRelevanceScore }>> {
  const db = await getDb();
  if (!db || activeBanners.length === 0) return [];

  // Obtener historial de engagement del usuario con estos banners
  const bannerIds = activeBanners.map(b => b.id);
  const userViews = await db.select()
    .from(bannerViews)
    .where(and(
      eq(bannerViews.userId, userProfile.userId),
    ));

  // Crear mapa de engagement por banner
  const engagementMap: Record<number, { views: number; clicks: number }> = {};
  for (const view of userViews) {
    if (!engagementMap[view.bannerId]) {
      engagementMap[view.bannerId] = { views: 0, clicks: 0 };
    }
    engagementMap[view.bannerId].views++;
    if (view.clicked) engagementMap[view.bannerId].clicks++;
  }

  // Calcular score de relevancia para cada banner
  const scoredBanners = activeBanners.map(banner => {
    const score = calculateRelevanceScore(banner, userProfile, engagementMap[banner.id]);
    return { ...banner, relevanceScore: score };
  });

  // Ordenar por score total descendente, con prioridad estática como desempate
  scoredBanners.sort((a, b) => {
    const scoreDiff = b.relevanceScore.totalScore - a.relevanceScore.totalScore;
    if (Math.abs(scoreDiff) < 5) {
      // Si los scores son muy similares, usar prioridad estática como desempate
      return b.priority - a.priority;
    }
    return scoreDiff;
  });

  return scoredBanners;
}

/**
 * Calcula el score de relevancia de un banner para un usuario.
 */
export function calculateRelevanceScore(
  banner: Banner,
  userProfile: UserAdProfile,
  engagement?: { views: number; clicks: number }
): AdRelevanceScore {
  const breakdown = {
    profileMatch: 0,
    geoMatch: 0,
    temporalMatch: 0,
    subscriptionMatch: 0,
    engagementScore: 0,
    freshnessScore: 0,
  };
  const reasons: string[] = [];

  // 1. Profile Match (0-25)
  breakdown.profileMatch = calculateProfileMatch(banner, userProfile, reasons);

  // 2. Geo Match (0-20)
  breakdown.geoMatch = calculateGeoMatch(banner, userProfile, reasons);

  // 3. Temporal Match (0-15)
  breakdown.temporalMatch = calculateTemporalMatch(banner, userProfile, reasons);

  // 4. Subscription Match (0-15)
  breakdown.subscriptionMatch = calculateSubscriptionMatch(banner, userProfile, reasons);

  // 5. Engagement Score (0-15)
  breakdown.engagementScore = calculateEngagementScore(banner, engagement, reasons);

  // 6. Freshness Score (0-10)
  breakdown.freshnessScore = calculateFreshnessScore(banner, reasons);

  const totalScore = Math.min(100, Math.round(
    breakdown.profileMatch +
    breakdown.geoMatch +
    breakdown.temporalMatch +
    breakdown.subscriptionMatch +
    breakdown.engagementScore +
    breakdown.freshnessScore
  ));

  return {
    bannerId: banner.id,
    totalScore,
    breakdown,
    reasons,
  };
}

// ============================================================================
// FUNCIONES DE SCORING INDIVIDUAL
// ============================================================================

/**
 * Profile Match (0-25): Qué tanto el banner coincide con el perfil de consumo del usuario.
 */
function calculateProfileMatch(
  banner: Banner,
  userProfile: UserAdProfile,
  reasons: string[]
): number {
  let score = 0;
  const profile = userProfile.consumptionProfile;

  if (!profile) {
    // Sin perfil de consumo, dar score base por tipo de banner
    if (banner.type === "PROMOTIONAL") score += 10; // Promociones son genéricas
    if (banner.type === "INFORMATIONAL") score += 8;
    return Math.min(25, score);
  }

  // Matching por nivel de gasto
  const monthlySpent = Number(profile.monthlyAvgSpent || 0);
  const bannerMeta = parseBannerMetadata(banner);

  if (bannerMeta.targetSpendingMin !== null || bannerMeta.targetSpendingMax !== null) {
    const min = bannerMeta.targetSpendingMin ?? 0;
    const max = bannerMeta.targetSpendingMax ?? Infinity;
    if (monthlySpent >= min && monthlySpent <= max) {
      score += 10;
      reasons.push("Gasto mensual coincide con el rango objetivo");
    } else {
      // Penalizar si está fuera del rango
      score += 2;
    }
  } else {
    // Sin targeting de gasto = neutral
    score += 5;
  }

  // Matching por frecuencia de carga
  const monthlySessions = Number(profile.monthlyAvgSessions || 0);
  if (bannerMeta.targetFrequencyMin !== null) {
    if (monthlySessions >= (bannerMeta.targetFrequencyMin ?? 0)) {
      score += 8;
      reasons.push("Frecuencia de carga coincide con el perfil objetivo");
    } else {
      score += 2;
    }
  } else {
    score += 4;
  }

  // Matching por tipo de carga preferido
  if (bannerMeta.targetChargeType && profile.preferredChargeType) {
    if (bannerMeta.targetChargeType === profile.preferredChargeType) {
      score += 7;
      reasons.push(`Tipo de carga preferido (${profile.preferredChargeType}) coincide`);
    } else {
      score += 2;
    }
  } else {
    score += 3;
  }

  return Math.min(25, score);
}

/**
 * Geo Match (0-20): Qué tanto el banner coincide con la ubicación del usuario.
 */
function calculateGeoMatch(
  banner: Banner,
  userProfile: UserAdProfile,
  reasons: string[]
): number {
  let score = 0;

  // Matching por ciudad
  const targetCities = banner.targetCities as string[] | null;
  if (targetCities && Array.isArray(targetCities) && targetCities.length > 0) {
    if (userProfile.city) {
      const userCityLower = userProfile.city.toLowerCase();
      const cityMatch = targetCities.some(c => c.toLowerCase() === userCityLower);
      if (cityMatch) {
        score += 12;
        reasons.push(`Ciudad del usuario (${userProfile.city}) coincide con targeting`);
      }
    }
  } else {
    // Sin targeting de ciudad = score base
    score += 6;
  }

  // Matching por estación actual
  const targetStations = (banner as any).targetStations as number[] | null;
  if (targetStations && Array.isArray(targetStations) && targetStations.length > 0) {
    if (userProfile.currentStationId && targetStations.includes(userProfile.currentStationId)) {
      score += 8;
      reasons.push("Usuario está en una estación objetivo de la campaña");
    }
  } else {
    score += 4;
  }

  // Matching por estaciones favoritas del perfil de consumo
  if (userProfile.consumptionProfile?.topStations) {
    const topStations = (typeof userProfile.consumptionProfile.topStations === 'string'
      ? JSON.parse(userProfile.consumptionProfile.topStations)
      : userProfile.consumptionProfile.topStations) as Array<{ stationId: number }>;
    
    if (targetStations && topStations.length > 0) {
      const favMatch = topStations.some(ts => targetStations.includes(ts.stationId));
      if (favMatch) {
        score += 4;
        reasons.push("Banner incluye una estación favorita del usuario");
      }
    }
  }

  return Math.min(20, score);
}

/**
 * Temporal Match (0-15): Qué tanto el banner es relevante en el momento actual.
 */
function calculateTemporalMatch(
  banner: Banner,
  userProfile: UserAdProfile,
  reasons: string[]
): number {
  let score = 5; // Base score

  const profile = userProfile.consumptionProfile;
  if (!profile) return score;

  // Si el usuario suele cargar a esta hora, los banners de carga son más relevantes
  const preferredHours = (typeof profile.preferredHours === 'string'
    ? JSON.parse(profile.preferredHours)
    : profile.preferredHours || []) as number[];

  if (preferredHours.includes(userProfile.currentHour)) {
    if (banner.type === "CHARGING" || banner.type === "PROMOTIONAL") {
      score += 5;
      reasons.push("Es la hora habitual de carga del usuario");
    }
  }

  // Si el usuario suele cargar este día de la semana
  const preferredDays = (typeof profile.preferredDays === 'string'
    ? JSON.parse(profile.preferredDays)
    : profile.preferredDays || []) as number[];

  if (preferredDays.includes(userProfile.currentDayOfWeek)) {
    score += 5;
    reasons.push("Es un día habitual de carga del usuario");
  }

  return Math.min(15, score);
}

/**
 * Subscription Match (0-15): Qué tanto el banner es relevante para el tier de suscripción.
 */
function calculateSubscriptionMatch(
  banner: Banner,
  userProfile: UserAdProfile,
  reasons: string[]
): number {
  let score = 5; // Base score

  const targetTiers = banner.targetSubscriptionTiers as string[] | null;
  if (targetTiers && Array.isArray(targetTiers) && targetTiers.length > 0) {
    if (targetTiers.includes(userProfile.currentSubscriptionTier)) {
      score += 10;
      reasons.push(`Suscripción del usuario (${userProfile.currentSubscriptionTier}) coincide con targeting`);
    } else {
      // Si el banner es para un tier superior y el perfil sugiere upgrade, es relevante
      const profile = userProfile.consumptionProfile;
      if (profile?.recommendedTier && targetTiers.includes(profile.recommendedTier)) {
        score += 7;
        reasons.push("Banner promueve la suscripción recomendada para el usuario");
      }
    }
  } else {
    score += 5; // Sin targeting = neutral
  }

  return Math.min(15, score);
}

/**
 * Engagement Score (0-15): Basado en el historial de interacción del usuario con el banner.
 * - Si ya lo vio muchas veces sin clickear → penalizar (fatiga)
 * - Si tiene buen CTR → mantener
 * - Si nunca lo ha visto → bonus de novedad
 */
function calculateEngagementScore(
  banner: Banner,
  engagement?: { views: number; clicks: number },
  reasons?: string[]
): number {
  if (!engagement) {
    // Nunca visto = bonus de novedad
    if (reasons) reasons.push("Banner nuevo para el usuario");
    return 12;
  }

  const { views, clicks } = engagement;

  // Si ya lo vio demasiadas veces sin clickear → fatiga publicitaria
  if (views > 10 && clicks === 0) {
    return 2; // Muy baja relevancia
  }

  if (views > 5 && clicks === 0) {
    return 5; // Baja relevancia
  }

  // CTR del usuario con este banner
  const ctr = views > 0 ? clicks / views : 0;

  if (ctr > 0.1) {
    // Buen CTR → el usuario interactúa con este tipo de contenido
    if (reasons) reasons.push("El usuario ha mostrado interés en este banner");
    return 15;
  }

  if (clicks > 0) {
    if (reasons) reasons.push("El usuario ha clickeado este banner antes");
    return 10;
  }

  // Pocas vistas, sin clicks → neutral
  return 7;
}

/**
 * Freshness Score (0-10): Campañas más nuevas tienen prioridad.
 */
function calculateFreshnessScore(
  banner: Banner,
  reasons?: string[]
): number {
  const now = new Date();
  const createdAt = new Date(banner.createdAt);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < 1) {
    if (reasons) reasons.push("Campaña nueva (menos de 24h)");
    return 10;
  }
  if (ageInDays < 7) {
    return 8;
  }
  if (ageInDays < 30) {
    return 6;
  }
  if (ageInDays < 90) {
    return 4;
  }
  return 2; // Campaña vieja
}

// ============================================================================
// HELPERS
// ============================================================================

interface BannerMetadata {
  targetSpendingMin: number | null;
  targetSpendingMax: number | null;
  targetFrequencyMin: number | null;
  targetChargeType: string | null;
  targetVehicleBrands: string[] | null;
}

/**
 * Parsea metadata extendida del banner desde el campo description (JSON embebido)
 * o desde campos futuros de targeting avanzado.
 * 
 * Formato esperado en description (opcional):
 * <!-- targeting: {"spendingMin": 100000, "spendingMax": 500000, "frequencyMin": 5, "chargeType": "DC"} -->
 */
function parseBannerMetadata(banner: Banner): BannerMetadata {
  const defaults: BannerMetadata = {
    targetSpendingMin: null,
    targetSpendingMax: null,
    targetFrequencyMin: null,
    targetChargeType: null,
    targetVehicleBrands: null,
  };

  if (!banner.description) return defaults;

  try {
    // Buscar JSON embebido en comentario HTML
    const match = banner.description.match(/<!--\s*targeting:\s*(\{.*?\})\s*-->/);
    if (match) {
      const targeting = JSON.parse(match[1]);
      return {
        targetSpendingMin: targeting.spendingMin ?? null,
        targetSpendingMax: targeting.spendingMax ?? null,
        targetFrequencyMin: targeting.frequencyMin ?? null,
        targetChargeType: targeting.chargeType ?? null,
        targetVehicleBrands: targeting.vehicleBrands ?? null,
      };
    }
  } catch (_) {
    // Ignore parse errors
  }

  return defaults;
}

/**
 * Obtiene el perfil de ad del usuario para el ranking de relevancia.
 */
export async function getUserAdProfile(
  userId: number,
  options?: { city?: string; stationId?: number; role?: string }
): Promise<UserAdProfile> {
  const db = await getDb();
  const now = new Date();

  let consumptionProfile: UserConsumptionProfile | null = null;
  let currentSubscriptionTier = "FREE";

  if (db) {
    // Obtener perfil de consumo
    const [profile] = await db.select()
      .from(userConsumptionProfile)
      .where(eq(userConsumptionProfile.userId, userId))
      .limit(1);
    consumptionProfile = profile || null;

    // Obtener suscripción activa
    const [sub] = await db.select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.isActive, true),
      ))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    if (sub) {
      currentSubscriptionTier = sub.tier;
    }
  }

  return {
    userId,
    consumptionProfile,
    currentSubscriptionTier,
    city: options?.city || null,
    role: options?.role || "user",
    currentHour: now.getHours(),
    currentDayOfWeek: now.getDay(),
    currentStationId: options?.stationId,
  };
}
