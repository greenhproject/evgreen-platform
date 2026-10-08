import { describe, expect, it } from "vitest";
import {
  displayHabitTime,
  selectReminderHabitSlot,
  summarizeChargingHabits,
} from "../shared/charging-habit-policy";

describe("charging habit policy", () => {
  it("agrupa las sesiones por día y hora de Colombia, no por UTC", () => {
    const summary = summarizeChargingHabits([
      // 03:10 UTC del miércoles equivale a 22:10 del martes en Bogotá.
      { startTime: "2026-10-07T03:10:00.000Z", timezone: "America/Bogota" },
      { startTime: "2026-10-14T03:05:00.000Z", timezone: "America/Bogota" },
      { startTime: "2026-10-21T03:30:00.000Z", timezone: "America/Bogota" },
      { startTime: "2026-10-28T03:20:00.000Z", timezone: "America/Bogota" },
      { startTime: "2026-11-04T03:15:00.000Z", timezone: "America/Bogota" },
    ]);

    expect(summary.sessionsAnalyzed).toBe(5);
    expect(summary.peakWeekday).toBe(2); // martes
    expect(summary.peakHour).toBe(22);
    expect(summary.slotDistribution[0]).toMatchObject({
      weekday: 2,
      hour: 22,
      count: 5,
      share: 1,
    });
  });

  it("sólo permite el recordatorio en la misma franja semanal", () => {
    const summary = summarizeChargingHabits([
      { startTime: "2026-10-07T03:10:00.000Z" },
      { startTime: "2026-10-14T03:10:00.000Z" },
      { startTime: "2026-10-21T03:10:00.000Z" },
      { startTime: "2026-10-28T03:10:00.000Z" },
      { startTime: "2026-11-04T03:10:00.000Z" },
    ]);

    expect(
      selectReminderHabitSlot(summary, { weekday: 2, hour: 23 })
    ).toMatchObject({ weekday: 2, hour: 22 });
    expect(
      selectReminderHabitSlot(summary, { weekday: 3, hour: 22 })
    ).toBeNull();
    expect(displayHabitTime(3)).toBe("03:00");
  });
});
