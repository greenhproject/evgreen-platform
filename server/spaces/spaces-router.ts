/**
 * EVGreen - Router de Postulación de Espacios para Cargadores
 * Permite a cualquier persona postular su espacio, y a admins validar, enviar carta de intención,
 * generar scoring IA, y publicar en el muro de crowdfunding.
 * @author Green House Project
 */
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getPlatformSettings } from "../db";
import { getResendClient } from "../email/resend-client";
import { buildCrowdfundingProjectInheritanceUpdate, getCrowdfundingInheritanceSnapshot } from "./crowdfunding-inheritance";
import {
  spaceSubmissions,
  spacePhotos,
  crowdfundingProjects,
  investorLeads,
  letterEmailEvents,
  spaceStatusHistory,
  spaceSolarScopeHistory,
} from "../../drizzle/schema";
import { eq, desc, and, sql, like, or, inArray, count, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { storagePut } from "../storage";
import { scoreSpaceInvestment } from "./space-ai-scoring";
import { buildEmailParams } from "../utils/email-helper";
import { optionalFormInteger, optionalFormNumber, optionalLocalizedDecimalString } from "./space-input-normalization";
import { canManageCommercialPipeline, canManageSpaceAdministration } from "./pipeline-access";
import { startOfDayInTz, endOfDayInTz } from "../utils/timezone";
import { assertCommercialTransition, type SpacePipelineStatus } from "./pipeline-transitions";
import {
  buildCrowdfundingProjectionSnapshot,
  type CrowdfundingProjectionSnapshot,
} from "../../shared/crowdfunding-financial-projection";
import {
  buildSpaceTrafficProjection,
  type SpaceTrafficProjectionSnapshot,
} from "../../shared/space-traffic-financial-projection";
import {
  assertProspectoFinancialScenarioIsDocumented,
  resolveProspectoTechnicalCondition,
} from "../../shared/prospecto-financial-scenario";
import { buildProspectoGridUpgradeNote } from "./prospecto-grid-upgrade-note";
import { getRevenueDistributionForSpaceType } from "../../shared/space-investment-scoring-policy";
import { buildAllySolarProgram } from "../../shared/ally-solar-program";

// ============================================================================
// ROLE GUARDS
// ============================================================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!canManageSpaceAdministration(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de administrador." });
  }
  return next({ ctx });
});

/** Permite el seguimiento comercial sin abrir privilegios de administración masiva. */
const commercialPipelineProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!canManageCommercialPipeline(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para gestionar el pipeline comercial." });
  }
  return next({ ctx });
});

// ============================================================================
// HELPERS
// ============================================================================

async function getDatabase() {
  const db = (await getDb())!;
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
  return db;
}

function safePdfSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "espacio";
}

/**
 * Genera únicamente la ficha técnica/comercial del aliado.
 * El objeto enviado al servicio PDF se construye de forma explícita para
 * impedir que CAPEX, ROI, payback, waterfall o participaciones financieras
 * lleguen accidentalmente al documento destinado al propietario del espacio.
 */
async function generateAllySpacePdfForSubmission(submissionId: number) {
  const db = await getDatabase();
  const [submission] = await db.select().from(spaceSubmissions)
    .where(eq(spaceSubmissions.id, submissionId))
    .limit(1);

  if (!submission) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado" });
  }

  const photos = await db.select().from(spacePhotos)
    .where(eq(spacePhotos.submissionId, submissionId))
    .orderBy(desc(spacePhotos.isCover), spacePhotos.sortOrder);
  const platformSettings = await getPlatformSettings();

  const { generateAllySpacePdf } = await import("./ally-space-pdf-service");
  const pdfBuffer = await generateAllySpacePdf({
    code: submission.code,
    spaceName: submission.spaceName,
    spaceType: submission.spaceType,
    spaceTypeOther: submission.spaceTypeOther,
    address: submission.address,
    city: submission.city,
    department: submission.department,
    country: submission.country,
    latitude: submission.latitude === null ? null : Number(submission.latitude),
    longitude: submission.longitude === null ? null : Number(submission.longitude),
    status: submission.spaceStatus,
    submitterName: submission.submitterName,
    submitterCompany: submission.submitterCompany,
    availableAreaM2: submission.availableAreaM2 ? Number(submission.availableAreaM2) : null,
    parkingSpots: submission.parkingSpots,
    transformerCapacityKva: submission.transformerCapacityKva ? Number(submission.transformerCapacityKva) : null,
    hasElectricalPanel: Boolean(submission.hasElectricalPanel),
    hasSolarPanels: Boolean(submission.hasSolarPanels),
    electricalDistance: submission.electricalDistance,
    hasInternet: Boolean(submission.hasInternet),
    operatingHoursStart: submission.operatingHoursStart,
    operatingHoursEnd: submission.operatingHoursEnd,
    is24Hours: Boolean(submission.is24Hours),
    operatingHoursPerDay: resolveSpaceOperatingHours({
      operatingHoursStart: submission.operatingHoursStart,
      operatingHoursEnd: submission.operatingHoursEnd,
      is24Hours: submission.is24Hours,
    }),
    estimatedDailyVehicles: submission.estimatedDailyVehicles,
    estimatedEvPercent: submission.estimatedEvPercent,
    nearbyAttractions: submission.nearbyAttractions,
    socioeconomicStratum: submission.socioeconomicStratum,
    electricalViability: submission.electricalViability,
    estimatedPowerKw: submission.estimatedPowerKw,
    estimatedChargerCount: submission.estimatedChargerCount,
    recommendedChargerType: submission.recommendedChargerType,
    salePricePerKwh: Number(platformSettings?.precioVentaDefault ?? 1800),
    energyCostPerKwh: Number(platformSettings?.costoEnergiaRed ?? 850),
    efficiencyPercent: Number(platformSettings?.eficienciaCargaDc ?? 92),
    allySharePercent: Number((platformSettings as any)?.hostSharePercent ?? 10),
    solarCoveragePercent: submission.solarCoveragePercent === null ? null : Number(submission.solarCoveragePercent),
    solarEnergyCostPerKwh: submission.solarEnergyCostPerKwh === null ? null : Number(submission.solarEnergyCostPerKwh),
    solarProgramEnabled: Number(submission.solarProgramEnabled) === 1,
    solarProgramCurrentBillCop: submission.solarProgramCurrentBillCop === null ? null : Number(submission.solarProgramCurrentBillCop),
    solarProgramSavingsCoveragePercent: submission.solarProgramSavingsCoveragePercent === null ? null : Number(submission.solarProgramSavingsCoveragePercent),
    solarProgramAgreementYears: submission.solarProgramAgreementYears,
    solarProgramAnnualCpiPercent: submission.solarProgramAnnualCpiPercent === null ? null : Number(submission.solarProgramAnnualCpiPercent),
    solarProgramUsefulLifeYears: submission.solarProgramUsefulLifeYears,
    solarSystemPowerKwp: submission.solarSystemPowerKwp === null ? null : Number(submission.solarSystemPowerKwp),
    solarAnnualGenerationKwh: submission.solarAnnualGenerationKwh === null ? null : Number(submission.solarAnnualGenerationKwh),
    solarSelfConsumptionPercent: submission.solarSelfConsumptionPercent === null ? null : Number(submission.solarSelfConsumptionPercent),
    solarExportPercent: submission.solarExportPercent === null ? null : Number(submission.solarExportPercent),
    solarGridTariffCopPerKwh: submission.solarGridTariffCopPerKwh,
    solarOfferPdfUrl: submission.solarOfferPdfUrl,
    solarOfferPdfName: submission.solarOfferPdfName,
    photos: photos.map(photo => ({
      url: photo.photoUrl,
      type: photo.photoType,
      caption: photo.caption,
      isCover: Boolean(photo.isCover),
      isConceptual: Boolean(photo.isConceptual),
    })),
    generatedAt: new Date(),
  });

  const randomSuffix = randomBytes(8).toString("hex");
  const fileName = `Ficha-Aliado-${submission.code}-${safePdfSegment(submission.spaceName)}.pdf`;
  const fileKey = `spaces/fichas-aliados/${submission.code}-${randomSuffix}.pdf`;
  const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");
  console.log(`[Spaces] Ficha PDF del aliado generada para ${submission.code}`);
  return { success: true as const, pdfUrl, fileName };
}

function toSqlTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Limita el ROI para que nunca desborde el campo DECIMAL(7,2) en base de datos (-99999.99 a 99999.99) */
function sanitizeProjectionRoi(roiAnnualPercent: number | undefined | null): string | null {
  if (roiAnnualPercent === undefined || roiAnnualPercent === null || !Number.isFinite(roiAnnualPercent) || roiAnnualPercent <= 0) {
    return null;
  }
  const bounded = Math.min(roiAnnualPercent, 99999.99);
  return bounded.toFixed(2);
}

function sanitizeProjectionPayback(paybackMonths: number | undefined | null): number | null {
  if (paybackMonths === undefined || paybackMonths === null || !Number.isFinite(paybackMonths) || paybackMonths <= 0) {
    return null;
  }
  return Math.max(1, Math.round(paybackMonths));
}

function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function resolveSpaceOperatingHours(input: {
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  is24Hours?: boolean | number | null;
}): number {
  if (Boolean(input.is24Hours)) return 24;
  const toMinutes = (value: string | null | undefined) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = toMinutes(input.operatingHoursStart);
  const end = toMinutes(input.operatingHoursEnd);
  if (start === null || end === null) return 16;
  const duration = end > start ? end - start : (24 * 60 - start) + end;
  return duration > 0 ? duration / 60 : 16;
}

type FinancialProjectionSnapshot = CrowdfundingProjectionSnapshot | SpaceTrafficProjectionSnapshot;

function parseProjectionSnapshot(value: unknown): FinancialProjectionSnapshot | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as FinancialProjectionSnapshot;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as FinancialProjectionSnapshot : null;
}

async function buildSpaceCrowdfundingProjection(input: {
  investmentCop: number;
  totalPowerKw: number;
  spaceType?: string | null;
  estimatedDailyVehicles?: number | null;
  estimatedEvPercent?: number | null;
  chargerCount?: number | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  is24Hours?: boolean | number | null;
  hasSolarPanels?: boolean | number | null;
  solarCoveragePercent?: number | null;
  solarEnergyCostPerKwh?: number | null;
  currentProject?: any;
}) {
  if (input.investmentCop <= 0 || input.totalPowerKw <= 0) return null;

  const settings = await getPlatformSettings();
  const stored = parseProjectionSnapshot(input.currentProject?.financialProjectionSnapshot);
  const distribution = getRevenueDistributionForSpaceType(input.spaceType);
  const investorSharePercent = Number(
    distribution.investorSharePercent,
  );
  const evgreenSharePercent = Number(
    distribution.evgreenSharePercent,
  );
  const selectedScenario = stored?.selectedScenario ?? "REALISTIC";
  const salePricePerKwh = Number(stored?.assumptions.salePricePerKwh ?? settings?.precioVentaDefault ?? 1800);
  const energyCostPerKwh = Number(
    input.currentProject?.energyPurchaseCostPerKwh
      ?? stored?.assumptions.energyCostPerKwh
      ?? settings?.costoEnergiaRed
      ?? 850,
  );
  const hostSharePercent = Number(
    input.currentProject?.hostSharePercent
      ?? stored?.assumptions.hostSharePercent
      ?? 10,
  );
  const fixedMonthlyExpenses = Number(stored?.assumptions.fixedMonthlyExpenses ?? 0);
  const efficiencyPercent = Number(
    stored?.basis === "EVGREEN_CROWDFUNDING_SCENARIOS"
      ? stored.assumptions.efficiencyPercent
      : settings?.eficienciaCargaDc ?? 92,
  );
  const estimatedDailyVehicles = firstPositiveNumber(input.estimatedDailyVehicles);
  const estimatedEvPercent = firstPositiveNumber(input.estimatedEvPercent);
  const chargerCount = firstPositiveNumber(input.chargerCount, input.currentProject?.chargerCount, 1)!;

  // Con tráfico y adopción EV declarados, el espacio usa el modelo canónico
  // de demanda capturable. La infraestructura limita por capacidad física,
  // pero nunca inventa sesiones que el flujo no justifique.
  if (estimatedDailyVehicles && estimatedEvPercent) {
    const snapshot = buildSpaceTrafficProjection({
      investmentCop: input.investmentCop,
      estimatedDailyVehicles,
      estimatedEvPercent,
      chargerCount,
      totalPowerKw: input.totalPowerKw,
      operatingHoursPerDay: resolveSpaceOperatingHours(input),
      efficiencyPercent,
      hasSolarPanels: input.hasSolarPanels,
      solarCoveragePercent: input.solarCoveragePercent,
      solarEnergyCostPerKwh: input.solarEnergyCostPerKwh,
      spaceType: input.spaceType,
      salePricePerKwh,
      energyCostPerKwh,
      hostSharePercent,
      fixedMonthlyExpenses,
    }, selectedScenario);
    return {
      snapshot,
      selected: snapshot.scenarios[snapshot.selectedScenario],
      selectedScenario,
      investorSharePercent: snapshot.assumptions.investorSharePercent,
      evgreenSharePercent: snapshot.assumptions.evgreenSharePercent,
    };
  }

  const snapshot = buildCrowdfundingProjectionSnapshot({
    investmentCop: input.investmentCop,
    totalPowerKw: input.totalPowerKw,
    salePricePerKwh,
    energyCostPerKwh,
    hostSharePercent,
    investorSharePercent,
    evgreenSharePercent,
    efficiencyPercent,
    fixedMonthlyExpenses,
  }, selectedScenario);
  const selected = snapshot.scenarios[snapshot.selectedScenario];

  return {
    snapshot,
    selected,
    selectedScenario,
    investorSharePercent,
    evgreenSharePercent,
  };
}

async function recordSpaceStatusChange(
  db: any,
  input: {
    submissionId: number;
    fromStatus: SpacePipelineStatus;
    toStatus: SpacePipelineStatus;
    changedById?: number | null;
    changedByRole?: string | null;
    note?: string | null;
  },
) {
  if (input.fromStatus === input.toStatus) return;
  await db.insert(spaceStatusHistory).values({
    ...input,
    changedById: input.changedById ?? null,
    changedByRole: input.changedByRole ?? null,
    note: input.note?.trim() || null,
    createdAt: toSqlTimestamp(),
  } as any);
}

