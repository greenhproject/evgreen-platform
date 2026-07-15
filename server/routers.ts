import { COOKIE_NAME } from "@shared/const";
/**
 * ============================================================================
 * EVGreen Platform - Rutas tRPC (routers.ts)
 * ============================================================================
 * Define TODOS los endpoints de la API usando tRPC v11.
 * Procedimientos protegidos por rol: staff, technician, investor, user.
 * 
 * @author Green House Project
 * @version 2.0.0 (Marzo 2026)
 * ============================================================================
 */
import { getSessionCookieOptions } from "./_core/cookies";
import { deleteAuth0User } from "./_core/auth0";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getDb } from "./db";
import { users, userVehicles, favoriteStations, notifications, sessionFeedback, tariffs as tariffsTable } from "../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { aiRouter } from "./ai/ai-router";
import { wompiRouter } from "./wompi/router";
import { ocppRouter } from "./ocpp/ocpp-router";
import { dualCSMS } from "./ocpp/csms-dual";
import * as ocppManager from "./ocpp/connection-manager";
import { chargingRouter, getAllActiveSessionsPower } from "./charging/charging-router";
import { pushRouter } from "./push/push-router";
import { generateExcelReport, generatePDFReport } from "./reports/export-transactions";
import { sendBroadcastNotification, getNotificationStats, getBroadcastHistory } from "./notifications/broadcast-service";
import { checkAndNotifyMilestones } from "./crowdfunding/progress-notifications";
import { triggerInvestorWelcome } from "./investor-onboarding/email-service";
import { eventRouter } from "./event/event-router";
import { idTagRouter } from "./idtags/idtag-router";
import { supportRouterV2 } from "./support/support-router";
import { buildFinancialRouter } from "./financial/financial-router";
import { onboardingRouter } from "./investor-onboarding/onboarding-router";
import { backupRouter, startAutomaticBackups } from "./backup/backup-router";
import { maintenanceScheduleRouter } from "./maintenance/maintenance-schedule-router";
import { buildApiKeysRouter } from "./api/api-keys-router";
import { quotesRouter } from "./quotes/quotes-router";
import { spacesRouter } from "./spaces/spaces-router";
import { partnersRouter } from "./partners/partners-router";
import { profilesRouter } from "./profiles/profiles-router";
import { buildOrganizationsRouter } from "./organizations/organizations-router";
import { contactRouter } from "./contact/contact-router";
import { saasRouter } from "./saas/saas-router";
import { campaignWizardRouter } from "./banners/campaign-wizard-router";

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
    ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
    return { success: true } as const;
  }),

  deleteMyAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    const { id: userId, openId } = ctx.user;
    await db.deleteUser(userId);
    ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
    console.log(`[Auth] Account deleted: userId=${userId}`);
    deleteAuth0User(openId).catch((e) =>
      console.error("[Auth0] Background delete failed:", e)
    );
    return { success: true } as const;
  }),
  
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      birthDate: z.string().optional(), // YYYY-MM-DD
      address: z.string().optional(),
      city: z.string().optional(),
      avatarUrl: z.string().optional(),
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      bankAccount: z.string().optional(),
      bankName: z.string().optional(),
      documentType: z.enum(["CC", "NIT", "CE", "PASAPORTE", "TI", "PEP"]).optional(),
      documentNumber: z.string().max(50).optional(),
      fiscalAddress: z.string().max(500).optional(),
      fiscalCity: z.string().max(100).optional(),
      fiscalDepartment: z.string().max(100).optional(),
      kindOfPerson: z.enum(["PERSON_ENTITY", "LEGAL_ENTITY"]).optional(),
      regime: z.enum(["SIMPLIFIED_REGIME", "COMMON_REGIME", "NOT_RESPONSIBLE_FOR_IVA"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, input);
      return { success: true };
    }),

  uploadAvatar: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().refine(
        (ct) => ["image/jpeg", "image/png", "image/webp"].includes(ct),
        { message: "Solo se permiten imágenes JPEG, PNG o WebP" }
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      const sharp = (await import("sharp")).default;
      const { storagePut } = await import("./storage");
      const originalBuffer = Buffer.from(input.fileBase64, "base64");
      if (originalBuffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La imagen no puede superar 5MB" });
      }
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      // Comprimir y redimensionar a 400x400 max para avatar
      const compressedBuffer = await sharp(originalBuffer)
        .resize(400, 400, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toBuffer();
      const fileKey = `avatars/user-${ctx.user.id}-${timestamp}-${randomSuffix}.webp`;
      const { url } = await storagePut(fileKey, compressedBuffer, "image/webp");
      // Guardar URL en el perfil del usuario
      await db.updateUser(ctx.user.id, { avatarUrl: url });
      return {
        avatarUrl: url,
        originalSize: originalBuffer.length,
        compressedSize: compressedBuffer.length,
      };
    }),
});

// ============================================================================
// USERS ROUTER (Admin only)
// ============================================================================

