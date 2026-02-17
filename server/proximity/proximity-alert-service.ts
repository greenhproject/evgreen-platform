/**
 * Servicio de Alertas de Proximidad
 * Detecta estaciones de carga cercanas compatibles con el vehículo del usuario
 * y envía notificaciones push cuando hay precios bajos.
 */

import { getDb, getEffectiveStationPrice } from "../db";
import { users, chargingStations, evses, userVehicles, tariffs } from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { sendPushNotification, type NotificationType } from "../firebase/fcm";
import { calculateDynamicKwhPrice, getDemandLevel } from "../pricing/dynamic-pricing";
import {
  calculateOccupancyMultiplier,
  calculateTimeMultiplier,
  calculateDayMultiplier,
} from "../pricing/dynamic-pricing";

// ============================================================================
// TIPOS
// ============================================================================

export interface ProximityCheckRequest {
  userId: number;
  latitude: number;
  longitude: number;
}

export interface NearbyCompatibleStation {
  stationId: number;
  stationName: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  pricePerKwh: number;
  demandLevel: string;
  availableConnectors: number;
  totalConnectors: number;
  compatibleConnectorTypes: string[];
  isLowPrice: boolean;
}

export interface ProximityCheckResult {
  checked: boolean;
  notificationSent: boolean;
  nearbyCompatibleStations: NearbyCompatibleStation[];
  reason?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const COOLDOWN_MINUTES = 30; // Mínimo 30 minutos entre alertas
const LOW_DEMAND_LEVELS = ["LOW", "NORMAL"]; // Niveles de demanda considerados "precio bajo"
const DEFAULT_RADIUS_KM = 5;

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Verificar si hay estaciones cercanas compatibles con precio bajo
 * y enviar notificación push si corresponde
 */
export async function checkProximityAndNotify(
  request: ProximityCheckRequest
): Promise<ProximityCheckResult> {
  const db = await getDb();
  if (!db) {
    return { checked: false, notificationSent: false, nearbyCompatibleStations: [], reason: "Database not available" };
  }

  // 1. Obtener preferencias del usuario
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      fcmToken: users.fcmToken,
      notifyProximity: users.notifyProximity,
      proximityRadiusKm: users.proximityRadiusKm,
      lastProximityAlertAt: users.lastProximityAlertAt,
      lastProximityStationId: users.lastProximityStationId,
    })
    .from(users)
    .where(eq(users.id, request.userId))
    .limit(1);

  if (!user) {
    return { checked: false, notificationSent: false, nearbyCompatibleStations: [], reason: "User not found" };
  }

  // 2. Verificar que las alertas de proximidad están habilitadas
  if (!user.notifyProximity) {
    return { checked: true, notificationSent: false, nearbyCompatibleStations: [], reason: "Proximity alerts disabled" };
  }

  // 3. Verificar que tiene token FCM
  if (!user.fcmToken) {
    return { checked: true, notificationSent: false, nearbyCompatibleStations: [], reason: "No FCM token" };
  }

  // 4. Verificar cooldown
  if (user.lastProximityAlertAt) {
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const timeSinceLastAlert = Date.now() - new Date(user.lastProximityAlertAt).getTime();
    if (timeSinceLastAlert < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastAlert) / 60000);
      return {
        checked: true,
        notificationSent: false,
        nearbyCompatibleStations: [],
        reason: `Cooldown active. ${remainingMinutes} minutes remaining`,
      };
    }
  }

  // 5. Obtener vehículo predeterminado del usuario
  const vehicleRows = await db
    .select()
    .from(userVehicles)
    .where(
      and(
        eq(userVehicles.userId, request.userId),
        eq(userVehicles.isActive, true)
      )
    )
    .orderBy(desc(userVehicles.isDefault))
    .limit(1);

  const defaultVehicle = vehicleRows.length > 0 ? vehicleRows[0] : null;
  const vehicleConnectors: string[] = defaultVehicle
    ? (defaultVehicle.connectorTypes as string[]) || []
    : [];

  // 6. Buscar estaciones cercanas
  const radiusKm = user.proximityRadiusKm || DEFAULT_RADIUS_KM;

  const nearbyStations = await db
    .select({
      id: chargingStations.id,
      name: chargingStations.name,
      address: chargingStations.address,
      city: chargingStations.city,
      latitude: chargingStations.latitude,
      longitude: chargingStations.longitude,
      isOnline: chargingStations.isOnline,
      distance: sql<number>`(
        6371 * acos(
          cos(radians(${request.latitude})) * cos(radians(${chargingStations.latitude})) *
          cos(radians(${chargingStations.longitude}) - radians(${request.longitude})) +
          sin(radians(${request.latitude})) * sin(radians(${chargingStations.latitude}))
        )
      )`.as("distance"),
    })
    .from(chargingStations)
    .where(
      and(
        eq(chargingStations.isActive, true),
        eq(chargingStations.isPublic, true),
        eq(chargingStations.isOnline, true)
      )
    )
    .having(sql`distance <= ${radiusKm}`)
    .orderBy(sql`distance`)
    .limit(10);

  if (nearbyStations.length === 0) {
    return { checked: true, notificationSent: false, nearbyCompatibleStations: [], reason: "No nearby stations" };
  }

  // 7. Evaluar cada estación: conectores compatibles + precio dinámico
  const compatibleStations: NearbyCompatibleStation[] = [];

  for (const station of nearbyStations) {
    // Obtener EVSEs de la estación
    const stationEvses = await db
      .select({
        id: evses.id,
        connectorType: evses.connectorType,
        status: evses.status,
      })
      .from(evses)
      .where(eq(evses.stationId, station.id));

    if (stationEvses.length === 0) continue;

    // Filtrar conectores compatibles con el vehículo
    const connectorTypes = Array.from(new Set(stationEvses.map(e => e.connectorType).filter(Boolean)));
    const compatibleConnectors = vehicleConnectors.length > 0
      ? connectorTypes.filter(ct => vehicleConnectors.includes(ct || ""))
      : connectorTypes;

    // Si no hay conectores compatibles, saltar
    if (vehicleConnectors.length > 0 && compatibleConnectors.length === 0) continue;

    // Calcular disponibilidad
    const availableEvses = stationEvses.filter(e => (e.status as string) === "AVAILABLE" || (e.status as string) === "Available");
    const availableConnectors = availableEvses.length;

    if (availableConnectors === 0) continue;

    // Calcular precio dinámico
    const effectivePriceDefault = await getEffectiveStationPrice(station.id);
    let pricePerKwh = effectivePriceDefault.pricePerKwh; // Precio efectivo (estación o global)
    let demandLevel = "NORMAL";

    try {
      const firstEvse = stationEvses[0];
      const pricing = await calculateDynamicKwhPrice(station.id, firstEvse.id);
      pricePerKwh = pricing.dynamicPricePerKwh;
      demandLevel = pricing.factors.demandLevel;
    } catch (e) {
      // Si falla el cálculo dinámico, usar precio base
      const stationTariff = await db
        .select({ pricePerKwh: tariffs.pricePerKwh })
        .from(tariffs)
        .where(eq(tariffs.stationId, station.id))
        .limit(1);
      if (stationTariff.length > 0 && stationTariff[0].pricePerKwh) {
        pricePerKwh = Number(stationTariff[0].pricePerKwh);
      }
    }

    const isLowPrice = LOW_DEMAND_LEVELS.includes(demandLevel);

    compatibleStations.push({
      stationId: station.id,
      stationName: station.name,
      address: station.address || "",
      city: station.city || "",
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      distanceKm: Math.round(station.distance * 10) / 10,
      pricePerKwh,
      demandLevel,
      availableConnectors,
      totalConnectors: stationEvses.length,
      compatibleConnectorTypes: compatibleConnectors.filter(Boolean) as string[],
      isLowPrice,
    });
  }

  if (compatibleStations.length === 0) {
    return { checked: true, notificationSent: false, nearbyCompatibleStations: [], reason: "No compatible stations nearby" };
  }

  // 8. Buscar la mejor estación (compatible + precio bajo + más cercana)
  const lowPriceStations = compatibleStations.filter(s => s.isLowPrice);
  const bestStation = lowPriceStations.length > 0
    ? lowPriceStations.sort((a, b) => a.distanceKm - b.distanceKm)[0]
    : null;

  // Si no hay estaciones con precio bajo, no notificar (pero retornar las compatibles)
  if (!bestStation) {
    return {
      checked: true,
      notificationSent: false,
      nearbyCompatibleStations: compatibleStations,
      reason: "No low-price compatible stations",
    };
  }

  // 9. Verificar que no es la misma estación que la última notificada (evitar spam)
  if (user.lastProximityStationId === bestStation.stationId && user.lastProximityAlertAt) {
    const timeSinceLastSameStation = Date.now() - new Date(user.lastProximityAlertAt).getTime();
    const sameStationCooldownMs = 2 * 60 * 60 * 1000; // 2 horas para la misma estación
    if (timeSinceLastSameStation < sameStationCooldownMs) {
      return {
        checked: true,
        notificationSent: false,
        nearbyCompatibleStations: compatibleStations,
        reason: "Same station cooldown active",
      };
    }
  }

  // 10. Enviar notificación push
  const vehicleName = defaultVehicle
    ? `${defaultVehicle.brand} ${defaultVehicle.model}`
    : "tu vehículo";

  const connectorText = bestStation.compatibleConnectorTypes.length > 0
    ? bestStation.compatibleConnectorTypes.join(", ")
    : "disponibles";

  const demandText = bestStation.demandLevel === "LOW"
    ? "Precio bajo"
    : "Precio normal";

  const notificationSent = await sendPushNotification(user.fcmToken, {
    type: "station_available" as NotificationType,
    title: `${demandText} cerca de ti`,
    body: `${bestStation.stationName} a ${bestStation.distanceKm} km · $${bestStation.pricePerKwh.toLocaleString()}/kWh · ${bestStation.availableConnectors} conectores ${connectorText} para ${vehicleName}`,
    clickAction: `/stations/${bestStation.stationId}`,
    data: {
      stationId: bestStation.stationId.toString(),
      stationName: bestStation.stationName,
      latitude: bestStation.latitude.toString(),
      longitude: bestStation.longitude.toString(),
      pricePerKwh: bestStation.pricePerKwh.toString(),
      demandLevel: bestStation.demandLevel,
    },
  });

  // 11. Actualizar cooldown del usuario
  if (notificationSent) {
    await db
      .update(users)
      .set({
        lastProximityAlertAt: new Date(),
        lastProximityStationId: bestStation.stationId,
      })
      .where(eq(users.id, request.userId));
  }

  return {
    checked: true,
    notificationSent,
    nearbyCompatibleStations: compatibleStations,
  };
}

/**
 * Obtener estaciones cercanas compatibles sin enviar notificación
 * (para mostrar en el frontend)
 */
export async function getNearbyCompatibleStations(
  userId: number,
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<NearbyCompatibleStation[]> {
  const result = await checkProximityAndNotify({
    userId,
    latitude,
    longitude,
  });
  return result.nearbyCompatibleStations;
}
