import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

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
      if (input?.lat && input?.lng) {
        return db.getStationsNearLocation(input.lat, input.lng, input.radiusKm || 10);
      }
      return db.getAllChargingStations({ isActive: true, isPublic: true });
    }),
  
  // Admin: listar todas las estaciones
  listAll: adminProcedure.query(async () => {
    return db.getAllChargingStations();
  }),
  
  // Inversionista: listar sus estaciones
  listOwned: investorProcedure.query(async ({ ctx }) => {
    return db.getAllChargingStations({ ownerId: ctx.user.id });
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
      connectorType: z.enum(["TYPE_2", "CCS_2", "CHADEMO", "TYPE_1"]),
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
        connectorType: z.enum(["TYPE_2", "CCS_2", "CHADEMO", "TYPE_1"]).optional(),
        chargeType: z.enum(["AC", "DC"]).optional(),
        powerKw: z.string().optional(),
        maxVoltage: z.number().optional(),
        maxAmperage: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateEvse(input.id, input.data);
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
});

// ============================================================================
// TRANSACTIONS ROUTER
// ============================================================================

const transactionsRouter = router({
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
    }).optional())
    .query(async ({ input }) => {
      if (input?.stationId) {
        return db.getTransactionsByStationId(input.stationId, {
          startDate: input.startDate,
          endDate: input.endDate,
        });
      }
      // TODO: Implementar listado general con paginación
      return [];
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
  
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const transaction = await db.getTransactionById(input.id);
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      }
      // Verificar acceso
      if (ctx.user.role === "user" && transaction.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta transacción" });
      }
      return transaction;
    }),
  
  getMeterValues: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(async ({ input }) => {
      return db.getMeterValuesByTransactionId(input.transactionId);
    }),
});

// ============================================================================
// RESERVATIONS ROUTER
// ============================================================================

const reservationsRouter = router({
  myReservations: protectedProcedure.query(async ({ ctx }) => {
    return db.getReservationsByUserId(ctx.user.id);
  }),
  
  create: protectedProcedure
    .input(z.object({
      evseId: z.number(),
      stationId: z.number(),
      startTime: z.date(),
      endTime: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar que el EVSE esté disponible
      const evse = await db.getEvseById(input.evseId);
      if (!evse || evse.status !== "AVAILABLE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El conector no está disponible para reserva" });
      }
      
      // Verificar que no haya reserva activa
      const activeReservation = await db.getActiveReservation(input.evseId);
      if (activeReservation) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ya existe una reserva activa para este conector" });
      }
      
      // Obtener tarifa para el cargo de reserva
      const tariff = await db.getActiveTariffByStationId(input.stationId);
      const reservationFee = tariff?.reservationFee || "0";
      const noShowPenalty = tariff?.noShowPenalty || "0";
      
      // Calcular tiempo de expiración (15 minutos después del inicio)
      const expiryTime = new Date(input.startTime.getTime() + 15 * 60 * 1000);
      
      const id = await db.createReservation({
        evseId: input.evseId,
        userId: ctx.user.id,
        stationId: input.stationId,
        startTime: input.startTime,
        endTime: input.endTime,
        expiryTime,
        reservationFee,
        noShowPenalty,
        status: "ACTIVE",
      });
      
      // Actualizar estado del EVSE
      await db.updateEvseStatus(input.evseId, "RESERVED");
      
      return { id };
    }),
  
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
      
      await db.updateReservation(input.id, { status: "CANCELLED" });
      await db.updateEvseStatus(reservation.evseId, "AVAILABLE");
      
      return { success: true };
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
// MAIN APP ROUTER
// ============================================================================

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
});

export type AppRouter = typeof appRouter;
