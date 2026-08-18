import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformSettings: vi.fn(),
  stageOcpiEvent: vi.fn(),
}));

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal() as Record<string, unknown>),
  getPlatformSettings: mocks.getPlatformSettings,
}));
vi.mock("../ocpi/ocpi-outbox", async (importOriginal) => ({
  ...(await importOriginal() as Record<string, unknown>),
  stageOcpiEvent: mocks.stageOcpiEvent,
}));

import { ConnectorStateService } from "./connector-state.service";

function dbForStation(station: Record<string, unknown>) {
  const limit = vi.fn(async () => [station]);
  const where = vi.fn(() => ({ limit }));
  const leftJoin = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from: vi.fn(() => ({ leftJoin })) })) };
}

describe("ConnectorStateService → cola SIEM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformSettings.mockResolvedValue({ ocpiCountryCode: "CO", ocpiPartyId: "EVG" });
  });

  it("encola el último estado de un EVSE SIEM elegible con tenant y clave idempotente", async () => {
    const db = dbForStation({ id: 12, organizationId: 7, isActive: 1, isPublic: 1, networkAccessMode: "EVGREEN_NETWORK", siemReportingEnabled: 1, organizationStatus: "ACTIVE", networkMember: 0 });
    mocks.stageOcpiEvent.mockResolvedValue({ staged: true, externalRequest: false });

    await ConnectorStateService._stageSiemEvseStatus({ id: 99, stationId: 12, evseIdLocal: 2 }, "CHARGING", db);

    expect(mocks.stageOcpiEvent).toHaveBeenCalledWith(db, expect.objectContaining({
      eventType: "EVSE_STATUS", organizationId: 7, stationId: 12, dedupeKey: "SIEM:EVSE_STATUS:station:12:evse:99",
      payload: expect.objectContaining({ country_code: "CO", party_id: "EVG", location_id: "EVG12", evse_uid: "2", status: "CHARGING" }),
    }));
  });

  it("no encola estaciones privadas o no habilitadas para reporte SIEM", async () => {
    const db = dbForStation({ id: 12, organizationId: 7, isActive: 1, isPublic: 0, networkAccessMode: "PRIVATE", siemReportingEnabled: 0, organizationStatus: "ACTIVE", networkMember: 0 });

    await ConnectorStateService._stageSiemEvseStatus({ id: 99, stationId: 12, evseIdLocal: 2 }, "FAULTED", db);

    expect(mocks.stageOcpiEvent).not.toHaveBeenCalled();
  });
});
