/**
 * Idempotencia de Pagos — Claim Atómico
 *
 * Garantiza procesamiento exactamente-una-vez de webhooks de Wompi.
 * Usa UPDATE ... WHERE processedAt IS NULL como lock optimista:
 * solo UNA ejecución concurrente puede "ganar" el claim.
 *
 * Patrón estándar de la industria (Stripe, PayPal, MercadoPago).
 */

import { getDb } from "../db";
import { wompiTransactions } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

export interface ClaimResult {
  claimed: boolean;
  reason?: "already_processed" | "not_found" | "db_unavailable";
}

/**
 * Intenta reclamar una transacción para procesamiento.
 * 
 * Ejecuta un UPDATE atómico:
 *   UPDATE wompi_transactions
 *   SET processedAt = NOW(), wompiTransactionId = ?, status = 'APPROVED', paymentMethodType = ?
 *   WHERE reference = ? AND processedAt IS NULL
 *
 * Si affectedRows === 1, este proceso ganó el claim.
 * Si affectedRows === 0, otro proceso ya la procesó (duplicado) o no existe.
 */
export async function claimWompiTransaction(
  reference: string,
  wompiTransactionId: string,
  paymentMethodType: string
): Promise<ClaimResult> {
  const database = await getDb();
  if (!database) {
    return { claimed: false, reason: "db_unavailable" };
  }

  // UPDATE atómico: solo tiene éxito si processedAt IS NULL
  const result = await database
    .update(wompiTransactions)
    .set({
      processedAt: new Date(),
      wompiTransactionId,
      status: "APPROVED",
      paymentMethodType,
      webhookReceivedAt: new Date(),
    })
    .where(
      and(
        eq(wompiTransactions.reference, reference),
        isNull(wompiTransactions.processedAt)
      )
    );

  // Drizzle MySQL devuelve el resultado con affectedRows
  const affectedRows = (result as any)[0]?.affectedRows ?? (result as any).rowsAffected ?? 0;

  if (affectedRows === 1) {
    console.log(`[Idempotency] ✅ Claim exitoso: ${reference} (Wompi TX: ${wompiTransactionId})`);
    return { claimed: true };
  }

  // No se actualizó: verificar si ya fue procesada o no existe
  const existing = await database
    .select({ id: wompiTransactions.id, processedAt: wompiTransactions.processedAt })
    .from(wompiTransactions)
    .where(eq(wompiTransactions.reference, reference))
    .limit(1);

  if (existing.length === 0) {
    console.warn(`[Idempotency] ⚠️ Referencia no encontrada: ${reference}`);
    return { claimed: false, reason: "not_found" };
  }

  // Existe pero ya tiene processedAt → duplicado
  console.log(`[Idempotency] 🔁 Duplicado detectado: ${reference} (ya procesada en ${existing[0].processedAt})`);
  return { claimed: false, reason: "already_processed" };
}

/**
 * Libera un claim en caso de fallo post-procesamiento.
 * Permite que un reintento futuro de Wompi vuelva a intentar.
 * 
 * USAR SOLO si el procesamiento posterior al claim falla
 * (ej: error al acreditar billetera después del claim exitoso).
 */
export async function releaseWompiClaim(reference: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  await database
    .update(wompiTransactions)
    .set({
      processedAt: null,
      status: "PENDING",
    })
    .where(eq(wompiTransactions.reference, reference));

  console.log(`[Idempotency] 🔓 Claim liberado: ${reference} (disponible para reintento)`);
}
