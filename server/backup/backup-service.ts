/**
 * EVGreen Platform - Sistema de Backup y Recuperación de Datos
 * 
 * Exporta tablas críticas de la BD a S3 como JSON comprimido (gzip).
 * Clasificación por prioridad:
 *   P1 (Críticas): usuarios, transacciones, wallets, pagos, financiero
 *   P2 (Importantes): estaciones, crowdfunding, tickets, reservas
 *   P3 (Configuración): banners, IA, tarifas, configuración
 * 
 * @author Green House Project | @version 1.0.0 (Abril 2026)
 */

import { getDb } from "../db";
import { backupLogs } from "../../drizzle/schema";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import { storagePut, storageGet } from "../storage";
import { gzipSync } from "zlib";

// ============================================================================
// CONFIGURACIÓN DE TABLAS POR PRIORIDAD
// ============================================================================

export type BackupPriority = "P1" | "P2" | "P3";
export type BackupType = "FULL" | "CRITICAL" | "FINANCIAL" | "USERS" | "MANUAL";

interface TableConfig {
  name: string;
  priority: BackupPriority;
  description: string;
  /** Si true, excluir de backups automáticos por volumen (ej: ocpp_logs) */
  excludeFromAuto?: boolean;
  /** Límite de filas para tablas muy grandes */
  rowLimit?: number;
}

export const BACKUP_TABLES: TableConfig[] = [
  // P1 - CRÍTICAS: Datos financieros y de usuarios (backup diario)
  { name: "users", priority: "P1", description: "Usuarios registrados, inversionistas, técnicos" },
  { name: "transactions", priority: "P1", description: "Transacciones de carga completadas" },
  { name: "wallets", priority: "P1", description: "Billeteras digitales de usuarios" },
  { name: "wallet_transactions", priority: "P1", description: "Movimientos de billetera" },
  { name: "wompi_transactions", priority: "P1", description: "Pagos procesados por Wompi" },
  { name: "financial_settlements", priority: "P1", description: "Liquidaciones financieras" },
  { name: "investor_settlement_shares", priority: "P1", description: "Participaciones de inversionistas en liquidaciones" },
  { name: "settlement_expense_items", priority: "P1", description: "Ítems de gastos en liquidaciones" },
  { name: "settlement_expense_lines", priority: "P1", description: "Líneas de gastos en liquidaciones" },
  { name: "investor_payouts", priority: "P1", description: "Pagos a inversionistas" },
  { name: "user_debts", priority: "P1", description: "Deudas de usuarios" },
  { name: "subscriptions", priority: "P1", description: "Suscripciones activas" },
  
  // P2 - IMPORTANTES: Infraestructura y operaciones (backup semanal)
  { name: "charging_stations", priority: "P2", description: "Estaciones de carga" },
  { name: "evses", priority: "P2", description: "Conectores/EVSEs de estaciones" },
  { name: "crowdfunding_projects", priority: "P2", description: "Proyectos de crowdfunding" },
  { name: "crowdfunding_participations", priority: "P2", description: "Participaciones en crowdfunding" },
  { name: "support_tickets", priority: "P2", description: "Tickets de soporte" },
  { name: "support_messages", priority: "P2", description: "Mensajes de soporte" },
  { name: "maintenance_tickets", priority: "P2", description: "Tickets de mantenimiento" },
  { name: "reservations", priority: "P2", description: "Reservas de carga" },
  { name: "meter_values", priority: "P2", description: "Valores de medidor OCPP", rowLimit: 50000 },
  { name: "id_tags", priority: "P2", description: "Tags de identificación OCPP" },
  { name: "station_fixed_expenses", priority: "P2", description: "Gastos fijos de estaciones" },
  { name: "maintenance_fund_records", priority: "P2", description: "Registros de fondo de mantenimiento" },
  { name: "operational_metrics", priority: "P2", description: "Métricas operacionales" },
  { name: "charger_brands", priority: "P2", description: "Marcas de cargadores" },
  { name: "user_vehicles", priority: "P2", description: "Vehículos de usuarios" },
  { name: "notifications", priority: "P2", description: "Notificaciones enviadas", rowLimit: 10000 },
  
  // P3 - CONFIGURACIÓN: Datos de configuración y auxiliares (backup semanal)
  { name: "tariffs", priority: "P3", description: "Tarifas de carga" },
  { name: "price_history", priority: "P3", description: "Historial de precios" },
  { name: "banners", priority: "P3", description: "Banners publicitarios" },
  { name: "ai_config", priority: "P3", description: "Configuración de IA" },
  { name: "platform_settings", priority: "P3", description: "Configuración de la plataforma" },
  { name: "support_agents", priority: "P3", description: "Agentes de soporte" },
  { name: "station_reviews", priority: "P3", description: "Reseñas de estaciones" },
  { name: "favorite_stations", priority: "P3", description: "Estaciones favoritas" },
  { name: "financial_reports", priority: "P3", description: "Reportes financieros" },
  
  // Excluidas del backup automático por volumen excesivo
  { name: "ocpp_logs", priority: "P3", description: "Logs OCPP (muy voluminoso)", excludeFromAuto: true, rowLimit: 10000 },
  { name: "ocpp_alerts", priority: "P2", description: "Alertas OCPP", rowLimit: 5000 },
];

