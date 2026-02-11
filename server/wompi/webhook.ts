/**
 * Webhook handler para eventos de Wompi
 * 
 * Recibe notificaciones de transacciones y actualiza la BD.
 * Verifica la firma del evento usando el events secret de la BD.
 */

import { Request, Response } from "express";
import {
  getWompiKeys,
  verifyWebhookChecksum,
  getTransactionStatus,
  WOMPI_TRANSACTION_STATUS,
} from "./config";
import * as db from "../db";
import { sendPushNotification } from "../firebase/fcm";

export async function handleWompiWebhook(req: Request, res: Response) {
  try {
    const event = req.body;
    console.log("[Wompi Webhook] Evento recibido:", event.event, event.data?.transaction?.id);

    // Obtener llaves de la BD para verificar firma
    const keys = await getWompiKeys();

    // Verificar firma si tenemos events secret
    if (keys?.eventsSecret) {
      const isValid = verifyWebhookChecksum(event, keys.eventsSecret);
      if (!isValid) {
        console.error("[Wompi Webhook] Firma inválida - rechazando evento");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[Wompi Webhook] Firma verificada correctamente");
    } else {
      console.warn("[Wompi Webhook] Sin events secret - aceptando sin verificar firma");
    }

    // Manejar eventos de transacción
    if (event.event === "transaction.updated") {
      const transaction = event.data?.transaction;

      if (!transaction) {
        return res.status(400).json({ error: "No transaction data" });
      }

      const { id, reference, status, amount_in_cents, payment_method_type } = transaction;
      console.log(`[Wompi Webhook] Transacción ${id} - Estado: ${status} - Ref: ${reference}`);

      // Actualizar transacción en nuestra BD
      try {
        await db.updateWompiTransactionByReference(reference, {
          wompiTransactionId: id,
          status,
          paymentMethodType: payment_method_type,
          webhookReceivedAt: new Date(),
          processedAt: status === WOMPI_TRANSACTION_STATUS.APPROVED ? new Date() : undefined,
        });
      } catch (err) {
        console.error("[Wompi Webhook] Error actualizando transacción en BD:", err);
      }

      // Procesar según el estado
      if (status === WOMPI_TRANSACTION_STATUS.APPROVED) {
        if (reference.startsWith("WLT-")) {
          await processWalletRecharge(reference, amount_in_cents / 100, payment_method_type, id, transaction);
        } else if (reference.startsWith("QRC-") || reference.startsWith("ATC-")) {
          // Recarga rápida con tarjeta (QRC) o auto-cobro (ATC) - acreditar billetera
          await processQuickRecharge(reference, amount_in_cents / 100, id);
        } else if (reference.startsWith("CHG-")) {
          await processChargingPayment(reference, amount_in_cents / 100);
        } else if (reference.startsWith("INV-")) {
          await processInvestmentDeposit(reference, amount_in_cents / 100, id);
        } else if (reference.startsWith("SUB-")) {
          await processSubscriptionPayment(reference, amount_in_cents / 100, payment_method_type, id, transaction);
        }
      } else if (status === WOMPI_TRANSACTION_STATUS.DECLINED || status === WOMPI_TRANSACTION_STATUS.ERROR) {
        console.log(`[Wompi Webhook] Pago ${status}: ${reference}`);
        await notifyPaymentFailed(reference, status);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Wompi Webhook] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ============================================================================
// PROCESAMIENTO DE PAGOS
// ============================================================================

async function processWalletRecharge(
  reference: string,
  amount: number,
  paymentMethod: string,
  wompiTxId: string,
  transaction?: any
) {
  console.log(`[Wompi] Procesando recarga de billetera: ${reference} - $${amount}`);

  // Buscar la transacción en nuestra BD para obtener el userId
  const localTx = await db.getWompiTransactionByReference(reference);
  if (!localTx) {
    console.error(`[Wompi] No se encontró transacción local para: ${reference}`);
    return;
  }

  try {
    // Agregar saldo a la billetera del usuario
    await db.addUserWalletBalance(localTx.userId, amount);

    // Guardar datos de la tarjeta si es pago con tarjeta (para futuras recargas con un clic)
    if (paymentMethod === "CARD") {
      try {
        // Intentar obtener datos de tarjeta del webhook primero
        let cardBrand = transaction?.payment_method?.brand || transaction?.payment_method?.extra?.brand;
        let cardLastFour = transaction?.payment_method?.last_four || transaction?.payment_method?.extra?.last_four;

        // Si el webhook no incluye los datos, consultar la API de Wompi
        if (!cardBrand || !cardLastFour) {
          console.log(`[Wompi] Datos de tarjeta no en webhook, consultando API para tx ${wompiTxId}`);
          const keys = await getWompiKeys();
          if (keys) {
            try {
              const txDetail = await getTransactionStatus(wompiTxId, keys);
              const pm = txDetail?.data?.payment_method;
              if (pm) {
                cardBrand = pm.brand || pm.extra?.brand;
                cardLastFour = pm.last_four || pm.extra?.last_four;
                console.log(`[Wompi] Datos de tarjeta obtenidos de API: ${cardBrand} ****${cardLastFour}`);
              }
            } catch (apiErr) {
              console.warn("[Wompi] Error consultando API para datos de tarjeta:", apiErr);
            }
          }
        }

        if (cardBrand && cardLastFour) {
          await db.updateUserSubscription(localTx.userId, {
            cardBrand,
            cardLastFour,
          });
          console.log(`[Wompi] Datos de tarjeta guardados: ${cardBrand} ****${cardLastFour}`);
        } else {
          console.warn(`[Wompi] No se pudieron obtener datos de tarjeta para tx ${wompiTxId}`);
        }
      } catch (cardErr) {
        console.warn("[Wompi] Error guardando datos de tarjeta:", cardErr);
      }
    }

    // Obtener datos del usuario para notificación
    const user = await db.getUserById(localTx.userId);
    const wallet = await db.getUserWallet(localTx.userId);

    if (user?.email) {
      const paymentMethodNames: Record<string, string> = {
        PSE: "PSE (Transferencia bancaria)",
        NEQUI: "Nequi",
        BANCOLOMBIA_QR: "Bancolombia QR",
        BANCOLOMBIA_TRANSFER: "Transferencia Bancolombia",
        CARD: "Tarjeta de crédito/débito",
        EFECTY: "Efecty",
      };

      const methodName = paymentMethodNames[paymentMethod] || paymentMethod;

      try {
        const { sendWalletRechargeNotification } = await import("../notifications/paymentNotifications");
        await sendWalletRechargeNotification({
          userEmail: user.email,
          userName: user.name || "Usuario",
          amount,
          paymentMethod: `Wompi (${methodName})`,
          transactionId: wompiTxId,
          newBalance: wallet ? parseFloat(wallet.balance) : amount,
        });
        console.log(`[Wompi] Notificación enviada a ${user.email}`);
      } catch (notifErr) {
        console.warn("[Wompi] No se pudo enviar notificación:", notifErr);
      }
    }

    const formatCOP = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(n);

    // Crear notificación in-app de recarga exitosa
    try {
      await db.createNotification({
        userId: localTx.userId,
        title: "¡Recarga exitosa!",
        message: `Tu billetera fue recargada con ${formatCOP(amount)}. Nuevo saldo: ${formatCOP(wallet ? parseFloat(wallet.balance) : amount)}.`,
        type: "PAYMENT",
        data: JSON.stringify({
          key: `recharge-${reference}`,
          amount,
          reference,
          wompiTxId,
          newBalance: wallet ? parseFloat(wallet.balance) : amount,
        }),
      });
    } catch (notifDbErr) {
      console.warn("[Wompi] Error creando notificación in-app de recarga:", notifDbErr);
    }

    // Enviar push notification
    try {
      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: "balance_added",
          title: "¡Recarga exitosa!",
          body: `Tu billetera fue recargada con ${formatCOP(amount)}. ¡Ya puedes cargar tu vehículo!`,
          clickAction: "/wallet",
          data: {
            reference,
            amount: amount.toString(),
          },
        });
      }
    } catch (pushErr) {
      console.warn("[Wompi] Error enviando push de recarga:", pushErr);
    }

    console.log(`[Wompi] Recarga completada para usuario ${localTx.userId}: $${amount}`);
  } catch (error) {
    console.error(`[Wompi] Error procesando recarga:`, error);
  }
}

/**
 * Procesar recarga rápida con tarjeta (QRC-) o auto-cobro (ATC-)
 * Estas transacciones se crean como PENDING y se confirman vía webhook.
 */
async function processQuickRecharge(reference: string, amount: number, wompiTxId: string) {
  const prefix = reference.startsWith("QRC-") ? "Recarga rápida" : "Auto-cobro";
  console.log(`[Wompi] Procesando ${prefix}: ${reference} - $${amount}`);

  const localTx = await db.getWompiTransactionByReference(reference);
  if (!localTx) {
    console.error(`[Wompi] No se encontró transacción local para: ${reference}`);
    return;
  }

  try {
    // Verificar si ya fue acreditada (evitar doble acreditación)
    // Buscamos en las transacciones recientes del usuario si ya existe una con esta referencia
    const recentTxs = await db.getWalletTransactionsByUserId(localTx.userId, 20);
    const alreadyCredited = recentTxs.some(t => t.description?.includes(reference));
    if (alreadyCredited) {
      console.log(`[Wompi] ${prefix} ya fue acreditada previamente: ${reference}`);
      return;
    }

    // Acreditar billetera
    await db.addUserWalletBalance(localTx.userId, amount);

    // Obtener wallet actualizada para el registro
    const wallet = await db.getUserWallet(localTx.userId);
    const newBalance = wallet ? parseFloat(wallet.balance) : amount;

    // Registrar transacción de billetera
    await db.createWalletTransaction({
      walletId: wallet?.id || 0,
      userId: localTx.userId,
      type: "WOMPI_RECHARGE",
      amount: amount.toString(),
      balanceBefore: (newBalance - amount).toString(),
      balanceAfter: newBalance.toString(),
      description: `${prefix} con tarjeta: ${reference}`,
    });

    const formatCOP = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(n);

    // Notificación in-app
    await db.createNotification({
      userId: localTx.userId,
      title: prefix === "Recarga rápida" ? "¡Recarga exitosa!" : "Auto-recarga exitosa",
      message: `Tu billetera fue recargada con ${formatCOP(amount)}. Nuevo saldo: ${formatCOP(newBalance)}.`,
      type: "PAYMENT",
      data: JSON.stringify({
        key: `${reference.startsWith("QRC-") ? "quick-recharge" : "auto-charge"}-${reference}`,
        amount,
        reference,
        wompiTxId,
        newBalance,
      }),
    });

    // Push notification
    try {
      const user = await db.getUserById(localTx.userId);
      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: "balance_added",
          title: prefix === "Recarga rápida" ? "¡Recarga exitosa!" : "Auto-recarga exitosa",
          body: `Tu billetera fue recargada con ${formatCOP(amount)}.`,
          clickAction: "/wallet",
          data: { reference, amount: amount.toString() },
        });
      }
    } catch (pushErr) {
      console.warn(`[Wompi] Error enviando push de ${prefix}:`, pushErr);
    }

    console.log(`[Wompi] ${prefix} completada para usuario ${localTx.userId}: $${amount}`);
  } catch (error) {
    console.error(`[Wompi] Error procesando ${prefix}:`, error);
  }
}

