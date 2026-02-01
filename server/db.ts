import { eq, and, desc, gte, lte, sql, or, count, sum, ne, inArray, isNull, not, like } from "drizzle-orm";
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
  ocppAlerts,
  InsertOcppAlert,
  OcppAlert,
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
    
    // Generar idTag único para nuevos usuarios (formato: EV-XXXXXX)
    // Solo se genera si no existe, no se actualiza en upsert
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existingUser.length === 0) {
      // Nuevo usuario - generar idTag
      values.idTag = await generateUniqueIdTag();
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

// Generar idTag único para usuarios (formato: EV-XXXXXX)
export async function generateUniqueIdTag(): Promise<string> {
  const db = await getDb();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const idTag = `EV-${code}`;
    
    // Verificar que no existe
    if (db) {
      const existing = await db.select().from(users).where(eq(users.idTag, idTag)).limit(1);
      if (existing.length === 0) {
        return idTag;
      }
    } else {
      return idTag;
    }
    attempts++;
  }
  
  // Fallback con timestamp si no se puede generar uno único
  return `EV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Obtener usuario por idTag (para autorización OCPP)
export async function getUserByIdTag(idTag: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.idTag, idTag)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Regenerar idTag de un usuario
export async function regenerateUserIdTag(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const newIdTag = await generateUniqueIdTag();
  await db.update(users).set({ idTag: newIdTag }).where(eq(users.id, userId));
  return newIdTag;
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

// Eliminar un usuario
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  // Primero eliminar datos relacionados (billetera, notificaciones, etc.)
  await db.delete(wallets).where(eq(wallets.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  // Finalmente eliminar el usuario
  await db.delete(users).where(eq(users.id, userId));
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

export async function getAllTransactions(filters?: { startDate?: Date; endDate?: Date; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  
  const query = db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      stationId: transactions.stationId,
      evseId: transactions.evseId,
      status: transactions.status,
      startTime: transactions.startTime,
      endTime: transactions.endTime,
      kwhConsumed: transactions.kwhConsumed,
      totalCost: transactions.totalCost,
      platformFee: transactions.platformFee,
      userName: users.name,
      userEmail: users.email,
      stationName: chargingStations.name,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.userId, users.id))
    .leftJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .orderBy(desc(transactions.startTime))
    .limit(filters?.limit || 100);
  
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  
  return query;
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

export async function getNotificationByKey(userId: number, key: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      like(notifications.data, `%"key":"${key}"%`)
    ))
    .limit(1);
  return results[0] || null;
}

export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Solo eliminar si pertenece al usuario
  await db.delete(notifications).where(
    and(
      eq(notifications.id, id),
      eq(notifications.userId, userId)
    )
  );
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

export async function getOcppLogs(filters: {
  stationId?: number;
  ocppIdentity?: string;
  messageType?: string;
  direction?: "IN" | "OUT";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  
  const conditions = [];
  
  if (filters.stationId) {
    conditions.push(eq(ocppLogs.stationId, filters.stationId));
  }
  if (filters.ocppIdentity) {
    conditions.push(eq(ocppLogs.ocppIdentity, filters.ocppIdentity));
  }
  if (filters.messageType) {
    conditions.push(eq(ocppLogs.messageType, filters.messageType));
  }
  if (filters.direction) {
    conditions.push(eq(ocppLogs.direction, filters.direction));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const logs = await db.select()
    .from(ocppLogs)
    .where(whereClause)
    .orderBy(desc(ocppLogs.createdAt))
    .limit(filters.limit || 100)
    .offset(filters.offset || 0);
  
  // Obtener total para paginación
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(ocppLogs)
    .where(whereClause);
  
  return {
    logs,
    total: countResult[0]?.count || 0,
  };
}

export async function getOcppMessageTypes() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.selectDistinct({ messageType: ocppLogs.messageType })
    .from(ocppLogs)
    .orderBy(ocppLogs.messageType);
  
  return result.map(r => r.messageType).filter(Boolean);
}

/**
 * Obtener conexiones activas basadas en logs de BD
 * Un cargador se considera activo si:
 * - Tiene un Heartbeat o StatusNotification en los últimos 5 minutos
 * - O tiene CONNECTION sin DISCONNECTION posterior
 */
export async function getActiveConnectionsFromLogs() {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener cargadores con actividad en los últimos 5 minutos
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Obtener cargadores únicos con actividad reciente
  const recentActivity = await db.selectDistinct({
    ocppIdentity: ocppLogs.ocppIdentity,
    stationId: ocppLogs.stationId,
  })
    .from(ocppLogs)
    .where(
      and(
        not(isNull(ocppLogs.ocppIdentity)),
        gte(ocppLogs.createdAt, fiveMinutesAgo),
        inArray(ocppLogs.messageType, ['Heartbeat', 'StatusNotification', 'BootNotification', 'CONNECTION'])
      )
    );
  
  // Obtener info adicional de cada cargador activo
  const activeConnections = [];
  
  for (const activity of recentActivity) {
    if (!activity.ocppIdentity) continue;
    
    // Verificar si hay una desconexión reciente (en los últimos 5 minutos)
    const disconnection = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          eq(ocppLogs.messageType, 'DISCONNECTION'),
          gte(ocppLogs.createdAt, fiveMinutesAgo)
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(1);
    
    // Obtener la última actividad (conexión o mensaje)
    const lastActivityLog = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          inArray(ocppLogs.messageType, ['Heartbeat', 'StatusNotification', 'BootNotification', 'CONNECTION'])
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(1);
    
    // Si hay desconexión más reciente que la última actividad, está desconectado
    if (disconnection.length > 0 && lastActivityLog.length > 0) {
      if (disconnection[0].createdAt > lastActivityLog[0].createdAt) {
        continue; // Está desconectado
      }
    }
    
    if (disconnection.length > 0) continue; // Está desconectado
    
    // Obtener el último BootNotification para info del cargador
    const bootInfo = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          eq(ocppLogs.messageType, 'BootNotification'),
          eq(ocppLogs.direction, 'IN')
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(1);
    
    // Obtener el último Heartbeat
    const lastHeartbeat = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          eq(ocppLogs.messageType, 'Heartbeat')
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(1);
    
    // Obtener estados de conectores
    const connectorStatuses = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          eq(ocppLogs.messageType, 'StatusNotification'),
          eq(ocppLogs.direction, 'IN')
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(10);
    
    // Construir objeto de conexión
    const bootPayload = bootInfo[0]?.payload as any;
    const connectorStatusMap: Record<number, string> = {};
    
    for (const cs of connectorStatuses) {
      const payload = cs.payload as any;
      const connectorId = payload?.connectorId || payload?.evseId || 0;
      if (!connectorStatusMap[connectorId]) {
        connectorStatusMap[connectorId] = payload?.status || 'Unknown';
      }
    }
    
    // Determinar versión OCPP
    const connectionLog = await db.select()
      .from(ocppLogs)
      .where(
        and(
          eq(ocppLogs.ocppIdentity, activity.ocppIdentity),
          eq(ocppLogs.messageType, 'CONNECTION')
        )
      )
      .orderBy(desc(ocppLogs.createdAt))
      .limit(1);
    
    const connectionPayload = connectionLog[0]?.payload as any;
    const ocppVersion = connectionPayload?.ocppVersion || '1.6';
    
    const lastActivityTime = lastActivityLog[0]?.createdAt || new Date();
    
    activeConnections.push({
      ocppIdentity: activity.ocppIdentity,
      ocppVersion,
      stationId: activity.stationId,
      connectedAt: connectionLog[0]?.createdAt?.toISOString() || lastActivityTime.toISOString(),
      lastHeartbeat: lastHeartbeat[0]?.createdAt?.toISOString() || lastActivityTime.toISOString(),
      lastMessage: lastActivityTime.toISOString(),
      connectorStatuses: connectorStatusMap,
      bootInfo: bootPayload ? {
        vendor: bootPayload.chargePointVendor || bootPayload.chargingStation?.vendorName || 'Unknown',
        model: bootPayload.chargePointModel || bootPayload.chargingStation?.model || 'Unknown',
        serialNumber: bootPayload.chargePointSerialNumber || bootPayload.chargeBoxSerialNumber || bootPayload.chargingStation?.serialNumber,
        firmwareVersion: bootPayload.firmwareVersion || bootPayload.chargingStation?.firmwareVersion,
      } : undefined,
      isConnected: true, // Si llegó aquí, está activo
    });
  }
  
  return activeConnections;
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


// ============================================================================
// STRIPE / PAYMENT OPERATIONS
// ============================================================================

export async function addUserWalletBalance(userId: number, amount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener o crear wallet del usuario
  let wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  
  if (wallet.length === 0) {
    await db.insert(wallets).values({
      userId,
      balance: amount.toString(),
      currency: "COP",
    });
  } else {
    await db.update(wallets).set({
      balance: sql`${wallets.balance} + ${amount}`,
    }).where(eq(wallets.userId, userId));
  }
  
  // Registrar transacción de wallet
  const currentWallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (currentWallet[0]) {
    const balanceBefore = parseFloat(currentWallet[0].balance) - amount;
    await db.insert(walletTransactions).values({
      walletId: currentWallet[0].id,
      userId,
      type: "RECHARGE",
      amount: amount.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: currentWallet[0].balance,
      description: "Recarga de saldo vía Stripe",
    });
  }
}

export async function createPaymentRecord(data: {
  userId: number;
  stripeSessionId: string;
  stripePaymentIntentId: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Por ahora registramos en wallet_transactions
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, data.userId)).limit(1);
  if (wallet[0]) {
    await db.insert(walletTransactions).values({
      walletId: wallet[0].id,
      userId: data.userId,
      type: "STRIPE_PAYMENT",
      amount: data.amount.toString(),
      balanceBefore: wallet[0].balance,
      balanceAfter: wallet[0].balance,
      referenceType: data.type,
      description: `Pago Stripe: ${data.stripeSessionId}`,
      stripePaymentIntentId: data.stripePaymentIntentId,
    });
  }
}

export async function updateUserSubscription(userId: number, data: {
  stripeSubscriptionId?: string | null;
  planId?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar suscripción existente
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  
  const tier = data.planId === "premium" ? "PREMIUM" : data.planId === "basic" ? "BASIC" : "FREE";
  const discountPercentage = tier === "PREMIUM" ? "20" : tier === "BASIC" ? "10" : "0";
  
  if (existing.length === 0) {
    // Crear nueva suscripción
    await db.insert(subscriptions).values({
      userId,
      tier: tier as any,
      stripeSubscriptionId: data.stripeSubscriptionId,
      discountPercentage,
      startDate: new Date(),
      isActive: data.status === "active",
    });
  } else {
    // Actualizar suscripción existente
    const updateData: any = {};
    if (data.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.planId) {
      updateData.tier = tier;
      updateData.discountPercentage = discountPercentage;
    }
    if (data.status) {
      updateData.isActive = data.status === "active";
      if (data.status === "canceled") {
        updateData.cancelledAt = new Date();
      }
    }
    
    await db.update(subscriptions).set(updateData).where(eq(subscriptions.userId, userId));
  }
}

export async function getUserByStripeSubscriptionId(subscriptionId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscriptionId)).limit(1);
  if (sub.length === 0) return null;
  
  const user = await db.select().from(users).where(eq(users.id, sub[0].userId)).limit(1);
  return user[0] || null;
}

export async function updateTransactionPaymentStatus(transactionId: string, data: {
  stripeSessionId: string;
  stripePaymentIntentId: string;
  paymentStatus: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Actualizar el estado de pago de la transacción de carga
  // Por ahora solo registramos en logs ya que la tabla transactions no tiene campos de Stripe
  console.log(`[DB] Transaction ${transactionId} payment updated:`, data);
}

export async function getUserWallet(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return wallet[0] || null;
}

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const sub = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return sub[0] || null;
}

export async function getWalletTransactions(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (wallet.length === 0) return [];
  
  return db.select().from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet[0].id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}


// ============================================================================
// PLATFORM SETTINGS OPERATIONS
// ============================================================================

import {
  platformSettings,
  InsertPlatformSettings,
  PlatformSettings,
} from "../drizzle/schema";

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(platformSettings).limit(1);
  return result[0] || null;
}

export async function upsertPlatformSettings(settings: Partial<InsertPlatformSettings>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getPlatformSettings();
  if (existing) {
    await db.update(platformSettings).set(settings).where(eq(platformSettings.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(platformSettings).values(settings as InsertPlatformSettings);
    return result[0].insertId;
  }
}

export async function getStripeConfig() {
  const settings = await getPlatformSettings();
  if (!settings) return null;
  
  return {
    publicKey: settings.stripePublicKey,
    secretKey: settings.stripeSecretKey,
    webhookSecret: settings.stripeWebhookSecret,
    testMode: settings.stripeTestMode,
  };
}

// ============================================================================
// OCPP ALERTS OPERATIONS
// ============================================================================

export interface OcppAlertInput {
  ocppIdentity: string;
  stationId?: number | null;
  alertType: "DISCONNECTION" | "ERROR" | "FAULT" | "OFFLINE_TIMEOUT" | "BOOT_REJECTED" | "TRANSACTION_ERROR";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  acknowledged?: boolean;
  createdAt?: Date;
}

export async function createOcppAlert(alert: OcppAlertInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ocppAlerts).values({
    ocppIdentity: alert.ocppIdentity,
    stationId: alert.stationId,
    alertType: alert.alertType,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    payload: alert.payload,
    acknowledged: alert.acknowledged || false,
  });
  
  return result[0].insertId;
}

export async function getOcppAlerts(options: {
  limit?: number;
  offset?: number;
  includeAcknowledged?: boolean;
  ocppIdentity?: string;
  severity?: string;
  alertType?: string;
}): Promise<OcppAlert[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (!options.includeAcknowledged) {
    conditions.push(eq(ocppAlerts.acknowledged, false));
  }
  
  if (options.ocppIdentity) {
    conditions.push(eq(ocppAlerts.ocppIdentity, options.ocppIdentity));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const alerts = await db.select()
    .from(ocppAlerts)
    .where(whereClause)
    .orderBy(desc(ocppAlerts.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
  
  return alerts;
}

export async function acknowledgeOcppAlert(alertId: number, userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(ocppAlerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    })
    .where(eq(ocppAlerts.id, alertId));
}

export async function getOcppAlertStats(): Promise<{
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      unacknowledged: 0,
      bySeverity: {},
      byType: {},
    };
  }
  
  // Total de alertas
  const totalResult = await db.select({ count: count() }).from(ocppAlerts);
  const total = totalResult[0]?.count || 0;
  
  // Alertas no reconocidas
  const unackResult = await db.select({ count: count() })
    .from(ocppAlerts)
    .where(eq(ocppAlerts.acknowledged, false));
  const unacknowledged = unackResult[0]?.count || 0;
  
  // Por severidad
  const bySeverityResult = await db.select({
    severity: ocppAlerts.severity,
    count: count(),
  })
    .from(ocppAlerts)
    .groupBy(ocppAlerts.severity);
  
  const bySeverity: Record<string, number> = {};
  for (const row of bySeverityResult) {
    if (row.severity) {
      bySeverity[row.severity] = row.count;
    }
  }
  
  // Por tipo
  const byTypeResult = await db.select({
    alertType: ocppAlerts.alertType,
    count: count(),
  })
    .from(ocppAlerts)
    .groupBy(ocppAlerts.alertType);
  
  const byType: Record<string, number> = {};
  for (const row of byTypeResult) {
    if (row.alertType) {
      byType[row.alertType] = row.count;
    }
  }
  
  return {
    total,
    unacknowledged,
    bySeverity,
    byType,
  };
}

// ============================================================================
// OCPP METRICS OPERATIONS
// ============================================================================

export async function getOcppConnectionMetrics(
  startDate: Date,
  endDate: Date,
  granularity: "hour" | "day" = "hour"
): Promise<Array<{ timestamp: string; connections: number; disconnections: number }>> {
  const db = await getDb();
  if (!db) return [];
  
  const dateFormat = granularity === "hour" 
    ? sql`DATE_FORMAT(${ocppLogs.createdAt}, '%Y-%m-%d %H:00:00')`
    : sql`DATE_FORMAT(${ocppLogs.createdAt}, '%Y-%m-%d')`;
  
  const result = await db.select({
    timestamp: dateFormat.as('timestamp'),
    messageType: ocppLogs.messageType,
    count: count(),
  })
    .from(ocppLogs)
    .where(
      and(
        gte(ocppLogs.createdAt, startDate),
        lte(ocppLogs.createdAt, endDate),
        inArray(ocppLogs.messageType, ['CONNECTION', 'DISCONNECTION'])
      )
    )
    .groupBy(dateFormat, ocppLogs.messageType)
    .orderBy(dateFormat);
  
  // Agrupar por timestamp
  const metricsMap = new Map<string, { connections: number; disconnections: number }>();
  
  for (const row of result) {
    const ts = String(row.timestamp);
    if (!metricsMap.has(ts)) {
      metricsMap.set(ts, { connections: 0, disconnections: 0 });
    }
    const entry = metricsMap.get(ts)!;
    if (row.messageType === 'CONNECTION') {
      entry.connections = row.count;
    } else {
      entry.disconnections = row.count;
    }
  }
  
  return Array.from(metricsMap.entries()).map(([timestamp, data]) => ({
    timestamp,
    ...data,
  }));
}

export async function getOcppMessageMetrics(
  startDate: Date,
  endDate: Date,
  granularity: "hour" | "day" = "hour"
): Promise<Array<{ timestamp: string; messageType: string; count: number }>> {
  const db = await getDb();
  if (!db) return [];
  
  const dateFormat = granularity === "hour" 
    ? sql`DATE_FORMAT(${ocppLogs.createdAt}, '%Y-%m-%d %H:00:00')`
    : sql`DATE_FORMAT(${ocppLogs.createdAt}, '%Y-%m-%d')`;
  
  const result = await db.select({
    timestamp: dateFormat.as('timestamp'),
    messageType: ocppLogs.messageType,
    count: count(),
  })
    .from(ocppLogs)
    .where(
      and(
        gte(ocppLogs.createdAt, startDate),
        lte(ocppLogs.createdAt, endDate)
      )
    )
    .groupBy(dateFormat, ocppLogs.messageType)
    .orderBy(dateFormat);
  
  return result.map(row => ({
    timestamp: String(row.timestamp),
    messageType: row.messageType || 'Unknown',
    count: row.count,
  }));
}

export async function getTransactionMetrics(
  startDate: Date,
  endDate: Date,
  granularity: "hour" | "day" = "day"
): Promise<Array<{ timestamp: string; count: number; totalEnergy: number; totalRevenue: number }>> {
  const db = await getDb();
  if (!db) return [];
  
  const dateFormat = granularity === "hour" 
    ? sql`DATE_FORMAT(${transactions.startTime}, '%Y-%m-%d %H:00:00')`
    : sql`DATE_FORMAT(${transactions.startTime}, '%Y-%m-%d')`;
  
  const result = await db.select({
    timestamp: dateFormat.as('timestamp'),
    count: count(),
    totalEnergy: sum(transactions.kwhConsumed),
    totalRevenue: sum(transactions.totalCost),
  })
    .from(transactions)
    .where(
      and(
        gte(transactions.startTime, startDate),
        lte(transactions.startTime, endDate)
      )
    )
    .groupBy(dateFormat)
    .orderBy(dateFormat);
  
  return result.map(row => ({
    timestamp: String(row.timestamp),
    count: row.count,
    totalEnergy: Number(row.totalEnergy) || 0,
    totalRevenue: Number(row.totalRevenue) || 0,
  }));
}


// ============================================================================
// INVESTOR EARNINGS OPERATIONS
// ============================================================================

export async function addInvestorEarnings(
  investorId: number,
  amount: number,
  transactionId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener o crear wallet del inversor
  let wallet = await db.select().from(wallets).where(eq(wallets.userId, investorId)).limit(1);
  
  if (wallet.length === 0) {
    await db.insert(wallets).values({
      userId: investorId,
      balance: amount.toString(),
      currency: "COP",
    });
    wallet = await db.select().from(wallets).where(eq(wallets.userId, investorId)).limit(1);
  } else {
    await db.update(wallets).set({
      balance: sql`${wallets.balance} + ${amount}`,
    }).where(eq(wallets.userId, investorId));
  }
  
  // Registrar transacción de wallet
  if (wallet[0]) {
    const balanceBefore = parseFloat(wallet[0].balance) || 0;
    const balanceAfter = balanceBefore + amount;
    
    await db.insert(walletTransactions).values({
      walletId: wallet[0].id,
      userId: investorId,
      type: "EARNING",
      amount: amount.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
      referenceType: "TRANSACTION",
      referenceId: transactionId,
      description: `Ganancia por transacción de carga #${transactionId}`,
    });
  }
}

