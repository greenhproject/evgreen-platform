import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  createWalletRechargeCheckout,
  createSubscriptionCheckout,
  isStripeConfigured,
  PRODUCTS,
  stripe,
} from "./config";

export const stripeRouter = router({
  // Verificar si Stripe está configurado
  isConfigured: publicProcedure.query(() => {
    return { configured: isStripeConfigured() };
  }),

  // Obtener productos disponibles
  getProducts: publicProcedure.query(() => {
    return {
      walletRecharge: PRODUCTS.WALLET_RECHARGE,
      subscriptionBasic: PRODUCTS.SUBSCRIPTION_BASIC,
      subscriptionPremium: PRODUCTS.SUBSCRIPTION_PREMIUM,
    };
  }),

  // Crear checkout para recarga de billetera
  createWalletRecharge: protectedProcedure
    .input(z.object({
      amount: z.number().min(20000).max(1000000), // 20,000 - 1,000,000 COP
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe no está configurado. Contacta al administrador.",
        });
      }

      const origin = ctx.req.headers.origin || "https://www.evgreen.lat";
      
      const result = await createWalletRechargeCheckout({
        userId: ctx.user.id.toString(),
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || "",
        amount: input.amount,
        currency: "cop",
        successUrl: `${origin}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/wallet?canceled=true`,
      });

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al crear la sesión de pago",
        });
      }

      return result;
    }),

  // Crear checkout para suscripción
  createSubscription: protectedProcedure
    .input(z.object({
      planId: z.enum(["basic", "premium"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe no está configurado. Contacta al administrador.",
        });
      }

      // Verificar si ya tiene suscripción activa
      const existingSub = await db.getUserSubscription(ctx.user.id);
      if (existingSub && existingSub.isActive && existingSub.tier !== "FREE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya tienes una suscripción activa. Cancela la actual antes de cambiar de plan.",
        });
      }

      const origin = ctx.req.headers.origin || "https://www.evgreen.lat";
      
      const result = await createSubscriptionCheckout({
        userId: ctx.user.id.toString(),
        userEmail: ctx.user.email || "",
        userName: ctx.user.name || "",
        planId: input.planId,
        successUrl: `${origin}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/subscription?canceled=true`,
      });

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al crear la sesión de suscripción",
        });
      }

      return result;
    }),

  // Obtener suscripción actual del usuario
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await db.getUserSubscription(ctx.user.id);
    return subscription;
  }),

  // Cancelar suscripción
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    if (!stripe) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Stripe no está configurado",
      });
    }

    const subscription = await db.getUserSubscription(ctx.user.id);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tienes una suscripción activa",
      });
    }

    try {
      // Cancelar en Stripe (al final del período actual)
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Actualizar en base de datos
      await db.updateUserSubscription(ctx.user.id, {
        status: "canceling",
      });

      return { success: true, message: "Tu suscripción se cancelará al final del período actual" };
    } catch (error) {
      console.error("[Stripe] Error canceling subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error al cancelar la suscripción",
      });
    }
  }),

  // Obtener historial de pagos
  getPaymentHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const transactions = await db.getWalletTransactions(ctx.user.id, input?.limit || 20);
      return transactions;
    }),

  // Crear portal de cliente para gestionar suscripción
  createCustomerPortal: protectedProcedure.mutation(async ({ ctx }) => {
    if (!stripe) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Stripe no está configurado",
      });
    }

    const wallet = await db.getUserWallet(ctx.user.id);
    if (!wallet || !wallet.stripeCustomerId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tienes un perfil de cliente en Stripe",
      });
    }

    const origin = ctx.req.headers.origin || "https://www.evgreen.lat";

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: wallet.stripeCustomerId,
        return_url: `${origin}/wallet`,
      });

      return { url: session.url };
    } catch (error) {
      console.error("[Stripe] Error creating customer portal:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error al crear el portal de cliente",
      });
    }
  }),
});
