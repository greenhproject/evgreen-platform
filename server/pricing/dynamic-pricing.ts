/**
 * Sistema de Tarifa Dinámica Inteligente para Green EV
 * Similar al modelo de surge pricing de Uber
 * 
 * Factores que afectan el precio:
 * 1. Ocupación de la zona (disponibilidad de conectores)
 * 2. Horario pico vs valle
 * 3. Día de la semana
 * 4. Historial de demanda
 * 5. Eventos especiales o condiciones climáticas
 */

import * as db from "../db";

// ============================================================================
// CONFIGURACIÓN DE TARIFA DINÁMICA
// ============================================================================

export interface DynamicPricingConfig {
  // Multiplicadores base
  minMultiplier: number;      // Mínimo multiplicador (ej: 0.8 = 20% descuento)
  maxMultiplier: number;      // Máximo multiplicador (ej: 2.5 = 150% más caro)
  
  // Umbrales de ocupación
  lowOccupancyThreshold: number;    // % debajo del cual hay descuento (ej: 30%)
  highOccupancyThreshold: number;   // % encima del cual hay surge (ej: 70%)
  criticalOccupancyThreshold: number; // % crítico (ej: 90%)
  
  // Multiplicadores por ocupación
  lowOccupancyDiscount: number;     // Descuento por baja ocupación (ej: 0.85)
  highOccupancyMultiplier: number;  // Multiplicador alta ocupación (ej: 1.3)
  criticalOccupancyMultiplier: number; // Multiplicador crítico (ej: 1.8)
  
  // Horarios pico
  peakHours: { start: number; end: number; multiplier: number }[];
  
  // Días de la semana (0 = Domingo, 6 = Sábado)
  weekendMultiplier: number;
  
  // Configuración de reserva
  reservationFeeBase: number;       // Tarifa base de reserva en COP
  noShowPenaltyBase: number;        // Penalización base por no show en COP
}

// Configuración por defecto
export const DEFAULT_PRICING_CONFIG: DynamicPricingConfig = {
  minMultiplier: 0.7,
  maxMultiplier: 3.0,
  
  lowOccupancyThreshold: 30,
  highOccupancyThreshold: 70,
  criticalOccupancyThreshold: 90,
  
  lowOccupancyDiscount: 0.8,
  highOccupancyMultiplier: 1.4,
  criticalOccupancyMultiplier: 2.0,
  
  peakHours: [
    { start: 7, end: 9, multiplier: 1.3 },   // Mañana pico
    { start: 12, end: 14, multiplier: 1.15 }, // Almuerzo
    { start: 17, end: 20, multiplier: 1.5 },  // Tarde pico (más alto)
  ],
  
  weekendMultiplier: 1.1,
  
  reservationFeeBase: 5000,  // $5,000 COP base
  noShowPenaltyBase: 15000,  // $15,000 COP base
};

// ============================================================================
// CÁLCULO DE OCUPACIÓN
// ============================================================================

export interface OccupancyData {
  totalConnectors: number;
  availableConnectors: number;
  chargingConnectors: number;
  reservedConnectors: number;
  faultedConnectors: number;
  occupancyRate: number;
}

// Contador global de simulaciones activas para calcular demanda
let activeSimulationCount = 0;

export function incrementActiveSimulations(): void {
  activeSimulationCount++;
  console.log(`[DynamicPricing] Active simulations: ${activeSimulationCount}`);
}

export function decrementActiveSimulations(): void {
  activeSimulationCount = Math.max(0, activeSimulationCount - 1);
  console.log(`[DynamicPricing] Active simulations: ${activeSimulationCount}`);
}

export function getActiveSimulationCount(): number {
  return activeSimulationCount;
}

