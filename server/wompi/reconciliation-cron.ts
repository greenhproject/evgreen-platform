/**
 * Cron job de reconciliación automática de transacciones Wompi pendientes.
 * 
 * Cada 5 minutos verifica transacciones QRC-/ATC-/WLT- que quedaron en PENDING
 * y las acredita si Wompi ya las aprobó. Esto cubre los casos donde:
 * - El webhook no llegó (configuración, timeout, red)
 * - El recheck del frontend no fue suficiente
 * - El usuario cerró la app antes de que se confirmara
 */

import * as db from "../db";
import { getWompiKeys, getTransactionStatus } from "./config";

let reconciliationInterval: ReturnType<typeof setInterval> | null = null;

const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_AGE_HOURS = 48; // Solo reconciliar transacciones de las últimas 48 horas

export async function reconcilePendingTransactions(): Promise<{
  processed: number;
  credited: number;
  declined: number;
  stillPending: number;
  errors: number;
  totalCreditedAmount: number;
}> {
  const startTime = Date.now();
  console.log("[Reconciliación] Iniciando reconciliación automática de transacciones pendientes...");

  const keys = await getWompiKeys();
  if (!keys) {
    console.warn("[Reconciliación] Wompi no configurado, saltando reconciliación");
    return { processed: 0, credited: 0, declined: 0, stillPending: 0, errors: 0, totalCreditedAmount: 0 };
  }

  let processed = 0;
  let credited = 0;
  let declined = 0;
  let stillPending = 0;
  let errors = 0;
  let totalCreditedAmount = 0;

  try {
    // Obtener transacciones PENDING
    const pendingTxs = await db.getPendingWompiTransactions();

    // Filtrar solo las que tienen wompiTransactionId y son de las últimas 48h
    const cutoffTime = Date.now() - (MAX_AGE_HOURS * 60 * 60 * 1000);
    const eligibleTxs = pendingTxs.filter(tx => {
      if (!tx.wompiTransactionId) return false;
      const txTime = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
      return txTime > cutoffTime;
    });

    if (eligibleTxs.length === 0) {
      console.log("[Reconciliación] No hay transacciones pendientes para reconciliar");
      return { processed: 0, credited: 0, declined: 0, stillPending: 0, errors: 0, totalCreditedAmount: 0 };
    }

    console.log(`[Reconciliación] Encontradas ${eligibleTxs.length} transacciones pendientes`);

    for (const tx of eligibleTxs) {
      processed++;
      try {
        const txDetail = await getTransactionStatus(tx.wompiTransactionId!, keys);
        const wompiStatus = txDetail?.data?.status;

        if (wompiStatus === "APPROVED") {
          // Actualizar estado en BD
          await db.updateWompiTransactionByReference(tx.reference, {
            status: "APPROVED",
            processedAt: new Date(),
          });

          // Verificar si ya fue acreditada (evitar doble acreditación)
          const amount = tx.amountInCents / 100;
          const recentTxs = await db.getWalletTransactionsByUserId(tx.userId, 50);
          const alreadyCredited = recentTxs.some(t => t.description?.includes(tx.reference));

          if (!alreadyCredited) {
            // Acreditar billetera
            await db.addUserWalletBalance(tx.userId, amount);
            const wallet = await db.getUserWallet(tx.userId);
            const newBalance = wallet ? parseFloat(wallet.balance) : amount;

            await db.createWalletTransaction({
              walletId: wallet?.id || 0,
              userId: tx.userId,
              type: "WOMPI_RECHARGE",
              amount: amount.toString(),
              balanceBefore: (newBalance - amount).toString(),
              balanceAfter: newBalance.toString(),
              description: `Reconciliación automática: ${tx.reference}`,
            });

            const formatCOP = (n: number) =>
              new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

            // Notificación in-app
            await db.createNotification({
              userId: tx.userId,
              title: "¡Recarga acreditada!",
              message: `Se acreditaron ${formatCOP(amount)} a tu billetera. Nuevo saldo: ${formatCOP(newBalance)}.`,
              type: "PAYMENT",
              data: JSON.stringify({
                key: `auto-reconcile-${tx.reference}`,
                amount,
                reference: tx.reference,
                newBalance,
              }),
            });

            // Push notification
            try {
              const user = await db.getUserById(tx.userId);
              if (user?.fcmToken) {
                const { sendPushNotification } = await import("../firebase/fcm");
                await sendPushNotification(user.fcmToken, {
                  type: "balance_added",
                  title: "¡Recarga acreditada!",
                  body: `Se acreditaron ${formatCOP(amount)} a tu billetera.`,
                  clickAction: "/wallet",
                  data: { reference: tx.reference, amount: amount.toString() },
                });
              }
            } catch (pushErr) {
              console.warn(`[Reconciliación] Error enviando push para ${tx.reference}:`, pushErr);
            }

            credited++;
            totalCreditedAmount += amount;
            console.log(`[Reconciliación] ✓ Acreditada: ${tx.reference} - $${amount} COP - Usuario ${tx.userId}`);
          } else {
            console.log(`[Reconciliación] Ya acreditada previamente: ${tx.reference}`);
          }
        } else if (wompiStatus === "DECLINED" || wompiStatus === "ERROR" || wompiStatus === "VOIDED") {
          await db.updateWompiTransactionByReference(tx.reference, { status: wompiStatus });
          declined++;
          console.log(`[Reconciliación] ✗ ${wompiStatus}: ${tx.reference}`);
        } else {
          stillPending++;
        }

        // Pequeña pausa entre consultas para no saturar la API de Wompi
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        errors++;
        console.error(`[Reconciliación] Error procesando ${tx.reference}:`, err);
      }
    }
  } catch (err) {
    console.error("[Reconciliación] Error general:", err);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Reconciliación] Completada en ${elapsed}s - ` +
    `Procesadas: ${processed}, Acreditadas: ${credited}, Rechazadas: ${declined}, ` +
    `Pendientes: ${stillPending}, Errores: ${errors}, Total acreditado: $${totalCreditedAmount}`
  );

  return { processed, credited, declined, stillPending, errors, totalCreditedAmount };
}

/**
 * Iniciar el cron job de reconciliación automática
 */
export function startReconciliationCron() {
  if (reconciliationInterval) {
    console.warn("[Reconciliación] Cron ya está activo, ignorando");
    return;
  }

  console.log(`[Reconciliación] Cron iniciado - cada ${RECONCILIATION_INTERVAL_MS / 1000 / 60} minutos`);

  // Ejecutar la primera reconciliación después de 60 segundos (dar tiempo al servidor para arrancar)
  setTimeout(() => {
    reconcilePendingTransactions().catch(err => {
      console.error("[Reconciliación] Error en primera ejecución:", err);
    });
  }, 60 * 1000);

  // Programar ejecución periódica
  reconciliationInterval = setInterval(() => {
    reconcilePendingTransactions().catch(err => {
      console.error("[Reconciliación] Error en ejecución periódica:", err);
    });
  }, RECONCILIATION_INTERVAL_MS);
}

/**
 * Detener el cron job de reconciliación
 */
export function stopReconciliationCron() {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
    console.log("[Reconciliación] Cron detenido");
  }
}
