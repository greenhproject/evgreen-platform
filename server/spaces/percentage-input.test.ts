import { describe, expect, it } from "vitest";
import { parseBoundedPercentageInput } from "../../shared/percentage-input";

describe("parseBoundedPercentageInput", () => {
  it("conserva 0 como un porcentaje válido", () => {
    expect(parseBoundedPercentageInput("0", 50)).toBe(0);
    expect(parseBoundedPercentageInput("", 50)).toBe(0);
  });

  it("limita el porcentaje al rango permitido", () => {
    expect(parseBoundedPercentageInput("62", 50)).toBe(50);
    expect(parseBoundedPercentageInput("-4", 50)).toBe(0);
  });

  it("rechaza texto no numérico sin sustituirlo por el valor por defecto", () => {
    expect(parseBoundedPercentageInput("no-numérico", 50)).toBeUndefined();
  });
});