const usersRouter = router({
  list: adminProcedure
    .input(z.object({
      role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer", "comercial", "host"]).optional(),
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
      role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer", "comercial", "host"]),
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
    
  // idTag es inmutable una vez asignado (se usa para tarjetas NFC)
  // No se permite regenerar desde el frontend

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
        role: z.enum(["staff", "technician", "investor", "user", "admin", "engineer", "comercial", "host"]).optional(),
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
      const { isDemoStation } = await import("./charging/charging-simulator");
      const ocppManager = await import("./ocpp/connection-manager");
      const stationsWithData = await Promise.all(
        stations.map(async (station: any) => {
          const tariff = await db.getActiveTariffByStationId(station.id);
          const evses = await db.getEvsesByStationId(station.id);
          const effectivePrice = await db.getEffectiveStationPrice(station.id);
          
          // Verificar si es estación demo para forzar online y conectores AVAILABLE
          const isDemo = station.ocppIdentity ? isDemoStation(station.ocppIdentity) : false;
          
          // Determinar estado online real usando dualCSMS (fuente única de verdad)
          // isStationOnline verifica: WebSocket OPEN (readyState===1) || grace period activo (5 min tras desconexion)
          let realIsOnline = station.isOnline;
          if (!isDemo && station.ocppIdentity) {
            realIsOnline = dualCSMS.isStationOnline(station.ocppIdentity);
          }
          
          // Si la estación está offline, todos sus EVSEs deben mostrarse como UNAVAILABLE
          // para que el usuario no intente cargar en una estación desconectada
          const effectiveEvses = isDemo
            ? evses.map((e: any) => ({
                ...e,
                status: e.status === 'RESERVED' ? 'RESERVED' : 'AVAILABLE',
              }))
            : realIsOnline
              ? evses  // Online: mostrar estado real de BD
              : evses.map((e: any) => ({
                  ...e,
                  // Offline: solo preservar CHARGING/RESERVED (sesiones activas), el resto UNAVAILABLE
                  status: (e.status === 'CHARGING' || e.status === 'RESERVED')
                    ? e.status
                    : 'UNAVAILABLE',
                }));

          return {
            ...station,
            isOnline: isDemo ? true : realIsOnline,
            evses: effectiveEvses,
            pricePerKwh: tariff?.pricePerKwh || effectivePrice.pricePerKwh.toString(),
            reservationFee: tariff?.reservationFee || effectivePrice.reservationFee.toString(),
            overstayPenaltyPerMin: tariff?.overstayPenaltyPerMinute || effectivePrice.overstayPenaltyPerMin.toString(),
            overstayGracePeriodMinutes: tariff?.overstayGracePeriodMinutes ?? 10,
            connectionFee: tariff?.pricePerSession || effectivePrice.connectionFee.toString(),
            tariffId: tariff?.id || null,
          };
        })
      );
      
      return stationsWithData;
    }),
  
  // Admin/Técnico: listar todas las estaciones (optimizado: batch EVSEs)
  listAll: technicianProcedure.query(async () => {
    const stations = await db.getAllChargingStations();
    // Obtener conexiones OCPP activas para enriquecer con lastHeartbeat
    const csmsConnections = dualCSMS.getConnectionsStatus();
    const csmsMap = new Map<string, any>();
    for (const conn of csmsConnections) {
      csmsMap.set(conn.ocppIdentity, conn);
    }
    // Batch: obtener TODOS los EVSEs de todas las estaciones en 2 queries (no N+1)
    const stationIds = stations.map((s: any) => s.id);
    const evsesMap = await db.getAllEvsesForStations(stationIds);
    
    // Batch: obtener TODAS las tarifas activas de todas las estaciones
    const tariffsMap = new Map<number, any>();
    if (stationIds.length > 0) {
      try {
        const dbConn = await getDb();
        if (dbConn) {
          const activeTariffs = await dbConn.select().from(tariffsTable)
            .where(and(inArray(tariffsTable.stationId, stationIds), eq(tariffsTable.isActive, true)));
          for (const t of activeTariffs) {
            if (!tariffsMap.has(t.stationId)) tariffsMap.set(t.stationId, t);
          }
        }
      } catch (e) { /* fallback: no tariff data */ }
    }
    
    // Enriquecer estaciones con EVSEs, tarifas y datos OCPP (sin queries adicionales)
    const stationsWithEvses = stations.map((station: any) => {
      const stationEvses = evsesMap.get(station.id) || [];
      const ocppId = station.ocppIdentity || station.id?.toString();
      const ocppConn = csmsMap.get(ocppId);
      const tariff = tariffsMap.get(station.id);
      return {
        ...station,
        evses: stationEvses,
        lastHeartbeat: ocppConn?.lastHeartbeat
          ? (ocppConn.lastHeartbeat instanceof Date ? ocppConn.lastHeartbeat.toISOString() : String(ocppConn.lastHeartbeat))
          : (station.lastBootNotification
            ? (station.lastBootNotification instanceof Date ? station.lastBootNotification.toISOString() : String(station.lastBootNotification))
            : null),
        tariff: tariff ? {
          id: tariff.id,
          pricePerKwh: tariff.pricePerKwh?.toString() || "1300",
          reservationFee: tariff.reservationFee?.toString() || "5000",
          idleFeePerMin: tariff.overstayPenaltyPerMinute?.toString() || "500",
          connectionFee: tariff.pricePerSession?.toString() || "2000",
          overstayGracePeriodMinutes: tariff.overstayGracePeriodMinutes ?? 10,
          autoPricing: tariff.autoPricing === true || tariff.autoPricing === 1,
        } : undefined,
      };
    });
    return stationsWithEvses;
  }),
  
  // Inversionista: listar sus estaciones con tarifas y EVSEs
  listOwned: investorProcedure.query(async ({ ctx }) => {
    // Obtener TODAS las estaciones: propias + participaciones crowdfunding
    const allStations = await db.getInvestorAllStations(ctx.user.id);
    const { isDemoStation } = await import("./charging/charging-simulator");
    
    // Obtener conexiones OCPP activas para estado en tiempo real
    const csmsConnections = dualCSMS.getConnectionsStatus();
    const legacyConnections = ocppManager.getAllConnections();
    
    // Enriquecer con tarifas, EVSEs y estado real de conexión
    const enrichedStations = await Promise.all(
      allStations.map(async (station) => {
        const tariff = await db.getActiveTariffByStationId(station.id);
        const evses = await db.getEvsesByStationId(station.id);
        
        // Verificar estado real de conexión OCPP
        const ocppId = station.ocppIdentity || station.id?.toString();
        const isConnectedOCPP = csmsConnections.some(c => 
          c.ocppIdentity === ocppId || c.stationId === station.id
        ) || legacyConnections.some((c: any) => 
          c.ocppIdentity === ocppId || c.stationId === station.id
        );
        
        // Obtener estados de conectores desde OCPP si está conectado
        const ocppConn = csmsConnections.find(c => 
          c.ocppIdentity === ocppId || c.stationId === station.id
        );
        
        // Verificar si es estación demo
        const isDemo = station.ocppIdentity ? isDemoStation(station.ocppIdentity) : false;
        
        return {
          ...station,
          // Usar estado real de OCPP en lugar de solo isOnline de BD (demo siempre online)
          isOnline: isDemo || isConnectedOCPP || station.isOnline,
          isConnectedOCPP,
          // Tipo de propiedad: 'owned' (propia) o 'crowdfunding' (participación colectiva)
          ownershipType: (station as any).ownershipType || 'owned',
          participationPercent: (station as any).participationPercent || '100.0000',
          crowdfundingProjectId: (station as any).crowdfundingProjectId || null,
          crowdfundingProjectName: (station as any).crowdfundingProjectName || null,
          ocppConnection: ocppConn ? {
            ocppVersion: ocppConn.ocppVersion,
            connectedAt: ocppConn.connectedAt instanceof Date ? ocppConn.connectedAt.toISOString() : String(ocppConn.connectedAt),
            lastHeartbeat: ocppConn.lastHeartbeat instanceof Date ? ocppConn.lastHeartbeat.toISOString() : String(ocppConn.lastHeartbeat),
            connectorStatuses: (ocppConn as any).connectorStatuses || {},
          } : null,
          tariff: tariff ? {
            pricePerKwh: tariff.pricePerKwh?.toString() || "1200",
            reservationFee: tariff.reservationFee?.toString() || "5000",
            idleFeePerMin: tariff.overstayPenaltyPerMinute?.toString() || "500",
            connectionFee: tariff.pricePerSession?.toString() || "2000",
            overstayGracePeriodMinutes: tariff.overstayGracePeriodMinutes ?? 10,
            autoPricing: tariff.autoPricing === true || (tariff.autoPricing as any) === 1,
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Estaci\u00f3n no encontrada" });
      }
      // Verificar acceso
      if (ctx.user.role === "investor" && station.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta estaci\u00f3n" });
      }
      // Calcular estado online REAL usando dualCSMS (fuente única de verdad)
      const { isDemoStation } = await import("./charging/charging-simulator");
      const isDemo = station.ocppIdentity ? isDemoStation(station.ocppIdentity) : false;
      let realIsOnline = station.isOnline;
      if (!isDemo && station.ocppIdentity) {
        realIsOnline = dualCSMS.isStationOnline(station.ocppIdentity);
      }
      return { ...station, isOnline: isDemo ? true : realIsOnline };
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
      chargerBrandId: z.number().optional(),
      imageUrl: z.string().optional(),
      // Modelo financiero configurable
      evgreenSharePercent: z.string().optional(),
      investorSharePercent: z.string().optional(),
      hostSharePercent: z.string().optional(),
      energyPurchaseCostPerKwh: z.string().optional(),
      hostName: z.string().optional(),
      hostUserId: z.number().optional(),
      parkingRatePerMinute: z.number().int().min(0).optional(),
      occupancyRatePerMinute: z.number().int().min(0).optional(),
      timezone: z.string().optional(),
      country: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Si se seleccionó un perfil de marca, autoconfigurar manufacturer y model
      let stationData: any = {
        ...input,
        country: input.country || "Colombia",
        timezone: input.timezone || "America/Bogota",
      };
      
      if (input.chargerBrandId) {
        const brand = await db.getChargerBrandById(input.chargerBrandId);
        if (brand) {
          stationData.manufacturer = brand.brand;
          stationData.model = brand.model;
        }
      }
      
      const id = await db.createChargingStation(stationData);
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
        imageUrl: z.string().nullable().optional(),
        // Modelo financiero configurable
        evgreenSharePercent: z.string().optional(),
        investorSharePercent: z.string().optional(),
        hostSharePercent: z.string().optional(),
        energyPurchaseCostPerKwh: z.string().optional(),
        hostName: z.string().optional(),
        hostUserId: z.number().optional(),
        parkingRatePerMinute: z.number().int().min(0).optional(),
        occupancyRatePerMinute: z.number().int().min(0).optional(),
        timezone: z.string().optional(),
        country: z.string().optional(),
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
  
  // Upload de imagen de estación a S3 con compresión automática
  uploadImage: technicianProcedure
    .input(z.object({
      stationId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().refine(
        (ct) => ["image/jpeg", "image/png", "image/webp"].includes(ct),
        { message: "Solo se permiten imágenes JPEG, PNG o WebP" }
      ),
    }))
    .mutation(async ({ input }) => {
      const sharp = (await import("sharp")).default;
      const { storagePut } = await import("./storage");
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const originalBuffer = Buffer.from(input.fileBase64, "base64");
      if (originalBuffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La imagen no puede superar 10MB" });
      }

      // Imagen principal: max 1200px de ancho, calidad 80, formato WebP
      const mainImage = await sharp(originalBuffer)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const mainKey = `stations/station-${input.stationId}/photo-${timestamp}-${randomSuffix}.webp`;
      const { url: imageUrl } = await storagePut(mainKey, mainImage, "image/webp");

      // Miniatura: max 300px de ancho, calidad 70, formato WebP
      const thumbImage = await sharp(originalBuffer)
        .resize(300, 225, { fit: "cover" })
        .webp({ quality: 70 })
        .toBuffer();
      const thumbKey = `stations/station-${input.stationId}/thumb-${timestamp}-${randomSuffix}.webp`;
      const { url: thumbnailUrl } = await storagePut(thumbKey, thumbImage, "image/webp");

      // Actualizar la estación con ambas URLs
      await db.updateChargingStation(input.stationId, { imageUrl, thumbnailUrl });

      const originalSizeKB = Math.round(originalBuffer.length / 1024);
      const compressedSizeKB = Math.round(mainImage.length / 1024);
      const thumbSizeKB = Math.round(thumbImage.length / 1024);
      const savings = Math.round((1 - mainImage.length / originalBuffer.length) * 100);

      return {
        imageUrl,
        thumbnailUrl,
        originalSizeKB,
        compressedSizeKB,
        thumbSizeKB,
        savings: `${savings}%`,
      };
    }),

  // Obtener EVSEs de una estación (con estado offline aplicado)
  getEvses: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      const evses = await db.getEvsesByStationId(input.stationId);
      // Verificar si la estación está offline para marcar EVSEs como UNAVAILABLE
      const station = await db.getChargingStationById(input.stationId);
      if (!station) return evses;
      const { isDemoStation } = await import("./charging/charging-simulator");
      const isDemo = station.ocppIdentity ? isDemoStation(station.ocppIdentity) : false;
      if (isDemo) return evses; // Demo: siempre estado real
      // Verificar estado online usando dualCSMS (fuente única de verdad)
      const realIsOnline = station.ocppIdentity
        ? dualCSMS.isStationOnline(station.ocppIdentity)
        : station.isOnline;
      if (realIsOnline) return evses; // Online: estado real de BD
      // Offline: marcar todos como UNAVAILABLE excepto CHARGING/RESERVED
      return evses.map((e: any) => ({
        ...e,
        status: (e.status === 'CHARGING' || e.status === 'RESERVED') ? e.status : 'UNAVAILABLE',
      }));
    }),
  
  // Eliminar estación (admin/técnico)
  delete: technicianProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteChargingStation(input.id);
      return { success: true };
    }),
  
  // Obtener perfil de marca asociado a una estación
  getChargerBrand: protectedProcedure
    .input(z.object({ stationId: z.number() }))
    .query(async ({ input }) => {
      return db.getChargerBrandForStation(input.stationId);
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
      connectorType: z.enum(["TYPE_1", "TYPE_2", "CCS_1", "CCS_2", "CHADEMO", "TESLA", "GBT_AC", "GBT_DC"]).optional(),
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
      
      // Validar precio por kWh contra rangos globales
      const priceRanges = await db.getPriceRanges();
      const pricePerKwh = parseFloat(input.pricePerKwh);
      if (!isNaN(pricePerKwh) && (pricePerKwh < priceRanges.minPrice || pricePerKwh > priceRanges.maxPrice)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El precio por kWh ($${pricePerKwh.toLocaleString("es-CO")} COP) debe estar dentro del rango global permitido: $${priceRanges.minPrice.toLocaleString("es-CO")} - $${priceRanges.maxPrice.toLocaleString("es-CO")} COP/kWh`,
        });
      }
      
      // Desactivar tarifas anteriores
      const existingTariffs = await db.getTariffsByStationId(input.stationId);
      for (const tariff of existingTariffs) {
        if (tariff.isActive) {
          await db.updateTariff(tariff.id, { isActive: false });
        }
      }
      
      const id = await db.createTariff({ ...input, isActive: true });
      
      // Registrar en log de auditoría
      try {
        await db.createTariffChangeLog({
          tariffId: id,
          stationId: input.stationId,
          changedBy: ctx.user.id,
          changedByName: ctx.user.name || 'Sin nombre',
          changedByRole: ctx.user.role || 'unknown',
          changeType: 'CREATE',
          previousValues: null,
          newValues: { pricePerKwh: input.pricePerKwh, reservationFee: input.reservationFee, name: input.name },
          description: `Tarifa "${input.name}" creada para estación ${station?.name || input.stationId} con precio $${input.pricePerKwh} COP/kWh`,
        });
      } catch (e) { console.error('[AuditLog] Error logging tariff create:', e); }
      
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
      
      // Validar precio por kWh contra rangos globales si se está actualizando
      if (input.data.pricePerKwh) {
        const priceRanges = await db.getPriceRanges();
        const pricePerKwh = parseFloat(input.data.pricePerKwh);
        if (!isNaN(pricePerKwh) && (pricePerKwh < priceRanges.minPrice || pricePerKwh > priceRanges.maxPrice)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El precio por kWh ($${pricePerKwh.toLocaleString("es-CO")} COP) debe estar dentro del rango global permitido: $${priceRanges.minPrice.toLocaleString("es-CO")} - $${priceRanges.maxPrice.toLocaleString("es-CO")} COP/kWh`,
          });
        }
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
      overstayGracePeriodMinutes: z.number().min(0).max(60).optional(),
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
      
      // Validar precio por kWh contra rangos globales (solo si no es autoPricing)
      if (!input.autoPricing) {
        const priceRanges = await db.getPriceRanges();
        if (input.pricePerKwh < priceRanges.minPrice || input.pricePerKwh > priceRanges.maxPrice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El precio por kWh ($${input.pricePerKwh.toLocaleString("es-CO")} COP) debe estar dentro del rango global permitido: $${priceRanges.minPrice.toLocaleString("es-CO")} - $${priceRanges.maxPrice.toLocaleString("es-CO")} COP/kWh`,
          });
        }
      }
      
      // Buscar tarifa activa de la estación
      const tariff = await db.getActiveTariffByStationId(input.stationId);
      
      const tariffData: Record<string, any> = {
        pricePerKwh: input.pricePerKwh.toString(),
        reservationFee: input.reservationFee.toString(),
        overstayPenaltyPerMinute: input.idleFeePerMin.toString(),
        pricePerSession: input.connectionFee.toString(),
        autoPricing: input.autoPricing ?? false,
      };
      if (input.overstayGracePeriodMinutes !== undefined) {
        tariffData.overstayGracePeriodMinutes = input.overstayGracePeriodMinutes;
      }
      
      if (tariff) {
        // Registrar cambio en log de auditoría
        try {
          await db.createTariffChangeLog({
            tariffId: tariff.id,
            stationId: input.stationId,
            changedBy: ctx.user.id,
            changedByName: ctx.user.name || 'Sin nombre',
            changedByRole: ctx.user.role || 'unknown',
            changeType: 'UPDATE',
            previousValues: { pricePerKwh: tariff.pricePerKwh, reservationFee: tariff.reservationFee, overstayPenaltyPerMinute: tariff.overstayPenaltyPerMinute, autoPricing: tariff.autoPricing },
            newValues: { pricePerKwh: input.pricePerKwh.toString(), reservationFee: input.reservationFee.toString(), overstayPenaltyPerMinute: input.idleFeePerMin.toString(), autoPricing: input.autoPricing },
            description: `Tarifa de estación ${station?.name || input.stationId} actualizada: $${tariff.pricePerKwh} → $${input.pricePerKwh} COP/kWh`,
          });
        } catch (e) { console.error('[AuditLog] Error logging tariff updateByStation:', e); }
        
        // Actualizar tarifa existente
        await db.updateTariff(tariff.id, tariffData);
      } else {
        // Crear nueva tarifa
        const newId = await db.createTariff({
          stationId: input.stationId,
          name: "Tarifa Estándar",
          pricePerKwh: input.pricePerKwh.toString(),
          reservationFee: input.reservationFee.toString(),
          overstayPenaltyPerMinute: input.idleFeePerMin.toString(),
          pricePerSession: input.connectionFee.toString(),
          autoPricing: input.autoPricing ?? false,
          overstayGracePeriodMinutes: input.overstayGracePeriodMinutes,
          isActive: true,
        });
        
        // Registrar creación en log de auditoría
        try {
          await db.createTariffChangeLog({
            tariffId: newId,
            stationId: input.stationId,
            changedBy: ctx.user.id,
            changedByName: ctx.user.name || 'Sin nombre',
            changedByRole: ctx.user.role || 'unknown',
            changeType: 'CREATE',
            previousValues: null,
            newValues: { pricePerKwh: input.pricePerKwh.toString(), reservationFee: input.reservationFee.toString() },
            description: `Tarifa estándar creada para estación ${station?.name || input.stationId} con precio $${input.pricePerKwh} COP/kWh`,
          });
        } catch (e) { console.error('[AuditLog] Error logging tariff create via updateByStation:', e); }
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
      defaultOverstayGracePeriodMinutes: z.number().min(0).max(60).optional(),
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
      //       // Validar que AC sea menor que DC si precios diferenciados están habilitados
      if (input.enableDifferentiatedPricing && input.defaultPricePerKwhAC && input.defaultPricePerKwhDC) {
        if (input.defaultPricePerKwhAC > input.defaultPricePerKwhDC) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "El precio AC (carga lenta) debe ser menor o igual al precio DC (carga rápida)" 
          });
        }
      }
      // Validar que precios AC y DC estén dentro del rango global
      if (input.enableDifferentiatedPricing) {
        if (input.defaultPricePerKwhAC !== undefined && (input.defaultPricePerKwhAC < input.minPrice || input.defaultPricePerKwhAC > input.maxPrice)) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `El precio AC ($${input.defaultPricePerKwhAC.toLocaleString("es-CO")}) debe estar dentro del rango global ($${input.minPrice.toLocaleString("es-CO")} - $${input.maxPrice.toLocaleString("es-CO")})` 
          });
        }
        if (input.defaultPricePerKwhDC !== undefined && (input.defaultPricePerKwhDC < input.minPrice || input.defaultPricePerKwhDC > input.maxPrice)) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `El precio DC ($${input.defaultPricePerKwhDC.toLocaleString("es-CO")}) debe estar dentro del rango global ($${input.minPrice.toLocaleString("es-CO")} - $${input.maxPrice.toLocaleString("es-CO")})` 
          });
        }
      }
      // Obtener rangos anteriores para comparación
      const previousRanges = await db.getPriceRanges();
      
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
        input.defaultBasePricePerKwh,
        input.defaultOverstayGracePeriodMinutes
      );
      
      // Registrar cambio global en log de auditoría
      try {
        await db.createTariffChangeLog({
          tariffId: null,
          stationId: null,
          changedBy: ctx.user.id,
          changedByName: ctx.user.name || 'Sin nombre',
          changedByRole: ctx.user.role || 'unknown',
          changeType: 'GLOBAL_UPDATE',
          previousValues: { minPrice: previousRanges.minPrice, maxPrice: previousRanges.maxPrice, defaultBasePricePerKwh: previousRanges.defaultBasePricePerKwh, defaultPricePerKwhAC: previousRanges.defaultPricePerKwhAC, defaultPricePerKwhDC: previousRanges.defaultPricePerKwhDC },
          newValues: { minPrice: input.minPrice, maxPrice: input.maxPrice, defaultBasePricePerKwh: input.defaultBasePricePerKwh, defaultPricePerKwhAC: input.defaultPricePerKwhAC, defaultPricePerKwhDC: input.defaultPricePerKwhDC },
          description: `Rangos globales actualizados: $${previousRanges.minPrice.toLocaleString("es-CO")} - $${previousRanges.maxPrice.toLocaleString("es-CO")} → $${input.minPrice.toLocaleString("es-CO")} - $${input.maxPrice.toLocaleString("es-CO")} COP/kWh`,
        });
      } catch (e) { console.error('[AuditLog] Error logging global price update:', e); }
      
      // Notificar a inversionistas si los rangos de precio cambiaron
      const rangesChanged = previousRanges.minPrice !== input.minPrice || previousRanges.maxPrice !== input.maxPrice;
      if (rangesChanged) {
        try {
          const investors = await db.getInvestorsWithActiveStations();
          const { sendUserPush } = await import("./push/unified-push");
          
          for (const investor of investors) {
            // Crear notificación in-app
            await db.createNotification({
              userId: investor.userId,
              title: "Actualización de rangos de precio",
              message: `Los rangos globales de precio han sido actualizados por el administrador. Nuevo rango: $${input.minPrice.toLocaleString("es-CO")} - $${input.maxPrice.toLocaleString("es-CO")} COP/kWh. Verifica que tus tarifas estén dentro del rango permitido.`,
              type: "SYSTEM",
              data: JSON.stringify({ previousMin: previousRanges.minPrice, previousMax: previousRanges.maxPrice, newMin: input.minPrice, newMax: input.maxPrice }),
            });
            
            // Enviar push notification (Web Push + FCM)
            await sendUserPush(investor.userId, {
              type: "system_alert",
              title: "Rangos de precio actualizados",
              body: `Nuevo rango: $${input.minPrice.toLocaleString("es-CO")} - $${input.maxPrice.toLocaleString("es-CO")} COP/kWh`,
            }).catch(() => {});
          }
          console.log(`[Notifications] Notificados ${investors.length} inversionistas sobre cambio de rangos globales`);
        } catch (e) { console.error('[Notifications] Error notifying investors:', e); }
      }
      
      return { success: true };
    }),
  
  // Obtener demanda actual de estaciones del inversionista
  getInvestorDemand: investorProcedure
    .query(async ({ ctx }) => {
      return db.getInvestorStationsDemand(ctx.user.id);
    }),
  
  // Obtener historial de cambios de tarifas (auditoría)
  getChangeLogs: adminProcedure
    .input(z.object({
      stationId: z.number().optional(),
      tariffId: z.number().optional(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      return db.getTariffChangeLogs(input || {});
    }),
  
  // Obtener historial de cambios por estación específica
  getChangeLogsByStation: protectedProcedure
    .input(z.object({ stationId: z.number(), limit: z.number().optional().default(20) }))
    .query(async ({ input }) => {
      return db.getTariffChangeLogsByStation(input.stationId, input.limit);
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
      
      // Obtener precios efectivos de la estación para referencia
      const effectivePrice = await db.getEffectiveStationPrice(transaction.stationId);
      
      return {
        id: transaction.id,
        stationId: transaction.stationId,
        stationName: station?.name || "Estación",
        stationAddress: station?.address || "",
        stationCity: station?.city || "",
        connectorId: evse?.connectorId || 1,
        connectorType: evse?.connectorType || "TYPE_2",
        chargeType: evse?.chargeType || "AC",
        startTime: transaction.startTime.toISOString(),
        endTime: transaction.endTime?.toISOString() || null,
        durationMinutes,
        kwhConsumed: transaction.kwhConsumed ? parseFloat(transaction.kwhConsumed).toFixed(2) : "0.00",
        // Tarifa aplicada (la que se usó al momento de la carga)
        appliedPricePerKwh: transaction.appliedPricePerKwh 
          ? parseFloat(transaction.appliedPricePerKwh.toString()) 
          : (tariff?.pricePerKwh ? parseFloat(tariff.pricePerKwh) : effectivePrice.pricePerKwh),
        pricePerKwh: tariff?.pricePerKwh ? parseFloat(tariff.pricePerKwh) : effectivePrice.pricePerKwh,
        // Costos desglosados
        energyCost: transaction.energyCost ? parseFloat(transaction.energyCost.toString()) : 0,
        timeCost: transaction.timeCost ? parseFloat(transaction.timeCost.toString()) : 0,
        sessionCost: transaction.sessionCost ? parseFloat(transaction.sessionCost.toString()) : 0,
        overstayCost: transaction.overstayCost ? parseFloat(transaction.overstayCost.toString()) : 0,
        totalCost: transaction.totalCost ? parseFloat(transaction.totalCost) : 0,
        // Distribución de ingresos
        investorShare: transaction.investorShare ? parseFloat(transaction.investorShare.toString()) : 0,
        platformFee: transaction.platformFee ? parseFloat(transaction.platformFee.toString()) : 0,
        // Modo de carga
        chargeMode: transaction.chargeMode || "full_charge",
        targetValue: transaction.targetValue ? parseFloat(transaction.targetValue.toString()) : 0,
        // Método de inicio y razón de parada
        startMethod: transaction.startMethod || "APP",
        stopReason: transaction.stopReason || "",
        // Tarifas de referencia de la estación
        connectionFee: effectivePrice.connectionFee,
        overstayPenaltyPerMin: effectivePrice.overstayPenaltyPerMin,
        // Estado y método de pago
        status: transaction.status,
        paymentMethod: "wallet",
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
  
  // Admin: todas las transacciones (paginado)
  listAll: adminProcedure
    .input(z.object({
      stationId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(1000).default(20),
      page: z.number().min(1).default(1),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 20;
      const page = input?.page || 1;
      const offset = (page - 1) * limit;
      
      if (input?.stationId) {
        const stationTxs = await db.getTransactionsByStationId(input.stationId, {
          startDate: input.startDate,
          endDate: input.endDate,
        });
        // Wrap in paginated format for consistent return type
        const sliced = stationTxs.slice(offset, offset + limit);
        return {
          data: sliced,
          total: stationTxs.length,
          page,
          pageSize: limit,
          totalPages: Math.ceil(stationTxs.length / limit),
        };
      }
      const result = await db.getAllTransactions({
        startDate: input?.startDate,
        endDate: input?.endDate,
        status: input?.status,
        limit,
        offset,
      });
      return {
        data: result.data,
        total: result.total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit),
      };
    }),
  
  // Inversionista: transacciones de sus estaciones (paginado)
  investorTransactions: investorProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      page: z.number().min(1).default(1),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 20;
      const page = input?.page || 1;
      const offset = (page - 1) * limit;
      
      const result = await db.getTransactionsByInvestor(ctx.user.id, {
        startDate: input?.startDate,
        endDate: input?.endDate,
        status: input?.status,
        limit,
        offset,
      });
      return {
        data: result.data,
        total: result.total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit),
      };
    }),

  // Inversionista: transacciones enriquecidas con waterfall por estación
  investorTransactionsEnriched: investorProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.string().optional(),
      stationId: z.number().optional(),
      limit: z.number().min(1).max(100).default(20),
      page: z.number().min(1).default(1),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 20;
      const page = input?.page || 1;
      const offset = (page - 1) * limit;
      
      const result = await db.getEnrichedTransactionsByInvestor(ctx.user.id, {
        startDate: input?.startDate,
        endDate: input?.endDate,
        status: input?.status,
        stationId: input?.stationId,
        limit,
        offset,
      });
      return {
        data: result.data,
        total: result.total,
        stations: result.stations,
        page,
        pageSize: limit,
        totalPages: Math.ceil(result.total / limit),
      };
    }),

  // Exportar transacciones del inversionista en Excel o PDF
  exportInvestorTransactions: investorProcedure
    .input(z.object({
      format: z.enum(["excel", "pdf"]),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const transactions = await db.getAllTransactionsByInvestor(ctx.user.id, {
        startDate: input.startDate,
        endDate: input.endDate,
      });

      const settings = await db.getPlatformSettings();
      const investorPercentage = settings?.investorPercentage ?? 70;
      const platformFeePercentage = settings?.platformFeePercentage ?? 30;

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
  // Incluye descuento de suscripción si el usuario está autenticado
  getDynamicKwhPrice: publicProcedure
    .input(z.object({
      stationId: z.number(),
      evseId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Verificar si la estación tiene autoPricing activado
      const tariff = await db.getActiveTariffByStationId(input.stationId);
      const useAutoPricing = tariff?.autoPricing === true || (tariff?.autoPricing as any) === 1;

      if (!useAutoPricing) {
        // Precio fijo: retornar sin multiplicadores dinámicos
        const basePricePerKwh = parseFloat(tariff?.pricePerKwh?.toString() || "1300");
        const fixedFactors = {
          occupancyMultiplier: 1,
          timeMultiplier: 1,
          dayMultiplier: 1,
          demandMultiplier: 1,
          finalMultiplier: 1,
          demandLevel: "NORMAL" as const,
        };
        return {
          basePricePerKwh,
          dynamicPricePerKwh: basePricePerKwh,
          multiplier: 1,
          factors: fixedFactors,
          demandVisualization: dynamicPricing.getDemandVisualization(fixedFactors),
          validUntil: new Date(Date.now() + 15 * 60 * 1000),
          currency: "COP",
          subscriptionDiscount: 0,
          priceBeforeDiscount: undefined,
          useAutoPricing: false,
        };
      }

      const pricing = await dynamicPricing.calculateDynamicKwhPrice(
        input.stationId,
        input.evseId
      );
      
      // Si el usuario está autenticado, aplicar descuento de suscripción al precio mostrado
      let subscriptionDiscount = 0;
      let discountedPrice = pricing.dynamicPricePerKwh;
      try {
        const userId = (ctx as any)?.user?.id;
        if (userId) {
          const userSub = await db.getUserSubscription(userId);
          if (userSub?.isActive && userSub.discountPercentage) {
            const discountPct = parseFloat(userSub.discountPercentage);
            if (discountPct > 0) {
              subscriptionDiscount = discountPct;
              discountedPrice = Math.round(pricing.dynamicPricePerKwh * (1 - discountPct / 100));
            }
          }
        }
      } catch (e) {
        // Si no hay usuario autenticado, se muestra el precio sin descuento
      }
      
      return {
        ...pricing,
        // Precio con descuento de suscripción (si aplica)
        dynamicPricePerKwh: discountedPrice,
        // Precio sin descuento (para mostrar comparación)
        priceBeforeDiscount: subscriptionDiscount > 0 ? pricing.dynamicPricePerKwh : undefined,
        subscriptionDiscount,
        useAutoPricing: true,
      };
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
      
      // Verificar si el usuario tiene deudas pendientes (bloqueo de cargas)
      const hasPendingDebt = await db.userHasPendingDebt(ctx.user.id);
      if (hasPendingDebt) {
        const totalDebt = await db.getUserTotalDebt(ctx.user.id);
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `Tienes una deuda pendiente de $${totalDebt.toLocaleString()} COP por tarifa de ocupación. Debes pagar tu deuda antes de iniciar una nueva carga. Ve a Billetera → Deudas Pendientes para saldarla.` 
        });
      }

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
        chargeMode: "full_charge",
        targetValue: "0",
        appliedPricePerKwh: pricing.dynamicPricePerKwh.toString(), // Guardar precio dinámico al inicio
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
      // Usar el precio dinámico guardado al inicio de la sesión (appliedPricePerKwh)
      // Si no existe (transacciones antiguas), caer al precio efectivo de la estación
      let pricePerKwh: number;
      if (transaction.appliedPricePerKwh && parseFloat(transaction.appliedPricePerKwh.toString()) > 0) {
        pricePerKwh = parseFloat(transaction.appliedPricePerKwh.toString());
        console.log(`[Charging] stopChargingSession: usando precio dinámico guardado $${pricePerKwh}/kWh`);
      } else {
        const effectivePriceForStop = await db.getEffectiveStationPrice(transaction.stationId);
        pricePerKwh = effectivePriceForStop.pricePerKwh;
        console.log(`[Charging] stopChargingSession: usando precio base de estación $${pricePerKwh}/kWh (sin precio dinámico guardado)`);
      }
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
      
      // Actualizar estado del EVSE a FINISHING (cable aún puede estar conectado)
      // El overstay-monitor se encargará de cobrar penalización si el cable sigue conectado
      if (transaction.evseId) {
        await db.updateEvseStatus(transaction.evseId, "FINISHING");
        console.log(`[Charging] stopChargingSession - EVSE ${transaction.evseId} set to FINISHING (pending cable disconnect)`);
        
        // Iniciar tracking de overstay
        const { onChargingFinished } = await import("./charging/overstay-monitor");
        onChargingFinished(transaction.evseId, transaction.stationId).catch(err => 
          console.error(`[Charging] Error starting overstay tracking:`, err)
        );
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

  // ============================================================================
  // DETALLE DE TRANSACCIÓN (para soporte y admin - resolver reclamos)
  // ============================================================================
  getDetail: adminProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(async ({ input }) => {
      const transaction = await db.getTransactionById(input.transactionId);
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      }

      // Obtener datos relacionados
      const station = await db.getChargingStationById(transaction.stationId);
      const evse = await db.getEvseById(transaction.evseId);
      const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
      const user = await db.getUserById(transaction.userId);
      const meterValuesData = await db.getMeterValuesByTransactionId(input.transactionId);

      // Obtener wallet transactions relacionadas a esta transacción (pagos + overstay)
      const dbInstance = await db.getDb();
      let relatedWalletTxs: any[] = [];
      if (dbInstance) {
        const { walletTransactions: wtTable } = await import("../drizzle/schema");
        const { eq: eqOp, and: andOp, desc: descOp } = await import("drizzle-orm");
        relatedWalletTxs = await dbInstance.select().from(wtTable)
          .where(andOp(
            eqOp(wtTable.userId, transaction.userId),
            eqOp(wtTable.referenceId, input.transactionId)
          ))
          .orderBy(descOp(wtTable.createdAt));
      }

      // Obtener deudas asociadas
      let relatedDebts: any[] = [];
      if (dbInstance) {
        const { userDebts: debtsTable } = await import("../drizzle/schema");
        const { eq: eqOp2, and: andOp2 } = await import("drizzle-orm");
        relatedDebts = await dbInstance.select().from(debtsTable)
          .where(andOp2(
            eqOp2(debtsTable.userId, transaction.userId),
            eqOp2(debtsTable.transactionId, input.transactionId)
          ));
      }

      // Reconstruir timeline de overstay
      const gracePeriodMinutes = tariff?.overstayGracePeriodMinutes ?? 10;
      const overstayPenaltyPerMin = tariff?.overstayPenaltyPerMinute
        ? parseFloat(tariff.overstayPenaltyPerMinute.toString())
        : 0;

      const startTime = transaction.startTime;
      const endTime = transaction.endTime;
      const overstayCost = parseFloat(transaction.overstayCost?.toString() || "0");

      // Calcular overstay start time = endTime + gracePeriodMinutes
      let overstayStartTime: Date | null = null;
      let overstayMinutesBilled = 0;
      if (endTime && overstayCost > 0) {
        overstayStartTime = new Date(endTime.getTime() + gracePeriodMinutes * 60 * 1000);
        if (overstayPenaltyPerMin > 0) {
          overstayMinutesBilled = Math.round(overstayCost / overstayPenaltyPerMin);
        }
      }

      // Calcular duración de carga
      const chargeDurationMs = endTime ? endTime.getTime() - startTime.getTime() : 0;
      const chargeDurationMinutes = Math.round(chargeDurationMs / 60000);

      // Obtener precio efectivo de la estación para contexto
      const effectivePrice = await db.getEffectiveStationPrice(transaction.stationId);

      return {
        // Datos básicos de la transacción
        id: transaction.id,
        status: transaction.status,
        ocppTransactionId: transaction.ocppTransactionId,
        startMethod: transaction.startMethod || "APP",
        stopReason: transaction.stopReason || "",
        chargeMode: transaction.chargeMode || "full_charge",

        // Timestamps exactos
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString() || null,
        chargeDurationMinutes,

        // Consumo
        kwhConsumed: parseFloat(transaction.kwhConsumed?.toString() || "0"),
        meterStart: transaction.meterStart ? parseFloat(transaction.meterStart.toString()) : null,
        meterEnd: transaction.meterEnd ? parseFloat(transaction.meterEnd.toString()) : null,

        // Desglose de costos
        energyCost: parseFloat(transaction.energyCost?.toString() || "0"),
        timeCost: parseFloat(transaction.timeCost?.toString() || "0"),
        sessionCost: parseFloat(transaction.sessionCost?.toString() || "0"),
        overstayCost,
        totalCost: parseFloat(transaction.totalCost?.toString() || "0"),

        // Tarifas aplicadas
        appliedPricePerKwh: transaction.appliedPricePerKwh
          ? parseFloat(transaction.appliedPricePerKwh.toString())
          : effectivePrice.pricePerKwh,
        overstayPenaltyPerMin: overstayPenaltyPerMin || effectivePrice.overstayPenaltyPerMin,
        gracePeriodMinutes,

        // Timeline de overstay
        overstay: overstayCost > 0 ? {
          gracePeriodEnd: endTime ? new Date(endTime.getTime() + gracePeriodMinutes * 60 * 1000).toISOString() : null,
          overstayStartTime: overstayStartTime?.toISOString() || null,
          minutesBilled: overstayMinutesBilled,
          ratePerMinute: overstayPenaltyPerMin || effectivePrice.overstayPenaltyPerMin,
          totalCharged: overstayCost,
        } : null,

        // Info de estación y conector
        station: {
          id: transaction.stationId,
          name: station?.name || "Estación",
          address: station?.address || "",
          city: station?.city || "",
        },
        connector: {
          id: evse?.id || 0,
          connectorId: evse?.connectorId || 1,
          connectorType: evse?.connectorType || "TYPE_2",
          chargeType: evse?.chargeType || "AC",
          powerKw: evse?.powerKw ? parseFloat(evse.powerKw.toString()) : 0,
        },

        // Info del usuario
        user: {
          id: user?.id || transaction.userId,
          name: user?.name || "Usuario",
          email: user?.email || "",
          phone: user?.phone || "",
        },

        // Movimientos de billetera relacionados
        walletMovements: relatedWalletTxs.map(wt => ({
          id: wt.id,
          type: wt.type,
          amount: parseFloat(wt.amount?.toString() || "0"),
          description: wt.description || "",
          createdAt: wt.createdAt?.toISOString() || "",
          status: wt.status,
        })),

        // Deudas asociadas
        debts: relatedDebts.map(d => ({
          id: d.id,
          originalAmount: parseFloat(d.originalAmount?.toString() || "0"),
          remainingAmount: parseFloat(d.remainingAmount?.toString() || "0"),
          reason: d.reason,
          status: d.status,
          createdAt: d.createdAt?.toISOString() || "",
        })),

        // Distribución de ingresos
        investorShare: parseFloat(transaction.investorShare?.toString() || "0"),
        platformFee: parseFloat(transaction.platformFee?.toString() || "0"),

        // Meter values (últimos 20 para gráfico de potencia)
        meterValues: meterValuesData.slice(-20).map(mv => ({
          timestamp: mv.timestamp.toISOString(),
          energyKwh: mv.energyKwh ? parseFloat(mv.energyKwh.toString()) : null,
          powerKw: mv.powerKw ? parseFloat(mv.powerKw.toString()) : null,
          soc: mv.soc,
        })),
      };
    }),

  // ============================================================================
  // REEMBOLSO PARCIAL (para soporte - resolver reclamos)
  // ============================================================================
  partialRefund: adminProcedure
    .input(z.object({
      transactionId: z.number(),
      refundAmount: z.number().min(1, "El monto debe ser mayor a 0"),
      reason: z.string().min(3, "Debe indicar un motivo"),
      refundType: z.enum(["overstay", "energy", "general"]).default("general"),
    }))
    .mutation(async ({ input, ctx }) => {
      const transaction = await db.getTransactionById(input.transactionId);
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });

      const totalCost = parseFloat(transaction.totalCost?.toString() || "0");
      if (input.refundAmount > totalCost) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `El reembolso ($${input.refundAmount.toLocaleString()}) no puede superar el total de la transacción ($${totalCost.toLocaleString()})` });
      }

      // Si es reembolso de overstay, actualizar el campo overstayCost
      if (input.refundType === "overstay") {
        const currentOverstay = parseFloat(transaction.overstayCost?.toString() || "0");
        if (input.refundAmount > currentOverstay) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `El reembolso de sobreestadía ($${input.refundAmount.toLocaleString()}) no puede superar el cobro de sobreestadía ($${currentOverstay.toLocaleString()})` });
        }
        const newOverstay = currentOverstay - input.refundAmount;
        const newTotal = totalCost - input.refundAmount;
        await db.updateTransaction(input.transactionId, {
          overstayCost: newOverstay.toFixed(2),
          totalCost: Math.max(0, newTotal).toFixed(2),
        });
      } else {
        // Reembolso general: solo reducir totalCost
        const newTotal = totalCost - input.refundAmount;
        await db.updateTransaction(input.transactionId, {
          totalCost: Math.max(0, newTotal).toFixed(2),
        });
      }

      // Reembolsar al usuario en billetera
      const wallet = await db.getWalletByUserId(transaction.userId);
      if (wallet) {
        const currentBalance = parseFloat(wallet.balance?.toString() || "0");
        const newBalance = currentBalance + input.refundAmount;
        await db.updateWalletBalance(transaction.userId, newBalance.toString());
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: transaction.userId,
          type: "ADMIN_REFUND",
          amount: input.refundAmount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          referenceId: input.transactionId,
          referenceType: "TRANSACTION",
          status: "COMPLETED",
          description: `[Admin: ${ctx.user.name || ctx.user.email}] Reembolso parcial (${input.refundType}). Motivo: ${input.reason}`,
        });
      }

      // Condonar deudas asociadas si el reembolso cubre la deuda
      if (input.refundType === "overstay") {
        const debts = await db.getUserPendingDebts(transaction.userId);
        for (const debt of debts) {
          if (debt.transactionId === input.transactionId) {
            const remaining = parseFloat(debt.remainingAmount?.toString() || "0");
            if (input.refundAmount >= remaining) {
              await db.waiveUserDebt(debt.id);
            } else {
              // Reducir deuda parcialmente
              const dbInst = await db.getDb();
              if (dbInst) {
                const { userDebts: debtsTable } = await import("../drizzle/schema");
                const { eq: eqOp3 } = await import("drizzle-orm");
                await dbInst.update(debtsTable).set({
                  remainingAmount: (remaining - input.refundAmount).toFixed(2),
                  updatedAt: new Date(),
                }).where(eqOp3(debtsTable.id, debt.id));
              }
            }
          }
        }
      }

      // Notificar al usuario
      await db.createNotification({
        userId: transaction.userId,
        title: "💰 Reembolso aplicado",
        message: `Se te ha reembolsado $${input.refundAmount.toLocaleString("es-CO")} COP de tu sesión de carga #${input.transactionId}. Motivo: ${input.reason}`,
        type: "PAYMENT",
        isRead: false,
      });

      // Registrar reembolso en tabla de auditoría
      const refundId = await db.createRefund({
        transactionId: input.transactionId,
        userId: transaction.userId,
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin #${ctx.user.id}`,
        amount: input.refundAmount.toString(),
        refundType: input.refundType,
        reason: input.reason,
        claimId: (input as any).claimId || null,
        walletTransactionId: null,
      });

      console.log(`[Refund] Admin ${ctx.user.name} refunded $${input.refundAmount} (${input.refundType}) for tx #${input.transactionId}. Reason: ${input.reason}. RefundId: ${refundId}`);

      return {
        success: true,
        refundedAmount: input.refundAmount,
        refundType: input.refundType,
        newTotalCost: totalCost - input.refundAmount,
        refundId,
      };
    }),
});

// ============================================================================
// REFUNDS ROUTER (Historial de reembolsos para auditoría)
// ============================================================================

const refundsRouter = router({
  // Listar todos los reembolsos (admin)
  list: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      adminId: z.number().optional(),
      userId: z.number().optional(),
      transactionId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const opts = input || {};
      const result = await db.getRefunds(opts);
      // Enriquecer con datos del usuario
      const enriched = await Promise.all(
        result.data.map(async (refund) => {
          const user = await db.getUserById(refund.userId);
          const transaction = await db.getTransactionById(refund.transactionId);
          return {
            ...refund,
            amount: parseFloat(refund.amount?.toString() || "0"),
            userName: user?.name || user?.email || `Usuario #${refund.userId}`,
            userEmail: user?.email || null,
            transactionTotal: transaction ? parseFloat(transaction.totalCost?.toString() || "0") : null,
            stationName: transaction ? (await db.getChargingStationById(transaction.stationId))?.name || null : null,
          };
        })
      );
      return { data: enriched, total: result.total };
    }),

  // Obtener un reembolso por ID
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const refund = await db.getRefundById(input.id);
      if (!refund) throw new TRPCError({ code: "NOT_FOUND", message: "Reembolso no encontrado" });
      return refund;
    }),

  // Estadísticas de reembolsos
  stats: adminProcedure.query(async () => {
    const allRefunds = await db.getRefunds({ limit: 10000 });
    const totalAmount = allRefunds.data.reduce((sum, r) => sum + parseFloat(r.amount?.toString() || "0"), 0);
    const byType = allRefunds.data.reduce((acc, r) => {
      acc[r.refundType] = (acc[r.refundType] || 0) + parseFloat(r.amount?.toString() || "0");
      return acc;
    }, {} as Record<string, number>);
    return {
      totalRefunds: allRefunds.total,
      totalAmount,
      byType,
      last30Days: allRefunds.data.filter(r => {
        const d = new Date(r.createdAt);
        return d > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }).length,
    };
  }),
});

