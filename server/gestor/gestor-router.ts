/**
 * EVGreen - Router del Gestor Comercial
 * Permite a usuarios con rol 'comercial' postular espacios, ver sus espacios asignados,
 * consultar la facturación de sus estaciones y revisar su liquidación mensual.
 * La comisión del gestor sale del 30% de EVGreen, sin afectar el % del inversionista.
 * @author Green House Project
 */
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  spaceSubmissions,
  spacePhotos,
  chargingStations,
  users,
  financialSettlements,
  transactions,
  stationFixedExpenses,
} from "../../drizzle/schema";
import { eq, desc, and, sql, or, isNull, inArray, gte, lt, lte } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  calculateGestorWaterfall,
  calculateGestorWaterfallFromAggregate,
  getColombiaDayBounds,
  getColombiaMonthBounds,
} from "./gestor-calculations";

// ============================================================================
// ROLE GUARDS
// ============================================================================
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de administrador." });
  }
  return next({ ctx });
});

const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "comercial" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de gestor comercial." });
  }
  return next({ ctx });
});

// ============================================================================
// HELPERS
// ============================================================================
function generateSpaceCode(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `SPE-${year}-${rand}`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBogotaDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fixedExpenseForPeriod(
  expense: { amountCop: number; expensePeriodicity: string; startDate?: string | Date | null },
  periodKind: "DAY" | "MONTH",
  dayKey?: string,
): number {
  const amount = toNumber(expense.amountCop);
  const periodKey = dayKey ?? getBogotaDateKey();
  if (expense.expensePeriodicity === "ONE_TIME") {
    const expenseStart = expense.startDate ? new Date(expense.startDate).toISOString().slice(0, 10) : "";
    return periodKind === "DAY"
      ? (expenseStart === periodKey ? amount : 0)
      : (expenseStart.slice(0, 7) === periodKey.slice(0, 7) ? amount : 0);
  }
  const monthlyEquivalent: Record<string, number> = {
    MONTHLY: amount,
    BIMONTHLY: amount / 2,
    QUARTERLY: amount / 3,
    SEMIANNUAL: amount / 6,
    ANNUAL: amount / 12,
  };
  const monthlyAmount = monthlyEquivalent[expense.expensePeriodicity] ?? amount;
  if (periodKind === "MONTH") return monthlyAmount;
  const [year, month] = periodKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return monthlyAmount / daysInMonth;
}

/**
 * Calcula la comisión del gestor dado el margen neto de la estación.
 * Margen Neto = (PV - CE) - hostSharePercent% * PV
 * Comisión Gestor = Margen Neto * gestorCommissionPercent%
 * La comisión sale del 30% de EVGreen, no afecta al inversionista.
 */
function calcGestorCommission(params: {
  grossRevenue: number;
  totalEnergyCost: number;
  hostSharePercent: number;
  gestorCommissionPercent: number;
}): {
  hostPayout: number;
  netMargin: number;
  gestorCommission: number;
  evgreenNet: number;
} {
  const { grossRevenue, totalEnergyCost, hostSharePercent, gestorCommissionPercent } = params;
  const hostPayout = (grossRevenue * hostSharePercent) / 100;
  const netMargin = grossRevenue - totalEnergyCost - hostPayout;
  const gestorCommission = (netMargin * gestorCommissionPercent) / 100;
  const evgreenNet = netMargin - gestorCommission;
  return { hostPayout, netMargin, gestorCommission, evgreenNet };
}

// ============================================================================
// ROUTER
// ============================================================================
export const gestorRouter = router({

  // --------------------------------------------------------------------------
  // POSTULAR ESPACIO (gestor puede postular en nombre de un EDS)
  // --------------------------------------------------------------------------
  postularEspacio: gestorProcedure
    .input(z.object({
      spaceName: z.string().min(2),
      spaceType: z.enum(['parking','mall','gas_station','hotel','restaurant','office_building','residential','supermarket','hospital','university','airport','highway_rest','other']),
      address: z.string().min(5),
      city: z.string().min(2),
      department: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      submitterName: z.string().min(2),
      submitterEmail: z.string().email(),
      submitterPhone: z.string().min(7),
      submitterCompany: z.string().optional(),
      estimatedDailyVehicles: z.number().int().optional(),
      estimatedEvPercent: z.number().int().min(0).max(100).optional(),
      transformerCapacityKva: z.string().optional(),
      hasElectricalPanel: z.boolean().optional(),
      hasInternet: z.boolean().optional(),
      operatingHoursStart: z.string().optional(),
      operatingHoursEnd: z.string().optional(),
      is24Hours: z.boolean().optional(),
      additionalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const code = generateSpaceCode();

      const [result] = await db.insert(spaceSubmissions).values({
        code,
        submitterName: input.submitterName,
        submitterEmail: input.submitterEmail,
        submitterPhone: input.submitterPhone,
        submitterCompany: input.submitterCompany ?? null,
        spaceName: input.spaceName,
        spaceType: input.spaceType,
        address: input.address,
        city: input.city,
        department: input.department ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        estimatedDailyVehicles: input.estimatedDailyVehicles ?? null,
        estimatedEvPercent: input.estimatedEvPercent ?? null,
        transformerCapacityKva: input.transformerCapacityKva ?? null,
        hasElectricalPanel: input.hasElectricalPanel ? 1 : 0,
        hasInternet: input.hasInternet ? 1 : 0,
        operatingHoursStart: input.operatingHoursStart ?? "06:00",
        operatingHoursEnd: input.operatingHoursEnd ?? "22:00",
        is24Hours: input.is24Hours ? 1 : 0,
        additionalNotes: input.additionalNotes ?? null,
        spaceStatus: "pending",
        gestorId: ctx.user.id,
        gestorCommissionPercent: "3.75",
        investmentType: "individual",
      });

      return { success: true, code, id: (result as any).insertId };
    }),

  // --------------------------------------------------------------------------
  // MIS ESPACIOS POSTULADOS
  // --------------------------------------------------------------------------
  getMisEspacios: gestorProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const offset = (input.page - 1) * input.limit;

      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      const whereClause = isAdmin ? undefined : eq(spaceSubmissions.gestorId, ctx.user.id);

      const [rows, [countRow]] = await Promise.all([
        db.select({
          id: spaceSubmissions.id,
          code: spaceSubmissions.code,
          spaceName: spaceSubmissions.spaceName,
          spaceType: spaceSubmissions.spaceType,
          city: spaceSubmissions.city,
          department: spaceSubmissions.department,
          address: spaceSubmissions.address,
          spaceStatus: spaceSubmissions.spaceStatus,
          aiScore: spaceSubmissions.aiScore,
          gestorCommissionPercent: spaceSubmissions.gestorCommissionPercent,
          createdAt: spaceSubmissions.createdAt,
          submitterName: spaceSubmissions.submitterName,
          submitterCompany: spaceSubmissions.submitterCompany,
          latitude: spaceSubmissions.latitude,
          longitude: spaceSubmissions.longitude,
          estimatedPowerKw: spaceSubmissions.estimatedPowerKw,
          estimatedChargerCount: spaceSubmissions.estimatedChargerCount,
        })
          .from(spaceSubmissions)
          .where(whereClause)
          .orderBy(desc(spaceSubmissions.createdAt))
          .limit(input.limit)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(spaceSubmissions)
          .where(whereClause),
      ]);

      return {
        spaces: rows,
        total: countRow?.total ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  // --------------------------------------------------------------------------
  // MIS ESTACIONES OPERATIVAS (vinculadas al gestor)
  // --------------------------------------------------------------------------
  getMisEstaciones: gestorProcedure
    .query(async ({ ctx }) => {
      const db = (await getDb())!;
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      const whereClause = isAdmin ? undefined : eq(chargingStations.gestorId, ctx.user.id);

      const stations = await db.select({
        id: chargingStations.id,
        name: chargingStations.name,
        address: chargingStations.address,
        city: chargingStations.city,
        department: chargingStations.department,
        isOnline: chargingStations.isOnline,
        isActive: chargingStations.isActive,
        gestorCommissionPercent: chargingStations.gestorCommissionPercent,
        hostSharePercent: chargingStations.hostSharePercent,
        investorSharePercent: chargingStations.investorSharePercent,
        evgreenSharePercent: chargingStations.evgreenSharePercent,
        energyPurchaseCostPerKwh: chargingStations.energyPurchaseCostPerKwh,
        imageUrl: chargingStations.imageUrl,
        latitude: chargingStations.latitude,
        longitude: chargingStations.longitude,
      })
        .from(chargingStations)
        .where(whereClause)
        .orderBy(desc(chargingStations.id));

      return { stations };
    }),

  // --------------------------------------------------------------------------
  // CARTERA COMERCIAL UNIFICADA: espacios en gestión + estaciones operativas
  // --------------------------------------------------------------------------
  getCartera: gestorProcedure
    .query(async ({ ctx }) => {
      const db = (await getDb())!;
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      const spaceFilter = isAdmin ? undefined : eq(spaceSubmissions.gestorId, ctx.user.id);
      const stationFilter = isAdmin ? undefined : eq(chargingStations.gestorId, ctx.user.id);
      const today = getBogotaDateKey();
      const month = today.slice(0, 7);
      const { start: monthStart, end: monthEnd } = getColombiaMonthBounds(
        Number(month.slice(0, 4)),
        Number(month.slice(5, 7)),
      );

      const [spaces, stations] = await Promise.all([
        db.select({
          id: spaceSubmissions.id,
          code: spaceSubmissions.code,
          name: spaceSubmissions.spaceName,
          city: spaceSubmissions.city,
          department: spaceSubmissions.department,
          address: spaceSubmissions.address,
          status: spaceSubmissions.spaceStatus,
          aiScore: spaceSubmissions.aiScore,
          gestorCommissionPercent: spaceSubmissions.gestorCommissionPercent,
          createdAt: spaceSubmissions.createdAt,
        }).from(spaceSubmissions).where(spaceFilter).orderBy(desc(spaceSubmissions.createdAt)),
        db.select({
          id: chargingStations.id,
          name: chargingStations.name,
          city: chargingStations.city,
          department: chargingStations.department,
          address: chargingStations.address,
          isOnline: chargingStations.isOnline,
          isActive: chargingStations.isActive,
          gestorCommissionPercent: chargingStations.gestorCommissionPercent,
          hostSharePercent: chargingStations.hostSharePercent,
          investorSharePercent: chargingStations.investorSharePercent,
          evgreenSharePercent: chargingStations.evgreenSharePercent,
          energyPurchaseCostPerKwh: chargingStations.energyPurchaseCostPerKwh,
          imageUrl: chargingStations.imageUrl,
        }).from(chargingStations).where(stationFilter).orderBy(desc(chargingStations.id)),
      ]);

      if (stations.length === 0) {
        return { month, spaces, stations: [], summary: { activeStations: 0, monthRevenue: 0, monthCommissionAccrued: 0 } };
      }

      const stationIds = stations.map((station) => station.id);
      const [transactionRows, expenseRows] = await Promise.all([
        db.select({
          stationId: transactions.stationId,
          grossRevenue: sql<number>`COALESCE(SUM(${transactions.totalCost}), 0)`,
          totalKwh: sql<number>`COALESCE(SUM(${transactions.kwhConsumed}), 0)`,
          totalSessions: sql<number>`COUNT(*)`,
        }).from(transactions).where(and(
          inArray(transactions.stationId, stationIds),
          eq(transactions.status, "COMPLETED"),
          gte(transactions.startTime, monthStart),
          lt(transactions.startTime, monthEnd),
        )).groupBy(transactions.stationId),
        db.select({
          stationId: stationFixedExpenses.stationId,
          amountCop: stationFixedExpenses.amountCop,
          expensePeriodicity: stationFixedExpenses.expensePeriodicity,
          startDate: stationFixedExpenses.startDate,
        }).from(stationFixedExpenses).where(and(
          inArray(stationFixedExpenses.stationId, stationIds),
          eq(stationFixedExpenses.isActive, 1),
          lte(stationFixedExpenses.startDate, monthEnd),
          or(isNull(stationFixedExpenses.endDate), gte(stationFixedExpenses.endDate, monthStart)),
        )),
      ]);

      const transactionMap = new Map(transactionRows.map((row) => [row.stationId, row]));
      const expenseMap = new Map<number, number>();
      for (const expense of expenseRows) {
        expenseMap.set(
          expense.stationId,
          (expenseMap.get(expense.stationId) ?? 0) + fixedExpenseForPeriod(expense, "MONTH"),
        );
      }

      const portfolioStations = stations.map((station) => {
        const totals = transactionMap.get(station.id);
        const waterfall = calculateGestorWaterfall({
          grossRevenue: toNumber(totals?.grossRevenue),
          kwhConsumed: toNumber(totals?.totalKwh),
          energyPurchaseCostPerKwh: toNumber(station.energyPurchaseCostPerKwh),
          hostSharePercent: toNumber(station.hostSharePercent),
          investorSharePercent: toNumber(station.investorSharePercent),
          evgreenSharePercent: toNumber(station.evgreenSharePercent),
          gestorCommissionPercent: toNumber(station.gestorCommissionPercent),
        });
        const fixedExpenses = expenseMap.get(station.id) ?? 0;
        const netWaterfall = calculateGestorWaterfallFromAggregate({
          ...waterfall,
          energyCost: waterfall.energyCost,
          fixedExpenses,
          hostSharePercent: toNumber(station.hostSharePercent),
          investorSharePercent: toNumber(station.investorSharePercent),
          evgreenSharePercent: toNumber(station.evgreenSharePercent),
          gestorCommissionPercent: toNumber(station.gestorCommissionPercent),
        });
        return {
          ...station,
          status: station.isActive ? (station.isOnline ? "ONLINE" : "OFFLINE") : "INACTIVE",
          month: {
            totalSessions: toNumber(totals?.totalSessions),
            totalKwh: toNumber(totals?.totalKwh),
            grossRevenue: netWaterfall.grossRevenue,
            netDistributableMargin: netWaterfall.netDistributableMargin,
            commissionAccrued: netWaterfall.gestorCommission,
          },
        };
      });

      return {
        month,
        spaces,
        stations: portfolioStations,
        summary: {
          activeStations: portfolioStations.filter((station) => station.isActive).length,
          monthRevenue: portfolioStations.reduce((sum, station) => sum + station.month.grossRevenue, 0),
          monthCommissionAccrued: portfolioStations.reduce((sum, station) => sum + station.month.commissionAccrued, 0),
        },
      };
    }),

  // --------------------------------------------------------------------------
  // LIQUIDACIÓN AUDITABLE: transacciones reales + margen + comisión acumulada
  // --------------------------------------------------------------------------
  getLiquidacionAuditable: gestorProcedure
    .input(z.object({
      period: z.enum(["DAY", "MONTH"]).default("MONTH"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2024).max(2035).optional(),
      stationId: z.number().int().optional(),
      limit: z.number().int().min(1).max(250).default(100),
    }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      const stationFilter = isAdmin ? undefined : eq(chargingStations.gestorId, ctx.user.id);
      const stations = await db.select({
        id: chargingStations.id,
        name: chargingStations.name,
        city: chargingStations.city,
        gestorCommissionPercent: chargingStations.gestorCommissionPercent,
        hostSharePercent: chargingStations.hostSharePercent,
        investorSharePercent: chargingStations.investorSharePercent,
        evgreenSharePercent: chargingStations.evgreenSharePercent,
        energyPurchaseCostPerKwh: chargingStations.energyPurchaseCostPerKwh,
      }).from(chargingStations).where(stationFilter);

      const targetStations = input.stationId ? stations.filter((station) => station.id === input.stationId) : stations;
      if (targetStations.length === 0) {
        return {
          period: input.period,
          periodLabel: input.period === "DAY" ? (input.date ?? getBogotaDateKey()) : "",
          officialStatus: null,
          stations: [],
          transactions: [],
          totals: { grossRevenue: 0, totalKwh: 0, totalSessions: 0, energyCost: 0, fixedExpenses: 0, netDistributableMargin: 0, investorPool: 0, evgreenPool: 0, gestorCommission: 0, evgreenRetained: 0 },
        };
      }

      const nowKey = getBogotaDateKey();
      const requestedDate = input.date ?? nowKey;
      const requestedYear = input.year ?? Number(nowKey.slice(0, 4));
      const requestedMonth = input.month ?? Number(nowKey.slice(5, 7));
      const bounds = input.period === "DAY"
        ? getColombiaDayBounds(requestedDate)
        : getColombiaMonthBounds(requestedYear, requestedMonth);
      const periodLabel = input.period === "DAY" ? requestedDate : `${requestedYear}-${String(requestedMonth).padStart(2, "0")}`;
      const stationIds = targetStations.map((station) => station.id);

      const [transactionRows, expenseRows, settlementRows] = await Promise.all([
        db.select({
          id: transactions.id,
          stationId: transactions.stationId,
          startTime: transactions.startTime,
          endTime: transactions.endTime,
          kwhConsumed: transactions.kwhConsumed,
          totalCost: transactions.totalCost,
          energySaleRevenue: transactions.energyCost,
          timeCost: transactions.timeCost,
          sessionCost: transactions.sessionCost,
          overstayCost: transactions.overstayCost,
          appliedPricePerKwh: transactions.appliedPricePerKwh,
        }).from(transactions).where(and(
          inArray(transactions.stationId, stationIds),
          eq(transactions.status, "COMPLETED"),
          gte(transactions.startTime, bounds.start),
          lt(transactions.startTime, bounds.end),
        )).orderBy(desc(transactions.startTime)).limit(input.limit),
        db.select({
          stationId: stationFixedExpenses.stationId,
          amountCop: stationFixedExpenses.amountCop,
          expensePeriodicity: stationFixedExpenses.expensePeriodicity,
          startDate: stationFixedExpenses.startDate,
        }).from(stationFixedExpenses).where(and(
          inArray(stationFixedExpenses.stationId, stationIds),
          eq(stationFixedExpenses.isActive, 1),
          lte(stationFixedExpenses.startDate, bounds.end),
          or(isNull(stationFixedExpenses.endDate), gte(stationFixedExpenses.endDate, bounds.start)),
        )),
        input.period === "MONTH"
          ? db.select({
            stationId: financialSettlements.stationId,
            status: financialSettlements.settlementStatus,
            grossRevenue: financialSettlements.grossRevenue,
            totalEnergyCost: financialSettlements.totalEnergyCost,
            totalFixedExpenses: financialSettlements.totalFixedExpenses,
            hostSharePercent: financialSettlements.hostSharePercent,
            investorSharePercent: financialSettlements.investorSharePercent,
            platformSharePercent: financialSettlements.platformSharePercent,
          }).from(financialSettlements).where(and(
            inArray(financialSettlements.stationId, stationIds),
            sql`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m') = ${periodLabel}`,
          ))
          : Promise.resolve([]),
      ]);

      const fixedExpenseMap = new Map<number, number>();
      for (const expense of expenseRows) {
        fixedExpenseMap.set(
          expense.stationId,
          (fixedExpenseMap.get(expense.stationId) ?? 0) + fixedExpenseForPeriod(expense, input.period, requestedDate),
        );
      }

      const stationMap = new Map(targetStations.map((station) => [station.id, station]));
      const aggregateMap = new Map<number, { grossRevenue: number; totalKwh: number; totalSessions: number }>();
      for (const transaction of transactionRows) {
        const aggregate = aggregateMap.get(transaction.stationId) ?? { grossRevenue: 0, totalKwh: 0, totalSessions: 0 };
        aggregate.grossRevenue += toNumber(transaction.totalCost);
        aggregate.totalKwh += toNumber(transaction.kwhConsumed);
        aggregate.totalSessions += 1;
        aggregateMap.set(transaction.stationId, aggregate);
      }

      const stationLines = targetStations.map((station) => {
        const aggregate = aggregateMap.get(station.id) ?? { grossRevenue: 0, totalKwh: 0, totalSessions: 0 };
        const official = settlementRows.find((settlement) => settlement.stationId === station.id);
        const waterfall = official
          ? calculateGestorWaterfallFromAggregate({
              grossRevenue: toNumber(official.grossRevenue),
              energyCost: toNumber(official.totalEnergyCost),
              fixedExpenses: toNumber(official.totalFixedExpenses),
              hostSharePercent: toNumber(official.hostSharePercent),
              investorSharePercent: toNumber(official.investorSharePercent),
              evgreenSharePercent: toNumber(official.platformSharePercent),
              gestorCommissionPercent: toNumber(station.gestorCommissionPercent),
            })
          : calculateGestorWaterfall({
              grossRevenue: aggregate.grossRevenue,
              kwhConsumed: aggregate.totalKwh,
              energyPurchaseCostPerKwh: toNumber(station.energyPurchaseCostPerKwh),
              hostSharePercent: toNumber(station.hostSharePercent),
              investorSharePercent: toNumber(station.investorSharePercent),
              evgreenSharePercent: toNumber(station.evgreenSharePercent),
              gestorCommissionPercent: toNumber(station.gestorCommissionPercent),
            });
        const estimatedWaterfall = official ? waterfall : calculateGestorWaterfallFromAggregate({
          ...waterfall,
          energyCost: waterfall.energyCost,
          fixedExpenses: fixedExpenseMap.get(station.id) ?? 0,
          hostSharePercent: toNumber(station.hostSharePercent),
          investorSharePercent: toNumber(station.investorSharePercent),
          evgreenSharePercent: toNumber(station.evgreenSharePercent),
          gestorCommissionPercent: toNumber(station.gestorCommissionPercent),
        });

        return {
          stationId: station.id,
          stationName: station.name,
          stationCity: station.city,
          commissionPercent: toNumber(station.gestorCommissionPercent),
          isOfficial: Boolean(official),
          officialStatus: official?.status ?? "PRELIMINARY",
          totalSessions: aggregate.totalSessions,
          totalKwh: aggregate.totalKwh,
          ...estimatedWaterfall,
        };
      });

      const transactionsForAudit = transactionRows.map((transaction) => {
        const station = stationMap.get(transaction.stationId)!;
        const energyCost = toNumber(transaction.kwhConsumed) * toNumber(station.energyPurchaseCostPerKwh);
        return {
          id: transaction.id,
          stationId: transaction.stationId,
          stationName: station.name,
          startedAt: transaction.startTime,
          endedAt: transaction.endTime,
          totalKwh: toNumber(transaction.kwhConsumed),
          grossRevenue: toNumber(transaction.totalCost),
          energyCost,
          contributionMargin: Math.max(0, toNumber(transaction.totalCost) - energyCost),
          energySaleRevenue: toNumber(transaction.energySaleRevenue),
          timeCost: toNumber(transaction.timeCost),
          sessionCost: toNumber(transaction.sessionCost),
          overstayCost: toNumber(transaction.overstayCost),
          appliedPricePerKwh: toNumber(transaction.appliedPricePerKwh),
        };
      });

      const totals = stationLines.reduce((total, line) => ({
        grossRevenue: total.grossRevenue + line.grossRevenue,
        totalKwh: total.totalKwh + line.totalKwh,
        totalSessions: total.totalSessions + line.totalSessions,
        energyCost: total.energyCost + line.energyCost,
        fixedExpenses: total.fixedExpenses + line.fixedExpenses,
        netDistributableMargin: total.netDistributableMargin + line.netDistributableMargin,
        investorPool: total.investorPool + line.investorPool,
        evgreenPool: total.evgreenPool + line.evgreenPool,
        gestorCommission: total.gestorCommission + line.gestorCommission,
        evgreenRetained: total.evgreenRetained + line.evgreenRetained,
      }), { grossRevenue: 0, totalKwh: 0, totalSessions: 0, energyCost: 0, fixedExpenses: 0, netDistributableMargin: 0, investorPool: 0, evgreenPool: 0, gestorCommission: 0, evgreenRetained: 0 });

      return {
        period: input.period,
        periodLabel,
        officialStatus: stationLines.every((line) => line.isOfficial)
          ? "OFFICIAL"
          : stationLines.some((line) => line.isOfficial)
            ? "MIXED"
            : "PRELIMINARY",
        stations: stationLines,
        transactions: transactionsForAudit,
        totals,
      };
    }),

  // --------------------------------------------------------------------------
  // GANANCIAS DEL GESTOR (por estación y período)
  // --------------------------------------------------------------------------
  getMisGanancias: gestorProcedure
    .input(z.object({
      stationId: z.number().int().optional(),
      year: z.number().int().min(2024).max(2030).default(new Date().getFullYear()),
    }))
    .query(async ({ ctx }) => {
      const db = (await getDb())!;
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";

      // Obtener estaciones del gestor
      const whereStation = isAdmin
        ? undefined
        : eq(chargingStations.gestorId, ctx.user.id);

      const myStations = await db.select({
        id: chargingStations.id,
        name: chargingStations.name,
        city: chargingStations.city,
        gestorCommissionPercent: chargingStations.gestorCommissionPercent,
        hostSharePercent: chargingStations.hostSharePercent,
        evgreenSharePercent: chargingStations.evgreenSharePercent,
        energyPurchaseCostPerKwh: chargingStations.energyPurchaseCostPerKwh,
      })
        .from(chargingStations)
        .where(whereStation);

      if (myStations.length === 0) {
        return { summary: [], totalCommission: 0, totalNetMargin: 0 };
      }

      const stationIds = myStations.map((s) => s.id);

      // Obtener settlements de los últimos 12 meses
      const payouts = await db.select({
        id: financialSettlements.id,
        stationId: financialSettlements.stationId,
        periodLabel: sql<string>`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m')`,
        startDate: financialSettlements.periodStart,
        endDate: financialSettlements.periodEnd,
        status: financialSettlements.settlementStatus,
        grossRevenue: financialSettlements.grossRevenue,
        totalEnergyCost: financialSettlements.totalEnergyCost,
        netRevenue: financialSettlements.netRevenue,
        hostSharePercent: financialSettlements.hostSharePercent,
        hostPool: financialSettlements.hostTotalAmount,
        totalKwhSold: financialSettlements.totalKwh,
        totalSessions: financialSettlements.totalSessions,
        avgPricePerKwh: financialSettlements.energyCostPerKwh,
      })
        .from(financialSettlements)
        .where(
          sql`${financialSettlements.stationId} IN (${sql.join(stationIds.map((id) => sql`${id}`), sql`, `)})`
        )
        .orderBy(desc(financialSettlements.periodStart));

      // Calcular comisión del gestor por cada payout
      const summary = payouts.map((payout) => {
        const station = myStations.find((s) => s.id === payout.stationId);
        if (!station) return null;

        // @ts-ignore
        const grossRevenue = parseFloat(payout.grossRevenue as string);
        // @ts-ignore
        const totalEnergyCost = parseFloat(payout.totalEnergyCost as string);
        const hostSharePercent = parseFloat(payout.hostSharePercent as string);
        const gestorCommissionPercent = parseFloat(station.gestorCommissionPercent as string);

        const calc = calcGestorCommission({
          grossRevenue,
          totalEnergyCost,
          hostSharePercent,
          gestorCommissionPercent,
        });

        return {
          payoutId: payout.id,
          stationId: payout.stationId,
          stationName: station.name,
          stationCity: station.city,
          periodLabel: payout.periodLabel,
          startDate: payout.startDate,
          endDate: payout.endDate,
          status: payout.status,
          grossRevenue,
          totalEnergyCost,
          hostPayout: calc.hostPayout,
          netMargin: calc.netMargin,
          gestorCommissionPercent,
          gestorCommission: calc.gestorCommission,
          evgreenNet: calc.evgreenNet,
          totalKwhSold: parseFloat(payout.totalKwhSold as string),
          totalSessions: payout.totalSessions,
          avgPricePerKwh: parseFloat(payout.avgPricePerKwh as string),
        };
      }).filter(Boolean);

      const totalCommission = summary.reduce((acc, s) => acc + (s?.gestorCommission ?? 0), 0);
      const totalNetMargin = summary.reduce((acc, s) => acc + (s?.netMargin ?? 0), 0);

      return { summary, totalCommission, totalNetMargin };
    }),

  // --------------------------------------------------------------------------
  // RESUMEN DE LIQUIDACIÓN MENSUAL (para el gestor)
  // --------------------------------------------------------------------------
  getLiquidacionMensual: gestorProcedure
    .input(z.object({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2024).max(2030),
    }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      const whereStation = isAdmin ? undefined : eq(chargingStations.gestorId, ctx.user.id);

      const myStations = await db.select({
        id: chargingStations.id,
        name: chargingStations.name,
        city: chargingStations.city,
        gestorCommissionPercent: chargingStations.gestorCommissionPercent,
        hostSharePercent: chargingStations.hostSharePercent,
        energyPurchaseCostPerKwh: chargingStations.energyPurchaseCostPerKwh,
      })
        .from(chargingStations)
        .where(whereStation);

      if (myStations.length === 0) {
        return { lines: [], totalCommission: 0, month: input.month, year: input.year };
      }

      const stationIds = myStations.map((s) => s.id);
      const periodLabel = `${input.year}-${String(input.month).padStart(2, "0")}`;

      const payouts = await db.select({
        id: financialSettlements.id,
        stationId: financialSettlements.stationId,
        periodLabel: sql<string>`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m')`,
        status: financialSettlements.settlementStatus,
        grossRevenue: financialSettlements.grossRevenue,
        totalEnergyCost: financialSettlements.totalEnergyCost,
        hostSharePercent: financialSettlements.hostSharePercent,
        totalKwhSold: financialSettlements.totalKwh,
      })
        .from(financialSettlements)
        .where(
          and(
            sql`${financialSettlements.stationId} IN (${sql.join(stationIds.map((id) => sql`${id}`), sql`, `)})`,
            sql`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m') = ${periodLabel}`
          )
        );

      const lines = payouts.map((payout) => {
        const station = myStations.find((s) => s.id === payout.stationId);
        if (!station) return null;

        const grossRevenue = Number(payout.grossRevenue);
        const totalEnergyCost = Number(payout.totalEnergyCost);
        const hostSharePercent = parseFloat(payout.hostSharePercent as string);
        const gestorCommissionPercent = parseFloat(station.gestorCommissionPercent as string);

        const calc = calcGestorCommission({
          grossRevenue,
          totalEnergyCost,
          hostSharePercent,
          gestorCommissionPercent,
        });

        return {
          stationId: payout.stationId,
          stationName: station.name,
          stationCity: station.city,
          periodLabel: payout.periodLabel,
          status: payout.status,
          grossRevenue,
          totalEnergyCost,
          hostPayout: calc.hostPayout,
          netMargin: calc.netMargin,
          gestorCommissionPercent,
          gestorCommission: calc.gestorCommission,
          totalKwhSold: parseFloat(payout.totalKwhSold as string),
        };
      }).filter(Boolean);

      const totalCommission = lines.reduce((acc, l) => acc + (l?.gestorCommission ?? 0), 0);

      return { lines, totalCommission, month: input.month, year: input.year };
    }),

  // --------------------------------------------------------------------------
  // ADMIN: LISTAR GESTORES DISPONIBLES
  // --------------------------------------------------------------------------
  listarGestores: adminProcedure
    .query(async () => {
      const db = (await getDb())!;
      const gestores = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
        .from(users)
        .where(eq(users.role, "comercial"))
        .orderBy(users.name);

      return { gestores };
    }),

  // --------------------------------------------------------------------------
  // ADMIN: ASIGNAR GESTOR A ESPACIO Y CONFIGURAR COMISIÓN
  // --------------------------------------------------------------------------
  asignarGestorAEspacio: adminProcedure
    .input(z.object({
      spaceId: z.number().int(),
      gestorId: z.number().int().nullable(),
      gestorCommissionPercent: z.number().min(0).max(30).default(3.75),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.update(spaceSubmissions)
        .set({
          gestorId: input.gestorId,
          gestorCommissionPercent: String(input.gestorCommissionPercent),
        })
        .where(eq(spaceSubmissions.id, input.spaceId));

      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // ADMIN: ASIGNAR GESTOR A ESTACIÓN Y CONFIGURAR COMISIÓN
  // --------------------------------------------------------------------------
  asignarGestorAEstacion: adminProcedure
    .input(z.object({
      stationId: z.number().int(),
      gestorId: z.number().int().nullable(),
      gestorCommissionPercent: z.number().min(0).max(30).default(3.75),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      await db.update(chargingStations)
        .set({
          gestorId: input.gestorId,
          gestorCommissionPercent: String(input.gestorCommissionPercent),
        })
        .where(eq(chargingStations.id, input.stationId));

      return { success: true };
    }),

  // --------------------------------------------------------------------------
  // ADMIN: VER RESUMEN DE COMISIONES DE TODOS LOS GESTORES
  // --------------------------------------------------------------------------
  resumenComisionesAdmin: adminProcedure
    .input(z.object({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2024).max(2030),
    }))
    .query(async ({ input }) => {
      const db = (await getDb())!;

      // Obtener todas las estaciones con gestor asignado
      const stationsWithGestor = await db.select({
        id: chargingStations.id,
        name: chargingStations.name,
        city: chargingStations.city,
        gestorId: chargingStations.gestorId,
        gestorCommissionPercent: chargingStations.gestorCommissionPercent,
        hostSharePercent: chargingStations.hostSharePercent,
      })
        .from(chargingStations)
        .where(sql`${chargingStations.gestorId} IS NOT NULL`);

      if (stationsWithGestor.length === 0) return { gestores: [], totalAPagar: 0 };

      // Obtener info de gestores
      // @ts-ignore
      const gestorIds = [...new Set(stationsWithGestor.map((s) => s.gestorId!))];
      const gestoresInfo = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(gestorIds.map((id) => sql`${id}`), sql`, `)})`);

      // Obtener settlements del mes
      const stationIds = stationsWithGestor.map((s) => s.id);
      const periodLabel = `${input.year}-${String(input.month).padStart(2, "0")}`;

      const payouts = await db.select({
        id: financialSettlements.id,
        stationId: financialSettlements.stationId,
        periodLabel: sql<string>`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m')`,
        status: financialSettlements.settlementStatus,
        grossRevenue: financialSettlements.grossRevenue,
        totalEnergyCost: financialSettlements.totalEnergyCost,
        hostSharePercent: financialSettlements.hostSharePercent,
        totalKwhSold: financialSettlements.totalKwh,
      })
        .from(financialSettlements)
        .where(
          and(
            sql`${financialSettlements.stationId} IN (${sql.join(stationIds.map((id) => sql`${id}`), sql`, `)})`,
            sql`DATE_FORMAT(${financialSettlements.periodStart}, '%Y-%m') = ${periodLabel}`
          )
        );

      // Agrupar por gestor
      const gestorMap = new Map<number, {
        gestor: typeof gestoresInfo[0];
        lines: Array<{
          stationName: string;
          stationCity: string;
          netMargin: number;
          gestorCommission: number;
          gestorCommissionPercent: number;
          totalKwhSold: number;
          status: string;
        }>;
        totalCommission: number;
      }>();

      for (const payout of payouts) {
        const station = stationsWithGestor.find((s) => s.id === payout.stationId);
        if (!station || !station.gestorId) continue;

        const gestor = gestoresInfo.find((g) => g.id === station.gestorId);
        if (!gestor) continue;

        // @ts-ignore
        const grossRevenue = parseFloat(payout.grossRevenue as string);
        // @ts-ignore
        const totalEnergyCost = parseFloat(payout.totalEnergyCost as string);
        const hostSharePercent = parseFloat(payout.hostSharePercent as string);
        const gestorCommissionPercent = parseFloat(station.gestorCommissionPercent as string);

        const calc = calcGestorCommission({
          grossRevenue,
          totalEnergyCost,
          hostSharePercent,
          gestorCommissionPercent,
        });

        if (!gestorMap.has(gestor.id)) {
          gestorMap.set(gestor.id, { gestor, lines: [], totalCommission: 0 });
        }

        const entry = gestorMap.get(gestor.id)!;
        entry.lines.push({
          stationName: station.name,
          stationCity: station.city,
          netMargin: calc.netMargin,
          gestorCommission: calc.gestorCommission,
          gestorCommissionPercent,
          totalKwhSold: parseFloat(payout.totalKwhSold as string),
          status: payout.status,
        });
        entry.totalCommission += calc.gestorCommission;
      }

      const gestores = Array.from(gestorMap.values());
      const totalAPagar = gestores.reduce((acc, g) => acc + g.totalCommission, 0);

      return { gestores, totalAPagar, month: input.month, year: input.year };
    }),
});
