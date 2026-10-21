import { describe, expect, it } from "vitest";
import {
  buildPowerHistoryFromMeterValues,
  estimatePowerFromEnergySamples,
  formatTelemetryAge,
  resolveBillableEnergyKwh,
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

  it("reconstruye la potencia para cargadores que solo reportan energía acumulada", () => {
    const history = buildPowerHistoryFromMeterValues([
      { timestamp: "2026-10-09T02:29:07Z", energyKwh: "3536.2640", powerKw: null },
      { timestamp: "2026-10-09T02:34:08Z", energyKwh: "3536.6380", powerKw: null },
      { timestamp: "2026-10-09T02:39:08Z", energyKwh: "3537.0120", powerKw: null },
    ], 3_535_902);

    expect(history).toHaveLength(3);
    expect(history[0].energy).toBeCloseTo(0.362, 6);
    expect(history[0].power).toBeNull();
    expect(history[0].powerSource).toBe("unavailable");
    expect(history[1].power).toBeCloseTo(4.47, 2);
    expect(history[1].powerSource).toBe("estimated_from_energy");
    expect(history[2].power).toBeCloseTo(4.49, 2);
    expect(history[2].powerSource).toBe("estimated_from_energy");
  });

  it("conserva la potencia estimada cuando meterStart está por encima de toda la serie", () => {
    const meterStartWh = 3_643_078;
    const source = [
      { timestamp: "2026-10-21T12:08:39Z", energyKwh: "3597.9510", powerKw: "0.00" },
      { timestamp: "2026-10-21T12:13:42Z", energyKwh: "3598.3350", powerKw: "0.00" },
      { timestamp: "2026-10-21T12:18:45Z", energyKwh: "3598.7190", powerKw: "0.00" },
    ];

    const history = buildPowerHistoryFromMeterValues(source, meterStartWh);

    // Sólo para la curva, la referencia pasa a ser la primera muestra. El
    // helper no muta la serie original ni representa consumo facturable.
    expect(source[0].energyKwh).toBe("3597.9510");
    expect(history.map((point) => point.energyReference)).toEqual(["first_sample", "first_sample", "first_sample"]);
    expect(history[0].energy).toBe(0);
    expect(history[1].energy).toBeCloseTo(0.384, 3);
    expect(history[2].energy).toBeCloseTo(0.768, 3);
    expect(history[1].power).toBeCloseTo(4.56, 1);
    expect(history[2].power).toBeCloseTo(4.56, 1);
    expect(history[1].powerSource).toBe("estimated_from_energy");
  });

  it("acepta 0 Wh como medidor inicial válido para la curva", () => {
    const history = buildPowerHistoryFromMeterValues([
      { timestamp: "2026-10-21T12:00:00Z", energyKwh: "0.100", powerKw: null },
      { timestamp: "2026-10-21T12:05:00Z", energyKwh: "0.500", powerKw: null },
    ], 0);

    expect(history.map((point) => point.energyReference)).toEqual(["meter_start", "meter_start"]);
    expect(history[1]).toMatchObject({ energy: 0.5, powerSource: "estimated_from_energy" });
  });

  it("liquida la energía observada desde la primera muestra si meterStart es posterior", () => {
    const result = resolveBillableEnergyKwh({
      meterStartWh: 3_643_078,
      firstSessionEnergyKwh: "3597.9510",
      currentEnergyKwh: "3644.1000",
    });

    expect(result).toEqual({
      kwh: 46.149,
      reference: "first_session_sample",
      meterStartConsistent: false,
    });
  });

  it("mantiene el medidor inicial cuando es consistente con la primera muestra", () => {
    expect(resolveBillableEnergyKwh({
      meterStartWh: 1_000,
      firstSessionEnergyKwh: 1.4,
      currentEnergyKwh: 1.8,
    })).toEqual({
      kwh: 0.8,
      reference: "meter_start",
      meterStartConsistent: true,
    });
  });

  it("no inventa un cobro si la lectura actual retrocede respecto a su base", () => {
    expect(resolveBillableEnergyKwh({
      meterStartWh: 100_000,
      firstSessionEnergyKwh: 100,
      currentEnergyKwh: 2,
    })).toEqual({
      kwh: null,
      reference: "meter_start",
      meterStartConsistent: true,
    });
  });

  it("mantiene la energía sin dato cuando no hay una referencia verificable", () => {
    expect(resolveBillableEnergyKwh({
      meterStartWh: null,
      firstSessionEnergyKwh: null,
      currentEnergyKwh: 44,
    })).toEqual({
      kwh: null,
      reference: "unavailable",
      meterStartConsistent: null,
    });
  });

  it("distingue una potencia cero medida de una potencia no reportada", () => {
    const history = buildPowerHistoryFromMeterValues([
      { timestamp: "2026-10-21T12:00:00Z", energyKwh: "10.000", powerKw: null },
      { timestamp: "2026-10-21T12:05:00Z", energyKwh: "10.000", powerKw: "0" },
    ], 10_000);

    expect(history[0]).toMatchObject({ power: null, powerSource: "unavailable" });
    expect(history[1]).toMatchObject({ power: 0, powerSource: "measured" });
  });

  it("no inventa potencia al cruzar una lectura regresiva o reset del medidor", () => {
    const history = buildPowerHistoryFromMeterValues([
      { timestamp: "2026-10-21T12:00:00Z", energyKwh: "100.000", powerKw: null },
      { timestamp: "2026-10-21T12:05:00Z", energyKwh: "100.400", powerKw: null },
      { timestamp: "2026-10-21T12:10:00Z", energyKwh: "2.000", powerKw: null },
    ], 100_000);

    expect(history[1]).toMatchObject({ powerSource: "estimated_from_energy" });
    expect(history[2]).toMatchObject({ power: null, powerSource: "unavailable" });
    expect(history[2].energy).toBe(history[1].energy);
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
