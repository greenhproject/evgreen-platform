import crypto from "crypto";
import * as mammoth from "mammoth";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router as trpcRouter } from "../_core/trpc";
import {
  contractTemplates,
  siteContractEvents,
  siteContractParties,
  siteContracts,
  spaceSubmissions,
} from "../../drizzle/schema";
import { getDb, getPlatformSettings, upsertPlatformSettings, withRetry } from "../db";
import { storageGet, storagePut } from "../storage";
import {
  DEFAULT_CONTRACT_VARIABLES,
  canIssueManualPdf,
  canSendToDocuSign,
  normalizeContractVariables,
  renderContractTemplate,
  unresolvedContractVariables,
} from "../../shared/site-contracts";
import { appendContractSignatureBlocks, generateContractPdf, sanitizeContractHtml, sha256 } from "./contract-pdf-service";
import { decryptDocusignSecret, encryptDocusignSecret, maskDocusignSecret } from "./docusign-crypto";
import { buildDocusignConsentUrl, downloadDocusignArtifacts, DocusignSettings, sendDocusignEnvelope, testDocusignConnection, voidDocusignEnvelope } from "./docusign-client";
import { createManualDownloadExpiry, hashManualDownloadToken } from "./manual-contract-download";

const FILE_MAX_BYTES = 10 * 1024 * 1024;
const CONTRACT_DURATION_YEARS = 10;

const partySchema = z.object({
  legalName: z.string().trim().min(3).max(255),
  taxId: z.string().trim().min(3).max(64),
  representativeName: z.string().trim().min(3).max(255),
  representativeDocument: z.string().trim().min(3).max(64),
  representativeTitle: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional(),
  notificationAddress: z.string().trim().min(5).max(500),
  domicile: z.string().trim().max(160).optional(),
});

const docusignConfigSchema = z.object({
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  enabled: z.boolean(),
  integrationKey: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(100).optional(),
  accountId: z.string().trim().max(100).optional(),
  consentRedirectUri: z.string().trim().url().max(500).optional(),
  privateKey: z.string().trim().min(100).max(20000).optional(),
  webhookSecret: z.string().trim().min(12).max(1000).optional(),
});

function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function requestEvidence(ctx: any) {
  return {
    actorUserId: ctx.user.id,
    actorRole: ctx.user.role,
    actorEmail: ctx.user.email || null,
    ipAddress: ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || ctx.req.socket.remoteAddress || null,
    userAgent: ctx.req.headers["user-agent"]?.toString() || null,
  };
}

async function recordContractEvent(db: any, input: {
  contractId: number;
  eventType: string;
  channel?: "INTERNAL" | "DOCUSIGN" | "MANUAL_PDF";
  externalEventId?: string | null;
  ctx?: any;
  details?: Record<string, unknown>;
}) {
  if (input.externalEventId) {
    const [existing] = await db.select({ id: siteContractEvents.id })
      .from(siteContractEvents)
      .where(eq(siteContractEvents.externalEventId, input.externalEventId))
      .limit(1);
    if (existing) return;
  }
  const evidence = input.ctx ? requestEvidence(input.ctx) : {};
  await db.insert(siteContractEvents).values({
    contractId: input.contractId,
    eventType: input.eventType,
    channel: input.channel || "INTERNAL",
    externalEventId: input.externalEventId || null,
    ...evidence,
    details: input.details || null,
  });
}

