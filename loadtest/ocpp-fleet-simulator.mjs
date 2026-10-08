import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { assertSafeRun, chargerUrl, loadConfig } from "./config.mjs";

const config = loadConfig();
if (config.loadTestEnvironment !== "loadtest") {
  throw new Error("El servicio de carga requiere LOAD_TEST_ENVIRONMENT=loadtest.");
}
if (!config.allowRun) {
  console.log("[loadtest:guard] Runner en modo idle. Define LOAD_TEST_ALLOW_RUN=true para iniciar la flota.");
  await new Promise(() => {});
} else {
  assertSafeRun(config);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const isOpen = ws => ws && ws.readyState === WebSocket.OPEN;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function shouldLog(level) {
  if (config.logLevel === "debug") return true;
  if (config.logLevel === "warn") return level === "warn" || level === "error";
  return level !== "debug";
}

function log(level, message, details) {
  if (!shouldLog(level)) return;
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[loadtest:${level}] ${message}${suffix}`);
}

class ChargePointSimulator {
  constructor({ stationNumber, chargerNumber }) {
    this.stationNumber = stationNumber;
    this.chargerNumber = chargerNumber;
    this.identity = `${config.stationPrefix}-S${String(stationNumber).padStart(3, "0")}-C${String(chargerNumber).padStart(2, "0")}`;
    this.idTag = `${config.stationPrefix}T${String(stationNumber).padStart(3, "0")}C${String(chargerNumber).padStart(2, "0")}`.slice(0, 20);
    this.ws = null;
    this.pending = new Map();
    this.sessions = new Map();
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.nextTransactionId = 1;
  }

  async start() {
    while (!this.stopped) {
      try {
        await this.connect();
        this.reconnectAttempts = 0;
        await new Promise(resolve => {
          this.resolveConnectionEnd = resolve;
          if (this.stopped) resolve();
        });
      } catch (error) {
        log("error", `${this.identity} connection failed`, { message: error.message });
      }
      if (this.stopped || !config.reconnect) break;
      const attempt = this.reconnectAttempts++;
      if (config.maxReconnectAttempts > 0 && attempt >= config.maxReconnectAttempts) break;
      const waitMs = Math.min(30000, 1000 * (2 ** Math.min(attempt, 5)));
      log("warn", `${this.identity} reconnecting`, { waitMs, attempt: attempt + 1 });
      await sleep(waitMs);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.stopped) return resolve();
      const url = chargerUrl(config.targetUrl, this.identity);
      const protocol = config.protocol === "ocpp2.0.1" ? "ocpp2.0.1" : "ocpp1.6";
      const ws = new WebSocket(url, protocol, { handshakeTimeout: 15000 });
      this.ws = ws;
      let opened = false;
      let settled = false;
      const fail = error => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      ws.once("open", async () => {
        opened = true;
        log("info", `${this.identity} connected`, { url, protocol });
        try {
          await this.boot();
          settled = true;
          resolve();
        } catch (error) {
          settled = true;
          reject(error);
        }
      });
      ws.on("message", data => this.handleMessage(data));
      ws.on("error", error => {
        if (!opened) fail(error);
        else log("error", `${this.identity} socket error`, { message: error.message });
      });
      ws.on("close", (code, reason) => {
        this.clearTimers();
        for (const [, pending] of this.pending) pending.reject(new Error(`socket closed (${code})`));
        this.pending.clear();
        for (const session of this.sessions.values()) clearInterval(session.meterTimer);
        this.sessions.clear();
        log("warn", `${this.identity} disconnected`, { code, reason: reason?.toString() || "" });
        this.resolveConnectionEnd?.();
      });
      ws.on("unexpected-response", (_request, response) => {
        fail(new Error(`OCPP websocket rejected with HTTP ${response.statusCode}`));
      });
    });
  }

  async boot() {
    const response = await this.call("BootNotification", config.protocol === "ocpp2.0.1"
      ? { reason: "PowerUp", chargingStation: { model: "EVGreen Load Simulator", vendorName: "EVGreen", serialNumber: this.identity, firmwareVersion: "loadtest" } }
      : { chargePointVendor: "EVGreen", chargePointModel: "LoadSimulator", chargePointSerialNumber: this.identity, firmwareVersion: "loadtest" });
    log("debug", `${this.identity} boot response`, response);
    this.startHeartbeat();
    for (let connectorId = 1; connectorId <= config.connectorsPerCharger; connectorId++) {
      await this.sendStatus(connectorId, "Available");
    }
    if (config.protocol === "ocpp1.6") {
      setTimeout(() => this.scheduleAutonomousSessions(), 500);
    }
    if (config.faultReconnectPercent > 0 && Math.random() * 100 < config.faultReconnectPercent) {
      setTimeout(() => this.ws?.close(1001, "simulated reconnect"), Math.max(1000, config.sessionRestSec * 1000));
    }
  }

  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.call("Heartbeat", {}).catch(error => log("warn", `${this.identity} heartbeat failed`, { message: error.message }));
    }, config.heartbeatIntervalSec * 1000);
  }

  scheduleAutonomousSessions() {
    if (this.stopped || !isOpen(this.ws) || config.mode === "once" && this.sessions.size > 0) return;
    for (let connectorId = 1; connectorId <= config.connectorsPerCharger; connectorId++) {
      const roll = Math.random() * 100;
      if (roll < config.occupancyPercent) {
        const delay = Math.round(Math.random() * Math.max(1, config.sessionRestSec) * 1000);
        setTimeout(() => this.startSession(connectorId).catch(error => log("warn", `${this.identity} session failed`, { connectorId, message: error.message })), delay);
      }
    }
    if (config.mode !== "once") {
      setTimeout(() => this.scheduleAutonomousSessions(), Math.max(5000, config.sessionRestSec * 1000));
    }
  }

  async startSession(connectorId, { remote = false } = {}) {
    if (!isOpen(this.ws) || this.sessions.has(connectorId)) return null;
    if (config.protocol !== "ocpp1.6") {
      log("warn", `${this.identity} OCPP 2.0.1 session generation is disabled until TransactionEvent persistence is enabled in the CSMS`);
      return null;
    }
    await this.sendStatus(connectorId, "Preparing");
    const auth = await this.call("Authorize", { idTag: this.idTag });
    if (auth?.idTagInfo?.status && auth.idTagInfo.status !== "Accepted") {
      await this.sendStatus(connectorId, "Available");
      return null;
    }
    const session = {
      connectorId,
      transactionId: null,
      meterWh: 0,
      powerKw: Math.min(config.powerKw, 250),
      soc: 20 + Math.round(Math.random() * 15),
      startedAt: Date.now(),
      finished: false,
      meterTimer: null,
      remote,
    };
    const response = await this.call("StartTransaction", {
      connectorId,
      idTag: this.idTag,
      meterStart: session.meterWh,
      timestamp: nowIso(),
    });
    if (!response || response.idTagInfo?.status === "Invalid") {
      await this.sendStatus(connectorId, "Available");
      throw new Error(`StartTransaction rejected for connector ${connectorId}`);
    }
    session.transactionId = Number(response.transactionId || `${this.stationNumber}${this.chargerNumber}${connectorId}${this.nextTransactionId++}`);
    this.sessions.set(connectorId, session);
    await this.sendStatus(connectorId, "Charging");
    await this.sendMeterValues(session);
    session.meterTimer = setInterval(() => this.sendMeterValues(session).catch(error => log("warn", `${this.identity} MeterValues failed`, { message: error.message })), config.meterValueIntervalSec * 1000);
    session.stopTimer = setTimeout(() => this.finishSession(connectorId, "Remote").catch(error => log("warn", `${this.identity} stop failed`, { message: error.message })), config.sessionDurationSec * 1000);
    log("info", `${this.identity} session started`, { connectorId, transactionId: session.transactionId });
    return session;
  }

  async sendMeterValues(session) {
    if (session.finished || !isOpen(this.ws)) return;
    const intervalSec = config.meterValueIntervalSec;
    session.meterWh += session.powerKw * intervalSec * 1000 / 3600;
    session.soc = clamp(session.soc + (session.powerKw * intervalSec / 3600 / 60) * 100, 0, 100);
    await this.call("MeterValues", {
      connectorId: session.connectorId,
      transactionId: session.transactionId,
      meterValue: [{
        timestamp: nowIso(),
        sampledValue: [
          { value: String(Math.round(session.meterWh)), measurand: "Energy.Active.Import.Register", unit: "Wh", context: "Sample.Periodic", format: "Raw", location: "Outlet" },
          { value: String(session.powerKw), measurand: "Power.Active.Import", unit: "kW", context: "Sample.Periodic", format: "Raw", location: "Outlet" },
          { value: String(Math.round(session.soc)), measurand: "SoC", unit: "Percent", context: "Sample.Periodic", format: "Raw", location: "EV" },
        ],
      }],
    });
  }

  async finishSession(connectorId, reason = "Remote") {
    const session = this.sessions.get(connectorId);
    if (!session || session.finished) return;
    session.finished = true;
    clearInterval(session.meterTimer);
    clearTimeout(session.stopTimer);
    if (!isOpen(this.ws)) return;
    await this.sendStatus(connectorId, "Finishing");
    await this.call("StopTransaction", {
      transactionId: session.transactionId,
      idTag: this.idTag,
      meterStop: Math.round(session.meterWh),
      timestamp: nowIso(),
      reason,
    });
    await this.sendStatus(connectorId, "Available");
    this.sessions.delete(connectorId);
    log("info", `${this.identity} session stopped`, { connectorId, transactionId: session.transactionId, meterWh: Math.round(session.meterWh) });
  }

  async sendStatus(connectorId, status) {
    if (!isOpen(this.ws)) return;
    await this.call("StatusNotification", {
      connectorId,
      status,
      errorCode: status === "Faulted" ? "OtherError" : "NoError",
      vendorErrorCode: "",
      timestamp: nowIso(),
    });
  }

  async handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    const [messageType, messageId, actionOrPayload, payload] = message;
    if (messageType === 3) {
      const pending = this.pending.get(messageId);
      if (!pending) return;
      this.pending.delete(messageId);
      pending.resolve(actionOrPayload);
      return;
    }
    if (messageType === 4) {
      const pending = this.pending.get(messageId);
      if (!pending) return;
      this.pending.delete(messageId);
      pending.reject(new Error(`${actionOrPayload}: ${payload || "CALLERROR"}`));
      return;
    }
    if (messageType !== 2) return;
    await this.handleCall(messageId, actionOrPayload, payload || {});
  }

  async handleCall(messageId, action, payload) {
    if (!isOpen(this.ws)) return;
    const respond = response => this.ws.send(JSON.stringify([3, messageId, response]));
    if (config.faultLatencyMs > 0) await sleep(config.faultLatencyMs);
    switch (action) {
      case "RemoteStartTransaction":
        respond({ status: "Accepted" });
        this.startSession(Number(payload.connectorId || 1), { remote: true }).catch(error => log("warn", `${this.identity} remote start failed`, { message: error.message }));
        break;
      case "RemoteStopTransaction": {
        respond({ status: "Accepted" });
        const session = [...this.sessions.values()].find(item => item.transactionId === Number(payload.transactionId));
        if (session) this.finishSession(session.connectorId, "Remote").catch(error => log("warn", `${this.identity} remote stop failed`, { message: error.message }));
        break;
      }
      case "TriggerMessage":
        respond({ status: "Accepted" });
        if (payload.requestedMessage === "Heartbeat") this.call("Heartbeat", {}).catch(() => {});
        break;
      case "ChangeConfiguration":
        respond({ status: "Accepted" });
        break;
      case "Reset":
        respond({ status: "Accepted" });
        setTimeout(() => this.ws?.close(1000, "simulated reset"), 100);
        break;
      case "UnlockConnector":
        respond({ status: "Unlocked" });
        break;
      default:
        respond({});
    }
  }

  call(action, payload, timeoutMs = 20000) {
    if (!isOpen(this.ws)) return Promise.reject(new Error("socket is not open"));
    const messageId = randomUUID();
    const send = () => this.ws.send(JSON.stringify([2, messageId, action, payload]));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`timeout waiting for ${action}`));
      }, timeoutMs);
      this.pending.set(messageId, {
        resolve: response => { clearTimeout(timeout); resolve(response); },
        reject: error => { clearTimeout(timeout); reject(error); },
      });
      send();
    });
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  clearTimers() {
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  async stop() {
    this.stopped = true;
    this.clearTimers();
    for (const connectorId of [...this.sessions.keys()]) {
      await this.finishSession(connectorId, "Local").catch(() => {});
    }
    this.ws?.close(1000, "runner stopped");
    this.resolveConnectionEnd?.();
  }
}

class FleetRunner {
  constructor() {
    this.actors = [];
    for (let station = 1; station <= config.stationCount; station++) {
      for (let charger = 1; charger <= config.chargersPerStation; charger++) {
        this.actors.push(new ChargePointSimulator({ stationNumber: station, chargerNumber: charger }));
      }
    }
  }

  async start() {
    log("info", "starting configurable OCPP fleet", {
      runId: config.runId,
      targetUrl: config.targetUrl,
      stationCount: config.stationCount,
      chargersPerStation: config.chargersPerStation,
      connectorsPerCharger: config.connectorsPerCharger,
      protocol: config.protocol,
      occupancyPercent: config.occupancyPercent,
      meterValueIntervalSec: config.meterValueIntervalSec,
      sessionDurationSec: config.sessionDurationSec,
    });
    const jobs = this.actors.map((actor, index) => (async () => {
      await sleep(index * config.rampUpMs);
      return actor.start();
    })());
    await Promise.all(jobs);
  }

  async stop() {
    await Promise.all(this.actors.map(actor => actor.stop()));
  }
}

const runner = new FleetRunner();
let stopping = false;
const stop = async signal => {
  if (stopping) return;
  stopping = true;
  log("info", `stopping fleet (${signal})`);
  await runner.stop();
  process.exit(0);
};
process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));

await runner.start();
