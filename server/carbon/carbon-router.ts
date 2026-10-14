import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  carbonAuditEvents,
  carbonCostEntries,
  carbonCreditLots,
  carbonProgramSettings,
  carbonSolarMeterReadings,
  chargingStations,
  transactions,
} from "../../drizzle/schema";
import { calculateCarbonProgramEconomics, calculateEvDisplacementImpact, calculateSolarBackedImpact, toFiniteNumber } from "../../shared/carbon-program-calculations";
import { getDb } from "../db";

const UPME_FACTOR_SOURCE = "https://docs.upme.gov.co/Normatividad/085_2026.pdf";
const validCostType = z.enum(["FIXED", "VARIABLE_PER_TCO2E", "ONE_TIME"]);
const validPeriodicity = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]);

const settingsInput = z.object({
  country: z.string().trim().min(2).max(100),
  programName: z.string().trim().min(3).max(255),
  methodologyCode: z.string().trim().min(3).max(120),
  methodologyName: z.string().trim().min(3).max(255),
  methodologyStatus: z.enum(["DRAFT", "PRE_AUDIT", "REGISTERED", "VALIDATED", "VERIFIED"]),
  gridInventoryFactorTco2ePerMwh: z.number().min(0).max(10),
  gridInventoryFactorYear: z.number().int().min(2000).max(2100),
  gridInventoryFactorSourceUrl: z.string().url().max(500),
  solarAvoidedFactorTco2ePerMwh: z.number().min(0).max(10),
  solarAvoidedFactorYear: z.number().int().min(2000).max(2100),
  solarAvoidedFactorSourceUrl: z.string().url().max(500),
  evDisplacementEnabled: z.boolean(),
  evDisplacementFactorTco2ePerMwh: z.number().min(0).max(10).nullable(),
  evDisplacementFactorSourceUrl: z.string().url().max(500).nullable(),
  estimatedCreditPriceCopPerTco2e: z.number().min(0).max(1_000_000_000),
  registryCommissionPercent: z.number().min(0).max(100),
  minimumSellableTco2e: z.number().min(0).max(10_000_000),
  publicStatsEnabled: z.boolean(),
});

const defaultSettings = {
  country: "Colombia",
  programName: "Impacto EVGreen",
  methodologyCode: "PENDIENTE_DE_DEFINIR",
  methodologyName: "Metodología por confirmar con el programa certificador",
  methodologyStatus: "DRAFT" as const,
  gridInventoryFactorTco2ePerMwh: 0.22,
  gridInventoryFactorYear: 2024,
  gridInventoryFactorSourceUrl: UPME_FACTOR_SOURCE,
  solarAvoidedFactorTco2ePerMwh: 0.66,
  solarAvoidedFactorYear: 2024,
  solarAvoidedFactorSourceUrl: UPME_FACTOR_SOURCE,
  evDisplacementEnabled: false,
  evDisplacementFactorTco2ePerMwh: null as number | null,
  evDisplacementFactorSourceUrl: null as string | null,
  estimatedCreditPriceCopPerTco2e: 0,
  registryCommissionPercent: 0,
  minimumSellableTco2e: 0,
  publicStatsEnabled: false,
};

function serializeSettings(row: typeof carbonProgramSettings.$inferSelect | undefined) {
  if (!row) return { id: null, ...defaultSettings, isPersisted: false };
  return {
    id: row.id,
    country: row.country,
    programName: row.programName,
    methodologyCode: row.methodologyCode,
    methodologyName: row.methodologyName,
    methodologyStatus: row.methodologyStatus,
    gridInventoryFactorTco2ePerMwh: toFiniteNumber(row.gridInventoryFactorTco2ePerMwh),
    gridInventoryFactorYear: row.gridInventoryFactorYear,
    gridInventoryFactorSourceUrl: row.gridInventoryFactorSourceUrl,
    solarAvoidedFactorTco2ePerMwh: toFiniteNumber(row.solarAvoidedFactorTco2ePerMwh),
    solarAvoidedFactorYear: row.solarAvoidedFactorYear,
    solarAvoidedFactorSourceUrl: row.solarAvoidedFactorSourceUrl,
    evDisplacementEnabled: Boolean(row.evDisplacementEnabled),
    evDisplacementFactorTco2ePerMwh: row.evDisplacementFactorTco2ePerMwh === null ? null : toFiniteNumber(row.evDisplacementFactorTco2ePerMwh),
    evDisplacementFactorSourceUrl: row.evDisplacementFactorSourceUrl,
    estimatedCreditPriceCopPerTco2e: toFiniteNumber(row.estimatedCreditPriceCopPerTco2e),
    registryCommissionPercent: toFiniteNumber(row.registryCommissionPercent),
    minimumSellableTco2e: toFiniteNumber(row.minimumSellableTco2e),
    publicStatsEnabled: Boolean(row.publicStatsEnabled),
    isPersisted: true,
    updatedAt: row.updatedAt,
  };
}

