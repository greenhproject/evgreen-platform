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
  WOMPI_TRANSACTION_STATUS,
} from "./config";
import * as db from "../db";

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
          await processWalletRecharge(reference, amount_in_cents / 100, payment_method_type, id);
        } else if (reference.startsWith("CHG-")) {
          await processChargingPayment(reference, amount_in_cents / 100);
        } else if (reference.startsWith("INV-")) {
          await processInvestmentDeposit(reference, amount_in_cents / 100, id);
        }
      } else if (status === WOMPI_TRANSACTION_STATUS.DECLINED) {
        console.log(`[Wompi Webhook] Pago rechazado: ${reference}`);
      } else if (status === WOMPI_TRANSACTION_STATUS.ERROR) {
        console.log(`[Wompi Webhook] Pago con error: ${reference}`);
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
  wompiTxId: string
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

    console.log(`[Wompi] Recarga completada para usuario ${localTx.userId}: $${amount}`);
  } catch (error) {
    console.error(`[Wompi] Error procesando recarga:`, error);
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
