/**
 * ============================================================================
 * EVGreen Platform - Financial System Router
 * ============================================================================
 * Endpoints para:
 * - CRUD de gastos fijos por estación
 * - Generación y gestión de liquidaciones (waterfall)
 * - Distribución a inversionistas
 * - Métricas operativas SLA
 * - Reportes financieros
 * 
 * @author Green House Project
 * @version 1.0.0 (Abril 2026)
 * ============================================================================
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { generateFinancialExcel, generateFinancialPDF } from "../reports/export-financial";
import {
  createFixedExpense,
  getFixedExpensesByStation,
  getActiveFixedExpensesByStation,
  updateFixedExpense,
  deleteFixedExpense,
  getFixedExpenseById,
  createSettlement,
  getSettlementById,
  getSettlementsByStation,
  updateSettlement,
  getSettlementWithDetails,
  createSettlementExpenseItem,
  createInvestorShare,
  getInvestorShares,
  getInvestorSettlementHistory,
  updateInvestorShare,
  createOperationalMetric,
  getOperationalMetricsByStation,
  getLatestOperationalMetric,
  updateOperationalMetric,
  getStationRevenueForPeriod,
  prorateExpense,
  getStationInvestors,
  getInvestorAllSettlements,
  getInvestorFinancialSummary,
  getChargingStationById,
  getAllChargingStations,
  getHostStations,
  getHostFinancialSummary,
  getHostSettlementHistory,
  getMaintenanceFundBalance,
  createMaintenanceFundRecord,
  getMaintenanceFundRecords,
  getMaintenanceFundSummary,
} from "../db";

// ============================================================================
// EXPENSE CATEGORY & PERIODICITY SCHEMAS
// ============================================================================

const expenseCategorySchema = z.enum([
  "ENERGY", "INSURANCE", "CONNECTIVITY", "MAINTENANCE",
  "FIDUCIARY", "TAX", "CONTINGENCY", "ADMIN", "OTHER",
]);

const expensePeriodicitySchema = z.enum([
  "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "ONE_TIME",
]);

const settlementPeriodTypeSchema = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]);

// ============================================================================
// HELPER: Build the financial router procedures
// ============================================================================

export function buildFinancialRouter(router: any, protectedProcedure: any, adminProcedure: any): any {
  return router({
    // ========================================================================
    // GASTOS FIJOS - CRUD (Admin only)
    // ========================================================================

    /** Crear un gasto fijo para una estación */
    createExpense: adminProcedure
      .input(z.object({
        stationId: z.number(),
        name: z.string().min(1).max(255),
        category: expenseCategorySchema,
        description: z.string().optional(),
        amountCop: z.number().min(0),
        periodicity: expensePeriodicitySchema,
        startDate: z.string(), // ISO date string
        endDate: z.string().optional(),
        providerName: z.string().optional(),
        contractReference: z.string().optional(),
        waterfallPriority: z.number().min(1).max(20).default(5),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const station = await getChargingStationById(input.stationId);
        if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });

        const id = await createFixedExpense({
          stationId: input.stationId,
          name: input.name,
          category: input.category,
          description: input.description || null,
          amountCop: input.amountCop,
          periodicity: input.periodicity,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          providerName: input.providerName || null,
          contractReference: input.contractReference || null,
          waterfallPriority: input.waterfallPriority,
          isActive: true,
          createdBy: ctx.user.id,
          updatedBy: null,
        });

        return { id, message: "Gasto fijo creado exitosamente" };
      }),

    /** Listar gastos fijos de una estación */
    getExpenses: adminProcedure
      .input(z.object({
        stationId: z.number(),
        activeOnly: z.boolean().default(false),
      }))
      .query(async ({ input }: { input: { stationId: number; activeOnly: boolean } }) => {
        if (input.activeOnly) {
          return getActiveFixedExpensesByStation(input.stationId);
        }
        return getFixedExpensesByStation(input.stationId);
      }),

    /** Actualizar un gasto fijo */
    updateExpense: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        category: expenseCategorySchema.optional(),
        description: z.string().optional(),
        amountCop: z.number().min(0).optional(),
        periodicity: expensePeriodicitySchema.optional(),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        providerName: z.string().nullable().optional(),
        contractReference: z.string().nullable().optional(),
        waterfallPriority: z.number().min(1).max(20).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const existing = await getFixedExpenseById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado" });

        const updateData: any = { updatedBy: ctx.user.id };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.amountCop !== undefined) updateData.amountCop = input.amountCop;
        if (input.periodicity !== undefined) updateData.periodicity = input.periodicity;
        if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
        if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
        if (input.providerName !== undefined) updateData.providerName = input.providerName;
        if (input.contractReference !== undefined) updateData.contractReference = input.contractReference;
        if (input.waterfallPriority !== undefined) updateData.waterfallPriority = input.waterfallPriority;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        await updateFixedExpense(input.id, updateData);
        return { message: "Gasto actualizado" };
      }),

    /** Eliminar un gasto fijo (soft delete = desactivar) */
    deleteExpense: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: { input: { id: number } }) => {
        await updateFixedExpense(input.id, { isActive: false });
        return { message: "Gasto desactivado" };
      }),

    // ========================================================================
    // LIQUIDACIONES / WATERFALL (Admin)
    // ========================================================================

    /** Generar una nueva liquidación para una estación */
    generateSettlement: adminProcedure
      .input(z.object({
        stationId: z.number(),
        periodType: settlementPeriodTypeSchema,
        periodStart: z.string(), // ISO date
        periodEnd: z.string(),   // ISO date
        // Optional overrides - if not provided, uses station-configured values
        investorSharePercent: z.number().min(0).max(100).optional(),
        platformSharePercent: z.number().min(0).max(100).optional(),
        hostSharePercent: z.number().min(0).max(100).optional(),
        contingencyPercent: z.number().min(0).max(20).default(5),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const station = await getChargingStationById(input.stationId);
        if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });

        const periodStart = new Date(input.periodStart);
        const periodEnd = new Date(input.periodEnd);

        // Use station-configured percentages as defaults, allow overrides
        const evgreenPct = input.platformSharePercent ?? Number(station.evgreenSharePercent || 30);
        const investorPct = input.investorSharePercent ?? Number(station.investorSharePercent || 70);
        const hostPct = input.hostSharePercent ?? Number(station.hostSharePercent || 0);
        const energyCostPerKwh = Number(station.energyPurchaseCostPerKwh || 850);

        // Validate percentages sum to 100
        const totalPct = evgreenPct + investorPct + hostPct;
        if (Math.abs(totalPct - 100) > 0.1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Los porcentajes deben sumar 100%. Actual: EVGreen ${evgreenPct}% + Inversionista ${investorPct}% + Aliado ${hostPct}% = ${totalPct}%` });
        }

        // 1. Get revenue for the period (now with breakdown by source)
        const revenue = await getStationRevenueForPeriod(input.stationId, periodStart, periodEnd);

        // 2. Get active fixed expenses and prorate them
        const expenses = await getActiveFixedExpensesByStation(input.stationId);
        const waterfallBreakdown: Array<{ priority: number; category: string; name: string; amount: number }> = [];
        let totalFixedExpenses = 0;

        for (const expense of expenses) {
          const proratedAmount = prorateExpense(expense, periodStart, periodEnd);
          if (proratedAmount > 0) {
            waterfallBreakdown.push({
              priority: expense.waterfallPriority,
              category: expense.category,
              name: expense.name,
              amount: Math.round(proratedAmount),
            });
            totalFixedExpenses += Math.round(proratedAmount);
          }
        }

        // Sort by priority
        waterfallBreakdown.sort((a, b) => a.priority - b.priority);

        // 3. Calculate energy purchase cost (kWh sold * cost per kWh)
        const totalEnergyCost = Math.round(revenue.totalKwh * energyCostPerKwh);

        // 4. Calculate net revenue: Gross - Fixed Expenses - Energy Cost
        const grossRevenue = Math.round(revenue.grossRevenue);
        const netAfterExpenses = Math.max(0, grossRevenue - totalFixedExpenses - totalEnergyCost);
        
        // 5. Contingency reserve
        const contingencyReserve = Math.round(netAfterExpenses * (input.contingencyPercent / 100));
        const distributableAmount = netAfterExpenses - contingencyReserve;

        // 6. Split 3-way: EVGreen / Inversionista / Aliado Comercial
        const investorTotalAmount = Math.round(distributableAmount * (investorPct / 100));
        const hostTotalAmount = Math.round(distributableAmount * (hostPct / 100));
        const platformTotalAmount = distributableAmount - investorTotalAmount - hostTotalAmount;
        const netRevenue = netAfterExpenses;

        // 6b. Fondo de mantenimiento (% del share de EVGreen, solo estaciones colectivas)
        const maintenanceFundPct = Number(station.maintenanceFundPercent || 5);
        const maintenanceFundAmount = Math.round(platformTotalAmount * (maintenanceFundPct / 100));
        const platformNetAmount = platformTotalAmount - maintenanceFundAmount;

        // 7. Create the settlement with full breakdown
        const settlementId = await createSettlement({
          stationId: input.stationId,
          periodStart,
          periodEnd,
          periodType: input.periodType,
          grossRevenue,
          totalSessions: revenue.totalSessions,
          totalKwh: String(revenue.totalKwh),
          totalFixedExpenses,
          netRevenue,
          // Energy cost
          totalEnergyCost,
          energyCostPerKwh: String(energyCostPerKwh),
          // Revenue by source
          revenueFromEnergy: Math.round(revenue.revenueFromEnergy),
          revenueFromPenalties: Math.round(revenue.revenueFromPenalties),
          revenueFromReservations: Math.round(revenue.revenueFromReservations),
          revenueFromAdvertising: Math.round(revenue.revenueFromAdvertising),
          // 3-way split
          investorSharePercent: String(investorPct),
          platformSharePercent: String(evgreenPct),
          hostSharePercent: String(hostPct),
          investorTotalAmount,
          platformTotalAmount,
          hostTotalAmount,
          // Fondo de mantenimiento
          maintenanceFundPercent: String(maintenanceFundPct),
          maintenanceFundAmount,
          platformNetAmount,
          contingencyReserve,
          waterfallBreakdown,
          status: "DRAFT",
          notes: input.notes || null,
          createdBy: ctx.user.id,
          approvedBy: null,
          approvedAt: null,
          distributedAt: null,
        });

        // 8. Create expense line items
        for (const item of waterfallBreakdown) {
          const matchingExpense = expenses.find(e => e.name === item.name);
          await createSettlementExpenseItem({
            settlementId,
            expenseId: matchingExpense?.id || null,
            name: item.name,
            category: item.category as any,
            originalAmount: matchingExpense ? Number(matchingExpense.amountCop) : item.amount,
            proratedAmount: item.amount,
            waterfallPriority: item.priority,
            isProrated: matchingExpense?.periodicity !== 'MONTHLY',
            prorateFormula: matchingExpense ? `${matchingExpense.amountCop} COP / ${matchingExpense.periodicity}` : null,
          });
        }

        // 9. Calculate investor shares
        const investors = await getStationInvestors(input.stationId);
        for (const investor of investors) {
          const grossShare = Math.round(grossRevenue * (investor.participationPercent / 100));
          const expenseShare = Math.round((totalFixedExpenses + totalEnergyCost) * (investor.participationPercent / 100));
          const netShare = Math.round(investorTotalAmount * (investor.participationPercent / 100));

          await createInvestorShare({
            settlementId,
            investorUserId: investor.investorId,
            participationPercent: String(investor.participationPercent),
            grossShare,
            expenseShare,
            netShare,
            status: "PENDING",
            creditedAt: null,
            paymentReference: null,
          });
        }

        // 10. Create maintenance fund deposit record
        if (maintenanceFundAmount > 0) {
          // Get current balance
          const currentBalance = await getMaintenanceFundBalance(input.stationId);
          await createMaintenanceFundRecord({
            stationId: input.stationId,
            type: 'deposit',
            amount: maintenanceFundAmount,
            description: `Aporte fondo mantenimiento - Liquidación ${periodStart.toLocaleDateString('es-CO')} a ${periodEnd.toLocaleDateString('es-CO')}`,
            settlementId,
            balanceAfter: currentBalance + maintenanceFundAmount,
            createdBy: ctx.user.id,
          });
        }

        return {
          id: settlementId,
          grossRevenue,
          totalFixedExpenses,
          totalEnergyCost,
          netRevenue,
          contingencyReserve,
          investorTotalAmount,
          platformTotalAmount,
          hostTotalAmount,
          maintenanceFundAmount,
          platformNetAmount,
          // Revenue breakdown
          revenueFromEnergy: revenue.revenueFromEnergy,
          revenueFromPenalties: revenue.revenueFromPenalties,
          revenueFromReservations: revenue.revenueFromReservations,
          revenueFromAdvertising: revenue.revenueFromAdvertising,
          // Percentages used
          evgreenPct,
          investorPct,
          hostPct,
          totalSessions: revenue.totalSessions,
          totalKwh: revenue.totalKwh,
          investorCount: investors.length,
          waterfallBreakdown,
          message: "Liquidación generada exitosamente (estado: BORRADOR)",
        };
      }),

    /** Listar liquidaciones de una estación */
    getSettlements: adminProcedure
      .input(z.object({
        stationId: z.number(),
        limit: z.number().default(20),
      }))
      .query(async ({ input }: { input: { stationId: number; limit: number } }) => {
        return getSettlementsByStation(input.stationId, input.limit);
      }),

    /** Ver detalle completo de una liquidación */
    getSettlementDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: { input: { id: number } }) => {
        const detail = await getSettlementWithDetails(input.id);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Liquidación no encontrada" });
        return detail;
      }),

    /** Aprobar una liquidación */
    approveSettlement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }: { input: { id: number }; ctx: any }) => {
        const settlement = await getSettlementById(input.id);
        if (!settlement) throw new TRPCError({ code: "NOT_FOUND", message: "Liquidación no encontrada" });
        if (settlement.status !== "DRAFT") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden aprobar liquidaciones en estado BORRADOR" });
        }

        await updateSettlement(input.id, {
          status: "APPROVED",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        });

        return { message: "Liquidación aprobada" };
      }),

    /** Distribuir fondos a inversionistas (marcar como distribuido) */
    distributeSettlement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: { input: { id: number } }) => {
        const settlement = await getSettlementById(input.id);
        if (!settlement) throw new TRPCError({ code: "NOT_FOUND", message: "Liquidación no encontrada" });
        if (settlement.status !== "APPROVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden distribuir liquidaciones aprobadas" });
        }

        // Mark all investor shares as credited
        const shares = await getInvestorShares(input.id);
        for (const share of shares) {
          await updateInvestorShare(share.id, {
            status: "CREDITED",
            creditedAt: new Date(),
          });
        }

        await updateSettlement(input.id, {
          status: "DISTRIBUTED",
          distributedAt: new Date(),
        });

        return { message: `Fondos distribuidos a ${shares.length} inversionistas` };
      }),

    // ========================================================================
    // MÉTRICAS OPERATIVAS SLA (Admin)
    // ========================================================================

    /** Registrar métricas operativas de un período */
    recordMetrics: adminProcedure
      .input(z.object({
        stationId: z.number(),
        periodStart: z.string(),
        periodEnd: z.string(),
        availabilityPercent: z.number().min(0).max(100).optional(),
        totalUptimeHours: z.number().optional(),
        totalDowntimeHours: z.number().optional(),
        avgCriticalResponseHours: z.number().optional(),
        criticalTicketsCount: z.number().optional(),
        criticalTicketsResolved: z.number().optional(),
        platformUptimePercent: z.number().min(0).max(100).optional(),
        userSatisfactionScore: z.number().min(0).max(5).optional(),
        totalReviews: z.number().optional(),
        billingAccuracyPercent: z.number().min(0).max(100).optional(),
        totalTransactions: z.number().optional(),
        disputedTransactions: z.number().optional(),
        solarGenerationPercent: z.number().min(0).max(200).optional(),
        solarKwhGenerated: z.number().optional(),
        solarKwhExpected: z.number().optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        // Calculate SLA status
        let breachCount = 0;
        const targets = {
          availability: 95,
          responseTime: 24,
          platformUptime: 99,
          satisfaction: 4.0,
          billingAccuracy: 99.9,
          solarGeneration: 85,
        };

        if (input.availabilityPercent !== undefined && input.availabilityPercent < targets.availability) breachCount++;
        if (input.avgCriticalResponseHours !== undefined && input.avgCriticalResponseHours > targets.responseTime) breachCount++;
        if (input.platformUptimePercent !== undefined && input.platformUptimePercent < targets.platformUptime) breachCount++;
        if (input.userSatisfactionScore !== undefined && input.userSatisfactionScore < targets.satisfaction) breachCount++;
        if (input.billingAccuracyPercent !== undefined && input.billingAccuracyPercent < targets.billingAccuracy) breachCount++;
        if (input.solarGenerationPercent !== undefined && input.solarGenerationPercent < targets.solarGeneration) breachCount++;

        let slaStatus: "COMPLIANT" | "WARNING" | "BREACH" = "COMPLIANT";
        if (breachCount >= 3) slaStatus = "BREACH";
        else if (breachCount >= 1) slaStatus = "WARNING";

        // Check consecutive breach months
        const latest = await getLatestOperationalMetric(input.stationId);
        let consecutiveBreachMonths = 0;
        if (latest && latest.slaStatus === "BREACH") {
          consecutiveBreachMonths = (latest.consecutiveBreachMonths || 0) + 1;
        } else if (slaStatus === "BREACH") {
          consecutiveBreachMonths = 1;
        }

        // Determine penalty
        let penaltyApplied = "NONE";
        if (consecutiveBreachMonths >= 6) penaltyApplied = "DEFAULT_EVENT";
        else if (consecutiveBreachMonths >= 3) penaltyApplied = "FEE_REDUCTION_10";
        else if (consecutiveBreachMonths >= 1) penaltyApplied = "IMPROVEMENT_PLAN";

        const id = await createOperationalMetric({
          stationId: input.stationId,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          availabilityPercent: input.availabilityPercent !== undefined ? String(input.availabilityPercent) : "0",
          totalUptimeHours: input.totalUptimeHours !== undefined ? String(input.totalUptimeHours) : "0",
          totalDowntimeHours: input.totalDowntimeHours !== undefined ? String(input.totalDowntimeHours) : "0",
          avgCriticalResponseHours: input.avgCriticalResponseHours !== undefined ? String(input.avgCriticalResponseHours) : "0",
          criticalTicketsCount: input.criticalTicketsCount || 0,
          criticalTicketsResolved: input.criticalTicketsResolved || 0,
          platformUptimePercent: input.platformUptimePercent !== undefined ? String(input.platformUptimePercent) : "99.50",
          userSatisfactionScore: input.userSatisfactionScore !== undefined ? String(input.userSatisfactionScore) : "0",
          totalReviews: input.totalReviews || 0,
          billingAccuracyPercent: input.billingAccuracyPercent !== undefined ? String(input.billingAccuracyPercent) : "100.00",
          totalTransactions: input.totalTransactions || 0,
          disputedTransactions: input.disputedTransactions || 0,
          solarGenerationPercent: input.solarGenerationPercent !== undefined ? String(input.solarGenerationPercent) : "0",
          solarKwhGenerated: input.solarKwhGenerated !== undefined ? String(input.solarKwhGenerated) : "0",
          solarKwhExpected: input.solarKwhExpected !== undefined ? String(input.solarKwhExpected) : "0",
          slaStatus,
          slaBreachCount: breachCount,
          consecutiveBreachMonths,
          penaltyApplied,
        });

        return { id, slaStatus, breachCount, consecutiveBreachMonths, penaltyApplied };
      }),

    /** Obtener historial de métricas de una estación */
    getMetrics: protectedProcedure
      .input(z.object({
        stationId: z.number(),
        limit: z.number().default(12),
      }))
      .query(async ({ input }: { input: { stationId: number; limit: number } }) => {
        return getOperationalMetricsByStation(input.stationId, input.limit);
      }),

    /** Obtener última métrica de una estación */
    getLatestMetric: protectedProcedure
      .input(z.object({ stationId: z.number() }))
      .query(async ({ input }: { input: { stationId: number } }) => {
        return getLatestOperationalMetric(input.stationId);
      }),

    // ========================================================================
    // INVESTOR FINANCIAL DATA (Protected - investor access)
    // ========================================================================

    /** Historial de liquidaciones del inversionista */
    mySettlements: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx }: { ctx: any }) => {
        return getInvestorAllSettlements(ctx.user.id);
      }),

    /** Resumen financiero del inversionista */
    mySummary: protectedProcedure
      .query(async ({ ctx }: { ctx: any }) => {
        return getInvestorFinancialSummary(ctx.user.id);
      }),

    /** Detalle de una liquidación específica (con verificación de acceso) */
    mySettlementDetail: protectedProcedure
      .input(z.object({ settlementId: z.number() }))
      .query(async ({ input, ctx }: { input: { settlementId: number }; ctx: any }) => {
        const detail = await getSettlementWithDetails(input.settlementId);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND" });
        
        // Verify investor has a share in this settlement
        const myShare = detail.investorShares.find(s => s.investorUserId === ctx.user.id);
        if (!myShare && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta liquidación" });
        }
        
        return { ...detail, myShare };
      }),

    // ========================================================================
    // ESTACIONES COLECTIVAS (para selectors)
    // ========================================================================

    /** Listar estaciones que tienen crowdfunding (colectivas) */
    getCollectiveStations: adminProcedure
      .query(async () => {
        // Get stations that have crowdfunding projects linked
        const db = await (await import("../db")).getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
        const results = await db.execute(sql.raw(`
          SELECT DISTINCT cs.id, cs.name, cs.city, cs.address, cs.isOnline,
            cp.id as projectId, cp.targetAmount, cp.raisedAmount, cp.status as projectStatus
          FROM charging_stations cs
          INNER JOIN crowdfunding_projects cp ON cp.stationId = cs.id
          WHERE cp.crowdfunding_status IN ('ACTIVE', 'FUNDED', 'COMPLETED')
          ORDER BY cs.name
        `));
        return ((results as any)[0] || []).map((r: any) => ({
          id: Number(r.id),
          name: r.name,
          city: r.city,
          address: r.address,
          isOnline: Boolean(r.isOnline),
          projectId: Number(r.projectId),
          targetAmount: Number(r.targetAmount),
          raisedAmount: Number(r.raisedAmount),
          projectStatus: r.projectStatus,
        }));
      }),

    /** Obtener inversionistas de una estación */
    getStationInvestorsList: adminProcedure
      .input(z.object({ stationId: z.number() }))
      .query(async ({ input }: { input: { stationId: number } }) => {
        return getStationInvestors(input.stationId);
      }),

    // ================================================================
    // EXPORT FINANCIAL REPORT (PDF/Excel)
    // ================================================================

    /** Exportar reporte financiero del inversionista */
    exportFinancialReport: protectedProcedure
      .input(z.object({
        format: z.enum(["pdf", "excel"]),
      }))
      .mutation(async ({ ctx, input }: { ctx: any; input: { format: "pdf" | "excel" } }) => {
        const userId = ctx.user.id;
        const userName = ctx.user.name || "Inversionista";

        // Get investor financial summary
        const summary = await getInvestorFinancialSummary(userId);
        if (!summary) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron datos financieros" });
        }

        // Get all settlements for this investor
        const allSettlements = await getInvestorAllSettlements(userId);

        // Get investor shares
        const investorShares: Array<{ settlementId: number; amount: number; ownershipPercent: number; status: string }> = [];
        for (const s of allSettlements) {
          if (!s) continue;
          const shares = await getInvestorShares(s.id);
          const myShare = (shares || []).find((sh: any) => sh.investorUserId === userId);
          if (myShare && s) {
            investorShares.push({
              settlementId: s.id,
              amount: Number(myShare.netShare || 0),
              ownershipPercent: Number(myShare.participationPercent || 0),
              status: myShare.status || s?.status || "PENDING",
            });
          }
        }

        // Build settlement data with expense lines
        const settlementsData = await Promise.all(
          allSettlements.map(async (s: any) => {
            const detail = await getSettlementWithDetails(s.id);
            const station = await getChargingStationById(s.stationId);
            return {
              id: s.id,
              stationId: s.stationId,
              stationName: station?.name || `Estación #${s.stationId}`,
              periodType: s.periodType || "MONTHLY",
              periodStart: Number(s.periodStart),
              periodEnd: Number(s.periodEnd),
              grossRevenue: Number(s.grossRevenue || 0),
              totalExpenses: Number(s.totalExpenses || 0),
              netRevenue: Number(s.netRevenue || 0),
              investorTotalAmount: Number(s.investorTotalAmount || 0),
              platformAmount: Number(s.platformAmount || 0),
              status: s.status,
              expenseLines: (detail as any)?.expenseItems?.map((line: any) => ({
                category: line.category,
                description: line.description,
                amount: Number(line.amount || 0),
              })) || [],
            };
          })
        );

        // Calculate financial metrics
        const totalInvested = Number(summary.totalInvested || 0);
        const totalDistributed = Number((summary as any).totalDistributed || summary.totalNetEarnings || 0);
        const pendingBalance = Number((summary as any).pendingBalance || Math.max(0, totalInvested - totalDistributed));
        const distributedSettlements = allSettlements.filter((s: any) => s.status === "DISTRIBUTED");
        const monthlyAvg = distributedSettlements.length > 0
          ? distributedSettlements.reduce((sum: number, s: any) => sum + Number(s.investorTotalAmount || 0), 0) / distributedSettlements.length
          : 0;
        const monthlyReturnPct = totalInvested > 0 ? ((monthlyAvg / totalInvested) * 100) : 0;

        const exportOptions = {
          investorName: userName,
          settlements: settlementsData,
          summary: {
            totalInvested,
            totalDistributed,
            pendingBalance,
            totalSettlements: allSettlements.length,
            roiAccumulated: totalInvested > 0 ? ((totalDistributed / totalInvested) * 100) : 0,
            monthlyReturnPct,
            annualizedReturn: monthlyReturnPct * 12,
            recoveryMonths: monthlyAvg > 0 ? Math.ceil(pendingBalance / monthlyAvg) : 0,
          },
          investorShares,
        };

        let buffer: Buffer;
        let filename: string;
        let mimeType: string;

        if (input.format === "excel") {
          buffer = generateFinancialExcel(exportOptions);
          filename = `reporte_financiero_${new Date().toISOString().split("T")[0]}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else {
          buffer = generateFinancialPDF(exportOptions);
          filename = `reporte_financiero_${new Date().toISOString().split("T")[0]}.pdf`;
          mimeType = "application/pdf";
        }

        return {
          filename,
          mimeType,
          data: buffer.toString("base64"),
        };
      }),

    // ========================================================================
    // ALIADO COMERCIAL (HOST) FINANCIAL DATA
    // ========================================================================

    /** Estaciones donde el usuario es Aliado Comercial */
    hostStations: protectedProcedure
      .query(async ({ ctx }: { ctx: any }) => {
        return getHostStations(ctx.user.id);
      }),

    /** Resumen financiero del Aliado Comercial */
    hostSummary: protectedProcedure
      .query(async ({ ctx }: { ctx: any }) => {
        return getHostFinancialSummary(ctx.user.id);
      }),

    /** Historial de liquidaciones del Aliado Comercial */
    hostSettlements: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx }: { ctx: any }) => {
        return getHostSettlementHistory(ctx.user.id);
      }),

    /** Obtener configuración financiera de una estación (para admin) */
    getStationFinancialConfig: adminProcedure
      .input(z.object({ stationId: z.number() }))
      .query(async ({ input }: { input: { stationId: number } }) => {
        const station = await getChargingStationById(input.stationId);
        if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
        return {
          evgreenSharePercent: Number(station.evgreenSharePercent || 30),
          investorSharePercent: Number(station.investorSharePercent || 70),
          hostSharePercent: Number(station.hostSharePercent || 0),
          energyPurchaseCostPerKwh: Number(station.energyPurchaseCostPerKwh || 850),
          hostUserId: station.hostUserId,
          hostName: station.hostName,
        };
      }),

    /** Obtener todas las estaciones con su configuración financiera */
    getAllStationsFinancial: adminProcedure
      .query(async () => {
        const stations = await getAllChargingStations();
        return stations.map(s => ({
          id: s.id,
          name: s.name,
          city: s.city,
          evgreenSharePercent: Number(s.evgreenSharePercent || 30),
          investorSharePercent: Number(s.investorSharePercent || 70),
          hostSharePercent: Number(s.hostSharePercent || 0),
          energyPurchaseCostPerKwh: Number(s.energyPurchaseCostPerKwh || 850),
          hostUserId: s.hostUserId,
          hostName: s.hostName,
          isOnline: s.isOnline,
        }));
      }),

    // ========================================================================
    // FONDO DE MANTENIMIENTO
    // ========================================================================

    /** Obtener resumen del fondo de mantenimiento de una estación */
    maintenanceFundSummary: protectedProcedure
      .input(z.object({ stationId: z.number() }))
      .query(async ({ input }: { input: { stationId: number } }) => {
        return getMaintenanceFundSummary(input.stationId);
      }),

    /** Obtener historial del fondo de mantenimiento */
    maintenanceFundHistory: protectedProcedure
      .input(z.object({ stationId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }: { input: { stationId: number; limit: number } }) => {
        return getMaintenanceFundRecords(input.stationId, input.limit);
      }),

    /** Registrar un cobro/retiro del fondo de mantenimiento (solo admin) */
    maintenanceFundWithdraw: adminProcedure
      .input(z.object({
        stationId: z.number(),
        amount: z.number().min(1),
        description: z.string().min(5),
        maintenanceType: z.enum(['preventivo', 'correctivo']),
        maintenanceDetail: z.string().optional(),
        technicianName: z.string().optional(),
        invoiceNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const currentBalance = await getMaintenanceFundBalance(input.stationId);
        if (input.amount > currentBalance) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Fondos insuficientes. Balance actual: $${currentBalance.toLocaleString('es-CO')} COP. Monto solicitado: $${input.amount.toLocaleString('es-CO')} COP`,
          });
        }
        const id = await createMaintenanceFundRecord({
          stationId: input.stationId,
          type: 'withdrawal',
          amount: input.amount,
          description: input.description,
          maintenanceType: input.maintenanceType,
          maintenanceDetail: input.maintenanceDetail,
          technicianName: input.technicianName,
          invoiceNumber: input.invoiceNumber,
          balanceAfter: currentBalance - input.amount,
          createdBy: ctx.user.id,
        });
        return { id, newBalance: currentBalance - input.amount };
      }),
  });
}
