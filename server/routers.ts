import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { aiRouter } from "./ai/ai-router";
import { stripeRouter } from "./stripe/router";
import { wompiRouter } from "./wompi/router";
import { ocppRouter } from "./ocpp/ocpp-router";
import { chargingRouter } from "./charging/charging-router";
import { pushRouter } from "./push/push-router";
import { generateExcelReport, generatePDFReport } from "./reports/export-transactions";
import { sendBroadcastNotification, getNotificationStats, getBroadcastHistory } from "./notifications/broadcast-service";
import { checkAndNotifyMilestones } from "./crowdfunding/progress-notifications";
import { eventRouter } from "./event/event-router";

// ============================================================================
// ROLE-BASED PROCEDURES
// ============================================================================

// Procedimiento para administradores (staff y admin)
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de administrador.",
    });
  }
  return next({ ctx });
});

// Procedimiento para técnicos
const technicianProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "technician" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de técnico.",
    });
  }
  return next({ ctx });
});

// Procedimiento para inversionistas
const investorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "investor" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de inversionista.",
    });
  }
  return next({ ctx });
});

// ============================================================================
// AUTH ROUTER
// ============================================================================

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      avatarUrl: z.string().optional(),
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      bankAccount: z.string().optional(),
      bankName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      return { success: true };
    }),
});

// ============================================================================
// USERS ROUTER (Admin only)
// ============================================================================

