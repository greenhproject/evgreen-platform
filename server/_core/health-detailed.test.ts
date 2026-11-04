import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "http";
import {
  DETAILED_HEALTH_PATH,
  registerDetailedHealthRoute,
  type DatabaseChecker,
} from "./health-detailed";

function startApp(checkDatabase: DatabaseChecker) {
  const app = express();
  registerDetailedHealthRoute(app, checkDatabase);
  const server = http.createServer(app);
  return server;
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

describe("endpoint de salud detallado para monitoreo externo", () => {
  describe("base de datos respondiendo", () => {
    const server = startApp(async () => ({ ok: true, latencyMs: 12 }));
    let baseUrl = "";

    beforeAll(async () => {
      baseUrl = await listen(server);
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    });

    it("responde 200 con status healthy y la latencia real del check", async () => {
      const response = await fetch(`${baseUrl}${DETAILED_HEALTH_PATH}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("healthy");
      expect(body.checks.database.ok).toBe(true);
      expect(body.checks.database.latencyMs).toBe(12);
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("base de datos caída (el escenario real del incidente del 27 de octubre)", () => {
    const server = startApp(async () => ({
      ok: false,
      error: "Access denied for user '3kTaiYRMPpnS3sR.17f9e41a6e58'@'%' (using password: YES)",
    }));
    let baseUrl = "";

    beforeAll(async () => {
      baseUrl = await listen(server);
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    });

    it("responde 503 (no 200) con status degraded y el error real expuesto", async () => {
      const response = await fetch(`${baseUrl}${DETAILED_HEALTH_PATH}`);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.checks.database.ok).toBe(false);
      expect(body.checks.database.error).toContain("Access denied");
    });

    it("el código 503 es distinguible de un 200 por cualquier monitor que solo revise el código HTTP, sin necesitar leer el cuerpo", async () => {
      const response = await fetch(`${baseUrl}${DETAILED_HEALTH_PATH}`);
      expect(response.ok).toBe(false);
      expect(response.status).not.toBe(200);
    });
  });

  describe("el propio check lanza una excepción inesperada", () => {
    const server = startApp(async () => {
      throw new Error("fallo inesperado fuera del contrato de DatabaseChecker");
    });
    let baseUrl = "";

    beforeAll(async () => {
      baseUrl = await listen(server);
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    });

    it("responde 500 con status error en vez de tumbar el proceso", async () => {
      const response = await fetch(`${baseUrl}${DETAILED_HEALTH_PATH}`);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
      expect(body.error).toContain("fallo inesperado");
    });
  });
});
