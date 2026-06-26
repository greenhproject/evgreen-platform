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
  supportMessages,
  users,
  transactions,
  tariffs,
} from "../../drizzle/schema";
import { eq, desc, sql, and, like, or, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure } from "../_core/trpc";

// Helper: default modules per plan
function getDefaultModules(plan: string): string[] {
  const base = ['dashboard', 'stations', 'transactions', 'tickets', 'settings'];
  const professional = [...base, 'analytics', 'dynamic_pricing', 'users', 'reports'];
  const enterprise = [...professional, 'billing', 'api_webhooks'];
  if (plan === 'enterprise') return enterprise;
  if (plan === 'professional') return professional;
  return base;
}

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
      // Usar SQL directo para evitar problemas de mismatch de schema en producción
      const [rows] = await db!.execute(sql`
        SELECT o.id, o.name, o.slug,
               o.org_plan as plan, o.org_status as status,
               o.logo_url as logoUrl, o.primary_color as primaryColor,
               o.secondary_color as secondaryColor, o.app_name as appName,
               o.custom_domain as customDomain, o.contact_name as contactName,
               o.contact_email as contactEmail, o.contact_phone as contactPhone,
               o.transaction_fee_percent as transactionFeePercent,
               o.next_billing_date as nextBillingDate,
               o.enabled_modules as enabledModules,
               o.support_mode as supportMode,
               o.support_chat_embed as supportChatEmbed,
               o.support_whatsapp as supportWhatsapp,
               ou.role as myRole
        FROM organizations o
        JOIN org_users ou ON ou.organization_id = o.id
        WHERE ou.user_id = ${ctx.user.id}
        LIMIT 1
      `) as any;
      const org = Array.isArray(rows) ? rows[0] : null;
      if (!org) return null;
      // Parse enabledModules si viene como string JSON
      if (org.enabledModules && typeof org.enabledModules === 'string') {
        try { org.enabledModules = JSON.parse(org.enabledModules); } catch {}
      }
      return org;
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

    // El admin de la org actualiza la configuración de una estación (precio, nombre, estado)
    updateMyStation: protectedProcedure
      .input(z.object({
        stationId: z.number(),
        name: z.string().min(3).max(255).optional(),
        description: z.string().max(1000).optional().nullable(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        contactPhone: z.string().max(20).optional().nullable(),
        operatingHours: z.any().optional(), // JSON: { monday: { open: '06:00', close: '22:00', enabled: true }, ... }
        // Tarifa activa de la estación
        pricePerKwh: z.number().min(0).optional(),
        pricePerMinute: z.number().min(0).optional(),
        pricePerSession: z.number().min(0).optional(),
        overstayPenaltyPerMinute: z.number().min(0).optional(),
        overstayGracePeriodMinutes: z.number().min(0).max(120).optional(),
        reservationFee: z.number().min(0).optional(),
        connectionFee: z.number().min(0).optional(),
        // Precios dinámicos IA
        autoPricing: z.boolean().optional(),
        priceMinKwh: z.number().min(0).optional(),
        priceMaxKwh: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        // Verificar que el usuario es admin de la org y que la estación pertenece a su org
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));

        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });
        if (membership.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo el admin puede configurar estaciones" });

        const [station] = await db!
          .select({ id: chargingStations.id })
          .from(chargingStations)
          .where(and(
            eq(chargingStations.id, input.stationId),
            eq(chargingStations.organizationId, membership.organizationId)
          ));

        if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada en tu organización" });

        // Actualizar campos de la estación
        const stationUpdate: Record<string, any> = {};
        if (input.name !== undefined) stationUpdate.name = input.name;
        if (input.description !== undefined) stationUpdate.description = input.description;
        if (input.isActive !== undefined) stationUpdate.isActive = input.isActive;
        if (input.isPublic !== undefined) stationUpdate.isPublic = input.isPublic;
        if (input.contactPhone !== undefined) stationUpdate.contactPhone = input.contactPhone;
        if (input.operatingHours !== undefined) stationUpdate.operatingHours = input.operatingHours;

        if (Object.keys(stationUpdate).length > 0) {
          await db!.update(chargingStations).set(stationUpdate).where(eq(chargingStations.id, input.stationId));
        }

        // Actualizar tarifa activa si se proporcionaron precios
        const hasTariffUpdate = input.pricePerKwh !== undefined || input.pricePerMinute !== undefined ||
          input.pricePerSession !== undefined || input.overstayPenaltyPerMinute !== undefined ||
          input.overstayGracePeriodMinutes !== undefined || input.reservationFee !== undefined ||
          input.connectionFee !== undefined || input.autoPricing !== undefined ||
          input.priceMinKwh !== undefined || input.priceMaxKwh !== undefined;

        if (hasTariffUpdate) {
          const [activeTariff] = await db!
            .select({ id: tariffs.id })
            .from(tariffs)
            .where(and(eq(tariffs.stationId, input.stationId), eq(tariffs.isActive, true)))
            .orderBy(desc(tariffs.createdAt))
            .limit(1);

          const tariffUpdate: Record<string, any> = {};
          if (input.pricePerKwh !== undefined) tariffUpdate.pricePerKwh = input.pricePerKwh.toString();
          if (input.pricePerMinute !== undefined) tariffUpdate.pricePerMinute = input.pricePerMinute.toString();
          if (input.pricePerSession !== undefined) tariffUpdate.pricePerSession = input.pricePerSession.toString();
          if (input.overstayPenaltyPerMinute !== undefined) tariffUpdate.overstayPenaltyPerMinute = input.overstayPenaltyPerMinute.toString();
          if (input.overstayGracePeriodMinutes !== undefined) tariffUpdate.overstayGracePeriodMinutes = input.overstayGracePeriodMinutes;
          if (input.reservationFee !== undefined) tariffUpdate.reservationFee = input.reservationFee.toString();
          if (input.connectionFee !== undefined) tariffUpdate.connectionFee = input.connectionFee.toString();
          if (input.autoPricing !== undefined) tariffUpdate.autoPricing = input.autoPricing;
          if (input.priceMinKwh !== undefined) tariffUpdate.priceMinKwh = input.priceMinKwh.toString();
          if (input.priceMaxKwh !== undefined) tariffUpdate.priceMaxKwh = input.priceMaxKwh.toString();

          if (activeTariff) {
            await db!.update(tariffs).set(tariffUpdate).where(eq(tariffs.id, activeTariff.id));
          } else {
            // Crear tarifa si no existe
            await db!.insert(tariffs).values({
              stationId: input.stationId,
              name: "Tarifa Principal",
              pricePerKwh: (input.pricePerKwh || 1800).toString(),
              pricePerMinute: (input.pricePerMinute || 0).toString(),
              pricePerSession: (input.pricePerSession || 0).toString(),
              overstayPenaltyPerMinute: (input.overstayPenaltyPerMinute || 0).toString(),
              overstayGracePeriodMinutes: input.overstayGracePeriodMinutes || 10,
              isActive: true,
            });
          }
        }

        return { success: true, message: "Estación actualizada correctamente" };
      }),

    // Obtener tarifa activa de una estación de la org
    getMyStationTariff: protectedProcedure
      .input(z.object({ stationId: z.number() }))
      .query(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));

        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

        const [station] = await db!
          .select({ id: chargingStations.id })
          .from(chargingStations)
          .where(and(
            eq(chargingStations.id, input.stationId),
            eq(chargingStations.organizationId, membership.organizationId)
          ));

        if (!station) throw new TRPCError({ code: "NOT_FOUND" });

        const [tariff] = await db!
          .select()
          .from(tariffs)
          .where(and(eq(tariffs.stationId, input.stationId), eq(tariffs.isActive, true)))
          .orderBy(desc(tariffs.createdAt))
          .limit(1);

        return tariff || null;
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

    // Obtener detalle de un ticket con mensajes
    getMyTicketDetail: protectedProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

        const [ticket] = await db!
          .select()
          .from(supportTickets)
          .where(and(
            eq(supportTickets.id, input.ticketId),
            eq(supportTickets.organizationId, membership.organizationId)
          ));
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket no encontrado" });

        // Obtener mensajes del ticket
        const messages = await db!
          .select({
            id: supportMessages.id,
            ticketId: supportMessages.ticketId,
            senderId: supportMessages.senderId,
            senderRole: supportMessages.senderRole,
            message: supportMessages.message,
            attachmentUrl: supportMessages.attachmentUrl,
            readAt: supportMessages.readAt,
            createdAt: supportMessages.createdAt,
            senderName: users.name,
          })
          .from(supportMessages)
          .leftJoin(users, eq(supportMessages.senderId, users.id))
          .where(eq(supportMessages.ticketId, input.ticketId))
          .orderBy(supportMessages.createdAt);

        // Marcar mensajes del agente como leídos
        await db!
          .update(supportMessages)
          .set({ readAt: new Date() })
          .where(and(
            eq(supportMessages.ticketId, input.ticketId),
            eq(supportMessages.senderRole, "agent"),
            isNull(supportMessages.readAt)
          ));

        return { ...ticket, messages };
      }),

    // Agregar mensaje a un ticket
    addTicketMessage: protectedProcedure
      .input(z.object({
        ticketId: z.number(),
        message: z.string().min(1).max(2000),
        attachmentUrl: z.string().url().optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

        const [ticket] = await db!
          .select({ id: supportTickets.id, status: supportTickets.status })
          .from(supportTickets)
          .where(and(
            eq(supportTickets.id, input.ticketId),
            eq(supportTickets.organizationId, membership.organizationId)
          ));
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
        if (ticket.status === "CLOSED") throw new TRPCError({ code: "BAD_REQUEST", message: "El ticket está cerrado" });

        await db!.insert(supportMessages).values({
          ticketId: input.ticketId,
          senderId: ctx.user.id,
          senderRole: "user",
          message: input.message,
          attachmentUrl: input.attachmentUrl,
        });

        // Si el ticket estaba resuelto, reabrirlo
        if (ticket.status === "RESOLVED") {
          await db!.update(supportTickets)
            .set({ status: "OPEN", resolvedAt: null })
            .where(eq(supportTickets.id, input.ticketId));
        }

        return { success: true };
      }),

    // Cerrar un ticket
    closeMyTicket: protectedProcedure
      .input(z.object({ ticketId: z.number() }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

        const [ticket] = await db!
          .select({ id: supportTickets.id })
          .from(supportTickets)
          .where(and(
            eq(supportTickets.id, input.ticketId),
            eq(supportTickets.organizationId, membership.organizationId)
          ));
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

        await db!.update(supportTickets)
          .set({ status: "CLOSED", resolvedAt: new Date() })
          .where(eq(supportTickets.id, input.ticketId));

        return { success: true };
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

    // El admin sube el logo directamente (base64 → S3)
    uploadOrgLogo: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        mimeType: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]),
        fileName: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ninguna organización" });
        if (membership.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo el admin puede subir el logo" });

        // Validar tamaño (max 2MB en base64 ≈ 2.7MB string)
        if (input.fileBase64.length > 3_600_000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo es demasiado grande. Máximo 2MB." });
        }

        const { storagePut } = await import("../storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const extMap: Record<string, string> = {
          "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
          "image/webp": "webp", "image/svg+xml": "svg",
        };
        const ext = extMap[input.mimeType] || "png";
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `org-logos/${membership.organizationId}-logo-${randomSuffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        await db!.update(organizations).set({ logoUrl: url }).where(eq(organizations.id, membership.organizationId));
        return { success: true, logoUrl: url };
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

    // Estadísticas de la organización: sesiones, kWh, ingresos
    getMyOrgStats: protectedProcedure
      .input(z.object({ period: z.enum(["7d", "30d", "90d", "all"]).default("30d") }).optional())
      .query(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId })
          .from(orgUsers)
          .where(eq(orgUsers.userId, ctx.user.id));

        if (!membership) return null;

        const period = input?.period || "30d";
        let dateFilter = "";
        if (period === "7d") dateFilter = "AND t.startTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        else if (period === "30d") dateFilter = "AND t.startTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        else if (period === "90d") dateFilter = "AND t.startTime >= DATE_SUB(NOW(), INTERVAL 90 DAY)";

        // Sesiones y kWh totales de las estaciones de la org
        const [stats] = await db!.execute(sql.raw(`
          SELECT
            COUNT(t.id) AS totalSessions,
            COALESCE(SUM(CAST(t.kwhConsumed AS DECIMAL(10,4))), 0) AS totalKwh,
            COALESCE(SUM(CAST(t.totalCost AS DECIMAL(12,2))), 0) AS totalRevenue,
            COALESCE(AVG(CAST(t.kwhConsumed AS DECIMAL(10,4))), 0) AS avgKwhPerSession,
            COUNT(DISTINCT t.userId) AS uniqueUsers
          FROM transactions t
          INNER JOIN charging_stations cs ON t.stationId = cs.id
          WHERE cs.organization_id = ${membership.organizationId}
            AND t.transaction_status = 'COMPLETED'
            ${dateFilter}
        `)) as any;

        const statsRow = Array.isArray(stats) ? stats[0] : stats;

        // Sesiones por día (últimos 7 días)
        const dailyRows = await db!.execute(sql.raw(`
          SELECT
            DATE(t.startTime) AS day,
            COUNT(*) AS sessions,
            COALESCE(SUM(CAST(t.kwhConsumed AS DECIMAL(10,4))), 0) AS kwh
          FROM transactions t
          INNER JOIN charging_stations cs ON t.stationId = cs.id
          WHERE cs.organization_id = ${membership.organizationId}
            AND t.transaction_status = 'COMPLETED'
            AND t.startTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(t.startTime)
          ORDER BY day ASC
        `)) as any;

        const daily = Array.isArray(dailyRows) ? dailyRows[0] : dailyRows;

        return {
          totalSessions: Number(statsRow?.totalSessions || 0),
          totalKwh: parseFloat(statsRow?.totalKwh || "0"),
          totalRevenue: parseFloat(statsRow?.totalRevenue || "0"),
          avgKwhPerSession: parseFloat(statsRow?.avgKwhPerSession || "0"),
          uniqueUsers: Number(statsRow?.uniqueUsers || 0),
          daily: Array.isArray(daily) ? daily : [],
          period,
        };
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
    // BILLING - ADMIN: cambiar plan + registrar pagos
    // ==========================================
    changePlanAdmin: adminProcedure
      .input(z.object({
        organizationId: z.number(),
        plan: z.enum(["starter", "professional", "enterprise"]),
        status: z.enum(["active", "suspended", "trial", "cancelled"]).optional(),
        transactionFeePercent: z.string().optional(),
        nextBillingDate: z.date().optional(),
        trialEndsAt: z.date().optional(),
        notes: z.string().optional(),
        recordSetupPayment: z.boolean().optional(),
        setupAmount: z.string().optional(),
        setupCurrency: z.string().default("USD").optional(),
        recordRenewalPayment: z.boolean().optional(),
        renewalAmount: z.string().optional(),
        renewalCurrency: z.string().default("USD").optional(),
      }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        const { organizationId, recordSetupPayment, setupAmount, setupCurrency,
          recordRenewalPayment, renewalAmount, renewalCurrency, ...orgUpdate } = input;
        const updateFields: any = {};
        if (orgUpdate.plan !== undefined) updateFields.plan = orgUpdate.plan;
        if (orgUpdate.status !== undefined) updateFields.status = orgUpdate.status;
        if (orgUpdate.transactionFeePercent !== undefined) updateFields.transactionFeePercent = orgUpdate.transactionFeePercent;
        if (orgUpdate.nextBillingDate !== undefined) updateFields.nextBillingDate = orgUpdate.nextBillingDate;
        if (orgUpdate.trialEndsAt !== undefined) updateFields.trialEndsAt = orgUpdate.trialEndsAt;
        if (orgUpdate.notes !== undefined) updateFields.notes = orgUpdate.notes;
        if (Object.keys(updateFields).length > 0) {
          await db!.update(organizations).set(updateFields).where(eq(organizations.id, organizationId));
        }
        if (recordSetupPayment && setupAmount) {
          await db!.insert(orgBillingRecords).values({
            organizationId, type: "setup",
            description: `Pago de setup - Plan ${orgUpdate.plan || "actualizado"}`,
            amount: setupAmount, currency: setupCurrency || "USD", status: "pending",
          });
        }
        if (recordRenewalPayment && renewalAmount) {
          await db!.insert(orgBillingRecords).values({
            organizationId, type: "annual_renewal",
            description: `Renovación anual - Plan ${orgUpdate.plan || "actualizado"}`,
            amount: renewalAmount, currency: renewalCurrency || "USD", status: "pending",
          });
        }
        return { success: true, message: "Plan y facturación actualizados" };
      }),

    getTransactionFeeAccrued: adminProcedure
      .input(z.object({ organizationId: z.number(), periodDays: z.number().default(30) }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        const since = new Date(Date.now() - input.periodDays * 24 * 60 * 60 * 1000);
        const [org] = await db!.select({
          transactionFeePercent: organizations.transactionFeePercent,
          plan: organizations.plan,
        }).from(organizations).where(eq(organizations.id, input.organizationId));
        let feePercent = parseFloat(org?.transactionFeePercent || "0");
        if (!feePercent && org?.plan) {
          const [defaults] = await db!.select({ transactionFeePercent: platformPricingDefaults.transactionFeePercent })
            .from(platformPricingDefaults).where(eq(platformPricingDefaults.plan, org.plan));
          feePercent = parseFloat(defaults?.transactionFeePercent || "5");
        }
        const [result] = await db!.execute(sql`
          SELECT COUNT(*) as session_count,
            COALESCE(SUM(t.totalCost), 0) as total_volume,
            COALESCE(SUM(t.totalCost * ${feePercent} / 100), 0) as fee_accrued
          FROM transactions t
          INNER JOIN charging_stations cs ON t.stationId = cs.id
          WHERE cs.organization_id = ${input.organizationId}
            AND t.transaction_status = 'COMPLETED' AND t.createdAt >= ${since}
        `) as any;
        const row = Array.isArray(result) ? result[0] : result;
        return {
          sessionCount: Number(row?.session_count || 0),
          totalVolumeCOP: parseFloat(row?.total_volume || "0"),
          feeAccruedCOP: parseFloat(row?.fee_accrued || "0"),
          feePercent, periodDays: input.periodDays,
        };
      }),

    // CLIENTE: ver billing y solicitar cambio de plan
    getMyBilling: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!
        .select({ organizationId: orgUsers.organizationId })
        .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
      const [org] = await db!.select({
        id: organizations.id, plan: organizations.plan, status: organizations.status,
        nextBillingDate: organizations.nextBillingDate, trialEndsAt: organizations.trialEndsAt,
        transactionFeePercent: organizations.transactionFeePercent, maxChargers: organizations.maxChargers,
      }).from(organizations).where(eq(organizations.id, membership.organizationId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      const [planDefaults] = await db!.select().from(platformPricingDefaults)
        .where(eq(platformPricingDefaults.plan, org.plan));
      const billingHistory = await db!.select().from(orgBillingRecords)
        .where(eq(orgBillingRecords.organizationId, membership.organizationId))
        .orderBy(desc(orgBillingRecords.createdAt)).limit(20);
      const feePercent = parseFloat(org.transactionFeePercent || planDefaults?.transactionFeePercent || "5");
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [feeResult] = await db!.execute(sql`
        SELECT COUNT(*) as session_count,
          COALESCE(SUM(t.totalCost), 0) as total_volume,
          COALESCE(SUM(t.totalCost * ${feePercent} / 100), 0) as fee_accrued
        FROM transactions t
        INNER JOIN charging_stations cs ON t.stationId = cs.id
        WHERE cs.organization_id = ${membership.organizationId}
          AND t.transaction_status = 'COMPLETED' AND t.createdAt >= ${since30d}
      `) as any;
      const feeRow = Array.isArray(feeResult) ? feeResult[0] : feeResult;
      return {
        org, planDefaults: planDefaults || null, billingHistory,
        currentPeriodFees: {
          sessionCount: Number(feeRow?.session_count || 0),
          totalVolumeCOP: parseFloat(feeRow?.total_volume || "0"),
          feeAccruedCOP: parseFloat(feeRow?.fee_accrued || "0"),
          feePercent,
        },
      };
    }),

    requestPlanChange: protectedProcedure
      .input(z.object({
        newPlan: z.enum(["starter", "professional", "enterprise"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!
          .select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
        if (membership.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo el admin puede solicitar cambio de plan" });
        const [org] = await db!.select({ plan: organizations.plan, name: organizations.name })
          .from(organizations).where(eq(organizations.id, membership.organizationId));
        await db!.insert(orgBillingRecords).values({
          organizationId: membership.organizationId, type: "setup",
          description: `SOLICITUD DE CAMBIO DE PLAN: ${org?.plan} → ${input.newPlan}${input.notes ? ` | Nota: ${input.notes}` : ""}`,
          amount: "0", currency: "USD", status: "pending",
        });
        try {
          const { notifyOwner } = await import("../_core/notification");
          await notifyOwner({
            title: `Solicitud de cambio de plan - ${org?.name}`,
            content: `La organización "${org?.name}" solicita cambiar del plan ${org?.plan} al plan ${input.newPlan}.${input.notes ? `\n\nNota: ${input.notes}` : ""}`,
          });
        } catch (_) {}
        return { success: true, message: "Solicitud enviada. El equipo de EVGreen la procesará en breve." };
      }),

    // ==========================================
    // MÓDULOS ACTIVABLES
    // ==========================================
    updateModules: adminProcedure
      .input(z.object({
        orgId: z.number(),
        modules: z.array(z.string()),
      }))
      .mutation(async ({ input }: any) => {
        const db = await getDb();
        await db!.execute(
          sql`UPDATE organizations SET enabled_modules = ${JSON.stringify(input.modules)} WHERE id = ${input.orgId}`
        );
        return { success: true };
      }),

    getMyModules: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!.select({ organizationId: orgUsers.organizationId })
        .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
      if (!membership) return { modules: getDefaultModules('professional') };
      // Fetch org with enabled_modules - handle missing column gracefully
      let orgPlan = 'starter';
      let saved: string[] | null = null;
      try {
        const [org] = await db!.select({ plan: organizations.plan, enabledModules: sql<string>`enabled_modules` })
          .from(organizations).where(eq(organizations.id, membership.organizationId));
        if (!org) return { modules: getDefaultModules('professional') };
        orgPlan = org.plan || 'starter';
        if (org.enabledModules) {
          // MySQL JSON column may return already-parsed array or a string
          const raw = org.enabledModules as any;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed) && parsed.length > 0) saved = parsed;
        }
      } catch {
        // Column may not exist in production yet - use plan-based defaults
        try {
          const [orgBasic] = await db!.select({ plan: organizations.plan })
            .from(organizations).where(eq(organizations.id, membership.organizationId));
          if (orgBasic) orgPlan = orgBasic.plan || 'starter';
        } catch {}
      }
      // If no explicit modules saved, use plan defaults (professional minimum)
      const planForDefault = orgPlan === 'enterprise' ? 'enterprise' : 'professional';
      return { modules: saved || getDefaultModules(planForDefault) };
    }),

    // ==========================================
    // CONFIG DE SOPORTE
    // ==========================================
    updateSupportConfig: protectedProcedure
      .input(z.object({
        supportPhone: z.string().max(50).optional(),
        supportEmail: z.string().email().max(200).optional(),
        supportWhatsapp: z.string().max(50).optional(),
        supportMode: z.enum(['org_only', 'evgreen_included']).optional(),
        supportChatEmbed: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!.select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
          .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
        if (!membership || membership.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const update: any = {};
        if (input.supportPhone !== undefined) update.supportPhone = input.supportPhone;
        if (input.supportEmail !== undefined) update.supportEmail = input.supportEmail;
        if (input.supportMode !== undefined) update.supportMode = input.supportMode;
        // supportWhatsapp and chatEmbed via raw SQL since not in drizzle schema yet
        await db!.execute(
          sql`UPDATE organizations SET 
            support_phone = COALESCE(${input.supportPhone ?? null}, support_phone),
            support_email = COALESCE(${input.supportEmail ?? null}, support_email),
            support_whatsapp = COALESCE(${input.supportWhatsapp ?? null}, support_whatsapp),
            support_mode = COALESCE(${input.supportMode ?? null}, support_mode),
            support_chat_embed = COALESCE(${input.supportChatEmbed ?? null}, support_chat_embed)
          WHERE id = ${membership.organizationId}`
        );
        return { success: true, message: 'Configuración de soporte actualizada' };
      }),

    getMySupportConfig: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!.select({ organizationId: orgUsers.organizationId })
        .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
      if (!membership) throw new TRPCError({ code: 'NOT_FOUND' });
      const [row] = await db!.execute(
        sql`SELECT support_phone, support_email, support_whatsapp, support_mode, support_chat_embed FROM organizations WHERE id = ${membership.organizationId}`
      ) as any;
      const r = Array.isArray(row) ? row[0] : row;
      return {
        supportPhone: r?.support_phone || '',
        supportEmail: r?.support_email || '',
        supportWhatsapp: r?.support_whatsapp || '',
        supportMode: r?.support_mode || 'org_only',
        supportChatEmbed: r?.support_chat_embed || '',
      };
    }),

    // ==========================================
    // USUARIOS DE LA ORG
    // ==========================================
    getOrgUsers: protectedProcedure.query(async ({ ctx }: any) => {
      const db = await getDb();
      const [membership] = await db!.select({ organizationId: orgUsers.organizationId, role: orgUsers.role })
        .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
      if (!membership || membership.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const members = await db!.select({
        userId: orgUsers.userId,
        role: orgUsers.role,
        joinedAt: orgUsers.createdAt,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
      }).from(orgUsers)
        .leftJoin(users, eq(orgUsers.userId, users.id))
        .where(eq(orgUsers.organizationId, membership.organizationId));
      return members;
    }),

    // ==========================================
    // TRANSACCIONES DE LA ORG
    // ==========================================
    getOrgTransactions: protectedProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        period: z.enum(['7d','30d','90d','all']).default('30d'),
        stationId: z.number().optional(),
      }))
      .query(async ({ ctx, input }: any) => {
        const db = await getDb();
        const [membership] = await db!.select({ organizationId: orgUsers.organizationId })
          .from(orgUsers).where(eq(orgUsers.userId, ctx.user.id));
        if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
        const cutoff = input.period === 'all' ? null :
          new Date(Date.now() - parseInt(input.period) * 24 * 60 * 60 * 1000);
        const stationIds = await db!.select({ id: chargingStations.id })
          .from(chargingStations)
          .where(eq(chargingStations.organizationId, membership.organizationId));
        if (!stationIds.length) return { transactions: [], total: 0, page: input.page };
        const ids = stationIds.map((s: any) => s.id);
        let whereClause = sql`t.stationId IN (${sql.join(ids.map((id: number) => sql`${id}`), sql`, `)})`;
        if (cutoff) whereClause = sql`${whereClause} AND t.startTime >= ${cutoff}`;
        if (input.stationId) whereClause = sql`${whereClause} AND t.stationId = ${input.stationId}`;
        const offset = (input.page - 1) * input.limit;
        const [rows, countRow] = await Promise.all([
          db!.execute(sql`
            SELECT t.id, t.stationId as station_id, t.startTime as start_time, t.endTime as end_time,
              t.kwhConsumed as energy_kwh, t.totalCost as total_cost,
              t.transaction_status as status, t.evseId as connector_id,
              st.name as station_name, u.name as user_name, u.email as user_email
            FROM transactions t
            LEFT JOIN charging_stations st ON t.stationId = st.id
            LEFT JOIN users u ON t.userId = u.id
            WHERE ${whereClause}
            ORDER BY t.startTime DESC
            LIMIT ${input.limit} OFFSET ${offset}
          `),
          db!.execute(sql`SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`),
        ]);
        const txs = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const cnt = Array.isArray(countRow) && Array.isArray(countRow[0]) ? countRow[0] : countRow;
        return {
          transactions: txs,
          total: (cnt as any)[0]?.total || 0,
          page: input.page,
        };
      }),

    // ==========================================
    // BRANDING POR SLUG (público, para login personalizado)
    // ==========================================
    getOrgBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }: any) => {
        const db = await getDb();
        const [org] = await db!.select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logoUrl: organizations.logoUrl,
          primaryColor: organizations.primaryColor,
          secondaryColor: organizations.secondaryColor,
          appName: organizations.appName,
          status: organizations.status,
        }).from(organizations).where(eq(organizations.slug, input.slug));
        if (!org) return null;
        return org;
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
