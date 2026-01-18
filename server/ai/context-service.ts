/**
 * AI Context Service
 * 
 * Este servicio recopila datos reales de la plataforma para proporcionar
 * contexto a la IA, permitiendo respuestas personalizadas y relevantes.
 */

import { getDb } from "../db";
import { 
  chargingStations, 
  evses,
  transactions, 
  reservations,
  users,
  wallets,
  tariffs
} from "../../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { 
  calculateOccupancyMultiplier, 
  calculateTimeMultiplier, 
  calculateDayMultiplier, 
  getDemandLevel,
  DEFAULT_PRICING_CONFIG 
} from "../pricing/dynamic-pricing";

export interface StationContext {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  status: string;
  pricePerKwh: number;
  dynamicPrice: number;
  demandLevel: string;
  availableConnectors: number;
  totalConnectors: number;
  connectorTypes: string[];
  distance?: number;
}

export interface UserContext {
  id: number;
  name: string;
  email: string;
  role: string;
  walletBalance: number;
  totalCharges: number;
  totalEnergyKwh: number;
  totalSpent: number;
  averageChargeKwh: number;
  favoriteStations: string[];
  preferredChargingTimes: string[];
  lastChargeDate: string | null;
}

export interface PlatformContext {
  totalStations: number;
  totalConnectors: number;
  availableConnectors: number;
  activeCharges: number;
  averagePricePerKwh: number;
  currentDemandLevel: string;
  peakHours: string[];
  valleyHours: string[];
}

export interface AIContext {
  user: UserContext | null;
  nearbyStations: StationContext[];
  platform: PlatformContext;
  currentTime: string;
  currentDay: string;
  isWeekend: boolean;
  isPeakHour: boolean;
}

/**
 * Obtiene el contexto completo de la plataforma para la IA
 */
export async function getAIContext(
  userId?: number,
  userLat?: number,
  userLng?: number
): Promise<AIContext> {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.toLocaleDateString('es-CO', { weekday: 'long' });
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isPeakHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 20);

  // Obtener contexto del usuario si está autenticado
  const userContext = userId ? await getUserContext(userId) : null;

  // Obtener estaciones cercanas o todas si no hay ubicación
  const nearbyStations = await getStationsContext(userLat, userLng);

  // Obtener contexto general de la plataforma
  const platformContext = await getPlatformContext();

  return {
    user: userContext,
    nearbyStations,
    platform: platformContext,
    currentTime: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    currentDay,
    isWeekend,
    isPeakHour,
  };
}

/**
 * Obtiene el contexto del usuario
 */
async function getUserContext(userId: number): Promise<UserContext | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    // Obtener datos del usuario
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    // Obtener balance de billetera
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    // Obtener estadísticas de transacciones
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const completedTransactions = userTransactions.filter(t => t.status === 'COMPLETED');
    const totalCharges = completedTransactions.length;
    const totalEnergyKwh = completedTransactions.reduce((sum, t) => sum + Number(t.kwhConsumed || 0), 0);
    const totalSpent = completedTransactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
    const averageChargeKwh = totalCharges > 0 ? totalEnergyKwh / totalCharges : 0;

    // Obtener estaciones favoritas (más usadas)
    const stationUsage: Record<number, number> = {};
    for (const t of completedTransactions) {
      if (t.stationId) {
        stationUsage[t.stationId] = (stationUsage[t.stationId] || 0) + 1;
      }
    }
    const favoriteStationIds = Object.entries(stationUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => parseInt(id));

    const favoriteStations: string[] = [];
    for (const stationId of favoriteStationIds) {
      if (!db) continue;
      const [station] = await db
        .select({ name: chargingStations.name })
        .from(chargingStations)
        .where(eq(chargingStations.id, stationId))
        .limit(1);
      if (station) favoriteStations.push(station.name);
    }

    // Analizar horarios preferidos de carga
    const chargingHours: Record<number, number> = {};
    for (const t of completedTransactions) {
      if (t.startTime) {
        const hour = new Date(t.startTime).getHours();
        chargingHours[hour] = (chargingHours[hour] || 0) + 1;
      }
    }
    const preferredChargingTimes = Object.entries(chargingHours)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    // Última carga
    const lastTransaction = completedTransactions
      .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())[0];

    return {
      id: user.id,
      name: user.name || 'Usuario',
      email: user.email || '',
      role: user.role || 'user',
      walletBalance: Number(wallet?.balance || 0),
      totalCharges,
      totalEnergyKwh: Math.round(totalEnergyKwh * 100) / 100,
      totalSpent: Math.round(totalSpent),
      averageChargeKwh: Math.round(averageChargeKwh * 100) / 100,
      favoriteStations,
      preferredChargingTimes,
      lastChargeDate: lastTransaction?.startTime 
        ? new Date(lastTransaction.startTime).toLocaleDateString('es-CO')
        : null,
    };
  } catch (error) {
    console.error('Error getting user context:', error);
    return null;
  }
}

