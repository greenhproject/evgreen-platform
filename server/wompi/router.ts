/**
 * Router de Wompi para pagos en Colombia
 * 
 * Las llaves se leen dinámicamente desde platform_settings (BD).
 * Las transacciones se guardan en la tabla wompi_transactions.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  getWompiKeys,
  isWompiConfigured,
  generatePaymentReference,
  generateIntegritySignature,
  buildCheckoutUrl,
  getTransactionByReference,
  WOMPI_TRANSACTION_STATUS,
} from "./config";
import {
  createPaymentSource,
  getAcceptanceToken,
  processRecurringBilling,
} from "./recurring-billing";

export const wompiRouter = router({
  // ========================================================================
  // Verificar si Wompi está configurado
  // ========================================================================
  isConfigured: publicProcedure.query(async () => {
    const keys = await getWompiKeys();
    return {
      configured: !!keys,
      testMode: keys?.testMode ?? true,
      publicKey: keys?.publicKey ? keys.publicKey.substring(0, 20) + "..." : null,
    };
  }),

  // ========================================================================
  // Obtener llave pública para el widget del frontend
  // ========================================================================
  getPublicKey: publicProcedure.query(async () => {
    const keys = await getWompiKeys();
    return keys?.publicKey ?? null;
  }),

  // ========================================================================
  // Crear sesión de checkout para recarga de billetera
  // ========================================================================
  createWalletRecharge: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(10000).max(50000000), // Min $10,000 COP, Max $50M COP
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      const reference = generatePaymentReference("WLT");
      const amountInCents = input.amount * 100;
      const currency = "COP";

      // Generar firma de integridad
      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        keys.integritySecret
      );

      // Obtener URL de origen para redirección
      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      // Construir URL de checkout
      const checkoutUrl = buildCheckoutUrl({
        publicKey: keys.publicKey,
        reference,
        amountInCents,
        currency,
        signature,
        redirectUrl: `${origin}/wallet?payment=wompi&reference=${reference}`,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
      });

      // Guardar transacción pendiente en BD
      try {
        await db.createWompiTransaction({
          userId: ctx.user.id,
          reference,
          amountInCents,
          currency,
          type: "WALLET_RECHARGE",
          customerEmail: ctx.user.email || "",
          description: `Recarga de billetera - $${input.amount.toLocaleString()} COP`,
          integritySignature: signature,
        });
      } catch (err) {
        console.error("[Wompi] Error guardando transacción pendiente:", err);
        // No fallar si no se puede guardar, el webhook se encargará
      }

      return {
        checkoutUrl,
        reference,
      };
    }),

  // ========================================================================
  // Crear sesión de checkout para pago de carga
  // ========================================================================
  createChargingPayment: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        amount: z.number().min(1000), // Min $1,000 COP
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      const reference = generatePaymentReference("CHG");
      const amountInCents = input.amount * 100;
      const currency = "COP";

      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        keys.integritySecret
      );

      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const checkoutUrl = buildCheckoutUrl({
        publicKey: keys.publicKey,
        reference,
        amountInCents,
        currency,
        signature,
        redirectUrl: `${origin}/charging/payment?reference=${reference}&transaction=${input.transactionId}`,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
      });

      // Guardar transacción pendiente
      try {
        await db.createWompiTransaction({
          userId: ctx.user.id,
          reference,
          amountInCents,
          currency,
          type: "OTHER",
          customerEmail: ctx.user.email || "",
          description: `Pago de carga #${input.transactionId}`,
          integritySignature: signature,
        });
      } catch (err) {
        console.error("[Wompi] Error guardando transacción pendiente:", err);
      }

      return {
        checkoutUrl,
        reference,
      };
    }),

  // ========================================================================
  // Crear sesión de checkout para depósito de inversión
  // ========================================================================
  createInvestmentDeposit: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(100000), // Min $100,000 COP
        projectId: z.number().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      const reference = generatePaymentReference("INV");
      const amountInCents = input.amount * 100;
      const currency = "COP";

      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        keys.integritySecret
      );

      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const checkoutUrl = buildCheckoutUrl({
        publicKey: keys.publicKey,
        reference,
        amountInCents,
        currency,
        signature,
        redirectUrl: `${origin}/investors?payment=wompi&reference=${reference}`,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
      });

      try {
        await db.createWompiTransaction({
          userId: ctx.user.id,
          reference,
          amountInCents,
          currency,
          type: "INVESTMENT_DEPOSIT",
          customerEmail: ctx.user.email || "",
          description: input.description || `Depósito de inversión - $${input.amount.toLocaleString()} COP`,
          integritySignature: signature,
        });
      } catch (err) {
        console.error("[Wompi] Error guardando transacción pendiente:", err);
      }

      return {
        checkoutUrl,
        reference,
      };
    }),

  // ========================================================================
  // Consultar estado de transacción por referencia
  // ========================================================================
  checkPaymentStatus: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      try {
        const result = await getTransactionByReference(input.reference, keys);

        if (!result.data || result.data.length === 0) {
          return { found: false, status: null, transaction: null };
        }

        const tx = result.data[0];

        return {
          found: true,
          status: tx.status,
          transaction: {
            id: tx.id,
            reference: tx.reference,
            amount: tx.amount_in_cents / 100,
            currency: tx.currency,
            status: tx.status,
            paymentMethod: tx.payment_method_type,
            createdAt: tx.created_at,
            finalizedAt: tx.finalized_at,
          },
        };
      } catch (error) {
        console.error("[Wompi] Error consultando transacción:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error consultando estado del pago",
        });
      }
    }),

  // ========================================================================
  // Verificar y procesar pago completado (llamado desde frontend)
  // ========================================================================
  verifyAndProcessPayment: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        type: z.enum(["wallet_recharge", "charging_payment", "investment_deposit"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      try {
        const result = await getTransactionByReference(input.reference, keys);

        if (!result.data || result.data.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transacción no encontrada en Wompi",
          });
        }

        const tx = result.data[0];

        // Actualizar transacción en nuestra BD
        await db.updateWompiTransactionByReference(input.reference, {
          wompiTransactionId: tx.id,
          status: tx.status,
          paymentMethodType: tx.payment_method_type,
          processedAt: new Date(),
        });

        if (tx.status !== WOMPI_TRANSACTION_STATUS.APPROVED) {
          return {
            success: false,
            status: tx.status,
            message: `El pago no fue aprobado. Estado: ${tx.status}`,
          };
        }

        // Procesar según el tipo de pago
        if (input.type === "wallet_recharge") {
          const amount = tx.amount_in_cents / 100;

          const wallet = await db.getUserWallet(ctx.user.id);
          if (wallet) {
            const currentBalance = parseFloat(wallet.balance) || 0;
            const newBalance = currentBalance + amount;
            await db.createWalletTransaction({
              walletId: wallet.id,
              userId: ctx.user.id,
              type: "WOMPI_RECHARGE",
              amount: amount.toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              description: `Recarga Wompi: ${input.reference}`,
            });
            await db.updateWalletBalance(ctx.user.id, newBalance.toString());
          }

          return {
            success: true,
            status: tx.status,
            message: `Billetera recargada con $${amount.toLocaleString()} COP`,
            amount,
          };
        }

        return {
          success: true,
          status: tx.status,
          message: "Pago verificado exitosamente",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error("[Wompi] Error verificando pago:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error verificando el pago",
        });
      }
    }),

  // ========================================================================
  // Historial de transacciones del usuario
  // ========================================================================
  myTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      return db.getWompiTransactionsByUser(ctx.user.id, limit, offset);
    }),

  // ========================================================================
  // Crear checkout para suscripción mensual
  // ========================================================================
  createSubscriptionPayment: protectedProcedure
    .input(
      z.object({
        planId: z.enum(["basic", "premium"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      // Precios de suscripción
      const PLAN_PRICES: Record<string, number> = {
        basic: 18900,
        premium: 33900,
      };

      const amount = PLAN_PRICES[input.planId];
      if (!amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plan inválido" });
      }

      const reference = generatePaymentReference("SUB");
      const amountInCents = amount * 100;
      const currency = "COP";

      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        keys.integritySecret
      );

      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const checkoutUrl = buildCheckoutUrl({
        publicKey: keys.publicKey,
        reference,
        amountInCents,
        currency,
        signature,
        redirectUrl: `${origin}/wallet?payment=wompi&reference=${reference}&type=subscription&plan=${input.planId}`,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
      });

      // Guardar transacción pendiente
      try {
        await db.createWompiTransaction({
          userId: ctx.user.id,
          reference,
          amountInCents,
          currency,
          type: "SUBSCRIPTION",
          customerEmail: ctx.user.email || "",
          description: `Suscripción Plan ${input.planId === "premium" ? "Premium" : "Básico"} - ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount)}/mes`,
          integritySignature: signature,
        });
      } catch (err) {
        console.error("[Wompi] Error guardando transacción de suscripción:", err);
      }

      return {
        checkoutUrl,
        reference,
        planId: input.planId,
      };
    }),

  // ========================================================================
  // Verificar y activar suscripción después del pago
  // ========================================================================
  verifyAndActivateSubscription: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        planId: z.enum(["basic", "premium"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      try {
        const result = await getTransactionByReference(input.reference, keys);

        if (!result.data || result.data.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transacción no encontrada en Wompi",
          });
        }

        const tx = result.data[0];

        // Actualizar transacción en BD
        await db.updateWompiTransactionByReference(input.reference, {
          wompiTransactionId: tx.id,
          status: tx.status,
          paymentMethodType: tx.payment_method_type,
          processedAt: new Date(),
        });

        if (tx.status !== WOMPI_TRANSACTION_STATUS.APPROVED) {
          return {
            success: false,
            status: tx.status,
            message: `El pago no fue aprobado. Estado: ${tx.status}`,
          };
        }

        // Activar suscripción
        const PLAN_PRICES: Record<string, number> = {
          basic: 18900,
          premium: 33900,
        };

        await db.updateUserSubscription(ctx.user.id, {
          planId: input.planId,
          status: "active",
          monthlyAmountCents: (PLAN_PRICES[input.planId] || 0) * 100,
          lastPaymentDate: new Date(),
          lastPaymentReference: input.reference,
          cardBrand: tx.payment_method?.extra?.brand,
          cardLastFour: tx.payment_method?.extra?.last_four,
        });

        // Crear notificación in-app
        try {
          await db.createNotification({
            userId: ctx.user.id,
            title: "¡Suscripción activada!",
            message: `Tu plan ${input.planId === "premium" ? "Premium" : "Básico"} está activo. Disfruta de tus beneficios exclusivos.`,
            type: "PAYMENT",
            data: JSON.stringify({
              key: `sub-${input.reference}`,
              planId: input.planId,
              reference: input.reference,
            }),
          });
        } catch (notifErr) {
          console.warn("[Wompi] Error creando notificación de suscripción:", notifErr);
        }

        return {
          success: true,
          status: tx.status,
          message: `¡Plan ${input.planId === "premium" ? "Premium" : "Básico"} activado exitosamente!`,
          planId: input.planId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Wompi] Error verificando suscripción:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error verificando el pago de suscripción",
        });
      }
    }),

  // ========================================================================
  // Cancelar suscripción
  // ========================================================================
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await db.getUserSubscription(ctx.user.id);
    if (!subscription || !subscription.isActive || subscription.tier === "FREE") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tienes una suscripción activa",
      });
    }

    await db.cancelUserSubscription(ctx.user.id);

    // Notificación de cancelación
    try {
      await db.createNotification({
        userId: ctx.user.id,
        title: "Suscripción cancelada",
        message: "Tu suscripción ha sido cancelada. Puedes reactivarla en cualquier momento.",
        type: "PAYMENT",
        data: JSON.stringify({ key: `sub-cancel-${Date.now()}` }),
      });
    } catch (notifErr) {
      console.warn("[Wompi] Error creando notificación de cancelación:", notifErr);
    }

    return { success: true, message: "Suscripción cancelada exitosamente" };
  }),

  // ========================================================================
  // Obtener suscripción actual del usuario
  // ========================================================================
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserSubscription(ctx.user.id);
  }),

  // ========================================================================
  // Métodos de pago disponibles
  // ========================================================================
  getPaymentMethods: publicProcedure.query(() => {
    return [
      { id: "CARD", name: "Tarjeta de Crédito/Débito", description: "Visa, Mastercard, American Express", icon: "credit-card", enabled: true },
      { id: "PSE", name: "PSE", description: "Transferencia bancaria desde tu banco", icon: "building-2", enabled: true },
      { id: "NEQUI", name: "Nequi", description: "Paga desde tu cuenta Nequi", icon: "smartphone", enabled: true },
      { id: "BANCOLOMBIA_QR", name: "Bancolombia QR", description: "Escanea el código QR con tu app Bancolombia", icon: "qr-code", enabled: true },
      { id: "EFECTY", name: "Efecty", description: "Paga en efectivo en puntos Efecty", icon: "banknote", enabled: true },
    ];
  }),

  // ========================================================================
  // Obtener acceptance token de Wompi (para tokenización de tarjetas)
  // ========================================================================
  getAcceptanceToken: protectedProcedure.query(async () => {
    const result = await getAcceptanceToken();
    if (!result) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Wompi no está configurado",
      });
    }
    return result;
  }),

  // ========================================================================
  // Tokenizar tarjeta y crear payment source para cobros recurrentes
  // ========================================================================
  tokenizeCard: protectedProcedure
    .input(
      z.object({
        cardToken: z.string().min(1),
        acceptanceToken: z.string().min(1),
        personalAuthToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const keys = await getWompiKeys();
      if (!keys) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      // Crear payment source
      const paymentSource = await createPaymentSource({
        cardToken: input.cardToken,
        customerEmail: ctx.user.email || "",
        acceptanceToken: input.acceptanceToken,
        personalAuthToken: input.personalAuthToken,
      });

      if (!paymentSource) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear el método de pago. Verifica los datos de tu tarjeta.",
        });
      }

      // Guardar payment source en la suscripción del usuario
      await db.updateUserSubscription(ctx.user.id, {
        wompiPaymentSourceId: paymentSource.paymentSourceId,
        wompiCardToken: input.cardToken,
      });

      return {
        success: true,
        paymentSourceId: paymentSource.paymentSourceId,
        message: "Tarjeta guardada exitosamente para cobros recurrentes",
      };
    }),

  // ========================================================================
  // Ejecutar cobro recurrente manualmente (admin only)
  // ========================================================================
  runBillingManually: protectedProcedure.mutation(async ({ ctx }) => {
    // Solo admin puede ejecutar cobros manuales
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo administradores pueden ejecutar cobros manuales",
      });
    }

    const result = await processRecurringBilling();
    return result;
  }),
});
