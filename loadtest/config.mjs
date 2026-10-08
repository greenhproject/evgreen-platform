import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONFIG = {
  targetUrl: "",
  stationPrefix: "LT",
  runId: "",
  stationCount: 1,
  chargersPerStation: 1,
  connectorsPerCharger: 2,
  connectorType: "CCS_2",
  chargeType: "DC",
  powerKw: 60,
  protocol: "ocpp1.6",
  rampUpMs: 250,
  heartbeatIntervalSec: 30,
  meterValueIntervalSec: 15,
  sessionDurationSec: 60,
  sessionRestSec: 15,
  occupancyPercent: 25,
  mode: "continuous",
  reconnect: true,
  maxReconnectAttempts: 0,
  faultReconnectPercent: 0,
  faultLatencyMs: 0,
  pricePerKwh: 1800,
  allowRun: false,
  loadTestEnvironment: "",
  logLevel: "info",
};

function deepMerge(base, override) {
  return { ...base, ...(override || {}) };
}

function numberOr(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolOr(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function argValue(args, name) {
  const index = args.findIndex(arg => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index < 0) return undefined;
  const current = args[index];
  if (current.includes("=")) return current.slice(current.indexOf("=") + 1);
  return args[index + 1];
}

function loadJsonConfig(configPath) {
  if (!configPath) return {};
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`No existe el archivo de configuración: ${absolutePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function normalizeTargetUrl(rawTargetUrl) {
  if (!rawTargetUrl) return "";
  const parsed = new URL(rawTargetUrl);
  if (parsed.protocol === "http:") parsed.protocol = "ws:";
  if (parsed.protocol === "https:") parsed.protocol = "wss:";
  if (!["ws:", "wss:"].includes(parsed.protocol)) {
    throw new Error("targetUrl debe usar http(s) o ws(s)");
  }
  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/api/ocpp/ws";
  } else if (!parsed.pathname.endsWith("/api/ocpp/ws") && !parsed.pathname.endsWith("/ocpp")) {
    parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/api/ocpp/ws`;
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function chargerUrl(targetUrl, identity) {
  const base = normalizeTargetUrl(targetUrl);
  return `${base}/${encodeURIComponent(identity)}`;
}

export function loadConfig(argv = process.argv.slice(2)) {
  const configPath = argValue(argv, "config") || process.env.LOAD_TEST_CONFIG;
  const fileConfig = loadJsonConfig(configPath);
  const config = deepMerge(DEFAULT_CONFIG, fileConfig);

  const env = process.env;
  const envValue = (...names) => names.map(name => env[name]).find(value => value !== undefined && value !== "");
  config.targetUrl = envValue("EVGREEN_PRUEBAS_URL_OBJETIVO", "LOAD_TEST_TARGET_URL") || config.targetUrl;
  config.stationPrefix = envValue("EVGREEN_PRUEBAS_PREFIJO_ESTACION", "LOAD_TEST_STATION_PREFIX") || config.stationPrefix;
  config.runId = envValue("EVGREEN_PRUEBAS_ID_CORRIDA", "LOAD_TEST_RUN_ID") || config.runId;
  config.stationCount = numberOr(argValue(argv, "stations") ?? envValue("EVGREEN_PRUEBAS_ESTACIONES", "LOAD_TEST_STATIONS"), config.stationCount);
  config.chargersPerStation = numberOr(argValue(argv, "chargers") ?? envValue("EVGREEN_PRUEBAS_CARGADORES_POR_ESTACION", "LOAD_TEST_CHARGERS_PER_STATION"), config.chargersPerStation);
  config.connectorsPerCharger = numberOr(argValue(argv, "connectors") ?? envValue("EVGREEN_PRUEBAS_CONECTORES_POR_CARGADOR", "LOAD_TEST_CONNECTORS_PER_CHARGER"), config.connectorsPerCharger);
  config.connectorType = envValue("EVGREEN_PRUEBAS_TIPO_CONECTOR", "LOAD_TEST_CONNECTOR_TYPE") || config.connectorType;
  config.chargeType = envValue("EVGREEN_PRUEBAS_TIPO_CARGA", "LOAD_TEST_CHARGE_TYPE") || config.chargeType;
  config.powerKw = numberOr(envValue("EVGREEN_PRUEBAS_POTENCIA_KW", "LOAD_TEST_POWER_KW"), config.powerKw);
  config.protocol = argValue(argv, "protocol") || envValue("EVGREEN_PRUEBAS_PROTOCOLO", "LOAD_TEST_PROTOCOL") || config.protocol;
  config.rampUpMs = numberOr(envValue("EVGREEN_PRUEBAS_ESCALONAMIENTO_MS", "LOAD_TEST_RAMP_UP_MS"), config.rampUpMs);
  config.heartbeatIntervalSec = numberOr(envValue("EVGREEN_PRUEBAS_INTERVALO_HEARTBEAT_SEG", "LOAD_TEST_HEARTBEAT_INTERVAL_SEC"), config.heartbeatIntervalSec);
  config.meterValueIntervalSec = numberOr(argValue(argv, "meter") ?? envValue("EVGREEN_PRUEBAS_INTERVALO_MEDIDORES_SEG", "LOAD_TEST_METER_INTERVAL_SEC"), config.meterValueIntervalSec);
  config.sessionDurationSec = numberOr(argValue(argv, "duration") ?? envValue("EVGREEN_PRUEBAS_DURACION_SESION_SEG", "LOAD_TEST_SESSION_DURATION_SEC"), config.sessionDurationSec);
  config.sessionRestSec = numberOr(envValue("EVGREEN_PRUEBAS_DESCANSO_SESION_SEG", "LOAD_TEST_SESSION_REST_SEC"), config.sessionRestSec);
  config.occupancyPercent = numberOr(argValue(argv, "occupancy") ?? envValue("EVGREEN_PRUEBAS_OCUPACION_PORCENTAJE", "LOAD_TEST_OCCUPANCY_PERCENT"), config.occupancyPercent);
  config.mode = envValue("EVGREEN_PRUEBAS_MODO", "LOAD_TEST_MODE") || config.mode;
  config.reconnect = boolOr(envValue("EVGREEN_PRUEBAS_RECONEXION", "LOAD_TEST_RECONNECT"), config.reconnect);
  config.maxReconnectAttempts = numberOr(envValue("EVGREEN_PRUEBAS_MAX_REINTENTOS", "LOAD_TEST_MAX_RECONNECT_ATTEMPTS"), config.maxReconnectAttempts);
  config.faultReconnectPercent = numberOr(envValue("EVGREEN_PRUEBAS_RECONEXION_FALLA_PORCENTAJE", "LOAD_TEST_FAULT_RECONNECT_PERCENT"), config.faultReconnectPercent);
  config.faultLatencyMs = numberOr(envValue("EVGREEN_PRUEBAS_LATENCIA_FALLA_MS", "LOAD_TEST_FAULT_LATENCY_MS"), config.faultLatencyMs);
  config.pricePerKwh = numberOr(envValue("EVGREEN_PRUEBAS_PRECIO_KWH", "LOAD_TEST_PRICE_PER_KWH"), config.pricePerKwh);
  config.allowRun = boolOr(envValue("EVGREEN_PRUEBAS_ACTIVAR", "LOAD_TEST_ALLOW_RUN"), config.allowRun);
  config.loadTestEnvironment = envValue("EVGREEN_PRUEBAS_ENTORNO", "LOAD_TEST_ENVIRONMENT") || config.loadTestEnvironment;
  config.logLevel = envValue("EVGREEN_PRUEBAS_NIVEL_LOG", "LOAD_TEST_LOG_LEVEL") || config.logLevel;
  config.targetUrl = normalizeTargetUrl(config.targetUrl);

  config.stationCount = Math.max(1, Math.floor(config.stationCount));
  config.chargersPerStation = Math.max(1, Math.floor(config.chargersPerStation));
  config.connectorsPerCharger = Math.max(1, Math.floor(config.connectorsPerCharger));
  config.occupancyPercent = Math.min(100, Math.max(0, config.occupancyPercent));
  config.meterValueIntervalSec = Math.max(1, config.meterValueIntervalSec);
  config.sessionDurationSec = Math.max(5, config.sessionDurationSec);
  config.rampUpMs = Math.max(0, config.rampUpMs);
  config.runId ||= `run-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

  return config;
}

export function assertSafeRun(config, { requireTarget = true, allowSeedOnly = false } = {}) {
  if (requireTarget && !config.targetUrl) {
    throw new Error("Falta LOAD_TEST_TARGET_URL o targetUrl en el archivo de configuración.");
  }
  if (!config.allowRun && !allowSeedOnly) {
    throw new Error("Carga bloqueada. Define LOAD_TEST_ALLOW_RUN=true de forma explícita para iniciar la flota.");
  }
  if (config.loadTestEnvironment !== "loadtest") {
    throw new Error("El runner sólo puede ejecutarse con LOAD_TEST_ENVIRONMENT=loadtest.");
  }
  const target = config.targetUrl || "";
  if (target.includes("app.evgreen.lat") && process.env.LOAD_TEST_ALLOW_PRODUCTION !== "true") {
    throw new Error("El runner se negó a apuntar a app.evgreen.lat. Usa un staging explícito; nunca cargues producción por accidente.");
  }
  if (config.stationCount > 1000 || config.chargersPerStation > 50 || config.connectorsPerCharger > 20) {
    throw new Error("Configuración fuera de límites seguros. Revisa stations, chargers y connectors.");
  }
}

export function manifestPath(runId) {
  const directory = path.join(__dirname, "manifests");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${runId}.json`);
}