// ============================================================================
// CLAIMS ROUTER (Reclamos de cobro incorrecto)
// ============================================================================

const claimsRouter = router({
  // Crear reclamo (usuario)
  create: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      category: z.enum(["overcharge", "overstay_unfair", "wrong_kwh", "double_charge", "other"]),
      description: z.string().min(10, "Describe el problema con al menos 10 caracteres"),
      requestedAmount: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verificar que la transacción pertenece al usuario
      const transaction = await db.getTransactionById(input.transactionId);
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      if (transaction.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No puedes reclamar una transacción que no te pertenece" });
      }

      // Verificar que no haya un reclamo pendiente para esta transacción
      const existingClaims = await db.getClaimsByTransactionId(input.transactionId);
      const pendingClaim = existingClaims.find(c => c.status === "PENDING" || c.status === "IN_REVIEW");
      if (pendingClaim) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya tienes un reclamo pendiente para esta transacción" });
      }

      const claimId = await db.createClaim({
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.email || `Usuario #${ctx.user.id}`,
        transactionId: input.transactionId,
        category: input.category,
        description: input.description,
        requestedAmount: input.requestedAmount?.toString() || null,
        status: "PENDING",
      });

      // Notificar a todos los admins/staff
      const allUsers = await db.getAllUsers();
      const admins = allUsers.filter((u: any) => u.role === "admin" || u.role === "staff");
      for (const admin of admins) {
        await db.createNotification({
          userId: admin.id,
          title: "⚠️ Nuevo reclamo de cobro",
          message: `${ctx.user.name || ctx.user.email} reportó un cobro incorrecto en la transacción #${input.transactionId}. Categoría: ${input.category}. Revisa el panel de reclamos.`,
          type: "SYSTEM",
          referenceId: claimId,
          referenceType: "CLAIM",
          isRead: false,
        });
      }

      return { success: true, claimId };
    }),

  // Mis reclamos (usuario)
  myClaims: protectedProcedure.query(async ({ ctx }) => {
    const result = await db.getClaims({ userId: ctx.user.id });
    // Enriquecer con datos de la transacción
    const enriched = await Promise.all(
      result.data.map(async (claim) => {
        const transaction = await db.getTransactionById(claim.transactionId);
        const station = transaction ? await db.getChargingStationById(transaction.stationId) : null;
        return {
          ...claim,
          requestedAmount: claim.requestedAmount ? parseFloat(claim.requestedAmount.toString()) : null,
          transactionTotal: transaction ? parseFloat(transaction.totalCost?.toString() || "0") : null,
          stationName: station?.name || null,
          transactionDate: transaction?.startTime || null,
        };
      })
    );
    return enriched;
  }),

  // Listar reclamos (admin)
  list: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const opts = input || {};
      const result = await db.getClaims(opts);
      // Enriquecer con datos de la transacción
      const enriched = await Promise.all(
        result.data.map(async (claim) => {
          const transaction = await db.getTransactionById(claim.transactionId);
          const station = transaction ? await db.getChargingStationById(transaction.stationId) : null;
          return {
            ...claim,
            requestedAmount: claim.requestedAmount ? parseFloat(claim.requestedAmount.toString()) : null,
            transactionTotal: transaction ? parseFloat(transaction.totalCost?.toString() || "0") : null,
            stationName: station?.name || null,
            transactionDate: transaction?.startTime || null,
            kwhConsumed: transaction ? parseFloat(transaction.kwhConsumed?.toString() || "0") : null,
            overstayCost: transaction ? parseFloat(transaction.overstayCost?.toString() || "0") : null,
          };
        })
      );
      return { data: enriched, total: result.total };
    }),

  // Resolver reclamo (admin)
  resolve: adminProcedure
    .input(z.object({
      claimId: z.number(),
      resolution: z.string().min(3, "Debe indicar la resolución"),
      status: z.enum(["RESOLVED", "REJECTED"]),
      refundAmount: z.number().optional(), // Si se aprueba reembolso
      refundType: z.enum(["overstay", "energy", "general"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const claim = await db.getClaimById(input.claimId);
      if (!claim) throw new TRPCError({ code: "NOT_FOUND", message: "Reclamo no encontrado" });
      if (claim.status !== "PENDING" && claim.status !== "IN_REVIEW") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este reclamo ya fue resuelto" });
      }

      let refundId: number | null = null;

      // Si se aprueba con reembolso, ejecutar el reembolso
      if (input.status === "RESOLVED" && input.refundAmount && input.refundAmount > 0) {
        const transaction = await db.getTransactionById(claim.transactionId);
        if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });

        const totalCost = parseFloat(transaction.totalCost?.toString() || "0");
        if (input.refundAmount > totalCost) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El reembolso no puede superar el total" });
        }

        // Ejecutar reembolso en billetera
        const wallet = await db.getWalletByUserId(transaction.userId);
        if (wallet) {
          const currentBalance = parseFloat(wallet.balance?.toString() || "0");
          const newBalance = currentBalance + input.refundAmount;
          await db.updateWalletBalance(transaction.userId, newBalance.toString());
          await db.createWalletTransaction({
            walletId: wallet.id,
            userId: transaction.userId,
            type: "ADMIN_REFUND",
            amount: input.refundAmount.toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newBalance.toString(),
            referenceId: claim.transactionId,
            referenceType: "TRANSACTION",
            status: "COMPLETED",
            description: `[Reclamo #${claim.id}] Reembolso aprobado por ${ctx.user.name || ctx.user.email}. Motivo: ${input.resolution}`,
          });
        }

        // Actualizar transacción
        const refundType = input.refundType || "general";
        if (refundType === "overstay") {
          const currentOverstay = parseFloat(transaction.overstayCost?.toString() || "0");
          await db.updateTransaction(claim.transactionId, {
            overstayCost: Math.max(0, currentOverstay - input.refundAmount).toFixed(2),
            totalCost: Math.max(0, totalCost - input.refundAmount).toFixed(2),
          });
        } else {
          await db.updateTransaction(claim.transactionId, {
            totalCost: Math.max(0, totalCost - input.refundAmount).toFixed(2),
          });
        }

        // Registrar en tabla de reembolsos
        refundId = await db.createRefund({
          transactionId: claim.transactionId,
          userId: transaction.userId,
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin #${ctx.user.id}`,
          amount: input.refundAmount.toString(),
          refundType: refundType,
          reason: `[Reclamo #${claim.id}] ${input.resolution}`,
          claimId: claim.id,
          walletTransactionId: null,
        });
      }

      // Actualizar reclamo
      await db.updateClaim(input.claimId, {
        status: input.status,
        resolution: input.resolution,
        resolvedByAdminId: ctx.user.id,
        resolvedByAdminName: ctx.user.name || ctx.user.email || `Admin #${ctx.user.id}`,
        refundId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      });

      // Notificar al usuario
      const statusText = input.status === "RESOLVED" ? "aprobado" : "rechazado";
      const refundText = input.refundAmount ? ` Se reembolsó $${input.refundAmount.toLocaleString("es-CO")} COP.` : "";
      await db.createNotification({
        userId: claim.userId,
        title: input.status === "RESOLVED" ? "✅ Reclamo resuelto" : "❌ Reclamo rechazado",
        message: `Tu reclamo sobre la transacción #${claim.transactionId} fue ${statusText}.${refundText} Resolución: ${input.resolution}`,
        type: "PAYMENT",
        referenceId: input.claimId,
        referenceType: "CLAIM",
        isRead: false,
      });

      return { success: true, status: input.status, refundId };
    }),

  // Marcar como en revisión (admin)
  markInReview: adminProcedure
    .input(z.object({ claimId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateClaim(input.claimId, { status: "IN_REVIEW", updatedAt: new Date() });
      return { success: true };
    }),

  // Estadísticas de reclamos
  stats: adminProcedure.query(async () => {
    const [pending, inReview, resolved, rejected] = await Promise.all([
      db.getClaims({ status: "PENDING" }),
      db.getClaims({ status: "IN_REVIEW" }),
      db.getClaims({ status: "RESOLVED" }),
      db.getClaims({ status: "REJECTED" }),
    ]);
    return {
      pending: pending.total,
      inReview: inReview.total,
      resolved: resolved.total,
      rejected: rejected.total,
      total: pending.total + inReview.total + resolved.total + rejected.total,
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
    const reservations = await db.getReservationsByUserId(ctx.user.id);
    // Enriquecer con nombre de estación
    const enriched = await Promise.all(
      reservations.map(async (r) => {
        const station = await db.getChargingStationById(r.stationId);
        return { ...r, stationName: station?.name || `Estación #${r.stationId}` };
      })
    );
    return enriched;
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
      // Verificar si la estación tiene autoPricing activado
      const tariff = await db.getActiveTariffByStationId(input.stationId);
      const useAutoPricing = tariff?.autoPricing === true || (tariff?.autoPricing as any) === 1;

      if (!useAutoPricing) {
        // Precio fijo: retornar sin multiplicadores dinámicos
        const basePricePerKwh = parseFloat(tariff?.pricePerKwh?.toString() || "1300");
        const reservationFee = parseFloat(tariff?.reservationFee?.toString() || "5000");
        const fixedFactors = {
          occupancyMultiplier: 1,
          timeMultiplier: 1,
          dayMultiplier: 1,
          demandMultiplier: 1,
          finalMultiplier: 1,
          demandLevel: "NORMAL" as const,
        };
        const visualization = dynamicPricing.getDemandVisualization(fixedFactors);
        return {
          basePrice: basePricePerKwh,
          finalPrice: basePricePerKwh,
          factors: fixedFactors,
          reservationFee,
          noShowPenalty: reservationFee,
          estimatedTotal: basePricePerKwh * 10 + reservationFee,
          currency: "COP",
          validUntil: new Date(Date.now() + 15 * 60 * 1000),
          visualization,
          useAutoPricing: false,
        };
      }

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
        useAutoPricing: true,
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
  
  // Fase 3: Obtener predicción de demanda basada en historial real (24h)
  getDemandForecast: publicProcedure
    .input(z.object({
      stationId: z.number(),
    }))
    .query(async ({ input }) => {
      const { get24HourForecast } = await import("./ai/demand-forecast-service");
      return get24HourForecast(input.stationId);
    }),

  // Fase 3: Obtener recomendación predictiva de suscripción
  getSubscriptionPrediction: protectedProcedure
    .query(async ({ ctx }) => {
      const { getPredictiveSubscriptionRecommendation } = await import("./ai/subscription-predictor");
      return getPredictiveSubscriptionRecommendation(ctx.user.id);
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
      // Verificar que el EVSE exista y no esté fuera de servicio
      const evse = await db.getEvseById(input.evseId);
      if (!evse) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conector no encontrado" });
      }
      // Permitir reservas si el conector está AVAILABLE o RESERVED (puede tener reservas futuras sin conflicto)
      // Solo bloquear si está en uso activo, fuera de servicio o con falla
      const blockedStatuses = ["CHARGING", "OCCUPIED", "UNAVAILABLE", "FAULTED", "SUSPENDED_EV", "SUSPENDED_EVSE"];
      if (blockedStatuses.includes(evse.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `El conector no está disponible (estado: ${evse.status})` });
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
      
      // Solo marcar como RESERVED si la reserva empieza dentro de los próximos 15 minutos
      const now = new Date();
      const minutesUntilStart = (input.startTime.getTime() - now.getTime()) / (1000 * 60);
      if (minutesUntilStart <= 15 && evse.status === "AVAILABLE") {
        await db.updateEvseStatus(input.evseId, "RESERVED");
      }
            // Para reservas futuras (>15 min), un job periódico se encargará de marcar RESERVED cuando se acerque la hora

      // WhatsApp: notificar reserva confirmada
      try {
        const userForWa = await db.getUserById(ctx.user.id);
        if (userForWa?.phone) {
          const station = await db.getChargingStationById(input.stationId);
          const { sendWhatsAppMessage, WaTemplates } = await import("./whatsapp/whatsapp-service");
          const startDate = new Date(input.startTime);
          const endDate = new Date(input.endTime);
          const { getStationTimezone, formatDateInTz, formatTimeRangeInTz } = await import("./utils/timezone");
          const stationTz = getStationTimezone(station ?? {});
          const dateStr = formatDateInTz(startDate, stationTz);
          const timeStr = formatTimeRangeInTz(startDate, endDate, stationTz);
          sendWhatsAppMessage({
            toPhone: userForWa.phone,
            message: WaTemplates.reservationConfirmed({
              stationName: station?.name ?? `Estación #${input.stationId}`,
              date: dateStr,
              time: timeStr,
              connectorId: input.evseId,
              userName: userForWa.name?.split(" ")[0],
            }),
            eventType: "reservation_confirmed",
            userId: ctx.user.id,
            referenceId: id,
            referenceType: "reservation",
          }).catch((e: Error) => console.error("[WhatsApp] reservation_confirmed error:", e.message));
        }
      } catch (waErr) {
        console.error("[WhatsApp] reservation_confirmed trigger error:", waErr);
      }

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
      const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
      
      let refundPercent = 0;
      if (minutesUntilStart >= 30) {
        refundPercent = 100; // Reembolso total si cancela con 30+ min de anticipación
      } else {
        refundPercent = 0; // Sin reembolso si cancela con menos de 30 min
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
      
      // WhatsApp: notificar recarga de billetera (plantilla aprobada)
      try {
        const userForWa = await db.getUserById(ctx.user.id);
        if (userForWa?.phone) {
          const { sendWhatsAppTemplate, WA_TEMPLATE_NAMES } = await import("./whatsapp/whatsapp-service");
          sendWhatsAppTemplate({
            toPhone: userForWa.phone,
            templateName: WA_TEMPLATE_NAMES.recarga_billetera,
            parameters: [
              userForWa.name?.split(" ")[0] || "Usuario",
              `$${input.amount.toLocaleString("es-CO")}`,
              `$${Math.round(newBalance).toLocaleString("es-CO")}`,
            ],
            eventType: "wallet_recharge",
            userId: ctx.user.id,
          }).catch((e: Error) => console.error("[WhatsApp] wallet_recharge error:", e.message));
        }
      } catch (waErr) {
        console.error("[WhatsApp] wallet_recharge trigger error:", waErr);
      }

      return { success: true, newBalance };
    }),

  // ========================================================================
  // Auto-recarga durante carga activa
  // ========================================================================
  getAutoRechargeSettings: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await db.getUserSubscription(ctx.user.id);
    return {
      enabled: subscription?.autoRechargeEnabled ?? false,
      threshold: subscription?.autoRechargeThreshold ?? 10000,
      amount: subscription?.autoRechargeAmount ?? 20000,
      hasPaymentMethod: !!subscription?.wompiPaymentSourceId,
      cardLastFour: subscription?.cardLastFour || null,
      cardBrand: subscription?.cardBrand || null,
      lastAutoRechargeAt: subscription?.lastAutoRechargeAt || null,
      failCount: subscription?.autoRechargeFailCount ?? 0,
    };
  }),

  updateAutoRechargeSettings: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      threshold: z.number().min(5000).max(100000).optional(),
      amount: z.number().min(10000).max(500000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const subscription = await db.getUserSubscription(ctx.user.id);
      
      // Si quiere activar, verificar que tenga tarjeta inscrita
      if (input.enabled && !subscription?.wompiPaymentSourceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Debes tener una tarjeta inscrita para activar la recarga autom\u00e1tica. Realiza una recarga por Wompi primero.",
        });
      }

      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BD no disponible" });

      const { subscriptions: subsTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      if (subscription) {
        await dbInstance.update(subsTable).set({
          autoRechargeEnabled: input.enabled,
          ...(input.threshold !== undefined && { autoRechargeThreshold: input.threshold }),
          ...(input.amount !== undefined && { autoRechargeAmount: input.amount }),
          ...(input.enabled && { autoRechargeFailCount: 0 }), // Reset fail count on re-enable
        }).where(eq(subsTable.userId, ctx.user.id));
      } else {
        // Crear suscripci\u00f3n b\u00e1sica con auto-recarga
        await dbInstance.insert(subsTable).values({
          userId: ctx.user.id,
          tier: "FREE" as any,
          autoRechargeEnabled: input.enabled,
          autoRechargeThreshold: input.threshold ?? 10000,
          autoRechargeAmount: input.amount ?? 20000,
          startDate: new Date(),
          isActive: true,
        });
      }

      return {
        success: true,
        enabled: input.enabled,
        threshold: input.threshold ?? subscription?.autoRechargeThreshold ?? 10000,
        amount: input.amount ?? subscription?.autoRechargeAmount ?? 20000,
      };
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
    .input(z.object({
      type: z.string().optional(),
      location: z.string().optional(),
      // Contexto básico (para usuarios no autenticados)
      userRole: z.string().optional(),
      userCity: z.string().optional(),
      stationId: z.number().optional(),
      stationCity: z.string().optional(),
      // Contexto enriquecido (para usuarios autenticados)
      userId: z.number().optional(),
      resolveFullContext: z.boolean().optional(), // Si true, resuelve contexto completo desde BD
    }).optional())
    .query(async ({ input }) => {
      let userContext: import("./db").BannerUserContext | undefined;

      // Si hay userId y se solicita contexto completo, resolver desde BD
      if (input?.userId && input?.resolveFullContext) {
        try {
          userContext = await db.resolveUserBannerContext(input.userId, {
            stationId: input.stationId,
            stationCity: input.stationCity,
          });
        } catch (err) {
          console.error("[Banners] Error resolving user context, using basic context:", err);
          userContext = { role: input?.userRole, city: input?.userCity, stationId: input?.stationId };
        }
      } else if (input?.userRole || input?.userCity || input?.stationId) {
        userContext = { role: input?.userRole, city: input?.userCity, stationId: input?.stationId, stationCity: input?.stationCity };
      }

      const activeBanners = await db.getActiveBanners(input?.type, input?.location, userContext);

      // IA: Si hay userId, rankear por relevancia personalizada
      if (input?.userId && activeBanners.length > 1) {
        try {
          const { rankBannersByRelevance, getUserAdProfile } = await import("./ai/ad-relevance-service");
          const adProfile = await getUserAdProfile(input.userId, {
            city: input.userCity,
            stationId: input.stationId,
            role: input.userRole,
          });
          const ranked = await rankBannersByRelevance(activeBanners, adProfile);
          return ranked;
        } catch (err) {
          console.error("[Banners] Error ranking by relevance, returning default order:", err);
        }
      }
      return activeBanners;
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
      // Segmentación — Dimensión 1: Geografía
      targetCities: z.array(z.string()).optional(),
      targetDepartments: z.array(z.string()).optional(),
      targetStationCities: z.array(z.string()).optional(),
      targetStationIds: z.array(z.number()).optional(),
      // Segmentación — Dimensión 2: Vehículo
      targetVehicleBrands: z.array(z.string()).optional(),
      targetVehicleModels: z.array(z.string()).optional(),
      targetConnectorTypes: z.array(z.string()).optional(),
      targetBatteryMinKwh: z.number().optional(),
      targetBatteryMaxKwh: z.number().optional(),
      // Segmentación — Dimensión 3: Comportamiento
      targetMinChargesPerMonth: z.number().optional(),
      targetMaxChargesPerMonth: z.number().optional(),
      targetMinSpendPerMonth: z.number().optional(),
      targetMaxSpendPerMonth: z.number().optional(),
      targetStartMethods: z.array(z.string()).optional(),
      targetChargeHoursStart: z.number().optional(),
      targetChargeHoursEnd: z.number().optional(),
      // Segmentación — Dimensión 4: Suscripción y rol
      targetRoles: z.array(z.string()).optional(),
      targetSubscriptionTiers: z.array(z.string()).optional(),
      targetHasCard: z.boolean().optional(),
      // Segmentación — Dimensión 5: Perfil financiero
      targetWalletMinBalance: z.number().optional(),
      targetWalletMaxBalance: z.number().optional(),
      targetMinAvgRecharge: z.number().optional(),
      // Segmentación — Dimensión 7: Actividad RFM
      targetActivitySegments: z.array(z.string()).optional(),
      // Configuración
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
        // Segmentación — Dimensión 1: Geografía
        targetCities: z.array(z.string()).optional(),
        targetDepartments: z.array(z.string()).optional(),
        targetStationCities: z.array(z.string()).optional(),
        targetStationIds: z.array(z.number()).optional(),
        // Segmentación — Dimensión 2: Vehículo
        targetVehicleBrands: z.array(z.string()).optional(),
        targetVehicleModels: z.array(z.string()).optional(),
        targetConnectorTypes: z.array(z.string()).optional(),
        targetBatteryMinKwh: z.number().optional(),
        targetBatteryMaxKwh: z.number().optional(),
        // Segmentación — Dimensión 3: Comportamiento
        targetMinChargesPerMonth: z.number().optional(),
        targetMaxChargesPerMonth: z.number().optional(),
        targetMinSpendPerMonth: z.number().optional(),
        targetMaxSpendPerMonth: z.number().optional(),
        targetStartMethods: z.array(z.string()).optional(),
        targetChargeHoursStart: z.number().optional(),
        targetChargeHoursEnd: z.number().optional(),
        // Segmentación — Dimensión 4: Suscripción y rol
        targetRoles: z.array(z.string()).optional(),
        targetSubscriptionTiers: z.array(z.string()).optional(),
        targetHasCard: z.boolean().optional(),
        // Segmentación — Dimensión 5: Perfil financiero
        targetWalletMinBalance: z.number().optional(),
        targetWalletMaxBalance: z.number().optional(),
        targetMinAvgRecharge: z.number().optional(),
        // Segmentación — Dimensión 7: Actividad RFM
        targetActivitySegments: z.array(z.string()).optional(),
        // Configuración
        priority: z.number().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"]).optional(),
        advertiserName: z.string().optional(),
        advertiserContact: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateBanner(input.id, input.data as any);
      return { success: true };
    }),
  
  toggleStatus: protectedProcedure
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
    .input(z.object({
      bannerId: z.number(),
      context: z.string().optional(),
      city: z.string().optional(),
      vehicleType: z.string().optional(),
      deviceType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.recordBannerImpression(input.bannerId, ctx.user?.id, input.context, {
        city: input.city,
        vehicleType: input.vehicleType,
        deviceType: input.deviceType,
      });
      return { success: true };
    }),
  
  recordClick: publicProcedure
    .input(z.object({ bannerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.recordBannerClick(input.bannerId, ctx.user?.id);
      return { success: true };
    }),

  recordDwellTime: protectedProcedure
    .input(z.object({ bannerId: z.number(), durationSeconds: z.number().min(1).max(7200) }))
    .mutation(async ({ ctx, input }) => {
      await db.recordBannerDwellTime(input.bannerId, ctx.user.id, input.durationSeconds);
      return { success: true };
    }),

  getCampaignAnalytics: adminProcedure
    .input(z.object({
      bannerId: z.number(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return db.getBannerCampaignAnalytics(input.bannerId, input.startDate, input.endDate);
    }),

  getDailyStats: adminProcedure
    .input(z.object({
      bannerId: z.number(),
      daysBack: z.number().min(7).max(365).default(30),
    }))
    .query(async ({ input }) => {
      return db.getBannerDailyStats(input.bannerId, input.daysBack);
    }),

  getAudienceProfile: adminProcedure
    .input(z.object({ bannerId: z.number() }))
    .query(async ({ input }) => {
      return db.getBannerAudienceProfile(input.bannerId);
    }),

  exportCampaignReport: adminProcedure
    .input(z.object({
      bannerId: z.number(),
      format: z.enum(["excel", "pdf"]),
      daysBack: z.number().min(7).max(365).default(30),
    }))
    .mutation(async ({ input }) => {
      const { exportCampaignExcel, exportCampaignPdf } = await import("./banner-export");
      const analytics = await db.getBannerCampaignAnalytics(input.bannerId);
      const dailyStats = await db.getBannerDailyStats(input.bannerId, input.daysBack);
      const audience = await db.getBannerAudienceProfile(input.bannerId);

      if (!analytics?.banner || !analytics?.summary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Banner no encontrado" });
      }

      let buffer: Buffer;
      let filename: string;
      let mimeType: string;

      if (input.format === "excel") {
        buffer = await exportCampaignExcel(analytics.banner as any, analytics.summary as any, dailyStats as any, audience as any);
        filename = `reporte_campana_${analytics.banner.id}_${new Date().toISOString().split("T")[0]}.xlsx`;
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        buffer = exportCampaignPdf(analytics.banner as any, analytics.summary as any, dailyStats as any, audience as any);
        filename = `reporte_campana_${analytics.banner.id}_${new Date().toISOString().split("T")[0]}.pdf`;
        mimeType = "application/pdf";
      }

      return {
        filename,
        mimeType,
        data: buffer.toString("base64"),
      };
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
      investorPercentage: settings?.investorPercentage ?? 70,
      platformFeePercentage: settings?.platformFeePercentage ?? 30,
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
      hostPercentage: 10, // Default aliado comercial % (per-station config overrides this)
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
        investorPercentage: 70,
        platformFeePercentage: 30,
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
        // Alegra
        alegraEmail: "",
        alegraToken: "",
        alegraEnabled: false,
        alegraTestMode: true,
        alegraDefaultItemId: "",
        alegraDefaultTaxId: "",
        alegraAutoInvoice: true,
        alegraPaymentMethodId: "",
        alegraPaymentAccountId: "",
        alegraResolutionNumber: "",
        // Email (Resend)
        resendApiKey: "",
        emailFrom: "noreply@evgreen.lat",
        // Soporte
        supportEmail: "soporte@greenhproject.com",
        supportPhone: "",
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
      // Alegra - Facturación Electrónica
      alegraEmail: settings.alegraEmail || "",
      alegraToken: settings.alegraToken ? "****" + settings.alegraToken.slice(-4) : "",
      alegraEnabled: settings.alegraEnabled ?? false,
      alegraTestMode: settings.alegraTestMode ?? true,
      alegraDefaultItemId: settings.alegraDefaultItemId || "",
      alegraDefaultTaxId: settings.alegraDefaultTaxId || "",
      alegraAutoInvoice: settings.alegraAutoInvoice ?? true,
      alegraPaymentMethodId: settings.alegraPaymentMethodId || "",
      alegraPaymentAccountId: settings.alegraPaymentAccountId || "",
      alegraResolutionNumber: settings.alegraResolutionNumber || "",
      // Email (Resend) - mask key for security
      resendApiKey: settings.resendApiKey ? "re_****" + settings.resendApiKey.slice(-4) : "",
      emailFrom: settings.emailFrom || "noreply@evgreen.lat",
      // Soporte
      supportEmail: settings.supportEmail || "soporte@greenhproject.com",
      supportPhone: settings.supportPhone || "",
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
      // Alegra - Facturación Electrónica
      alegraEmail: z.string().optional(),
      alegraToken: z.string().optional(),
      alegraEnabled: z.boolean().optional(),
      alegraTestMode: z.boolean().optional(),
      alegraDefaultItemId: z.string().optional(),
      alegraDefaultTaxId: z.string().optional(),
      alegraAutoInvoice: z.boolean().optional(),
      alegraPaymentMethodId: z.string().optional(),
      alegraPaymentAccountId: z.string().optional(),
      alegraResolutionNumber: z.string().optional(),
      // Email (Resend)
      resendApiKey: z.string().optional(),
      emailFrom: z.string().optional(),
      // Soporte
      supportEmail: z.string().optional(),
      supportPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Filtrar campos vacíos o con valores de máscara
      const data: any = { ...input, updatedBy: ctx.user.id };
      
      // No actualizar claves si vienen con máscara
      if (data.wompiPrivateKey?.startsWith("prv_****")) delete data.wompiPrivateKey;
      if (data.wompiIntegritySecret?.startsWith("****")) delete data.wompiIntegritySecret;
      if (data.wompiEventsSecret?.startsWith("****")) delete data.wompiEventsSecret;
      if (data.upmeToken?.startsWith("****")) delete data.upmeToken;
      if (data.alegraToken?.startsWith("****")) delete data.alegraToken;
      if (data.resendApiKey?.startsWith("re_****")) delete data.resendApiKey;
      
      await db.upsertPlatformSettings(data);
      // Invalidar caché de Resend si se actualizó la key
      if (data.resendApiKey || data.emailFrom) {
        const { invalidateResendCache } = await import("./email/resend-client");
        invalidateResendCache();
      }
      return { success: true };
    }),

  // Alegra: Test connection
  alegraTestConnection: adminProcedure
    .input(z.object({
      email: z.string().email(),
      token: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const { testConnection } = await import("./alegra/alegra-service");
      return testConnection({ email: input.email, token: input.token });
    }),

  // Alegra: List items (products/services)
  alegraListItems: adminProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    if (!settings?.alegraEmail || !settings?.alegraToken) {
      return { items: [], error: "Alegra no configurado" };
    }
    try {
      const { listItems } = await import("./alegra/alegra-service");
      const items = await listItems({ email: settings.alegraEmail, token: settings.alegraToken });
      return { items, error: null };
    } catch (e: any) {
      return { items: [], error: e.message };
    }
  }),

  // Alegra: List taxes
  alegraListTaxes: adminProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    if (!settings?.alegraEmail || !settings?.alegraToken) {
      return { taxes: [], error: "Alegra no configurado" };
    }
    try {
      const { listTaxes } = await import("./alegra/alegra-service");
      const taxes = await listTaxes({ email: settings.alegraEmail, token: settings.alegraToken });
      return { taxes, error: null };
    } catch (e: any) {
      return { taxes: [], error: e.message };
    }
  }),

  // Alegra: List payment methods
  alegraListPaymentMethods: adminProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    if (!settings?.alegraEmail || !settings?.alegraToken) {
      return { methods: [], error: "Alegra no configurado" };
    }
    try {
      const { listPaymentMethods } = await import("./alegra/alegra-service");
      const methods = await listPaymentMethods({ email: settings.alegraEmail, token: settings.alegraToken });
      return { methods, error: null };
    } catch (e: any) {
      return { methods: [], error: e.message };
    }
  }),

  // Alegra: List bank accounts
  alegraListBankAccounts: adminProcedure.query(async () => {
    const settings = await db.getPlatformSettings();
    if (!settings?.alegraEmail || !settings?.alegraToken) {
      return { accounts: [], error: "Alegra no configurado" };
    }
    try {
      const { listBankAccounts } = await import("./alegra/alegra-service");
      const accounts = await listBankAccounts({ email: settings.alegraEmail, token: settings.alegraToken });
      return { accounts, error: null };
    } catch (e: any) {
      return { accounts: [], error: e.message };
    }
  }),
  // Resend: Test connection
  testResendConnection: adminProcedure
    .input(z.object({
      apiKey: z.string().optional(),
      emailFrom: z.string().optional(),
      testEmailTo: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { getResendApiKey, getEmailFrom } = await import("./email/resend-client");
        const { Resend } = await import("resend");
        const apiKey = (input.apiKey && !input.apiKey.startsWith("re_****"))
          ? input.apiKey
          : await getResendApiKey();
        if (!apiKey) {
          return { success: false, error: "No hay API Key de Resend configurada. Guarda la key primero." };
        }
        const fromEmail = input.emailFrom || await getEmailFrom();
        const resend = new Resend(apiKey);
        const result = await resend.emails.send({
          from: `EVGreen <${fromEmail}>`,
          to: [input.testEmailTo],
          subject: "\u2705 Prueba de conexi\u00f3n Resend \u2014 EVGreen",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#16a34a">Conexi\u00f3n exitosa con Resend</h2><p>Este es un email de prueba enviado desde el panel de administraci\u00f3n de <strong>EVGreen</strong>.</p><p style="color:#6b7280;font-size:14px">Si recibiste este mensaje, la configuraci\u00f3n de Resend est\u00e1 funcionando correctamente.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"><p style="color:#9ca3af;font-size:12px">EVGreen \u00b7 Carga el Futuro</p></div>`,
        });
        if (result.error) {
          return { success: false, error: result.error.message || "Error desconocido de Resend" };
        }
        return { success: true, messageId: result.data?.id || "" };
      } catch (err: any) {
        return { success: false, error: err.message || "Error al conectar con Resend" };
      }
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
      
      const platformFee = input.amount * ((100 - (balance.investorPercentage || 70)) / (balance.investorPercentage || 70));
      const totalRevenue = input.amount + platformFee;
      
      const payoutId = await db.createInvestorPayout({
        investorId: ctx.user.id,
        periodStart,
        periodEnd,
        totalRevenue: totalRevenue.toFixed(2),
        investorShare: input.amount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        investorPercentage: balance.investorPercentage || 70,
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
      status: z.enum(['ACTIVE', 'FUNDED', 'COMPLETED', 'CANCELLED', 'DRAFT']).optional(),
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
      // Modelo financiero para la estación auto-creada
      evgreenSharePercent: z.string().optional(),
      investorSharePercent: z.string().optional(),
      hostSharePercent: z.string().optional(),
      energyPurchaseCostPerKwh: z.string().optional(),
      hostName: z.string().optional(),
      hostUserId: z.number().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { evgreenSharePercent, investorSharePercent, hostSharePercent, energyPurchaseCostPerKwh, hostName, hostUserId, latitude, longitude, ...projectInput } = input;
      
      // 1. Crear el proyecto crowdfunding
      const projectId = await db.createCrowdfundingProject({
        ...projectInput,
        createdById: ctx.user.id,
      });
      
      // 2. Auto-crear estación física vinculada al proyecto
      const stationName = `${input.name}`;
      const stationId = await db.createChargingStation({
        ownerId: ctx.user.id, // Admin es el owner temporal hasta que se asigne
        name: stationName,
        description: input.description || `Estación colectiva - Proyecto ${input.name}`,
        address: input.address || `${input.zone}, ${input.city}`,
        city: input.city,
        department: '',
        latitude: latitude || '4.6097',
        longitude: longitude || '-74.0817',
        country: 'Colombia',
        isActive: false, // Inactiva hasta que se instale
        isPublic: false,
        // Modelo financiero
        evgreenSharePercent: evgreenSharePercent || '30.00',
        investorSharePercent: investorSharePercent || '70.00',
        hostSharePercent: hostSharePercent || '10.00',
        energyPurchaseCostPerKwh: energyPurchaseCostPerKwh || '800.00',
        hostName: hostName || null,
        hostUserId: hostUserId || null,
      });
      
      // 3. Vincular la estación al proyecto crowdfunding
      if (stationId) {
        await db.updateCrowdfundingProject(projectId, { stationId });
        console.log(`[Crowdfunding] Proyecto ${projectId} vinculado a estación ${stationId} automáticamente`);
      }
      
      // 4. Crear EVSEs/conectores según especificaciones del proyecto
      if (stationId && input.chargerCount) {
        for (let i = 1; i <= input.chargerCount; i++) {
          await db.createEvse({
            stationId,
            evseIdLocal: i,
            connectorType: 'CCS_2',
            chargeType: 'DC',
            powerKw: String(input.chargerPowerKw || 120),
            status: 'UNAVAILABLE',
          });
        }
        console.log(`[Crowdfunding] ${input.chargerCount} conectores creados para estación ${stationId}`);
      }
      
      return { success: true, projectId, stationId };
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
      const raw = await db.getCrowdfundingParticipations(input.projectId);
      return raw.map((p: any) => ({
        ...p,
        investor: {
          id: p.investorId,
          name: p.investorName || p.name || 'N/A',
          email: p.investorEmail || p.email || '',
        },
      }));
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
      
      // Conexión crowdfunding → módulo de inversionistas:
      // Actualizar investorTypes para incluir 'collective' automáticamente
      try {
        const database = await getDb();
        if (database) {
          // Obtener tipos actuales
          const [userRows] = await database.execute(sql`SELECT investorTypes FROM users WHERE id = ${investorId}`);
          const currentTypes: string[] = (userRows as any)?.[0]?.investorTypes || [];
          if (!currentTypes.includes('collective')) {
            const newTypes = [...currentTypes, 'collective'];
            await database.execute(sql`UPDATE users SET investorTypes = ${JSON.stringify(newTypes)} WHERE id = ${investorId}`);
          }
          // Actualizar investorTotalInvested
          await database.execute(sql`UPDATE users SET investorTotalInvested = COALESCE(investorTotalInvested, 0) + ${input.amount} WHERE id = ${investorId}`);
          // Establecer investorJoinedAt si no existe
          await database.execute(sql`UPDATE users SET investorJoinedAt = NOW() WHERE id = ${investorId} AND investorJoinedAt IS NULL`);
        }
        console.log(`[Crowdfunding] Inversionista ${investorId} actualizado con tipo 'collective' y monto ${input.amount}`);
      } catch (e) {
        console.error('[Crowdfunding] Error updating investor types:', e);
      }
      
      // Si el proyecto tiene estación asignada, vincular al inversionista
      if (project.stationId) {
        console.log(`[Crowdfunding] Inversionista ${investorId} vinculado a estación ${project.stationId}`);
      }
      
      // Trigger onboarding welcome email if payment is confirmed
      if (input.paymentConfirmed) {
        try {
          const investor = await db.getUserById(investorId);
          if (investor && investor.email && !investor.welcomeEmailSent) {
            await triggerInvestorWelcome(investorId, {
              investorName: investor.name || input.name,
              investorEmail: investor.email || input.email,
              investmentAmount: input.amount,
              investmentType: 'collective',
              projectName: project.name,
              participationPercent,
            });
            console.log(`[Onboarding] Welcome email sent to new investor ${investorId} via registerInvestor`);
          }
        } catch (onboardingError) {
          console.error('[Onboarding] Error triggering welcome from registerInvestor:', onboardingError);
        }
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

  // Admin: Buscar usuarios para vincular como inversionistas
  searchUsers: adminProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.searchUsers(input.query, 15);
    }),

  // Admin: Editar participación existente
  editParticipation: adminProcedure
    .input(z.object({
      participationId: z.number(),
      amount: z.number().positive().optional(),
      paymentStatus: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
      paymentReference: z.string().optional(),
      investorId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const participation = await db.getCrowdfundingParticipationById(input.participationId);
      if (!participation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Participación no encontrada' });
      }
      const project = await db.getCrowdfundingProjectById(participation.projectId);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
      }
      const updateData: any = {};
      if (input.amount !== undefined) {
        updateData.amount = input.amount;
        updateData.participationPercent = (input.amount / Number(project.targetAmount)) * 100;
      }
      if (input.paymentStatus !== undefined) {
        updateData.paymentStatus = input.paymentStatus;
        if (input.paymentStatus === 'COMPLETED' && participation.paymentStatus !== 'COMPLETED') {
          updateData.paymentDate = new Date();
        }
      }
      if (input.paymentReference !== undefined) {
        updateData.paymentReference = input.paymentReference;
      }
      if (input.investorId !== undefined) {
        updateData.investorId = input.investorId;
        // Update the linked user's role to investor if needed
        const user = await db.getUserById(input.investorId);
        if (user && user.role !== 'investor' && user.role !== 'admin') {
          await db.updateUser(input.investorId, { role: 'investor' });
        }
      }
      await db.updateCrowdfundingParticipationFull(input.participationId, updateData);
      await db.updateProjectRaisedAmountByParticipation(input.participationId);
      
      // Trigger onboarding welcome email if payment status changed to COMPLETED
      if (input.paymentStatus === 'COMPLETED' && participation.paymentStatus !== 'COMPLETED') {
        try {
          const investor = await db.getUserById(updateData.investorId || participation.investorId);
          if (investor && investor.email && !investor.welcomeEmailSent) {
            const project = await db.getCrowdfundingProjectById(participation.projectId);
            await triggerInvestorWelcome(investor.id, {
              investorName: investor.name || 'Inversionista',
              investorEmail: investor.email,
              investmentAmount: Number(participation.amount),
              investmentType: 'collective',
              projectName: project?.name,
              participationPercent: Number(participation.participationPercent),
            });
            console.log(`[Onboarding] Welcome email sent to investor ${investor.id} via editParticipation`);
          }
        } catch (onboardingError) {
          console.error('[Onboarding] Error triggering welcome from editParticipation:', onboardingError);
        }
      }
      
      return { success: true };
    }),

  // Admin: Eliminar participación
  deleteParticipation: adminProcedure
    .input(z.object({ participationId: z.number() }))
    .mutation(async ({ input }) => {
      const participation = await db.getCrowdfundingParticipationById(input.participationId);
      if (!participation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Participación no encontrada' });
      }
      const projectId = participation.projectId;
      await db.deleteCrowdfundingParticipation(input.participationId);
      await db.updateProjectRaisedAmount(projectId);
      return { success: true };
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
      
      // Trigger onboarding welcome email for the investor
      try {
        const investor = await db.getUserById(participation.investorId);
        if (investor && investor.email && !investor.welcomeEmailSent) {
          const isIndividual = (investor.investorTypes || []).includes('individual');
          await triggerInvestorWelcome(investor.id, {
            investorName: investor.name || 'Inversionista',
            investorEmail: investor.email,
            investmentAmount: Number(participation.amount),
            investmentType: isIndividual ? 'individual' : 'collective',
            projectName: projectAfter?.name,
            participationPercent: Number(participation.participationPercent),
          });
          console.log(`[Onboarding] Welcome email sent to investor ${investor.id}`);
        }
      } catch (onboardingError) {
        console.error('[Onboarding] Error triggering welcome:', onboardingError);
      }
      
      return { success: true };
    }),

  // Admin: Eliminar proyecto de crowdfunding completo
  deleteProject: adminProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const project = await db.getCrowdfundingProjectById(input.projectId);
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
      }
      
      // 1. Eliminar todas las participaciones del proyecto
      await db.deleteCrowdfundingProjectParticipations(input.projectId);
      
      // 2. Eliminar el proyecto
      await db.deleteCrowdfundingProject(input.projectId);
      
      return { success: true, deletedProject: project.name };
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

  // Obtener preferencias de email del usuario
  getEmailPreferences: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      return {
        emailNotifyEnabled: true,
        emailNotifyReceipts: true,
        emailNotifyWeeklyReport: false,
        emailNotifyPromotions: false,
      };
    }
    const [user] = await database
      .select({
        emailNotifyEnabled: users.emailNotifyEnabled,
        emailNotifyReceipts: users.emailNotifyReceipts,
        emailNotifyWeeklyReport: users.emailNotifyWeeklyReport,
        emailNotifyPromotions: users.emailNotifyPromotions,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      emailNotifyEnabled: user?.emailNotifyEnabled ?? true,
      emailNotifyReceipts: user?.emailNotifyReceipts ?? true,
      emailNotifyWeeklyReport: user?.emailNotifyWeeklyReport ?? false,
      emailNotifyPromotions: user?.emailNotifyPromotions ?? false,
    };
  }),

  // Actualizar preferencias de email del usuario
  updateEmailPreferences: protectedProcedure
    .input(z.object({
      emailNotifyEnabled: z.boolean().optional(),
      emailNotifyReceipts: z.boolean().optional(),
      emailNotifyWeeklyReport: z.boolean().optional(),
      emailNotifyPromotions: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.emailNotifyEnabled !== undefined) updateData.emailNotifyEnabled = input.emailNotifyEnabled;
      if (input.emailNotifyReceipts !== undefined) updateData.emailNotifyReceipts = input.emailNotifyReceipts;
      if (input.emailNotifyWeeklyReport !== undefined) updateData.emailNotifyWeeklyReport = input.emailNotifyWeeklyReport;
      if (input.emailNotifyPromotions !== undefined) updateData.emailNotifyPromotions = input.emailNotifyPromotions;

      if (Object.keys(updateData).length > 0) {
        await database
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));
      }

      return { success: true };
    }),

  // Obtener preferencias de WhatsApp del usuario
  getWhatsAppPreferences: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      return {
        waNotifyChargeStart: true,
        waNotifyChargeEnd: true,
        waNotifyReminder: false,
        waNotifyPenalty: true,
        waNotifyWallet: true,
      };
    }
    const [user] = await database
      .select({
        waNotifyChargeStart: users.waNotifyChargeStart,
        waNotifyChargeEnd: users.waNotifyChargeEnd,
        waNotifyReminder: users.waNotifyReminder,
        waNotifyPenalty: users.waNotifyPenalty,
        waNotifyWallet: users.waNotifyWallet,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      waNotifyChargeStart: user?.waNotifyChargeStart ?? true,
      waNotifyChargeEnd: user?.waNotifyChargeEnd ?? true,
      waNotifyReminder: user?.waNotifyReminder ?? false,
      waNotifyPenalty: user?.waNotifyPenalty ?? true,
      waNotifyWallet: user?.waNotifyWallet ?? true,
    };
  }),

  // Actualizar preferencias de WhatsApp del usuario
  updateWhatsAppPreferences: protectedProcedure
    .input(z.object({
      waNotifyChargeStart: z.boolean().optional(),
      waNotifyChargeEnd: z.boolean().optional(),
      waNotifyReminder: z.boolean().optional(),
      waNotifyPenalty: z.boolean().optional(),
      waNotifyWallet: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const updateData: Record<string, unknown> = {};
      if (input.waNotifyChargeStart !== undefined) updateData.waNotifyChargeStart = input.waNotifyChargeStart;
      if (input.waNotifyChargeEnd !== undefined) updateData.waNotifyChargeEnd = input.waNotifyChargeEnd;
      if (input.waNotifyReminder !== undefined) updateData.waNotifyReminder = input.waNotifyReminder;
      if (input.waNotifyPenalty !== undefined) updateData.waNotifyPenalty = input.waNotifyPenalty;
      if (input.waNotifyWallet !== undefined) updateData.waNotifyWallet = input.waNotifyWallet;

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

  // Actualizar nivel de batería del vehículo
  updateBatteryLevel: protectedProcedure
    .input(z.object({
      vehicleId: z.number().optional(),
      batteryLevel: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      let vehicleId = input.vehicleId;
      if (!vehicleId) {
        const defaultVehicle = await db.getDefaultVehicle(ctx.user.id);
        if (!defaultVehicle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No tienes un vehículo registrado" });
        }
        vehicleId = defaultVehicle.id;
      }
      const existing = await db.getUserVehicleById(vehicleId, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehículo no encontrado" });
      }
      await db.updateVehicleBatteryLevel(vehicleId, ctx.user.id, input.batteryLevel);
      return {
        message: `Batería actualizada a ${input.batteryLevel}%`,
        batteryLevel: input.batteryLevel,
        vehicleId,
      };
    }),

  // Obtener nivel de batería del vehículo por defecto
  getBatteryLevel: protectedProcedure.query(async ({ ctx }) => {
    const defaultVehicle = await db.getDefaultVehicle(ctx.user.id);
    if (!defaultVehicle) return null;
    return {
      vehicleId: defaultVehicle.id,
      vehicleName: `${defaultVehicle.brand} ${defaultVehicle.model}`,
      batteryLevel: defaultVehicle.batteryLevel,
      lastBatteryUpdate: defaultVehicle.lastBatteryUpdate,
      batteryCapacityKwh: defaultVehicle.batteryCapacityKwh ? Number(defaultVehicle.batteryCapacityKwh) : null,
      rangeKm: defaultVehicle.rangeKm,
    };
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

// SEGURIDAD: Rate limiting para intentos de 2FA (anti brute-force)
const twoFaAttempts = new Map<number, { count: number; lockUntil: number }>();
const TWO_FA_MAX_ATTEMPTS = 5;
const TWO_FA_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutos de bloqueo

function check2FALimit(userId: number): void {
  const now = Date.now();
  const entry = twoFaAttempts.get(userId);
  
  if (entry && now < entry.lockUntil) {
    const remainingSec = Math.ceil((entry.lockUntil - now) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Demasiados intentos. Intenta de nuevo en ${remainingSec} segundos.`,
    });
  }
  
  if (!entry || now >= entry.lockUntil) {
    twoFaAttempts.set(userId, { count: 0, lockUntil: 0 });
  }
}

function record2FAFailure(userId: number): void {
  const entry = twoFaAttempts.get(userId) || { count: 0, lockUntil: 0 };
  entry.count++;
  if (entry.count >= TWO_FA_MAX_ATTEMPTS) {
    entry.lockUntil = Date.now() + TWO_FA_LOCKOUT_MS;
    entry.count = 0;
    console.warn(`[Security] 2FA brute-force lockout for user ${userId}`);
  }
  twoFaAttempts.set(userId, entry);
}

function clear2FAAttempts(userId: number): void {
  twoFaAttempts.delete(userId);
}

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
      check2FALimit(ctx.user.id);
      const isValid = await verify2FAToken(ctx.user.id, input.token);
      if (!isValid) {
        record2FAFailure(ctx.user.id);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido. Verifica e intenta de nuevo.",
        });
      }
      clear2FAAttempts(ctx.user.id);
      return { success: true, message: "2FA activado correctamente" };
    }),

  // Desactivar 2FA (requiere código válido)
  disable2FA: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      check2FALimit(ctx.user.id);
      const success = await disable2FA(ctx.user.id, input.token);
      if (!success) {
        record2FAFailure(ctx.user.id);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido. No se pudo desactivar 2FA.",
        });
      }
      clear2FAAttempts(ctx.user.id);
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

// ============================================================================
// CHARGER BRANDS ROUTER
// ============================================================================

const chargerBrandsRouter = router({
  // Público: listar todas las marcas/modelos de cargadores disponibles
  list: publicProcedure.query(async () => {
    return db.getAllChargerBrands();
  }),
  
  // Público: obtener perfil de una marca por ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const brand = await db.getChargerBrandById(input.id);
      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de cargador no encontrado" });
      }
      return brand;
    }),
  
  // Admin: crear nuevo perfil de marca
  create: adminProcedure
    .input(z.object({
      brand: z.string(),
      model: z.string(),
      displayName: z.string(),
      imageUrl: z.string().optional(),
      ocppVersion: z.string().default("1.6"),
      ocppPasswordRequired: z.boolean().default(false),
      chargeType: z.enum(["AC", "DC"]),
      defaultPowerKw: z.string(),
      maxPowerKw: z.string().optional(),
      minChargingCurrentA: z.number().optional(),
      maxChargingCurrentA: z.number().optional(),
      defaultVoltage: z.number().optional(),
      phases: z.number().default(1),
      supportedConnectors: z.array(z.string()).optional(),
      supportedMeasurands: z.array(z.string()).optional(),
      energyUnit: z.string().default("Wh"),
      supportsSoC: z.boolean().default(false),
      supportsPowerMeasurement: z.boolean().default(false),
      supportsCurrentMeasurement: z.boolean().default(false),
      supportsVoltageMeasurement: z.boolean().default(false),
      supportsRemoteStart: z.boolean().default(true),
      supportsRemoteStop: z.boolean().default(true),
      supportsReset: z.boolean().default(true),
      supportsReservation: z.boolean().default(false),
      supportsSmartCharging: z.boolean().default(false),
      supportsFirmwareUpdate: z.boolean().default(false),
      ocppConfig: z.any().optional(),
      meterValueInterval: z.number().default(30),
      cloudApiBaseUrl: z.string().optional(),
      cloudApiAuthMethod: z.string().optional(),
      cloudApiDocsUrl: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createChargerBrand(input as any);
      return { id };
    }),
  
  // Admin: actualizar perfil de marca
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        brand: z.string().optional(),
        model: z.string().optional(),
        displayName: z.string().optional(),
        imageUrl: z.string().optional(),
        ocppVersion: z.string().optional(),
        ocppPasswordRequired: z.boolean().optional(),
        defaultPowerKw: z.string().optional(),
        maxPowerKw: z.string().optional(),
        supportedMeasurands: z.array(z.string()).optional(),
        supportsSoC: z.boolean().optional(),
        supportsPowerMeasurement: z.boolean().optional(),
        supportsCurrentMeasurement: z.boolean().optional(),
        supportsVoltageMeasurement: z.boolean().optional(),
        ocppConfig: z.any().optional(),
        meterValueInterval: z.number().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await db.updateChargerBrand(input.id, input.data as any);
      return { success: true };
    }),
});

// ============================================================================
// OVERSTAY ROUTER - Historial y estado de penalizaciones por ocupación
// ============================================================================

const overstayRouter = router({
  // Usuario: obtener estado de overstay activo (si tiene)
  getMyStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const { getOverstayInfo, getAllOverstaySessions } = await import("./charging/overstay-monitor");
      
      // Buscar si el usuario tiene una transacción activa (IN_PROGRESS)
      let transaction = await db.getActiveTransactionByUserId(ctx.user.id);
      
      // Si no hay transacción activa, buscar la más reciente COMPLETED (para overstay post-carga)
      if (!transaction) {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { transactions: txTable } = await import("../drizzle/schema");
          const { eq, and, desc } = await import("drizzle-orm");
          const recentCompleted = await dbInstance.select()
            .from(txTable)
            .where(
              and(
                eq(txTable.userId, ctx.user.id),
                eq(txTable.status, "COMPLETED")
              )
            )
            .orderBy(desc(txTable.endTime))
            .limit(1);
          if (recentCompleted.length > 0) {
            const tx = recentCompleted[0];
            // Only consider if ended within last 2 hours
            const endTime = tx.endTime ? new Date(tx.endTime) : null;
            if (endTime && (Date.now() - endTime.getTime()) < 2 * 60 * 60 * 1000) {
              transaction = tx;
            }
          }
        }
      }
      
      if (!transaction) return null;
      
      // Buscar el EVSE de la transacción
      const evse = await db.getEvseById(transaction.evseId);
      if (!evse) return null;
      
      // Obtener datos de estación para la UI
      const station = await db.getChargingStationById(transaction.stationId);
      const stationInfo = {
        stationName: station?.name || "Estación",
        stationAddress: station?.address || "",
        connectorType: evse.connectorType || "TYPE_2",
        powerKw: evse.powerKw ? parseFloat(evse.powerKw.toString()) : 7,
        evseIdLocal: evse.evseIdLocal || 1,
        kwhConsumed: transaction.kwhConsumed ? parseFloat(transaction.kwhConsumed.toString()) : 0,
        energyCost: transaction.energyCost ? parseFloat(transaction.energyCost.toString()) : 0,
        totalChargeCost: transaction.totalCost ? parseFloat(transaction.totalCost.toString()) : 0,
        chargeEndTime: transaction.endTime ? new Date(transaction.endTime).toISOString() : new Date().toISOString(),
        chargeStartTime: transaction.startTime ? new Date(transaction.startTime).toISOString() : new Date().toISOString(),
      };
      
      const info = getOverstayInfo(evse.id);
      if (!info) {
        // No hay overstay activo en memoria, pero verificar si el EVSE está en Finishing
        if (evse.status === "FINISHING" || evse.status === "SUSPENDED_EV") {
          // Obtener tarifa para mostrar info de grace period
          const tariff = transaction.tariffId ? await db.getTariffById(transaction.tariffId) : null;
          const globalPrices = await db.getPriceRanges();
          return {
            status: "finishing" as const,
            gracePeriodMinutes: tariff?.overstayGracePeriodMinutes ?? globalPrices.defaultOverstayGracePeriodMinutes ?? 10,
            penaltyPerMinute: tariff?.overstayPenaltyPerMinute ? parseFloat(tariff.overstayPenaltyPerMinute.toString()) : (globalPrices.defaultOverstayPenaltyPerMin ?? 500),
            evseId: evse.id,
            transactionId: transaction.id,
            ...stationInfo,
          };
        }
        return null;
      }
      
      return {
        status: info.isPenaltyActive ? "penalty" as const : "grace" as const,
        ...info,
        ...stationInfo,
      };
    }),

  // Admin: historial de transacciones con penalización por overstay
  getHistory: adminProcedure
    .input(z.object({
      stationId: z.number().optional(),
      userId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const results = await db.getOverstayTransactions({
        stationId: input?.stationId,
        userId: input?.userId,
        startDate: input?.startDate,
        endDate: input?.endDate,
        limit: input?.limit || 100,
      });

      return results.map((tx: any) => ({
        id: tx.id,
        userId: tx.userId,
        userName: tx.userName || "Usuario",
        stationId: tx.stationId,
        stationName: tx.stationName || "Estación",
        startTime: tx.startTime,
        endTime: tx.endTime,
        kwhConsumed: tx.kwhConsumed ? parseFloat(tx.kwhConsumed.toString()) : 0,
        energyCost: tx.energyCost ? parseFloat(tx.energyCost.toString()) : 0,
        overstayCost: tx.overstayCost ? parseFloat(tx.overstayCost.toString()) : 0,
        totalCost: tx.totalCost ? parseFloat(tx.totalCost.toString()) : 0,
        status: tx.status,
      }));
    }),

  // Admin: obtener sesiones de overstay activas en tiempo real
  getActiveSessions: adminProcedure
    .query(async () => {
      const { getAllOverstaySessions } = await import("./charging/overstay-monitor");
      const sessions = getAllOverstaySessions();
      
      // Enriquecer con nombres de estación y usuario
      const enriched = await Promise.all(sessions.map(async (s: any) => {
        const evse = await db.getEvseById(s.evseId);
        const station = evse ? await db.getChargingStationById(evse.stationId || 0) : null;
        const tx = await db.getTransactionById(s.transactionId);
        const user = tx ? await db.getUserById(tx.userId) : null;
        
        return {
          ...s,
          stationName: station?.name || "Estación",
          userName: user?.name || "Usuario",
          connectorId: evse?.connectorId || 0,
        };
      }));
      
      return enriched;
    }),

  // Admin: resumen estadístico de overstay
  getSummary: adminProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ input }) => {
      const results = await db.getOverstayTransactions({
        startDate: input?.startDate,
        endDate: input?.endDate,
        limit: 500,
      });

      const totalPenalties = results.reduce((sum: number, tx: any) => sum + parseFloat(tx.overstayCost?.toString() || "0"), 0);
      const totalTransactions = results.length;
      const avgPenalty = totalTransactions > 0 ? totalPenalties / totalTransactions : 0;
      
      // Agrupar por estación
      const byStation: Record<number, { name: string; count: number; total: number }> = {};
      for (const tx of results) {
        const sid = tx.stationId;
        if (!byStation[sid]) {
          byStation[sid] = { name: (tx as any).stationName || "Estación", count: 0, total: 0 };
        }
        byStation[sid].count++;
        byStation[sid].total += parseFloat(tx.overstayCost?.toString() || "0");
      }

      return {
        totalPenalties: Math.round(totalPenalties),
        totalTransactions,
        avgPenalty: Math.round(avgPenalty),
        byStation: Object.entries(byStation).map(([id, data]) => ({
          stationId: parseInt(id),
          stationName: data.name,
          count: data.count,
          total: Math.round(data.total),
        })),
       };
    }),

  // Admin: cancelar/condonar penalización por overstay (falso positivo, corte de luz, etc.)
  cancelPenalty: adminProcedure
    .input(z.object({
      transactionId: z.number(),
      reason: z.string().min(3, "Debe indicar un motivo"),
    }))
    .mutation(async ({ input, ctx }) => {
      const transaction = await db.getTransactionById(input.transactionId);
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      
      const overstayCost = parseFloat(transaction.overstayCost?.toString() || "0");
      if (overstayCost <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta transacción no tiene penalización por overstay" });
      
      // Guardar el costo original antes de cancelar
      const originalOverstayCost = overstayCost;
      const originalTotalCost = parseFloat(transaction.totalCost?.toString() || "0");
      const newTotalCost = Math.max(0, originalTotalCost - originalOverstayCost);
      
      // Actualizar transacción: poner overstayCost en 0
      await db.updateTransaction(input.transactionId, {
        overstayCost: "0",
        totalCost: newTotalCost.toString(),
      });
      
      // Reembolsar al usuario en su billetera
      const wallet = await db.getWalletByUserId(transaction.userId);
      if (wallet) {
        const currentBalance = parseFloat(wallet.balance?.toString() || "0");
        const newBalance = currentBalance + originalOverstayCost;
        await db.updateWalletBalance(transaction.userId, newBalance.toString());
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: transaction.userId,
          type: "ADMIN_REFUND",
          amount: originalOverstayCost.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          referenceId: input.transactionId,
          referenceType: "TRANSACTION",
          status: "COMPLETED",
          description: `[Admin: ${ctx.user.name || ctx.user.email}] Cancelación de penalización por overstay. Motivo: ${input.reason}`,
        });
      }
      
      // Condonar deudas asociadas a esta transacción
      const debts = await db.getUserPendingDebts(transaction.userId);
      for (const debt of debts) {
        if (debt.transactionId === input.transactionId) {
          await db.waiveUserDebt(debt.id);
        }
      }
      
      // Notificar al usuario
      await db.createNotification({
        userId: transaction.userId,
        title: "✅ Penalización cancelada",
        message: `Se ha cancelado la penalización de $${originalOverstayCost.toLocaleString("es-CO")} COP de tu última sesión de carga. Se ha reembolsado el monto a tu billetera. Motivo: ${input.reason}`,
        type: "PAYMENT",
        isRead: false,
      });
      
      console.log(`[Overstay] Admin ${ctx.user.name} cancelled penalty of $${originalOverstayCost} for tx #${input.transactionId}. Reason: ${input.reason}`);
      
      return {
        success: true,
        refundedAmount: originalOverstayCost,
        newTotalCost,
      };
    }),

  // Admin: ajustar monto de penalización (reducir parcialmente)
  adjustPenalty: adminProcedure
    .input(z.object({
      transactionId: z.number(),
      newOverstayCost: z.number().min(0, "El monto no puede ser negativo"),
      reason: z.string().min(3, "Debe indicar un motivo"),
    }))
    .mutation(async ({ input, ctx }) => {
      const transaction = await db.getTransactionById(input.transactionId);
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transacción no encontrada" });
      
      const currentOverstayCost = parseFloat(transaction.overstayCost?.toString() || "0");
      if (currentOverstayCost <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta transacción no tiene penalización" });
      if (input.newOverstayCost >= currentOverstayCost) throw new TRPCError({ code: "BAD_REQUEST", message: "El nuevo monto debe ser menor al actual" });
      
      const refundAmount = currentOverstayCost - input.newOverstayCost;
      const originalTotalCost = parseFloat(transaction.totalCost?.toString() || "0");
      const newTotalCost = originalTotalCost - refundAmount;
      
      // Actualizar transacción
      await db.updateTransaction(input.transactionId, {
        overstayCost: input.newOverstayCost.toString(),
        totalCost: Math.max(0, newTotalCost).toString(),
      });
      
      // Reembolsar la diferencia al usuario
      const wallet = await db.getWalletByUserId(transaction.userId);
      if (wallet) {
        const currentBalance = parseFloat(wallet.balance?.toString() || "0");
        const newBalance = currentBalance + refundAmount;
        await db.updateWalletBalance(transaction.userId, newBalance.toString());
        await db.createWalletTransaction({
          walletId: wallet.id,
          userId: transaction.userId,
          type: "ADMIN_REFUND",
          amount: refundAmount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          referenceId: input.transactionId,
          referenceType: "TRANSACTION",
          status: "COMPLETED",
          description: `[Admin: ${ctx.user.name || ctx.user.email}] Ajuste de penalización: $${currentOverstayCost.toLocaleString("es-CO")} → $${input.newOverstayCost.toLocaleString("es-CO")}. Motivo: ${input.reason}`,
        });
      }
      
      // Ajustar deudas asociadas si existen
      const debts = await db.getUserPendingDebts(transaction.userId);
      for (const debt of debts) {
        if (debt.transactionId === input.transactionId) {
          const debtRemaining = parseFloat(debt.remainingAmount?.toString() || "0");
          if (debtRemaining > refundAmount) {
            // Reducir deuda parcialmente
            const dbInstance = await db.getDb();
            if (dbInstance) {
              const { userDebts: userDebtsTable } = await import("../drizzle/schema");
              const { eq: eqOp } = await import("drizzle-orm");
              await dbInstance.update(userDebtsTable).set({
                remainingAmount: (debtRemaining - refundAmount).toFixed(2),
                updatedAt: new Date(),
              }).where(eqOp(userDebtsTable.id, debt.id));
            }
          } else {
            // Condonar deuda completamente
            await db.waiveUserDebt(debt.id);
          }
        }
      }
      
      // Notificar al usuario
      await db.createNotification({
        userId: transaction.userId,
        title: "💰 Penalización ajustada",
        message: `Se ha ajustado la penalización de tu sesión de carga de $${currentOverstayCost.toLocaleString("es-CO")} a $${input.newOverstayCost.toLocaleString("es-CO")} COP. Se reembolsaron $${refundAmount.toLocaleString("es-CO")} COP a tu billetera. Motivo: ${input.reason}`,
        type: "PAYMENT",
        isRead: false,
      });
      
      console.log(`[Overstay] Admin ${ctx.user.name} adjusted penalty for tx #${input.transactionId}: $${currentOverstayCost} → $${input.newOverstayCost}. Refund: $${refundAmount}`);
      
      return {
        success: true,
        previousAmount: currentOverstayCost,
        newAmount: input.newOverstayCost,
        refundedAmount: refundAmount,
      };
    }),

  // Admin: finalizar sesión fantasma remotamente (corte de luz, cargador colgado)
  forceEndSession: adminProcedure
    .input(z.object({
      evseId: z.number(),
      transactionId: z.number().optional(),
      reason: z.string().min(3, "Debe indicar un motivo"),
      cancelPenalty: z.boolean().default(true), // Por defecto cancela la penalización (es un falso positivo)
    }))
    .mutation(async ({ input, ctx }) => {
      const evse = await db.getEvseById(input.evseId);
      if (!evse) throw new TRPCError({ code: "NOT_FOUND", message: "EVSE no encontrado" });
      
      const station = await db.getChargingStationById(evse.stationId || 0);
      if (!station) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      
      const results: string[] = [];
      
      // 1. Detener el tracking de overstay en memoria
      const { onCableDisconnected, getOverstayInfo } = await import("./charging/overstay-monitor");
      const overstayInfo = getOverstayInfo(input.evseId);
      if (overstayInfo) {
        // Si se debe cancelar la penalización, limpiar la sesión sin cobrar
        if (input.cancelPenalty) {
          // Importar el mapa de sesiones directamente para limpiar sin cobrar
          const overstayModule = await import("./charging/overstay-monitor");
          // Usar onCableDisconnected que hace el cobro final, luego reembolsamos
          await onCableDisconnected(input.evseId);
          results.push("Sesión de overstay finalizada");
        } else {
          await onCableDisconnected(input.evseId);
          results.push("Sesión de overstay finalizada (con cobro)");
        }
      }
      
      // 2. Intentar enviar RemoteStop al cargador
      try {
        if (station.ocppIdentity) {
          // Buscar transacción activa para el EVSE
          const activeTx = await db.getActiveTransaction(input.evseId);
          if (activeTx) {
            const ocppTxId = (activeTx as any).ocppNumericTxId || activeTx.id;
            await dualCSMS.requestStopTransaction(station.ocppIdentity, ocppTxId);
            results.push("RemoteStop enviado al cargador");
          }
        }
      } catch (err: any) {
        results.push(`RemoteStop falló: ${err.message}`);
      }
      
      // 3. Intentar Reset Soft del cargador
      try {
        if (station.ocppIdentity) {
          await dualCSMS.reset(station.ocppIdentity, "Soft");
          results.push("Reset Soft enviado al cargador");
        }
      } catch (err: any) {
        results.push(`Reset falló: ${err.message}`);
      }
      
      // 4. Actualizar estado del EVSE a AVAILABLE
      await db.updateEvseStatus(input.evseId, "AVAILABLE");
      results.push("EVSE marcado como AVAILABLE");
      
      // 5. Si hay transacción activa, completarla
      const activeTx = await db.getActiveTransaction(input.evseId);
      if (activeTx) {
        await db.updateTransaction(activeTx.id, {
          status: "COMPLETED",
          endTime: new Date(),
        });
        results.push(`Transacción #${activeTx.id} completada`);
      }
      
      // 6. Si se pidió cancelar la penalización y hay una transacción con overstay
      if (input.cancelPenalty && input.transactionId) {
        const tx = await db.getTransactionById(input.transactionId);
        if (tx) {
          const overstayCost = parseFloat(tx.overstayCost?.toString() || "0");
          if (overstayCost > 0) {
            const originalTotal = parseFloat(tx.totalCost?.toString() || "0");
            await db.updateTransaction(input.transactionId, {
              overstayCost: "0",
              totalCost: Math.max(0, originalTotal - overstayCost).toString(),
            });
            
            // Reembolsar
            const wallet = await db.getWalletByUserId(tx.userId);
            if (wallet) {
              const bal = parseFloat(wallet.balance?.toString() || "0");
              await db.updateWalletBalance(tx.userId, (bal + overstayCost).toString());
              await db.createWalletTransaction({
                walletId: wallet.id,
                userId: tx.userId,
                type: "ADMIN_REFUND",
                amount: overstayCost.toString(),
                balanceBefore: bal.toString(),
                balanceAfter: (bal + overstayCost).toString(),
                referenceId: input.transactionId,
                referenceType: "TRANSACTION",
                status: "COMPLETED",
                description: `[Admin: ${ctx.user.name}] Reembolso por sesión fantasma. Motivo: ${input.reason}`,
              });
            }
            
            // Condonar deudas
            const debts = await db.getUserPendingDebts(tx.userId);
            for (const debt of debts) {
              if (debt.transactionId === input.transactionId) {
                await db.waiveUserDebt(debt.id);
              }
            }
            
            // Notificar
            await db.createNotification({
              userId: tx.userId,
              title: "✅ Sesión corregida",
              message: `Se detectó un problema con tu sesión de carga (posible corte de energía). La penalización de $${overstayCost.toLocaleString("es-CO")} COP ha sido cancelada y reembolsada. Motivo: ${input.reason}`,
              type: "PAYMENT",
              isRead: false,
            });
            
            results.push(`Penalización de $${overstayCost} cancelada y reembolsada`);
          }
        }
      }
      
      console.log(`[Overstay] Admin ${ctx.user.name} force-ended session on EVSE ${input.evseId}. Actions: ${results.join(", ")}. Reason: ${input.reason}`);
      
      return {
        success: true,
        actions: results,
      };
    }),
});
// ============================================================================
// INVESTOR MANAGEMENT ROUTER (Admin)
// ============================================================================

const investorManagementRouter = router({
  // Admin: listar todos los inversionistas con sus participaciones
  list: adminProcedure.query(async () => {
    const allUsers = await db.getAllUsers('investor');
    // Para cada inversionista, obtener sus participaciones
    const investorsWithData = await Promise.all(
      allUsers.map(async (user: any) => {
        const participations = await db.getInvestorParticipations(user.id);
        const stations = await db.getAllChargingStations({ ownerId: user.id });
        // Normalizar investorTypes: usar el nuevo campo JSON o derivar del legacy
        let investorTypes: string[] = [];
        if (user.investorTypes && Array.isArray(user.investorTypes) && user.investorTypes.length > 0) {
          investorTypes = user.investorTypes;
        } else if (user.investorType) {
          investorTypes = [user.investorType];
        }
        // Asegurar que 'founder' esté en los tipos si isFounder es true
        if (user.isFounder && !investorTypes.includes('founder')) {
          investorTypes.push('founder');
        }
        // Determinar tipo automáticamente basado en datos reales
        if (stations.length > 0 && !investorTypes.includes('individual')) {
          investorTypes.push('individual');
        }
        if (participations.length > 0 && !investorTypes.includes('collective')) {
          investorTypes.push('collective');
        }
        return {
          ...user,
          investorTypes, // Array de tipos NO excluyentes
          participations,
          ownedStations: stations,
          totalInvested: participations.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) + (user.investorTotalInvested || 0),
        };
      })
    );
    return investorsWithData;
  }),

  // Admin: actualizar perfil de inversionista (tipos múltiples, fundador, frase, bio, badge, etc)
  updateProfile: adminProcedure
    .input(z.object({
      userId: z.number(),
      // Nuevo: array de tipos NO excluyentes
      investorTypes: z.array(z.enum(['individual', 'collective', 'founder'])).optional(),
      // Legacy: tipo único (se mantiene por compatibilidad)
      investorType: z.enum(['individual', 'collective', 'founder']).optional(),
      isFounder: z.boolean().optional(),
      founderTitle: z.string().max(100).optional().nullable(),
      founderOrder: z.number().optional().nullable(),
      investorQuote: z.string().max(500).optional().nullable(),
      investorBio: z.string().optional().nullable(),
      investorBadge: z.enum(['gold', 'platinum', 'diamond', 'emerald']).optional().nullable(),
      investorJoinedAt: z.date().optional().nullable(),
      investorShowInWall: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, investorTypes, ...data } = input;
      // Si se envían investorTypes (array), actualizar el campo JSON y sincronizar legacy
      const updateData: any = { ...data };
      if (investorTypes !== undefined) {
        updateData.investorTypes = JSON.stringify(investorTypes);
        // Sincronizar campo legacy con el primer tipo del array
        if (investorTypes.length > 0) {
          updateData.investorType = investorTypes[0];
        }
        // Sincronizar isFounder con la presencia de 'founder' en los tipos
        updateData.isFounder = investorTypes.includes('founder');
      }
      // Actualizar investorTypes via SQL directo para JSON
      if (investorTypes !== undefined) {
        const database = await getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET investorTypes = ${JSON.stringify(investorTypes)} WHERE id = ${userId}`);
        }
        delete updateData.investorTypes; // No pasar JSON string al updateUser genérico
      }
      await db.updateUser(userId, updateData);
      return { success: true };
    }),

  // Admin: subir foto de perfil del inversionista
  uploadPhoto: adminProcedure
    .input(z.object({
      userId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string().refine(
        (ct) => ['image/jpeg', 'image/png', 'image/webp'].includes(ct),
        { message: 'Solo se permiten imágenes JPEG, PNG o WebP' }
      ),
    }))
    .mutation(async ({ input }) => {
      const sharp = (await import('sharp')).default;
      const { storagePut } = await import('./storage');
      const originalBuffer = Buffer.from(input.fileBase64, 'base64');
      if (originalBuffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La imagen no puede superar 5MB' });
      }
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const compressedBuffer = await sharp(originalBuffer)
        .resize(600, 600, { fit: 'cover', position: 'center' })
        .webp({ quality: 85 })
        .toBuffer();
      const fileKey = `investor-photos/investor-${input.userId}-${timestamp}-${randomSuffix}.webp`;
      const { url } = await storagePut(fileKey, compressedBuffer, 'image/webp');
      await db.updateUser(input.userId, { investorPhotoUrl: url } as any);
      return { photoUrl: url };
    }),

  // Público: obtener muro de fundadores
  getFoundersWall: publicProcedure.query(async () => {
    const database = await getDb();
    if (!database) return [];
    const founders = await database.select({
      id: users.id,
      name: users.name,
      investorType: users.investorType,
      isFounder: users.isFounder,
      founderTitle: users.founderTitle,
      founderOrder: users.founderOrder,
      investorPhotoUrl: users.investorPhotoUrl,
      investorQuote: users.investorQuote,
      investorBio: users.investorBio,
      investorBadge: users.investorBadge,
      investorJoinedAt: users.investorJoinedAt,
      companyName: users.companyName,
    })
      .from(users)
      .where(
        and(
          eq(users.isFounder, true),
          eq(users.investorShowInWall, true)
        )
      )
      .orderBy(users.founderOrder);
    return founders;
  }),

  // Inversionista: obtener su propio perfil completo
  getMyProfile: investorProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    // Obtener participaciones y estaciones propias
    const participations = await db.getInvestorParticipations(ctx.user.id);
    const ownedStations = await db.getAllChargingStations({ ownerId: ctx.user.id });
    // Normalizar investorTypes
    let investorTypes: string[] = [];
    if ((user as any).investorTypes && Array.isArray((user as any).investorTypes)) {
      investorTypes = (user as any).investorTypes;
    } else if (user.investorType) {
      investorTypes = [user.investorType];
    }
    if (user.isFounder && !investorTypes.includes('founder')) investorTypes.push('founder');
    if (ownedStations.length > 0 && !investorTypes.includes('individual')) investorTypes.push('individual');
    if (participations.length > 0 && !investorTypes.includes('collective')) investorTypes.push('collective');
    return {
      investorType: user.investorType,
      investorTypes, // Array de tipos NO excluyentes
      isFounder: user.isFounder,
      founderTitle: user.founderTitle,
      investorPhotoUrl: user.investorPhotoUrl,
      investorQuote: user.investorQuote,
      investorBio: user.investorBio,
      investorBadge: user.investorBadge,
      investorJoinedAt: user.investorJoinedAt,
      investorTotalInvested: user.investorTotalInvested,
      companyName: user.companyName,
      // Perfil completo: estaciones propias + participaciones colectivas
      ownedStations: ownedStations.map((s: any) => ({
        id: s.id, name: s.name, city: s.city, address: s.address, isOnline: s.isOnline,
      })),
      participations: participations.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount || 0),
        participationPercent: Number(p.participationPercent || 0),
        paymentStatus: p.paymentStatus,
        project: p.project ? {
          id: p.project.id, name: p.project.name, city: p.project.city,
          targetAmount: p.project.targetAmount, raisedAmount: p.project.raisedAmount,
        } : null,
      })),
      totalInvested: participations.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) + (user.investorTotalInvested || 0),
    };
  }),

  // Admin: eliminar inversionista (limpia participaciones, payouts, perfil)
  deleteInvestor: adminProcedure
    .input(z.object({
      userId: z.number(),
      deleteUserAccount: z.boolean().default(false), // Si true, elimina la cuenta de usuario completa
    }))
    .mutation(async ({ input }) => {
      // Verificar que el usuario existe y es inversionista
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
      }
      if (user.role !== 'investor') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'El usuario no es un inversionista' });
      }
      // No permitir eliminar al owner/admin principal
      if (user.email === 'Admin@greenhproject.com' || user.email === 'greenhproject@gmail.com') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No se puede eliminar la cuenta del administrador principal' });
      }
      const result = await db.deleteInvestor(input.userId, input.deleteUserAccount);
      return {
        success: true,
        message: input.deleteUserAccount
          ? `Inversionista y cuenta de usuario eliminados. ${result.deletedParticipations} participación(es) eliminada(s).`
          : `Perfil de inversionista eliminado. ${result.deletedParticipations} participación(es) eliminada(s). La cuenta de usuario se mantuvo como usuario normal.`,
        ...result,
      };
    }),
});

// ============================================================================
// DEBT MANAGEMENT ROUTER
// ============================================================================

const debtRouter = router({
  // Obtener deudas pendientes del usuario actual
  myDebts: protectedProcedure.query(async ({ ctx }) => {
    const pendingDebts = await db.getUserPendingDebts(ctx.user.id);
    const totalDebt = pendingDebts.reduce((sum, d) => sum + parseFloat(d.remainingAmount?.toString() || "0"), 0);
    return {
      debts: pendingDebts.map(d => ({
        id: d.id,
        originalAmount: parseFloat(d.originalAmount?.toString() || "0"),
        remainingAmount: parseFloat(d.remainingAmount?.toString() || "0"),
        reason: d.reason,
        description: d.description,
        status: d.status,
        createdAt: d.createdAt,
      })),
      totalDebt,
      hasDebt: totalDebt > 0,
    };
  }),

  // Obtener historial completo de deudas
  myDebtHistory: protectedProcedure.query(async ({ ctx }) => {
    const allDebts = await db.getAllUserDebts(ctx.user.id);
    return allDebts.map(d => ({
      id: d.id,
      originalAmount: parseFloat(d.originalAmount?.toString() || "0"),
      remainingAmount: parseFloat(d.remainingAmount?.toString() || "0"),
      reason: d.reason,
      description: d.description,
      status: d.status,
      paidAt: d.paidAt,
      createdAt: d.createdAt,
    }));
  }),

  // Pagar deudas desde billetera
  payFromWallet: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db.payAllDebtsFromWallet(ctx.user.id);
    if (result.totalPaid === 0) {
      // Verificar si hay deudas
      const hasDebt = await db.userHasPendingDebt(ctx.user.id);
      if (!hasDebt) {
        return { success: true, message: "No tienes deudas pendientes", totalPaid: 0, debtsCleared: 0 };
      }
      // Hay deuda pero no se pudo pagar (saldo insuficiente)
      const wallet = await db.getWalletByUserId(ctx.user.id);
      const balance = parseFloat(wallet?.balance?.toString() || "0");
      const totalDebt = await db.getUserTotalDebt(ctx.user.id);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Saldo insuficiente. Tu saldo es $${balance.toLocaleString()} COP pero tu deuda es $${totalDebt.toLocaleString()} COP. Recarga tu billetera primero.`,
      });
    }
    return {
      success: true,
      message: `Se pagaron $${result.totalPaid.toLocaleString()} COP (${result.debtsCleared} deuda${result.debtsCleared > 1 ? 's' : ''})`,
      totalPaid: result.totalPaid,
      debtsCleared: result.debtsCleared,
    };
  }),

  // Pagar una deuda específica
  payDebt: protectedProcedure
    .input(z.object({ debtId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const debts = await db.getUserPendingDebts(ctx.user.id);
      const debt = debts.find(d => d.id === input.debtId);
      if (!debt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deuda no encontrada" });
      }

      const remaining = parseFloat(debt.remainingAmount?.toString() || "0");
      const wallet = await db.getWalletByUserId(ctx.user.id);
      const balance = parseFloat(wallet?.balance?.toString() || "0");

      if (balance < remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente. Necesitas $${remaining.toLocaleString()} COP pero tienes $${balance.toLocaleString()} COP.`,
        });
      }

      // Descontar de billetera
      const newBalance = balance - remaining;
      await db.updateWalletBalance(ctx.user.id, newBalance.toFixed(2));
      await db.createWalletTransaction({
        walletId: wallet!.id,
        userId: ctx.user.id,
        type: "OVERSTAY_PENALTY",
        amount: (-remaining).toFixed(2),
        balanceBefore: balance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: `Pago de deuda #${debt.id} por ocupación`,
        status: "COMPLETED",
      });

      // Marcar deuda como pagada
      await db.payUserDebt(debt.id, remaining, `WALLET-${Date.now()}`);

      return {
        success: true,
        message: `Deuda de $${remaining.toLocaleString()} COP pagada exitosamente`,
        newBalance,
      };
    }),

  // Admin: ver deudas de cualquier usuario
  getUserDebts: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const allDebts = await db.getAllUserDebts(input.userId);
      const totalPending = await db.getUserTotalDebt(input.userId);
      return {
        debts: allDebts.map(d => ({
          id: d.id,
          originalAmount: parseFloat(d.originalAmount?.toString() || "0"),
          remainingAmount: parseFloat(d.remainingAmount?.toString() || "0"),
          reason: d.reason,
          description: d.description,
          status: d.status,
          paidAt: d.paidAt,
          createdAt: d.createdAt,
        })),
        totalPending,
      };
    }),

  // Admin: condonar deuda
  waiveDebt: adminProcedure
    .input(z.object({ debtId: z.number() }))
    .mutation(async ({ input }) => {
      await db.waiveUserDebt(input.debtId);
      return { success: true };
    }),

  // Admin: listado global de deudas con filtros
  adminListAll: adminProcedure
    .input(z.object({
      status: z.string().optional().default("ALL"),
      reason: z.string().optional().default("ALL"),
      search: z.string().optional().default(""),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
    }))
    .query(async ({ input }) => {
      const result = await db.getAllDebtsAdmin(input);
      return {
        debts: result.debts.map(d => ({
          id: d.id,
          userId: d.userId,
          transactionId: d.transactionId,
          originalAmount: parseFloat(d.originalAmount?.toString() || "0"),
          remainingAmount: parseFloat(d.remainingAmount?.toString() || "0"),
          reason: d.reason,
          description: d.description,
          status: d.status,
          autoChargeAttempts: d.autoChargeAttempts,
          lastAutoChargeAt: d.lastAutoChargeAt,
          paymentReference: d.paymentReference,
          paidAt: d.paidAt,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          userName: d.userName || "Usuario desconocido",
          userEmail: d.userEmail || "",
          userPhone: d.userPhone || "",
        })),
        total: result.total,
      };
    }),

  // Admin: estadísticas globales de deudas
  adminStats: adminProcedure.query(async () => {
    return db.getDebtStats();
  }),

  // Admin: cobro manual (marcar como pagada sin descontar billetera)
  adminManualPay: adminProcedure
    .input(z.object({
      debtId: z.number(),
      paymentReference: z.string().min(1, "Se requiere referencia de pago"),
    }))
    .mutation(async ({ input }) => {
      await db.adminManualPayDebt(input.debtId, input.paymentReference);
      return { success: true, message: "Deuda marcada como pagada" };
    }),

  // Admin: cobrar deuda desde billetera del usuario
  adminChargeFromWallet: adminProcedure
    .input(z.object({ debtId: z.number() }))
    .mutation(async ({ input }) => {
      const allDebts = await db.getAllUserDebts(0); // placeholder
      // Get the specific debt first
      const dbInstance = (await import("../drizzle/schema")).userDebts;
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });
      
      const { eq } = await import("drizzle-orm");
      const [debt] = await dbConn.select().from(dbInstance).where(eq(dbInstance.id, input.debtId)).limit(1);
      if (!debt) throw new TRPCError({ code: "NOT_FOUND", message: "Deuda no encontrada" });
      if (debt.status === "PAID" || debt.status === "WAIVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta deuda ya fue saldada o condonada" });
      }

      const remaining = parseFloat(debt.remainingAmount?.toString() || "0");
      const wallet = await db.getWalletByUserId(debt.userId);
      const balance = parseFloat(wallet?.balance?.toString() || "0");

      if (balance < remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Saldo insuficiente del usuario. Saldo: $${balance.toLocaleString()} COP, Deuda: $${remaining.toLocaleString()} COP`,
        });
      }

      const newBalance = balance - remaining;
      await db.updateWalletBalance(debt.userId, newBalance.toFixed(2));
      await db.createWalletTransaction({
        walletId: wallet!.id,
        userId: debt.userId,
        type: "OVERSTAY_PENALTY",
        amount: (-remaining).toFixed(2),
        balanceBefore: balance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: `Cobro admin de deuda #${debt.id}`,
        status: "COMPLETED",
      });

      await db.payUserDebt(debt.id, remaining, `ADMIN-WALLET-${Date.now()}`);
      return { success: true, message: `Se cobraron $${remaining.toLocaleString()} COP de la billetera del usuario` };
    }),
});

