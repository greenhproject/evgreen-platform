import fs from "node:fs/promises";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { contractTemplates, users } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";
import { getDb } from "../server/db";

const baseUrl = process.env.CONTRACT_BASE_URL || "http://127.0.0.1:3000";

async function request(pathname: string, token: string, input?: unknown) {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}`, {
    method: input ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify({ json: input }) : undefined,
  });
  const payload = await response.json();
  return {
    status: response.status,
    data: payload?.result?.data?.json ?? payload?.result?.data,
    message: payload?.error?.json?.message || null,
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("La base activa no está disponible.");
  const accounts = await db.select({ id: users.id, openId: users.openId, name: users.name, role: users.role }).from(users).limit(200);
  const admin = accounts.find(account => account.role === "admin" && account.openId);
  const nonAdmin = accounts.find(account => account.role !== "admin" && account.openId);
  if (!admin?.openId) throw new Error("No existe una cuenta Admin para la validación.");
  if (!nonAdmin?.openId) throw new Error("No existe una cuenta no Admin para comprobar el rechazo de permisos.");

  const adminToken = await sdk.createSessionToken(admin.openId, { name: admin.name || "QA Admin", expiresInMs: 5 * 60 * 1000 });
  const userToken = await sdk.createSessionToken(nonAdmin.openId, { name: nonAdmin.name || "QA User", expiresInMs: 5 * 60 * 1000 });
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const createdIds: number[] = [];

  try {
    const [draftInsert] = await db.insert(contractTemplates).values({
      name: `QA eliminación ${suffix}`,
      version: `qa-draft-${suffix}`,
      status: "DRAFT",
      sourceFilename: "qa-delete.docx",
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceFileUrl: "https://invalid.local/qa-delete.docx",
      sourceFileKey: `contracts/templates/qa-delete-${suffix}.docx`,
      htmlContent: "<p>{{ALIADO_RAZON_SOCIAL}}</p>",
      variableSchema: { variables: ["ALIADO_RAZON_SOCIAL"], required: ["ALIADO_RAZON_SOCIAL"] },
      contentHash: crypto.randomBytes(32).toString("hex"),
      createdBy: admin.id,
    });
    const draftId = Number(draftInsert.insertId);
    createdIds.push(draftId);

    const [retiredInsert] = await db.insert(contractTemplates).values({
      name: `QA protegida ${suffix}`,
      version: `qa-retired-${suffix}`,
      status: "RETIRED",
      sourceFilename: "qa-protected.docx",
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceFileUrl: "https://invalid.local/qa-protected.docx",
      sourceFileKey: `contracts/templates/qa-protected-${suffix}.docx`,
      htmlContent: "<p>{{ALIADO_RAZON_SOCIAL}}</p>",
      variableSchema: { variables: ["ALIADO_RAZON_SOCIAL"], required: ["ALIADO_RAZON_SOCIAL"] },
      contentHash: crypto.randomBytes(32).toString("hex"),
      createdBy: admin.id,
    });
    const retiredId = Number(retiredInsert.insertId);
    createdIds.push(retiredId);

    const before = await request("contracts.listTemplates", adminToken);
    if (before.status !== 200) throw new Error(`El listado Admin falló: ${before.status} ${before.message || ""}`);
    const draft = before.data.find((item: any) => item.id === draftId);
    const retired = before.data.find((item: any) => item.id === retiredId);
    if (!draft?.canDelete || draft.contractCount !== 0) throw new Error("El borrador QA no apareció como eliminable y sin contratos.");
    if (retired?.canDelete || !retired?.deletionBlockReason) throw new Error("La versión retirada no apareció protegida.");

    const forbidden = await request("contracts.deleteDraftTemplate", userToken, { id: draftId, confirmVersion: draft.version });
    if (forbidden.status !== 403) throw new Error(`Un usuario no Admin no fue rechazado: HTTP ${forbidden.status}.`);

    const wrongConfirmation = await request("contracts.deleteDraftTemplate", adminToken, { id: draftId, confirmVersion: "incorrecta" });
    if (wrongConfirmation.status !== 400) throw new Error(`La confirmación incorrecta no fue rechazada: HTTP ${wrongConfirmation.status}.`);

    const protectedDeletion = await request("contracts.deleteDraftTemplate", adminToken, { id: retiredId, confirmVersion: retired.version });
    if (protectedDeletion.status !== 409) throw new Error(`La versión retirada no quedó bloqueada: HTTP ${protectedDeletion.status}.`);

    const deleted = await request("contracts.deleteDraftTemplate", adminToken, { id: draftId, confirmVersion: draft.version });
    if (deleted.status !== 200 || deleted.data?.deletedTemplateId !== draftId) throw new Error(`No se eliminó el borrador QA: HTTP ${deleted.status} ${deleted.message || ""}`);
    createdIds.splice(createdIds.indexOf(draftId), 1);

    const after = await request("contracts.listTemplates", adminToken);
    if (after.data.some((item: any) => item.id === draftId)) throw new Error("El borrador eliminado todavía aparece en el listado.");

    const docxPath = "/home/ubuntu/green-ev-platform/docs/Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";
    const duplicateDocx = await fs.readFile(docxPath);
    const duplicate = await request("contracts.createTemplateFromDocx", adminToken, {
      name: `QA duplicado ${suffix}`,
      version: `qa-duplicate-${suffix}`,
      filename: "Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBase64: duplicateDocx.toString("base64"),
    });
    if (duplicate.status !== 409 || !duplicate.message?.includes("ya está registrado")) {
      throw new Error(`La carga duplicada no fue bloqueada: HTTP ${duplicate.status} ${duplicate.message || ""}`);
    }

    console.log(JSON.stringify({
      baseUrl,
      adminOnly: true,
      forbiddenStatus: forbidden.status,
      wrongConfirmationStatus: wrongConfirmation.status,
      protectedTemplateStatus: protectedDeletion.status,
      deletedTemplateId: draftId,
      removedFromList: true,
      duplicateUploadStatus: duplicate.status,
      duplicateUploadMessage: duplicate.message,
    }, null, 2));
  } finally {
    if (createdIds.length) await db.delete(contractTemplates).where(inArray(contractTemplates.id, createdIds));
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
