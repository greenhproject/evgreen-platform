import { describe, expect, it } from "vitest";
import {
  estimatePowerFromEnergySamples,
  formatTelemetryAge,
  resolveChargingTelemetryFreshness,
  shouldAdvanceTelemetrySample,
} from "../../shared/charging-telemetry";

describe("telemetría autoritativa de carga", () => {
  it("calcula potencia con los timestamps OCPP aunque las lecturas lleguen juntas después de una reconexión", () => {
    const power = estimatePowerFromEnergySamples({
      previousEnergyKwh: 3310.232,
      currentEnergyKwh: 3310.718,
      previousSampleAt: "2026-09-06T22:38:27Z",
      currentSampleAt: "2026-09-06T22:43:27Z",
    });
    expect(power).toBeCloseTo(5.832, 3);
  });

  it("rechaza deltas con timestamps fuera de orden o energía regresiva", () => {
    expect(estimatePowerFromEnergySamples({
      previousEnergyKwh: 10,
      currentEnergyKwh: 9,
      previousSampleAt: 1_000,
      currentSampleAt: 2_000,
    })).toBeNull();
    expect(estimatePowerFromEnergySamples({
      previousEnergyKwh: 9,
      currentEnergyKwh: 10,
      previousSampleAt: 2_000,
      currentSampleAt: 1_000,
    })).toBeNull();
  });

  it("distingue telemetría vigente, retrasada, obsoleta y ausente", () => {
    const now = "2026-09-06T23:30:00Z";
    expect(resolveChargingTelemetryFreshness({ sampleAt: "2026-09-06T23:25:00Z", now }).status).toBe("live");
    expect(resolveChargingTelemetryFreshness({ sampleAt: "2026-09-06T23:20:00Z", now }).status).toBe("delayed");
    expect(resolveChargingTelemetryFreshness({ sampleAt: "2026-09-06T22:43:27Z", now }).status).toBe("stale");
    expect(resolveChargingTelemetryFreshness({ sampleAt: null, now }).status).toBe("unavailable");
  });

  it("formatea la antigüedad de la lectura para móvil", () => {
    expect(formatTelemetryAge(null)).toBe("sin lecturas");
    expect(formatTelemetryAge(35)).toBe("hace menos de 1 min");
    expect(formatTelemetryAge(610)).toBe("hace 10 min");
    expect(formatTelemetryAge(4_260)).toBe("hace 1 h 11 min");
  });

  it("solo permite avanzar el estado actual con una muestra OCPP estrictamente más reciente", () => {
    const current = "2026-09-06T23:44:06Z";
    expect(shouldAdvanceTelemetrySample(current, "2026-09-06T23:49:06Z")).toBe(true);
    expect(shouldAdvanceTelemetrySample(current, current)).toBe(false);
    expect(shouldAdvanceTelemetrySample(current, "2026-09-06T23:39:06Z")).toBe(false);
    expect(shouldAdvanceTelemetrySample(null, current)).toBe(true);
  });
});