// ============================================================================
// SERVICIO DE BACKUP
// ============================================================================

interface BackupResult {
  backupId: number;
  status: "COMPLETED" | "FAILED" | "PARTIAL";
  tablesBackedUp: string[];
  tablesFailed: string[];
  totalRows: number;
  totalSizeBytes: number;
  s3Url: string | null;
  s3Key: string | null;
  duration: number; // ms
  errors: Record<string, string>;
}

/**
 * Ejecuta un backup de las tablas especificadas según el tipo.
 */
export async function executeBackup(options: {
  type: BackupType;
  triggeredBy?: string;
  isAutomatic?: boolean;
  notes?: string;
  /** Tablas específicas a respaldar (override). Si no se especifica, usa la clasificación por tipo */
  specificTables?: string[];
}): Promise<BackupResult> {
  const db = (await getDb())!;
  const startTime = Date.now();
  
  // 1. Crear registro de backup en estado RUNNING
  const [insertResult] = await db.insert(backupLogs).values({
    backupType: options.type,
    status: "RUNNING",
    triggeredBy: options.triggeredBy || "system",
    isAutomatic: options.isAutomatic ?? true,
    notes: options.notes || null,
    // Retención: 90 días para automáticos, 365 días para manuales
    expiresAt: new Date(Date.now() + (options.isAutomatic ? 90 : 365) * 24 * 60 * 60 * 1000),
  });
  
  const backupId = insertResult.insertId;
  
  // 2. Determinar qué tablas respaldar
  const tablesToBackup = getTablesForBackupType(options.type, options.specificTables);
  
  // 3. Exportar cada tabla
  const backupData: Record<string, { rows: any[]; count: number }> = {};
  const tablesFailed: string[] = [];
  const errors: Record<string, string> = {};
  let totalRows = 0;
  
  for (const table of tablesToBackup) {
    try {
      const config = BACKUP_TABLES.find(t => t.name === table);
      const limit = config?.rowLimit;
      
      let query = `SELECT * FROM \`${table}\``;
      if (limit) {
        query += ` ORDER BY id DESC LIMIT ${limit}`;
      }
      
      const result = await db.execute(sql.raw(query));
      const rowArray = (result as any)[0] as any[];
      
      backupData[table] = {
        rows: rowArray,
        count: rowArray.length,
      };
      totalRows += rowArray.length;
      
      console.log(`[Backup] ${table}: ${rowArray.length} filas exportadas`);
    } catch (error: any) {
      console.error(`[Backup] Error exportando ${table}:`, error.message);
      tablesFailed.push(table);
      errors[table] = error.message;
    }
  }
  
  // 4. Crear el archivo de backup
  const tablesBackedUp = Object.keys(backupData);
  let s3Url: string | null = null;
  let s3Key: string | null = null;
  let totalSizeBytes = 0;
  
  try {
    const backupPayload = {
      metadata: {
        backupId,
        type: options.type,
        timestamp: new Date().toISOString(),
        platform: "EVGreen",
        version: "2.0.0",
        tablesIncluded: tablesBackedUp,
        tablesFailed,
        totalRows,
        triggeredBy: options.triggeredBy || "system",
      },
      tables: backupData,
    };
    
    const jsonString = JSON.stringify(backupPayload);
    const compressed = gzipSync(Buffer.from(jsonString));
    totalSizeBytes = compressed.length;
    
    // 5. Subir a S3
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    s3Key = `backups/evgreen-${options.type.toLowerCase()}-${dateStr}-${randomSuffix}.json.gz`;
    
    const uploadResult = await storagePut(s3Key, compressed, "application/gzip");
    s3Url = uploadResult.url;
    
    console.log(`[Backup] Archivo subido a S3: ${s3Key} (${(totalSizeBytes / 1024).toFixed(1)} KB)`);
  } catch (error: any) {
    console.error(`[Backup] Error subiendo a S3:`, error.message);
    errors["_s3_upload"] = error.message;
  }
  
  // 6. Determinar estado final
  const status = tablesFailed.length === 0 && s3Url
    ? "COMPLETED"
    : tablesFailed.length === tablesBackedUp.length || !s3Url
      ? "FAILED"
      : "PARTIAL";
  
  const duration = Date.now() - startTime;
  
  // 7. Actualizar registro de backup
  await db.update(backupLogs)
    .set({
      status,
      completedAt: new Date(),
      tablesIncluded: tablesBackedUp,
      totalRows,
      totalSizeBytes,
      s3Url,
      s3Key,
      errorMessage: Object.keys(errors).length > 0 ? `Errores en: ${Object.keys(errors).join(", ")}` : null,
      errorDetails: Object.keys(errors).length > 0 ? errors : null,
    })
    .where(eq(backupLogs.id, backupId));
  
  console.log(`[Backup] Completado en ${duration}ms. Estado: ${status}. Tablas: ${tablesBackedUp.length}/${tablesToBackup.length}. Filas: ${totalRows}. Tamaño: ${(totalSizeBytes / 1024).toFixed(1)} KB`);
  
  return {
    backupId,
    status,
    tablesBackedUp,
    tablesFailed,
    totalRows,
    totalSizeBytes,
    s3Url,
    s3Key,
    duration,
    errors,
  };
}