const usersRouter = router({
  list: adminProcedure
    .input(z.object({
      role: z.enum(["staff", "technician", "investor", "user", "admin"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAllUsers(input?.role);
    }),
  
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getUserById(input.id);
    }),
  
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["staff", "technician", "investor", "user", "admin"]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Proteger la cuenta maestra
      const user = await db.getUserById(input.userId);
      if (user?.email === "greenhproject@gmail.com") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No se puede modificar el rol de la cuenta maestra.",
        });
      }
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),
  
  update: adminProcedure
    .input(z.object({
      userId: z.number(),
      data: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.boolean().optional(),
        companyName: z.string().optional(),
        taxId: z.string().optional(),
        bankAccount: z.string().optional(),
        bankName: z.string().optional(),
        technicianLicense: z.string().optional(),
        assignedRegion: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, input.data);
      return { success: true };
    }),
    
  // Usuario: regenerar su propio idTag
  regenerateMyIdTag: protectedProcedure
    .mutation(async ({ ctx }) => {
      const newIdTag = await db.regenerateUserIdTag(ctx.user.id);
      if (!newIdTag) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo regenerar el idTag",
        });
      }
      return { idTag: newIdTag };
    }),

  // Admin: eliminar usuario
  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      // Proteger la cuenta maestra
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      }
      if (user.email === "greenhproject@gmail.com") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No se puede eliminar la cuenta maestra.",
        });
      }
      await db.deleteUser(input.userId);
      return { success: true };
    }),

  // Admin: obtener billetera de un usuario
  getUserWallet: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const wallet = await db.getWalletByUserId(input.userId);
      if (!wallet) {
        return { balance: 0, currency: "COP", walletId: null };
      }
      return {
        balance: parseFloat(wallet.balance?.toString() || "0"),
        currency: wallet.currency || "COP",
        walletId: wallet.id,
      };
    }),

  // Admin: obtener historial de transacciones de billetera de un usuario
  getUserWalletTransactions: adminProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(200).optional(),
    }))
    .query(async ({ input }) => {
      const transactions = await db.getWalletTransactionsByUserId(input.userId, input.limit || 50);
      return transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount?.toString() || "0"),
        balanceBefore: parseFloat(tx.balanceBefore?.toString() || "0"),
        balanceAfter: parseFloat(tx.balanceAfter?.toString() || "0"),
        status: tx.status,
        description: tx.description || "",
        createdAt: tx.createdAt,
      }));
    }),

  // Admin: ajustar saldo de billetera manualmente
  adjustWalletBalance: adminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number(), // Positivo para agregar, negativo para descontar
      reason: z.string().min(3, "Debe indicar un motivo"),
      type: z.enum(["credit", "debit", "refund"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { userId, amount, reason, type } = input;
      
      // Obtener o crear billetera
      let wallet = await db.getWalletByUserId(userId);
      if (!wallet) {
        await db.createWallet({ userId, balance: "0", currency: "COP" });
        wallet = await db.getWalletByUserId(userId);
        if (!wallet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la billetera" });
      }
      
      const currentBalance = parseFloat(wallet.balance?.toString() || "0");
      const adjustAmount = type === "debit" ? -Math.abs(amount) : Math.abs(amount);
      const newBalance = currentBalance + adjustAmount;
      
      if (newBalance < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente. Saldo actual: $${currentBalance.toLocaleString()} COP`,
        });
      }
      
      // Actualizar saldo
      await db.updateWalletBalance(userId, newBalance.toString());
      
      // Registrar transacción
      const txType = type === "credit" ? "ADMIN_CREDIT" : type === "refund" ? "ADMIN_REFUND" : "ADMIN_DEBIT";
      await db.createWalletTransaction({
        walletId: wallet.id,
        userId,
        type: txType,
        amount: adjustAmount.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        status: "COMPLETED",
        description: `[Admin: ${ctx.user.name || ctx.user.email}] ${reason}`,
      });
      
      // Crear notificación para el usuario
      const user = await db.getUserById(userId);
      const typeLabel = type === "credit" ? "Crédito agregado" : type === "refund" ? "Reembolso" : "Débito";
      const amountFormatted = Math.abs(adjustAmount).toLocaleString("es-CO");
      await db.createNotification({
        userId,
        title: `💰 ${typeLabel} en tu billetera`,
        message: `Se ha realizado un ajuste de ${type === "debit" ? "-" : "+"}$${amountFormatted} COP en tu billetera. Nuevo saldo: $${newBalance.toLocaleString("es-CO")} COP. Motivo: ${reason}`,
        type: "PAYMENT",
        isRead: false,
      });
      
      return {
        success: true,
        previousBalance: currentBalance,
        newBalance,
        adjustment: adjustAmount,
      };
    }),

  // Admin: actualizar usuario completo (incluyendo email y rol)
  updateFull: adminProcedure
    .input(z.object({
      userId: z.number(),
      data: z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["staff", "technician", "investor", "user", "admin"]).optional(),
        isActive: z.boolean().optional(),
        companyName: z.string().optional(),
        taxId: z.string().optional(),
        bankAccount: z.string().optional(),
        bankName: z.string().optional(),
        technicianLicense: z.string().optional(),
        assignedRegion: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      // Proteger la cuenta maestra de cambios de rol
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      }
      if (user.email === "greenhproject@gmail.com" && input.data.role && input.data.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No se puede modificar el rol de la cuenta maestra.",
        });
      }
      await db.updateUser(input.userId, input.data);
      return { success: true };
    }),
});

// ============================================================================
// STATIONS ROUTER
// ============================================================================

const stationsRouter = router({
  // Público: listar estaciones activas para el mapa
  listPublic: publicProcedure
    .input(z.object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      radiusKm: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      let stations;
      if (input?.lat && input?.lng) {
        stations = await db.getStationsNearLocation(input.lat, input.lng, input.radiusKm || 10);
      } else {
        stations = await db.getAllChargingStations({ isActive: true, isPublic: true });
      }
      
      // Agregar tarifa activa y EVSEs a cada estación
      const stationsWithData = await Promise.all(
        stations.map(async (station: any) => {
          const tariff = await db.getActiveTariffByStationId(station.id);
          const evses = await db.getEvsesByStationId(station.id);
          return {
            ...station,
            evses,
            pricePerKwh: tariff?.pricePerKwh || "1200",
            reservationFee: tariff?.reservationFee || "5000",
            overstayPenaltyPerMin: tariff?.overstayPenaltyPerMinute || "500",
            connectionFee: tariff?.pricePerSession || "2000",
            tariffId: tariff?.id,
          };
        })
      );
      
      return stationsWithData;
    }),
  
  // Admin: listar todas las estaciones
  listAll: adminProcedure.query(async () => {
    const stations = await db.getAllChargingStations();
    // Agregar evses a cada estación
    const stationsWithEvses = await Promise.all(
      stations.map(async (station: any) => {
        const evses = await db.getEvsesByStationId(station.id);
        return { ...station, evses };
      })
    );
    return stationsWithEvses;
  }),
  
  // Inversionista: listar sus estaciones con tarifas y EVSEs
  listOwned: investorProcedure.query(async ({ ctx }) => {
    const stations = await db.getAllChargingStations({ ownerId: ctx.user.id });
    
    // Enriquecer con tarifas y EVSEs
    const enrichedStations = await Promise.all(
      stations.map(async (station) => {
        const tariff = await db.getActiveTariffByStationId(station.id);
        const evses = await db.getEvsesByStationId(station.id);
        
        return {
          ...station,
          tariff: tariff ? {
            pricePerKwh: tariff.pricePerKwh?.toString() || "1200",
            reservationFee: tariff.reservationFee?.toString() || "5000",
            idleFeePerMin: tariff.overstayPenaltyPerMinute?.toString() || "500",
            connectionFee: tariff.pricePerSession?.toString() || "2000",
            autoPricing: tariff.autoPricing || false,
          } : undefined,
          evses: evses.map(e => ({
            id: e.id,
            connectorId: e.connectorId,
            connectorType: e.connectorType,
            powerKw: e.powerKw?.toString() || "22",
            status: e.status,
          })),
        };
      })
    );
    
    return enrichedStations;
  }),
  
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const station = await db.getChargingStationById(input.id);
      if (!station) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }
      // Verificar acceso
      if (ctx.user.role === "investor" && station.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta estación" });
      }
      return station;
    }),
  
  create: adminProcedure
    .input(z.object({
      ownerId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      address: z.string(),
      city: z.string(),
      department: z.string().optional(),
      latitude: z.string(),
      longitude: z.string(),
      ocppIdentity: z.string().optional(),
      operatingHours: z.any().optional(),
      amenities: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createChargingStation({
        ...input,
        country: "Colombia",
      });
      return { id };
    }),
  
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        department: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        operatingHours: z.any().optional(),
        amenities: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const station = await db.getChargingStationById(input.id);
      if (!station) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }
      // Solo admin o el dueño pueden actualizar
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && station.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para modificar esta estación" });
      }
      await db.updateChargingStation(input.id, input.data);
      return { success: true };
    }),
  
  // Obtener EVSEs de una estación
  getEvses: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      return db.getEvsesByStationId(input.stationId);
    }),
  
  // Eliminar estación (solo admin)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteChargingStation(input.id);
      return { success: true };
    }),
});

// ============================================================================
// EVSE ROUTER
// ============================================================================

const evseRouter = router({
  create: adminProcedure
    .input(z.object({
      stationId: z.number(),
      evseIdLocal: z.number(),
      connectorId: z.number().optional(),
      connectorType: z.enum(["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"]),
      chargeType: z.enum(["AC", "DC"]),
      powerKw: z.string(),
      maxVoltage: z.number().optional(),
      maxAmperage: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createEvse(input);
      return { id };
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        connectorType: z.enum(["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"]).optional(),
        chargeType: z.enum(["AC", "DC"]).optional(),
        powerKw: z.string().optional(),
        maxVoltage: z.number().optional(),
        maxAmperage: z.number().optional(),
        isActive: z.boolean().optional(),
        status: z.enum(["AVAILABLE", "UNAVAILABLE", "FAULTED"]).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateEvse(input.id, input.data);
      return { success: true };
    }),
  
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteEvse(input.id);
      return { success: true };
    }),
  
  updateStatus: technicianProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum([
        "AVAILABLE", "PREPARING", "CHARGING", "SUSPENDED_EVSE",
        "SUSPENDED_EV", "FINISHING", "RESERVED", "UNAVAILABLE", "FAULTED"
      ]),
    }))
    .mutation(async ({ input }) => {
      await db.updateEvseStatus(input.id, input.status);
      return { success: true };
    }),
  
  getAvailable: publicProcedure
    .input(z.object({
      connectorType: z.enum(["TYPE_2", "CCS_2", "CHADEMO", "TYPE_1"]).optional(),
      chargeType: z.enum(["AC", "DC"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAvailableEvses(input);
    }),
});

// ============================================================================
// TARIFFS ROUTER
// ============================================================================

const tariffsRouter = router({
  getByStation: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      return db.getTariffsByStationId(input.stationId);
    }),
  
  getActive: publicProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      return db.getActiveTariffByStationId(input.stationId);
    }),
  
  create: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      pricePerKwh: z.string(),
      pricePerMinute: z.string().optional(),
      pricePerSession: z.string().optional(),
      reservationFee: z.string().optional(),
      noShowPenalty: z.string().optional(),
      overstayPenaltyPerMinute: z.string().optional(),
      overstayGracePeriodMinutes: z.number().optional(),
      timeBasedPricing: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verificar que el usuario sea dueño de la estación o admin
      const station = await db.getChargingStationById(input.stationId);
      if (!station) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && station.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para crear tarifas en esta estación" });
      }
      
      // Desactivar tarifas anteriores
      const existingTariffs = await db.getTariffsByStationId(input.stationId);
      for (const tariff of existingTariffs) {
        if (tariff.isActive) {
          await db.updateTariff(tariff.id, { isActive: false });
        }
      }
      
      const id = await db.createTariff({ ...input, isActive: true });
      return { id };
    }),
  
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        pricePerKwh: z.string().optional(),
        pricePerMinute: z.string().optional(),
        pricePerSession: z.string().optional(),
        reservationFee: z.string().optional(),
        noShowPenalty: z.string().optional(),
        overstayPenaltyPerMinute: z.string().optional(),
        overstayGracePeriodMinutes: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const tariff = await db.getTariffById(input.id);
      if (!tariff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarifa no encontrada" });
      }
      const station = await db.getChargingStationById(tariff.stationId);
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && station?.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para modificar esta tarifa" });
      }
      await db.updateTariff(input.id, input.data);
      return { success: true };
    }),

  // Actualizar tarifa por estación (para inversionistas)
  updateByStation: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      pricePerKwh: z.number(),
      reservationFee: z.number(),
      idleFeePerMin: z.number(),
      connectionFee: z.number(),
      autoPricing: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const station = await db.getChargingStationById(input.stationId);
      if (!station) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && station.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para modificar esta estación" });
      }
      
      // Buscar tarifa activa de la estación
      const tariff = await db.getActiveTariffByStationId(input.stationId);
      
      if (tariff) {
        // Actualizar tarifa existente
        await db.updateTariff(tariff.id, {
          pricePerKwh: input.pricePerKwh.toString(),
          reservationFee: input.reservationFee.toString(),
          overstayPenaltyPerMinute: input.idleFeePerMin.toString(),
          pricePerSession: input.connectionFee.toString(),
          autoPricing: input.autoPricing ?? false,
        });
      } else {
        // Crear nueva tarifa
        await db.createTariff({
          stationId: input.stationId,
          name: "Tarifa Estándar",
          pricePerKwh: input.pricePerKwh.toString(),
          reservationFee: input.reservationFee.toString(),
          overstayPenaltyPerMinute: input.idleFeePerMin.toString(),
          pricePerSession: input.connectionFee.toString(),
          autoPricing: input.autoPricing ?? false,
          isActive: true,
        });
      }
      
      return { success: true };
    }),
  
  // Obtener precio sugerido por IA para una estación
  getSuggestedPrice: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      const { calculateDynamicPrice } = await import("./pricing/dynamic-pricing");
      
      // Obtener EVSEs de la estación para calcular precio dinámico
      const evses = await db.getEvsesByStationId(input.stationId);
      const firstEvse = evses[0];
      
      if (!firstEvse) {
        return {
          suggestedPrice: 1200,
          demandLevel: "NORMAL" as const,
          factors: {
            occupancyMultiplier: 1,
            timeMultiplier: 1,
            dayMultiplier: 1,
            demandMultiplier: 1,
            finalMultiplier: 1,
          },
          explanation: "No hay conectores configurados. Usando precio base.",
        };
      }
      
      const dynamicPrice = await calculateDynamicPrice(input.stationId, firstEvse.id);
      
      // Generar explicación del precio sugerido
      let explanation = "";
      if (dynamicPrice.factors.demandLevel === "LOW") {
        explanation = "Baja demanda actual. Precio reducido para atraer más usuarios.";
      } else if (dynamicPrice.factors.demandLevel === "HIGH") {
        explanation = "Alta demanda detectada. Precio incrementado por ocupación.";
      } else if (dynamicPrice.factors.demandLevel === "SURGE") {
        explanation = "Demanda crítica. Precio máximo por alta ocupación.";
      } else {
        explanation = "Demanda normal. Precio estándar basado en horario y día.";
      }
      
      // Añadir información del horario
      const hour = new Date().getHours();
      if (hour >= 17 && hour < 20) {
        explanation += " Horario pico vespertino (+50%).";
      } else if (hour >= 7 && hour < 9) {
        explanation += " Horario pico matutino (+30%).";
      } else if (hour >= 0 && hour < 6) {
        explanation += " Horario valle nocturno (-15%).";
      }
      
      return {
        suggestedPrice: dynamicPrice.finalPrice,
        demandLevel: dynamicPrice.factors.demandLevel,
        factors: dynamicPrice.factors,
        explanation,
      };
    }),
  
  // Obtener historial de precios de una estación
  getPriceHistory: protectedProcedure
    .input(z.object({ 
      stationId: z.number(),
      daysBack: z.number().optional().default(7),
      granularity: z.enum(["hour", "day"]).optional().default("hour"),
    }))
    .query(async ({ input }) => {
      return db.getPriceHistoryAggregated(input.stationId, input.daysBack, input.granularity);
    }),
  
  // Obtener rangos de precio permitidos (admin)
  getPriceRanges: protectedProcedure
    .query(async () => {
      return db.getPriceRanges();
    }),
  
  // Actualizar rangos de precio y tarifas globales (solo admin)
  updatePriceRanges: adminProcedure
    .input(z.object({
      minPrice: z.number().min(100).max(5000),
      maxPrice: z.number().min(100).max(10000),
      enableDynamicPricing: z.boolean(),
      defaultReservationFee: z.number().min(0).max(100000).optional(),
      defaultOverstayPenaltyPerMin: z.number().min(0).max(10000).optional(),
      defaultConnectionFee: z.number().min(0).max(50000).optional(),
      defaultPricePerKwhAC: z.number().min(100).max(5000).optional(),
      defaultPricePerKwhDC: z.number().min(100).max(10000).optional(),
      enableDifferentiatedPricing: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.minPrice >= input.maxPrice) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "El precio mínimo debe ser menor al máximo" 
        });
      }
      // Validar que AC sea menor que DC si precios diferenciados están habilitados
      if (input.enableDifferentiatedPricing && input.defaultPricePerKwhAC && input.defaultPricePerKwhDC) {
        if (input.defaultPricePerKwhAC > input.defaultPricePerKwhDC) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "El precio AC (carga lenta) debe ser menor o igual al precio DC (carga rápida)" 
          });
        }
      }
      await db.updatePriceRanges(
        input.minPrice, 
        input.maxPrice, 
        input.enableDynamicPricing, 
        ctx.user.id,
        input.defaultReservationFee,
        input.defaultOverstayPenaltyPerMin,
        input.defaultConnectionFee,
        input.defaultPricePerKwhAC,
        input.defaultPricePerKwhDC,
        input.enableDifferentiatedPricing
      );
      return { success: true };
    }),
  
  // Obtener demanda actual de estaciones del inversionista
  getInvestorDemand: investorProcedure
    .query(async ({ ctx }) => {
      return db.getInvestorStationsDemand(ctx.user.id);
    }),
});

// ============================================================================
// TRANSACTIONS ROUTER
// ============================================================================

const transactionsRouter = router({
  // Obtener transacción por ID (solo si pertenece al usuario o es admin)
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const transaction = await db.getTransactionById(input.id);
      
      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transacción no encontrada",
        });
      }
      
      // Verificar que el usuario tiene acceso
      if (transaction.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tienes acceso a esta transacción",
        });
      }
      
      // Obtener información adicional
      const station = await db.getChargingStationById(transaction.stationId);
      const evse = await db.getEvseById(transaction.evseId);
      const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
      
      // Calcular duración
      const startTime = new Date(transaction.startTime);
      const endTime = transaction.endTime ? new Date(transaction.endTime) : new Date();
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      
      return {
        id: transaction.id,
        stationId: transaction.stationId,
        stationName: station?.name || "Estación",
        stationAddress: station?.address || "",
        connectorId: evse?.connectorId || 1,
        connectorType: evse?.connectorType || "TYPE_2",
        startTime: transaction.startTime.toISOString(),
        endTime: transaction.endTime?.toISOString() || null,
        durationMinutes,
        kwhConsumed: transaction.kwhConsumed ? parseFloat(transaction.kwhConsumed).toFixed(2) : "0.00",
        pricePerKwh: tariff?.pricePerKwh ? parseFloat(tariff.pricePerKwh) : 800,
        totalCost: transaction.totalCost ? parseFloat(transaction.totalCost) : 0,
        status: transaction.status,
        paymentMethod: "wallet", // Por defecto wallet
      };
    }),
  
  // Usuario: sus transacciones
  myTransactions: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.getTransactionsByUserId(ctx.user.id, input?.limit || 50);
    }),
  
  // Alias para compatibilidad
  getMyHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.getTransactionsByUserId(ctx.user.id, input?.limit || 50);
    }),
  
  // Admin: todas las transacciones
  listAll: adminProcedure
    .input(z.object({
      stationId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      if (input?.stationId) {
        return db.getTransactionsByStationId(input.stationId, {
          startDate: input.startDate,
          endDate: input.endDate,
        });
      }
      // Obtener todas las transacciones con información de usuario y estación
      return db.getAllTransactions({
        startDate: input?.startDate,
        endDate: input?.endDate,
        limit: input?.limit || 100,
      });
    }),
  
  // Inversionista: transacciones de sus estaciones
  investorTransactions: investorProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getTransactionsByInvestor(ctx.user.id, {
        startDate: input?.startDate,
        endDate: input?.endDate,
      });
    }),

  // Exportar transacciones del inversionista en Excel o PDF
  exportInvestorTransactions: investorProcedure
    .input(z.object({
      format: z.enum(["excel", "pdf"]),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const transactions = await db.getTransactionsByInvestor(ctx.user.id, {
        startDate: input.startDate,
        endDate: input.endDate,
      });

      const settings = await db.getPlatformSettings();
      const investorPercentage = settings?.investorPercentage ?? 80;
      const platformFeePercentage = settings?.platformFeePercentage ?? 20;

      const stationIds = Array.from(new Set(transactions.map(t => t.stationId)));
      const stationsMap: Record<number, string> = {};
      for (const stationId of stationIds) {
        const station = await db.getChargingStationById(stationId);
        if (station) {
          stationsMap[stationId] = station.name;
        }
      }

      const transactionsWithNames = transactions.map(t => ({
        ...t,
        stationName: stationsMap[t.stationId] || `Estación ${t.stationId}`,
      }));

      const options = {
        investorName: ctx.user.name || "Inversionista",
        investorPercentage,
        platformFeePercentage,
        startDate: input.startDate,
        endDate: input.endDate,
      };

      let buffer: Buffer;
      let filename: string;
      let mimeType: string;

      if (input.format === "excel") {
        buffer = generateExcelReport(transactionsWithNames, options);
        filename = `transacciones_${new Date().toISOString().split("T")[0]}.xlsx`;
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        buffer = generatePDFReport(transactionsWithNames, options);
        filename = `transacciones_${new Date().toISOString().split("T")[0]}.pdf`;
        mimeType = "application/pdf";
      }

      const base64 = buffer.toString("base64");

      return {
        filename,
        mimeType,
        data: base64,
      };
    }),
  
  getMeterValues: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(async ({ input }) => {
      return db.getMeterValuesByTransactionId(input.transactionId);
    }),
  
  // Obtener precio dinámico actual del kWh para una estación
  getDynamicKwhPrice: publicProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const pricing = await dynamicPricing.calculateDynamicKwhPrice(
        input.stationId,
        input.evseId
      );
      return pricing;
    }),
  
  // Estimar costo de carga basado en kWh objetivo
  estimateChargingCost: publicProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number(),
      targetKwh: z.number().min(1).max(200),
    }))
    .query(async ({ input }) => {
      return dynamicPricing.estimateChargingCost(
        input.stationId,
        input.evseId,
        input.targetKwh
      );
    }),
  
  // Iniciar sesión de carga con precio dinámico
  startChargingSession: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number(),
      targetKwh: z.number().optional(), // Si no se especifica, carga hasta que el usuario detenga
    }))
    .mutation(async ({ ctx, input }) => {
      // Obtener precio dinámico actual
      const pricing = await dynamicPricing.calculateDynamicKwhPrice(
        input.stationId,
        input.evseId
      );
      
      // Verificar saldo del usuario
      const wallet = await db.getWalletByUserId(ctx.user.id);
      if (!wallet) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No tienes una billetera activa" });
      }
      
      const balance = parseFloat(wallet.balance?.toString() || "0");
      const minBalance = pricing.dynamicPricePerKwh * 5; // Mínimo para 5 kWh
      
      if (balance < minBalance) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Saldo insuficiente. Necesitas al menos $${minBalance.toLocaleString()} COP para iniciar la carga.` 
        });
      }
      
      // Verificar que el EVSE esté disponible
      const evse = await db.getEvseById(input.evseId);
      if (!evse || evse.status !== "AVAILABLE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El conector no está disponible" });
      }
      
      // Crear transacción con precio dinámico
      const transactionId = await db.createTransaction({
        stationId: input.stationId,
        evseId: input.evseId,
        userId: ctx.user.id,
        status: "IN_PROGRESS",
        startTime: new Date(),
      });
      
      // Actualizar estado del EVSE
      await db.updateEvseStatus(input.evseId, "CHARGING");
      
      return {
        transactionId,
        pricePerKwh: pricing.dynamicPricePerKwh,
        multiplier: pricing.multiplier,
        demandLevel: pricing.factors.demandLevel,
        message: `Carga iniciada a $${pricing.dynamicPricePerKwh}/kWh (${pricing.factors.demandLevel === "LOW" ? "precio bajo" : pricing.factors.demandLevel === "SURGE" ? "demanda alta" : "precio normal"})`,
      };
    }),
  
  // Detener sesión de carga y calcular costo final
  stopChargingSession: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const transaction = await db.getTransactionById(input.transactionId);
      
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      }
      
      if (transaction.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta transacción" });
      }
      
      if (transaction.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta transacción ya fue completada" });
      }
      
      // Calcular energía consumida y costo
      const kwhConsumed = parseFloat(transaction.kwhConsumed?.toString() || "0");
      // Obtener tarifa de la estación
      const tariff = await db.getActiveTariffByStationId(transaction.stationId);
      const pricePerKwh = parseFloat(tariff?.pricePerKwh?.toString() || "800");
      const totalCost = Math.round(kwhConsumed * pricePerKwh);
      
      // Calcular distribución según configuración del admin
      const revenueConfig = await db.getRevenueShareConfig();
      const investorShare = Math.round(totalCost * (revenueConfig.investorPercent / 100));
      const platformFee = Math.round(totalCost * (revenueConfig.platformPercent / 100));
      
      // Actualizar transacción
      await db.updateTransaction(input.transactionId, {
        endTime: new Date(),
        status: "COMPLETED",
        totalCost: totalCost.toString(),
        investorShare: investorShare.toString(),
        platformFee: platformFee.toString(),
      });
      
      // Descontar de la billetera del usuario
      const wallet = await db.getWalletByUserId(ctx.user.id);
      if (wallet) {
        let currentBalance = parseFloat(wallet.balance?.toString() || "0");

        // Auto-cobro: si el saldo es insuficiente y tiene tarjeta inscrita
        if (currentBalance < totalCost) {
          try {
            const { autoChargeIfNeeded } = await import("./wompi/auto-charge");
            const autoResult = await autoChargeIfNeeded(ctx.user.id, totalCost);
            if (autoResult?.success) {
              currentBalance = autoResult.newBalance;
              console.log(`[Charging] Auto-cobro exitoso: $${autoResult.amountCharged} cobrados a tarjeta`);
            } else if (autoResult) {
              console.log(`[Charging] Auto-cobro fallido: ${autoResult.error}`);
            }
          } catch (autoErr) {
            console.warn(`[Charging] Error en auto-cobro:`, autoErr);
          }
        }

        const newBalance = Math.max(0, currentBalance - totalCost);
        await db.updateWalletBalance(ctx.user.id, newBalance.toString());
        // Registrar transacción de billetera
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: ctx.user.id,
          type: "DEBIT",
          amount: (-totalCost).toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          description: `Carga de ${kwhConsumed.toFixed(2)} kWh`,
          referenceId: input.transactionId,
        });
      }
      
      // Actualizar estado del EVSE
      if (transaction.evseId) {
        await db.updateEvseStatus(transaction.evseId, "AVAILABLE");
      }
      
      return {
        transactionId: input.transactionId,
        kwhConsumed,
        pricePerKwh,
        totalCost,
        investorShare,
        platformFee,
        message: `Carga completada. Total: $${totalCost.toLocaleString()} COP por ${kwhConsumed.toFixed(2)} kWh`,
      };
    }),
});