// ============================================================================
// DASHBOARD METRICS OPERATIONS
// ============================================================================

export async function getAdminDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Total de transacciones completadas
  const totalTransactions = await db.select({ count: count() })
    .from(transactions)
    .where(eq(transactions.status, "COMPLETED"));
  
  // Transacciones del mes
  const monthlyTransactions = await db.select({ 
    count: count(),
    totalKwh: sum(transactions.kwhConsumed),
    totalRevenue: sum(transactions.totalCost),
    platformFees: sum(transactions.platformFee),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, startOfMonth)
      )
    );
  
  // Transacciones de hoy
  const todayTransactions = await db.select({ 
    count: count(),
    totalKwh: sum(transactions.kwhConsumed),
    totalRevenue: sum(transactions.totalCost),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, startOfDay)
      )
    );
  
  // Transacciones en progreso
  const activeTransactions = await db.select({ count: count() })
    .from(transactions)
    .where(eq(transactions.status, "IN_PROGRESS"));
  
  // Total de estaciones
  const totalStations = await db.select({ count: count() }).from(chargingStations);
  
  // Estaciones online
  const onlineStations = await db.select({ count: count() })
    .from(chargingStations)
    .where(eq(chargingStations.isOnline, true));
  
  // Total de usuarios
  const totalUsers = await db.select({ count: count() }).from(users);
  
  return {
    totalTransactions: totalTransactions[0]?.count || 0,
    activeTransactions: activeTransactions[0]?.count || 0,
    monthly: {
      transactions: monthlyTransactions[0]?.count || 0,
      kwhSold: Number(monthlyTransactions[0]?.totalKwh) || 0,
      revenue: Number(monthlyTransactions[0]?.totalRevenue) || 0,
      platformFees: Number(monthlyTransactions[0]?.platformFees) || 0,
    },
    today: {
      transactions: todayTransactions[0]?.count || 0,
      kwhSold: Number(todayTransactions[0]?.totalKwh) || 0,
      revenue: Number(todayTransactions[0]?.totalRevenue) || 0,
    },
    stations: {
      total: totalStations[0]?.count || 0,
      online: onlineStations[0]?.count || 0,
    },
    users: {
      total: totalUsers[0]?.count || 0,
    },
  };
}

