import { and, eq } from "drizzle-orm";
import { chargingStations, evses, organizations } from "../../drizzle/schema";
import { getDb, getPlatformSettings } from "../db";
import { getSiemEligibility, mapStationToOcpiLocation } from "./ocpi-catalog";
import { getLocationDedupeKey, stageOcpiEvent } from "./ocpi-outbox";

/**
 * Recalcula el snapshot de una Location tras cambios administrativos. No hace
 * tráfico externo: solo actualiza la cola SIEM si la estación sigue elegible.
 */
export async function stageSiemLocationSnapshot(stationId: number, providedDb?: any) {
  const db = providedDb ?? await getDb();
  if (!db) return { staged: false, reason: "DATABASE_UNAVAILABLE" as const, externalRequest: false as const };

  const [station] = await db.select({
    id: chargingStations.id, name: chargingStations.name, address: chargingStations.address, city: chargingStations.city,
    country: chargingStations.country, latitude: chargingStations.latitude, longitude: chargingStations.longitude, timezone: chargingStations.timezone,
    isActive: chargingStations.isActive, isPublic: chargingStations.isPublic, networkAccessMode: chargingStations.networkAccessMode, siemReportingEnabled: chargingStations.siemReportingEnabled,
    organizationId: chargingStations.organizationId, organizationStatus: organizations.orgStatus, networkMember: organizations.networkMember,
  }).from(chargingStations).leftJoin(organizations, eq(chargingStations.organizationId, organizations.id)).where(eq(chargingStations.id, stationId)).limit(1);

  if (!station) return { staged: false, reason: "STATION_NOT_FOUND" as const, externalRequest: false as const };
  const eligibility = getSiemEligibility(station as any);
  if (!eligibility.eligible) return { staged: false, reason: eligibility.reason, externalRequest: false as const };

  const activeEvses = await db.select().from(evses).where(and(eq(evses.stationId, stationId), eq(evses.isActive, 1)));
  const settings: any = await getPlatformSettings();
  const location = mapStationToOcpiLocation(station as any, activeEvses as any, {
    countryCode: settings?.ocpiCountryCode || "CO",
    partyId: settings?.ocpiPartyId || "EVG",
  }, "SIEM");
  await stageOcpiEvent(db, {
    eventType: "LOCATION_UPSERT",
    organizationId: station.organizationId,
    stationId,
    dedupeKey: getLocationDedupeKey(stationId),
    payload: location,
  });
  return { staged: true, externalRequest: false as const };
}
