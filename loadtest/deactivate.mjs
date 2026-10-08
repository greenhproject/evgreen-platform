import mysql from "mysql2/promise";
import { loadConfig } from "./config.mjs";

const config = loadConfig();
if (config.loadTestEnvironment !== "loadtest") throw new Error("La limpieza requiere LOAD_TEST_ENVIRONMENT=loadtest.");
if (process.env.LOAD_TEST_CLEANUP_CONFIRM !== "EVGREEN-LOADTEST" && !process.argv.includes("--confirm")) {
  throw new Error("Limpieza bloqueada. Repite con LOAD_TEST_CLEANUP_CONFIRM=EVGREEN-LOADTEST o --confirm.");
}
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL para limpiar el seed.");

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 4 });
const marker = `EVGREEN_LOADTEST:${config.runId}:%`;
const [stations] = await pool.execute("SELECT id FROM charging_stations WHERE description LIKE ?", [marker]);
const ids = stations.map(row => Number(row.id));
if (ids.length === 0) {
  console.log(JSON.stringify({ runId: config.runId, stations: 0, message: "No se encontraron estaciones sintéticas" }));
  await pool.end();
  process.exit(0);
}
const placeholders = ids.map(() => "?").join(",");
await pool.execute(`UPDATE charging_stations SET isActive = 0, isPublic = 0, isOnline = 0 WHERE id IN (${placeholders})`, ids);
await pool.execute(`UPDATE chargers SET is_active = 0, is_online = 0, charger_status = 'OFFLINE' WHERE station_id IN (${placeholders})`, ids);
await pool.execute(`UPDATE evses SET isActive = 0, connectorStatus = 'UNAVAILABLE' WHERE stationId IN (${placeholders})`, ids);
console.log(JSON.stringify({ runId: config.runId, stations: ids.length, stationIds: ids, mode: "deactivated" }, null, 2));
await pool.end();
