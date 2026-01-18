import { eq, and, desc, gte, lte, sql, or, count, sum, ne, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  chargingStations,
  evses,
  transactions,
  meterValues,
  reservations,
  tariffs,
  wallets,
  walletTransactions,
  subscriptions,
  maintenanceTickets,
  notifications,
  supportTickets,
  investorPayouts,
  ocppLogs,
  banners,
  bannerViews,
  InsertChargingStation,
  InsertEvse,
  InsertTransaction,
  InsertMeterValue,
  InsertReservation,
  InsertTariff,
  InsertWallet,
  InsertWalletTransaction,
  InsertMaintenanceTicket,
  InsertNotification,
  InsertSupportTicket,
  InsertInvestorPayout,
  InsertOcppLog,
  InsertBanner,
  InsertBannerView,
  User,
  ChargingStation,
  Evse,
  Transaction,
  Reservation,
  Tariff,
  Banner,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod", "avatarUrl", "companyName", "taxId", "bankAccount", "bankName", "technicianLicense", "assignedRegion"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    
    // Asignar rol admin a la cuenta maestra
    if (user.email === "greenhproject@gmail.com") {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(role?: User["role"]) {
  const db = await getDb();
  if (!db) return [];
  if (role) {
    return db.select().from(users).where(eq(users.role, role)).orderBy(desc(users.createdAt));
  }
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: User["role"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// Vincular un usuario existente con un nuevo openId de Manus OAuth
export async function linkUserOpenId(userId: number, newOpenId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ openId: newOpenId }).where(eq(users.id, userId));
}

// ============================================================================
// CHARGING STATION OPERATIONS
// ============================================================================

export async function createChargingStation(station: InsertChargingStation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chargingStations).values(station);
  return result[0].insertId;
}

export async function getChargingStationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chargingStations).where(eq(chargingStations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getChargingStationByOcppIdentity(ocppIdentity: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chargingStations).where(eq(chargingStations.ocppIdentity, ocppIdentity)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllChargingStations(filters?: { ownerId?: number; isActive?: boolean; isPublic?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.ownerId) conditions.push(eq(chargingStations.ownerId, filters.ownerId));
  if (filters?.isActive !== undefined) conditions.push(eq(chargingStations.isActive, filters.isActive));
  if (filters?.isPublic !== undefined) conditions.push(eq(chargingStations.isPublic, filters.isPublic));
  
  if (conditions.length > 0) {
    return db.select().from(chargingStations).where(and(...conditions)).orderBy(desc(chargingStations.createdAt));
  }
  return db.select().from(chargingStations).orderBy(desc(chargingStations.createdAt));
}

export async function updateChargingStation(id: number, data: Partial<InsertChargingStation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(chargingStations).set(data).where(eq(chargingStations.id, id));
}

export async function updateStationOnlineStatus(ocppIdentity: string, isOnline: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(chargingStations)
    .set({ isOnline, lastBootNotification: isOnline ? new Date() : undefined })
    .where(eq(chargingStations.ocppIdentity, ocppIdentity));
}

export async function deleteChargingStation(id: number) {
  const db = await getDb();
  if (!db) return;
  // Primero eliminar los EVSEs asociados
  await db.delete(evses).where(eq(evses.stationId, id));
  // Luego eliminar la estación
  await db.delete(chargingStations).where(eq(chargingStations.id, id));
}

// ============================================================================
// EVSE OPERATIONS
// ============================================================================

export async function createEvse(evse: InsertEvse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evses).values(evse);
  return result[0].insertId;
}

export async function getEvseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(evses).where(eq(evses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEvsesByStationId(stationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evses).where(eq(evses.stationId, stationId)).orderBy(evses.evseIdLocal);
}

export async function updateEvseStatus(id: number, status: Evse["status"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(evses).set({ status, lastStatusUpdate: new Date() }).where(eq(evses.id, id));
}

export async function updateEvse(id: number, data: Partial<InsertEvse>) {
  const db = await getDb();
  if (!db) return;
  await db.update(evses).set(data).where(eq(evses.id, id));
}

export async function deleteEvse(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(evses).where(eq(evses.id, id));
}

export async function getAvailableEvses(filters?: { connectorType?: Evse["connectorType"]; chargeType?: Evse["chargeType"]; minPowerKw?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(evses.status, "AVAILABLE"), eq(evses.isActive, true)];
  if (filters?.connectorType) conditions.push(eq(evses.connectorType, filters.connectorType));
  if (filters?.chargeType) conditions.push(eq(evses.chargeType, filters.chargeType));
  
  return db.select().from(evses).where(and(...conditions));
}

// ============================================================================
// TRANSACTION OPERATIONS
// ============================================================================

export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(transaction);
  return result[0].insertId;
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTransactionByOcppId(ocppTransactionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.ocppTransactionId, ocppTransactionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTransactionsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.startTime)).limit(limit);
}

export async function getTransactionsByStationId(stationId: number, filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(transactions.stationId, stationId)];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  
  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.startTime));
}

