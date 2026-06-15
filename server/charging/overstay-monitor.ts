/**
 * Overstay Monitor Service
 * 
 * Monitors EVSEs in FINISHING state (charge completed, cable still connected).
 * After the grace period expires, charges the overstay penalty per minute.
 * 
 * Flow:
 * 1. StatusNotification "Finishing" → records overstay start time
 * 2. This monitor runs every 60s checking for active overstay sessions
 * 3. After grace period: deducts penalty from wallet, updates transaction overstayCost
 * 4. Sends notifications to user (warning at grace end, periodic updates)
 * 5. When cable is disconnected (Available), finalizes overstay charges
 * 
 * IMPORTANT: Uses DB-level locks (overstay_locks table) to prevent duplicate charges
 * when multiple server instances are running (e.g., Railway replicas).
 * 
 * Runs as a periodic job every 60 seconds.
 */

import * as db from "../db";
import { transactions, evses, tariffs, overstayLocks } from "../../drizzle/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { sendUserPush } from "../push/unified-push";
import { autoChargeIfNeeded } from "../wompi/auto-charge";
import crypto from "crypto";

// Unique instance ID for this server process (survives restarts with different ID)
const INSTANCE_ID = `inst-${crypto.randomUUID().substring(0, 8)}-${Date.now()}`;
// Lock heartbeat timeout: if an instance hasn't updated its heartbeat in 3 minutes, consider it dead
const LOCK_TIMEOUT_MS = 3 * 60 * 1000;

// ============================================================================
// OVERSTAY SESSION TRACKING
// ============================================================================

interface OverstaySession {
  transactionId: number;
  evseId: number;
  stationId: number;
  userId: number;
  tariffId: number | null;
  /** Station name for notifications */
  stationName: string;
  /** Connector number for notifications */
  connectorId: number;
  /** When the charger reported "Finishing" (charge complete, cable connected) */
  finishingStartTime: Date;
  /** Grace period in minutes before penalty starts */
  gracePeriodMinutes: number;
  /** Penalty rate in COP per minute */
  penaltyPerMinute: number;
  /** Total overstay cost accumulated so far (COP) */
  accumulatedCost: number;
  /** Last time we charged the user */
  lastChargeTime: Date;
  /** Whether we've sent the initial finishing notification */
  finishingNotified: boolean;
  /** Whether we've sent the grace period warning (2 min remaining) */
  graceWarningNotified: boolean;
  /** Whether we've sent the first penalty notification */
  penaltyStartNotified: boolean;
  /** Number of penalty charges applied */
  chargeCount: number;
}

// In-memory map of active overstay sessions: evseId → OverstaySession
const activeOverstaySessions = new Map<number, OverstaySession>();

let monitorInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// DB LOCK MANAGEMENT - Prevents duplicate charges across instances
// ============================================================================

/**
 * Try to acquire a DB lock for an EVSE overstay session.
 * Returns true if this instance now holds the lock, false if another instance has it.
 */
async function acquireOverstayLock(evseId: number, transactionId: number, startedAt: Date): Promise<boolean> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return false;

  try {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

    // Check if there's an existing lock for this EVSE
    const [existing] = await dbInstance.select()
      .from(overstayLocks)
      .where(eq(overstayLocks.evseId, evseId))
      .limit(1);

    if (existing) {
      // Lock exists - check if it's from this instance or if it's stale
      if (existing.instanceId === INSTANCE_ID) {
        // We already hold the lock - update heartbeat
        await dbInstance.update(overstayLocks)
          .set({ lastHeartbeat: now })
          .where(eq(overstayLocks.id, existing.id));
        return true;
      }

      if (new Date(existing.lastHeartbeat) > timeoutThreshold) {
        // Another instance holds a valid lock - do NOT process
        return false;
      }

      // Lock is stale (instance died) - take over
      console.log(`[OverstayMonitor] Taking over stale lock for EVSE ${evseId} from instance ${existing.instanceId}`);
      await dbInstance.update(overstayLocks)
        .set({
          instanceId: INSTANCE_ID,
          lastHeartbeat: now,
          transactionId,
        })
        .where(eq(overstayLocks.id, existing.id));
      return true;
    }

    // No lock exists - create one
    await dbInstance.insert(overstayLocks).values({
      evseId,
      transactionId,
      instanceId: INSTANCE_ID,
      lastHeartbeat: now,
      accumulatedCost: "0",
      lastChargeTime: now,
      startedAt,
    });
    return true;
  } catch (error: any) {
    // Duplicate key error means another instance just created the lock
    if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
      return false;
    }
    console.error(`[OverstayMonitor] Error acquiring lock for EVSE ${evseId}:`, error);
    return false;
  }
}

