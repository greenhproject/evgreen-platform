/**
 * Balance Monitor Service
 * 
 * Monitors wallet balance of users with active charging sessions.
 * When balance drops below threshold:
 *   1. Attempts auto-recharge via Wompi (if configured by user)
 *   2. If auto-recharge fails or is not configured and balance <= 0: sends RemoteStopTransaction
 * 
 * Runs as a periodic job every 30 seconds.
 */

import * as db from "../db";
import { dualCSMS } from "../ocpp/csms-dual";
import {
  getWompiKeys,
  generatePaymentReference,
  generateIntegritySignature,
  getTransactionStatus,
} from "../wompi/config";
import { getAcceptanceToken } from "../wompi/recurring-billing";
import { subscriptions, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Track which users we've already attempted auto-recharge for in this cycle
// to avoid spamming Wompi with repeated requests
const autoRechargeInProgress = new Set<number>();

// Track users who have been auto-stopped to avoid repeated stop commands
const autoStoppedUsers = new Set<number>();

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get all IN_PROGRESS transactions from DB
 */
async function getAllInProgressTransactions() {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  return dbInstance.select().from(transactions).where(eq(transactions.status, "IN_PROGRESS"));
}

/**
 * Start the balance monitor job
 */
export function startBalanceMonitor() {
  if (monitorInterval) {
    console.log("[BalanceMonitor] Already running, skipping start");
    return;
  }

  console.log("[BalanceMonitor] Starting balance monitor (every 30s)");
  monitorInterval = setInterval(checkActiveChargingBalances, 30_000);

  // Run immediately on start
  setTimeout(checkActiveChargingBalances, 5_000);
}

/**
 * Stop the balance monitor job
 */
export function stopBalanceMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[BalanceMonitor] Stopped");
  }
}

/**
 * Main check: find all active charging sessions and verify balances
 */
async function checkActiveChargingBalances() {
  try {
    const activeTransactions = await getAllInProgressTransactions();
    if (!activeTransactions || activeTransactions.length === 0) {
      return; // No active sessions, nothing to do
    }

    for (const tx of activeTransactions) {
      if (!tx.userId) continue;

      try {
        await checkUserBalance(tx);
      } catch (err) {
        console.error(`[BalanceMonitor] Error checking balance for user ${tx.userId}:`, err);
      }
    }
  } catch (err) {
    console.error("[BalanceMonitor] Error in balance check cycle:", err);
  }
}

/**
 * Check a single user's balance and take action if needed
 */
async function checkUserBalance(tx: any) {
  const userId = tx.userId;

  // Get wallet balance
  const wallet = await db.getWalletByUserId(userId);
  if (!wallet) return;

  const balance = parseFloat(wallet.balance) || 0;

  // Get user's auto-recharge settings
  const subscription = await db.getUserSubscription(userId);
  const autoRechargeEnabled = subscription?.autoRechargeEnabled ?? false;
  const threshold = subscription?.autoRechargeThreshold ?? 10000;
  const rechargeAmount = subscription?.autoRechargeAmount ?? 20000;

  // Check if balance is below threshold
  if (balance > threshold) {
    // Balance is fine, clear any auto-stop tracking
    autoStoppedUsers.delete(userId);
    autoRechargeInProgress.delete(userId);
    return;
  }

  console.log(`[BalanceMonitor] User ${userId} balance $${Math.round(balance)} COP is below threshold $${threshold} COP (tx: ${tx.id})`);

  // STEP 1: Try auto-recharge if enabled and has payment method
  if (autoRechargeEnabled && subscription?.wompiPaymentSourceId && !autoRechargeInProgress.has(userId)) {
    autoRechargeInProgress.add(userId);

    try {
      const result = await performAutoRecharge(userId, rechargeAmount, subscription);

      if (result.success) {
        console.log(`[BalanceMonitor] Auto-recharge SUCCESS for user ${userId}: $${rechargeAmount} COP`);

        // Notify user of successful auto-recharge
        await db.createNotification({
          userId,
          title: "Recarga automática exitosa",
          message: `Se recargaron $${rechargeAmount.toLocaleString()} COP a tu billetera automáticamente durante tu carga activa. Tarjeta ****${subscription.cardLastFour || ""}`,
          type: "PAYMENT",
          data: JSON.stringify({
            key: `auto-recharge-${Date.now()}`,
            amount: rechargeAmount,
            transactionId: tx.id,
          }),
        });

        // Update last auto-recharge timestamp
        await updateAutoRechargeTimestamp(userId);

        // Clear tracking
        autoRechargeInProgress.delete(userId);
        autoStoppedUsers.delete(userId);
        return; // Balance restored, no need to stop
      } else {
        console.warn(`[BalanceMonitor] Auto-recharge FAILED for user ${userId}: ${result.message}`);

        // Notify user of failed auto-recharge
        await db.createNotification({
          userId,
          title: "Recarga automática fallida",
          message: `No se pudo recargar tu billetera automáticamente. ${result.message}. Si tu saldo llega a $0, la carga se detendrá.`,
          type: "ALERT",
          data: JSON.stringify({
            key: `auto-recharge-fail-${Date.now()}`,
            reason: result.message,
            transactionId: tx.id,
          }),
        });

        // Increment fail count
        await incrementAutoRechargeFailCount(userId);
        autoRechargeInProgress.delete(userId);
      }
    } catch (err) {
      console.error(`[BalanceMonitor] Auto-recharge error for user ${userId}:`, err);
      autoRechargeInProgress.delete(userId);
    }
  } else if (balance > threshold && !autoRechargeEnabled) {
    // Balance below threshold but auto-recharge not enabled - just notify
    // Only notify once per session
    if (!autoRechargeInProgress.has(userId)) {
      autoRechargeInProgress.add(userId);
      await db.createNotification({
        userId,
        title: "Saldo bajo durante carga",
        message: `Tu saldo es de $${Math.round(balance).toLocaleString()} COP. Activa la recarga automática en tu perfil para evitar que tu carga se detenga.`,
        type: "ALERT",
        data: JSON.stringify({
          key: `low-balance-${Date.now()}`,
          balance: Math.round(balance),
          transactionId: tx.id,
        }),
      });
    }
  }

  // STEP 2: If balance <= 0, stop the charge
  if (balance <= 0 && !autoStoppedUsers.has(userId)) {
    console.log(`[BalanceMonitor] User ${userId} balance is $${Math.round(balance)} COP - STOPPING CHARGE (tx: ${tx.id})`);
    autoStoppedUsers.add(userId);

    try {
      await stopChargingForInsufficientBalance(tx, userId);
    } catch (err) {
      console.error(`[BalanceMonitor] Error stopping charge for user ${userId}:`, err);
      autoStoppedUsers.delete(userId); // Allow retry on next cycle
    }
  }
}

