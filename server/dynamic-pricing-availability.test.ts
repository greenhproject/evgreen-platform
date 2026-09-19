import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getChargingStationById: vi.fn(),
  getEvsesByStationId: vi.fn(),
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
});
