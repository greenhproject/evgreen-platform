export type OcpiStationInput = {
  id: number; name: string; address: string; city: string; country: string; latitude: string | number;
	longitude: string | number; timezone?: string | null; isActive: number | boolean; isPublic: number | boolean;
	networkAccessMode: "PRIVATE" | "EVGREEN_NETWORK" | "ROAMING"; siemReportingEnabled?: number | boolean | null;
	organizationStatus?: string | null; networkMember?: number | boolean | null;
};
export type OcpiEvseInput = { id: number; evseIdLocal: number; connectorId: number; connectorType: string; chargeType: "AC" | "DC"; powerKw: string | number; maxVoltage?: number | null; maxAmperage?: number | null; connectorStatus: string; isActive: number | boolean; updatedAt?: string | null; };

const connectorMap: Record<string, string> = { TYPE_1: "IEC_62196_T1", TYPE_2: "IEC_62196_T2", CCS_1: "IEC_62196_T1_COMBO", CCS_2: "IEC_62196_T2_COMBO", CHADEMO: "CHADEMO", TESLA: "TESLA_R", GBT_AC: "GBT", GBT_DC: "GBT" };
const statusMap: Record<string, string> = { AVAILABLE: "AVAILABLE", PREPARING: "BLOCKED", CHARGING: "CHARGING", FINISHING: "BLOCKED", RESERVED: "RESERVED", FAULTED: "OUTOFORDER", UNAVAILABLE: "INOPERATIVE", SUSPENDED_EV: "BLOCKED", SUSPENDED_EVSE: "BLOCKED" };

export function getOcpiEligibility(station: OcpiStationInput): { eligible: boolean; reason?: string } {
  if (station.networkAccessMode !== "ROAMING") return { eligible: false, reason: "La estación no está marcada para ROAMING." };
  if (!station.isActive || !station.isPublic) return { eligible: false, reason: "La estación debe estar activa y pública." };
  if (station.organizationStatus && !["ACTIVE", "TRIAL", "active", "trial"].includes(station.organizationStatus)) return { eligible: false, reason: "La organización propietaria no está activa." };
  if (station.organizationStatus && !station.networkMember) return { eligible: false, reason: "La organización no pertenece a la red EVGreen." };
	return { eligible: true };
}

export function getSiemEligibility(station: OcpiStationInput): { eligible: boolean; reason?: string } {
	if (!station.siemReportingEnabled) return { eligible: false, reason: "El reporte SIEM no está habilitado para esta estación." };
	if (!station.isActive || !station.isPublic) return { eligible: false, reason: "La estación debe estar activa y pública para reportar al SIEM." };
	if (station.organizationStatus && !["ACTIVE", "TRIAL", "active", "trial"].includes(station.organizationStatus)) return { eligible: false, reason: "La organización propietaria no está activa." };
	return { eligible: true };
}

export function mapStationToOcpiLocation(station: OcpiStationInput, evses: OcpiEvseInput[], identity: { countryCode: string; partyId: string }, scope: "ROAMING" | "SIEM" = "ROAMING") {
	const eligibility = scope === "SIEM" ? getSiemEligibility(station) : getOcpiEligibility(station);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  const activeEvses = evses.filter(evse => Boolean(evse.isActive));
  return {
    country_code: identity.countryCode, party_id: identity.partyId, id: `EVG${station.id}`, publish: true,
    name: station.name, address: station.address, city: station.city, country: station.country || "Colombia",
    coordinates: { latitude: String(station.latitude), longitude: String(station.longitude) }, time_zone: station.timezone || "America/Bogota",
    evses: activeEvses.map(evse => ({
      uid: `EVG${station.id}E${evse.evseIdLocal}C${evse.connectorId}`, evse_id: `EVG${station.id}E${evse.evseIdLocal}`,
      status: statusMap[evse.connectorStatus] || "UNKNOWN", capabilities: ["REMOTE_START_STOP_CAPABLE"],
      connectors: [{ id: String(evse.connectorId), standard: connectorMap[evse.connectorType] || "OTHER", format: evse.chargeType === "DC" ? "CABLE" : "SOCKET", power_type: evse.chargeType === "DC" ? "DC" : "AC_3_PHASE", max_voltage: evse.maxVoltage || 0, max_amperage: evse.maxAmperage || 0, max_electric_power: Number(evse.powerKw) * 1000, last_updated: evse.updatedAt || new Date().toISOString() }],
      last_updated: evse.updatedAt || new Date().toISOString(),
    })), last_updated: new Date().toISOString(),
  };
}