export async function getTransactionsByInvestor(investorId: number, filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  // Primero obtener las estaciones del inversionista
  const investorStations = await db.select({ id: chargingStations.id }).from(chargingStations).where(eq(chargingStations.ownerId, investorId));
  const stationIds = investorStations.map(s => s.id);
  
  if (stationIds.length === 0) return [];
  
  const conditions = [inArray(transactions.stationId, stationIds)];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  
  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.startTime));
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) return;
  await db.update(transactions).set(data).where(eq(transactions.id, id));
}

export async function getActiveTransaction(evseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions)
    .where(and(eq(transactions.evseId, evseId), eq(transactions.status, "IN_PROGRESS")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// METER VALUES OPERATIONS
// ============================================================================

export async function createMeterValue(meterValue: InsertMeterValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(meterValues).values(meterValue);
}

export async function getMeterValuesByTransactionId(transactionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meterValues).where(eq(meterValues.transactionId, transactionId)).orderBy(meterValues.timestamp);
}

export async function getLatestMeterValue(transactionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meterValues)
    .where(eq(meterValues.transactionId, transactionId))
    .orderBy(desc(meterValues.timestamp))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// RESERVATION OPERATIONS
// ============================================================================

export async function createReservation(reservation: InsertReservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reservations).values(reservation);
  return result[0].insertId;
}

export async function getReservationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveReservation(evseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reservations)
    .where(and(eq(reservations.evseId, evseId), eq(reservations.status, "ACTIVE")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getReservationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservations).where(eq(reservations.userId, userId)).orderBy(desc(reservations.startTime));
}

export async function updateReservation(id: number, data: Partial<InsertReservation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reservations).set(data).where(eq(reservations.id, id));
}

export async function getExpiredReservations() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(reservations)
    .where(and(eq(reservations.status, "ACTIVE"), lte(reservations.expiryTime, now)));
}

export async function checkReservationConflict(evseId: number, startTime: Date, endTime: Date, excludeId?: number) {
  const db = await getDb();
  if (!db) return false;
  
  // Buscar reservas activas que se superpongan con el rango de tiempo solicitado
  const conflicts = await db.select().from(reservations)
    .where(
      and(
        eq(reservations.evseId, evseId),
        eq(reservations.status, "ACTIVE"),
        // Verificar superposición de tiempos
        lte(reservations.startTime, endTime),
        gte(reservations.endTime, startTime),
        excludeId ? ne(reservations.id, excludeId) : undefined
      )
    );
  
  return conflicts.length > 0;
}

export async function applyNoShowPenalty(reservationId: number) {
  const db = await getDb();
  if (!db) return;
  
  const reservation = await getReservationById(reservationId);
  if (!reservation || reservation.isPenaltyApplied) return;
  
  // Marcar la reserva como NO_SHOW y aplicar penalización
  await db.update(reservations)
    .set({ 
      status: "NO_SHOW", 
      isPenaltyApplied: true 
    })
    .where(eq(reservations.id, reservationId));
  
  // Descontar de la billetera del usuario
  const penalty = parseFloat(reservation.noShowPenalty?.toString() || "0");
  if (penalty > 0) {
    const wallet = await getWalletByUserId(reservation.userId);
    if (wallet) {
      const newBalance = parseFloat(wallet.balance?.toString() || "0") - penalty;
      await updateWalletBalance(wallet.id, Math.max(0, newBalance).toString());
      
      // Registrar la transacción de penalización
      const currentBalance = parseFloat(wallet.balance?.toString() || "0");
      await createWalletTransaction({
        walletId: wallet.id,
        userId: reservation.userId,
        amount: (-penalty).toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: Math.max(0, newBalance).toString(),
        type: "DEBIT",
        description: `Penalización por no presentarse a reserva #${reservationId}`,
        referenceType: "RESERVATION",
        referenceId: reservationId,
      });
    }
  }
  
  // Liberar el EVSE
  await updateEvseStatus(reservation.evseId, "AVAILABLE");
  
  return { penaltyApplied: penalty };
}