export async function getZoneOccupancy(stationId: number): Promise<OccupancyData> {
  // Obtener todos los EVSEs de la estación
  const evses = await db.getEvsesByStationId(stationId);
  
  const totalConnectors = evses.length;
  let availableConnectors = evses.filter(e => e.status === "AVAILABLE").length;
  let chargingConnectors = evses.filter(e => e.status === "CHARGING").length;
  const reservedConnectors = evses.filter(e => e.status === "RESERVED").length;
  const faultedConnectors = evses.filter(e => e.status === "FAULTED" || e.status === "UNAVAILABLE").length;
  
  // Incluir simulaciones activas en el cálculo de ocupación
  // Cada simulación activa cuenta como un conector ocupado adicional
  const simulationOccupancy = activeSimulationCount;
  if (simulationOccupancy > 0) {
    // Añadir simulaciones al conteo de cargando
    chargingConnectors += simulationOccupancy;
    // Reducir disponibles (pero no menos de 0)
    availableConnectors = Math.max(0, availableConnectors - simulationOccupancy);
    console.log(`[DynamicPricing] Including ${simulationOccupancy} active simulations in occupancy calculation`);
  }
  
  const occupancyRate = totalConnectors > 0 
    ? ((totalConnectors - availableConnectors) / totalConnectors) * 100 
    : 0;
  
  console.log(`[DynamicPricing] Zone occupancy for station ${stationId}: ${occupancyRate.toFixed(1)}% (${chargingConnectors} charging, ${availableConnectors} available, ${totalConnectors} total)`);
  
  return {
    totalConnectors,
    availableConnectors,
    chargingConnectors,
    reservedConnectors,
    faultedConnectors,
    occupancyRate,
  };
}

// Obtener ocupación de una zona geográfica (radio de X km)
export async function getAreaOccupancy(
  latitude: number, 
  longitude: number, 
  radiusKm: number = 5
): Promise<OccupancyData> {
  const stations = await db.getStationsNearLocation(latitude, longitude, radiusKm);
  
  let totalConnectors = 0;
  let availableConnectors = 0;
  let chargingConnectors = 0;
  let reservedConnectors = 0;
  let faultedConnectors = 0;
  
  for (const station of stations) {
    const evses = await db.getEvsesByStationId(station.station.id);
    totalConnectors += evses.length;
    availableConnectors += evses.filter(e => e.status === "AVAILABLE").length;
    chargingConnectors += evses.filter(e => e.status === "CHARGING").length;
    reservedConnectors += evses.filter(e => e.status === "RESERVED").length;
    faultedConnectors += evses.filter(e => e.status === "FAULTED" || e.status === "UNAVAILABLE").length;
  }
  
  const occupancyRate = totalConnectors > 0 
    ? ((totalConnectors - availableConnectors) / totalConnectors) * 100 
    : 0;
  
  return {
    totalConnectors,
    availableConnectors,
    chargingConnectors,
    reservedConnectors,
    faultedConnectors,
    occupancyRate,
  };
}

// ============================================================================
// CÁLCULO DE MULTIPLICADOR DINÁMICO
// ============================================================================

export interface PricingFactors {
  occupancyMultiplier: number;
  timeMultiplier: number;
  dayMultiplier: number;
  demandMultiplier: number;
  finalMultiplier: number;
  demandLevel: "LOW" | "NORMAL" | "HIGH" | "SURGE";
}

export function calculateOccupancyMultiplier(
  occupancyRate: number, 
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): number {
  if (occupancyRate < config.lowOccupancyThreshold) {
    // Baja ocupación = descuento
    return config.lowOccupancyDiscount;
  } else if (occupancyRate >= config.criticalOccupancyThreshold) {
    // Ocupación crítica = surge máximo
    return config.criticalOccupancyMultiplier;
  } else if (occupancyRate >= config.highOccupancyThreshold) {
    // Alta ocupación = surge progresivo
    const progress = (occupancyRate - config.highOccupancyThreshold) / 
                     (config.criticalOccupancyThreshold - config.highOccupancyThreshold);
    return config.highOccupancyMultiplier + 
           (config.criticalOccupancyMultiplier - config.highOccupancyMultiplier) * progress;
  }
  
  // Ocupación normal
  return 1.0;
}

export function calculateTimeMultiplier(
  date: Date = new Date(),
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const hour = date.getHours();
  
  for (const peak of config.peakHours) {
    if (hour >= peak.start && hour < peak.end) {
      return peak.multiplier;
    }
  }
  
  // Horario valle (descuento leve)
  if (hour >= 0 && hour < 6) {
    return 0.85; // Madrugada = 15% descuento
  }
  
  return 1.0;
}

