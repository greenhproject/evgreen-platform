export type StationMarkerFingerprintInput = {
  id: number;
  latitude: string | number;
  longitude: string | number;
  evses?: Array<{
    id?: number;
    chargeType?: string;
    connectorType?: string;
    connectorStatus?: string;
    status?: string;
  }>;
};

/**
 * Excludes user-distance presentation data so GPS ticks do not remount every
 * station marker. Only marker-relevant station state participates in the key.
 */
export function createStationMarkerFingerprint(stations: StationMarkerFingerprintInput[]): string {
  return stations
    .map((station) => {
      const evseState = (station.evses || [])
        .map((evse) => [
          evse.id ?? "",
          evse.chargeType ?? "",
          evse.connectorType ?? "",
          evse.connectorStatus ?? evse.status ?? "",
        ].join(":"))
        .sort()
        .join(",");

      return [station.id, station.latitude, station.longitude, evseState].join("|");
    })
    .sort()
    .join(";");
}
