import { sql } from "drizzle-orm";
import { getDb } from "../db";

const REQUIRED_LONGTEXT_COLUMNS = [
  { table: "contract_templates", column: "html_content" },
  { table: "site_contracts", column: "contract_html" },
] as const;

const CONTRACT_TABLES = [
  `CREATE TABLE IF NOT EXISTS \`contract_templates\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) NOT NULL,
    \`version\` varchar(64) NOT NULL,
    \`status\` enum('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
    \`source_filename\` varchar(255) NOT NULL,
    \`source_mime_type\` varchar(100) NOT NULL,
    \`source_file_url\` text NOT NULL,
    \`source_file_key\` varchar(500) NOT NULL,
    \`html_content\` longtext NOT NULL,
    \`variable_schema\` json NOT NULL,
    \`content_hash\` varchar(64) NOT NULL,
    \`legal_review_note\` text,
    \`approved_by\` int, \`approved_at\` timestamp NULL,
    \`retired_by\` int, \`retired_at\` timestamp NULL,
    \`created_by\` int NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`contract_templates_name_version_unique\` (\`name\`,\`version\`),
    KEY \`idx_contract_templates_status\` (\`status\`,\`created_at\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`site_contracts\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`contract_number\` varchar(64) NOT NULL,
    \`submission_id\` int NOT NULL,
    \`template_id\` int NOT NULL,
    \`template_name\` varchar(255) NOT NULL,
    \`template_version\` varchar(64) NOT NULL,
    \`status\` enum('DRAFT','READY','DOCUSIGN_SENT','DOCUSIGN_COMPLETED','DOCUSIGN_DECLINED','DOCUSIGN_VOIDED','DOCUSIGN_EXPIRED','MANUAL_PDF_ISSUED','MANUAL_PDF_RETURNED','MANUAL_PDF_VERIFIED','MANUAL_PDF_REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    \`variables_snapshot\` json NOT NULL,
    \`contract_html\` longtext NOT NULL,
    \`content_hash\` varchar(64) NOT NULL,
    \`draft_pdf_url\` text, \`draft_pdf_key\` varchar(500),
    \`docusign_envelope_id\` varchar(100), \`docusign_envelope_status\` varchar(64),
    \`docusign_completed_pdf_url\` text, \`docusign_completed_pdf_key\` varchar(500),
    \`docusign_certificate_url\` text, \`docusign_certificate_key\` varchar(500),
    \`manual_signed_pdf_url\` text, \`manual_signed_pdf_key\` varchar(500),
    \`manual_returned_at\` timestamp NULL, \`manual_verified_at\` timestamp NULL, \`manual_verified_by\` int,
    \`manual_download_token_hash\` varchar(64) NULL, \`manual_download_expires_at\` timestamp NULL,
    \`expires_at\` timestamp NULL, \`issued_at\` timestamp NULL, \`completed_at\` timestamp NULL,
    \`cancelled_at\` timestamp NULL, \`cancelled_by\` int, \`cancellation_reason\` text,
    \`created_by\` int NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`site_contracts_number_unique\` (\`contract_number\`),
    UNIQUE KEY \`site_contracts_docusign_envelope_unique\` (\`docusign_envelope_id\`),
    UNIQUE KEY \`site_contracts_manual_download_token_unique\` (\`manual_download_token_hash\`),
    KEY \`idx_site_contracts_submission\` (\`submission_id\`,\`created_at\`),
    KEY \`idx_site_contracts_status\` (\`status\`,\`updated_at\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`site_contract_parties\` (
    \`id\` int NOT NULL AUTO_INCREMENT, \`contract_id\` int NOT NULL,
    \`role\` enum('OPERATOR','ALLY') NOT NULL,
    \`legal_name\` varchar(255) NOT NULL, \`tax_id\` varchar(64) NOT NULL,
    \`representative_name\` varchar(255) NOT NULL, \`representative_document\` varchar(64) NOT NULL,
    \`representative_title\` varchar(120), \`email\` varchar(320) NOT NULL, \`phone\` varchar(50),
    \`notification_address\` varchar(500) NOT NULL, \`domicile\` varchar(160), \`signing_order\` int NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`site_contract_parties_contract_role_unique\` (\`contract_id\`,\`role\`),
    KEY \`idx_site_contract_parties_contract_order\` (\`contract_id\`,\`signing_order\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`site_contract_events\` (
    \`id\` int NOT NULL AUTO_INCREMENT, \`contract_id\` int NOT NULL, \`event_type\` varchar(80) NOT NULL,
    \`channel\` enum('INTERNAL','DOCUSIGN','MANUAL_PDF') NOT NULL DEFAULT 'INTERNAL',
    \`external_event_id\` varchar(160), \`actor_user_id\` int, \`actor_role\` varchar(32), \`actor_email\` varchar(320),
    \`ip_address\` varchar(64), \`user_agent\` text, \`details\` json,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`), UNIQUE KEY \`site_contract_events_external_unique\` (\`external_event_id\`),
    KEY \`idx_site_contract_events_contract_created\` (\`contract_id\`,\`created_at\`)
  )`,
] as const;

const DOCUSIGN_PLATFORM_COLUMNS = [
  "ADD COLUMN `docusign_environment` enum('SANDBOX','PRODUCTION') NOT NULL DEFAULT 'SANDBOX'",
  "ADD COLUMN `docusign_enabled` tinyint NOT NULL DEFAULT 0",
  "ADD COLUMN `docusign_integration_key` varchar(100)",
  "ADD COLUMN `docusign_user_id` varchar(100)",
  "ADD COLUMN `docusign_account_id` varchar(100)",
  "ADD COLUMN `docusign_base_uri` varchar(255)",
  "ADD COLUMN `docusign_private_key_encrypted` text",
  "ADD COLUMN `docusign_webhook_secret_encrypted` text",
  "ADD COLUMN `docusign_last_test_at` timestamp NULL",
  "ADD COLUMN `docusign_last_test_status` enum('NEVER','SUCCESS','FAILED') NOT NULL DEFAULT 'NEVER'",
  "ADD COLUMN `docusign_last_test_message` text",
  "ADD COLUMN `docusign_consent_redirect_uri` varchar(500)",
] as const;

let verificationPromise: Promise<void> | null = null;

async function hasColumn(db: any, table: string, column: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 AS present
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
    LIMIT 1
  `);
  const rows = Array.isArray(result) ? result[0] : [];
  return Boolean((rows as Array<{ present?: number }>)[0]?.present);
}

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

    // Railway utiliza una base de datos independiente de la usada en desarrollo.
    // Si allí no ha corrido el historial de Drizzle, crear estas tablas es necesario
    // para que las consultas administrativas no fallen antes de importar un DOCX.
    for (const statement of CONTRACT_TABLES) {
      await db.execute(sql.raw(statement));
    }

    for (const definition of DOCUSIGN_PLATFORM_COLUMNS) {
      const column = definition.match(/`([^`]+)`/)?.[1];
      if (column && !(await hasColumn(db, "platform_settings", column))) {
        await db.execute(sql.raw(`ALTER TABLE \`platform_settings\` ${definition}`));
        console.log(`[Contracts] Added platform_settings.${column}`);
      }
    }

    for (const target of REQUIRED_LONGTEXT_COLUMNS) {
      const result = await db.execute(sql`
        SELECT COLUMN_TYPE AS column_type FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${target.table} AND COLUMN_NAME = ${target.column} LIMIT 1
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