export async function getUpcomingReservations(userId: number, minutesAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const futureTime = new Date(now.getTime() + minutesAhead * 60 * 1000);
  
  return db.select().from(reservations)
    .where(
      and(
        eq(reservations.userId, userId),
        eq(reservations.status, "ACTIVE"),
        gte(reservations.startTime, now),
        lte(reservations.startTime, futureTime)
      )
    );
}

export async function fulfillReservation(reservationId: number, transactionId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(reservations)
    .set({ 
      status: "FULFILLED",
      transactionId 
    })
    .where(eq(reservations.id, reservationId));
}

export async function getReservationsForStation(stationId: number, date?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = date ? new Date(date.setHours(0, 0, 0, 0)) : new Date(new Date().setHours(0, 0, 0, 0));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return db.select().from(reservations)
    .where(
      and(
        eq(reservations.stationId, stationId),
        gte(reservations.startTime, startOfDay),
        lte(reservations.startTime, endOfDay)
      )
    )
    .orderBy(reservations.startTime);
}

export async function cancelReservationWithRefund(reservationId: number, refundPercent: number = 100) {
  const db = await getDb();
  if (!db) return { success: false };
  
  const reservation = await getReservationById(reservationId);
  if (!reservation || reservation.status !== "ACTIVE") {
    return { success: false, error: "Reserva no válida para cancelación" };
  }
  
  // Actualizar estado de la reserva
  await db.update(reservations)
    .set({ status: "CANCELLED" })
    .where(eq(reservations.id, reservationId));
  
  // Calcular y aplicar reembolso
  const reservationFee = parseFloat(reservation.reservationFee?.toString() || "0");
  const refundAmount = (reservationFee * refundPercent) / 100;
  
  if (refundAmount > 0) {
    const wallet = await getWalletByUserId(reservation.userId);
    if (wallet) {
      const newBalance = parseFloat(wallet.balance?.toString() || "0") + refundAmount;
      await updateWalletBalance(wallet.id, newBalance.toString());
      
      // Registrar la transacción de reembolso
      const currentBalance = parseFloat(wallet.balance?.toString() || "0");
      await createWalletTransaction({
        walletId: wallet.id,
        userId: reservation.userId,
        amount: refundAmount.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        type: "CREDIT",
        description: `Reembolso por cancelación de reserva #${reservationId} (${refundPercent}%)`,
        referenceType: "RESERVATION",
        referenceId: reservationId,
      });
    }
  }
  
  // Liberar el EVSE
  await updateEvseStatus(reservation.evseId, "AVAILABLE");
  
  return { success: true, refundAmount };
}

// ============================================================================
// TARIFF OPERATIONS
// ============================================================================

export async function createTariff(tariff: InsertTariff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tariffs).values(tariff);
  return result[0].insertId;
}

export async function getTariffById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tariffs).where(eq(tariffs.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveTariffByStationId(stationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tariffs)
    .where(and(eq(tariffs.stationId, stationId), eq(tariffs.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTariffsByStationId(stationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tariffs).where(eq(tariffs.stationId, stationId)).orderBy(desc(tariffs.createdAt));
}

export async function updateTariff(id: number, data: Partial<InsertTariff>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tariffs).set(data).where(eq(tariffs.id, id));
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

export async function createWallet(wallet: InsertWallet) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(wallets).values(wallet);
  return result[0].insertId;
}

export async function getWalletByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWalletBalance(userId: number, newBalance: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(wallets).set({ balance: newBalance }).where(eq(wallets.userId, userId));
}

export async function createWalletTransaction(walletTx: InsertWalletTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(walletTransactions).values(walletTx);
  return result[0].insertId;
}

export async function getWalletTransactionsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(limit);
}

// ============================================================================
// MAINTENANCE OPERATIONS
// ============================================================================

export async function createMaintenanceTicket(ticket: InsertMaintenanceTicket) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(maintenanceTickets).values(ticket);
  return result[0].insertId;
}

export async function getMaintenanceTicketById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMaintenanceTicketsByTechnician(technicianId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceTickets).where(eq(maintenanceTickets.technicianId, technicianId)).orderBy(desc(maintenanceTickets.createdAt));
}

