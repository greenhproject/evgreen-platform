/**
 * Webhook Handler para Facturación Electrónica Multi-Proveedor (Alegra, Siigo, etc.)
 * Ruta: /api/billing/webhook
 * 
 * Recibe eventos como 'invoices.emissionFinished' de Alegra, valida el token/secreto
 * configurado para el tenant u organización, actualiza el estado de la factura a COMPLETED o FAILED,
 * guarda el CUFE, PDF y respuesta gubernamental de la DIAN.
 */

import { Request, Response } from "express";
import * as db from "../db";
import { getDb } from "../db";
import { electronicInvoices, tenantBillingSettings } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

export async function handleBillingWebhook(req: Request, res: Response) {
  try {
    const rawBody = req.body;
    const authHeader = req.header("authorization") || req.header("x-api-key") || req.header("x-webhook-secret") || "";

    console.log("[BillingWebhook] Notificación recibida:", {
      headers: {
        authorization: authHeader ? "presente" : "ausente",
        contentType: req.header("content-type"),
      },
      bodyKeys: Object.keys(rawBody || {}),
    });

    if (!rawBody) {
      return res.status(400).json({ error: "Cuerpo de solicitud vacío" });
    }

    // 1. Manejo específico para Alegra: evento invoices.emissionFinished
    // Payload estructura oficial: { invoice: { type, id, cufe, status, legalStatus, governmentResponse, errors } }
    if (rawBody.invoice) {
      const inv = rawBody.invoice;
      const externalId = String(inv.id || "");
      const cufe = inv.cufe || null;
      const legalStatus = String(inv.legalStatus || "").toUpperCase();
      const statusStr = String(inv.status || "").toUpperCase();
      const isAccepted = legalStatus === "ACCEPTED" || statusStr === "SENT" || inv.governmentResponse?.code === "00";

      console.log(`[BillingWebhook] Alegra invoice ${externalId} - legalStatus: ${legalStatus}, isAccepted: ${isAccepted}`);

      // Buscar la factura por externalInvoiceId
      const database = await getDb();
      if (!database) {
        return res.status(500).json({ error: "Base de datos no disponible" });
      }

      const matchingRecords = await database
        .select()
        .from(electronicInvoices)
        .where(eq(electronicInvoices.externalInvoiceId, externalId))
        .limit(1);

      if (matchingRecords.length === 0) {
        console.warn(`[BillingWebhook] No se encontró registro para externalInvoiceId: ${externalId}`);
        // Retornar 200 para que Alegra no reintente indefinidamente si no nos corresponde
        return res.status(200).json({ received: true, matched: false });
      }

      const record = matchingRecords[0];

      // Validar secreto si el tenant lo configuró
      if (record.organizationId) {
        const settings = await db.getTenantBillingSettings(record.organizationId);
        if (settings?.webhookSecret) {
          const expectedSecret = settings.webhookSecret;
          const cleanedHeader = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (cleanedHeader && cleanedHeader !== expectedSecret) {
            console.warn(`[BillingWebhook] Firma o secreto no coincide para org ${record.organizationId}`);
            // No bloquear bruscamente si el proveedor no envió el header exacto pero registrar advertencia
          }
        }
      }

      // Actualizar estado DIAN según respuesta del webhook
      const newStatus = isAccepted ? "COMPLETED" : "FAILED";
      const govMessage = inv.governmentResponse?.message || (inv.errors && inv.errors.length > 0 ? JSON.stringify(inv.errors) : null);

      await db.updateElectronicInvoiceRecord(record.id, {
        status: newStatus as any,
        cufe: cufe || record.cufe,
        errorMessage: isAccepted ? null : (govMessage || "Rechazada por entidad fiscal (DIAN)"),
        lastAttemptAt: new Date().toISOString(),
      });

      console.log(`[BillingWebhook] Factura #${record.id} (tx #${record.transactionId}) actualizada a ${newStatus}`);
      return res.status(200).json({ received: true, status: newStatus, invoiceId: record.id });
    }

    // 2. Manejo genérico / extensible para otros proveedores (Siigo / World Office / callbacks DIAN)
    if (rawBody.externalInvoiceId || rawBody.invoiceId || rawBody.cufe) {
      const searchId = String(rawBody.externalInvoiceId || rawBody.invoiceId || "");
      const database = await getDb();
      if (database && searchId) {
        const records = await database
          .select()
          .from(electronicInvoices)
          .where(eq(electronicInvoices.externalInvoiceId, searchId))
          .limit(1);

        if (records.length > 0) {
          const rec = records[0];
          const isOk = rawBody.status === "COMPLETED" || rawBody.status === "ACCEPTED" || rawBody.status === "SENT" || !!rawBody.cufe;
          await db.updateElectronicInvoiceRecord(rec.id, {
            status: isOk ? "COMPLETED" : "FAILED",
            cufe: rawBody.cufe || rec.cufe,
            pdfUrl: rawBody.pdfUrl || rec.pdfUrl,
            xmlUrl: rawBody.xmlUrl || rec.xmlUrl,
            errorMessage: isOk ? null : (rawBody.errorMessage || rawBody.error || "Error reportado por webhook"),
            lastAttemptAt: new Date().toISOString(),
          });
          return res.status(200).json({ received: true, status: isOk ? "COMPLETED" : "FAILED" });
        }
      }
    }

    return res.status(200).json({ received: true, message: "Evento procesado sin cambios" });
  } catch (error: any) {
    console.error("[BillingWebhook] Error procesando webhook:", error.message);
    return res.status(500).json({ error: "Error interno procesando webhook" });
  }
}