export async function generateSubmissionCode(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SPE-${year}-`;

  const submissions = await db
    .select({ code: spaceSubmissions.code })
    .from(spaceSubmissions)
    .where(like(spaceSubmissions.code, `${prefix}%`));

  // Ignorar códigos legados inválidos o fuera del formato oficial y elegir el
  // primer consecutivo libre de cuatro dígitos. Esto evita que valores anómalos
  // como SPE-2026-0NaN o SPE-2026-764057 rompan futuras postulaciones.
  const usedCodes = new Set(submissions.flatMap((submission: any) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(submission.code ?? "");
    const value = match ? Number.parseInt(match[1], 10) : NaN;
    return Number.isInteger(value) && value >= 1 && value <= 9999 && match?.[1].length === 4 ? [value] : [];
  }));
  let nextNum = 1;
  while (usedCodes.has(nextNum) && nextNum <= 9999) nextNum++;
  if (nextNum > 9999) {
    throw new TRPCError({ code: "CONFLICT", message: "Se agotó la numeración anual de postulaciones de espacios." });
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

function isSubmissionCodeCollision(error: unknown): boolean {
  let current: any = error;
  for (let depth = 0; current && depth < 3; depth++, current = current.cause) {
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes("space_submissions_code_unique") || message.includes("Duplicate entry") || current?.code === "ER_DUP_ENTRY") return true;
  }
  return false;
}

export async function insertSubmissionWithCodeRetry(db: any, buildValues: (code: string) => Record<string, unknown>, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = await generateSubmissionCode(db);
    try {
      const [result] = await db.insert(spaceSubmissions).values(buildValues(code));
      return { code, result };
    } catch (error) {
      if (!isSubmissionCodeCollision(error) || attempt === maxAttempts - 1) throw error;
    }
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo asignar un código de postulación." });
}

export function generateLetterToken(): string {
  return randomBytes(32).toString("hex");
}

// ============================================================================
// SPACE TYPE LABELS (para UI y emails)
// ============================================================================

const SPACE_TYPE_LABELS: Record<string, string> = {
  parking: "Parqueadero público",
  mall: "Centro comercial",
  gas_station: "Estación de servicio",
  hotel: "Hotel / hospedaje",
  restaurant: "Restaurante",
  office_building: "Edificio de oficinas",
  residential: "Conjunto residencial",
  supermarket: "Supermercado",
  hospital: "Hospital / clínica",
  university: "Universidad / institución educativa",
  airport: "Aeropuerto",
  highway_rest: "Parador en carretera",
  other: "Otro",
};

export function getSpaceTypeLabel(spaceType: string | null | undefined) {
  return SPACE_TYPE_LABELS[spaceType ?? ""] ?? spaceType ?? "Espacio";
}

const LETTER_ACCEPTANCE_BASE_URL = "https://app.evgreen.lat";

function getLetterAcceptanceUrl(letterToken: string) {
  return `${LETTER_ACCEPTANCE_BASE_URL}/carta-intencion/${letterToken}`;
}

export function getLetterShareLinkData(submission: { spaceStatus: string; letterToken: string | null; submitterName: string; spaceName: string }) {
  if (submission.spaceStatus !== "letter_sent" || !submission.letterToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El enlace alterno solo está disponible para cartas enviadas y pendientes de firma." });
  }
  return {
    acceptUrl: getLetterAcceptanceUrl(submission.letterToken),
    recipientName: submission.submitterName,
    spaceName: submission.spaceName,
  };
}

export function getRotatedLetterShareLinkData(submission: { spaceStatus: string; letterToken: string | null; submitterName: string; spaceName: string }, nextToken: string) {
  getLetterShareLinkData(submission);
  if (!nextToken || nextToken === submission.letterToken) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo rotar el enlace de firma." });
  }
  return { acceptUrl: getLetterAcceptanceUrl(nextToken), revokedPreviousLink: true };
}

export function buildLetterDispatchUpdate(letterToken: string, providerEmailId: string | null | undefined, now = new Date()) {
  const timestamp = now.toISOString().slice(0, 19).replace("T", " ");
  return {
    spaceStatus: "letter_sent" as const,
    letterToken,
    letterSentAt: timestamp,
    letterEmailId: providerEmailId ?? null,
    letterDeliveryStatus: "SENT" as const,
    letterDeliveryUpdatedAt: timestamp,
  };
}

/**
 * Autoriza una publicación excepcional sin alterar los datos de firma externa.
 * La excepción solo aplica a una carta enviada que sigue pendiente de firma y
 * exige una justificación de negocio que queda registrada en la postulación.
 */
export function getCrowdfundingPublicationDecision(
  spaceStatus: string,
  manualFormalizationReason?: string,
  manualFormalizationEvidence?: string,
) {
  if (spaceStatus === "letter_accepted" || spaceStatus === "approved") {
    return { isManualFormalization: false, reason: null as string | null, evidence: null as string | null };
  }

  if (spaceStatus === "letter_sent") {
    const reason = manualFormalizationReason?.trim() ?? "";
    const evidence = manualFormalizationEvidence?.trim() ?? "";
    if (reason.length < 15) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Para formalizar internamente se requiere un motivo de al menos 15 caracteres.",
      });
    }
    if (evidence.length < 5) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Para formalizar internamente se requiere evidencia o referencia de aprobación.",
      });
    }
    return { isManualFormalization: true, reason, evidence };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Solo se pueden publicar espacios aprobados, con carta aceptada o cartas enviadas formalizadas excepcionalmente.",
  });
}

// ============================================================================
// SPACES ROUTER
// ============================================================================

export const spacesRouter = router({
  // ========================================================================
  // PÚBLICO: Crear postulación de espacio
  // ========================================================================
  submit: publicProcedure
    .input(z.object({
      // Datos del postulante
      submitterName: z.string().min(2, "El nombre es requerido"),
      submitterEmail: z.string().email("Email inválido"),
      submitterPhone: z.string().min(7, "Teléfono inválido"),
      submitterCompany: z.string().optional(),
      submitterDocument: z.string().optional(),

      // Datos del espacio
      spaceName: z.string().min(2, "El nombre del espacio es requerido"),
      spaceType: z.enum([
        "parking", "mall", "gas_station", "hotel", "restaurant",
        "office_building", "residential", "supermarket", "hospital",
        "university", "airport", "highway_rest", "other",
      ]),
      spaceTypeOther: z.string().optional(),
      address: z.string().min(5, "La dirección es requerida"),
      city: z.string().min(2, "La ciudad es requerida"),
      department: z.string().optional(),
      latitude: optionalLocalizedDecimalString(),
      longitude: optionalLocalizedDecimalString(),

      // Características técnicas
      availableAreaM2: optionalLocalizedDecimalString(),
      parkingSpots: optionalFormInteger(),
      transformerCapacityKva: optionalLocalizedDecimalString(),
      hasElectricalPanel: z.boolean().optional(),
      hasSolarPanels: z.boolean().optional(),
      solarCoveragePercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La cobertura solar debe estar entre 0 % y 100 %"),
      solarEnergyCostPerKwh: optionalFormInteger().refine((value) => value === undefined || value >= 0, "El costo solar por kWh no puede ser negativo"),
      solarProgramEnabled: z.boolean().optional(),
      solarProgramCurrentBillCop: optionalFormNumber().refine((value) => value === undefined || value > 0, "La factura mensual debe ser mayor que cero"),
      solarProgramSavingsCoveragePercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La cobertura de ahorro solar debe estar entre 0 % y 100 %"),
      solarProgramAgreementYears: optionalFormInteger().refine((value) => value === undefined || (value >= 1 && value <= 30), "El acuerdo solar debe estar entre 1 y 30 años"),
      solarProgramAnnualCpiPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 30), "El IPC anual debe estar entre 0 % y 30 %"),
      solarProgramUsefulLifeYears: optionalFormInteger().refine((value) => value === undefined || (value >= 1 && value <= 50), "La vida útil solar debe estar entre 1 y 50 años"),
      solarSystemPowerKwp: optionalFormNumber(),
      solarAnnualGenerationKwh: optionalFormNumber(),
      solarSelfConsumptionPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "El autoconsumo debe estar entre 0 % y 100 %"),
      solarExportPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La exportación solar debe estar entre 0 % y 100 %"),
      solarGridTariffCopPerKwh: optionalFormInteger().refine((value) => value === undefined || value >= 0, "La tarifa de red no puede ser negativa"),
      openSolarProjectId: z.string().trim().max(80).optional(),
      openSolarProjectTitle: z.string().trim().max(255).optional(),
      openSolarAnnualConsumptionKwh: optionalFormNumber().refine((value) => value === undefined || value >= 0, "El consumo anual OpenSolar no puede ser negativo"),
      electricalDistance: optionalFormInteger(),
      hasInternet: z.boolean().optional(),
      operatingHoursStart: z.string().optional(),
      operatingHoursEnd: z.string().optional(),
      is24Hours: z.boolean().optional(),
      electricalViability: z.enum(["viable", "requires_upgrade", "not_viable"]).optional(),
      requiresNewTransformer: z.boolean().optional(),
      proposedTransformerKva: optionalFormNumber(),
      investmentType: z.enum(["individual", "colectiva"]).optional(),

      // Tráfico y contexto
      estimatedDailyVehicles: optionalFormInteger(),
      estimatedEvPercent: optionalFormInteger().refine((value) => value === undefined || (value >= 0 && value <= 100)),
      nearbyAttractions: z.string().optional(),
      socioeconomicStratum: optionalFormInteger().refine((value) => value === undefined || (value >= 1 && value <= 6)),

      // Proyección comercial preliminar (opcional, calculada automáticamente)
      estimatedInvestmentCop: optionalFormNumber().refine((value) => value === undefined || value > 0, "La inversión debe ser mayor que cero"),
      estimatedPowerKw: optionalFormInteger().refine((value) => value === undefined || value >= 120, "EVGreen solo instala cargadores rápidos DC desde 120 kW."),
      estimatedChargerCount: optionalFormInteger().refine((value) => value === undefined || value >= 1, "Debe configurarse al menos un cargador"),

      // Notas
      additionalNotes: z.string().optional(),

      // Fotos (base64 encoded)
      photos: z.array(z.object({
        base64: z.string(),
        fileName: z.string(),
        contentType: z.string(),
        photoType: z.enum(["general", "electrical_panel", "transformer", "parking_area", "access_road", "surroundings", "other"]).optional(),
        caption: z.string().optional(),
        isCover: z.boolean().optional(),
        isConceptual: z.boolean().optional(),
      })).optional(),
      solarOfferPdf: z.object({
        base64: z.string().min(1).max(25_000_000),
        fileName: z.string().trim().min(1).max(255),
        contentType: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      let solarProgram: ReturnType<typeof buildAllySolarProgram> = null;
      try {
        solarProgram = buildAllySolarProgram({
          enabled: input.solarProgramEnabled,
          currentMonthlyBillCop: input.solarProgramCurrentBillCop,
          savingsCoveragePercent: input.solarProgramSavingsCoveragePercent,
          agreementYears: input.solarProgramAgreementYears,
          annualCpiPercent: input.solarProgramAnnualCpiPercent,
          usefulLifeYears: input.solarProgramUsefulLifeYears,
          systemPowerKwp: input.solarSystemPowerKwp,
          annualGenerationKwh: input.solarAnnualGenerationKwh,
          selfConsumptionPercent: input.solarSelfConsumptionPercent,
          exportPercent: input.solarExportPercent,
          gridTariffCopPerKwh: input.solarGridTariffCopPerKwh,
        });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Revisa los datos del programa solar." });
      }
      const solarAssumptions = solarProgram?.assumptions;
      const { code, result } = await db.transaction(async (tx: any) => {
        let technicalNotesJson: string | null = null;
        if (input.requiresNewTransformer !== undefined || input.proposedTransformerKva !== undefined) {
          const notesData: Record<string, unknown> = {};
          if (input.requiresNewTransformer !== undefined) notesData.requiresNewTransformer = input.requiresNewTransformer;
          if (input.proposedTransformerKva !== undefined) notesData.proposedTransformerKva = input.proposedTransformerKva;
          technicalNotesJson = JSON.stringify(notesData);
        }

        const created = await insertSubmissionWithCodeRetry(tx, (code) => ({
            code,
            submitterName: input.submitterName,
            submitterEmail: input.submitterEmail,
            submitterPhone: input.submitterPhone,
            submitterCompany: input.submitterCompany || null,
            submitterDocument: input.submitterDocument || null,
            spaceName: input.spaceName,
            spaceType: input.spaceType,
            spaceTypeOther: input.spaceTypeOther || null,
            address: input.address,
            city: input.city,
            department: input.department || null,
            latitude: input.latitude || null,
            longitude: input.longitude || null,
            availableAreaM2: input.availableAreaM2 || null,
            parkingSpots: input.parkingSpots || null,
            transformerCapacityKva: input.transformerCapacityKva || null,
            hasElectricalPanel: input.hasElectricalPanel ? 1 : 0,
            hasSolarPanels: input.hasSolarPanels ? 1 : 0,
            solarCoveragePercent: input.solarCoveragePercent ?? 0,
            solarEnergyCostPerKwh: input.solarEnergyCostPerKwh ?? null,
            solarProgramEnabled: solarProgram ? 1 : 0,
            // Los datos importados desde OpenSolar se conservan aunque aún no
            // exista una propuesta de ahorro activada. Activar el programa
            // requiere la validación comercial posterior, no borra el diseño.
            solarProgramCurrentBillCop: solarAssumptions?.currentMonthlyBillCop ?? input.solarProgramCurrentBillCop ?? null,
            solarProgramSavingsCoveragePercent: solarAssumptions?.savingsCoveragePercent ?? input.solarProgramSavingsCoveragePercent ?? null,
            solarProgramAgreementYears: solarAssumptions?.agreementYears ?? input.solarProgramAgreementYears ?? null,
            solarProgramAnnualCpiPercent: solarAssumptions?.annualCpiPercent ?? input.solarProgramAnnualCpiPercent ?? null,
            solarProgramUsefulLifeYears: solarAssumptions?.usefulLifeYears ?? input.solarProgramUsefulLifeYears ?? null,
            solarSystemPowerKwp: solarAssumptions?.systemPowerKwp ?? input.solarSystemPowerKwp ?? null,
            solarAnnualGenerationKwh: solarAssumptions?.annualGenerationKwh ?? input.solarAnnualGenerationKwh ?? null,
            solarSelfConsumptionPercent: solarAssumptions?.selfConsumptionPercent ?? input.solarSelfConsumptionPercent ?? null,
            solarExportPercent: solarAssumptions?.exportPercent ?? input.solarExportPercent ?? null,
            solarGridTariffCopPerKwh: solarAssumptions?.gridTariffCopPerKwh ?? input.solarGridTariffCopPerKwh ?? null,
            openSolarProjectId: input.openSolarProjectId?.trim() || null,
            openSolarProjectTitle: input.openSolarProjectTitle?.trim() || null,
            openSolarAnnualConsumptionKwh: input.openSolarAnnualConsumptionKwh ?? null,
            openSolarProjectImportedAt: input.openSolarProjectId?.trim() ? toSqlTimestamp() : null,
            electricalDistance: input.electricalDistance || null,
            hasInternet: input.hasInternet ? 1 : 0,
            operatingHoursStart: input.operatingHoursStart || "06:00",
            operatingHoursEnd: input.operatingHoursEnd || "22:00",
            is24Hours: input.is24Hours ? 1 : 0,
            estimatedDailyVehicles: input.estimatedDailyVehicles || null,
            estimatedEvPercent: input.estimatedEvPercent || null,
            estimatedInvestmentCop: input.estimatedInvestmentCop || null,
            estimatedPowerKw: input.estimatedPowerKw || null,
            estimatedChargerCount: input.estimatedChargerCount || null,
            nearbyAttractions: input.nearbyAttractions || null,
            socioeconomicStratum: input.socioeconomicStratum || null,
            additionalNotes: input.additionalNotes || null,
            electricalViability: input.electricalViability || null,
            technicalNotes: technicalNotesJson,
            investmentType: input.investmentType || "individual",
            spaceStatus: "pending",
          }));

        await tx.insert(spaceSolarScopeHistory).values({
          submissionId: created.result.insertId,
          previousHasSolarPanels: null,
          nextHasSolarPanels: input.hasSolarPanels ? 1 : 0,
          previousSolarCoveragePercent: null,
          nextSolarCoveragePercent: input.solarCoveragePercent ?? 0,
          previousSolarEnergyCostPerKwh: null,
          nextSolarEnergyCostPerKwh: input.solarEnergyCostPerKwh ?? null,
          changedById: ctx.user?.id ?? null,
          changedByRole: ctx.user?.role ?? "external_submitter",
          changeSource: "SUBMISSION",
        } as any);
        return created;
      });

      const submissionId = result.insertId;

      const projection = await buildSpaceCrowdfundingProjection({
        investmentCop: Number(input.estimatedInvestmentCop ?? 0),
        totalPowerKw: Number(input.estimatedPowerKw ?? 0),
        spaceType: input.spaceType,
        estimatedDailyVehicles: input.estimatedDailyVehicles,
        estimatedEvPercent: input.estimatedEvPercent,
        chargerCount: input.estimatedChargerCount,
        operatingHoursStart: input.operatingHoursStart,
        operatingHoursEnd: input.operatingHoursEnd,
        is24Hours: input.is24Hours,
        hasSolarPanels: input.hasSolarPanels,
        solarCoveragePercent: input.solarCoveragePercent,
        solarEnergyCostPerKwh: input.solarEnergyCostPerKwh,
      });
      if (projection) {
        await db.update(spaceSubmissions)
          .set({
            estimatedRoiPercent: sanitizeProjectionRoi(projection.selected.roiAnnualPercent),
            estimatedPaybackMonths: sanitizeProjectionPayback(projection.selected.paybackMonths),
            financialProjectionUpdatedAt: toSqlTimestamp(),
          })
          .where(eq(spaceSubmissions.id, submissionId));
      }

      // Subir fotos a S3
      if (input.photos && input.photos.length > 0) {
        for (let i = 0; i < input.photos.length; i++) {
          const photo = input.photos[i];
          try {
            const buffer = Buffer.from(photo.base64, "base64");
            if (buffer.length > 10 * 1024 * 1024) continue; // Max 10MB por foto

            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const ext = photo.fileName.split(".").pop() || "jpg";
            const fileKey = `spaces/${code}/${i}-${randomSuffix}.${ext}`;

            const { url } = await storagePut(fileKey, buffer, photo.contentType || "image/jpeg");

            // Si esta foto viene marcada como portada, asegurar unicidad
            const isCover = photo.isCover ? 1 : (i === 0 && !input.photos.some(p => p.isCover) ? 1 : 0);
            await db.insert(spacePhotos).values({
              submissionId,
              photoUrl: url,
              photoKey: fileKey,
              caption: photo.caption || null,
              photoType: photo.photoType || "general",
              sortOrder: i,
              isCover,
              isConceptual: photo.isConceptual ? 1 : 0,
            });
          } catch (err) {
            console.error(`[Spaces] Error uploading photo ${i}:`, err);
          }
        }
      }

      if (input.solarOfferPdf) {
        try {
          const pdfBuffer = Buffer.from(input.solarOfferPdf.base64.replace(/^data:application\/pdf;base64,/, ""), "base64");
          if (pdfBuffer.length === 0 || pdfBuffer.length > 20 * 1024 * 1024 || pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
            throw new Error("El archivo no parece ser un PDF válido o supera 20 MB.");
          }
          const fileKey = `spaces/${code}/solar-offer/${Date.now()}-${safePdfSegment(input.solarOfferPdf.fileName)}.pdf`;
          const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
          await db.update(spaceSubmissions).set({
            solarOfferPdfUrl: uploaded.url,
            solarOfferPdfKey: fileKey,
            solarOfferPdfName: input.solarOfferPdf.fileName,
          }).where(eq(spaceSubmissions.id, submissionId));
        } catch (error) {
          console.error("[Spaces] Error uploading solar offer PDF:", error);
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible guardar la oferta solar PDF." });
        }
      }

      // Notificar al admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Nueva postulación de espacio: ${input.spaceName}`,
          content: `${input.submitterName} ha postulado el espacio "${input.spaceName}" en ${input.city}. Código: ${code}. Revisa el panel de administración para evaluar la postulación.`,
        });
      } catch (err) {
        console.error("[Spaces] Error notifying owner:", err);
      }

      return { code, submissionId };
    }),

  // ========================================================================
  // PÚBLICO: Consultar estado de postulación por código
  // ========================================================================
  getStatus: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [submission] = await db
        .select({
          code: spaceSubmissions.code,
          spaceName: spaceSubmissions.spaceName,
          status: spaceSubmissions.spaceStatus,
          city: spaceSubmissions.city,
          createdAt: spaceSubmissions.createdAt,
          letterSentAt: spaceSubmissions.letterSentAt,
          letterAcceptedAt: spaceSubmissions.letterAcceptedAt,
        })
        .from(spaceSubmissions)
        .where(eq(spaceSubmissions.code, input.code))
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
      }

      return submission;
    }),

  // ========================================================================
  // PÚBLICO: Aceptar carta de intención (por token)
  // ========================================================================
  acceptLetter: publicProcedure
    .input(z.object({
      token: z.string(),
      signerName: z.string().min(2, "El nombre del firmante es requerido"),
      signerDocument: z.string().min(5, "El documento del firmante es requerido"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();

      const [submission] = await db
        .select()
        .from(spaceSubmissions)
        .where(eq(spaceSubmissions.letterToken, input.token))
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Token de carta de intención inválido o expirado" });
      }

      if (submission.letterAcceptedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta carta de intención ya fue aceptada" });
      }

      if (submission.spaceStatus !== "letter_sent") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta postulación no está en estado de firma de carta" });
      }

      // Obtener IP y User-Agent del request
      const clientIp = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
        || ctx.req.socket.remoteAddress
        || "unknown";
      const userAgent = ctx.req.headers["user-agent"] || "unknown";

      const signedAt = new Date();

      // Generar PDF de constancia de firma
      let pdfUrl = "";
      let pdfKey = "";
      try {
        const { generateSignedLetterPdf } = await import("./letter-pdf-service");
        const pdfBuffer = generateSignedLetterPdf({
          spaceName: submission.spaceName,
          spaceType: submission.spaceType || "No especificado",
          city: submission.city,
          department: submission.department || "Colombia",
          address: submission.address,
          code: submission.code,
          signerName: input.signerName,
          signerDocument: input.signerDocument,
          signerIp: clientIp,
          signerUserAgent: userAgent,
          signedAt,
          submitterName: submission.submitterName,
          submitterEmail: submission.submitterEmail,
          submitterPhone: submission.submitterPhone || "",
        });

        // Subir PDF a S3 con key único
        const randomSuffix = randomBytes(8).toString("hex");
        const fileKey = `spaces/cartas-firmadas/${submission.code}-${randomSuffix}.pdf`;
        const result = await storagePut(fileKey, pdfBuffer, "application/pdf");
        pdfUrl = result.url;
        pdfKey = result.key;
        console.log(`[Spaces] PDF de constancia generado y subido: ${pdfUrl}`);
      } catch (pdfErr) {
        console.error("[Spaces] Error generando PDF de constancia:", pdfErr);
        // No bloquear la firma si el PDF falla
      }

      // Actualizar BD con todos los datos de la firma
      await db.update(spaceSubmissions)
        .set({
          spaceStatus: "letter_accepted",
          letterAcceptedAt: signedAt.toISOString().slice(0, 19).replace("T", " "),
          letterSignerName: input.signerName,
          letterSignerDocument: input.signerDocument,
          letterSignerIp: clientIp,
          letterSignerUserAgent: userAgent,
          ...(pdfUrl ? { signedLetterPdfUrl: pdfUrl, signedLetterPdfKey: pdfKey } : {}),
        })
        .where(eq(spaceSubmissions.id, submission.id));

      await recordSpaceStatusChange(db, {
        submissionId: submission.id,
        fromStatus: "letter_sent",
        toStatus: "letter_accepted",
        changedByRole: "external_signer",
        note: `Carta de intención firmada por ${input.signerName}.`,
      });

      // Enviar copia del PDF al firmante por email (trazabilidad)
      try {
        if (pdfUrl && submission.submitterEmail) {
          const resend = await getResendClient();
          const emailParams = buildEmailParams({
            from: "EVGreen <notificaciones@evgreen.lat>",
            to: submission.submitterEmail,
            subject: `Constancia de Firma - Carta de Intención EVGreen (${submission.spaceName})`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">⚡ EVGreen</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 13px;">Green House Project S.A.S.</p>
                </div>
                <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <h2 style="color: #111827; font-size: 18px; margin: 0 0 12px;">Carta de Intención Firmada</h2>
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Estimado(a) <strong>${input.signerName}</strong>,</p>
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Adjuntamos la constancia de firma digital de la carta de intención para el espacio <strong>${submission.spaceName}</strong> (Código: ${submission.code}).</p>
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Este documento sirve como evidencia legal de su aceptación y contiene todos los datos de la firma digital.</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${pdfUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">📄 Descargar Constancia PDF</a>
                  </div>
                  <p style="color: #9ca3af; font-size: 12px; text-align: center;">Conserve este documento para sus registros.</p>
                </div>
              </div>
            `,
          });
          await resend.emails.send(emailParams as any);
          console.log(`[Spaces] Email con constancia PDF enviado a ${submission.submitterEmail}`);
        }
      } catch (emailErr) {
        console.error("[Spaces] Error enviando email con constancia:", emailErr);
      }

      // Notificar al admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Carta de intención aceptada: ${submission.spaceName}`,
          content: `${input.signerName} (${input.signerDocument}) ha aceptado la carta de intención para "${submission.spaceName}" en ${submission.city}. Código: ${submission.code}.${pdfUrl ? ` PDF de constancia: ${pdfUrl}` : ""} Ya puede publicar el espacio en el muro de crowdfunding.`,
        });
      } catch (err) {
        console.error("[Spaces] Error notifying owner:", err);
      }

      return { success: true, spaceName: submission.spaceName, code: submission.code, pdfUrl: pdfUrl || undefined };
    }),

  // ========================================================================
  // PÚBLICO: Listar espacios publicados (para muro de crowdfunding)
  // ========================================================================
  listPublished: publicProcedure
    .query(async () => {
      const db = await getDatabase();

      const published = await db
        .select({
          id: spaceSubmissions.id,
          code: spaceSubmissions.code,
          spaceName: spaceSubmissions.spaceName,
          spaceType: spaceSubmissions.spaceType,
          city: spaceSubmissions.city,
          department: spaceSubmissions.department,
          address: spaceSubmissions.address,
          latitude: spaceSubmissions.latitude,
          longitude: spaceSubmissions.longitude,
          aiScore: spaceSubmissions.aiScore,
          aiAnalysis: spaceSubmissions.aiAnalysis,
          estimatedInvestmentCop: spaceSubmissions.estimatedInvestmentCop,
          estimatedPowerKw: spaceSubmissions.estimatedPowerKw,
          estimatedChargerCount: spaceSubmissions.estimatedChargerCount,
          recommendedChargerType: spaceSubmissions.recommendedChargerType,
          spaceStatus: spaceSubmissions.spaceStatus,
          crowdfundingProjectId: spaceSubmissions.crowdfundingProjectId,
          socioeconomicStratum: spaceSubmissions.socioeconomicStratum,
          estimatedDailyVehicles: spaceSubmissions.estimatedDailyVehicles,
          parkingSpots: spaceSubmissions.parkingSpots,
          viewCount: spaceSubmissions.viewCount,
          investmentType: spaceSubmissions.investmentType,
        })
        .from(spaceSubmissions)
        .where(
          inArray(spaceSubmissions.spaceStatus, ["published", "funded", "in_construction", "operational"])
        )
        .orderBy(desc(spaceSubmissions.aiScore));

      // Obtener TODAS las fotos de cada espacio (primera como thumbnail + galería completa)
      const submissionIds = published.map(s => s.id);
      let thumbnailMap: Record<number, string> = {};
      let allPhotosMap: Record<number, Array<{ url: string; type: string; caption: string | null; isCover?: boolean; isConceptual?: boolean }>> = {};

      if (submissionIds.length > 0) {
        const photos = await db
          .select({
            submissionId: spacePhotos.submissionId,
            photoUrl: spacePhotos.photoUrl,
            photoType: spacePhotos.photoType,
            caption: spacePhotos.caption,
            isCover: spacePhotos.isCover,
            isConceptual: spacePhotos.isConceptual,
          })
          .from(spacePhotos)
          .where(inArray(spacePhotos.submissionId, submissionIds))
          .orderBy(desc(spacePhotos.isCover), spacePhotos.sortOrder);

        for (const photo of photos) {
          if (!thumbnailMap[photo.submissionId]) {
            thumbnailMap[photo.submissionId] = photo.photoUrl;
          }
          if (!allPhotosMap[photo.submissionId]) {
            allPhotosMap[photo.submissionId] = [];
          }
          allPhotosMap[photo.submissionId].push({
            url: photo.photoUrl,
            type: photo.photoType,
            caption: photo.caption,
            isCover: Boolean(photo.isCover),
            isConceptual: Boolean(photo.isConceptual),
          });
        }
      }

      // Obtener datos de crowdfunding si existen
      const cfIds = published.filter(s => s.crowdfundingProjectId).map(s => s.crowdfundingProjectId!);
      let cfMap: Record<number, { raisedAmount: number; targetAmount: number; status: string }> = {};

      if (cfIds.length > 0) {
        const cfProjects = await db
          .select({
            id: crowdfundingProjects.id,
            raisedAmount: crowdfundingProjects.raisedAmount,
            targetAmount: crowdfundingProjects.targetAmount,
            status: crowdfundingProjects.status,
          })
          .from(crowdfundingProjects)
          .where(inArray(crowdfundingProjects.id, cfIds));

        for (const cf of cfProjects) {
          cfMap[cf.id] = { raisedAmount: cf.raisedAmount, targetAmount: cf.targetAmount, status: cf.status };
        }
      }

      return published.map(s => ({
        ...s,
        thumbnailUrl: thumbnailMap[s.id] || null,
        photos: allPhotosMap[s.id] || [],
        crowdfunding: s.crowdfundingProjectId ? cfMap[s.crowdfundingProjectId] || null : null,
      }));
    }),

  // ========================================================================
  // ADMIN: Listar todas las postulaciones con filtros
  // ========================================================================
  admin: router({
    list: commercialPipelineProcedure
      .input(z.object({
        status: z.string().optional(),
        search: z.string().optional(),
        city: z.string().optional(),
        spaceType: z.string().optional(),
        dateFrom: z.string().optional(), // ISO date string
        dateTo: z.string().optional(), // ISO date string
        hasScore: z.enum(["all", "scored", "unscored"]).optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDatabase();
        const limit = input?.limit || 50;
        const offset = input?.offset || 0;

        let conditions: any[] = [];

        if (input?.status && input.status !== "all") {
          conditions.push(eq(spaceSubmissions.spaceStatus, input.status as any));
        }

        if (input?.search) {
          const searchTerm = `%${input.search}%`;
          conditions.push(
            or(
              like(spaceSubmissions.code, searchTerm),
              like(spaceSubmissions.spaceName, searchTerm),
              like(spaceSubmissions.submitterName, searchTerm),
              like(spaceSubmissions.city, searchTerm),
              like(spaceSubmissions.submitterEmail, searchTerm),
            )
          );
        }

        // Advanced filters
        if (input?.city) {
          conditions.push(eq(spaceSubmissions.city, input.city));
        }

        if (input?.spaceType) {
          conditions.push(eq(spaceSubmissions.spaceType, input.spaceType as any));
        }

        // El <input type="date"> del admin entrega "YYYY-MM-DD" como día
        // calendario de Bogotá (sin marca de zona), pero createdAt se
        // persiste en UTC. startOfDayInTz/endOfDayInTz convierten ese día
        // local al instante UTC real de su inicio/fin; usar setHours o
        // setUTCHours directamente sobre el string desplaza el límite por
        // el offset de Bogotá (ver advertencia ya documentada en
        // formatIsoDateInTz, en server/utils/timezone.ts).
        if (input?.dateFrom) {
          conditions.push(gte(spaceSubmissions.createdAt, startOfDayInTz(input.dateFrom).toISOString().slice(0, 19).replace('T', ' ')));
        }

        if (input?.dateTo) {
          conditions.push(lte(spaceSubmissions.createdAt, endOfDayInTz(input.dateTo).toISOString().slice(0, 19).replace('T', ' ')));
        }

        if (input?.hasScore === "scored") {
          conditions.push(isNotNull(spaceSubmissions.aiScore));
        } else if (input?.hasScore === "unscored") {
          conditions.push(isNull(spaceSubmissions.aiScore));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [submissions, [totalResult]] = await Promise.all([
          db
            .select()
            .from(spaceSubmissions)
            .where(whereClause)
            .orderBy(desc(spaceSubmissions.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(spaceSubmissions)
            .where(whereClause),
        ]);

        // Obtener conteo por estado
        const statusCounts = await db
          .select({
            status: spaceSubmissions.spaceStatus,
            count: count(),
          })
          .from(spaceSubmissions)
          .groupBy(spaceSubmissions.spaceStatus);

        // Obtener ciudades y tipos únicos para los filtros
        const [cities, types] = await Promise.all([
          db.selectDistinct({ city: spaceSubmissions.city }).from(spaceSubmissions).orderBy(spaceSubmissions.city),
          db.selectDistinct({ spaceType: spaceSubmissions.spaceType }).from(spaceSubmissions).orderBy(spaceSubmissions.spaceType),
        ]);

        return {
          // Alias de compatibilidad: UI y clientes previos consumían `status`.
          submissions: submissions.map((submission) => ({
            ...submission,
            status: submission.spaceStatus,
          })),
          total: totalResult?.count || 0,
          statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s.count])),
          filterOptions: {
            cities: cities.map(c => c.city),
            types: types.map(t => t.spaceType),
          },
        };
      }),

    // ========================================================================
    // ADMIN: Obtener detalle de una postulación
    // ========================================================================
    getById: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDatabase();

        const [submission] = await db
          .select()
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        const photos = await db
          .select()
          .from(spacePhotos)
          .where(eq(spacePhotos.submissionId, input.id))
          .orderBy(spacePhotos.sortOrder);

        return { ...submission, status: submission.spaceStatus, photos };
      }),

    // ========================================================================
    // PIPELINE: Historial reciente de cambios de etapa
    // ========================================================================
    getStatusHistory: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDatabase();
        return db.select({
          fromStatus: spaceStatusHistory.fromStatus,
          toStatus: spaceStatusHistory.toStatus,
          changedByRole: spaceStatusHistory.changedByRole,
          note: spaceStatusHistory.note,
          createdAt: spaceStatusHistory.createdAt,
        })
          .from(spaceStatusHistory)
          .where(eq(spaceStatusHistory.submissionId, input.id))
          .orderBy(desc(spaceStatusHistory.createdAt))
          .limit(12);
      }),

    // ========================================================================
    // ADMIN: Bitácora de alcance solar del espacio
    // ========================================================================
    getSolarScopeHistory: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDatabase();
        return db.select({
          previousHasSolarPanels: spaceSolarScopeHistory.previousHasSolarPanels,
          nextHasSolarPanels: spaceSolarScopeHistory.nextHasSolarPanels,
          previousSolarCoveragePercent: spaceSolarScopeHistory.previousSolarCoveragePercent,
          nextSolarCoveragePercent: spaceSolarScopeHistory.nextSolarCoveragePercent,
          previousSolarEnergyCostPerKwh: spaceSolarScopeHistory.previousSolarEnergyCostPerKwh,
          nextSolarEnergyCostPerKwh: spaceSolarScopeHistory.nextSolarEnergyCostPerKwh,
          changedByRole: spaceSolarScopeHistory.changedByRole,
          changeSource: spaceSolarScopeHistory.changeSource,
          createdAt: spaceSolarScopeHistory.createdAt,
        })
          .from(spaceSolarScopeHistory)
          .where(eq(spaceSolarScopeHistory.submissionId, input.id))
          .orderBy(desc(spaceSolarScopeHistory.createdAt))
          .limit(6);
      }),

    // ========================================================================
    // ADMIN: Consultar un proyecto OpenSolar sin persistir ni sincronizar
    // ========================================================================
    lookupOpenSolarProject: adminProcedure
      .input(z.object({
        projectId: z.string().trim().min(1, "Ingresa el ID del proyecto OpenSolar").max(80),
      }))
      .mutation(async ({ input }) => {
        const settings = await getPlatformSettings();
        if (settings?.openSolarEnabled !== 1 || !settings.openSolarOrgId || !settings.openSolarApiKeyEncrypted) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Configura, autentica y habilita OpenSolar primero en Administración → Configuración.",
          });
        }

        let bearerToken: string;
        try {
          const { decryptOpenSolarSecret } = await import("../opensolar/opensolar-secrets");
          bearerToken = decryptOpenSolarSecret(settings.openSolarApiKeyEncrypted);
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No fue posible preparar la credencial cifrada de OpenSolar. Vuelve a autenticar la integración.",
          });
        }

        const { getOpenSolarProjectPrefill } = await import("../opensolar/opensolar-client");
        const result = await getOpenSolarProjectPrefill({
          bearerToken,
          orgId: settings.openSolarOrgId,
          projectId: input.projectId,
        });
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
        }
        return result;
      }),

    // ========================================================================
    // ADMIN: Actualizar estado de una postulación
    // ========================================================================
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum([
          "pending", "under_review", "approved", "rejected",
          "letter_sent", "letter_accepted", "published",
          "funded", "in_construction", "operational",
        ]),
        rejectionReason: z.string().optional(),
        // Campos de evaluación técnica
        technicalScore: z.number().int().min(0).max(100).optional(),
        technicalNotes: z.string().optional(),
        electricalViability: z.enum(["viable", "requires_upgrade", "not_viable"]).optional(),
        accessibilityScore: z.number().int().min(0).max(10).optional(),
        trafficPotentialScore: z.number().int().min(0).max(10).optional(),
        // Datos de inversión estimados
        estimatedInvestmentCop: z.number().optional(),
		minimumInvestmentCop: z.number().optional(),
		estimatedRoiPercent: z.string().optional(),
		estimatedPaybackMonths: z.number().int().optional(),
        estimatedPowerKw: z.number().int().min(120, "EVGreen solo instala cargadores rápidos DC desde 120 kW.").optional(),
        estimatedChargerCount: z.number().int().optional(),
        recommendedChargerType: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();

        const [currentSubmission] = await db
          .select({ spaceStatus: spaceSubmissions.spaceStatus })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);
        if (!currentSubmission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        const updateData: any = {
          spaceStatus: input.status,
        };

        if (input.rejectionReason) updateData.rejectionReason = input.rejectionReason;
        if (input.technicalScore !== undefined) updateData.technicalScore = input.technicalScore;
        if (input.technicalNotes) updateData.technicalNotes = input.technicalNotes;
        if (input.electricalViability) updateData.electricalViability = input.electricalViability;
        if (input.accessibilityScore !== undefined) updateData.accessibilityScore = input.accessibilityScore;
        if (input.trafficPotentialScore !== undefined) updateData.trafficPotentialScore = input.trafficPotentialScore;
        if (input.estimatedInvestmentCop !== undefined) updateData.estimatedInvestmentCop = input.estimatedInvestmentCop;
		if (input.minimumInvestmentCop !== undefined) updateData.minimumInvestmentCop = input.minimumInvestmentCop;
		if (input.estimatedRoiPercent !== undefined) updateData.estimatedRoiPercent = input.estimatedRoiPercent;
		if (input.estimatedPaybackMonths !== undefined) updateData.estimatedPaybackMonths = input.estimatedPaybackMonths;
		if (input.estimatedInvestmentCop !== undefined || input.minimumInvestmentCop !== undefined || input.estimatedRoiPercent !== undefined || input.estimatedPaybackMonths !== undefined) {
			updateData.financialProjectionUpdatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
			updateData.financialProjectionUpdatedBy = ctx.user.id;
		}
        if (input.estimatedPowerKw !== undefined) updateData.estimatedPowerKw = input.estimatedPowerKw;
        if (input.estimatedChargerCount !== undefined) updateData.estimatedChargerCount = input.estimatedChargerCount;
        if (input.recommendedChargerType) updateData.recommendedChargerType = input.recommendedChargerType;

        // Si se está evaluando, registrar quién y cuándo
        if (["under_review", "approved", "rejected"].includes(input.status)) {
          updateData.evaluatedBy = ctx.user.id;
          updateData.evaluatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        }

        await db.update(spaceSubmissions)
          .set(updateData)
          .where(eq(spaceSubmissions.id, input.id));

        await recordSpaceStatusChange(db, {
          submissionId: input.id,
          fromStatus: currentSubmission.spaceStatus as SpacePipelineStatus,
          toStatus: input.status as SpacePipelineStatus,
          changedById: ctx.user.id,
          changedByRole: ctx.user.role,
          note: input.rejectionReason || "Actualización de etapa desde administración.",
        });

        // ── Auto-crear proyecto crowdfunding DRAFT cuando se aprueba ──
        if (input.status === "approved") {
          const [submission] = await db
            .select()
            .from(spaceSubmissions)
            .where(eq(spaceSubmissions.id, input.id))
            .limit(1);

			if (submission && !submission.crowdfundingProjectId) {
				const inheritedPhotos = await db.select({
					submissionId: spacePhotos.submissionId, url: spacePhotos.photoUrl, type: spacePhotos.photoType,
					caption: spacePhotos.caption, sortOrder: spacePhotos.sortOrder,
					isCover: spacePhotos.isCover, isConceptual: spacePhotos.isConceptual,
				}).from(spacePhotos).where(eq(spacePhotos.submissionId, input.id)).orderBy(spacePhotos.sortOrder);
				const inherited = getCrowdfundingInheritanceSnapshot(submission, inheritedPhotos);
				const targetAmount = inherited.targetAmount ?? 0;
				const totalPowerKw = inherited.totalPowerKw ?? 0;
				const projection = await buildSpaceCrowdfundingProjection({
					investmentCop: targetAmount,
					totalPowerKw,
					spaceType: submission.spaceType,
					estimatedDailyVehicles: Number(submission.estimatedDailyVehicles ?? 0),
					estimatedEvPercent: Number(submission.estimatedEvPercent ?? 0),
					chargerCount: Number(submission.estimatedChargerCount ?? 0),
					operatingHoursStart: submission.operatingHoursStart,
					operatingHoursEnd: submission.operatingHoursEnd,
					is24Hours: submission.is24Hours,
					hasSolarPanels: submission.hasSolarPanels,
					solarCoveragePercent: Number(submission.solarCoveragePercent ?? 0),
					solarEnergyCostPerKwh: submission.solarEnergyCostPerKwh === null ? null : Number(submission.solarEnergyCostPerKwh),
				});
	            const [cfResult] = await db.insert(crowdfundingProjects).values({
				name: inherited.name,
				description: inherited.description,
				city: inherited.city,
				zone: inherited.zone,
				address: inherited.address,
              targetAmount,
				minimumInvestment: inherited.minimumInvestment ?? 0,
					totalPowerKw,
					chargerCount: inherited.chargerCount ?? 0,
					chargerPowerKw: inherited.chargerPowerKw ?? 0,
	                            hasSolarPanels: inherited.hasSolarPanels ? 1 : 0,
	                            solarCoveragePercent: String(inherited.solarCoveragePercent),
	                            solarEnergyCostPerKwh: inherited.solarEnergyCostPerKwh,
              raisedAmount: 0,
					estimatedRoiPercent: projection ? projection.selected.roiAnnualPercent.toFixed(2) : "0.00",
					estimatedPaybackMonths: projection ? Math.ceil(projection.selected.paybackMonths) : 0,
					financialProjectionSnapshot: projection?.snapshot ?? null,
					financialProjectionScenario: projection?.selectedScenario ?? null,
					financialProjectionUpdatedAt: projection ? toSqlTimestamp() : null,
					financialProjectionUpdatedBy: projection ? ctx.user.id : null,
					status: "DRAFT",
              spaceSubmissionId: input.id,
				spaceInheritanceSnapshot: inherited,
              createdById: ctx.user.id,
            });
            // Vincular el espacio con el proyecto CF
            await db.update(spaceSubmissions)
              .set({ crowdfundingProjectId: cfResult.insertId })
              .where(eq(spaceSubmissions.id, input.id));
          }
        }

        // ── Auto-activar proyecto CF cuando carta es aceptada ──
        if (input.status === "letter_accepted") {
          const [submission] = await db
            .select()
            .from(spaceSubmissions)
            .where(eq(spaceSubmissions.id, input.id))
            .limit(1);

          if (submission?.crowdfundingProjectId) {
            await db.update(crowdfundingProjects)
              .set({ status: "OPEN", launchDate: new Date().toISOString().slice(0, 19).replace("T", " ") })
              .where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId));
          }
        }

        return { success: true };
      }),

    // ========================================================================
    // ADMIN: Enviar carta de intención por email
    // ========================================================================
    sendLetter: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();

        const [submission] = await db
          .select()
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        if (submission.spaceStatus !== "approved" && submission.spaceStatus !== "letter_sent") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se puede enviar o reenviar carta a postulaciones aprobadas con firma pendiente" });
        }

        const letterToken = generateLetterToken();
        const acceptUrl = getLetterAcceptanceUrl(letterToken);

        // Generar HTML del email de carta de intención
        const emailHTML = generateLetterEmailHTML({
          submitterName: submission.submitterName,
          spaceName: submission.spaceName,
          city: submission.city,
          address: submission.address,
          spaceType: SPACE_TYPE_LABELS[submission.spaceType] || submission.spaceType,
          acceptUrl,
          code: submission.code,
        });

        // Enviar email
        const resend = await getResendClient();

        const emailParams = buildEmailParams({
          from: "EVGreen <admin@evgreen.lat>",
          to: submission.submitterEmail,
          subject: `${submission.spaceStatus === "letter_sent" ? "Recordatorio: " : ""}Carta de Intención - Espacio ${submission.spaceName} | EVGreen`,
          html: emailHTML,
          replyTo: "gerencia@greenhproject.com",
        });

        const result = await resend.emails.send({
          ...emailParams,
          cc: "gerencia@greenhproject.com",
        });

        if (result.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Error al enviar email: ${result.error.message}`,
          });
        }

        // Actualizar estado y token
        await db.update(spaceSubmissions)
          .set(buildLetterDispatchUpdate(letterToken, result.data?.id) as any)
          .where(eq(spaceSubmissions.id, input.id));

        await recordSpaceStatusChange(db, {
          submissionId: input.id,
          fromStatus: submission.spaceStatus as SpacePipelineStatus,
          toStatus: "letter_sent",
          changedById: ctx.user.id,
          changedByRole: ctx.user.role,
          note: submission.spaceStatus === "letter_sent" ? "Carta de intención reenviada." : "Carta de intención enviada al postulante.",
        });

        return { success: true, emailId: result.data?.id, acceptUrl };
      }),

    // ========================================================================
    // ADMIN: Obtener enlace alterno de firma para compartir manualmente
    // ========================================================================
    getLetterShareLink: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const [submission] = await db
          .select({ id: spaceSubmissions.id, spaceStatus: spaceSubmissions.spaceStatus, letterToken: spaceSubmissions.letterToken, submitterName: spaceSubmissions.submitterName, spaceName: spaceSubmissions.spaceName })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        return getLetterShareLinkData(submission);
      }),

    // ========================================================================
    // ADMIN: Historial seguro de entrega de la carta (sin payload del proveedor)
    // ========================================================================
    getLetterDeliveryHistory: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDatabase();
        return db.select({
          eventType: letterEmailEvents.eventType,
          deliveryStatus: letterEmailEvents.deliveryStatus,
          recipientEmail: letterEmailEvents.recipientEmail,
          occurredAt: letterEmailEvents.occurredAt,
          receivedAt: letterEmailEvents.receivedAt,
        }).from(letterEmailEvents)
          .where(eq(letterEmailEvents.submissionId, input.id))
          .orderBy(desc(letterEmailEvents.occurredAt))
          .limit(10);
      }),

    // ========================================================================
    // ADMIN: Rotar enlace de firma para revocar un vínculo compartido
    // ========================================================================
    rotateLetterShareLink: commercialPipelineProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const [submission] = await db
          .select({ id: spaceSubmissions.id, spaceStatus: spaceSubmissions.spaceStatus, letterToken: spaceSubmissions.letterToken, submitterName: spaceSubmissions.submitterName, spaceName: spaceSubmissions.spaceName })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        const letterToken = generateLetterToken();
        const rotated = getRotatedLetterShareLinkData(submission, letterToken);
        await db.update(spaceSubmissions)
          .set({ letterToken, letterSentAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
          .where(eq(spaceSubmissions.id, input.id));

        return rotated;
      }),

    // ========================================================================
    // ADMIN: Generar scoring IA para un espacio
    // ========================================================================
    generateAIScore: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();

        const [submission] = await db
          .select()
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        const photos = await db
          .select({ photoUrl: spacePhotos.photoUrl, photoType: spacePhotos.photoType, caption: spacePhotos.caption })
          .from(spacePhotos)
          .where(eq(spacePhotos.submissionId, input.id))
          .orderBy(spacePhotos.sortOrder);

        let analysis;
        try {
          analysis = await scoreSpaceInvestment({ space: submission, photos });
        } catch (error) {
          console.error("[Spaces] Error generating multimodal AI scoring:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No fue posible completar el análisis visual y técnico. Inténtalo de nuevo.",
          });
        }

        let technicalNotes: Record<string, unknown>;
        try {
          technicalNotes = submission.technicalNotes ? JSON.parse(submission.technicalNotes) : {};
        } catch {
          technicalNotes = submission.technicalNotes ? { legacyText: submission.technicalNotes } : {};
        }
        technicalNotes.requiresNewTransformer = true;
        technicalNotes.proposedTransformerKva = analysis.dcInfrastructure.requiredTransformerKva;
        technicalNotes.dcPowerFactor = analysis.dcInfrastructure.transformerPowerFactor;
        technicalNotes.dcMinimumChargerPowerKw = analysis.dcInfrastructure.minimumChargerPowerKw;
        technicalNotes.dcScoringVersion = analysis.version;

        // Guardar en BD
        await db.update(spaceSubmissions)
          .set({
            aiScore: analysis.score,
            aiAnalysis: JSON.stringify(analysis),
            aiScoredAt: new Date().toISOString().slice(0, 19).replace("T", " "),
            technicalNotes: JSON.stringify(technicalNotes),
            // Una recomendación antigua inferior a 120 kW no puede persistir como una oferta DC EVGreen válida.
            ...(Number(submission.estimatedPowerKw) >= 120 ? {} : { estimatedPowerKw: analysis.estimatedPowerKw }),
            ...(Number(submission.estimatedChargerCount) > 0 ? {} : { estimatedChargerCount: analysis.estimatedChargers }),
            electricalViability: analysis.electricalViability,
          })
          .where(eq(spaceSubmissions.id, input.id));

        return { score: analysis.score, analysis };
      }),

    // ========================================================================
    // ADMIN: Publicar espacio en crowdfunding
    // ========================================================================
    publishToCrowdfunding: commercialPipelineProcedure
      .input(z.object({
        id: z.number(),
		targetAmount: z.number().min(1000000, "La meta de inversión debe ser al menos $1.000.000").optional(),
        minimumInvestment: z.number().optional(),
        estimatedRoiPercent: z.string().optional(),
        estimatedPaybackMonths: z.number().int().optional(),
        manualFormalizationReason: z.string().trim().min(15).max(2000).optional(),
        manualFormalizationEvidence: z.string().trim().min(5).max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();

        const [submission] = await db
          .select()
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        const publicationDecision = getCrowdfundingPublicationDecision(
          submission.spaceStatus,
          input.manualFormalizationReason,
          input.manualFormalizationEvidence,
        );

			const inheritedPhotos = await db.select({
				submissionId: spacePhotos.submissionId, url: spacePhotos.photoUrl, type: spacePhotos.photoType,
				caption: spacePhotos.caption, sortOrder: spacePhotos.sortOrder,
				isCover: spacePhotos.isCover, isConceptual: spacePhotos.isConceptual,
			}).from(spacePhotos).where(eq(spacePhotos.submissionId, input.id)).orderBy(spacePhotos.sortOrder);
		const inherited = getCrowdfundingInheritanceSnapshot(submission, inheritedPhotos);
			const [currentProject] = submission.crowdfundingProjectId
				? await db.select().from(crowdfundingProjects).where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId)).limit(1)
				: [];
			const targetAmount = firstPositiveNumber(currentProject?.targetAmount, inherited.targetAmount, input.targetAmount);
			if (!targetAmount) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Completa la meta de inversión en Espacios antes de publicar." });
			}
			const totalPowerKw = firstPositiveNumber(currentProject?.totalPowerKw, inherited.totalPowerKw, 120)!;
			const projection = await buildSpaceCrowdfundingProjection({
				investmentCop: targetAmount,
				totalPowerKw,
				spaceType: submission.spaceType,
				estimatedDailyVehicles: Number(submission.estimatedDailyVehicles ?? 0),
				estimatedEvPercent: Number(submission.estimatedEvPercent ?? 0),
				chargerCount: Number(submission.estimatedChargerCount ?? 0),
				operatingHoursStart: submission.operatingHoursStart,
				operatingHoursEnd: submission.operatingHoursEnd,
				is24Hours: submission.is24Hours,
				hasSolarPanels: submission.hasSolarPanels,
				solarCoveragePercent: Number(submission.solarCoveragePercent ?? 0),
				solarEnergyCostPerKwh: submission.solarEnergyCostPerKwh === null ? null : Number(submission.solarEnergyCostPerKwh),
				currentProject,
			});
			if (!projection) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Completa inversión y potencia para calcular los escenarios antes de publicar." });
			}
			const projectionValues = {
				estimatedRoiPercent: projection.selected.roiAnnualPercent.toFixed(2),
				estimatedPaybackMonths: Math.ceil(projection.selected.paybackMonths),
				financialProjectionSnapshot: projection.snapshot,
				financialProjectionScenario: projection.selectedScenario,
				financialProjectionUpdatedAt: toSqlTimestamp(),
				financialProjectionUpdatedBy: ctx.user.id,
			};

        let crowdfundingProjectId: number;

        if (submission.crowdfundingProjectId) {
	          // Ya existe un proyecto CF (creado auto al aprobar) → actualizar
		          await db.update(crowdfundingProjects)
		            .set({
					spaceInheritanceSnapshot: inherited,
					targetAmount,
					minimumInvestment: firstPositiveNumber(currentProject?.minimumInvestment, inherited.minimumInvestment, input.minimumInvestment, 50000000)!,
					totalPowerKw,
					hasSolarPanels: inherited.hasSolarPanels ? 1 : 0,
					solarCoveragePercent: String(inherited.solarCoveragePercent),
					solarEnergyCostPerKwh: inherited.solarEnergyCostPerKwh,
					...projectionValues,
	              status: "OPEN",
              launchDate: new Date().toISOString().slice(0, 19).replace("T", " "),
            })
            .where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId));
          crowdfundingProjectId = submission.crowdfundingProjectId;
        } else {
          // Crear nuevo proyecto de crowdfunding
          const [cfResult] = await db.insert(crowdfundingProjects).values({
			name: inherited.name,
			description: inherited.description,
			city: inherited.city,
			zone: inherited.zone,
			address: inherited.address,
				targetAmount,
				minimumInvestment: inherited.minimumInvestment ?? input.minimumInvestment ?? 50000000,
				totalPowerKw,
			chargerCount: inherited.chargerCount ?? 2,
			chargerPowerKw: inherited.chargerPowerKw ?? 60,
	            hasSolarPanels: inherited.hasSolarPanels ? 1 : 0,
	            solarCoveragePercent: String(inherited.solarCoveragePercent),
	            solarEnergyCostPerKwh: inherited.solarEnergyCostPerKwh,
            raisedAmount: 0,
				...projectionValues,
            status: "OPEN",
            launchDate: new Date().toISOString().slice(0, 19).replace("T", " "),
            spaceSubmissionId: input.id,
				spaceInheritanceSnapshot: inherited,
            createdById: ctx.user.id,
          });
          crowdfundingProjectId = cfResult.insertId;
        }

        // Actualizar postulaci\u00f3n
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await db.update(spaceSubmissions)
          .set({
            spaceStatus: "published",
            crowdfundingProjectId,
			estimatedInvestmentCop: targetAmount,
            ...(publicationDecision.isManualFormalization
              ? {
                  manualFormalizationReason: publicationDecision.reason,
                  manualFormalizationEvidence: publicationDecision.evidence,
                  manualFormalizedAt: now,
                  manualFormalizedBy: ctx.user.id,
                }
              : {}),
          } as any)
          .where(eq(spaceSubmissions.id, input.id));

        await recordSpaceStatusChange(db, {
          submissionId: input.id,
          fromStatus: submission.spaceStatus as SpacePipelineStatus,
          toStatus: "published",
          changedById: ctx.user.id,
          changedByRole: ctx.user.role,
          note: publicationDecision.isManualFormalization
            ? "Oferta publicada con formalización interna registrada."
            : "Oferta publicada para crowdfunding.",
        });

        return {
          success: true,
          crowdfundingProjectId,
          manualFormalization: publicationDecision.isManualFormalization,
        };
      }),

    // ========================================================================
    // PIPELINE COMERCIAL: Confirmar el siguiente hito posterior a publicación
    // ========================================================================
    advanceCommercialStage: commercialPipelineProcedure
      .input(z.object({
        id: z.number(),
        targetStatus: z.enum(["funded", "in_construction", "operational"]),
        note: z.string().trim().min(4, "Registra una nota comercial de al menos 4 caracteres.").max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();
        const [submission] = await db
          .select({
            id: spaceSubmissions.id,
            spaceStatus: spaceSubmissions.spaceStatus,
            crowdfundingProjectId: spaceSubmissions.crowdfundingProjectId,
          })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });

        try {
          assertCommercialTransition(
            submission.spaceStatus as SpacePipelineStatus,
            input.targetStatus as SpacePipelineStatus,
          );
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "No es posible avanzar la etapa comercial.",
          });
        }

        const now = toSqlTimestamp();
        await db.update(spaceSubmissions)
          .set({ spaceStatus: input.targetStatus })
          .where(eq(spaceSubmissions.id, input.id));

        if (submission.crowdfundingProjectId) {
          const projectUpdate = input.targetStatus === "funded"
            ? { status: "FUNDED" as const, fundedDate: now }
            : input.targetStatus === "operational"
              ? { status: "COMPLETED" as const, operationalDate: now }
              : { status: "IN_PROGRESS" as const };
          await db.update(crowdfundingProjects)
            .set(projectUpdate)
            .where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId));
        }

        await recordSpaceStatusChange(db, {
          submissionId: submission.id,
          fromStatus: submission.spaceStatus as SpacePipelineStatus,
          toStatus: input.targetStatus as SpacePipelineStatus,
          changedById: ctx.user.id,
          changedByRole: ctx.user.role,
          note: input.note,
        });

        return { success: true, status: input.targetStatus };
      }),

    // ========================================================================
    // ADMIN: Editar datos de un espacio
    // ========================================================================
    updateSpace: adminProcedure
      .input(z.object({
        id: z.number(),
        spaceName: z.string().optional(),
        spaceType: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        department: z.string().optional(),
        latitude: optionalLocalizedDecimalString(),
        longitude: optionalLocalizedDecimalString(),
        availableAreaM2: optionalLocalizedDecimalString(),
        parkingSpots: optionalFormInteger(),
        transformerCapacityKva: optionalLocalizedDecimalString(),
        hasElectricalPanel: z.boolean().optional(),
        hasSolarPanels: z.boolean().optional(),
        solarCoveragePercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La cobertura solar debe estar entre 0 % y 100 %"),
        solarEnergyCostPerKwh: optionalFormInteger().refine((value) => value === undefined || value >= 0, "El costo solar por kWh no puede ser negativo"),
        solarProgramEnabled: z.boolean().optional(),
        solarProgramCurrentBillCop: optionalFormNumber().refine((value) => value === undefined || value > 0, "La factura mensual debe ser mayor que cero"),
        solarProgramSavingsCoveragePercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La cobertura de ahorro solar debe estar entre 0 % y 100 %"),
        solarProgramAgreementYears: optionalFormInteger().refine((value) => value === undefined || (value >= 1 && value <= 30), "El acuerdo solar debe estar entre 1 y 30 años"),
        solarProgramAnnualCpiPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 30), "El IPC anual debe estar entre 0 % y 30 %"),
        solarProgramUsefulLifeYears: optionalFormInteger().refine((value) => value === undefined || (value >= 1 && value <= 50), "La vida útil solar debe estar entre 1 y 50 años"),
        solarSystemPowerKwp: optionalFormNumber(),
        solarAnnualGenerationKwh: optionalFormNumber(),
        solarSelfConsumptionPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "El autoconsumo debe estar entre 0 % y 100 %"),
        solarExportPercent: optionalFormNumber().refine((value) => value === undefined || (value >= 0 && value <= 100), "La exportación solar debe estar entre 0 % y 100 %"),
        solarGridTariffCopPerKwh: optionalFormInteger().refine((value) => value === undefined || value >= 0, "La tarifa de red no puede ser negativa"),
        openSolarProjectId: z.string().trim().max(80).optional(),
        openSolarProjectTitle: z.string().trim().max(255).optional(),
        openSolarAnnualConsumptionKwh: optionalFormNumber().refine((value) => value === undefined || value >= 0, "El consumo anual OpenSolar no puede ser negativo"),
        electricalDistance: optionalFormInteger(),
        electricalDistanceM: optionalFormInteger(),
        hasInternet: z.boolean().optional(),
        operatingHoursStart: z.string().optional(),
        operatingHoursEnd: z.string().optional(),
        is24Hours: z.boolean().optional(),
        estimatedDailyVehicles: optionalFormInteger(),
        estimatedEvPercent: optionalFormInteger(),
        nearbyAttractions: z.string().optional(),
        socioeconomicStratum: optionalFormInteger(),
        additionalNotes: z.string().optional(),
        submitterName: z.string().optional(),
        submitterEmail: z.string().optional(),
        submitterPhone: z.string().optional(),
        submitterCompany: z.string().optional(),
        estimatedInvestmentCop: optionalFormNumber(),
        minimumInvestmentCop: optionalFormNumber(),
        estimatedRoiPercent: optionalFormNumber(),
        estimatedPaybackMonths: optionalFormInteger(),
        estimatedPowerKw: optionalFormInteger(),
        estimatedChargerCount: optionalFormInteger(),
        recommendedChargerType: z.string().optional(),
        investmentType: z.enum(["individual", "colectiva"]).optional(),
        // Campos de evaluación manual
        technicalScore: optionalFormInteger().refine((value) => value === undefined || (value >= 0 && value <= 100)),
        technicalNotes: z.string().optional(),
        electricalViability: z.enum(["viable", "requires_upgrade", "not_viable"]).optional(),
        accessibilityScore: optionalFormInteger().refine((value) => value === undefined || (value >= 0 && value <= 10)),
        trafficPotentialScore: optionalFormInteger().refine((value) => value === undefined || (value >= 0 && value <= 10)),
        // Campos de IA editables manualmente
        aiScore: optionalFormInteger().refine((value) => value === undefined || (value >= 0 && value <= 100)),
        aiAnalysis: z.string().optional(), // JSON string
        // Transformador nuevo
        requiresNewTransformer: z.boolean().optional(), // Se guarda en technicalNotes como JSON
        proposedTransformerKva: optionalFormNumber(), // kVA del transformador propuesto
        solarOfferPdf: z.object({
          base64: z.string().min(1).max(25_000_000),
          fileName: z.string().trim().min(1).max(255),
          contentType: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();
        const { id, requiresNewTransformer, proposedTransformerKva, electricalDistanceM, solarOfferPdf, ...updateFields } = input;

        const [previousSubmission] = await db
          .select({
            id: spaceSubmissions.id,
            estimatedInvestmentCop: spaceSubmissions.estimatedInvestmentCop,
            estimatedPowerKw: spaceSubmissions.estimatedPowerKw,
            estimatedChargerCount: spaceSubmissions.estimatedChargerCount,
            estimatedDailyVehicles: spaceSubmissions.estimatedDailyVehicles,
            estimatedEvPercent: spaceSubmissions.estimatedEvPercent,
            operatingHoursStart: spaceSubmissions.operatingHoursStart,
            operatingHoursEnd: spaceSubmissions.operatingHoursEnd,
            is24Hours: spaceSubmissions.is24Hours,
            hasSolarPanels: spaceSubmissions.hasSolarPanels,
            solarCoveragePercent: spaceSubmissions.solarCoveragePercent,
            solarEnergyCostPerKwh: spaceSubmissions.solarEnergyCostPerKwh,
            solarProgramEnabled: spaceSubmissions.solarProgramEnabled,
            solarProgramCurrentBillCop: spaceSubmissions.solarProgramCurrentBillCop,
            solarProgramSavingsCoveragePercent: spaceSubmissions.solarProgramSavingsCoveragePercent,
            solarProgramAgreementYears: spaceSubmissions.solarProgramAgreementYears,
            solarProgramAnnualCpiPercent: spaceSubmissions.solarProgramAnnualCpiPercent,
            solarProgramUsefulLifeYears: spaceSubmissions.solarProgramUsefulLifeYears,
            solarSystemPowerKwp: spaceSubmissions.solarSystemPowerKwp,
            solarAnnualGenerationKwh: spaceSubmissions.solarAnnualGenerationKwh,
            solarSelfConsumptionPercent: spaceSubmissions.solarSelfConsumptionPercent,
            solarExportPercent: spaceSubmissions.solarExportPercent,
            solarGridTariffCopPerKwh: spaceSubmissions.solarGridTariffCopPerKwh,
          })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, id))
          .limit(1);
        if (!previousSubmission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulación no encontrada" });
        }

        const cleanFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateFields)) {
          if (value !== undefined) {
            cleanFields[key] = value;
          }
        }
        if (cleanFields.electricalDistance === undefined && electricalDistanceM !== undefined) {
          cleanFields.electricalDistance = electricalDistanceM;
        }
        if (cleanFields.hasSolarPanels !== undefined) {
          cleanFields.hasSolarPanels = cleanFields.hasSolarPanels ? 1 : 0;
        }
        if (cleanFields.openSolarProjectId !== undefined) {
          const openSolarProjectId = String(cleanFields.openSolarProjectId).trim();
          cleanFields.openSolarProjectId = openSolarProjectId || null;
          cleanFields.openSolarProjectImportedAt = openSolarProjectId ? toSqlTimestamp() : null;
          if (!openSolarProjectId) cleanFields.openSolarProjectTitle = null;
        }
        const solarProgramFields = [
          "solarProgramEnabled", "solarProgramCurrentBillCop", "solarProgramSavingsCoveragePercent",
          "solarProgramAgreementYears", "solarProgramAnnualCpiPercent", "solarProgramUsefulLifeYears",
          "solarSystemPowerKwp", "solarAnnualGenerationKwh", "solarSelfConsumptionPercent",
          "solarExportPercent", "solarGridTariffCopPerKwh",
        ];
        const solarProgramChanged = solarProgramFields.some((field) => cleanFields[field] !== undefined);
        if (solarProgramChanged) {
          const nextEnabled = cleanFields.solarProgramEnabled === undefined
            ? Number(previousSubmission.solarProgramEnabled) === 1
            : Boolean(cleanFields.solarProgramEnabled);
          let solarProgram: ReturnType<typeof buildAllySolarProgram> = null;
          try {
            solarProgram = buildAllySolarProgram({
              enabled: nextEnabled,
              currentMonthlyBillCop: cleanFields.solarProgramCurrentBillCop ?? previousSubmission.solarProgramCurrentBillCop,
              savingsCoveragePercent: cleanFields.solarProgramSavingsCoveragePercent ?? previousSubmission.solarProgramSavingsCoveragePercent,
              agreementYears: cleanFields.solarProgramAgreementYears ?? previousSubmission.solarProgramAgreementYears,
              annualCpiPercent: cleanFields.solarProgramAnnualCpiPercent ?? previousSubmission.solarProgramAnnualCpiPercent,
              usefulLifeYears: cleanFields.solarProgramUsefulLifeYears ?? previousSubmission.solarProgramUsefulLifeYears,
              systemPowerKwp: cleanFields.solarSystemPowerKwp ?? previousSubmission.solarSystemPowerKwp,
              annualGenerationKwh: cleanFields.solarAnnualGenerationKwh ?? previousSubmission.solarAnnualGenerationKwh,
              selfConsumptionPercent: cleanFields.solarSelfConsumptionPercent ?? previousSubmission.solarSelfConsumptionPercent,
              exportPercent: cleanFields.solarExportPercent ?? previousSubmission.solarExportPercent,
              gridTariffCopPerKwh: cleanFields.solarGridTariffCopPerKwh ?? previousSubmission.solarGridTariffCopPerKwh,
            });
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Revisa los datos del programa solar." });
          }
          if (!solarProgram) {
            cleanFields.solarProgramEnabled = 0;
            // La desactivación del programa impide proyectar ahorro, pero no
            // puede borrar el diseño, consumo o factura importados. Esos datos
            // quedan como referencia pendiente de aprobación humana.
          } else {
            cleanFields.solarProgramEnabled = 1;
            cleanFields.solarProgramCurrentBillCop = solarProgram.assumptions.currentMonthlyBillCop;
            cleanFields.solarProgramSavingsCoveragePercent = solarProgram.assumptions.savingsCoveragePercent;
            cleanFields.solarProgramAgreementYears = solarProgram.assumptions.agreementYears;
            cleanFields.solarProgramAnnualCpiPercent = solarProgram.assumptions.annualCpiPercent;
            cleanFields.solarProgramUsefulLifeYears = solarProgram.assumptions.usefulLifeYears;
            cleanFields.solarSystemPowerKwp = solarProgram.assumptions.systemPowerKwp;
            cleanFields.solarAnnualGenerationKwh = solarProgram.assumptions.annualGenerationKwh;
            cleanFields.solarSelfConsumptionPercent = solarProgram.assumptions.selfConsumptionPercent;
            cleanFields.solarExportPercent = solarProgram.assumptions.exportPercent;
            cleanFields.solarGridTariffCopPerKwh = solarProgram.assumptions.gridTariffCopPerKwh;
          }
        }
        if (cleanFields.estimatedPowerKw !== undefined && cleanFields.estimatedPowerKw < 120) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "EVGreen solo instala cargadores rápidos DC desde 120 kW." });
        }
        const numericProjectionInputChanged = [
          "estimatedInvestmentCop",
          "estimatedPowerKw",
          "estimatedChargerCount",
          "estimatedDailyVehicles",
          "estimatedEvPercent",
          "hasSolarPanels",
          "solarCoveragePercent",
          "solarEnergyCostPerKwh",
        ].some((field) => cleanFields[field] !== undefined && Number(cleanFields[field]) !== Number(previousSubmission[field as keyof typeof previousSubmission]));
        const operatingProjectionInputChanged = ["operatingHoursStart", "operatingHoursEnd", "is24Hours"]
          .some((field) => cleanFields[field] !== undefined && String(cleanFields[field]) !== String(previousSubmission[field as keyof typeof previousSubmission]));
        const projectionInputChanged = numericProjectionInputChanged || operatingProjectionInputChanged;
        if (
          cleanFields.estimatedInvestmentCop !== undefined ||
          cleanFields.minimumInvestmentCop !== undefined ||
          cleanFields.estimatedRoiPercent !== undefined ||
          cleanFields.estimatedPaybackMonths !== undefined
        ) {
          cleanFields.financialProjectionUpdatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
          cleanFields.financialProjectionUpdatedBy = ctx.user.id;
        }

        // Manejar transformador nuevo: merge en technicalNotes como JSON
        if (requiresNewTransformer !== undefined || proposedTransformerKva !== undefined) {
          // Leer technicalNotes actual
          const [current] = await db.select({ technicalNotes: spaceSubmissions.technicalNotes })
            .from(spaceSubmissions).where(eq(spaceSubmissions.id, id)).limit(1);
          let notesData: any = {};
          try {
            if (current?.technicalNotes) notesData = JSON.parse(current.technicalNotes);
          } catch { notesData = { text: current?.technicalNotes || "" }; }
          if (requiresNewTransformer !== undefined) notesData.requiresNewTransformer = requiresNewTransformer;
          if (proposedTransformerKva !== undefined) notesData.proposedTransformerKva = proposedTransformerKva;
          cleanFields.technicalNotes = JSON.stringify(notesData);
        }

        if (Object.keys(cleanFields).length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No se proporcionaron campos para actualizar" });
        }

        const previousHasSolarPanels = Number(previousSubmission.hasSolarPanels) === 1;
        const nextHasSolarPanels = cleanFields.hasSolarPanels === undefined
          ? previousHasSolarPanels
          : Number(cleanFields.hasSolarPanels) === 1;
        const solarConfigurationChanged = (cleanFields.hasSolarPanels !== undefined && previousHasSolarPanels !== nextHasSolarPanels)
          || (cleanFields.solarCoveragePercent !== undefined && Number(cleanFields.solarCoveragePercent) !== Number(previousSubmission.solarCoveragePercent ?? 0))
          || (cleanFields.solarEnergyCostPerKwh !== undefined && (previousSubmission.solarEnergyCostPerKwh === null || Number(cleanFields.solarEnergyCostPerKwh) !== Number(previousSubmission.solarEnergyCostPerKwh)));
        await db.transaction(async (tx: any) => {
          await tx.update(spaceSubmissions)
            .set(cleanFields)
            .where(eq(spaceSubmissions.id, id));

          if (solarConfigurationChanged) {
            await tx.insert(spaceSolarScopeHistory).values({
              submissionId: id,
              previousHasSolarPanels: previousHasSolarPanels ? 1 : 0,
              nextHasSolarPanels: nextHasSolarPanels ? 1 : 0,
              previousSolarCoveragePercent: previousSubmission.solarCoveragePercent ?? 0,
              nextSolarCoveragePercent: cleanFields.solarCoveragePercent ?? previousSubmission.solarCoveragePercent ?? 0,
              previousSolarEnergyCostPerKwh: previousSubmission.solarEnergyCostPerKwh ?? null,
              nextSolarEnergyCostPerKwh: cleanFields.solarEnergyCostPerKwh ?? previousSubmission.solarEnergyCostPerKwh ?? null,
              changedById: ctx.user.id,
              changedByRole: ctx.user.role,
              changeSource: "ADMIN_EDIT",
            } as any);
          }
        });

        if (solarOfferPdf) {
          try {
            const pdfBuffer = Buffer.from(solarOfferPdf.base64.replace(/^data:application\/pdf;base64,/, ""), "base64");
            if (pdfBuffer.length === 0 || pdfBuffer.length > 20 * 1024 * 1024 || pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
              throw new Error("El archivo no parece ser un PDF válido o supera 20 MB.");
            }
            const [spaceForOffer] = await db.select({ code: spaceSubmissions.code })
              .from(spaceSubmissions).where(eq(spaceSubmissions.id, id)).limit(1);
            const fileKey = `spaces/${spaceForOffer?.code || id}/solar-offer/${Date.now()}-${safePdfSegment(solarOfferPdf.fileName)}.pdf`;
            const uploaded = await storagePut(fileKey, pdfBuffer, "application/pdf");
            await db.update(spaceSubmissions).set({
              solarOfferPdfUrl: uploaded.url,
              solarOfferPdfKey: fileKey,
              solarOfferPdfName: solarOfferPdf.fileName,
            }).where(eq(spaceSubmissions.id, id));
          } catch (error) {
            console.error("[Spaces] Error uploading solar offer PDF in update:", error);
            throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible guardar la oferta solar PDF." });
          }
        }

        let updatedSubmission: any;
        if (projectionInputChanged) {
          const [submissionForProjection] = await db
            .select()
            .from(spaceSubmissions)
            .where(eq(spaceSubmissions.id, id))
            .limit(1);
          const [currentProject] = submissionForProjection?.crowdfundingProjectId
            ? await db
              .select()
              .from(crowdfundingProjects)
              .where(eq(crowdfundingProjects.id, submissionForProjection.crowdfundingProjectId))
              .limit(1)
            : [];
          const projection = submissionForProjection
            ? await buildSpaceCrowdfundingProjection({
              investmentCop: Number(submissionForProjection.estimatedInvestmentCop ?? 0),
              totalPowerKw: Number(submissionForProjection.estimatedPowerKw ?? 0),
              spaceType: submissionForProjection.spaceType,
              estimatedDailyVehicles: Number(submissionForProjection.estimatedDailyVehicles ?? 0),
              estimatedEvPercent: Number(submissionForProjection.estimatedEvPercent ?? 0),
              chargerCount: Number(submissionForProjection.estimatedChargerCount ?? 0),
              operatingHoursStart: submissionForProjection.operatingHoursStart,
              operatingHoursEnd: submissionForProjection.operatingHoursEnd,
              is24Hours: submissionForProjection.is24Hours,
              hasSolarPanels: submissionForProjection.hasSolarPanels,
              solarCoveragePercent: Number(submissionForProjection.solarCoveragePercent ?? 0),
              solarEnergyCostPerKwh: submissionForProjection.solarEnergyCostPerKwh === null ? null : Number(submissionForProjection.solarEnergyCostPerKwh),
              currentProject,
            })
            : null;

          if (projection) {
            await db.update(spaceSubmissions)
              .set({
                estimatedRoiPercent: sanitizeProjectionRoi(projection.selected.roiAnnualPercent),
                estimatedPaybackMonths: sanitizeProjectionPayback(projection.selected.paybackMonths),
                financialProjectionUpdatedAt: toSqlTimestamp(),
                financialProjectionUpdatedBy: ctx.user.id,
              })
              .where(eq(spaceSubmissions.id, id));
            if (submissionForProjection?.crowdfundingProjectId) {
              await db.update(crowdfundingProjects)
                .set({
                  financialProjectionSnapshot: JSON.stringify(projection.snapshot),
                  selectedFinancialScenario: projection.selectedScenario,
                  hostSharePercent: String(projection.snapshot.assumptions.hostSharePercent),
                  investorSharePercent: String(projection.investorSharePercent),
                  evgreenSharePercent: String(projection.evgreenSharePercent),
                } as any)
                .where(eq(crowdfundingProjects.id, submissionForProjection.crowdfundingProjectId));
            }
          }
        }

        const inheritedFields = [
          "spaceName", "address", "city", "department", "latitude", "longitude",
          "estimatedInvestmentCop", "minimumInvestmentCop", "estimatedRoiPercent",
          "estimatedPaybackMonths", "estimatedPowerKw", "estimatedChargerCount",
          "estimatedDailyVehicles", "estimatedEvPercent", "recommendedChargerType",
          "technicalScore", "technicalNotes", "aiScore", "aiAnalysis", "hasSolarPanels",
          "solarCoveragePercent", "solarEnergyCostPerKwh",
        ];
        if (inheritedFields.some((field) => cleanFields[field] !== undefined)) {
          [updatedSubmission] = await db
            .select()
            .from(spaceSubmissions)
            .where(eq(spaceSubmissions.id, id))
            .limit(1);

          if (updatedSubmission?.crowdfundingProjectId) {
					const inheritedPhotos = await db.select({
						submissionId: spacePhotos.submissionId, url: spacePhotos.photoUrl, type: spacePhotos.photoType,
						caption: spacePhotos.caption, sortOrder: spacePhotos.sortOrder,
					}).from(spacePhotos).where(eq(spacePhotos.submissionId, id)).orderBy(spacePhotos.sortOrder);
	            const projectUpdate = buildCrowdfundingProjectInheritanceUpdate(updatedSubmission, inheritedPhotos);

            await db.update(crowdfundingProjects)
              .set(projectUpdate as any)
              .where(eq(crowdfundingProjects.id, updatedSubmission.crowdfundingProjectId));
          }
        }

        return { success: true };
      }),

    // ========================================================================
    // ADMIN: Eliminar un espacio y sus fotos
    // ========================================================================
    deleteSpace: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();

        const [submission] = await db
          .select({ id: spaceSubmissions.id, spaceName: spaceSubmissions.spaceName })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);

        if (!submission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Postulaci\u00f3n no encontrada" });
        }

        await db.delete(investorLeads).where(eq(investorLeads.spaceId, input.id));
        await db.delete(spacePhotos).where(eq(spacePhotos.submissionId, input.id));
        await db.delete(spaceSubmissions).where(eq(spaceSubmissions.id, input.id));

        return { success: true, deletedName: submission.spaceName };
      }),

    // ========================================================================
    // ADMIN: Agregar fotos a un espacio existente
    // ========================================================================
    addPhotos: adminProcedure
      .input(z.object({
        id: z.number(),
	        photos: z.array(z.object({
	          base64: z.string(),
	          fileName: z.string(),
	          contentType: z.string(),
	          photoType: z.enum(["general", "electrical_panel", "transformer", "parking_area", "access_road", "surroundings", "other"]).optional(),
	          caption: z.string().optional(),
	          isCover: z.boolean().optional(),
	          isConceptual: z.boolean().optional(),
	        })).min(1).max(20),
	      }))
	      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const [submission] = await db
          .select({ id: spaceSubmissions.id, code: spaceSubmissions.code })
          .from(spaceSubmissions)
          .where(eq(spaceSubmissions.id, input.id))
          .limit(1);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado" });

        let uploadedCount = 0;
        for (let i = 0; i < input.photos.length; i++) {
          const photo = input.photos[i];
          try {
            const buffer = Buffer.from(photo.base64, "base64");
            if (buffer.length > 10 * 1024 * 1024) continue;
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const ext = photo.fileName.split(".").pop() || "jpg";
            const fileKey = `spaces/${submission.code}/${Date.now()}-${randomSuffix}.${ext}`;
	            const { url } = await storagePut(fileKey, buffer, photo.contentType || "image/jpeg");
	            if (photo.isCover) {
	              await db.update(spacePhotos).set({ isCover: 0 }).where(eq(spacePhotos.submissionId, input.id));
	            }
	            await db.insert(spacePhotos).values({
	              submissionId: input.id,
	              photoUrl: url,
	              photoKey: fileKey,
	              caption: photo.caption || null,
	              photoType: photo.photoType || "general",
	              sortOrder: i,
	              isCover: photo.isCover ? 1 : 0,
	              isConceptual: photo.isConceptual ? 1 : 0,
	            });
	            uploadedCount++;
          } catch (err) {
            console.error(`[Spaces] Error uploading photo ${i}:`, err);
          }
        }
	        return { success: true, uploadedCount };
	      }),

	    // ========================================================================
	    // ADMIN: Establecer foto de portada principal del espacio
	    // ========================================================================
	    setCoverPhoto: adminProcedure
	      .input(z.object({
	        submissionId: z.number(),
	        photoId: z.number(),
	      }))
	      .mutation(async ({ input }) => {
	        const db = await getDatabase();
	        await db.update(spacePhotos)
	          .set({ isCover: 0 })
	          .where(eq(spacePhotos.submissionId, input.submissionId));
	        await db.update(spacePhotos)
	          .set({ isCover: 1 })
	          .where(and(eq(spacePhotos.id, input.photoId), eq(spacePhotos.submissionId, input.submissionId)));
	        return { success: true };
	      }),

	    // ========================================================================
	    // ADMIN: Alternar etiqueta de render / ilustración conceptual
	    // ========================================================================
	    toggleConceptualPhoto: adminProcedure
	      .input(z.object({
	        submissionId: z.number(),
	        photoId: z.number(),
	        isConceptual: z.boolean(),
	      }))
	      .mutation(async ({ input }) => {
	        const db = await getDatabase();
	        await db.update(spacePhotos)
	          .set({ isConceptual: input.isConceptual ? 1 : 0 })
	          .where(and(eq(spacePhotos.id, input.photoId), eq(spacePhotos.submissionId, input.submissionId)));
	        return { success: true };
	      }),

	    // ========================================================================
	    // ADMIN: Clasificar una foto por su tipo técnico
	    // ========================================================================
	    updatePhotoType: adminProcedure
	      .input(z.object({
	        submissionId: z.number(),
	        photoId: z.number(),
	        photoType: z.enum(["general", "electrical_panel", "transformer", "parking_area", "access_road", "surroundings", "other"]),
	      }))
	      .mutation(async ({ input }) => {
	        const db = await getDatabase();
	        await db.update(spacePhotos)
	          .set({ photoType: input.photoType })
	          .where(and(eq(spacePhotos.id, input.photoId), eq(spacePhotos.submissionId, input.submissionId)));
	        return { success: true };
	      }),

	    // ========================================================================
	    // ADMIN: Eliminar múltiples espacios en masa
	    // ========================================================================
    bulkDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const { ids } = input;

        // Eliminar leads, fotos y submissions en masa
        await db.delete(investorLeads).where(inArray(investorLeads.spaceId, ids));
        await db.delete(spacePhotos).where(inArray(spacePhotos.submissionId, ids));
        await db.delete(spaceSubmissions).where(inArray(spaceSubmissions.id, ids));

        return { success: true, deletedCount: ids.length };
      }),

    // ========================================================================
    // ADMIN: Cambiar estado de múltiples espacios en masa
    // ========================================================================
    bulkUpdateStatus: adminProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(500),
        status: z.enum([
          "pending", "under_review", "approved", "rejected",
          "letter_sent", "letter_accepted", "published",
          "funded", "in_construction", "operational",
        ]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();
        const { ids, status } = input;

        const currentSubmissions = await db.select({
          id: spaceSubmissions.id,
          spaceStatus: spaceSubmissions.spaceStatus,
        }).from(spaceSubmissions).where(inArray(spaceSubmissions.id, ids));

        const updateData: any = { spaceStatus: status };
        if (["under_review", "approved", "rejected"].includes(status)) {
          updateData.evaluatedBy = ctx.user.id;
          updateData.evaluatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        }

        await db.update(spaceSubmissions)
          .set(updateData)
          .where(inArray(spaceSubmissions.id, ids));

        await Promise.all(currentSubmissions.map((submission) => recordSpaceStatusChange(db, {
          submissionId: submission.id,
          fromStatus: submission.spaceStatus as SpacePipelineStatus,
          toStatus: status as SpacePipelineStatus,
          changedById: ctx.user.id,
          changedByRole: ctx.user.role,
          note: "Actualización masiva desde administración.",
        })));

        return { success: true, updatedCount: currentSubmissions.length };
      }),

    // ========================================================================
    // ADMIN: Asignar score manual a múltiples espacios en masa
    // ========================================================================
    bulkAssignScore: adminProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(500),
        technicalScore: z.number().int().min(0).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();
        const { ids, technicalScore } = input;

        await db.update(spaceSubmissions)
          .set({
            technicalScore,
            evaluatedBy: ctx.user.id,
            evaluatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
          .where(inArray(spaceSubmissions.id, ids));

        return { success: true, updatedCount: ids.length };
      }),

    // ========================================================================
    // ADMIN: Listar leads de inversionistas
    // ========================================================================
    listLeads: adminProcedure
      .input(z.object({
        spaceId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDatabase();
        const limit = input?.limit || 50;
        const offset = input?.offset || 0;

        let conditions: any[] = [];
        if (input?.spaceId) {
          conditions.push(eq(investorLeads.spaceId, input.spaceId));
        }
        if (input?.status && input.status !== "all") {
          conditions.push(eq(investorLeads.leadStatus, input.status as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [leads, [totalResult]] = await Promise.all([
          db
            .select()
            .from(investorLeads)
            .where(whereClause)
            .orderBy(desc(investorLeads.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(investorLeads)
            .where(whereClause),
        ]);

        return { leads, total: totalResult?.count || 0 };
      }),

    // ========================================================================
    // ADMIN: Actualizar estado/notas de un lead
    // ========================================================================
    updateLead: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "converted", "discarded"]).optional(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const { id, ...updateFields } = input;

        const cleanFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateFields)) {
          if (value !== undefined) cleanFields[key] = value;
        }

        if (Object.keys(cleanFields).length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No se proporcionaron campos para actualizar" });
        }

        await db.update(investorLeads)
          .set(cleanFields)
          .where(eq(investorLeads.id, id));

        return { success: true };
      }),
  }),

  // ========================================================================
  // P\u00daBLICO: Incrementar contador de visitas de un espacio
  // ========================================================================
  incrementView: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.update(spaceSubmissions)
        .set({ viewCount: sql`${spaceSubmissions.viewCount} + 1` })
        .where(eq(spaceSubmissions.id, input.id));
      return { success: true };
    }),

  // ========================================================================
  // P\u00daBLICO: Enviar formulario de contacto de inversionista (lead)
  // ========================================================================
  submitLead: publicProcedure
    .input(z.object({
      spaceId: z.number(),
      name: z.string().min(2, "El nombre es requerido"),
      email: z.string().email("Email inv\u00e1lido"),
      phone: z.string().optional(),
      interestedAmount: z.number().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const [space] = await db
        .select({ id: spaceSubmissions.id, spaceName: spaceSubmissions.spaceName, spaceStatus: spaceSubmissions.spaceStatus })
        .from(spaceSubmissions)
        .where(eq(spaceSubmissions.id, input.spaceId))
        .limit(1);

      if (!space || !["published", "funded", "in_construction", "operational"].includes(space.spaceStatus)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado o no disponible" });
      }

      await db.insert(investorLeads).values({
        spaceId: input.spaceId,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        interestedAmount: input.interestedAmount || null,
        message: input.message || null,
        leadStatus: "new",
      });

      // Notificar al admin
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Nuevo lead de inversionista - ${space.spaceName}`,
          content: `${input.name} (${input.email}) est\u00e1 interesado en invertir en "${space.spaceName}".${input.interestedAmount ? ` Monto interesado: $${input.interestedAmount.toLocaleString("es-CO")} COP.` : ""}${input.message ? ` Mensaje: ${input.message}` : ""}`,
        });
      } catch (err) {
        console.error("[Spaces] Error notifying owner about lead:", err);
      }

      // Enviar email de confirmaci\u00f3n al inversionista
      try {
        const resend = await getResendClient();
        const emailParams = buildEmailParams({
          from: "EVGreen <admin@evgreen.lat>",
          to: input.email,
          subject: `Gracias por tu inter\u00e9s en ${space.spaceName} | EVGreen`,
          html: generateLeadConfirmationHTML({ name: input.name, spaceName: space.spaceName }),
          replyTo: "gerencia@greenhproject.com",
        });
        await resend.emails.send({ ...emailParams, cc: "gerencia@greenhproject.com" });
      } catch (err) {
        console.error("[Spaces] Error sending lead confirmation email:", err);
      }

      return { success: true };
    }),

  // ============================================================
  // GENERAR PROSPECTO DE INVERSIÓN PDF
  // ============================================================
  generateProspectoPdf: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      allySharePercent: z.number().min(0).max(50).default(10),
      investorSharePercent: z.number().min(1).max(99).default(70),
      platformSharePercent: z.number().min(1).max(99).default(30),
      installedPowerKw: z.number().positive().max(5000).optional(),
      tarifaKwhCop: z.number().positive().max(10000).optional(),
      energyCostPerKwhCop: z.number().min(0).max(10000).optional(),
      fixedMonthlyExpensesCop: z.number().min(0).max(100000000).default(0),
      capexIncludesGridUpgrade: z.boolean().default(false),
      technicalConditionNote: z.string().trim().max(2000).optional(),
    }).refine(
      data => Math.abs(data.investorSharePercent + data.platformSharePercent - 100) < 0.001,
      { message: "La participación de Inversionista y EVGreen debe sumar exactamente 100 % del margen neto" },
    ))
    .mutation(async ({ input, ctx }) => {
      // Solo admins pueden generar prospectos
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden generar prospectos" });
      }

      const db = (await getDb())!;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      // Obtener datos del espacio
      const [submission] = await db.select().from(spaceSubmissions)
        .where(eq(spaceSubmissions.id, input.submissionId))
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado" });
      }

      // Obtener TODAS las fotos (sin límite)
      const photos = await db.select().from(spacePhotos)
        .where(eq(spacePhotos.submissionId, input.submissionId))
        .orderBy(spacePhotos.sortOrder);

      // Parsear análisis IA
      let aiData: any = null;
      if (submission.aiAnalysis) {
        try { aiData = JSON.parse(submission.aiAnalysis as string); } catch { /* ignore */ }
      }

	      // Construir un escenario auditable con la tarifa vigente y con la condición eléctrica explícita.
	      const platformSettings = await getPlatformSettings();
	      const requestedPowerKw = input.installedPowerKw ?? Number(submission.estimatedPowerKw ?? 0);
	      const technicalCondition = resolveProspectoTechnicalCondition({
	        totalPowerKw: requestedPowerKw,
	        transformerCapacityKva: submission.transformerCapacityKva ? Number(submission.transformerCapacityKva) : null,
	        electricalViability: submission.electricalViability,
	      });
	      const technicalConditionNote = buildProspectoGridUpgradeNote(
	        submission.technicalNotes,
	        input.technicalConditionNote,
	      );
	      const revenueDistribution = getRevenueDistributionForSpaceType(submission.spaceType);
	      try {
	        assertProspectoFinancialScenarioIsDocumented({
	          technicalCondition,
	          capexIncludesGridUpgrade: input.capexIncludesGridUpgrade,
	          technicalConditionNote,
	        });
	      } catch (error) {
	        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "La condición técnica debe documentarse" });
	      }
	      const { generateProspectoPdf } = await import("./prospecto-pdf-service");
      const pdfBuffer = await generateProspectoPdf({
        code: submission.code,
        spaceName: submission.spaceName,
        spaceType: submission.spaceType,
        spaceTypeOther: submission.spaceTypeOther,
        address: submission.address,
        city: submission.city,
        department: submission.department ?? undefined,
        country: submission.country,
        latitude: submission.latitude ? parseFloat(submission.latitude as string) : null,
        longitude: submission.longitude ? parseFloat(submission.longitude as string) : null,
        availableAreaM2: submission.availableAreaM2 ? parseFloat(submission.availableAreaM2 as string) : null,
        parkingSpots: submission.parkingSpots,
        transformerCapacityKva: submission.transformerCapacityKva ? parseFloat(submission.transformerCapacityKva as string) : null,
        hasElectricalPanel: !!submission.hasElectricalPanel,
        electricalDistance: submission.electricalDistance,
        hasInternet: !!submission.hasInternet,
        operatingHoursStart: submission.operatingHoursStart,
        operatingHoursEnd: submission.operatingHoursEnd,
        is24Hours: !!submission.is24Hours,
        estimatedDailyVehicles: submission.estimatedDailyVehicles,
        estimatedEvPercent: submission.estimatedEvPercent,
        nearbyAttractions: submission.nearbyAttractions,
        socioeconomicStratum: submission.socioeconomicStratum,
        aiScore: submission.aiScore,
        aiAnalysis: submission.aiAnalysis as string | null,
        estimatedInvestmentCop: submission.estimatedInvestmentCop ? parseFloat(String(submission.estimatedInvestmentCop)) : null,
        estimatedPowerKw: submission.estimatedPowerKw ? parseFloat(String(submission.estimatedPowerKw)) : null,
        estimatedChargerCount: submission.estimatedChargerCount,
        hasSolarPanels: Number(submission.hasSolarPanels) === 1,
        solarCoveragePercent: Number(submission.solarCoveragePercent ?? 0),
        solarEnergyCostPerKwh: submission.solarEnergyCostPerKwh === null ? null : Number(submission.solarEnergyCostPerKwh),
        allySharePercent: input.allySharePercent,
	        investorSharePercent: revenueDistribution.investorSharePercent,
	        platformSharePercent: revenueDistribution.evgreenSharePercent,
	        installedPowerKw: requestedPowerKw,
	        tarifaKwhCop: input.tarifaKwhCop ?? Number(platformSettings?.precioVentaDefault ?? 1800),
	        energyCostPerKwhCop: input.energyCostPerKwhCop ?? Number(platformSettings?.costoEnergiaRed ?? 850),
	        efficiencyPercent: Number(platformSettings?.eficienciaCargaDc ?? 92),
	        fixedMonthlyExpensesCop: input.fixedMonthlyExpensesCop,
		        technicalCondition,
		        capexIncludesGridUpgrade: input.capexIncludesGridUpgrade,
		        technicalConditionNote,
	        photos: photos.map(p => ({
	          url: p.photoUrl,
	          type: p.photoType,
	          caption: p.caption,
	          isCover: Boolean(p.isCover),
	          isConceptual: Boolean(p.isConceptual),
	        })),
	        generatedAt: new Date(),
	      });

      // Subir a S3
      const { storagePut } = await import("../storage");
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `spaces/prospectos/${submission.code}-prospecto-${randomSuffix}.pdf`;
      const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      console.log(`[Spaces] Prospecto PDF generado: ${pdfUrl}`);
      return { success: true, pdfUrl, fileName: `Prospecto-${submission.code}-${submission.city}.pdf` };
    }),

  // ============================================================
  // FICHA TÉCNICA/COMERCIAL DEL ALIADO — SIN DATOS DE INVERSIÓN
  // ============================================================
  generateAllySpacePdf: adminProcedure
    .input(z.object({ submissionId: z.number() }))
    .mutation(async ({ input }) => generateAllySpacePdfForSubmission(input.submissionId)),

  /**
   * Descarga pública controlada para el aliado que ya firmó la carta.
   * El token no se acepta mientras la carta siga pendiente y la ficha nunca
   * incluye la información financiera reservada al inversionista.
   */
  downloadAllySpacePdf: publicProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [submission] = await db.select({
        id: spaceSubmissions.id,
        letterAcceptedAt: spaceSubmissions.letterAcceptedAt,
        spaceStatus: spaceSubmissions.spaceStatus,
      })
        .from(spaceSubmissions)
        .where(eq(spaceSubmissions.letterToken, input.token))
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enlace de aliado inválido o expirado" });
      }
      if (!submission.letterAcceptedAt || submission.spaceStatus === "letter_sent") {
        throw new TRPCError({ code: "FORBIDDEN", message: "La ficha del aliado estará disponible después de firmar la carta de intención" });
      }

      return generateAllySpacePdfForSubmission(submission.id);
    }),
});

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export function generateLetterEmailHTML(params: {
  submitterName: string;
  spaceName: string;
  city: string;
  address: string;
  spaceType: string;
  acceptUrl: string;
  code: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carta de Intención - EVGreen</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-background { padding: 16px 0 !important; }
      .email-shell { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .email-header { padding: 24px 20px !important; }
      .email-content { padding: 28px 20px !important; }
      .email-footer { padding: 20px !important; }
      .email-title { font-size: 24px !important; }
      .detail-label { width: 36% !important; }
      .cta-link { display: block !important; padding: 15px 14px !important; font-size: 15px !important; }
      .acceptance-url { display: inline-block !important; max-width: 280px !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-background" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-shell" style="width:100%;max-width:600px;background-color:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
          <!-- Header -->
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg,#065f46,#047857,#10b981);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                ⚡ EVGreen
              </h1>
              <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">
                Infraestructura de Carga para Vehículos Eléctricos
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="email-content" style="padding:40px;">
              <h2 class="email-title" style="color:#10b981;margin:0 0 24px;font-size:22px;font-weight:600;">
                Carta de Intención
              </h2>

              <p style="color:#e5e7eb;font-size:16px;line-height:1.6;margin:0 0 16px;">
                Estimado(a) <strong style="color:#ffffff;">${params.submitterName}</strong>,
              </p>

              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Nos complace informarle que su postulación de espacio ha sido <strong style="color:#10b981;">aprobada</strong> por nuestro equipo técnico. Hemos evaluado las condiciones de su espacio y consideramos que es un excelente candidato para la instalación de infraestructura de carga de vehículos eléctricos.
              </p>

              <!-- Space Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1f2937;border-radius:12px;margin:0 0 24px;border:1px solid #374151;">
                <tr>
                  <td style="padding:20px;">
                    <p style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
                      Detalles del Espacio
                    </p>
                    <table width="100%" cellpadding="4" cellspacing="0">
                      <tr>
                        <td class="detail-label" style="color:#9ca3af;font-size:14px;width:40%;">Código:</td>
                        <td style="color:#ffffff;font-size:14px;font-weight:600;">${params.code}</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:14px;">Nombre:</td>
                        <td style="color:#ffffff;font-size:14px;">${params.spaceName}</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:14px;">Tipo:</td>
                        <td style="color:#ffffff;font-size:14px;">${params.spaceType}</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:14px;">Ciudad:</td>
                        <td style="color:#ffffff;font-size:14px;">${params.city}</td>
                      </tr>
                      <tr>
                        <td style="color:#9ca3af;font-size:14px;">Dirección:</td>
                        <td style="color:#ffffff;font-size:14px;">${params.address}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Para continuar con el proceso, necesitamos que firme digitalmente la <strong style="color:#ffffff;">Carta de Intención</strong>. Este documento formaliza su interés en participar como aliado comercial en la red de carga EVGreen y establece los términos preliminares de la colaboración.
              </p>

              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 32px;">
                Al firmar, usted acepta que EVGreen realice los estudios técnicos necesarios y publique su espacio en nuestra plataforma de inversión para atraer capital que financie la instalación de los cargadores.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.acceptUrl}" class="cta-link" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                      ✍️ Firmar Carta de Intención
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center;">
                Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="${params.acceptUrl}" class="acceptance-url" style="color:#10b981;word-break:break-word;overflow-wrap:anywhere;">${params.acceptUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color:#0d1117;padding:24px 40px;border-top:1px solid #1f2937;">
              <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;text-align:center;">
                Este correo fue enviado por EVGreen, una línea de negocio de Green House Project SAS.<br>
                NIT 901.447.678-0 | Bogotá, Colombia<br>
                <a href="https://evgreen.lat" style="color:#10b981;">evgreen.lat</a> | 
                <a href="mailto:gerencia@greenhproject.com" style="color:#10b981;">gerencia@greenhproject.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateLeadConfirmationHTML(params: { name: string; spaceName: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gracias por tu interés - EVGreen</title></head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
          <tr>
            <td style="background:linear-gradient(135deg,#065f46,#047857,#10b981);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">⚡ EVGreen</h1>
              <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">Infraestructura de Carga para Vehículos Eléctricos</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#10b981;margin:0 0 24px;font-size:22px;font-weight:600;">¡Gracias por tu interés!</h2>
              <p style="color:#e5e7eb;font-size:16px;line-height:1.6;margin:0 0 16px;">
                Hola <strong style="color:#ffffff;">${params.name}</strong>,
              </p>
              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Hemos recibido tu solicitud de información sobre el espacio <strong style="color:#10b981;">"${params.spaceName}"</strong>. Nuestro equipo de inversiones se pondrá en contacto contigo en las próximas 24-48 horas hábiles para brindarte toda la información detallada sobre esta oportunidad de inversión.
              </p>
              <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Mientras tanto, te invitamos a explorar otros espacios disponibles en nuestra plataforma.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://evgreen.lat/investors" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;">
                      Ver Oportunidades de Inversión
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d1117;padding:24px 40px;border-top:1px solid #1f2937;">
              <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;text-align:center;">
                Este email fue enviado por EVGreen, una marca de Green House Project S.A.S.<br>
                NIT 901.856.696-1 | Bogotá, Colombia<br>
                <a href="https://evgreen.lat" style="color:#10b981;">evgreen.lat</a> | 
                <a href="mailto:gerencia@greenhproject.com" style="color:#10b981;">gerencia@greenhproject.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
