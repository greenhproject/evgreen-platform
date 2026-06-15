/**
 * EVGreen - Router de Postulación de Espacios para Cargadores
 * Permite a cualquier persona postular su espacio, y a admins validar, enviar carta de intención,
 * generar scoring IA, y publicar en el muro de crowdfunding.
 * @author Green House Project
 */
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import {
  spaceSubmissions,
  spacePhotos,
  crowdfundingProjects,
  investorLeads,
} from "../../drizzle/schema";
import { eq, desc, and, sql, like, or, inArray, count, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";

// ============================================================================
// ROLE GUARDS
// ============================================================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Se requiere rol de administrador." });
  }
  return next({ ctx });
});

// ============================================================================
// HELPERS
// ============================================================================

async function getDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
  return db;
}

async function generateSubmissionCode(): Promise<string> {
  const db = await getDatabase();
  const year = new Date().getFullYear();
  const prefix = `SPE-${year}-`;

  const [lastSubmission] = await db
    .select({ code: spaceSubmissions.code })
    .from(spaceSubmissions)
    .where(like(spaceSubmissions.code, `${prefix}%`))
    .orderBy(desc(spaceSubmissions.id))
    .limit(1);

  let nextNum = 1;
  if (lastSubmission) {
    const lastNum = parseInt(lastSubmission.code.replace(prefix, ""), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

function generateLetterToken(): string {
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
      latitude: z.string().optional(),
      longitude: z.string().optional(),

      // Características técnicas
      availableAreaM2: z.string().optional(),
      parkingSpots: z.number().int().optional(),
      transformerCapacityKva: z.string().optional(),
      hasElectricalPanel: z.boolean().optional(),
      electricalDistance: z.number().int().optional(),
      hasInternet: z.boolean().optional(),
      operatingHoursStart: z.string().optional(),
      operatingHoursEnd: z.string().optional(),
      is24Hours: z.boolean().optional(),

      // Tráfico y contexto
      estimatedDailyVehicles: z.number().int().optional(),
      estimatedEvPercent: z.number().int().min(0).max(100).optional(),
      nearbyAttractions: z.string().optional(),
      socioeconomicStratum: z.number().int().min(1).max(6).optional(),

      // Notas
      additionalNotes: z.string().optional(),

      // Fotos (base64 encoded)
      photos: z.array(z.object({
        base64: z.string(),
        fileName: z.string(),
        contentType: z.string(),
        photoType: z.enum(["general", "electrical_panel", "transformer", "parking_area", "access_road", "surroundings", "other"]).optional(),
        caption: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const code = await generateSubmissionCode();

      // Insertar la postulación
      const [result] = await db.insert(spaceSubmissions).values({
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
        hasElectricalPanel: input.hasElectricalPanel || false,
        electricalDistance: input.electricalDistance || null,
        hasInternet: input.hasInternet || false,
        operatingHoursStart: input.operatingHoursStart || "06:00",
        operatingHoursEnd: input.operatingHoursEnd || "22:00",
        is24Hours: input.is24Hours || false,
        estimatedDailyVehicles: input.estimatedDailyVehicles || null,
        estimatedEvPercent: input.estimatedEvPercent || null,
        nearbyAttractions: input.nearbyAttractions || null,
        socioeconomicStratum: input.socioeconomicStratum || null,
        additionalNotes: input.additionalNotes || null,
        status: "pending",
      });

      const submissionId = result.insertId;

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

            await db.insert(spacePhotos).values({
              submissionId,
              photoUrl: url,
              photoKey: fileKey,
              caption: photo.caption || null,
              photoType: photo.photoType || "general",
              sortOrder: i,
            });
          } catch (err) {
            console.error(`[Spaces] Error uploading photo ${i}:`, err);
          }
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
          status: spaceSubmissions.status,
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

      if (submission.status !== "letter_sent") {
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
          status: "letter_accepted",
          letterAcceptedAt: signedAt,
          letterSignerName: input.signerName,
          letterSignerDocument: input.signerDocument,
          letterSignerIp: clientIp,
          letterSignerUserAgent: userAgent,
          ...(pdfUrl ? { signedLetterPdfUrl: pdfUrl, signedLetterPdfKey: pdfKey } : {}),
        })
        .where(eq(spaceSubmissions.id, submission.id));

      // Enviar copia del PDF al firmante por email (trazabilidad)
      try {
        if (pdfUrl && submission.submitterEmail) {
          const resendApiKey = process.env.Resend;
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            const emailParams = buildEmailParams({
              from: "EVGreen <notificaciones@evgreen.lat>",
              to: submission.submitterEmail,
              subject: `Constancia de Firma - Carta de Intención EVGreen (${submission.spaceName})`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">\u26a1 EVGreen</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 13px;">Green House Project S.A.S.</p>
                  </div>
                  <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <h2 style="color: #111827; font-size: 18px; margin: 0 0 12px;">Carta de Intención Firmada</h2>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Estimado(a) <strong>${input.signerName}</strong>,</p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Adjuntamos la constancia de firma digital de la carta de intención para el espacio <strong>${submission.spaceName}</strong> (Código: ${submission.code}).</p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Este documento sirve como evidencia legal de su aceptación y contiene todos los datos de la firma digital.</p>
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${pdfUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">\ud83d\udcc4 Descargar Constancia PDF</a>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">Conserve este documento para sus registros.</p>
                  </div>
                </div>
              `,
            });
            await resend.emails.send(emailParams as any);
            console.log(`[Spaces] Email con constancia PDF enviado a ${submission.submitterEmail}`);
          }
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
          status: spaceSubmissions.status,
          crowdfundingProjectId: spaceSubmissions.crowdfundingProjectId,
          socioeconomicStratum: spaceSubmissions.socioeconomicStratum,
          estimatedDailyVehicles: spaceSubmissions.estimatedDailyVehicles,
          parkingSpots: spaceSubmissions.parkingSpots,
          viewCount: spaceSubmissions.viewCount,
          investmentType: spaceSubmissions.investmentType,
        })
        .from(spaceSubmissions)
        .where(
          inArray(spaceSubmissions.status, ["published", "funded", "in_construction", "operational"])
        )
        .orderBy(desc(spaceSubmissions.aiScore));

      // Obtener TODAS las fotos de cada espacio (primera como thumbnail + galería completa)
      const submissionIds = published.map(s => s.id);
      let thumbnailMap: Record<number, string> = {};
      let allPhotosMap: Record<number, Array<{ url: string; type: string; caption: string | null }>> = {};

      if (submissionIds.length > 0) {
        const photos = await db
          .select({
            submissionId: spacePhotos.submissionId,
            photoUrl: spacePhotos.photoUrl,
            photoType: spacePhotos.photoType,
            caption: spacePhotos.caption,
          })
          .from(spacePhotos)
          .where(inArray(spacePhotos.submissionId, submissionIds))
          .orderBy(spacePhotos.sortOrder);

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
    list: adminProcedure
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
          conditions.push(eq(spaceSubmissions.status, input.status as any));
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

        if (input?.dateFrom) {
          conditions.push(gte(spaceSubmissions.createdAt, new Date(input.dateFrom)));
        }

        if (input?.dateTo) {
          const endDate = new Date(input.dateTo);
          endDate.setHours(23, 59, 59, 999);
          conditions.push(lte(spaceSubmissions.createdAt, endDate));
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
            status: spaceSubmissions.status,
            count: count(),
          })
          .from(spaceSubmissions)
          .groupBy(spaceSubmissions.status);

        // Obtener ciudades y tipos únicos para los filtros
        const [cities, types] = await Promise.all([
          db.selectDistinct({ city: spaceSubmissions.city }).from(spaceSubmissions).orderBy(spaceSubmissions.city),
          db.selectDistinct({ spaceType: spaceSubmissions.spaceType }).from(spaceSubmissions).orderBy(spaceSubmissions.spaceType),
        ]);

        return {
          submissions,
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
    getById: adminProcedure
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

        return { ...submission, photos };
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
        estimatedPowerKw: z.number().int().optional(),
        estimatedChargerCount: z.number().int().optional(),
        recommendedChargerType: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDatabase();

        const updateData: any = {
          status: input.status,
        };

        if (input.rejectionReason) updateData.rejectionReason = input.rejectionReason;
        if (input.technicalScore !== undefined) updateData.technicalScore = input.technicalScore;
        if (input.technicalNotes) updateData.technicalNotes = input.technicalNotes;
        if (input.electricalViability) updateData.electricalViability = input.electricalViability;
        if (input.accessibilityScore !== undefined) updateData.accessibilityScore = input.accessibilityScore;
        if (input.trafficPotentialScore !== undefined) updateData.trafficPotentialScore = input.trafficPotentialScore;
        if (input.estimatedInvestmentCop !== undefined) updateData.estimatedInvestmentCop = input.estimatedInvestmentCop;
        if (input.estimatedPowerKw !== undefined) updateData.estimatedPowerKw = input.estimatedPowerKw;
        if (input.estimatedChargerCount !== undefined) updateData.estimatedChargerCount = input.estimatedChargerCount;
        if (input.recommendedChargerType) updateData.recommendedChargerType = input.recommendedChargerType;

        // Si se está evaluando, registrar quién y cuándo
        if (["under_review", "approved", "rejected"].includes(input.status)) {
          updateData.evaluatedBy = ctx.user.id;
          updateData.evaluatedAt = new Date();
        }

        await db.update(spaceSubmissions)
          .set(updateData)
          .where(eq(spaceSubmissions.id, input.id));

        // ── Auto-crear proyecto crowdfunding DRAFT cuando se aprueba ──
        if (input.status === "approved") {
          const [submission] = await db
            .select()
            .from(spaceSubmissions)
            .where(eq(spaceSubmissions.id, input.id))
            .limit(1);

          if (submission && !submission.crowdfundingProjectId) {
            const targetAmount = submission.estimatedInvestmentCop || 1000000000;
            const [cfResult] = await db.insert(crowdfundingProjects).values({
              name: `Punto de Carga - ${submission.spaceName}`,
              description: `Punto de carga EV en ${submission.spaceName}, ${submission.city}. ${submission.address}`,
              city: submission.city,
              zone: submission.department || submission.city,
              address: submission.address,
              targetAmount,
              minimumInvestment: 50000000,
              totalPowerKw: submission.estimatedPowerKw || 120,
              chargerCount: submission.estimatedChargerCount || 2,
              chargerPowerKw: submission.estimatedPowerKw && submission.estimatedChargerCount
                ? Math.round(submission.estimatedPowerKw / submission.estimatedChargerCount)
                : 60,
              hasSolarPanels: false,
              estimatedRoiPercent: "85.00",
              estimatedPaybackMonths: 14,
              status: "DRAFT",
              spaceSubmissionId: input.id,
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
              .set({ status: "OPEN", launchDate: new Date() })
              .where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId));
          }
        }

        return { success: true };
      }),

    // ========================================================================
    // ADMIN: Enviar carta de intención por email
    // ========================================================================
    sendLetter: adminProcedure
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

        if (submission.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se puede enviar carta a postulaciones aprobadas" });
        }

        const letterToken = generateLetterToken();
        const baseUrl = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, "") || "https://evgreen.lat";
        const acceptUrl = `${baseUrl}/carta-intencion/${letterToken}`;

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
        const resendApiKey = process.env.RESEND_API_KEY || "re_VBTGfE43_MrkUuQ96ji8kyvY4ZrfEiy9b";
        const resend = new Resend(resendApiKey);

        const emailParams = buildEmailParams({
          from: "EVGreen <admin@evgreen.lat>",
          to: submission.submitterEmail,
          subject: `Carta de Intención - Espacio ${submission.spaceName} | EVGreen`,
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
          .set({
            status: "letter_sent",
            letterToken,
            letterSentAt: new Date(),
          })
          .where(eq(spaceSubmissions.id, input.id));

        return { success: true, emailId: result.data?.id };
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

        const prompt = `Eres un analista experto en infraestructura de carga de vehículos eléctricos en Colombia. Evalúa el siguiente espacio postulado para instalar cargadores EV y genera un puntaje de 0 a 100 junto con un análisis detallado.

DATOS DEL ESPACIO:
- Nombre: ${submission.spaceName}
- Tipo: ${SPACE_TYPE_LABELS[submission.spaceType] || submission.spaceType}
- Ciudad: ${submission.city}${submission.department ? `, ${submission.department}` : ""}
- Dirección: ${submission.address}
- Área disponible: ${submission.availableAreaM2 || "No especificada"} m²
- Puestos de parqueo: ${submission.parkingSpots || "No especificado"}
- Capacidad del transformador: ${submission.transformerCapacityKva || "No especificada"} kVA
- Tablero eléctrico accesible: ${submission.hasElectricalPanel ? "Sí" : "No"}
- Distancia tablero-punto de carga: ${submission.electricalDistance || "No especificada"} metros
- Internet disponible: ${submission.hasInternet ? "Sí" : "No"}
- Horario: ${submission.is24Hours ? "24 horas" : `${submission.operatingHoursStart} - ${submission.operatingHoursEnd}`}
- Vehículos diarios estimados: ${submission.estimatedDailyVehicles || "No especificado"}
- % vehículos eléctricos estimado: ${submission.estimatedEvPercent || "No especificado"}%
- Estrato socioeconómico: ${submission.socioeconomicStratum || "No especificado"}
- Puntos de interés cercanos: ${submission.nearbyAttractions || "No especificados"}
- Notas adicionales: ${submission.additionalNotes || "Ninguna"}

CRITERIOS DE EVALUACIÓN:
1. Viabilidad eléctrica (capacidad del transformador, acceso al tablero)
2. Potencial de tráfico vehicular y demanda de carga EV
3. Ubicación estratégica (estrato, tipo de zona, puntos de interés)
4. Infraestructura existente (internet, área, parqueo)
5. Horario de operación y accesibilidad
6. Potencial de retorno de inversión para inversionistas

Responde en formato JSON con la siguiente estructura:`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Eres un analista experto en infraestructura de carga de vehículos eléctricos en Colombia. Responde siempre en español." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "space_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  score: { type: "integer", description: "Puntaje general de 0 a 100" },
                  summary: { type: "string", description: "Resumen ejecutivo de 2-3 oraciones" },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de fortalezas del espacio",
                  },
                  weaknesses: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de debilidades o riesgos",
                  },
                  recommendation: { type: "string", description: "Recomendación de tipo de cargador y potencia" },
                  estimatedChargers: { type: "integer", description: "Número estimado de cargadores recomendados" },
                  estimatedPowerKw: { type: "integer", description: "Potencia total estimada en kW" },
                  investmentAppeal: { type: "string", description: "Atractivo para inversionistas (alto/medio/bajo)" },
                  electricalViability: { type: "string", description: "Viabilidad eléctrica: viable, requires_upgrade, not_viable" },
                },
                required: ["score", "summary", "strengths", "weaknesses", "recommendation", "estimatedChargers", "estimatedPowerKw", "investmentAppeal", "electricalViability"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        let analysis: any;

        try {
          analysis = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al parsear respuesta de IA",
          });
        }

        // Guardar en BD
        await db.update(spaceSubmissions)
          .set({
            aiScore: Math.min(100, Math.max(0, analysis.score)),
            aiAnalysis: JSON.stringify(analysis),
            aiScoredAt: new Date(),
            // Auto-llenar datos de inversión estimados si no existen
            ...(submission.estimatedPowerKw ? {} : { estimatedPowerKw: analysis.estimatedPowerKw }),
            ...(submission.estimatedChargerCount ? {} : { estimatedChargerCount: analysis.estimatedChargers }),
            ...(submission.electricalViability ? {} : { electricalViability: analysis.electricalViability as any }),
          })
          .where(eq(spaceSubmissions.id, input.id));

        return { score: analysis.score, analysis };
      }),

    // ========================================================================
    // ADMIN: Publicar espacio en crowdfunding
    // ========================================================================
    publishToCrowdfunding: adminProcedure
      .input(z.object({
        id: z.number(),
        targetAmount: z.number().min(1000000, "La meta de inversión debe ser al menos $1.000.000"),
        minimumInvestment: z.number().optional(),
        estimatedRoiPercent: z.string().optional(),
        estimatedPaybackMonths: z.number().int().optional(),
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

        if (submission.status !== "letter_accepted" && submission.status !== "approved") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Solo se pueden publicar espacios aprobados o con carta de intenci\u00f3n aceptada",
          });
        }

        let crowdfundingProjectId: number;

        if (submission.crowdfundingProjectId) {
          // Ya existe un proyecto CF (creado auto al aprobar) → actualizar
          await db.update(crowdfundingProjects)
            .set({
              targetAmount: input.targetAmount,
              minimumInvestment: input.minimumInvestment || 50000000,
              estimatedRoiPercent: input.estimatedRoiPercent || "85.00",
              estimatedPaybackMonths: input.estimatedPaybackMonths || 14,
              status: "OPEN",
              launchDate: new Date(),
            })
            .where(eq(crowdfundingProjects.id, submission.crowdfundingProjectId));
          crowdfundingProjectId = submission.crowdfundingProjectId;
        } else {
          // Crear nuevo proyecto de crowdfunding
          const [cfResult] = await db.insert(crowdfundingProjects).values({
            name: `Punto de Carga - ${submission.spaceName}`,
            description: `Punto de carga EV en ${submission.spaceName}, ${submission.city}. ${submission.address}`,
            city: submission.city,
            zone: submission.department || submission.city,
            address: submission.address,
            targetAmount: input.targetAmount,
            minimumInvestment: input.minimumInvestment || 50000000,
            totalPowerKw: submission.estimatedPowerKw || 120,
            chargerCount: submission.estimatedChargerCount || 2,
            chargerPowerKw: submission.estimatedPowerKw && submission.estimatedChargerCount
              ? Math.round(submission.estimatedPowerKw / submission.estimatedChargerCount)
              : 60,
            hasSolarPanels: false,
            estimatedRoiPercent: input.estimatedRoiPercent || "85.00",
            estimatedPaybackMonths: input.estimatedPaybackMonths || 14,
            status: "OPEN",
            launchDate: new Date(),
            spaceSubmissionId: input.id,
            createdById: ctx.user.id,
          });
          crowdfundingProjectId = cfResult.insertId;
        }

        // Actualizar postulaci\u00f3n
        await db.update(spaceSubmissions)
          .set({
            status: "published",
            crowdfundingProjectId,
            estimatedInvestmentCop: input.targetAmount,
          })
          .where(eq(spaceSubmissions.id, input.id));

        return { success: true, crowdfundingProjectId };
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
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        availableAreaM2: z.string().optional(),
        parkingSpots: z.number().int().optional(),
        transformerCapacityKva: z.string().optional(),
        hasElectricalPanel: z.boolean().optional(),
        electricalDistance: z.number().int().optional(),
        hasInternet: z.boolean().optional(),
        operatingHoursStart: z.string().optional(),
        operatingHoursEnd: z.string().optional(),
        is24Hours: z.boolean().optional(),
        estimatedDailyVehicles: z.number().int().optional(),
        estimatedEvPercent: z.number().int().optional(),
        nearbyAttractions: z.string().optional(),
        socioeconomicStratum: z.number().int().optional(),
        additionalNotes: z.string().optional(),
        submitterName: z.string().optional(),
        submitterEmail: z.string().optional(),
        submitterPhone: z.string().optional(),
        submitterCompany: z.string().optional(),
        estimatedInvestmentCop: z.number().optional(),
        estimatedPowerKw: z.number().int().optional(),
        estimatedChargerCount: z.number().int().optional(),
        recommendedChargerType: z.string().optional(),
        investmentType: z.enum(["individual", "colectiva"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDatabase();
        const { id, ...updateFields } = input;

        const cleanFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateFields)) {
          if (value !== undefined) {
            cleanFields[key] = value;
          }
        }

        if (Object.keys(cleanFields).length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No se proporcionaron campos para actualizar" });
        }

        await db.update(spaceSubmissions)
          .set(cleanFields)
          .where(eq(spaceSubmissions.id, id));

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

        const updateData: any = { status };
        if (["under_review", "approved", "rejected"].includes(status)) {
          updateData.evaluatedBy = ctx.user.id;
          updateData.evaluatedAt = new Date();
        }

        await db.update(spaceSubmissions)
          .set(updateData)
          .where(inArray(spaceSubmissions.id, ids));

        return { success: true, updatedCount: ids.length };
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
            evaluatedAt: new Date(),
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
          conditions.push(eq(investorLeads.status, input.status as any));
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
        .select({ id: spaceSubmissions.id, spaceName: spaceSubmissions.spaceName, status: spaceSubmissions.status })
        .from(spaceSubmissions)
        .where(eq(spaceSubmissions.id, input.spaceId))
        .limit(1);

      if (!space || !["published", "funded", "in_construction", "operational"].includes(space.status)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Espacio no encontrado o no disponible" });
      }

      await db.insert(investorLeads).values({
        spaceId: input.spaceId,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        interestedAmount: input.interestedAmount || null,
        message: input.message || null,
        status: "new",
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
        const resendApiKey = process.env.RESEND_API_KEY || "re_VBTGfE43_MrkUuQ96ji8kyvY4ZrfEiy9b";
        const resend = new Resend(resendApiKey);
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
});

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function generateLetterEmailHTML(params: {
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
</head>
<body style="margin:0;padding:0;background-color:#0a0f1a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#065f46,#047857,#10b981);padding:32px 40px;text-align:center;">
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
            <td style="padding:40px;">
              <h2 style="color:#10b981;margin:0 0 24px;font-size:22px;font-weight:600;">
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
                        <td style="color:#9ca3af;font-size:14px;width:40%;">Código:</td>
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
                    <a href="${params.acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                      ✍️ Firmar Carta de Intención
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center;">
                Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="${params.acceptUrl}" style="color:#10b981;word-break:break-all;">${params.acceptUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
