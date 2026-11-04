import { describe, expect, it } from "vitest";
import { toIsoDateOrEmpty } from "./date-serialization";

describe("toIsoDateOrEmpty", () => {
  it("serializa Date, texto ISO y timestamp de forma uniforme", () => {
    const expected = "2026-08-24T12:30:00.000Z";
    expect(toIsoDateOrEmpty(new Date(expected))).toBe(expected);
    expect(toIsoDateOrEmpty(expected)).toBe(expected);
    expect(toIsoDateOrEmpty(Date.parse(expected))).toBe(expected);
  });

  it("interpreta TIMESTAMP SQL/ISO sin zona como UTC aunque el proceso use otra zona", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "America/Bogota";
      expect(toIsoDateOrEmpty("2026-11-04 08:26:17")).toBe("2026-11-04T08:26:17.000Z");
      expect(toIsoDateOrEmpty(" 2026-11-04T08:26:17.123 ")).toBe("2026-11-04T08:26:17.123Z");
      expect(toIsoDateOrEmpty("2026-11-04T03:26:17-05:00")).toBe("2026-11-04T08:26:17.000Z");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("no falla ante valores ausentes o históricos inválidos", () => {
    expect(toIsoDateOrEmpty(null)).toBe("");
    expect(toIsoDateOrEmpty(undefined)).toBe("");
    expect(toIsoDateOrEmpty("fecha-no-valida")).toBe("");
    expect(toIsoDateOrEmpty("   ")).toBe("");
    expect(toIsoDateOrEmpty(new Date(NaN))).toBe("");
  });
});
