/**
 * Stripe webhook - DEPRECATED
 * La plataforma ahora usa Wompi como pasarela de pagos.
 * Todos los webhooks de pago se procesan en wompi/webhook.ts.
 */

import type { Request, Response } from "express";

export async function handleStripeWebhook(_req: Request, res: Response) {
  return res.status(410).json({
    error: "Stripe webhook deprecated",
    message: "Usa Wompi webhook en /api/wompi/webhook",
  });
}
