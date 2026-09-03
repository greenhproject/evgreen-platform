import type { Request, Response } from "express";
import { getPlatformSettings } from "../db";
import { decryptConfiguredDocusignWebhookSecret, processDocusignContractCompletion } from "./contracts-router";
import { validateDocusignWebhookSignature } from "./docusign-client";

export function extractDocusignEnvelopeEvent(payload: any): { envelopeId: string; status: string; eventType: string } | null {
  const envelopeId = payload?.data?.envelopeId || payload?.data?.envelopeSummary?.envelopeId || payload?.envelopeId || payload?.envelopeSummary?.envelopeId;
  const status = payload?.data?.envelopeSummary?.status || payload?.data?.status || payload?.envelopeSummary?.status || payload?.status;
  const eventType = payload?.event || payload?.eventType || payload?.data?.event || "envelope-updated";
  if (!envelopeId || !status) return null;
  return { envelopeId: String(envelopeId), status: String(status), eventType: String(eventType) };
}

function headerValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export async function handleDocusignWebhook(req: Request, res: Response) {
  const rawBody = typeof req.body === "string" ? req.body : "";
  if (!rawBody) return res.status(400).json({ error: "Missing raw webhook body" });
  try {
    const settings: any = await getPlatformSettings();
    const secret = decryptConfiguredDocusignWebhookSecret(settings);
    const signatures = [
      ...headerValues(req.headers["x-docusign-signature-1"]),
      ...headerValues(req.headers["x-docusign-signature-2"]),
      ...headerValues(req.headers["x-docusign-signature-3"]),
      ...headerValues(req.headers["x-docusign-signature-4"]),
    ];
    if (!secret || !validateDocusignWebhookSignature(secret, rawBody, signatures)) {
      return res.status(401).json({ error: "Invalid DocuSign webhook signature" });
    }
    const payload = JSON.parse(rawBody);
    const event = extractDocusignEnvelopeEvent(payload);
    if (!event) return res.status(400).json({ error: "Unsupported DocuSign event payload" });
    const result = await processDocusignContractCompletion({ ...event, rawEvent: payload });
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[DocuSign] Error procesando Connect webhook", error);
    return res.status(500).json({ error: "Unable to process DocuSign event" });
  }
}
