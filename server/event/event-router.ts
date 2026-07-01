/**
 * Event Management Router
 * 
 * Gestión de invitados del evento de lanzamiento EVGreen:
 * - CRUD de invitados
 * - Generación de QR únicos
 * - Envío de invitaciones por email
 * - Check-in con escaneo QR
 * - Registro de pagos de reserva
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getPlatformSettings } from "../db";
import { eventGuests, eventPayments, users } from "../../drizzle/schema";
import { eq, desc, sql, and, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";
import { generateQRCodeUrl } from "../utils/qr-generator";
import {
  isWompiConfigured,
  getWompiKeys,
  generatePaymentReference,
  generateIntegritySignature,
  buildCheckoutUrl,
} from "../wompi/config";
import {
  exportGuestsToExcel,
  exportPaymentsToExcel,
  exportGuestsToPDF,
  exportPaymentsToPDF,
} from "./event-export";

// Resend para envío de emails
const resendApiKey = process.env.RESEND_API_KEY || "re_CeRTmETR_MHxYaF2sShjXcmSmZKE5qSzr";
const resend = new Resend(resendApiKey);

// URL de la imagen de fondo del evento (S3/CloudFront - hospedada en nuestro propio storage)
const EVENT_BG_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/evgreen/email-assets/event-bg-a8147fd468f251ce.png";

// Email del super staff (vista global de todos los inversionistas)
const SUPER_STAFF_EMAIL = "evgreen@greenhproject.com";

// Verificar si el usuario es super staff (vista global) o admin
function isSuperStaff(user: { email?: string | null; role: string }): boolean {
  return user.role === "admin" || user.email === SUPER_STAFF_EMAIL;
}

// Procedimiento para staff y admin
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de staff o administrador.",
    });
  }
  return next({ ctx });
});

// Generar código QR único
function generateQRCode(): string {
  return `EVG-${uuidv4().substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

// Paquetes de inversión
const INVESTMENT_PACKAGES = {
  AC: { name: "AC Básico", amount: 8500000 },
  DC_INDIVIDUAL: { name: "DC Individual 120kW", amount: 85000000 },
  COLECTIVO: { name: "Estación Premium Colectiva", amount: 200000000 },
};

export const eventRouter = router({
  // ============================================================================
  // GESTIÓN DE INVITADOS (Staff)
  // ============================================================================

  // Listar invitados (filtrado por staff)
  listGuests: staffProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["INVITED", "CONFIRMED", "CHECKED_IN", "NO_SHOW", "CANCELLED", "ALL"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const search = input?.search;
      const status = input?.status;
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const conditions: any[] = [];
      const isGlobal = isSuperStaff(ctx.user);

      // Filtrar por staff si no es super staff
      if (!isGlobal) {
        conditions.push(eq(eventGuests.createdById, ctx.user.id));
      }

      if (status && status !== "ALL") {
        conditions.push(eq(eventGuests.status, status));
      }

      if (search) {
        conditions.push(
          sql`(${eventGuests.fullName} LIKE ${`%${search}%`} OR ${eventGuests.email} LIKE ${`%${search}%`} OR ${eventGuests.company} LIKE ${`%${search}%`})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const statsCondition = !isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined;

      const guests = await db
        .select({
          guest: eventGuests,
          staffName: users.name,
        })
        .from(eventGuests)
        .leftJoin(users, eq(eventGuests.createdById, users.id))
        .where(whereClause)
        .orderBy(desc(eventGuests.createdAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventGuests)
        .where(whereClause);

      // Estadísticas (filtradas por staff)
      const [stats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          invited: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'INVITED' THEN 1 ELSE 0 END)`,
          confirmed: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CONFIRMED' THEN 1 ELSE 0 END)`,
          checkedIn: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CHECKED_IN' THEN 1 ELSE 0 END)`,
          cancelled: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CANCELLED' THEN 1 ELSE 0 END)`,
        })
        .from(eventGuests)
        .where(statsCondition);

      return {
        guests: guests.map(g => ({ ...g.guest, staffName: g.staffName })),
        total: countResult?.count || 0,
        isGlobalView: isGlobal,
        stats: {
          total: Number(stats?.total) || 0,
          invited: Number(stats?.invited) || 0,
          confirmed: Number(stats?.confirmed) || 0,
          checkedIn: Number(stats?.checkedIn) || 0,
          cancelled: Number(stats?.cancelled) || 0,
        },
      };
    }),

  // Crear invitado
  createGuest: staffProcedure
    .input(z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      company: z.string().optional(),
      position: z.string().optional(),
      investmentPackage: z.enum(["AC", "DC_INDIVIDUAL", "COLECTIVO"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const qrCode = generateQRCode();

      // Asignar siguiente cupo fundador disponible
      const [lastSlot] = await db
        .select({ maxSlot: sql<number>`MAX(founderSlot)` })
        .from(eventGuests)
        .where(sql`founderSlot IS NOT NULL`);

      const nextSlot = (lastSlot?.maxSlot || 0) + 1;
      const founderSlot = nextSlot <= 30 ? nextSlot : null;

      const investmentAmount = input.investmentPackage
        ? INVESTMENT_PACKAGES[input.investmentPackage].amount
        : null;

      await db.insert(eventGuests).values({
        fullName: input.fullName,
        email: input.email,
        phone: input.phone || null,
        company: input.company || null,
        position: input.position || null,
        qrCode,
        investmentPackage: input.investmentPackage || null,
        investmentAmount,
        founderSlot,
        status: "INVITED",
        notes: input.notes || null,
        createdById: ctx.user.id,
      });

      return { success: true, qrCode, founderSlot };
    }),

  // Actualizar invitado (solo el staff que lo creó o super staff)
  updateGuest: staffProcedure
    .input(z.object({
      id: z.number(),
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      position: z.string().optional(),
      investmentPackage: z.enum(["AC", "DC_INDIVIDUAL", "COLECTIVO"]).optional(),
      notes: z.string().optional(),
      status: z.enum(["INVITED", "CONFIRMED", "CHECKED_IN", "NO_SHOW", "CANCELLED"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const updateData: any = {};
      if (input.fullName) updateData.fullName = input.fullName;
      if (input.email) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone || null;
      if (input.company !== undefined) updateData.company = input.company || null;
      if (input.position !== undefined) updateData.position = input.position || null;
      if (input.investmentPackage) {
        updateData.investmentPackage = input.investmentPackage;
        updateData.investmentAmount = INVESTMENT_PACKAGES[input.investmentPackage].amount;
      }
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.status) updateData.status = input.status;

      // Verificar que el staff tiene permiso sobre este invitado
      if (!isSuperStaff(ctx.user)) {
        const [guest] = await db.select().from(eventGuests).where(eq(eventGuests.id, input.id));
        if (guest && guest.createdById !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo puedes editar invitados que tú creaste." });
        }
      }

      await db.update(eventGuests).set(updateData).where(eq(eventGuests.id, input.id));

      return { success: true };
    }),

  // Eliminar invitado (solo el staff que lo creó o super staff)
  deleteGuest: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      // Verificar que el staff tiene permiso sobre este invitado
      if (!isSuperStaff(ctx.user)) {
        const [guest] = await db.select().from(eventGuests).where(eq(eventGuests.id, input.id));
        if (guest && guest.createdById !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo puedes eliminar invitados que tú creaste." });
        }
      }

      // Primero eliminar pagos asociados
      await db.delete(eventPayments).where(eq(eventPayments.guestId, input.id));
      await db.delete(eventGuests).where(eq(eventGuests.id, input.id));

      return { success: true };
    }),

  // Obtener invitado por QR code (para check-in)
  getGuestByQR: staffProcedure
    .input(z.object({ qrCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.qrCode, input.qrCode));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      // Obtener pagos del invitado
      const payments = await db
        .select()
        .from(eventPayments)
        .where(eq(eventPayments.guestId, guest.id))
        .orderBy(desc(eventPayments.createdAt));

      return { ...guest, payments };
    }),

  // ============================================================================
  // CHECK-IN (Staff)
  // ============================================================================

  // Realizar check-in de un invitado
  checkIn: staffProcedure
    .input(z.object({ qrCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.qrCode, input.qrCode));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Código QR no válido. Invitado no encontrado." });
      }

      if (guest.status === "CHECKED_IN") {
        return {
          success: false,
          alreadyCheckedIn: true,
          guest,
          message: `${guest.fullName} ya fue registrado previamente.`,
        };
      }

      if (guest.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La invitación de ${guest.fullName} fue cancelada.`,
        });
      }

      await db
        .update(eventGuests)
        .set({
          status: "CHECKED_IN",
          checkedInAt: new Date(),
          checkedInBy: ctx.user.id,
        })
        .where(eq(eventGuests.id, guest.id));

      // Obtener pagos
      const payments = await db
        .select()
        .from(eventPayments)
        .where(eq(eventPayments.guestId, guest.id));

      return {
        success: true,
        alreadyCheckedIn: false,
        guest: { ...guest, status: "CHECKED_IN" as const },
        payments,
        message: `¡Bienvenido ${guest.fullName}! Check-in exitoso.`,
      };
    }),

  // ============================================================================
  // PAGOS DE RESERVA (Staff)
  // ============================================================================

  // Registrar pago de reserva
  registerPayment: staffProcedure
    .input(z.object({
      guestId: z.number(),
      amount: z.number().min(1000000), // Mínimo $1.000.000
      selectedPackage: z.enum(["AC", "DC_INDIVIDUAL", "COLECTIVO"]),
      paymentMethod: z.enum(["WOMPI", "CASH", "TRANSFER", "CARD", "NEQUI"]),
      paymentReference: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      // Verificar que el invitado existe
      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.id, input.guestId));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      const reference = input.paymentReference || generatePaymentReference("EVT");

      await db.insert(eventPayments).values({
        guestId: input.guestId,
        amount: input.amount,
        reservationDeposit: 1000000,
        paymentStatus: input.paymentMethod === "WOMPI" ? "PENDING" : "PAID",
        paymentMethod: input.paymentMethod,
        paymentReference: reference,
        selectedPackage: input.selectedPackage,
        founderBenefits: (guest.founderSlot || 0) <= 30,
        founderDiscount: "5.00",
        zoneFeeFree: true,
        registeredById: ctx.user.id,
        paidAt: input.paymentMethod !== "WOMPI" ? new Date() : null,
      });

      // Actualizar paquete del invitado
      await db
        .update(eventGuests)
        .set({
          investmentPackage: input.selectedPackage,
          investmentAmount: INVESTMENT_PACKAGES[input.selectedPackage].amount,
        })
        .where(eq(eventGuests.id, input.guestId));

      return { success: true, reference };
    }),

  // Crear checkout Wompi para pago de reserva
  createReservationCheckout: staffProcedure
    .input(z.object({
      guestId: z.number(),
      amount: z.number().min(1000000),
      selectedPackage: z.enum(["AC", "DC_INDIVIDUAL", "COLECTIVO"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isWompiConfigured())) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Use otro método de pago.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.id, input.guestId));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      const reference = generatePaymentReference("EVT");
      const amountInCents = input.amount * 100;
      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error: llaves de Wompi no configuradas",
        });
      }

      const currency = "COP";
      const signature = generateIntegritySignature(reference, amountInCents, currency, keys.integritySecret);
      const checkoutUrl = buildCheckoutUrl({
        publicKey: keys.publicKey,
        reference,
        amountInCents,
        currency,
        signature,
        redirectUrl: `${origin}/staff/event?payment=success&reference=${reference}&guest=${input.guestId}`,
        customerEmail: guest.email,
        customerName: guest.fullName,
        customerPhone: guest.phone || undefined,
      });

      const checkout = { checkoutUrl, reference, signature };

      // Crear registro de pago pendiente
      await db.insert(eventPayments).values({
        guestId: input.guestId,
        amount: input.amount,
        reservationDeposit: 1000000,
        paymentStatus: "PENDING",
        paymentMethod: "WOMPI",
        paymentReference: reference,
        selectedPackage: input.selectedPackage,
        founderBenefits: (guest.founderSlot || 0) <= 30,
        founderDiscount: "5.00",
        zoneFeeFree: true,
        registeredById: ctx.user.id,
      });

      return {
        checkoutUrl: checkout.checkoutUrl,
        reference,
      };
    }),

  // Listar pagos (filtrado por staff)
  listPayments: staffProcedure
    .input(z.object({
      guestId: z.number().optional(),
      status: z.enum(["PENDING", "PAID", "PARTIAL", "REFUNDED", "ALL"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const params = input || {};
      const conditions: any[] = [];
      const isGlobal = isSuperStaff(ctx.user);

      // Filtrar por staff: solo ver pagos de invitados que este staff creó
      if (!isGlobal) {
        conditions.push(eq(eventGuests.createdById, ctx.user.id));
      }

      if (params.guestId) {
        conditions.push(eq(eventPayments.guestId, params.guestId));
      }

      if (params.status && params.status !== "ALL") {
        conditions.push(eq(eventPayments.paymentStatus, params.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const payments = await db
        .select({
          payment: eventPayments,
          guestName: eventGuests.fullName,
          guestEmail: eventGuests.email,
          guestCompany: eventGuests.company,
          founderSlot: eventGuests.founderSlot,
          staffName: users.name,
        })
        .from(eventPayments)
        .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
        .leftJoin(users, eq(eventGuests.createdById, users.id))
        .where(whereClause)
        .orderBy(desc(eventPayments.createdAt));

      // Estadísticas de pagos (filtradas por staff)
      const statsConditions: any[] = [];
      if (!isGlobal) {
        statsConditions.push(eq(eventGuests.createdById, ctx.user.id));
      }
      const statsWhere = statsConditions.length > 0 ? and(...statsConditions) : undefined;

      const [paymentStats] = await db
        .select({
          totalPayments: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN ${eventPayments.amount} ELSE 0 END), 0)`,
          paidCount: sql<number>`SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN 1 ELSE 0 END)`,
          pendingCount: sql<number>`SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PENDING' THEN 1 ELSE 0 END)`,
        })
        .from(eventPayments)
        .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
        .where(statsWhere);

      return {
        payments,
        isGlobalView: isGlobal,
        stats: {
          totalPayments: Number(paymentStats?.totalPayments) || 0,
          totalAmount: Number(paymentStats?.totalAmount) || 0,
          paidCount: Number(paymentStats?.paidCount) || 0,
          pendingCount: Number(paymentStats?.pendingCount) || 0,
        },
      };
    }),

  // ============================================================================
  // ENVÍO DE INVITACIONES POR EMAIL
  // ============================================================================

  // Enviar invitación por email
  sendInvitation: staffProcedure
    .input(z.object({ guestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.id, input.guestId));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      // Generar URL del QR
      const qrUrl = `https://evgreen.lat/event-checkin/${guest.qrCode}`;

      // Obtener configuración del evento
      const eventConfig = await getPlatformSettings();

      // Generar HTML del email de invitación
      const emailHtml = await generateInvitationEmail(guest, qrUrl, eventConfig);
      const eventName = eventConfig?.eventName || "Gran Lanzamiento Red de Carga EVGreen";

      try {
        console.log(`[Event] Enviando invitación a ${guest.email} con API Key: ${resendApiKey.substring(0, 10)}...`);
        
        const result = await resend.emails.send({
          ...buildEmailParams({
            from: "EVGreen <invitaciones@evgreen.lat>",
            to: guest.email,
            subject: `Invitacion Exclusiva - ${eventName}`,
            html: emailHtml,
            replyTo: "evgreen@greenhproject.com",
          }),
          tags: [
            { name: "category", value: "invitation" },
            { name: "guest_id", value: String(input.guestId) },
          ],
        });

        console.log(`[Event] Resultado Resend:`, JSON.stringify(result));

        // Verificar si Resend retornó un error
        if (result.error) {
          console.error(`[Event] Error de Resend:`, result.error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Error de Resend: ${result.error.message || JSON.stringify(result.error)}`,
          });
        }

        // Actualizar estado
        await db
          .update(eventGuests)
          .set({
            invitationSentAt: new Date(),
            invitationEmailId: result.data?.id || null,
            status: "CONFIRMED",
          })
          .where(eq(eventGuests.id, input.guestId));

        return { success: true, emailId: result.data?.id };
      } catch (error: any) {
        console.error("[Event] Error enviando invitación:", error?.message || error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error enviando la invitación: ${error?.message || 'Error desconocido'}`,
        });
      }
    }),

  // Enviar invitaciones masivas
  sendBulkInvitations: staffProcedure
    .input(z.object({
      guestIds: z.array(z.number()).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      let sent = 0;
      let failed = 0;

      // Obtener configuración del evento una sola vez para todo el batch
      const eventCfg = await getPlatformSettings();
      const evtName = eventCfg?.eventName || "Gran Lanzamiento Red de Carga EVGreen";

      for (const guestId of input.guestIds) {
        try {
          const [guest] = await db
            .select()
            .from(eventGuests)
            .where(eq(eventGuests.id, guestId));

          if (!guest || guest.invitationSentAt) continue;

          const qrUrl = `https://evgreen.lat/event-checkin/${guest.qrCode}`;
          const emailHtml = await generateInvitationEmail(guest, qrUrl, eventCfg);

          console.log(`[Event Bulk] Enviando invitación a ${guest.email}...`);
          const result = await resend.emails.send({
            ...buildEmailParams({
              from: "EVGreen <invitaciones@evgreen.lat>",
              to: guest.email,
              subject: `Invitacion Exclusiva - ${evtName}`,
              html: emailHtml,
              replyTo: "evgreen@greenhproject.com",
            }),
            tags: [
              { name: "category", value: "invitation" },
              { name: "guest_id", value: String(guestId) },
            ],
          });
          console.log(`[Event Bulk] Resultado:`, JSON.stringify(result));

          if (result.error) {
            console.error(`[Event Bulk] Error Resend para ${guest.email}:`, result.error);
            failed++;
            continue;
          }

          await db
            .update(eventGuests)
            .set({
              invitationSentAt: new Date(),
              invitationEmailId: result.data?.id || null,
              status: "CONFIRMED",
            })
            .where(eq(eventGuests.id, guestId));

          sent++;

          // Pausa entre envíos para evitar rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[Event] Error enviando invitación a guest ${guestId}:`, error);
          failed++;
        }
      }

      return { sent, failed, total: input.guestIds.length };
    }),

  // Verificar estado de entrega del email
  checkEmailStatus: staffProcedure
    .input(z.object({ guestId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.id, input.guestId));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      if (!guest.invitationEmailId) {
        return { status: "not_sent", message: "La invitaci\u00f3n a\u00fan no ha sido enviada" };
      }

      try {
        const emailDetail = await resend.emails.get(guest.invitationEmailId);
        if (emailDetail.error) {
          return { status: "unknown", message: "No se pudo verificar el estado del email" };
        }
        const lastEvent = emailDetail.data?.last_event || "unknown";
        const statusMessages: Record<string, string> = {
          sent: "Email enviado, pendiente de entrega",
          delivered: "Email entregado al servidor de correo del destinatario",
          delivery_delayed: "Entrega retrasada, reintentando...",
          complained: "El destinatario marc\u00f3 el email como spam",
          bounced: "El email rebot\u00f3 (direcci\u00f3n inv\u00e1lida o buz\u00f3n lleno)",
          opened: "El destinatario abri\u00f3 el email",
          clicked: "El destinatario hizo clic en un enlace del email",
        };
        return {
          status: lastEvent,
          message: statusMessages[lastEvent] || `Estado: ${lastEvent}`,
          emailId: guest.invitationEmailId,
          sentAt: guest.invitationSentAt,
        };
      } catch (error: any) {
        console.error("[Event] Error verificando estado email:", error?.message);
        return { status: "error", message: "Error al consultar Resend API" };
      }
    }),

  // Re-enviar invitaci\u00f3n (forzar reenv\u00edo aunque ya se haya enviado)
  resendInvitation: staffProcedure
    .input(z.object({ guestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

      const [guest] = await db
        .select()
        .from(eventGuests)
        .where(eq(eventGuests.id, input.guestId));

      if (!guest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitado no encontrado" });
      }

      if (!guest.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El invitado no tiene email registrado" });
      }

      const qrUrl = `https://evgreen.lat/event-checkin/${guest.qrCode}`;
      const eventConfig = await getPlatformSettings();
      const emailHtml = await generateInvitationEmail(guest, qrUrl, eventConfig);
      const eventName = eventConfig?.eventName || "Gran Lanzamiento Red de Carga EVGreen";

      try {
        console.log(`[Event] Re-enviando invitaci\u00f3n a ${guest.email}...`);
        const result = await resend.emails.send({
          ...buildEmailParams({
            from: "EVGreen <invitaciones@evgreen.lat>",
            to: guest.email,
            subject: `Invitacion Exclusiva - ${eventName}`,
            html: emailHtml,
            replyTo: "evgreen@greenhproject.com",
          }),
          tags: [
            { name: "category", value: "invitation-resend" },
            { name: "guest_id", value: String(input.guestId) },
          ],
        });

        if (result.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Error de Resend: ${result.error.message || JSON.stringify(result.error)}`,
          });
        }

        await db
          .update(eventGuests)
          .set({
            invitationSentAt: new Date(),
            invitationEmailId: result.data?.id || null,
          })
          .where(eq(eventGuests.id, input.guestId));

        return { success: true, emailId: result.data?.id };
      } catch (error: any) {
        console.error("[Event] Error re-enviando invitaci\u00f3n:", error?.message || error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error re-enviando la invitaci\u00f3n: ${error?.message || 'Error desconocido'}`,
        });
      }
    }),

  // ============================================================================
  // ESTAD\u00cdSTICAS DEL EVENTO
  // ============================================================================

  // ============================================================================
  // EXPORTACIÓN DE DATOS
  // ============================================================================

  exportGuestsExcel: staffProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const isGlobal = isSuperStaff(ctx.user);
    const guests = await db.select().from(eventGuests)
      .where(!isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined)
      .orderBy(eventGuests.founderSlot);
    const buffer = await exportGuestsToExcel(guests);
    return { base64: buffer.toString("base64"), filename: `EVGreen_Invitados_${new Date().toISOString().split("T")[0]}.xlsx` };
  }),

  exportPaymentsExcel: staffProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const isGlobal = isSuperStaff(ctx.user);
    const payments = await db
      .select({
        id: eventPayments.id,
        guestName: eventGuests.fullName,
        guestEmail: eventGuests.email,
        guestCompany: eventGuests.company,
        founderSlot: eventGuests.founderSlot,
        amount: eventPayments.amount,
        selectedPackage: eventPayments.selectedPackage,
        paymentStatus: eventPayments.paymentStatus,
        paymentMethod: eventPayments.paymentMethod,
        paymentReference: eventPayments.paymentReference,
        paidAt: eventPayments.paidAt,
        createdAt: eventPayments.createdAt,
      })
      .from(eventPayments)
      .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
      .where(!isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined)
      .orderBy(desc(eventPayments.createdAt));

    const buffer = await exportPaymentsToExcel(payments as any);
    return { base64: buffer.toString("base64"), filename: `EVGreen_Pagos_${new Date().toISOString().split("T")[0]}.xlsx` };
  }),

  exportGuestsPDF: staffProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const isGlobal = isSuperStaff(ctx.user);
    const guests = await db.select().from(eventGuests)
      .where(!isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined)
      .orderBy(eventGuests.founderSlot);
    const buffer = exportGuestsToPDF(guests);
    return { base64: buffer.toString("base64"), filename: `EVGreen_Invitados_${new Date().toISOString().split("T")[0]}.pdf` };
  }),

  exportPaymentsPDF: staffProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const isGlobal = isSuperStaff(ctx.user);
    const payments = await db
      .select({
        id: eventPayments.id,
        guestName: eventGuests.fullName,
        guestEmail: eventGuests.email,
        guestCompany: eventGuests.company,
        founderSlot: eventGuests.founderSlot,
        amount: eventPayments.amount,
        selectedPackage: eventPayments.selectedPackage,
        paymentStatus: eventPayments.paymentStatus,
        paymentMethod: eventPayments.paymentMethod,
        paymentReference: eventPayments.paymentReference,
        paidAt: eventPayments.paidAt,
        createdAt: eventPayments.createdAt,
      })
      .from(eventPayments)
      .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
      .where(!isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined)
      .orderBy(desc(eventPayments.createdAt));

    const buffer = exportPaymentsToPDF(payments as any);
    return { base64: buffer.toString("base64"), filename: `EVGreen_Pagos_${new Date().toISOString().split("T")[0]}.pdf` };
  }),

  getEventStats: staffProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const isGlobal = isSuperStaff(ctx.user);
    const staffFilter = !isGlobal ? eq(eventGuests.createdById, ctx.user.id) : undefined;

    const [guestStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        invited: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'INVITED' THEN 1 ELSE 0 END)`,
        confirmed: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CONFIRMED' THEN 1 ELSE 0 END)`,
        checkedIn: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CHECKED_IN' THEN 1 ELSE 0 END)`,
        cancelled: sql<number>`SUM(CASE WHEN ${eventGuests.status} = 'CANCELLED' THEN 1 ELSE 0 END)`,
        slotsUsed: sql<number>`SUM(CASE WHEN ${eventGuests.founderSlot} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(eventGuests)
      .where(staffFilter);

    // Para pagos, filtrar por invitados del staff
    const paymentJoinConditions: any[] = [];
    if (!isGlobal) {
      paymentJoinConditions.push(eq(eventGuests.createdById, ctx.user.id));
    }
    const paymentStaffFilter = paymentJoinConditions.length > 0 ? and(...paymentJoinConditions) : undefined;

    const [paymentStats] = await db
      .select({
        totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN ${eventPayments.amount} ELSE 0 END), 0)`,
        totalPending: sql<number>`COALESCE(SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PENDING' THEN ${eventPayments.amount} ELSE 0 END), 0)`,
        paidCount: sql<number>`SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN 1 ELSE 0 END)`,
        pendingCount: sql<number>`SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PENDING' THEN 1 ELSE 0 END)`,
      })
      .from(eventPayments)
      .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
      .where(paymentStaffFilter);

    // Distribución por paquete
    const pkgConditions: any[] = [sql`${eventGuests.investmentPackage} IS NOT NULL`];
    if (!isGlobal) pkgConditions.push(eq(eventGuests.createdById, ctx.user.id));
    const packageDistribution = await db
      .select({
        package: eventGuests.investmentPackage,
        count: sql<number>`COUNT(*)`,
      })
      .from(eventGuests)
      .where(and(...pkgConditions))
      .groupBy(eventGuests.investmentPackage);

    // Distribución por método de pago
    const pmConditions: any[] = [sql`${eventPayments.paymentStatus} = 'PAID'`];
    if (!isGlobal) pmConditions.push(eq(eventGuests.createdById, ctx.user.id));
    const paymentMethodDist = await db
      .select({
        method: eventPayments.paymentMethod,
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${eventPayments.amount}), 0)`,
      })
      .from(eventPayments)
      .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
      .where(and(...pmConditions))
      .groupBy(eventPayments.paymentMethod);

    // Pagos recientes (últimos 10)
    const recentConditions: any[] = [];
    if (!isGlobal) recentConditions.push(eq(eventGuests.createdById, ctx.user.id));
    const recentPayments = await db
      .select({
        id: eventPayments.id,
        guestName: eventGuests.fullName,
        amount: eventPayments.amount,
        selectedPackage: eventPayments.selectedPackage,
        paymentMethod: eventPayments.paymentMethod,
        paymentStatus: eventPayments.paymentStatus,
        paidAt: eventPayments.paidAt,
        createdAt: eventPayments.createdAt,
        staffName: users.name,
      })
      .from(eventPayments)
      .leftJoin(eventGuests, eq(eventPayments.guestId, eventGuests.id))
      .leftJoin(users, eq(eventGuests.createdById, users.id))
      .where(recentConditions.length > 0 ? and(...recentConditions) : undefined)
      .orderBy(desc(eventPayments.createdAt))
      .limit(10);

    // Invitaciones enviadas vs pendientes
    const [invitationStats] = await db
      .select({
        sent: sql<number>`SUM(CASE WHEN ${eventGuests.invitationSentAt} IS NOT NULL THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN ${eventGuests.invitationSentAt} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(eventGuests)
      .where(staffFilter);

    // Meta de recaudación: 30 cupos * $1M reserva = $30M mínimo
    const reservationGoal = 30000000;
    const totalPaid = Number(paymentStats?.totalPaid) || 0;
    const goalProgress = Math.min((totalPaid / reservationGoal) * 100, 100);

    // Inversión potencial total por paquete
    const PACKAGE_AMOUNTS: Record<string, number> = {
      AC: 8500000,
      DC_INDIVIDUAL: 85000000,
      COLECTIVO: 200000000,
    };
    const potentialInvestment = packageDistribution.reduce((acc: number, p: any) => {
      const pkg = p.package || "AC";
      return acc + (PACKAGE_AMOUNTS[pkg] || 0) * Number(p.count);
    }, 0);

    // Ranking de aliados (solo para super staff)
    let staffRanking: any[] = [];
    if (isGlobal) {
      staffRanking = await db
        .select({
          staffId: users.id,
          staffName: users.name,
          staffEmail: users.email,
          totalGuests: sql<number>`COUNT(DISTINCT ${eventGuests.id})`,
          totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN ${eventPayments.amount} ELSE 0 END), 0)`,
          paidCount: sql<number>`SUM(CASE WHEN ${eventPayments.paymentStatus} = 'PAID' THEN 1 ELSE 0 END)`,
        })
        .from(eventGuests)
        .innerJoin(users, eq(eventGuests.createdById, users.id))
        .leftJoin(eventPayments, eq(eventPayments.guestId, eventGuests.id))
        .where(sql`${users.role} = 'staff'`)
        .groupBy(users.id, users.name, users.email)
        .orderBy(sql`totalPaid DESC`);
    }

    return {
      isGlobalView: isGlobal,
      staffName: ctx.user.name,
      guests: {
        total: Number(guestStats?.total) || 0,
        invited: Number(guestStats?.invited) || 0,
        confirmed: Number(guestStats?.confirmed) || 0,
        checkedIn: Number(guestStats?.checkedIn) || 0,
        cancelled: Number(guestStats?.cancelled) || 0,
        founderSlotsUsed: Number(guestStats?.slotsUsed) || 0,
        founderSlotsAvailable: 30 - (Number(guestStats?.slotsUsed) || 0),
        invitationsSent: Number(invitationStats?.sent) || 0,
        invitationsPending: Number(invitationStats?.pending) || 0,
      },
      payments: {
        totalPaid,
        totalPending: Number(paymentStats?.totalPending) || 0,
        paidCount: Number(paymentStats?.paidCount) || 0,
        pendingCount: Number(paymentStats?.pendingCount) || 0,
        reservationGoal,
        goalProgress: Math.round(goalProgress * 10) / 10,
        potentialInvestment,
        averagePayment: Number(paymentStats?.paidCount) > 0
          ? Math.round(totalPaid / Number(paymentStats?.paidCount))
          : 0,
      },
      packageDistribution: packageDistribution.map((p) => ({
        package: p.package,
        count: Number(p.count),
      })),
      paymentMethodDistribution: paymentMethodDist.map((p) => ({
        method: p.method,
        count: Number(p.count),
        total: Number(p.total),
      })),
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      staffRanking: staffRanking.map((s) => ({
        staffId: s.staffId,
        staffName: s.staffName,
        staffEmail: s.staffEmail,
        totalGuests: Number(s.totalGuests),
        totalPaid: Number(s.totalPaid),
        paidCount: Number(s.paidCount),
      })),
    };
  }),
});

// ============================================================================
// GENERADOR DE EMAIL DE INVITACIÓN
// ============================================================================

async function generateInvitationEmail(guest: any, qrUrl: string, eventConfig?: any): Promise<string> {
  // Datos del evento desde configuración admin (o valores por defecto)
  const evt = {
    name: eventConfig?.eventName || "Gran Lanzamiento Red de Carga EVGreen",
    date: eventConfig?.eventDate || "Por confirmar - Se notificará próximamente",
    time: eventConfig?.eventTime || "",
    venueName: eventConfig?.eventVenueName || "Por confirmar",
    address: eventConfig?.eventAddress || "Bogotá, Colombia",
    city: eventConfig?.eventCity || "Bogotá",
    contactPhone: eventConfig?.eventContactPhone || "",
    contactEmail: eventConfig?.eventContactEmail || "evgreen@greenhproject.com",
    googleMapsUrl: eventConfig?.eventGoogleMapsUrl || "",
    wazeUrl: eventConfig?.eventWazeUrl || "",
    dressCode: eventConfig?.eventDressCode || "Business Casual",
    description: eventConfig?.eventDescription || "",
    maxGuests: eventConfig?.eventMaxGuests || 30,
    bgImageUrl: eventConfig?.eventBgImageUrl || EVENT_BG_IMAGE,
  };

  const founderSlotText = guest.founderSlot
    ? `<div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; letter-spacing: 1px;">
          CUPO FUNDADOR #${guest.founderSlot} DE ${evt.maxGuests}
        </span>
      </div>`
    : "";

  const packageText = guest.investmentPackage
    ? `<p style="color: #a0a0a0; font-size: 14px; text-align: center; margin: 10px 0;">
        Paquete de interés: <strong style="color: #22c55e;">${
          guest.investmentPackage === "AC"
            ? "AC Básico - $8.500.000"
            : guest.investmentPackage === "DC_INDIVIDUAL"
            ? "DC Individual 120kW - $85.000.000"
            : "Estación Premium Colectiva - $200.000.000"
        }</strong>
      </p>`
    : "";

  // QR code generado internamente y hospedado en S3 (evita spam por imágenes externas)
  let qrImageUrl: string;
  try {
    const qrFileKey = `evgreen/qr-codes/event-${guest.qrCode}.png`;
    qrImageUrl = await generateQRCodeUrl(qrUrl, qrFileKey, {
      width: 300,
      color: { dark: "#22c55e", light: "#0a0a0a" },
      margin: 2,
    });
  } catch (e) {
    // Fallback: usar data URI si S3 falla
    const QRCode = await import("qrcode");
    qrImageUrl = await QRCode.default.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#22c55e", light: "#0a0a0a" },
    });
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación EVGreen</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #000000;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; border-radius: 16px; overflow: hidden; border: 1px solid #1a3a1a;">
          
          <!-- Header con imagen de fondo -->
          <tr>
            <td style="background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(10,10,10,1) 100%), url('${evt.bgImageUrl}'); background-size: cover; background-position: center top; height: 300px; text-align: center; vertical-align: bottom; padding: 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">
                ${evt.name.toUpperCase()}
              </h1>
              <p style="color: #22c55e; margin: 5px 0 0 0; font-size: 16px; font-weight: 600; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">
                Red de Carga Eléctrica EVGreen
              </p>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding: 30px 40px;">
              <!-- Badge exclusivo -->
              <div style="text-align: center; margin-bottom: 25px;">
                <span style="display: inline-block; border: 1px solid #22c55e; color: #22c55e; padding: 6px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">
                  EVENTO EXCLUSIVO POR INVITACIÓN
                </span>
              </div>

              <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Estimado/a <strong style="color: #ffffff;">${guest.fullName}</strong>,
              </p>

              <p style="color: #a0a0a0; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                Tiene el honor de ser invitado/a al <strong style="color: #22c55e;">${evt.name}</strong>${evt.description ? `, ${evt.description}` : ', donde presentaremos la primera red de electrolineras inteligentes de Colombia con tecnología Huawei FusionCharge'}.
              </p>

              <p style="color: #a0a0a0; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                Como <strong style="color: #ffffff;">Inversionista Fundador</strong>, tendrá acceso exclusivo a beneficios únicos: <strong style="color: #22c55e;">5% de descuento</strong> en su inversión, <strong style="color: #22c55e;">fee de zona gratis</strong> (ahorro hasta $5.000.000), prioridad en selección de ubicación y soporte VIP de por vida.
              </p>

              ${founderSlotText}
              ${packageText}

              <!-- Separador -->
              <div style="border-top: 1px solid #1a3a1a; margin: 25px 0;"></div>

              <!-- Detalles del evento -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td style="padding: 10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #22c55e; font-size: 20px; padding-right: 12px; vertical-align: top;">📅</td>
                        <td>
                          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;">Fecha del Evento</p>
                          <p style="color: #a0a0a0; font-size: 13px; margin: 4px 0 0 0;">${evt.date}${evt.time && evt.time !== 'Por confirmar' ? ` - ${evt.time}` : ''}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #22c55e; font-size: 20px; padding-right: 12px; vertical-align: top;">📍</td>
                        <td>
                          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;">${evt.venueName}</p>
                          <p style="color: #a0a0a0; font-size: 13px; margin: 4px 0 0 0;">${evt.address}</p>
                          ${evt.googleMapsUrl || evt.wazeUrl ? `
                          <p style="margin: 8px 0 0 0;">
                            ${evt.googleMapsUrl ? `<a href="${evt.googleMapsUrl}" style="color: #22c55e; text-decoration: none; font-size: 12px; margin-right: 15px;">🗺️ Abrir en Google Maps</a>` : ''}
                            ${evt.wazeUrl ? `<a href="${evt.wazeUrl}" style="color: #22c55e; text-decoration: none; font-size: 12px;">🚗 Abrir en Waze</a>` : ''}
                          </p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${evt.dressCode ? `<tr>
                  <td style="padding: 10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #22c55e; font-size: 20px; padding-right: 12px; vertical-align: top;">👔</td>
                        <td>
                          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;">Dress Code</p>
                          <p style="color: #a0a0a0; font-size: 13px; margin: 4px 0 0 0;">${evt.dressCode}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ''}
                ${evt.contactPhone ? `<tr>
                  <td style="padding: 10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #22c55e; font-size: 20px; padding-right: 12px; vertical-align: top;">📞</td>
                        <td>
                          <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0;">Contacto</p>
                          <p style="color: #a0a0a0; font-size: 13px; margin: 4px 0 0 0;">${evt.contactPhone}${evt.contactEmail ? ` | ${evt.contactEmail}` : ''}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ''}
              </table>

              <!-- Separador -->
              <div style="border-top: 1px solid #1a3a1a; margin: 25px 0;"></div>

              <!-- QR Code -->
              <div style="text-align: center; margin: 25px 0;">
                <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 5px 0;">
                  Su Pase de Acceso
                </p>
                <p style="color: #a0a0a0; font-size: 13px; margin: 0 0 20px 0;">
                  Presente este código QR en la entrada del evento
                </p>
                <div style="display: inline-block; background: #111; border: 2px solid #22c55e; border-radius: 16px; padding: 20px;">
                  <img src="${qrImageUrl}" alt="QR Code" width="200" height="200" style="display: block; border-radius: 8px;" />
                </div>
                <p style="color: #666; font-size: 11px; margin: 10px 0 0 0;">
                  Código: ${guest.qrCode}
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://evgreen.lat/investors" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Conocer Paquetes de Inversión →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #050505; padding: 25px 40px; border-top: 1px solid #1a3a1a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="color: #22c55e; font-size: 16px; font-weight: 700; margin: 0;">EVGreen</p>
                    <p style="color: #666; font-size: 12px; margin: 4px 0 0 0;">Carga el Futuro - Green House Project S.A.S.</p>
                  </td>
                  <td align="right">
                    <a href="https://evgreen.lat" style="color: #22c55e; text-decoration: none; font-size: 13px;">evgreen.lat</a>
                  </td>
                </tr>
              </table>
              <p style="color: #444; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                Solo ${evt.maxGuests} cupos disponibles para Inversionistas Fundadores. Esta invitación es personal e intransferible.
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