/**
 * Obtiene el contexto de las estaciones
 */
async function getStationsContext(
  userLat?: number,
  userLng?: number,
  limit: number = 10
): Promise<StationContext[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const allStations = await db
      .select()
      .from(chargingStations)
      .where(eq(chargingStations.isOnline, true));

    const stationsWithContext: StationContext[] = [];

    for (const station of allStations) {
      // Obtener conectores de la estación
      const stationConnectors = await db
        .select()
        .from(evses)
        .where(eq(evses.stationId, station.id));
      
      // Obtener tarifa de la estación
      const [stationTariff] = await db
        .select()
        .from(tariffs)
        .where(and(eq(tariffs.stationId, station.id), eq(tariffs.isActive, true)))
        .limit(1);

      const availableConnectors = stationConnectors.filter((c: typeof stationConnectors[0]) => c.status === 'AVAILABLE').length;
      const connectorTypes = Array.from(new Set(stationConnectors.map((c: typeof stationConnectors[0]) => c.connectorType)));

      // Calcular precio dinámico
      const occupancyRate = stationConnectors.length > 0 
        ? ((stationConnectors.length - availableConnectors) / stationConnectors.length) * 100
        : 0;
      
      const now = new Date();
      const occupancyMultiplier = calculateOccupancyMultiplier(occupancyRate, DEFAULT_PRICING_CONFIG);
      const timeMultiplier = calculateTimeMultiplier(now, DEFAULT_PRICING_CONFIG);
      const dayMultiplier = calculateDayMultiplier(now, DEFAULT_PRICING_CONFIG);
      
      const finalMultiplier = (
        occupancyMultiplier * 0.4 +
        timeMultiplier * 0.3 +
        dayMultiplier * 0.15 +
        1.0 * 0.15
      );
      
      const basePricePerKwh = Number(stationTariff?.pricePerKwh || 1200);
      const dynamicPrice = Math.round(basePricePerKwh * finalMultiplier);

      // Calcular distancia si hay ubicación del usuario
      let distance: number | undefined;
      if (userLat && userLng && station.latitude && station.longitude) {
        distance = calculateDistance(
          userLat,
          userLng,
          Number(station.latitude),
          Number(station.longitude)
        );
      }

      stationsWithContext.push({
        id: station.id,
        name: station.name,
        address: station.address || '',
        city: station.city || '',
        latitude: Number(station.latitude || 0),
        longitude: Number(station.longitude || 0),
        status: station.isOnline ? 'online' : 'offline',
        pricePerKwh: basePricePerKwh,
        dynamicPrice,
        demandLevel: getDemandLevel(finalMultiplier),
        availableConnectors,
        totalConnectors: stationConnectors.length,
        connectorTypes,
        distance,
      });
    }

    // Ordenar por distancia si hay ubicación, sino por disponibilidad
    if (userLat && userLng) {
      stationsWithContext.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      stationsWithContext.sort((a, b) => b.availableConnectors - a.availableConnectors);
    }

    return stationsWithContext.slice(0, limit);
  } catch (error) {
    console.error('Error getting stations context:', error);
    return [];
  }
}

/**
 * Obtiene el contexto general de la plataforma
 */