/**
 * Update the heartbeat and accumulated cost for our lock
 */
async function updateOverstayLock(evseId: number, accumulatedCost: number, lastChargeTime: Date): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  try {
    await dbInstance.update(overstayLocks)
      .set({
        lastHeartbeat: new Date(),
        accumulatedCost: accumulatedCost.toFixed(2),
        lastChargeTime,
      })
      .where(and(
        eq(overstayLocks.evseId, evseId),
        eq(overstayLocks.instanceId, INSTANCE_ID)
      ));
  } catch (error) {
    console.error(`[OverstayMonitor] Error updating lock for EVSE ${evseId}:`, error);
  }
}

/**
 * Release the lock when overstay session ends
 */
async function releaseOverstayLock(evseId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  try {
    await dbInstance.delete(overstayLocks)
      .where(eq(overstayLocks.evseId, evseId));
  } catch (error) {
    console.error(`[OverstayMonitor] Error releasing lock for EVSE ${evseId}:`, error);
  }
}

/**
 * Get lock info for recovery (when this instance takes over a stale lock)
 */
async function getExistingLockInfo(evseId: number): Promise<{ accumulatedCost: number; lastChargeTime: Date; startedAt: Date } | null> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;

  try {
    const [lock] = await dbInstance.select()
      .from(overstayLocks)
      .where(eq(overstayLocks.evseId, evseId))
      .limit(1);

    if (!lock) return null;
    return {
      accumulatedCost: parseFloat(lock.accumulatedCost?.toString() || "0"),
      lastChargeTime: new Date(lock.lastChargeTime),
      startedAt: new Date(lock.startedAt),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start the overstay monitor job (runs every 60 seconds)
 */
export function startOverstayMonitor() {
  if (monitorInterval) {
    console.log("[OverstayMonitor] Already running, skipping start");
    return;
  }

  console.log("[OverstayMonitor] Starting overstay monitor (every 60s)");
  monitorInterval = setInterval(processOverstaySessions, 60_000);

  // Run first check after 10s
  setTimeout(processOverstaySessions, 10_000);
}

/**
 * Stop the overstay monitor
 */
export function stopOverstayMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[OverstayMonitor] Stopped");
  }
}

/**
 * Called when a charger reports StatusNotification "Finishing"
 * This means the charge is complete but the cable is still connected.
 */
