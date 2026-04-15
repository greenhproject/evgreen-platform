/**
 * EVGreen Platform - Router de Backup y Recuperación
 * 
 * Procedimientos tRPC para gestionar backups desde el panel admin:
 * - Ejecutar backup manual (full, crítico, financiero, usuarios)
 * - Ver historial de backups
 * - Descargar backup específico
 * - Obtener estadísticas
 * - Configurar backup automático
 * 
 * @author Green House Project | @version 1.0.0 (Abril 2026)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  executeBackup,
  getBackupHistory,
  getBackupStats,
  getBackupDownloadUrl,
  deleteBackup,
  cleanupExpiredBackups,
  BACKUP_TABLES,
  type BackupType,
} from "./backup-service";
import { sendBackupNotification } from "./backup-notifications";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden gestionar backups" });
  }
  return next({ ctx });
});

export const backupRouter = router({
  /**
   * Ejecutar un backup manual.
   */
  executeBackup: adminProcedure
    .input(z.object({
      type: z.enum(["FULL", "CRITICAL", "FINANCIAL", "USERS", "MANUAL"]),
      notes: z.string().optional(),
      specificTables: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await executeBackup({
          type: input.type as BackupType,
          triggeredBy: ctx.user.name || ctx.user.id.toString(),
          isAutomatic: false,
          notes: input.notes,
          specificTables: input.specificTables,
        });
        
        // Enviar notificación por email
        await sendBackupNotification(result).catch((err: any) => {
          console.error("[Backup] Error enviando notificación:", err.message);
        });
        
        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error ejecutando backup: ${error.message}`,
        });
      }
    }),
  
  /**
   * Obtener historial de backups.
   */
  getHistory: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      type: z.enum(["FULL", "CRITICAL", "FINANCIAL", "USERS", "MANUAL"]).optional(),
    }))
    .query(async ({ input }) => {
      return getBackupHistory({
        limit: input.limit,
        offset: input.offset,
        type: input.type as BackupType | undefined,
      });
    }),
  
  /**
   * Obtener estadísticas del sistema de backups.
   */
  getStats: adminProcedure.query(async () => {
    return getBackupStats();
  }),
  
  /**
   * Obtener URL de descarga de un backup.
   */
  getDownloadUrl: adminProcedure
    .input(z.object({ backupId: z.number() }))
    .query(async ({ input }) => {
      try {
        return await getBackupDownloadUrl(input.backupId);
      } catch (error: any) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error.message,
        });
      }
    }),
  
  /**
   * Eliminar un backup (soft delete).
   */
  deleteBackup: adminProcedure
    .input(z.object({ backupId: z.number() }))
    .mutation(async ({ input }) => {
      return deleteBackup(input.backupId);
    }),
  
  /**
   * Limpiar backups expirados.
   */
  cleanupExpired: adminProcedure.mutation(async () => {
    return cleanupExpiredBackups();
  }),
  
  /**
   * Obtener la configuración de tablas para backup.
   */
  getTableConfig: adminProcedure.query(async () => {
    return BACKUP_TABLES.map(t => ({
      name: t.name,
      priority: t.priority,
      description: t.description,
      excludedFromAuto: t.excludeFromAuto || false,
      rowLimit: t.rowLimit || null,
    }));
  }),
});

// ============================================================================
// SISTEMA DE BACKUP AUTOMÁTICO
// ============================================================================

let backupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia el sistema de backup automático.
 * - Backup CRITICAL (P1): cada 24 horas
 * - Backup FULL: cada 7 días (domingo a las 3am)
 * - Limpieza de expirados: cada 24 horas
 */
export function startAutomaticBackups() {
  console.log("[Backup Auto] Iniciando sistema de backup automático...");
  
  // Backup crítico diario - cada 24 horas
  const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24h
  
  backupInterval = setInterval(async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo
    
    try {
      if (dayOfWeek === 0) {
        // Domingo: backup FULL
        console.log("[Backup Auto] Ejecutando backup FULL semanal...");
        const result = await executeBackup({
          type: "FULL",
          triggeredBy: "sistema-automatico",
          isAutomatic: true,
          notes: "Backup completo semanal automático",
        });
        await sendBackupNotification(result).catch(() => {});
      } else {
        // Otros días: backup CRITICAL (P1)
        console.log("[Backup Auto] Ejecutando backup CRITICAL diario...");
        const result = await executeBackup({
          type: "CRITICAL",
          triggeredBy: "sistema-automatico",
          isAutomatic: true,
          notes: "Backup crítico diario automático",
        });
        // Solo notificar si falla
        if (result.status !== "COMPLETED") {
          await sendBackupNotification(result).catch(() => {});
        }
      }
      
      // Limpiar backups expirados
      await cleanupExpiredBackups();
    } catch (error: any) {
      console.error("[Backup Auto] Error en backup automático:", error.message);
    }
  }, DAILY_INTERVAL);
  
  // Ejecutar primer backup crítico 5 minutos después del inicio
  setTimeout(async () => {
    try {
      console.log("[Backup Auto] Ejecutando backup inicial...");
      const result = await executeBackup({
        type: "CRITICAL",
        triggeredBy: "sistema-automatico",
        isAutomatic: true,
        notes: "Backup inicial al arrancar el servidor",
      });
      console.log(`[Backup Auto] Backup inicial completado: ${result.status}`);
    } catch (error: any) {
      console.error("[Backup Auto] Error en backup inicial:", error.message);
    }
  }, 5 * 60 * 1000); // 5 minutos
  
  console.log("[Backup Auto] Sistema configurado:");
  console.log("  - Backup CRITICAL (P1): diario");
  console.log("  - Backup FULL: domingos");
  console.log("  - Limpieza de expirados: diaria");
  console.log("  - Primer backup: en 5 minutos");
}

/**
 * Detiene el sistema de backup automático.
 */
export function stopAutomaticBackups() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log("[Backup Auto] Sistema de backup automático detenido");
  }
}
