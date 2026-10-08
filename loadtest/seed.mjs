import mysql from "mysql2/promise";
import fs from "node:fs";
import { assertSafeRun, loadConfig, manifestPath } from "./config.mjs";

const config = loadConfig();
if (config.loadTestEnvironment !== "loadtest") {
  throw new Error("El seed requiere LOAD_TEST_ENVIRONMENT=loadtest.");
}
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL para ejecutar el seed.");
if (process.env.LOAD_TEST_SEED_CONFIRM !== "EVGREEN-LOADTEST" && !process.argv.includes("--confirm")) {
  throw new Error("Seed bloqueado. Repite con LOAD_TEST_SEED_CONFIRM=EVGREEN-LOADTEST o --confirm.");
}
assertSafeRun({ ...config, allowRun: true }, { requireTarget: false, allowSeedOnly: true });

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 8, waitForConnections: true });
const ownerId = Number(process.env.LOAD_TEST_OWNER_ID || 1);
const manifest = { runId: config.runId, createdAt: new Date().toISOString(), stationIds: [], chargerIds: [], evseIds: [], userIds: [], idTags: [] };

async function one(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return Array.isArray(rows) ? rows[0] : undefined;
}

async function ensureUser(tag, index) {
  const openId = `${config.stationPrefix.toLowerCase()}-load-user-${config.runId}-${index}`.slice(0, 64);
  const existing = await one("SELECT id FROM users WHERE openId = ? LIMIT 1", [openId]);
  if (existing?.id) return Number(existing.id);
  const [result] = await pool.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, isActive, idTag, notifyChargingComplete, notifyLowBalance, notifyPromotions, notifyProximity, waNotifyChargeStart, waNotifyChargeEnd, emailNotifyEnabled, emailNotifyReceipts, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, NULL, 'loadtest', 'user', 1, ?, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW(), NOW())`,
    [openId, `EVGreen Load User ${index}`, tag],
  );
  return Number(result.insertId);
}

async function ensureWallet(userId) {
  const existing = await one("SELECT id FROM wallets WHERE userId = ? LIMIT 1", [userId]);
  if (existing?.id) {
    await pool.execute("UPDATE wallets SET balance = GREATEST(balance, 100000000) WHERE id = ?", [existing.id]);
    return Number(existing.id);
  }
  const [result] = await pool.execute("INSERT INTO wallets (userId, balance, currency, creditLimit) VALUES (?, 100000000, 'COP', 0)", [userId]);
  return Number(result.insertId);
}

async function ensureIdTag(tag, userId) {
  const existing = await one("SELECT id FROM id_tags WHERE id_tag = ? LIMIT 1", [tag]);
  if (existing?.id) {
    await pool.execute("UPDATE id_tags SET user_id = ?, id_tag_status = 'ACTIVE', id_tag_type = 'APP' WHERE id = ?", [userId, existing.id]);
    return Number(existing.id);
  }
  const [result] = await pool.execute(
    "INSERT INTO id_tags (id_tag, user_id, id_tag_type, id_tag_status, label, max_active_transactions) VALUES (?, ?, 'APP', 'ACTIVE', 'EVGreen load test', 1)",
    [tag, userId],
  );
  return Number(result.insertId);
}

async function ensureStation(stationNumber) {
  const description = `EVGREEN_LOADTEST:${config.runId}:STATION:${stationNumber}`;
  const existing = await one("SELECT id FROM charging_stations WHERE description = ? LIMIT 1", [description]);
  if (existing?.id) return Number(existing.id);
  const name = `${config.stationPrefix} Station ${String(stationNumber).padStart(3, "0")}`;
  const [result] = await pool.execute(
    `INSERT INTO charging_stations (ownerId, name, description, address, city, department, country, timezone, latitude, longitude, isOnline, isPublic, network_access_mode, isActive)
     VALUES (?, ?, ?, ?, 'Bogotá', 'Cundinamarca', 'Colombia', 'America/Bogota', ?, ?, 0, 0, 'PRIVATE', 1)`,
    [ownerId, name, description, `Load test ${config.runId} - ${name}`, 4.6 + stationNumber / 10000, -74.1 - stationNumber / 10000],
  );
  return Number(result.insertId);
}

async function ensureTariff(stationId) {
  const existing = await one("SELECT id FROM tariffs WHERE stationId = ? AND name = ? LIMIT 1", [stationId, `LoadTest ${config.runId}`]);
  if (existing?.id) return Number(existing.id);
  const [result] = await pool.execute(
    `INSERT INTO tariffs (stationId, name, description, pricePerKwh, pricePerMinute, pricePerSession, isActive, autoPricing, connectionFee)
     VALUES (?, ?, 'Tarifa sintética EVGreen load test', ?, 0, 0, 1, 0, 0)`,
    [stationId, `LoadTest ${config.runId}`, config.pricePerKwh],
  );
  return Number(result.insertId);
}

async function ensureCharger(stationId, stationNumber, chargerNumber) {
  const identity = `${config.stationPrefix}-S${String(stationNumber).padStart(3, "0")}-C${String(chargerNumber).padStart(2, "0")}`;
  const existing = await one("SELECT id FROM chargers WHERE ocpp_identity = ? LIMIT 1", [identity]);
  if (existing?.id) return { id: Number(existing.id), identity };
  const [result] = await pool.execute(
    `INSERT INTO chargers (station_id, charger_code, display_name, ocpp_identity, brand, model, serial_number, firmware_version, power_kw, max_concurrent_sessions, charger_status, is_online, is_active, notes)
     VALUES (?, ?, ?, ?, 'EVGreen', 'LoadSimulator', ?, 'loadtest', ?, ?, 'UNKNOWN', 0, 1, ?)`,
    [stationId, `C${String(chargerNumber).padStart(2, "0")}`, `Load charger ${stationNumber}-${chargerNumber}`, identity, identity, config.powerKw, config.connectorsPerCharger, `EVGREEN_LOADTEST:${config.runId}`],
  );
  return { id: Number(result.insertId), identity };
}

async function ensureEvse(stationId, chargerId, connectorId) {
  const existing = await one("SELECT id FROM evses WHERE stationId = ? AND charger_id = ? AND connectorId = ? LIMIT 1", [stationId, chargerId, connectorId]);
  if (existing?.id) return Number(existing.id);
  const [result] = await pool.execute(
    `INSERT INTO evses (stationId, evseIdLocal, connectorId, connector_label, connector_type, charge_type, powerKw, maxVoltage, maxAmperage, connectorStatus, charger_id, isActive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, 1)`,
    [stationId, connectorId, connectorId, `C${connectorId}`, config.connectorType, config.chargeType, config.powerKw, config.chargeType === "DC" ? 1000 : 240, config.chargeType === "DC" ? 200 : 32, chargerId],
  );
  return Number(result.insertId);
}

for (let stationNumber = 1; stationNumber <= config.stationCount; stationNumber++) {
  const stationId = await ensureStation(stationNumber);
  await ensureTariff(stationId);
  manifest.stationIds.push(stationId);
  for (let chargerNumber = 1; chargerNumber <= config.chargersPerStation; chargerNumber++) {
    const charger = await ensureCharger(stationId, stationNumber, chargerNumber);
    manifest.chargerIds.push(charger.id);
    const tag = `${config.stationPrefix}T${String(stationNumber).padStart(3, "0")}C${String(chargerNumber).padStart(2, "0")}`.slice(0, 20);
    const userId = await ensureUser(tag, `${stationNumber}-${chargerNumber}`);
    await ensureWallet(userId);
    await ensureIdTag(tag, userId);
    manifest.userIds.push(userId);
    manifest.idTags.push(tag);
    for (let connectorId = 1; connectorId <= config.connectorsPerCharger; connectorId++) {
      manifest.evseIds.push(await ensureEvse(stationId, charger.id, connectorId));
    }
  }
}

const output = manifestPath(config.runId);
fs.writeFileSync(output, `${JSON.stringify({ ...manifest, config }, null, 2)}\n`);
console.log(JSON.stringify({ ...manifest, manifestPath: output }, null, 2));
await pool.end();
