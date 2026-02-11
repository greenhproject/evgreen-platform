/**
 * Servicio de cobro recurrente de suscripciones con Wompi
 * 
 * Se ejecuta diariamente para:
 * 1. Buscar suscripciones con nextBillingDate <= hoy
 * 2. Si tienen wompiPaymentSourceId, cobrar automáticamente vía API
 * 3. Si no tienen payment source, crear checkout y notificar al usuario
 * 4. Manejar reintentos y cancelación por fallos consecutivos
 */

import {
  getWompiKeys,
  generatePaymentReference,
  generateIntegritySignature,
  WompiKeys,
} from "./config";
import * as db from "../db";
import { sendPushNotification } from "../firebase/fcm";

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FAILED_PAYMENTS = 3; // Cancelar suscripción después de 3 fallos
const BILLING_CYCLE_DAYS = 30;

const PLAN_PRICES: Record<string, number> = {
  BASIC: 18900,
  PREMIUM: 33900,
};

// ============================================================================
// MAIN BILLING FUNCTION
// ============================================================================

/**
 * Procesar cobros recurrentes de suscripciones vencidas.
 * Debe ejecutarse diariamente (ej: cada 24 horas o con cron).
 */
export async function processRecurringBilling(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  cancelled: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    successful: 0,
    failed: 0,
    cancelled: 0,
    errors: [] as string[],
  };

  console.log("[Billing] Iniciando proceso de cobro recurrente...");

  // Obtener llaves de Wompi
  const keys = await getWompiKeys();
  if (!keys) {
    console.log("[Billing] Wompi no está configurado - saltando cobros");
    result.errors.push("Wompi no configurado");
    return result;
  }

  // Obtener suscripciones que necesitan cobro
  let subscriptions: any[];
  try {
    subscriptions = await db.getActiveSubscriptionsForBilling();
  } catch (err) {
    console.error("[Billing] Error obteniendo suscripciones:", err);
    result.errors.push("Error consultando suscripciones");
    return result;
  }

  console.log(`[Billing] ${subscriptions.length} suscripciones pendientes de cobro`);

  for (const sub of subscriptions) {
    result.processed++;

    try {
      // Verificar si tiene demasiados fallos
      if ((sub.failedPaymentCount || 0) >= MAX_FAILED_PAYMENTS) {
        console.log(`[Billing] Cancelando suscripción ${sub.id} por ${sub.failedPaymentCount} fallos consecutivos`);
        await cancelSubscriptionForNonPayment(sub);
        result.cancelled++;
        continue;
      }

      const amount = PLAN_PRICES[sub.tier] || PLAN_PRICES.BASIC;

      // Si tiene payment source tokenizado, cobrar automáticamente
      if (sub.wompiPaymentSourceId) {
        const success = await chargeWithPaymentSource(sub, amount, keys);
        if (success) {
          result.successful++;
        } else {
          result.failed++;
        }
      } else {
        // Sin payment source: notificar al usuario para que pague manualmente
        await notifyManualPaymentRequired(sub, amount);
        result.failed++;
      }
    } catch (error: any) {
      console.error(`[Billing] Error procesando suscripción ${sub.id}:`, error);
      result.errors.push(`Sub ${sub.id}: ${error.message}`);
      result.failed++;
    }
  }

  console.log(`[Billing] Proceso completado:`, result);
  return result;
}

// ============================================================================
// CHARGE WITH TOKENIZED PAYMENT SOURCE
// ============================================================================

/**
 * Cobrar automáticamente usando el payment source tokenizado de Wompi
 */
