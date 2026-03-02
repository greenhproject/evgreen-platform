/**
 * Servicio Principal de IA para Green EV
 * Gestiona proveedores, configuración y funcionalidades
 */

import { db as database } from "../db";
import {
  ManusProvider,
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
} from "./providers";
import type {
  AIProvider,
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  ChargingRecommendation,
  ChargingRecommendationRequest,
  TripPlan,
  TripPlanRequest,
  InvestorInsight,
  InvestorInsightRequest,
  ConversationContext,
} from "./types";
import { getAIContext, type AIContext } from "./context-service";

// ============================================================================
// SERVICIO DE IA
// ============================================================================

class AIService {
  private providers: Map<AIProvider, IAIProvider> = new Map();
  private activeProvider: IAIProvider;
  private config: {
    provider: AIProvider;
    temperature: number;
    maxTokens: number;
    enableChat: boolean;
    enableRecommendations: boolean;
    enableTripPlanner: boolean;
    enableInvestorInsights: boolean;
    enableAdminAnalytics: boolean;
    dailyUserLimit: number;
    dailyTotalLimit: number;
  };

  constructor() {
    // Inicializar proveedores
    this.providers.set("manus", new ManusProvider());
    this.providers.set("openai", new OpenAIProvider());
    this.providers.set("anthropic", new AnthropicProvider());
    this.providers.set("google", new GoogleProvider());

    // Configuración por defecto
    this.config = {
      provider: "manus",
      temperature: 0.7,
      maxTokens: 2000,
      enableChat: true,
      enableRecommendations: true,
      enableTripPlanner: true,
      enableInvestorInsights: true,
      enableAdminAnalytics: true,
      dailyUserLimit: 50,
      dailyTotalLimit: 10000,
    };

    // Proveedor activo por defecto
    this.activeProvider = this.providers.get("manus")!;
  }

  // ============================================================================
  // CONFIGURACIÓN
  // ============================================================================

  /**
   * Cargar configuración desde la base de datos
   */
  async loadConfig(): Promise<void> {
    try {
      const dbConfig = await database.getAIConfig();
      if (dbConfig) {
        this.config = {
          provider: dbConfig.provider as AIProvider,
          temperature: parseFloat(dbConfig.temperature?.toString() || "0.7"),
          maxTokens: dbConfig.maxTokens || 2000,
          enableChat: dbConfig.enableChat,
          enableRecommendations: dbConfig.enableRecommendations,
          enableTripPlanner: dbConfig.enableTripPlanner,
          enableInvestorInsights: dbConfig.enableInvestorInsights,
          enableAdminAnalytics: dbConfig.enableAdminAnalytics,
          dailyUserLimit: dbConfig.dailyUserLimit || 50,
          dailyTotalLimit: dbConfig.dailyTotalLimit || 10000,
        };

        // Configurar el proveedor activo con su API key
        await this.setActiveProvider(dbConfig.provider as AIProvider, {
          openai: dbConfig.openaiApiKey || undefined,
          anthropic: dbConfig.anthropicApiKey || undefined,
          google: dbConfig.googleApiKey || undefined,
          azure: dbConfig.azureApiKey || undefined,
          azureEndpoint: dbConfig.azureEndpoint || undefined,
          custom: dbConfig.customApiKey || undefined,
          customEndpoint: dbConfig.customEndpoint || undefined,
          model: dbConfig.modelName || undefined,
        });
      }
    } catch (error) {
      console.error("[AIService] Error loading config:", error);
      // Usar configuración por defecto (Manus)
    }
  }

