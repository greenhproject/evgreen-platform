/**
 * Servicio de Perfiles de Consumo
 *
 * Calcula el perfil de hábitos de cada usuario a partir de sus
 * transacciones de carga COMPLETADAS de los últimos 90 días.
 *
 * Principios:
 * 1. SOLO procesa usuarios con consentimiento AI_PROFILING vigente.
 * 2. El LLM nunca ve datos crudos: consume el perfil resumido.
 * 3. Revocación de consentimiento = borrado del perfil (Ley 1581, Art. 8).
 *
 * Ejecución: cron nocturno (3 AM, hora de baja carga) o bajo demanda.
 */

import { and, eq, gte, sql, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  transactions,
  userConsumptionProfile,
  userDataConsents,
  chargingStations,
} from "../../drizzle/schema";
import { summarizeChargingHabits } from "../../shared/charging-habit-policy";
import { isEnabledDatabaseFlag } from "../../shared/database-boolean";

const WINDOW_DAYS = 90;

// ============================================================================
// CONSENTIMIENTO
// ============================================================================

export async function hasActiveConsent(
  userId: number,
  consentType: "AI_PROFILING" | "MARKETING" | "LOCATION_HISTORY"
): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  const [consent] = await database
    .select({ granted: userDataConsents.granted })
    .from(userDataConsents)
    .where(
      and(
        eq(userDataConsents.userId, userId),
        eq(userDataConsents.consentType, consentType)
      )
    )
    .orderBy(desc(userDataConsents.updatedAt))
    .limit(1);

  return isEnabledDatabaseFlag(consent?.granted);
}

export async function grantConsent(params: {
  userId: number;
  consentType: "AI_PROFILING" | "MARKETING" | "LOCATION_HISTORY";
  policyVersion: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  await database.insert(userDataConsents).values({
    userId: params.userId,
    consentType: params.consentType,
    granted: 1,
    policyVersion: params.policyVersion,
    grantedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  } as any);
}

/**
 * Revoca el consentimiento Y BORRA el perfil (derecho de supresión).
 */
export async function revokeConsent(
  userId: number,
  consentType: "AI_PROFILING" | "MARKETING" | "LOCATION_HISTORY"
): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  await database.insert(userDataConsents).values({
    userId,
    consentType,
    granted: 0,
    policyVersion: "revocation",
    revokedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  } as any);

  // Derecho de supresión: al revocar AI_PROFILING, el perfil se elimina.
  if (consentType === "AI_PROFILING") {
    await database
      .delete(userConsumptionProfile)
      .where(eq(userConsumptionProfile.userId, userId));
  }
}

// ============================================================================
// CÁLCULO DEL PERFIL
// ============================================================================

