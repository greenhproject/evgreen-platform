/**
 * recurring-billing.ts — Motor de renovación automática de suscripciones EVGreen
 *
 * Flujo de renovación (ejecutado diariamente vía Heartbeat):
 *  D-3  → Recordatorio: "Tu plan vence en 3 días, asegura saldo"
 *  D-0  → Intento 1: Billetera → Tarjeta Wompi → Suspender + notificar
 *  D+3  → Intento 2: misma lógica
 *  D+6  → Intento 3: misma lógica → si falla → cancelar definitivamente
 *  D+10 → Cancelación definitiva si sigue suspendido
 *
 * Política de cancelación voluntaria:
 *  - El usuario cancela en cualquier momento → estado CANCELLED_PENDING
 *  - El plan sigue activo hasta nextBillingDate (período ya pagado)
 *  - Al vencer: estado CANCELLED, sin más cobros
 */

import {
  getWompiKeys,
  generatePaymentReference,
  generateIntegritySignature,
  WompiKeys,
} from "./config";
import * as db from "../db";
import { sendPushNotification } from "../firebase/fcm";
import { sendSubscriptionEmail } from "../email/subscription-email";
import { getDb } from "../db";
import { subscriptions } from "../../drizzle/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";

// ─── Constantes ──────────────────────────────────────────────────────────────
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_DAYS = 3;
const GRACE_PERIOD_DAYS = 10;
const BILLING_CYCLE_DAYS = 30;

export const PLAN_PRICES: Record<string, number> = {
  BASIC: 18900,
  PREMIUM: 33900,
  FREE: 0,
};

export const PLAN_NAMES: Record<string, string> = {
  BASIC: "Plan Básico",
  PREMIUM: "Plan Premium",
  FREE: "Plan Gratuito",
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Función principal (llamada por el Heartbeat job) ─────────────────────────
export async function processRecurringBilling(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  cancelled: number;
  reminders: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    successful: 0,
    failed: 0,
    cancelled: 0,
    reminders: 0,
    errors: [] as string[],
  };

  console.log("[Billing] ═══════════════════════════════════════════════════");
  console.log("[Billing] Iniciando proceso de renovación automática...");
  console.log(`[Billing] Fecha: ${new Date().toISOString()}`);

  // 1. Recordatorios D-3
  try {
    result.reminders = await sendRenewalReminders();
    console.log(`[Billing] Recordatorios enviados: ${result.reminders}`);
  } catch (err: any) {
    result.errors.push(`Recordatorios: ${err.message}`);
  }

  // 2. Procesar cancelaciones CANCELLED_PENDING vencidas
  try {
    const n = await processPendingCancellations();
    result.cancelled += n;
    console.log(`[Billing] Cancelaciones pendientes procesadas: ${n}`);
  } catch (err: any) {
    result.errors.push(`Cancelaciones pendientes: ${err.message}`);
  }

  // 3. Cancelar suspensiones expiradas (> GRACE_PERIOD_DAYS)
  try {
    const n = await cancelExpiredSuspensions();
    result.cancelled += n;
    console.log(`[Billing] Suspensiones expiradas canceladas: ${n}`);
  } catch (err: any) {
    result.errors.push(`Suspensiones expiradas: ${err.message}`);
  }

  // 4. Obtener llaves de Wompi (puede ser null si no está configurado)
  const keys = await getWompiKeys();

  // 5. Obtener suscripciones que necesitan cobro hoy
  let subs: any[];
  try {
    subs = await db.getActiveSubscriptionsForBilling();
  } catch (err: any) {
    result.errors.push(`Consulta BD: ${err.message}`);
    return result;
  }

  console.log(`[Billing] ${subs.length} suscripciones pendientes de cobro`);

  // 6. Procesar cada suscripción
  for (const sub of subs) {
    result.processed++;
    try {
      await processSingleSubscription(sub, keys, result);
    } catch (err: any) {
      console.error(`[Billing] Error inesperado en sub ${sub.id}:`, err);
      result.errors.push(`Sub ${sub.id}: ${err.message}`);
      result.failed++;
    }
  }

  console.log(`[Billing] Resultado:`, result);
  console.log("[Billing] ═══════════════════════════════════════════════════");
  return result;
}