/**
 * Perform auto-recharge via Wompi payment source
 */
async function performAutoRecharge(
  userId: number,
  amount: number,
  subscription: any
): Promise<{ success: boolean; message: string }> {
  const keys = await getWompiKeys();
  if (!keys) {
    return { success: false, message: "Wompi no está configurado" };
  }

  if (!subscription.wompiPaymentSourceId) {
    return { success: false, message: "No hay tarjeta inscrita" };
  }

  const reference = generatePaymentReference("ARC"); // ARC = Auto ReCarga
  const amountInCents = amount * 100;
  const currency = "COP";

  // Get acceptance token
  const acceptanceData = await getAcceptanceToken();
  if (!acceptanceData?.acceptanceToken) {
    return { success: false, message: "No se pudo obtener token de aceptación" };
  }

  // Generate integrity signature
  const signature = generateIntegritySignature(
    reference,
    amountInCents,
    currency,
    keys.integritySecret
  );

  console.log(`[BalanceMonitor] Auto-recharge: $${amount} for user ${userId} via PS ${subscription.wompiPaymentSourceId}`);

  try {
    const response = await fetch(`${keys.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: amountInCents,
        currency,
        payment_source_id: parseInt(subscription.wompiPaymentSourceId),
        reference,
        customer_email: "", // Server-side, no email needed
        signature,
        acceptance_token: acceptanceData.acceptanceToken,
        payment_method: {
          type: "CARD",
          installments: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[BalanceMonitor] Wompi error (${response.status}):`, errorBody);
      return { success: false, message: "Error en el cobro con Wompi" };
    }

    const result = await response.json();
    const tx = result.data;

    console.log(`[BalanceMonitor] Wompi transaction: ${tx.id}, status: ${tx.status}`);

    // Save Wompi transaction
    try {
      await db.createWompiTransaction({
        userId,
        reference,
        amountInCents,
        currency,
        type: "WALLET_RECHARGE",
        customerEmail: "",
        description: `Recarga automática durante carga - $${amount.toLocaleString()} COP`,
        integritySignature: "",
      });
      await db.updateWompiTransactionByReference(reference, {
        wompiTransactionId: tx.id,
        status: tx.status,
        paymentMethodType: tx.payment_method_type || "CARD",
        processedAt: new Date(),
      });
    } catch (dbErr) {
      console.warn("[BalanceMonitor] Error saving Wompi transaction:", dbErr);
    }

    // Wait 2s for PENDING transactions (card payments usually resolve quickly)
    let finalStatus = tx.status;
    if (tx.status === "PENDING" && tx.id) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const recheckResult = await getTransactionStatus(tx.id, keys);
        if (recheckResult?.data?.status) {
          finalStatus = recheckResult.data.status;
          console.log(`[BalanceMonitor] Recheck status: ${finalStatus}`);
          if (finalStatus !== "PENDING") {
            await db.updateWompiTransactionByReference(reference, {
              status: finalStatus,
              processedAt: new Date(),
            });
          }
        }
      } catch (recheckErr) {
        console.warn("[BalanceMonitor] Error rechecking transaction:", recheckErr);
      }
    }

    if (finalStatus === "APPROVED") {
      // Credit the wallet
      const wallet = await db.getWalletByUserId(userId);
      if (wallet) {
        const currentBalance = parseFloat(wallet.balance) || 0;
        const newBalance = currentBalance + amount;
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId,
          type: "WOMPI_RECHARGE",
          amount: amount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          description: `Recarga automática durante carga: ${reference}`,
        });
        await db.updateWalletBalance(userId, newBalance.toString());
      }
      return { success: true, message: "Recarga aprobada" };
    } else if (finalStatus === "PENDING") {
      // Still pending after 2s - we'll check again next cycle
      return { success: false, message: "Pago pendiente de aprobación" };
    } else {
      return { success: false, message: `Cobro rechazado: ${finalStatus}` };
    }
  } catch (err) {
    console.error("[BalanceMonitor] Wompi API error:", err);
    return { success: false, message: "Error de conexión con Wompi" };
  }
}