async function processChargingPayment(reference: string, amount: number) {
  console.log(`[Wompi] Procesando pago de carga: ${reference} - $${amount}`);

  const localTx = await db.getWompiTransactionByReference(reference);
  if (!localTx) {
    console.error(`[Wompi] No se encontró transacción local para: ${reference}`);
    return;
  }

  // El pago de carga se maneja por el flujo normal de la app
  console.log(`[Wompi] Pago de carga procesado: ${reference}`);
}

async function processInvestmentDeposit(reference: string, amount: number, wompiTxId: string) {
  console.log(`[Wompi] Procesando depósito de inversión: ${reference} - $${amount}`);

  const localTx = await db.getWompiTransactionByReference(reference);
  if (!localTx) {
    console.error(`[Wompi] No se encontró transacción local para: ${reference}`);
    return;
  }

  console.log(`[Wompi] Depósito de inversión procesado para usuario ${localTx.userId}: $${amount}`);
}

// ============================================================================
// PROCESAMIENTO DE SUSCRIPCIONES
// ============================================================================

async function processSubscriptionPayment(
  reference: string,
  amount: number,
  paymentMethod: string,
  wompiTxId: string,
  transaction: any
) {
  console.log(`[Wompi] Procesando pago de suscripción: ${reference} - $${amount}`);

  const localTx = await db.getWompiTransactionByReference(reference);
  if (!localTx) {
    console.error(`[Wompi] No se encontró transacción local para: ${reference}`);
    return;
  }

  try {
    // Determinar el plan basado en el monto
    const planId = amount >= 33900 ? "premium" : "basic";

    // Extraer datos de la tarjeta - intentar múltiples ubicaciones
    let cardBrand = transaction?.payment_method?.brand || transaction?.payment_method?.extra?.brand;
    let cardLastFour = transaction?.payment_method?.last_four || transaction?.payment_method?.extra?.last_four;

    // Si no están en el webhook, consultar la API de Wompi
    if (!cardBrand || !cardLastFour) {
      try {
        const keys = await getWompiKeys();
        if (keys) {
          const txDetail = await getTransactionStatus(wompiTxId, keys);
          const pm = txDetail?.data?.payment_method;
          if (pm) {
            cardBrand = pm.brand || pm.extra?.brand;
            cardLastFour = pm.last_four || pm.extra?.last_four;
          }
        }
      } catch (apiErr) {
        console.warn("[Wompi] Error consultando API para datos de tarjeta en suscripción:", apiErr);
      }
    }

    // Activar/actualizar suscripción
    await db.updateUserSubscription(localTx.userId, {
      planId,
      status: "active",
      monthlyAmountCents: amount * 100,
      lastPaymentDate: new Date(),
      lastPaymentReference: reference,
      cardBrand,
      cardLastFour,
    });

    // Crear notificación in-app de suscripción activada
    const planName = planId === "premium" ? "Premium" : "Básico";
    const formatCurrency = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(n);

    await db.createNotification({
      userId: localTx.userId,
      title: "¡Suscripción activada!",
      message: `Tu plan ${planName} (${formatCurrency(amount)}/mes) está activo. Disfruta de tus descuentos en cargas y beneficios exclusivos.`,
      type: "PAYMENT",
      data: JSON.stringify({
        key: `sub-activated-${reference}`,
        planId,
        amount,
        reference,
        wompiTxId,
      }),
    });

    // Enviar email de confirmación
    try {
      const user = await db.getUserById(localTx.userId);
      if (user?.email) {
        const { sendWalletRechargeNotification } = await import("../notifications/paymentNotifications");
        await sendWalletRechargeNotification({
          userEmail: user.email,
          userName: user.name || "Usuario",
          amount,
          paymentMethod: `Wompi (${paymentMethod || "Tarjeta"})`,
          transactionId: wompiTxId,
        });
      }
    } catch (emailErr) {
      console.warn("[Wompi] Error enviando email de suscripción:", emailErr);
    }

    // Enviar push notification
    try {
      const user = await db.getUserById(localTx.userId);
      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: "balance_added",
          title: "¡Suscripción activada!",
          body: `Tu plan ${planName} (${formatCurrency(amount)}/mes) está activo. Disfruta de tus descuentos en cargas.`,
          clickAction: "/wallet",
          data: {
            reference,
            planId,
          },
        });
      }
    } catch (pushErr) {
      console.warn("[Wompi] Error enviando push de suscripción:", pushErr);
    }

    console.log(`[Wompi] Suscripción ${planName} activada para usuario ${localTx.userId}`);
  } catch (error) {
    console.error(`[Wompi] Error procesando suscripción:`, error);
  }
}

