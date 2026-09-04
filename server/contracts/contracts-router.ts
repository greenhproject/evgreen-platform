import crypto from "crypto";
import * as mammoth from "mammoth";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
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
  CONTRACT_VARIABLE_CATALOG,
  DEFAULT_CONTRACT_VARIABLES,
  analyzeContractTemplateMarkers,
  canIssueManualPdf,
  canSendToDocuSign,
} from "../../shared/site-contracts";
import { generateContractPdf, sanitizeContractHtml, sha256 } from "./contract-pdf-service";
import { decryptDocusignSecret, encryptDocusignSecret, maskDocusignSecret } from "./docusign-crypto";
import { buildDocusignConsentUrl, downloadDocusignArtifacts, DocusignSettings, sendDocusignEnvelope, testDocusignConnection, voidDocusignEnvelope } from "./docusign-client";
import { createManualDownloadExpiry, hashManualDownloadToken } from "./manual-contract-download";
import { ensureContractDocumentStorage } from "./ensure-contract-document-storage";
import { ensureInitialContractTemplate } from "./seed-initial-contract-template";
import { buildContractDraft, UnresolvedContractVariablesError } from "./contract-draft-builder";
import { getTemplateDeletionEligibility } from "./template-deletion";
import { getContractSpaceEligibility } from "./contract-space-eligibility";
import {
  getContractOperatorProfileStatus,
  mergeTemplateVariableSchema,
} from "./contract-operator-profile";
import { getContractAllyPrefill, requireValidContractAlly } from "./contract-ally-profile";
import {
  CONTRACT_DOCX_MIME,
  CONTRACT_PDF_MIME,
  analyzeContractTemplateSource,
  buildMappedContractPdf,
  buildContractTemplateMappingPreview,
  decodeContractTemplateUpload,
  downloadGoogleContractTemplate,
  mappingFingerprint,
  type ContractTemplateSource,
} from "./template-import-service";

const FILE_MAX_BYTES = 10 * 1024 * 1024;

const templateSourceInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("UPLOAD"),
    filename: z.string().trim().min(1).max(255),
    contentType: z.enum([CONTRACT_DOCX_MIME, CONTRACT_PDF_MIME]),
    fileBase64: z.string().min(1),
  }),
  z.object({
    kind: z.literal("GOOGLE_DRIVE"),
    sourceUrl: z.string().trim().url().max(1000),
  }),
]);

const markerMappingsSchema = z.record(
  z.string().trim().min(1).max(255),
  z.enum(DEFAULT_CONTRACT_VARIABLES),
);

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

const partyInputSchema = z.object({
  legalName: z.string().max(255),
  taxId: z.string().max(64),
  representativeName: z.string().max(255),
  representativeDocument: z.string().max(64),
  representativeTitle: z.string().max(120).optional(),
  email: z.string().max(320),
  phone: z.string().max(50).optional(),
  notificationAddress: z.string().max(500),
  domicile: z.string().max(160).optional(),
});