/**
 * Obtiene las tablas a respaldar según el tipo de backup.
 */
function getTablesForBackupType(type: BackupType, specificTables?: string[]): string[] {
  if (specificTables && specificTables.length > 0) {
    return specificTables;
  }
  
  switch (type) {
    case "CRITICAL":
      return BACKUP_TABLES
        .filter(t => t.priority === "P1" && !t.excludeFromAuto)
        .map(t => t.name);
    
    case "FINANCIAL":
      return BACKUP_TABLES
        .filter(t => ["financial_settlements", "investor_settlement_shares", "settlement_expense_items", 
          "settlement_expense_lines", "investor_payouts", "transactions", "wallet_transactions", 
          "wallets", "wompi_transactions", "user_debts"].includes(t.name))
        .map(t => t.name);
    
    case "USERS":
      return BACKUP_TABLES
        .filter(t => ["users", "wallets", "subscriptions", "user_vehicles", "user_debts", 
          "id_tags", "favorite_stations"].includes(t.name))
        .map(t => t.name);
    
    case "FULL":
      return BACKUP_TABLES
        .filter(t => !t.excludeFromAuto)
        .map(t => t.name);
    
    case "MANUAL":
      return BACKUP_TABLES
        .filter(t => !t.excludeFromAuto)
        .map(t => t.name);
    
    default:
      return BACKUP_TABLES
        .filter(t => t.priority === "P1" && !t.excludeFromAuto)
        .map(t => t.name);
  }
}

// ============================================================================
// CONSULTAS DE HISTORIAL
// ============================================================================

/**
 * Obtiene el historial de backups con paginación.
 */
export async function getBackupHistory(options: {
  limit?: number;
  offset?: number;
  type?: BackupType;
}) {
  const db = (await getDb())!;
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  
  let query = db.select().from(backupLogs)
    .where(eq(backupLogs.isDeleted, false))
    .orderBy(desc(backupLogs.startedAt))
    .limit(limit)
    .offset(offset);
  
  const results = await query;
  
  // Contar total
  const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(backupLogs)
    .where(eq(backupLogs.isDeleted, false));
  
  return {
    backups: results,
    total: countResult.count,
    limit,
    offset,
  };
}

/**
 * Obtiene estadísticas generales del sistema de backups.
 */
