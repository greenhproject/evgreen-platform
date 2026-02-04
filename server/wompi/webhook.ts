/**
 * Webhook handler para eventos de Wompi
 */

import { Request, Response } from "express";
import { verifyWebhookSignature, WOMPI_TRANSACTION_STATUS } from "./config";
import * as db from "../db";

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
          await processWalletRecharge(reference, amount_in_cents / 100);
        } else if (reference.startsWith("CHG-")) {
          // Pago de carga
          await processChargingPayment(reference, amount_in_cents / 100);
        }
      } else if (status === WOMPI_TRANSACTION_STATUS.DECLINED) {
        console.log(`[Wompi Webhook] Pago rechazado: ${reference}`);
        // Notificar al usuario si es necesario
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Wompi Webhook] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function processWalletRecharge(reference: string, amount: number) {
  console.log(`[Wompi] Procesando recarga de billetera: ${reference} - $${amount}`);
  
  // TODO: Buscar el usuario asociado a esta referencia en una tabla de transacciones pendientes
  // Por ahora, el usuario debe verificar manualmente desde el frontend
}

async function processChargingPayment(reference: string, amount: number) {
  console.log(`[Wompi] Procesando pago de carga: ${reference} - $${amount}`);
  
  // TODO: Actualizar el estado de la transacción de carga
}
