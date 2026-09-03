import crypto from "crypto";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { siteContractEvents, siteContracts } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGet } from "../storage";

export function hashManualDownloadToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function createManualDownloadExpiry(hours = 72): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

export async function handleManualContractDownload(req: Request, res: Response) {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) return res.status(404).send("Documento no disponible.");

  const db = await getDb();
  if (!db) return res.status(503).send("Servicio documental no disponible.");
  const tokenHash = hashManualDownloadToken(token);
  const [contract] = await db.select({
    id: siteContracts.id,
    status: siteContracts.status,
    contractNumber: siteContracts.contractNumber,
    draftPdfKey: siteContracts.draftPdfKey,
    manualDownloadExpiresAt: siteContracts.manualDownloadExpiresAt,
  }).from(siteContracts).where(and(eq(siteContracts.manualDownloadTokenHash, tokenHash), eq(siteContracts.status, "MANUAL_PDF_ISSUED"))).limit(1);

  if (!contract || !contract.draftPdfKey || !contract.manualDownloadExpiresAt || new Date(contract.manualDownloadExpiresAt).getTime() < Date.now()) {
    return res.status(404).send("El enlace de descarga no está disponible o venció.");
  }

  await db.insert(siteContractEvents).values({
    contractId: contract.id,
    eventType: "MANUAL_PDF_LINK_OPENED",
    channel: "MANUAL_PDF",
    ipAddress: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || null,
    userAgent: req.headers["user-agent"]?.toString() || null,
    details: { contractNumber: contract.contractNumber, linkExpiresAt: contract.manualDownloadExpiresAt },
  });
  const download = await storageGet(contract.draftPdfKey);
  res.setHeader("Cache-Control", "no-store, private");
  return res.redirect(302, download.url);
}