// ============================================================================
// RESERVATIONS ROUTER
// ============================================================================

// Importar módulo de tarifa dinámica
import * as dynamicPricing from "./pricing/dynamic-pricing";

const reservationsRouter = router({
  myReservations: protectedProcedure.query(async ({ ctx }) => {
    return db.getReservationsByUserId(ctx.user.id);
  }),
  
  // Obtener tarifa dinámica para una reserva
  getDynamicPrice: publicProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number(),
      requestedDate: z.date().optional(),
      estimatedDurationMinutes: z.number().min(15).max(480).default(60),
    }))
    .query(async ({ input }) => {
      const price = await dynamicPricing.calculateDynamicPrice(
        input.stationId,
        input.evseId,
        input.requestedDate || new Date(),
        input.estimatedDurationMinutes
      );
      
      const visualization = dynamicPricing.getDemandVisualization(price.factors);
      
      return {
        ...price,
        visualization,
      };
    }),
  
  // Obtener predicción de mejores horarios
  getBestTimes: publicProcedure
    .input(z.object({
      stationId: z.number(),
      date: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return dynamicPricing.predictBestTimes(
        input.stationId,
        input.date || new Date()
      );
    }),
  
  // Obtener ocupación de la zona
  getZoneOccupancy: publicProcedure
    .input(z.object({
      stationId: z.number(),
    }))
    .query(async ({ input }) => {
      return dynamicPricing.getZoneOccupancy(input.stationId);
    }),
  
  // Crear reserva con tarifa dinámica
  create: protectedProcedure
    .input(z.object({
      evseId: z.number(),
      stationId: z.number(),
      startTime: z.date(),
      endTime: z.date(),
      estimatedDurationMinutes: z.number().min(15).max(480).default(60),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que el EVSE esté disponible
      const evse = await db.getEvseById(input.evseId);
      if (!evse || evse.status !== "AVAILABLE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El conector no está disponible para reserva" });
      }
      
      // Verificar conflictos de horario
      const hasConflict = await db.checkReservationConflict(
        input.evseId,
        input.startTime,
        input.endTime
      );
      if (hasConflict) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ya existe una reserva en ese horario" });
      }
      
      // Calcular tarifa dinámica
      const dynamicPrice = await dynamicPricing.calculateDynamicPrice(
        input.stationId,
        input.evseId,
        input.startTime,
        input.estimatedDurationMinutes
      );
      
      // Verificar saldo del usuario
      const wallet = await db.getWalletByUserId(ctx.user.id);
      const balance = parseFloat(wallet?.balance?.toString() || "0");
      
      if (balance < dynamicPrice.reservationFee) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Saldo insuficiente. Necesitas $${dynamicPrice.reservationFee.toLocaleString()} COP para reservar.` 
        });
      }
      
      // Calcular tiempo de expiración (15 minutos después del inicio)
      const expiryTime = new Date(input.startTime.getTime() + 15 * 60 * 1000);
      
      // Crear la reserva
      const id = await db.createReservation({
        evseId: input.evseId,
        userId: ctx.user.id,
        stationId: input.stationId,
        startTime: input.startTime,
        endTime: input.endTime,
        expiryTime,
        reservationFee: dynamicPrice.reservationFee.toString(),
        noShowPenalty: dynamicPrice.noShowPenalty.toString(),
        status: "ACTIVE",
      });
      
      // Descontar tarifa de reserva de la billetera
      if (wallet) {
        const newBalance = balance - dynamicPrice.reservationFee;
        await db.updateWalletBalance(wallet.id, newBalance.toString());
        
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: ctx.user.id,
          amount: (-dynamicPrice.reservationFee).toString(),
          balanceBefore: balance.toString(),
          balanceAfter: newBalance.toString(),
          type: "DEBIT",
          description: `Reserva de cargador #${id}`,
          referenceType: "RESERVATION",
          referenceId: id,
        });
      }
      
      // Actualizar estado del EVSE
      await db.updateEvseStatus(input.evseId, "RESERVED");
      
      return { 
        id,
        reservationFee: dynamicPrice.reservationFee,
        noShowPenalty: dynamicPrice.noShowPenalty,
        demandLevel: dynamicPrice.factors.demandLevel,
      };
    }),
  
  // Cancelar reserva con reembolso dinámico
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const reservation = await db.getReservationById(input.id);
      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reserva no encontrada" });
      }
      if (reservation.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para cancelar esta reserva" });
      }
      if (reservation.status !== "ACTIVE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La reserva no puede ser cancelada" });
      }
      
      // Calcular porcentaje de reembolso según tiempo de anticipación
      const now = new Date();
      const startTime = new Date(reservation.startTime);
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      let refundPercent = 0;
      if (hoursUntilStart >= 24) {
        refundPercent = 100; // Reembolso total si cancela con 24h+ de anticipación
      } else if (hoursUntilStart >= 12) {
        refundPercent = 75; // 75% si cancela con 12-24h de anticipación
      } else if (hoursUntilStart >= 2) {
        refundPercent = 50; // 50% si cancela con 2-12h de anticipación
      } else {
        refundPercent = 0; // Sin reembolso si cancela con menos de 2h
      }
      
      const result = await db.cancelReservationWithRefund(input.id, refundPercent);
      
      return { 
        success: result.success, 
        refundAmount: result.refundAmount,
        refundPercent,
      };
    }),
  
  // Verificar y aplicar penalizaciones por no show
  checkNoShows: adminProcedure.mutation(async () => {
    const expiredReservations = await db.getExpiredReservations();
    const results = [];
    
    for (const reservation of expiredReservations) {
      const result = await db.applyNoShowPenalty(reservation.id);
      results.push({
        reservationId: reservation.id,
        penaltyApplied: result?.penaltyApplied || 0,
      });
    }
    
    return { processed: results.length, results };
  }),
});