function dateToIso(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function appendAuditEvent(input: {
  eventType: string;
  entityType: string;
  entityId?: number | null;
  actorUserId: number;
  actorRole: string;
  metadata?: Record<string, unknown>;
}) {
  const database = await getDb();
  if (!database) return;
  await database.insert(carbonAuditEvents).values({
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    metadata: input.metadata ?? null,
  });
}

async function loadSettings() {
  const database = await getDb();
  if (!database) return undefined;
  const rows = await database.select().from(carbonProgramSettings).orderBy(desc(carbonProgramSettings.updatedAt)).limit(1);
  return rows[0];
}

async function getMeasuredImpact(userId?: number, since?: Date) {
  const database = await getDb();
  if (!database) return { chargingKwh: 0, sessionCount: 0, verifiedSolarKwh: 0, firstObservedAt: null as string | null };
  const conditions = [eq(transactions.status, "COMPLETED"), sql`${transactions.kwhConsumed} > 0`];
  if (userId !== undefined) conditions.push(eq(transactions.userId, userId));
  if (since) conditions.push(gte(transactions.endTime, since.toISOString()));
  const charging = await database.select({
    kwh: sql<string>`COALESCE(SUM(${transactions.kwhConsumed}), 0)`,
    sessions: sql<number>`COUNT(*)`,
    firstObservedAt: sql<string | null>`MIN(${transactions.endTime})`,
  }).from(transactions).where(and(...conditions));

  const solarConditions = [eq(carbonSolarMeterReadings.verificationStatus, "VERIFIED"), lte(carbonSolarMeterReadings.periodEnd, new Date().toISOString())];
  if (since) solarConditions.push(gte(carbonSolarMeterReadings.periodEnd, since.toISOString()));
  const solar = await database.select({
    kwh: sql<string>`COALESCE(SUM(${carbonSolarMeterReadings.generationKwh}), 0)`,
  }).from(carbonSolarMeterReadings).where(and(...solarConditions));

  return {
    chargingKwh: toFiniteNumber(charging[0]?.kwh),
    sessionCount: Number(charging[0]?.sessions ?? 0),
    verifiedSolarKwh: toFiniteNumber(solar[0]?.kwh),
    firstObservedAt: charging[0]?.firstObservedAt ?? null,
  };
}

async function getMonthlyMeasuredImpact(since: Date, solarFactor: number, evDisplacement: { enabled: boolean; factor: number | null }) {
  const database = await getDb();
  if (!database) return [] as { month: string; chargingKwh: number; verifiedSolarKwh: number; solarBackedKwh: number; estimatedAvoidedTco2e: number; operationalEstimatedAvoidedTco2e: number }[];
  // Agrupar por la primera expresión seleccionada funciona con ONLY_FULL_GROUP_BY
  // sin depender de cómo Drizzle califique el nombre de columna por cláusula.
  const chargeMonth = sql<string>`DATE_FORMAT(${transactions.endTime}, '%Y-%m')`;
  const solarMonth = sql<string>`DATE_FORMAT(${carbonSolarMeterReadings.periodEnd}, '%Y-%m')`;
  const [charges, solar] = await Promise.all([
    database.select({
      month: chargeMonth,
      kwh: sql<string>`COALESCE(SUM(${transactions.kwhConsumed}), 0)`,
    }).from(transactions).where(and(
      eq(transactions.status, "COMPLETED"),
      sql`${transactions.kwhConsumed} > 0`,
      gte(transactions.endTime, since.toISOString()),
    )).groupBy(sql.raw("1")).orderBy(sql.raw("1")),
    database.select({
      month: solarMonth,
      kwh: sql<string>`COALESCE(SUM(${carbonSolarMeterReadings.generationKwh}), 0)`,
    }).from(carbonSolarMeterReadings).where(and(
      eq(carbonSolarMeterReadings.verificationStatus, "VERIFIED"),
      gte(carbonSolarMeterReadings.periodEnd, since.toISOString()),
      lte(carbonSolarMeterReadings.periodEnd, new Date().toISOString()),
    )).groupBy(sql.raw("1")).orderBy(sql.raw("1")),
  ]);

  const months = new Map<string, { chargingKwh: number; verifiedSolarKwh: number }>();
  for (const row of charges) months.set(row.month, { chargingKwh: toFiniteNumber(row.kwh), verifiedSolarKwh: months.get(row.month)?.verifiedSolarKwh ?? 0 });
  for (const row of solar) months.set(row.month, { chargingKwh: months.get(row.month)?.chargingKwh ?? 0, verifiedSolarKwh: toFiniteNumber(row.kwh) });
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({
    month,
    ...calculateSolarBackedImpact({ ...values, solarAvoidedFactorTco2ePerMwh: solarFactor }),
    operationalEstimatedAvoidedTco2e: calculateEvDisplacementImpact({
      chargingKwh: values.chargingKwh,
      enabled: evDisplacement.enabled,
      displacementFactorTco2ePerMwh: evDisplacement.factor,
    }).estimatedAvoidedTco2e,
  }));
}

