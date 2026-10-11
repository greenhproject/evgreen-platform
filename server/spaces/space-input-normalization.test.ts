import { describe, expect, it } from "vitest";
import { optionalFormInteger, optionalFormNumber, optionalLocalizedDecimalString, parseLocalizedNumber } from "./space-input-normalization";

describe("normalización de números en edición de espacios", () => {
  it("acepta enteros enviados como texto desde inputs HTML", () => {
    expect(optionalFormInteger().parse("1600")).toBe(1600);
    expect(optionalFormInteger().parse("3")).toBe(3);
  });

  it("conserva cero y trata vacío como opcional", () => {
    expect(optionalFormInteger().parse("0")).toBe(0);
    expect(optionalFormInteger().parse("")).toBeUndefined();
  });

  it("acepta punto y coma para decimales y agrupadores de miles", () => {
    expect(optionalFormNumber().parse("112,5")).toBe(112.5);
    expect(optionalFormNumber().parse("112.5")).toBe(112.5);
    expect(optionalFormInteger().parse("1.500.000")).toBe(1_500_000);
    expect(optionalFormInteger().parse("1,500,000")).toBe(1_500_000);
    expect(optionalFormInteger().parse("1.100")).toBe(1_100);
    expect(optionalFormInteger().parse("1,100")).toBe(1_100);
    expect(optionalFormNumber().parse("1.500,75")).toBe(1500.75);
    expect(optionalFormNumber().parse("1,500.75")).toBe(1500.75);
  });

  it("rechaza texto o formatos ambiguos antes de persistirlos", () => {
    expect(parseLocalizedNumber("12,00,5")).toBeUndefined();
    expect(() => optionalFormInteger().parse("no-numérico")).toThrow();
    expect(() => optionalFormNumber().parse("12,00,5")).toThrow();
  });

  it("normaliza DECIMAL de Drizzle sin obligar al usuario a escoger punto o coma", () => {
    expect(optionalLocalizedDecimalString().parse("112,5")).toBe("112.5");
    expect(optionalLocalizedDecimalString().parse("1.500,75")).toBe("1500.75");
    expect(optionalLocalizedDecimalString().parse("1,500.75")).toBe("1500.75");
    expect(optionalLocalizedDecimalString().parse(undefined)).toBeUndefined();
    expect(() => optionalLocalizedDecimalString().parse("1,2,3")).toThrow();
  });
});
