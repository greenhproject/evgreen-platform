import { sql } from "drizzle-orm";
import { getDb } from "../db";

const REQUIRED_LONGTEXT_COLUMNS = [
  { table: "contract_templates", column: "html_content" },
  { table: "site_contracts", column: "contract_html" },
] as const;

let verificationPromise: Promise<void> | null = null;

/**
 * Mantiene compatible el esquema del expediente contractual en despliegues
 * donde las migraciones históricas todavía no se hayan aplicado. Solo ensancha
 * columnas TEXT existentes; no elimina, transforma ni reescribe documentos.
 */
export async function ensureContractDocumentStorage(): Promise<void> {
  if (verificationPromise) return verificationPromise;

  verificationPromise = (async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Contracts] No database connection; document storage verification skipped");
      return;
    }

    for (const target of REQUIRED_LONGTEXT_COLUMNS) {
      const result = await db.execute(sql`
        SELECT COLUMN_TYPE AS column_type
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${target.table}
          AND COLUMN_NAME = ${target.column}
        LIMIT 1
      `);
      const rows = Array.isArray(result) ? result[0] : [];
      const columnType = String((rows as Array<{ column_type?: string }>)[0]?.column_type ?? "").toLowerCase();

      if (!columnType) {
        console.warn(`[Contracts] ${target.table}.${target.column} does not exist; migration required`);
        continue;
      }

      if (columnType === "longtext") continue;

      await db.execute(sql.raw(
        `ALTER TABLE \`${target.table}\` MODIFY COLUMN \`${target.column}\` LONGTEXT NOT NULL`
      ));
      console.log(`[Contracts] Expanded ${target.table}.${target.column} from ${columnType} to LONGTEXT`);
    }
  })().catch((error) => {
    verificationPromise = null;
    console.error("[Contracts] Document storage verification failed", error);
  });

  return verificationPromise;
}