export async function computeProfileForUser(userId: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  // 1. Verificar consentimiento — sin esto, NO se perfila. Punto.
  const consented = await hasActiveConsent(userId, "AI_PROFILING");
  if (!consented) return false;

  // 2. Traer sesiones completadas de la ventana de análisis
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await database
    .select({
      startTime: transactions.startTime,
      kwhConsumed: transactions.kwhConsumed,
      totalCost: transactions.totalCost,
      endTime: transactions.endTime,
      stationId: transactions.stationId,
      stationName: chargingStations.name,
      chargeMode: transactions.chargeMode,
      appliedPricePerKwh: transactions.appliedPricePerKwh,
      stationTimezone: chargingStations.timezone,
    })
    .from(transactions)
    .leftJoin(chargingStations, eq(chargingStations.id, transactions.stationId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "COMPLETED"),
        // @ts-ignore
        gte(transactions.startTime, since)
      )
    );

  if (sessions.length === 0) return false;

  // 3. Distribuciones temporales en la hora local de cada estación.
  // Nunca se usa `Date#getHours()` aquí: ese valor depende del servidor UTC.
  const habitSummary = summarizeChargingHabits(
    sessions.map(session => ({
      startTime: session.startTime,
      timezone: session.stationTimezone,
    }))
  );

  // 4. Promedios de consumo
  const num = (v: string | null) => (v ? parseFloat(v) : 0);
  const totalKwh = sessions.reduce((a, s) => a + num(s.kwhConsumed), 0);
  const totalCost = sessions.reduce((a, s) => a + num(s.totalCost), 0);
  const durations = sessions
    .filter(s => s.endTime && s.startTime)
    // @ts-ignore
    .map(s => (s.endTime!.getTime() - s.startTime.getTime()) / 60000);
  const avgMinutes = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const datedSessions = sessions
    .filter(session => session.startTime)
    .sort(
      (a, b) =>
        new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime()
    );
  const latestSession = datedSessions[0];
  const chargeIntervalsDays = datedSessions
    .slice(1)
    .map(
      (session, index) =>
        (new Date(datedSessions[index].startTime!).getTime() -
          new Date(session.startTime!).getTime()) /
        (24 * 60 * 60 * 1000)
    )
    .filter(interval => Number.isFinite(interval) && interval > 0)
    .slice(0, 10);
  const typicalChargeFrequencyDays = chargeIntervalsDays.length
    ? chargeIntervalsDays.reduce((sum, interval) => sum + interval, 0) /
      chargeIntervalsDays.length
    : null;
  const lastChargeAt = latestSession
    ? new Date(latestSession.endTime ?? latestSession.startTime!)
    : null;
  const nextPredictedChargeAt =
    lastChargeAt && typicalChargeFrequencyDays
      ? new Date(
          lastChargeAt.getTime() +
            typicalChargeFrequencyDays * 24 * 60 * 60 * 1000
        )
      : null;

  const stationVisits = new Map<
    number,
    { name: string; visits: number; lastVisit: Date }
  >();
  for (const session of datedSessions) {
    const visit = stationVisits.get(session.stationId) ?? {
      name: session.stationName ?? `Estación #${session.stationId}`,
      visits: 0,
      lastVisit: new Date(session.startTime!),
    };
    visit.visits += 1;
    if (new Date(session.startTime!).getTime() > visit.lastVisit.getTime()) {
      visit.lastVisit = new Date(session.startTime!);
    }
    stationVisits.set(session.stationId, visit);
  }
  const topStations = [...stationVisits.entries()]
    .sort(
      ([, a], [, b]) =>
        b.visits - a.visits || b.lastVisit.getTime() - a.lastVisit.getTime()
    )
    .slice(0, 3)
    .map(([stationId, visit]) => ({
      stationId,
      name: visit.name,
      visits: visit.visits,
      lastVisit: visit.lastVisit.toISOString(),
    }));

  // 5. Sensibilidad al precio
  const pricedSessions = sessions.filter(s => num(s.appliedPricePerKwh) > 0);
  const avgPrice = pricedSessions.length
    ? pricedSessions.reduce((a, s) => a + num(s.appliedPricePerKwh), 0) /
      pricedSessions.length
    : null;

  // 6. Confianza del perfil
  const confidence = habitSummary.confidence;

  // 7. Upsert del perfil — usa las columnas existentes + las nuevas
  const profileData = {
    // Columnas nuevas (perfilamiento avanzado)
    hourlyDistribution: habitSummary.hourlyDistribution,
    weekdayDistribution: habitSummary.weekdayDistribution,
    habitSlotDistribution: habitSummary.slotDistribution,
    habitTimezone: habitSummary.timezone,
    peakHour: habitSummary.peakHour,
    peakWeekday: habitSummary.peakWeekday,
    sessionsPerWeek: ((sessions.length / WINDOW_DAYS) * 7).toFixed(2),
    priceSensitivity: avgPrice ? "0.300" : null, // placeholder heurístico v1
    avgPricePaidPerKwh: avgPrice?.toFixed(2) ?? null,
    sessionsAnalyzed: sessions.length,
    windowDays: WINDOW_DAYS,
    confidence,
    computedAt: new Date(),
    // Columnas existentes que también actualizamos
    totalSessions: sessions.length,
    totalKwh: totalKwh.toFixed(4),
    totalSpentCop: totalCost.toFixed(2),
    avgKwhPerSession: (totalKwh / sessions.length).toFixed(4),
    avgCostPerSession: (totalCost / sessions.length).toFixed(2),
    avgSessionDurationMin: avgMinutes,
    monthlyAvgSpent: (totalCost / Math.max(1, WINDOW_DAYS / 30)).toFixed(2),
    monthlyAvgKwh: (totalKwh / Math.max(1, WINDOW_DAYS / 30)).toFixed(4),
    monthlyAvgSessions: (
      sessions.length / Math.max(1, WINDOW_DAYS / 30)
    ).toFixed(2),
    topStations,
    lastChargeAt,
    typicalChargeFrequencyDays: typicalChargeFrequencyDays?.toFixed(2) ?? null,
    nextPredictedChargeAt,
    preferredHours: habitSummary.hourlyDistribution
      .map((v: number, i: number) => ({ h: i, c: v }))
      .sort((a: { c: number }, b: { c: number }) => b.c - a.c)
      .slice(0, 3)
      .map((x: { h: number }) => x.h),
    preferredDays: habitSummary.weekdayDistribution
      .map((v: number, i: number) => ({ d: i, c: v }))
      .sort((a: { c: number }, b: { c: number }) => b.c - a.c)
      .slice(0, 3)
      .map((x: { d: number }) => x.d),
  };

  await database
    .insert(userConsumptionProfile)
    .values({
      userId,
      ...profileData,
    } as any)
    .onDuplicateKeyUpdate({
      // @ts-ignore
      set: profileData,
    });

  return true;
}

