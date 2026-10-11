import { describe, expect, it } from "vitest";
import { hasIsolatedTestDatabase } from "./database-mutation-guard";

describe("guardia de mutaciones de base de datos en pruebas", () => {
  it("bloquea una prueba mutable sin base aislada", () => {
    expect(hasIsolatedTestDatabase({
      VITEST: "true",
      DATABASE_URL: "mysql://production.example/evgreen",
    })).toBe(false);
  });

  it("bloquea una URL de prueba idéntica a la base operativa", () => {
    expect(hasIsolatedTestDatabase({
      VITEST: "true",
      DATABASE_URL: "mysql://same.example/evgreen",
      TEST_DATABASE_URL: "mysql://same.example/evgreen",
    })).toBe(false);
  });

  it("permite integración mutable sólo con una base explícitamente distinta", () => {
    expect(hasIsolatedTestDatabase({
      VITEST: "true",
      DATABASE_URL: "mysql://production.example/evgreen",
      TEST_DATABASE_URL: "mysql://testing.example/evgreen_test",
    })).toBe(true);
  });

  it("no se habilita fuera de Vitest", () => {
    expect(hasIsolatedTestDatabase({
      DATABASE_URL: "mysql://production.example/evgreen",
      TEST_DATABASE_URL: "mysql://testing.example/evgreen_test",
    })).toBe(false);
  });
});