export async function getMaintenanceTicketsByStation(stationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceTickets).where(eq(maintenanceTickets.stationId, stationId)).orderBy(desc(maintenanceTickets.createdAt));
}

export async function getAllMaintenanceTickets(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(maintenanceTickets).where(eq(maintenanceTickets.status, status as any)).orderBy(desc(maintenanceTickets.createdAt));
  }
  return db.select().from(maintenanceTickets).orderBy(desc(maintenanceTickets.createdAt));
}

export async function updateMaintenanceTicket(id: number, data: Partial<InsertMaintenanceTicket>) {
  const db = await getDb();
  if (!db) return;
  await db.update(maintenanceTickets).set(data).where(eq(maintenanceTickets.id, id));
}

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return result[0].insertId;
}

export async function getNotificationsByUserId(userId: number, unreadOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.isRead, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt));
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true, readAt: new Date() }).where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true, readAt: new Date() }).where(eq(notifications.userId, userId));
}

// ============================================================================
// SUPPORT TICKET OPERATIONS
// ============================================================================

export async function createSupportTicket(ticket: InsertSupportTicket) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supportTickets).values(ticket);
  return result[0].insertId;
}

export async function getSupportTicketsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt));
}

export async function getAllSupportTickets(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(supportTickets).where(eq(supportTickets.status, status)).orderBy(desc(supportTickets.createdAt));
  }
  return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
}

export async function updateSupportTicket(id: number, data: Partial<InsertSupportTicket>) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportTickets).set(data).where(eq(supportTickets.id, id));
}

// ============================================================================
// INVESTOR PAYOUT OPERATIONS
// ============================================================================

export async function createInvestorPayout(payout: InsertInvestorPayout) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(investorPayouts).values(payout);
  return result[0].insertId;
}

export async function getPayoutsByInvestorId(investorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(investorPayouts).where(eq(investorPayouts.investorId, investorId)).orderBy(desc(investorPayouts.periodEnd));
}

export async function updateInvestorPayout(id: number, data: Partial<InsertInvestorPayout>) {
  const db = await getDb();
  if (!db) return;
  await db.update(investorPayouts).set(data).where(eq(investorPayouts.id, id));
}

// ============================================================================
// OCPP LOG OPERATIONS
// ============================================================================

export async function createOcppLog(log: InsertOcppLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ocppLogs).values(log);
}

export async function getOcppLogsByStation(stationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ocppLogs).where(eq(ocppLogs.stationId, stationId)).orderBy(desc(ocppLogs.createdAt)).limit(limit);
}

// ============================================================================
// STATISTICS AND AGGREGATIONS
// ============================================================================

export async function getInvestorStats(investorId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  // Obtener estaciones del inversionista
  const investorStations = await db.select().from(chargingStations).where(eq(chargingStations.ownerId, investorId));
  const stationIds = investorStations.map(s => s.id);
  
  if (stationIds.length === 0) {
    return {
      totalStations: 0,
      totalEvses: 0,
      totalTransactions: 0,
      totalKwh: 0,
      totalRevenue: 0,
      investorShare: 0,
      platformFee: 0,
    };
  }
  
  // Obtener EVSEs
  const stationEvses = await db.select().from(evses).where(inArray(evses.stationId, stationIds));
  
  // Obtener transacciones
  const conditions = [inArray(transactions.stationId, stationIds), eq(transactions.status, "COMPLETED")];
  if (startDate) conditions.push(gte(transactions.startTime, startDate));
  if (endDate) conditions.push(lte(transactions.startTime, endDate));
  
  const txs = await db.select().from(transactions).where(and(...conditions));
  
  const totalKwh = txs.reduce((sum, tx) => sum + parseFloat(tx.kwhConsumed || "0"), 0);
  const totalRevenue = txs.reduce((sum, tx) => sum + parseFloat(tx.totalCost || "0"), 0);
  const investorShare = txs.reduce((sum, tx) => sum + parseFloat(tx.investorShare || "0"), 0);
  const platformFee = txs.reduce((sum, tx) => sum + parseFloat(tx.platformFee || "0"), 0);
  
  return {
    totalStations: investorStations.length,
    totalEvses: stationEvses.length,
    totalTransactions: txs.length,
    totalKwh,
    totalRevenue,
    investorShare,
    platformFee,
  };
}