/**
 * Job nocturno: recalcula perfiles de usuarios activos CON consentimiento.
 * Procesa en lotes para no saturar la BD.
 */
export async function computeAllProfiles(batchSize = 100): Promise<{
  processed: number;
  skippedNoConsent: number;
}> {
  const database = await getDb();
  if (!database) return { processed: 0, skippedNoConsent: 0 };

  // Usuarios con al menos una sesión en la ventana
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const activeUsers = await database
    .selectDistinct({ userId: transactions.userId })
    .from(transactions)
    // @ts-ignore
    .where(gte(transactions.startTime, since));

  let processed = 0;
  let skippedNoConsent = 0;

  for (let i = 0; i < activeUsers.length; i += batchSize) {
    const batch = activeUsers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(u => computeProfileForUser(u.userId))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) processed++;
      else skippedNoConsent++;
    }
  }

  console.log(
    `[Profiles] Perfiles calculados: ${processed}, omitidos (sin consentimiento o sin datos): ${skippedNoConsent}`
  );
  return { processed, skippedNoConsent };
}

// ============================================================================
// CONTEXTO PARA EL LLM
// ============================================================================

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/**
 * Genera el contexto de personalización que se inyecta al prompt del
 * asistente IA. Devuelve null si el usuario no dio consentimiento —
 * en ese caso el asistente funciona en modo genérico.
 *
 * El LLM recibe el RESUMEN, nunca el historial crudo:
 * más barato, más rápido y más respetuoso con la privacidad.
 */
export async function buildPersonalizationContext(
  userId: number
): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;

  const consented = await hasActiveConsent(userId, "AI_PROFILING");
  if (!consented) return null;

  const [profile] = await database
    .select()
    .from(userConsumptionProfile)
    .where(eq(userConsumptionProfile.userId, userId))
    .limit(1);

  // @ts-ignore
  if (!profile || profile.confidence === "LOW") return null;

  const peakDayName = DAY_NAMES[profile.peakWeekday ?? 0];
  const peakHourStr = `${profile.peakHour ?? 0}:00`;
  const topStationsStr = ((profile.topStations as any[]) ?? [])
    .slice(0, 3)
    .map((s: any) => `#${s.stationId ?? s.name ?? "?"}`)
    .join(", ");

  return [
    // @ts-ignore
    `PERFIL DE CONSUMO DEL USUARIO (confianza: ${profile.confidence}, basado en ${profile.sessionsAnalyzed} sesiones de los últimos ${profile.windowDays} días):`,
    `- Suele cargar los ${peakDayName} alrededor de las ${peakHourStr}`,
    `- Frecuencia: ${profile.sessionsPerWeek ?? "?"} cargas/semana, ~${profile.avgKwhPerSession} kWh y ~$${profile.avgCostPerSession} COP por sesión`,
    `- Duración típica: ${profile.avgSessionDurationMin ?? "?"} minutos`,
    `- Estaciones frecuentes: ${topStationsStr || "sin datos suficientes"}`,
    ``,
    `Usa este perfil para personalizar consejos (mejor horario, estación menos congestionada, ahorro estimado). NO inventes datos que no estén aquí. Si la confianza es MEDIUM, presenta los consejos como sugerencias, no certezas.`,
  ].join("\n");
}
