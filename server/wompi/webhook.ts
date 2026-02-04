/**
 * Webhook handler para eventos de Wompi
 */

import { Request, Response } from "express";
import { verifyWebhookSignature, WOMPI_TRANSACTION_STATUS } from "./config";
import * as db from "../db";
import { sendWalletRechargeNotification } from "../notifications/paymentNotifications";

// Tabla temporal para trackear transacciones pendientes (en producción usar DB)
const pendingTransactions = new Map<string, { userId: number; amount: number; type: string }>();

export function trackPendingTransaction(reference: string, userId: number, amount: number, type: string) {
  pendingTransactions.set(reference, { userId, amount, type });
}

export async function handleWompiWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-event-checksum"] as string;
    const timestamp = req.headers["x-event-timestamp"] as string;
    const payload = JSON.stringify(req.body);

    // Verificar firma del webhook (opcional en sandbox)
    if (process.env.WOMPI_TEST_MODE !== "true" && signature && timestamp) {
      const isValid = verifyWebhookSignature(payload, signature, timestamp);
      if (!isValid) {
        console.error("[Wompi Webhook] Firma inválida");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = req.body;
    console.log("[Wompi Webhook] Evento recibido:", event.event, event.data?.transaction?.id);

    // Manejar eventos de transacción
    if (event.event === "transaction.updated") {
      const transaction = event.data?.transaction;
      
      if (!transaction) {
        return res.status(400).json({ error: "No transaction data" });
      }

      const { id, reference, status, amount_in_cents, payment_method_type } = transaction;
      
      console.log(`[Wompi Webhook] Transacción ${id} - Estado: ${status} - Referencia: ${reference}`);

      // Procesar según el estado
      if (status === WOMPI_TRANSACTION_STATUS.APPROVED) {
        // Determinar tipo de pago por el prefijo de la referencia
        if (reference.startsWith("WLT-")) {
          // Recarga de billetera
          await processWalletRecharge(reference, amount_in_cents / 100, payment_method_type, id);
        } else if (reference.startsWith("CHG-")) {
          // Pago de carga
          await processChargingPayment(reference, amount_in_cents / 100);
        }
      } else if (status === WOMPI_TRANSACTION_STATUS.DECLINED) {
        console.log(`[Wompi Webhook] Pago rechazado: ${reference}`);
        // Limpiar transacción pendiente
        pendingTransactions.delete(reference);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Wompi Webhook] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function processWalletRecharge(reference: string, amount: number, paymentMethod: string, transactionId: string) {
  console.log(`[Wompi] Procesando recarga de billetera: ${reference} - $${amount}`);
  
  // Buscar transacción pendiente
  const pending = pendingTransactions.get(reference);
  
  if (!pending) {
    console.error(`[Wompi] No se encontró transacción pendiente para: ${reference}`);
    return;
  }

  try {
    // Agregar saldo a la billetera del usuario
    await db.addUserWalletBalance(pending.userId, amount);
    
    // Obtener datos del usuario para notificación
    const user = await db.getUserById(pending.userId);
    const wallet = await db.getUserWallet(pending.userId);
    
    if (user?.email) {
      // Mapear método de pago a nombre legible
      const paymentMethodNames: Record<string, string> = {
        'PSE': 'PSE (Transferencia bancaria)',
        'NEQUI': 'Nequi',
        'BANCOLOMBIA_QR': 'Bancolombia QR',
        'BANCOLOMBIA_TRANSFER': 'Transferencia Bancolombia',
        'CARD': 'Tarjeta de crédito/débito',
        'EFECTY': 'Efecty',
      };
      
      const methodName = paymentMethodNames[paymentMethod] || paymentMethod;
      
      // Enviar notificación por email
      await sendWalletRechargeNotification({
        userEmail: user.email,
        userName: user.name || 'Usuario',
        amount,
        paymentMethod: `Wompi (${methodName})`,
        transactionId,
        newBalance: wallet ? parseFloat(wallet.balance) : amount,
      });
      
      console.log(`[Wompi] Notificación enviada a ${user.email}`);
    }
    
    // Limpiar transacción pendiente
    pendingTransactions.delete(reference);
    
    console.log(`[Wompi] Recarga completada para usuario ${pending.userId}: $${amount}`);
  } catch (error) {
    console.error(`[Wompi] Error procesando recarga:`, error);
  }
}

async function processChargingPayment(reference: string, amount: number) {
  console.log(`[Wompi] Procesando pago de carga: ${reference} - $${amount}`);
  
  // Extraer ID de transacción de la referencia (CHG-{transactionId}-{timestamp})
  const parts = reference.split('-');
  if (parts.length >= 2) {
    const transactionId = parts[1];
    
    try {
      // Actualizar estado de pago de la transacción
      await db.updateTransactionPaymentStatus(transactionId, {
        paymentStatus: "paid",
        stripeSessionId: `wompi-${reference}`,
        stripePaymentIntentId: `wompi-${reference}`,
      });
      
      console.log(`[Wompi] Pago de carga ${transactionId} marcado como pagado`);
    } catch (error) {
      console.error(`[Wompi] Error actualizando pago de carga:`, error);
    }
  }
}
