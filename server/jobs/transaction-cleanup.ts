/**
 * Transaction Cleanup Job
 * 
 * Limpieza periódica de transacciones huérfanas y corruptas.
 * Se ejecuta cada 15 minutos para mantener la BD limpia.
 */

import { cleanupOrphanedTransactions, cleanupCorruptedTransactions } from "../db";

let cleanupInterval: NodeJS.Timeout | null = null;

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_INACTIVE_MINUTES = 60; // 1 hora sin actividad = huérfana

/**
 * Ejecutar limpieza de transacciones
 */
async function runCleanup(): Promise<void> {
  try {
    console.log("[TransactionCleanup] Iniciando limpieza periódica...");
    
    // 1. Limpiar transacciones corruptas (datos negativos)
    const corruptedCount = await cleanupCorruptedTransactions();
    if (corruptedCount > 0) {
      console.log(`[TransactionCleanup] ${corruptedCount} transacciones corruptas cerradas`);
    }
    
    // 2. Limpiar transacciones huérfanas (sin actividad > 1 hora)
    const orphanedCount = await cleanupOrphanedTransactions(MAX_INACTIVE_MINUTES);
    if (orphanedCount > 0) {
      console.log(`[TransactionCleanup] ${orphanedCount} transacciones huérfanas cerradas`);
    }
    
    const totalCleaned = corruptedCount + orphanedCount;
    if (totalCleaned === 0) {
      console.log("[TransactionCleanup] No se encontraron transacciones para limpiar");
    } else {
      console.log(`[TransactionCleanup] Total limpiadas: ${totalCleaned}`);
    }
  } catch (error) {
    console.error("[TransactionCleanup] Error durante la limpieza:", error);
  }
}

/**
 * Iniciar el job de limpieza periódica
 */
export function startTransactionCleanupJob(): void {
  if (cleanupInterval) {
    console.log("[TransactionCleanup] Job ya está corriendo");
    return;
  }
  
  console.log(`[TransactionCleanup] Iniciando job periódico (cada ${CLEANUP_INTERVAL_MS / 60000} minutos, inactividad máxima: ${MAX_INACTIVE_MINUTES} minutos)`);
  
  // Ejecutar limpieza inicial después de 30 segundos (dar tiempo a que la BD se conecte)
  setTimeout(() => {
    runCleanup();
  }, 30000);
  
  // Programar ejecución periódica
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Detener el job de limpieza
 */
export function stopTransactionCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[TransactionCleanup] Job detenido");
  }
}