  /**
   * Establecer el proveedor activo
   */
  async setActiveProvider(
    providerName: AIProvider,
    apiKeys?: {
      openai?: string;
      anthropic?: string;
      google?: string;
      azure?: string;
      azureEndpoint?: string;
      custom?: string;
      customEndpoint?: string;
      model?: string;
    }
  ): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.error(`[AIService] Provider ${providerName} not found`);
      return false;
    }

    // Configurar API key si se proporciona
    if (apiKeys && "configure" in provider) {
      const configMethod = (provider as any).configure;
      if (typeof configMethod === "function") {
        let apiKey: string | undefined;
        let endpoint: string | undefined;

        switch (providerName) {
          case "openai":
            apiKey = apiKeys.openai;
            break;
          case "anthropic":
            apiKey = apiKeys.anthropic;
            break;
          case "google":
            apiKey = apiKeys.google;
            break;
          case "azure":
            apiKey = apiKeys.azure;
            endpoint = apiKeys.azureEndpoint;
            break;
          case "custom":
            apiKey = apiKeys.custom;
            endpoint = apiKeys.customEndpoint;
            break;
        }

        configMethod.call(provider, {
          apiKey,
          endpoint,
          model: apiKeys.model,
        });
      }
    }

    // Verificar que el proveedor está configurado (excepto Manus que siempre está disponible)
    if (providerName !== "manus" && !provider.isConfigured()) {
      console.warn(`[AIService] Provider ${providerName} is not configured, falling back to Manus`);
      this.activeProvider = this.providers.get("manus")!;
      this.config.provider = "manus";
      return false;
    }

    this.activeProvider = provider;
    this.config.provider = providerName;
    return true;
  }

  /**
   * Obtener configuración actual
   */
  getConfig() {
    return {
      ...this.config,
      activeProviderName: this.activeProvider.name,
      activeProviderDisplayName: this.activeProvider.displayName,
      isConfigured: this.activeProvider.isConfigured(),
      supportedModels: this.activeProvider.supportedModels,
    };
  }

  /**
   * Obtener lista de proveedores disponibles
   */
  getAvailableProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      displayName: provider.displayName,
      isConfigured: provider.isConfigured(),
      supportedModels: provider.supportedModels,
      defaultModel: provider.defaultModel,
    }));
  }

  // ============================================================================
  // COMPLETIONS
  // ============================================================================

  /**
   * Completar un mensaje con el proveedor activo
   */
  async complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const finalOptions: AICompletionOptions = {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      ...options,
    };

    return this.activeProvider.complete(messages, finalOptions);
  }

  // ============================================================================
  // CHAT CONVERSACIONAL
  // ============================================================================

  /**
   * Procesar mensaje de chat del usuario con contexto real de la plataforma
   */
  async chat(
    userMessage: string,
    conversationHistory: AIMessage[],
    context: ConversationContext
  ): Promise<AICompletionResponse> {
    if (!this.config.enableChat) {
      throw new Error("El chat de IA está deshabilitado");
    }

    // Obtener contexto real de la plataforma
    let platformContext: AIContext | null = null;
    try {
      platformContext = await getAIContext(
        context.userId,
        context.currentLocation?.latitude,
        context.currentLocation?.longitude
      );
    } catch (error) {
      console.error('[AIService] Error getting platform context:', error);
    }

    const systemPrompt = this.buildChatSystemPromptWithContext(context, platformContext);
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    return this.complete(messages);
  }

  private buildChatSystemPromptWithContext(context: ConversationContext, platformContext: AIContext | null): string {
    let prompt = `Eres el asistente virtual de Green EV, una plataforma de carga de vehículos eléctricos en Colombia.
Tu nombre es "EV Assistant" y tu objetivo es ayudar a los usuarios con información REAL y ACTUALIZADA de nuestra plataforma.

=== INFORMACIÓN DEL USUARIO ===
- Nombre: ${context.userName || "Usuario"}
- Rol: ${context.userRole}
`;

    // Agregar contexto del usuario desde la plataforma
    if (platformContext?.user) {
      const u = platformContext.user;
      prompt += `
=== HISTORIAL DEL USUARIO EN LA PLATAFORMA ===
- Total de cargas realizadas: ${u.totalCharges}
- Energía total consumida: ${u.totalEnergyKwh.toFixed(1)} kWh
- Gasto total: $${u.totalSpent.toLocaleString('es-CO')} COP
- Promedio por carga: ${u.averageChargeKwh.toFixed(1)} kWh
- Saldo en billetera: $${u.walletBalance.toLocaleString('es-CO')} COP
- Estaciones favoritas: ${u.favoriteStations.length > 0 ? u.favoriteStations.join(', ') : 'Ninguna aún'}
- Horarios preferidos de carga: ${u.preferredChargingTimes.length > 0 ? u.preferredChargingTimes.join(', ') : 'No determinado'}
`;
    }

    // Agregar vehículos del usuario desde la plataforma
    if (platformContext?.user?.defaultVehicle) {
      const v = platformContext.user.defaultVehicle;
      prompt += `
=== VEHÍCULO PREDETERMINADO DEL USUARIO ===
- ${v.brand} ${v.model}${v.year ? ` (${v.year})` : ''}${v.nickname ? ` "${v.nickname}"` : ''}
- Capacidad de batería: ${v.batteryCapacityKwh ? `${v.batteryCapacityKwh} kWh` : 'No especificada'}
- Autonomía: ${v.rangeKm ? `${v.rangeKm} km` : 'No especificada'}
- Conectores compatibles: ${v.connectorTypes.join(', ') || 'No especificado'}
- Potencia máxima de carga: ${v.maxChargePowerKw ? `${v.maxChargePowerKw} kW` : 'No especificada'}
`;
      if (platformContext.user.vehicles.length > 1) {
        prompt += `- Otros vehículos registrados: ${platformContext.user.vehicles.filter(vv => vv.id !== v.id).map(vv => `${vv.brand} ${vv.model}${vv.nickname ? ` "${vv.nickname}"` : ''}`).join(', ')}\n`;
      }
    } else if (context.vehicle) {
      prompt += `
=== VEHÍCULO REGISTRADO ===
- ${context.vehicle.brand} ${context.vehicle.model}
- Capacidad de batería: ${context.vehicle.batteryCapacity} kWh
- Tipo de conector: ${context.vehicle.connectorType}
`;
    }

    // Agregar estaciones cercanas con datos reales (priorizando compatibles con el vehículo)
    if (platformContext?.nearbyStations && platformContext.nearbyStations.length > 0) {
      const userConnectors = platformContext?.user?.defaultVehicle?.connectorTypes || [];
      prompt += `
=== ESTACIONES CERCANAS (DATOS EN TIEMPO REAL) ===
`;
      for (const station of platformContext.nearbyStations.slice(0, 5)) {
        const distanceText = station.distance ? `${station.distance.toFixed(1)} km` : 'Distancia desconocida';
        const isCompatible = userConnectors.length > 0
          ? station.connectorTypes.some(ct => userConnectors.includes(ct))
          : true;
        const compatibleTag = userConnectors.length > 0 ? (isCompatible ? ' ✅ COMPATIBLE' : ' ⚠️ NO COMPATIBLE con tu vehículo') : '';
        prompt += `
⚡ ${station.name}${compatibleTag}
   - Dirección: ${station.address}, ${station.city}
   - Coordenadas GPS: ${station.latitude}, ${station.longitude}
   - Distancia: ${distanceText}
   - Estado: ${station.status === 'online' ? 'En línea' : 'Fuera de línea'}
   - Conectores disponibles: ${station.availableConnectors}/${station.totalConnectors}
   - Tipos de conector: ${station.connectorTypes.join(', ') || 'No especificado'}
   - Precio base: $${station.pricePerKwh.toLocaleString('es-CO')}/kWh
   - Precio dinámico actual: $${station.dynamicPrice.toLocaleString('es-CO')}/kWh
   - Nivel de demanda: ${station.demandLevel === 'LOW' ? 'Baja (buen momento!)' : station.demandLevel === 'NORMAL' ? 'Normal' : station.demandLevel === 'HIGH' ? 'Alta' : 'Muy alta (surge)'}
`;
      }
    }

    // Agregar contexto de la plataforma
    if (platformContext?.platform) {
      const p = platformContext.platform;
      prompt += `
=== ESTADO ACTUAL DE LA RED GREEN EV ===
- Total de estaciones: ${p.totalStations}
- Total de conectores: ${p.totalConnectors}
- Conectores disponibles ahora: ${p.availableConnectors}
- Cargas activas en este momento: ${p.activeCharges}
- Nivel de demanda general: ${p.currentDemandLevel === 'LOW' ? 'Baja' : p.currentDemandLevel === 'NORMAL' ? 'Normal' : p.currentDemandLevel === 'HIGH' ? 'Alta' : 'Muy alta'}
- Precio promedio: $${p.averagePricePerKwh.toLocaleString('es-CO')}/kWh
- Hora actual: ${platformContext.currentTime}
- Día: ${platformContext.currentDay}
- Es fin de semana: ${platformContext.isWeekend ? 'Sí' : 'No'}
- Es hora pico: ${platformContext.isPeakHour ? 'Sí (precios más altos)' : 'No'}
`;
    }

    // Agregar ubicación GPS real del usuario
    if (platformContext?.userLocation) {
      prompt += `
=== UBICACIÓN GPS ACTUAL DEL USUARIO (EN TIEMPO REAL) ===
- Latitud: ${platformContext.userLocation.latitude}
- Longitud: ${platformContext.userLocation.longitude}
- IMPORTANTE: Tienes la ubicación REAL del usuario obtenida por GPS. NO le pidas su ubicación ni punto de partida.
- Usa estas coordenadas directamente como punto de origen para planificar rutas y calcular distancias.
- Las distancias a estaciones ya están calculadas desde esta ubicación.
`;
    } else {
      prompt += `
=== UBICACIÓN DEL USUARIO ===
- No se pudo obtener la ubicación GPS del usuario.
- Si necesitas su ubicación para planificar una ruta, pídele que la comparta o que indique su punto de partida.
`;
    }

    // Agregar rutas frecuentes del usuario
    if (platformContext?.frequentRoutes && platformContext.frequentRoutes.length > 0) {
      prompt += `
=== RUTAS FRECUENTES DEL USUARIO ===
`;
      for (const route of platformContext.frequentRoutes) {
        prompt += `- ${route.originName} → ${route.destinationName} (${route.frequency} veces)`;
        if (route.estimatedDistanceKm) prompt += ` ~${route.estimatedDistanceKm} km`;
        if (route.typicalDepartureHour !== null) prompt += ` | Sale normalmente a las ${route.typicalDepartureHour}:00`;
        prompt += '\n';
      }
      prompt += `- Usa esta información para anticipar las necesidades del usuario y ofrecer sugerencias proactivas.
`;
    }

    // Agregar ubicaciones frecuentes del usuario
    if (platformContext?.frequentLocations && platformContext.frequentLocations.length > 0) {
      prompt += `
=== UBICACIONES FRECUENTES DEL USUARIO ===
`;
      for (const loc of platformContext.frequentLocations) {
        prompt += `- ${loc.label} (${loc.count} visitas, ${loc.typicalHours})\n`;
      }
      prompt += `- Usa esta información para personalizar recomendaciones (ej: "como sueles ir a tu oficina...").
`;
    }

    prompt += `
=== INSTRUCCIONES CRÍTICAS ===

**REGLA #1 - CLASIFICACIÓN DE CONSULTA (MUY IMPORTANTE):**
Antes de responder, clasifica internamente la consulta del usuario en una de estas categorías:
- UBICACIÓN: El usuario pregunta por estaciones cercanas, cómo llegar, direcciones, rutas, navegar
- RUTA_VIAJE: El usuario quiere planificar un viaje largo con paradas de carga
- RESERVA: El usuario quiere reservar un cargador a una hora específica
- INFORMATIVA: Preguntas sobre precios, consumo, análisis, horarios, ahorro, vehículos, etc.

**REGLA #2 - TAGS DE NAVEGACIÓN [NAV:...] (MUY IMPORTANTE):**
- SOLO incluye tags [NAV:latitud,longitud|Nombre] cuando la consulta es de tipo UBICACIÓN
- NUNCA incluyas tags [NAV:...] en consultas INFORMATIVAS (precios, consumo, análisis, horarios, ahorro)
- Formato: [NAV:4.6782,-74.0582|Estación Centro Bogotá]
- Solo usar cuando el usuario explícitamente pide: "llévame", "cómo llego", "navegar a", "ir a", "dónde queda", "estaciones cercanas para ir"

**REGLA #3 - PLANIFICACIÓN DE RUTAS [ROUTE:...] (PARA VIAJES LARGOS):**
Cuando el usuario quiere planificar un viaje/ruta con paradas de carga:
- Calcula las paradas necesarias basándote en la autonomía del vehículo (usa datos reales del vehículo registrado)
- Considera una velocidad promedio de 80 km/h en carretera (o la que indique el usuario)
- Deja un margen de seguridad del 20% en la autonomía (no agotar batería al 0%)
- Para cada parada, indica cuánto cargar y tiempo estimado
- Al final de tu respuesta, incluye un tag con la ruta completa:
  [ROUTE:lat_origen,lng_origen|lat_parada1,lng_parada1|lat_parada2,lng_parada2|...|lat_destino,lng_destino|Nombre descriptivo de la ruta]
- Ejemplo: [ROUTE:4.624,-74.063|4.812,-73.521|5.534,-73.362|Bogotá a Bucaramanga con 2 paradas]
- SOLO incluir este tag cuando es un viaje real con origen y destino definidos

**REGLA #4 - RESERVA DE CARGADORES [RESERVE:...]:**
Cuando el usuario quiere reservar un cargador:
- Pregunta los datos necesarios: estación, fecha/hora, duración estimada
- Confirma la disponibilidad y el costo de la reserva
- Cuando tengas todos los datos y el usuario confirme, incluye el tag:
  [RESERVE:stationId,evseId,startTime_ISO,durationMinutes]
  Ejemplo: [RESERVE:1,101,2026-03-02T14:00:00,60]
- SIEMPRE pide confirmación antes de incluir el tag de reserva
- Informa al usuario sobre la tarifa de reserva y la penalización por no-show

**REGLAS GENERALES:**
1. USA SIEMPRE los datos reales de arriba para responder preguntas sobre estaciones, precios y disponibilidad
2. Cuando el usuario pregunte por estaciones cercanas, usa la lista de "ESTACIONES CERCANAS" con los datos actuales
3. Cuando pregunte por precios, usa los precios dinámicos actuales que incluyen el nivel de demanda
4. Si el usuario tiene historial, personalízale las respuestas basado en sus patrones de uso
5. Recomienda cargar en horarios de baja demanda para ahorrar dinero
6. Los precios están en COP (pesos colombianos)
7. Responde siempre en español colombiano de manera amigable y profesional
8. Sé específico con nombres de estaciones, direcciones y precios reales
9. Si no tienes datos de algo, indícalo claramente en lugar de inventar
10. Si el usuario tiene un vehículo registrado, SIEMPRE prioriza estaciones que tengan conectores compatibles
11. Cuando estimes tiempos de carga, usa: tiempo_horas = kWh_necesarios / min(potencia_cargador, potencia_max_vehiculo)
12. Si el usuario pregunta sobre autonomía o alcance, usa los datos reales de su vehículo registrado
13. Para planificación de rutas, calcula: autonomía_real = autonomía_nominal * (batería_actual/100) * 0.8 (factor seguridad)

Capacidades:
- Recomendar estaciones de carga cercanas con precios actuales
- Navegar a estaciones con integración directa a Google Maps (SOLO cuando se pide)
- Planificar viajes largos con paradas de carga optimizadas según autonomía del vehículo
- Estimar costos de carga basados en precios dinámicos
- Reservar cargadores a una hora específica
- Responder preguntas sobre vehículos eléctricos, consumo y ahorro
- Explicar cómo funcionan las tarifas dinámicas`;

    return prompt;
  }

  // ============================================================================
  // RECOMENDACIONES DE CARGA
  // ============================================================================

  /**
   * Obtener recomendaciones de estaciones de carga
   */
  async getChargingRecommendations(
    request: ChargingRecommendationRequest
  ): Promise<ChargingRecommendation[]> {
    if (!this.config.enableRecommendations) {
      throw new Error("Las recomendaciones de IA están deshabilitadas");
    }

    // Obtener estaciones cercanas de la base de datos
    const stations = await database.getNearbyStations(
      request.currentLatitude,
      request.currentLongitude,
      request.maxDistance || 20
    );

    if (stations.length === 0) {
      return [];
    }

    // Construir prompt para análisis de IA
    const systemPrompt = `Eres un experto en optimización de carga de vehículos eléctricos.
Analiza las siguientes estaciones de carga y proporciona recomendaciones ordenadas por conveniencia.

Considera:
- Distancia al usuario
- Disponibilidad de conectores
- Precio actual (considera tarifa dinámica)
- Tiempo de espera estimado
- Tipo de conector compatible

Responde SOLO con un JSON array con el siguiente formato:
[{
  "stationId": number,
  "score": number (0-100),
  "reason": "string explicando por qué se recomienda"
}]`;

    const userPrompt = `Usuario en: ${request.currentLatitude}, ${request.currentLongitude}
Nivel de batería: ${request.batteryLevel || "desconocido"}%
Conectores preferidos: ${request.preferredConnectorTypes?.join(", ") || "cualquiera"}

Estaciones disponibles:
${JSON.stringify(stations, null, 2)}`;

    try {
      const response = await this.complete([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      // Parsear respuesta JSON
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("[AIService] Could not parse recommendations JSON");
        return this.fallbackRecommendations(stations);
      }

      const aiRecommendations = JSON.parse(jsonMatch[0]);

      // Combinar datos de IA con datos de estaciones
      return aiRecommendations.map((rec: any) => {
        const station = stations.find((s: any) => s.id === rec.stationId);
        if (!station) return null;

        return {
          stationId: station.id,
          stationName: station.name,
          address: station.address,
          distance: station.distance || 0,
          estimatedWaitTime: 0, // TODO: calcular basado en ocupación
          currentPrice: 1200, // Precio base por defecto
          demandLevel: "NORMAL" as const,
          reason: rec.reason,
          score: rec.score,
        };
      }).filter(Boolean);
    } catch (error) {
      console.error("[AIService] Error getting recommendations:", error);
      return this.fallbackRecommendations(stations);
    }
  }

  private fallbackRecommendations(stations: any[]): ChargingRecommendation[] {
    // Recomendaciones básicas sin IA (por distancia)
    return stations.slice(0, 5).map((station, index) => ({
      stationId: station.id,
      stationName: station.name,
      address: station.address,
      distance: station.distance || 0,
      estimatedWaitTime: 0,
      currentPrice: station.currentPrice || 1200,
      demandLevel: "NORMAL" as const,
      reason: `Estación cercana a ${(station.distance || 0).toFixed(1)} km`,
      score: 100 - index * 10,
    }));
  }

  // ============================================================================
  // PLANIFICACIÓN DE VIAJES
  // ============================================================================

  /**
   * Planificar un viaje con paradas de carga
   */
  async planTrip(request: TripPlanRequest): Promise<TripPlan> {
    if (!this.config.enableTripPlanner) {
      throw new Error("El planificador de viajes está deshabilitado");
    }

    // Obtener vehículo predeterminado del usuario para contexto
    let vehicleInfo = '';
    try {
      const userContext = await getAIContext(request.userId);
      if (userContext.user?.defaultVehicle) {
        const v = userContext.user.defaultVehicle;
        vehicleInfo = `\nVehículo del usuario: ${v.brand} ${v.model}${v.year ? ` (${v.year})` : ''}
- Capacidad de batería: ${v.batteryCapacityKwh || 'desconocida'} kWh
- Autonomía nominal: ${v.rangeKm || request.vehicleRange} km
- Conectores compatibles: ${v.connectorTypes.join(', ') || 'cualquiera'}
- Potencia máxima de carga: ${v.maxChargePowerKw || 'desconocida'} kW`;
      }
    } catch (e) {
      console.error('[AIService] Error getting vehicle context for trip:', e);
    }

    const systemPrompt = `Eres un experto en planificación de viajes para vehículos eléctricos.
Planifica la ruta óptima considerando:
- Autonomía del vehículo
- Nivel de batería actual
- Estaciones de carga disponibles en la ruta
- Tiempos de carga estimados
- Costos de carga
- IMPORTANTE: Solo recomienda estaciones que tengan conectores compatibles con el vehículo del usuario
- Calcula tiempos de carga usando: tiempo = kWh_necesarios / min(potencia_cargador, potencia_max_vehiculo)

Responde SOLO con un JSON con el siguiente formato:
{
  "totalDistance": number (km),
  "totalDuration": number (minutos),
  "totalChargingTime": number (minutos),
  "totalChargingCost": number (COP),
  "stops": [{
    "type": "origin" | "charging" | "destination",
    "name": string,
    "address": string,
    "latitude": number,
    "longitude": number,
    "stationId": number (solo para charging),
    "chargingDuration": number (minutos, solo para charging),
    "estimatedCost": number (COP, solo para charging),
    "batteryOnArrival": number (%),
    "batteryOnDeparture": number (%)
  }],
  "warnings": [string]
}`;

    // Obtener estaciones en la ruta
    const routeStations = await database.getStationsAlongRoute(
      request.origin,
      request.destination,
      50 // km de buffer
    );

    const userPrompt = `Planifica un viaje:
Origen: ${request.origin.latitude}, ${request.origin.longitude}
Destino: ${request.destination.latitude}, ${request.destination.longitude}
Autonomía del vehículo: ${request.vehicleRange} km
Batería actual: ${request.currentBatteryLevel}%
Batería mínima al llegar: ${request.minimumBatteryAtDestination || 20}%
Conectores preferidos: ${request.preferredConnectorTypes?.join(", ") || "cualquiera"}
${vehicleInfo}

Estaciones disponibles en la ruta:
${JSON.stringify(routeStations, null, 2)}`;

    try {
      const response = await this.complete([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      // Parsear respuesta JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse trip plan JSON");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("[AIService] Error planning trip:", error);
      // Retornar plan básico
      return {
        totalDistance: 0,
        totalDuration: 0,
        totalChargingTime: 0,
        totalChargingCost: 0,
        stops: [
          {
            type: "origin",
            name: "Origen",
            address: request.origin.address || "Ubicación de origen",
            latitude: request.origin.latitude,
            longitude: request.origin.longitude,
            batteryOnArrival: request.currentBatteryLevel,
            batteryOnDeparture: request.currentBatteryLevel,
          },
          {
            type: "destination",
            name: "Destino",
            address: request.destination.address || "Ubicación de destino",
            latitude: request.destination.latitude,
            longitude: request.destination.longitude,
            batteryOnArrival: 0,
            batteryOnDeparture: 0,
          },
        ],
        warnings: ["No se pudo calcular la ruta óptima. Por favor, intente de nuevo."],
      };
    }
  }

  // ============================================================================
  // INSIGHTS PARA INVERSIONISTAS
  // ============================================================================

  /**
   * Obtener insights para inversionistas
   */
  async getInvestorInsights(
    request: InvestorInsightRequest
  ): Promise<InvestorInsight[]> {
    if (!this.config.enableInvestorInsights) {
      throw new Error("Los insights de inversionista están deshabilitados");
    }

    // Obtener datos del inversionista
    const investorData = await database.getInvestorAnalytics(
      request.investorId,
      request.stationIds,
      request.period || "month"
    );

    const systemPrompt = `Eres un analista financiero especializado en infraestructura de carga de vehículos eléctricos.
Analiza los datos del inversionista y proporciona insights accionables.

Genera insights en las siguientes categorías:
- revenue: Análisis de ingresos
- usage: Patrones de uso
- maintenance: Necesidades de mantenimiento
- opportunity: Oportunidades de mejora
- warning: Alertas importantes

Responde SOLO con un JSON array:
[{
  "type": "revenue" | "usage" | "maintenance" | "opportunity" | "warning",
  "title": string,
  "description": string,
  "metric": {
    "value": number,
    "unit": string,
    "change": number (% vs período anterior),
    "trend": "up" | "down" | "stable"
  },
  "recommendation": string,
  "priority": "low" | "medium" | "high",
  "stationId": number (opcional)
}]`;

    const userPrompt = `Datos del inversionista:
${JSON.stringify(investorData, null, 2)}`;

    try {
      const response = await this.complete([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.fallbackInvestorInsights(investorData);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("[AIService] Error getting investor insights:", error);
      return this.fallbackInvestorInsights(investorData);
    }
  }

  private fallbackInvestorInsights(data: any): InvestorInsight[] {
    return [
      {
        type: "revenue",
        title: "Resumen de ingresos",
        description: `Ingresos totales del período: $${data.totalRevenue?.toLocaleString() || 0} COP`,
        metric: {
          value: data.totalRevenue || 0,
          unit: "COP",
          trend: "stable",
        },
        priority: "medium",
      },
    ];
  }

  // ============================================================================
  // TRACKING DE USO
  // ============================================================================

  /**
   * Registrar uso de IA
   */
  async trackUsage(
    userId: number,
    usageType: string,
    response: AICompletionResponse
  ): Promise<void> {
    try {
      await database.createAIUsage({
        userId,
        usageType,
        provider: response.provider,
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        estimatedCost: this.activeProvider.estimateCost(
          response.usage.inputTokens,
          response.usage.outputTokens
        ).toString(),
      });
    } catch (error) {
      console.error("[AIService] Error tracking usage:", error);
    }
  }

  /**
   * Verificar límites de uso
   */
  async checkUsageLimits(userId: number): Promise<{
    allowed: boolean;
    userUsageToday: number;
    userLimit: number;
    totalUsageToday: number;
    totalLimit: number;
  }> {
    const usage = await database.getAIUsageStats(userId);
    
    return {
      allowed:
        usage.userUsageToday < this.config.dailyUserLimit &&
        usage.totalUsageToday < this.config.dailyTotalLimit,
      userUsageToday: usage.userUsageToday,
      userLimit: this.config.dailyUserLimit,
      totalUsageToday: usage.totalUsageToday,
      totalLimit: this.config.dailyTotalLimit,
    };
  }
}

// Singleton
export const aiService = new AIService();
