import { describe, expect, it } from "vitest";
import { optionalFormInteger, optionalFormNumber } from "./space-input-normalization";

describe("normalización de números en edición de espacios", () => {
  it("acepta enteros enviados como texto desde inputs HTML", () => {
    expect(optionalFormInteger().parse("1600")).toBe(1600);
    expect(optionalFormInteger().parse("3")).toBe(3);
  });

  it("conserva cero y trata vacío como opcional", () => {
    expect(optionalFormInteger().parse("0")).toBe(0);
    expect(optionalFormInteger().parse("")).toBeUndefined();
  });

  it("acepta decimales válidos y rechaza texto no numérico", () => {
    expect(optionalFormNumber().parse("112.5")).toBe(112.5);
    expect(() => optionalFormInteger().parse("no-numérico")).toThrow();
  });
});
