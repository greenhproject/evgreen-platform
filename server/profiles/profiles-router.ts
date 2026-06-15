/**
 * Router tRPC — Perfiles de consumo y consentimiento de datos
 *
 * Cumplimiento Ley 1581/2012:
 * - Art. 8: Derecho de acceso (getMyProfile)
 * - Art. 8: Derecho de supresión (revokeConsent → borra perfil)
 * - Art. 12: Consentimiento previo, expreso e informado (grantConsent)
 *
 * Montar en server/routers.ts:
 *   import { profilesRouter } from "./profiles/profiles-router";
 *   ...
 *   profiles: profilesRouter,
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  grantConsent,
  revokeConsent,
  hasActiveConsent,
  computeProfileForUser,
} from "./consumption-profile-service";
import { getDb } from "../db";
import { userConsumptionProfile, personalizedOffers } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Versión vigente de la política de tratamiento de datos.
 * ⚠️ Si cambias el texto del disclaimer, INCREMENTA esta versión:
 * los usuarios deberán aceptar de nuevo la versión actualizada.
 */
export const CURRENT_POLICY_VERSION = "2026-06-v1";

const consentTypeSchema = z.enum(["AI_PROFILING", "MARKETING", "LOCATION_HISTORY"]);

export const profilesRouter = router({
  // --------------------------------------------------------------------
  // CONSENTIMIENTO
  // --------------------------------------------------------------------

  /** Estado de consentimientos del usuario (para mostrar u ocultar el diálogo) */
  getConsentStatus: protectedProcedure.query(async ({ ctx }) => {
    const [aiProfiling, marketing, locationHistory] = await Promise.all([
      hasActiveConsent(ctx.user.id, "AI_PROFILING"),
      hasActiveConsent(ctx.user.id, "MARKETING"),
      hasActiveConsent(ctx.user.id, "LOCATION_HISTORY"),
    ]);
    return {
      aiProfiling,
      marketing,
      locationHistory,
      currentPolicyVersion: CURRENT_POLICY_VERSION,
    };
  }),

  /** Otorgar consentimiento (desde el checkbox del diálogo) */
  grantConsent: protectedProcedure
    .input(
      z.object({
        consentType: consentTypeSchema,
        // El cliente confirma qué versión del texto está aceptando
        policyVersion: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.policyVersion !== CURRENT_POLICY_VERSION) {
        throw new Error(
          "La política de datos fue actualizada. Por favor recarga la página."
        );
      }

      await grantConsent({
        userId: ctx.user.id,
        consentType: input.consentType,
        policyVersion: input.policyVersion,
        ipAddress: (ctx as any).req?.ip,
        userAgent: (ctx as any).req?.headers?.["user-agent"] as string | undefined,
      });

      // Calcular el perfil de inmediato para que la IA se "active" ya
      if (input.consentType === "AI_PROFILING") {
        computeProfileForUser(ctx.user.id).catch(err =>
          console.error("[Profiles] Error en cálculo inicial:", err)
        );
      }

      return { success: true };
    }),

  /** Revocar consentimiento (borra el perfil — derecho de supresión) */
  revokeConsent: protectedProcedure
    .input(z.object({ consentType: consentTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      await revokeConsent(ctx.user.id, input.consentType);
      return { success: true };
    }),

  // --------------------------------------------------------------------
  // PERFIL (transparencia: el usuario puede VER lo que sabemos de él,
  // Ley 1581 Art. 8 — derecho de acceso)
  // --------------------------------------------------------------------

  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const consented = await hasActiveConsent(ctx.user.id, "AI_PROFILING");
    if (!consented) return { consented: false as const, profile: null };

    const database = await getDb();
    if (!database) return { consented: true as const, profile: null };

    const [profile] = await database
      .select()
      .from(userConsumptionProfile)
      .where(eq(userConsumptionProfile.userId, ctx.user.id))
      .limit(1);

    return { consented: true as const, profile: profile ?? null };
  }),

  // --------------------------------------------------------------------
  // OFERTAS PERSONALIZADAS
  // --------------------------------------------------------------------

  /** Obtener ofertas activas del usuario */
  getMyOffers: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) return [];

    const offers = await database
      .select()
      .from(personalizedOffers)
      .where(
        and(
          eq(personalizedOffers.userId, ctx.user.id),
          eq(personalizedOffers.status, "ACTIVE")
        )
      )
      .orderBy(desc(personalizedOffers.createdAt))
      .limit(10);

    return offers;
  }),

  /** Marcar oferta como canjeada */
  redeemOffer: protectedProcedure
    .input(z.object({ offerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verificar que la oferta pertenece al usuario
      const [offer] = await database
        .select()
        .from(personalizedOffers)
        .where(
          and(
            eq(personalizedOffers.id, input.offerId),
            eq(personalizedOffers.userId, ctx.user.id),
            eq(personalizedOffers.status, "ACTIVE")
          )
        )
        .limit(1);

      if (!offer) {
        throw new Error("Oferta no encontrada o ya no está disponible");
      }

      await database
        .update(personalizedOffers)
        .set({
          status: "REDEEMED",
          redeemedAt: new Date(),
        })
        .where(eq(personalizedOffers.id, input.offerId));

      return { success: true };
    }),

  /** Descartar oferta */
  dismissOffer: protectedProcedure
    .input(z.object({ offerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .update(personalizedOffers)
        .set({ status: "DISMISSED" })
        .where(
          and(
            eq(personalizedOffers.id, input.offerId),
            eq(personalizedOffers.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /** Forzar recálculo del perfil (para testing/admin) */
  recomputeProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await computeProfileForUser(ctx.user.id);
    return { success: result };
  }),
});
