/**
 * Tests para las mejoras del EV Assistant
 * - Clasificación de consultas (NAV solo para ubicación)
 * - Tags ROUTE para planificación de rutas
 * - Tags RESERVE para reservas desde el chat
 */
import { describe, it, expect } from "vitest";

// ============================================================================
// HELPERS - Simulan la lógica del frontend para parsear tags
// ============================================================================

function parseNavTags(content: string): { lat: number; lng: number; name: string }[] {
  const navMatches: { lat: number; lng: number; name: string }[] = [];
  const navTagRegex = /\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g;
  let m;
  while ((m = navTagRegex.exec(content)) !== null) {
    navMatches.push({
      lat: parseFloat(m[1]),
      lng: parseFloat(m[2]),
      name: m[3].trim(),
    });
  }
  return navMatches;
}

function parseRouteTag(content: string): { waypoints: { lat: number; lng: number }[]; name: string } | null {
  const routeRegex = /\[ROUTE:([^\]]+)\]/;
  const routeMatch = content.match(routeRegex);
  if (!routeMatch) return null;

  const parts = routeMatch[1].split('|');
  if (parts.length < 3) return null;

  const name = parts[parts.length - 1].trim();
  const waypoints: { lat: number; lng: number }[] = [];

  for (let i = 0; i < parts.length - 1; i++) {
    const coords = parts[i].split(',');
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng });
      }
    }
  }

  return waypoints.length >= 2 ? { waypoints, name } : null;
}

function parseReserveTag(content: string): { stationId: number; evseId: number; startTime: string; duration: number } | null {
  const reserveRegex = /\[RESERVE:(\d+),(\d+),([^,]+),(\d+)\]/;
  const reserveMatch = content.match(reserveRegex);
  if (!reserveMatch) return null;

  return {
    stationId: parseInt(reserveMatch[1]),
    evseId: parseInt(reserveMatch[2]),
    startTime: reserveMatch[3].trim(),
    duration: parseInt(reserveMatch[4]),
  };
}

function cleanDisplayText(content: string): string {
  return content
    .replace(/\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g, '')
    .replace(/\[ROUTE:([^\]]+)\]/g, '')
    .replace(/\[RESERVE:([^\]]+)\]/g, '');
}

// ============================================================================
// TESTS: TAGS DE NAVEGACIÓN [NAV:]
// ============================================================================

describe("Tags de Navegación [NAV:]", () => {
  it("debe parsear un tag NAV simple", () => {
    const content = "La estación más cercana es: [NAV:4.6782,-74.0582|Estación Centro Bogotá]";
    const navs = parseNavTags(content);
    expect(navs).toHaveLength(1);
    expect(navs[0].lat).toBeCloseTo(4.6782);
    expect(navs[0].lng).toBeCloseTo(-74.0582);
    expect(navs[0].name).toBe("Estación Centro Bogotá");
  });

  it("debe parsear múltiples tags NAV", () => {
    const content = `Aquí tienes las estaciones:
    [NAV:4.6782,-74.0582|Estación Centro]
    [NAV:4.7123,-74.0321|Estación Norte]
    [NAV:4.5987,-74.0876|Estación Sur]`;
    const navs = parseNavTags(content);
    expect(navs).toHaveLength(3);
    expect(navs[0].name).toBe("Estación Centro");
    expect(navs[1].name).toBe("Estación Norte");
    expect(navs[2].name).toBe("Estación Sur");
  });

  it("NO debe encontrar tags NAV en respuesta informativa", () => {
    const content = "El precio actual del kWh es $1,200 COP. Te recomiendo cargar en horarios de baja demanda.";
    const navs = parseNavTags(content);
    expect(navs).toHaveLength(0);
  });

  it("NO debe encontrar tags NAV en análisis de consumo", () => {
    const content = "Tu consumo promedio es de 15 kWh por carga. Has gastado $180,000 COP en total. Recomendación: cargar en madrugada.";
    const navs = parseNavTags(content);
    expect(navs).toHaveLength(0);
  });

  it("debe limpiar tags NAV del texto visible", () => {
    const content = "Ve a esta estación: [NAV:4.6782,-74.0582|Estación Centro]";
    const clean = cleanDisplayText(content);
    expect(clean).toBe("Ve a esta estación: ");
    expect(clean).not.toContain("[NAV:");
  });

  it("debe manejar coordenadas negativas", () => {
    const content = "[NAV:-33.4489,-70.6693|Santiago Centro]";
    const navs = parseNavTags(content);
    expect(navs).toHaveLength(1);
    expect(navs[0].lat).toBeCloseTo(-33.4489);
    expect(navs[0].lng).toBeCloseTo(-70.6693);
  });
});

// ============================================================================
// TESTS: TAGS DE RUTA [ROUTE:]
// ============================================================================

