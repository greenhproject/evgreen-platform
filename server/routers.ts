import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getDb } from "./db";
import { users, userVehicles, favoriteStations, notifications } from "../drizzle/schema";
import { eq } from "drizzle-orm";
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

// Procedimiento para ingeniero jefe (control total del área técnica)
const engineerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "engineer" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Se requiere rol de ingeniero o administrador.",
    });
  }
  return next({ ctx });
});

// Procedimiento para técnicos (incluye engineer que puede hacer todo lo del técnico)
const technicianProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "technician" && ctx.user.role !== "engineer" && ctx.user.role !== "admin" && ctx.user.role !== "staff") {
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
      role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer"]).optional(),
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
      role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer"]),
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
        role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer"]).optional(),
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
          // Usar precio efectivo (tarifa de estación o precios globales)
          const effectivePrice = await db.getEffectiveStationPrice(station.id);
          return {
            ...station,
            evses,
            pricePerKwh: tariff?.pricePerKwh || effectivePrice.pricePerKwh.toString(),
            reservationFee: tariff?.reservationFee || effectivePrice.reservationFee.toString(),
            overstayPenaltyPerMin: tariff?.overstayPenaltyPerMinute || effectivePrice.overstayPenaltyPerMin.toString(),
            connectionFee: tariff?.pricePerSession || effectivePrice.connectionFee.toString(),
            tariffId: tariff?.id || null,
          };
        })
      );
      
      return stationsWithData;
    }),
  
  // Admin/Técnico: listar todas las estaciones
  listAll: technicianProcedure.query(async () => {
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
  
  create: technicianProcedure
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
      // Admin, staff, técnico o el dueño pueden actualizar
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "technician" && ctx.user.role !== "engineer" && station.ownerId !== ctx.user.id) {
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
  
  // Eliminar estación (admin/técnico)
  delete: technicianProcedure
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
  create: technicianProcedure
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
  
  update: technicianProcedure
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
  
  delete: technicianProcedure
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
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "engineer" && station.ownerId !== ctx.user.id) {
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
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "engineer" && station?.ownerId !== ctx.user.id) {
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
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff" && ctx.user.role !== "engineer" && station.ownerId !== ctx.user.id) {
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
      defaultBasePricePerKwh: z.number().min(100).max(10000).optional(),
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
          message: "El precio m\u00ednimo debe ser menor al m\u00e1ximo" 
        });
      }
      // Validar que el precio base est\u00e9 dentro del rango global
      if (input.defaultBasePricePerKwh !== undefined) {
        if (input.defaultBasePricePerKwh < input.minPrice || input.defaultBasePricePerKwh > input.maxPrice) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `El precio base ($${input.defaultBasePricePerKwh}) debe estar dentro del rango global ($${input.minPrice} - $${input.maxPrice})` 
          });
        }
      }
      // Validar que AC sea menor que DC si precios diferenciados est\u00e1n habilitados
      if (input.enableDifferentiatedPricing && input.defaultPricePerKwhAC && input.defaultPricePerKwhDC) {
        if (input.defaultPricePerKwhAC > input.defaultPricePerKwhDC) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "El precio AC (carga lenta) debe ser menor o igual al precio DC (carga r\u00e1pida)" 
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
        input.enableDifferentiatedPricing,
        input.defaultBasePricePerKwh
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
        pricePerKwh: tariff?.pricePerKwh ? parseFloat(tariff.pricePerKwh) : (await db.getEffectiveStationPrice(transaction.stationId)).pricePerKwh,
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
  
  // Admin: Limpiar transacciones huérfanas manualmente
  cleanupOrphaned: adminProcedure
    .mutation(async () => {
      const orphanedCount = await db.cleanupOrphanedTransactions(60);
      const corruptedCount = await db.cleanupCorruptedTransactions();
      return {
        orphanedCleaned: orphanedCount,
        corruptedCleaned: corruptedCount,
        totalCleaned: orphanedCount + corruptedCount,
        message: `Limpieza completada: ${orphanedCount} huérfanas y ${corruptedCount} corruptas cerradas`,
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
      // Obtener tarifa de la estación (usa precios globales si no tiene tarifa propia)
      const effectivePriceForStop = await db.getEffectiveStationPrice(transaction.stationId);
      const pricePerKwh = effectivePriceForStop.pricePerKwh;
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
  
  // Ingeniero/Admin: todos los tickets
  listAll: engineerProcedure
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
  
  // Upload photo for a ticket
  uploadPhoto: technicianProcedure
    .input(z.object({
      ticketId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().refine(
        (ct) => ["image/jpeg", "image/png", "image/webp"].includes(ct),
        { message: "Solo se permiten im\u00e1genes (JPEG, PNG, WebP)" }
      ),
      photoType: z.enum(["before", "after", "evidence"]).default("evidence"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("./storage");
      const ext = input.fileName.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `maintenance/ticket-${input.ticketId}/${input.photoType}-${timestamp}-${randomSuffix}.${ext}`;
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La imagen no puede superar 10MB" });
      }
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      const ticket = await db.getMaintenanceTicketById(input.ticketId);
      const existingAttachments = (ticket?.attachments as any[]) || [];
      const newAttachment = {
        url,
        fileKey,
        type: input.photoType,
        fileName: input.fileName,
        uploadedBy: ctx.user.name || ctx.user.email,
        uploadedAt: new Date().toISOString(),
      };
      await db.updateMaintenanceTicket(input.ticketId, {
        attachments: [...existingAttachments, newAttachment],
      });
      return { url, fileKey, attachment: newAttachment };
    }),

  // Delete a photo from a ticket
  deletePhoto: technicianProcedure
    .input(z.object({
      ticketId: z.number(),
      fileKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      const ticket = await db.getMaintenanceTicketById(input.ticketId);
      const existingAttachments = (ticket?.attachments as any[]) || [];
      const filtered = existingAttachments.filter((a: any) => a.fileKey !== input.fileKey);
      await db.updateMaintenanceTicket(input.ticketId, { attachments: filtered });
      return { success: true };
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
        technicianId: ctx.user.id,
        status: "PENDING",
      });
      // Notify admin if critical priority
      if (input.priority === "CRITICAL") {
        try {
          const { sendTicketEmailToAdmin } = await import("./notifications/ticket-email-service");
          await sendTicketEmailToAdmin({
            type: "critical_created",
            ticketId: id,
            title: input.title,
            priority: "CRITICAL",
            stationId: input.stationId,
            technicianName: ctx.user.name || ctx.user.email || "T\u00e9cnico",
          });
        } catch (e) { console.error("[Ticket] Error sending admin email:", e); }
      }
      return { id };
    }),

  // Get a single ticket by ID
  getById: technicianProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getMaintenanceTicketById(input.id);
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
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { ...input.data };
      if (input.data.status === "IN_PROGRESS" && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (input.data.status === "COMPLETED" && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }
      await db.updateMaintenanceTicket(input.id, updateData);
      // Send admin email notifications on resolve/cancel
      if (input.data.status === "COMPLETED" || input.data.status === "CANCELLED") {
        try {
          const ticket = await db.getMaintenanceTicketById(input.id);
          const { sendTicketEmailToAdmin } = await import("./notifications/ticket-email-service");
          await sendTicketEmailToAdmin({
            type: input.data.status === "COMPLETED" ? "resolved" : "cancelled",
            ticketId: input.id,
            title: ticket?.title || "Ticket",
            priority: ticket?.priority || "MEDIUM",
            stationId: ticket?.stationId || 0,
            stationName: ticket?.stationName || undefined,
            technicianName: ctx.user.name || ctx.user.email || "T\u00e9cnico",
            resolution: input.data.resolution,
            laborCost: input.data.laborCost,
          });
        } catch (e) { console.error("[Ticket] Error sending admin email:", e); }
      }
      return { success: true };
    }),
  
  // Ingeniero/Admin: asignar técnico a un ticket
  assignTechnician: engineerProcedure
    .input(z.object({
      ticketId: z.number(),
      technicianId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const technician = await db.getUserById(input.technicianId);
      if (!technician || (technician.role !== "technician" && technician.role !== "engineer")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario seleccionado no es un técnico válido." });
      }
      await db.updateMaintenanceTicket(input.ticketId, {
        technicianId: input.technicianId,
      });
      // Notificar al técnico asignado
      try {
        const ticket = await db.getMaintenanceTicketById(input.ticketId);
        await db.createNotification({
          userId: input.technicianId,
          title: "\ud83d\udcdd Ticket asignado",
          message: `El Ing. ${ctx.user.name || "Jefe"} te asign\u00f3 el ticket #${input.ticketId}: ${ticket?.title || "Sin t\u00edtulo"}`,
          type: "SYSTEM",
          isRead: false,
        });
      } catch (e) { console.error("[Ticket] Error notifying technician:", e); }
      return { success: true };
    }),

  // Ingeniero/Admin: cambiar prioridad de un ticket
  updatePriority: engineerProcedure
    .input(z.object({
      ticketId: z.number(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateMaintenanceTicket(input.ticketId, {
        priority: input.priority,
      });
      return { success: true };
    }),

  // Ingeniero/Admin: listar técnicos disponibles para asignación
  listTechnicians: engineerProcedure.query(async () => {
    const allUsers = await db.getAllUsers();
    return allUsers.filter((u: any) => u.role === "technician" || u.role === "engineer").map((u: any) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      role: u.role,
      assignedRegion: u.assignedRegion,
      isActive: u.isActive,
    }));
  }),

  // Ingeniero/Admin: estadísticas de operaciones
  operationsStats: engineerProcedure.query(async () => {
    const allTickets = await db.getAllMaintenanceTickets();
    const pending = allTickets.filter((t: any) => t.status === "PENDING").length;
    const inProgress = allTickets.filter((t: any) => t.status === "IN_PROGRESS").length;
    const completed = allTickets.filter((t: any) => t.status === "COMPLETED").length;
    const cancelled = allTickets.filter((t: any) => t.status === "CANCELLED").length;
    const critical = allTickets.filter((t: any) => t.priority === "CRITICAL" && t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
    const high = allTickets.filter((t: any) => t.priority === "HIGH" && t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
    
    // Calcular tiempo promedio de resolución
    const resolvedTickets = allTickets.filter((t: any) => t.status === "COMPLETED" && t.completedAt && t.createdAt);
    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum: number, t: any) => {
        const created = new Date(t.createdAt).getTime();
        const completed = new Date(t.completedAt).getTime();
        return sum + (completed - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedTickets.length * 10) / 10;
    }

    // Tickets por técnico
    const technicianMap = new Map<number, { name: string; count: number; completed: number; pending: number }>();
    for (const t of allTickets) {
      if (t.technicianId) {
        if (!technicianMap.has(t.technicianId)) {
          technicianMap.set(t.technicianId, { name: (t as any).technicianName || `Técnico #${t.technicianId}`, count: 0, completed: 0, pending: 0 });
        }
        const entry = technicianMap.get(t.technicianId)!;
        entry.count++;
        if (t.status === "COMPLETED") entry.completed++;
        if (t.status === "PENDING" || t.status === "IN_PROGRESS") entry.pending++;
      }
    }

    return {
      total: allTickets.length,
      pending,
      inProgress,
      completed,
      cancelled,
      critical,
      high,
      avgResolutionHours,
      completionRate: allTickets.length > 0 ? Math.round((completed / allTickets.length) * 100) : 0,
      byTechnician: Array.from(technicianMap.entries()).map(([id, data]) => ({ id, ...data })),
    };
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
  
  // Upload de imagen de banner a S3
  uploadImage: adminProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(), // Base64-encoded file data
      contentType: z.string().refine(
        (ct) => ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(ct),
        { message: "Solo se permiten im\u00e1genes (JPEG, PNG, WebP, GIF, SVG)" }
      ),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("./storage");
      
      // Generar nombre único para evitar colisiones
      const ext = input.fileName.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `banners/${timestamp}-${randomSuffix}.${ext}`;
      
      // Decodificar base64 a buffer
      const buffer = Buffer.from(input.fileBase64, "base64");
      
      // Validar tama\u00f1o (m\u00e1x 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La imagen no puede superar 5MB",
        });
      }
      
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      
      return { url, fileKey };
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
        // Evento
        eventName: "Gran Lanzamiento Red de Carga EVGreen",
        eventDate: "Por confirmar",
        eventTime: "Por confirmar",
        eventVenueName: "Por confirmar",
        eventAddress: "Bogotá, Colombia",
        eventCity: "Bogotá",
        eventContactPhone: "",
        eventContactEmail: "evgreen@greenhproject.com",
        eventGoogleMapsUrl: "",
        eventWazeUrl: "",
        eventDressCode: "Business Casual",
        eventDescription: "",
        eventMaxGuests: 30,
        eventBgImageUrl: "",
      };
    }
    // Ocultar claves secretas parcialmente y retornar todos los campos explícitamente
    return {
      id: settings.id,
      companyName: settings.companyName,
      businessLine: settings.businessLine,
      nit: settings.nit,
      contactEmail: settings.contactEmail,
      investorPercentage: settings.investorPercentage,
      platformFeePercentage: settings.platformFeePercentage,
      wompiPublicKey: settings.wompiPublicKey || "",
      wompiPrivateKey: settings.wompiPrivateKey ? "prv_****" + settings.wompiPrivateKey.slice(-4) : "",
      wompiIntegritySecret: settings.wompiIntegritySecret ? "****" + settings.wompiIntegritySecret.slice(-4) : "",
      wompiEventsSecret: settings.wompiEventsSecret ? "****" + settings.wompiEventsSecret.slice(-4) : "",
      wompiTestMode: settings.wompiTestMode,
      enableEnergyBilling: settings.enableEnergyBilling,
      enableReservationBilling: settings.enableReservationBilling,
      enableOccupancyPenalty: settings.enableOccupancyPenalty,
      notifyChargeComplete: settings.notifyChargeComplete,
      notifyReservationReminder: settings.notifyReservationReminder,
      notifyPromotions: settings.notifyPromotions,
      upmeEndpoint: settings.upmeEndpoint || "",
      upmeToken: settings.upmeToken ? "****" + settings.upmeToken.slice(-4) : "",
      upmeAutoReport: settings.upmeAutoReport,
      ocppPort: settings.ocppPort,
      ocppServerActive: settings.ocppServerActive,
      factorUtilizacionPremium: settings.factorUtilizacionPremium,
      costosOperativosIndividual: settings.costosOperativosIndividual,
      costosOperativosColectivo: settings.costosOperativosColectivo,
      costosOperativosAC: settings.costosOperativosAC,
      eficienciaCargaDC: settings.eficienciaCargaDC,
      eficienciaCargaAC: settings.eficienciaCargaAC,
      costoEnergiaRed: settings.costoEnergiaRed,
      costoEnergiaSolar: settings.costoEnergiaSolar,
      precioVentaDefault: settings.precioVentaDefault,
      precioVentaMin: settings.precioVentaMin,
      precioVentaMax: settings.precioVentaMax,
      // Evento - campos explícitos para que tRPC los incluya en el tipo
      eventName: settings.eventName || "Gran Lanzamiento Red de Carga EVGreen",
      eventDate: settings.eventDate || "Por confirmar",
      eventTime: settings.eventTime || "Por confirmar",
      eventVenueName: settings.eventVenueName || "Por confirmar",
      eventAddress: settings.eventAddress || "Bogotá, Colombia",
      eventCity: settings.eventCity || "Bogotá",
      eventContactPhone: settings.eventContactPhone || "",
      eventContactEmail: settings.eventContactEmail || "evgreen@greenhproject.com",
      eventGoogleMapsUrl: settings.eventGoogleMapsUrl || "",
      eventWazeUrl: settings.eventWazeUrl || "",
      eventDressCode: settings.eventDressCode || "Business Casual",
      eventDescription: settings.eventDescription || "",
      eventMaxGuests: settings.eventMaxGuests || 30,
      eventBgImageUrl: settings.eventBgImageUrl || "",
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
      // Configuración del evento de lanzamiento
      eventName: z.string().optional(),
      eventDate: z.string().optional(),
      eventTime: z.string().optional(),
      eventVenueName: z.string().optional(),
      eventAddress: z.string().optional(),
      eventCity: z.string().optional(),
      eventContactPhone: z.string().optional(),
      eventContactEmail: z.string().optional(),
      eventGoogleMapsUrl: z.string().optional(),
      eventWazeUrl: z.string().optional(),
      eventDressCode: z.string().optional(),
      eventDescription: z.string().optional(),
      eventMaxGuests: z.number().min(1).optional(),
      eventBgImageUrl: z.string().optional(),
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

// ============================================================================
// VEHICLES ROUTER - Gestión de vehículos del usuario
// ============================================================================

const connectorTypeValues = ["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"] as const;

// ============================================================================
// TECHNICIAN CONFIG ROUTER - Preferencias de configuración del técnico
// ============================================================================

const techConfigRouter = router({
  // Obtener configuración del técnico
  get: technicianProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      return {
        notifyNewTickets: true,
        notifyCriticalAlerts: true,
        notifyMaintenanceReminders: true,
        notifyByEmail: true,
        notifyByPush: true,
        defaultView: "dashboard",
        autoRefreshLogs: true,
        refreshInterval: 30,
        availableForEmergencies: true,
        workingHoursStart: "08:00",
        workingHoursEnd: "18:00",
      };
    }
    const [user] = await database
      .select({
        notifyNewTickets: users.techNotifyNewTickets,
        notifyCriticalAlerts: users.techNotifyCriticalAlerts,
        notifyMaintenanceReminders: users.techNotifyMaintenanceReminders,
        notifyByEmail: users.techNotifyByEmail,
        notifyByPush: users.techNotifyByPush,
        defaultView: users.techDefaultView,
        autoRefreshLogs: users.techAutoRefreshLogs,
        refreshInterval: users.techRefreshInterval,
        availableForEmergencies: users.techAvailableForEmergencies,
        workingHoursStart: users.techWorkingHoursStart,
        workingHoursEnd: users.techWorkingHoursEnd,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      notifyNewTickets: user?.notifyNewTickets ?? true,
      notifyCriticalAlerts: user?.notifyCriticalAlerts ?? true,
      notifyMaintenanceReminders: user?.notifyMaintenanceReminders ?? true,
      notifyByEmail: user?.notifyByEmail ?? true,
      notifyByPush: user?.notifyByPush ?? true,
      defaultView: user?.defaultView ?? "dashboard",
      autoRefreshLogs: user?.autoRefreshLogs ?? true,
      refreshInterval: user?.refreshInterval ?? 30,
      availableForEmergencies: user?.availableForEmergencies ?? true,
      workingHoursStart: user?.workingHoursStart ?? "08:00",
      workingHoursEnd: user?.workingHoursEnd ?? "18:00",
    };
  }),

  // Guardar configuración del técnico
  save: technicianProcedure
    .input(z.object({
      notifyNewTickets: z.boolean().optional(),
      notifyCriticalAlerts: z.boolean().optional(),
      notifyMaintenanceReminders: z.boolean().optional(),
      notifyByEmail: z.boolean().optional(),
      notifyByPush: z.boolean().optional(),
      defaultView: z.enum(["dashboard", "tickets", "alerts", "stations"]).optional(),
      autoRefreshLogs: z.boolean().optional(),
      refreshInterval: z.number().min(10).max(300).optional(),
      availableForEmergencies: z.boolean().optional(),
      workingHoursStart: z.string().optional(),
      workingHoursEnd: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await database.update(users).set({
        techNotifyNewTickets: input.notifyNewTickets ?? undefined,
        techNotifyCriticalAlerts: input.notifyCriticalAlerts ?? undefined,
        techNotifyMaintenanceReminders: input.notifyMaintenanceReminders ?? undefined,
        techNotifyByEmail: input.notifyByEmail ?? undefined,
        techNotifyByPush: input.notifyByPush ?? undefined,
        techDefaultView: input.defaultView ?? undefined,
        techAutoRefreshLogs: input.autoRefreshLogs ?? undefined,
        techRefreshInterval: input.refreshInterval ?? undefined,
        techAvailableForEmergencies: input.availableForEmergencies ?? undefined,
        techWorkingHoursStart: input.workingHoursStart ?? undefined,
        techWorkingHoursEnd: input.workingHoursEnd ?? undefined,
      }).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // Obtener estadísticas del técnico
  getStats: technicianProcedure.query(async ({ ctx }) => {
    const tickets = await db.getMaintenanceTicketsByTechnician(ctx.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = tickets.filter((t: any) => t.status === "PENDING").length;
    const inProgress = tickets.filter((t: any) => t.status === "IN_PROGRESS").length;
    const completedTotal = tickets.filter((t: any) => t.status === "COMPLETED").length;
    const completedToday = tickets.filter((t: any) => {
      if (t.status !== "COMPLETED" || !t.completedAt) return false;
      return new Date(t.completedAt) >= today;
    }).length;
    const critical = tickets.filter((t: any) => t.priority === "CRITICAL" && t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
    const avgResolutionTime = tickets
      .filter((t: any) => t.status === "COMPLETED" && t.startedAt && t.completedAt)
      .reduce((acc: number, t: any, _: number, arr: any[]) => {
        const start = new Date(t.startedAt).getTime();
        const end = new Date(t.completedAt).getTime();
        return acc + (end - start) / arr.length;
      }, 0);

    return {
      pending,
      inProgress,
      completedTotal,
      completedToday,
      critical,
      totalTickets: tickets.length,
      avgResolutionTimeMs: avgResolutionTime,
    };
  }),
});

// ============================================================================
// USER CONFIG ROUTER - Preferencias de configuración del usuario
// ============================================================================

const userConfigRouter = router({
  // Obtener configuración del usuario
  get: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      return {
        language: "es",
        distanceUnit: "km",
        currency: "COP",
        autoLocate: true,
        saveHistory: true,
        shareUsageData: false,
      };
    }
    const [user] = await database
      .select({
        language: users.prefLanguage,
        distanceUnit: users.prefDistanceUnit,
        currency: users.prefCurrency,
        autoLocate: users.prefAutoLocate,
        saveHistory: users.prefSaveHistory,
        shareUsageData: users.prefShareUsageData,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      language: user?.language ?? "es",
      distanceUnit: user?.distanceUnit ?? "km",
      currency: user?.currency ?? "COP",
      autoLocate: user?.autoLocate ?? true,
      saveHistory: user?.saveHistory ?? true,
      shareUsageData: user?.shareUsageData ?? false,
    };
  }),

  // Guardar configuración del usuario
  save: protectedProcedure
    .input(z.object({
      language: z.enum(["es", "en"]).optional(),
      distanceUnit: z.enum(["km", "mi"]).optional(),
      currency: z.enum(["COP", "USD"]).optional(),
      autoLocate: z.boolean().optional(),
      saveHistory: z.boolean().optional(),
      shareUsageData: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.language !== undefined) updateData.prefLanguage = input.language;
      if (input.distanceUnit !== undefined) updateData.prefDistanceUnit = input.distanceUnit;
      if (input.currency !== undefined) updateData.prefCurrency = input.currency;
      if (input.autoLocate !== undefined) updateData.prefAutoLocate = input.autoLocate;
      if (input.saveHistory !== undefined) updateData.prefSaveHistory = input.saveHistory;
      if (input.shareUsageData !== undefined) updateData.prefShareUsageData = input.shareUsageData;

      if (Object.keys(updateData).length > 0) {
        await database
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));
      }

      return { success: true };
    }),

  // Limpiar caché del usuario (resetear datos locales)
  clearCache: protectedProcedure.mutation(async ({ ctx }) => {
    // Limpiar caché del servidor para este usuario (si existe)
    return { success: true, message: "Caché limpiado exitosamente" };
  }),

  // Eliminar todos los datos del usuario
  deleteAllData: protectedProcedure
    .input(z.object({
      confirmEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verificar que el email coincide con el del usuario
      const [user] = await database
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.email || user.email !== input.confirmEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El email de confirmación no coincide" });
      }

      // Eliminar datos asociados al usuario (en orden por dependencias)
      // 1. Eliminar vehículos
      await database.delete(userVehicles).where(eq(userVehicles.userId, ctx.user.id));
      // 2. Eliminar favoritos
      await database.delete(favoriteStations).where(eq(favoriteStations.userId, ctx.user.id));
      // 3. Eliminar notificaciones
      await database.delete(notifications).where(eq(notifications.userId, ctx.user.id));
      // 4. Resetear preferencias del usuario
      await database.update(users).set({
        prefLanguage: "es",
        prefDistanceUnit: "km",
        prefCurrency: "COP",
        prefAutoLocate: true,
        prefSaveHistory: true,
        prefShareUsageData: false,
        notifyChargingComplete: true,
        notifyLowBalance: true,
        notifyPromotions: true,
        notifyProximity: true,
        proximityRadiusKm: 5,
        fcmToken: null,
      }).where(eq(users.id, ctx.user.id));

      return { success: true, message: "Todos tus datos han sido eliminados" };
    }),
});

const vehiclesRouter = router({
  // Obtener todos los vehículos del usuario autenticado
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserVehicles(ctx.user.id);
  }),

  // Obtener un vehículo específico
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const vehicle = await db.getUserVehicleById(input.id, ctx.user.id);
      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehículo no encontrado" });
      }
      return vehicle;
    }),

  // Obtener el vehículo por defecto
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    return db.getDefaultVehicle(ctx.user.id);
  }),

  // Crear un nuevo vehículo
  create: protectedProcedure
    .input(
      z.object({
        brand: z.string().min(1, "La marca es requerida").max(100),
        model: z.string().min(1, "El modelo es requerido").max(100),
        year: z.number().min(1990).max(2030).optional(),
        licensePlate: z.string().max(20).optional(),
        batteryCapacityKwh: z.number().min(0).max(999).optional(),
        rangeKm: z.number().min(0).max(2000).optional(),
        connectorTypes: z.array(z.enum(connectorTypeValues)).min(1, "Selecciona al menos un tipo de conector"),
        maxChargePowerKw: z.number().min(0).max(999).optional(),
        isDefault: z.boolean().optional(),
        nickname: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.createUserVehicle({
        userId: ctx.user.id,
        brand: input.brand,
        model: input.model,
        year: input.year ?? null,
        licensePlate: input.licensePlate ?? null,
        batteryCapacityKwh: input.batteryCapacityKwh?.toString() ?? null,
        rangeKm: input.rangeKm ?? null,
        connectorTypes: input.connectorTypes,
        maxChargePowerKw: input.maxChargePowerKw?.toString() ?? null,
        isDefault: input.isDefault ?? false,
        nickname: input.nickname ?? null,
      });
      return { id, message: "Vehículo registrado exitosamente" };
    }),

  // Actualizar un vehículo existente
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        brand: z.string().min(1).max(100).optional(),
        model: z.string().min(1).max(100).optional(),
        year: z.number().min(1990).max(2030).nullable().optional(),
        licensePlate: z.string().max(20).nullable().optional(),
        batteryCapacityKwh: z.number().min(0).max(999).nullable().optional(),
        rangeKm: z.number().min(0).max(2000).nullable().optional(),
        connectorTypes: z.array(z.enum(connectorTypeValues)).min(1).optional(),
        maxChargePowerKw: z.number().min(0).max(999).nullable().optional(),
        isDefault: z.boolean().optional(),
        nickname: z.string().max(100).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Verificar que el vehículo existe y pertenece al usuario
      const existing = await db.getUserVehicleById(id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehículo no encontrado" });
      }

      const updateData: Record<string, unknown> = {};
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.year !== undefined) updateData.year = data.year;
      if (data.licensePlate !== undefined) updateData.licensePlate = data.licensePlate;
      if (data.batteryCapacityKwh !== undefined) updateData.batteryCapacityKwh = data.batteryCapacityKwh?.toString() ?? null;
      if (data.rangeKm !== undefined) updateData.rangeKm = data.rangeKm;
      if (data.connectorTypes !== undefined) updateData.connectorTypes = data.connectorTypes;
      if (data.maxChargePowerKw !== undefined) updateData.maxChargePowerKw = data.maxChargePowerKw?.toString() ?? null;
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
      if (data.nickname !== undefined) updateData.nickname = data.nickname;

      await db.updateUserVehicle(id, ctx.user.id, updateData);
      return { message: "Vehículo actualizado exitosamente" };
    }),

  // Eliminar un vehículo (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getUserVehicleById(input.id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehículo no encontrado" });
      }
      await db.deleteUserVehicle(input.id, ctx.user.id);
      return { message: "Vehículo eliminado exitosamente" };
    }),

  // Establecer un vehículo como predeterminado
  setDefault: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getUserVehicleById(input.id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehículo no encontrado" });
      }
      await db.setDefaultVehicle(input.id, ctx.user.id);
      return { message: "Vehículo establecido como predeterminado" };
    }),
});

