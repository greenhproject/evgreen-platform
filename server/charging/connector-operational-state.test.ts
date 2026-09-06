import { describe, expect, it } from "vitest";
import {
  normalizeConnectorStatus,
  resolveConnectorOperationalState,
} from "../../shared/connector-operational-state";

describe("connector operational state projection", () => {
  it("normaliza estados OCPP y persistidos con distintas convenciones", () => {
    expect(normalizeConnectorStatus("Charging")).toBe("CHARGING");
    expect(normalizeConnectorStatus("Occupied")).toBe("CHARGING");
    expect(normalizeConnectorStatus("SuspendedEVSE")).toBe("SUSPENDED_EVSE");
    expect(normalizeConnectorStatus("AVAILABLE")).toBe("AVAILABLE");
  });

  it("clasifica como cargando una transacción activa aunque la memoria OCPP esté vacía", () => {
    expect(resolveConnectorOperationalState({
      liveOcppStatus: null,
      persistedStatus: undefined,
      activeTransactionId: 1140015,
    })).toMatchObject({
      status: "CHARGING",
      source: "active_transaction",
      hasActiveTransaction: true,
      isCharging: true,
      isAvailable: false,
    });
  });

  it("prioriza la transacción activa sobre un estado Available transitoriamente rezagado", () => {
    expect(resolveConnectorOperationalState({
      liveOcppStatus: "Available",
      persistedStatus: "AVAILABLE",
      activeTransactionId: 77,
    })).toMatchObject({ status: "CHARGING", source: "active_transaction", isCharging: true });
  });

  it("usa OCPP y luego la base cuando no existe transacción activa", () => {
    expect(resolveConnectorOperationalState({
      liveOcppStatus: "Preparing",
      persistedStatus: "AVAILABLE",
    })).toMatchObject({ status: "PREPARING", source: "ocpp_memory" });
    expect(resolveConnectorOperationalState({
      persistedStatus: "CHARGING",
    })).toMatchObject({ status: "CHARGING", source: "database", isCharging: true });
  });
});