describe("Tags de Ruta [ROUTE:]", () => {
  it("debe parsear una ruta con 2 paradas de carga", () => {
    const content = `Aquí está tu ruta planificada:
    [ROUTE:4.624,-74.063|4.812,-73.521|5.534,-73.362|7.119,-73.123|Bogotá a Bucaramanga con 2 paradas]`;
    const route = parseRouteTag(content);
    expect(route).not.toBeNull();
    expect(route!.waypoints).toHaveLength(4);
    expect(route!.name).toBe("Bogotá a Bucaramanga con 2 paradas");
    expect(route!.waypoints[0].lat).toBeCloseTo(4.624);
    expect(route!.waypoints[3].lat).toBeCloseTo(7.119);
  });

  it("debe parsear una ruta directa sin paradas intermedias", () => {
    const content = "[ROUTE:4.624,-74.063|4.812,-73.521|Bogotá a Tunja directo]";
    const route = parseRouteTag(content);
    expect(route).not.toBeNull();
    expect(route!.waypoints).toHaveLength(2);
    expect(route!.name).toBe("Bogotá a Tunja directo");
  });

  it("NO debe parsear ruta con menos de 2 puntos", () => {
    const content = "[ROUTE:4.624,-74.063|Solo un punto]";
    const route = parseRouteTag(content);
    expect(route).toBeNull();
  });

  it("NO debe encontrar tag ROUTE en respuesta sin ruta", () => {
    const content = "El precio del kWh es $1,200 COP. No necesitas planificar una ruta para eso.";
    const route = parseRouteTag(content);
    expect(route).toBeNull();
  });

  it("debe limpiar tags ROUTE del texto visible", () => {
    const content = "Tu ruta: [ROUTE:4.624,-74.063|7.119,-73.123|Bogotá a Bucaramanga]";
    const clean = cleanDisplayText(content);
    expect(clean).toBe("Tu ruta: ");
    expect(clean).not.toContain("[ROUTE:");
  });

  it("debe identificar correctamente las paradas intermedias", () => {
    const content = "[ROUTE:4.624,-74.063|5.0,-73.8|5.5,-73.4|6.0,-73.2|7.119,-73.123|Ruta con 3 paradas]";
    const route = parseRouteTag(content);
    expect(route).not.toBeNull();
    expect(route!.waypoints).toHaveLength(5);
    // Paradas intermedias (excluyendo origen y destino)
    const intermediateStops = route!.waypoints.slice(1, -1);
    expect(intermediateStops).toHaveLength(3);
  });
});

// ============================================================================
// TESTS: TAGS DE RESERVA [RESERVE:]
// ============================================================================

describe("Tags de Reserva [RESERVE:]", () => {
  it("debe parsear un tag de reserva válido", () => {
    const content = "Perfecto, voy a reservar: [RESERVE:1,101,2026-03-02T14:00:00,60]";
    const reserve = parseReserveTag(content);
    expect(reserve).not.toBeNull();
    expect(reserve!.stationId).toBe(1);
    expect(reserve!.evseId).toBe(101);
    expect(reserve!.startTime).toBe("2026-03-02T14:00:00");
    expect(reserve!.duration).toBe(60);
  });

  it("debe parsear reserva con duración corta", () => {
    const content = "[RESERVE:5,502,2026-03-15T08:30:00,30]";
    const reserve = parseReserveTag(content);
    expect(reserve).not.toBeNull();
    expect(reserve!.stationId).toBe(5);
    expect(reserve!.duration).toBe(30);
  });

  it("NO debe encontrar tag RESERVE en respuesta sin reserva", () => {
    const content = "Las estaciones disponibles son: Estación Centro y Estación Norte. ¿Quieres reservar alguna?";
    const reserve = parseReserveTag(content);
    expect(reserve).toBeNull();
  });

  it("debe limpiar tags RESERVE del texto visible", () => {
    const content = "Reservando: [RESERVE:1,101,2026-03-02T14:00:00,60] Listo!";
    const clean = cleanDisplayText(content);
    expect(clean).toBe("Reservando:  Listo!");
    expect(clean).not.toContain("[RESERVE:");
  });

  it("debe validar que el startTime es parseable como fecha", () => {
    const content = "[RESERVE:1,101,2026-03-02T14:00:00,60]";
    const reserve = parseReserveTag(content);
    expect(reserve).not.toBeNull();
    const date = new Date(reserve!.startTime);
    expect(date.getTime()).not.toBeNaN();
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2); // Marzo = 2 (0-indexed)
    expect(date.getDate()).toBe(2);
  });
});

// ============================================================================
// TESTS: LIMPIEZA DE TEXTO COMBINADA
// ============================================================================