const contractOperatorProfileSchema = z.object({
  legalName: z.string().trim().min(3).max(255),
  taxId: z.string().trim().min(3).max(64),
  representativeName: z.string().trim().min(3).max(255),
  representativeDocument: z.string().trim().min(3).max(64),
  representativeTitle: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(5).max(50),
  notificationAddress: z.string().trim().min(5).max(500),
  domicile: z.string().trim().min(2).max(160),
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
  // Cubre despliegues donde la conexión de inicio todavía no estaba disponible
  // cuando se registró el servidor. La rutina es idempotente por instancia.
  await ensureContractDocumentStorage();
  await ensureInitialContractTemplate();
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

async function requireVerifiedContractOperatorProfile() {
  const status = getContractOperatorProfileStatus(await getPlatformSettings());
  if (!status.isVerified) {
    const details = status.missingFields.length
      ? ` Faltan: ${status.missingFields.join(", ")}.`
      : " Confirme nuevamente que los datos legales están vigentes.";
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Complete y confirme el perfil legal de Green House Project SAS antes de activar o emitir contratos.${details}`,
    });
  }
  return status.profile;
}

function decodeBase64(base64: string): Buffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > FILE_MAX_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "El archivo debe tener un tamaño entre 1 byte y 10 MB." });
  return buffer;
}

async function resolveTemplateSource(input: z.infer<typeof templateSourceInputSchema>): Promise<ContractTemplateSource> {
  try {
    return input.kind === "GOOGLE_DRIVE"
      ? await downloadGoogleContractTemplate(input.sourceUrl)
      : decodeContractTemplateUpload(input);
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible leer la fuente de la plantilla." });
  }
}

async function analyzeResolvedTemplateSource(source: ContractTemplateSource) {
  try {
    return await analyzeContractTemplateSource(source);
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible analizar la plantilla." });
  }
}

async function previewResolvedTemplateMapping(source: ContractTemplateSource, mappings: Record<string, string>) {
  const analysis = await analyzeResolvedTemplateSource(source);
  try {
    return { analysis, preview: await buildContractTemplateMappingPreview(source, analysis, mappings) };
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible validar el mapeo." });
  }
}

function mappedPdfMetadata(template: any): { sourceFormat: string | null; mappings: Record<string, string> } {
  const schema = template?.variableSchema && typeof template.variableSchema === "object" ? template.variableSchema : {};
  return {
    sourceFormat: typeof schema.sourceFormat === "string" ? schema.sourceFormat : null,
    mappings: schema.mappings && typeof schema.mappings === "object" ? schema.mappings : {},
  };
}

async function generateFrozenContractPdf(input: {
  template: any;
  contractNumber: string;
  contentHash: string;
  variables: Record<string, string>;
  contractHtml: string;
  ally: z.infer<typeof partySchema>;
  operator: z.infer<typeof partySchema>;
}): Promise<Buffer> {
  const metadata = mappedPdfMetadata(input.template);
  if (metadata.sourceFormat !== "PDF_ACROFORM") {
    return generateContractPdf({
      contractHtml: input.contractHtml,
      contractNumber: input.contractNumber,
      contentHash: input.contentHash,
      templateName: input.template.name,
      templateVersion: input.template.version,
    });
  }
  if (!input.template.sourceFileKey || !Object.keys(metadata.mappings).length) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La plantilla PDF no conserva su archivo fuente o el mapeo validado." });
  }
  const { url } = await storageGet(input.template.sourceFileKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible recuperar la plantilla PDF versionada." });
  const sourcePdf = Buffer.from(await response.arrayBuffer());
  if (sha256(sourcePdf) !== input.template.contentHash) {
    throw new TRPCError({ code: "CONFLICT", message: "La plantilla PDF almacenada no coincide con su hash de integridad." });
  }
  return buildMappedContractPdf({
    sourcePdf,
    mappings: metadata.mappings,
    values: input.variables,
    contractNumber: input.contractNumber,
    contentHash: input.contentHash,
    allyName: input.ally.legalName,
    allyRepresentative: input.ally.representativeName,
    allyDocument: input.ally.representativeDocument,
    operatorName: input.operator.legalName,
    operatorRepresentative: input.operator.representativeName,
    operatorDocument: input.operator.representativeDocument,
  });
}

export function requireValidContractTemplateMarkers(htmlContent: string): string[] {
  const analysis = analyzeContractTemplateMarkers(htmlContent);
  if (analysis.malformedMarkers.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `La plantilla contiene marcadores mal formados: ${analysis.malformedMarkers.join(", ")}. Use el formato {{VARIABLE}}.`,
    });
  }
  if (analysis.unknownMarkers.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `La plantilla contiene variables no permitidas: ${analysis.unknownMarkers.join(", ")}. Regístrelas primero en el catálogo contractual.`,
    });
  }
  if (!analysis.markers.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La plantilla debe incluir al menos un marcador dinámico con formato {{VARIABLE}}." });
  }
  return analysis.markers;
}

function buildValidatedContractDraft(input: Parameters<typeof buildContractDraft>[0]) {
  try {
    return buildContractDraft(input);
  } catch (error) {
    if (error instanceof UnresolvedContractVariablesError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
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
      const [templates, contractReferences] = await withContractDbRetry("listTemplates", () => Promise.all([
        db.select({
          id: contractTemplates.id, name: contractTemplates.name, version: contractTemplates.version, status: contractTemplates.status,
          sourceFilename: contractTemplates.sourceFilename, contentHash: contractTemplates.contentHash, legalReviewNote: contractTemplates.legalReviewNote,
          approvedAt: contractTemplates.approvedAt, createdAt: contractTemplates.createdAt, updatedAt: contractTemplates.updatedAt,
        }).from(contractTemplates).orderBy(desc(contractTemplates.createdAt)),
        db.select({ templateId: siteContracts.templateId }).from(siteContracts),
      ]));
      const contractCounts = contractReferences.reduce((counts, reference) => {
        counts.set(reference.templateId, (counts.get(reference.templateId) || 0) + 1);
        return counts;
      }, new Map<number, number>());
      return templates.map(template => {
        const contractCount = contractCounts.get(template.id) || 0;
        return { ...template, contractCount, ...getTemplateDeletionEligibility(template.status, contractCount) };
      });
    }),

    getTemplate: legalAdminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      const operatorProfile = getContractOperatorProfileStatus(await getPlatformSettings());
      let markerValidation = { valid: true, message: "Los marcadores de la plantilla son válidos." };
      try {
        requireValidContractTemplateMarkers(template.htmlContent);
      } catch (error) {
        markerValidation = { valid: false, message: error instanceof Error ? error.message : "La plantilla contiene marcadores inválidos." };
      }
      return { ...template, operatorProfile, markerValidation };
    }),

    getContractOperatorProfile: legalAdminProcedure.query(async () => {
      return getContractOperatorProfileStatus(await getPlatformSettings());
    }),

    saveContractOperatorProfile: legalAdminProcedure.input(z.object({
      profile: contractOperatorProfileSchema,
      confirmCurrent: z.literal(true),
    })).mutation(async ({ input, ctx }: any) => {
      const at = nowSql();
      await upsertPlatformSettings({
        contractOperatorLegalName: input.profile.legalName,
        contractOperatorTaxId: input.profile.taxId,
        contractOperatorRepresentativeName: input.profile.representativeName,
        contractOperatorRepresentativeDocument: input.profile.representativeDocument,
        contractOperatorRepresentativeTitle: input.profile.representativeTitle,
        contractOperatorEmail: input.profile.email,
        contractOperatorPhone: input.profile.phone,
        contractOperatorNotificationAddress: input.profile.notificationAddress,
        contractOperatorDomicile: input.profile.domicile,
        contractOperatorVerifiedAt: at,
        contractOperatorVerifiedBy: ctx.user.id,
        updatedBy: ctx.user.id,
      } as any);
      return getContractOperatorProfileStatus(await getPlatformSettings());
    }),

    analyzeTemplateSource: legalAdminProcedure.input(z.object({ source: templateSourceInputSchema })).mutation(async ({ input }: any) => {
      const source = await resolveTemplateSource(input.source);
      const analysis = await analyzeResolvedTemplateSource(source);
      return {
        filename: source.filename,
        sourceOrigin: source.origin,
        sourceFormat: analysis.sourceFormat,
        contentType: source.contentType,
        sourceHash: analysis.sourceHash,
        pageCount: analysis.pageCount,
        markers: analysis.markers,
        warnings: analysis.warnings,
        catalog: CONTRACT_VARIABLE_CATALOG,
      };
    }),

    previewTemplateMapping: legalAdminProcedure.input(z.object({
      source: templateSourceInputSchema,
      expectedSourceHash: z.string().length(64),
      mappings: markerMappingsSchema,
    })).mutation(async ({ input }: any) => {
      const source = await resolveTemplateSource(input.source);
      const { analysis, preview } = await previewResolvedTemplateMapping(source, input.mappings);
      if (analysis.sourceHash !== input.expectedSourceHash) {
        throw new TRPCError({ code: "CONFLICT", message: "La fuente cambió después del análisis. Analícela nuevamente antes de guardar." });
      }
      return {
        sourceFormat: analysis.sourceFormat,
        variables: preview.variables,
        previewHtml: preview.previewHtml,
        previewPdfBase64: preview.previewPdfBase64,
        fingerprint: mappingFingerprint(analysis.sourceHash, input.mappings),
      };
    }),

    createTemplateFromMappedSource: legalAdminProcedure.input(z.object({
      name: z.string().trim().min(3).max(255),
      version: z.string().trim().min(1).max(64),
      source: templateSourceInputSchema,
      expectedSourceHash: z.string().length(64),
      previewFingerprint: z.string().length(64),
      mappings: markerMappingsSchema,
    })).mutation(async ({ input, ctx }: any) => {
      const source = await resolveTemplateSource(input.source);
      const { analysis, preview } = await previewResolvedTemplateMapping(source, input.mappings);
      if (analysis.sourceHash !== input.expectedSourceHash) {
        throw new TRPCError({ code: "CONFLICT", message: "La fuente cambió después del análisis. Analícela nuevamente." });
      }
      const fingerprint = mappingFingerprint(analysis.sourceHash, input.mappings);
      if (fingerprint !== input.previewFingerprint) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Revise nuevamente la vista previa después de cambiar el mapeo." });
      }
      const htmlContent = preview.normalizedHtml
        ? sanitizeContractHtml(preview.normalizedHtml).trim()
        : `<section data-contract-template-format="PDF_ACROFORM">${preview.variables.map(variable => `<span>{{${variable}}}</span>`).join("")}</section>`;
      requireValidContractTemplateMarkers(htmlContent);
      const db = await getContractsDb();
      const [duplicate] = await db.select({ id: contractTemplates.id, name: contractTemplates.name, version: contractTemplates.version })
        .from(contractTemplates).where(eq(contractTemplates.contentHash, analysis.sourceHash)).limit(1);
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: `Este mismo documento ya está registrado como ${duplicate.name} v${duplicate.version}. Revise esa versión en lugar de cargar un duplicado.` });
      }
      const key = `contracts/templates/${crypto.randomBytes(10).toString("hex")}-${safeFilename(source.filename)}`;
      const uploaded = await storagePut(key, source.buffer, source.contentType);
      const [result] = await withContractDbRetry("createTemplateFromMappedSource", () => db.insert(contractTemplates).values({
        name: input.name,
        version: input.version,
        sourceFilename: source.filename,
        sourceMimeType: source.contentType,
        sourceFileUrl: uploaded.url,
        sourceFileKey: uploaded.key,
        htmlContent,
        variableSchema: {
          variables: preview.variables,
          required: preview.variables,
          sourceFormat: analysis.sourceFormat,
          sourceOrigin: source.origin,
          sourceUrl: source.sourceUrl || null,
          mappings: input.mappings,
          mappingFingerprint: fingerprint,
        },
        contentHash: analysis.sourceHash,
        createdBy: ctx.user.id,
      }));
      return { success: true, templateId: result.insertId, sourceFormat: analysis.sourceFormat, variables: preview.variables, conversionWarnings: analysis.warnings };
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
      const variables = requireValidContractTemplateMarkers(htmlContent);
      const sourceHash = sha256(source);
      const db = await getContractsDb();
      const [duplicate] = await db.select({ id: contractTemplates.id, name: contractTemplates.name, version: contractTemplates.version })
        .from(contractTemplates)
        .where(eq(contractTemplates.contentHash, sourceHash))
        .limit(1);
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Este mismo documento ya está registrado como ${duplicate.name} v${duplicate.version}. Revise esa versión en lugar de cargar un duplicado.`,
        });
      }
      const key = `contracts/templates/${crypto.randomBytes(10).toString("hex")}-${safeFilename(input.filename)}`;
      const uploaded = await storagePut(key, source, input.contentType);
      const [result] = await withContractDbRetry("createTemplateFromDocx", () => db.insert(contractTemplates).values({
        name: input.name, version: input.version, sourceFilename: input.filename, sourceMimeType: input.contentType,
        sourceFileUrl: uploaded.url, sourceFileKey: uploaded.key, htmlContent,
        variableSchema: { variables, required: variables }, contentHash: sourceHash, createdBy: ctx.user.id,
      }));
      return { success: true, templateId: result.insertId, conversionWarnings: converted.messages.map(message => message.message) };
    }),

    deleteDraftTemplate: legalAdminProcedure.input(z.object({
      id: z.number().int().positive(),
      confirmVersion: z.string().trim().min(1).max(64),
    })).mutation(async ({ input }: any) => {
      const db = await getContractsDb();
      const [template] = await db.select({
        id: contractTemplates.id,
        version: contractTemplates.version,
        status: contractTemplates.status,
      }).from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      if (template.version !== input.confirmVersion) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La versión de confirmación no coincide con la plantilla seleccionada." });
      }
      const references = await db.select({ id: siteContracts.id })
        .from(siteContracts)
        .where(eq(siteContracts.templateId, input.id));
      const eligibility = getTemplateDeletionEligibility(template.status, references.length);
      if (!eligibility.canDelete) {
        throw new TRPCError({ code: "CONFLICT", message: eligibility.deletionBlockReason });
      }
      const [deletionResult]: any = await withContractDbRetry("deleteDraftTemplate", () => db.delete(contractTemplates)
        .where(and(eq(contractTemplates.id, input.id), eq(contractTemplates.status, "DRAFT"))));
      if (Number(deletionResult?.affectedRows || 0) !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "La plantilla cambió mientras se procesaba la eliminación. Actualice el listado e inténtelo nuevamente." });
      }
      return { success: true, deletedTemplateId: input.id };
    }),

    updateDraftTemplate: legalAdminProcedure.input(z.object({
      id: z.number().int().positive(), htmlContent: z.string().trim().min(100).max(900000), legalReviewNote: z.string().trim().max(5000).optional(),
    })).mutation(async ({ input }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select({
        status: contractTemplates.status,
        variableSchema: contractTemplates.variableSchema,
      }).from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      if (template.status !== "DRAFT") throw new TRPCError({ code: "CONFLICT", message: "Solo se puede editar una plantilla en borrador. Cree una versión nueva para cambiar condiciones futuras." });
      const htmlContent = sanitizeContractHtml(input.htmlContent);
      const variables = requireValidContractTemplateMarkers(htmlContent);
      await db.update(contractTemplates).set({
        htmlContent,
        variableSchema: {
          ...mergeTemplateVariableSchema(template.variableSchema, variables),
          normalizedHtmlHash: sha256(htmlContent),
        },
        legalReviewNote: input.legalReviewNote || null,
      }).where(eq(contractTemplates.id, input.id));
      return { success: true };
    }),

    activateTemplate: legalAdminProcedure.input(z.object({
      id: z.number().int().positive(),
      htmlContent: z.string().trim().min(100).max(900000),
      legalReviewNote: z.string().trim().min(20).max(5000),
    })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [template] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, input.id)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Plantilla no encontrada." });
      if (template.status !== "DRAFT") throw new TRPCError({ code: "CONFLICT", message: "Solo una plantilla en borrador puede activarse. Cree una nueva versión si necesita cambios." });
      await requireVerifiedContractOperatorProfile();
      const htmlContent = sanitizeContractHtml(input.htmlContent);
      const variables = requireValidContractTemplateMarkers(htmlContent);
      const at = nowSql();
      await db.transaction(async (tx: any) => {
        await tx.update(contractTemplates).set({ status: "RETIRED", retiredBy: ctx.user.id, retiredAt: at }).where(and(eq(contractTemplates.name, template.name), eq(contractTemplates.status, "ACTIVE")));
        const [activationResult]: any = await tx.update(contractTemplates).set({
          status: "ACTIVE",
          htmlContent,
          variableSchema: {
            ...mergeTemplateVariableSchema(template.variableSchema, variables),
            normalizedHtmlHash: sha256(htmlContent),
          },
          legalReviewNote: input.legalReviewNote,
          approvedBy: ctx.user.id,
          approvedAt: at,
        }).where(and(eq(contractTemplates.id, input.id), eq(contractTemplates.status, "DRAFT")));
        if (Number(activationResult?.affectedRows || 0) !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "La plantilla cambió durante la activación. Actualice el listado e inténtelo de nuevo." });
        }
      });
      return { success: true };
    }),

    listEligibleSpaces: legalAdminProcedure.query(async () => {
      const db = (await getDb())!;
      const [formalizedSpaces, existingContracts] = await Promise.all([
        db.select({
          id: spaceSubmissions.id, code: spaceSubmissions.code, spaceName: spaceSubmissions.spaceName, spaceStatus: spaceSubmissions.spaceStatus,
          submitterName: spaceSubmissions.submitterName, submitterCompany: spaceSubmissions.submitterCompany, submitterEmail: spaceSubmissions.submitterEmail,
          submitterPhone: spaceSubmissions.submitterPhone, submitterDocument: spaceSubmissions.submitterDocument,
          letterSignerName: spaceSubmissions.letterSignerName, letterSignerDocument: spaceSubmissions.letterSignerDocument, address: spaceSubmissions.address,
          city: spaceSubmissions.city, department: spaceSubmissions.department, country: spaceSubmissions.country, availableAreaM2: spaceSubmissions.availableAreaM2,
          parkingSpots: spaceSubmissions.parkingSpots, letterAcceptedAt: spaceSubmissions.letterAcceptedAt,
          manualFormalizedAt: spaceSubmissions.manualFormalizedAt,
        }).from(spaceSubmissions).where(or(isNotNull(spaceSubmissions.letterAcceptedAt), isNotNull(spaceSubmissions.manualFormalizedAt))),
        db.select({
          id: siteContracts.id,
          submissionId: siteContracts.submissionId,
          contractNumber: siteContracts.contractNumber,
          status: siteContracts.status,
          updatedAt: siteContracts.updatedAt,
        }).from(siteContracts).where(ne(siteContracts.status, "CANCELLED")).orderBy(desc(siteContracts.updatedAt)),
      ]);
      const contractBySubmission = new Map<number, { id: number; contractNumber: string; status: string }>();
      existingContracts.forEach(contract => {
        if (!contractBySubmission.has(contract.submissionId)) contractBySubmission.set(contract.submissionId, contract);
      });
      return formalizedSpaces
        .map(space => ({ ...space, allyPrefill: getContractAllyPrefill(space), ...getContractSpaceEligibility(space, contractBySubmission.get(space.id) || null) }))
        .sort((left, right) => new Date(right.formalizedAt || 0).getTime() - new Date(left.formalizedAt || 0).getTime());
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

    previewContractPdf: legalAdminProcedure.input(z.object({
      submissionId: z.number().int().positive(), templateId: z.number().int().positive(), variables: z.record(z.string(), z.string().max(1000)),
      ally: partyInputSchema, operator: partySchema.optional(),
    })).mutation(async ({ input }: any) => {
      const db = await getContractsDb();
      const [[space], [template]] = await Promise.all([
        db.select().from(spaceSubmissions).where(eq(spaceSubmissions.id, input.submissionId)).limit(1),
        db.select().from(contractTemplates).where(eq(contractTemplates.id, input.templateId)).limit(1),
      ]);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado." });
      const eligibility = getContractSpaceEligibility(space);
      if (!eligibility.isFormalized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: eligibility.eligibilityReason });
      if (!template || template.status === "RETIRED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seleccione una plantilla en borrador o activa." });
      requireValidContractTemplateMarkers(template.htmlContent);
      const ally = requireValidContractAlly(input.ally, space);
      const operatorStatus = getContractOperatorProfileStatus(await getPlatformSettings());
      const operator = operatorStatus.isComplete ? operatorStatus.profile : input.operator;
      if (!operator) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Complete el perfil legal del operador para generar la vista previa. Faltan: ${operatorStatus.missingFields.join(", ")}.` });
      const number = `EVG-PREV-${new Date().getUTCFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const draft = buildValidatedContractDraft({
        contractNumber: number,
        templateVersion: template.version,
        templateHtml: template.htmlContent,
        variables: input.variables,
        ally,
        operator,
        space,
      });
      const pdfBuffer = await generateFrozenContractPdf({ template, contractNumber: number, contentHash: draft.contentHash, variables: draft.variables, contractHtml: draft.contractHtml, ally, operator });
      return { success: true, contractNumber: number, contentHash: draft.contentHash, templateVersion: template.version, pdfBase64: pdfBuffer.toString("base64") };
    }),

    createContract: legalAdminProcedure.input(z.object({
      submissionId: z.number().int().positive(), templateId: z.number().int().positive(), variables: z.record(z.string(), z.string().max(1000)),
      ally: partyInputSchema, operator: partySchema.optional(), expiresAt: z.string().datetime().optional(),
    })).mutation(async ({ input, ctx }: any) => {
      const db = (await getDb())!;
      const [[space], [template], existingContracts] = await Promise.all([
        db.select().from(spaceSubmissions).where(eq(spaceSubmissions.id, input.submissionId)).limit(1),
        db.select().from(contractTemplates).where(eq(contractTemplates.id, input.templateId)).limit(1),
        db.select({ id: siteContracts.id, contractNumber: siteContracts.contractNumber, status: siteContracts.status })
          .from(siteContracts)
          .where(and(eq(siteContracts.submissionId, input.submissionId), ne(siteContracts.status, "CANCELLED")))
          .orderBy(desc(siteContracts.updatedAt))
          .limit(1),
      ]);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado." });
      const eligibility = getContractSpaceEligibility(space, existingContracts[0] || null);
      if (!eligibility.isFormalized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: eligibility.eligibilityReason });
      if (!eligibility.canCreateContract) throw new TRPCError({ code: "CONFLICT", message: eligibility.eligibilityReason });
      if (!template || template.status !== "ACTIVE") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seleccione una plantilla contractual activa y aprobada." });
      const operator = await requireVerifiedContractOperatorProfile();
      const ally = requireValidContractAlly(input.ally, space);
      const number = contractNumber();
      requireValidContractTemplateMarkers(template.htmlContent);
      const draft = buildValidatedContractDraft({
        contractNumber: number,
        templateVersion: template.version,
        templateHtml: template.htmlContent,
        variables: input.variables,
        ally,
        operator,
        space,
      });
      const pdfBuffer = await generateFrozenContractPdf({ template, contractNumber: number, contentHash: draft.contentHash, variables: draft.variables, contractHtml: draft.contractHtml, ally, operator });
      const pdfUpload = await storagePut(`contracts/drafts/${number}-${draft.contentHash.slice(0, 12)}.pdf`, pdfBuffer, "application/pdf");
      const [result] = await db.insert(siteContracts).values({
        contractNumber: number, submissionId: space.id, templateId: template.id, templateName: template.name, templateVersion: template.version,
        status: "READY", variablesSnapshot: draft.variables, contractHtml: draft.contractHtml, contentHash: draft.contentHash, draftPdfUrl: pdfUpload.url, draftPdfKey: pdfUpload.key,
        expiresAt: input.expiresAt ? input.expiresAt.slice(0, 19).replace("T", " ") : null, createdBy: ctx.user.id,
      });
      const id = result.insertId;
      await db.insert(siteContractParties).values([
        { contractId: id, role: "ALLY", ...ally, signingOrder: 1 },
        { contractId: id, role: "OPERATOR", ...operator, signingOrder: 2 },
      ]);
      await recordContractEvent(db, { contractId: id, eventType: "CONTRACT_CREATED", ctx, details: { templateId: template.id, templateVersion: template.version, contentHash: draft.contentHash, variableKeys: Object.keys(draft.variables) } });
      return { success: true, contractId: id, contractNumber: number, pdfUrl: pdfUpload.url, contentHash: draft.contentHash };
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
