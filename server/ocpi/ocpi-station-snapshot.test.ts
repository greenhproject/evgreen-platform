import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPlatformSettings: vi.fn(), stageOcpiEvent: vi.fn() }));

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal() as Record<string, unknown>),
  getPlatformSettings: mocks.getPlatformSettings,
}));
vi.mock("./ocpi-outbox", async (importOriginal) => ({
  ...(await importOriginal() as Record<string, unknown>),
  stageOcpiEvent: mocks.stageOcpiEvent,
}));

import { stageSiemLocationSnapshot } from "./ocpi-station-snapshot";

function eligibleDb(overrides: Record<string, unknown> = {}) {
  const station = { id: 42, name: "Diamante", address: "Calle 1", city: "Bogotá", country: "Colombia", latitude: "4.6", longitude: "-74.1", timezone: "America/Bogota", isActive: 1, isPublic: 1, siemReportingEnabled: 1, networkAccessMode: "EVGREEN_NETWORK", organizationId: 9, organizationStatus: "ACTIVE", networkMember: 0, ...overrides };
  const stationLimit = vi.fn(async () => [station]);
  const stationWhere = vi.fn(() => ({ limit: stationLimit }));
  const stationJoin = vi.fn(() => ({ where: stationWhere }));
  const evseWhere = vi.fn(async () => [{ id: 3, evseIdLocal: 1, connectorId: 1, connectorType: "TYPE_2", connectorStatus: "AVAILABLE", powerKw: "7.4", isActive: 1 }]);
  return { select: vi.fn((fields?: unknown) => fields ? { from: vi.fn(() => ({ leftJoin: stationJoin })) } : { from: vi.fn(() => ({ where: evseWhere })) }) };
}

describe("snapshot de Location SIEM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformSettings.mockResolvedValue({ ocpiCountryCode: "CO", ocpiPartyId: "EVG" });
    mocks.stageOcpiEvent.mockResolvedValue({ staged: true, externalRequest: false });
  });

  it("encola un Location actualizado con tenant y clave idempotente para una estación elegible", async () => {
    const db = eligibleDb();
    await expect(stageSiemLocationSnapshot(42, db)).resolves.toEqual({ staged: true, externalRequest: false });
    expect(mocks.stageOcpiEvent).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "LOCATION_UPSERT", organizationId: 9, stationId: 42, dedupeKey: "SIEM:LOCATION_UPSERT:station:42" }));
  });

  it("no encola estaciones privadas o deshabilitadas para SIEM", async () => {
    const db = eligibleDb({ isPublic: 0, siemReportingEnabled: 0, networkAccessMode: "PRIVATE" });
    await expect(stageSiemLocationSnapshot(42, db)).resolves.toMatchObject({ staged: false, externalRequest: false });
    expect(mocks.stageOcpiEvent).not.toHaveBeenCalled();
  });
});