async function chargeWithPaymentSource(
  subscription: any,
  amount: number,
  keys: WompiKeys
): Promise<boolean> {
  const reference = generatePaymentReference("REC");
  const amountInCents = amount * 100;

  console.log(`[Billing] Cobrando $${amount} a suscripción ${subscription.id} con payment source ${subscription.wompiPaymentSourceId}`);

  try {
    // Obtener acceptance token (obligatorio según API de Wompi)
    const acceptanceData = await getAcceptanceToken();
    const acceptanceToken = acceptanceData?.acceptanceToken || "";

    // Generar firma de integridad (obligatoria según API de Wompi)
    const signature = generateIntegritySignature(
      reference,
      amountInCents,
      "COP",
      keys.integritySecret
    );

    // Crear transacción con payment source en Wompi
    const response = await fetch(`${keys.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: amountInCents,
        currency: "COP",
        payment_source_id: parseInt(subscription.wompiPaymentSourceId),
        reference,
        customer_email: subscription.customerEmail || "",
        signature,
        acceptance_token: acceptanceToken,
        payment_method: {
          type: "CARD",
          installments: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Billing] Error API Wompi (${response.status}):`, errorBody);
      await handleFailedPayment(subscription, reference, `API error: ${response.status}`);
      return false;
    }

    const result = await response.json();
    const tx = result.data;

    console.log(`[Billing] Transacción creada: ${tx.id} - Estado: ${tx.status}`);

    // Guardar transacción en BD
    try {
      const txId = await db.createWompiTransaction({
        userId: subscription.userId,
        reference,
        amountInCents,
        currency: "COP",
        type: "SUBSCRIPTION",
        customerEmail: subscription.customerEmail || "",
        description: `Cobro recurrente - Plan ${subscription.tier} - ${formatCOP(amount)}/mes`,
        integritySignature: "",
      });
      // Actualizar con datos de Wompi
      await db.updateWompiTransactionByReference(reference, {
        wompiTransactionId: tx.id,
        status: tx.status,
        paymentMethodType: tx.payment_method_type || "CARD",
      });
    } catch (dbErr) {
      console.warn("[Billing] Error guardando transacción:", dbErr);
    }

    // Verificar estado
    if (tx.status === "APPROVED") {
      await handleSuccessfulPayment(subscription, reference, amount);
      return true;
    } else if (tx.status === "PENDING") {
      // El webhook se encargará de procesar cuando se confirme
      console.log(`[Billing] Transacción pendiente: ${reference} - esperando webhook`);
      return true; // No contar como fallo
    } else {
      await handleFailedPayment(subscription, reference, `Status: ${tx.status}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[Billing] Error cobrando suscripción ${subscription.id}:`, error);
    await handleFailedPayment(subscription, reference, error.message);
    return false;
  }
}

// ============================================================================
// PAYMENT RESULT HANDLERS
// ============================================================================

async function handleSuccessfulPayment(
  subscription: any,
  reference: string,
  amount: number
): Promise<void> {
  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + BILLING_CYCLE_DAYS);

  // Actualizar suscripción
  await db.updateSubscriptionBilling(subscription.id, {
    lastPaymentDate: new Date(),
    lastPaymentReference: reference,
    nextBillingDate: nextBilling,
    failedPaymentCount: 0,
  });

  // Crear notificación in-app
  await db.createNotification({
    userId: subscription.userId,
    title: "Cobro de suscripción exitoso",
    message: `Se ha cobrado ${formatCOP(amount)} por tu plan ${subscription.tier}. Próximo cobro: ${nextBilling.toLocaleDateString("es-CO")}.`,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `recurring-${reference}`,
      amount,
      reference,
      planId: subscription.tier,
      nextBilling: nextBilling.toISOString(),
    }),
  });

  // Enviar push notification
  try {
    const user = await db.getUserById(subscription.userId);
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "balance_added",
        title: "Cobro de suscripción exitoso",
        body: `Se cobró ${formatCOP(amount)} por tu plan ${subscription.tier}. Próximo cobro: ${nextBilling.toLocaleDateString("es-CO")}.`,
        clickAction: "/wallet",
        data: {
          reference,
          amount: amount.toString(),
        },
      });
    }
  } catch (pushErr) {
    console.warn("[Billing] Error enviando push:", pushErr);
  }

  console.log(`[Billing] Cobro exitoso: suscripción ${subscription.id}, ref: ${reference}`);
}