// ─── Procesar una suscripción individual ──────────────────────────────────────
async function processSingleSubscription(
  sub: any,
  keys: WompiKeys | null,
  result: { successful: number; failed: number; cancelled: number }
): Promise<void> {
  const tier = ((sub.tier || sub.subscriptionTier || "BASIC") as string).toUpperCase();
  const amount = PLAN_PRICES[tier] ?? PLAN_PRICES.BASIC;
  const planName = PLAN_NAMES[tier] ?? "Plan Básico";
  const failedCount = sub.failedPaymentCount || 0;

  console.log(`[Billing] Sub ${sub.id} | User ${sub.userId} | ${planName} | Fallos: ${failedCount}`);

  // Excedió reintentos → cancelar definitivamente
  if (failedCount >= MAX_RETRY_ATTEMPTS) {
    await cancelSubscriptionForNonPayment(sub, planName);
    result.cancelled++;
    return;
  }

  // Intento 1: Billetera EVGreen
  const wallet = await db.getUserWallet(sub.userId);
  const walletBalance = parseFloat((wallet?.balance ?? "0").toString());

  if (walletBalance >= amount) {
    const ok = await chargeFromWallet(sub, wallet, amount, planName);
    if (ok) { result.successful++; return; }
  }

  // Intento 2: Tarjeta tokenizada Wompi
  if (keys && sub.wompiPaymentSourceId) {
    const ok = await chargeWithPaymentSource(sub, amount, planName, keys);
    if (ok) { result.successful++; return; }
  }

  // Sin métodos disponibles → suspender y notificar
  await handleFailedRenewal(sub, amount, planName, walletBalance);
  result.failed++;
}

// ─── Cobro desde billetera ────────────────────────────────────────────────────
async function chargeFromWallet(
  sub: any,
  wallet: any,
  amount: number,
  planName: string
): Promise<boolean> {
  const reference = generatePaymentReference("RENWAL");
  const walletBalance = parseFloat((wallet?.balance ?? "0").toString());
  const newBalance = walletBalance - amount;

  try {
    await db.updateWalletBalance(sub.userId, newBalance.toFixed(2));

    await db.createWalletTransaction({
      walletId: wallet.id,
      userId: sub.userId,
      amount: (-amount).toString(),
      balanceBefore: walletBalance.toString(),
      balanceAfter: newBalance.toFixed(2),
      type: "DEBIT",
      description: `Renovación automática ${planName}`,
      referenceType: "SUBSCRIPTION",
      paymentStatus: "COMPLETED",
    });

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + BILLING_CYCLE_DAYS);

    await db.updateSubscriptionBilling(sub.id, {
      lastPaymentDate: new Date(),
      lastPaymentReference: reference,
      nextBillingDate: nextBilling,
      failedPaymentCount: 0,
    });

    await setSubscriptionStatus(sub.userId, "ACTIVE");

    const user = await db.getUserById(sub.userId);

    await db.createNotification({
      userId: sub.userId,
      title: `✅ ${planName} renovado`,
      message: `Tu ${planName} fue renovado automáticamente. Se descontaron ${formatCOP(amount)} de tu billetera. Saldo: ${formatCOP(newBalance)}.`,
      type: "PAYMENT",
      data: JSON.stringify({
        key: `renewal-wallet-${reference}`,
        reference,
        planId: tier(sub),
        paymentMethod: "wallet",
        amount,
        nextBillingDate: nextBilling.toISOString(),
      }),
    });

    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "payment_success",
        title: `✅ ${planName} renovado`,
        body: `Se descontaron ${formatCOP(amount)} de tu billetera. Próximo cobro: ${nextBilling.toLocaleDateString("es-CO")}.`,
        clickAction: "/subscription",
        data: { reference, amount: amount.toString() },
      }).catch(console.warn);
    }

    if (user?.email) {
      await sendSubscriptionEmail({
        type: "renewal_success",
        to: user.email,
        userName: user.name || "Usuario",
        planName,
        amount,
        paymentMethod: "Billetera EVGreen",
        reference,
        nextBillingDate: nextBilling,
        walletBalance: newBalance,
      }).catch(console.warn);
    }

    console.log(`[Billing] ✅ Renovación vía billetera: sub ${sub.id}, ref ${reference}`);
    return true;
  } catch (err: any) {
    console.error(`[Billing] Error cobrando billetera sub ${sub.id}:`, err);
    return false;
  }
}

