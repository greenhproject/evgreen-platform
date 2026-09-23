import { describe, expect, it } from "vitest";
import {
  formatStationDate,
  formatStationDateTime,
  formatStationTime,
  stationLocalDateTimeToUtc,
} from "../../shared/station-timezone";

describe("station timezone policy", () => {
  it("persists a Bogotá booking selected at 21:25 as its correct UTC instant", () => {
    const instant = stationLocalDateTimeToUtc("2026-09-22", "21:25", "America/Bogota");

    expect(instant.toISOString()).toBe("2026-09-23T02:25:00.000Z");
    expect(formatStationDate(instant, "America/Bogota")).toBe("2026-09-22");
    expect(formatStationTime(instant, "America/Bogota")).toBe("21:25");
  });

  it("formats each reservation in the station zone rather than the device zone", () => {
    const instant = new Date("2026-09-23T02:25:00.000Z");
    const formatted = formatStationDateTime(instant, "America/Bogota", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(formatted).toContain("21:25");
    expect(formatted).not.toMatch(/a\.?\s*m\.?|p\.?\s*m\.?/i);
  });

  it("falls back to Bogotá when a station has no valid IANA zone", () => {
    const instant = stationLocalDateTimeToUtc("2026-09-22", "21:25", "not/a-zone");
    expect(instant.toISOString()).toBe("2026-09-23T02:25:00.000Z");
  });
});
