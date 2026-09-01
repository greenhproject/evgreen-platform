import type { Request, Response } from "express";
import { getResendClient, getResendWebhookSecret } from "./resend-client";
import { recordLetterDeliveryEvent } from "./letter-delivery-events";

export async function handleResendWebhook(req: Request, res: Response) {
  const webhookSecret = await getResendWebhookSecret();
  if (!webhookSecret) return res.status(503).json({ error: "Webhook de correo no configurado" });
  const rawPayload = typeof req.body === "string" ? req.body : "";
  const svixId = req.header("svix-id") ?? "";
  const svixTimestamp = req.header("svix-timestamp") ?? "";
  const svixSignature = req.header("svix-signature") ?? "";
  if (!rawPayload || !svixId || !svixTimestamp || !svixSignature) return res.status(400).json({ error: "Solicitud de webhook incompleta" });

  try {
    const resend = await getResendClient();
    const event = resend.webhooks.verify({
      payload: rawPayload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
    const outcome = await recordLetterDeliveryEvent(svixId, event as any);
    return res.status(200).json({ received: true, ...outcome });
  } catch (error) {
    console.warn("[ResendWebhook] Evento rechazado:", error instanceof Error ? error.message : "error desconocido");
    return res.status(400).json({ error: "Firma de webhook inválida" });
  }
}