// ─── Cobro con tarjeta tokenizada Wompi ───────────────────────────────────────
async function chargeWithPaymentSource(
  sub: any,
  amount: number,
  planName: string,
  keys: WompiKeys
): Promise<boolean> {
  const reference = generatePaymentReference("RENREC");
  const amountInCents = amount * 100;

  try {
    const acceptanceData = await fetchAcceptanceToken(keys);
    const signature = generateIntegritySignature(reference, amountInCents, "COP", keys.integritySecret);

    const response = await fetch(`${keys.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: amountInCents,
        currency: "COP",
        payment_source_id: parseInt(sub.wompiPaymentSourceId),
        reference,
        customer_email: sub.customerEmail || "",
        signature,
        acceptance_token: acceptanceData?.acceptanceToken || "",
        payment_method: { type: "CARD", installments: 1 },
      }),
    });

    if (!response.ok) {
      await db.incrementSubscriptionFailedPayments(sub.id);
      return false;
    }

    const txResult = await response.json();
    const txStatus = txResult.data?.status || txResult.data?.wompiTxStatus;

    if (txStatus === "APPROVED") {
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + BILLING_CYCLE_DAYS);

      await db.updateSubscriptionBilling(sub.id, {
        lastPaymentDate: new Date(),
        lastPaymentReference: reference,
        nextBillingDate: nextBilling,
        failedPaymentCount: 0,
      });

      await setSubscriptionStatus(sub.userId, "ACTIVE");

      const user = await db.getUserById(sub.userId);

      await db.createNotification({
        userId: sub.userId,
        title: `✅ ${planName} renovado`,
        message: `Tu ${planName} fue renovado. Se cobró ${formatCOP(amount)} a tu tarjeta ****${sub.cardLastFour}. Próximo cobro: ${nextBilling.toLocaleDateString("es-CO")}.`,
        type: "PAYMENT",
        data: JSON.stringify({ key: `renewal-card-${reference}`, reference, planId: tier(sub) }),
      });

      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: "payment_success",
          title: `✅ ${planName} renovado`,
          body: `Cobro de ${formatCOP(amount)} a tarjeta ****${sub.cardLastFour} aprobado.`,
          clickAction: "/subscription",
          data: { reference },
        }).catch(console.warn);
      }

      if (user?.email) {
        await sendSubscriptionEmail({
          type: "renewal_success",
          to: user.email,
          userName: user.name || "Usuario",
          planName,
          amount,
          paymentMethod: `Tarjeta ****${sub.cardLastFour}`,
          reference,
          nextBillingDate: nextBilling,
        }).catch(console.warn);
      }

      console.log(`[Billing] ✅ Renovación vía tarjeta: sub ${sub.id}`);
      return true;
    }

    await db.incrementSubscriptionFailedPayments(sub.id);
    return false;
  } catch (err: any) {
    console.error(`[Billing] Error tarjeta sub ${sub.id}:`, err);
    await db.incrementSubscriptionFailedPayments(sub.id);
    return false;
  }
}

// ─── Manejar fallo de renovación → suspender ─────────────────────────────────
async function handleFailedRenewal(
  sub: any,
  amount: number,
  planName: string,
  walletBalance: number
): Promise<void> {
  const failedCount = (sub.failedPaymentCount || 0) + 1;
  await db.incrementSubscriptionFailedPayments(sub.id);
  await setSubscriptionStatus(sub.userId, "SUSPENDED");

  const shortfall = amount - walletBalance;
  const remainingAttempts = MAX_RETRY_ATTEMPTS - failedCount;
  const nextRetryDate = new Date();
  nextRetryDate.setDate(nextRetryDate.getDate() + RETRY_INTERVAL_DAYS);

  const message = remainingAttempts > 0
    ? `No pudimos renovar tu ${planName}. Te faltan ${formatCOP(shortfall)} en tu billetera. Lo intentaremos de nuevo el ${nextRetryDate.toLocaleDateString("es-CO")} (intento ${failedCount}/${MAX_RETRY_ATTEMPTS}).`
    : `No pudimos renovar tu ${planName} después de ${MAX_RETRY_ATTEMPTS} intentos. Tu plan será cancelado en ${GRACE_PERIOD_DAYS} días si no regularizas el pago.`;

  const user = await db.getUserById(sub.userId);

  await db.createNotification({
    userId: sub.userId,
    title: `⚠️ No se pudo renovar tu ${planName}`,
    message,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `renewal-failed-${Date.now()}`,
      planId: tier(sub),
      amount,
      walletBalance,
      shortfall,
      failedCount,
      remainingAttempts,
      nextRetryDate: nextRetryDate.toISOString(),
      action: "reactivate_subscription",
    }),
  });

  if (user?.fcmToken) {
    await sendPushNotification(user.fcmToken, {
      type: "low_balance",
      title: `⚠️ No se pudo renovar tu ${planName}`,
      body: `Te faltan ${formatCOP(shortfall)} para renovar. Recarga tu billetera.`,
      clickAction: "/subscription",
      data: { action: "reactivate_subscription", shortfall: shortfall.toString() },
    }).catch(console.warn);
  }

  if (user?.email) {
    await sendSubscriptionEmail({
      type: "renewal_failed",
      to: user.email,
      userName: user.name || "Usuario",
      planName,
      amount,
      walletBalance,
      shortfall,
      failedCount,
      remainingAttempts,
      nextRetryDate,
    }).catch(console.warn);
  }

  console.log(`[Billing] ⚠️ Renovación fallida sub ${sub.id}: intento ${failedCount}/${MAX_RETRY_ATTEMPTS}`);
}

// ─── Cancelación definitiva por falta de pago ────────────────────────────────
async function cancelSubscriptionForNonPayment(sub: any, planName: string): Promise<void> {
  await db.cancelUserSubscription(sub.userId);
  await setSubscriptionStatus(sub.userId, "CANCELLED");

  const user = await db.getUserById(sub.userId);

  await db.createNotification({
    userId: sub.userId,
    title: `❌ ${planName} cancelado`,
    message: `Tu ${planName} fue cancelado después de ${MAX_RETRY_ATTEMPTS} intentos fallidos. Puedes reactivarlo en cualquier momento desde Membresía.`,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `sub-cancelled-nonpayment-${Date.now()}`,
      reason: "non_payment",
      planId: tier(sub),
      action: "reactivate_subscription",
    }),
  });

  if (user?.fcmToken) {
    await sendPushNotification(user.fcmToken, {
      type: "system_alert",
      title: `❌ ${planName} cancelado`,
      body: `Tu plan fue cancelado por falta de pago. Puedes reactivarlo en cualquier momento.`,
      clickAction: "/subscription",
    }).catch(console.warn);
  }

  if (user?.email) {
    await sendSubscriptionEmail({
      type: "cancelled_non_payment",
      to: user.email,
      userName: user.name || "Usuario",
      planName,
      amount: PLAN_PRICES[((sub.tier || sub.subscriptionTier || "BASIC") as string).toUpperCase()] ?? PLAN_PRICES.BASIC,
    }).catch(console.warn);
  }

  console.log(`[Billing] ❌ Sub ${sub.id} cancelada definitivamente`);
}

// ─── Recordatorios D-3 ───────────────────────────────────────────────────────
async function sendRenewalReminders(): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) return 0;

  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const dayStart = new Date(threeDaysFromNow);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(threeDaysFromNow);
  dayEnd.setHours(23, 59, 59, 999);

  let count = 0;
  try {
    const upcoming = await dbConn.select().from(subscriptions).where(
      and(
        eq(subscriptions.isActive, 1),
        gte(subscriptions.nextBillingDate, dayStart.toISOString().slice(0, 19).replace("T", " ")),
        lte(subscriptions.nextBillingDate, dayEnd.toISOString().slice(0, 19).replace("T", " ")),
        isNull(subscriptions.renewalReminderSentAt),
        sql`${subscriptions.subscriptionTier} != 'FREE'`
      )
    );

    for (const sub of upcoming) {
      const t = ((sub.subscriptionTier || "BASIC") as string).toUpperCase();
      const amount = PLAN_PRICES[t] ?? PLAN_PRICES.BASIC;
      const planName = PLAN_NAMES[t] ?? "Plan Básico";
      const wallet = await db.getUserWallet(sub.userId);
      const walletBalance = parseFloat((wallet?.balance ?? "0").toString());
      const hasSufficientBalance = walletBalance >= amount;
      const user = await db.getUserById(sub.userId);
      const dueDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date();

      await db.createNotification({
        userId: sub.userId,
        title: `🔔 Tu ${planName} vence en 3 días`,
        message: hasSufficientBalance
          ? `Tu ${planName} se renovará automáticamente el ${dueDate.toLocaleDateString("es-CO")} por ${formatCOP(amount)}. Tu billetera tiene saldo suficiente (${formatCOP(walletBalance)}).`
          : `Tu ${planName} vence en 3 días (${formatCOP(amount)}). Tu billetera tiene ${formatCOP(walletBalance)}. Recarga ${formatCOP(amount - walletBalance)} más para asegurar la renovación.`,
        type: "PAYMENT",
        data: JSON.stringify({
          key: `renewal-reminder-${sub.id}-${Date.now()}`,
          planId: sub.subscriptionTier,
          amount,
          walletBalance,
          hasSufficientBalance,
          dueDate: dueDate.toISOString(),
          action: hasSufficientBalance ? undefined : "top_up_wallet",
        }),
      });

      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: hasSufficientBalance ? "payment_success" : "low_balance",
          title: `🔔 Tu ${planName} vence en 3 días`,
          body: hasSufficientBalance
            ? `Renovación automática programada por ${formatCOP(amount)}.`
            : `Recarga ${formatCOP(amount - walletBalance)} para asegurar tu renovación.`,
          clickAction: "/subscription",
          data: { action: hasSufficientBalance ? "none" : "top_up_wallet" },
        }).catch(console.warn);
      }

      if (user?.email) {
        await sendSubscriptionEmail({
          type: "renewal_reminder",
          to: user.email,
          userName: user.name || "Usuario",
          planName,
          amount,
          walletBalance,
          dueDate,
          hasSufficientBalance,
        }).catch(console.warn);
      }

      await dbConn.update(subscriptions).set({
        renewalReminderSentAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      }).where(eq(subscriptions.id, sub.id));

      count++;
    }
  } catch (err) {
    console.error("[Billing] Error enviando recordatorios:", err);
  }

  return count;
}

// ─── Procesar cancelaciones CANCELLED_PENDING vencidas ───────────────────────
async function processPendingCancellations(): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) return 0;

  let count = 0;
  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const pending = await dbConn.select().from(subscriptions).where(
      and(
        eq(subscriptions.subscriptionStatus, "CANCELLED_PENDING"),
        sql`${subscriptions.nextBillingDate} <= ${now}`
      )
    );

    for (const sub of pending) {
      const t = ((sub.subscriptionTier || "BASIC") as string).toUpperCase();
      const planName = PLAN_NAMES[t] ?? "Plan Básico";

      await dbConn.update(subscriptions).set({
        isActive: 0,
        subscriptionStatus: "CANCELLED",
        subscriptionTier: "FREE",
        discountPercentage: "0",
        freeReservationsPerMonth: 0,
        prioritySupport: 0,
        nextBillingDate: null,
      }).where(eq(subscriptions.id, sub.id));

      const user = await db.getUserById(sub.userId);

      await db.createNotification({
        userId: sub.userId,
        title: `${planName} finalizado`,
        message: `Tu ${planName} ha finalizado. Puedes reactivarlo en cualquier momento desde Membresía.`,
        type: "PAYMENT",
        data: JSON.stringify({ key: `sub-ended-${sub.id}`, planId: sub.subscriptionTier }),
      });

      if (user?.email) {
        await sendSubscriptionEmail({
          type: "cancelled_by_user",
          to: user.email,
          userName: user.name || "Usuario",
          planName,
          amount: PLAN_PRICES[t] ?? PLAN_PRICES.BASIC,
        }).catch(console.warn);
      }

      count++;
    }
  } catch (err) {
    console.error("[Billing] Error procesando cancelaciones pendientes:", err);
  }

  return count;
}

// ─── Cancelar suspensiones expiradas ─────────────────────────────────────────
async function cancelExpiredSuspensions(): Promise<number> {
  const dbConn = await getDb();
  if (!dbConn) return 0;

  let count = 0;
  try {
    const gracePeriodAgo = new Date();
    gracePeriodAgo.setDate(gracePeriodAgo.getDate() - GRACE_PERIOD_DAYS);
    const gracePeriodAgoStr = gracePeriodAgo.toISOString().slice(0, 19).replace("T", " ");

    const expired = await dbConn.select().from(subscriptions).where(
      and(
        eq(subscriptions.subscriptionStatus, "SUSPENDED"),
        sql`${subscriptions.suspendedAt} <= ${gracePeriodAgoStr}`
      )
    );

    for (const sub of expired) {
      const t = ((sub.subscriptionTier || "BASIC") as string).toUpperCase();
      const planName = PLAN_NAMES[t] ?? "Plan Básico";
      await cancelSubscriptionForNonPayment(sub, planName);
      count++;
    }
  } catch (err) {
    console.error("[Billing] Error cancelando suspensiones expiradas:", err);
  }

  return count;
}

// ─── Cancelación voluntaria (llamada desde el router) ────────────────────────
export async function requestSubscriptionCancellation(userId: number): Promise<{
  success: boolean;
  effectiveDate: Date | null;
  message: string;
}> {
  const sub = await db.getUserSubscription(userId);
  if (!sub || !sub.isActive) {
    return { success: false, effectiveDate: null, message: "No tienes una suscripción activa." };
  }

  const t = ((sub.subscriptionTier || "BASIC") as string).toUpperCase();
  const planName = PLAN_NAMES[t] ?? "Plan Básico";
  const effectiveDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date();

  const dbConn = await getDb();
  if (!dbConn) return { success: false, effectiveDate: null, message: "Error de base de datos." };

  await dbConn.update(subscriptions).set({
    subscriptionStatus: "CANCELLED_PENDING",
    cancellationRequestedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    cancellationEffectiveDate: effectiveDate.toISOString().slice(0, 19).replace("T", " "),
  }).where(eq(subscriptions.userId, userId));

  const user = await db.getUserById(userId);

  await db.createNotification({
    userId,
    title: `Cancelación de ${planName} programada`,
    message: `Tu ${planName} seguirá activo hasta el ${effectiveDate.toLocaleDateString("es-CO")}. Después no se realizarán más cobros. Puedes reactivarlo antes de esa fecha.`,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `sub-cancel-request-${Date.now()}`,
      planId: sub.subscriptionTier,
      effectiveDate: effectiveDate.toISOString(),
      action: "reactivate_subscription",
    }),
  });

  if (user?.fcmToken) {
    await sendPushNotification(user.fcmToken, {
      type: "system_alert",
      title: `Cancelación programada`,
      body: `Tu ${planName} seguirá activo hasta el ${effectiveDate.toLocaleDateString("es-CO")}.`,
      clickAction: "/subscription",
    }).catch(console.warn);
  }

  if (user?.email) {
    await sendSubscriptionEmail({
      type: "cancellation_confirmed",
      to: user.email,
      userName: user.name || "Usuario",
      planName,
      amount: PLAN_PRICES[t] ?? PLAN_PRICES.BASIC,
      effectiveDate,
    }).catch(console.warn);
  }

  console.log(`[Billing] Cancelación voluntaria: userId ${userId}, efectiva ${effectiveDate.toISOString()}`);
  return {
    success: true,
    effectiveDate,
    message: `Tu ${planName} seguirá activo hasta el ${effectiveDate.toLocaleDateString("es-CO")}.`,
  };
}

// ─── Reactivar suscripción ────────────────────────────────────────────────────
export async function reactivateSubscription(userId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const sub = await db.getUserSubscription(userId);
  if (!sub) return { success: false, message: "No se encontró suscripción." };

  const t = ((sub.subscriptionTier || "BASIC") as string).toUpperCase();
  const amount = PLAN_PRICES[t] ?? PLAN_PRICES.BASIC;
  const planName = PLAN_NAMES[t] ?? "Plan Básico";

  const wallet = await db.getUserWallet(userId);
  const walletBalance = parseFloat((wallet?.balance ?? "0").toString());

  if (walletBalance < amount) {
    return {
      success: false,
      message: `Saldo insuficiente. Necesitas ${formatCOP(amount)} y tienes ${formatCOP(walletBalance)}. Recarga ${formatCOP(amount - walletBalance)} más.`,
    };
  }

  const ok = await chargeFromWallet(sub, wallet, amount, planName);
  if (ok) return { success: true, message: `¡${planName} reactivado exitosamente!` };
  return { success: false, message: "Error al procesar el pago. Intenta nuevamente." };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
async function setSubscriptionStatus(
  userId: number,
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED_PENDING" | "CANCELLED"
): Promise<void> {
  try {
    const dbConn = await getDb();
    if (!dbConn) return;
    const updateData: any = { subscriptionStatus: status };
    if (status === "SUSPENDED") updateData.suspendedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    if (status === "ACTIVE") { updateData.suspendedAt = null; updateData.suspendedUntil = null; }
    await dbConn.update(subscriptions).set(updateData).where(eq(subscriptions.userId, userId));
  } catch (err) {
    console.warn("[Billing] Error actualizando subscriptionStatus:", err);
  }
}

async function fetchAcceptanceToken(keys: WompiKeys): Promise<{
  acceptanceToken: string;
  personalAuthToken: string;
} | null> {
  try {
    const res = await fetch(`${keys.apiUrl}/merchants/${keys.publicKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      acceptanceToken: data.data?.presigned_acceptance?.acceptance_token || "",
      personalAuthToken: data.data?.presigned_personal_data_auth?.acceptance_token || "",
    };
  } catch { return null; }
}

function tier(sub: any): string {
  return (sub.tier || sub.subscriptionTier || "BASIC").toString().toUpperCase();
}

// ─── Exportaciones para compatibilidad ───────────────────────────────────────
export async function createPaymentSource(params: {
  cardToken: string;
  customerEmail: string;
  acceptanceToken: string;
  personalAuthToken?: string;
}): Promise<{ paymentSourceId: string; status: string } | null> {
  const keys = await getWompiKeys();
  if (!keys) return null;
  try {
    const body: any = {
      type: "CARD",
      token: params.cardToken,
      customer_email: params.customerEmail,
      acceptance_token: params.acceptanceToken,
    };
    if (params.personalAuthToken) body.accept_personal_auth = params.personalAuthToken;
    const res = await fetch(`${keys.apiUrl}/payment_sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.privateKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return { paymentSourceId: result.data.id.toString(), status: result.data.status };
  } catch { return null; }
}

export async function getAcceptanceToken(): Promise<{
  acceptanceToken: string;
  personalAuthToken: string;
  permalink: string;
} | null> {
  const keys = await getWompiKeys();
  if (!keys) return null;
  try {
    const res = await fetch(`${keys.apiUrl}/merchants/${keys.publicKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      acceptanceToken: data.data?.presigned_acceptance?.acceptance_token || "",
      personalAuthToken: data.data?.presigned_personal_data_auth?.acceptance_token || "",
      permalink: data.data?.presigned_acceptance?.permalink || "",
    };
  } catch { return null; }
}
