/**
 * Organizations Router - Gestión de tenants SaaS
 * Solo accesible por superadmin (admin/staff)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  organizations,
  platformPricingDefaults,
  orgBillingRecords,
} from "../../drizzle/schema";
import { eq, desc, sql, and, like, or } from "drizzle-orm";

export function buildOrganizationsRouter(router: any, adminProcedure: any) {
  return router({
    // Listar todas las organizaciones
    list: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          plan: z.enum(["starter", "professional", "enterprise"]).optional(),
          status: z.enum(["active", "suspended", "trial", "cancelled"]).optional(),
        }).optional()
      )
      .query(async ({ input }: any) => {
        const db = await getDb();
        let query = db!.select().from(organizations);
        
        const conditions: any[] = [];
        if (input?.search) {
          conditions.push(
            or(
              like(organizations.name, `%${input.search}%`),
              like(organizations.slug, `%${input.search}%`),
              like(organizations.contactEmail, `%${input.search}%`)
            )
          );
        }
        if (input?.plan) {
          conditions.push(eq(organizations.plan, input.plan));
        }
        if (input?.status) {
          conditions.push(eq(organizations.status, input.status));
        }
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
        
        return await (query as any).orderBy(desc(organizations.createdAt));
      }),

    // Obtener una organización por ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        const [org] = await db!
          .select()
          .from(organizations)
          .where(eq(organizations.id, input.id));
        
        if (!org) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organización no encontrada" });
        }
        return org;
      }),

    // Crear nueva organización
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
          slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
          plan: z.enum(["starter", "professional", "enterprise"]),
          contactName: z.string().optional(),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          nit: z.string().optional(),
          networkMember: z.boolean().default(true),
          supportIncluded: z.boolean().default(false),
          maxChargers: z.number().min(1).default(10),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        
        // Verificar slug único
        const [existing] = await db!
          .select()
          .from(organizations)
          .where(eq(organizations.slug, input.slug));
        
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "El slug ya está en uso" });
        }
        
        const [result] = await db!.insert(organizations).values({
          name: input.name,
          slug: input.slug,
          plan: input.plan,
          status: "trial",
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          nit: input.nit,
          networkMember: input.networkMember,
          supportIncluded: input.supportIncluded,
          maxChargers: input.maxChargers,
          notes: input.notes,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días trial
        });
        
        return { id: result.insertId, message: "Organización creada exitosamente" };
      }),

    // Actualizar organización
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          plan: z.enum(["starter", "professional", "enterprise"]).optional(),
          status: z.enum(["active", "suspended", "trial", "cancelled"]).optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          nit: z.string().optional(),
          logoUrl: z.string().optional(),
          primaryColor: z.string().optional(),
          secondaryColor: z.string().optional(),
          customDomain: z.string().optional(),
          appName: z.string().optional(),
          networkMember: z.boolean().optional(),
          supportIncluded: z.boolean().optional(),
          maxChargers: z.number().min(1).optional(),
          // Pricing overrides
          setupFeePerCharger: z.string().optional(),
          annualFeePerCharger: z.string().optional(),
          transactionFeePercent: z.string().optional(),
          supportFeePercent: z.string().optional(),
          networkDiscount: z.string().optional(),
          minMonthlyFeePerCharger: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        const { id, ...data } = input;
        
        // Filtrar campos undefined
        const updateData: any = {};
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        
        if (Object.keys(updateData).length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No hay campos para actualizar" });
        }
        
        await db!.update(organizations).set(updateData).where(eq(organizations.id, id));
        return { success: true, message: "Organización actualizada" };
      }),

    // Eliminar organización (soft delete via status)
    deactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!
          .update(organizations)
          .set({ status: "cancelled" })
          .where(eq(organizations.id, input.id));
        return { success: true, message: "Organización desactivada" };
      }),

    // ==========================================
    // PRICING DEFAULTS
    // ==========================================

    // Obtener pricing defaults (los 3 planes)
    getPricingDefaults: adminProcedure.query(async () => {
      const db = await getDb();
      return await db!.select().from(platformPricingDefaults);
    }),

    // Actualizar pricing de un plan
    updatePricingDefault: adminProcedure
      .input(
        z.object({
          plan: z.enum(["starter", "professional", "enterprise"]),
          setupFeePerCharger: z.string().optional(),
          annualFeePerCharger: z.string().optional(),
          transactionFeePercent: z.string().optional(),
          supportFeePercent: z.string().optional(),
          networkDiscount: z.string().optional(),
          minMonthlyFeePerCharger: z.string().optional(),
          maxChargers: z.number().optional(),
          uptimeSla: z.string().optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        const { plan, ...data } = input;
        
        const updateData: any = {};
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) updateData[key] = value;
        });
        
        await db!
          .update(platformPricingDefaults)
          .set(updateData)
          .where(eq(platformPricingDefaults.plan, plan));
        
        return { success: true, message: `Pricing del plan ${plan} actualizado` };
      }),

    // ==========================================
    // BILLING RECORDS
    // ==========================================

    // Obtener historial de facturación de una organización
    getBillingHistory: adminProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        return await db!
          .select()
          .from(orgBillingRecords)
          .where(eq(orgBillingRecords.organizationId, input.organizationId))
          .orderBy(desc(orgBillingRecords.createdAt));
      }),

    // Registrar un cobro
    createBillingRecord: adminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          type: z.enum(["setup", "annual_renewal", "transaction_fee", "support_fee", "minimum_fee"]),
          description: z.string().optional(),
          amount: z.string(),
          currency: z.string().default("USD"),
          periodStart: z.date().optional(),
          periodEnd: z.date().optional(),
          transactionCount: z.number().optional(),
          totalTransactionVolume: z.string().optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        const [result] = await db!.insert(orgBillingRecords).values(input);
        return { id: result.insertId, message: "Registro de facturación creado" };
      }),

    // Marcar cobro como pagado
    markBillingPaid: adminProcedure
      .input(z.object({ id: z.number(), invoiceUrl: z.string().optional() }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!
          .update(orgBillingRecords)
          .set({ status: "paid", paidAt: new Date(), invoiceUrl: input.invoiceUrl })
          .where(eq(orgBillingRecords.id, input.id));
        return { success: true };
      }),

    // ==========================================
    // STATS
    // ==========================================

    // Dashboard stats para el panel de organizaciones
    getStats: adminProcedure.query(async () => {
      const db = await getDb();
      
      const [stats] = await db!.select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`SUM(CASE WHEN org_status = 'active' THEN 1 ELSE 0 END)`,
        trial: sql<number>`SUM(CASE WHEN org_status = 'trial' THEN 1 ELSE 0 END)`,
        suspended: sql<number>`SUM(CASE WHEN org_status = 'suspended' THEN 1 ELSE 0 END)`,
        starter: sql<number>`SUM(CASE WHEN org_plan = 'starter' THEN 1 ELSE 0 END)`,
        professional: sql<number>`SUM(CASE WHEN org_plan = 'professional' THEN 1 ELSE 0 END)`,
        enterprise: sql<number>`SUM(CASE WHEN org_plan = 'enterprise' THEN 1 ELSE 0 END)`,
      }).from(organizations);
      
      const [revenue] = await db!.select({
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN billing_status = 'paid' THEN amount ELSE 0 END), 0)`,
        pendingRevenue: sql<string>`COALESCE(SUM(CASE WHEN billing_status = 'pending' THEN amount ELSE 0 END), 0)`,
      }).from(orgBillingRecords);
      
      return { ...stats, ...revenue };
    }),
  });
}
