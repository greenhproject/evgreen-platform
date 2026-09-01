import { describe, expect, it } from "vitest";
import { buildOcpiEvseStatusPayload, getEvseStatusDedupeKey, toOcpiEvseStatus } from "./ocpi-status-projection";

describe("proyección de estados EVSE hacia SIEM", () => {
  it("convierte los estados internos a estados OCPI canónicos", () => {
    expect(toOcpiEvseStatus("AVAILABLE")).toBe("AVAILABLE");
    expect(toOcpiEvseStatus("CHARGING")).toBe("CHARGING");
    expect(toOcpiEvseStatus("RESERVED")).toBe("RESERVED");
    expect(toOcpiEvseStatus("FAULTED")).toBe("OUTOFORDER");
    expect(toOcpiEvseStatus("UNAVAILABLE")).toBe("INOPERATIVE");
  });

  it("mantiene un evento idempotente por estación y EVSE sin mezclar conectores", () => {
    expect(getEvseStatusDedupeKey(10, 4)).toBe("SIEM:EVSE_STATUS:station:10:evse:4");
    expect(getEvseStatusDedupeKey(10, 4)).toBe(getEvseStatusDedupeKey(10, 4));
    expect(getEvseStatusDedupeKey(10, 5)).not.toBe(getEvseStatusDedupeKey(10, 4));
  });

  it("construye un payload mínimo sin datos de usuario ni secretos", () => {
    const payload = buildOcpiEvseStatusPayload({ countryCode: "CO", partyId: "EVG", stationId: 10, evseId: 4, evseUid: 2, status: "CHARGING", updatedAt: "2026-08-18T12:00:00.000Z" });
    expect(payload).toEqual({ country_code: "CO", party_id: "EVG", location_id: "EVG10", evse_uid: "2", status: "CHARGING", last_updated: "2026-08-18T12:00:00.000Z" });
    expect(payload).not.toHaveProperty("token");
    expect(payload).not.toHaveProperty("user_id");
  });
});