// ============================================================================
// WALLET ROUTER
// ============================================================================

const walletRouter = router({
  getMyWallet: protectedProcedure.query(async ({ ctx }) => {
    let wallet = await db.getWalletByUserId(ctx.user.id);
    if (!wallet) {
      // Crear billetera si no existe
      await db.createWallet({ userId: ctx.user.id, balance: "0", currency: "COP" });
      wallet = await db.getWalletByUserId(ctx.user.id);
    }
    return wallet;
  }),
  
  getTransactions: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.getWalletTransactionsByUserId(ctx.user.id, input?.limit || 50);
    }),
  
  // Recargar billetera (placeholder para integración con Stripe)
  recharge: protectedProcedure
    .input(z.object({
      amount: z.number().min(10000), // Mínimo 10,000 COP
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Integrar con Stripe para procesar el pago
      // Por ahora, simular la recarga
      const wallet = await db.getWalletByUserId(ctx.user.id);
      if (!wallet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Billetera no encontrada" });
      }
      
      const newBalance = parseFloat(wallet.balance) + input.amount;
      await db.updateWalletBalance(ctx.user.id, newBalance.toString());
      
      await db.createWalletTransaction({
        walletId: wallet.id,
        userId: ctx.user.id,
        type: "RECHARGE",
        amount: input.amount.toString(),
        balanceBefore: wallet.balance,
        balanceAfter: newBalance.toString(),
        status: "COMPLETED",
        description: `Recarga de billetera por $${input.amount.toLocaleString()} COP`,
      });
      
      return { success: true, newBalance };
    }),
});

