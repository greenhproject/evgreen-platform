import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  userOnboardingEvents,
  userOnboardingProgress,
  userVehicles,
  users,
} from "../../drizzle/schema";
import {
  USER_ONBOARDING_STEPS,
  USER_ONBOARDING_VERSION,
  canShowUserOnboarding,
  normalizeOnboardingName,
} from "../../shared/user-onboarding";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const connectorTypes = ["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"] as const;
const currentTermsVersion = "1.0";

const progressStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "SKIPPED"]);

function requireEndUser(role: string) {
  if (role !== "user") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "El onboarding inicial está disponible únicamente para cuentas de usuario final.",
    });
  }
}

async function upsertProgress(userId: number, currentStep: number, status: z.infer<typeof progressStatusSchema> = "IN_PROGRESS") {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

  const now = new Date();
  const completedAt = status === "COMPLETED" ? now : null;
  const skippedAt = status === "SKIPPED" ? now : null;

  await database
    .insert(userOnboardingProgress)
    .values({
      userId,
      version: USER_ONBOARDING_VERSION,
      status,
      currentStep,
      startedAt: now,
      completedAt,
      skippedAt,
      lastSavedAt: now,
    } as any)
    .onDuplicateKeyUpdate({
      set: {
        status,
        currentStep,
        completedAt,
        skippedAt,
        lastSavedAt: now,
        version: USER_ONBOARDING_VERSION,
      } as any,
    });
}

