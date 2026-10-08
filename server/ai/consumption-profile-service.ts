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
  userConsumptionProfile,
  type UserConsumptionProfile,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ConsumptionProfileUpdate {
  userId: number;
  transactionId: number;
  stationId: number;
  kwhConsumed: number;
  totalCost: number;
  durationMinutes: number;
  chargeType?: string; // AC or DC
  connectorType?: string; // CCS_2, TYPE_2, etc.
  chargePowerKw?: number;
  startTime: Date;
  endTime: Date;
  hadOverstay: boolean; // Para calcular puntualidad
}

/**
 * Actualiza el perfil de consumo del usuario después de una sesión de carga.
 * Se llama automáticamente desde csms-dual.ts al completar una transacción.
 */
export async function updateConsumptionProfile(
  data: ConsumptionProfileUpdate
): Promise<void> {
  try {
    // La actualización que ocurre al cerrar una carga debe usar exactamente el
    // mismo cálculo consentido, con ventana de 90 días y hora local, que el
    // recálculo manual/nocturno. Así evitamos dos fuentes de verdad de hábitos.
    const { computeProfileForUser } = await import(
      "../profiles/consumption-profile-service"
    );
    const updated = await computeProfileForUser(data.userId);
    console.log(
      `[ConsumptionProfile] ${updated ? "Updated" : "Skipped"} profile for user ${data.userId}`
    );
  } catch (error) {
    console.error(
      `[ConsumptionProfile] Error updating profile for user ${data.userId}:`,
      error
    );
  }
}

/**
 * Obtener el perfil de consumo de un usuario
 */
export async function getConsumptionProfile(
  userId: number
): Promise<UserConsumptionProfile | null> {
  const db = (await getDb())!;
  if (!db) return null;
  const [profile] = await db
    .select()
    .from(userConsumptionProfile)
    .where(eq(userConsumptionProfile.userId, userId))
    .limit(1);
  return profile || null;
}

/**
 * Genera texto de perfil de consumo para inyectar al prompt del LLM
 */
export function formatProfileForLLM(profile: UserConsumptionProfile): string {
  const topStations = (
    typeof profile.topStations === "string"
      ? JSON.parse(profile.topStations)
      : profile.topStations || []
  ) as Array<{ stationId: number; name: string; visits: number }>;

  const preferredHours = (
    typeof profile.preferredHours === "string"
      ? JSON.parse(profile.preferredHours)
      : profile.preferredHours || []
  ) as number[];

  const preferredDays = (
    typeof profile.preferredDays === "string"
      ? JSON.parse(profile.preferredDays)
      : profile.preferredDays || []
  ) as number[];

  const scoreBreakdown = (
    typeof profile.scoreBreakdown === "string"
      ? JSON.parse(profile.scoreBreakdown)
      : profile.scoreBreakdown
  ) as {
    frequency: number;
    spending: number;
    punctuality: number;
    loyalty: number;
  } | null;

  const dayNames = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const daysStr = preferredDays.map(d => dayNames[d] || `Día ${d}`).join(", ");
  const hoursStr = preferredHours.map(h => `${h}:00`).join(", ");
  const stationsStr = topStations
    .map(s => `${s.name} (${s.visits} visitas)`)
    .join(", ");

  let text = `## Perfil de Consumo del Usuario (Aprendizaje Progresivo)
- Sesiones totales: ${profile.totalSessions}
- Energía total: ${Number(profile.totalKwh).toFixed(1)} kWh
- Gasto total: $${Math.round(Number(profile.totalSpentCop)).toLocaleString("es-CO")} COP
- Promedio por carga: ${Number(profile.avgKwhPerSession).toFixed(1)} kWh / $${Math.round(Number(profile.avgCostPerSession)).toLocaleString("es-CO")} COP
- Duración promedio: ${profile.avgSessionDurationMin} minutos
- Gasto mensual promedio: $${Math.round(Number(profile.monthlyAvgSpent)).toLocaleString("es-CO")} COP
- Energía mensual: ${Number(profile.monthlyAvgKwh).toFixed(1)} kWh/mes
- Sesiones mensuales: ${Number(profile.monthlyAvgSessions).toFixed(1)}/mes
`;

  if (hoursStr) text += `- Horarios preferidos de carga: ${hoursStr}\n`;
  if (daysStr) text += `- Días preferidos: ${daysStr}\n`;
  if (stationsStr) text += `- Estaciones favoritas: ${stationsStr}\n`;
  if (profile.preferredChargeType)
    text += `- Tipo de carga preferido: ${profile.preferredChargeType}\n`;
  if (profile.preferredConnectorType)
    text += `- Conector preferido: ${profile.preferredConnectorType}\n`;
  if (Number(profile.avgChargePowerKw) > 0)
    text += `- Potencia promedio: ${Number(profile.avgChargePowerKw).toFixed(0)} kW\n`;

  if (profile.typicalChargeFrequencyDays) {
    const freq = Number(profile.typicalChargeFrequencyDays);
    text += `- Frecuencia típica: cada ${freq.toFixed(1)} días\n`;
  }
  if (profile.nextPredictedChargeAt) {
    const nextDate = new Date(profile.nextPredictedChargeAt);
    const now = new Date();
    const daysUntil = Math.round(
      (nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil > 0) {
      text += `- Próxima carga estimada: en ~${daysUntil} días (${nextDate.toLocaleDateString("es-CO")})\n`;
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

  if (profile.recommendedTier && profile.recommendedTier !== "FREE") {
    text += `- 💡 Suscripción recomendada: ${profile.recommendedTier} (ahorraría ~$${Math.round(Number(profile.estimatedMonthlySavingsWithUpgrade)).toLocaleString("es-CO")} COP/mes)\n`;
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