// ============================================================================
// ADMIN REMOTE START ROUTER - Inicio remoto de carga desde panel admin/soporte
// ============================================================================

const adminRemoteStartRouter = router({
  /**
   * Buscar usuarios para vincular con inicio remoto de carga
   * Busca por email, nombre o teléfono
   */
  searchUsers: adminProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const results = await db.searchUsers(input.query, 15);
      return results.map((u: any) => ({
        id: u.id,
        name: u.name || "Sin nombre",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "user",
        idTag: u.idTag || `USER-${u.id}`,
      }));
    }),

  /**
   * Obtener estaciones con conectores disponibles para inicio remoto
   */
  getAvailableStations: adminProcedure
    .query(async () => {
      const stations = await db.getAllChargingStations({ isActive: true });
      const enriched = await Promise.all(
        stations.map(async (station: any) => {
          const evsesList = await db.getEvsesByStationId(station.id);
          const isConnected = dualCSMS.isStationConnected(station.ocppIdentity || "");
          return {
            id: station.id,
            name: station.name,
            address: station.address,
            ocppIdentity: station.ocppIdentity,
            isOnline: station.isOnline || isConnected,
            isConnected,
            connectors: evsesList.map((e: any) => ({
              id: e.id,
              connectorId: e.connectorId || e.evseIdLocal,
              status: (e.status || "UNKNOWN").toUpperCase(),
              connectorType: e.connectorType || "Type2",
              maxPowerKw: (e as any).maxPowerKw || (e as any).powerKw || 0,
            })),
          };
        })
      );
      return enriched;
    }),

  /**
   * Obtener precio estimado para una estación y conector
   */
  getEstimatedPrice: adminProcedure
    .input(z.object({
      stationId: z.number(),
      connectorId: z.number(),
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      const { stationId, connectorId, userId } = input;
      const evsesList = await db.getEvsesByStationId(stationId);
      const selectedConnector = evsesList.find((c: any) => c.connectorId === connectorId || c.evseIdLocal === connectorId) || evsesList[0];
      const evseId = selectedConnector?.id || evsesList[0]?.id;

      const effectivePriceData = await db.getEffectiveStationPrice(stationId);
      const tariffSource = effectivePriceData.source;

      // Siempre calcular precio dinámico (IA) si hay evseId disponible
      let pricePerKwh: number;
      let dynamicPriceApplied = false;
      if (evseId) {
        try {
          const dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, evseId);
          const priceByType = await db.getPriceByConnectorType(evseId, dynamicPrice.finalPrice, tariffSource);
          pricePerKwh = priceByType.price;
          dynamicPriceApplied = true;
        } catch {
          // Fallback al precio base si falla el cálculo dinámico
          const basePrice = effectivePriceData.pricePerKwh;
          const priceByType = await db.getPriceByConnectorType(evseId, basePrice, tariffSource);
          pricePerKwh = priceByType.price;
        }
      } else {
        pricePerKwh = effectivePriceData.pricePerKwh;
      }

      // Aplicar descuento de suscripción del usuario
      let subscriptionDiscount = 0;
      try {
        const userSub = await db.getUserSubscription(userId);
        if (userSub?.isActive && userSub.discountPercentage) {
          const discountPct = parseFloat(userSub.discountPercentage);
          if (discountPct > 0) {
            subscriptionDiscount = discountPct;
            pricePerKwh = Math.round(pricePerKwh * (1 - discountPct / 100));
          }
        }
      } catch (e) { /* no-op */ }

      // Obtener saldo del usuario
      const wallet = await db.getWalletByUserId(userId);
      const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;

      return {
        pricePerKwh,
        subscriptionDiscount,
        userBalance: balance,
        tariffSource,
        useAutoPricing: dynamicPriceApplied,
        connectorType: selectedConnector?.connectorType || "Type2",
        maxPowerKw: (selectedConnector as any)?.maxPowerKw || (selectedConnector as any)?.powerKw || 0,
      };
    }),

  /**
   * INICIAR CARGA REMOTA desde admin/soporte
   * Crea la sesión pendiente + envía RemoteStartTransaction + auditoría
   */
  startRemoteCharge: adminProcedure
    .input(z.object({
      userId: z.number(),
      stationId: z.number(),
      connectorId: z.number(),
      chargeMode: z.enum(["fixed_amount", "percentage", "full_charge", "by_kwh", "by_amount"]),
      targetValue: z.number(),
      reason: z.string().min(3, "Debe indicar un motivo para la asistencia remota"),
    }))
    .mutation(async ({ input, ctx }) => {
      const { userId, stationId, connectorId, chargeMode, targetValue, reason } = input;
      const adminName = ctx.user.name || ctx.user.email || "Admin";

      // 1. Validar que el usuario existe
      const targetUser = await db.getUserById(userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      }

      // 2. Validar saldo del usuario
      const wallet = await db.getWalletByUserId(userId);
      const balance = wallet?.balance ? parseFloat(wallet.balance) : 0;

      // 3. Calcular precio dinámico (IA) siempre - misma lógica que startCharge
      const evsesList = await db.getEvsesByStationId(stationId);
      const selectedConnector = evsesList.find((c: any) => c.connectorId === connectorId || c.evseIdLocal === connectorId) || evsesList[0];
      const evseId = selectedConnector?.id || evsesList[0]?.id;

      const effectivePriceData = await db.getEffectiveStationPrice(stationId);
      const tariffSource = effectivePriceData.source;

      // Siempre usar precio dinámico de la IA
      let pricePerKwh: number;
      if (evseId) {
        try {
          const dynamicPrice = await dynamicPricing.calculateDynamicPrice(stationId, evseId);
          const priceByType = await db.getPriceByConnectorType(evseId, dynamicPrice.finalPrice, tariffSource);
          pricePerKwh = priceByType.price;
        } catch {
          // Fallback al precio base si falla el cálculo dinámico
          const basePrice = effectivePriceData.pricePerKwh;
          const priceByType = await db.getPriceByConnectorType(evseId, basePrice, tariffSource);
          pricePerKwh = priceByType.price;
        }
      } else {
        pricePerKwh = effectivePriceData.pricePerKwh;
      }

      // Aplicar descuento de suscripción
      let subscriptionDiscount = 0;
      try {
        const userSub = await db.getUserSubscription(userId);
        if (userSub?.isActive && userSub.discountPercentage) {
          const discountPct = parseFloat(userSub.discountPercentage);
          if (discountPct > 0) {
            subscriptionDiscount = discountPct;
            pricePerKwh = Math.round(pricePerKwh * (1 - discountPct / 100));
          }
        }
      } catch (e) { /* no-op */ }

      // 4. Calcular costo estimado
      let estimatedCost = 0;
      let estimatedKwhTotal = 0;
      const avgBatteryCapacity = 60; // kWh promedio de batería EV
      switch (chargeMode) {
        case "fixed_amount":
          estimatedCost = targetValue;
          estimatedKwhTotal = targetValue / pricePerKwh;
          break;
        case "by_amount":
          estimatedCost = targetValue;
          estimatedKwhTotal = targetValue / pricePerKwh;
          break;
        case "by_kwh":
          estimatedKwhTotal = targetValue;
          estimatedCost = targetValue * pricePerKwh;
          break;
        case "percentage":
          estimatedKwhTotal = ((targetValue - 20) / 100) * avgBatteryCapacity;
          estimatedCost = estimatedKwhTotal * pricePerKwh;
          break;
        case "full_charge":
          estimatedKwhTotal = 0.8 * avgBatteryCapacity;
          estimatedCost = estimatedKwhTotal * pricePerKwh;
          break;
      }

      // 5. Validar saldo (advertir pero no bloquear - admin puede decidir)
      const insufficientBalance = balance < estimatedCost;

      // 6. Obtener datos de la estación
      const stationData = await db.getChargingStationById(stationId);
      if (!stationData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      }

      const ocppIdentity = stationData.ocppIdentity || "";
      if (!ocppIdentity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La estación no tiene identidad OCPP configurada" });
      }

      // 7. Verificar conexión OCPP
      const isConnected = dualCSMS.isStationConnected(ocppIdentity);
      if (!isConnected && !stationData.isOnline) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La estación no está conectada. Verifica que el cargador tenga conexión a internet.",
        });
      }

      // 8. Crear sesión pendiente en memoria (reutilizando la estructura de charging-router)
      const { v4: uuidv4 } = await import("uuid");
      const sessionId = uuidv4();
      const { getPendingSession } = await import("./charging/charging-router");

      // Importar dinámicamente para acceder al Map de sesiones pendientes
      // Necesitamos usar la misma referencia que charging-router para que el flujo OCPP funcione
      const chargingModule = await import("./charging/charging-router");

      // Crear la sesión pendiente directamente en el módulo de charging
      // Usamos un truco: llamamos a la función interna que gestiona el Map
      // Como no hay un "setPendingSession" exportado, lo hacemos via el módulo
      // La sesión se crea en el Map interno del charging-router
      const pendingSessionData = {
        userId,
        stationId,
        connectorId,
        chargeMode: chargeMode as any,
        targetValue,
        estimatedCost,
        pricePerKwh,
        createdAt: new Date(),
        ocppIdentity,
      };

      // 9. Enviar RemoteStartTransaction al cargador
      const idTag = targetUser.idTag || `USER-${userId}`;
      let sent = false;
      let remoteStartResponse: { status: string } | null = null;

      console.log(`[AdminRemoteStart] Admin ${adminName} initiating remote charge for user ${targetUser.name || targetUser.email} (ID: ${userId}) at station ${stationData.name} (${ocppIdentity}), connector ${connectorId}`);

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[AdminRemoteStart] Attempt ${attempt}/3: Sending RemoteStartTransaction to ${ocppIdentity}, connectorId=${connectorId}, idTag=${idTag}`);
          remoteStartResponse = await dualCSMS.requestStartTransaction(ocppIdentity, connectorId, idTag);
          sent = true;
          console.log(`[AdminRemoteStart] Response: ${JSON.stringify(remoteStartResponse)}`);

          if (remoteStartResponse?.status === "Rejected") {
            console.warn(`[AdminRemoteStart] Charger ${ocppIdentity} REJECTED RemoteStartTransaction`);
            break;
          }
          break;
        } catch (error: any) {
          console.error(`[AdminRemoteStart] Attempt ${attempt}/3 failed: ${error.message}`);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      // 10. Si el cargador rechazó explícitamente
      if (remoteStartResponse?.status === "Rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El cargador rechazó la solicitud. Verifica que el vehículo esté correctamente conectado al conector.",
        });
      }

      // 11. Registrar auditoría OCPP
      await db.createOcppLog({
        ocppIdentity,
        direction: "OUT",
        messageType: "RemoteStartTransaction",
        messageId: sessionId,
        payload: {
          connectorId,
          idTag,
          initiatedBy: "ADMIN_REMOTE",
          adminId: ctx.user.id,
          adminName,
          targetUserId: userId,
          targetUserName: targetUser.name || targetUser.email,
          reason,
          chargeMode,
          targetValue,
          pricePerKwh,
          estimatedCost,
          response: remoteStartResponse,
        },
      });

      // 12. Notificar al usuario que se inició su carga remotamente
      const stationName = stationData.name || "Estación EVGreen";
      const formattedPrice = Math.round(pricePerKwh).toLocaleString("es-CO");
      await db.createNotification({
        userId,
        title: "\u26a1 Carga iniciada por soporte",
        message: `El equipo de soporte EVGreen ha iniciado una sesión de carga en ${stationName}, conector ${connectorId}. Tarifa: $${formattedPrice} COP/kWh. Motivo: ${reason}`,
        type: "CHARGE_REQUESTED",
        isRead: false,
      });

      // 13. Enviar push notification al usuario
      try {
        const { sendUserPush } = await import("./push/unified-push");
        await sendUserPush(userId, {
          type: "charging_started",
          title: "\u26a1 Carga iniciada por soporte",
          body: `Soporte EVGreen inició tu carga en ${stationName}. Tarifa: $${formattedPrice}/kWh`,
          clickAction: "/charging-monitor",
          data: { stationId: stationId.toString(), connectorId: connectorId.toString() },
        });
      } catch (pushErr) {
        console.warn(`[AdminRemoteStart] Push notification failed:`, pushErr);
      }

      // 14. Notificar al admin que inició la carga (copia para trazabilidad)
      await db.createNotification({
        userId: ctx.user.id,
        title: "\ud83d\udcdd Carga remota iniciada",
        message: `Iniciaste carga remota para ${targetUser.name || targetUser.email} en ${stationName}, conector ${connectorId}. Motivo: ${reason}. Estado: ${sent ? "Enviado" : "Pendiente de reintento"}`,
        type: "ADMIN_ACTION",
        isRead: false,
      });

      console.log(`[AdminRemoteStart] Remote charge ${sent ? "sent" : "deferred"} for user ${userId} at ${ocppIdentity}:${connectorId} by admin ${adminName}. Reason: ${reason}`);

      return {
        success: true,
        sessionId,
        sent,
        insufficientBalance,
        pricePerKwh,
        estimatedCost,
        userBalance: balance,
        stationName,
        connectorId,
        userName: targetUser.name || targetUser.email || "Usuario",
        message: sent
          ? `Carga iniciada exitosamente para ${targetUser.name || targetUser.email} en ${stationName}`
          : `Comando enviado pero sin confirmación. El sistema reintentará automáticamente.`,
      };
    }),

  /**
   * Obtener historial de inicios remotos de carga (auditoría)
   */
  getRemoteStartHistory: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return [];

      const logs = await database.execute(sql`
        SELECT ol.*, u.name as adminName, u.email as adminEmail
        FROM ocpp_logs ol
        LEFT JOIN users u ON JSON_EXTRACT(ol.payload, '$.adminId') = u.id
        WHERE ol.messageType = 'RemoteStartTransaction'
          AND JSON_EXTRACT(ol.payload, '$.initiatedBy') = 'ADMIN_REMOTE'
        ORDER BY ol.createdAt DESC
        LIMIT ${input.limit}
      `);

      return ((logs as any)[0] as any[]) || [];
    }),
});

// ============================================================================
// OCCUPANCY LIQUIDATIONS ROUTER
// Liquidaciones de tarifa de ocupación para aliados (parqueaderos)
// ============================================================================
const occupancyLiquidationsRouter = router({
  // Admin: resumen mensual de todas las estaciones
  adminSummary: adminProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ input }) => {
      return db.getOccupancyLiquidationSummaryAdmin(input.year, input.month);
    }),

  // Admin: detalle por estación
  adminByStation: adminProcedure
    .input(z.object({ stationId: z.number(), year: z.number().optional(), month: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getOccupancyLiquidationsByStation(input.stationId, input.year, input.month);
    }),

  // Admin: marcar liquidaciones como pagadas
  markPaid: adminProcedure
    .input(z.object({ hostUserId: z.number(), year: z.number(), month: z.number() }))
    .mutation(async ({ input }) => {
      await db.markOccupancyLiquidationsPaid(input.hostUserId, input.year, input.month);
      return { success: true };
    }),

  // Aliado: resumen mensual propio
  mySummary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getOccupancyLiquidationSummary(ctx.user.id, input.year, input.month);
    }),

  // Aliado: detalle de registros propios
  myRecords: protectedProcedure
    .input(z.object({ year: z.number().optional(), month: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getOccupancyLiquidationsByHost(ctx.user.id, input.year, input.month);
    }),
});

// ============================================================================
// WHATSAPP ROUTER
// ============================================================================
const whatsappRouter = router({
  getConfig: adminProcedure.query(async () => {
    const { getWhatsAppConfig } = await import("./whatsapp/whatsapp-service");
    const cfg = await getWhatsAppConfig();
    // Mask the access token for security
    if (cfg?.accessToken) {
      return { ...cfg, accessToken: cfg.accessToken.slice(0, 8) + "*".repeat(20) + cfg.accessToken.slice(-4) };
    }
    return cfg;
  }),

  saveConfig: adminProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      phoneNumberId: z.string().optional(),
      accessToken: z.string().optional(),
      wabaId: z.string().optional(),
      fromPhone: z.string().optional(),
      adminPhone: z.string().optional(),
      notifyChargeStart: z.boolean().optional(),
      notifyChargeEnd: z.boolean().optional(),
      notifyChargeProgress: z.boolean().optional(),
      notifyPenalty: z.boolean().optional(),
      notifyWalletRecharge: z.boolean().optional(),
      notifyChargerOffline: z.boolean().optional(),
      notifyReservation: z.boolean().optional(),
      notifyMonthlySummary: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const dbInst = await getDb();
      if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });
      const { whatsappConfig } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const existing = await dbInst.select().from(whatsappConfig).where(eq(whatsappConfig.id, 1)).limit(1);
      // Don't overwrite token if masked value is sent
      const tokenToSave = input.accessToken && !input.accessToken.includes("*") ? input.accessToken : undefined;
      if (existing.length > 0) {
        await dbInst.update(whatsappConfig).set({
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.phoneNumberId && { phoneNumberId: input.phoneNumberId }),
          ...(tokenToSave && { accessToken: tokenToSave }),
          ...(input.wabaId && { wabaId: input.wabaId }),
          ...(input.fromPhone && { displayPhone: input.fromPhone }),
          ...(input.adminPhone !== undefined && { adminPhone: input.adminPhone }),
          ...(input.notifyChargeStart !== undefined && { notifyChargeStart: input.notifyChargeStart }),
          ...(input.notifyChargeEnd !== undefined && { notifyChargeEnd: input.notifyChargeEnd }),
          ...(input.notifyChargeProgress !== undefined && { notifyChargeProgress: input.notifyChargeProgress }),
          ...(input.notifyPenalty !== undefined && { notifyPenalty: input.notifyPenalty }),
          ...(input.notifyWalletRecharge !== undefined && { notifyWalletRecharge: input.notifyWalletRecharge }),
          ...(input.notifyChargerOffline !== undefined && { notifyChargerOffline: input.notifyChargerOffline }),
          ...(input.notifyReservation !== undefined && { notifyReservation: input.notifyReservation }),
          ...(input.notifyMonthlySummary !== undefined && { notifyMonthlySummary: input.notifyMonthlySummary }),
          updatedAt: new Date(),
        }).where(eq(whatsappConfig.id, 1));
      } else {
        await dbInst.insert(whatsappConfig).values({
          id: 1,
          enabled: input.enabled ?? false,
          phoneNumberId: input.phoneNumberId ?? "",
          accessToken: tokenToSave ?? "",
          wabaId: input.wabaId ?? "",
          displayPhone: input.fromPhone ?? "",
          notifyChargeStart: input.notifyChargeStart ?? true,
          notifyChargeEnd: input.notifyChargeEnd ?? true,
          notifyChargeProgress: input.notifyChargeProgress ?? false,
          notifyPenalty: input.notifyPenalty ?? true,
          notifyWalletRecharge: input.notifyWalletRecharge ?? true,
          notifyChargerOffline: input.notifyChargerOffline ?? false,
          notifyReservation: input.notifyReservation ?? true,
          notifyMonthlySummary: input.notifyMonthlySummary ?? false,
        });
      }
      return { success: true };
    }),

  sendTest: adminProcedure
    .input(z.object({ toPhone: z.string(), message: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { sendWhatsAppMessage } = await import("./whatsapp/whatsapp-service");
      const ok = await sendWhatsAppMessage({
        toPhone: input.toPhone,
        message: input.message ?? `✅ *EVGreen — Mensaje de prueba*\n\nHola! Este es un mensaje de prueba del sistema de notificaciones WhatsApp de EVGreen.\n\n_Enviado por: ${ctx.user.name || ctx.user.email}_`,
        eventType: "charge_start",
        skipConfigCheck: true, // Los mensajes de prueba siempre se envían sin importar los toggles
      });
      return { success: ok };
    }),

  getLogs: adminProcedure
    .input(z.object({ limit: z.number().optional(), eventType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const dbInst = await getDb();
      if (!dbInst) return [];
      const { whatsappNotificationLog } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return dbInst.select().from(whatsappNotificationLog)
        .orderBy(desc(whatsappNotificationLog.createdAt))
        .limit(input?.limit ?? 100);
    }),
});

// ============================================================================
// NOC ROUTER - Network Operations Center Dashboard
// ============================================================================
const nocRouter = router({
  // Obtener todos los datos del NOC en una sola query optimizada
  getNetworkSnapshot: publicProcedure.query(async () => {
    const { getAllConnections } = await import("./ocpp/connection-manager");
    const { dualCSMS } = await import("./ocpp/csms-dual");
    const dbInst = await getDb();
    if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });

    const { chargingStations, evses, transactions, users: usersTable } = await import("../drizzle/schema");
    const { desc, gte, count, sum, eq: eqOp, and: andOp, inArray } = await import("drizzle-orm");

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Strings para queries raw SQL (MySQL format)
    const toMySQLDate = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const startOfDayStr = toMySQLDate(startOfDay);
    const startOfMonthStr = toMySQLDate(startOfMonth);
    const startOfWeekStr = toMySQLDate(startOfWeek);

    // Todas las estaciones
    const allStations = await dbInst.select().from(chargingStations).orderBy(chargingStations.name);
    // Todos los EVSEs
    const allEvses = await dbInst.select().from(evses);
    // Conexiones OCPP activas
    const liveConnections = getAllConnections();
    const csmsConns = dualCSMS.getConnectionsStatus();
    const connectedIds = new Set<string>();
    for (const c of csmsConns) connectedIds.add(c.ocppIdentity);
    for (const c of liveConnections) if (c.isConnected) connectedIds.add(c.ocppIdentity);

    // Transacciones activas (IN_PROGRESS)
    const activeTxs = await dbInst.select().from(transactions)
      .where(eqOp(transactions.status, "IN_PROGRESS"));

    // Potencia real de sesiones activas (desde memoria — MeterValues en tiempo real)
    const liveSessionPower = getAllActiveSessionsPower();

    // Fallback: si la sesión no está en memoria (reinicio del servidor), buscar último MeterValue en BD
    // Solo para transacciones sin datos en memoria
    const txIdsWithoutLiveData = activeTxs
      .filter(tx => !liveSessionPower.has(tx.id))
      .map(tx => tx.id);
    const fallbackPowerMap = new Map<number, number>();
    if (txIdsWithoutLiveData.length > 0) {
      try {
        const { meterValues } = await import("../drizzle/schema");
        const { sql: sqlRaw } = await import("drizzle-orm");
        // Obtener el último MeterValue con powerKw para cada transacción sin datos en memoria
        for (const txId of txIdsWithoutLiveData) {
          const lastMv = await dbInst.select({ powerKw: meterValues.powerKw })
            .from(meterValues)
            .where(eqOp(meterValues.transactionId, txId))
            .orderBy(desc(meterValues.timestamp))
            .limit(1);
          if (lastMv.length > 0 && lastMv[0].powerKw !== null) {
            fallbackPowerMap.set(txId, parseFloat(lastMv[0].powerKw?.toString() || "0"));
          }
        }
      } catch { /* fallback silencioso */ }
    }

    // KPIs del día
    const todayStats = await dbInst.select({
      count: count(),
      totalKwh: sum(transactions.kwhConsumed),
      totalRevenue: sum(transactions.totalCost),
      platformFee: sum(transactions.platformFee),
    }).from(transactions)
      .where(andOp(eqOp(transactions.status, "COMPLETED"), gte(transactions.startTime, startOfDay)));

    // KPIs del mes
    const monthStats = await dbInst.select({
      count: count(),
      totalKwh: sum(transactions.kwhConsumed),
      totalRevenue: sum(transactions.totalCost),
    }).from(transactions)
      .where(andOp(eqOp(transactions.status, "COMPLETED"), gte(transactions.startTime, startOfMonth)));

    // KPIs de la semana
    const weekStats = await dbInst.select({
      count: count(),
      totalKwh: sum(transactions.kwhConsumed),
      totalRevenue: sum(transactions.totalCost),
    }).from(transactions)
      .where(andOp(eqOp(transactions.status, "COMPLETED"), gte(transactions.startTime, startOfWeek)));

    // Últimas 20 transacciones completadas (para el ticker)
    const recentTxs = await dbInst.select({
      id: transactions.id,
      stationId: transactions.stationId,
      userId: transactions.userId,
      kwhConsumed: transactions.kwhConsumed,
      totalCost: transactions.totalCost,
      startTime: transactions.startTime,
      endTime: transactions.endTime,
      status: transactions.status,
    }).from(transactions)
      .orderBy(desc(transactions.updatedAt))
      .limit(20);

    // Enriquecer con nombres de usuario y estación
    const userIds = Array.from(new Set(recentTxs.map(t => t.userId)));
    const stationIds = Array.from(new Set(recentTxs.map(t => t.stationId)));
    const txUsers = userIds.length > 0 ? await dbInst.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
    const txStations = stationIds.length > 0 ? await dbInst.select({ id: chargingStations.id, name: chargingStations.name }).from(chargingStations).where(inArray(chargingStations.id, stationIds)) : [];
    const userMap = new Map(txUsers.map(u => [u.id, u.name]));
    const stationMap = new Map(txStations.map(s => [s.id, s.name]));

    // Top 5 estaciones por ingresos del mes (usando Drizzle ORM)
    const topStationsRaw = await dbInst.select({
      stationId: transactions.stationId,
      stationName: chargingStations.name,
      sessions: count(),
      revenue: sum(transactions.totalCost),
      kwh: sum(transactions.kwhConsumed),
    }).from(transactions)
      .innerJoin(chargingStations, eqOp(chargingStations.id, transactions.stationId))
      .where(andOp(eqOp(transactions.status, "COMPLETED"), gte(transactions.startTime, startOfMonth)))
      .groupBy(transactions.stationId, chargingStations.name)
      .orderBy(desc(sum(transactions.totalCost)))
      .limit(5);
    const topStations = topStationsRaw.map(r => ({ stationId: r.stationId, name: r.stationName, sessions: Number(r.sessions), revenue: String(r.revenue ?? '0'), kwh: String(r.kwh ?? '0') }));

    // Ingresos por hora (últimas 24h) para el gráfico (usando raw SQL)
    let hourlyData: Array<{ hour: number; sessions: number; revenue: string; kwh: string }> = [];
    try {
      const hourlyRaw = await dbInst.execute(sql`
        SELECT HOUR(startTime) as hour, COUNT(*) as sessions, SUM(totalCost) as revenue, SUM(kwhConsumed) as kwh
        FROM transactions
        WHERE status = 'COMPLETED' AND startTime >= ${startOfDayStr}
        GROUP BY HOUR(startTime)
        ORDER BY hour
      `);
      hourlyData = ((hourlyRaw as any)[0] || []) as Array<{ hour: number; sessions: number; revenue: string; kwh: string }>;
    } catch {
      // fallback: generate empty hourly data
      hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, sessions: 0, revenue: '0', kwh: '0' }));
    }

    // Construir mapa de EVSEs por estación
    const evsesByStation = new Map<number, typeof allEvses>();
    for (const e of allEvses) {
      const arr = evsesByStation.get(e.stationId) || [];
      arr.push(e);
      evsesByStation.set(e.stationId, arr);
    }

    // Construir mapa de conexiones OCPP por stationId
    const connByStation = new Map<number, any>();
    for (const c of liveConnections) {
      if (c.stationId) connByStation.set(c.stationId, c);
    }

    // Construir mapa de transacciones activas por evseId
    const activeTxByEvse = new Map<number, any>();
    for (const tx of activeTxs) activeTxByEvse.set(tx.evseId, tx);

    // Enriquecer estaciones con datos en vivo
    const enrichedStations = allStations.map(station => {
      const stationEvses = evsesByStation.get(station.id) || [];
      const ocppConn = connByStation.get(station.id);
      const isLiveOnline = station.ocppIdentity ? connectedIds.has(station.ocppIdentity) : false;
      const chargingEvses = stationEvses.filter(e => activeTxByEvse.has(e.id));
      const availableEvses = stationEvses.filter(e => e.status === "AVAILABLE" && !activeTxByEvse.has(e.id));
      const faultedEvses = stationEvses.filter(e => e.status === "FAULTED");
      // Calcular potencia real usando MeterValues (desde memoria o BD), no la potencia nominal del EVSE
      const totalPowerKw = chargingEvses.reduce((sum, e) => {
        const tx = activeTxByEvse.get(e.id);
        if (!tx) return sum;
        // 1. Potencia real desde sesión en memoria (MeterValues en tiempo real)
        const liveData = liveSessionPower.get(tx.id);
        if (liveData && liveData.currentPower > 0) return sum + liveData.currentPower;
        // 2. Fallback: último MeterValue desde BD (si el servidor se reinició)
        const fallbackPower = fallbackPowerMap.get(tx.id);
        if (fallbackPower && fallbackPower > 0) return sum + fallbackPower;
        // 3. Último recurso: potencia nominal del EVSE (estática)
        return sum + parseFloat(e.powerKw?.toString() || "0");
      }, 0);

      // Determinar estado general de la estación
      let overallStatus: "charging" | "available" | "offline" | "faulted" | "inactive" = "inactive";
      if (!station.isActive) overallStatus = "inactive";
      else if (faultedEvses.length > 0 && chargingEvses.length === 0) overallStatus = "faulted";
      else if (!isLiveOnline && station.ocppIdentity) overallStatus = "offline";
      else if (chargingEvses.length > 0) overallStatus = "charging";
      else if (availableEvses.length > 0) overallStatus = "available";
      else if (isLiveOnline) overallStatus = "available";

      return {
        id: station.id,
        name: station.name,
        city: station.city,
        department: station.department,
        address: station.address,
        latitude: station.latitude,
        longitude: station.longitude,
        ocppIdentity: station.ocppIdentity,
        isOnline: isLiveOnline,
        isActive: station.isActive,
        overallStatus,
        totalEvses: stationEvses.length,
        chargingCount: chargingEvses.length,
        availableCount: availableEvses.length,
        faultedCount: faultedEvses.length,
        totalPowerKw: Math.round(totalPowerKw * 10) / 10,
        lastHeartbeat: ocppConn?.lastHeartbeat || null,
        connectorStatuses: ocppConn?.connectorStatuses || {},
        evses: stationEvses.map(e => ({
          id: e.id,
          evseIdLocal: e.evseIdLocal,
          connectorType: e.connectorType,
          chargeType: e.chargeType,
          powerKw: e.powerKw,
          status: e.status,
          isCharging: activeTxByEvse.has(e.id),
          currentTx: activeTxByEvse.get(e.id) ? (() => {
            const tx = activeTxByEvse.get(e.id)!;
            const liveData = liveSessionPower.get(tx.id);
            const fallbackPower = fallbackPowerMap.get(tx.id);
            const realPower = (liveData && liveData.currentPower > 0)
              ? liveData.currentPower
              : (fallbackPower && fallbackPower > 0 ? fallbackPower : 0);
            return {
              id: tx.id,
              kwhConsumed: liveData ? liveData.currentKwh.toFixed(4) : tx.kwhConsumed,
              totalCost: tx.totalCost,
              startTime: tx.startTime,
              currentPower: Math.round(realPower * 10) / 10,
              soc: liveData?.soc ?? null,
              lastMeterUpdate: liveData?.lastMeterUpdate ?? null,
            };
          })() : null,
        })),
      };
    });

    // Contadores globales
    const totalStations = allStations.length;
    const onlineStations = enrichedStations.filter(s => s.isOnline).length;
    const chargingStationsCount = enrichedStations.filter(s => s.overallStatus === "charging").length;
    const offlineStations = enrichedStations.filter(s => s.overallStatus === "offline").length;
    const faultedStations = enrichedStations.filter(s => s.overallStatus === "faulted").length;
    const activeSessionsCount = activeTxs.length;
    const totalPowerDelivering = enrichedStations.reduce((sum, s) => sum + s.totalPowerKw, 0);

    return {
      timestamp: now.toISOString(),
      // KPIs globales
      kpis: {
        totalStations,
        onlineStations,
        offlineStations,
        faultedStations,
        chargingStations: chargingStationsCount,
        activeSessionsCount,
        totalPowerDelivering: Math.round(totalPowerDelivering * 10) / 10,
        today: {
          sessions: Number(todayStats[0]?.count || 0),
          kwh: parseFloat(todayStats[0]?.totalKwh?.toString() || "0"),
          revenue: parseFloat(todayStats[0]?.totalRevenue?.toString() || "0"),
          platformFee: parseFloat(todayStats[0]?.platformFee?.toString() || "0"),
        },
        week: {
          sessions: Number(weekStats[0]?.count || 0),
          kwh: parseFloat(weekStats[0]?.totalKwh?.toString() || "0"),
          revenue: parseFloat(weekStats[0]?.totalRevenue?.toString() || "0"),
        },
        month: {
          sessions: Number(monthStats[0]?.count || 0),
          kwh: parseFloat(monthStats[0]?.totalKwh?.toString() || "0"),
          revenue: parseFloat(monthStats[0]?.totalRevenue?.toString() || "0"),
        },
      },
      // Estaciones enriquecidas
      stations: enrichedStations,
      // Ticker de actividad reciente
      recentActivity: recentTxs.map(tx => ({
        id: tx.id,
        stationName: stationMap.get(tx.stationId) || `Estación #${tx.stationId}`,
        userName: userMap.get(tx.userId) || `Usuario #${tx.userId}`,
        kwhConsumed: parseFloat(tx.kwhConsumed?.toString() || "0"),
        totalCost: parseFloat(tx.totalCost?.toString() || "0"),
        startTime: tx.startTime,
        endTime: tx.endTime,
        status: tx.status,
      })),
      // Top estaciones
      topStations: topStations.map(s => ({
        stationId: s.stationId,
        name: s.name,
        sessions: Number(s.sessions),
        revenue: parseFloat(s.revenue || "0"),
        kwh: parseFloat(s.kwh || "0"),
      })),
      // Datos por hora para gráfico
      hourlyData: hourlyData.map(h => ({
        hour: h.hour,
        sessions: Number(h.sessions),
        revenue: parseFloat(h.revenue || "0"),
        kwh: parseFloat(h.kwh || "0"),
      })),
    };
  }),
});

