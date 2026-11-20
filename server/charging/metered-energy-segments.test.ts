import { describe, expect, it } from "vitest";
import { resolveMeteredEnergySegments } from "../../shared/metered-energy-segments";

const START = "2026-11-03T18:00:00Z";
const sample = (minutes: number, energyKwh?: number | string | null) => ({
  timestamp: Date.parse(START) + minutes * 60_000,
  energyKwh,
});
const unavailable = {
  kwh: null,
  reference: "unavailable",
  meterStartConsistent: null,
  resetCount: 0,
  rejectedJumpCount: 0,
};
const realSamples = [
  { timestamp: "2026-11-03T18:13:09Z", energyKwh: "3678.619" },
  { timestamp: "2026-11-03T18:18:08Z", energyKwh: "3670.719" },
  { timestamp: "2026-11-03T18:23:07Z", energyKwh: "3671.223" },
  { timestamp: "2026-11-03T18:28:08Z", energyKwh: "3671.729" },
  { timestamp: "2026-11-03T18:33:08Z", energyKwh: "3672.233" },
  { timestamp: "2026-11-03T18:38:08Z", energyKwh: "3672.635" },
  { timestamp: "2026-11-03T18:43:08Z", energyKwh: "3673.035" },
];
const realInput = {
  startTime: "2026-11-03T18:13:06Z",
  meterStartWh: 3_678_619,
  maxPowerKw: 7,
};
const realResult = {
  kwh: 2.316,
  reference: "observed_segments",
  meterStartConsistent: false,
  resetCount: 1,
  rejectedJumpCount: 0,
};

