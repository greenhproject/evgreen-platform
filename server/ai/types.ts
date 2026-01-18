/**
 * Sistema de IA Genérico para Green EV
 * Arquitectura de proveedores intercambiables
 */

// ============================================================================
// TIPOS BASE
// ============================================================================

export type AIProvider = "manus" | "openai" | "anthropic" | "google" | "azure" | "custom";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface AICompletionResponse {
  content: string;
  finishReason: "stop" | "length" | "content_filter" | "error";
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: AIProvider;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

// ============================================================================
// CONFIGURACIÓN DE PROVEEDOR
// ============================================================================

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  organizationId?: string;
}

// ============================================================================
// INTERFAZ DE PROVEEDOR
// ============================================================================

export interface IAIProvider {
  readonly name: AIProvider;
  readonly displayName: string;
  readonly supportedModels: string[];
  readonly defaultModel: string;
  
  /**
   * Verificar si el proveedor está configurado correctamente
   */
  isConfigured(): boolean;
  
  /**
   * Completar un chat con el modelo de IA
   */
  complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse>;
  
  /**
   * Completar un chat con streaming (opcional)
   */
  streamComplete?(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): AsyncGenerator<AIStreamChunk>;
  
  /**
   * Estimar costo de una solicitud (en USD)
   */
  estimateCost(inputTokens: number, outputTokens: number): number;
}

// ============================================================================
// TIPOS PARA FUNCIONALIDADES ESPECÍFICAS
// ============================================================================

// Recomendaciones de carga
export interface ChargingRecommendation {
  stationId: number;
  stationName: string;
  address: string;
  distance: number; // km
  estimatedWaitTime: number; // minutos
  currentPrice: number; // COP/kWh
  demandLevel: "LOW" | "NORMAL" | "HIGH" | "SURGE";
  reason: string;
  score: number; // 0-100
}

export interface ChargingRecommendationRequest {
  userId: number;
  currentLatitude: number;
  currentLongitude: number;
  batteryLevel?: number; // 0-100
  vehicleRange?: number; // km
  preferredConnectorTypes?: string[];
  maxDistance?: number; // km
  maxWaitTime?: number; // minutos
}

// Planificación de viajes
export interface TripStop {
  type: "origin" | "charging" | "destination";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  stationId?: number;
  estimatedArrival?: Date;
  estimatedDeparture?: Date;
  chargingDuration?: number; // minutos
  estimatedCost?: number; // COP
  batteryOnArrival?: number; // %
  batteryOnDeparture?: number; // %
}

export interface TripPlan {
  totalDistance: number; // km
  totalDuration: number; // minutos
  totalChargingTime: number; // minutos
  totalChargingCost: number; // COP
  stops: TripStop[];
  warnings: string[];
  alternatives?: TripPlan[];
}

export interface TripPlanRequest {
  userId: number;
  origin: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  waypoints?: { latitude: number; longitude: number; address?: string }[];
  vehicleRange: number; // km con batería llena
  currentBatteryLevel: number; // 0-100
  preferredConnectorTypes?: string[];
  departureTime?: Date;
  minimumBatteryAtDestination?: number; // % mínimo al llegar
}

// Insights para inversionistas
export interface InvestorInsight {
  type: "revenue" | "usage" | "maintenance" | "opportunity" | "warning";
  title: string;
  description: string;
  metric?: {
    value: number;
    unit: string;
    change?: number; // % cambio vs período anterior
    trend?: "up" | "down" | "stable";
  };
  recommendation?: string;
  priority: "low" | "medium" | "high";
  stationId?: number;
}

export interface InvestorInsightRequest {
  investorId: number;
  stationIds?: number[];
  period?: "day" | "week" | "month" | "quarter" | "year";
}

// Analytics para administradores
export interface AdminAnalytics {
  networkHealth: {
    totalStations: number;
    onlineStations: number;
    utilizationRate: number;
    averageSessionDuration: number;
  };
  anomalies: {
    type: string;
    description: string;
    stationId?: number;
    severity: "low" | "medium" | "high" | "critical";
    detectedAt: Date;
  }[];
  predictions: {
    type: string;
    description: string;
    confidence: number;
    timeframe: string;
  }[];
  recommendations: {
    title: string;
    description: string;
    impact: string;
    effort: "low" | "medium" | "high";
  }[];
}

// ============================================================================
// CONTEXTO DE CONVERSACIÓN
// ============================================================================

export interface ConversationContext {
  userId: number;
  userRole: string;
  userName?: string;
  // Ubicación actual (si está disponible)
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  // Vehículo del usuario (si está registrado)
  vehicle?: {
    brand: string;
    model: string;
    batteryCapacity: number; // kWh
    connectorType: string;
  };
  // Historial de carga reciente
  recentCharges?: {
    stationName: string;
    date: Date;
    energyDelivered: number;
    cost: number;
  }[];
  // Para inversionistas
  ownedStations?: {
    id: number;
    name: string;
  }[];
  // Preferencias del usuario
  preferences?: {
    preferredLanguage: string;
    preferredConnectorTypes: string[];
    maxChargingBudget?: number;
  };
}