// ============================================================================
// SECURITY ROUTER - 2FA, sesiones, seguridad de cuenta
// ============================================================================

import {
  generate2FASecret,
  verify2FAToken,
  disable2FA,
  get2FAStatus,
  getUserSessions,
  terminateSession,
  terminateAllOtherSessions,
  recordLoginSession,
} from "./security/security-service";

const securityRouter = router({
  // Obtener estado de 2FA
  get2FAStatus: protectedProcedure.query(async ({ ctx }) => {
    return get2FAStatus(ctx.user.id);
  }),

  // Generar secreto 2FA (paso 1: mostrar QR)
  setup2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const email = ctx.user.email || `user-${ctx.user.id}@evgreen.lat`;
    const result = await generate2FASecret(ctx.user.id, email);
    return {
      otpauthUrl: result.otpauthUrl,
      secret: result.secret, // Para entrada manual si no pueden escanear QR
    };
  }),

  // Verificar código 2FA (paso 2: confirmar y activar)
  verify2FA: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const isValid = await verify2FAToken(ctx.user.id, input.token);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido. Verifica e intenta de nuevo.",
        });
      }
      return { success: true, message: "2FA activado correctamente" };
    }),

  // Desactivar 2FA (requiere código válido)
  disable2FA: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const success = await disable2FA(ctx.user.id, input.token);
      if (!success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido. No se pudo desactivar 2FA.",
        });
      }
      return { success: true, message: "2FA desactivado" };
    }),

  // Obtener historial de sesiones
  getSessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return getUserSessions(ctx.user.id, input?.limit || 20);
    }),

  // Cerrar una sesión específica
  terminateSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await terminateSession(ctx.user.id, input.sessionId);
      return { success };
    }),

  // Cerrar todas las demás sesiones
  terminateAllOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const terminated = await terminateAllOtherSessions(ctx.user.id);
    return { terminated, message: `${terminated} sesiones cerradas` };
  }),

  // Registrar sesión actual (llamado al login)
  recordSession: protectedProcedure
    .input(z.object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const sessionId = await recordLoginSession(
        ctx.user.id,
        input?.userAgent,
        input?.ipAddress
      );
      return { sessionId };
    }),
});

