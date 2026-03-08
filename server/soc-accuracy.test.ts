/**
 * Tests para el sistema de seguimiento de precisión de SoC
 * Verifica el cálculo de errores, sugerencias de capacidad y lógica de registro
 */
import { describe, it, expect } from "vitest";

// ============================================================================
// FUNCIONES PURAS DE CÁLCULO (extraídas de la lógica de csms-dual.ts y db.ts)
// ============================================================================

/**
 * Calcula el SoC estimado al finalizar la carga basado en datos manuales y kWh reales
 */
function calculateSocEnd(manualSocStart: number, realKwhDelivered: number, batteryCapacityKwh: number): number {
  if (batteryCapacityKwh <= 0) return manualSocStart;
  const kwhToSocPercent = (realKwhDelivered / batteryCapacityKwh) * 100;
  return Math.min(100, Math.round(manualSocStart + kwhToSocPercent));
}

/**
 * Calcula el error estimado entre el SoC calculado y el reportado por el cargador
 */
function calculateSocError(calculatedSocEnd: number, chargerSocEnd: number, batteryCapacityKwh: number): {
  errorSocPct: number;
  errorKwh: number;
} {
  const errorSocPct = calculatedSocEnd - chargerSocEnd;
  const errorKwh = Math.round((errorSocPct / 100) * batteryCapacityKwh * 10) / 10;
  return { errorSocPct, errorKwh };
}

/**
 * Genera una sugerencia de capacidad basada en el historial de errores
 */
function generateCapacitySuggestion(
  lastCapacityKwh: number,
  avgErrorKwh: number | null,
  errorThresholdKwh = 2
): number | null {
  if (avgErrorKwh === null || Math.abs(avgErrorKwh) <= errorThresholdKwh) return null;
  const suggested = Math.round((lastCapacityKwh - avgErrorKwh) * 10) / 10;
  return suggested > 0 ? suggested : null;
}

/**
 * Calcula el promedio de errores de un historial de registros
 */
function calculateAverageError(errors: (number | null)[]): number | null {
  const validErrors = errors.filter((e): e is number => e !== null);
  if (validErrors.length === 0) return null;
  return Math.round((validErrors.reduce((a, b) => a + b, 0) / validErrors.length) * 10) / 10;
}

/**
 * Determina el método de detección de finalización de carga
 */
function determineDetectionMethod(
  chargeCompleteDetected: boolean,
  hasSocFromCharger: boolean,
  stopReason: string | null
): string {
  if (chargeCompleteDetected) {
    return hasSocFromCharger ? "charger_soc" : "power_drop";
  }
  return stopReason === "Remote" ? "target_reached" : "user_stop";
}

// ============================================================================
// TESTS
// ============================================================================

describe("SoC Accuracy - calculateSocEnd", () => {
  it("calcula SoC final correctamente con datos típicos", () => {
    // Batería de 60 kWh, SoC inicial 20%, cargó 24 kWh → 20 + 40 = 60%
    expect(calculateSocEnd(20, 24, 60)).toBe(60);
  });

  it("no supera el 100% aunque se cargue más de la capacidad", () => {
    // Batería de 60 kWh, SoC inicial 80%, cargó 30 kWh → 80 + 50 = 130 → cap a 100%
    expect(calculateSocEnd(80, 30, 60)).toBe(100);
  });

  it("retorna el SoC inicial si la capacidad es 0", () => {
    expect(calculateSocEnd(30, 10, 0)).toBe(30);
  });

  it("calcula correctamente con batería pequeña (20 kWh)", () => {
    // Batería 20 kWh, SoC inicial 10%, cargó 8 kWh → 10 + 40 = 50%
    expect(calculateSocEnd(10, 8, 20)).toBe(50);
  });

  it("redondea correctamente el resultado", () => {
    // Batería 65 kWh, SoC inicial 15%, cargó 32.5 kWh → 15 + 50 = 65%
    expect(calculateSocEnd(15, 32.5, 65)).toBe(65);
  });

  it("maneja kWh muy pequeños (carga corta)", () => {
    // Batería 60 kWh, SoC inicial 50%, cargó 0.5 kWh → 50 + 0.83 ≈ 51%
    expect(calculateSocEnd(50, 0.5, 60)).toBe(51);
  });
});

