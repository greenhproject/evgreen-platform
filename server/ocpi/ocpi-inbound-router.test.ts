import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformSettings: vi.fn(),
  getDb: vi.fn(),
  decryptOcpiSecret: vi.fn((value: string) => value),
}));

vi.mock("../db", () => ({ getPlatformSettings: mocks.getPlatformSettings, getDb: mocks.getDb }));
vi.mock("./ocpi-secrets", () => ({ decryptOcpiSecret: mocks.decryptOcpiSecret }));

import ocpiInboundRouter, { isValidOcpiInboundToken } from "./ocpi-inbound-router";

const locationPayload = {
  id: "LOC-001", name: "CargaME Centro", address: "Calle 10 # 12-34", city: "Bogotá",
  publish: true, coordinates: { latitude: "4.60971", longitude: "-74.08175" }, last_updated: "2026-08-17T18:00:00Z",
};

function createDb(existing: Array<{ id: number }> = []) {
  const insertValues = vi.fn().mockResolvedValue([{ insertId: 7 }]);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const selectLimit = vi.fn().mockResolvedValue(existing);
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: selectLimit })) })) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
    spies: { insertValues, updateSet, updateWhere, selectLimit },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/ocpi/2.2.1", ocpiInboundRouter);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}` };
}

describe("OCPI inbound Locations", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("rechaza solicitudes si el administrador aún no configuró token entrante", async () => {
    mocks.getPlatformSettings.mockResolvedValue({ ocpiInboundTokenEncrypted: null });
    const { server, url } = await startServer();
    const response = await fetch(`${url}/ocpi/2.2.1/locations/CO/CMG/LOC-001`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(locationPayload) });
    expect(response.status).toBe(503);
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("rechaza un token OCPI inválido sin acceder a la base de datos", async () => {
    mocks.getPlatformSettings.mockResolvedValue({ ocpiInboundTokenEncrypted: "secreto-oficial" });
    const { server, url } = await startServer();
    const response = await fetch(`${url}/ocpi/2.2.1/locations/CO/CMG/LOC-001`, { method: "PUT", headers: { authorization: "Token incorrecto", "content-type": "application/json" }, body: JSON.stringify(locationPayload) });
    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("recibe una Location autenticada y crea un registro remoto independiente", async () => {
    const db = createDb();
    mocks.getPlatformSettings.mockResolvedValue({ ocpiInboundTokenEncrypted: "secreto-oficial" });
    mocks.getDb.mockResolvedValue(db);
    const { server, url } = await startServer();
    const response = await fetch(`${url}/ocpi/2.2.1/locations/co/cmg/LOC-001`, { method: "PUT", headers: { authorization: "Token secreto-oficial", "content-type": "application/json" }, body: JSON.stringify(locationPayload) });
    expect(response.status).toBe(200);
    expect(db.spies.insertValues).toHaveBeenCalledWith(expect.objectContaining({ provider: "CARGAME", countryCode: "CO", partyId: "CMG", locationId: "LOC-001", rawLocation: locationPayload }));
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("actualiza idempotentemente una Location que ya fue recibida", async () => {
    const db = createDb([{ id: 42 }]);
    mocks.getPlatformSettings.mockResolvedValue({ ocpiInboundTokenEncrypted: "secreto-oficial" });
    mocks.getDb.mockResolvedValue(db);
    const { server, url } = await startServer();
    const response = await fetch(`${url}/ocpi/2.2.1/locations/CO/CMG/LOC-001`, { method: "PUT", headers: { authorization: "Token secreto-oficial", "content-type": "application/json" }, body: JSON.stringify(locationPayload) });
    expect(response.status).toBe(200);
    expect(db.spies.updateSet).toHaveBeenCalledWith(expect.objectContaining({ locationId: "LOC-001", status: "ACTIVE" }));
    expect(db.spies.updateWhere).toHaveBeenCalled();
    expect(db.spies.insertValues).not.toHaveBeenCalled();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("mantiene aisladas Locations con el mismo ID cuando pertenecen a partners distintos", async () => {
    const db = createDb();
    mocks.getPlatformSettings.mockResolvedValue({ ocpiInboundTokenEncrypted: "secreto-oficial" });
    mocks.getDb.mockResolvedValue(db);
    const { server, url } = await startServer();
    const request = (partyId: string) => fetch(`${url}/ocpi/2.2.1/locations/CO/${partyId}/LOC-001`, { method: "PUT", headers: { authorization: "Token secreto-oficial", "content-type": "application/json" }, body: JSON.stringify(locationPayload) });
    const [first, second] = await Promise.all([request("CMG"), request("EVG")]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(db.spies.insertValues).toHaveBeenCalledTimes(2);
    expect(db.spies.insertValues).toHaveBeenNthCalledWith(1, expect.objectContaining({ countryCode: "CO", partyId: "CMG", locationId: "LOC-001" }));
    expect(db.spies.insertValues).toHaveBeenNthCalledWith(2, expect.objectContaining({ countryCode: "CO", partyId: "EVG", locationId: "LOC-001" }));
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("compara tokens de igual longitud de forma segura", () => {
    expect(isValidOcpiInboundToken("Token secreto-oficial", "secreto-oficial")).toBe(true);
    expect(isValidOcpiInboundToken("Token corto", "secreto-oficial")).toBe(false);
  });
});
