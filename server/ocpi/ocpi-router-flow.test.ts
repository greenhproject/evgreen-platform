import { beforeEach, describe, expect, it, vi } from "vitest";
import { initTRPC } from "@trpc/server";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getPlatformSettings: vi.fn(),
  upsertPlatformSettings: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
  getPlatformSettings: mocks.getPlatformSettings,
  upsertPlatformSettings: mocks.upsertPlatformSettings,
}));

import { buildOcpiRouter } from "./ocpi-router";

const eligibleStation = {
	id: 41, name: "Red EVGreen Norte", address: "Calle 100 # 10-10", city: "Bogotá", country: "Colombia",
	latitude: "4.70", longitude: "-74.05", timezone: "America/Bogota", isActive: 1, isPublic: 1, siemReportingEnabled: 1,
	networkAccessMode: "EVGREEN_NETWORK", organizationId: 8, organizationStatus: "ACTIVE", networkMember: 0,
};
const privateStation = { ...eligibleStation, id: 42, name: "Privada", networkAccessMode: "PRIVATE", isPublic: 0 };
const evseRows = [{ id: 1, stationId: 41, evseIdLocal: 1, connectorId: 1, connectorType: "CCS_2", chargeType: "DC", powerKw: "60", maxVoltage: 400, maxAmperage: 150, connectorStatus: "AVAILABLE", isActive: 1 }];

function setupDb() {
  const stationWhere = vi.fn(async () => [eligibleStation, privateStation]);
  const evseWhere = vi.fn(async () => evseRows);
  const insertValues = vi.fn(async () => [{ insertId: 77 }]);
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: stationWhere })), where: evseWhere })) })),
    insert: vi.fn(() => ({ values: insertValues })),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, insertValues };
}

function createCaller() {
  const t = initTRPC.context<{ user: { id: number } }>().create();
  return buildOcpiRouter(t.router, t.procedure).createCaller({ user: { id: 15 } });
}

describe("flujo administrativo del catálogo OCPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformSettings.mockResolvedValue({ ocpiCountryCode: "CO", ocpiPartyId: "EVG", ocpiEnabled: 0, ocpiVersionsUrl: null, ocpiTokenEncrypted: null });
  });

  it("excluye estaciones no elegibles del catálogo generado", async () => {
    setupDb();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const catalog = await createCaller().getCatalog();
    expect(catalog.eligibleCount).toBe(1);
    expect(catalog.entries.find((entry: any) => entry.stationId === 42)).toMatchObject({ eligibility: { eligible: false } });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("previsualiza y registra publicación manual sin llamar fetch cuando OCPI está desactivado", async () => {
    const { insertValues } = setupDb();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const caller = createCaller();

    await expect(caller.previewCatalog()).resolves.toMatchObject({ success: true, eligibleCount: 1 });
    await expect(caller.publishCatalog()).resolves.toMatchObject({ success: true, dryRun: true, externalRequest: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(insertValues.mock.calls[0][0]).toMatchObject({ operation: "CATALOG_PREVIEW", status: "SUCCESS" });
    expect(insertValues.mock.calls[1][0]).toMatchObject({ operation: "LOCATION_PUBLISH", status: "SKIPPED", details: { dryRun: true, externalRequest: false } });
    fetchSpy.mockRestore();
  });

  it("valida un evento en la cola local sin realizar tráfico externo", async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    mocks.getDb.mockResolvedValue({ update: vi.fn(() => ({ set })) });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(createCaller().validateOutboxDryRun({ eventId: 55, outcome: "SENT" })).resolves.toMatchObject({ success: true, status: "SENT", externalRequest: false });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "SENT", lastError: null }));
    await expect(createCaller().validateOutboxDryRun({ eventId: 55, outcome: "FAILED" })).resolves.toMatchObject({ success: true, status: "FAILED", externalRequest: false });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "FAILED", lastError: "Validación local OCPI sin solicitud externa." }));
    await expect(createCaller().validateOutboxDryRun({ eventId: 55, outcome: "DEAD" })).resolves.toMatchObject({ success: true, status: "DEAD", externalRequest: false });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "DEAD" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("lista únicamente metadatos seguros de la cola, sin payload ni claves de deduplicación", async () => {
    let projection: Record<string, unknown> | undefined;
    mocks.getDb.mockResolvedValue({
      select: vi.fn((fields: Record<string, unknown>) => {
        projection = fields;
        return { from: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) };
      }),
    });

    await expect(createCaller().listOutboxEvents()).resolves.toEqual([]);
    expect(projection).toBeDefined();
    expect(projection).not.toHaveProperty("payload");
    expect(projection).not.toHaveProperty("dedupeKey");
  });
});
