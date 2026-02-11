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
  getTransactionStatus,
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

          // Guardar datos de tarjeta si es pago con CARD
          if (tx.payment_method_type === "CARD") {
            const cardBrand = tx.payment_method?.brand || tx.payment_method?.extra?.brand;
            const cardLastFour = tx.payment_method?.last_four || tx.payment_method?.extra?.last_four;
            if (cardBrand && cardLastFour) {
              try {
                await db.updateUserSubscription(ctx.user.id, {
                  cardBrand,
                  cardLastFour,
                });
                console.log(`[Wompi] Tarjeta guardada desde verify: ${cardBrand} ****${cardLastFour}`);
              } catch (cardErr) {
                console.warn("[Wompi] Error guardando tarjeta desde verify:", cardErr);
              }
            }
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
          cardBrand: tx.payment_method?.brand || tx.payment_method?.extra?.brand,
          cardLastFour: tx.payment_method?.last_four || tx.payment_method?.extra?.last_four,
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
        cardLastFour: z.string().min(4).max(4).optional(),
        cardBrand: z.string().optional(),
        cardHolderName: z.string().optional(),
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

      // Detectar marca de tarjeta por BIN (primeros dígitos) si no viene del frontend
      let cardBrand = input.cardBrand || "CARD";

      // Guardar payment source + datos de tarjeta en la suscripción del usuario
      await db.updateUserSubscription(ctx.user.id, {
        wompiPaymentSourceId: paymentSource.paymentSourceId,
        wompiCardToken: input.cardToken,
        cardBrand: cardBrand,
        cardLastFour: input.cardLastFour || "",
        cardHolderName: input.cardHolderName || "",
      });

      console.log(`[Wompi] Tarjeta tokenizada para usuario ${ctx.user.id}: ${cardBrand} ****${input.cardLastFour || "????"}, PS: ${paymentSource.paymentSourceId}`);

      return {
        success: true,
        paymentSourceId: paymentSource.paymentSourceId,
        cardBrand,
        cardLastFour: input.cardLastFour || "",
        message: "Tarjeta guardada exitosamente para cobros recurrentes",
      };
    }),

  // ========================================================================
  // Recarga rápida con tarjeta inscrita (sin checkout)
  // ========================================================================
  quickRecharge: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(10000).max(50000000),
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

      // Verificar que el usuario tenga tarjeta inscrita con payment source
      const subscription = await db.getUserSubscription(ctx.user.id);
      if (!subscription?.wompiPaymentSourceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No tienes una tarjeta inscrita. Realiza una recarga por el checkout de Wompi primero.",
        });
      }

      const reference = generatePaymentReference("QRC");
      const amountInCents = input.amount * 100;
      const currency = "COP";

      // Obtener acceptance token (obligatorio según API de Wompi)
      const acceptanceData = await getAcceptanceToken();
      if (!acceptanceData?.acceptanceToken) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo obtener el token de aceptación de Wompi. Intenta de nuevo.",
        });
      }

      // Generar firma de integridad (obligatoria según API de Wompi)
      const signature = generateIntegritySignature(
        reference,
        amountInCents,
        currency,
        keys.integritySecret
      );

      console.log(`[Wompi] Recarga rápida: $${input.amount} para usuario ${ctx.user.id} con payment source ${subscription.wompiPaymentSourceId}`);

      try {
        // Crear transacción directa con payment source en Wompi
        const response = await fetch(`${keys.apiUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keys.privateKey}`,
          },
          body: JSON.stringify({
            amount_in_cents: amountInCents,
            currency,
            payment_source_id: parseInt(subscription.wompiPaymentSourceId),
            reference,
            customer_email: ctx.user.email || "",
            signature,
            acceptance_token: acceptanceData.acceptanceToken,
            payment_method: {
              type: "CARD",
              installments: 1,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[Wompi] Error en recarga rápida (${response.status}):`, errorBody);
          
          // Intentar parsear el error para dar mejor feedback
          let errorMessage = "Error procesando el cobro. Intenta de nuevo o usa otro método de pago.";
          try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error?.messages) {
              const msgs = Object.values(errorJson.error.messages).flat();
              if (msgs.length > 0) errorMessage = `Error Wompi: ${msgs.join(", ")}`;
            } else if (errorJson.error?.reason) {
              errorMessage = `Error Wompi: ${errorJson.error.reason}`;
            }
          } catch (_) { /* usar mensaje genérico */ }
          
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorMessage,
          });
        }

        const result = await response.json();
        const tx = result.data;

        console.log(`[Wompi] Recarga rápida - Transacción: ${tx.id}, Estado: ${tx.status}`);

        // Guardar transacción en BD
        try {
          await db.createWompiTransaction({
            userId: ctx.user.id,
            reference,
            amountInCents,
            currency,
            type: "WALLET_RECHARGE",
            customerEmail: ctx.user.email || "",
            description: `Recarga rápida con tarjeta - $${input.amount.toLocaleString()} COP`,
            integritySignature: "",
          });
          await db.updateWompiTransactionByReference(reference, {
            wompiTransactionId: tx.id,
            status: tx.status,
            paymentMethodType: tx.payment_method_type || "CARD",
            processedAt: new Date(),
          });
        } catch (dbErr) {
          console.warn("[Wompi] Error guardando transacción de recarga rápida:", dbErr);
        }

        // Si la transacción está PENDING, esperar 2s y volver a consultar
        // Muchas transacciones con payment source se aprueban en <2s
        let finalStatus = tx.status;
        let finalTxId = tx.id;
        if (tx.status === "PENDING" && tx.id) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const recheckResult = await getTransactionStatus(tx.id, keys);
            if (recheckResult?.data?.status) {
              finalStatus = recheckResult.data.status;
              console.log(`[Wompi] Recarga r\u00e1pida - Recheck: ${finalStatus}`);
              if (finalStatus !== "PENDING") {
                await db.updateWompiTransactionByReference(reference, {
                  status: finalStatus,
                  processedAt: new Date(),
                });
              }
            }
          } catch (recheckErr) {
            console.warn("[Wompi] Error en recheck de transacci\u00f3n:", recheckErr);
          }
        }

        // Si fue aprobada (inmediatamente o después del recheck), acreditar la billetera
        if (finalStatus === "APPROVED") {
          const wallet = await db.getUserWallet(ctx.user.id);
          if (wallet) {
            const currentBalance = parseFloat(wallet.balance) || 0;
            const newBalance = currentBalance + input.amount;
            await db.createWalletTransaction({
              walletId: wallet.id,
              userId: ctx.user.id,
              type: "WOMPI_RECHARGE",
              amount: input.amount.toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              description: `Recarga rápida con tarjeta ****${subscription.cardLastFour || ""}: ${reference}`,
            });
            await db.updateWalletBalance(ctx.user.id, newBalance.toString());
          }

          // Notificación
          try {
            await db.createNotification({
              userId: ctx.user.id,
              title: "Recarga exitosa",
              message: `Se acreditaron $${input.amount.toLocaleString()} COP a tu billetera con tu tarjeta ****${subscription.cardLastFour || ""}.`,
              type: "PAYMENT",
              data: JSON.stringify({
                key: `quick-recharge-${reference}`,
                amount: input.amount,
                reference,
              }),
            });
          } catch (notifErr) {
            console.warn("[Wompi] Error creando notificación de recarga rápida:", notifErr);
          }

          return {
            success: true,
            status: "APPROVED",
            message: `¡Billetera recargada con $${input.amount.toLocaleString()} COP!`,
            amount: input.amount,
            reference,
          };
        } else if (finalStatus === "PENDING") {
          return {
            success: true,
            status: "PENDING",
            message: "El cobro est\u00e1 siendo procesado. Tu billetera se actualizar\u00e1 en unos momentos.",
            amount: input.amount,
            reference,
          };
        } else {
          return {
            success: false,
            status: finalStatus,
            message: `El cobro no fue aprobado (${finalStatus}). Intenta de nuevo o usa otro m\u00e9todo de pago.`,
            reference,
          };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Wompi] Error en recarga rápida:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error procesando la recarga. Intenta de nuevo.",
        });
      }
    }),

  // ========================================================================
  // Eliminar tarjeta inscrita
  // ========================================================================
  removeCard: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await db.getUserSubscription(ctx.user.id);
    if (!subscription || (!subscription.cardLastFour && !subscription.wompiPaymentSourceId)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tienes una tarjeta inscrita",
      });
    }

    // Limpiar datos de tarjeta de la suscripción
    await db.updateUserSubscription(ctx.user.id, {
      wompiPaymentSourceId: null,
      wompiCardToken: null,
      cardBrand: "",
      cardLastFour: "",
      cardHolderName: "",
    });

    console.log(`[Wompi] Tarjeta eliminada para usuario ${ctx.user.id}`);

    // Notificación
    try {
      await db.createNotification({
        userId: ctx.user.id,
        title: "Tarjeta eliminada",
        message: "Tu tarjeta ha sido desvinculada exitosamente. Puedes inscribir una nueva en cualquier momento.",
        type: "SYSTEM",
        data: JSON.stringify({ key: `card-removed-${Date.now()}` }),
      });
    } catch (notifErr) {
      console.warn("[Wompi] Error creando notificación de eliminación de tarjeta:", notifErr);
    }

    return {
      success: true,
      message: "Tarjeta eliminada exitosamente",
    };
  }),

  // ========================================================================
  // Consultar estado de recarga rápida PENDING (polling)
  // ========================================================================
  checkQuickRechargeStatus: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const localTx = await db.getWompiTransactionByReference(input.reference);
      if (!localTx || localTx.userId !== ctx.user.id) {
        return { status: "NOT_FOUND", credited: false };
      }

      // Si ya está aprobada en nuestra BD, verificar si ya se acreditó
      if (localTx.status === "APPROVED") {
        return { status: "APPROVED", credited: true };
      }

      // Si sigue PENDING, consultar Wompi directamente
      if (localTx.status === "PENDING") {
        try {
          const keys = await getWompiKeys();
          if (keys && localTx.wompiTransactionId) {
            const txDetail = await getTransactionStatus(localTx.wompiTransactionId, keys);
            const wompiStatus = txDetail?.data?.status;

            if (wompiStatus === "APPROVED") {
              // Actualizar en BD
              await db.updateWompiTransactionByReference(input.reference, {
                status: "APPROVED",
                processedAt: new Date(),
              });

              // Acreditar billetera si aún no se ha hecho
              const amount = localTx.amountInCents / 100;
              const recentTxs = await db.getWalletTransactionsByUserId(ctx.user.id, 20);
              const alreadyCredited = recentTxs.some(t => t.description?.includes(input.reference));

              if (!alreadyCredited) {
                await db.addUserWalletBalance(ctx.user.id, amount);
                const wallet = await db.getUserWallet(ctx.user.id);
                const newBalance = wallet ? parseFloat(wallet.balance) : amount;

                await db.createWalletTransaction({
                  walletId: wallet?.id || 0,
                  userId: ctx.user.id,
                  type: "WOMPI_RECHARGE",
                  amount: amount.toString(),
                  balanceBefore: (newBalance - amount).toString(),
                  balanceAfter: newBalance.toString(),
                  description: `Recarga rápida con tarjeta: ${input.reference}`,
                });

                try {
                  const formatCOP = (n: number) =>
                    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
                  await db.createNotification({
                    userId: ctx.user.id,
                    title: "¡Recarga exitosa!",
                    message: `Tu billetera fue recargada con ${formatCOP(amount)}. Nuevo saldo: ${formatCOP(newBalance)}.`,
                    type: "PAYMENT",
                    data: JSON.stringify({ key: `quick-recharge-${input.reference}`, amount, reference: input.reference }),
                  });
                } catch (notifErr) {
                  console.warn("[Wompi] Error creando notificación:", notifErr);
                }
              }

              return { status: "APPROVED", credited: true };
            } else if (wompiStatus === "DECLINED" || wompiStatus === "ERROR" || wompiStatus === "VOIDED") {
              await db.updateWompiTransactionByReference(input.reference, { status: wompiStatus });
              return { status: wompiStatus, credited: false };
            }
          }
        } catch (err) {
          console.warn("[Wompi] Error consultando estado de transacción:", err);
        }
      }

      return { status: localTx.status || "PENDING", credited: false };
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

  // ========================================================================
  // Reconciliar transacciones pendientes (admin only)
  // Verifica en Wompi las transacciones QRC-/ATC- que quedaron PENDING
  // y las acredita si ya fueron aprobadas
  // ========================================================================
  reconcilePendingTransactions: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo administradores pueden reconciliar transacciones",
      });
    }

    const keys = await getWompiKeys();
    if (!keys) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Wompi no est\u00e1 configurado",
      });
    }

    // Buscar transacciones PENDING de tipo QRC y ATC
    const pendingTxs = await db.getPendingWompiTransactions();
    const qrcAtcPending = pendingTxs.filter(
      (tx) => tx.reference.startsWith("QRC-") || tx.reference.startsWith("ATC-")
    );

    const results: { reference: string; oldStatus: string; newStatus: string; credited: boolean; amount: number }[] = [];

    for (const tx of qrcAtcPending) {
      try {
        if (!tx.wompiTransactionId) {
          results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: "NO_WOMPI_ID", credited: false, amount: tx.amountInCents / 100 });
          continue;
        }

        const txDetail = await getTransactionStatus(tx.wompiTransactionId, keys);
        const wompiStatus = txDetail?.data?.status;

        if (wompiStatus === "APPROVED") {
          // Actualizar estado en BD
          await db.updateWompiTransactionByReference(tx.reference, {
            status: "APPROVED",
            processedAt: new Date(),
          });

          // Verificar si ya fue acreditada
          const amount = tx.amountInCents / 100;
          const recentTxs = await db.getWalletTransactionsByUserId(tx.userId, 50);
          const alreadyCredited = recentTxs.some(t => t.description?.includes(tx.reference));

          if (!alreadyCredited) {
            await db.addUserWalletBalance(tx.userId, amount);
            const wallet = await db.getUserWallet(tx.userId);
            const newBalance = wallet ? parseFloat(wallet.balance) : amount;

            await db.createWalletTransaction({
              walletId: wallet?.id || 0,
              userId: tx.userId,
              type: "WOMPI_RECHARGE",
              amount: amount.toString(),
              balanceBefore: (newBalance - amount).toString(),
              balanceAfter: newBalance.toString(),
              description: `Reconciliaci\u00f3n: ${tx.reference}`,
            });

            const formatCOP = (n: number) =>
              new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

            await db.createNotification({
              userId: tx.userId,
              title: "Recarga acreditada",
              message: `Se acreditaron ${formatCOP(amount)} a tu billetera (transacci\u00f3n ${tx.reference}).`,
              type: "PAYMENT",
              data: JSON.stringify({ key: `reconcile-${tx.reference}`, amount, reference: tx.reference }),
            });

            results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: "APPROVED", credited: true, amount });
          } else {
            results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: "APPROVED", credited: false, amount });
          }
        } else if (wompiStatus === "DECLINED" || wompiStatus === "ERROR" || wompiStatus === "VOIDED") {
          await db.updateWompiTransactionByReference(tx.reference, { status: wompiStatus });
          results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: wompiStatus, credited: false, amount: tx.amountInCents / 100 });
        } else {
          results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: wompiStatus || "STILL_PENDING", credited: false, amount: tx.amountInCents / 100 });
        }
      } catch (err) {
        console.error(`[Reconcile] Error procesando ${tx.reference}:`, err);
        results.push({ reference: tx.reference, oldStatus: tx.status || "PENDING", newStatus: "ERROR", credited: false, amount: tx.amountInCents / 100 });
      }
    }

    const totalCredited = results.filter(r => r.credited).reduce((sum, r) => sum + r.amount, 0);
    console.log(`[Reconcile] Procesadas ${results.length} transacciones. Total acreditado: $${totalCredited}`);

    return {
      processed: results.length,
      credited: results.filter(r => r.credited).length,
      totalCreditedAmount: totalCredited,
      details: results,
    };
  }),
});
