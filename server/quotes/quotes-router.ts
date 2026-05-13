/**
 * EVGreen - Router de Cotizaciones Automatizadas
 * Permite a admin configurar catálogo de cargadores y a asesores crear/enviar cotizaciones
 * @author Green House Project
 */
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  chargersCatalog,
  quoteSettings,
  quotes,
  quoteItems,
} from "../../drizzle/schema";
import { eq, desc, and, sql, like, or } from "drizzle-orm";
import { randomBytes } from "crypto";

// ============================================================================
// ROLE GUARDS
// ============================================================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de administrador." });
  }
  return next({ ctx });
});

const advisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  // Admin, staff, host y comercial pueden crear cotizaciones
  const allowed = ["admin", "staff", "host", "investor", "comercial"];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de asesor comercial." });
  }
  return next({ ctx });
});

// ============================================================================
// HELPER: Generar número de cotización único
// ============================================================================

async function getDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
  return db;
}

async function generateQuoteNumber(): Promise<string> {
  const db = await getDatabase();
  const year = new Date().getFullYear();
  const prefix = `EVG-${year}-`;

  // Obtener el último número de cotización del año
  const [lastQuote] = await db
    .select({ quoteNumber: quotes.quoteNumber })
    .from(quotes)
    .where(like(quotes.quoteNumber, `${prefix}%`))
    .orderBy(desc(quotes.id))
    .limit(1);

  let nextNum = 1;
  if (lastQuote) {
    const lastNum = parseInt(lastQuote.quoteNumber.replace(prefix, ""), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

function generatePublicToken(): string {
  return randomBytes(32).toString("hex");
}

// ============================================================================
// QUOTES ROUTER
// ============================================================================

export const quotesRouter = router({
  // ========================================================================
  // CATÁLOGO DE CARGADORES (Admin)
  // ========================================================================

  /** Listar cargadores del catálogo */
  catalog: router({
    list: protectedProcedure.query(async () => {
      const db = await getDatabase();
      return db
        .select()
        .from(chargersCatalog)
        .where(eq(chargersCatalog.isActive, true))
        .orderBy(chargersCatalog.sortOrder);
    }),

    listAll: adminProcedure.query(async () => {
      const db = await getDatabase();
      return db.select().from(chargersCatalog).orderBy(chargersCatalog.sortOrder);
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(3),
          slug: z.string().min(2),
          powerKw: z.number().positive(),
          chargeType: z.enum(["AC", "DC"]),
          connectorType: z.string().min(2),
          price: z.number().positive(),
          description: z.string().optional(),
          features: z.array(z.string()).optional(),
          imageUrl: z.string().optional(),
          includesTransformer: z.boolean().optional(),
          cableMetersIncluded: z.number().optional(),
          warrantyYears: z.number().optional(),
          sortOrder: z.number().optional(),
          commissionPercent: z.number().min(0).max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const [result] = await db.insert(chargersCatalog).values({
          name: input.name,
          slug: input.slug,
          powerKw: input.powerKw.toString(),
          chargeType: input.chargeType,
          connectorType: input.connectorType,
          price: input.price,
          description: input.description || null,
          features: input.features || [],
          imageUrl: input.imageUrl || null,
          includesTransformer: input.includesTransformer ?? false,
          cableMetersIncluded: input.cableMetersIncluded ?? 10,
          warrantyYears: input.warrantyYears ?? 2,
          sortOrder: input.sortOrder ?? 0,
          commissionPercent: (input.commissionPercent ?? 0).toFixed(2),
        });
        return { id: result.insertId };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(3).optional(),
          slug: z.string().min(2).optional(),
          powerKw: z.number().positive().optional(),
          chargeType: z.enum(["AC", "DC"]).optional(),
          connectorType: z.string().min(2).optional(),
          price: z.number().positive().optional(),
          description: z.string().optional(),
          features: z.array(z.string()).optional(),
          imageUrl: z.string().optional(),
          includesTransformer: z.boolean().optional(),
          cableMetersIncluded: z.number().optional(),
          warrantyYears: z.number().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
          commissionPercent: z.number().min(0).max(100).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.slug !== undefined) updateData.slug = data.slug;
        if (data.powerKw !== undefined) updateData.powerKw = data.powerKw.toString();
        if (data.chargeType !== undefined) updateData.chargeType = data.chargeType;
        if (data.connectorType !== undefined) updateData.connectorType = data.connectorType;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.features !== undefined) updateData.features = data.features;
        if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
        if (data.includesTransformer !== undefined) updateData.includesTransformer = data.includesTransformer;
        if (data.cableMetersIncluded !== undefined) updateData.cableMetersIncluded = data.cableMetersIncluded;
        if (data.warrantyYears !== undefined) updateData.warrantyYears = data.warrantyYears;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.commissionPercent !== undefined) updateData.commissionPercent = data.commissionPercent.toFixed(2);

        await db.update(chargersCatalog).set(updateData).where(eq(chargersCatalog.id, id));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        // Soft delete
        await db.update(chargersCatalog).set({ isActive: false }).where(eq(chargersCatalog.id, input.id));
        return { success: true };
      }),

    /** Subir imagen de producto al catálogo */
    uploadImage: adminProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        contentType: z.string().refine(
          (ct) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(ct),
          { message: "Solo se permiten imágenes (JPEG, PNG, WebP, GIF)" }
        ),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("../storage");
        const ext = input.fileName.split(".").pop() || "jpg";
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `catalog-chargers/${timestamp}-${randomSuffix}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");

        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La imagen no puede superar 5MB" });
        }

        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url, fileKey };
      }),
  }),

  // ========================================================================
  // CONFIGURACIÓN DE COTIZACIONES (Admin)
  // ========================================================================

  settings: router({
    get: adminProcedure.query(async () => {
      const db = await getDatabase();
      const [settings] = await db.select().from(quoteSettings).limit(1);
      if (!settings) {
        // Crear configuración por defecto
        const [result] = await db.insert(quoteSettings).values({
          validityDays: 30,
          evgreenFeePercent: 30,
          ownerSharePercent: 70,
          benefitsDescription: JSON.stringify([
            "Operación y monitoreo 24/7 de la estación de carga",
            "Mantenimiento preventivo y correctivo incluido",
            "Soporte técnico especializado para usuarios",
            "Licencia de software de gestión con Inteligencia Artificial",
            "Plataforma de cobro y facturación electrónica",
            "App móvil para usuarios con mapa, reservas y pagos",
            "Tarifa dinámica inteligente para maximizar ingresos",
            "Reportes y analítica en tiempo real",
            "Seguro contra daños y vandalismo",
            "Actualizaciones de firmware y software sin costo",
          ]),
          exclusions: "No incluye obras civiles adicionales, cableado o tubería superior a 10 metros desde el punto de conexión hasta el cargador, ni adecuaciones estructurales. Estos costos serán validados y cotizados por separado tras la visita técnica previa.",
          termsAndConditions: "Precios válidos por 30 días calendario. Incluye instalación llave en mano: cargador(es), transformador (cuando aplique), hasta 10 metros de cableado y tubería desde el punto de conexión hasta el cargador. Se requiere visita técnica previa para validar condiciones del sitio (la visita tiene costo pero se descuenta del valor total al momento de la compra). Garantía de 2 años en equipos. Tiempo de instalación estimado: 15-30 días hábiles tras aprobación.",
        });
        const [newSettings] = await db.select().from(quoteSettings).where(eq(quoteSettings.id, result.insertId));
        return newSettings;
      }
      return settings;
    }),

    /** Obtener defaults de modelo financiero para precargar en formulario de crear cotización */
    getDefaults: protectedProcedure.query(async () => {
      const db = await getDatabase();
      const [settings] = await db.select().from(quoteSettings).limit(1);
      return {
        evgreenFeePercent: settings?.evgreenFeePercent || 30,
        ownerSharePercent: settings?.ownerSharePercent || 70,
        hostSharePercent: (settings as any)?.hostSharePercent || 0,
        defaultEnergyCostPerKwh: (settings as any)?.defaultEnergyCostPerKwh || 700,
        defaultSalePricePerKwh: (settings as any)?.defaultSalePricePerKwh || 1800,
        defaultDailyHours: parseFloat((settings as any)?.defaultDailyHours || "4.0"),
      };
    }),

    update: adminProcedure
      .input(
        z.object({
          validityDays: z.number().min(7).max(90).optional(),
          evgreenFeePercent: z.number().min(10).max(50).optional(),
          ownerSharePercent: z.number().min(50).max(90).optional(),
          hostSharePercent: z.number().min(0).max(50).optional(),
          defaultEnergyCostPerKwh: z.number().min(100).max(5000).optional(),
          defaultSalePricePerKwh: z.number().min(500).max(10000).optional(),
          defaultDailyHours: z.string().optional(),
          companyName: z.string().optional(),
          companyNit: z.string().optional(),
          companyPhone: z.string().optional(),
          companyEmail: z.string().optional(),
          companyWebsite: z.string().optional(),
          headerMessage: z.string().optional(),
          footerMessage: z.string().optional(),
          termsAndConditions: z.string().optional(),
          exclusions: z.string().optional(),
          benefitsDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const [existing] = await db.select().from(quoteSettings).limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Configuración no encontrada" });
        }
        await db.update(quoteSettings).set(input).where(eq(quoteSettings.id, existing.id));
        return { success: true };
      }),
  }),

  // ========================================================================
  // COTIZACIONES (Asesor Comercial)
  // ========================================================================

  /** Crear nueva cotización */
  create: advisorProcedure
    .input(
      z.object({
        clientName: z.string().min(2),
        clientEmail: z.string().email(),
        clientPhone: z.string().optional(),
        clientCompany: z.string().optional(),
        clientCity: z.string().optional(),
        items: z.array(
          z.object({
            catalogItemId: z.number(),
            quantity: z.number().min(1).max(50),
          })
        ).min(1),
        clientNotes: z.string().optional(),
        internalNotes: z.string().optional(),
        discount: z.number().min(0).optional(),
        // Modelo financiero personalizado
        evgreenSharePercent: z.number().min(0).max(100).optional(),
        investorSharePercent: z.number().min(0).max(100).optional(),
        hostSharePercent: z.number().min(0).max(100).optional(),
        // Proyección de ingresos
        projectionEnergyCostPerKwh: z.number().min(100).max(5000).optional(),
        projectionSalePricePerKwh: z.number().min(500).max(10000).optional(),
        projectionDailyHours: z.number().min(1).max(24).optional(),
        projectionScenario: z.enum(["pessimistic", "realistic", "optimistic"]).optional(),
        showProjection: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Obtener configuración
      const [settings] = await db.select().from(quoteSettings).limit(1);
      const validityDays = settings?.validityDays || 30;

      // Obtener items del catálogo
      const catalogIds = input.items.map((i) => i.catalogItemId);
      const catalogItems = await db
        .select()
        .from(chargersCatalog)
        .where(
          and(
            sql`${chargersCatalog.id} IN (${sql.join(catalogIds.map(id => sql`${id}`), sql`, `)})`,
            eq(chargersCatalog.isActive, true)
          )
        );

      if (catalogItems.length !== catalogIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Uno o más productos no están disponibles." });
      }

      // Calcular totales y comisiones
      let subtotal = 0;
      let totalCommission = 0;
      const itemsToInsert = input.items.map((item) => {
        const catalogItem = catalogItems.find((c) => c.id === item.catalogItemId)!;
        const lineTotal = catalogItem.price * item.quantity;
        subtotal += lineTotal;
        const commPct = parseFloat(catalogItem.commissionPercent || "0");
        const commAmount = Math.round(lineTotal * commPct / 100);
        totalCommission += commAmount;
        return {
          catalogItemId: item.catalogItemId,
          productName: catalogItem.name,
          productPowerKw: catalogItem.powerKw,
          productChargeType: catalogItem.chargeType,
          productConnector: catalogItem.connectorType,
          unitPrice: catalogItem.price,
          quantity: item.quantity,
          lineTotal,
          includesTransformer: catalogItem.includesTransformer,
          cableMetersIncluded: catalogItem.cableMetersIncluded,
          productImageUrl: catalogItem.imageUrl || null,
          commissionPercent: commPct.toFixed(2),
          commissionAmount: commAmount,
        };
      });

      const discount = input.discount || 0;
      const total = subtotal - discount;

      // Generar número y token
      const quoteNumber = await generateQuoteNumber();
      const publicToken = generatePublicToken();

      // Calcular fecha de expiración
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);

      // Insertar cotización
      const [quoteResult] = await db.insert(quotes).values({
        quoteNumber,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone || null,
        clientCompany: input.clientCompany || null,
        clientCity: input.clientCity || null,
        advisorId: ctx.user.id,
        advisorName: ctx.user.name || "Asesor EVGreen",
        status: "DRAFT",
        subtotal,
        discount,
        total,
        totalCommission,
        validityDays,
        expiresAt,
        clientNotes: input.clientNotes || null,
        internalNotes: input.internalNotes || null,
        publicToken,
        // Modelo financiero personalizado
        evgreenSharePercent: input.evgreenSharePercent?.toString() || settings?.evgreenFeePercent?.toString() || "30.00",
        investorSharePercent: input.investorSharePercent?.toString() || settings?.ownerSharePercent?.toString() || "70.00",
        hostSharePercent: input.hostSharePercent?.toString() || settings?.hostSharePercent?.toString() || "0.00",
        // Proyección de ingresos
        projectionEnergyCostPerKwh: input.projectionEnergyCostPerKwh || (settings as any)?.defaultEnergyCostPerKwh || 700,
        projectionSalePricePerKwh: input.projectionSalePricePerKwh || (settings as any)?.defaultSalePricePerKwh || 1800,
        projectionDailyHours: input.projectionDailyHours?.toString() || (settings as any)?.defaultDailyHours?.toString() || "4.0",
        projectionScenario: input.projectionScenario || "realistic",
        showProjection: input.showProjection !== undefined ? input.showProjection : true,
      });

      const quoteId = quoteResult.insertId;

      // Insertar items
      for (const item of itemsToInsert) {
        await db.insert(quoteItems).values({
          quoteId,
          ...item,
        });
      }

      return { id: quoteId, quoteNumber, publicToken };
    }),

  /** Listar cotizaciones (asesor ve las suyas, admin ve todas) */
  list: advisorProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      let conditions: any[] = [];

      // Admin/staff ve todas, otros solo las suyas
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        conditions.push(eq(quotes.advisorId, ctx.user.id));
      }

      if (input?.status) {
        conditions.push(eq(quotes.status, input.status));
      }

      if (input?.search) {
        conditions.push(
          or(
            like(quotes.clientName, `%${input.search}%`),
            like(quotes.clientEmail, `%${input.search}%`),
            like(quotes.quoteNumber, `%${input.search}%`),
            like(quotes.clientCompany, `%${input.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(quotes)
        .where(whereClause)
        .orderBy(desc(quotes.createdAt))
        .limit(limit)
        .offset(offset);

      // Contar total
      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quotes)
        .where(whereClause);

      return { quotes: results, total: countResult?.count || 0 };
    }),

  /** Obtener detalle de una cotización */
  getById: advisorProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.id));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Verificar acceso (admin/staff ven todas, comercial/host solo las suyas)
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      if (!isAdmin && quote.advisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.id));
      const [settings] = await db.select().from(quoteSettings).limit(1);

      return { quote, items, settings };
    }),

  /** Vista pública de cotización (sin autenticación, por token) */
  getPublic: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [quote] = await db.select().from(quotes).where(eq(quotes.publicToken, input.token));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Marcar como vista si es la primera vez
      if (!quote.viewedAt) {
        await db.update(quotes).set({
          viewedAt: new Date(),
          viewCount: 1,
          status: quote.status === "SENT" ? "VIEWED" : quote.status,
        }).where(eq(quotes.id, quote.id));
      } else {
        await db.update(quotes).set({
          viewCount: (quote.viewCount || 0) + 1,
        }).where(eq(quotes.id, quote.id));
      }

      const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id));
      const [settings] = await db.select().from(quoteSettings).limit(1);

      return { quote, items, settings };
    }),

  /** Marcar cotización como enviada */
  markSent: advisorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.update(quotes).set({
        status: "SENT",
        sentAt: new Date(),
      }).where(eq(quotes.id, input.id));
      return { success: true };
    }),

  /** Actualizar estado de cotización */
  updateStatus: advisorProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["ACCEPTED", "REJECTED", "EXPIRED"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const updateData: any = { status: input.status };
      if (input.status === "ACCEPTED") updateData.acceptedAt = new Date();
      if (input.status === "REJECTED") updateData.rejectedAt = new Date();

      await db.update(quotes).set(updateData).where(eq(quotes.id, input.id));
      return { success: true };
    }),

  /** Duplicar cotización */
  duplicate: advisorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [original] = await db.select().from(quotes).where(eq(quotes.id, input.id));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const originalItems = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.id));

      const quoteNumber = await generateQuoteNumber();
      const publicToken = generatePublicToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + original.validityDays);

      const [newQuote] = await db.insert(quotes).values({
        quoteNumber,
        clientName: original.clientName,
        clientEmail: original.clientEmail,
        clientPhone: original.clientPhone,
        clientCompany: original.clientCompany,
        clientCity: original.clientCity,
        advisorId: ctx.user.id,
        advisorName: ctx.user.name || "Asesor EVGreen",
        status: "DRAFT",
        subtotal: original.subtotal,
        discount: original.discount,
        total: original.total,
        validityDays: original.validityDays,
        expiresAt,
        clientNotes: original.clientNotes,
        internalNotes: original.internalNotes,
        publicToken,
        // Copiar modelo financiero
        evgreenSharePercent: original.evgreenSharePercent,
        investorSharePercent: original.investorSharePercent,
        hostSharePercent: original.hostSharePercent,
        projectionEnergyCostPerKwh: original.projectionEnergyCostPerKwh,
        projectionSalePricePerKwh: original.projectionSalePricePerKwh,
        projectionDailyHours: original.projectionDailyHours,
        projectionScenario: original.projectionScenario,
        showProjection: original.showProjection,
      });

      const newQuoteId = newQuote.insertId;
      for (const item of originalItems) {
        await db.insert(quoteItems).values({
          quoteId: newQuoteId,
          catalogItemId: item.catalogItemId,
          productName: item.productName,
          productPowerKw: item.productPowerKw,
          productChargeType: item.productChargeType,
          productConnector: item.productConnector,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          includesTransformer: item.includesTransformer,
          cableMetersIncluded: item.cableMetersIncluded,
          productImageUrl: item.productImageUrl || null,
        });
      }

      return { id: newQuoteId, quoteNumber };
    }),

  /** Estadísticas de cotizaciones */
  stats: advisorProcedure.query(async ({ ctx }) => {
    const db = await getDatabase();
    let conditions: any[] = [];
    if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
      conditions.push(eq(quotes.advisorId, ctx.user.id));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allQuotes = await db.select().from(quotes).where(whereClause);

    const total = allQuotes.length;
    const draft = allQuotes.filter((q: any) => q.status === "DRAFT").length;
    const sent = allQuotes.filter((q: any) => q.status === "SENT").length;
    const viewed = allQuotes.filter((q: any) => q.status === "VIEWED").length;
    const accepted = allQuotes.filter((q: any) => q.status === "ACCEPTED").length;
    const rejected = allQuotes.filter((q: any) => q.status === "REJECTED").length;
    const expired = allQuotes.filter((q: any) => q.status === "EXPIRED").length;
    const totalValue = allQuotes.reduce((sum: number, q: any) => sum + (q.total || 0), 0);
    const acceptedValue = allQuotes.filter((q: any) => q.status === "ACCEPTED").reduce((sum: number, q: any) => sum + (q.total || 0), 0);
    const conversionRate = sent + viewed + accepted + rejected > 0
      ? Math.round((accepted / (sent + viewed + accepted + rejected)) * 100)
      : 0;

    // Comisiones
    const totalCommission = allQuotes.reduce((sum: number, q: any) => sum + (q.totalCommission || 0), 0);
    const acceptedCommission = allQuotes.filter((q: any) => q.status === "ACCEPTED").reduce((sum: number, q: any) => sum + (q.totalCommission || 0), 0);
    const pendingCommission = allQuotes.filter((q: any) => ["SENT", "VIEWED", "DRAFT"].includes(q.status)).reduce((sum: number, q: any) => sum + (q.totalCommission || 0), 0);

    return { total, draft, sent, viewed, accepted, rejected, expired, totalValue, acceptedValue, conversionRate, totalCommission, acceptedCommission, pendingCommission };
  }),

  /** Guardar URL del PDF generado */
  savePdfUrl: advisorProcedure
    .input(z.object({ id: z.number(), pdfUrl: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.update(quotes).set({ pdfUrl: input.pdfUrl }).where(eq(quotes.id, input.id));
      return { success: true };
    }),

  /** Enviar cotización por email al cliente */
  sendEmail: advisorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.id));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Verificar acceso (admin/staff ven todas, comercial/host solo las suyas)
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      if (!isAdmin && quote.advisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.id));
      const [settings] = await db.select().from(quoteSettings).limit(1);

      if (!settings) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure primero los ajustes de cotización." });
      }

      // Importar servicio de envío
      const { sendQuoteEmail } = await import("./quote-send-service");

      const baseUrl = ctx.req?.headers?.origin || "https://evgreen.lat";

      const result = await sendQuoteEmail({
        quoteNumber: quote.quoteNumber,
        createdAt: quote.createdAt,
        expiresAt: quote.expiresAt,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone,
        clientCompany: quote.clientCompany,
        clientCity: quote.clientCity,
        clientNotes: quote.clientNotes,
        advisorName: quote.advisorName,
        subtotal: quote.subtotal,
        discount: quote.discount || 0,
        total: quote.total,
        publicToken: quote.publicToken,
        items: items.map((item: any) => ({
          productName: item.productName,
          productPowerKw: item.productPowerKw,
          productChargeType: item.productChargeType,
          productConnector: item.productConnector,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          includesTransformer: item.includesTransformer || false,
          cableMetersIncluded: item.cableMetersIncluded || 10,
          productImageUrl: item.productImageUrl || null,
        })),
        settings: {
          companyName: settings.companyName || "EVGreen",
          companyNit: settings.companyNit || "",
          companyPhone: settings.companyPhone || "",
          companyEmail: settings.companyEmail || "",
          companyWebsite: settings.companyWebsite || "",
          evgreenFeePercent: settings.evgreenFeePercent,
          ownerSharePercent: settings.ownerSharePercent,
          headerMessage: settings.headerMessage || "",
          footerMessage: settings.footerMessage || "",
          termsAndConditions: settings.termsAndConditions || "",
          exclusions: settings.exclusions || "",
          benefitsDescription: settings.benefitsDescription || "",
        },
        baseUrl,
        financialModel: {
          evgreenSharePercent: parseFloat(quote.evgreenSharePercent || "0") || settings.evgreenFeePercent,
          investorSharePercent: parseFloat(quote.investorSharePercent || "0") || settings.ownerSharePercent,
          hostSharePercent: parseFloat(quote.hostSharePercent || "0") || 0,
        },
        projection: {
          show: quote.showProjection ?? true,
          energyCostPerKwh: quote.projectionEnergyCostPerKwh || 700,
          salePricePerKwh: quote.projectionSalePricePerKwh || 1800,
          dailyHours: parseFloat(quote.projectionDailyHours || "4.0"),
          scenario: quote.projectionScenario || "realistic",
          totalKw: items.reduce((acc: number, item: any) => acc + (parseFloat(item.productPowerKw) || 0) * item.quantity, 0),
        },
      });

      if (result.success) {
        // Actualizar estado a SENT
        await db.update(quotes).set({
          status: "SENT",
          sentAt: new Date(),
          pdfUrl: result.pdfUrl || null,
        }).where(eq(quotes.id, input.id));
      }

      return result;
    }),

  /** Editar datos de una cotización (solo borrador o enviada) */
  updateQuote: advisorProcedure
    .input(z.object({
      id: z.number(),
      clientName: z.string().min(2).optional(),
      clientEmail: z.string().email().optional(),
      clientPhone: z.string().optional(),
      clientCompany: z.string().optional(),
      clientCity: z.string().optional(),
      clientNotes: z.string().optional(),
      internalNotes: z.string().optional(),
      discount: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const { id, ...updateData } = input;
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Verificar acceso
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      if (!isAdmin && quote.advisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Solo se pueden editar borradores y enviadas
      if (!["DRAFT", "SENT"].includes(quote.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden editar cotizaciones en borrador o enviadas" });
      }

      // Recalcular total si se cambia el descuento
      const finalUpdate: any = {};
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) finalUpdate[key] = value;
      });

      if (updateData.discount !== undefined) {
        finalUpdate.total = quote.subtotal - updateData.discount;
      }

      await db.update(quotes).set(finalUpdate).where(eq(quotes.id, id));
      return { success: true };
    }),

  /** Eliminar cotización (solo borrador) */
  deleteQuote: advisorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.id));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Verificar acceso
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      if (!isAdmin && quote.advisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Solo admin puede eliminar cualquiera, asesores solo borradores
      if (!isAdmin && quote.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Solo puedes eliminar cotizaciones en borrador" });
      }

      // Eliminar items primero, luego la cotización
      await db.delete(quoteItems).where(eq(quoteItems.quoteId, input.id));
      await db.delete(quotes).where(eq(quotes.id, input.id));
      return { success: true };
    }),

  /** Generar PDF de cotización y devolver URL */
  generatePdf: advisorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.id));
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });

      // Verificar acceso
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "staff";
      if (!isAdmin && quote.advisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.id));
      const [settings] = await db.select().from(quoteSettings).limit(1);

      if (!settings) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure primero los ajustes de cotización." });
      }

      // Generar HTML de la cotización
      const { generateQuoteHTML } = await import("./quote-pdf");
      const baseUrl = ctx.req?.headers?.origin || "https://evgreen.lat";
      const htmlContent = await generateQuoteHTML({
        quoteNumber: quote.quoteNumber,
        createdAt: quote.createdAt,
        expiresAt: quote.expiresAt,
        publicUrl: `${baseUrl}/cotizacion/${quote.publicToken}`,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone,
        clientCompany: quote.clientCompany,
        clientCity: quote.clientCity,
        clientNotes: quote.clientNotes,
        advisorName: quote.advisorName,
        subtotal: quote.subtotal,
        discount: quote.discount || 0,
        total: quote.total,
        items: items.map((item: any) => ({
          productName: item.productName,
          productPowerKw: item.productPowerKw,
          productChargeType: item.productChargeType,
          productConnector: item.productConnector,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          includesTransformer: item.includesTransformer || false,
          cableMetersIncluded: item.cableMetersIncluded || 10,
          productImageUrl: item.productImageUrl || null,
        })),
        settings: {
          companyName: settings.companyName || "EVGreen",
          companyNit: settings.companyNit || "",
          companyPhone: settings.companyPhone || "",
          companyEmail: settings.companyEmail || "",
          companyWebsite: settings.companyWebsite || "",
          evgreenFeePercent: settings.evgreenFeePercent,
          ownerSharePercent: settings.ownerSharePercent,
          headerMessage: settings.headerMessage || "",
          footerMessage: settings.footerMessage || "",
          termsAndConditions: settings.termsAndConditions || "",
          exclusions: settings.exclusions || "",
          benefitsDescription: settings.benefitsDescription || "",
        },
        financialModel: {
          evgreenSharePercent: parseFloat(quote.evgreenSharePercent || "0") || settings.evgreenFeePercent,
          investorSharePercent: parseFloat(quote.investorSharePercent || "0") || settings.ownerSharePercent,
          hostSharePercent: parseFloat(quote.hostSharePercent || "0") || 0,
        },
        projection: {
          show: quote.showProjection ?? true,
          energyCostPerKwh: quote.projectionEnergyCostPerKwh || 700,
          salePricePerKwh: quote.projectionSalePricePerKwh || 1800,
          dailyHours: parseFloat(quote.projectionDailyHours || "4.0"),
          scenario: quote.projectionScenario || "realistic",
          totalKw: items.reduce((acc: number, item: any) => acc + (parseFloat(item.productPowerKw) || 0) * item.quantity, 0),
        },
      });

      // Subir HTML a S3
      const { storagePut } = await import("../storage");
      const fileName = `quotes/${quote.quoteNumber.replace(/\s/g, "-")}.html`;
      const { url: htmlUrl } = await storagePut(fileName, Buffer.from(htmlContent, "utf-8"), "text/html");

      // Guardar URL en BD
      await db.update(quotes).set({ pdfUrl: htmlUrl }).where(eq(quotes.id, input.id));

      return { url: htmlUrl, htmlContent };
    }),
});
