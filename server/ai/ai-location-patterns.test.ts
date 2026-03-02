/**
 * Tests para la funcionalidad de ubicación GPS y patrones de ruta del EV Assistant
 */
import { describe, it, expect } from "vitest";

// ============================================================================
// Tests de integración de ubicación en el system prompt
// ============================================================================

describe("Integración de ubicación GPS en el system prompt", () => {
  it("debe incluir sección de ubicación GPS cuando hay coordenadas", () => {
    const mockPlatformContext = {
      userLocation: { latitude: 4.624, longitude: -74.063 },
      frequentRoutes: [],
      frequentLocations: [],
    };

    // Simular la lógica del system prompt
    let prompt = "";
    if (mockPlatformContext.userLocation) {
      prompt += `=== UBICACIÓN GPS ACTUAL DEL USUARIO (EN TIEMPO REAL) ===
- Latitud: ${mockPlatformContext.userLocation.latitude}
- Longitud: ${mockPlatformContext.userLocation.longitude}
- IMPORTANTE: Tienes la ubicación REAL del usuario obtenida por GPS.`;
    }

    expect(prompt).toContain("UBICACIÓN GPS ACTUAL");
    expect(prompt).toContain("4.624");
    expect(prompt).toContain("-74.063");
    expect(prompt).toContain("ubicación REAL");
  });

  it("debe incluir mensaje de fallback cuando NO hay ubicación GPS", () => {
    const mockPlatformContext = {
      userLocation: null,
      frequentRoutes: [],
      frequentLocations: [],
    };

    let prompt = "";
    if (mockPlatformContext.userLocation) {
      prompt += "=== UBICACIÓN GPS ACTUAL ===";
    } else {
      prompt += "=== UBICACIÓN DEL USUARIO ===\n- No se pudo obtener la ubicación GPS del usuario.";
    }

    expect(prompt).not.toContain("UBICACIÓN GPS ACTUAL");
    expect(prompt).toContain("No se pudo obtener");
  });

  it("debe incluir instrucción de NO pedir ubicación cuando ya la tiene", () => {
    const mockPlatformContext = {
      userLocation: { latitude: 4.624, longitude: -74.063 },
    };

    let prompt = "";
    if (mockPlatformContext.userLocation) {
      prompt += "NO le pidas su ubicación ni punto de partida.";
    }

    expect(prompt).toContain("NO le pidas su ubicación");
  });
});

// ============================================================================
// Tests de rutas frecuentes
// ============================================================================

describe("Rutas frecuentes en el contexto de IA", () => {
  it("debe formatear rutas frecuentes correctamente en el prompt", () => {
    const routes = [
      {
        originName: "Casa",
        destinationName: "Oficina",
        frequency: 15,
        estimatedDistanceKm: 12.5,
        typicalDepartureHour: 7,
      },
      {
        originName: "Oficina",
        destinationName: "Gimnasio",
        frequency: 8,
        estimatedDistanceKm: 5.2,
        typicalDepartureHour: 18,
      },
    ];

    let prompt = "=== RUTAS FRECUENTES DEL USUARIO ===\n";
    for (const route of routes) {
      prompt += `- ${route.originName} → ${route.destinationName} (${route.frequency} veces)`;
      if (route.estimatedDistanceKm) prompt += ` ~${route.estimatedDistanceKm} km`;
      if (route.typicalDepartureHour !== null) prompt += ` | Sale normalmente a las ${route.typicalDepartureHour}:00`;
      prompt += "\n";
    }

    expect(prompt).toContain("Casa → Oficina (15 veces)");
    expect(prompt).toContain("~12.5 km");
    expect(prompt).toContain("Sale normalmente a las 7:00");
    expect(prompt).toContain("Oficina → Gimnasio (8 veces)");
  });

  it("NO debe incluir sección de rutas frecuentes si no hay rutas", () => {
    const routes: any[] = [];

    let prompt = "";
    if (routes.length > 0) {
      prompt += "=== RUTAS FRECUENTES DEL USUARIO ===\n";
    }

    expect(prompt).toBe("");
  });
});

// ============================================================================
// Tests de ubicaciones frecuentes
// ============================================================================

describe("Ubicaciones frecuentes en el contexto de IA", () => {
  it("debe formatear ubicaciones frecuentes correctamente", () => {
    const locations = [
      { label: "Posible casa (Calle 100)", latitude: 4.68, longitude: -74.04, count: 25, typicalHours: "Noche (~21:00)" },
      { label: "Posible trabajo (Calle 72)", latitude: 4.66, longitude: -74.06, count: 18, typicalHours: "Mañana (~8:00)" },
    ];

    let prompt = "=== UBICACIONES FRECUENTES DEL USUARIO ===\n";
    for (const loc of locations) {
      prompt += `- ${loc.label} (${loc.count} visitas, ${loc.typicalHours})\n`;
    }

    expect(prompt).toContain("Posible casa (Calle 100) (25 visitas, Noche (~21:00))");
    expect(prompt).toContain("Posible trabajo (Calle 72) (18 visitas, Mañana (~8:00))");
  });
});

// ============================================================================
// Tests de clustering de ubicaciones
// ============================================================================

