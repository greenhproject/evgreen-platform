import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  advertiserProfiles,
  adCampaigns,
  adCampaignCreatives,
  users,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAdvertiser(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });
  const profile = await db
    .select()
    .from(advertiserProfiles)
    .where(eq(advertiserProfiles.userId, userId))
    .limit(1);
  if (!profile[0]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes un perfil de anunciante. Regístrate primero.",
    });
  }
  return profile[0];
}

// ─── Router de Anunciantes ────────────────────────────────────────────────────

export const advertiserRouter = router({
  // ── Registro y perfil ──────────────────────────────────────────────────────

  register: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(2).max(255),
        taxId: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        website: z.string().optional(),
        contactName: z.string().max(255).optional(),
        contactPhone: z.string().max(30).optional(),
        contactEmail: z.string().email().optional(),
        monthlyBudget: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select({ id: advertiserProfiles.id })
        .from(advertiserProfiles)
        .where(eq(advertiserProfiles.userId, ctx.user.id))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya tienes un perfil de anunciante." });
      }

      await db.insert(advertiserProfiles).values({
        userId: ctx.user.id,
        companyName: input.companyName,
        taxId: input.taxId,
        industry: input.industry,
        website: input.website,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        monthlyBudget: input.monthlyBudget,
        status: "pending",
      });

      await db
        .update(users)
        .set({ role: "advertiser" })
        .where(eq(users.id, ctx.user.id));

      return { success: true, message: "Perfil creado. Pendiente de aprobación." };
    }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const profile = await db
      .select()
      .from(advertiserProfiles)
      .where(eq(advertiserProfiles.userId, ctx.user.id))
      .limit(1);
    return profile[0] ?? null;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(2).max(255).optional(),
        taxId: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        website: z.string().optional(),
        contactName: z.string().max(255).optional(),
        contactPhone: z.string().max(30).optional(),
        contactEmail: z.string().email().optional(),
        monthlyBudget: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);
      await db
        .update(advertiserProfiles)
        .set({ ...input })
        .where(eq(advertiserProfiles.id, profile.id));
      return { success: true };
    }),

  // ── Campañas ───────────────────────────────────────────────────────────────

  createCampaign: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(255),
        objective: z.enum(["awareness", "traffic", "conversions", "app_install"]).default("awareness"),
        budgetTotal: z.number().int().positive(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        targetCities: z.array(z.string()).optional(),
        targetVehicleBrands: z.array(z.string()).optional(),
        targetSubscriptionTiers: z.array(z.string()).optional(),
        targetMinChargesPerMonth: z.number().int().optional(),
        targetActivitySegments: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);

      if (profile.status !== "approved") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tu perfil debe ser aprobado antes de crear campañas.",
        });
      }

      const result = await db.insert(adCampaigns).values({
        advertiserId: profile.id,
        name: input.name,
        objective: input.objective,
        budgetTotal: input.budgetTotal,
        startDate: input.startDate,
        endDate: input.endDate,
        targetCities: input.targetCities ?? null,
        targetVehicleBrands: input.targetVehicleBrands ?? null,
        targetSubscriptionTiers: input.targetSubscriptionTiers ?? null,
        targetMinChargesPerMonth: input.targetMinChargesPerMonth,
        targetActivitySegments: input.targetActivitySegments ?? null,
        status: "draft",
      });

      return { success: true, campaignId: Number((result as any).insertId) };
    }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const profile = await requireAdvertiser(ctx.user.id);
    return db
      .select()
      .from(adCampaigns)
      .where(eq(adCampaigns.advertiserId, profile.id))
      .orderBy(desc(adCampaigns.createdAt));
  }),

  getCampaign: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);

      const campaign = await db
        .select()
        .from(adCampaigns)
        .where(and(eq(adCampaigns.id, input.id), eq(adCampaigns.advertiserId, profile.id)))
        .limit(1);

      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campaña no encontrada." });

      const creatives = await db
        .select()
        .from(adCampaignCreatives)
        .where(eq(adCampaignCreatives.campaignId, input.id));

      return { ...campaign[0], creatives };
    }),

  updateCampaign: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(2).max(255).optional(),
        objective: z.enum(["awareness", "traffic", "conversions", "app_install"]).optional(),
        budgetTotal: z.number().int().positive().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        targetCities: z.array(z.string()).optional(),
        targetVehicleBrands: z.array(z.string()).optional(),
        targetSubscriptionTiers: z.array(z.string()).optional(),
        targetMinChargesPerMonth: z.number().int().optional(),
        targetActivitySegments: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);
      const { id, ...data } = input;

      const campaign = await db
        .select({ id: adCampaigns.id, status: adCampaigns.status })
        .from(adCampaigns)
        .where(and(eq(adCampaigns.id, id), eq(adCampaigns.advertiserId, profile.id)))
        .limit(1);

      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["draft", "paused"].includes(campaign[0].status ?? "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo puedes editar campañas en borrador o pausadas." });
      }

      await db.update(adCampaigns).set(data).where(eq(adCampaigns.id, id));
      return { success: true };
    }),

  submitForReview: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);

      const campaign = await db
        .select()
        .from(adCampaigns)
        .where(and(eq(adCampaigns.id, input.id), eq(adCampaigns.advertiserId, profile.id)))
        .limit(1);

      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign[0].status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo puedes enviar a revisión campañas en borrador." });
      }

      const creatives = await db
        .select({ id: adCampaignCreatives.id })
        .from(adCampaignCreatives)
        .where(eq(adCampaignCreatives.campaignId, input.id))
        .limit(1);

      if (!creatives[0]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Debes agregar al menos una creatividad antes de enviar a revisión." });
      }

      await db
        .update(adCampaigns)
        .set({ status: "pending_review" })
        .where(eq(adCampaigns.id, input.id));

      return { success: true };
    }),

  pauseCampaign: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);
      await db
        .update(adCampaigns)
        .set({ status: "paused" })
        .where(and(eq(adCampaigns.id, input.id), eq(adCampaigns.advertiserId, profile.id)));
      return { success: true };
    }),

  // ── Creatividades ──────────────────────────────────────────────────────────

  addCreative: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int(),
        format: z.enum(["SPLASH", "CHARGING", "MAP", "PROMOTIONAL"]).default("PROMOTIONAL"),
        imageUrl: z.string().url(),
        imageUrlMobile: z.string().url().optional(),
        title: z.string().min(1).max(255),
        subtitle: z.string().max(500).optional(),
        body: z.string().optional(),
        ctaText: z.string().max(100).optional(),
        linkUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);

      const campaign = await db
        .select({ id: adCampaigns.id })
        .from(adCampaigns)
        .where(and(eq(adCampaigns.id, input.campaignId), eq(adCampaigns.advertiserId, profile.id)))
        .limit(1);

      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const result = await db.insert(adCampaignCreatives).values({
        ...input,
        status: "draft",
      });

      return { success: true, creativeId: Number((result as any).insertId) };
    }),

  deleteCreative: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const profile = await requireAdvertiser(ctx.user.id);

      const creative = await db
        .select({ id: adCampaignCreatives.id })
        .from(adCampaignCreatives)
        .innerJoin(adCampaigns, eq(adCampaigns.id, adCampaignCreatives.campaignId))
        .where(
          and(
            eq(adCampaignCreatives.id, input.id),
            eq(adCampaigns.advertiserId, profile.id)
          )
        )
        .limit(1);

      if (!creative[0]) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(adCampaignCreatives).where(eq(adCampaignCreatives.id, input.id));
      return { success: true };
    }),

  // ── IA: sugerencias de campaña ─────────────────────────────────────────────

  getAiSuggestions: protectedProcedure
    .input(
      z.object({
        objective: z.string(),
        industry: z.string().optional(),
        monthlyBudget: z.number().optional(),
        targetDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Eres un experto en publicidad digital para plataformas de vehículos eléctricos en Colombia. La plataforma EVGreen tiene +10,000 conductores de VE activos. Responde SIEMPRE en español con JSON válido.`,
          },
          {
            role: "user",
            content: `Genera sugerencias de campaña publicitaria para:
- Objetivo: ${input.objective}
- Industria: ${input.industry ?? "No especificada"}
- Presupuesto mensual: ${input.monthlyBudget ? `$${input.monthlyBudget.toLocaleString()} COP` : "No especificado"}
- Audiencia objetivo: ${input.targetDescription ?? "Conductores de VE en Colombia"}

Devuelve un JSON con:
{
  "campaignName": "nombre sugerido",
  "targetCities": ["ciudad1", "ciudad2"],
  "targetVehicleBrands": ["marca1", "marca2"],
  "targetActivitySegments": ["segmento1"],
  "suggestedBudget": 500000,
  "estimatedImpressions": 10000,
  "estimatedClicks": 500,
  "copyTitle": "título del anuncio",
  "copySubtitle": "subtítulo",
  "copyBody": "cuerpo del mensaje",
  "ctaText": "texto del botón",
  "tips": ["consejo1", "consejo2", "consejo3"]
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "campaign_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                campaignName: { type: "string" },
                targetCities: { type: "array", items: { type: "string" } },
                targetVehicleBrands: { type: "array", items: { type: "string" } },
                targetActivitySegments: { type: "array", items: { type: "string" } },
                suggestedBudget: { type: "number" },
                estimatedImpressions: { type: "number" },
                estimatedClicks: { type: "number" },
                copyTitle: { type: "string" },
                copySubtitle: { type: "string" },
                copyBody: { type: "string" },
                ctaText: { type: "string" },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "campaignName", "targetCities", "targetVehicleBrands",
                "targetActivitySegments", "suggestedBudget", "estimatedImpressions",
                "estimatedClicks", "copyTitle", "copySubtitle", "copyBody",
                "ctaText", "tips",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al generar sugerencias." });

      try {
        return typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al procesar respuesta de IA." });
      }
    }),

  // ── Métricas del dashboard ─────────────────────────────────────────────────

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const profile = await requireAdvertiser(ctx.user.id);

    const campaigns = await db
      .select({
        id: adCampaigns.id,
        name: adCampaigns.name,
        status: adCampaigns.status,
        impressions: adCampaigns.impressions,
        clicks: adCampaigns.clicks,
        uniqueViews: adCampaigns.uniqueViews,
        budgetTotal: adCampaigns.budgetTotal,
        budgetSpent: adCampaigns.budgetSpent,
      })
      .from(adCampaigns)
      .where(eq(adCampaigns.advertiserId, profile.id));

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalBudgetSpent = 0;
    let activeCampaigns = 0;

    for (const c of campaigns) {
      totalImpressions += c.impressions ?? 0;
      totalClicks += c.clicks ?? 0;
      totalBudgetSpent += c.budgetSpent ?? 0;
      if (c.status === "active") activeCampaigns++;
    }

    const ctr = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

    return {
      profile,
      totalImpressions,
      totalClicks,
      totalBudgetSpent,
      activeCampaigns,
      totalCampaigns: campaigns.length,
      ctr,
      campaigns,
    };
  }),
});

