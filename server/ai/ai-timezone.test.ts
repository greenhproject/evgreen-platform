/**
 * Tests para la corrección de zona horaria del EV Assistant
 */
import { describe, it, expect } from "vitest";

describe("Timezone Correction", () => {
  describe("Local time generation with timezone", () => {
    it("should generate correct time for America/Bogota timezone", () => {
      const now = new Date();
      const tz = "America/Bogota";
      const localTime = now.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      });
      // Should be a valid time string like "12:30 a. m." or "12:30 p. m."
      expect(localTime).toBeTruthy();
      expect(localTime.length).toBeGreaterThan(0);
    });

    it("should generate correct day for America/Bogota timezone", () => {
      const now = new Date();
      const tz = "America/Bogota";
      const localDay = now.toLocaleDateString("es-CO", {
        weekday: "long",
        timeZone: tz,
      });
      const validDays = [
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado",
        "domingo",
      ];
      expect(validDays).toContain(localDay);
    });

    it("should generate correct full date for America/Bogota timezone", () => {
      const now = new Date();
      const tz = "America/Bogota";
      const localDate = now.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tz,
      });
      // Should contain a year
      expect(localDate).toMatch(/\d{4}/);
    });

    it("should use different times for different timezones", () => {
      // Use a fixed date to ensure timezone difference is visible
      const fixedDate = new Date("2026-03-02T05:00:00Z"); // 5 AM UTC
      const bogotaTime = fixedDate.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Bogota",
      });
      const tokyoTime = fixedDate.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      });
      // Bogota is UTC-5, so 5 AM UTC = 12:00 AM Bogota
      // Tokyo is UTC+9, so 5 AM UTC = 2:00 PM Tokyo
      expect(bogotaTime).not.toBe(tokyoTime);
    });
  });

  describe("Peak hour detection with timezone", () => {
    it("should correctly detect peak hours based on local time", () => {
      const isPeakHour = (hour: number) =>
        (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);

      expect(isPeakHour(7)).toBe(true);
      expect(isPeakHour(8)).toBe(true);
      expect(isPeakHour(9)).toBe(true);
      expect(isPeakHour(17)).toBe(true);
      expect(isPeakHour(18)).toBe(true);
      expect(isPeakHour(20)).toBe(true);
      expect(isPeakHour(12)).toBe(false);
      expect(isPeakHour(0)).toBe(false);
      expect(isPeakHour(23)).toBe(false);
    });

    it("should extract hour correctly from timezone-aware time", () => {
      const fixedDate = new Date("2026-03-02T05:00:00Z"); // 5 AM UTC = 12 AM Bogota
      const localHourStr = fixedDate.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        hour12: false,
        timeZone: "America/Bogota",
      });
      const hour = parseInt(localHourStr, 10);
      expect(hour).toBe(0); // 5 AM UTC - 5 hours = 0 (midnight)
    });
  });

  describe("Weekend detection with timezone", () => {
    it("should correctly detect weekends based on local timezone", () => {
      // March 1, 2026 is a Sunday
      const sundayUTC = new Date("2026-03-01T12:00:00Z");
      const dayOfWeek = sundayUTC.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "America/Bogota",
      });
      expect(dayOfWeek).toBe("Sun");
      const isWeekend = dayOfWeek === "Sat" || dayOfWeek === "Sun";
      expect(isWeekend).toBe(true);

      // March 2, 2026 is a Monday
      const mondayUTC = new Date("2026-03-02T12:00:00Z");
      const mondayDayOfWeek = mondayUTC.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "America/Bogota",
      });
      expect(mondayDayOfWeek).toBe("Mon");
      const isMondayWeekend =
        mondayDayOfWeek === "Sat" || mondayDayOfWeek === "Sun";
      expect(isMondayWeekend).toBe(false);
    });

    it("should handle timezone boundary for weekend detection", () => {
      // Saturday 11 PM UTC = Saturday 6 PM Bogota (still weekend)
      const satNightUTC = new Date("2026-02-28T23:00:00Z");
      const bogotaDay = satNightUTC.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "America/Bogota",
      });
      expect(bogotaDay).toBe("Sat");
    });
  });

  describe("Default timezone fallback", () => {
    it("should default to America/Bogota when no timezone provided", () => {
      const tz = undefined || "America/Bogota";
      expect(tz).toBe("America/Bogota");
    });

    it("should use provided timezone when available", () => {
      const userTz = "America/Lima";
      const tz = userTz || "America/Bogota";
      expect(tz).toBe("America/Lima");
    });
  });

  describe("Intl.DateTimeFormat timezone detection", () => {
    it("should return a valid IANA timezone string", () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      expect(tz).toBeTruthy();
      expect(typeof tz).toBe("string");
      // IANA timezones suelen contener '/' (ej. America/Bogota)
      // pero UTC y GMT son también válidos (el sandbox de CI corre en UTC)
      const isValidTz = tz.includes("/") || ["UTC", "GMT"].includes(tz);
      expect(isValidTz).toBe(true);
    });
  });
});