async function calculateDashboard() {
  const settings = serializeSettings(await loadSettings());
  const yearAgo = new Date();
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);
  const [lifetime, yearly, monthly] = await Promise.all([
    getMeasuredImpact(),
    getMeasuredImpact(undefined, yearAgo),
    getMonthlyMeasuredImpact(yearAgo, settings.solarAvoidedFactorTco2ePerMwh, {
      enabled: settings.evDisplacementEnabled,
      factor: settings.evDisplacementFactorTco2ePerMwh,
    }),
  ]);
  const lifetimeImpact = calculateSolarBackedImpact({ ...lifetime, solarAvoidedFactorTco2ePerMwh: settings.solarAvoidedFactorTco2ePerMwh });
  const yearlyImpact = calculateSolarBackedImpact({ ...yearly, solarAvoidedFactorTco2ePerMwh: settings.solarAvoidedFactorTco2ePerMwh });
  const lifetimeOperationalImpact = calculateEvDisplacementImpact({
    chargingKwh: lifetime.chargingKwh,
    enabled: settings.evDisplacementEnabled,
    displacementFactorTco2ePerMwh: settings.evDisplacementFactorTco2ePerMwh,
  });
  const yearlyOperationalImpact = calculateEvDisplacementImpact({
    chargingKwh: yearly.chargingKwh,
    enabled: settings.evDisplacementEnabled,
    displacementFactorTco2ePerMwh: settings.evDisplacementFactorTco2ePerMwh,
  });
  const database = await getDb();
  if (!database) return { settings, lifetimeImpact, yearlyImpact, lifetimeOperationalImpact, yearlyOperationalImpact, monthly, costs: [], lots: [], economics: calculateCarbonProgramEconomics({ projectedTco2e: yearlyImpact.estimatedAvoidedTco2e, estimatedCreditPriceCopPerTco2e: settings.estimatedCreditPriceCopPerTco2e, registryCommissionPercent: settings.registryCommissionPercent, costs: [] }) };
  const [costs, lots] = await Promise.all([
    database.select().from(carbonCostEntries).orderBy(desc(carbonCostEntries.createdAt)),
    database.select().from(carbonCreditLots).orderBy(desc(carbonCreditLots.periodEnd)),
  ]);
  const economics = calculateCarbonProgramEconomics({
    projectedTco2e: yearlyImpact.estimatedAvoidedTco2e,
    estimatedCreditPriceCopPerTco2e: settings.estimatedCreditPriceCopPerTco2e,
    registryCommissionPercent: settings.registryCommissionPercent,
    costs: costs.map((cost) => ({
      amountCop: toFiniteNumber(cost.amountCop),
      costType: cost.costType,
      periodicity: cost.periodicity,
      status: cost.status,
    })),
  });
  const sellReview = settings.methodologyStatus === "VERIFIED"
    && economics.isEconomicallyViable
    && yearlyImpact.estimatedAvoidedTco2e >= settings.minimumSellableTco2e;
  return { settings, lifetimeImpact, yearlyImpact, lifetimeOperationalImpact, yearlyOperationalImpact, monthly, costs, lots, economics, sellReview };
}