export function calculateDayMultiplier(
  date: Date = new Date(),
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const day = date.getDay();
  
  // Fin de semana (Sábado = 6, Domingo = 0)
  if (day === 0 || day === 6) {
    return config.weekendMultiplier;
  }
  
  return 1.0;
}

// Calcular multiplicador basado en historial de demanda
export async function calculateDemandMultiplier(
  stationId: number,
  targetDate: Date = new Date()
): Promise<number> {
  // Obtener transacciones de la última semana en el mismo horario
  const dayOfWeek = targetDate.getDay();
  const hour = targetDate.getHours();
  
  // Aquí se podría implementar un análisis más sofisticado
  // Por ahora, retornamos 1.0 (neutral)
  // En producción, se analizaría el historial de transacciones
  
  return 1.0;
}

export function getDemandLevel(multiplier: number): "LOW" | "NORMAL" | "HIGH" | "SURGE" {
  if (multiplier < 0.9) return "LOW";
  if (multiplier < 1.2) return "NORMAL";
  if (multiplier < 1.6) return "HIGH";
  return "SURGE";
}

// ============================================================================
// CÁLCULO DE PRECIO FINAL
// ============================================================================

export interface DynamicPrice {
  basePrice: number;
  finalPrice: number;
  factors: PricingFactors;
  reservationFee: number;
  noShowPenalty: number;
  estimatedTotal: number;
  currency: string;
  validUntil: Date;
}

export async function calculateDynamicPrice(
  stationId: number,
  evseId: number,
  requestedDate: Date = new Date(),
  estimatedDurationMinutes: number = 60,
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): Promise<DynamicPrice> {
  // Obtener tarifa base de la estación
  const tariff = await db.getActiveTariffByStationId(stationId);
  const basePricePerKwh = parseFloat(tariff?.pricePerKwh?.toString() || "800");
  
  // Obtener EVSE para conocer la potencia
  const evse = await db.getEvseById(evseId);
  const powerKw = parseFloat(evse?.powerKw?.toString() || "22");
  
  // Calcular ocupación
  const occupancy = await getZoneOccupancy(stationId);
  
  // Calcular multiplicadores
  const occupancyMultiplier = calculateOccupancyMultiplier(occupancy.occupancyRate, config);
  const timeMultiplier = calculateTimeMultiplier(requestedDate, config);
  const dayMultiplier = calculateDayMultiplier(requestedDate, config);
  const demandMultiplier = await calculateDemandMultiplier(stationId, requestedDate);
  
  // Calcular multiplicador final (promedio ponderado)
  let finalMultiplier = (
    occupancyMultiplier * 0.4 +  // 40% peso a ocupación
    timeMultiplier * 0.3 +       // 30% peso a horario
    dayMultiplier * 0.15 +       // 15% peso a día
    demandMultiplier * 0.15      // 15% peso a demanda histórica
  );
  
  // Aplicar límites
  finalMultiplier = Math.max(config.minMultiplier, Math.min(config.maxMultiplier, finalMultiplier));
  
  // Calcular precios
  const finalPricePerKwh = basePricePerKwh * finalMultiplier;
  
  // Estimar energía consumida (asumiendo eficiencia del 90%)
  const estimatedKwh = (powerKw * (estimatedDurationMinutes / 60)) * 0.9;
  const estimatedEnergyTotal = finalPricePerKwh * estimatedKwh;
  
  // Calcular tarifa de reserva dinámica
  const reservationFee = config.reservationFeeBase * finalMultiplier;
  const noShowPenalty = config.noShowPenaltyBase * finalMultiplier;
  
  // Total estimado
  const estimatedTotal = estimatedEnergyTotal + reservationFee;
  
  // El precio es válido por 5 minutos
  const validUntil = new Date(Date.now() + 5 * 60 * 1000);
  
  return {
    basePrice: basePricePerKwh,
    finalPrice: Math.round(finalPricePerKwh),
    factors: {
      occupancyMultiplier,
      timeMultiplier,
      dayMultiplier,
      demandMultiplier,
      finalMultiplier,
      demandLevel: getDemandLevel(finalMultiplier),
    },
    reservationFee: Math.round(reservationFee),
    noShowPenalty: Math.round(noShowPenalty),
    estimatedTotal: Math.round(estimatedTotal),
    currency: "COP",
    validUntil,
  };
}