export async function getInvestorDashboardMetrics(investorId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Obtener estaciones del inversor
  const investorStations = await db.select({ id: chargingStations.id })
    .from(chargingStations)
    .where(eq(chargingStations.ownerId, investorId));
  
  const stationIds = investorStations.map(s => s.id);
  
  if (stationIds.length === 0) {
    return {
      totalStations: 0,
      onlineStations: 0,
      totalTransactions: 0,
      monthlyTransactions: 0,
      monthlyKwh: 0,
      monthlyRevenue: 0,
      monthlyEarnings: 0,
      walletBalance: 0,
    };
  }
  
  // Estaciones online
  const onlineStations = await db.select({ count: count() })
    .from(chargingStations)
    .where(
      and(
        eq(chargingStations.ownerId, investorId),
        eq(chargingStations.isOnline, true)
      )
    );
  
  // Transacciones totales
  const totalTransactions = await db.select({ count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        inArray(transactions.stationId, stationIds)
      )
    );
  
  // Transacciones del mes
  const monthlyData = await db.select({ 
    count: count(),
    totalKwh: sum(transactions.kwhConsumed),
    totalRevenue: sum(transactions.totalCost),
    investorShare: sum(transactions.investorShare),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        inArray(transactions.stationId, stationIds),
        gte(transactions.startTime, startOfMonth)
      )
    );
  
  // Balance de wallet
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, investorId)).limit(1);
  
  return {
    totalStations: stationIds.length,
    onlineStations: onlineStations[0]?.count || 0,
    totalTransactions: totalTransactions[0]?.count || 0,
    monthlyTransactions: monthlyData[0]?.count || 0,
    monthlyKwh: Number(monthlyData[0]?.totalKwh) || 0,
    monthlyRevenue: Number(monthlyData[0]?.totalRevenue) || 0,
    monthlyEarnings: Number(monthlyData[0]?.investorShare) || 0,
    walletBalance: Number(wallet[0]?.balance) || 0,
  };
}