describe("SoC Accuracy - calculateSocError", () => {
  it("calcula error positivo cuando el calculado es mayor que el real", () => {
    // Calculado: 65%, Cargador reporta: 60% → error = +5%, +3 kWh
    const result = calculateSocError(65, 60, 60);
    expect(result.errorSocPct).toBe(5);
    expect(result.errorKwh).toBe(3);
  });

  it("calcula error negativo cuando el calculado es menor que el real", () => {
    // Calculado: 55%, Cargador reporta: 60% → error = -5%, -3 kWh
    const result = calculateSocError(55, 60, 60);
    expect(result.errorSocPct).toBe(-5);
    expect(result.errorKwh).toBe(-3);
  });

  it("retorna 0 cuando no hay error", () => {
    const result = calculateSocError(70, 70, 60);
    expect(result.errorSocPct).toBe(0);
    expect(result.errorKwh).toBe(0);
  });

  it("calcula error en kWh correctamente con batería de 40 kWh", () => {
    // Error de 10% en batería de 40 kWh = 4 kWh
    const result = calculateSocError(80, 70, 40);
    expect(result.errorSocPct).toBe(10);
    expect(result.errorKwh).toBe(4);
  });
});

describe("SoC Accuracy - generateCapacitySuggestion", () => {
  it("sugiere capacidad menor cuando hay sobreestimación consistente", () => {
    // Capacidad actual 60 kWh, error promedio +5 kWh → sugerir 55 kWh
    expect(generateCapacitySuggestion(60, 5)).toBe(55);
  });

  it("sugiere capacidad mayor cuando hay subestimación consistente", () => {
    // Capacidad actual 60 kWh, error promedio -5 kWh → sugerir 65 kWh
    expect(generateCapacitySuggestion(60, -5)).toBe(65);
  });

  it("no sugiere cambio si el error es pequeño (≤2 kWh)", () => {
    expect(generateCapacitySuggestion(60, 1.5)).toBeNull();
    expect(generateCapacitySuggestion(60, -2)).toBeNull();
  });

  it("no sugiere si no hay datos de error", () => {
    expect(generateCapacitySuggestion(60, null)).toBeNull();
  });

  it("no sugiere capacidad negativa o cero", () => {
    // Error muy grande que llevaría a capacidad negativa
    expect(generateCapacitySuggestion(10, 15)).toBeNull();
  });

  it("respeta el umbral personalizado", () => {
    // Con umbral de 5 kWh, un error de 4 kWh no genera sugerencia
    expect(generateCapacitySuggestion(60, 4, 5)).toBeNull();
    // Pero un error de 6 kWh sí
    expect(generateCapacitySuggestion(60, 6, 5)).toBe(54);
  });
});

describe("SoC Accuracy - calculateAverageError", () => {
  it("calcula el promedio correctamente", () => {
    expect(calculateAverageError([3, 5, 4, 2, 6])).toBe(4);
  });

  it("ignora valores null en el promedio", () => {
    expect(calculateAverageError([3, null, 5, null, 4])).toBe(4);
  });

  it("retorna null si todos son null", () => {
    expect(calculateAverageError([null, null, null])).toBeNull();
  });

  it("retorna null para array vacío", () => {
    expect(calculateAverageError([])).toBeNull();
  });

  it("maneja valores negativos correctamente", () => {
    expect(calculateAverageError([-3, -5, -4])).toBe(-4);
  });

  it("maneja mezcla de positivos y negativos", () => {
    // Promedio de [-5, 5] = 0
    expect(calculateAverageError([-5, 5])).toBe(0);
  });
});