// ============================================================================
// CÁLCULO DE PRECIO DINÁMICO PARA kWh EN SESIONES DE CARGA
// ============================================================================

export interface DynamicKwhPrice {
  basePricePerKwh: number;
  dynamicPricePerKwh: number;
  multiplier: number;
  factors: PricingFactors;
  demandVisualization: DemandVisualization;
  validUntil: Date;
  currency: string;
}

/**
 * Calcula el precio dinámico del kWh para una sesión de carga
 * Este precio se aplica al iniciar la carga y puede actualizarse durante la sesión
 */
export async function calculateDynamicKwhPrice(
  stationId: number,
  evseId?: number,
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): Promise<DynamicKwhPrice> {
  // Obtener tarifa base de la estación
  const tariff = await db.getActiveTariffByStationId(stationId);
  const basePricePerKwh = parseFloat(tariff?.pricePerKwh?.toString() || "800");
  
  // Obtener ocupación de la estación
  const occupancy = await getZoneOccupancy(stationId);
  
  // Calcular multiplicadores
  const now = new Date();
  const occupancyMultiplier = calculateOccupancyMultiplier(occupancy.occupancyRate, config);
  const timeMultiplier = calculateTimeMultiplier(now, config);
  const dayMultiplier = calculateDayMultiplier(now, config);
  const demandMultiplier = await calculateDemandMultiplier(stationId, now);
  
  // Calcular multiplicador final con pesos
  let finalMultiplier = (
    occupancyMultiplier * 0.4 +  // 40% peso a ocupación
    timeMultiplier * 0.3 +       // 30% peso a horario
    dayMultiplier * 0.15 +       // 15% peso a día
    demandMultiplier * 0.15      // 15% peso a demanda histórica
  );
  
  // Aplicar límites
  finalMultiplier = Math.max(config.minMultiplier, Math.min(config.maxMultiplier, finalMultiplier));
  
  // Calcular precio dinámico
  const dynamicPricePerKwh = Math.round(basePricePerKwh * finalMultiplier);
  
  const factors: PricingFactors = {
    occupancyMultiplier,
    timeMultiplier,
    dayMultiplier,
    demandMultiplier,
    finalMultiplier,
    demandLevel: getDemandLevel(finalMultiplier),
  };
  
  // El precio es válido por 15 minutos para sesiones de carga
  const validUntil = new Date(Date.now() + 15 * 60 * 1000);
  
  return {
    basePricePerKwh,
    dynamicPricePerKwh,
    multiplier: finalMultiplier,
    factors,
    demandVisualization: getDemandVisualization(factors),
    validUntil,
    currency: "COP",
  };
}

/**
 * Estima el costo total de una sesión de carga basado en el precio dinámico actual
 */
export async function estimateChargingCost(
  stationId: number,
  evseId: number,
  targetKwh: number,
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): Promise<{
  estimatedCost: number;
  pricePerKwh: number;
  multiplier: number;
  demandLevel: string;
  savings: number; // Ahorro vs precio máximo posible
}> {
  const pricing = await calculateDynamicKwhPrice(stationId, evseId, config);
  const estimatedCost = Math.round(pricing.dynamicPricePerKwh * targetKwh);
  
  // Calcular ahorro vs precio máximo
  const maxPossiblePrice = pricing.basePricePerKwh * config.maxMultiplier;
  const savings = Math.round((maxPossiblePrice - pricing.dynamicPricePerKwh) * targetKwh);
  
  return {
    estimatedCost,
    pricePerKwh: pricing.dynamicPricePerKwh,
    multiplier: pricing.multiplier,
    demandLevel: pricing.factors.demandLevel,
    savings: savings > 0 ? savings : 0,
  };
}