// ============================================================================
// MAINTENANCE ROUTER (Técnicos)
// ============================================================================

const maintenanceRouter = router({
  // Técnico: sus tickets asignados
  myTickets: technicianProcedure.query(async ({ ctx }) => {
    return db.getMaintenanceTicketsByTechnician(ctx.user.id);
  }),
  
  // Admin: todos los tickets
  listAll: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getAllMaintenanceTickets(input?.status);
    }),
  
  // Por estación
  getByStation: technicianProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      return db.getMaintenanceTicketsByStation(input.stationId);
    }),
  
  create: technicianProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number().optional(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createMaintenanceTicket({
        ...input,
        reportedById: ctx.user.id,
        status: "PENDING",
      });
      return { id };
    }),
  
  update: technicianProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
        resolution: z.string().optional(),
        partsUsed: z.any().optional(),
        laborCost: z.string().optional(),
        totalCost: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const updateData: any = { ...input.data };
      if (input.data.status === "IN_PROGRESS" && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (input.data.status === "COMPLETED" && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }
      await db.updateMaintenanceTicket(input.id, updateData);
      return { success: true };
    }),
  
  assignTechnician: adminProcedure
    .input(z.object({
      ticketId: z.number(),
      technicianId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.updateMaintenanceTicket(input.ticketId, {
        technicianId: input.technicianId,
      });
      return { success: true };
    }),
});

// ============================================================================
// NOTIFICATIONS ROUTER
// ============================================================================

const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.getNotificationsByUserId(ctx.user.id, input?.unreadOnly || false);
    }),
  
  markAsRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.markNotificationAsRead(input.id);
      return { success: true };
    }),
  
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsAsRead(ctx.user.id);
    return { success: true };
  }),
  
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteNotification(input.id, ctx.user.id);
      return { success: true };
    }),

  // ============================================================================
  // ADMIN BROADCAST ENDPOINTS
  // ============================================================================
  
  // Obtener estadísticas de notificaciones
  getStats: adminProcedure.query(async () => {
    return getNotificationStats();
  }),
  
  // Obtener historial de notificaciones broadcast
  getHistory: adminProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return getBroadcastHistory(input?.limit || 20);
    }),
  
  // Enviar notificación broadcast
  sendBroadcast: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      message: z.string().min(1).max(2000),
      type: z.enum(["INFO", "SUCCESS", "WARNING", "ALERT", "PROMOTION"]),
      targetAudience: z.enum(["all", "users", "investors", "technicians", "admins"]),
      linkUrl: z.string().url().optional(),
      sendPush: z.boolean().optional(),
      sendEmail: z.boolean().optional(),
      sendInApp: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await sendBroadcastNotification(input);
      return {
        success: true,
        ...result,
      };
    }),
});

// ============================================================================
// SUPPORT ROUTER
// ============================================================================

const supportRouter = router({
  myTickets: protectedProcedure.query(async ({ ctx }) => {
    return db.getSupportTicketsByUserId(ctx.user.id);
  }),
  
  listAll: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getAllSupportTickets(input?.status);
    }),
  
  create: protectedProcedure
    .input(z.object({
      subject: z.string(),
      description: z.string(),
      category: z.string().optional(),
      stationId: z.number().optional(),
      transactionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createSupportTicket({
        ...input,
        userId: ctx.user.id,
        status: "OPEN",
      });
      return { id };
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        status: z.string().optional(),
        assignedToId: z.number().optional(),
        resolution: z.string().optional(),
        priority: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const updateData: any = { ...input.data };
      if (input.data.status === "RESOLVED" && !updateData.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      await db.updateSupportTicket(input.id, updateData);
      return { success: true };
    }),
});

// ============================================================================
// INVESTOR STATS ROUTER
// ============================================================================

const investorStatsRouter = router({
  getStats: investorProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getInvestorStats(ctx.user.id, input?.startDate, input?.endDate);
    }),
  
  getPayouts: investorProcedure.query(async ({ ctx }) => {
    return db.getPayoutsByInvestorId(ctx.user.id);
  }),
});

// ============================================================================
// BANNERS ROUTER (Admin)
// ============================================================================