export async function getUserActiveTransaction(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    transaction: transactions,
    station: chargingStations,
    evse: evses,
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .innerJoin(evses, eq(transactions.evseId, evses.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "IN_PROGRESS")
      )
    )
    .limit(1);
  
  return result[0] || null;
}

export async function getUserTransactionHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    transaction: transactions,
    station: chargingStations,
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.startTime))
    .limit(limit);
}

export async function getUserMonthlyStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const result = await db.select({
    count: count(),
    totalKwh: sum(transactions.kwhConsumed),
    totalCost: sum(transactions.totalCost),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, startOfMonth)
      )
    );
  
  return {
    sessions: result[0]?.count || 0,
    kwhConsumed: Number(result[0]?.totalKwh) || 0,
    totalSpent: Number(result[0]?.totalCost) || 0,
  };
}


// ============================================================================
// TOP STATIONS AND RECENT TRANSACTIONS
// ============================================================================

export async function getTopStationsByRevenue(
  startDate: Date,
  endDate: Date,
  limit: number = 10
) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    stationId: transactions.stationId,
    stationName: chargingStations.name,
    city: chargingStations.city,
    transactionCount: count(),
    totalKwh: sum(transactions.kwhConsumed),
    totalRevenue: sum(transactions.totalCost),
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, startDate),
        lte(transactions.startTime, endDate)
      )
    )
    .groupBy(transactions.stationId, chargingStations.name, chargingStations.city)
    .orderBy(desc(sum(transactions.totalCost)))
    .limit(limit);
  
  return result.map(row => ({
    stationId: row.stationId,
    stationName: row.stationName,
    city: row.city,
    transactionCount: row.transactionCount,
    totalKwh: Number(row.totalKwh) || 0,
    totalRevenue: Number(row.totalRevenue) || 0,
  }));
}

