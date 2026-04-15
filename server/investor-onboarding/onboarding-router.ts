/**
 * EVGreen - Router de Onboarding para Inversionistas
 * Procedimientos tRPC para el flujo de onboarding guiado
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { triggerInvestorWelcome } from "./email-service";
import { storagePut } from "../storage";

export const onboardingRouter = router({
  /**
   * Obtener el estado actual del onboarding del usuario
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    return {
      onboardingCompleted: user.onboardingCompleted ?? false,
      onboardingStep: user.onboardingStep ?? 0,
      onboardingStartedAt: user.onboardingStartedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
      welcomeEmailSent: user.welcomeEmailSent ?? false,
      // Datos de perfil para verificar completitud
      profileComplete: !!(user.name && user.email && user.phone),
      companyComplete: !!(user.companyName && user.taxId),
      bankingComplete: !!(user.bankName && user.bankAccount),
      // Datos actuales del perfil
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        documentType: user.documentType,
        documentNumber: user.documentNumber,
        companyName: user.companyName,
        taxId: user.taxId,
        fiscalAddress: user.fiscalAddress,
        fiscalCity: user.fiscalCity,
        fiscalDepartment: user.fiscalDepartment,
        bankName: user.bankName,
        bankAccount: user.bankAccount,
        avatarUrl: user.avatarUrl,
        investorTypes: user.investorTypes,
        isFounder: user.isFounder,
        founderTitle: user.founderTitle,
        investorPhotoUrl: user.investorPhotoUrl,
        investorQuote: user.investorQuote,
        investorBio: user.investorBio,
        investorShowInWall: user.investorShowInWall,
        investorBadge: user.investorBadge,
      },
    };
  }),

  /**
   * Actualizar el paso actual del onboarding
   */
  updateStep: protectedProcedure
    .input(z.object({
      step: z.number().min(0).max(7),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, {
        onboardingStep: input.step,
      } as any);
      return { success: true, step: input.step };
    }),

  /**
   * Guardar datos del paso de perfil personal (Step 2)
   */
  savePersonalProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      documentType: z.enum(["CC", "NIT", "CE", "PASAPORTE", "TI", "PEP"]).optional(),
      documentNumber: z.string().max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      // Avanzar al paso 3
      await db.updateUser(ctx.user.id, { onboardingStep: 3 } as any);
      return { success: true };
    }),

  /**
   * Guardar datos del paso de empresa (Step 3)
   */
  saveCompanyProfile: protectedProcedure
    .input(z.object({
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      fiscalAddress: z.string().max(500).optional(),
      fiscalCity: z.string().max(100).optional(),
      fiscalDepartment: z.string().max(100).optional(),
      kindOfPerson: z.enum(["PERSON_ENTITY", "LEGAL_ENTITY"]).optional(),
      regime: z.enum(["SIMPLIFIED_REGIME", "COMMON_REGIME", "NOT_RESPONSIBLE_FOR_IVA"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      // Avanzar al paso 4
      await db.updateUser(ctx.user.id, { onboardingStep: 4 } as any);
      return { success: true };
    }),

  /**
   * Guardar datos bancarios (Step 4)
   */
  saveBankingInfo: protectedProcedure
    .input(z.object({
      bankName: z.string().min(1),
      bankAccount: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      // Avanzar al paso 5
      await db.updateUser(ctx.user.id, { onboardingStep: 5 } as any);
      return { success: true };
    }),

  /**
   * Guardar perfil de fundador (Step especial entre banking y dashboard tour)
   * Solo para inversionistas con isFounder=true
   */
  saveFounderProfile: protectedProcedure
    .input(z.object({
      founderTitle: z.string().max(100).optional(),
      investorQuote: z.string().max(500).optional(),
      investorBio: z.string().max(2000).optional(),
      investorShowInWall: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isFounder) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo disponible para fundadores" });
      }
      const updateData: Record<string, any> = {};
      if (input.founderTitle !== undefined) updateData.founderTitle = input.founderTitle;
      if (input.investorQuote !== undefined) updateData.investorQuote = input.investorQuote;
      if (input.investorBio !== undefined) updateData.investorBio = input.investorBio;
      if (input.investorShowInWall !== undefined) updateData.investorShowInWall = input.investorShowInWall;

      if (Object.keys(updateData).length > 0) {
        await db.updateUser(ctx.user.id, updateData);
      }
      return { success: true };
    }),

  /**
   * Upload de foto de fundador a S3
   */
  uploadFounderPhoto: protectedProcedure
    .input(z.object({
      photoBase64: z.string(), // base64 encoded image
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isFounder) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo disponible para fundadores" });
      }
      try {
        const buffer = Buffer.from(input.photoBase64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("webp") ? "webp" : "jpg";
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `founders/${ctx.user.id}-photo-${randomSuffix}.${ext}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Guardar URL en el perfil del usuario
        await db.updateUser(ctx.user.id, { investorPhotoUrl: url } as any);
        
        return { success: true, photoUrl: url };
      } catch (error: any) {
        console.error("[Onboarding] Failed to upload founder photo:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al subir la foto" });
      }
    }),

  /**
   * Completar el onboarding
   */
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const maxStep = ctx.user.isFounder ? 7 : 6;
    await db.updateUser(ctx.user.id, {
      onboardingCompleted: true,
      onboardingStep: maxStep,
      onboardingCompletedAt: new Date(),
    } as any);
    return { success: true };
  }),

  /**
   * Admin: Disparar manualmente el email de bienvenida para un inversionista
   */
  sendWelcomeEmail: adminProcedure
    .input(z.object({
      userId: z.number(),
      investmentAmount: z.number(),
      investmentType: z.enum(["individual", "collective"]),
      stationName: z.string().optional(),
      projectName: z.string().optional(),
      participationPercent: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Obtener datos del usuario
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      }
      if (!user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario no tiene email registrado" });
      }

      const sent = await triggerInvestorWelcome(user.id, {
        investorName: user.name || "Inversionista",
        investorEmail: user.email,
        investmentAmount: input.investmentAmount,
        investmentType: input.investmentType,
        stationName: input.stationName,
        projectName: input.projectName,
        participationPercent: input.participationPercent,
      });

      return { success: sent };
    }),

  /**
   * Reset onboarding (admin only, for testing)
   */
  reset: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, {
        onboardingCompleted: false,
        onboardingStep: 0,
        onboardingStartedAt: null,
        onboardingCompletedAt: null,
        welcomeEmailSent: false,
      } as any);
      return { success: true };
    }),
});