export async function getPlatformStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const allStations = await db.select().from(chargingStations);
  const allEvses = await db.select().from(evses);
  const allUsers = await db.select().from(users);
  
  const conditions = [eq(transactions.status, "COMPLETED")];
  if (startDate) conditions.push(gte(transactions.startTime, startDate));
  if (endDate) conditions.push(lte(transactions.startTime, endDate));
  
  const txs = await db.select().from(transactions).where(and(...conditions));
  
  const totalKwh = txs.reduce((sum, tx) => sum + parseFloat(tx.kwhConsumed || "0"), 0);
  const totalRevenue = txs.reduce((sum, tx) => sum + parseFloat(tx.totalCost || "0"), 0);
  const platformFee = txs.reduce((sum, tx) => sum + parseFloat(tx.platformFee || "0"), 0);
  
  const onlineStations = allStations.filter(s => s.isOnline).length;
  const availableEvses = allEvses.filter(e => e.status === "AVAILABLE").length;
  
  return {
    totalStations: allStations.length,
    onlineStations,
    totalEvses: allEvses.length,
    availableEvses,
    totalUsers: allUsers.length,
    usersByRole: {
      staff: allUsers.filter(u => u.role === "staff").length,
      technician: allUsers.filter(u => u.role === "technician").length,
      investor: allUsers.filter(u => u.role === "investor").length,
      user: allUsers.filter(u => u.role === "user").length,
    },
    totalTransactions: txs.length,
    totalKwh,
    totalRevenue,
    platformFee,
  };
}

// ============================================================================
// GEOSPATIAL QUERIES
// ============================================================================

export async function getStationsNearLocation(lat: number, lng: number, radiusKm: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  // Fórmula de Haversine simplificada para MySQL
  // 6371 es el radio de la Tierra en km
  const stations = await db.select({
    station: chargingStations,
    distance: sql<number>`(
      6371 * acos(
        cos(radians(${lat})) * cos(radians(${chargingStations.latitude})) *
        cos(radians(${chargingStations.longitude}) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${chargingStations.latitude}))
      )
    )`.as("distance"),
  })
  .from(chargingStations)
  .where(and(eq(chargingStations.isActive, true), eq(chargingStations.isPublic, true)))
  .having(sql`distance <= ${radiusKm}`)
  .orderBy(sql`distance`);
  
  return stations;
}


// ============================================================================
// BANNER OPERATIONS
// ============================================================================

export async function createBanner(banner: InsertBanner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(banners).values(banner);
  return result[0].insertId;
}

export async function getBannerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return result[0] || null;
}

export async function getAllBanners(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(banners).where(eq(banners.status, status as any)).orderBy(desc(banners.priority), desc(banners.createdAt));
  }
  return db.select().from(banners).orderBy(desc(banners.priority), desc(banners.createdAt));
}

export async function getActiveBanners(type?: string, location?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(banners.status, "ACTIVE"),
    or(isNull(banners.startDate), lte(banners.startDate, new Date())),
    or(isNull(banners.endDate), gte(banners.endDate, new Date())),
  ];
  
  if (type) {
    conditions.push(eq(banners.type, type as any));
  }
  
  return db.select().from(banners).where(and(...conditions)).orderBy(desc(banners.priority));
}

export async function updateBanner(id: number, data: Partial<InsertBanner>) {
  const db = await getDb();
  if (!db) return;
  await db.update(banners).set(data).where(eq(banners.id, id));
}

export async function deleteBanner(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(banners).where(eq(banners.id, id));
}

