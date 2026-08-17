import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "http";

const { mockGetDb, mockGetChargingStationById, mockGetEvgreenNetworkStationById, mockSendGenericCommand } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetChargingStationById: vi.fn(),
  mockGetEvgreenNetworkStationById: vi.fn(),
  mockSendGenericCommand: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mockGetDb,
  getChargingStationById: mockGetChargingStationById,
  getEvgreenNetworkStationById: mockGetEvgreenNetworkStationById,
}));

vi.mock("../ocpp/csms-dual", () => ({
  dualCSMS: { sendGenericCommand: mockSendGenericCommand },
}));

import publicApiRouter from "./public-api";

const tenantAKey = {
  id: 1,
  userId: 101,
  userName: "Tenant A Staff",
  userEmail: "staff@tenant-a.test",
  userRole: "staff",
  name: "Tenant A key",
  organizationId: 10,
};

describe("REST API remote commands tenant isolation", () => {
  const app = express();
  const server = http.createServer(app);
  let baseUrl = "";

  beforeAll(async () => {
    app.use(express.json());
    app.use("/api/v1", publicApiRouter);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      execute: vi.fn()
        .mockResolvedValueOnce([[tenantAKey]])
        .mockResolvedValue([]),
    });
  });

  async function post(path: string, body: Record<string, unknown>) {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "tenant-a-secret" },
      body: JSON.stringify(body),
    });
  }

  it.each([
    ["/stations/202/start", { connectorId: 1, idTag: "tenant-a-user" }],
    ["/stations/202/stop", { transactionId: 9001 }],
  ])("returns 404 for a foreign station without OCPP on %s", async (path, body) => {
    mockGetChargingStationById.mockResolvedValue({ id: 202, organizationId: 20, ocppIdentity: null });

    const response = await post(path, body);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "NOT_FOUND" });
    expect(mockSendGenericCommand).not.toHaveBeenCalled();
  });

  it.each([
    ["/stations/202/start", { connectorId: 1, idTag: "tenant-a-user" }],
    ["/stations/202/stop", { transactionId: 9001 }],
  ])("returns the same 404 for a foreign station with OCPP on %s", async (path, body) => {
    mockGetChargingStationById.mockResolvedValue({ id: 202, organizationId: 20, ocppIdentity: "FOREIGN-OCPP" });

    const response = await post(path, body);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "NOT_FOUND" });
    expect(mockSendGenericCommand).not.toHaveBeenCalled();
  });

  it("preserves NO_OCPP for a station owned by the API key tenant", async () => {
    mockGetChargingStationById.mockResolvedValue({ id: 101, organizationId: 10, ocppIdentity: null });

    const response = await post("/stations/101/start", { connectorId: 1, idTag: "tenant-a-user" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "NO_OCPP" });
  });

  it.each(["/stations/202", "/stations/202/status"])("returns 404 when a tenant requests a foreign station through %s", async (path) => {
    mockGetEvgreenNetworkStationById.mockResolvedValue({ id: 202, organizationId: 20, ocppIdentity: "FOREIGN-OCPP" });

    const response = await fetch(`${baseUrl}${path}`, {
      headers: { "x-api-key": "tenant-a-station-key" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "NOT_FOUND" });
  });

  it("scopes station listing queries to the organization of the API key", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[tenantAKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[]]);
    mockGetDb.mockResolvedValue({ execute });

    const response = await fetch(`${baseUrl}/stations`, {
      headers: { "x-api-key": "tenant-a-list-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: [] });
    expect(JSON.stringify(execute.mock.calls[2][0])).toContain("cs.organization_id = 10");
  });

  it("scopes aggregate statistics to the organization of the API key", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[tenantAKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ totalKwh: 50, totalRevenue: 90000, totalSessions: 2 }]]);
    mockGetDb.mockResolvedValue({ execute });

    const response = await fetch(`${baseUrl}/stats/overview`, {
      headers: { "x-api-key": "tenant-a-stats-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { stations: { total: 1 }, last30Days: { totalRevenueCOP: 90000 } },
    });
    const generatedQueries = execute.mock.calls.slice(1).map(([query]) => JSON.stringify(query)).join(" ");
    expect(generatedQueries).toContain("organization_id = 10");
  });

  it("scopes energy statistics to the organization of the API key", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[tenantAKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ period: "2026-08-17", energyKwh: 50, revenue: 90000, sessions: 2, avgEnergyPerSession: 25 }]]);
    mockGetDb.mockResolvedValue({ execute });

    const response = await fetch(`${baseUrl}/stats/energy`, {
      headers: { "x-api-key": "tenant-a-energy-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: [{ period: "2026-08-17", revenueCOP: 90000 }] });
    expect(JSON.stringify(execute.mock.calls[2][0])).toContain("cs.organization_id = 10");
  });

  it("preserves global statistics for a platform API key", async () => {
    const platformKey = { ...tenantAKey, id: 2, organizationId: null };
    const execute = vi.fn()
      .mockResolvedValueOnce([[platformKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([[{ totalKwh: 100, totalRevenue: 180000, totalSessions: 4 }]]);
    mockGetDb.mockResolvedValue({ execute });

    const response = await fetch(`${baseUrl}/stats/overview`, {
      headers: { "x-api-key": "platform-admin-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { stations: { total: 2 } } });
    const generatedQueries = execute.mock.calls.slice(1).map(([query]) => JSON.stringify(query)).join(" ");
    expect(generatedQueries).not.toContain("organization_id = 10");
  });

  it("scopes webhook listing and creation to the organization of the API key", async () => {
    const listExecute = vi.fn()
      .mockResolvedValueOnce([[tenantAKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[]]);
    mockGetDb.mockResolvedValue({ execute: listExecute });

    const listResponse = await fetch(`${baseUrl}/webhooks`, {
      headers: { "x-api-key": "tenant-a-webhook-key" },
    });
    expect(listResponse.status).toBe(200);
    expect(JSON.stringify(listExecute.mock.calls[2][0])).toContain("organization_id");

    const createExecute = vi.fn()
      .mockResolvedValueOnce([[tenantAKey]])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockGetDb.mockResolvedValue({ execute: createExecute });

    const createResponse = await post("/webhooks", {
      url: "https://tenant-a.test/hooks/charging",
      events: ["charging.completed"],
    });
    expect(createResponse.status).toBe(201);
    const insertQuery = JSON.stringify(createExecute.mock.calls[2][0]);
    expect(insertQuery).toContain("organization_id");
    expect(insertQuery).toContain("10");
  });

  it("rejects a webhook URL that targets an internal or plaintext endpoint", async () => {
    const response = await post("/webhooks", {
      url: "http://127.0.0.1:3000/internal",
      events: ["charging.completed"],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "UNSAFE_WEBHOOK_URL" });
  });
});