async function handleFailedPayment(
  subscription: any,
  reference: string,
  reason: string
): Promise<void> {
  const failedCount = (subscription.failedPaymentCount || 0) + 1;

  // Incrementar contador de fallos
  await db.incrementSubscriptionFailedPayments(subscription.id);

  // Crear notificación in-app
  const remainingAttempts = MAX_FAILED_PAYMENTS - failedCount;
  const message = remainingAttempts > 0
    ? `No pudimos cobrar tu suscripción ${subscription.tier}. Quedan ${remainingAttempts} intento(s) antes de cancelar. Verifica tu método de pago.`
    : `No pudimos cobrar tu suscripción ${subscription.tier}. Tu suscripción será cancelada. Puedes reactivarla desde la billetera.`;

  await db.createNotification({
    userId: subscription.userId,
    title: "Error en cobro de suscripción",
    message,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `recurring-failed-${reference}`,
      reference,
      reason,
      failedCount,
      remainingAttempts,
    }),
  });

  // Enviar push notification
  try {
    const user = await db.getUserById(subscription.userId);
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "low_balance",
        title: "Error en cobro de suscripción",
        body: message,
        clickAction: "/wallet",
        data: {
          reference,
          failedCount: failedCount.toString(),
        },
      });
    }
  } catch (pushErr) {
    console.warn("[Billing] Error enviando push de fallo:", pushErr);
  }

  console.log(`[Billing] Cobro fallido: suscripción ${subscription.id}, intento ${failedCount}/${MAX_FAILED_PAYMENTS}`);
}

// ============================================================================
// CANCELLATION FOR NON-PAYMENT
// ============================================================================

async function cancelSubscriptionForNonPayment(subscription: any): Promise<void> {
  await db.cancelUserSubscription(subscription.userId);

  // Notificación in-app
  await db.createNotification({
    userId: subscription.userId,
    title: "Suscripción cancelada por falta de pago",
    message: `Tu plan ${subscription.tier} fue cancelado después de ${MAX_FAILED_PAYMENTS} intentos de cobro fallidos. Puedes reactivarlo desde la billetera.`,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `sub-cancelled-nonpayment-${Date.now()}`,
      reason: "non_payment",
      planId: subscription.tier,
    }),
  });

  // Push notification
  try {
    const user = await db.getUserById(subscription.userId);
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "system_alert",
        title: "Suscripción cancelada",
        body: `Tu plan ${subscription.tier} fue cancelado por falta de pago. Puedes reactivarlo en cualquier momento.`,
        clickAction: "/wallet",
      });
    }
  } catch (pushErr) {
    console.warn("[Billing] Error enviando push de cancelación:", pushErr);
  }

  console.log(`[Billing] Suscripción ${subscription.id} cancelada por falta de pago`);
}

// ============================================================================
// MANUAL PAYMENT NOTIFICATION
// ============================================================================

async function notifyManualPaymentRequired(subscription: any, amount: number): Promise<void> {
  // Notificación in-app
  await db.createNotification({
    userId: subscription.userId,
    title: "Renovación de suscripción pendiente",
    message: `Tu plan ${subscription.tier} necesita renovación (${formatCOP(amount)}/mes). Ingresa a la billetera para completar el pago.`,
    type: "PAYMENT",
    data: JSON.stringify({
      key: `sub-renewal-${Date.now()}`,
      planId: subscription.tier,
      amount,
      action: "renew_subscription",
    }),
  });

  // Push notification
  try {
    const user = await db.getUserById(subscription.userId);
    if (user?.fcmToken) {
      await sendPushNotification(user.fcmToken, {
        type: "low_balance",
        title: "Renovación de suscripción pendiente",
        body: `Tu plan ${subscription.tier} necesita renovación. Ingresa a la billetera para pagar ${formatCOP(amount)}.`,
        clickAction: "/wallet",
        data: {
          action: "renew_subscription",
          planId: subscription.tier,
          amount: amount.toString(),
        },
      });
    }
  } catch (pushErr) {
    console.warn("[Billing] Error enviando push de renovación:", pushErr);
  }

  console.log(`[Billing] Notificación de renovación enviada a usuario ${subscription.userId}`);
}