export async function recordBannerImpression(bannerId: number, userId?: number, context?: string) {
  const db = await getDb();
  if (!db) return;
  
  // Incrementar contador de impresiones
  await db.update(banners).set({
    impressions: sql`${banners.impressions} + 1`,
  }).where(eq(banners.id, bannerId));
  
  // Registrar vista si hay usuario
  if (userId) {
    await db.insert(bannerViews).values({
      bannerId,
      userId,
      viewContext: context,
    });
    
    // Actualizar vistas únicas
    const existingViews = await db.select().from(bannerViews)
      .where(and(eq(bannerViews.bannerId, bannerId), eq(bannerViews.userId, userId)))
      .limit(2);
    
    if (existingViews.length === 1) {
      await db.update(banners).set({
        uniqueViews: sql`${banners.uniqueViews} + 1`,
      }).where(eq(banners.id, bannerId));
    }
  }
}

export async function recordBannerClick(bannerId: number, userId?: number) {
  const db = await getDb();
  if (!db) return;
  
  // Incrementar contador de clics
  await db.update(banners).set({
    clicks: sql`${banners.clicks} + 1`,
  }).where(eq(banners.id, bannerId));
  
  // Actualizar registro de vista si hay usuario
  if (userId) {
    await db.update(bannerViews).set({
      clicked: true,
      clickedAt: new Date(),
    }).where(and(
      eq(bannerViews.bannerId, bannerId),
      eq(bannerViews.userId, userId),
      eq(bannerViews.clicked, false),
    ));
  }
}


// ============================================================================
// AI CONFIGURATION OPERATIONS
// ============================================================================

import {
  aiConfig,
  aiConversations,
  aiMessages,
  aiUsage,
  InsertAIConfig,
  InsertAIConversation,
  InsertAIMessage,
  InsertAIUsage,
} from "../drizzle/schema";

export async function getAIConfig() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiConfig).limit(1);
  return result[0] || null;
}

export async function upsertAIConfig(config: Partial<InsertAIConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getAIConfig();
  if (existing) {
    await db.update(aiConfig).set(config).where(eq(aiConfig.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(aiConfig).values(config as InsertAIConfig);
    return result[0].insertId;
  }
}

// ============================================================================
// AI CONVERSATION OPERATIONS
// ============================================================================

export async function createAIConversation(conversation: InsertAIConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiConversations).values(conversation);
  return result[0].insertId;
}

export async function getAIConversationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  return result[0] || null;
}

export async function getAIConversationsByUserId(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), eq(aiConversations.isActive, true)))
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(limit);
}

export async function updateAIConversation(id: number, data: Partial<InsertAIConversation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiConversations).set(data).where(eq(aiConversations.id, id));
}

export async function deleteAIConversation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiConversations).set({ isActive: false }).where(eq(aiConversations.id, id));
}

// ============================================================================
// AI MESSAGE OPERATIONS
// ============================================================================

export async function createAIMessage(message: InsertAIMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiMessages).values(message);
  
  // Actualizar contador de mensajes en la conversación
  await db.update(aiConversations).set({
    messageCount: sql`${aiConversations.messageCount} + 1`,
    lastMessageAt: new Date(),
  }).where(eq(aiConversations.id, message.conversationId));
  
  return result[0].insertId;
}

export async function getAIMessagesByConversationId(conversationId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt)
    .limit(limit);
}

// ============================================================================
// AI USAGE OPERATIONS
// ============================================================================

export async function createAIUsage(usage: InsertAIUsage) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiUsage).values(usage);
}

export async function getAIUsageStats(userId: number) {
  const db = await getDb();
  if (!db) return { userUsageToday: 0, totalUsageToday: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Uso del usuario hoy
  const userUsage = await db.select({ count: sql<number>`COUNT(*)` })
    .from(aiUsage)
    .where(and(
      eq(aiUsage.userId, userId),
      gte(aiUsage.createdAt, today)
    ));
  
  // Uso total hoy
  const totalUsage = await db.select({ count: sql<number>`COUNT(*)` })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, today));
  
  return {
    userUsageToday: userUsage[0]?.count || 0,
    totalUsageToday: totalUsage[0]?.count || 0,
  };
}

// ============================================================================
// AI HELPER FUNCTIONS
// ============================================================================