describe("SoC Accuracy - determineDetectionMethod", () => {
  it("retorna 'charger_soc' cuando se detectó batería llena con SoC del cargador", () => {
    expect(determineDetectionMethod(true, true, null)).toBe("charger_soc");
  });

  it("retorna 'power_drop' cuando se detectó batería llena sin SoC del cargador", () => {
    expect(determineDetectionMethod(true, false, null)).toBe("power_drop");
  });

  it("retorna 'target_reached' cuando se detuvo remotamente sin detección de batería llena", () => {
    expect(determineDetectionMethod(false, false, "Remote")).toBe("target_reached");
  });

  it("retorna 'user_stop' cuando el usuario detuvo manualmente", () => {
    expect(determineDetectionMethod(false, false, "Local")).toBe("user_stop");
    expect(determineDetectionMethod(false, false, null)).toBe("user_stop");
  });
});

describe("SoC Accuracy - Escenarios de uso real", () => {
  it("Escenario: usuario con capacidad sobreestimada (registró 60 kWh pero real es 55 kWh)", () => {
    // Carga 1: inicio 20%, cargó 28 kWh, cargador reporta 71%
    const soc1 = calculateSocEnd(20, 28, 60); // 20 + 46.67 = 67%
    const error1 = calculateSocError(soc1, 71, 60); // 67 - 71 = -4%, -2.4 kWh

    // Carga 2: inicio 30%, cargó 24 kWh, cargador reporta 74%
    const soc2 = calculateSocEnd(30, 24, 60); // 30 + 40 = 70%
    const error2 = calculateSocError(soc2, 74, 60); // 70 - 74 = -4%, -2.4 kWh

    // Promedio de errores
    const avgError = calculateAverageError([error1.errorKwh, error2.errorKwh]);
    expect(avgError).toBeLessThan(0); // Error negativo = subestimando

    // Sugerencia de capacidad
    const suggestion = generateCapacitySuggestion(60, avgError);
    expect(suggestion).not.toBeNull();
    if (suggestion) {
      expect(suggestion).toBeGreaterThan(60); // Sugerir capacidad mayor
    }
  });

  it("Escenario: usuario con estimaciones precisas (error < 2 kWh)", () => {
    // Carga 1: inicio 20%, cargó 24 kWh, cargador reporta 60%
    const soc1 = calculateSocEnd(20, 24, 60); // 60%
    const error1 = calculateSocError(soc1, 60, 60); // 0%

    // Carga 2: inicio 30%, cargó 18 kWh, cargador reporta 60%
    const soc2 = calculateSocEnd(30, 18, 60); // 60%
    const error2 = calculateSocError(soc2, 61, 60); // -1%, -0.6 kWh

    const avgError = calculateAverageError([error1.errorKwh, error2.errorKwh]);
    const suggestion = generateCapacitySuggestion(60, avgError);
    expect(suggestion).toBeNull(); // No hay sugerencia - estimaciones precisas
  });

  it("Escenario: batería llena detectada por caída de potencia (sin SoC del cargador)", () => {
    // Sin SoC del cargador, solo tenemos el cálculo basado en energía
    const soc = calculateSocEnd(20, 48, 60); // 20 + 80 = 100%
    expect(soc).toBe(100);

    const method = determineDetectionMethod(true, false, null);
    expect(method).toBe("power_drop");
  });

  it("Escenario: carga parcial con objetivo de porcentaje", () => {
    // Usuario quería cargar hasta 80%, inicio en 30%, capacidad 60 kWh
    // Debería cargar 30 kWh para llegar al 80%
    const expectedKwh = ((80 - 30) / 100) * 60; // 30 kWh
    expect(expectedKwh).toBe(30);

    const socEnd = calculateSocEnd(30, 30, 60);
    expect(socEnd).toBe(80);

    const method = determineDetectionMethod(false, false, "Remote");
    expect(method).toBe("target_reached");
  });
});
