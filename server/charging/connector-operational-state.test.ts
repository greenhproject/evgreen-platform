import { describe, expect, it } from "vitest";
import {
  isLiveOcppStatusFresh,
  normalizeConnectorStatus,
  projectOperationalConnectorStates,
  resolveConnectorOperationalState,
  summarizeOperationalConnectorAvailability,
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

  it("no deja que una caché OCPP anterior contradiga el último estado físico persistido", () => {
    const persistedAt = new Date("2026-10-09T00:32:00.000Z");
    const staleLiveAt = new Date("2026-10-04T18:18:00.000Z");

    expect(isLiveOcppStatusFresh({
      liveOcppStatus: "Charging",
      liveOcppStatusAt: staleLiveAt,
      persistedStatus: "AVAILABLE",
      persistedStatusAt: persistedAt,
    })).toBe(false);

    expect(resolveConnectorOperationalState({
      liveOcppStatus: "Charging",
      liveOcppStatusAt: staleLiveAt,
      persistedStatus: "AVAILABLE",
      persistedStatusAt: persistedAt,
    })).toMatchObject({
      status: "AVAILABLE",
      source: "database",
      isAvailable: true,
    });
  });

  it("mantiene una lectura OCPP reciente cuando no existe transacción activa", () => {
    const persistedAt = new Date("2026-10-09T00:32:00.000Z");
    const liveAt = new Date("2026-10-09T00:32:05.000Z");
    expect(resolveConnectorOperationalState({
      liveOcppStatus: "Preparing",
      liveOcppStatusAt: liveAt,
      persistedStatus: "AVAILABLE",
      persistedStatusAt: persistedAt,
    })).toMatchObject({ status: "PREPARING", source: "ocpp_memory", isPreparing: true });
  });

  it("no cuenta como disponible un AVAILABLE persistido si hay una transacción activa", () => {
    const summary = summarizeOperationalConnectorAvailability([
      { id: 1, connectorStatus: "AVAILABLE", activeTransactionId: 1140025 },
    ]);
    expect(summary).toMatchObject({
      totalConnectors: 1,
      availableConnectors: 0,
      chargingConnectors: 1,
    });
  });

  it("proyecta connectorStatus canónico para todas las superficies", () => {
    const [connector] = projectOperationalConnectorStates([
      { id: 1, connectorStatus: "AVAILABLE", liveOcppStatus: "Preparing" },
    ]);
    expect(connector).toMatchObject({
      connectorStatus: "PREPARING",
      operationalStatus: "PREPARING",
      isAvailable: false,
    });
  });
});
