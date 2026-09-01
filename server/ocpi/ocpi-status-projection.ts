import type { ConnectorStatus } from "../charging/connector-state.service";

export type OcpiEvseStatus = "AVAILABLE" | "BLOCKED" | "CHARGING" | "INOPERATIVE" | "OUTOFORDER" | "RESERVED" | "UNKNOWN";

const OCPI_STATUS_MAP: Record<ConnectorStatus, OcpiEvseStatus> = {
  AVAILABLE: "AVAILABLE",
  PREPARING: "BLOCKED",
  CHARGING: "CHARGING",
  SUSPENDED_EVSE: "BLOCKED",
  SUSPENDED_EV: "BLOCKED",
  FINISHING: "BLOCKED",
  RESERVED: "RESERVED",
  UNAVAILABLE: "INOPERATIVE",
  FAULTED: "OUTOFORDER",
};

export function toOcpiEvseStatus(status: ConnectorStatus): OcpiEvseStatus {
  return OCPI_STATUS_MAP[status] ?? "UNKNOWN";
}

export function getEvseStatusDedupeKey(stationId: number, evseId: number) {
  return `SIEM:EVSE_STATUS:station:${stationId}:evse:${evseId}`;
}

export function buildOcpiEvseStatusPayload(input: { countryCode: string; partyId: string; stationId: number; evseId: number; evseUid?: number | null; status: ConnectorStatus; updatedAt: string }) {
  return {
    country_code: input.countryCode,
    party_id: input.partyId,
    location_id: `EVG${input.stationId}`,
    evse_uid: String(input.evseUid ?? input.evseId),
    status: toOcpiEvseStatus(input.status),
    last_updated: input.updatedAt,
  };
}