export async function onChargingFinished(evseId: number, stationId: number) {
  // Check if there's already an overstay session for this EVSE (in-memory)
  if (activeOverstaySessions.has(evseId)) {
    console.log(`[OverstayMonitor] Overstay session already active for EVSE ${evseId}, skipping`);
    return;
  }

  try {
    // Find the most recent COMPLETED transaction for this EVSE
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    // GUARD: Si hay una transacción activa (IN_PROGRESS), NO iniciar overstay.
    // Esto significa que la carga aún está en curso (el cargador reportó Finishing
    // pero la transacción no se ha completado aún en nuestro sistema).
    const activeTx = await db.getActiveTransaction(evseId);
    if (activeTx) {
      console.log(`[OverstayMonitor] EVSE ${evseId} has active IN_PROGRESS transaction (id=${activeTx.id}). NOT starting overstay - charge may still be in progress.`);
      return;
    }
    
    // Buscar la transacción completada más reciente
    const recentTx = await dbInstance.select()
      .from(transactions)
      .where(and(
        eq(transactions.evseId, evseId),
        eq(transactions.status, "COMPLETED")
      ))
      .orderBy(desc(transactions.endTime))
      .limit(1);
    const transaction = recentTx.length > 0 ? recentTx[0] : undefined;
    
    if (!transaction) {
      console.warn(`[OverstayMonitor] No transaction found for EVSE ${evseId} in Finishing state`);
      return;
    }

    // Get tariff for overstay rates - first try station tariff, then global defaults
    const globalPriceRanges = await db.getPriceRanges();
    let gracePeriodMinutes = globalPriceRanges.defaultOverstayGracePeriodMinutes ?? 10;
    let penaltyPerMinute = globalPriceRanges.defaultOverstayPenaltyPerMin ?? 500;

    if (transaction.tariffId) {
      const tariff = await db.getTariffById(transaction.tariffId);
      if (tariff) {
        const overstayRate = parseFloat(tariff.overstayPenaltyPerMinute?.toString() || "0");
        if (overstayRate > 0) {
          penaltyPerMinute = overstayRate;
        }
        if (tariff.overstayGracePeriodMinutes != null && tariff.overstayGracePeriodMinutes >= 0) {
          gracePeriodMinutes = tariff.overstayGracePeriodMinutes;
        }
      }
    }

    // Only track if penalty is configured (> 0)
    if (penaltyPerMinute <= 0) {
      console.log(`[OverstayMonitor] No overstay penalty configured for EVSE ${evseId}, skipping`);
      return;
    }

    // Get station and EVSE info for notification messages
    const station = await db.getChargingStationById(stationId);
    const evse = await db.getEvseById(evseId);
    const stationName = station?.name || `Estación #${stationId}`;
    const connectorId = evse?.connectorId || 1;

    const session: OverstaySession = {
      transactionId: transaction.id,
      evseId,
      stationId,
      userId: transaction.userId,
      tariffId: transaction.tariffId,
      stationName,
      connectorId,
      finishingStartTime: new Date(),
      gracePeriodMinutes,
      penaltyPerMinute,
      accumulatedCost: 0,
      lastChargeTime: new Date(),
      finishingNotified: false,
      graceWarningNotified: false,
      penaltyStartNotified: false,
      chargeCount: 0,
    };

    // Try to acquire DB lock before starting
    const lockAcquired = await acquireOverstayLock(evseId, transaction.id, new Date());
    if (!lockAcquired) {
      console.log(`[OverstayMonitor] Another instance already tracking EVSE ${evseId}, skipping`);
      return;
    }

    // Check if there's existing lock info (recovery from restart)
    const existingLock = await getExistingLockInfo(evseId);
    if (existingLock && existingLock.accumulatedCost > 0) {
      // Recover accumulated cost from previous instance
      session.accumulatedCost = existingLock.accumulatedCost;
      session.lastChargeTime = existingLock.lastChargeTime;
      session.finishingStartTime = existingLock.startedAt;
      session.chargeCount = Math.round(existingLock.accumulatedCost / penaltyPerMinute);
      console.log(`[OverstayMonitor] Recovered session for EVSE ${evseId}: accumulated=$${existingLock.accumulatedCost}, lastCharge=${existingLock.lastChargeTime.toISOString()}`);
    }

    activeOverstaySessions.set(evseId, session);
    console.log(`[OverstayMonitor] Started tracking EVSE ${evseId}: grace=${gracePeriodMinutes}min, penalty=$${penaltyPerMinute}/min, txId=${transaction.id}`);

    // Send immediate notification that charging is complete
    await sendOverstayNotification(session.userId, "finishing", {
      stationName,
      connectorId,
      gracePeriodMinutes,
      penaltyPerMinute,
    });
    session.finishingNotified = true;
    console.log(`[OverstayMonitor] Finishing notification sent to user ${session.userId} for ${stationName} (conector ${connectorId})`);

  } catch (error) {
    console.error(`[OverstayMonitor] Error starting overstay tracking for EVSE ${evseId}:`, error);
  }
}

/**
 * Called when a charger reports StatusNotification "Available" (cable disconnected)
 * Finalizes any active overstay session.
 */
export async function onCableDisconnected(evseId: number) {
  const session = activeOverstaySessions.get(evseId);
  if (!session) return;

  console.log(`[OverstayMonitor] Cable disconnected on EVSE ${evseId}. Finalizing overstay. Total charged: $${session.accumulatedCost.toFixed(0)} COP`);

  // Do one final charge calculation for any remaining time
  await chargeOverstayForSession(session, true);

  // Release the DB lock
  await releaseOverstayLock(evseId);

  // Remove the session
  activeOverstaySessions.delete(evseId);
}

/**
 * Get active overstay info for a specific EVSE (for UI display)
 */
