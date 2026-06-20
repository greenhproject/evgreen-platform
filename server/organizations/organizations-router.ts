/**
 * Organizations Router - Gestión de tenants SaaS
 * Solo accesible por superadmin (admin/staff)
 * Incluye: gestión de orgs, usuarios de org, asignación de estaciones, tickets de soporte
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  organizations,
  platformPricingDefaults,
  orgBillingRecords,
  orgUsers,
  chargingStations,
  supportTickets,
  users,
} from "../../drizzle/schema";
import { eq, desc, sql, and, like, or, isNull } from "drizzle-orm";
import { protectedProcedure } from "../_core/trpc";

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
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

    // Desactivar organización
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
    // ORG USERS (Administradores de la org)
    // ==========================================

    listOrgUsers: adminProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        return await db!
          .select({
            id: orgUsers.id,
            userId: orgUsers.userId,
            role: orgUsers.role,
            createdAt: orgUsers.createdAt,
            userName: users.name,
            userEmail: users.email,
          })
          .from(orgUsers)
          .leftJoin(users, eq(orgUsers.userId, users.id))
          .where(eq(orgUsers.organizationId, input.organizationId));
      }),

    addOrgUser: adminProcedure
      .input(z.object({
        organizationId: z.number(),
        userId: z.number(),
        role: z.enum(["admin", "viewer"]).default("admin"),
      }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!.insert(orgUsers).values(input);
        return { success: true, message: "Usuario agregado a la organización" };
      }),

    removeOrgUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!.delete(orgUsers).where(eq(orgUsers.id, input.id));
        return { success: true };
      }),

    // ==========================================
    // STATION ASSIGNMENT
    // ==========================================

    listOrgStations: adminProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        return await db!
          .select()
          .from(chargingStations)
          .where(eq(chargingStations.organizationId, input.organizationId));
      }),

    // Listar estaciones sin organización asignada (para asignar)
    listUnassignedStations: adminProcedure.query(async () => {
      const db = await getDb();
      return await db!
        .select({ id: chargingStations.id, name: chargingStations.name, city: chargingStations.city, address: chargingStations.address })
        .from(chargingStations)
        .where(isNull(chargingStations.organizationId));
    }),

    assignStation: adminProcedure
      .input(z.object({
        stationId: z.number(),
        organizationId: z.number().nullable(),
      }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!
          .update(chargingStations)
          .set({ organizationId: input.organizationId })
          .where(eq(chargingStations.id, input.stationId));
        return { success: true, message: input.organizationId ? "Estación asignada a la organización" : "Estación desvinculada" };
      }),

    // ==========================================
    // SUPPORT TICKETS (admin ve todos los de una org)
    // ==========================================

    listOrgTickets: adminProcedure
      .input(z.object({
        organizationId: z.number(),
        status: z.string().optional(),
      }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        const conditions: any[] = [eq(supportTickets.organizationId, input.organizationId)];
        if (input.status) conditions.push(eq(supportTickets.status, input.status));
        return await db!
          .select({
            id: supportTickets.id,
            subject: supportTickets.subject,
            description: supportTickets.description,
            category: supportTickets.category,
            priority: supportTickets.priority,
            status: supportTickets.status,
            createdAt: supportTickets.createdAt,
            updatedAt: supportTickets.updatedAt,
            resolution: supportTickets.resolution,
            resolvedAt: supportTickets.resolvedAt,
            stationId: supportTickets.stationId,
            userName: users.name,
            userEmail: users.email,
          })
          .from(supportTickets)
          .leftJoin(users, eq(supportTickets.userId, users.id))
          .where(and(...conditions))
          .orderBy(desc(supportTickets.createdAt));
      }),

    updateTicketStatus: adminProcedure
      .input(z.object({
        ticketId: z.number(),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
        resolution: z.string().optional(),
      }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        const updateData: any = { status: input.status, updatedAt: new Date() };
        if (input.resolution) updateData.resolution = input.resolution;
        if (input.status === "RESOLVED" || input.status === "CLOSED") updateData.resolvedAt = new Date();
        await db!.update(supportTickets).set(updateData).where(eq(supportTickets.id, input.ticketId));
        return { success: true };
      }),

    // ==========================================
    // ORG PORTAL - Procedures para el cliente SaaS
    // (usa protectedProcedure + verifica que el user pertenece a la org)
    // ==========================================

    // El cliente obtiene su propia organización
    getMyOrg: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!
        .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
        .from(orgUsers)
        .where(eq(orgUsers.userId, ctx.user.id));

      if (!membership) return null;

      const [org] = await db!
        .select()
        .from(organizations)
        .where(eq(organizations.id, membership.organizationId));

      return org ? { ...org, myRole: membership.role } : null;
    }),

    // El cliente ve sus estaciones
    getMyStations: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!
        .select({ organizationId: orgUsers.organizationId })
        .from(orgUsers)
        .where(eq(orgUsers.userId, ctx.user.id));

      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });

      return await db!
        .select()
        .from(chargingStations)
        .where(eq(chargingStations.organizationId, membership.organizationId));
    }),

    // El cliente crea un ticket de soporte
    createMyTicket: protectedProcedure
      .input(z.object({
        subject: z.string().min(5),
        description: z.string().min(10),
        category: z.enum(["CHARGING_ISSUE", "CONNECTIVITY", "PAYMENT", "APP_BUG", "MAINTENANCE", "OTHER"]),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
        stationId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));

        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });

        const [result] = await db!.insert(supportTickets).values({
          userId: ctx.user.id,
          organizationId: membership.organizationId,
          subject: input.subject,
          description: input.description,
          category: input.category,
          priority: input.priority,
          stationId: input.stationId,
          status: "OPEN",
        });

        return { id: result.insertId, message: "Ticket creado exitosamente" };
      }),

    // El cliente ve sus tickets
    getMyTickets: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));

        if (!membership) return [];

        const conditions: any[] = [eq(supportTickets.organizationId, membership.organizationId)];
        if (input?.status) conditions.push(eq(supportTickets.status, input.status));

        return await db!
          .select()
          .from(supportTickets)
          .where(and(...conditions))
          .orderBy(desc(supportTickets.createdAt));
      }),

    // El admin de la org actualiza el branding (logo, colores, nombre)
    updateMyBranding: protectedProcedure
      .input(
        z.object({
          logoUrl: z.string().url().nullable().optional(),
          primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          appName: z.string().max(60).optional(),
        })
      )
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });
        if (membership.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo el admin puede modificar el branding" });
        const update: Record<string, any> = {};
        if (input.logoUrl !== undefined) update.logoUrl = input.logoUrl;
        if (input.primaryColor) update.primaryColor = input.primaryColor;
        if (input.secondaryColor) update.secondaryColor = input.secondaryColor;
        if (input.appName !== undefined) update.appName = input.appName || null;
        if (Object.keys(update).length === 0) return { success: true, message: "Sin cambios" };
        await db!.update(organizations).set(update).where(eq(organizations.id, membership.organizationId));
        return { success: true, message: "Branding actualizado correctamente" };
      }),

    // El admin de la org configura su dominio personalizado
    updateMyDomain: protectedProcedure
      .input(z.object({ customDomain: z.string().max(253).nullable() }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });
        if (membership.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo el admin puede configurar el dominio" });
        await db!.update(organizations)
          .set({ customDomain: input.customDomain })
          .where(eq(organizations.id, membership.organizationId));
        return { success: true, message: input.customDomain ? `Dominio guardado: ${input.customDomain}` : "Dominio personalizado eliminado" };
      }),

    // ==========================================
    // PRICING DEFAULTS
    // ==========================================

    getPricingDefaults: adminProcedure.query(async () => {
      const db = await getDb();
      return await db!.select().from(platformPricingDefaults);
    }),

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