// ============================================================================
// NOTIFICACIÓN DE PAGO FALLIDO
// ============================================================================

async function notifyPaymentFailed(reference: string, status: string) {
  try {
    const localTx = await db.getWompiTransactionByReference(reference);
    if (!localTx) return;

    const typeLabels: Record<string, string> = {
      WALLET_RECHARGE: "recarga de billetera",
      SUBSCRIPTION: "suscripción",
      INVESTMENT_DEPOSIT: "depósito de inversión",
      OTHER: "pago",
    };

    const typeLabel = typeLabels[localTx.type] || "pago";
    const statusLabel = status === "DECLINED" ? "rechazado" : "con error";

    await db.createNotification({
      userId: localTx.userId,
      title: `Pago ${statusLabel}`,
      message: `Tu ${typeLabel} de ${new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(localTx.amountInCents / 100)} fue ${statusLabel}. Intenta de nuevo o usa otro método de pago.`,
      type: "PAYMENT",
      data: JSON.stringify({
        key: `payment-failed-${reference}`,
        reference,
        status,
        type: localTx.type,
      }),
    });

    // Enviar push notification de fallo
    try {
      const user = await db.getUserById(localTx.userId);
      if (user?.fcmToken) {
        await sendPushNotification(user.fcmToken, {
          type: "system_alert",
          title: `Pago ${statusLabel}`,
          body: `Tu ${typeLabel} no pudo ser procesado. Intenta de nuevo o usa otro método de pago.`,
          clickAction: "/wallet",
          data: {
            reference,
            status,
          },
        });
      }
    } catch (pushErr) {
      console.warn("[Wompi] Error enviando push de fallo:", pushErr);
    }

    console.log(`[Wompi] Notificación de pago fallido enviada a usuario ${localTx.userId}`);
  } catch (error) {
    console.error("[Wompi] Error creando notificación de pago fallido:", error);
  }
}