function contractNumber(): string {
  const date = new Date();
  return `EVG-CON-${date.getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "plantilla.docx";
}

async function getContractsDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La base de datos contractual no está disponible temporalmente. Intente de nuevo en unos segundos.",
    });
  }
  return db;
}

/** Solo reintenta errores transitorios de red; no oculta errores de permisos o datos. */
function withContractDbRetry<T>(context: string, operation: () => Promise<T>): Promise<T> {
  return withRetry(operation, `contracts.${context}`);
}

function decodeBase64(base64: string): Buffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > FILE_MAX_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "El archivo debe tener un tamaño entre 1 byte y 10 MB." });
  return buffer;
}

function asDocusignSettings(settings: any): DocusignSettings {
  return {
    docusignEnvironment: settings?.docusignEnvironment || "SANDBOX",
    docusignEnabled: settings?.docusignEnabled || 0,
    docusignIntegrationKey: settings?.docusignIntegrationKey,
    docusignUserId: settings?.docusignUserId,
    docusignAccountId: settings?.docusignAccountId,
    docusignBaseUri: settings?.docusignBaseUri,
    docusignConsentRedirectUri: settings?.docusignConsentRedirectUri,
    docusignPrivateKeyEncrypted: settings?.docusignPrivateKeyEncrypted,
    docusignWebhookSecretEncrypted: settings?.docusignWebhookSecretEncrypted,
  };
}

function hasDocusignCredentials(settings: any): boolean {
  return Boolean(settings?.docusignIntegrationKey && settings?.docusignUserId && settings?.docusignPrivateKeyEncrypted && settings?.docusignWebhookSecretEncrypted && settings?.docusignAccountId && settings?.docusignBaseUri);
}

const legalAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado. La formalización contractual es exclusiva de Administración." });
  }
  return next({ ctx });
});

export const contractsRouter = trpcRouter({
    getDocusignConfig: legalAdminProcedure.query(async () => {
      const settings: any = await getPlatformSettings();
      const config = asDocusignSettings(settings);
      return {
        environment: config.docusignEnvironment,
        enabled: Boolean(config.docusignEnabled),
        integrationKey: config.docusignIntegrationKey || "",
        userId: config.docusignUserId || "",
        accountId: config.docusignAccountId || "",
        baseUri: config.docusignBaseUri || "",
        consentRedirectUri: config.docusignConsentRedirectUri || "",
        privateKey: maskDocusignSecret(config.docusignPrivateKeyEncrypted),
        webhookSecret: maskDocusignSecret(config.docusignWebhookSecretEncrypted),
        hasPrivateKey: Boolean(config.docusignPrivateKeyEncrypted),
        hasWebhookSecret: Boolean(config.docusignWebhookSecretEncrypted),
        ready: hasDocusignCredentials(settings),
        consentUrl: buildDocusignConsentUrl(config),
        lastTestAt: settings?.docusignLastTestAt || null,
        lastTestStatus: settings?.docusignLastTestStatus || "NEVER",
        lastTestMessage: settings?.docusignLastTestMessage || null,
      };
    }),

    saveDocusignConfig: legalAdminProcedure.input(docusignConfigSchema).mutation(async ({ input, ctx }: any) => {
      const current: any = await getPlatformSettings();
      const hasPrivateKey = Boolean(input.privateKey || current?.docusignPrivateKeyEncrypted);
      const hasWebhookSecret = Boolean(input.webhookSecret || current?.docusignWebhookSecretEncrypted);
      const integrationKey = input.integrationKey || current?.docusignIntegrationKey;
      const userId = input.userId || current?.docusignUserId;
      const consentRedirectUri = input.consentRedirectUri || current?.docusignConsentRedirectUri;
      if (input.enabled && (!integrationKey || !userId || !consentRedirectUri || !hasPrivateKey || !hasWebhookSecret)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Para activar DocuSign se requieren Integration Key, User ID, URI de consentimiento, clave privada RSA y secreto HMAC." });
      }
      const update: any = {
        docusignEnvironment: input.environment,
        docusignEnabled: input.enabled ? 1 : 0,
        docusignIntegrationKey: input.integrationKey || current?.docusignIntegrationKey || null,
        docusignUserId: input.userId || current?.docusignUserId || null,
        docusignAccountId: input.accountId || current?.docusignAccountId || null,
        docusignConsentRedirectUri: input.consentRedirectUri || current?.docusignConsentRedirectUri || null,
        updatedBy: ctx.user.id,
      };
      if (input.privateKey) update.docusignPrivateKeyEncrypted = encryptDocusignSecret(input.privateKey);
      if (input.webhookSecret) update.docusignWebhookSecretEncrypted = encryptDocusignSecret(input.webhookSecret);
      await upsertPlatformSettings(update);
      return { success: true };
    }),

    testDocusignConnection: legalAdminProcedure.mutation(async () => {
      const current: any = await getPlatformSettings();
      const settings = asDocusignSettings(current);
      const testedAt = nowSql();
      try {
        const result = await testDocusignConnection(settings);
        await upsertPlatformSettings({
          docusignAccountId: result.accountId,
          docusignBaseUri: result.baseUri,
          docusignLastTestAt: testedAt,
          docusignLastTestStatus: "SUCCESS",
          docusignLastTestMessage: `Conectado a ${result.accountName}.`,
        } as any);
        return { success: true, message: `Conectado a ${result.accountName}.`, accountId: result.accountId, baseUri: result.baseUri };
      } catch (error: any) {
        const message = error?.message || "No fue posible validar DocuSign.";
        await upsertPlatformSettings({ docusignLastTestAt: testedAt, docusignLastTestStatus: "FAILED", docusignLastTestMessage: message } as any);
        return { success: false, message, consentUrl: buildDocusignConsentUrl(settings) };
      }
    }),

    listTemplates: legalAdminProcedure.query(async () => {
      const db = await getContractsDb();
      return withContractDbRetry("listTemplates", () => db.select({
          id: contractTemplates.id, name: contractTemplates.name, version: contractTemplates.version, status: contractTemplates.status,
          sourceFilename: contractTemplates.sourceFilename, contentHash: contractTemplates.contentHash, legalReviewNote: contractTemplates.legalReviewNote,
          approvedAt: contractTemplates.approvedAt, createdAt: contractTemplates.createdAt, updatedAt: contractTemplates.updatedAt,
        }).from(contractTemplates).orderBy(desc(contractTemplates.createdAt)));
    }),

    getTemplate: legalAdminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      return template;
    }),

    createTemplateFromDocx: legalAdminProcedure.input(z.object({
      name: z.string().trim().min(3).max(255), version: z.string().trim().min(1).max(64), filename: z.string().trim().min(1).max(255),
      contentType: z.literal("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), fileBase64: z.string().min(1),
    })).mutation(async ({ input, ctx }: any) => {
      const source = decodeBase64(input.fileBase64);
      if (source.subarray(0, 2).toString("utf8") !== "PK") throw new TRPCError({ code: "BAD_REQUEST", message: "La plantilla debe ser un archivo DOCX válido." });
      const converted = await mammoth.convertToHtml({ buffer: source });
      const htmlContent = sanitizeContractHtml(converted.value).trim();
      if (!htmlContent) throw new TRPCError({ code: "BAD_REQUEST", message: "No fue posible extraer contenido de la plantilla DOCX." });
      const sourceHash = sha256(source);
      const key = `contracts/templates/${crypto.randomBytes(10).toString("hex")}-${safeFilename(input.filename)}`;
      const uploaded = await storagePut(key, source, input.contentType);
      const variables = Array.from(new Set([...DEFAULT_CONTRACT_VARIABLES, ...Array.from(htmlContent.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g)).map(match => match[1]) ]));
      const db = await getContractsDb();
      const [result] = await withContractDbRetry("createTemplateFromDocx", () => db.insert(contractTemplates).values({
        name: input.name, version: input.version, sourceFilename: input.filename, sourceMimeType: input.contentType,
        sourceFileUrl: uploaded.url, sourceFileKey: uploaded.key, htmlContent,
        variableSchema: { variables, required: variables }, contentHash: sourceHash, createdBy: ctx.user.id,
      }));
      return { success: true, templateId: result.insertId, conversionWarnings: converted.messages.map(message => message.message) };
    }),

    updateDraftTemplate: legalAdminProcedure.input(z.object({
      id: z.number().int().positive(), htmlContent: z.string().trim().min(100).max(900000), legalReviewNote: z.string().trim().max(5000).optional(),
    })).mutation(async ({ input }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select({ status: contractTemplates.status }).from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      if (template.status !== "DRAFT") throw new TRPCError({ code: "CONFLICT", message: "Solo se puede editar una plantilla en borrador. Cree una versión nueva para cambiar condiciones futuras." });
      const htmlContent = sanitizeContractHtml(input.htmlContent);
      await db.update(contractTemplates).set({ htmlContent, legalReviewNote: input.legalReviewNote || null, contentHash: sha256(htmlContent) }).where(eq(contractTemplates.id, input.id));
      return { success: true };
    }),

    activateTemplate: legalAdminProcedure.input(z.object({ id: z.number().int().positive(), legalReviewNote: z.string().trim().min(20).max(5000) })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      if (template.status === "RETIRED") throw new TRPCError({ code: "CONFLICT", message: "Una plantilla retirada no puede reactivarse. Cree una nueva versión aprobada." });
      const at = nowSql();
      await db.update(contractTemplates).set({ status: "RETIRED", retiredBy: ctx.user.id, retiredAt: at }).where(and(eq(contractTemplates.name, template.name), eq(contractTemplates.status, "ACTIVE")));
      await db.update(contractTemplates).set({ status: "ACTIVE", legalReviewNote: input.legalReviewNote, approvedBy: ctx.user.id, approvedAt: at }).where(eq(contractTemplates.id, input.id));
      return { success: true };
    }),

    listEligibleSpaces: legalAdminProcedure.query(async () => {
      const db = (await getDb())!;
      return db.select({
        id: spaceSubmissions.id, code: spaceSubmissions.code, spaceName: spaceSubmissions.spaceName, spaceStatus: spaceSubmissions.spaceStatus,
        submitterName: spaceSubmissions.submitterName, submitterCompany: spaceSubmissions.submitterCompany, submitterEmail: spaceSubmissions.submitterEmail,
        submitterPhone: spaceSubmissions.submitterPhone, submitterDocument: spaceSubmissions.submitterDocument, address: spaceSubmissions.address,
        city: spaceSubmissions.city, department: spaceSubmissions.department, country: spaceSubmissions.country, availableAreaM2: spaceSubmissions.availableAreaM2,
        parkingSpots: spaceSubmissions.parkingSpots, letterAcceptedAt: spaceSubmissions.letterAcceptedAt,
      }).from(spaceSubmissions).where(and(eq(spaceSubmissions.spaceStatus, "letter_accepted"))).orderBy(desc(spaceSubmissions.letterAcceptedAt));
    }),

    listContracts: legalAdminProcedure.query(async () => {
      const db = await getContractsDb();
      return withContractDbRetry("listContracts", () => db.select({
          id: siteContracts.id, contractNumber: siteContracts.contractNumber, status: siteContracts.status, templateName: siteContracts.templateName,
          templateVersion: siteContracts.templateVersion, contentHash: siteContracts.contentHash, createdAt: siteContracts.createdAt,
          updatedAt: siteContracts.updatedAt, issuedAt: siteContracts.issuedAt, completedAt: siteContracts.completedAt, draftPdfUrl: siteContracts.draftPdfUrl,
          spaceName: spaceSubmissions.spaceName, submissionCode: spaceSubmissions.code, city: spaceSubmissions.city,
        }).from(siteContracts).innerJoin(spaceSubmissions, eq(siteContracts.submissionId, spaceSubmissions.id)).orderBy(desc(siteContracts.updatedAt)));
    }),

    getContract: legalAdminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select({ contract: siteContracts, space: spaceSubmissions }).from(siteContracts).innerJoin(spaceSubmissions, eq(siteContracts.submissionId, spaceSubmissions.id)).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      const [parties, events] = await Promise.all([
        db.select().from(siteContractParties).where(eq(siteContractParties.contractId, input.id)).orderBy(siteContractParties.signingOrder),
        db.select().from(siteContractEvents).where(eq(siteContractEvents.contractId, input.id)).orderBy(desc(siteContractEvents.createdAt)),
      ]);
      return { ...contract, parties, events };
    }),

    createContract: legalAdminProcedure.input(z.object({
      submissionId: z.number().int().positive(), templateId: z.number().int().positive(), variables: z.record(z.string(), z.string().max(1000)),
      ally: partySchema, operator: partySchema, expiresAt: z.string().datetime().optional(),
    })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [[space], [template]] = await Promise.all([
        db.select().from(spaceSubmissions).where(eq(spaceSubmissions.id, input.submissionId)).limit(1),
        db.select().from(contractTemplates).where(eq(contractTemplates.id, input.templateId)).limit(1),
      ]);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado." });
      if (!space.letterAcceptedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Solo se puede formalizar un contrato después de firmar la carta de intención." });
      if (!template || template.status !== "ACTIVE") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seleccione una plantilla contractual activa y aprobada." });
      const number = contractNumber();
      const variables = normalizeContractVariables({
        ...input.variables,
        NUMERO_CONTRATO: number,
        GHP_RAZON_SOCIAL: input.operator.legalName, GHP_NIT: input.operator.taxId, GHP_REPRESENTANTE: input.operator.representativeName,
        GHP_DOCUMENTO_REPRESENTANTE: input.operator.representativeDocument, GHP_DIRECCION: input.operator.notificationAddress,
        GHP_CORREO_NOTIFICACIONES: input.operator.email, GHP_TELEFONO: input.operator.phone || "",
        ALIADO_RAZON_SOCIAL: input.ally.legalName, ALIADO_NIT: input.ally.taxId, ALIADO_REPRESENTANTE: input.ally.representativeName,
        ALIADO_DOCUMENTO_REPRESENTANTE: input.ally.representativeDocument, ALIADO_DIRECCION_NOTIFICACIONES: input.ally.notificationAddress,
        ALIADO_CORREO_NOTIFICACIONES: input.ally.email, ALIADO_TELEFONO: input.ally.phone || "",
        SITIO_NOMBRE: space.spaceName, SITIO_DIRECCION: space.address, SITIO_CIUDAD: space.city, SITIO_DEPARTAMENTO: space.department || "",
        SITIO_TIPO: space.spaceType, AREA_CEDIDA_M2: space.availableAreaM2?.toString() || "", PUESTOS_PARQUEO: space.parkingSpots?.toString() || "",
        PLAZO_INICIAL_ANOS: String(CONTRACT_DURATION_YEARS),
      });
      const missing = unresolvedContractVariables(template.htmlContent, variables);
      if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Faltan variables obligatorias: ${missing.join(", ")}` });
      const filledHtml = renderContractTemplate(template.htmlContent, variables);
      const contractHtml = appendContractSignatureBlocks(filledHtml, {
        allyName: input.ally.legalName, allyRepresentative: input.ally.representativeName, allyDocument: input.ally.representativeDocument,
        operatorName: input.operator.legalName, operatorRepresentative: input.operator.representativeName, operatorDocument: input.operator.representativeDocument,
      });
      const contentHash = sha256(contractHtml);
      const pdfBuffer = await generateContractPdf({ contractHtml, contractNumber: number, contentHash });
      const pdfUpload = await storagePut(`contracts/drafts/${number}-${contentHash.slice(0, 12)}.pdf`, pdfBuffer, "application/pdf");
      const [result] = await db.insert(siteContracts).values({
        contractNumber: number, submissionId: space.id, templateId: template.id, templateName: template.name, templateVersion: template.version,
        status: "READY", variablesSnapshot: variables, contractHtml, contentHash, draftPdfUrl: pdfUpload.url, draftPdfKey: pdfUpload.key,
        expiresAt: input.expiresAt ? input.expiresAt.slice(0, 19).replace("T", " ") : null, createdBy: ctx.user.id,
      });
      const id = result.insertId;
      await db.insert(siteContractParties).values([
        { contractId: id, role: "ALLY", ...input.ally, signingOrder: 1 },
        { contractId: id, role: "OPERATOR", ...input.operator, signingOrder: 2 },
      ]);
      await recordContractEvent(db, { contractId: id, eventType: "CONTRACT_CREATED", ctx, details: { templateId: template.id, templateVersion: template.version, contentHash, variableKeys: Object.keys(variables) } });
      return { success: true, contractId: id, contractNumber: number, pdfUrl: pdfUpload.url, contentHash };
    }),

    issueManualPdf: legalAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      if (!canIssueManualPdf(contract.status as any)) throw new TRPCError({ code: "CONFLICT", message: "Este contrato no puede emitirse para firma manuscrita en su estado actual." });
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = createManualDownloadExpiry();
      await db.update(siteContracts).set({ status: "MANUAL_PDF_ISSUED", issuedAt: contract.issuedAt || nowSql(), manualDownloadTokenHash: hashManualDownloadToken(rawToken), manualDownloadExpiresAt: expiresAt }).where(eq(siteContracts.id, input.id));
      await recordContractEvent(db, { contractId: input.id, eventType: "MANUAL_PDF_ISSUED", channel: "MANUAL_PDF", ctx, details: { contentHash: contract.contentHash, linkExpiresAt: expiresAt } });
      return { success: true, pdfUrl: contract.draftPdfUrl, sharePath: `/api/contracts/manual/${rawToken}`, shareExpiresAt: expiresAt, contractNumber: contract.contractNumber, contentHash: contract.contentHash };
    }),

    uploadManualSignedPdf: legalAdminProcedure.input(z.object({ id: z.number().int().positive(), fileName: z.string().trim().min(1).max(255), fileBase64: z.string().min(1) })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      if (contract.status !== "MANUAL_PDF_ISSUED") throw new TRPCError({ code: "CONFLICT", message: "Solo puede cargar un PDF después de emitirlo para firma manuscrita." });
      const pdf = decodeBase64(input.fileBase64);
      if (pdf.subarray(0, 4).toString("utf8") !== "%PDF") throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo cargado debe ser un PDF." });
      const uploaded = await storagePut(`contracts/manual-signed/${contract.contractNumber}-${crypto.randomBytes(8).toString("hex")}.pdf`, pdf, "application/pdf");
      await db.update(siteContracts).set({ status: "MANUAL_PDF_RETURNED", manualSignedPdfUrl: uploaded.url, manualSignedPdfKey: uploaded.key, manualReturnedAt: nowSql() }).where(eq(siteContracts.id, input.id));
      await recordContractEvent(db, { contractId: input.id, eventType: "MANUAL_PDF_RETURNED", channel: "MANUAL_PDF", ctx, details: { fileName: safeFilename(input.fileName), uploadedHash: sha256(pdf), originalContractHash: contract.contentHash } });
      return { success: true, url: uploaded.url };
    }),

    verifyManualSignedPdf: legalAdminProcedure.input(z.object({ id: z.number().int().positive(), accepted: z.boolean(), note: z.string().trim().min(10).max(2000) })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      if (contract.status !== "MANUAL_PDF_RETURNED") throw new TRPCError({ code: "CONFLICT", message: "No hay un PDF manuscrito pendiente de verificación." });
      await db.update(siteContracts).set({ status: input.accepted ? "MANUAL_PDF_VERIFIED" : "MANUAL_PDF_REJECTED", manualVerifiedAt: nowSql(), manualVerifiedBy: ctx.user.id, completedAt: input.accepted ? nowSql() : null }).where(eq(siteContracts.id, input.id));
      await recordContractEvent(db, { contractId: input.id, eventType: input.accepted ? "MANUAL_PDF_VERIFIED" : "MANUAL_PDF_REJECTED", channel: "MANUAL_PDF", ctx, details: { note: input.note } });
      return { success: true };
    }),

    sendToDocusign: legalAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      if (!canSendToDocuSign(contract.status as any)) throw new TRPCError({ code: "CONFLICT", message: "Solo un contrato listo puede enviarse a DocuSign." });
      if (contract.expiresAt && new Date(contract.expiresAt).getTime() < Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El contrato ya expiró; emita una nueva versión antes de enviarlo." });
      const settings: any = await getPlatformSettings();
      if (!settings?.docusignEnabled || !hasDocusignCredentials(settings)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DocuSign no está configurado, probado y habilitado por Administración." });
      const parties = await db.select().from(siteContractParties).where(eq(siteContractParties.contractId, input.id)).orderBy(siteContractParties.signingOrder);
      const ally = parties.find(party => party.role === "ALLY");
      const operator = parties.find(party => party.role === "OPERATOR");
      if (!ally || !operator || !contract.draftPdfKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El expediente no tiene las dos partes o el PDF congelado requeridos." });
      const { url } = await storageGet(contract.draftPdfKey);
      const pdfResponse = await fetch(url);
      if (!pdfResponse.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible recuperar el PDF congelado para DocuSign." });
      const output = await sendDocusignEnvelope({ settings: asDocusignSettings(settings), contractNumber: contract.contractNumber, pdfBuffer: Buffer.from(await pdfResponse.arrayBuffer()), ally: { name: ally.representativeName, email: ally.email, order: ally.signingOrder }, operator: { name: operator.representativeName, email: operator.email, order: operator.signingOrder } });
      await db.update(siteContracts).set({ status: "DOCUSIGN_SENT", docusignEnvelopeId: output.envelopeId, docusignEnvelopeStatus: output.status, issuedAt: nowSql() }).where(eq(siteContracts.id, input.id));
      await recordContractEvent(db, { contractId: input.id, eventType: "DOCUSIGN_SENT", channel: "DOCUSIGN", externalEventId: output.envelopeId, ctx, details: { envelopeStatus: output.status, contentHash: contract.contentHash } });
      return { success: true, envelopeId: output.envelopeId };
    }),

    cancelContract: legalAdminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(15).max(2000) })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.id, input.id)).limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato no encontrado." });
      if (["DOCUSIGN_COMPLETED", "MANUAL_PDF_VERIFIED", "CANCELLED"].includes(contract.status)) throw new TRPCError({ code: "CONFLICT", message: "No se puede cancelar un contrato finalizado o cancelado." });
      if (contract.status === "DOCUSIGN_SENT" && contract.docusignEnvelopeId) {
        const settings: any = await getPlatformSettings();
        await voidDocusignEnvelope(asDocusignSettings(settings), contract.docusignEnvelopeId, input.reason);
      }
      await db.update(siteContracts).set({ status: "CANCELLED", cancelledAt: nowSql(), cancelledBy: ctx.user.id, cancellationReason: input.reason }).where(eq(siteContracts.id, input.id));
      await recordContractEvent(db, { contractId: input.id, eventType: "CONTRACT_CANCELLED", channel: contract.status === "DOCUSIGN_SENT" ? "DOCUSIGN" : "INTERNAL", ctx, details: { reason: input.reason } });
      return { success: true };
    }),
});

