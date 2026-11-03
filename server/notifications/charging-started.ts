import type { InsertNotification } from "../../drizzle/schema";
import {
  buildChargingStartedNotification,
  type ChargingStartedNotification,
} from "../../shared/charging-start-notification";
import * as db from "../db";
import { sendUserPush } from "../push/unified-push";

export interface NotifyChargingStartedInput {
  transactionId: number;
  stationName: string;
  connectorId: number | string;
  timeZone?: string;
}

export interface NotifyChargingStartedResult {
  created: boolean;
  notificationId: number | null;
  /** Provider acceptance only, never proof of delivery. Null means no send attempted. */
  pushAccepted: boolean | null;
}

/**
 * The DB claim inserts the inbox row under the physical transaction lock.
 * Only that claim's winner sends a push. Provider failures retain the inbox event
 * and do not make retransmissions send another push for the same transaction.
 */
export async function notifyChargingStartedOnce({
  transactionId,
  stationName,
  connectorId,
  timeZone = "America/Bogota",
}: NotifyChargingStartedInput): Promise<NotifyChargingStartedResult> {
  let event: ChargingStartedNotification | undefined;
  const claim = await db.claimChargingStartedNotification(transactionId, (transaction): InsertNotification => {
    // Capture the exact payload built under the lock; don't rebuild after commit.
    event = buildChargingStartedNotification({
      transactionId: transaction.id,
      userId: transaction.userId,
      stationName,
      connectorId,
      startTime: transaction.startTime,
      appliedPricePerKwh: transaction.appliedPricePerKwh,
      appliedConnectionFee: transaction.appliedConnectionFee,
      timeZone,
    });
    return {
      userId: transaction.userId,
      type: "CHARGE_START",
      title: event.title,
      message: event.body,
      referenceId: transaction.id,
      referenceType: "transaction",
      data: JSON.stringify(event.data),
      isRead: 0,
      pushSent: 0,
      pushSentAt: null,
    };
  });

  if (!claim.created) {
    return { created: false, notificationId: claim.notificationId, pushAccepted: null };
  }
  if (!event || !claim.transaction || claim.notificationId === null) {
    throw new Error(`Invalid charging-start notification claim for transaction ${transactionId}`);
  }

  let pushAccepted = false;
  try {
    pushAccepted = await sendUserPush(claim.transaction.userId, {
      type: "charging_started",
      title: event.title,
      body: event.body,
      clickAction: "/charging-monitor",
      data: event.data,
    }) === true;
  } catch (error) {
    // Preserve the error/stack and event identity without claiming a delivery.
    console.error(`[ChargingStarted] Push failed for transaction ${transactionId}, notification ${claim.notificationId}:`, error);
  }
  // Keep the durable event when the provider rejects or throws. Do not release
  // the claim or mark delivery; this field records acceptance alone.
  await db.markChargingStartedPushAccepted(claim.notificationId, pushAccepted);
  return { created: true, notificationId: claim.notificationId, pushAccepted };
}