export async function getNearbyStations(lat: number, lng: number, radiusKm: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const stations = await db.select({
    id: chargingStations.id,
    name: chargingStations.name,
    address: chargingStations.address,
    city: chargingStations.city,
    latitude: chargingStations.latitude,
    longitude: chargingStations.longitude,
    isOnline: chargingStations.isOnline,
    distance: sql<number>`(
      6371 * acos(
        cos(radians(${lat})) * cos(radians(${chargingStations.latitude})) *
        cos(radians(${chargingStations.longitude}) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${chargingStations.latitude}))
      )
    )`.as("distance"),
  })
  .from(chargingStations)
  .where(and(eq(chargingStations.isActive, true), eq(chargingStations.isPublic, true)))
  .having(sql`distance <= ${radiusKm}`)
  .orderBy(sql`distance`)
  .limit(20);
  
  return stations;
}

export async function getStationsAlongRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  bufferKm: number = 50
) {
  // Simplificación: obtener estaciones en un rectángulo que contiene la ruta
  const db = await getDb();
  if (!db) return [];
  
  const minLat = Math.min(origin.latitude, destination.latitude) - (bufferKm / 111);
  const maxLat = Math.max(origin.latitude, destination.latitude) + (bufferKm / 111);
  const minLng = Math.min(origin.longitude, destination.longitude) - (bufferKm / 111);
  const maxLng = Math.max(origin.longitude, destination.longitude) + (bufferKm / 111);
  
  return db.select().from(chargingStations)
    .where(and(
      eq(chargingStations.isActive, true),
      eq(chargingStations.isPublic, true),
      gte(chargingStations.latitude, minLat.toString()),
      lte(chargingStations.latitude, maxLat.toString()),
      gte(chargingStations.longitude, minLng.toString()),
      lte(chargingStations.longitude, maxLng.toString()),
    ))
    .limit(50);
}

export async function getInvestorAnalytics(
  investorId: number,
  stationIds?: number[],
  period: "day" | "week" | "month" | "quarter" | "year" = "month"
) {
  const db = await getDb();
  if (!db) return null;
  
  // Calcular fecha de inicio según el período
  const startDate = new Date();
  switch (period) {
    case "day": startDate.setDate(startDate.getDate() - 1); break;
    case "week": startDate.setDate(startDate.getDate() - 7); break;
    case "month": startDate.setMonth(startDate.getMonth() - 1); break;
    case "quarter": startDate.setMonth(startDate.getMonth() - 3); break;
    case "year": startDate.setFullYear(startDate.getFullYear() - 1); break;
  }
  
  // Obtener estaciones del inversionista
  let investorStations;
  if (stationIds && stationIds.length > 0) {
    investorStations = await db.select().from(chargingStations)
      .where(and(eq(chargingStations.ownerId, investorId), inArray(chargingStations.id, stationIds)));
  } else {
    investorStations = await db.select().from(chargingStations)
      .where(eq(chargingStations.ownerId, investorId));
  }
  
  const ids = investorStations.map(s => s.id);
  if (ids.length === 0) {
    return {
      stations: [],
      totalRevenue: 0,
      totalKwh: 0,
      totalTransactions: 0,
      averageSessionDuration: 0,
    };
  }
  
  // Obtener transacciones
  const txs = await db.select().from(transactions)
    .where(and(
      inArray(transactions.stationId, ids),
      eq(transactions.status, "COMPLETED"),
      gte(transactions.startTime, startDate)
    ));
  
  const totalRevenue = txs.reduce((sum, tx) => sum + parseFloat(tx.investorShare || "0"), 0);
  const totalKwh = txs.reduce((sum, tx) => sum + parseFloat(tx.kwhConsumed || "0"), 0);
  
  return {
    stations: investorStations,
    totalRevenue,
    totalKwh,
    totalTransactions: txs.length,
    averageSessionDuration: txs.length > 0 
      ? txs.reduce((sum, tx) => {
          if (tx.startTime && tx.endTime) {
            return sum + (new Date(tx.endTime).getTime() - new Date(tx.startTime).getTime()) / 60000;
          }
          return sum;
        }, 0) / txs.length
      : 0,
  };
}

// Objeto db para compatibilidad
export const db = {
  getAIConfig,
  upsertAIConfig,
  createAIConversation,
  getAIConversationById,
  getAIConversationsByUserId,
  updateAIConversation,
  deleteAIConversation,
  createAIMessage,
  getAIMessagesByConversationId,
  createAIUsage,
  getAIUsageStats,
  getNearbyStations,
  getStationsAlongRoute,
  getInvestorAnalytics,
};
