import { describe, expect, it } from "vitest";
import {
  doesConnectorQrMatchStation,
  isValidConnectorQrToken,
  resolveConnectorQrTarget,
} from "../../shared/connector-qr-policy";

const token = "Q4wK7vAq6XC2uvSYGfD7w7k4y3h8P_01";
const connector = {
  id: 81,
  stationId: 12,
  evseIdLocal: 2,
  connectorId: 2,
  connectorLabel: "Pistola B",
  isActive: 1,
};
const station = { id: 12, name: "Estación Ingativa", ocppIdentity: "ING-01", isActive: 1 };

describe("connector QR policy", () => {
  it("rejects malformed tokens before any connector can be selected", () => {
    expect(isValidConnectorQrToken("12")).toBe(false);
    expect(resolveConnectorQrTarget({ token: "not a valid token", connector, station })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("no es válido"),
    });
  });

  it("rejects a revoked or inactive connector QR", () => {
    expect(resolveConnectorQrTarget({ token, connector: { ...connector, isActive: 0 }, station })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("revocado"),
    });
  });

  it("rejects a QR when its station is inactive or mismatched", () => {
    expect(resolveConnectorQrTarget({ token, connector, station: { ...station, id: 13 } })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("estación"),
    });
  });

  it("binds a valid QR to exactly one station and EVSE", () => {
    const result = resolveConnectorQrTarget({ token, connector, station });
    expect(result).toEqual({
      ok: true,
      target: {
        stationId: 12,
        stationCode: "ING-01",
        stationName: "Estación Ingativa",
        evseId: 81,
        connectorId: 2,
        connectorLabel: "Pistola B",
      },
    });
    if (result.ok) {
      expect(doesConnectorQrMatchStation(result.target, 12)).toBe(true);
      expect(doesConnectorQrMatchStation(result.target, 99)).toBe(false);
    }
  });
});
