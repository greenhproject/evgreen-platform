import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const migrationsDir = path.join(projectRoot, "drizzle");
const trackingTable = "__evgreen_runtime_migrations";

function getConnectionOptions() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL es obligatorio para sincronizar el esquema runtime");
  }

  const url = new URL(rawUrl);
  const options = {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    multipleStatements: true,
    connectTimeout: 30_000,
  };

  const sslParam = url.searchParams.get("ssl");
  if (sslParam) {
    try {
      options.ssl = JSON.parse(sslParam);
    } catch {
      options.ssl = { rejectUnauthorized: true };
    }
  }

  return options;
}

function migrationFiles(files) {
  return files
    .filter(file => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function sqlChunks(sql) {
  return sql
    .replace(/^\uFEFF/, "")
    .split(/-->\s*statement-breakpoint/g)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk && !/^--(?:[^\n]*\n?)*$/.test(chunk));
}

function isAlreadyAppliedError(error) {
  return [1050, 1060, 1061, 1091, 1826, 1831].includes(Number(error?.errno));
}

function repairLegacyMysqlSql(sql) {
  let repairedSql = sql.replace(/DEFAULT\s+'CURRENT_TIMESTAMP'/gi, "DEFAULT CURRENT_TIMESTAMP");

  if (!/CREATE\s+TABLE/i.test(repairedSql) || !/AUTO_INCREMENT/i.test(repairedSql) || /PRIMARY\s+KEY/i.test(repairedSql)) {
    return repairedSql;
  }

  const autoColumn = repairedSql.match(/^\s*`([^`]+)`[^\n]*AUTO_INCREMENT/im)?.[1];
  const closingParen = repairedSql.lastIndexOf(")");
  if (!autoColumn || closingParen < 0) return repairedSql;

  return `${repairedSql.slice(0, closingParen).replace(/\s*$/, "")},\n\tPRIMARY KEY (\`${autoColumn}\`)\n${repairedSql.slice(closingParen)}`;
}

async function main() {
  const connection = await mysql.createConnection(getConnectionOptions());
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`${trackingTable}\` (
        migration_id varchar(255) NOT NULL PRIMARY KEY,
        applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [appliedRows] = await connection.query(
      `SELECT migration_id FROM \`${trackingTable}\``
    );
    const applied = new Set(appliedRows.map(row => row.migration_id));
    const files = migrationFiles(await fs.readdir(migrationsDir));

    console.log(`[RuntimeSchema] Revisando ${files.length} migraciones SQL`);
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      const chunks = sqlChunks(sql);
      console.log(`[RuntimeSchema] Aplicando ${file} (${chunks.length} sentencias)`);

      for (const chunk of chunks) {
        const repairedChunk = repairLegacyMysqlSql(chunk);
        if (repairedChunk !== chunk) {
          console.warn(`[RuntimeSchema] Normalizando SQL heredado en ${file}`);
        }

        try {
          await connection.query(repairedChunk);
        } catch (error) {
          if (!isAlreadyAppliedError(error)) {
            throw new Error(`Falló ${file}: ${error.message}`, { cause: error });
          }
          console.warn(`[RuntimeSchema] Omitiendo cambio ya aplicado en ${file}: ${error.message}`);
        }
      }

      await connection.query(
        `INSERT INTO \`${trackingTable}\` (migration_id) VALUES (?)`,
        [file]
      );
    }

    const [tables] = await connection.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE()`
    );
    console.log(`[RuntimeSchema] Sincronización completada; tablas visibles: ${tables[0].count}`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("[RuntimeSchema] Error fatal:", error);
  process.exitCode = 1;
});
