import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAcTelemetryState } from "./ac-telemetry-watchdog";

const NOW = new Date("2026-10-21T03:00:00.000Z");

describe("resolveAcTelemetryState", () => {
  it("mantiene período de gracia al iniciar una carga AC sin una primera lectura", () => {
    const result = resolveAcTelemetryState({
      startedAt: "2026-10-21T02:57:00.000Z",
      lastMeterAt: null,
    }, NOW);
    expect(result.state).toBe("GRACE");
  });

  it("abre advertencia después de diez minutos sin una lectura", () => {
    const result = resolveAcTelemetryState({
      startedAt: "2026-10-21T02:48:00.000Z",
      lastMeterAt: null,
    }, NOW);
    expect(result.state).toBe("WARNING");
    expect(result.staleForMs).toBe(12 * 60_000);
  });

  it("escala a crítica después de treinta minutos sin telemetría", () => {
    const result = resolveAcTelemetryState({
      startedAt: "2026-10-21T02:00:00.000Z",
      lastMeterAt: "2026-10-21T02:25:00.000Z",
    }, NOW);
    expect(result.state).toBe("CRITICAL");
  });

  it("considera fresca una sesión cuando llega una lectura OCPP reciente", () => {
    const result = resolveAcTelemetryState({
      startedAt: "2026-10-21T02:00:00.000Z",
      lastMeterAt: "2026-10-21T02:56:00.000Z",
    }, NOW);
    expect(result.state).toBe("FRESH");
  });

  it("se ejecuta mediante Heartbeat durable y no con un timer efímero", () => {
    const indexSource = fs.readFileSync(path.resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(indexSource).toContain("/api/scheduled/ac-telemetry-watchdog");
    expect(indexSource).toContain('name: "evgreen-ac-telemetry-watchdog"');
    expect(indexSource).toContain("runAcTelemetryWatchdog");
  });
});
