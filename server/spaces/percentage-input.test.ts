import { describe, expect, it } from "vitest";
import {
  isNetRevenueDistributionValid,
  parseBoundedPercentageInput,
  parseOptionalBoundedPercentageInput,
} from "../../shared/percentage-input";

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

  it("permite vaciar temporalmente un campo controlado para escribir un valor nuevo", () => {
    expect(parseOptionalBoundedPercentageInput("", 100)).toBeUndefined();
    expect(parseOptionalBoundedPercentageInput("  ", 100)).toBeUndefined();
    expect(parseOptionalBoundedPercentageInput("0", 100)).toBe(0);
    expect(parseOptionalBoundedPercentageInput("60", 100)).toBe(60);
  });

  it("acepta repartos EDS editados que conservan el 100% neto", () => {
    expect(isNetRevenueDistributionValid(60, 40)).toBe(true);
    expect(isNetRevenueDistributionValid(70, 30)).toBe(true);
    expect(isNetRevenueDistributionValid(0, 100)).toBe(true);
    expect(isNetRevenueDistributionValid(60, 30)).toBe(false);
    expect(isNetRevenueDistributionValid(undefined, 40)).toBe(false);
  });
});