async function recordOnboardingEvent(input: {
  userId: number;
  eventType: string;
  granted?: boolean;
  policyVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

  await database.insert(userOnboardingEvents).values({
    userId: input.userId,
    eventType: input.eventType,
    granted: input.granted === undefined ? null : input.granted,
    policyVersion: input.policyVersion ?? USER_ONBOARDING_VERSION,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
  } as any);
}

export const userOnboardingRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

    const [progress] = await database
      .select()
      .from(userOnboardingProgress)
      .where(eq(userOnboardingProgress.userId, ctx.user.id))
      .limit(1);

    const [user] = await database
      .select({
        name: users.name,
        email: users.email,
        phone: users.phone,
        birthDate: users.birthDate,
        city: users.city,
        electronicInvoiceOptIn: users.electronicInvoiceOptIn,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const [defaultVehicle] = await database
      .select({ id: userVehicles.id })
      .from(userVehicles)
      .where(and(eq(userVehicles.userId, ctx.user.id), eq(userVehicles.isActive, true as any)))
      .limit(1);

    const status = progress?.status ?? null;
    return {
      shouldShow: canShowUserOnboarding(ctx.user.role, status),
      status,
      currentStep: progress?.currentStep ?? USER_ONBOARDING_STEPS.welcome,
      version: progress?.version ?? USER_ONBOARDING_VERSION,
      profile: {
        name: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
        birthDate: user?.birthDate ?? "",
        city: user?.city ?? "",
        electronicInvoiceOptIn: Boolean(user?.electronicInvoiceOptIn),
        hasVehicle: Boolean(defaultVehicle),
      },
    };
  }),

  start: protectedProcedure.mutation(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.welcome);
    return { success: true };
  }),

  restart: protectedProcedure.mutation(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.welcome);
    await recordOnboardingEvent({ userId: ctx.user.id, eventType: "ONBOARDING_RESTARTED", granted: true });
    return { success: true };
  }),

  savePersonalProfile: protectedProcedure
    .input(z.object({
      firstName: z.string().trim().min(2, "Ingresa tu nombre").max(80),
      lastName: z.string().trim().min(2, "Ingresa tu apellido").max(80),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD").optional(),
      phone: z.string().trim().min(7, "Ingresa un número de WhatsApp válido").max(20),
      city: z.string().trim().max(100).optional(),
      address: z.string().trim().max(500).optional(),
      emailConfirmed: z.literal(true),
    }))
    .mutation(async ({ ctx, input }) => {
      requireEndUser(ctx.user.role);
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

      await database
        .update(users)
        .set({
          name: normalizeOnboardingName(input.firstName, input.lastName),
          phone: input.phone,
          birthDate: input.birthDate || null,
          city: input.city || null,
          address: input.address || null,
        } as any)
        .where(eq(users.id, ctx.user.id));

      await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.vehicle);
      await recordOnboardingEvent({
        userId: ctx.user.id,
        eventType: "EMAIL_CONFIRMED",
        granted: true,
        ipAddress: (ctx as any).req?.ip,
        userAgent: (ctx as any).req?.headers?.["user-agent"],
      });
      return { success: true };
    }),

  saveVehicle: protectedProcedure
    .input(z.object({
      brand: z.string().trim().min(1, "La marca es requerida").max(100),
      model: z.string().trim().min(1, "El modelo es requerido").max(100),
      batteryCapacityKwh: z.number().min(1).max(999).optional(),
      connectorTypes: z.array(z.enum(connectorTypes)).min(1, "Selecciona un conector"),
    }))
    .mutation(async ({ ctx, input }) => {
      requireEndUser(ctx.user.role);
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

      const [existingVehicle] = await database
        .select({ id: userVehicles.id })
        .from(userVehicles)
        .where(and(eq(userVehicles.userId, ctx.user.id), eq(userVehicles.isActive, true as any)))
        .limit(1);

      if (!existingVehicle) {
        await database.insert(userVehicles).values({
          userId: ctx.user.id,
          brand: input.brand,
          model: input.model,
          batteryCapacityKwh: input.batteryCapacityKwh?.toString() ?? null,
          connectorTypes: input.connectorTypes,
          isDefault: true,
          isActive: true,
        } as any);
      }

      await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.billing);
      return { success: true, created: !existingVehicle };
    }),

  skipVehicle: protectedProcedure.mutation(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.billing);
    return { success: true };
  }),

  saveBilling: protectedProcedure
    .input(z.object({
      wantsElectronicInvoice: z.boolean(),
      documentType: z.enum(["CC", "NIT", "CE", "PASAPORTE", "TI", "PEP"]).optional(),
      documentNumber: z.string().trim().max(50).optional(),
      kindOfPerson: z.enum(["PERSON_ENTITY", "LEGAL_ENTITY"]).optional(),
      companyName: z.string().trim().max(255).optional(),
      taxId: z.string().trim().max(50).optional(),
      regime: z.enum(["SIMPLIFIED_REGIME", "COMMON_REGIME", "NOT_RESPONSIBLE_FOR_IVA"]).optional(),
      fiscalAddress: z.string().trim().max(500).optional(),
      fiscalCity: z.string().trim().max(100).optional(),
      fiscalDepartment: z.string().trim().max(100).optional(),
    }).superRefine((value, context) => {
      if (!value.wantsElectronicInvoice) return;
      for (const [key, fieldValue] of Object.entries({
        documentType: value.documentType,
        documentNumber: value.documentNumber,
        kindOfPerson: value.kindOfPerson,
        fiscalAddress: value.fiscalAddress,
        fiscalCity: value.fiscalCity,
        fiscalDepartment: value.fiscalDepartment,
      })) {
        if (!fieldValue) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Completa este dato para la facturación electrónica" });
      }
      if (value.kindOfPerson === "LEGAL_ENTITY" && (!value.companyName || !value.taxId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "Ingresa razón social y NIT para persona jurídica" });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      requireEndUser(ctx.user.role);
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

      const billingData: Record<string, unknown> = {
        electronicInvoiceOptIn: input.wantsElectronicInvoice,
      };
      if (input.wantsElectronicInvoice) {
        billingData.documentType = input.documentType;
        billingData.documentNumber = input.documentNumber;
        billingData.kindOfPerson = input.kindOfPerson;
        billingData.companyName = input.companyName || null;
        billingData.taxId = input.taxId || null;
        billingData.regime = input.regime || null;
        billingData.fiscalAddress = input.fiscalAddress;
        billingData.fiscalCity = input.fiscalCity;
        billingData.fiscalDepartment = input.fiscalDepartment;
      }

      await database
        .update(users)
        .set(billingData as any)
        .where(eq(users.id, ctx.user.id));

      await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.notifications);
      return { success: true };
    }),

  saveWhatsAppPreference: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      requireEndUser(ctx.user.role);
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

      await database
        .update(users)
        .set({
          waNotifyChargeStart: input.enabled,
          waNotifyChargeEnd: input.enabled,
          waNotifyReminder: false,
          waNotifyPenalty: input.enabled,
          waNotifyWallet: input.enabled,
        } as any)
        .where(eq(users.id, ctx.user.id));

      await recordOnboardingEvent({
        userId: ctx.user.id,
        eventType: "WHATSAPP_NOTIFICATIONS",
        granted: input.enabled,
        ipAddress: (ctx as any).req?.ip,
        userAgent: (ctx as any).req?.headers?.["user-agent"],
      });
      return { success: true };
    }),

  recordPushPreference: protectedProcedure
    .input(z.object({ granted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      requireEndUser(ctx.user.role);
      await recordOnboardingEvent({
        userId: ctx.user.id,
        eventType: "PUSH_NOTIFICATIONS",
        granted: input.granted,
        ipAddress: (ctx as any).req?.ip,
        userAgent: (ctx as any).req?.headers?.["user-agent"],
      });
      return { success: true };
    }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });

    const [user] = await database
      .select({ termsAcceptedAt: users.termsAcceptedAt })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!user?.termsAcceptedAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Acepta los Términos y la Política de tratamiento de datos para completar la activación." });
    }

    await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.complete, "COMPLETED");
    await recordOnboardingEvent({ userId: ctx.user.id, eventType: "ONBOARDING_COMPLETED", granted: true, policyVersion: currentTermsVersion });
    return { success: true };
  }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    await upsertProgress(ctx.user.id, USER_ONBOARDING_STEPS.welcome, "SKIPPED");
    await recordOnboardingEvent({ userId: ctx.user.id, eventType: "ONBOARDING_SKIPPED", granted: false });
    return { success: true };
  }),

  getRecentEvents: protectedProcedure.query(async ({ ctx }) => {
    requireEndUser(ctx.user.role);
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de datos no disponible" });
    return database
      .select({ eventType: userOnboardingEvents.eventType, granted: userOnboardingEvents.granted, createdAt: userOnboardingEvents.createdAt })
      .from(userOnboardingEvents)
      .where(eq(userOnboardingEvents.userId, ctx.user.id))
      .orderBy(desc(userOnboardingEvents.createdAt))
      .limit(20);
  }),
});
