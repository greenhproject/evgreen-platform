import {
  getStationDateTimeParts,
  normalizeStationTimezone,
} from "./station-timezone";

export const HABIT_ANALYSIS_WINDOW_DAYS = 90;
export const MIN_HABIT_SESSIONS = 5;
export const HABIT_TIME_WINDOW_HOURS = 1;
export const MIN_HABIT_SLOT_SHARE = 0.25;

export type ChargingHabitSlot = {
  weekday: number;
  hour: number;
  count: number;
  share: number;
};

export type ChargingHabitSummary = {
  timezone: string;
  sessionsAnalyzed: number;
  weekdayDistribution: number[];
  hourlyDistribution: number[];
  slotDistribution: ChargingHabitSlot[];
  peakWeekday: number | null;
  peakHour: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type ChargingHabitSample = {
  startTime: Date | string | number | null | undefined;
  timezone?: string | null;
};

function emptyDistribution(length: number): number[] {
  return Array.from({ length }, () => 0);
}

function profileConfidence(
  totalSessions: number
): ChargingHabitSummary["confidence"] {
  if (totalSessions >= 20) return "HIGH";
  if (totalSessions >= MIN_HABIT_SESSIONS) return "MEDIUM";
  return "LOW";
}

/**
 * Agrupa sesiones por hora y día locales de la estación, no por reloj UTC del
 * servidor. Esto conserva correctamente las rutinas que cruzan medianoche.
 */
export function summarizeChargingHabits(
  samples: ChargingHabitSample[],
  fallbackTimezone = "America/Bogota"
): ChargingHabitSummary {
  const timezone = normalizeStationTimezone(fallbackTimezone);
  const weekdayDistribution = emptyDistribution(7);
  const hourlyDistribution = emptyDistribution(24);
  const slots = new Map<string, ChargingHabitSlot>();
  let sessionsAnalyzed = 0;

  for (const sample of samples) {
    if (!sample.startTime) continue;
    const parts = getStationDateTimeParts(
      sample.startTime,
      sample.timezone ?? timezone
    );
    const weekday = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day)
    ).getUTCDay();
    if (!Number.isInteger(weekday) || !Number.isInteger(parts.hour)) continue;

    sessionsAnalyzed += 1;
    weekdayDistribution[weekday] += 1;
    hourlyDistribution[parts.hour] += 1;
    const key = `${weekday}:${parts.hour}`;
    const current = slots.get(key) ?? {
      weekday,
      hour: parts.hour,
      count: 0,
      share: 0,
    };
    current.count += 1;
    slots.set(key, current);
  }

  const slotDistribution = [...slots.values()]
    .map(slot => ({
      ...slot,
      share: sessionsAnalyzed ? slot.count / sessionsAnalyzed : 0,
    }))
    .sort(
      (a, b) => b.count - a.count || a.weekday - b.weekday || a.hour - b.hour
    );

  const peak = slotDistribution[0] ?? null;
  return {
    timezone,
    sessionsAnalyzed,
    weekdayDistribution,
    hourlyDistribution,
    slotDistribution,
    peakWeekday: peak?.weekday ?? null,
    peakHour: peak?.hour ?? null,
    confidence: profileConfidence(sessionsAnalyzed),
  };
}

export function selectReminderHabitSlot(
  summary: ChargingHabitSummary,
  current: { weekday: number; hour: number }
): ChargingHabitSlot | null {
  if (
    summary.sessionsAnalyzed < MIN_HABIT_SESSIONS ||
    summary.confidence === "LOW"
  )
    return null;

  const matching = summary.slotDistribution.find(
    slot =>
      slot.weekday === current.weekday &&
      Math.abs(slot.hour - current.hour) <= HABIT_TIME_WINDOW_HOURS &&
      slot.share >= MIN_HABIT_SLOT_SHARE
  );

  return matching ?? null;
}

export function displayHabitTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