// ============================================================================
// TOKENIZATION HELPERS
// ============================================================================

/**
 * Tokenizar tarjeta y crear payment source en Wompi.
 * Se usa después del primer pago exitoso para habilitar cobros recurrentes.
 */
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

    if (params.personalAuthToken) {
      body.accept_personal_auth = params.personalAuthToken;
    }

    const response = await fetch(`${keys.apiUrl}/payment_sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.privateKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Billing] Error creando payment source (${response.status}):`, errorBody);
      return null;
    }

    const result = await response.json();
    const ps = result.data;

    console.log(`[Billing] Payment source creado: ${ps.id} - Status: ${ps.status}`);

    return {
      paymentSourceId: ps.id.toString(),
      status: ps.status,
    };
  } catch (error: any) {
    console.error("[Billing] Error creando payment source:", error);
    return null;
  }
}

/**
 * Obtener acceptance token de Wompi (necesario para crear payment sources)
 */
export async function getAcceptanceToken(): Promise<{
  acceptanceToken: string;
  personalAuthToken: string;
  permalink: string;
} | null> {
  const keys = await getWompiKeys();
  if (!keys) return null;

  try {
    const response = await fetch(`${keys.apiUrl}/merchants/${keys.publicKey}`);
    if (!response.ok) return null;

    const result = await response.json();
    const merchant = result.data;

    return {
      acceptanceToken: merchant.presigned_acceptance?.acceptance_token || "",
      personalAuthToken: merchant.presigned_personal_data_auth?.acceptance_token || "",
      permalink: merchant.presigned_acceptance?.permalink || "",
    };
  } catch (error) {
    console.error("[Billing] Error obteniendo acceptance token:", error);
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// CRON JOB SETUP
// ============================================================================

let billingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Iniciar el cron job de cobro recurrente.
 * Se ejecuta cada 24 horas (a las 6:00 AM hora Colombia).
 */
export function startBillingCronJob(): void {
  if (billingInterval) {
    console.log("[Billing] Cron job ya está corriendo");
    return;
  }

  // Calcular tiempo hasta las 6:00 AM Colombia (UTC-5)
  const now = new Date();
  const colombiaOffset = -5 * 60; // UTC-5 en minutos
  const localNow = new Date(now.getTime() + (colombiaOffset + now.getTimezoneOffset()) * 60000);
  
  let nextRun = new Date(localNow);
  nextRun.setHours(6, 0, 0, 0);
  
  if (nextRun <= localNow) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilFirstRun = nextRun.getTime() - localNow.getTime();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  console.log(`[Billing] Cron job programado. Próxima ejecución en ${Math.round(msUntilFirstRun / 60000)} minutos`);

  // Primera ejecución programada
  setTimeout(() => {
    processRecurringBilling().catch((err) => {
      console.error("[Billing] Error en ejecución programada:", err);
    });

    // Después, ejecutar cada 24 horas
    billingInterval = setInterval(() => {
      processRecurringBilling().catch((err) => {
        console.error("[Billing] Error en ejecución periódica:", err);
      });
    }, TWENTY_FOUR_HOURS);
  }, msUntilFirstRun);
}

/**
 * Detener el cron job de cobro recurrente.
 */
export function stopBillingCronJob(): void {
  if (billingInterval) {
    clearInterval(billingInterval);
    billingInterval = null;
    console.log("[Billing] Cron job detenido");
  }
}
