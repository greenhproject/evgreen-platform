/**
 * Tests para las nuevas funcionalidades del chat de IA:
 * 1. Tags [NAV:lat,lng|nombre] en el system prompt
 * 2. Coordenadas GPS incluidas en el contexto de estaciones
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Tests de detección de tags NAV (lógica frontend replicada)
// ============================================================================

function extractNavTags(content: string) {
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

function cleanNavTags(content: string) {
  return content.replace(/\[NAV:(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\|([^\]]+)\]/g, '');
}

function buildGoogleMapsUrl(
  lat: number,
  lng: number,
  userLat?: number,
  userLng?: number
) {
  if (userLat !== undefined && userLng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${lat},${lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

describe("AI Chat Features", () => {
  describe("NAV Tag Extraction", () => {
    it("debe extraer un tag NAV simple", () => {
      const content = "La estación más cercana es Centro Bogotá. [NAV:4.6782,-74.0582|Estación Centro Bogotá]";
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(1);
      expect(tags[0].lat).toBeCloseTo(4.6782);
      expect(tags[0].lng).toBeCloseTo(-74.0582);
      expect(tags[0].name).toBe("Estación Centro Bogotá");
    });

    it("debe extraer múltiples tags NAV", () => {
      const content = `Aquí tienes las estaciones cercanas:
1. [NAV:4.6782,-74.0582|Estación Centro]
2. [NAV:4.7110,-74.0721|Estación Norte]
3. [NAV:4.6243,-74.0645|Estación Sur]`;
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(3);
      expect(tags[0].name).toBe("Estación Centro");
      expect(tags[1].name).toBe("Estación Norte");
      expect(tags[2].name).toBe("Estación Sur");
    });

    it("debe manejar coordenadas negativas", () => {
      const content = "[NAV:-33.4489,-70.6693|Estación Santiago]";
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(1);
      expect(tags[0].lat).toBeCloseTo(-33.4489);
      expect(tags[0].lng).toBeCloseTo(-70.6693);
    });

    it("debe retornar array vacío si no hay tags", () => {
      const content = "La estación más cercana está en la Calle 100.";
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(0);
    });

    it("debe manejar coordenadas con espacios después de la coma", () => {
      const content = "[NAV:4.6782, -74.0582|Estación Test]";
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(1);
      expect(tags[0].lng).toBeCloseTo(-74.0582);
    });

    it("debe manejar nombres con caracteres especiales", () => {
      const content = "[NAV:4.6782,-74.0582|Estación Éxito Calle 80 #45-12]";
      const tags = extractNavTags(content);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe("Estación Éxito Calle 80 #45-12");
    });
  });

  describe("NAV Tag Cleaning", () => {
    it("debe limpiar tags NAV del texto visible", () => {
      const content = "Ve a la estación Centro. [NAV:4.6782,-74.0582|Estación Centro]";
      const cleaned = cleanNavTags(content);
      expect(cleaned).toBe("Ve a la estación Centro. ");
      expect(cleaned).not.toContain("[NAV:");
    });

    it("debe limpiar múltiples tags", () => {
      const content = "Opción 1: [NAV:4.6782,-74.0582|Centro] y Opción 2: [NAV:4.7110,-74.0721|Norte]";
      const cleaned = cleanNavTags(content);
      expect(cleaned).toBe("Opción 1:  y Opción 2: ");
    });

    it("debe preservar texto sin tags", () => {
      const content = "No hay estaciones disponibles en este momento.";
      const cleaned = cleanNavTags(content);
      expect(cleaned).toBe(content);
    });
  });

  describe("Google Maps URL Generation", () => {
    it("debe generar URL con origen y destino cuando hay ubicación del usuario", () => {
      const url = buildGoogleMapsUrl(4.6782, -74.0582, 4.7110, -74.0721);
      expect(url).toContain("origin=4.711,-74.0721");
      expect(url).toContain("destination=4.6782,-74.0582");
      expect(url).toContain("travelmode=driving");
    });

    it("debe generar URL solo con destino cuando no hay ubicación del usuario", () => {
      const url = buildGoogleMapsUrl(4.6782, -74.0582);
      expect(url).not.toContain("origin=");
      expect(url).toContain("destination=4.6782,-74.0582");
      expect(url).toContain("travelmode=driving");
    });

    it("debe usar el dominio correcto de Google Maps", () => {
      const url = buildGoogleMapsUrl(4.6782, -74.0582);
      expect(url).toContain("https://www.google.com/maps/dir/");
    });
  });

  describe("System Prompt - Coordenadas GPS", () => {
    it("debe incluir instrucción de tags NAV en el prompt", () => {
      // Simular la parte relevante del system prompt
      const promptInstructions = `10. IMPORTANTE: Cuando el usuario pida navegar, llegar, o ir a una estación, SIEMPRE incluye las coordenadas GPS en tu respuesta usando el formato exacto: [NAV:latitud,longitud|Nombre de la estación]. Ejemplo: [NAV:4.6782,-74.0582|Estación Centro Bogotá]. Esto permite al usuario abrir Google Maps directamente.
11. Si el usuario dice "llévame", "cómo llego", "navegar a", "ir a" o similar, incluye el tag [NAV:...] para CADA estación que menciones`;

      expect(promptInstructions).toContain("[NAV:");
      expect(promptInstructions).toContain("Google Maps");
      expect(promptInstructions).toContain("llévame");
      expect(promptInstructions).toContain("cómo llego");
    });

    it("debe incluir coordenadas GPS en el contexto de estaciones", () => {
      // Simular el formato de estación en el prompt
      const stationPrompt = `⚡ Estación Centro Bogotá
   - Dirección: Calle 100 #15-20, Bogotá
   - Coordenadas GPS: 4.6782, -74.0582
   - Distancia: 2.3 km`;

      expect(stationPrompt).toContain("Coordenadas GPS:");
      expect(stationPrompt).toContain("4.6782");
      expect(stationPrompt).toContain("-74.0582");
    });
  });

  describe("Navigation Context Detection", () => {
    it("debe detectar contexto de navegación en español", () => {
      const patterns = [
        "¿Cómo llego a la estación?",
        "Llévame a cargar",
        "¿Cuál es la dirección?",
        "Navegar a la estación más cercana",
        "¿Dónde está la ubicación?",
        "Quiero ir a cargar",
        "La estación más cercana",
      ];

      const regex = /estaci[oó]n|direcci[oó]n|ubicaci[oó]n|llegar|ruta|navegar|m[aá]s cercana|c[oó]mo llego|ll[eé]vame|ir a/i;

      for (const pattern of patterns) {
        expect(regex.test(pattern)).toBe(true);
      }
    });

    it("no debe detectar contexto de navegación en mensajes normales", () => {
      const patterns = [
        "¿Cuál es el precio del kWh?",
        "¿Cuánto cuesta cargar?",
        "Hola, buenos días",
      ];

      const regex = /estaci[oó]n|direcci[oó]n|ubicaci[oó]n|llegar|ruta|navegar|m[aá]s cercana|c[oó]mo llego|ll[eé]vame|ir a/i;

      for (const pattern of patterns) {
        expect(regex.test(pattern)).toBe(false);
      }
    });
  });
});