describe("resolveMeteredEnergySegments: energía mínima medida por segmentos", () => {
  it("recupera 2.316 kWh medidos tras el retroceso del caso real sin integrar potencia", () => {
    expect(resolveMeteredEnergySegments({ ...realInput, samples: realSamples })).toEqual(realResult);
  });

  it("produce el mismo caso real con repetidos fuera de orden y no muta la entrada", () => {
    const samples = [
      realSamples[6], realSamples[0], realSamples[3], realSamples[1],
      realSamples[2], realSamples[3], realSamples[5], realSamples[4], realSamples[0],
    ].map((value) => Object.freeze({ ...value }));
    const before = samples.map((value) => ({ ...value }));
    Object.freeze(samples);
    expect(resolveMeteredEnergySegments({ ...realInput, samples })).toEqual(realResult);
    expect(samples).toEqual(before);
  });

  it("incluye start->first y deltas normales sólo cuando son plausibles", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: "100000", maxPowerKw: 7,
      samples: [sample(5, "100.4"), sample(10, 100.8), sample(15, 101.2)],
    })).toEqual({
      kwh: 1.2, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 0,
    });
  });

  it("usa la primera muestra si meterStart es superior, sin inventar el hueco inicial", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 110_000, maxPowerKw: 7,
      samples: [sample(5, 100), sample(10, 100.4), sample(15, 100.8)],
    })).toEqual({
      kwh: 0.8, reference: "first_session_sample", meterStartConsistent: false,
      resetCount: 0, rejectedJumpCount: 0,
    });
  });

  it("descarta el hueco inicial imposible aunque first esté por encima de meterStart", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(1, 110), sample(6, 110.4)],
    })).toEqual({
      kwh: 0.4, reference: "first_session_sample", meterStartConsistent: false,
      resetCount: 0, rejectedJumpCount: 1,
    });
  });

  it("preserva las positivas anteriores a un reset a mitad de carga", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 100.4), sample(10, 2), sample(15, 2.5)],
    })).toEqual({
      kwh: 0.9, reference: "observed_segments", meterStartConsistent: false,
      resetCount: 1, rejectedJumpCount: 0,
    });
  });

  it("retiene también el delta inicial válido al sumar varios resets", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(5, 100.4), sample(10, 1), sample(15, 1.3), sample(20, 0), sample(25, 0.2)],
    })).toEqual({
      kwh: 0.9, reference: "observed_segments", meterStartConsistent: false,
      resetCount: 2, rejectedJumpCount: 0,
    });
  });

  it("rechaza un pico y permite recuperación sin contaminar la base ni crear un reset falso", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 100.4), sample(10, 999), sample(15, 101.2)],
    })).toEqual({
      kwh: 1.2, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 1,
    });
  });

  it("rechaza un retorno final al contador alto obsoleto después del reset real", () => {
    expect(resolveMeteredEnergySegments({
      ...realInput,
      samples: [...realSamples, { timestamp: "2026-11-03T18:48:08Z", energyKwh: 3678.619 }],
    })).toEqual({ ...realResult, rejectedJumpCount: 1 });
  });

  it("mantiene la última base válida tras varios saltos imposibles", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 900), sample(10, 800), sample(15, 101)],
    })).toEqual({
      kwh: 1, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 2,
    });
  });

  it("acepta exactamente el 25% de tolerancia más 0.0002 kWh de cuantización", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 0, maxPowerKw: 4,
      samples: [sample(60, 5.0002), sample(120, 10.0004)],
    })).toEqual({
      kwh: 10.0004, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 0,
    });
  });

  it("rechaza incrementos por encima del límite sin recortarlos ni cobrarlos", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 0, maxPowerKw: 4,
      samples: [sample(0, 0), sample(60, 5.0003), sample(120, 1)],
    })).toEqual({
      kwh: 1, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 1,
    });
  });

  it("no atribuye un salto al inicio cuando el tiempo transcurrido es cero", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 0, maxPowerKw: 7,
      samples: [sample(0, 1), sample(5, 1.4)],
    })).toMatchObject({
      kwh: 0.4, reference: "first_session_sample", meterStartConsistent: false,
      rejectedJumpCount: 1,
    });
  });

  it("colapsa duplicados con valores equivalentes y distintos formatos de timestamp", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [
        sample(0, 100), sample(5, 100.4),
        { timestamp: "2026-11-03T13:05:00-05:00", energyKwh: "100.4000" },
        { timestamp: new Date("2026-11-03T18:05:00Z"), energyKwh: 100.4 },
        sample(10, 100.8),
      ],
    })).toMatchObject({ kwh: 0.8, resetCount: 0, rejectedJumpCount: 0 });
  });

  it("excluye un timestamp conflictivo entero incluso con duplicados posteriores", () => {
    const samples = [
      sample(0, 100), sample(5, 100.4), sample(5, 1), sample(5, 100.4), sample(10, 100.8),
    ];
    const input = { startTime: START, meterStartWh: 100_000, maxPowerKw: 7 };
    const result = {
      kwh: 0.8, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 0,
    };
    expect(resolveMeteredEnergySegments({ ...input, samples })).toEqual(result);
    expect(resolveMeteredEnergySegments({ ...input, samples: [...samples].reverse() })).toEqual(result);
  });

  it("retorna unavailable si todas las lecturas tienen timestamps conflictivos", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000,
      samples: [sample(0, 100), sample(0, 101)],
    })).toEqual(unavailable);
  });

  it("ignora lecturas preinicio y timestamps inválidos antes de elegir la base", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [
        sample(-5, 1), { timestamp: "invalid", energyKwh: 2 },
        { timestamp: new Date(NaN), energyKwh: 3 },
        { timestamp: NaN, energyKwh: 4 },
        sample(0, 100), sample(5, 100.4),
      ],
    })).toMatchObject({ kwh: 0.4, reference: "meter_start", resetCount: 0 });
  });

  it("interpreta tiempos ISO y SQL sin zona como UTC", () => {
    expect(resolveMeteredEnergySegments({
      startTime: "2026-11-03 18:00:00", meterStartWh: 100_000, maxPowerKw: 7,
      samples: [
        { timestamp: "2026-11-03T18:00:00", energyKwh: 100 },
        { timestamp: "2026-11-03T13:05:00-05:00", energyKwh: 100.4 },
        { timestamp: "2026-11-03 18:10:00", energyKwh: 100.8 },
      ],
    })).toMatchObject({ kwh: 0.8, reference: "meter_start", resetCount: 0 });
  });

  it("no infiere energía sin muestras aunque haya meterStart, duración y potencia máxima", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7, samples: [],
    })).toEqual(unavailable);
  });

  it("no convierte una lectura actual null o ausente en cero", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(5, null), sample(10)],
    })).toEqual(unavailable);
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 100.4), sample(10, null)],
    })).toMatchObject({ kwh: 0.4, meterStartConsistent: true, resetCount: 0 });
  });

  it.each([null, undefined, "", "   ", NaN, Infinity, -Infinity, "NaN", "Infinity", -1, "-2"])(
    "ignora energía inválida %s sin crear resets ni picos",
    (energyKwh) => {
      expect(resolveMeteredEnergySegments({
        startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
        samples: [sample(0, 100), sample(5, energyKwh), sample(10, 100.8)],
      })).toMatchObject({ kwh: 0.8, resetCount: 0, rejectedJumpCount: 0 });
      expect(resolveMeteredEnergySegments({
        startTime: START, meterStartWh: 100_000, samples: [sample(5, energyKwh)],
      })).toEqual(unavailable);
    },
  );

  it("ignora un valor vacío al mismo timestamp que una lectura válida", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, null), sample(5, 100.4)],
    })).toMatchObject({ kwh: 0.4, rejectedJumpCount: 0 });
  });

  it.each([null, undefined, "", "  ", NaN, Infinity, -1, "-2"])(
    "usa la primera lectura observada cuando meterStart no es válido (%s)",
    (meterStartWh) => {
      expect(resolveMeteredEnergySegments({
        startTime: START, meterStartWh, maxPowerKw: 7,
        samples: [sample(5, 100), sample(10, 100.4)],
      })).toEqual({
        kwh: 0.4, reference: "first_session_sample", meterStartConsistent: null,
        resetCount: 0, rejectedJumpCount: 0,
      });
    },
  );

  it("una muestra aislada válida sin meterStart sólo prueba cero observado", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: null, maxPowerKw: 7, samples: [sample(10, 500)],
    })).toEqual({
      kwh: 0, reference: "first_session_sample", meterStartConsistent: null,
      resetCount: 0, rejectedJumpCount: 0,
    });
  });

  it("acepta 0 Wh y 0 kWh como datos legítimos, sin confundirlos con ausencia", () => {
    expect(resolveMeteredEnergySegments({
      startTime: new Date(START), meterStartWh: "0", maxPowerKw: 7,
      samples: [sample(0, "0"), sample(5, 0), sample(10, 0.5)],
    })).toEqual({
      kwh: 0.5, reference: "meter_start", meterStartConsistent: true,
      resetCount: 0, rejectedJumpCount: 0,
    });
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 0, samples: [sample(0, 0), sample(5, 0)],
    })).toMatchObject({ kwh: 0, reference: "meter_start", meterStartConsistent: true });
  });

  it("permite reset legítimo a cero y suma las positivas posteriores", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 100_000, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 0), sample(10, 0.4)],
    })).toEqual({
      kwh: 0.4, reference: "observed_segments", meterStartConsistent: false,
      resetCount: 1, rejectedJumpCount: 0,
    });
  });

  it("marca inconsistencia por reset también cuando meterStart está ausente", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: null, maxPowerKw: 7,
      samples: [sample(0, 100), sample(5, 100.4), sample(10, 2), sample(15, 2.3)],
    })).toMatchObject({
      kwh: 0.7, reference: "observed_segments", meterStartConsistent: false, resetCount: 1,
    });
  });

  it.each(["invalid", "", NaN, Infinity, new Date(NaN)])(
    "no usa lecturas con inicio inválido (%s)",
    (startTime) => {
      expect(resolveMeteredEnergySegments({
        startTime, meterStartWh: 0, samples: [sample(0, 0), sample(5, 0.4)],
      })).toEqual(unavailable);
    },
  );

  it.each([undefined, NaN, Infinity, -7])(
    "usa un límite físico finito de 150 kW si maxPowerKw es inválido (%s)",
    (maxPowerKw) => {
      expect(resolveMeteredEnergySegments({
        startTime: START, meterStartWh: 0, maxPowerKw,
        samples: [sample(0, 0), sample(5, 100), sample(10, 1)],
      })).toMatchObject({ kwh: 1, resetCount: 0, rejectedJumpCount: 1 });
    },
  );

  it("respeta un límite explícito de cero sin estimar energía", () => {
    expect(resolveMeteredEnergySegments({
      startTime: START, meterStartWh: 0, maxPowerKw: 0,
      samples: [sample(0, 0), sample(5, 0.1), sample(10, 0.0002)],
    })).toMatchObject({ kwh: 0.0002, resetCount: 0, rejectedJumpCount: 1 });
  });
});
