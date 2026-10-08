import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";

describe("OCPP fleet runner", () => {
  const servers: WebSocketServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  });

  it("completa boot, estados, autorización, sesión, telemetría y cierre con una flota mínima", async () => {
    const server = new WebSocketServer({ port: 0 });
    servers.push(server);
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No se pudo abrir el CSMS de prueba");

    const calls: string[] = [];
    let completionSeen = false;
    server.on("connection", ws => {
      ws.on("message", raw => {
        const [type, messageId, action, payload] = JSON.parse(raw.toString());
        if (type !== 2) return;
        calls.push(action);
        const response: Record<string, unknown> = {};
        if (action === "BootNotification") Object.assign(response, { status: "Accepted", currentTime: new Date().toISOString(), interval: 1 });
        if (action === "Authorize") Object.assign(response, { idTagInfo: { status: "Accepted" } });
        if (action === "StartTransaction") Object.assign(response, { idTagInfo: { status: "Accepted" }, transactionId: 42 });
        if (action === "StopTransaction") Object.assign(response, { idTagInfo: { status: "Accepted" } });
        ws.send(JSON.stringify([3, messageId, response]));

        if (action === "StatusNotification" && payload.status === "Available" && calls.includes("StopTransaction") && !completionSeen) {
          completionSeen = true;
          setTimeout(() => ws.close(1000, "test complete"), 50);
        }
      });
    });

    const child = spawn("node", ["loadtest/ocpp-fleet-simulator.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOAD_TEST_ENVIRONMENT: "loadtest",
        LOAD_TEST_ALLOW_RUN: "true",
        LOAD_TEST_TARGET_URL: `ws://127.0.0.1:${address.port}/api/ocpp/ws`,
        LOAD_TEST_STATIONS: "1",
        LOAD_TEST_CHARGERS_PER_STATION: "1",
        LOAD_TEST_CONNECTORS_PER_CHARGER: "1",
        LOAD_TEST_OCCUPANCY_PERCENT: "100",
        LOAD_TEST_MODE: "once",
        LOAD_TEST_SESSION_DURATION_SEC: "5",
        LOAD_TEST_SESSION_REST_SEC: "1",
        LOAD_TEST_METER_INTERVAL_SEC: "1",
        LOAD_TEST_HEARTBEAT_INTERVAL_SEC: "1",
        LOAD_TEST_RECONNECT: "false",
        LOAD_TEST_RAMP_UP_MS: "0",
        LOAD_TEST_LOG_LEVEL: "warn",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`El runner no terminó: ${output}`));
      }, 15000);
      child.on("exit", code => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual(expect.arrayContaining([
      "BootNotification",
      "Heartbeat",
      "StatusNotification",
      "Authorize",
      "StartTransaction",
      "MeterValues",
      "StopTransaction",
    ]));
  }, 20000);
});
