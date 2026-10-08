import { afterEach, describe, expect, it } from "vitest";
import { assertSafeRun, chargerUrl, DEFAULT_CONFIG, normalizeTargetUrl } from "./config.mjs";

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

describe("loadtest config", () => {
  it("normaliza el dominio HTTPS al endpoint WebSocket OCPP", () => {
    expect(normalizeTargetUrl("https://staging.evgreen.example")).toBe("wss://staging.evgreen.example/api/ocpp/ws");
    expect(chargerUrl("https://staging.evgreen.example", "LT-S001-C01")).toBe("wss://staging.evgreen.example/api/ocpp/ws/LT-S001-C01");
  });

  it("preserva una ruta OCPP existente", () => {
    expect(normalizeTargetUrl("wss://staging.evgreen.example/ocpp")).toBe("wss://staging.evgreen.example/ocpp");
  });

  it("bloquea ejecuciones sin interruptor explícito", () => {
    expect(() => assertSafeRun({ ...DEFAULT_CONFIG, targetUrl: "wss://staging.evgreen.example/api/ocpp/ws", loadTestEnvironment: "loadtest" }))
      .toThrow("LOAD_TEST_ALLOW_RUN=true");
  });

  it("bloquea producción salvo permiso excepcional explícito", () => {
    const config = {
      ...DEFAULT_CONFIG,
      targetUrl: "wss://app.evgreen.lat/api/ocpp/ws",
      allowRun: true,
      loadTestEnvironment: "loadtest",
    };
    expect(() => assertSafeRun(config)).toThrow("app.evgreen.lat");

    process.env.LOAD_TEST_ALLOW_PRODUCTION = "true";
    expect(() => assertSafeRun(config)).not.toThrow();
  });

  it("acepta una configuración acotada para staging", () => {
    expect(() => assertSafeRun({
      ...DEFAULT_CONFIG,
      targetUrl: "wss://staging.evgreen.example/api/ocpp/ws",
      stationCount: 100,
      chargersPerStation: 4,
      connectorsPerCharger: 2,
      allowRun: true,
      loadTestEnvironment: "loadtest",
    })).not.toThrow();
  });
});