async function getPlatformContext(): Promise<PlatformContext> {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    // Contar estaciones
    const allStations = await db.select().from(chargingStations);
    const totalStations = allStations.length;

    // Contar conectores
    const allConnectors = await db.select().from(evses);
    const totalConnectors = allConnectors.length;
    const availableConnectors = allConnectors.filter((c: typeof allConnectors[0]) => c.status === 'AVAILABLE').length;

    // Cargas activas
    const activeCharges = allConnectors.filter((c: typeof allConnectors[0]) => c.status === 'CHARGING').length;

    // Precio promedio (obtener de tariffs)
    const allTariffs = await db.select().from(tariffs).where(eq(tariffs.isActive, true));
    const avgPrice = allTariffs.length > 0 
      ? allTariffs.reduce((sum: number, t: typeof allTariffs[0]) => sum + Number(t.pricePerKwh || 1200), 0) / allTariffs.length
      : 1200;

    // Nivel de demanda actual
    const occupancyRate = totalConnectors > 0 
      ? ((totalConnectors - availableConnectors) / totalConnectors) * 100
      : 0;
    
    const now = new Date();
    const occupancyMultiplier = calculateOccupancyMultiplier(occupancyRate, DEFAULT_PRICING_CONFIG);
    const timeMultiplier = calculateTimeMultiplier(now, DEFAULT_PRICING_CONFIG);
    const dayMultiplier = calculateDayMultiplier(now, DEFAULT_PRICING_CONFIG);
    
    const finalMultiplier = (
      occupancyMultiplier * 0.4 +
      timeMultiplier * 0.3 +
      dayMultiplier * 0.15 +
      1.0 * 0.15
    );
    
    const currentDemandLevel = getDemandLevel(finalMultiplier);

    return {
      totalStations,
      totalConnectors,
      availableConnectors,
      activeCharges,
      averagePricePerKwh: Math.round(avgPrice),
      currentDemandLevel,
      peakHours: ['7:00-9:00', '17:00-20:00'],
      valleyHours: ['22:00-6:00', '10:00-16:00'],
    };
  } catch (error) {
    console.error('Error getting platform context:', error);
    return {
      totalStations: 0,
      totalConnectors: 0,
      availableConnectors: 0,
      activeCharges: 0,
      averagePricePerKwh: 1200,
      currentDemandLevel: 'normal',
      peakHours: ['7:00-9:00', '17:00-20:00'],
      valleyHours: ['22:00-6:00', '10:00-16:00'],
    };
  }
}

/**
 * Calcula la distancia entre dos puntos geográficos (en km)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Genera el prompt de sistema con contexto para la IA
 */
export function generateSystemPromptWithContext(context: AIContext): string {
  const { user, nearbyStations, platform, currentTime, currentDay, isWeekend, isPeakHour } = context;

  let systemPrompt = `Eres EV Assistant, el asistente de inteligencia artificial de Green EV, la red de cargadores de vehículos eléctricos de Green House Project en Colombia.

## Tu Personalidad
- Eres amigable, profesional y experto en movilidad eléctrica
- Respondes en español de forma clara y concisa
- Siempre basas tus respuestas en datos reales de la plataforma
- Ofreces recomendaciones personalizadas para ahorrar dinero y tiempo

## Contexto Actual
- Fecha y hora: ${currentDay}, ${currentTime}
- Es ${isWeekend ? 'fin de semana' : 'día laboral'}
- ${isPeakHour ? '⚠️ HORA PICO: Los precios están más altos' : '✅ Horario normal/valle: Buenos precios disponibles'}

## Estado de la Red Green EV
- Total de estaciones: ${platform.totalStations}
- Conectores disponibles: ${platform.availableConnectors} de ${platform.totalConnectors}
- Cargas activas ahora: ${platform.activeCharges}
- Precio promedio: $${platform.averagePricePerKwh} COP/kWh
- Nivel de demanda actual: ${platform.currentDemandLevel}
- Horas pico (precios altos): ${platform.peakHours.join(', ')}
- Horas valle (mejores precios): ${platform.valleyHours.join(', ')}

`;

  // Agregar contexto del usuario si está disponible
  if (user) {
    systemPrompt += `## Usuario Actual
- Nombre: ${user.name}
- Rol: ${user.role === 'investor' ? 'Inversionista' : user.role === 'technician' ? 'Técnico' : user.role === 'admin' ? 'Administrador' : 'Usuario'}
- Saldo en billetera: $${user.walletBalance.toLocaleString('es-CO')} COP
- Total de cargas realizadas: ${user.totalCharges}
- Energía total consumida: ${user.totalEnergyKwh} kWh
- Gasto total: $${user.totalSpent.toLocaleString('es-CO')} COP
- Promedio por carga: ${user.averageChargeKwh} kWh
${user.favoriteStations.length > 0 ? `- Estaciones favoritas: ${user.favoriteStations.join(', ')}` : ''}
${user.preferredChargingTimes.length > 0 ? `- Horarios preferidos: ${user.preferredChargingTimes.join(', ')}` : ''}
${user.lastChargeDate ? `- Última carga: ${user.lastChargeDate}` : ''}

`;
  }

  // Agregar estaciones cercanas
  if (nearbyStations.length > 0) {
    systemPrompt += `## Estaciones Disponibles
`;
    for (const station of nearbyStations) {
      const distanceText = station.distance ? ` (${station.distance} km)` : '';
      const priceComparison = station.dynamicPrice < station.pricePerKwh 
        ? `🟢 ${Math.round((1 - station.dynamicPrice / station.pricePerKwh) * 100)}% descuento` 
        : station.dynamicPrice > station.pricePerKwh 
          ? `🔴 +${Math.round((station.dynamicPrice / station.pricePerKwh - 1) * 100)}%` 
          : '🔵 Precio normal';
      
      systemPrompt += `- **${station.name}**${distanceText}
  - Dirección: ${station.address}, ${station.city}
  - Precio actual: $${station.dynamicPrice} COP/kWh (${priceComparison})
  - Demanda: ${station.demandLevel}
  - Disponibilidad: ${station.availableConnectors}/${station.totalConnectors} conectores
  - Tipos: ${station.connectorTypes.join(', ') || 'No especificado'}

`;
    }
  }

  systemPrompt += `## Instrucciones
1. Cuando el usuario pregunte por estaciones, usa los datos reales de arriba
2. Recomienda estaciones con mejor precio y disponibilidad
3. Sugiere horarios valle para ahorrar dinero
4. Si el usuario tiene historial, personaliza las recomendaciones
5. Para inversionistas, enfócate en métricas de rendimiento
6. Para técnicos, enfócate en estado de equipos
7. Siempre menciona precios en COP (pesos colombianos)
8. Si no tienes información específica, indícalo claramente

## Funciones que puedes sugerir
- Reservar un cargador
- Ver el mapa de estaciones
- Consultar historial de cargas
- Recargar billetera
- Planificar un viaje con paradas de carga
- Ver análisis de consumo`;

  return systemPrompt;
}