export function buildCarbonRouter(router: any, publicProcedure: any, protectedProcedure: any, adminProcedure: any) {
  return router({
    publicSummary: publicProcedure.query(async () => {
      const dashboard = await calculateDashboard();
      if (!dashboard.settings.publicStatsEnabled) return { published: false };
      return {
        published: true,
        methodologyStatus: dashboard.settings.methodologyStatus,
        chargingKwh: dashboard.lifetimeImpact.chargingKwh,
        solarBackedKwh: dashboard.lifetimeImpact.solarBackedKwh,
        solarEstimatedAvoidedTco2e: dashboard.lifetimeImpact.estimatedAvoidedTco2e,
        solarFactorYear: dashboard.settings.solarAvoidedFactorYear,
        solarFactorSourceUrl: dashboard.settings.solarAvoidedFactorSourceUrl,
        operationalImpactEnabled: dashboard.lifetimeOperationalImpact.isEnabled,
        operationalEstimatedAvoidedTco2e: dashboard.lifetimeOperationalImpact.estimatedAvoidedTco2e,
        operationalFactorTco2ePerMwh: dashboard.lifetimeOperationalImpact.factorApplied,
        operationalFactorSourceUrl: dashboard.settings.evDisplacementFactorSourceUrl,
      };
    }),

    myImpact: protectedProcedure.query(async ({ ctx }: any) => {
      const settings = serializeSettings(await loadSettings());
      const [userMeasured, networkMeasured] = await Promise.all([getMeasuredImpact(ctx.user.id), getMeasuredImpact()]);
      const networkImpact = calculateSolarBackedImpact({ ...networkMeasured, solarAvoidedFactorTco2ePerMwh: settings.solarAvoidedFactorTco2ePerMwh });
      const userSolarBackedKwh = networkMeasured.chargingKwh > 0
        ? Math.min(userMeasured.chargingKwh, (userMeasured.chargingKwh / networkMeasured.chargingKwh) * networkImpact.solarBackedKwh)
        : 0;
      const userImpact = calculateSolarBackedImpact({
        chargingKwh: userMeasured.chargingKwh,
        verifiedSolarKwh: userSolarBackedKwh,
        solarAvoidedFactorTco2ePerMwh: settings.solarAvoidedFactorTco2ePerMwh,
      });
      const userOperationalImpact = calculateEvDisplacementImpact({
        chargingKwh: userMeasured.chargingKwh,
        enabled: settings.evDisplacementEnabled,
        displacementFactorTco2ePerMwh: settings.evDisplacementFactorTco2ePerMwh,
      });
      return {
        sessionCount: userMeasured.sessionCount,
        chargingKwh: userMeasured.chargingKwh,
        estimatedSolarBackedKwh: userImpact.solarBackedKwh,
        solarEstimatedAvoidedTco2e: userImpact.estimatedAvoidedTco2e,
        solarFactorYear: settings.solarAvoidedFactorYear,
        solarFactorSourceUrl: settings.solarAvoidedFactorSourceUrl,
        operationalImpactEnabled: userOperationalImpact.isEnabled,
        operationalEstimatedAvoidedTco2e: userOperationalImpact.estimatedAvoidedTco2e,
        operationalFactorTco2ePerMwh: userOperationalImpact.factorApplied,
        operationalFactorSourceUrl: settings.evDisplacementFactorSourceUrl,
        methodologyStatus: settings.methodologyStatus,
        note: "La movilidad estimada y el impacto solar atribuible se reportan por separado. Ninguno representa créditos emitidos, vendidos ni retirados.",
      };
    }),

    adminDashboard: adminProcedure.query(calculateDashboard),
    adminSettings: adminProcedure.query(async () => serializeSettings(await loadSettings())),

    saveSettings: adminProcedure.input(settingsInput).mutation(async ({ ctx, input }: any) => {
      if (input.evDisplacementEnabled && (!input.evDisplacementFactorTco2ePerMwh || !input.evDisplacementFactorSourceUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El factor de desplazamiento EV y su fuente son obligatorios al habilitarlo." });
      }
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
      const existing = await loadSettings();
      const values = {
        ...input,
        evDisplacementEnabled: input.evDisplacementEnabled ? 1 : 0,
        evDisplacementFactorTco2ePerMwh: input.evDisplacementEnabled ? String(input.evDisplacementFactorTco2ePerMwh) : null,
        evDisplacementFactorSourceUrl: input.evDisplacementEnabled ? input.evDisplacementFactorSourceUrl : null,
        gridInventoryFactorTco2ePerMwh: String(input.gridInventoryFactorTco2ePerMwh),
        solarAvoidedFactorTco2ePerMwh: String(input.solarAvoidedFactorTco2ePerMwh),
        estimatedCreditPriceCopPerTco2e: String(input.estimatedCreditPriceCopPerTco2e),
        registryCommissionPercent: String(input.registryCommissionPercent),
        minimumSellableTco2e: String(input.minimumSellableTco2e),
        publicStatsEnabled: input.publicStatsEnabled ? 1 : 0,
        updatedBy: ctx.user.id,
      };
      if (existing) await database.update(carbonProgramSettings).set(values).where(eq(carbonProgramSettings.id, existing.id));
      else await database.insert(carbonProgramSettings).values(values as any);
      await appendAuditEvent({ eventType: "SETTINGS_SAVED", entityType: "carbon_program_settings", entityId: existing?.id, actorUserId: ctx.user.id, actorRole: ctx.user.role, metadata: { methodologyStatus: input.methodologyStatus, factorYear: input.solarAvoidedFactorYear, publicStatsEnabled: input.publicStatsEnabled } });
      return serializeSettings(await loadSettings());
    }),

    createSolarReading: adminProcedure.input(z.object({
      stationId: z.number().int().positive(),
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
      generationKwh: z.number().positive().max(100_000_000),
      sourceType: z.enum(["INVERTER_METER", "UTILITY_BILL", "MANUAL_METER", "OTHER"]),
      verificationStatus: z.enum(["DRAFT", "VERIFIED"]),
      evidenceReference: z.string().trim().max(500).optional(),
      note: z.string().trim().max(2000).optional(),
    }).refine((input) => new Date(input.periodEnd) > new Date(input.periodStart), { message: "El período final debe ser posterior al inicial.", path: ["periodEnd"] })).mutation(async ({ ctx, input }: any) => {
      if (input.verificationStatus === "VERIFIED" && !input.evidenceReference?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Una lectura verificada requiere referencia de evidencia (inversor, factura o expediente)." });
      }
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
      const station = await database.select({ id: chargingStations.id }).from(chargingStations).where(eq(chargingStations.id, input.stationId)).limit(1);
      if (!station[0]) throw new TRPCError({ code: "NOT_FOUND", message: "La estación seleccionada no existe." });
      if (input.verificationStatus === "VERIFIED") {
        const overlap = await database.select({ id: carbonSolarMeterReadings.id }).from(carbonSolarMeterReadings).where(and(
          eq(carbonSolarMeterReadings.stationId, input.stationId),
          eq(carbonSolarMeterReadings.verificationStatus, "VERIFIED"),
          lt(carbonSolarMeterReadings.periodStart, input.periodEnd),
          gt(carbonSolarMeterReadings.periodEnd, input.periodStart),
        )).limit(1);
        if (overlap[0]) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe una lectura verificada que se solapa con este período para la estación. Revísala para evitar doble atribución." });
        }
      }
      const result = await database.insert(carbonSolarMeterReadings).values({ ...input, generationKwh: String(input.generationKwh), createdBy: ctx.user.id });
      const id = Number(result[0].insertId);
      await appendAuditEvent({ eventType: "SOLAR_READING_CREATED", entityType: "carbon_solar_meter_reading", entityId: id, actorUserId: ctx.user.id, actorRole: ctx.user.role, metadata: { stationId: input.stationId, generationKwh: input.generationKwh, verificationStatus: input.verificationStatus, periodStart: input.periodStart, periodEnd: input.periodEnd } });
      return { id };
    }),

    createCost: adminProcedure.input(z.object({
      name: z.string().trim().min(3).max(255),
      category: z.enum(["CONSULTING", "VALIDATION", "VERIFICATION", "REGISTRY", "LEGAL", "MONITORING", "COMMISSION", "MARKETING", "OTHER"]),
      costType: validCostType,
      amountCop: z.number().positive().max(1_000_000_000),
      periodicity: validPeriodicity,
      activeFrom: z.string().datetime(),
      activeTo: z.string().datetime().optional(),
      note: z.string().trim().max(2000).optional(),
    }).refine((input) => !input.activeTo || new Date(input.activeTo) >= new Date(input.activeFrom), { message: "La fecha final no puede ser anterior a la inicial.", path: ["activeTo"] })).mutation(async ({ ctx, input }: any) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
      const result = await database.insert(carbonCostEntries).values({ ...input, amountCop: String(input.amountCop), createdBy: ctx.user.id });
      const id = Number(result[0].insertId);
      await appendAuditEvent({ eventType: "COST_CREATED", entityType: "carbon_cost_entry", entityId: id, actorUserId: ctx.user.id, actorRole: ctx.user.role, metadata: { category: input.category, costType: input.costType, amountCop: input.amountCop } });
      return { id };
    }),

    archiveCost: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }: any) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
      const existing = await database.select({ id: carbonCostEntries.id }).from(carbonCostEntries).where(eq(carbonCostEntries.id, input.id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Costo no encontrado." });
      await database.update(carbonCostEntries).set({ status: "ARCHIVED" }).where(eq(carbonCostEntries.id, input.id));
      await appendAuditEvent({ eventType: "COST_ARCHIVED", entityType: "carbon_cost_entry", entityId: input.id, actorUserId: ctx.user.id, actorRole: ctx.user.role });
      return { success: true };
    }),

    createCreditLot: adminProcedure.input(z.object({
      name: z.string().trim().min(3).max(255),
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
      estimatedTco2e: z.number().min(0).max(10_000_000),
      registryName: z.string().trim().max(120).optional(),
      registryProjectReference: z.string().trim().max(255).optional(),
      note: z.string().trim().max(2000).optional(),
    }).refine((input) => new Date(input.periodEnd) > new Date(input.periodStart), { message: "El período final debe ser posterior al inicial.", path: ["periodEnd"] })).mutation(async ({ ctx, input }: any) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
      const result = await database.insert(carbonCreditLots).values({ ...input, estimatedTco2e: String(input.estimatedTco2e), createdBy: ctx.user.id });
      const id = Number(result[0].insertId);
      await appendAuditEvent({ eventType: "CREDIT_LOT_CREATED", entityType: "carbon_credit_lot", entityId: id, actorUserId: ctx.user.id, actorRole: ctx.user.role, metadata: { estimatedTco2e: input.estimatedTco2e, periodStart: input.periodStart, periodEnd: input.periodEnd } });
      return { id };
    }),

    listStations: adminProcedure.query(async () => {
      const database = await getDb();
      if (!database) return [];
      return database.select({ id: chargingStations.id, name: chargingStations.name, city: chargingStations.city }).from(chargingStations).where(eq(chargingStations.isActive, 1)).orderBy(chargingStations.name);
    }),
  });
}
