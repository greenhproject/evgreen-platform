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
 * Runs as a periodic job every 60 seconds.
 */

import * as db from "../db";
import { transactions, evses, tariffs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sendPushNotification } from "../firebase/fcm";

// ============================================================================
// OVERSTAY SESSION TRACKING
// ============================================================================

interface OverstaySession {
  transactionId: number;
  evseId: number;
  stationId: number;
  userId: number;
  tariffId: number | null;
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
  /** Whether we've sent the grace period warning */
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
  // Check if there's already an overstay session for this EVSE
  if (activeOverstaySessions.has(evseId)) {
    console.log(`[OverstayMonitor] Overstay session already active for EVSE ${evseId}, skipping`);
    return;
  }

  try {
    // Find the most recent COMPLETED transaction for this EVSE
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    const recentTx = await dbInstance.select()
      .from(transactions)
      .where(and(
        eq(transactions.evseId, evseId),
        eq(transactions.status, "COMPLETED")
      ))
      .orderBy(transactions.endTime)
      .limit(1);

    // Also check IN_PROGRESS (the StopTransaction may not have arrived yet)
    const activeTx = await db.getActiveTransaction(evseId);
    
    const transaction = activeTx || (recentTx.length > 0 ? recentTx[0] : null);
    
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

    const session: OverstaySession = {
      transactionId: transaction.id,
      evseId,
      stationId,
      userId: transaction.userId,
      tariffId: transaction.tariffId,
      finishingStartTime: new Date(),
      gracePeriodMinutes,
      penaltyPerMinute,
      accumulatedCost: 0,
      lastChargeTime: new Date(),
      graceWarningNotified: false,
      penaltyStartNotified: false,
      chargeCount: 0,
    };

    activeOverstaySessions.set(evseId, session);
    console.log(`[OverstayMonitor] Started tracking EVSE ${evseId}: grace=${gracePeriodMinutes}min, penalty=$${penaltyPerMinute}/min, txId=${transaction.id}`);

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
// INTERNAL: PERIODIC PROCESSING
// ============================================================================

/**
 * Main processing loop - runs every 60 seconds
 */
async function processOverstaySessions() {
  if (activeOverstaySessions.size === 0) return;

  console.log(`[OverstayMonitor] Processing ${activeOverstaySessions.size} active overstay session(s)`);

  const entries = Array.from(activeOverstaySessions.entries());
  for (const [evseId, session] of entries) {
    try {
      // First, verify the EVSE is still in FINISHING state
      const evse = await db.getEvseById(evseId);
      if (!evse || (evse.status !== "FINISHING" && evse.status !== "SUSPENDED_EV")) {
        // Cable was disconnected or status changed - finalize
        console.log(`[OverstayMonitor] EVSE ${evseId} no longer in FINISHING/SUSPENDED_EV (status=${evse?.status}). Removing session.`);
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
    // Deduct from wallet
    const wallet = await db.getWalletByUserId(session.userId);
    if (wallet) {
      const currentBalance = parseFloat(wallet.balance?.toString() || "0");
      const newBalance = Math.max(0, currentBalance - penaltyAmount);

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
    }

    // Update accumulated cost
    session.accumulatedCost += penaltyAmount;
    session.lastChargeTime = now;
    session.chargeCount++;

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
        penaltyPerMinute: session.penaltyPerMinute,
        accumulatedCost: session.accumulatedCost,
      });
    } else if (session.chargeCount % 5 === 0) {
      // Send periodic update every 5 charges (~5 minutes)
      await sendOverstayNotification(session.userId, "penalty_update", {
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

type OverstayNotificationType = "warning" | "penalty_started" | "penalty_update";

async function sendOverstayNotification(
  userId: number,
  type: OverstayNotificationType,
  data: { graceRemaining?: number; penaltyPerMinute: number; accumulatedCost?: number; elapsedMinutes?: number }
) {
  try {
    let title = "";
    let message = "";

    switch (type) {
      case "warning":
        title = "Tu carga ha finalizado";
        message = `Tu vehículo ya terminó de cargar. Tienes ${data.graceRemaining} minutos para desconectar el cable antes de que se aplique la tarifa de ocupación ($${data.penaltyPerMinute.toLocaleString()}/min).`;
        break;
      case "penalty_started":
        title = "Tarifa de ocupación activa";
        message = `Se está aplicando la tarifa de ocupación de $${data.penaltyPerMinute.toLocaleString()}/min. Desconecta tu vehículo para detener el cobro. Acumulado: $${Math.round(data.accumulatedCost || 0).toLocaleString()} COP.`;
        break;
      case "penalty_update":
        title = "Tarifa de ocupación en curso";
        message = `Llevas ${data.elapsedMinutes} minutos de ocupación. Acumulado: $${Math.round(data.accumulatedCost || 0).toLocaleString()} COP ($${data.penaltyPerMinute.toLocaleString()}/min). Desconecta tu vehículo.`;
        break;
    }

    // Create in-app notification
    await db.createNotification({
      userId,
      title,
      message,
      type: "CHARGING",
    });

    // Send push notification
    const user = await db.getUserById(userId);
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "charging_complete",
        title,
        body: message,
        clickAction: "/charging",
        data: { overstayType: type },
      });
    }
  } catch (error) {
    console.error(`[OverstayMonitor] Error sending notification to user ${userId}:`, error);
  }
}
