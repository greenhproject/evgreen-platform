import { describe, expect, it } from "vitest";
import { toIsoDateOrEmpty } from "./date-serialization";

describe("toIsoDateOrEmpty", () => {
  it("serializa Date, texto ISO y timestamp de forma uniforme", () => {
    const expected = "2026-08-24T12:30:00.000Z";
    expect(toIsoDateOrEmpty(new Date(expected))).toBe(expected);
    expect(toIsoDateOrEmpty(expected)).toBe(expected);
    expect(toIsoDateOrEmpty(Date.parse(expected))).toBe(expected);
  });

  it("no falla ante valores ausentes o históricos inválidos", () => {
    expect(toIsoDateOrEmpty(null)).toBe("");
    expect(toIsoDateOrEmpty(undefined)).toBe("");
    expect(toIsoDateOrEmpty("fecha-no-valida")).toBe("");
  });
});