export async function getBackupStats() {
  const db = (await getDb())!;
  
  const [stats] = await db.select({
    totalBackups: sql<number>`COUNT(*)`,
    completedBackups: sql<number>`SUM(CASE WHEN backup_status = 'COMPLETED' THEN 1 ELSE 0 END)`,
    failedBackups: sql<number>`SUM(CASE WHEN backup_status = 'FAILED' THEN 1 ELSE 0 END)`,
    partialBackups: sql<number>`SUM(CASE WHEN backup_status = 'PARTIAL' THEN 1 ELSE 0 END)`,
    totalSizeBytes: sql<number>`COALESCE(SUM(totalSizeBytes), 0)`,
    totalRowsBackedUp: sql<number>`COALESCE(SUM(totalRows), 0)`,
    lastBackupAt: sql<string>`MAX(completedAt)`,
    lastSuccessfulAt: sql<string>`MAX(CASE WHEN backup_status = 'COMPLETED' THEN completedAt ELSE NULL END)`,
  }).from(backupLogs)
    .where(eq(backupLogs.isDeleted, false));
  
  // Último backup exitoso
  const [lastSuccessful] = await db.select()
    .from(backupLogs)
    .where(and(
      eq(backupLogs.status, "COMPLETED"),
      eq(backupLogs.isDeleted, false),
    ))
    .orderBy(desc(backupLogs.completedAt))
    .limit(1);
  
  // Próximo backup automático estimado (basado en el último)
  const [lastAutomatic] = await db.select()
    .from(backupLogs)
    .where(and(
      eq(backupLogs.isAutomatic, true),
      eq(backupLogs.isDeleted, false),
    ))
    .orderBy(desc(backupLogs.startedAt))
    .limit(1);
  
  return {
    ...stats,
    lastSuccessfulBackup: lastSuccessful || null,
    lastAutomaticBackup: lastAutomatic || null,
    tableConfig: BACKUP_TABLES.map(t => ({
      name: t.name,
      priority: t.priority,
      description: t.description,
      excludedFromAuto: t.excludeFromAuto || false,
    })),
  };
}

/**
 * Obtiene la URL de descarga de un backup específico.
 */
export async function getBackupDownloadUrl(backupId: number) {
  const db = (await getDb())!;
  
  const [backup] = await db.select()
    .from(backupLogs)
    .where(eq(backupLogs.id, backupId))
    .limit(1);
  
  if (!backup) {
    throw new Error("Backup no encontrado");
  }
  
  if (!backup.s3Key) {
    throw new Error("Backup sin archivo en S3");
  }
  
  // Obtener URL de descarga presignada
  const { url } = await storageGet(backup.s3Key);
  
  return {
    backup,
    downloadUrl: url,
  };
}

/**
 * Marca un backup como eliminado (soft delete).
 */
export async function deleteBackup(backupId: number) {
  const db = (await getDb())!;
  
  await db.update(backupLogs)
    .set({ isDeleted: true })
    .where(eq(backupLogs.id, backupId));
  
  return { success: true };
}

/**
 * Limpia backups expirados.
 */
export async function cleanupExpiredBackups() {
  const db = (await getDb())!;
  const now = new Date();
  
  const expired = await db.select({ id: backupLogs.id, s3Key: backupLogs.s3Key })
    .from(backupLogs)
    .where(and(
      lt(backupLogs.expiresAt, now),
      eq(backupLogs.isDeleted, false),
    ));
  
  if (expired.length === 0) {
    console.log("[Backup Cleanup] No hay backups expirados");
    return { cleaned: 0 };
  }
  
  // Marcar como eliminados
  for (const backup of expired) {
    await db.update(backupLogs)
      .set({ isDeleted: true })
      .where(eq(backupLogs.id, backup.id));
  }
  
  console.log(`[Backup Cleanup] ${expired.length} backups expirados marcados como eliminados`);
  return { cleaned: expired.length };
}

// ============================================================================
// SERVICIO DE RESTAURACIÓN DE BACKUP
// ============================================================================

interface RestoreResult {
  tablesRestored: number;
  tablesSkipped: number;
  totalRowsRestored: number;
  errors: string[];
  details: Record<string, { inserted: number; skipped: number; error?: string }>;
}

/**
 * Restaura datos desde un backup JSON a la base de datos.
 * 
 * Modos:
 * - "merge": INSERT IGNORE — inserta filas nuevas, omite duplicados por PK
 * - "replace": DELETE + INSERT — elimina datos existentes y reinserta todo
 * 
 * Seguridad:
 * - Solo permite restaurar tablas que existen en BACKUP_TABLES
 * - Sanitiza nombres de tabla para prevenir SQL injection
 * - Procesa en lotes de 100 filas para evitar timeouts
 */