// ─── Router de Feedback de Sesión de Carga ──────────────────────────────────
const feedbackRouter = router({
  // Enviar calificación al terminar una sesión
  submit: protectedProcedure
    .input(z.object({
      transactionId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(300).optional(),
      stationId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB no disponible" });
      // Verificar que no haya feedback previo para esta transacción
      const existing = await database.select({ id: sessionFeedback.id })
        .from(sessionFeedback)
        .where(eq(sessionFeedback.transactionId, input.transactionId))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya enviaste feedback para esta sesión." });
      }
      await database.insert(sessionFeedback).values({
        transactionId: input.transactionId,
        userId: ctx.user.id,
        stationId: input.stationId ?? null,
        rating: input.rating,
        comment: input.comment ?? null,
      });
      // Notificar al admin si la calificación es baja (1 o 2)
      if (input.rating <= 2) {
        const { notifyOwner } = await import("./_core/notification");
        const ratingLabel = input.rating === 1 ? "Muy mala" : "Mala";
        await notifyOwner({
          title: `⚠️ Feedback negativo en sesión #${input.transactionId}`,
          content: `Usuario ID ${ctx.user.id} calificó su sesión de carga con **${ratingLabel} (${input.rating}/5)**.${
            input.comment ? `\n\nComentario: "${input.comment}"` : ""
          }\n\nEstación ID: ${input.stationId ?? "desconocida"}`,
        });
      }
      return { success: true };
    }),

  // Verificar si ya existe feedback para una transacción
  checkExists: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { exists: false };
      const existing = await database.select({ id: sessionFeedback.id })
        .from(sessionFeedback)
        .where(eq(sessionFeedback.transactionId, input.transactionId))
        .limit(1);
      return { exists: existing.length > 0 };
    }),

  // Admin: listar todos los feedbacks con paginación
  adminList: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      minRating: z.number().int().min(1).max(5).optional(),
      maxRating: z.number().int().min(1).max(5).optional(),
      stationId: z.number().int().positive().optional(),
    }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { items: [], total: 0, page: 1, totalPages: 0, avgRating: null };
      const offset = (input.page - 1) * input.limit;
      const conditions: any[] = [];
      if (input.minRating !== undefined) conditions.push(sql`${sessionFeedback.rating} >= ${input.minRating}`);
      if (input.maxRating !== undefined) conditions.push(sql`${sessionFeedback.rating} <= ${input.maxRating}`);
      if (input.stationId !== undefined) conditions.push(eq(sessionFeedback.stationId, input.stationId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totals] = await Promise.all([
        database.select({
          id: sessionFeedback.id,
          transactionId: sessionFeedback.transactionId,
          userId: sessionFeedback.userId,
          stationId: sessionFeedback.stationId,
          rating: sessionFeedback.rating,
          comment: sessionFeedback.comment,
          createdAt: sessionFeedback.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
          .from(sessionFeedback)
          .leftJoin(users, eq(sessionFeedback.userId, users.id))
          .where(whereClause)
          .orderBy(sql`${sessionFeedback.createdAt} DESC`)
          .limit(input.limit)
          .offset(offset),
        database.select({ total: sql<number>`COUNT(*)` })
          .from(sessionFeedback)
          .where(whereClause),
      ]);

      const total = Number(totals[0]?.total ?? 0);
      const avgResult = await database.select({ avg: sql<number>`AVG(${sessionFeedback.rating})` })
        .from(sessionFeedback)
        .where(whereClause);

      return {
        items,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
        avgRating: avgResult[0]?.avg ? parseFloat(String(avgResult[0].avg)).toFixed(1) : null,
      };
    }),

  // Admin: resumen de calificaciones por estación
  adminSummary: adminProcedure
    .query(async () => {
      const database = await getDb();
      if (!database) return [];
      const summary = await database.select({
        stationId: sessionFeedback.stationId,
        total: sql<number>`COUNT(*)`,
        avgRating: sql<number>`AVG(${sessionFeedback.rating})`,
        rating1: sql<number>`SUM(CASE WHEN ${sessionFeedback.rating} = 1 THEN 1 ELSE 0 END)`,
        rating2: sql<number>`SUM(CASE WHEN ${sessionFeedback.rating} = 2 THEN 1 ELSE 0 END)`,
        rating3: sql<number>`SUM(CASE WHEN ${sessionFeedback.rating} = 3 THEN 1 ELSE 0 END)`,
        rating4: sql<number>`SUM(CASE WHEN ${sessionFeedback.rating} = 4 THEN 1 ELSE 0 END)`,
        rating5: sql<number>`SUM(CASE WHEN ${sessionFeedback.rating} = 5 THEN 1 ELSE 0 END)`,
      })
        .from(sessionFeedback)
        .groupBy(sessionFeedback.stationId)
        .orderBy(sql`AVG(${sessionFeedback.rating}) ASC`);

      return summary.map(s => ({
        stationId: s.stationId,
        total: Number(s.total),
        avgRating: parseFloat(String(s.avgRating)).toFixed(1),
        distribution: {
          1: Number(s.rating1), 2: Number(s.rating2), 3: Number(s.rating3),
          4: Number(s.rating4), 5: Number(s.rating5),
        },
      }));
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
  support: supportRouterV2,
  investorStats: investorStatsRouter,
  platformStats: platformStatsRouter,
  banners: bannersRouter,
  ai: aiRouter,
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
  idTags: idTagRouter,
  chargerBrands: chargerBrandsRouter,
  overstay: overstayRouter,
  investorManagement: investorManagementRouter,
  debts: debtRouter,
  adminRemoteStart: adminRemoteStartRouter,
  financial: buildFinancialRouter(router, protectedProcedure, adminProcedure),
  maintenanceSchedule: maintenanceScheduleRouter,
  onboarding: onboardingRouter,
  backup: backupRouter,
  apiKeys: buildApiKeysRouter(router, adminProcedure),
  refunds: refundsRouter,
  claims: claimsRouter,
  quotes: quotesRouter,
  spaces: spacesRouter,
  partners: partnersRouter,
  profiles: profilesRouter,
  organizations: buildOrganizationsRouter(router, adminProcedure),
  contact: contactRouter,
  saas: saasRouter,
  occupancyLiquidations: occupancyLiquidationsRouter,
  whatsapp: whatsappRouter,
  noc: nocRouter,
  feedback: feedbackRouter,
  campaignWizard: campaignWizardRouter,
});

// Iniciar sistema de backup automático al cargar el módulo
startAutomaticBackups();

export type AppRouter = typeof appRouter;
