/**
 * Router de Wompi para pagos en Colombia
 * 
 * Endpoints para:
 * - Crear sesiones de checkout
 * - Consultar estado de transacciones
 * - Recargar billetera con PSE/Nequi
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  isWompiConfigured,
  createWompiCheckout,
  generatePaymentReference,
  getTransactionStatus,
  getTransactionByReference,
  wompiConfig,
  WOMPI_TRANSACTION_STATUS,
} from "./config";

export const wompiRouter = router({
  // Verificar si Wompi está configurado
  isConfigured: publicProcedure.query(() => {
    return {
      configured: isWompiConfigured(),
      testMode: wompiConfig.testMode,
      publicKey: wompiConfig.publicKey ? wompiConfig.publicKey.substring(0, 20) + "..." : null,
    };
  }),

  // Obtener llave pública para el frontend
  getPublicKey: publicProcedure.query(() => {
    if (!isWompiConfigured()) {
      return null;
    }
    return wompiConfig.publicKey;
  }),

  // Crear sesión de checkout para recarga de billetera
  createWalletRecharge: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(10000).max(50000000), // Min $10,000 COP, Max $50,000,000 COP
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isWompiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      const reference = generatePaymentReference("WLT");
      const amountInCents = input.amount * 100; // Convertir a centavos

      // Obtener URL de origen para redirección
      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const checkout = await createWompiCheckout({
        reference,
        amountInCents,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
        redirectUrl: `${origin}/wallet?payment=wompi&reference=${reference}`,
      });

      if (!checkout) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error creando sesión de pago con Wompi",
        });
      }

      // Guardar referencia pendiente en base de datos
      // TODO: Crear tabla de transacciones Wompi pendientes

      return {
        checkoutUrl: checkout.checkoutUrl,
        reference: checkout.reference,
      };
    }),

  // Crear sesión de checkout para pago de carga
  createChargingPayment: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        amount: z.number().min(1000), // Min $1,000 COP
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isWompiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado. Contacta al administrador.",
        });
      }

      const reference = generatePaymentReference("CHG");
      const amountInCents = input.amount * 100;

      const origin = (ctx.req.headers.origin as string) || "https://evgreen.lat";

      const checkout = await createWompiCheckout({
        reference,
        amountInCents,
        customerEmail: ctx.user.email || "",
        customerName: ctx.user.name ?? undefined,
        redirectUrl: `${origin}/charging/payment?reference=${reference}&transaction=${input.transactionId}`,
      });

      if (!checkout) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error creando sesión de pago con Wompi",
        });
      }

      return {
        checkoutUrl: checkout.checkoutUrl,
        reference: checkout.reference,
      };
    }),

  // Consultar estado de transacción por referencia
  checkPaymentStatus: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
      })
    )
    .query(async ({ input }) => {
      if (!isWompiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      try {
        const result = await getTransactionByReference(input.reference);
        
        if (!result.data || result.data.length === 0) {
          return {
            found: false,
            status: null,
            transaction: null,
          };
        }

        const transaction = result.data[0];
        
        return {
          found: true,
          status: transaction.status,
          transaction: {
            id: transaction.id,
            reference: transaction.reference,
            amount: transaction.amount_in_cents / 100,
            currency: transaction.currency,
            status: transaction.status,
            paymentMethod: transaction.payment_method_type,
            createdAt: transaction.created_at,
            finalizedAt: transaction.finalized_at,
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

  // Verificar y procesar pago completado
  verifyAndProcessPayment: protectedProcedure
    .input(
      z.object({
        reference: z.string(),
        type: z.enum(["wallet_recharge", "charging_payment"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isWompiConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wompi no está configurado",
        });
      }

      try {
        const result = await getTransactionByReference(input.reference);
        
        if (!result.data || result.data.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transacción no encontrada",
          });
        }

        const transaction = result.data[0];

        if (transaction.status !== WOMPI_TRANSACTION_STATUS.APPROVED) {
          return {
            success: false,
            status: transaction.status,
            message: `El pago no fue aprobado. Estado: ${transaction.status}`,
          };
        }

        // Procesar según el tipo de pago
        if (input.type === "wallet_recharge") {
          const amount = transaction.amount_in_cents / 100;
          
          // Recargar billetera del usuario
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
            // Actualizar balance de la billetera
            await db.updateWalletBalance(ctx.user.id, newBalance.toString());
          }
          
          return {
            success: true,
            status: transaction.status,
            message: `Billetera recargada con $${amount.toLocaleString()} COP`,
            amount,
          };
        }

        // Para pagos de carga, el webhook debería manejar esto
        return {
          success: true,
          status: transaction.status,
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

  // Obtener métodos de pago disponibles
  getPaymentMethods: publicProcedure.query(() => {
    return [
      {
        id: "CARD",
        name: "Tarjeta de Crédito/Débito",
        description: "Visa, Mastercard, American Express",
        icon: "credit-card",
        enabled: true,
      },
      {
        id: "PSE",
        name: "PSE",
        description: "Transferencia bancaria desde tu banco",
        icon: "building-2",
        enabled: true,
      },
      {
        id: "NEQUI",
        name: "Nequi",
        description: "Paga desde tu cuenta Nequi",
        icon: "smartphone",
        enabled: true,
      },
      {
        id: "BANCOLOMBIA_QR",
        name: "Bancolombia QR",
        description: "Escanea el código QR con tu app Bancolombia",
        icon: "qr-code",
        enabled: true,
      },
      {
        id: "EFECTY",
        name: "Efecty",
        description: "Paga en efectivo en puntos Efecty",
        icon: "banknote",
        enabled: true,
      },
    ];
  }),
});