/**
 * Stop charging session due to insufficient balance
 */
async function stopChargingForInsufficientBalance(tx: any, userId: number) {
  // Find the charging station and OCPP identity
  const station = tx.stationId ? await db.getChargingStationById(tx.stationId) : null;
  if (!station?.ocppIdentity) {
    console.error(`[BalanceMonitor] Cannot stop charge: no OCPP identity for station ${tx.stationId}`);
    return;
  }

  // Find the OCPP transaction ID
  const ocppTxId = tx.ocppTransactionId;
  if (!ocppTxId) {
    console.error(`[BalanceMonitor] Cannot stop charge: no OCPP transaction ID for tx ${tx.id}`);
    return;
  }

  console.log(`[BalanceMonitor] Sending RemoteStopTransaction for OCPP tx ${ocppTxId} on station ${station.ocppIdentity}`);

  try {
    // Try to stop via dualCSMS
    const result = await dualCSMS.requestStopTransaction(station.ocppIdentity, ocppTxId);
    console.log(`[BalanceMonitor] RemoteStopTransaction result:`, result);
  } catch (err) {
    console.error(`[BalanceMonitor] Error sending RemoteStopTransaction:`, err);

    // Fallback: try sendCommandIfConnected
    try {
      const numericId = typeof ocppTxId === "number" ? ocppTxId : parseInt(ocppTxId);
      const msgId = `auto-stop-${Date.now()}`;
      dualCSMS.sendCommandIfConnected(station.ocppIdentity, msgId, "RemoteStopTransaction", {
        transactionId: numericId,
      });
      console.log(`[BalanceMonitor] Fallback RemoteStopTransaction sent`);
    } catch (fallbackErr) {
      console.error(`[BalanceMonitor] Fallback also failed:`, fallbackErr);
    }
  }

  // Create notification for user
  await db.createNotification({
    userId,
    title: "Carga detenida por saldo insuficiente",
    message: "Tu carga se detuvo automáticamente porque tu saldo llegó a $0 COP. Recarga tu billetera para continuar cargando.",
    type: "ALERT",
    data: JSON.stringify({
      key: `auto-stop-balance-${Date.now()}`,
      transactionId: tx.id,
      reason: "INSUFFICIENT_BALANCE",
    }),
  });

  // Log the auto-stop event
  await db.createOcppLog({
    ocppIdentity: station.ocppIdentity,
    stationId: station.id,
    direction: "OUT",
    messageType: "RemoteStopTransaction",
    payload: JSON.stringify({
      transactionId: ocppTxId,
      reason: "INSUFFICIENT_BALANCE",
      userId,
    }),
  });
}

/**
 * Update the last auto-recharge timestamp
 */
async function updateAutoRechargeTimestamp(userId: number) {
  try {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    await dbInstance.update(subscriptions).set({
      lastAutoRechargeAt: new Date(),
      autoRechargeFailCount: 0,
    }).where(eq(subscriptions.userId, userId));
  } catch (err) {
    console.warn(`[BalanceMonitor] Error updating auto-recharge timestamp:`, err);
  }
}

/**
 * Increment the auto-recharge fail count
 */
async function incrementAutoRechargeFailCount(userId: number) {
  try {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const sub = await dbInstance.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    if (sub[0]) {
      const newCount = (sub[0].autoRechargeFailCount || 0) + 1;
      await dbInstance.update(subscriptions).set({
        autoRechargeFailCount: newCount,
      }).where(eq(subscriptions.userId, userId));

      // If failed 3+ times, disable auto-recharge and notify
      if (newCount >= 3) {
        await dbInstance.update(subscriptions).set({
          autoRechargeEnabled: false,
        }).where(eq(subscriptions.userId, userId));

        await db.createNotification({
          userId,
          title: "Recarga automática desactivada",
          message: "La recarga automática se desactivó después de 3 intentos fallidos. Verifica tu método de pago y reactívala en tu perfil.",
          type: "ALERT",
        });
      }
    }
  } catch (err) {
    console.warn(`[BalanceMonitor] Error incrementing fail count:`, err);
  }
}

// Export for testing
export {
  checkActiveChargingBalances,
  performAutoRecharge,
  stopChargingForInsufficientBalance,
  checkUserBalance,
};