// ─── Admin: gestión de anunciantes ────────────────────────────────────────────

export const adminAdvertiserRouter = router({
  listAdvertisers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db
      .select({
        id: advertiserProfiles.id,
        userId: advertiserProfiles.userId,
        companyName: advertiserProfiles.companyName,
        industry: advertiserProfiles.industry,
        status: advertiserProfiles.status,
        contactEmail: advertiserProfiles.contactEmail,
        monthlyBudget: advertiserProfiles.monthlyBudget,
        createdAt: advertiserProfiles.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(advertiserProfiles)
      .leftJoin(users, eq(users.id, advertiserProfiles.userId))
      .orderBy(desc(advertiserProfiles.createdAt));
  }),

  approveAdvertiser: protectedProcedure
    .input(z.object({ profileId: z.number().int(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const profile = await db
        .select({ userId: advertiserProfiles.userId })
        .from(advertiserProfiles)
        .where(eq(advertiserProfiles.id, input.profileId))
        .limit(1);

      if (!profile[0]) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(advertiserProfiles)
        .set({
          status: "approved",
          adminNotes: input.notes,
          approvedById: ctx.user.id,
          approvedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(advertiserProfiles.id, input.profileId));

      return { success: true };
    }),

  rejectAdvertiser: protectedProcedure
    .input(z.object({ profileId: z.number().int(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(advertiserProfiles)
        .set({ status: "rejected", adminNotes: input.notes })
        .where(eq(advertiserProfiles.id, input.profileId));

      return { success: true };
    }),

  listPendingCampaigns: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db
      .select({
        id: adCampaigns.id,
        name: adCampaigns.name,
        objective: adCampaigns.objective,
        status: adCampaigns.status,
        budgetTotal: adCampaigns.budgetTotal,
        createdAt: adCampaigns.createdAt,
        companyName: advertiserProfiles.companyName,
        advertiserId: adCampaigns.advertiserId,
      })
      .from(adCampaigns)
      .leftJoin(advertiserProfiles, eq(advertiserProfiles.id, adCampaigns.advertiserId))
      .where(eq(adCampaigns.status, "pending_review"))
      .orderBy(desc(adCampaigns.createdAt));
  }),

  approveCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number().int(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(adCampaigns)
        .set({
          status: "active",
          adminNotes: input.notes,
          reviewedById: ctx.user.id,
          reviewedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(adCampaigns.id, input.campaignId));

      await db
        .update(adCampaignCreatives)
        .set({ status: "approved" })
        .where(eq(adCampaignCreatives.campaignId, input.campaignId));

      return { success: true };
    }),

  rejectCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number().int(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(adCampaigns)
        .set({
          status: "rejected",
          adminNotes: input.notes,
          reviewedById: ctx.user.id,
          reviewedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(adCampaigns.id, input.campaignId));

      return { success: true };
    }),
});