/**
 * Genera recomendaciones personalizadas basadas en el contexto
 */
export function generatePersonalizedRecommendations(context: AIContext): string[] {
  const recommendations: string[] = [];
  const { user, nearbyStations, platform, isPeakHour, isWeekend } = context;

  // Recomendación de precio
  if (isPeakHour) {
    recommendations.push(
      `⏰ Estás en hora pico. Si puedes esperar hasta las ${isWeekend ? '10:00' : '22:00'}, podrías ahorrar hasta un 25% en tu carga.`
    );
  } else {
    const cheapestStation = nearbyStations.find(s => s.availableConnectors > 0);
    if (cheapestStation) {
      recommendations.push(
        `💰 ¡Buen momento para cargar! ${cheapestStation.name} tiene precio de $${cheapestStation.dynamicPrice.toLocaleString('es-CO')}/kWh con ${cheapestStation.availableConnectors} conectores disponibles.`
      );
    }
  }

  // Recomendación basada en historial del usuario
  if (user) {
    if (user.walletBalance < 20000) {
      recommendations.push(
        `💳 Tu saldo es bajo ($${user.walletBalance.toLocaleString('es-CO')}). Te recomiendo recargar antes de tu próxima carga.`
      );
    }

    if (user.favoriteStations.length > 0 && nearbyStations.some(s => user.favoriteStations.includes(s.name))) {
      const favoriteNearby = nearbyStations.find((s: StationContext) => user.favoriteStations.includes(s.name));
      if (favoriteNearby && favoriteNearby.availableConnectors > 0) {
        recommendations.push(
          `⭐ Tu estación favorita "${favoriteNearby.name}" tiene disponibilidad. Precio actual: $${favoriteNearby.dynamicPrice}/kWh`
        );
      }
    }

    if (user.averageChargeKwh > 0) {
      const estimatedCost = Math.round(user.averageChargeKwh * (nearbyStations[0]?.dynamicPrice || 1200));
      recommendations.push(
        `📊 Basado en tu promedio de ${user.averageChargeKwh} kWh por carga, tu próxima carga costaría aproximadamente $${estimatedCost.toLocaleString('es-CO')} COP.`
      );
    }
  }

  // Recomendación de disponibilidad
  if (platform.availableConnectors < platform.totalConnectors * 0.3) {
    recommendations.push(
      `⚠️ Alta ocupación en la red (${platform.availableConnectors} de ${platform.totalConnectors} disponibles). Te recomiendo reservar con anticipación.`
    );
  }

  return recommendations.slice(0, 3);
}