export function getOverstayInfo(evseId: number) {
  const session = activeOverstaySessions.get(evseId);
  if (!session) return null;

  const now = new Date();
  const elapsedMinutes = (now.getTime() - session.finishingStartTime.getTime()) / (1000 * 60);
  const graceRemaining = Math.max(0, session.gracePeriodMinutes - elapsedMinutes);
  const isPenaltyActive = elapsedMinutes > session.gracePeriodMinutes;
  const penaltyMinutes = isPenaltyActive ? elapsedMinutes - session.gracePeriodMinutes : 0;

  return {
    evseId,
    transactionId: session.transactionId,
    finishingStartTime: session.finishingStartTime,
    elapsedMinutes: Math.round(elapsedMinutes),
    graceRemaining: Math.round(graceRemaining * 10) / 10,
    isPenaltyActive,
    penaltyMinutes: Math.round(penaltyMinutes),
    penaltyPerMinute: session.penaltyPerMinute,
    accumulatedCost: Math.round(session.accumulatedCost),
  };
}

/**
 * Get all active overstay sessions (for admin dashboard)
 */
export function getAllOverstaySessions() {
  const sessions: ReturnType<typeof getOverstayInfo>[] = [];
  activeOverstaySessions.forEach((_session, evseId) => {
    const info = getOverstayInfo(evseId);
    if (info) sessions.push(info);
  });
  return sessions;
}

// ============================================================================
// INTERNAL: DB SCAN for unmonitored overstay
// ============================================================================

/**
 * Scans the database for EVSEs in FINISHING/SUSPENDED_EV state that have
 * a recently completed transaction but no active overstay tracking.
 * This catches cases where:
 * - The StatusNotification "Finishing" was missed
 * - The server restarted and lost in-memory sessions
 * - The user stopped charging via the app (stopChargingSession) but the call to
 *   onChargingFinished didn't succeed
 */
async function scanForUnmonitoredOverstay() {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  try {
    // Find EVSEs in FINISHING state only
    // IMPORTANTE: SUSPENDED_EV NO debe incluirse aquí porque indica que el BMS del
    // vehículo redujo la corriente temporalmente (fase taper en AC, ~80-90% SoC).
    // El carro puede seguir cargando después de SuspendedEV.
    const finishingEvses = await dbInstance.select()
      .from(evses)
      .where(
        eq(evses.status, "FINISHING")
      );

    for (const evse of finishingEvses) {
      // Skip if already being tracked
      if (activeOverstaySessions.has(evse.id)) continue;

      // Find the most recent COMPLETED transaction for this EVSE
      const recentTx = await dbInstance.select()
        .from(transactions)
        .where(
          and(
            eq(transactions.evseId, evse.id),
            eq(transactions.status, "COMPLETED")
          )
        )
        .orderBy(desc(transactions.endTime))
        .limit(1);

      if (recentTx.length === 0) continue;

      const tx = recentTx[0];
      // Only consider transactions that ended recently (within 2 hours)
      const endTime = tx.endTime ? new Date(tx.endTime) : null;
      if (!endTime) continue;
      
      const hoursSinceEnd = (Date.now() - endTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceEnd > 2) {
        // Transaction ended more than 2 hours ago - likely stale EVSE status, reset it
        console.log(`[OverstayMonitor] EVSE ${evse.id} in ${evse.status} but last tx ended ${hoursSinceEnd.toFixed(1)}h ago. Resetting to AVAILABLE.`);
        await db.updateEvseStatus(evse.id, "AVAILABLE");
        continue;
      }

      console.log(`[OverstayMonitor] DB Scan: Found unmonitored EVSE ${evse.id} in ${evse.status} with completed tx ${tx.id}. Starting overstay tracking.`);
      await onChargingFinished(evse.id, tx.stationId);
    }
  } catch (error) {
    console.error(`[OverstayMonitor] Error in scanForUnmonitoredOverstay:`, error);
  }
}

// ============================================================================
// INTERNAL: PERIODIC PROCESSING
// ============================================================================

/**
 * Main processing loop - runs every 60 seconds
 * Also scans the DB for EVSEs in FINISHING state that don't have active tracking
 */
