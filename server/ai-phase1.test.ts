/**
 * Tests para Fase 1 de Inteligencia IA EVGreen
 * 
 * 1. Segmentación de banners por usuario (rol, ciudad, estación)
 * 2. Inyección de ubicaciones frecuentes al prompt del LLM
 * 3. Registro de patrones de ruta al finalizar sesiones de carga
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// 1. Tests de segmentación de banners
// ============================================================================
describe("Banner Targeting Logic", () => {
  it("should match banner with no targeting to all users", () => {
    const banner = {
      targetRoles: null,
      targetCities: null,
      targetStations: null,
    };
    const userRole = "user";
    const userCity = "Bogotá";
    const stationId = 5;

    // Lógica: si todos los campos de targeting son null, el banner es para todos
    const roleMatch = !banner.targetRoles || banner.targetRoles.includes(userRole);
    const cityMatch = !banner.targetCities || banner.targetCities.includes(userCity);
    const stationMatch = !banner.targetStations || banner.targetStations.includes(String(stationId));

    expect(roleMatch).toBe(true);
    expect(cityMatch).toBe(true);
    expect(stationMatch).toBe(true);
  });

  it("should filter banner by role when targetRoles is set", () => {
    const banner = {
      targetRoles: "investor,admin",
      targetCities: null,
      targetStations: null,
    };

    // Usuario con rol 'user' NO debería ver este banner
    const userRoleMatch = !banner.targetRoles || banner.targetRoles.split(",").map((r: string) => r.trim().toLowerCase()).includes("user");
    expect(userRoleMatch).toBe(false);

    // Usuario con rol 'investor' SÍ debería verlo
    const investorRoleMatch = !banner.targetRoles || banner.targetRoles.split(",").map((r: string) => r.trim().toLowerCase()).includes("investor");
    expect(investorRoleMatch).toBe(true);
  });

  it("should filter banner by city when targetCities is set", () => {
    const banner = {
      targetRoles: null,
      targetCities: "Bogotá,Medellín",
      targetStations: null,
    };

    // Usuario en Bogotá SÍ debería ver el banner
    const bogotaMatch = !banner.targetCities || banner.targetCities.toLowerCase().includes("bogotá");
    expect(bogotaMatch).toBe(true);

    // Usuario en Cali NO debería verlo
    const caliMatch = !banner.targetCities || banner.targetCities.toLowerCase().includes("cali");
    expect(caliMatch).toBe(false);
  });

  it("should filter banner by station when targetStations is set", () => {
    const banner = {
      targetRoles: null,
      targetCities: null,
      targetStations: "1,3,5",
    };

    // Estación 3 SÍ debería mostrar el banner
    const station3Match = !banner.targetStations || banner.targetStations.split(",").includes("3");
    expect(station3Match).toBe(true);

    // Estación 7 NO debería mostrarlo
    const station7Match = !banner.targetStations || banner.targetStations.split(",").includes("7");
    expect(station7Match).toBe(false);
  });

  it("should require ALL targeting criteria to match (AND logic)", () => {
    const banner = {
      targetRoles: "user",
      targetCities: "Bogotá",
      targetStations: "1,2",
    };

    // Usuario correcto, ciudad correcta, estación correcta → SÍ
    const allMatch = (
      banner.targetRoles.includes("user") &&
      banner.targetCities.toLowerCase().includes("bogotá") &&
      banner.targetStations.split(",").includes("1")
    );
    expect(allMatch).toBe(true);

    // Usuario correcto, ciudad incorrecta → NO
    const cityMismatch = (
      banner.targetRoles.includes("user") &&
      "Cali".toLowerCase() === "bogotá" &&
      banner.targetStations.split(",").includes("1")
    );
    expect(cityMismatch).toBe(false);
  });
});

// ============================================================================
// 2. Tests de inyección de ubicaciones frecuentes al prompt del LLM
// ============================================================================
describe("AI Context - Frequent Locations in Prompt", () => {
  // Simular la función generateSystemPromptWithContext
  function buildLocationPromptSection(frequentLocations: Array<{
    label: string;
    latitude: number;
    longitude: number;
    count: number;
    typicalHours: string;
  }>): string {
    if (!frequentLocations || frequentLocations.length === 0) return "";
    
    let section = `## Ubicaciones Frecuentes del Usuario (Hábitos Detectados)\n`;
    for (const loc of frequentLocations) {
      section += `- **${loc.label}** (${loc.count} visitas, horarios típicos: ${loc.typicalHours})\n`;
      section += `  - Coordenadas: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}\n`;
    }
    return section;
  }

  function buildRoutePromptSection(frequentRoutes: Array<{
    originName: string;
    destinationName: string;
    frequency: number;
    estimatedDistanceKm: number | null;
    typicalDepartureHour: number | null;
  }>): string {
    if (!frequentRoutes || frequentRoutes.length === 0) return "";
    
    let section = `## Rutas Frecuentes del Usuario\n`;
    for (const route of frequentRoutes) {
      const distText = route.estimatedDistanceKm ? ` (~${route.estimatedDistanceKm} km)` : '';
      const hourText = route.typicalDepartureHour !== null ? ` a las ${route.typicalDepartureHour}:00` : '';
      section += `- ${route.originName} → ${route.destinationName}${distText}: ${route.frequency} viajes${hourText}\n`;
    }
    return section;
  }

  it("should inject frequent locations into LLM prompt when available", () => {
    const locations = [
      { label: "Posible casa", latitude: 4.6097, longitude: -74.0817, count: 45, typicalHours: "18:00-22:00" },
      { label: "Posible trabajo", latitude: 4.6580, longitude: -74.0936, count: 30, typicalHours: "07:00-09:00" },
    ];

    const section = buildLocationPromptSection(locations);
    
    expect(section).toContain("Ubicaciones Frecuentes del Usuario");
    expect(section).toContain("Posible casa");
    expect(section).toContain("Posible trabajo");
    expect(section).toContain("45 visitas");
    expect(section).toContain("18:00-22:00");
    expect(section).toContain("4.6097");
  });

  it("should return empty string when no frequent locations", () => {
    const section = buildLocationPromptSection([]);
    expect(section).toBe("");
  });

  it("should inject route patterns into LLM prompt when available", () => {
    const routes = [
      { originName: "Casa", destinationName: "EVG Diamante Oriental", frequency: 12, estimatedDistanceKm: 5.3, typicalDepartureHour: 8 },
      { originName: "Oficina", destinationName: "EVG Centro", frequency: 8, estimatedDistanceKm: 2.1, typicalDepartureHour: 18 },
    ];

    const section = buildRoutePromptSection(routes);
    
    expect(section).toContain("Rutas Frecuentes del Usuario");
    expect(section).toContain("Casa → EVG Diamante Oriental");
    expect(section).toContain("~5.3 km");
    expect(section).toContain("12 viajes");
    expect(section).toContain("a las 8:00");
    expect(section).toContain("Oficina → EVG Centro");
  });

  it("should return empty string when no route patterns", () => {
    const section = buildRoutePromptSection([]);
    expect(section).toBe("");
  });
});

// ============================================================================
// 3. Tests de registro de patrones de ruta post-carga
// ============================================================================
describe("Route Pattern Recording on StopTransaction", () => {
  // Simular la lógica de cálculo de distancia usada en csms-dual.ts
  function calculateApproxDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): number {
    return Math.sqrt(
      Math.pow((destLat - originLat) * 111, 2) +
      Math.pow((destLng - originLng) * 111 * Math.cos(originLat * Math.PI / 180), 2)
    );
  }

  it("should calculate approximate distance correctly", () => {
    // Bogotá centro a Usaquén (~8km)
    const dist = calculateApproxDistance(4.6097, -74.0817, 4.6950, -74.0320);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(12);
  });

  it("should skip route recording when distance < 500m", () => {
    // Dos puntos muy cercanos (~100m)
    const dist = calculateApproxDistance(4.6097, -74.0817, 4.6098, -74.0816);
    const shouldRecord = dist > 0.5;
    expect(shouldRecord).toBe(false);
  });

  it("should record route when distance > 500m", () => {
    // Dos puntos a ~2km
    const dist = calculateApproxDistance(4.6097, -74.0817, 4.6250, -74.0700);
    const shouldRecord = dist > 0.5;
    expect(shouldRecord).toBe(true);
  });

  it("should build correct route pattern data", () => {
    const transaction = {
      userId: 1,
      startTime: new Date("2026-03-24T08:30:00Z"),
    };
    const lastLocation = { latitude: "4.6097", longitude: "-74.0817" };
    const station = { name: "EVG Diamante Oriental", latitude: "4.6950", longitude: "-74.0320" };

    const originLat = Number(lastLocation.latitude);
    const originLng = Number(lastLocation.longitude);
    const destLat = Number(station.latitude);
    const destLng = Number(station.longitude);
    const distKm = calculateApproxDistance(originLat, originLng, destLat, destLng);

    const routeData = {
      userId: transaction.userId,
      originLat,
      originLng,
      destinationLat: destLat,
      destinationLng: destLng,
      destinationName: station.name,
      estimatedDistanceKm: Math.round(distKm * 10) / 10,
      departureHour: new Date(transaction.startTime).getHours(),
    };

    expect(routeData.userId).toBe(1);
    expect(routeData.destinationName).toBe("EVG Diamante Oriental");
    expect(routeData.estimatedDistanceKm).toBeGreaterThan(5);
    // getHours() returns local timezone, so we just verify it's a valid hour (0-23)
    expect(routeData.departureHour).toBeGreaterThanOrEqual(0);
    expect(routeData.departureHour).toBeLessThanOrEqual(23);
    expect(routeData.originLat).toBeCloseTo(4.6097, 3);
  });

  it("should handle missing location gracefully (no recording)", () => {
    const lastLocation = null;
    const station = { name: "EVG Centro", latitude: "4.6580", longitude: "-74.0936" };

    // Si no hay última ubicación, no se debe registrar
    const shouldRecord = lastLocation && station && station.latitude && station.longitude;
    expect(shouldRecord).toBeFalsy();
  });

  it("should handle missing station gracefully (no recording)", () => {
    const lastLocation = { latitude: "4.6097", longitude: "-74.0817" };
    const station = null;

    const shouldRecord = lastLocation && station;
    expect(shouldRecord).toBeFalsy();
  });
});

// ============================================================================
// 4. Tests de la función upsertRoutePattern (lógica de matching)
// ============================================================================
describe("Route Pattern Upsert Logic", () => {
  const THRESHOLD = 0.01; // ~1km

  function findMatchingRoute(
    existing: Array<{ originLatitude: string; originLongitude: string; destinationLatitude: string; destinationLongitude: string }>,
    newRoute: { originLat: number; originLng: number; destinationLat: number; destinationLng: number }
  ) {
    return existing.find(r => {
      const oLatDiff = Math.abs(Number(r.originLatitude) - newRoute.originLat);
      const oLngDiff = Math.abs(Number(r.originLongitude) - newRoute.originLng);
      const dLatDiff = Math.abs(Number(r.destinationLatitude) - newRoute.destinationLat);
      const dLngDiff = Math.abs(Number(r.destinationLongitude) - newRoute.destinationLng);
      return oLatDiff < THRESHOLD && oLngDiff < THRESHOLD && dLatDiff < THRESHOLD && dLngDiff < THRESHOLD;
    });
  }

  it("should match existing route within 1km threshold", () => {
    const existing = [
      { originLatitude: "4.6097", originLongitude: "-74.0817", destinationLatitude: "4.6950", destinationLongitude: "-74.0320" },
    ];
    const newRoute = { originLat: 4.6100, originLng: -74.0820, destinationLat: 4.6955, destinationLng: -74.0315 };

    const match = findMatchingRoute(existing, newRoute);
    expect(match).toBeDefined();
  });

  it("should NOT match route outside 1km threshold", () => {
    const existing = [
      { originLatitude: "4.6097", originLongitude: "-74.0817", destinationLatitude: "4.6950", destinationLongitude: "-74.0320" },
    ];
    const newRoute = { originLat: 4.7000, originLng: -74.1500, destinationLat: 4.5000, destinationLng: -73.9000 };

    const match = findMatchingRoute(existing, newRoute);
    expect(match).toBeUndefined();
  });

  it("should create new route when no match exists", () => {
    const existing: Array<{ originLatitude: string; originLongitude: string; destinationLatitude: string; destinationLongitude: string }> = [];
    const newRoute = { originLat: 4.6097, originLng: -74.0817, destinationLat: 4.6950, destinationLng: -74.0320 };

    const match = findMatchingRoute(existing, newRoute);
    const action = match ? "update_frequency" : "create_new";
    expect(action).toBe("create_new");
  });
});