const bannersRouter = router({
  list: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getAllBanners(input?.status);
    }),
  
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getBannerById(input.id);
    }),
  
  getActive: publicProcedure
    .input(z.object({ type: z.string().optional(), location: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getActiveBanners(input?.type, input?.location);
    }),
  
  create: adminProcedure
    .input(z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string(),
      imageUrlMobile: z.string().optional(),
      type: z.enum(["SPLASH", "CHARGING", "MAP", "PROMOTIONAL", "INFORMATIONAL"]),
      linkUrl: z.string().optional(),
      linkType: z.string().optional(),
      ctaText: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      targetRoles: z.array(z.string()).optional(),
      targetCities: z.array(z.string()).optional(),
      priority: z.number().optional(),
      displayDurationMs: z.number().optional(),
      advertiserName: z.string().optional(),
      advertiserContact: z.string().optional(),
      campaignId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createBanner({
        ...input,
        status: "DRAFT",
        createdById: ctx.user.id,
      });
      return { id };
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        imageUrlMobile: z.string().optional(),
        type: z.enum(["SPLASH", "CHARGING", "MAP", "PROMOTIONAL", "INFORMATIONAL"]).optional(),
        linkUrl: z.string().optional(),
        linkType: z.string().optional(),
        ctaText: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        targetRoles: z.array(z.string()).optional(),
        targetCities: z.array(z.string()).optional(),
        priority: z.number().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).optional(),
        advertiserName: z.string().optional(),
        advertiserContact: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateBanner(input.id, input.data);
      return { success: true };
    }),
  
  toggleActive: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const banner = await db.getBannerById(input.id);
      if (!banner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Banner no encontrado" });
      }
      const newStatus = banner.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await db.updateBanner(input.id, { status: newStatus });
      return { success: true, status: newStatus };
    }),
  
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteBanner(input.id);
      return { success: true };
    }),
  
  recordImpression: publicProcedure
    .input(z.object({ bannerId: z.number(), context: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.recordBannerImpression(input.bannerId, ctx.user?.id, input.context);
      return { success: true };
    }),
  
  recordClick: publicProcedure
    .input(z.object({ bannerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.recordBannerClick(input.bannerId, ctx.user?.id);
      return { success: true };
    }),
});

// ============================================================================
// PLATFORM STATS ROUTER (Admin)
// ============================================================================

const platformStatsRouter = router({
  getStats: adminProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getPlatformStats(input?.startDate, input?.endDate);
    }),
});

// ============================================================================
// PLATFORM SETTINGS ROUTER (Admin)
// ============================================================================

const settingsRouter = router({
  // Endpoint público para obtener solo el porcentaje del inversionista (para mostrar en UI)
  getInvestorPercentage: publicProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    return {
      investorPercentage: settings?.investorPercentage ?? 80,
      platformFeePercentage: settings?.platformFeePercentage ?? 20,
    };
  }),

  // Endpoint público para obtener parámetros de la calculadora de inversión
  getCalculatorParams: publicProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    return {
      investorPercentage: settings?.investorPercentage ?? 70,
      factorUtilizacionPremium: parseFloat(String(settings?.factorUtilizacionPremium ?? "2.00")),
      costosOperativosIndividual: settings?.costosOperativosIndividual ?? 15,
      costosOperativosColectivo: settings?.costosOperativosColectivo ?? 10,
      costosOperativosAC: settings?.costosOperativosAC ?? 15,
      eficienciaCargaDC: settings?.eficienciaCargaDC ?? 92,
      eficienciaCargaAC: settings?.eficienciaCargaAC ?? 95,
      costoEnergiaRed: settings?.costoEnergiaRed ?? 850,
      costoEnergiaSolar: settings?.costoEnergiaSolar ?? 250,
      precioVentaDefault: settings?.precioVentaDefault ?? 1800,
      precioVentaMin: settings?.precioVentaMin ?? 1400,
      precioVentaMax: settings?.precioVentaMax ?? 2200,
    };
  }),
  
  get: adminProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    if (!settings) {
      // Retornar valores por defecto si no hay configuración
      return {
        id: 0,
        companyName: "Green House Project",
        businessLine: "Green EV",
        nit: "",
        contactEmail: "",
        investorPercentage: 80,
        platformFeePercentage: 20,
        wompiPublicKey: "",
        wompiPrivateKey: "",
        wompiIntegritySecret: "",
        wompiEventsSecret: "",
        wompiTestMode: true,
        enableEnergyBilling: true,
        enableReservationBilling: true,
        enableOccupancyPenalty: true,
        notifyChargeComplete: true,
        notifyReservationReminder: true,
        notifyPromotions: false,
        upmeEndpoint: "",
        upmeToken: "",
        upmeAutoReport: true,
        ocppPort: 9000,
        ocppServerActive: true,
        factorUtilizacionPremium: "2.00",
        costosOperativosIndividual: 15,
        costosOperativosColectivo: 10,
        costosOperativosAC: 15,
        eficienciaCargaDC: 92,
        eficienciaCargaAC: 95,
        costoEnergiaRed: 850,
        costoEnergiaSolar: 250,
        precioVentaDefault: 1800,
        precioVentaMin: 1400,
        precioVentaMax: 2200,
      };
    }
    // Ocultar claves secretas parcialmente
    return {
      ...settings,
      wompiPrivateKey: settings.wompiPrivateKey ? "prv_****" + settings.wompiPrivateKey.slice(-4) : "",
      wompiIntegritySecret: settings.wompiIntegritySecret ? "****" + settings.wompiIntegritySecret.slice(-4) : "",
      wompiEventsSecret: settings.wompiEventsSecret ? "****" + settings.wompiEventsSecret.slice(-4) : "",
      upmeToken: settings.upmeToken ? "****" + settings.upmeToken.slice(-4) : "",
    };
  }),
  
  update: adminProcedure
    .input(z.object({
      companyName: z.string().optional(),
      businessLine: z.string().optional(),
      nit: z.string().optional(),
      contactEmail: z.string().email().optional().or(z.literal("")),
      investorPercentage: z.number().min(0).max(100).optional(),
      platformFeePercentage: z.number().min(0).max(100).optional(),
      wompiPublicKey: z.string().optional(),
      wompiPrivateKey: z.string().optional(),
      wompiIntegritySecret: z.string().optional(),
      wompiEventsSecret: z.string().optional(),
      wompiTestMode: z.boolean().optional(),
      enableEnergyBilling: z.boolean().optional(),
      enableReservationBilling: z.boolean().optional(),
      enableOccupancyPenalty: z.boolean().optional(),
      notifyChargeComplete: z.boolean().optional(),
      notifyReservationReminder: z.boolean().optional(),
      notifyPromotions: z.boolean().optional(),
      upmeEndpoint: z.string().optional(),
      upmeToken: z.string().optional(),
      upmeAutoReport: z.boolean().optional(),
      ocppPort: z.number().optional(),
      ocppServerActive: z.boolean().optional(),
      // Parámetros de la calculadora de inversión
      factorUtilizacionPremium: z.number().min(1).max(5).optional(),
      costosOperativosIndividual: z.number().min(0).max(50).optional(),
      costosOperativosColectivo: z.number().min(0).max(50).optional(),
      costosOperativosAC: z.number().min(0).max(50).optional(),
      eficienciaCargaDC: z.number().min(50).max(100).optional(),
      eficienciaCargaAC: z.number().min(50).max(100).optional(),
      costoEnergiaRed: z.number().min(0).optional(),
      costoEnergiaSolar: z.number().min(0).optional(),
      precioVentaDefault: z.number().min(0).optional(),
      precioVentaMin: z.number().min(0).optional(),
      precioVentaMax: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Filtrar campos vacíos o con valores de máscara
      const data: any = { ...input, updatedBy: ctx.user.id };
      
      // No actualizar claves si vienen con máscara
      if (data.wompiPrivateKey?.startsWith("prv_****")) delete data.wompiPrivateKey;
      if (data.wompiIntegritySecret?.startsWith("****")) delete data.wompiIntegritySecret;
      if (data.wompiEventsSecret?.startsWith("****")) delete data.wompiEventsSecret;
      if (data.upmeToken?.startsWith("****")) delete data.upmeToken;
      
      await db.upsertPlatformSettings(data);
      return { success: true };
    }),
});