async function processOverstaySessions() {
  // SCAN DB: Detect EVSEs in FINISHING state without active overstay tracking
  try {
    await scanForUnmonitoredOverstay();
  } catch (error) {
    console.error(`[OverstayMonitor] Error scanning for unmonitored overstay:`, error);
  }

  if (activeOverstaySessions.size === 0) return;

  console.log(`[OverstayMonitor] Processing ${activeOverstaySessions.size} active overstay session(s)`);

  const entries = Array.from(activeOverstaySessions.entries());
  for (const [evseId, session] of entries) {
    try {
      // First, verify the EVSE is still in FINISHING state
      // NOTA: Solo FINISHING es válido para overstay. SUSPENDED_EV indica taper (carga aún en curso).
      const evse = await db.getEvseById(evseId);
      if (!evse || evse.status !== "FINISHING") {
        // Cable was disconnected, status changed, or car resumed charging - finalize
        console.log(`[OverstayMonitor] EVSE ${evseId} no longer in FINISHING (status=${evse?.status}). Removing session.`);
        await releaseOverstayLock(evseId);
        activeOverstaySessions.delete(evseId);
        continue;
      }

      // Verify we still hold the lock (another instance might have taken over)
      const lockValid = await acquireOverstayLock(evseId, session.transactionId, session.finishingStartTime);
      if (!lockValid) {
        console.log(`[OverstayMonitor] Lost lock for EVSE ${evseId}, removing local session`);
        activeOverstaySessions.delete(evseId);
        continue;
      }

      await chargeOverstayForSession(session, false);
    } catch (error) {
      console.error(`[OverstayMonitor] Error processing EVSE ${evseId}:`, error);
    }
  }
}

/**
 * Calculate and charge overstay for a single session
 */
