import { describe, expect, it } from "vitest";
import { getOcpiEligibility, getSiemEligibility, mapStationToOcpiLocation } from "./ocpi-catalog";

const station = { id: 12, name: "EVG Diamante", address: "Calle 1 # 2-3", city: "Bogotá", country: "Colombia", latitude: "4.65", longitude: "-74.1", timezone: "America/Bogota", isActive: 1, isPublic: 1, networkAccessMode: "ROAMING" as const, siemReportingEnabled: 1, organizationStatus: "ACTIVE", networkMember: 1 };

describe("catálogo OCPI de roaming", () => {
  it("solo publica estaciones roaming activas y de un tenant habilitado", () => {
    expect(getOcpiEligibility(station)).toEqual({ eligible: true });
    expect(getOcpiEligibility({ ...station, networkAccessMode: "PRIVATE" })).toMatchObject({ eligible: false });
    expect(getOcpiEligibility({ ...station, networkMember: 0 })).toMatchObject({ eligible: false });
  });
  it("separa el reporte SIEM de la red comercial ROAMING", () => {
    const publicNetworkStation = { ...station, networkAccessMode: "EVGREEN_NETWORK" as const, networkMember: 0 };
    expect(getSiemEligibility(publicNetworkStation)).toEqual({ eligible: true });
    expect(getSiemEligibility({ ...publicNetworkStation, siemReportingEnabled: 0 })).toMatchObject({ eligible: false });
    expect(getSiemEligibility({ ...publicNetworkStation, isPublic: 0 })).toMatchObject({ eligible: false });
    const location = mapStationToOcpiLocation(publicNetworkStation, [{ id: 7, evseIdLocal: 1, connectorId: 1, connectorType: "CCS_2", chargeType: "DC", powerKw: "120", connectorStatus: "AVAILABLE", isActive: 1 }], { countryCode: "CO", partyId: "EVG" }, "SIEM");
    expect(location.id).toBe("EVG12");
  });
  it("mapea estación, EVSE y conector al contrato Locations OCPI", () => {
    const location = mapStationToOcpiLocation(station, [{ id: 7, evseIdLocal: 1, connectorId: 1, connectorType: "CCS_2", chargeType: "DC", powerKw: "120", maxVoltage: 500, maxAmperage: 240, connectorStatus: "AVAILABLE", isActive: 1 }], { countryCode: "CO", partyId: "EVG" });
    expect(location.id).toBe("EVG12");
    expect(location.evses[0].status).toBe("AVAILABLE");
    expect(location.evses[0].connectors[0]).toMatchObject({ standard: "IEC_62196_T2_COMBO", max_electric_power: 120000 });
  });
});
