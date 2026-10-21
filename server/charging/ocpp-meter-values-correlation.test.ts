import { describe, expect, it } from "vitest";
import { matchesOcppMeterValuesScope } from "../../shared/ocpp-meter-values-correlation";

const scope = {
  stationId: 150001,
  evseId: 150001,
  ocppNumericTxId: 1023,
};

describe("correlación segura de MeterValues OCPP 1.6", () => {
  it("acepta la sesión activa que coincide con estación, conector e ID OCPP", () => {
    expect(matchesOcppMeterValuesScope({
      stationId: 150001,
      evseId: 150001,
      ocppNumericTxId: 1023,
      status: "IN_PROGRESS",
      transactionStatus: "IN_PROGRESS",
      endTime: null,
    }, scope)).toBe(true);
  });

  it("rechaza un mapa stale para otro conector o transactionId", () => {
    expect(matchesOcppMeterValuesScope({
      stationId: 150001,
      evseId: 150002,
      ocppNumericTxId: 1023,
      status: "IN_PROGRESS",
      endTime: null,
    }, scope)).toBe(false);
    expect(matchesOcppMeterValuesScope({
      stationId: 150001,
      evseId: 150001,
      ocppNumericTxId: 1024,
      status: "IN_PROGRESS",
      endTime: null,
    }, scope)).toBe(false);
  });

  it("rechaza una sesión ya finalizada aunque su mapa siga en memoria", () => {
    expect(matchesOcppMeterValuesScope({
      stationId: 150001,
      evseId: 150001,
      ocppNumericTxId: 1023,
      status: "IN_PROGRESS",
      endTime: "2026-10-21T12:00:00Z",
    }, scope)).toBe(false);
  });
});