// ============================================================================
// DASHBOARD ROUTER (Métricas para todos los roles)
// ============================================================================

const dashboardRouter = router({
  // Métricas para Admin
  adminMetrics: adminProcedure.query(async () => {
    return db.getAdminDashboardMetrics();
  }),
  
  // Métricas para Inversor
  investorMetrics: investorProcedure.query(async ({ ctx }) => {
    return db.getInvestorDashboardMetrics(ctx.user.id);
  }),
  
  // Transacción activa del usuario
  userActiveTransaction: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserActiveTransaction(ctx.user.id);
  }),
  
  // Historial de transacciones del usuario
  userTransactionHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return db.getUserTransactionHistory(ctx.user.id, input?.limit || 20);
    }),
  
  // Estadísticas mensuales del usuario
  userMonthlyStats: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserMonthlyStats(ctx.user.id);
  }),
  
  // Métricas de transacciones por período (Admin)
  transactionMetrics: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      granularity: z.enum(["hour", "day"]).default("day"),
    }))
    .query(async ({ input }) => {
      return db.getTransactionMetrics(input.startDate, input.endDate, input.granularity);
    }),
  
  // Top estaciones por ingresos (Admin)
  topStationsByRevenue: adminProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ input }) => {
      const startDate = input?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
      const endDate = input?.endDate || new Date();
      return db.getTopStationsByRevenue(startDate, endDate, input?.limit || 10);
    }),
  
  // Transacciones recientes (Admin)
  recentTransactions: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      return db.getRecentTransactions(input?.limit || 20);
    }),
});

// ============================================================================
// PAYOUTS ROUTER (Liquidaciones)
// ============================================================================

