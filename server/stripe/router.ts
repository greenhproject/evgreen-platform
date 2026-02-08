/**
 * Stripe router - DEPRECATED
 * La plataforma ahora usa Wompi como pasarela de pagos.
 * Este router se mantiene como stub para evitar errores de importación.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const stripeRouter = router({
  isConfigured: publicProcedure.query(() => {
    return { configured: false, message: "Usar Wompi para pagos" };
  }),

  getProducts: publicProcedure.query(() => {
    return {
      walletRecharge: { id: "wallet_recharge", name: "Recarga de Saldo", prices: {} },
      subscriptionBasic: { id: "basic", name: "Plan Básico", price: 18900 },
      subscriptionPremium: { id: "premium", name: "Plan Premium", price: 33900 },
    };
  }),

  createWalletRecharge: protectedProcedure
    .input(z.object({ amount: z.number() }))
    .mutation(async () => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe deshabilitado. Usa Wompi." });
    }),

  createSubscription: protectedProcedure
    .input(z.object({ planId: z.enum(["basic", "premium"]) }))
    .mutation(async () => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe deshabilitado. Usa Wompi." });
    }),

  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserSubscription(ctx.user.id);
  }),

  cancelSubscription: protectedProcedure.mutation(async () => {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe deshabilitado. Usa Wompi." });
  }),

  getPaymentHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.getWalletTransactions(ctx.user.id, input?.limit || 20);
    }),

  createCustomerPortal: protectedProcedure.mutation(async () => {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe deshabilitado. Usa Wompi." });
  }),
});