export async function getRecentTransactions(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    transaction: transactions,
    station: chargingStations,
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .innerJoin(users, eq(transactions.userId, users.id))
    .orderBy(desc(transactions.startTime))
    .limit(limit);
  
  return result;
}


// ============================================================================
// PRICE ALERT OPERATIONS
// ============================================================================

/**
 * Obtener usuarios que han cargado en una estación en los últimos N días
 * Para enviar notificaciones de cambio de precio
 */
export async function getUsersWithRecentTransactions(
  stationId: number,
  daysBack: number = 30
): Promise<Array<{ id: number; name: string | null; email: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  // Obtener usuarios únicos que han cargado en esta estación
  const result = await db.selectDistinct({
    id: users.id,
    name: users.name,
    email: users.email,
  })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .where(
      and(
        eq(transactions.stationId, stationId),
        gte(transactions.startTime, startDate),
        eq(users.isActive, true)
      )
    );
  
  return result;
}

/**
 * Obtener usuarios suscritos a alertas de precio en estaciones cercanas
 */
export async function getUsersNearStation(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Array<{ id: number; name: string | null; email: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  
  // Calcular bounding box aproximado
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
  
  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const minLng = longitude - lngDelta;
  const maxLng = longitude + lngDelta;
  
  // Obtener usuarios que han cargado en estaciones dentro del radio
  const result = await db.selectDistinct({
    id: users.id,
    name: users.name,
    email: users.email,
  })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(
      and(
        eq(users.isActive, true),
        gte(chargingStations.latitude, minLat.toString()),
        lte(chargingStations.latitude, maxLat.toString()),
        gte(chargingStations.longitude, minLng.toString()),
        lte(chargingStations.longitude, maxLng.toString())
      )
    );
  
  return result;
}


// ============================================================================
// CHARGING FLOW OPERATIONS
// ============================================================================

/**
 * Obtener estación por ocppIdentity
 */
export async function getStationByOcppIdentity(ocppIdentity: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(chargingStations)
    .where(eq(chargingStations.ocppIdentity, ocppIdentity))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Obtener transacción activa de un usuario
 */
export async function getActiveTransactionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "IN_PROGRESS")
      )
    )
    .orderBy(desc(transactions.startTime))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Obtener último valor de medición de una transacción
 */