export async function restoreBackup(options: {
  tables: Record<string, any[]>;
  mode: "merge" | "replace";
  triggeredBy?: string;
  metadata?: any;
}): Promise<RestoreResult> {
  const db = (await getDb())!;
  const allowedTables = BACKUP_TABLES.map(t => t.name);
  
  const result: RestoreResult = {
    tablesRestored: 0,
    tablesSkipped: 0,
    totalRowsRestored: 0,
    errors: [],
    details: {},
  };

  const tableNames = Object.keys(options.tables);
  console.log(`[Restore] Iniciando restauración de ${tableNames.length} tablas en modo "${options.mode}"`);

  for (const tableName of tableNames) {
    // Validate table name against allowed list
    if (!allowedTables.includes(tableName)) {
      console.warn(`[Restore] Tabla "${tableName}" no está en la lista permitida, omitiendo`);
      result.tablesSkipped++;
      result.details[tableName] = { inserted: 0, skipped: 0, error: "Tabla no permitida" };
      result.errors.push(`Tabla "${tableName}" no está en la lista de tablas permitidas`);
      continue;
    }

    const rows = options.tables[tableName];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log(`[Restore] Tabla "${tableName}" sin datos, omitiendo`);
      result.tablesSkipped++;
      result.details[tableName] = { inserted: 0, skipped: 0, error: "Sin datos" };
      continue;
    }

    try {
      // Sanitize table name (only allow alphanumeric and underscore)
      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
      if (safeTableName !== tableName) {
        throw new Error(`Nombre de tabla inválido: ${tableName}`);
      }

      let insertedCount = 0;

      // In replace mode, delete existing data first
      if (options.mode === "replace") {
        // Temporarily disable foreign key checks for clean replacement
        await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 0"));
        await db.execute(sql.raw(`DELETE FROM \`${safeTableName}\``));
        console.log(`[Restore] Tabla "${safeTableName}": datos existentes eliminados`);
      }

      // Get column names from the first row
      const columns = Object.keys(rows[0]);
      if (columns.length === 0) {
        throw new Error("Filas sin columnas");
      }

      // Helper to escape SQL values
      const escapeValue = (val: any): string => {
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return String(val);
        if (typeof val === "boolean") return val ? "1" : "0";
        if (typeof val === "object" && !(val instanceof Date)) {
          const str = JSON.stringify(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          return `'${str}'`;
        }
        const str = String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `'${str}'`;
      };

      // Build column list
      const colList = columns.map(c => `\`${c.replace(/[^a-zA-Z0-9_]/g, "")}\``).join(", ");
      const insertKeyword = options.mode === "merge" ? "INSERT IGNORE" : "INSERT";

      // Process in batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        // Build values with escaped inline values
        const valueSets = batch.map(row => {
          const vals = columns.map(col => escapeValue(row[col]));
          return `(${vals.join(", ")})`;
        });

        const queryStr = `${insertKeyword} INTO \`${safeTableName}\` (${colList}) VALUES ${valueSets.join(", ")}`;
        
        try {
          const [insertResult] = await db.execute(sql.raw(queryStr)) as any;
          insertedCount += insertResult?.affectedRows || batch.length;
        } catch (batchError: any) {
          // If batch fails, try row by row
          console.warn(`[Restore] Batch error en "${safeTableName}" (lote ${i}-${i + BATCH_SIZE}): ${batchError.message}. Intentando fila por fila...`);
          for (const row of batch) {
            try {
              const vals = columns.map(col => escapeValue(row[col]));
              const singleQuery = `${insertKeyword} INTO \`${safeTableName}\` (${colList}) VALUES (${vals.join(", ")})`;
              await db.execute(sql.raw(singleQuery));
              insertedCount++;
            } catch (rowError: any) {
              // Skip individual row errors silently in merge mode
              if (options.mode !== "merge") {
                console.warn(`[Restore] Error en fila de "${safeTableName}": ${rowError.message}`);
              }
            }
          }
        }
      }

      // Re-enable foreign key checks if we disabled them
      if (options.mode === "replace") {
        await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1"));
      }

      result.tablesRestored++;
      result.totalRowsRestored += insertedCount;
      result.details[tableName] = { inserted: insertedCount, skipped: rows.length - insertedCount };
      console.log(`[Restore] Tabla "${safeTableName}": ${insertedCount}/${rows.length} filas restauradas`);

    } catch (error: any) {
      console.error(`[Restore] Error restaurando tabla "${tableName}":`, error.message);
      result.errors.push(`Error en tabla "${tableName}": ${error.message}`);
      result.details[tableName] = { inserted: 0, skipped: rows.length, error: error.message };
      
      // Make sure foreign key checks are re-enabled
      try {
        await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1"));
      } catch {}
    }
  }

  console.log(`[Restore] Completado: ${result.tablesRestored} tablas restauradas, ${result.totalRowsRestored} filas, ${result.errors.length} errores`);
  return result;
}