// ============================================================================
// REVIEWS / CALIFICACIONES ROUTER
// ============================================================================

const reviewsRouter = router({
  getByStation: publicProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      const reviews = await db.getReviewsByStationId(input.stationId);
      const stats = await db.getStationAverageRating(input.stationId);
      return {
        reviews,
        averageRating: stats.averageRating ? Number(stats.averageRating) : null,
        totalReviews: stats.totalReviews,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      stationId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar si ya existe una review del usuario
      const existing = await db.getUserReviewForStation(ctx.user.id, input.stationId);
      if (existing) {
        // Actualizar review existente
        await db.updateStationReview(existing.id, {
          rating: input.rating,
          comment: input.comment,
        });
        return { id: existing.id, updated: true };
      }
      const id = await db.createStationReview({
        stationId: input.stationId,
        userId: ctx.user.id,
        rating: input.rating,
        comment: input.comment,
      });
      return { id, updated: false };
    }),

  getMyReview: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getUserReviewForStation(ctx.user.id, input.stationId);
    }),

  respondAsOwner: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      response: z.string().max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden responder' });
      }
      await db.updateStationReview(input.reviewId, {
        ownerResponse: input.response,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Admin can delete any, user can delete own
      if (ctx.user.role !== 'admin') {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { stationReviews: sr } = await import('../drizzle/schema');
        const { eq: eqOp } = await import('drizzle-orm');
        const [r] = await database.select().from(sr).where(eqOp(sr.id, input.reviewId)).limit(1);
        if (!r || r.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'No puedes eliminar esta calificación' });
        }
      }
      await db.deleteStationReview(input.reviewId);
      return { success: true };
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
  vehicles: vehiclesRouter,
  userConfig: userConfigRouter,
  techConfig: techConfigRouter,
  security: securityRouter,
  reviews: reviewsRouter,
});

export type AppRouter = typeof appRouter;
