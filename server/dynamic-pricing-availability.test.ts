import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getChargingStationById: vi.fn(),
  getEvsesByStationId: vi.fn(),
  getChargersByStationId: vi.fn(),
  getActiveTransactionsByStationId: vi.fn(),
}));
const getConnectionInfo = vi.hoisted(() => vi.fn());

vi.mock("./db", () => dbMocks);
vi.mock("./ocpp/csms-dual", () => ({ dualCSMS: { getConnectionInfo } }));

import { getZoneOccupancy } from "./pricing/dynamic-pricing";

describe("dynamic pricing canonical connector availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getChargingStationById.mockResolvedValue({ id: 150001, ocppIdentity: "EVG-DIAMANTE" });
    dbMocks.getEvsesByStationId.mockResolvedValue([
      { id: 150001, evseIdLocal: 1, connectorStatus: "AVAILABLE" },
    ]);
    dbMocks.getChargersByStationId.mockResolvedValue([]);
    getConnectionInfo.mockReturnValue(null);
  });

  it("does not advertise low demand when the persisted status lags an active charge", async () => {
    dbMocks.getActiveTransactionsByStationId.mockResolvedValue([
      { id: 1140025, evseId: 150001 },
    ]);

    await expect(getZoneOccupancy(150001)).resolves.toMatchObject({
      totalConnectors: 1,
      availableConnectors: 0,
      chargingConnectors: 1,
      occupancyRate: 100,
    });
  });

  it("uses a live OCPP occupancy state when no transaction has been persisted yet", async () => {
    dbMocks.getActiveTransactionsByStationId.mockResolvedValue([]);
    getConnectionInfo.mockReturnValue({ connectorStatuses: { 1: "Preparing" } });

    await expect(getZoneOccupancy(150001)).resolves.toMatchObject({
      availableConnectors: 0,
      chargingConnectors: 0,
      occupancyRate: 100,
    });
  });

  it("aggregates capacity for every cabinet in the station, not only the quoted connector", async () => {
    dbMocks.getChargersByStationId.mockResolvedValue([
      { id: 1, maxConcurrentSessions: 2 },
      { id: 2, maxConcurrentSessions: 2 },
      { id: 3, maxConcurrentSessions: 2 },
      { id: 4, maxConcurrentSessions: 2 },
    ]);
    dbMocks.getEvsesByStationId.mockResolvedValue(
      Array.from({ length: 4 }, (_, index) => [
        { id: index * 2 + 1, chargerId: index + 1, evseIdLocal: index * 2 + 1, connectorId: 1, connectorStatus: "CHARGING", connectorType: "CCS_2", powerKw: "120", isActive: 1 },
        { id: index * 2 + 2, chargerId: index + 1, evseIdLocal: index * 2 + 2, connectorId: 2, connectorStatus: "AVAILABLE", connectorType: "CCS_2", powerKw: "120", isActive: 1 },
      ]).flat(),
    );
    dbMocks.getActiveTransactionsByStationId.mockResolvedValue([]);

    await expect(getZoneOccupancy(150001)).resolves.toMatchObject({
      totalConnectors: 8,
      totalConcurrentCapacity: 8,
      occupiedOrHeldCapacity: 4,
      availableConcurrentCapacity: 4,
      occupancyRate: 50,
    });
  });
});
