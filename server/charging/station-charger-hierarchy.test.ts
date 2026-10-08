import { describe, expect, it } from "vitest";
import {
  buildStationChargerHierarchy,
  canStartOnConnectorWithinCharger,
  calculatePhysicalStationOccupancy,
} from "../../shared/station-charger-hierarchy";

const liboltek = {
  id: 31,
  chargerCode: "ING-DC-03",
  displayName: "Cargador 03",
  manufacturer: "Liboltek",
  maxConcurrentSessions: 2,
};

const connectorA = {
  id: 101,
  chargerId: 31,
  connectorId: 1,
  connectorLabel: "Pistola A",
  connectorType: "CCS_2",
  powerKw: "120",
  connectorStatus: "CHARGING",
  isActive: 1,
};

const connectorB = {
  id: 102,
  chargerId: 31,
  connectorId: 2,
  connectorLabel: "Pistola B",
  connectorType: "CCS_2",
  powerKw: "120",
  connectorStatus: "AVAILABLE",
  isActive: 1,
};

describe("station charger hierarchy", () => {
  it("groups a dual-output Liboltek charger and preserves independent capacity", () => {
    const [group] = buildStationChargerHierarchy([liboltek], [connectorA, connectorB]);

    expect(group.label).toBe("Cargador 03");
    expect(group.connectors.map((connector) => connector.label)).toEqual(["Pistola A", "Pistola B"]);
    expect(group.concurrentCapacity).toBe(2);
    expect(group.occupiedOrHeldSlots).toBe(1);
    expect(group.availableSlots).toBe(1);
    expect(group.supportsIndependentSessions).toBe(true);
  });

  it("permits an independent second connector when the configured concurrent capacity is two", () => {
    expect(canStartOnConnectorWithinCharger(liboltek, [connectorA, connectorB], connectorB.id)).toEqual({ allowed: true });
  });

  it("blocks the other connector for non-simultaneous equipment", () => {
    const nonSimultaneous = { ...liboltek, maxConcurrentSessions: 1 };
    expect(canStartOnConnectorWithinCharger(nonSimultaneous, [connectorA, connectorB], connectorB.id)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("límite operativo de 1 sesión"),
    });
  });

  it("measures a four-cabinet Liboltek station by eight concurrent physical slots", () => {
    const chargers = Array.from({ length: 4 }, (_, index) => ({
      ...liboltek,
      id: index + 1,
      chargerCode: `ING-DC-${String(index + 1).padStart(2, "0")}`,
    }));
    const connectors = chargers.flatMap((charger) => [
      { ...connectorA, id: charger.id * 10 + 1, chargerId: charger.id, connectorStatus: "CHARGING" },
      { ...connectorB, id: charger.id * 10 + 2, chargerId: charger.id, connectorStatus: "AVAILABLE" },
    ]);

    expect(calculatePhysicalStationOccupancy(chargers, connectors)).toEqual({
      totalConnectorOutputs: 8,
      totalConcurrentCapacity: 8,
      occupiedOrHeldCapacity: 4,
      availableConcurrentCapacity: 4,
    });
  });

  it("keeps legacy unassigned connectors independently usable during migration", () => {
    expect(calculatePhysicalStationOccupancy([], [connectorA, connectorB].map(({ chargerId, ...connector }) => connector))).toMatchObject({
      totalConnectorOutputs: 2,
      totalConcurrentCapacity: 2,
      occupiedOrHeldCapacity: 1,
      availableConcurrentCapacity: 1,
    });
  });
});