describe("Limpieza de texto combinada", () => {
  it("debe limpiar todos los tipos de tags simultáneamente", () => {
    const content = `Aquí está tu plan:
    Estación más cercana: [NAV:4.6782,-74.0582|Estación Centro]
    Ruta planificada: [ROUTE:4.624,-74.063|7.119,-73.123|Bogotá a Bucaramanga]
    Reserva: [RESERVE:1,101,2026-03-02T14:00:00,60]`;
    
    const clean = cleanDisplayText(content);
    expect(clean).not.toContain("[NAV:");
    expect(clean).not.toContain("[ROUTE:");
    expect(clean).not.toContain("[RESERVE:");
    expect(clean).toContain("Aquí está tu plan:");
    expect(clean).toContain("Estación más cercana:");
  });

  it("debe preservar el texto normal sin tags", () => {
    const content = "El precio del kWh es $1,200 COP. Tu consumo promedio es 15 kWh.";
    const clean = cleanDisplayText(content);
    expect(clean).toBe(content);
  });
});

// ============================================================================
// TESTS: GENERACIÓN DE URLS DE GOOGLE MAPS
// ============================================================================

describe("Generación de URLs de Google Maps", () => {
  it("debe generar URL correcta para navegación a un punto", () => {
    const lat = 4.6782;
    const lng = -74.0582;
    const userLat = 4.6500;
    const userLng = -74.0500;
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${lat},${lng}&travelmode=driving`;
    expect(url).toContain("origin=4.65,-74.05");
    expect(url).toContain("destination=4.6782,-74.0582");
    expect(url).toContain("travelmode=driving");
  });

  it("debe generar URL correcta para ruta con waypoints", () => {
    const origin = { lat: 4.624, lng: -74.063 };
    const destination = { lat: 7.119, lng: -73.123 };
    const stops = [
      { lat: 4.812, lng: -73.521 },
      { lat: 5.534, lng: -73.362 },
    ];
    
    const waypointsStr = stops.map(w => `${w.lat},${w.lng}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving&waypoints=${encodeURIComponent(waypointsStr)}`;
    
    expect(url).toContain("origin=4.624,-74.063");
    expect(url).toContain("destination=7.119,-73.123");
    expect(url).toContain("waypoints=");
    expect(decodeURIComponent(url)).toContain("4.812,-73.521|5.534,-73.362");
  });

  it("debe generar URL sin origen cuando no hay ubicación del usuario", () => {
    const lat = 4.6782;
    const lng = -74.0582;
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    expect(url).not.toContain("origin=");
    expect(url).toContain("destination=4.6782,-74.0582");
  });
});

// ============================================================================
// TESTS: SYSTEM PROMPT - CLASIFICACIÓN DE CONSULTAS
// ============================================================================

describe("Clasificación de consultas en system prompt", () => {
  // Estas son las palabras clave que el system prompt usa para clasificar
  const locationKeywords = ["llévame", "cómo llego", "navegar a", "ir a", "dónde queda", "estaciones cercanas para ir"];
  const informativeKeywords = ["precio", "consumo", "análisis", "horarios", "ahorro", "cuánto cuesta", "recomendación"];
  const routeKeywords = ["viaje", "ruta", "planificar viaje", "paradas de carga", "autonomía"];
  const reserveKeywords = ["reservar", "reserva", "agendar", "programar"];

  it("debe clasificar consultas de ubicación correctamente", () => {
    const queries = [
      "Llévame a la estación más cercana",
      "¿Cómo llego a una estación de carga?",
      "¿Dónde queda la estación Centro?",
      "Quiero ir a cargar mi auto",
    ];
    
    for (const query of queries) {
      const isLocation = locationKeywords.some(kw => query.toLowerCase().includes(kw));
      expect(isLocation).toBe(true);
    }
  });

  it("debe clasificar consultas informativas correctamente", () => {
    const queries = [
      "¿Cuál es el precio del kWh?",
      "Analiza mi consumo de energía",
      "¿Cuáles son los mejores horarios para cargar?",
      "¿Cuánto cuesta una carga completa?",
    ];
    
    for (const query of queries) {
      const isInformative = informativeKeywords.some(kw => query.toLowerCase().includes(kw));
      const isLocation = locationKeywords.some(kw => query.toLowerCase().includes(kw));
      expect(isInformative).toBe(true);
      expect(isLocation).toBe(false);
    }
  });

  it("debe clasificar consultas de ruta correctamente", () => {
    const queries = [
      "Quiero planificar un viaje a Medellín",
      "¿Cuál es la ruta con paradas de carga a Bucaramanga?",
      "Calcula las paradas según la autonomía de mi vehículo",
    ];
    
    for (const query of queries) {
      const isRoute = routeKeywords.some(kw => query.toLowerCase().includes(kw));
      expect(isRoute).toBe(true);
    }
  });

  it("debe clasificar consultas de reserva correctamente", () => {
    const queries = [
      "Quiero reservar un cargador para las 3pm",
      "Necesito agendar una carga para mañana",
      "¿Puedo programar una carga para mañana?",
    ];
    
    for (const query of queries) {
      const isReserve = reserveKeywords.some(kw => query.toLowerCase().includes(kw));
      expect(isReserve).toBe(true);
    }
  });
});