export async function getLastMeterValue(transactionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(meterValues)
    .where(eq(meterValues.transactionId, transactionId))
    .orderBy(desc(meterValues.timestamp))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Obtener transacciones de un usuario con paginación
 */
export async function getUserTransactions(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: transactions.id,
    stationId: transactions.stationId,
    stationName: chargingStations.name,
    evseId: transactions.evseId,
    startTime: transactions.startTime,
    endTime: transactions.endTime,
    energyDelivered: transactions.kwhConsumed,
    totalCost: transactions.totalCost,
    status: transactions.status,
    energyCost: transactions.energyCost,
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.startTime))
    .limit(limit)
    .offset(offset);
  
  return result;
}

/**
 * Descontar saldo de la billetera del usuario
 */
export async function deductWalletBalance(userId: number, amount: number, transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Obtener wallet actual
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  
  if (wallet.length === 0) {
    throw new Error("Usuario no tiene billetera");
  }
  
  const currentBalance = parseFloat(wallet[0].balance);
  if (currentBalance < amount) {
    throw new Error("Saldo insuficiente");
  }
  
  const newBalance = currentBalance - amount;
  
  // Actualizar balance
  await db.update(wallets).set({
    balance: newBalance.toString(),
  }).where(eq(wallets.userId, userId));
  
  // Registrar transacción de wallet
  await db.insert(walletTransactions).values({
    walletId: wallet[0].id,
    userId,
    type: "CHARGE",
    amount: (-amount).toString(),
    balanceBefore: currentBalance.toString(),
    balanceAfter: newBalance.toString(),
    referenceType: "TRANSACTION",
    referenceId: transactionId,
    description: `Pago por carga de vehículo #${transactionId}`,
  });
  
  return newBalance;
}