const payoutsRouter = router({
  // Obtener balance pendiente del inversionista
  getMyBalance: investorProcedure.query(async ({ ctx }) => {
    return db.getInvestorPendingBalance(ctx.user.id);
  }),
  
  // Obtener historial de liquidaciones del inversionista
  getMyPayouts: investorProcedure.query(async ({ ctx }) => {
    return db.getPayoutsByInvestorId(ctx.user.id);
  }),
  
  // Solicitar pago (inversionista)
  requestPayout: investorProcedure
    .input(z.object({
      amount: z.number().positive(),
      bankName: z.string().min(1),
      bankAccount: z.string().min(1),
      accountHolder: z.string().min(1),
      accountType: z.enum(['AHORROS', 'CORRIENTE']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar balance disponible
      const balance = await db.getInvestorPendingBalance(ctx.user.id);
      if (input.amount > balance.pendingBalance) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Monto solicitado ($${input.amount.toLocaleString()}) excede el balance disponible ($${balance.pendingBalance.toLocaleString()})`,
        });
      }
      
      // Crear solicitud de pago
      const now = new Date();
      const periodStart = balance.lastPayout?.periodEnd || new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodEnd = now;
      
      const platformFee = input.amount * ((100 - (balance.investorPercentage || 80)) / (balance.investorPercentage || 80));
      const totalRevenue = input.amount + platformFee;
      
      const payoutId = await db.createInvestorPayout({
        investorId: ctx.user.id,
        periodStart,
        periodEnd,
        totalRevenue: totalRevenue.toFixed(2),
        investorShare: input.amount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        investorPercentage: balance.investorPercentage || 80,
        transactionCount: balance.transactionCount || 0,
        totalKwh: '0', // Se puede calcular si es necesario
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        accountHolder: input.accountHolder,
        accountType: input.accountType,
        status: 'REQUESTED',
        requestedAt: now,
        investorNotes: input.notes,
      });
      
      return { success: true, payoutId };
    }),
  
  // Admin: Obtener todas las solicitudes de pago
  getAllPayouts: adminProcedure
    .input(z.object({
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAllPayoutsForAdmin(input?.status);
    }),
  
  // Admin: Obtener solicitudes pendientes
  getPendingPayouts: adminProcedure.query(async () => {
    return db.getAllPendingPayouts();
  }),
  
  // Admin: Aprobar solicitud de pago
  approvePayout: adminProcedure
    .input(z.object({
      payoutId: z.number(),
      adminNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const payout = await db.getPayoutById(input.payoutId);
      if (!payout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitud no encontrada' });
      }
      if (payout.status !== 'REQUESTED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esta solicitud ya fue procesada' });
      }
      
      await db.updateInvestorPayout(input.payoutId, {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: ctx.user.id,
        adminNotes: input.adminNotes,
      });
      
      return { success: true };
    }),
  
  // Admin: Rechazar solicitud de pago
  rejectPayout: adminProcedure
    .input(z.object({
      payoutId: z.number(),
      rejectionReason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const payout = await db.getPayoutById(input.payoutId);
      if (!payout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitud no encontrada' });
      }
      if (payout.status === 'PAID') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede rechazar un pago ya completado' });
      }
      
      await db.updateInvestorPayout(input.payoutId, {
        status: 'REJECTED',
        rejectionReason: input.rejectionReason,
        adminNotes: `Rechazado por: ${ctx.user.name || ctx.user.email}`,
      });
      
      return { success: true };
    }),
  
  // Admin: Marcar como pagado
  markAsPaid: adminProcedure
    .input(z.object({
      payoutId: z.number(),
      paymentMethod: z.enum(['BANK_TRANSFER', 'STRIPE', 'WOMPI', 'OTHER']),
      paymentReference: z.string().min(1),
      adminNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const payout = await db.getPayoutById(input.payoutId);
      if (!payout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Solicitud no encontrada' });
      }
      if (payout.status === 'PAID') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este pago ya fue completado' });
      }
      if (payout.status === 'REJECTED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede pagar una solicitud rechazada' });
      }
      
      await db.updateInvestorPayout(input.payoutId, {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference,
        adminNotes: input.adminNotes || `Pagado por: ${ctx.user.name || ctx.user.email}`,
      });
      
      return { success: true };
    }),
});

// ============================================================================
// CROWDFUNDING ROUTER
// ============================================================================

const crowdfundingRouter = router({
  // Obtener todos los proyectos públicos
  getProjects: publicProcedure
    .input(z.object({
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getCrowdfundingProjects({
        status: input?.status,
        includePrivate: false,
      });
    }),
  
  // Obtener un proyecto por ID
  getProjectById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getCrowdfundingProjectById(input.id);
    }),
  
  // Admin: Obtener todos los proyectos incluyendo borradores
  getAllProjects: adminProcedure.query(async () => {
    return db.getCrowdfundingProjects({ includePrivate: true });
  }),
  
  // Admin: Crear proyecto
  createProject: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      city: z.string().min(1),
      zone: z.string().min(1),
      address: z.string().optional(),
      targetAmount: z.number().positive(),
      minimumInvestment: z.number().positive().optional(),
      totalPowerKw: z.number().positive().optional(),
      chargerCount: z.number().positive().optional(),
      chargerPowerKw: z.number().positive().optional(),
      hasSolarPanels: z.boolean().optional(),
      estimatedRoiPercent: z.number().optional(),
      estimatedPaybackMonths: z.number().optional(),
      status: z.string().optional(),
      targetDate: z.date().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const projectId = await db.createCrowdfundingProject({
        ...input,
        createdById: ctx.user.id,
      });
      return { success: true, projectId };
    }),
  
  // Admin: Actualizar proyecto
  updateProject: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      city: z.string().optional(),
      zone: z.string().optional(),
      address: z.string().optional(),
      targetAmount: z.number().optional(),
      raisedAmount: z.number().optional(),
      minimumInvestment: z.number().optional(),
      totalPowerKw: z.number().optional(),
      chargerCount: z.number().optional(),
      chargerPowerKw: z.number().optional(),
      hasSolarPanels: z.boolean().optional(),
      estimatedRoiPercent: z.number().optional(),
      estimatedPaybackMonths: z.number().optional(),
      status: z.string().optional(),
      targetDate: z.date().optional(),
      priority: z.number().optional(),
      stationId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateCrowdfundingProject(id, data);
      return { success: true };
    }),
  
  // Obtener participaciones de un proyecto
  getParticipations: adminProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getCrowdfundingParticipations(input.projectId);
    }),
  
  // Inversionista: Obtener mis participaciones
  getMyParticipations: investorProcedure.query(async ({ ctx }) => {
    return db.getInvestorParticipations(ctx.user.id);
  }),
  
  // Inversionista: Crear participación (expresar interés)
  createParticipation: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      amount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que el proyecto existe y está abierto
      const project = await db.getCrowdfundingProjectById(input.projectId);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
      }
      if (project.status !== 'OPEN' && project.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este proyecto no está abierto para inversiones' });
      }
      if (input.amount < project.minimumInvestment) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `La inversión mínima es ${project.minimumInvestment.toLocaleString()} COP` 
        });
      }
      
      // Calcular porcentaje de participación
      const participationPercent = (input.amount / project.targetAmount) * 100;
      
      const participationId = await db.createCrowdfundingParticipation({
        projectId: input.projectId,
        investorId: ctx.user.id,
        amount: input.amount,
        participationPercent,
        paymentStatus: 'PENDING',
      });
      
      return { success: true, participationId, participationPercent };
    }),
  
  // Admin: Registrar nuevo inversionista con participación
  registerInvestor: adminProcedure
    .input(z.object({
      projectId: z.number(),
      // Datos del inversionista
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      taxId: z.string().optional(), // NIT
      bankAccount: z.string().optional(),
      bankName: z.string().optional(),
      // Datos de la inversión
      amount: z.number().positive(),
      paymentReference: z.string().optional(),
      paymentConfirmed: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      // Verificar que el proyecto existe y está abierto
      const project = await db.getCrowdfundingProjectById(input.projectId);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
      }
      if (project.status !== 'OPEN' && project.status !== 'IN_PROGRESS') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este proyecto no está abierto para inversiones' });
      }
      if (input.amount < project.minimumInvestment) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `La inversión mínima es ${project.minimumInvestment.toLocaleString()} COP` 
        });
      }
      
      // Verificar si ya existe un usuario con ese email
      let investorId: number;
      const existingUser = await db.getUserByEmail(input.email);
      
      if (existingUser) {
        // Actualizar rol a inversionista si no lo es
        if (existingUser.role !== 'investor' && existingUser.role !== 'admin') {
          await db.updateUser(existingUser.id, { role: 'investor' });
        }
        // Actualizar datos adicionales del inversionista
        await db.updateUser(existingUser.id, {
          name: input.name,
          phone: input.phone,
          companyName: input.companyName,
          taxId: input.taxId,
          bankAccount: input.bankAccount,
          bankName: input.bankName,
        });
        investorId = existingUser.id;
      } else {
        // Crear nuevo usuario inversionista
        const openId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        investorId = await db.createUser({
          openId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: 'investor',
          companyName: input.companyName,
          taxId: input.taxId,
          bankAccount: input.bankAccount,
          bankName: input.bankName,
          loginMethod: 'admin_created',
        });
      }
      
      // Calcular porcentaje de participación
      const participationPercent = (input.amount / project.targetAmount) * 100;
      
      // Crear la participación
      const participationId = await db.createCrowdfundingParticipation({
        projectId: input.projectId,
        investorId,
        amount: input.amount,
        participationPercent,
        paymentStatus: input.paymentConfirmed ? 'COMPLETED' : 'PENDING',
        paymentDate: input.paymentConfirmed ? new Date() : undefined,
        paymentReference: input.paymentReference,
      });
      
      // Si el pago está confirmado, actualizar el monto recaudado
      if (input.paymentConfirmed) {
        await db.updateProjectRaisedAmountByParticipation(participationId);
        
        // Verificar hitos de financiamiento
        const projectAfter = await db.getCrowdfundingProjectById(input.projectId);
        if (projectAfter) {
          try {
            await checkAndNotifyMilestones(
              {
                id: projectAfter.id,
                name: projectAfter.name,
                city: projectAfter.city,
                zone: projectAfter.zone,
                targetAmount: Number(projectAfter.targetAmount),
                raisedAmount: Number(projectAfter.raisedAmount),
                status: projectAfter.status,
              },
              Number(project.raisedAmount)
            );
          } catch (notifyError) {
            console.error('[Crowdfunding] Error sending milestone notifications:', notifyError);
          }
        }
      }
      
      // Si el proyecto tiene estación asignada, vincular al inversionista
      if (project.stationId) {
        // Aquí podríamos agregar lógica adicional para vincular al inversionista con la estación
        console.log(`[Crowdfunding] Inversionista ${investorId} vinculado a estación ${project.stationId}`);
      }
      
      return { 
        success: true, 
        investorId, 
        participationId, 
        participationPercent,
        message: existingUser 
          ? 'Participación registrada para inversionista existente' 
          : 'Nuevo inversionista creado y participación registrada'
      };
    }),

  // Admin: Confirmar pago de participación
  confirmPayment: adminProcedure
    .input(z.object({
      participationId: z.number(),
      paymentReference: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Obtener la participación para conocer el proyecto
      const participation = await db.getCrowdfundingParticipationById(input.participationId);
      if (!participation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Participación no encontrada' });
      }
      
      // Obtener el proyecto antes de actualizar para conocer el monto anterior
      const projectBefore = await db.getCrowdfundingProjectById(participation.projectId);
      const previousRaisedAmount = projectBefore ? Number(projectBefore.raisedAmount) : 0;
      
      // Actualizar estado de pago
      await db.updateCrowdfundingParticipation(input.participationId, {
        paymentStatus: 'COMPLETED',
        paymentDate: new Date(),
      });
      
      // Actualizar monto recaudado del proyecto
      await db.updateProjectRaisedAmountByParticipation(input.participationId);
      
      // Obtener el proyecto actualizado para verificar hitos
      const projectAfter = await db.getCrowdfundingProjectById(participation.projectId);
      if (projectAfter) {
        // Verificar y enviar notificaciones de hitos (50%, 75%, 100%)
        try {
          await checkAndNotifyMilestones(
            {
              id: projectAfter.id,
              name: projectAfter.name,
              city: projectAfter.city,
              zone: projectAfter.zone,
              targetAmount: Number(projectAfter.targetAmount),
              raisedAmount: Number(projectAfter.raisedAmount),
              status: projectAfter.status,
            },
            previousRaisedAmount
          );
        } catch (notifyError) {
          console.error('[Crowdfunding] Error sending milestone notifications:', notifyError);
          // No lanzar error, el pago ya fue confirmado
        }
      }
      
      return { success: true };
    }),
});

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

// ============================================================================
// FAVORITOS ROUTER
// ============================================================================

const favoritesRouter = router({
  getMyFavorites: protectedProcedure.query(async ({ ctx }) => {
    const favorites = await db.getUserFavoriteStations(ctx.user.id);
    // Obtener detalles de cada estación
    const stationsWithDetails = await Promise.all(
      favorites.map(async (fav) => {
        const station = await db.getChargingStationById(fav.stationId);
        const stationEvses = await db.getEvsesByStationId(fav.stationId);
        return station ? { ...fav, station, evses: stationEvses } : null;
      })
    );
    return stationsWithDetails.filter(Boolean);
  }),

  isFavorite: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.isFavoriteStation(ctx.user.id, input.stationId);
    }),

  toggle: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const isFav = await db.isFavoriteStation(ctx.user.id, input.stationId);
      if (isFav) {
        await db.removeFavoriteStation(ctx.user.id, input.stationId);
        return { isFavorite: false };
      } else {
        await db.addFavoriteStation(ctx.user.id, input.stationId);
        return { isFavorite: true };
      }
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  stations: stationsRouter,
  evses: evseRouter,
  tariffs: tariffsRouter,
  transactions: transactionsRouter,
  reservations: reservationsRouter,
  wallet: walletRouter,
  maintenance: maintenanceRouter,
  notifications: notificationsRouter,
  support: supportRouter,
  investorStats: investorStatsRouter,
  platformStats: platformStatsRouter,
  banners: bannersRouter,
  ai: aiRouter,
  stripe: stripeRouter,
  wompi: wompiRouter,
  settings: settingsRouter,
  ocpp: ocppRouter,
  dashboard: dashboardRouter,
  charging: chargingRouter,
  push: pushRouter,
  payouts: payoutsRouter,
  crowdfunding: crowdfundingRouter,
  event: eventRouter,
  favorites: favoritesRouter,
});

export type AppRouter = typeof appRouter;