// ============================================================================
// VISUALIZACIÓN DE DEMANDA
// ============================================================================

export interface DemandVisualization {
  level: "LOW" | "NORMAL" | "HIGH" | "SURGE";
  color: string;
  icon: string;
  message: string;
  savingsOrSurge: string;
}

export function getDemandVisualization(factors: PricingFactors): DemandVisualization {
  const { demandLevel, finalMultiplier } = factors;
  
  switch (demandLevel) {
    case "LOW":
      const discount = Math.round((1 - finalMultiplier) * 100);
      return {
        level: "LOW",
        color: "#22c55e", // Verde
        icon: "trending-down",
        message: "Baja demanda - ¡Buen momento para cargar!",
        savingsOrSurge: `Ahorra ${discount}%`,
      };
    
    case "NORMAL":
      return {
        level: "NORMAL",
        color: "#3b82f6", // Azul
        icon: "minus",
        message: "Demanda normal",
        savingsOrSurge: "Precio estándar",
      };
    
    case "HIGH":
      const surgeHigh = Math.round((finalMultiplier - 1) * 100);
      return {
        level: "HIGH",
        color: "#f59e0b", // Amarillo/Naranja
        icon: "trending-up",
        message: "Alta demanda en esta zona",
        savingsOrSurge: `+${surgeHigh}% por demanda`,
      };
    
    case "SURGE":
      const surgeCritical = Math.round((finalMultiplier - 1) * 100);
      return {
        level: "SURGE",
        color: "#ef4444", // Rojo
        icon: "zap",
        message: "¡Demanda muy alta! Considera otro horario",
        savingsOrSurge: `+${surgeCritical}% surge`,
      };
  }
}

// ============================================================================
// PREDICCIÓN DE MEJOR HORARIO
// ============================================================================

export interface TimeSlotPrediction {
  time: Date;
  estimatedMultiplier: number;
  demandLevel: "LOW" | "NORMAL" | "HIGH" | "SURGE";
  recommendation: "BEST" | "GOOD" | "AVOID";
}

export async function predictBestTimes(
  stationId: number,
  date: Date = new Date(),
  config: DynamicPricingConfig = DEFAULT_PRICING_CONFIG
): Promise<TimeSlotPrediction[]> {
  const predictions: TimeSlotPrediction[] = [];
  const baseDate = new Date(date);
  baseDate.setMinutes(0, 0, 0);
  
  // Predecir para las próximas 24 horas en intervalos de 1 hora
  for (let i = 0; i < 24; i++) {
    const slotTime = new Date(baseDate.getTime() + i * 60 * 60 * 1000);
    
    const timeMultiplier = calculateTimeMultiplier(slotTime, config);
    const dayMultiplier = calculateDayMultiplier(slotTime, config);
    
    // Estimar ocupación basada en patrones típicos
    let estimatedOccupancy = 50; // Base
    const hour = slotTime.getHours();
    
    if (hour >= 7 && hour < 9) estimatedOccupancy = 75;
    else if (hour >= 12 && hour < 14) estimatedOccupancy = 65;
    else if (hour >= 17 && hour < 20) estimatedOccupancy = 85;
    else if (hour >= 0 && hour < 6) estimatedOccupancy = 20;
    
    const occupancyMultiplier = calculateOccupancyMultiplier(estimatedOccupancy, config);
    
    const estimatedMultiplier = (
      occupancyMultiplier * 0.4 +
      timeMultiplier * 0.3 +
      dayMultiplier * 0.15 +
      1.0 * 0.15
    );
    
    const demandLevel = getDemandLevel(estimatedMultiplier);
    
    let recommendation: "BEST" | "GOOD" | "AVOID";
    if (estimatedMultiplier < 0.95) recommendation = "BEST";
    else if (estimatedMultiplier < 1.3) recommendation = "GOOD";
    else recommendation = "AVOID";
    
    predictions.push({
      time: slotTime,
      estimatedMultiplier,
      demandLevel,
      recommendation,
    });
  }
  
  return predictions;
}