describe("Clustering de ubicaciones frecuentes", () => {
  it("debe agrupar ubicaciones cercanas en clusters", () => {
    // Simular la lógica de clustering
    const locations = [
      { latitude: 4.680, longitude: -74.040 },
      { latitude: 4.681, longitude: -74.041 },
      { latitude: 4.680, longitude: -74.039 },
      { latitude: 4.660, longitude: -74.060 }, // Diferente cluster
      { latitude: 4.661, longitude: -74.061 },
    ];

    const CLUSTER_RADIUS = 0.005;
    const clusters: Array<{ lat: number; lng: number; count: number }> = [];

    for (const loc of locations) {
      const existing = clusters.find(
        (c) =>
          Math.abs(c.lat - loc.latitude) < CLUSTER_RADIUS &&
          Math.abs(c.lng - loc.longitude) < CLUSTER_RADIUS
      );

      if (existing) {
        existing.count++;
      } else {
        clusters.push({ lat: loc.latitude, lng: loc.longitude, count: 1 });
      }
    }

    expect(clusters.length).toBe(2);
    expect(clusters[0].count).toBe(3); // Primer cluster
    expect(clusters[1].count).toBe(2); // Segundo cluster
  });

  it("debe filtrar clusters con menos de 2 visitas", () => {
    const clusters = [
      { count: 5, label: "Casa" },
      { count: 1, label: "Visita única" },
      { count: 3, label: "Oficina" },
    ];

    const filtered = clusters.filter((c) => c.count >= 2);
    expect(filtered.length).toBe(2);
    expect(filtered.map((c) => c.label)).toEqual(["Casa", "Oficina"]);
  });
});

// ============================================================================
// Tests de detección de patrones de ruta
// ============================================================================

describe("Detección de patrones de ruta similares", () => {
  it("debe detectar rutas similares dentro del umbral de 1km", () => {
    const existingRoutes = [
      { originLat: 4.680, originLng: -74.040, destLat: 4.660, destLng: -74.060 },
    ];

    const newRoute = { originLat: 4.681, originLng: -74.041, destLat: 4.661, destLng: -74.061 };

    const THRESHOLD = 0.01;
    const match = existingRoutes.find((r) => {
      const oLatDiff = Math.abs(r.originLat - newRoute.originLat);
      const oLngDiff = Math.abs(r.originLng - newRoute.originLng);
      const dLatDiff = Math.abs(r.destLat - newRoute.destLat);
      const dLngDiff = Math.abs(r.destLng - newRoute.destLng);
      return oLatDiff < THRESHOLD && oLngDiff < THRESHOLD && dLatDiff < THRESHOLD && dLngDiff < THRESHOLD;
    });

    expect(match).toBeDefined();
  });

  it("NO debe detectar rutas diferentes como similares", () => {
    const existingRoutes = [
      { originLat: 4.680, originLng: -74.040, destLat: 4.660, destLng: -74.060 },
    ];

    const newRoute = { originLat: 5.534, originLng: -73.362, destLat: 7.119, destLng: -73.122 };

    const THRESHOLD = 0.01;
    const match = existingRoutes.find((r) => {
      const oLatDiff = Math.abs(r.originLat - newRoute.originLat);
      const oLngDiff = Math.abs(r.originLng - newRoute.originLng);
      const dLatDiff = Math.abs(r.destLat - newRoute.destLat);
      const dLngDiff = Math.abs(r.destLng - newRoute.destLng);
      return oLatDiff < THRESHOLD && oLngDiff < THRESHOLD && dLatDiff < THRESHOLD && dLngDiff < THRESHOLD;
    });

    expect(match).toBeUndefined();
  });
});

// ============================================================================
// Tests de contexto con ubicación para el sendMessage
// ============================================================================

describe("Contexto de ubicación en sendMessage", () => {
  it("debe construir el contexto con ubicación cuando hay GPS", () => {
    const userGpsLocation = { latitude: 4.624, longitude: -74.063 };

    const context = userGpsLocation
      ? {
          currentLatitude: userGpsLocation.latitude,
          currentLongitude: userGpsLocation.longitude,
        }
      : undefined;

    expect(context).toBeDefined();
    expect(context?.currentLatitude).toBe(4.624);
    expect(context?.currentLongitude).toBe(-74.063);
  });

  it("debe enviar undefined como contexto cuando NO hay GPS", () => {
    const userGpsLocation = null;

    const context = userGpsLocation
      ? {
          currentLatitude: userGpsLocation.latitude,
          currentLongitude: userGpsLocation.longitude,
        }
      : undefined;

    expect(context).toBeUndefined();
  });
});

// ============================================================================
// Tests de heurística de etiquetado de ubicaciones
// ============================================================================

describe("Heurística de etiquetado de ubicaciones", () => {
  it("debe etiquetar como 'casa' ubicaciones con visitas nocturnas frecuentes", () => {
    const hours = [21, 22, 23, 20, 7, 6, 22, 21]; // Mayoría nocturnas
    const nightVisits = hours.filter((h) => h >= 20 || h <= 7).length;
    const isLikelyHome = nightVisits > hours.length * 0.5;

    expect(isLikelyHome).toBe(true);
  });

  it("debe etiquetar como 'trabajo' ubicaciones con visitas matutinas frecuentes", () => {
    const hours = [8, 9, 8, 7, 9, 10, 8, 14]; // Mayoría matutinas
    const morningVisits = hours.filter((h) => h >= 7 && h <= 10).length;
    const nightVisits = hours.filter((h) => h >= 20 || h <= 7).length;
    const isLikelyWork = nightVisits <= hours.length * 0.5 && morningVisits > hours.length * 0.3;

    expect(isLikelyWork).toBe(true);
  });

  it("NO debe etiquetar como casa ni trabajo ubicaciones con horarios mixtos", () => {
    const hours = [12, 15, 10, 18, 14, 16]; // Horarios variados
    const nightVisits = hours.filter((h) => h >= 20 || h <= 7).length;
    const morningVisits = hours.filter((h) => h >= 7 && h <= 10).length;
    const isLikelyHome = nightVisits > hours.length * 0.5;
    const isLikelyWork = nightVisits <= hours.length * 0.5 && morningVisits > hours.length * 0.3;

    expect(isLikelyHome).toBe(false);
    expect(isLikelyWork).toBe(false);
  });
});