export async function processDocusignContractCompletion(input: { envelopeId: string; status: string; eventType: string; rawEvent: unknown }) {
  const db = (await getDb())!;
  const [contract] = await db.select().from(siteContracts).where(eq(siteContracts.docusignEnvelopeId, input.envelopeId)).limit(1);
  if (!contract) return { matched: false };
  const normalized = input.status.toLowerCase();
  const mappedStatus = normalized === "completed" ? "DOCUSIGN_COMPLETED" : normalized === "declined" ? "DOCUSIGN_DECLINED" : normalized === "voided" ? "DOCUSIGN_VOIDED" : normalized === "delivered" ? "DOCUSIGN_SENT" : "DOCUSIGN_SENT";
  const changes: any = { docusignEnvelopeStatus: input.status };
  if (mappedStatus !== "DOCUSIGN_SENT") changes.status = mappedStatus;
  if (mappedStatus === "DOCUSIGN_COMPLETED") {
    const settings: any = await getPlatformSettings();
    const artifacts = await downloadDocusignArtifacts(asDocusignSettings(settings), input.envelopeId);
    const completed = await storagePut(`contracts/docusign/completed/${contract.contractNumber}-${input.envelopeId}.pdf`, artifacts.combinedPdf, "application/pdf");
    const certificate = await storagePut(`contracts/docusign/certificates/${contract.contractNumber}-${input.envelopeId}.pdf`, artifacts.certificatePdf, "application/pdf");
    changes.docusignCompletedPdfUrl = completed.url;
    changes.docusignCompletedPdfKey = completed.key;
    changes.docusignCertificateUrl = certificate.url;
    changes.docusignCertificateKey = certificate.key;
    changes.completedAt = nowSql();
  }
  await db.update(siteContracts).set(changes).where(eq(siteContracts.id, contract.id));
  await recordContractEvent(db, { contractId: contract.id, eventType: `DOCUSIGN_${input.eventType.toUpperCase()}`, channel: "DOCUSIGN", externalEventId: `${input.envelopeId}:${input.eventType}:${input.status}`, details: { status: input.status, eventType: input.eventType } });
  return { matched: true, contractId: contract.id };
}

export function decryptConfiguredDocusignWebhookSecret(settings: any): string | null {
  return settings?.docusignWebhookSecretEncrypted ? decryptDocusignSecret(settings.docusignWebhookSecretEncrypted) : null;
}
