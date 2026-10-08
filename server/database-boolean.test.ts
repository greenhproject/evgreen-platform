import { describe, expect, it } from "vitest";
import { isEnabledDatabaseFlag } from "../shared/database-boolean";

describe("database boolean flags", () => {
  it("no interpreta la cadena histórica '0' como un opt-in", () => {
    expect(isEnabledDatabaseFlag("0")).toBe(false);
    expect(isEnabledDatabaseFlag(0)).toBe(false);
    expect(isEnabledDatabaseFlag(false)).toBe(false);
  });

  it("acepta los formatos persistentes habilitados", () => {
    expect(isEnabledDatabaseFlag(true)).toBe(true);
    expect(isEnabledDatabaseFlag(1)).toBe(true);
    expect(isEnabledDatabaseFlag("1")).toBe(true);
    expect(isEnabledDatabaseFlag("true")).toBe(true);
  });
});