async function chargeOverstayForSession(session: OverstaySession, isFinal: boolean) {
  const now = new Date();
  const elapsedMinutes = (now.getTime() - session.finishingStartTime.getTime()) / (1000 * 60);

  // Still in grace period?
  if (elapsedMinutes <= session.gracePeriodMinutes) {
    // Send grace period warning when 2 minutes remain
    const graceRemaining = session.gracePeriodMinutes - elapsedMinutes;
    if (graceRemaining <= 2 && !session.graceWarningNotified) {
      session.graceWarningNotified = true;
      await sendOverstayNotification(session.userId, "warning", {
        stationName: session.stationName,
        connectorId: session.connectorId,
        graceRemaining: Math.ceil(graceRemaining),
        penaltyPerMinute: session.penaltyPerMinute,
      });
      console.log(`[OverstayMonitor] Grace period warning sent to user ${session.userId} (${graceRemaining.toFixed(1)} min remaining)`);
    }
    return;
  }

  // Calculate penalty for time since last charge
  const minutesSinceLastCharge = (now.getTime() - session.lastChargeTime.getTime()) / (1000 * 60);
  
  // Only charge if at least 1 minute has passed since last charge
  if (minutesSinceLastCharge < 1 && !isFinal) return;

  const penaltyAmount = Math.round(minutesSinceLastCharge * session.penaltyPerMinute);
  if (penaltyAmount <= 0) return;

  try {
    // Deduct from wallet with debt management
    const wallet = await db.getWalletByUserId(session.userId);
    if (wallet) {
      const currentBalance = parseFloat(wallet.balance?.toString() || "0");
      
      if (currentBalance >= penaltyAmount) {
        // Saldo suficiente: cobrar normalmente
        const newBalance = currentBalance - penaltyAmount;
        await db.updateWalletBalance(session.userId, newBalance.toString());

        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: session.userId,
          type: "CHARGE_PAYMENT",
          amount: (-penaltyAmount).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          referenceId: session.transactionId,
          referenceType: "TRANSACTION",
          status: "COMPLETED",
          description: `Tarifa de ocupación: ${Math.round(minutesSinceLastCharge)} min × $${session.penaltyPerMinute}/min`,
        });

        console.log(`[OverstayMonitor] Charged $${penaltyAmount} COP to user ${session.userId} for ${minutesSinceLastCharge.toFixed(1)} min overstay. Balance: $${currentBalance} → $${newBalance}`);
      } else {
        // Saldo insuficiente: cobrar lo que haya y manejar el déficit
        const amountFromWallet = currentBalance; // Cobrar todo lo que tenga
        const deficit = penaltyAmount - amountFromWallet;

        // Cobrar lo que haya en billetera
        if (amountFromWallet > 0) {
          await db.updateWalletBalance(session.userId, "0");
          await db.createWalletTransaction({
            walletId: wallet.id,
            userId: session.userId,
            type: "CHARGE_PAYMENT",
            amount: (-amountFromWallet).toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: "0",
            referenceId: session.transactionId,
            referenceType: "TRANSACTION",
            status: "COMPLETED",
            description: `Tarifa de ocupación (parcial): ${Math.round(minutesSinceLastCharge)} min × $${session.penaltyPerMinute}/min (saldo insuficiente)`,
          });
          console.log(`[OverstayMonitor] Partial charge $${amountFromWallet} from wallet (of $${penaltyAmount} needed). Balance: $${currentBalance} → $0`);
        }

        // Intentar cobrar el déficit con tarjeta inscrita
        let deficitCovered = false;
        try {
          const autoChargeResult = await autoChargeIfNeeded(session.userId, deficit);
          if (autoChargeResult?.success) {
            // Auto-cobro exitoso: descontar el déficit de la billetera recargada
            const updatedWallet = await db.getWalletByUserId(session.userId);
            const updatedBalance = parseFloat(updatedWallet?.balance?.toString() || "0");
            const afterDeduction = Math.max(0, updatedBalance - deficit);
            await db.updateWalletBalance(session.userId, afterDeduction.toString());
            await db.createWalletTransaction({
              walletId: wallet.id,
              userId: session.userId,
              type: "CHARGE_PAYMENT",
              amount: (-deficit).toString(),
              balanceBefore: updatedBalance.toString(),
              balanceAfter: afterDeduction.toString(),
              referenceId: session.transactionId,
              referenceType: "TRANSACTION",
              status: "COMPLETED",
              description: `Tarifa de ocupación (auto-cobro tarjeta): déficit $${deficit} COP`,
            });
            deficitCovered = true;
            console.log(`[OverstayMonitor] Deficit $${deficit} covered by auto-charge from card`);
          }
        } catch (autoChargeErr) {
          console.error(`[OverstayMonitor] Auto-charge failed for user ${session.userId}:`, autoChargeErr);
        }

        // Si no se pudo cobrar con tarjeta: registrar deuda
        if (!deficitCovered && deficit > 0) {
          try {
            await db.createUserDebt({
              userId: session.userId,
              transactionId: session.transactionId,
              originalAmount: deficit,
              reason: "OVERSTAY",
              description: `Tarifa de ocupación no cobrada por saldo insuficiente. ${Math.round(minutesSinceLastCharge)} min × $${session.penaltyPerMinute}/min. Déficit: $${deficit} COP`,
            });

            // Notificar al usuario de la deuda
            await db.createNotification({
              userId: session.userId,
              title: "Deuda por ocupación",
              message: `Se ha registrado una deuda de $${deficit.toLocaleString()} COP por tarifa de ocupación. Tu saldo era insuficiente y no tienes tarjeta inscrita. No podrás iniciar nuevas cargas hasta pagar esta deuda.`,
              type: "PAYMENT",
              data: JSON.stringify({
                key: `debt-overstay-${session.transactionId}-${Date.now()}`,
                amount: deficit,
                reason: "OVERSTAY",
                transactionId: session.transactionId,
              }),
            });

            console.log(`[OverstayMonitor] DEBT CREATED: $${deficit} COP for user ${session.userId} (no card, insufficient balance)`);
          } catch (debtErr) {
            console.error(`[OverstayMonitor] Error creating debt:`, debtErr);
          }
        }
      }
    }

    // Update accumulated cost
    session.accumulatedCost += penaltyAmount;
    session.lastChargeTime = now;
    session.chargeCount++;

    // Update the DB lock with new accumulated cost (for recovery)
    await updateOverstayLock(session.evseId, session.accumulatedCost, now);

    // Update transaction overstayCost in DB
    await db.updateTransaction(session.transactionId, {
      overstayCost: session.accumulatedCost.toFixed(2),
      totalCost: undefined, // Will be recalculated below
    });

    // Recalculate total cost including overstay
    const tx = await db.getTransactionById(session.transactionId);
    if (tx) {
      const energyCost = parseFloat(tx.energyCost?.toString() || "0");
      const timeCost = parseFloat(tx.timeCost?.toString() || "0");
      const sessionCost = parseFloat(tx.sessionCost?.toString() || "0");
      const newTotalCost = energyCost + timeCost + sessionCost + session.accumulatedCost;
      
      // Recalculate revenue share
      const revenueConfig = await db.getRevenueShareConfig();
      const investorShare = newTotalCost * (revenueConfig.investorPercent / 100);
      const platformFee = newTotalCost * (revenueConfig.platformPercent / 100);

      await db.updateTransaction(session.transactionId, {
        overstayCost: session.accumulatedCost.toFixed(2),
        totalCost: newTotalCost.toFixed(2),
        investorShare: investorShare.toFixed(2),
        platformFee: platformFee.toFixed(2),
      });
    }

    // Send notifications
    if (!session.penaltyStartNotified) {
      session.penaltyStartNotified = true;
      await sendOverstayNotification(session.userId, "penalty_started", {
        stationName: session.stationName,
        connectorId: session.connectorId,
        penaltyPerMinute: session.penaltyPerMinute,
        accumulatedCost: session.accumulatedCost,
      });
    } else if (session.chargeCount % 5 === 0) {
      // Send periodic update every 5 charges (~5 minutes)
      await sendOverstayNotification(session.userId, "penalty_update", {
        stationName: session.stationName,
        connectorId: session.connectorId,
        penaltyPerMinute: session.penaltyPerMinute,
        accumulatedCost: session.accumulatedCost,
        elapsedMinutes: Math.round(elapsedMinutes - session.gracePeriodMinutes),
      });
    }

    // Add earnings to investor
    if (tx) {
      try {
        const station = await db.getChargingStationById(session.stationId);
        if (station?.ownerId) {
          const revenueConfig = await db.getRevenueShareConfig();
          const investorPenaltyShare = penaltyAmount * (revenueConfig.investorPercent / 100);
          await db.addInvestorEarnings(station.ownerId, investorPenaltyShare, session.transactionId);
        }
      } catch (e) {
        console.error(`[OverstayMonitor] Error adding investor earnings:`, e);
      }
    }

  } catch (error) {
    console.error(`[OverstayMonitor] Error charging overstay for user ${session.userId}:`, error);
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

type OverstayNotificationType = "finishing" | "warning" | "penalty_started" | "penalty_update";

interface OverstayNotificationData {
  stationName?: string;
  connectorId?: number;
  gracePeriodMinutes?: number;
  graceRemaining?: number;
  penaltyPerMinute: number;
  accumulatedCost?: number;
  elapsedMinutes?: number;
}

async function sendOverstayNotification(
  userId: number,
  type: OverstayNotificationType,
  data: OverstayNotificationData
) {
  try {
    let title = "";
    let message = "";
    const stationLabel = data.stationName ? `en ${data.stationName}` : "";
    const connectorLabel = data.connectorId ? ` (conector ${data.connectorId})` : "";

    switch (type) {
      case "finishing":
        title = "⚡ Carga completada";
        message = `Tu vehículo terminó de cargar ${stationLabel}${connectorLabel}. Tienes ${data.gracePeriodMinutes || 10} minutos de gracia para desconectar el cable. Después se aplicará una tarifa de ocupación de $${data.penaltyPerMinute.toLocaleString()}/min.`;
        break;
      case "warning":
        title = `⏰ ¡Quedan ${data.graceRemaining} min de gracia!`;
        message = `Tu vehículo sigue conectado ${stationLabel}${connectorLabel}. Desconéctalo en los próximos ${data.graceRemaining} minutos o se aplicará la tarifa de ocupación ($${data.penaltyPerMinute.toLocaleString()}/min).`;
        break;
      case "penalty_started":
        title = "🚨 Tarifa de ocupación activa";
        message = `Se está cobrando $${data.penaltyPerMinute.toLocaleString()}/min por ocupación ${stationLabel}${connectorLabel}. Desconecta tu vehículo para detener el cobro. Acumulado: $${Math.round(data.accumulatedCost || 0).toLocaleString()} COP.`;
        break;
      case "penalty_update":
        title = "💸 Ocupación en curso";
        message = `Llevas ${data.elapsedMinutes} min de ocupación ${stationLabel}${connectorLabel}. Acumulado: $${Math.round(data.accumulatedCost || 0).toLocaleString()} COP ($${data.penaltyPerMinute.toLocaleString()}/min). Desconecta tu vehículo.`;
        break;
    }

    // Create in-app notification
    await db.createNotification({
      userId,
      title,
      message,
      type: "CHARGING",
    });

    // Send push notification via unified push (Web Push + FCM)
    await sendUserPush(userId, {
      type: type === "finishing" ? "charging_complete" : "overstay_alert",
      title,
      body: message,
      clickAction: "/overstay",
      data: { overstayType: type },
    });

    console.log(`[OverstayMonitor] Notification sent: type=${type}, userId=${userId}, title="${title}"`);
  } catch (error) {
    console.error(`[OverstayMonitor] Error sending notification to user ${userId}:`, error);
  }
}
