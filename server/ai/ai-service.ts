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
   * Procesar mensaje de chat del usuario
   */
  async chat(
    userMessage: string,
    conversationHistory: AIMessage[],
    context: ConversationContext
  ): Promise<AICompletionResponse> {
    if (!this.config.enableChat) {
      throw new Error("El chat de IA está deshabilitado");
    }

    const systemPrompt = this.buildChatSystemPrompt(context);
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    return this.complete(messages);
  }

  private buildChatSystemPrompt(context: ConversationContext): string {
    let prompt = `Eres el asistente virtual de Green EV, una plataforma de carga de vehículos eléctricos en Colombia.
Tu nombre es "EV Assistant" y tu objetivo es ayudar a los usuarios con todo lo relacionado a la carga de vehículos eléctricos.

Información del usuario:
- Nombre: ${context.userName || "Usuario"}
- Rol: ${context.userRole}
`;

    if (context.vehicle) {
      prompt += `
Vehículo registrado:
- ${context.vehicle.brand} ${context.vehicle.model}
- Capacidad de batería: ${context.vehicle.batteryCapacity} kWh
- Tipo de conector: ${context.vehicle.connectorType}
`;
    }

    if (context.currentLocation) {
      prompt += `
Ubicación actual: ${context.currentLocation.latitude}, ${context.currentLocation.longitude}
`;
    }

    prompt += `
Capacidades:
1. Recomendar estaciones de carga cercanas
2. Planificar viajes con paradas de carga
3. Estimar costos de carga
4. Responder preguntas sobre vehículos eléctricos
5. Ayudar con reservas y pagos
6. Explicar tarifas y precios dinámicos

Responde siempre en español colombiano de manera amigable y profesional.
Los precios están en COP (pesos colombianos).
Sé conciso pero informativo.`;

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

    const systemPrompt = `Eres un experto en planificación de viajes para vehículos eléctricos.
Planifica la ruta óptima considerando:
- Autonomía del vehículo
- Nivel de batería actual
- Estaciones de carga disponibles en la ruta
- Tiempos de carga estimados
- Costos de carga

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
