import { describe, expect, it } from "vitest";
import { buildInitialMeterValuesTrigger } from "../../shared/ocpp-initial-meter-values";

describe("solicitud de primera lectura OCPP", () => {
  it("usa el selector de conector de OCPP 1.6", () => {
    expect(buildInitialMeterValuesTrigger({
      ocppVersion: "1.6",
      evseId: 7,
      connectorId: 2,
    })).toEqual({ requestedMessage: "MeterValues", connectorId: 2 });
  });

  it("usa la estructura EVSE de OCPP 2.0.1", () => {
    expect(buildInitialMeterValuesTrigger({
      ocppVersion: "2.0.1",
      evseId: 7,
      connectorId: 2,
    })).toEqual({
      requestedMessage: "MeterValues",
      evse: { id: 7, connectorId: 2 },
    });
  });
});
