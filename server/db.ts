import { eq, and, desc, asc, gte, lte, lt, gt, sql, or, count, sum, avg, ne, inArray, isNull, not, like } from "drizzle-orm";
/**
 * ============================================================================
 * EVGreen Platform - Funciones de Base de Datos (db.ts)
 * ============================================================================
 * Archivo principal de acceso a datos (~6000 líneas).
 * Contiene TODAS las queries SQL organizadas por dominio.
 * 
 * NOTA: columnas BD usan snake_case, código usa camelCase.
 * En queries raw usar: status (crowdfunding_projects), payment_status, payment_reference
 * 
 * @author Green House Project
 * @version 2.0.0 (Marzo 2026)
 * @see ARCHITECTURE.md
 * ============================================================================
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
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
  bannerDailyStats,
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
  priceHistory,
  InsertPriceHistory,
  PriceHistory,
  platformSettings,
  PlatformSettings,
  InsertPlatformSettings,
  favoriteStations,
  FavoriteStation,
  InsertFavoriteStation,
  wompiTransactions,
  WompiTransaction,
  InsertWompiTransaction,
  firmwareUpdates,
  stationReviews,
  InsertStationReview,
  StationReview,
  idTags,
  IdTag,
  InsertIdTag,
  chargerBrands,
  ChargerBrand,
  InsertChargerBrand,
  tariffChangeLogs,
  TariffChangeLog,
  InsertTariffChangeLog,
  userLocationHistory,
  InsertUserLocationHistory,
  UserLocationHistory,
  userRoutePatterns,
  InsertUserRoutePattern,
  UserRoutePattern,
  userDebts,
  UserDebt,
  InsertUserDebt,
  userConsumptionProfile,
  UserConsumptionProfile,
  InsertUserConsumptionProfile,
  stationFixedExpenses,
  StationFixedExpense,
  InsertStationFixedExpense,
  financialSettlements,
  FinancialSettlement,
  InsertFinancialSettlement,
  settlementExpenseItems,
  SettlementExpenseItem,
  InsertSettlementExpenseItem,
  investorSettlementShares,
  InvestorSettlementShare,
  InsertInvestorSettlementShare,
  operationalMetrics,
  OperationalMetric,
  InsertOperationalMetric,
  maintenanceFundRecords,
  InsertMaintenanceFundRecord,
  refunds,
  Refund,
  InsertRefund,
  claims,
  Claim,
  InsertClaim,
  localAuthLists,
  LocalAuthList,
  InsertLocalAuthList,
  localAuthEntries,
  LocalAuthEntry,
  InsertLocalAuthEntry,
  offlineTransactions,
  OfflineTransaction,
  InsertOfflineTransaction,
  userVehicles,
  UserVehicle,
  InsertUserVehicle,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;
let _dbInitPromise: Promise<ReturnType<typeof drizzle> | null> | null = null;

/**
 * Create a resilient MySQL connection pool with:
 * - Connection pooling (max 10 connections)
 * - Automatic reconnection on ECONNRESET
 * - TCP keepalive to detect dead connections
 * - Configurable timeouts
 */
function createPool(): mysql.Pool {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const url = new URL(dbUrl);
  const sslParam = url.searchParams.get('ssl');
  let sslConfig: any = undefined;
  if (sslParam) {
    try {
      const parsed = JSON.parse(sslParam);
      sslConfig = parsed.rejectUnauthorized !== undefined ? parsed : { rejectUnauthorized: true };
    } catch {
      sslConfig = { rejectUnauthorized: true };
    }
  }
  url.searchParams.delete('ssl');

  const pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: sslConfig,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    waitForConnections: true,
    queueLimit: 50,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
  });

  pool.on('connection', () => {
    console.log('[Database] New pool connection created');
  });

  pool.on('error', (err: any) => {
    console.error('[Database] Pool error:', err.code || err.message);
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('[Database] Connection lost, pool will auto-reconnect on next query');
    }
  });

  return pool;
}

/** Get the database instance with resilient connection pool. */
export async function getDb() {
  if (_db) return _db;
  if (_dbInitPromise) return _dbInitPromise;

  _dbInitPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('[Database] DATABASE_URL not set');
      return null;
    }
    try {
      _pool = createPool();
      _db = drizzle(_pool);
      // Verify connection works
      const promisePool = _pool.promise();
      const conn = await promisePool.getConnection();
      await conn.ping();
      conn.release();
      console.log('[Database] Pool initialized successfully');
      return _db;
    } catch (error: any) {
      console.error('[Database] Failed to initialize pool:', error.message);
      _db = null;
      _pool = null;
      _dbInitPromise = null;
      return null;
    }
  })();

  const result = await _dbInitPromise;
  _dbInitPromise = null;
  return result;
}

/**
 * Execute a database operation with automatic retry on transient errors.
 * Retries up to 3 times with exponential backoff for ECONNRESET, ETIMEDOUT, etc.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string = 'unknown',
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const code = error?.cause?.code || error?.code || '';
      const isTransient = [
        'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE',
        'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR'
      ].includes(code);

      if (isTransient && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`[Database] Transient error in ${context} (attempt ${attempt}/${maxRetries}): ${code}. Retrying in ${delay}ms...`);
        if (code === 'ECONNRESET' || code === 'PROTOCOL_CONNECTION_LOST') {
          try { if (_pool) _pool.end(() => {}); } catch {}
          _db = null;
          _pool = null;
          _dbInitPromise = null;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        await getDb();
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** Get pool health statistics for monitoring */
export function getPoolStats() {
  if (!_pool) return { status: 'not_initialized' };
  const p = _pool as any;
  return {
    status: 'active',
    totalConnections: p._allConnections?.length || 0,
    freeConnections: p._freeConnections?.length || 0,
    queuedRequests: p._connectionQueue?.length || 0,
  };
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

    // Sincronizar idTag con tabla id_tags
    if (values.idTag) {
      try {
        const upsertedUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
        if (upsertedUser.length > 0 && upsertedUser[0].idTag) {
          await syncUserIdTag(upsertedUser[0].id, upsertedUser[0].idTag);
        }
      } catch (syncErr) {
        console.warn("[Database] Failed to sync idTag to id_tags table:", syncErr);
      }
    }
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
  // Sincronizar con tabla id_tags
  try {
    await syncUserIdTag(userId, newIdTag);
  } catch (e) {
    console.warn("[Database] Failed to sync regenerated idTag:", e);
  }
  return newIdTag;
}

// Crear un nuevo usuario y retornar su ID
export async function createUser(userData: InsertUser): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generar idTag único para el nuevo usuario
  const idTag = await generateUniqueIdTag();
  
  const result = await db.insert(users).values({
    ...userData,
    idTag,
  });
  
  const newUserId = Number(result[0].insertId);
  
  // Sincronizar con tabla id_tags
  try {
    await syncUserIdTag(newUserId, idTag);
  } catch (e) {
    console.warn("[Database] Failed to sync new user idTag:", e);
  }
  
  return newUserId;
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

// Eliminar un inversionista: limpia participaciones, payouts, datos de onboarding y perfil de inversionista
// Opcionalmente elimina la cuenta de usuario completa
export async function deleteInvestor(userId: number, deleteUserAccount: boolean = false): Promise<{ deletedParticipations: number; deletedPayouts: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 1. Eliminar participaciones de crowdfunding del inversionista
  const partResult = await db.execute(sql`
    DELETE FROM crowdfunding_participations WHERE investorId = ${userId}
  `);
  const deletedParticipations = (partResult[0] as any)?.affectedRows || 0;
  
  // 2. Eliminar liquidaciones (payouts) del inversionista
  await db.delete(investorPayouts).where(eq(investorPayouts.investorId, userId));
  const payoutResult = await db.execute(sql`
    SELECT ROW_COUNT() as cnt
  `);
  const deletedPayouts = 0; // Approximate - delete already executed
  
  // 3. Limpiar campos de inversionista del usuario (resetear perfil)
  await db.update(users).set({
    role: deleteUserAccount ? 'user' : 'user', // Cambiar rol a usuario normal
    investorType: null,
    isFounder: false,
    founderTitle: null,
    founderOrder: null,
    investorPhotoUrl: null,
    investorQuote: null,
    investorBio: null,
    investorBadge: null,
    investorJoinedAt: null,
    investorTotalInvested: null,
    investorShowInWall: false,
    onboardingCompleted: false,
    onboardingStep: 0,
    onboardingStartedAt: null,
    onboardingCompletedAt: null,
    welcomeEmailSent: false,
  } as any).where(eq(users.id, userId));
  
  // 4. Limpiar investorTypes JSON via SQL directo
  await db.execute(sql`UPDATE users SET investorTypes = NULL WHERE id = ${userId}`);
  
  // 5. Si se solicita, eliminar la cuenta de usuario completa
  if (deleteUserAccount) {
    // Eliminar datos relacionados
    await db.delete(wallets).where(eq(wallets.userId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
  
  return { deletedParticipations, deletedPayouts };
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

/**
 * Get ALL station IDs an investor has access to:
 * 1. Stations they own directly (ownerId = investorId)
 * 2. Stations linked to crowdfunding projects where they have a participation
 * Returns a deduplicated array of station IDs.
 */
export async function getInvestorAllStationIds(investorId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  // 1. Stations owned directly
  const ownedStations = await db.select({ id: chargingStations.id })
    .from(chargingStations)
    .where(eq(chargingStations.ownerId, investorId));
  
  // 2. Stations linked via crowdfunding participations
  const crowdfundingStations = await db.execute(sql`
    SELECT DISTINCT cfp.stationId
    FROM crowdfunding_participations cp
    JOIN crowdfunding_projects cfp ON cp.projectId = cfp.id
    WHERE cp.investorId = ${investorId}
      AND cp.paymentStatus = 'COMPLETED'
      AND cfp.stationId IS NOT NULL
  `);
  
  const crowdfundingIds = ((crowdfundingStations as any)[0] || []).map((r: any) => r.stationId).filter(Boolean);
  const ownedIds = ownedStations.map(s => s.id);
  
  // Deduplicate station IDs
  return Array.from(new Set([...ownedIds, ...crowdfundingIds]));
}

/**
 * Get ALL stations an investor has access to (owned + crowdfunding participations).
 * Each station includes an `ownershipType` field: 'owned' | 'crowdfunding'
 * and a `participationPercent` for crowdfunding stations.
 */
export async function getInvestorAllStations(investorId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 1. Stations owned directly
  const ownedStations = await db.select()
    .from(chargingStations)
    .where(eq(chargingStations.ownerId, investorId))
    .orderBy(desc(chargingStations.createdAt));
  
  const ownedWithType = ownedStations.map(s => ({
    ...s,
    ownershipType: 'owned' as const,
    participationPercent: '100.0000',
    crowdfundingProjectId: null as number | null,
    crowdfundingProjectName: null as string | null,
  }));
  
  // 2. Stations linked via crowdfunding participations
  const crowdfundingResult = await db.execute(sql`
    SELECT 
      cs.*,
      cp.participationPercent,
      cfp.id as crowdfundingProjectId,
      cfp.name as crowdfundingProjectName
    FROM crowdfunding_participations cp
    JOIN crowdfunding_projects cfp ON cp.projectId = cfp.id
    JOIN charging_stations cs ON cfp.stationId = cs.id
    WHERE cp.investorId = ${investorId}
      AND cp.paymentStatus = 'COMPLETED'
      AND cfp.stationId IS NOT NULL
    ORDER BY cs.createdAt DESC
  `);
  
  const crowdfundingRows = ((crowdfundingResult as any)[0] || []).map((r: any) => ({
    ...r,
    ownershipType: 'crowdfunding' as const,
    participationPercent: r.participationPercent || '0',
    crowdfundingProjectId: r.crowdfundingProjectId,
    crowdfundingProjectName: r.crowdfundingProjectName,
  }));
  
  // Deduplicate: if a station appears in both (owner + crowdfunding), keep the owned version
  const ownedIds = new Set(ownedStations.map(s => s.id));
  const uniqueCrowdfunding = crowdfundingRows.filter((s: any) => !ownedIds.has(s.id));
  
  return [...ownedWithType, ...uniqueCrowdfunding];
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
  const evseList = await db.select().from(evses).where(eq(evses.stationId, stationId)).orderBy(evses.evseIdLocal);
  
  // Verificar reservas activas para cada EVSE
  const now = new Date();
  const in15Min = new Date(now.getTime() + 15 * 60 * 1000);
  
  // Batch: obtener TODAS las reservas activas de estos EVSEs en una sola query
  const evseIds = evseList.map(e => e.id);
  const allActiveReservations = evseIds.length > 0
    ? await db.select().from(reservations)
        .where(and(
          inArray(reservations.evseId, evseIds),
          eq(reservations.status, 'ACTIVE')
        ))
        .orderBy(reservations.startTime)
    : [];
  
  // Agrupar reservas por evseId
  const reservationsByEvse = new Map<number, typeof allActiveReservations>();
  for (const r of allActiveReservations) {
    const list = reservationsByEvse.get(r.evseId) || [];
    list.push(r);
    reservationsByEvse.set(r.evseId, list);
  }
  
  const enriched = evseList.map((evse) => {
    if (evse.status === 'AVAILABLE' || evse.status === 'RESERVED') {
      const activeResList = reservationsByEvse.get(evse.id) || [];
      
      if (activeResList.length > 0) {
        const currentOrImminent = activeResList.find(r => 
          r.startTime <= in15Min && r.endTime > now
        );
        
        if (currentOrImminent) {
          return { 
            ...evse, 
            status: 'RESERVED' as typeof evse.status, 
            activeReservationId: currentOrImminent.id, 
            activeReservationUserId: currentOrImminent.userId,
            nextReservation: null,
          };
        }
        
        const nextRes = activeResList[0];
        return { 
          ...evse, 
          status: evse.status,
          activeReservationId: null, 
          activeReservationUserId: null,
          nextReservation: {
            id: nextRes.id,
            userId: nextRes.userId,
            startTime: nextRes.startTime,
            endTime: nextRes.endTime,
          },
        };
      }
    }
    return { ...evse, activeReservationId: null, activeReservationUserId: null, nextReservation: null };
  });
  return enriched;
}

/**
 * Batch version: Get all EVSEs for multiple stations in a single query.
 * Eliminates N+1 pattern in stations.listAll.
 */
export async function getAllEvsesForStations(stationIds: number[]) {
  const db = await getDb();
  if (!db || stationIds.length === 0) return new Map<number, any[]>();
  
  // Single query for all EVSEs
  const allEvses = await db.select().from(evses)
    .where(inArray(evses.stationId, stationIds))
    .orderBy(evses.stationId, evses.evseIdLocal);
  
  // Single query for all active reservations for these EVSEs
  const evseIds = allEvses.map(e => e.id);
  const allActiveReservations = evseIds.length > 0
    ? await db.select().from(reservations)
        .where(and(
          inArray(reservations.evseId, evseIds),
          eq(reservations.status, 'ACTIVE')
        ))
        .orderBy(reservations.startTime)
    : [];
  
  // Group reservations by evseId
  const reservationsByEvse = new Map<number, typeof allActiveReservations>();
  for (const r of allActiveReservations) {
    const list = reservationsByEvse.get(r.evseId) || [];
    list.push(r);
    reservationsByEvse.set(r.evseId, list);
  }
  
  // Enrich and group by stationId
  const now = new Date();
  const in15Min = new Date(now.getTime() + 15 * 60 * 1000);
  const result = new Map<number, any[]>();
  
  for (const evse of allEvses) {
    let enriched: any = { ...evse, activeReservationId: null, activeReservationUserId: null, nextReservation: null };
    
    if (evse.status === 'AVAILABLE' || evse.status === 'RESERVED') {
      const activeResList = reservationsByEvse.get(evse.id) || [];
      if (activeResList.length > 0) {
        const currentOrImminent = activeResList.find(r => 
          r.startTime <= in15Min && r.endTime > now
        );
        if (currentOrImminent) {
          enriched = { 
            ...evse, 
            status: 'RESERVED' as typeof evse.status, 
            activeReservationId: currentOrImminent.id, 
            activeReservationUserId: currentOrImminent.userId,
            nextReservation: null,
          };
        } else {
          const nextRes = activeResList[0];
          enriched = { 
            ...evse, 
            status: evse.status,
            activeReservationId: null, 
            activeReservationUserId: null,
            nextReservation: {
              id: nextRes.id,
              userId: nextRes.userId,
              startTime: nextRes.startTime,
              endTime: nextRes.endTime,
            },
          };
        }
      }
    }
    
    const stationEvses = result.get(evse.stationId) || [];
    stationEvses.push(enriched);
    result.set(evse.stationId, stationEvses);
  }
  
  return result;
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

export async function getAllTransactions(filters?: { startDate?: Date; endDate?: Date; limit?: number; offset?: number; status?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  
  const conditions: any[] = [];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  if (filters?.status) conditions.push(eq(transactions.status, filters.status as any));
  
  // Count total
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(transactions).where(whereClause);
  const total = Number(countResult[0]?.count || 0);
  
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;
  
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
    .where(whereClause)
    .orderBy(desc(transactions.startTime))
    .limit(limit)
    .offset(offset);
  
  const data = await query;
  return { data, total };
}

export async function getOverstayTransactions(filters?: {
  stationId?: number;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [gt(transactions.overstayCost, "0")];
  if (filters?.stationId) conditions.push(eq(transactions.stationId, filters.stationId));
  if (filters?.userId) conditions.push(eq(transactions.userId, filters.userId));
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));

  return db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      stationId: transactions.stationId,
      evseId: transactions.evseId,
      status: transactions.status,
      startTime: transactions.startTime,
      endTime: transactions.endTime,
      kwhConsumed: transactions.kwhConsumed,
      energyCost: transactions.energyCost,
      overstayCost: transactions.overstayCost,
      totalCost: transactions.totalCost,
      userName: users.name,
      stationName: chargingStations.name,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.userId, users.id))
    .leftJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.endTime))
    .limit(filters?.limit || 200);
}

export async function getTransactionsByStationId(stationId: number, filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(transactions.stationId, stationId)];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  
  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.startTime));
}

export async function getTransactionsByInvestor(investorId: number, filters?: { startDate?: Date; endDate?: Date; limit?: number; offset?: number; status?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const stationIds = await getInvestorAllStationIds(investorId);
  
  if (stationIds.length === 0) return { data: [], total: 0 };
  
  const conditions: any[] = [inArray(transactions.stationId, stationIds)];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  if (filters?.status) conditions.push(eq(transactions.status, filters.status as any));
  
  const whereClause = and(...conditions);
  
  // Count total
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(transactions).where(whereClause);
  const total = Number(countResult[0]?.count || 0);
  
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;
  
  const data = await db.select().from(transactions).where(whereClause).orderBy(desc(transactions.startTime)).limit(limit).offset(offset);
  return { data, total };
}

// Versión sin paginación para exportar todas las transacciones del inversionista
export async function getAllTransactionsByInvestor(investorId: number, filters?: { startDate?: Date; endDate?: Date }) {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const stationIds = await getInvestorAllStationIds(investorId);
  
  if (stationIds.length === 0) return [];
  
  const conditions: any[] = [inArray(transactions.stationId, stationIds)];
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
  const result = await db.select({
    id: maintenanceTickets.id,
    stationId: maintenanceTickets.stationId,
    evseId: maintenanceTickets.evseId,
    technicianId: maintenanceTickets.technicianId,
    reportedById: maintenanceTickets.reportedById,
    title: maintenanceTickets.title,
    description: maintenanceTickets.description,
    priority: maintenanceTickets.priority,
    category: maintenanceTickets.category,
    status: maintenanceTickets.status,
    scheduledDate: maintenanceTickets.scheduledDate,
    startedAt: maintenanceTickets.startedAt,
    completedAt: maintenanceTickets.completedAt,
    resolution: maintenanceTickets.resolution,
    partsUsed: maintenanceTickets.partsUsed,
    laborCost: maintenanceTickets.laborCost,
    totalCost: maintenanceTickets.totalCost,
    attachments: maintenanceTickets.attachments,
    createdAt: maintenanceTickets.createdAt,
    updatedAt: maintenanceTickets.updatedAt,
    stationName: chargingStations.name,
    stationCity: chargingStations.city,
    stationAddress: chargingStations.address,
    technicianName: users.name,
    technicianEmail: users.email,
  })
    .from(maintenanceTickets)
    .leftJoin(chargingStations, eq(maintenanceTickets.stationId, chargingStations.id))
    .leftJoin(users, eq(maintenanceTickets.technicianId, users.id))
    .where(eq(maintenanceTickets.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMaintenanceTicketsByTechnician(technicianId: number) {
  const db = await getDb();
  if (!db) return [];
  // Show tickets assigned to this technician OR reported by them
  return db.select().from(maintenanceTickets).where(
    or(
      eq(maintenanceTickets.technicianId, technicianId),
      eq(maintenanceTickets.reportedById, technicianId)
    )
  ).orderBy(desc(maintenanceTickets.createdAt));
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

export async function getPayoutById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(investorPayouts).where(eq(investorPayouts.id, id));
  return result[0] || null;
}

export async function getAllPendingPayouts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    payout: investorPayouts,
    investor: users,
  })
    .from(investorPayouts)
    .innerJoin(users, eq(investorPayouts.investorId, users.id))
    .where(inArray(investorPayouts.status, ['PENDING', 'REQUESTED']))
    .orderBy(desc(investorPayouts.requestedAt));
}

export async function getAllPayoutsForAdmin(status?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (status && status !== 'ALL') {
    return db.select({
      payout: investorPayouts,
      investor: users,
    })
      .from(investorPayouts)
      .innerJoin(users, eq(investorPayouts.investorId, users.id))
      .where(eq(investorPayouts.status, status as any))
      .orderBy(desc(investorPayouts.createdAt));
  }
  
  return db.select({
    payout: investorPayouts,
    investor: users,
  })
    .from(investorPayouts)
    .innerJoin(users, eq(investorPayouts.investorId, users.id))
    .orderBy(desc(investorPayouts.createdAt));
}

export async function getInvestorPendingBalance(investorId: number) {
  const db = await getDb();
  if (!db) return { pendingBalance: 0, totalPaid: 0, lastPayout: null };
  
  // Obtener estaciones del inversionista
  const stations = await db.select({ id: chargingStations.id })
    .from(chargingStations)
    .where(eq(chargingStations.ownerId, investorId));
  
  const stationIds = stations.map(s => s.id);
  if (stationIds.length === 0) {
    return { pendingBalance: 0, totalPaid: 0, lastPayout: null };
  }
  
  // Obtener configuración de porcentaje
  const settings = await db.select().from(platformSettings).limit(1);
  const investorPercentage = settings[0]?.investorPercentage || 70;
  
  // Obtener todas las transacciones completadas
  // Nota: El campo 'status' en el schema de drizzle mapea a 'transaction_status' en la BD
  const txs = await db.select()
    .from(transactions)
    .where(and(
      inArray(transactions.stationId, stationIds),
      eq(transactions.status, 'COMPLETED')
    ));
  
  const totalRevenue = txs.reduce((sum, tx) => sum + Number(tx.totalCost || 0), 0);
  const totalInvestorShare = totalRevenue * (investorPercentage / 100);
  
  // Obtener total ya pagado
  const paidPayouts = await db.select()
    .from(investorPayouts)
    .where(and(
      eq(investorPayouts.investorId, investorId),
      eq(investorPayouts.status, 'PAID')
    ));
  
  const totalPaid = paidPayouts.reduce((sum, p) => sum + Number(p.investorShare || 0), 0);
  
  // Obtener último pago
  const lastPayout = paidPayouts.length > 0 
    ? paidPayouts.sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())[0]
    : null;
  
  // Obtener solicitudes pendientes (ya solicitadas pero no pagadas)
  const pendingPayouts = await db.select()
    .from(investorPayouts)
    .where(and(
      eq(investorPayouts.investorId, investorId),
      inArray(investorPayouts.status, ['PENDING', 'REQUESTED', 'APPROVED', 'PROCESSING'])
    ));
  
  const pendingRequested = pendingPayouts.reduce((sum, p) => sum + Number(p.investorShare || 0), 0);
  
  // Balance disponible = total ganado - total pagado - solicitudes pendientes
  const pendingBalance = totalInvestorShare - totalPaid - pendingRequested;
  
  return {
    pendingBalance: Math.max(0, pendingBalance),
    totalPaid,
    lastPayout,
    investorPercentage,
    totalRevenue,
    totalInvestorShare,
    pendingRequested,
    transactionCount: txs.length,
  };
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

export async function getOcppChargePointIds() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.selectDistinct({ ocppIdentity: ocppLogs.ocppIdentity })
    .from(ocppLogs)
    .orderBy(ocppLogs.ocppIdentity);
  
  return result.map(r => r.ocppIdentity).filter(Boolean);
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
 * Obtener conexiones activas basadas en logs de BD (OPTIMIZADO)
 * Un cargador se considera activo si:
 * - Tiene un Heartbeat o StatusNotification en los últimos 5 minutos
 * - O tiene CONNECTION sin DISCONNECTION posterior
 * 
 * Usa queries batch en lugar de N+1 para rendimiento con 1M+ logs.
 */
export async function getActiveConnectionsFromLogs() {
  const db = await getDb();
  if (!db) return [];
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // 1. Obtener cargadores únicos con actividad reciente (usa índice compuesto)
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
  
  if (recentActivity.length === 0) return [];
  
  const identities = recentActivity.map(a => a.ocppIdentity).filter(Boolean) as string[];
  if (identities.length === 0) return [];
  
  // 2. Batch: obtener desconexiones recientes para TODOS los cargadores activos
  const recentDisconnections = await db.select({
    ocppIdentity: ocppLogs.ocppIdentity,
    createdAt: ocppLogs.createdAt,
  })
    .from(ocppLogs)
    .where(
      and(
        inArray(ocppLogs.ocppIdentity, identities),
        eq(ocppLogs.messageType, 'DISCONNECTION'),
        gte(ocppLogs.createdAt, fiveMinutesAgo)
      )
    )
    .orderBy(desc(ocppLogs.createdAt));
  
  // Agrupar: última desconexión por identity
  const lastDisconnectionMap = new Map<string, Date>();
  for (const d of recentDisconnections) {
    if (d.ocppIdentity && !lastDisconnectionMap.has(d.ocppIdentity)) {
      lastDisconnectionMap.set(d.ocppIdentity, d.createdAt);
    }
  }
  
  // 3. Batch: obtener última actividad para TODOS los cargadores
  const lastActivities = await db.select({
    ocppIdentity: ocppLogs.ocppIdentity,
    createdAt: ocppLogs.createdAt,
  })
    .from(ocppLogs)
    .where(
      and(
        inArray(ocppLogs.ocppIdentity, identities),
        inArray(ocppLogs.messageType, ['Heartbeat', 'StatusNotification', 'BootNotification', 'CONNECTION'])
      )
    )
    .orderBy(desc(ocppLogs.createdAt))
    .limit(identities.length * 2); // Suficiente para obtener al menos 1 por identity
  
  const lastActivityMap = new Map<string, Date>();
  for (const a of lastActivities) {
    if (a.ocppIdentity && !lastActivityMap.has(a.ocppIdentity)) {
      lastActivityMap.set(a.ocppIdentity, a.createdAt);
    }
  }
  
  // 4. Filtrar desconectados
  const activeIdentities = identities.filter(id => {
    const lastDisc = lastDisconnectionMap.get(id);
    const lastAct = lastActivityMap.get(id);
    if (!lastDisc) return true; // Sin desconexión = activo
    if (!lastAct) return false; // Desconexión sin actividad = desconectado
    return lastAct > lastDisc; // Actividad más reciente que desconexión = reconectado
  });
  
  if (activeIdentities.length === 0) return [];
  
  // 5. Batch: obtener logs relevantes para todos los activos en UNA query
  //    (BootNotification, Heartbeat, StatusNotification, CONNECTION)
  const relevantLogs = await db.select()
    .from(ocppLogs)
    .where(
      and(
        inArray(ocppLogs.ocppIdentity, activeIdentities),
        inArray(ocppLogs.messageType, ['BootNotification', 'Heartbeat', 'StatusNotification', 'CONNECTION'])
      )
    )
    .orderBy(desc(ocppLogs.createdAt))
    .limit(activeIdentities.length * 15); // ~15 logs por cargador es suficiente
  
  // Agrupar por identity y tipo
  const logsByIdentity = new Map<string, typeof relevantLogs>();
  for (const log of relevantLogs) {
    if (!log.ocppIdentity) continue;
    const list = logsByIdentity.get(log.ocppIdentity) || [];
    list.push(log);
    logsByIdentity.set(log.ocppIdentity, list);
  }
  
  // 6. Construir resultado
  const activeConnections = [];
  const activityMap = new Map(recentActivity.map(a => [a.ocppIdentity, a]));
  
  for (const identity of activeIdentities) {
    const activity = activityMap.get(identity);
    if (!activity) continue;
    
    const logs = logsByIdentity.get(identity) || [];
    
    const bootLog = logs.find(l => l.messageType === 'BootNotification' && l.direction === 'IN');
    const heartbeatLog = logs.find(l => l.messageType === 'Heartbeat');
    const connectionLog = logs.find(l => l.messageType === 'CONNECTION');
    const statusLogs = logs.filter(l => l.messageType === 'StatusNotification' && l.direction === 'IN').slice(0, 10);
    
    const bootPayload = bootLog?.payload as any;
    const connectionPayload = connectionLog?.payload as any;
    const ocppVersion = connectionPayload?.ocppVersion || '1.6';
    
    const connectorStatusMap: Record<number, string> = {};
    for (const cs of statusLogs) {
      const payload = cs.payload as any;
      const connectorId = payload?.connectorId || payload?.evseId || 0;
      if (!connectorStatusMap[connectorId]) {
        connectorStatusMap[connectorId] = payload?.status || 'Unknown';
      }
    }
    
    const lastActivityTime = lastActivityMap.get(identity) || new Date();
    
    activeConnections.push({
      ocppIdentity: identity,
      ocppVersion,
      stationId: activity.stationId,
      connectedAt: connectionLog?.createdAt?.toISOString() || lastActivityTime.toISOString(),
      lastHeartbeat: heartbeatLog?.createdAt?.toISOString() || lastActivityTime.toISOString(),
      lastMessage: lastActivityTime.toISOString(),
      connectorStatuses: connectorStatusMap,
      bootInfo: bootPayload ? {
        vendor: bootPayload.chargePointVendor || bootPayload.chargingStation?.vendorName || 'Unknown',
        model: bootPayload.chargePointModel || bootPayload.chargingStation?.model || 'Unknown',
        serialNumber: bootPayload.chargePointSerialNumber || bootPayload.chargeBoxSerialNumber || bootPayload.chargingStation?.serialNumber,
        firmwareVersion: bootPayload.firmwareVersion || bootPayload.chargingStation?.firmwareVersion,
      } : undefined,
      isConnected: true,
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
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const allStations = await getInvestorAllStations(investorId);
  const stationIds = allStations.map(s => s.id);
  
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
    totalStations: allStations.length,
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

// ============================================================================
// BANNER SEGMENTATION ENGINE — 8 DIMENSIONS
// ============================================================================

/**
 * Contexto enriquecido del usuario para el motor de segmentación de banners.
 * Se resuelve una sola vez por request y se pasa al filtro.
 */
export interface BannerUserContext {
  // Dimensión 1: Geografía
  city?: string;                    // ciudad de residencia
  department?: string;              // departamento de residencia
  stationId?: number;               // estación actual (para carga activa)
  stationCity?: string;             // ciudad de la estación actual
  // Dimensión 2: Vehículo
  vehicleBrands?: string[];         // marcas de vehículos del usuario
  vehicleModels?: string[];         // modelos de vehículos del usuario
  connectorTypes?: string[];        // tipos de conector del usuario
  batteryCapacityKwh?: number;      // capacidad de batería del vehículo principal (kWh)
  // Dimensión 3: Comportamiento de carga
  chargesThisMonth?: number;        // cargas realizadas este mes
  spendThisMonth?: number;          // gasto este mes en COP
  usedStartMethods?: string[];      // métodos de inicio usados (QR, APP, NFC)
  typicalChargeHour?: number;       // hora típica de carga (0-23)
  // Dimensión 4: Suscripción y rol
  role?: string;                    // rol del usuario
  subscriptionTier?: string;        // tier de suscripción
  hasCard?: boolean;                // tiene tarjeta registrada
  // Dimensión 5: Perfil financiero
  walletBalance?: number;           // saldo actual en billetera (COP)
  avgRechargeAmount?: number;       // monto promedio de recarga (COP)
  // Dimensión 7: Actividad RFM
  activitySegment?: "active" | "at_risk" | "dormant" | "new"; // segmento RFM
}

/**
 * Resuelve el contexto completo del usuario para segmentación de banners.
 * Hace queries adicionales solo cuando es necesario.
 */
export async function resolveUserBannerContext(
  userId: number,
  baseContext?: Partial<BannerUserContext>
): Promise<BannerUserContext> {
  const db = await getDb();
  if (!db) return baseContext || {};

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoForNew = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Consulta paralela de todos los datos necesarios
  const [user, userVehiclesRows, walletRow, subscriptionRow, monthlyTxRows, allTxRows] =
    await Promise.all([
      // Usuario base
      db.select({
        city: users.city,
        fiscalDepartment: users.fiscalDepartment,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, userId)).limit(1),

      // Vehículos activos del usuario
      db.select({
        brand: userVehicles.brand,
        model: userVehicles.model,
        connectorTypes: userVehicles.connectorTypes,
        batteryCapacityKwh: userVehicles.batteryCapacityKwh,
        isDefault: userVehicles.isDefault,
      }).from(userVehicles)
        .where(and(eq(userVehicles.userId, userId), eq(userVehicles.isActive, true))),

      // Billetera
      db.select({ balance: wallets.balance })
        .from(wallets).where(eq(wallets.userId, userId)).limit(1),

      // Suscripción activa
      db.select({
        tier: subscriptions.tier,
        wompiCardToken: subscriptions.wompiCardToken,
        isActive: subscriptions.isActive,
      }).from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, true)))
        .limit(1),

      // Transacciones de este mes
      db.select({
        totalCost: transactions.totalCost,
        startMethod: transactions.startMethod,
        startTime: transactions.startTime,
      }).from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.status, "COMPLETED"),
          gte(transactions.startTime, startOfMonth)
        )),

      // Todas las transacciones (para RFM)
      db.select({ startTime: transactions.startTime })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.status, "COMPLETED")))
        .orderBy(desc(transactions.startTime))
        .limit(1),
    ]);

  // Promedio de recargas de billetera
  const rechargeRows = await db.select({ amount: walletTransactions.amount })
    .from(walletTransactions)
    .where(and(
      eq(walletTransactions.userId, userId),
      eq(walletTransactions.type, "RECHARGE"),
      eq(walletTransactions.status, "COMPLETED")
    ))
    .limit(20);

  const u = user[0];
  const sub = subscriptionRow[0];
  const wallet = walletRow[0];

  // Calcular métricas de comportamiento
  const chargesThisMonth = monthlyTxRows.length;
  const spendThisMonth = monthlyTxRows.reduce((s, t) => s + parseFloat(t.totalCost as any || "0"), 0);
  const usedStartMethods = Array.from(new Set(monthlyTxRows.map(t => t.startMethod).filter(Boolean) as string[]));
  const typicalHours = monthlyTxRows.map(t => new Date(t.startTime).getHours());
  const typicalChargeHour = typicalHours.length > 0
    ? Math.round(typicalHours.reduce((a, b) => a + b, 0) / typicalHours.length)
    : undefined;

  // Calcular RFM
  let activitySegment: BannerUserContext["activitySegment"] = "dormant";
  const lastTx = allTxRows[0];
  const userCreatedAt = u?.createdAt ? new Date(u.createdAt) : null;
  if (lastTx) {
    const lastTxDate = new Date(lastTx.startTime);
    if (lastTxDate >= thirtyDaysAgo) activitySegment = "active";
    else if (lastTxDate >= sixtyDaysAgo) activitySegment = "at_risk";
    else if (lastTxDate >= ninetyDaysAgo) activitySegment = "dormant";
    else activitySegment = "dormant";
  } else if (userCreatedAt && userCreatedAt >= thirtyDaysAgoForNew) {
    activitySegment = "new";
  }

  // Calcular promedio de recarga
  const avgRechargeAmount = rechargeRows.length > 0
    ? rechargeRows.reduce((s, r) => s + parseFloat(r.amount as any || "0"), 0) / rechargeRows.length
    : 0;

  // Vehículo principal para batería
  const defaultVehicle = userVehiclesRows.find(v => v.isDefault) || userVehiclesRows[0];

  return {
    // Dimensión 1: Geografía
    city: baseContext?.city || u?.city || undefined,
    department: u?.fiscalDepartment || undefined,
    stationId: baseContext?.stationId,
    stationCity: baseContext?.stationCity,
    // Dimensión 2: Vehículo
    vehicleBrands: userVehiclesRows.map(v => v.brand).filter(Boolean),
    vehicleModels: userVehiclesRows.map(v => v.model).filter(Boolean),
    connectorTypes: Array.from(new Set(userVehiclesRows.flatMap(v => (v.connectorTypes as string[]) || []))),
    batteryCapacityKwh: defaultVehicle?.batteryCapacityKwh
      ? parseFloat(defaultVehicle.batteryCapacityKwh as any)
      : undefined,
    // Dimensión 3: Comportamiento
    chargesThisMonth,
    spendThisMonth,
    usedStartMethods,
    typicalChargeHour,
    // Dimensión 4: Suscripción y rol
    role: u?.role || baseContext?.role,
    subscriptionTier: sub?.tier || "FREE",
    hasCard: !!(sub?.wompiCardToken),
    // Dimensión 5: Perfil financiero
    walletBalance: wallet?.balance ? parseFloat(wallet.balance as any) : 0,
    avgRechargeAmount,
    // Dimensión 7: RFM
    activitySegment,
  };
}

/**
 * Motor de filtrado de banners con las 8 dimensiones de segmentación.
 * Retorna true si el banner aplica para el contexto del usuario.
 */
function matchesBannerSegmentation(banner: any, ctx: BannerUserContext): boolean {
  // ── Dimensión 1: Geografía ──────────────────────────────────────────────────
  if (banner.targetCities?.length > 0) {
    if (!ctx.city) return false;
    const match = banner.targetCities.some((c: string) =>
      c.toLowerCase() === ctx.city!.toLowerCase());
    if (!match) return false;
  }
  if (banner.targetDepartments?.length > 0) {
    if (!ctx.department) return false;
    const match = banner.targetDepartments.some((d: string) =>
      d.toLowerCase() === ctx.department!.toLowerCase());
    if (!match) return false;
  }
  if (banner.targetStationCities?.length > 0) {
    if (!ctx.stationCity) return false;
    const match = banner.targetStationCities.some((c: string) =>
      c.toLowerCase() === ctx.stationCity!.toLowerCase());
    if (!match) return false;
  }
  if (banner.targetStationIds?.length > 0) {
    if (!ctx.stationId) return false;
    if (!banner.targetStationIds.includes(ctx.stationId)) return false;
  }

  // ── Dimensión 2: Vehículo ───────────────────────────────────────────────────
  if (banner.targetVehicleBrands?.length > 0) {
    if (!ctx.vehicleBrands?.length) return false;
    const match = ctx.vehicleBrands.some(b =>
      banner.targetVehicleBrands.some((tb: string) =>
        tb.toLowerCase() === b.toLowerCase()));
    if (!match) return false;
  }
  if (banner.targetVehicleModels?.length > 0) {
    if (!ctx.vehicleModels?.length) return false;
    const match = ctx.vehicleModels.some(m =>
      banner.targetVehicleModels.some((tm: string) =>
        tm.toLowerCase() === m.toLowerCase()));
    if (!match) return false;
  }
  if (banner.targetConnectorTypes?.length > 0) {
    if (!ctx.connectorTypes?.length) return false;
    const match = ctx.connectorTypes.some(c =>
      banner.targetConnectorTypes.includes(c));
    if (!match) return false;
  }
  if (banner.targetBatteryMinKwh != null) {
    if ((ctx.batteryCapacityKwh ?? 0) < banner.targetBatteryMinKwh) return false;
  }
  if (banner.targetBatteryMaxKwh != null) {
    if ((ctx.batteryCapacityKwh ?? 999) > banner.targetBatteryMaxKwh) return false;
  }

  // ── Dimensión 3: Comportamiento de carga ────────────────────────────────────
  if (banner.targetMinChargesPerMonth != null) {
    if ((ctx.chargesThisMonth ?? 0) < banner.targetMinChargesPerMonth) return false;
  }
  if (banner.targetMaxChargesPerMonth != null) {
    if ((ctx.chargesThisMonth ?? 0) > banner.targetMaxChargesPerMonth) return false;
  }
  if (banner.targetMinSpendPerMonth != null) {
    if ((ctx.spendThisMonth ?? 0) < banner.targetMinSpendPerMonth) return false;
  }
  if (banner.targetMaxSpendPerMonth != null) {
    if ((ctx.spendThisMonth ?? 0) > banner.targetMaxSpendPerMonth) return false;
  }
  if (banner.targetStartMethods?.length > 0) {
    if (!ctx.usedStartMethods?.length) return false;
    const match = ctx.usedStartMethods.some(m =>
      banner.targetStartMethods.includes(m));
    if (!match) return false;
  }
  if (banner.targetChargeHoursStart != null && banner.targetChargeHoursEnd != null) {
    const h = ctx.typicalChargeHour ?? -1;
    if (h < 0) return false;
    const start = banner.targetChargeHoursStart;
    const end = banner.targetChargeHoursEnd;
    const inRange = start <= end ? (h >= start && h <= end) : (h >= start || h <= end);
    if (!inRange) return false;
  }

  // ── Dimensión 4: Suscripción y rol ──────────────────────────────────────────
  if (banner.targetRoles?.length > 0) {
    if (!ctx.role || !banner.targetRoles.includes(ctx.role)) return false;
  }
  if (banner.targetSubscriptionTiers?.length > 0) {
    if (!ctx.subscriptionTier || !banner.targetSubscriptionTiers.includes(ctx.subscriptionTier)) return false;
  }
  if (banner.targetHasCard != null) {
    if (banner.targetHasCard === true && !ctx.hasCard) return false;
    if (banner.targetHasCard === false && ctx.hasCard) return false;
  }

  // ── Dimensión 5: Perfil financiero ──────────────────────────────────────────
  if (banner.targetWalletMinBalance != null) {
    if ((ctx.walletBalance ?? 0) < banner.targetWalletMinBalance) return false;
  }
  if (banner.targetWalletMaxBalance != null) {
    if ((ctx.walletBalance ?? 0) > banner.targetWalletMaxBalance) return false;
  }
  if (banner.targetMinAvgRecharge != null) {
    if ((ctx.avgRechargeAmount ?? 0) < banner.targetMinAvgRecharge) return false;
  }

  // ── Dimensión 7: Actividad RFM ───────────────────────────────────────────────
  if (banner.targetActivitySegments?.length > 0) {
    if (!ctx.activitySegment || !banner.targetActivitySegments.includes(ctx.activitySegment)) return false;
  }

  return true;
}

export async function getActiveBanners(
  type?: string,
  location?: string,
  userContext?: BannerUserContext
) {
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

  // Fetch all active banners, then apply JS-side segmentation engine
  const allBanners = await db.select().from(banners)
    .where(and(...conditions))
    .orderBy(desc(banners.priority));

  if (!userContext) return allBanners;

  return allBanners.filter(banner => matchesBannerSegmentation(banner, userContext));
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

export async function recordBannerImpression(
  bannerId: number,
  userId?: number,
  context?: string,
  extra?: { city?: string; vehicleType?: string; deviceType?: string; stationId?: number }
) {
  const db = await getDb();
  if (!db) return;
  
  const hourOfDay = new Date().getHours();
  
  // Incrementar contador de impresiones
  await db.update(banners).set({
    impressions: sql`${banners.impressions} + 1`,
  }).where(eq(banners.id, bannerId));
  
  // Actualizar stats diarias
  const today = new Date().toISOString().split('T')[0];
  try {
    await db.execute(sql`
      INSERT INTO banner_daily_stats (bannerId, date, impressions, clicks, uniqueViews, totalDwellSeconds, dwellCount)
      VALUES (${bannerId}, ${today}, 1, 0, 0, 0, 0)
      ON DUPLICATE KEY UPDATE impressions = impressions + 1
    `);
  } catch (_e) { /* non-critical */ }
  
  // Registrar vista si hay usuario
  if (userId) {
    await db.insert(bannerViews).values({
      bannerId,
      userId,
      viewContext: context,
      deviceType: extra?.deviceType,
      city: extra?.city,
      vehicleType: extra?.vehicleType,
      hourOfDay,
    });
    
    // Actualizar vistas únicas
    const existingViews = await db.select({ id: bannerViews.id }).from(bannerViews)
      .where(and(eq(bannerViews.bannerId, bannerId), eq(bannerViews.userId, userId)))
      .limit(2);
    
    if (existingViews.length === 1) {
      await db.update(banners).set({
        uniqueViews: sql`${banners.uniqueViews} + 1`,
      }).where(eq(banners.id, bannerId));
      // También en stats diarias
      try {
        await db.execute(sql`
          INSERT INTO banner_daily_stats (bannerId, date, impressions, clicks, uniqueViews, totalDwellSeconds, dwellCount)
          VALUES (${bannerId}, ${today}, 0, 0, 1, 0, 0)
          ON DUPLICATE KEY UPDATE uniqueViews = uniqueViews + 1
        `);
      } catch (_e) { /* non-critical */ }
    }
  }
}

export async function recordBannerDwellTime(bannerId: number, userId: number, durationSeconds: number) {
  const db = await getDb();
  if (!db) return;
  
  // Actualizar la última vista del usuario para este banner con el dwell time
  await db.execute(sql`
    UPDATE banner_views
    SET viewDurationSeconds = ${durationSeconds}
    WHERE bannerId = ${bannerId} AND userId = ${userId} AND viewDurationSeconds IS NULL
    ORDER BY viewedAt DESC
    LIMIT 1
  `);
  
  // Actualizar stats diarias
  const today = new Date().toISOString().split('T')[0];
  try {
    await db.execute(sql`
      INSERT INTO banner_daily_stats (bannerId, date, impressions, clicks, uniqueViews, totalDwellSeconds, dwellCount)
      VALUES (${bannerId}, ${today}, 0, 0, 0, ${durationSeconds}, 1)
      ON DUPLICATE KEY UPDATE totalDwellSeconds = totalDwellSeconds + ${durationSeconds}, dwellCount = dwellCount + 1
    `);
  } catch (_e) { /* non-critical */ }
}

export async function recordBannerClick(bannerId: number, userId?: number) {
  const db = await getDb();
  if (!db) return;
  
  // Incrementar contador de clics
  await db.update(banners).set({
    clicks: sql`${banners.clicks} + 1`,
  }).where(eq(banners.id, bannerId));
  
  // Actualizar stats diarias
  const today = new Date().toISOString().split('T')[0];
  try {
    await db.execute(sql`
      INSERT INTO banner_daily_stats (bannerId, date, impressions, clicks, uniqueViews, totalDwellSeconds, dwellCount)
      VALUES (${bannerId}, ${today}, 0, 1, 0, 0, 0)
      ON DUPLICATE KEY UPDATE clicks = clicks + 1
    `);
  } catch (_e) { /* non-critical */ }
  
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

export async function getBannerCampaignAnalytics(bannerId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const banner = await db.select().from(banners).where(eq(banners.id, bannerId)).limit(1);
  if (!banner[0]) return null;
  
  // Filtro de fechas para banner_views
  const dateConditions: any[] = [eq(bannerViews.bannerId, bannerId)];
  if (startDate) dateConditions.push(gte(bannerViews.viewedAt, startDate));
  if (endDate) dateConditions.push(lte(bannerViews.viewedAt, endDate));
  
  // Métricas agregadas
  const [metrics] = await db.select({
    totalViews: count(bannerViews.id),
    uniqueUsers: sql<number>`COUNT(DISTINCT ${bannerViews.userId})`,
    totalClicks: sum(sql<number>`CASE WHEN ${bannerViews.clicked} = 1 THEN 1 ELSE 0 END`),
    avgDwellSeconds: avg(bannerViews.viewDurationSeconds),
    totalDwellSeconds: sum(bannerViews.viewDurationSeconds),
  }).from(bannerViews).where(and(...dateConditions));
  
  const totalImpressions = banner[0].impressions;
  const totalClicks = Number(metrics.totalClicks) || 0;
  const reach = Number(metrics.uniqueUsers) || 0;
  const frequency = reach > 0 ? (totalImpressions / reach) : 0;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
  const avgDwell = Number(metrics.avgDwellSeconds) || 0;
  
  return {
    banner: banner[0],
    summary: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: Math.round(ctr * 100) / 100,
      reach,
      frequency: Math.round(frequency * 100) / 100,
      avgDwellSeconds: Math.round(avgDwell),
      totalDwellMinutes: Math.round(Number(metrics.totalDwellSeconds) / 60),
    },
  };
}

export async function getBannerDailyStats(bannerId: number, daysBack: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().split('T')[0];
  
  const stats = await db.select().from(bannerDailyStats)
    .where(and(
      eq(bannerDailyStats.bannerId, bannerId),
      gte(bannerDailyStats.date, sinceStr as any)
    ))
    .orderBy(asc(bannerDailyStats.date));
  
  return stats.map(s => ({
    date: s.date,
    impressions: s.impressions,
    clicks: s.clicks,
    uniqueViews: s.uniqueViews,
    avgDwellSeconds: s.dwellCount > 0 ? Math.round(s.totalDwellSeconds / s.dwellCount) : 0,
    ctr: s.impressions > 0 ? Math.round((s.clicks / s.impressions) * 10000) / 100 : 0,
  }));
}

export async function getBannerAudienceProfile(bannerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Distribución por hora del día
  const byHour = await db.select({
    hour: bannerViews.hourOfDay,
    views: count(bannerViews.id),
  }).from(bannerViews)
    .where(and(eq(bannerViews.bannerId, bannerId), sql`${bannerViews.hourOfDay} IS NOT NULL`))
    .groupBy(bannerViews.hourOfDay)
    .orderBy(bannerViews.hourOfDay);
  
  // Distribución por ciudad
  const byCity = await db.select({
    city: bannerViews.city,
    views: count(bannerViews.id),
    clicks: sum(sql<number>`CASE WHEN ${bannerViews.clicked} = 1 THEN 1 ELSE 0 END`),
  }).from(bannerViews)
    .where(and(eq(bannerViews.bannerId, bannerId), sql`${bannerViews.city} IS NOT NULL`))
    .groupBy(bannerViews.city)
    .orderBy(desc(count(bannerViews.id)))
    .limit(10);
  
  // Distribución por tipo de vehículo
  const byVehicle = await db.select({
    vehicleType: bannerViews.vehicleType,
    views: count(bannerViews.id),
  }).from(bannerViews)
    .where(and(eq(bannerViews.bannerId, bannerId), sql`${bannerViews.vehicleType} IS NOT NULL`))
    .groupBy(bannerViews.vehicleType)
    .orderBy(desc(count(bannerViews.id)))
    .limit(10);
  
  // Distribución por dispositivo
  const byDevice = await db.select({
    deviceType: bannerViews.deviceType,
    views: count(bannerViews.id),
  }).from(bannerViews)
    .where(and(eq(bannerViews.bannerId, bannerId), sql`${bannerViews.deviceType} IS NOT NULL`))
    .groupBy(bannerViews.deviceType);
  
  return {
    byHour: byHour.map(h => ({ hour: h.hour ?? 0, views: Number(h.views) })),
    byCity: byCity.map(c => ({ city: c.city || 'Desconocida', views: Number(c.views), clicks: Number(c.clicks) || 0 })),
    byVehicle: byVehicle.map(v => ({ vehicleType: v.vehicleType || 'Desconocido', views: Number(v.views) })),
    byDevice: byDevice.map(d => ({ deviceType: d.deviceType || 'Desconocido', views: Number(d.views) })),
  };
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
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const allInvestorStationIds = await getInvestorAllStationIds(investorId);
  let investorStations;
  if (stationIds && stationIds.length > 0) {
    // Filtrar solo las estaciones solicitadas que pertenezcan al inversionista
    investorStations = await db.select().from(chargingStations)
      .where(and(inArray(chargingStations.id, allInvestorStationIds), inArray(chargingStations.id, stationIds)));
  } else {
    investorStations = await db.select().from(chargingStations)
      .where(inArray(chargingStations.id, allInvestorStationIds));
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

export async function addUserWalletBalance(userId: number, amount: number, description = "Recarga de saldo") {
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
      type: "WOMPI_RECHARGE",
      amount: amount.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: currentWallet[0].balance,
      description,
    });
  }
}

// createPaymentRecord eliminado - era exclusivo de Stripe, ahora se usa Wompi

export async function updateUserSubscription(userId: number, data: {
  planId?: string;
  status?: string;
  wompiPaymentSourceId?: string | null;
  wompiCardToken?: string | null;
  cardBrand?: string;
  cardLastFour?: string;
  cardHolderName?: string;
  monthlyAmountCents?: number;
  lastPaymentDate?: Date;
  lastPaymentReference?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  
  const tier = data.planId === "premium" ? "PREMIUM" : data.planId === "basic" ? "BASIC" : "FREE";
  const discountPercentage = tier === "PREMIUM" ? "5" : tier === "BASIC" ? "3" : "0";
  const freeReservationsPerMonth = tier === "PREMIUM" ? 5 : tier === "BASIC" ? 2 : 0;
  const prioritySupport = tier !== "FREE";
  
  // Calcular próxima fecha de facturación (30 días desde hoy)
  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + 30);
  
  if (existing.length === 0) {
    await db.insert(subscriptions).values({
      userId,
      tier: tier as any,
      wompiPaymentSourceId: data.wompiPaymentSourceId,
      wompiCardToken: data.wompiCardToken,
      cardBrand: data.cardBrand,
      cardLastFour: data.cardLastFour,
      cardHolderName: data.cardHolderName,
      monthlyAmountCents: data.monthlyAmountCents || 0,
      discountPercentage,
      freeReservationsPerMonth,
      prioritySupport,
      startDate: new Date(),
      nextBillingDate: nextBilling,
      lastPaymentDate: data.lastPaymentDate || new Date(),
      lastPaymentReference: data.lastPaymentReference,
      isActive: data.status ? data.status === "active" : true,
    });
  } else {
    const updateData: any = {};
    if (data.wompiPaymentSourceId !== undefined) updateData.wompiPaymentSourceId = data.wompiPaymentSourceId;
    if (data.wompiCardToken !== undefined) updateData.wompiCardToken = data.wompiCardToken;
    if (data.cardBrand !== undefined) updateData.cardBrand = data.cardBrand;
    if (data.cardLastFour !== undefined) updateData.cardLastFour = data.cardLastFour;
    if (data.cardHolderName !== undefined) updateData.cardHolderName = data.cardHolderName;
    if (data.monthlyAmountCents !== undefined) updateData.monthlyAmountCents = data.monthlyAmountCents;
    if (data.lastPaymentDate) updateData.lastPaymentDate = data.lastPaymentDate;
    if (data.lastPaymentReference) updateData.lastPaymentReference = data.lastPaymentReference;
    if (data.planId) {
      updateData.tier = tier;
      updateData.discountPercentage = discountPercentage;
      updateData.freeReservationsPerMonth = freeReservationsPerMonth;
      updateData.prioritySupport = prioritySupport;
    }
    if (data.status) {
      updateData.isActive = data.status === "active";
      updateData.nextBillingDate = nextBilling;
      if (data.status === "canceled") {
        updateData.cancelledAt = new Date();
        updateData.nextBillingDate = null;
      }
    }
    
    await db.update(subscriptions).set(updateData).where(eq(subscriptions.userId, userId));
  }
}

export async function cancelUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({
    isActive: false,
    cancelledAt: new Date(),
    nextBillingDate: null,
    tier: "FREE" as any,
    discountPercentage: "0",
    freeReservationsPerMonth: 0,
    prioritySupport: false,
  }).where(eq(subscriptions.userId, userId));
}

export async function getActiveSubscriptionsForBilling() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  return db.select().from(subscriptions)
    .where(
      and(
        eq(subscriptions.isActive, true),
        sql`${subscriptions.nextBillingDate} <= ${now}`,
        sql`${subscriptions.tier} != 'FREE'`
      )
    );
}

export async function updateSubscriptionBilling(subscriptionId: number, data: {
  lastPaymentDate: Date;
  lastPaymentReference: string;
  nextBillingDate: Date;
  failedPaymentCount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({
    lastPaymentDate: data.lastPaymentDate,
    lastPaymentReference: data.lastPaymentReference,
    nextBillingDate: data.nextBillingDate,
    failedPaymentCount: data.failedPaymentCount ?? 0,
  }).where(eq(subscriptions.id, subscriptionId));
}

export async function incrementSubscriptionFailedPayments(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({
    failedPaymentCount: sql`${subscriptions.failedPaymentCount} + 1`,
  }).where(eq(subscriptions.id, subscriptionId));
}

// updateTransactionPaymentStatus eliminado - era exclusivo de Stripe, ahora se usa Wompi

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

export async function getWompiConfig() {
  const settings = await getPlatformSettings();
  if (!settings) return null;
  
  return {
    publicKey: settings.wompiPublicKey,
    privateKey: settings.wompiPrivateKey,
    integritySecret: settings.wompiIntegritySecret,
    eventsSecret: settings.wompiEventsSecret,
    testMode: settings.wompiTestMode,
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
  
  // Prevenir alertas duplicadas: verificar si ya existe una alerta activa del mismo tipo para el mismo cargador
  const existing = await db.select({ id: ocppAlerts.id })
    .from(ocppAlerts)
    .where(
      and(
        eq(ocppAlerts.ocppIdentity, alert.ocppIdentity),
        eq(ocppAlerts.alertType, alert.alertType),
        eq(ocppAlerts.acknowledged, false),
        isNull(ocppAlerts.resolvedAt)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    console.log(`[OCPP Alert] Duplicate alert prevented: ${alert.alertType} for ${alert.ocppIdentity} (existing alert #${existing[0].id})`);
    return existing[0].id; // Retornar ID de la alerta existente
  }
  
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
  includeResolved?: boolean;
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
  
  // Por defecto excluir alertas resueltas automáticamente de la lista activa
  if (!options.includeResolved) {
    conditions.push(isNull(ocppAlerts.resolvedAt));
  }
  
  if (options.ocppIdentity) {
    conditions.push(eq(ocppAlerts.ocppIdentity, options.ocppIdentity));
  }
  
  if (options.severity) {
    conditions.push(eq(ocppAlerts.severity, options.severity as any));
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

/**
 * Obtener historial de alertas resueltas (auto-resueltas y reconocidas)
 */
export async function getAlertHistory(options: {
  limit?: number;
  offset?: number;
  ocppIdentity?: string;
}): Promise<OcppAlert[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  // Solo alertas que han sido resueltas o reconocidas
  conditions.push(
    or(
      not(isNull(ocppAlerts.resolvedAt)),
      eq(ocppAlerts.acknowledged, true)
    )!
  );
  
  if (options.ocppIdentity) {
    conditions.push(eq(ocppAlerts.ocppIdentity, options.ocppIdentity));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const alerts = await db.select()
    .from(ocppAlerts)
    .where(whereClause)
    .orderBy(desc(ocppAlerts.createdAt))
    .limit(options.limit || 100)
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

/**
 * Auto-resuelve alertas de desconexión activas cuando un cargador se reconecta
 */
export async function autoResolveDisconnectionAlerts(ocppIdentity: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.update(ocppAlerts)
    .set({
      resolvedAt: new Date(),
      autoResolved: true,
      resolvedReason: "Cargador reconectado automáticamente",
      acknowledged: true,
      acknowledgedAt: new Date(),
    })
    .where(
      and(
        eq(ocppAlerts.ocppIdentity, ocppIdentity),
        eq(ocppAlerts.alertType, "DISCONNECTION"),
        eq(ocppAlerts.acknowledged, false),
        isNull(ocppAlerts.resolvedAt)
      )
    );
  
  return result[0]?.affectedRows || 0;
}

export async function getOcppAlertStats(): Promise<{
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  autoResolved: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      unacknowledged: 0,
      bySeverity: {},
      byType: {},
      autoResolved: 0,
    };
  }
  
  // Total de alertas
  const totalResult = await db.select({ count: count() }).from(ocppAlerts);
  const total = totalResult[0]?.count || 0;
  
  // Alertas no reconocidas (activas)
  const unackResult = await db.select({ count: count() })
    .from(ocppAlerts)
    .where(and(eq(ocppAlerts.acknowledged, false), isNull(ocppAlerts.resolvedAt)));
  const unacknowledged = unackResult[0]?.count || 0;
  
  // Por severidad - solo alertas activas (no resueltas automáticamente)
  const bySeverityResult = await db.select({
    severity: ocppAlerts.severity,
    count: count(),
  })
    .from(ocppAlerts)
    .where(and(eq(ocppAlerts.acknowledged, false), isNull(ocppAlerts.resolvedAt)))
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
    .where(and(eq(ocppAlerts.acknowledged, false), isNull(ocppAlerts.resolvedAt)))
    .groupBy(ocppAlerts.alertType);
  
  const byType: Record<string, number> = {};
  for (const row of byTypeResult) {
    if (row.alertType) {
      byType[row.alertType] = row.count;
    }
  }
  
  // Auto-resueltas
  const autoResolvedResult = await db.select({ count: count() })
    .from(ocppAlerts)
    .where(eq(ocppAlerts.autoResolved, true));
  const autoResolved = autoResolvedResult[0]?.count || 0;
  
  return {
    total,
    unacknowledged,
    bySeverity,
    byType,
    autoResolved,
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
  
  // Ingresos por mes (últimos 6 meses)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const revenueByMonth = await db.select({
    month: sql<number>`MONTH(startTime)`,
    year: sql<number>`YEAR(startTime)`,
    totalRevenue: sum(transactions.totalCost),
    totalKwh: sum(transactions.kwhConsumed),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, sixMonthsAgo)
      )
    )
    .groupBy(sql`YEAR(startTime)`, sql`MONTH(startTime)`)
    .orderBy(sql`YEAR(startTime)`, sql`MONTH(startTime)`);
  
  // Energía por día de la semana (últimas 4 semanas)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const energyByDayOfWeek = await db.select({
    dayOfWeek: sql<number>`DAYOFWEEK(startTime)`,
    totalKwh: sum(transactions.kwhConsumed),
    count: count(),
  })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "COMPLETED"),
        gte(transactions.startTime, fourWeeksAgo)
      )
    )
    .groupBy(sql`DAYOFWEEK(startTime)`)
    .orderBy(sql`DAYOFWEEK(startTime)`);
  
  // Formatear datos de ingresos mensuales
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const revenueChartData = revenueByMonth.map((row) => ({
    name: monthNames[(Number(row.month) || 1) - 1],
    month: Number(row.month),
    year: Number(row.year),
    value: Number(row.totalRevenue) || 0,
    kwh: Number(row.totalKwh) || 0,
  }));
  
  // Formatear datos de energía semanal
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  // MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ..., 7=Saturday
  const energyChartData = dayNames.map((name, idx) => {
    const dayNum = idx + 1; // 1=Dom, 2=Lun, ..., 7=Sáb
    const found = energyByDayOfWeek.find((r) => Number(r.dayOfWeek) === dayNum);
    return {
      name,
      kwh: Number(found?.totalKwh) || 0,
      sessions: Number(found?.count) || 0,
    };
  });
  
  // Tendencia de registros de usuarios (últimos 6 meses)
  const usersByMonth = await db.select({
    month: sql<number>`MONTH(createdAt)`,
    year: sql<number>`YEAR(createdAt)`,
    count: count(),
  })
    .from(users)
    .where(gte(users.createdAt, sixMonthsAgo))
    .groupBy(sql`YEAR(createdAt)`, sql`MONTH(createdAt)`)
    .orderBy(sql`YEAR(createdAt)`, sql`MONTH(createdAt)`);
  
  const usersChartData = usersByMonth.map((row) => ({
    name: monthNames[(Number(row.month) || 1) - 1],
    month: Number(row.month),
    year: Number(row.year),
    users: Number(row.count) || 0,
  }));
  
  // Distribución de ingresos por estación (top 8)
  const revenueByStation = await db.select({
    stationId: transactions.stationId,
    stationName: chargingStations.name,
    totalRevenue: sum(transactions.totalCost),
    totalSessions: count(),
  })
    .from(transactions)
    .innerJoin(chargingStations, eq(transactions.stationId, chargingStations.id))
    .where(eq(transactions.status, "COMPLETED"))
    .groupBy(transactions.stationId, chargingStations.name)
    .orderBy(desc(sum(transactions.totalCost)))
    .limit(8);
  
  const stationDistributionData = revenueByStation.map((row) => ({
    name: row.stationName || `Estación ${row.stationId}`,
    value: Number(row.totalRevenue) || 0,
    sessions: Number(row.totalSessions) || 0,
  }));
  
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
    revenueChart: revenueChartData,
    energyChart: energyChartData,
    usersChart: usersChartData,
    stationDistribution: stationDistributionData,
  };
}

export async function getInvestorDashboardMetrics(investorId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const stationIds = await getInvestorAllStationIds(investorId);
  
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
 * Limpiar transacciones huérfanas IN_PROGRESS sin actividad por más de un tiempo determinado.
 * Marca las transacciones como CANCELLED con stopReason indicando limpieza automática.
 * @param maxAgeMinutes - Tiempo máximo de inactividad en minutos (default: 60)
 * @returns Número de transacciones limpiadas
 */
export async function cleanupOrphanedTransactions(maxAgeMinutes: number = 60): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  
  // Encontrar transacciones IN_PROGRESS cuya última actualización sea anterior al cutoff
  const orphaned = await db.select()
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "IN_PROGRESS"),
        lte(transactions.updatedAt, cutoffTime)
      )
    );
  
  if (orphaned.length === 0) return 0;
  
  let cleanedCount = 0;
  
  for (const t of orphaned) {
    const kwhConsumed = parseFloat(t.kwhConsumed || "0");
    const totalCost = parseFloat(t.totalCost || "0");
    
    if (kwhConsumed > 0 && totalCost > 0) {
      // Transacción con energía consumida real: COMPLETAR y cobrar, no cancelar
      await db.update(transactions)
        .set({
          status: "COMPLETED",
          endTime: new Date(),
          stopReason: `AUTO_COMPLETE: Sesión finalizada automáticamente (sin actividad por ${maxAgeMinutes} min)`,
        })
        .where(eq(transactions.id, t.id));
      
      // Descontar saldo de la billetera del usuario
      if (t.userId && totalCost > 0) {
        try {
          const wallet = await db.select().from(wallets).where(eq(wallets.userId, t.userId)).limit(1);
          if (wallet.length > 0) {
            const currentBalance = parseFloat(wallet[0].balance);
            
            // Auto-cobro si saldo insuficiente
            let finalBalance = currentBalance;
            if (currentBalance < totalCost) {
              try {
                const { autoChargeIfNeeded } = await import("./wompi/auto-charge");
                const autoResult = await autoChargeIfNeeded(t.userId, totalCost);
                if (autoResult?.success) {
                  finalBalance = autoResult.newBalance;
                  console.log(`[Cleanup] Auto-cobro exitoso para tx ${t.id}: $${autoResult.amountCharged}`);
                }
              } catch (autoErr) {
                console.warn(`[Cleanup] Error en auto-cobro para tx ${t.id}:`, autoErr);
              }
            }
            
            const newBalance = Math.max(0, finalBalance - totalCost);
            await db.update(wallets)
              .set({ balance: newBalance.toString() })
              .where(eq(wallets.userId, t.userId));
            
            await db.insert(walletTransactions).values({
              walletId: wallet[0].id,
              userId: t.userId,
              type: "CHARGE_PAYMENT",
              amount: (-totalCost).toString(),
              balanceBefore: finalBalance.toString(),
              balanceAfter: newBalance.toString(),
              referenceId: t.id,
              referenceType: "TRANSACTION",
              status: "COMPLETED",
              description: `Pago por carga de ${kwhConsumed.toFixed(2)} kWh (auto-completada)`,
            });
            
            console.log(`[Cleanup] Transacción ${t.id} COMPLETADA y cobrada: $${totalCost.toFixed(0)} COP, ${kwhConsumed.toFixed(2)} kWh. Balance: $${finalBalance.toFixed(0)} -> $${newBalance.toFixed(0)}`);
            
            // Registrar deuda si el saldo quedó en 0 y no alcanzó
            if (finalBalance < totalCost) {
              const debt = totalCost - finalBalance;
              console.warn(`[Cleanup] Usuario ${t.userId} tiene deuda de $${debt.toFixed(0)} COP por tx ${t.id}`);
            }
          }
        } catch (walletErr) {
          console.error(`[Cleanup] Error descontando billetera para tx ${t.id}:`, walletErr);
        }
      }
      
      // Notificar al usuario
      if (t.userId) {
        try {
          let stationName = "Estación";
          try {
            const station = await db.select().from(chargingStations).where(eq(chargingStations.id, t.stationId)).limit(1);
            if (station.length > 0) stationName = station[0].name || "Estación";
          } catch {} 
          
          await db.insert(notifications).values({
            userId: t.userId,
            title: "⚡ Carga completada automáticamente",
            message: `Tu carga en ${stationName} fue completada automáticamente. Consumiste ${kwhConsumed.toFixed(2)} kWh por un total de $${totalCost.toLocaleString()} COP.`,
            type: "CHARGE_COMPLETE",
            referenceId: t.id,
            referenceType: "transaction",
          });
        } catch (notifErr) {
          console.warn(`[Cleanup] Error enviando notificación para tx ${t.id}:`, notifErr);
        }
      }
    } else {
      // Transacción sin energía consumida: cancelar normalmente
      await db.update(transactions)
        .set({
          status: "CANCELLED",
          endTime: new Date(),
          stopReason: `AUTO_CLEANUP: Sin actividad por más de ${maxAgeMinutes} minutos`,
        })
        .where(eq(transactions.id, t.id));
      
      console.log(`[Cleanup] Transacción huérfana cancelada: id=${t.id}, userId=${t.userId}, stationId=${t.stationId}, kWh=${kwhConsumed}`);
    }
    
    cleanedCount++;
  }
  
  return cleanedCount;
}

/**
 * Limpiar transacciones con datos corruptos (kWh negativo, costos negativos)
 * @returns Número de transacciones limpiadas
 */
export async function cleanupCorruptedTransactions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Encontrar transacciones IN_PROGRESS con kWh negativo o costo negativo
  const corrupted = await db.select({ id: transactions.id, userId: transactions.userId, kwhConsumed: transactions.kwhConsumed, totalCost: transactions.totalCost })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "IN_PROGRESS"),
        or(
          lt(transactions.kwhConsumed, sql`0`),
          lt(transactions.totalCost, sql`0`)
        )
      )
    );
  
  if (corrupted.length === 0) return 0;
  
  const corruptedIds = corrupted.map(t => t.id);
  
  await db.update(transactions)
    .set({
      status: "CANCELLED",
      endTime: new Date(),
      kwhConsumed: "0",
      totalCost: "0",
      stopReason: "AUTO_CLEANUP: Datos corruptos (valores negativos)",
    })
    .where(inArray(transactions.id, corruptedIds));
  
  for (const t of corrupted) {
    console.log(`[Cleanup] Transacción corrupta cerrada: id=${t.id}, userId=${t.userId}, kWh=${t.kwhConsumed}, cost=${t.totalCost}`);
  }
  
  return corrupted.length;
}

/**
 * Obtener la última transacción completada de un usuario (para mostrar resumen)
 */
export async function getLastCompletedTransactionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "COMPLETED")
      )
    )
    .orderBy(desc(transactions.endTime))
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


// ============================================================================
// PRICE HISTORY OPERATIONS
// ============================================================================

export async function createPriceHistoryRecord(record: InsertPriceHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(priceHistory).values(record);
  return result[0].insertId;
}

export async function getPriceHistoryByStation(
  stationId: number,
  daysBack: number = 7,
  limit: number = 500
): Promise<PriceHistory[]> {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  return db.select()
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.stationId, stationId),
        gte(priceHistory.recordedAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.recordedAt))
    .limit(limit);
}

export async function getPriceHistoryAggregated(
  stationId: number,
  daysBack: number = 7,
  granularity: "hour" | "day" = "hour"
): Promise<Array<{ timestamp: string; avgPrice: number; minPrice: number; maxPrice: number; demandLevel: string }>> {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  const dateFormat = granularity === "hour" 
    ? sql`DATE_FORMAT(${priceHistory.recordedAt}, '%Y-%m-%d %H:00:00')`
    : sql`DATE_FORMAT(${priceHistory.recordedAt}, '%Y-%m-%d')`;
  
  const result = await db.select({
    timestamp: dateFormat.as('timestamp'),
    avgPrice: sql<number>`AVG(${priceHistory.pricePerKwh})`.as('avgPrice'),
    minPrice: sql<number>`MIN(${priceHistory.pricePerKwh})`.as('minPrice'),
    maxPrice: sql<number>`MAX(${priceHistory.pricePerKwh})`.as('maxPrice'),
    demandLevel: sql<string>`MAX(${priceHistory.demandLevel})`.as('demandLevel'),
  })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.stationId, stationId),
        gte(priceHistory.recordedAt, startDate)
      )
    )
    .groupBy(dateFormat)
    .orderBy(dateFormat);
  
  return result.map(row => ({
    timestamp: String(row.timestamp),
    avgPrice: Number(row.avgPrice) || 0,
    minPrice: Number(row.minPrice) || 0,
    maxPrice: Number(row.maxPrice) || 0,
    demandLevel: row.demandLevel || 'NORMAL',
  }));
}

// ============================================================================
// PRICE RANGE OPERATIONS (Admin controlled)
// ============================================================================

export async function getPriceRanges(): Promise<{ 
  minPrice: number; 
  maxPrice: number; 
  enableDynamicPricing: boolean;
  defaultBasePricePerKwh: number;
  defaultReservationFee: number;
  defaultOverstayPenaltyPerMin: number;
  defaultOverstayGracePeriodMinutes: number;
  defaultConnectionFee: number;
  defaultPricePerKwhAC: number;
  defaultPricePerKwhDC: number;
  enableDifferentiatedPricing: boolean;
}> {
  const settings = await getPlatformSettings();
  return {
    minPrice: parseFloat(settings?.minPricePerKwh?.toString() || "400"),
    maxPrice: parseFloat(settings?.maxPricePerKwh?.toString() || "2500"),
    enableDynamicPricing: settings?.enableDynamicPricing ?? true,
    defaultBasePricePerKwh: parseFloat(settings?.defaultBasePricePerKwh?.toString() || "1200"),
    defaultReservationFee: parseFloat(settings?.defaultReservationFee?.toString() || "5000"),
    defaultOverstayPenaltyPerMin: parseFloat(settings?.defaultOverstayPenaltyPerMin?.toString() || "500"),
    defaultOverstayGracePeriodMinutes: settings?.defaultOverstayGracePeriodMinutes ?? 10,
    defaultConnectionFee: parseFloat(settings?.defaultConnectionFee?.toString() || "2000"),
    defaultPricePerKwhAC: parseFloat(settings?.defaultPricePerKwhAC?.toString() || "800"),
    defaultPricePerKwhDC: parseFloat(settings?.defaultPricePerKwhDC?.toString() || "1200"),
    enableDifferentiatedPricing: settings?.enableDifferentiatedPricing ?? true,
  };
}

export async function updatePriceRanges(
  minPrice: number,
  maxPrice: number,
  enableDynamicPricing: boolean,
  updatedBy?: number,
  defaultReservationFee?: number,
  defaultOverstayPenaltyPerMin?: number,
  defaultConnectionFee?: number,
  defaultPricePerKwhAC?: number,
  defaultPricePerKwhDC?: number,
  enableDifferentiatedPricing?: boolean,
  defaultBasePricePerKwh?: number,
  defaultOverstayGracePeriodMinutes?: number
): Promise<void> {
  const updateData: Record<string, any> = {
    minPricePerKwh: minPrice.toString(),
    maxPricePerKwh: maxPrice.toString(),
    enableDynamicPricing,
    updatedBy,
  };
  if (defaultBasePricePerKwh !== undefined) {
    updateData.defaultBasePricePerKwh = defaultBasePricePerKwh.toString();
  }
  
  if (defaultReservationFee !== undefined) {
    updateData.defaultReservationFee = defaultReservationFee.toString();
  }
  if (defaultOverstayPenaltyPerMin !== undefined) {
    updateData.defaultOverstayPenaltyPerMin = defaultOverstayPenaltyPerMin.toString();
  }
  if (defaultConnectionFee !== undefined) {
    updateData.defaultConnectionFee = defaultConnectionFee.toString();
  }
  if (defaultPricePerKwhAC !== undefined) {
    updateData.defaultPricePerKwhAC = defaultPricePerKwhAC.toString();
  }
  if (defaultPricePerKwhDC !== undefined) {
    updateData.defaultPricePerKwhDC = defaultPricePerKwhDC.toString();
  }
  if (enableDifferentiatedPricing !== undefined) {
    updateData.enableDifferentiatedPricing = enableDifferentiatedPricing;
  }
  if (defaultOverstayGracePeriodMinutes !== undefined) {
    updateData.defaultOverstayGracePeriodMinutes = defaultOverstayGracePeriodMinutes;
  }
  
  await upsertPlatformSettings(updateData);
}

// ============================================================================
// DEMAND MONITORING OPERATIONS
// ============================================================================

export async function getStationDemandStats(stationId: number): Promise<{
  currentOccupancy: number;
  totalConnectors: number;
  activeCharges: number;
  demandLevel: string;
}> {
  const db = await getDb();
  if (!db) return { currentOccupancy: 0, totalConnectors: 0, activeCharges: 0, demandLevel: 'LOW' };
  
  // Obtener EVSEs de la estación
  const stationEvses = await db.select().from(evses).where(eq(evses.stationId, stationId));
  const totalConnectors = stationEvses.length;
  
  // Contar EVSEs en uso (CHARGING)
  const chargingEvses = stationEvses.filter(e => e.status === 'CHARGING').length;
  
  // Calcular ocupación
  const currentOccupancy = totalConnectors > 0 ? (chargingEvses / totalConnectors) * 100 : 0;
  
  // Determinar nivel de demanda
  let demandLevel = 'LOW';
  if (currentOccupancy >= 80) demandLevel = 'SURGE';
  else if (currentOccupancy >= 60) demandLevel = 'HIGH';
  else if (currentOccupancy >= 30) demandLevel = 'NORMAL';
  
  return {
    currentOccupancy,
    totalConnectors,
    activeCharges: chargingEvses,
    demandLevel,
  };
}

export async function getInvestorStationsDemand(investorId: number): Promise<Array<{
  stationId: number;
  stationName: string;
  currentOccupancy: number;
  totalConnectors: number;
  activeCharges: number;
  demandLevel: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // Obtener TODAS las estaciones del inversionista (propias + crowdfunding)
  const allStations = await getInvestorAllStations(investorId);
  
  const results = [];
  for (const station of allStations) {
    const demandStats = await getStationDemandStats(station.id);
    results.push({
      stationId: station.id,
      stationName: station.name,
      ...demandStats,
    });
  }
  
  return results;
}


// ============================================================================
// REVENUE SHARE CONFIGURATION
// ============================================================================

export async function getRevenueShareConfig(): Promise<{ investorPercent: number; platformPercent: number }> {
  const settings = await getPlatformSettings();
  const investorPercent = settings?.investorPercentage ?? 70;
  const platformPercent = settings?.platformFeePercentage ?? 30;
  return { investorPercent, platformPercent };
}


// ============================================================================
// PRICING BY CONNECTOR TYPE (AC/DC)
// ============================================================================

/**
 * Obtiene el precio efectivo para una estación.
 * Primero busca la tarifa activa de la estación.
 * Si no existe, usa los precios globales de platform_settings.
 * NUNCA usa un valor hardcodeado de fallback.
 */
export async function getEffectiveStationPrice(stationId: number): Promise<{
  pricePerKwh: number;
  reservationFee: number;
  overstayPenaltyPerMin: number;
  connectionFee: number;
  tariffId: number | null;
  autoPricing: boolean;
  source: 'station' | 'global';
}> {
  const tariff = await getActiveTariffByStationId(stationId);
  if (tariff) {
    return {
      pricePerKwh: parseFloat(tariff.pricePerKwh?.toString() || "1200"),
      reservationFee: parseFloat(tariff.reservationFee?.toString() || "5000"),
      overstayPenaltyPerMin: parseFloat(tariff.overstayPenaltyPerMinute?.toString() || "500"),
      connectionFee: parseFloat(tariff.pricePerSession?.toString() || "2000"),
      tariffId: tariff.id,
      autoPricing: tariff.autoPricing || false,
      source: 'station',
    };
  }
  // Fallback: usar precios globales de platform_settings
  const priceRanges = await getPriceRanges();
  return {
    pricePerKwh: priceRanges.defaultBasePricePerKwh,
    reservationFee: priceRanges.defaultReservationFee,
    overstayPenaltyPerMin: priceRanges.defaultOverstayPenaltyPerMin,
    connectionFee: priceRanges.defaultConnectionFee,
    tariffId: null,
    autoPricing: false,
    source: 'global',
  };
}

export async function getPriceByConnectorType(
  evseId: number,
  basePrice: number,
  /** Si la tarifa viene de una estación específica ('station'), NO sobreescribir con precios globales AC/DC.
   *  Solo aplicar precios globales AC/DC cuando la fuente es 'global' (fallback sin tarifa de estación). */
  tariffSource?: 'station' | 'global'
): Promise<{ price: number; connectorType: string; chargeType: string }> {
  // Obtener información del EVSE
  const evse = await getEvseById(evseId);
  if (!evse) {
    return { price: basePrice, connectorType: "UNKNOWN", chargeType: "AC" };
  }
  
  // Si la tarifa viene de una estación específica, respetar el precio calculado
  // (ya sea dinámico o fijo del inversionista) y NO sobreescribir con precios globales AC/DC.
  // La diferenciación AC/DC global solo aplica cuando se usa el fallback global.
  if (tariffSource === 'station') {
    return {
      price: basePrice,
      connectorType: evse.connectorType,
      chargeType: evse.chargeType,
    };
  }
  
  // Obtener configuración de precios diferenciados
  const priceRanges = await getPriceRanges();
  
  // Si los precios diferenciados no están habilitados, usar precio base
  if (!priceRanges.enableDifferentiatedPricing) {
    return { 
      price: basePrice, 
      connectorType: evse.connectorType, 
      chargeType: evse.chargeType 
    };
  }
  
  // Determinar precio según tipo de carga (AC o DC) - solo para tarifa global
  const price = evse.chargeType === "DC" 
    ? priceRanges.defaultPricePerKwhDC 
    : priceRanges.defaultPricePerKwhAC;
  
  return {
    price,
    connectorType: evse.connectorType,
    chargeType: evse.chargeType,
  };
}


// ============================================================================
// CROWDFUNDING OPERATIONS
// ============================================================================

export interface CrowdfundingProject {
  id: number;
  name: string;
  description: string | null;
  city: string;
  zone: string;
  address: string | null;
  targetAmount: number;
  raisedAmount: number;
  minimumInvestment: number;
  totalPowerKw: number;
  chargerCount: number;
  chargerPowerKw: number;
  hasSolarPanels: boolean;
  estimatedRoiPercent: string | null;
  estimatedPaybackMonths: number | null;
  status: string;
  targetDate: Date | null;
  launchDate: Date | null;
  fundedDate: Date | null;
  operationalDate: Date | null;
  priority: number;
  stationId: number | null;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
  investorCount?: number;
}

export interface CrowdfundingParticipation {
  id: number;
  projectId: number;
  investorId: number;
  amount: number;
  participationPercent: string;
  paymentStatus: string;
  paymentDate: Date | null;
  paymentReference: string | null;
  contractSigned: boolean;
  contractSignedAt: Date | null;
  contractUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  investor?: User;
  project?: CrowdfundingProject;
}

// Obtener todos los proyectos de crowdfunding (públicos)
// SEGURIDAD: Whitelist de status válidos para prevenir SQL injection
const VALID_CROWDFUNDING_STATUSES = ['OPEN', 'ACTIVE', 'IN_PROGRESS', 'FUNDED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'DRAFT'] as const;

export async function getCrowdfundingProjects(options?: {
  status?: string;
  includePrivate?: boolean;
}): Promise<CrowdfundingProject[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Validar status contra whitelist para prevenir SQL injection
    const sanitizedStatus = options?.status && VALID_CROWDFUNDING_STATUSES.includes(options.status as any)
      ? options.status
      : null;
    
    let query = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM crowdfunding_participations WHERE projectId = p.id AND paymentStatus = 'COMPLETED') as investorCount,
        s.spaceName as linkedSpaceName,
        s.city as linkedSpaceCity,
        s.submitterName as linkedSubmitterName,
        s.space_status as linkedSpaceStatus,
        COALESCE(s.latitude, cs.latitude) as linkedLatitude,
        COALESCE(s.longitude, cs.longitude) as linkedLongitude
      FROM crowdfunding_projects p
      LEFT JOIN space_submissions s ON s.id = p.spaceSubmissionId
      LEFT JOIN charging_stations cs ON cs.id = p.stationId
    `;
    
    if (sanitizedStatus) {
      query += ` WHERE p.status = '${sanitizedStatus}'`;
    } else if (!options?.includePrivate) {
      query += ` WHERE p.status != 'DRAFT'`;
    }
    
    query += ` ORDER BY p.priority ASC, p.createdAt DESC`;
    
    const result = await db.execute(sql.raw(query));
    const rows = ((result as any)[0] as CrowdfundingProject[]) || [];
    // Normalizar hasSolarPanels de tinyint(1) a boolean
    return rows.map(r => ({ ...r, hasSolarPanels: !!r.hasSolarPanels }));
  } catch (error) {
    console.error('[DB] Error getting crowdfunding projects:', error);
    return [];
  }
}

// Obtener un proyecto por ID
export async function getCrowdfundingProjectById(projectId: number): Promise<CrowdfundingProject | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.execute(sql`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM crowdfunding_participations WHERE projectId = p.id AND paymentStatus = 'COMPLETED') as investorCount
      FROM crowdfunding_projects p
      WHERE p.id = ${projectId}
      LIMIT 1
    `);
    
    const rows = (result as any)[0] as CrowdfundingProject[];
    const row = rows[0] || null;
    // Normalizar hasSolarPanels de tinyint(1) a boolean
    if (row) row.hasSolarPanels = !!row.hasSolarPanels;
    return row;
  } catch (error) {
    console.error('[DB] Error getting crowdfunding project:', error);
    return null;
  }
}

// Crear un nuevo proyecto de crowdfunding
export async function createCrowdfundingProject(data: {
  name: string;
  description?: string;
  city: string;
  zone: string;
  address?: string;
  targetAmount: number;
  minimumInvestment?: number;
  totalPowerKw?: number;
  chargerCount?: number;
  chargerPowerKw?: number;
  hasSolarPanels?: boolean;
  estimatedRoiPercent?: number;
  estimatedPaybackMonths?: number;
  status?: string;
  targetDate?: Date;
  priority?: number;
  createdById?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.execute(sql`
    INSERT INTO crowdfunding_projects (
      name, description, city, zone, address,
      targetAmount, minimumInvestment, totalPowerKw, chargerCount, chargerPowerKw,
      hasSolarPanels, estimatedRoiPercent, estimatedPaybackMonths,
      status, targetDate, priority, createdById
    ) VALUES (
      ${data.name},
      ${data.description || null},
      ${data.city},
      ${data.zone},
      ${data.address || null},
      ${data.targetAmount},
      ${data.minimumInvestment || 50000000},
      ${data.totalPowerKw || 480},
      ${data.chargerCount || 4},
      ${data.chargerPowerKw || 120},
      ${data.hasSolarPanels !== false},
      ${data.estimatedRoiPercent || 85.00},
      ${data.estimatedPaybackMonths || 14},
      ${data.status || 'DRAFT'},
      ${data.targetDate || null},
      ${data.priority || 0},
      ${data.createdById || null}
    )
  `);
  
  return (result[0] as any).insertId;
}

// Actualizar un proyecto de crowdfunding
export async function updateCrowdfundingProject(
  projectId: number,
  data: Partial<{
    name: string;
    description: string;
    city: string;
    zone: string;
    address: string;
    targetAmount: number;
    raisedAmount: number;
    minimumInvestment: number;
    totalPowerKw: number;
    chargerCount: number;
    chargerPowerKw: number;
    hasSolarPanels: boolean;
    estimatedRoiPercent: number;
    estimatedPaybackMonths: number;
    status: string;
    targetDate: Date;
    launchDate: Date;
    fundedDate: Date;
    operationalDate: Date;
    priority: number;
    stationId: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  
  const updates: string[] = [];
  const values: any[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (updates.length === 0) return;
  
  // Construir la query con valores interpolados
  const setClause = Object.entries(data)
    .filter(([_, v]) => v !== undefined)
    .map(([key, value]) => {
      if (value instanceof Date) {
        return `${key} = '${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
      } else if (typeof value === 'string') {
        return `${key} = '${value.replace(/'/g, "''")}'`;
      } else if (typeof value === 'boolean') {
        return `${key} = ${value ? 1 : 0}`;
      } else {
        return `${key} = ${value}`;
      }
    })
    .join(', ');
  
  if (!setClause) return;
  
  await db.execute(sql.raw(`
    UPDATE crowdfunding_projects 
    SET ${setClause}
    WHERE id = ${projectId}
  `));
}

// Obtener participaciones de un proyecto
export async function getCrowdfundingParticipations(projectId: number): Promise<CrowdfundingParticipation[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.execute(sql.raw(`
      SELECT 
        cp.*,
        u.name as investorName,
        u.email as investorEmail
      FROM crowdfunding_participations cp
      LEFT JOIN users u ON cp.investorId = u.id
      WHERE cp.projectId = ${projectId}
      ORDER BY cp.createdAt DESC
    `));
    
    return ((result as any)[0] as CrowdfundingParticipation[]) || [];
  } catch (error) {
    console.error('[DB] Error getting crowdfunding participations:', error);
    return [];
  }
}

// Obtener participaciones de un inversionista
export async function getInvestorParticipations(investorId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.execute(sql`
      SELECT 
        cp.id,
        cp.projectId,
        cp.investorId,
        cp.amount,
        cp.participationPercent,
        cp.paymentStatus,
        cp.paymentDate,
        cp.createdAt,
        p.name as projectName,
        p.city as projectCity,
        p.zone as projectZone,
        p.status as projectStatus,
        p.targetAmount as projectTargetAmount,
        p.raisedAmount as projectRaisedAmount,
        p.totalPowerKw as projectTotalPowerKw,
        p.hasSolarPanels as projectHasSolarPanels,
        p.stationId as projectStationId,
        p.estimatedRoiPercent as projectEstimatedRoiPercent,
        cs.isOnline as stationIsOnline,
        cs.isActive as stationIsActive,
        cs.name as stationName,
        cs.investorSharePercent as stationInvestorSharePercent,
        cs.evgreenSharePercent as stationEvgreenSharePercent,
        cs.hostSharePercent as stationHostSharePercent,
        cs.energyPurchaseCostPerKwh as stationEnergyCostPerKwh
      FROM crowdfunding_participations cp
      LEFT JOIN crowdfunding_projects p ON cp.projectId = p.id
      LEFT JOIN charging_stations cs ON p.stationId = cs.id
      WHERE cp.investorId = ${investorId}
      ORDER BY cp.createdAt DESC
    `);
    
    // Transformar los resultados para incluir el proyecto como objeto anidado
    const rows = ((result as any)[0] as any[]) || [];
    // For each participation, get real transaction-based earnings
    const enrichedRows = [];
    for (const row of rows) {
      let realEarnings = { totalGross: 0, totalNet: 0, txCount: 0, totalKwh: 0 };
      if (row.projectStationId) {
        try {
          const earningsResult = await db.execute(sql`
            SELECT 
              COUNT(*) as txCount,
              COALESCE(SUM(totalCost), 0) as totalGross,
              COALESCE(SUM(kwhConsumed), 0) as totalKwh
            FROM transactions
            WHERE stationId = ${row.projectStationId}
              AND status = 'COMPLETED'
          `);
          const er = (earningsResult as any)[0]?.[0] || {};
          realEarnings.totalGross = Number(er.totalGross || 0);
          realEarnings.txCount = Number(er.txCount || 0);
          realEarnings.totalKwh = Number(er.totalKwh || 0);
          
          // Waterfall correcto del modelo colectivo:
          // Margen = (Ingreso bruto - Costo energía) × 90% (después aliado) × 70% (tu parte)
          // El 70% ya incluye costos operativos (economías de escala)
          const energyCost = realEarnings.totalKwh * Number(row.stationEnergyCostPerKwh || 850);
          const grossMargin = Math.max(0, realEarnings.totalGross - energyCost);
          const hostPct = Number(row.stationHostSharePercent || 10);
          const netAfterHost = grossMargin * (1 - hostPct / 100);
          // 70% es la parte del inversionista (costos op incluidos en modelo colectivo)
          const investorModelPct = 0.70;
          const investorPool = netAfterHost * investorModelPct;
          const myPct = Number(row.participationPercent || 0);
          realEarnings.totalNet = investorPool * (myPct / 100);
        } catch (e) {
          console.error('[DB] Error getting real earnings for participation:', e);
        }
      }
      
      enrichedRows.push({
        id: row.id,
        projectId: row.projectId,
        investorId: row.investorId,
        amount: row.amount,
        participationPercent: row.participationPercent,
        paymentStatus: row.paymentStatus,
        paymentDate: row.paymentDate,
        createdAt: row.createdAt,
        project: {
          name: row.projectName,
          city: row.projectCity,
          zone: row.projectZone,
          status: row.projectStatus,
          targetAmount: row.projectTargetAmount,
          raisedAmount: row.projectRaisedAmount,
          totalPowerKw: row.projectTotalPowerKw,
          hasSolarPanels: !!row.projectHasSolarPanels,
          stationId: row.projectStationId,
          estimatedRoiPercent: row.projectEstimatedRoiPercent,
        },
        station: {
          isOnline: !!row.stationIsOnline,
          isActive: !!row.stationIsActive,
          name: row.stationName || null,
          investorSharePercent: Number(row.stationInvestorSharePercent || 70),
          evgreenSharePercent: Number(row.stationEvgreenSharePercent || 30),
          hostSharePercent: Number(row.stationHostSharePercent || 10),
        },
        realEarnings,
      });
    }
    return enrichedRows;
  } catch (error) {
    console.error('[DB] Error getting investor participations:', error);
    return [];
  }
}

// Crear una participación en un proyecto
export async function createCrowdfundingParticipation(data: {
  projectId: number;
  investorId: number;
  amount: number;
  participationPercent: number;
  paymentStatus?: string;
  paymentDate?: Date;
  paymentReference?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.execute(sql`
    INSERT INTO crowdfunding_participations (
      projectId, investorId, amount, participationPercent, paymentStatus, paymentDate, paymentReference
    ) VALUES (
      ${data.projectId},
      ${data.investorId},
      ${data.amount},
      ${data.participationPercent},
      ${data.paymentStatus || 'PENDING'},
      ${data.paymentDate || null},
      ${data.paymentReference || null}
    )
  `);
  
  return (result[0] as any).insertId;
}

// Actualizar el monto recaudado de un proyecto
export async function updateProjectRaisedAmount(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Calcular el total de participaciones completadas
  await db.execute(sql`
    UPDATE crowdfunding_projects p
    SET raisedAmount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM crowdfunding_participations
      WHERE projectId = ${projectId} AND paymentStatus = 'COMPLETED'
    )
    WHERE p.id = ${projectId}
  `);
  
  // Verificar si se alcanzó la meta
  const project = await getCrowdfundingProjectById(projectId);
  if (project && project.raisedAmount >= project.targetAmount) {
    if (project.status === 'IN_PROGRESS') {
      await db.execute(sql`
        UPDATE crowdfunding_projects
        SET status = 'FUNDED', fundedDate = NOW()
        WHERE id = ${projectId}
      `);
    }
  }
}

// Actualizar participación
export async function updateCrowdfundingParticipation(
  participationId: number,
  data: Partial<{
    paymentStatus: string;
    paymentDate: Date;
    paymentReference: string;
    contractSigned: boolean;
    contractSignedAt: Date;
    contractUrl: string;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  
  const updates: string[] = [];
  const values: any[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (updates.length === 0) return;
  
  // Construir la query con valores interpolados
  const setClause = Object.entries(data)
    .filter(([_, v]) => v !== undefined)
    .map(([key, value]) => {
      if (value instanceof Date) {
        return `${key} = '${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
      } else if (typeof value === 'string') {
        return `${key} = '${value.replace(/'/g, "''")}'`;
      } else if (typeof value === 'boolean') {
        return `${key} = ${value ? 1 : 0}`;
      } else {
        return `${key} = ${value}`;
      }
    })
    .join(', ');
  
  if (!setClause) return;
  
  await db.execute(sql.raw(`
    UPDATE crowdfunding_participations 
    SET ${setClause}
    WHERE id = ${participationId}
  `));
}


// Actualizar monto recaudado por participación
export async function updateProjectRaisedAmountByParticipation(participationId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // Obtener el projectId de la participación
    const result = await db.execute(sql.raw(`
      SELECT projectId FROM crowdfunding_participations WHERE id = ${participationId}
    `));
    
    const rows = (result as any)[0] as any[];
    if (rows[0]?.projectId) {
      await updateProjectRaisedAmount(rows[0].projectId);
    }
  } catch (error) {
    console.error('[DB] Error updating project raised amount:', error);
  }
}


// Obtener una participación por ID
export async function getCrowdfundingParticipationById(participationId: number): Promise<CrowdfundingParticipation | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.execute(sql.raw(`
      SELECT * FROM crowdfunding_participations WHERE id = ${participationId}
    `));
    
    const rows = (result as any)[0] as CrowdfundingParticipation[];
    return rows[0] || null;
  } catch (error) {
    console.error('[DB] Error getting crowdfunding participation:', error);
    return null;
  }
}

// ============================================================================
// FAVORITOS DE ESTACIONES
// ============================================================================

export async function getUserFavoriteStations(userId: number) {
  const database = await getDb();
  if (!database) return [];
  try {
    return await database
      .select()
      .from(favoriteStations)
      .where(eq(favoriteStations.userId, userId))
      .orderBy(desc(favoriteStations.createdAt));
  } catch (error) {
    console.error('[DB] Error getting favorite stations:', error);
    return [];
  }
}

export async function isFavoriteStation(userId: number, stationId: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  try {
    const result = await database
      .select()
      .from(favoriteStations)
      .where(and(
        eq(favoriteStations.userId, userId),
        eq(favoriteStations.stationId, stationId)
      ))
      .limit(1);
    return result.length > 0;
  } catch (error) {
    console.error('[DB] Error checking favorite station:', error);
    return false;
  }
}

export async function addFavoriteStation(userId: number, stationId: number) {
  const database = await getDb();
  if (!database) throw new Error('Database not available');
  try {
    await database.insert(favoriteStations).values({ userId, stationId }).onDuplicateKeyUpdate({ set: { userId } });
    return true;
  } catch (error) {
    console.error('[DB] Error adding favorite station:', error);
    throw error;
  }
}

export async function removeFavoriteStation(userId: number, stationId: number) {
  const database = await getDb();
  if (!database) throw new Error('Database not available');
  try {
    await database
      .delete(favoriteStations)
      .where(and(
        eq(favoriteStations.userId, userId),
        eq(favoriteStations.stationId, stationId)
      ));
    return true;
  } catch (error) {
    console.error('[DB] Error removing favorite station:', error);
    throw error;
  }
}


// ============================================================================
// WOMPI TRANSACTIONS OPERATIONS
// ============================================================================

export async function createWompiTransaction(data: {
  userId: number;
  reference: string;
  amountInCents: number;
  currency?: string;
  type: string;
  customerEmail?: string;
  description?: string;
  integritySignature?: string;
}): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const result = await database.insert(wompiTransactions).values({
    userId: data.userId,
    reference: data.reference,
    amountInCents: data.amountInCents,
    currency: data.currency || "COP",
    type: data.type as any,
    customerEmail: data.customerEmail,
    description: data.description,
    integritySignature: data.integritySignature,
    status: "PENDING",
  });

  return (result as any)[0].insertId;
}

export async function getWompiTransactionByReference(reference: string): Promise<WompiTransaction | null> {
  const database = await getDb();
  if (!database) return null;

  const result = await database
    .select()
    .from(wompiTransactions)
    .where(eq(wompiTransactions.reference, reference))
    .limit(1);

  return result[0] || null;
}

export async function updateWompiTransactionByReference(
  reference: string,
  data: {
    wompiTransactionId?: string;
    status?: string;
    paymentMethodType?: string;
    processedAt?: Date;
    webhookReceivedAt?: Date;
  }
): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.wompiTransactionId) updateData.wompiTransactionId = data.wompiTransactionId;
  if (data.status) updateData.status = data.status;
  if (data.paymentMethodType) updateData.paymentMethodType = data.paymentMethodType;
  if (data.processedAt) updateData.processedAt = data.processedAt;
  if (data.webhookReceivedAt) updateData.webhookReceivedAt = data.webhookReceivedAt;

  if (Object.keys(updateData).length === 0) return;

  await database
    .update(wompiTransactions)
    .set(updateData)
    .where(eq(wompiTransactions.reference, reference));
}

export async function getWompiTransactionsByUser(
  userId: number,
  limit: number = 20,
  offset: number = 0
): Promise<WompiTransaction[]> {
  const database = await getDb();
  if (!database) return [];

  return database
    .select()
    .from(wompiTransactions)
    .where(eq(wompiTransactions.userId, userId))
    .orderBy(desc(wompiTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Obtener transacciones de Wompi con estado PENDING
 * Usado para reconciliación de transacciones que no fueron procesadas por webhook
 */
export async function getPendingWompiTransactions(): Promise<WompiTransaction[]> {
  const database = await getDb();
  if (!database) return [];

  return database
    .select()
    .from(wompiTransactions)
    .where(eq(wompiTransactions.status, "PENDING"))
    .orderBy(desc(wompiTransactions.createdAt))
    .limit(100);
}


// ============================================================================
// USER VEHICLES OPERATIONS
// ============================================================================

// userVehicles, UserVehicle, InsertUserVehicle already imported at top of file

export async function getUserVehicles(userId: number): Promise<UserVehicle[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, userId), eq(userVehicles.isActive, true)))
    .orderBy(desc(userVehicles.isDefault), desc(userVehicles.createdAt));
}

export async function getUserVehicleById(id: number, userId: number): Promise<UserVehicle | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.id, id), eq(userVehicles.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserVehicle(vehicle: InsertUserVehicle): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Si es el primer vehículo del usuario o se marca como default, asegurar que solo uno sea default
  if (vehicle.isDefault) {
    await db
      .update(userVehicles)
      .set({ isDefault: false })
      .where(eq(userVehicles.userId, vehicle.userId));
  }

  // Si es el primer vehículo, marcarlo como default automáticamente
  const existingCount = await db
    .select({ count: count() })
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, vehicle.userId), eq(userVehicles.isActive, true)));

  if (existingCount[0].count === 0) {
    vehicle.isDefault = true;
  }

  const result = await db.insert(userVehicles).values(vehicle);
  return Number(result[0].insertId);
}

export async function updateUserVehicle(
  id: number,
  userId: number,
  data: Partial<InsertUserVehicle>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Si se marca como default, quitar default de los demás
  if (data.isDefault) {
    await db
      .update(userVehicles)
      .set({ isDefault: false })
      .where(and(eq(userVehicles.userId, userId), ne(userVehicles.id, id)));
  }

  await db
    .update(userVehicles)
    .set(data)
    .where(and(eq(userVehicles.id, id), eq(userVehicles.userId, userId)));
}

export async function deleteUserVehicle(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Soft delete
  await db
    .update(userVehicles)
    .set({ isActive: false, isDefault: false })
    .where(and(eq(userVehicles.id, id), eq(userVehicles.userId, userId)));

  // Si el eliminado era el default, asignar default al siguiente vehículo activo
  const remaining = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, userId), eq(userVehicles.isActive, true)))
    .orderBy(desc(userVehicles.createdAt))
    .limit(1);

  if (remaining.length > 0) {
    const hasDefault = await db
      .select()
      .from(userVehicles)
      .where(
        and(
          eq(userVehicles.userId, userId),
          eq(userVehicles.isActive, true),
          eq(userVehicles.isDefault, true)
        )
      )
      .limit(1);

    if (hasDefault.length === 0) {
      await db
        .update(userVehicles)
        .set({ isDefault: true })
        .where(eq(userVehicles.id, remaining[0].id));
    }
  }
}

export async function setDefaultVehicle(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Quitar default de todos
  await db
    .update(userVehicles)
    .set({ isDefault: false })
    .where(eq(userVehicles.userId, userId));
  // Marcar el seleccionado como default
  await db
    .update(userVehicles)
    .set({ isDefault: true })
    .where(and(eq(userVehicles.id, id), eq(userVehicles.userId, userId)));
}

export async function getDefaultVehicle(userId: number): Promise<UserVehicle | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userVehicles)
    .where(
      and(
        eq(userVehicles.userId, userId),
        eq(userVehicles.isActive, true),
        eq(userVehicles.isDefault, true)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateVehicleBatteryLevel(
  vehicleId: number,
  userId: number,
  batteryLevel: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userVehicles)
    .set({
      batteryLevel,
      lastBatteryUpdate: new Date(),
    })
    .where(
      and(
        eq(userVehicles.id, vehicleId),
        eq(userVehicles.userId, userId)
      )
    );
}


// ============================================================================
// FIRMWARE UPDATES
// ============================================================================

export async function createFirmwareUpdate(params: {
  stationId: number;
  ocppIdentity: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  version?: string;
  initiatedBy?: number;
  notes?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(firmwareUpdates).values({
    stationId: params.stationId,
    ocppIdentity: params.ocppIdentity,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fileUrl: params.fileUrl,
    version: params.version || null,
    initiatedBy: params.initiatedBy || null,
    notes: params.notes || null,
    status: "PENDING",
    progress: 0,
  });
  return result[0].insertId;
}

export async function updateFirmwareStatus(
  id: number,
  status: string,
  progress: number,
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updates: any = { status, progress, updatedAt: new Date() };
  if (errorMessage) updates.errorMessage = errorMessage;
  if (status === "DOWNLOADING" || status === "INSTALLING") {
    updates.startedAt = new Date();
  }
  if (status === "INSTALLED" || status === "FAILED" || status === "INSTALLATION_FAILED" || status === "DOWNLOAD_FAILED") {
    updates.completedAt = new Date();
  }
  await db.update(firmwareUpdates).set(updates).where(eq(firmwareUpdates.id, id));
}

export async function updateFirmwareStatusByIdentity(
  ocppIdentity: string,
  status: string,
  progress: number,
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Update the latest active firmware update for this charger
  const active = await db
    .select()
    .from(firmwareUpdates)
    .where(
      and(
        eq(firmwareUpdates.ocppIdentity, ocppIdentity),
        inArray(firmwareUpdates.status, ["PENDING", "DOWNLOADING", "DOWNLOADED", "INSTALLING"])
      )
    )
    .orderBy(desc(firmwareUpdates.createdAt))
    .limit(1);

  if (active.length > 0) {
    await updateFirmwareStatus(active[0].id, status, progress, errorMessage);
  }
}

export async function getFirmwareUpdatesByStation(stationId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(firmwareUpdates)
    .where(eq(firmwareUpdates.stationId, stationId))
    .orderBy(desc(firmwareUpdates.createdAt))
    .limit(limit);
}

export async function getAllFirmwareUpdates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(firmwareUpdates)
    .orderBy(desc(firmwareUpdates.createdAt))
    .limit(limit);
}

export async function getActiveFirmwareUpdates() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(firmwareUpdates)
    .where(
      inArray(firmwareUpdates.status, ["PENDING", "DOWNLOADING", "DOWNLOADED", "INSTALLING"])
    )
    .orderBy(desc(firmwareUpdates.createdAt));
}


// ============================================================================
// STATION REVIEWS / CALIFICACIONES
// ============================================================================

export async function getReviewsByStationId(stationId: number) {
  const database = await getDb();
  if (!database) return [];
  const result = await database
    .select({
      id: stationReviews.id,
      stationId: stationReviews.stationId,
      userId: stationReviews.userId,
      rating: stationReviews.rating,
      comment: stationReviews.comment,
      ownerResponse: stationReviews.ownerResponse,
      createdAt: stationReviews.createdAt,
      userName: users.name,
    })
    .from(stationReviews)
    .leftJoin(users, eq(stationReviews.userId, users.id))
    .where(eq(stationReviews.stationId, stationId))
    .orderBy(desc(stationReviews.createdAt));
  return result;
}

export async function getStationAverageRating(stationId: number) {
  const database = await getDb();
  if (!database) return { averageRating: null, totalReviews: 0 };
  const result = await database
    .select({
      averageRating: sql<number>`AVG(${stationReviews.rating})`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(stationReviews)
    .where(eq(stationReviews.stationId, stationId));
  return {
    averageRating: result[0]?.averageRating || null,
    totalReviews: Number(result[0]?.totalReviews) || 0,
  };
}

export async function createStationReview(data: {
  stationId: number;
  userId: number;
  rating: number;
  comment?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(stationReviews).values({
    stationId: data.stationId,
    userId: data.userId,
    rating: data.rating,
    comment: data.comment || null,
  });
  return Number(result[0].insertId);
}

export async function getUserReviewForStation(userId: number, stationId: number) {
  const database = await getDb();
  if (!database) return null;
  const result = await database
    .select()
    .from(stationReviews)
    .where(and(eq(stationReviews.userId, userId), eq(stationReviews.stationId, stationId)))
    .limit(1);
  return result[0] || null;
}

export async function updateStationReview(id: number, data: {
  rating?: number;
  comment?: string;
  ownerResponse?: string;
}) {
  const database = await getDb();
  if (!database) return;
  const updateData: any = { updatedAt: new Date() };
  if (data.rating !== undefined) updateData.rating = data.rating;
  if (data.comment !== undefined) updateData.comment = data.comment;
  if (data.ownerResponse !== undefined) updateData.ownerResponse = data.ownerResponse;
  await database.update(stationReviews).set(updateData).where(eq(stationReviews.id, id));
}

export async function deleteStationReview(id: number) {
  const database = await getDb();
  if (!database) return;
  await database.delete(stationReviews).where(eq(stationReviews.id, id));
}

// ============================================================================
// ID TAGS / RFID OPERATIONS
// ============================================================================

/**
 * Buscar un idTag en la tabla id_tags.
 * Retorna el registro completo incluyendo userId, tipo, estado, etc.
 */
export async function getIdTag(idTag: string): Promise<IdTag | undefined> {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(idTags).where(eq(idTags.idTag, idTag)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Buscar usuario por idTag usando la tabla id_tags (soporta APP, RFID, NFC).
 * Solo retorna si el tag está ACTIVE.
 */
export async function getUserByIdTagFromTable(idTag: string): Promise<User | undefined> {
  const database = await getDb();
  if (!database) return undefined;
  
  const tag = await database.select().from(idTags)
    .where(and(eq(idTags.idTag, idTag), eq(idTags.status, "ACTIVE")))
    .limit(1);
  
  if (tag.length === 0 || !tag[0].userId) return undefined;
  
  const user = await database.select().from(users).where(eq(users.id, tag[0].userId)).limit(1);
  return user.length > 0 ? user[0] : undefined;
}

/**
 * Resolver usuario por idTag con múltiples estrategias:
 * 1. Buscar en tabla id_tags (nueva, soporta RFID/NFC)
 * 2. Buscar en tabla users por idTag legacy
 * 3. Extraer userId del formato USER-{id}
 * 4. Extraer userId del formato EV-XXXXXX buscando en id_tags
 */
export async function resolveUserByIdTag(idTag: string): Promise<{ user: User | undefined; source: string }> {
  // 1. Buscar en tabla id_tags (prioridad máxima)
  const userFromTable = await getUserByIdTagFromTable(idTag);
  if (userFromTable) {
    return { user: userFromTable, source: "id_tags_table" };
  }
  
  // 2. Buscar en tabla users por idTag legacy
  const userLegacy = await getUserByIdTag(idTag);
  if (userLegacy) {
    return { user: userLegacy, source: "users_legacy" };
  }
  
  // 3. Formato USER-{id}
  const userIdMatch = idTag.match(/^USER-(\d+)$/);
  if (userIdMatch) {
    const user = await getUserById(parseInt(userIdMatch[1], 10));
    return { user: user || undefined, source: "user_id_format" };
  }
  
  return { user: undefined, source: "not_found" };
}

/**
 * Crear un nuevo idTag (para RFID, NFC o APP)
 */
export async function createIdTag(data: {
  idTag: string;
  userId?: number;
  type: "APP" | "RFID" | "NFC" | "REMOTE";
  status?: "ACTIVE" | "BLOCKED" | "EXPIRED" | "LOST";
  label?: string;
  serialNumber?: string;
  expiresAt?: Date;
  parentIdTag?: string;
  maxActiveTransactions?: number;
}): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const result = await database.insert(idTags).values({
    idTag: data.idTag,
    userId: data.userId,
    type: data.type,
    status: data.status || "ACTIVE",
    label: data.label,
    serialNumber: data.serialNumber,
    expiresAt: data.expiresAt,
    parentIdTag: data.parentIdTag,
    maxActiveTransactions: data.maxActiveTransactions || 1,
  });
  
  return result[0].insertId;
}

/**
 * Actualizar un idTag existente
 */
export async function updateIdTag(id: number, data: Partial<InsertIdTag>): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(idTags).set(data).where(eq(idTags.id, id));
}

/**
 * Registrar uso de un idTag (actualizar lastUsedAt y lastUsedStationId)
 */
export async function recordIdTagUsage(idTag: string, stationId: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(idTags)
    .set({ lastUsedAt: new Date(), lastUsedStationId: stationId })
    .where(eq(idTags.idTag, idTag));
}

/**
 * Obtener todos los idTags de un usuario
 */
export async function getIdTagsByUserId(userId: number): Promise<IdTag[]> {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(idTags).where(eq(idTags.userId, userId));
}

/**
 * Obtener todos los idTags (admin)
 */
export async function getAllIdTags(filters?: { type?: string; status?: string }): Promise<IdTag[]> {
  const database = await getDb();
  if (!database) return [];
  
  const conditions = [];
  if (filters?.type) conditions.push(eq(idTags.type, filters.type as any));
  if (filters?.status) conditions.push(eq(idTags.status, filters.status as any));
  
  if (conditions.length > 0) {
    return database.select().from(idTags).where(and(...conditions));
  }
  return database.select().from(idTags);
}

/**
 * Bloquear un idTag
 */
export async function blockIdTag(idTag: string): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(idTags).set({ status: "BLOCKED" }).where(eq(idTags.idTag, idTag));
}

/**
 * Verificar si un idTag es válido para iniciar una transacción:
 * - Existe en la tabla
 * - Está ACTIVE
 * - No ha expirado
 * - Tiene un usuario asignado
 */
export async function validateIdTag(idTag: string): Promise<{
  valid: boolean;
  reason: string;
  userId?: number;
  tagType?: string;
}> {
  const tag = await getIdTag(idTag);
  
  if (!tag) {
    return { valid: false, reason: "TAG_NOT_FOUND" };
  }
  
  if (tag.status === "BLOCKED") {
    return { valid: false, reason: "TAG_BLOCKED" };
  }
  
  if (tag.status === "EXPIRED") {
    return { valid: false, reason: "TAG_EXPIRED" };
  }
  
  if (tag.status === "LOST") {
    return { valid: false, reason: "TAG_LOST" };
  }
  
  if (tag.expiresAt && new Date(tag.expiresAt) < new Date()) {
    // Marcar como expirado
    await updateIdTag(tag.id, { status: "EXPIRED" });
    return { valid: false, reason: "TAG_EXPIRED" };
  }
  
  if (!tag.userId) {
    return { valid: false, reason: "TAG_NOT_ASSIGNED" };
  }
  
  return {
    valid: true,
    reason: "OK",
    userId: tag.userId,
    tagType: tag.type,
  };
}

/**
 * Sincronizar idTags: cuando se crea un nuevo idTag en users, también crear en id_tags
 */
export async function syncUserIdTag(userId: number, idTag: string): Promise<void> {
  const existing = await getIdTag(idTag);
  if (existing) {
    // Actualizar userId si cambió
    if (existing.userId !== userId) {
      await updateIdTag(existing.id, { userId });
    }
    return;
  }
  
  // Crear nuevo registro en id_tags
  await createIdTag({
    idTag,
    userId,
    type: "APP",
    label: "Tag de la app",
  });
}


// ============================================================================
// ACTIVE TRANSACTIONS BY STATION (para StopTransaction fallback)
// ============================================================================

/**
 * Obtener transacciones activas (IN_PROGRESS) de una estación
 */
export async function getActiveTransactionsByStationId(stationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(transactions)
    .where(
      and(
        eq(transactions.stationId, stationId),
        eq(transactions.status, "IN_PROGRESS")
      )
    )
    .orderBy(desc(transactions.startTime))
    .limit(10);
  
  return result;
}


// ============================================================================
// CHARGER BRANDS / PROFILES
// ============================================================================

/**
 * Obtener todos los perfiles de marca de cargador activos
 */
export async function getAllChargerBrands() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(chargerBrands)
    .where(eq(chargerBrands.isActive, true))
    .orderBy(chargerBrands.brand, chargerBrands.model);
  
  return result;
}

/**
 * Obtener un perfil de marca de cargador por ID
 */
export async function getChargerBrandById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(chargerBrands)
    .where(eq(chargerBrands.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Obtener perfil de marca por nombre de marca y modelo
 */
export async function getChargerBrandByBrandModel(brand: string, model: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(chargerBrands)
    .where(
      and(
        eq(chargerBrands.brand, brand),
        eq(chargerBrands.model, model),
        eq(chargerBrands.isActive, true)
      )
    )
    .limit(1);
  
  return result[0] || null;
}

/**
 * Crear un nuevo perfil de marca de cargador
 */
export async function createChargerBrand(data: InsertChargerBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chargerBrands).values(data);
  return result[0].insertId;
}

/**
 * Actualizar un perfil de marca de cargador
 */
export async function updateChargerBrand(id: number, data: Partial<InsertChargerBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(chargerBrands)
    .set(data)
    .where(eq(chargerBrands.id, id));
}

/**
 * Obtener el perfil de marca asociado a una estación
 */
export async function getChargerBrandForStation(stationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const station = await db.select({
    chargerBrandId: chargingStations.chargerBrandId,
  })
    .from(chargingStations)
    .where(eq(chargingStations.id, stationId))
    .limit(1);
  
  if (!station[0]?.chargerBrandId) return null;
  
  return getChargerBrandById(station[0].chargerBrandId);
}


// ============================================================================
// TARIFF CHANGE LOG OPERATIONS (Auditoría de cambios de tarifas)
// ============================================================================

export async function createTariffChangeLog(log: InsertTariffChangeLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tariffChangeLogs).values(log);
  return result[0].insertId;
}

export async function getTariffChangeLogs(filters?: {
  tariffId?: number;
  stationId?: number;
  changedBy?: number;
  changeType?: string;
  limit?: number;
  offset?: number;
}): Promise<TariffChangeLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.tariffId) conditions.push(eq(tariffChangeLogs.tariffId, filters.tariffId));
  if (filters?.stationId) conditions.push(eq(tariffChangeLogs.stationId, filters.stationId));
  if (filters?.changedBy) conditions.push(eq(tariffChangeLogs.changedBy, filters.changedBy));
  
  const query = db.select().from(tariffChangeLogs);
  
  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(desc(tariffChangeLogs.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
  }
  
  return query
    .orderBy(desc(tariffChangeLogs.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);
}

export async function getTariffChangeLogsByStation(stationId: number, limit = 50): Promise<TariffChangeLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tariffChangeLogs)
    .where(eq(tariffChangeLogs.stationId, stationId))
    .orderBy(desc(tariffChangeLogs.createdAt))
    .limit(limit);
}

// Obtener todos los inversionistas con estaciones activas (para notificaciones)
export async function getInvestorsWithActiveStations(): Promise<Array<{
  userId: number;
  userName: string | null;
  email: string | null;
  fcmToken: string | null;
  stationCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.execute(sql`
    SELECT 
      u.id as userId,
      u.name as userName,
      u.email as email,
      u.fcmToken as fcmToken,
      COUNT(cs.id) as stationCount
    FROM users u
    INNER JOIN charging_stations cs ON cs.ownerId = u.id AND cs.isActive = 1
    WHERE u.role = 'investor'
    GROUP BY u.id, u.name, u.email, u.fcmToken
  `);
  
  const rows = (results as any)[0] as any[];
  return rows.map(r => ({
    userId: r.userId,
    userName: r.userName,
    email: r.email,
    fcmToken: r.fcmToken,
    stationCount: Number(r.stationCount),
  }));
}


// ============================================================================
// USER LOCATION HISTORY
// ============================================================================

export async function saveUserLocation(data: {
  userId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
  address?: string;
  city?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(userLocationHistory).values({
    userId: data.userId,
    latitude: data.latitude.toString(),
    longitude: data.longitude.toString(),
    accuracy: data.accuracy?.toString(),
    source: data.source || "chat",
    address: data.address,
    city: data.city,
  });
  return (result as any)[0]?.insertId || 0;
}

export async function getRecentUserLocations(userId: number, limit = 20): Promise<UserLocationHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userLocationHistory)
    .where(eq(userLocationHistory.userId, userId))
    .orderBy(desc(userLocationHistory.createdAt))
    .limit(limit);
}

export async function getLastUserLocation(userId: number): Promise<UserLocationHistory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const results = await db.select().from(userLocationHistory)
    .where(eq(userLocationHistory.userId, userId))
    .orderBy(desc(userLocationHistory.createdAt))
    .limit(1);
  return results[0];
}

// ============================================================================
// USER ROUTE PATTERNS
// ============================================================================

export async function getUserRoutePatterns(userId: number, limit = 10): Promise<UserRoutePattern[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userRoutePatterns)
    .where(eq(userRoutePatterns.userId, userId))
    .orderBy(desc(userRoutePatterns.frequency))
    .limit(limit);
}

export async function upsertRoutePattern(data: {
  userId: number;
  originLat: number;
  originLng: number;
  originName?: string;
  destinationLat: number;
  destinationLng: number;
  destinationName?: string;
  estimatedDistanceKm?: number;
  departureHour?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Buscar ruta similar existente (dentro de ~1km de radio)
  const existing = await db.select().from(userRoutePatterns)
    .where(eq(userRoutePatterns.userId, data.userId));

  const THRESHOLD = 0.01; // ~1km
  const match = existing.find(r => {
    const oLatDiff = Math.abs(Number(r.originLatitude) - data.originLat);
    const oLngDiff = Math.abs(Number(r.originLongitude) - data.originLng);
    const dLatDiff = Math.abs(Number(r.destinationLatitude) - data.destinationLat);
    const dLngDiff = Math.abs(Number(r.destinationLongitude) - data.destinationLng);
    return oLatDiff < THRESHOLD && oLngDiff < THRESHOLD && dLatDiff < THRESHOLD && dLngDiff < THRESHOLD;
  });

  if (match) {
    // Actualizar frecuencia
    await db.update(userRoutePatterns)
      .set({
        frequency: match.frequency + 1,
        lastUsed: new Date(),
        updatedAt: new Date(),
        ...(data.originName ? { originName: data.originName } : {}),
        ...(data.destinationName ? { destinationName: data.destinationName } : {}),
        ...(data.departureHour !== undefined ? { typicalDepartureHour: data.departureHour } : {}),
      })
      .where(eq(userRoutePatterns.id, match.id));
  } else {
    // Crear nueva ruta
    await db.insert(userRoutePatterns).values({
      userId: data.userId,
      originLatitude: data.originLat.toString(),
      originLongitude: data.originLng.toString(),
      originName: data.originName,
      destinationLatitude: data.destinationLat.toString(),
      destinationLongitude: data.destinationLng.toString(),
      destinationName: data.destinationName,
      frequency: 1,
      estimatedDistanceKm: data.estimatedDistanceKm?.toString(),
      typicalDepartureHour: data.departureHour,
    });
  }
}

/**
 * Obtener ubicaciones frecuentes del usuario (clusters de ubicación)
 * Detecta "casa", "oficina", etc. basado en frecuencia y horarios
 */
export async function getUserFrequentLocations(userId: number): Promise<Array<{
  latitude: number;
  longitude: number;
  count: number;
  label: string;
  typicalHours: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const locations = await db.select().from(userLocationHistory)
    .where(eq(userLocationHistory.userId, userId))
    .orderBy(desc(userLocationHistory.createdAt))
    .limit(200);

  if (locations.length < 3) return [];

  // Simple clustering: agrupar ubicaciones cercanas
  const clusters: Array<{
    lat: number;
    lng: number;
    count: number;
    hours: number[];
    address?: string;
  }> = [];

  const CLUSTER_RADIUS = 0.005; // ~500m

  for (const loc of locations) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const hour = loc.createdAt.getHours();
    
    const existing = clusters.find(c => 
      Math.abs(c.lat - lat) < CLUSTER_RADIUS && Math.abs(c.lng - lng) < CLUSTER_RADIUS
    );

    if (existing) {
      existing.count++;
      existing.hours.push(hour);
      if (!existing.address && loc.address) existing.address = loc.address;
    } else {
      clusters.push({ lat, lng, count: 1, hours: [hour], address: loc.address || undefined });
    }
  }

  // Ordenar por frecuencia y etiquetar
  return clusters
    .filter(c => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c, i) => {
      const avgHour = Math.round(c.hours.reduce((a, b) => a + b, 0) / c.hours.length);
      let label = c.address || `Ubicación frecuente ${i + 1}`;
      
      // Heurística simple: si la mayoría de visitas son nocturnas, probablemente es casa
      const nightVisits = c.hours.filter(h => h >= 20 || h <= 7).length;
      const morningVisits = c.hours.filter(h => h >= 7 && h <= 10).length;
      if (nightVisits > c.count * 0.5) label = `Posible casa (${c.address || 'sin dirección'})`;
      else if (morningVisits > c.count * 0.3) label = `Posible trabajo (${c.address || 'sin dirección'})`;

      const typicalHours = avgHour < 12 ? `Mañana (~${avgHour}:00)` : avgHour < 18 ? `Tarde (~${avgHour}:00)` : `Noche (~${avgHour}:00)`;

      return {
        latitude: c.lat,
        longitude: c.lng,
        count: c.count,
        label,
        typicalHours,
      };
    });
}


// ============================================================================
// USER DEBTS - Gestión de deudas pendientes
// ============================================================================

/**
 * Crear una nueva deuda para un usuario
 */
export async function createUserDebt(data: {
  userId: number;
  transactionId?: number;
  originalAmount: number;
  reason: string;
  description?: string;
}): Promise<number> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("Database not available");

  const [result] = await dbInstance.insert(userDebts).values({
    userId: data.userId,
    transactionId: data.transactionId ?? null,
    originalAmount: data.originalAmount.toFixed(2),
    remainingAmount: data.originalAmount.toFixed(2),
    reason: data.reason,
    description: data.description || null,
    status: "PENDING",
    autoChargeAttempts: 0,
  });

  console.log(`[Debt] Created debt #${result.insertId} for user ${data.userId}: $${data.originalAmount} COP (${data.reason})`);
  return result.insertId;
}

/**
 * Obtener deudas pendientes de un usuario
 */
export async function getUserPendingDebts(userId: number): Promise<UserDebt[]> {
  const dbInstance = await getDb();
  if (!dbInstance) return [];

  return dbInstance.select()
    .from(userDebts)
    .where(and(
      eq(userDebts.userId, userId),
      or(
        eq(userDebts.status, "PENDING"),
        eq(userDebts.status, "PARTIAL")
      )
    ))
    .orderBy(userDebts.createdAt);
}

/**
 * Obtener el total de deuda pendiente de un usuario
 */
export async function getUserTotalDebt(userId: number): Promise<number> {
  const debts = await getUserPendingDebts(userId);
  return debts.reduce((total, debt) => {
    return total + parseFloat(debt.remainingAmount?.toString() || "0");
  }, 0);
}

/**
 * Verificar si un usuario tiene deudas pendientes (para bloqueo de cargas)
 */
export async function userHasPendingDebt(userId: number): Promise<boolean> {
  const totalDebt = await getUserTotalDebt(userId);
  return totalDebt > 0;
}

/**
 * Marcar una deuda como pagada (total o parcialmente)
 */
export async function payUserDebt(debtId: number, amountPaid: number, paymentReference?: string): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  const [debt] = await dbInstance.select().from(userDebts).where(eq(userDebts.id, debtId)).limit(1);
  if (!debt) return;

  const remaining = parseFloat(debt.remainingAmount?.toString() || "0");
  const newRemaining = Math.max(0, remaining - amountPaid);

  await dbInstance.update(userDebts)
    .set({
      remainingAmount: newRemaining.toFixed(2),
      status: newRemaining <= 0 ? "PAID" : "PARTIAL",
      paymentReference: paymentReference || debt.paymentReference,
      paidAt: newRemaining <= 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(userDebts.id, debtId));

  console.log(`[Debt] Debt #${debtId}: paid $${amountPaid}, remaining $${newRemaining} (${newRemaining <= 0 ? "PAID" : "PARTIAL"})`);
}

/**
 * Incrementar intentos de auto-cobro fallido
 */
export async function incrementDebtAutoChargeAttempts(debtId: number): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  const [debt] = await dbInstance.select().from(userDebts).where(eq(userDebts.id, debtId)).limit(1);
  if (!debt) return;

  await dbInstance.update(userDebts)
    .set({
      autoChargeAttempts: (debt.autoChargeAttempts || 0) + 1,
      lastAutoChargeAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userDebts.id, debtId));
}

/**
 * Obtener todas las deudas de un usuario (incluyendo pagadas, para historial)
 */
export async function getAllUserDebts(userId: number): Promise<UserDebt[]> {
  const dbInstance = await getDb();
  if (!dbInstance) return [];

  return dbInstance.select()
    .from(userDebts)
    .where(eq(userDebts.userId, userId))
    .orderBy(desc(userDebts.createdAt));
}

/**
 * Condonar una deuda (admin)
 */
export async function waiveUserDebt(debtId: number): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  await dbInstance.update(userDebts)
    .set({
      status: "WAIVED",
      remainingAmount: "0.00",
      updatedAt: new Date(),
    })
    .where(eq(userDebts.id, debtId));

  console.log(`[Debt] Debt #${debtId} waived by admin`);
}

/**
 * Pagar todas las deudas pendientes de un usuario desde su billetera
 * Retorna el monto total pagado
 */
export async function payAllDebtsFromWallet(userId: number): Promise<{ totalPaid: number; debtsCleared: number }> {
  const dbInstance = await getDb();
  if (!dbInstance) return { totalPaid: 0, debtsCleared: 0 };

  const pendingDebts = await getUserPendingDebts(userId);
  if (pendingDebts.length === 0) return { totalPaid: 0, debtsCleared: 0 };

  const wallet = await getWalletByUserId(userId);
  if (!wallet) return { totalPaid: 0, debtsCleared: 0 };

  let balance = parseFloat(wallet.balance?.toString() || "0");
  let totalPaid = 0;
  let debtsCleared = 0;

  for (const debt of pendingDebts) {
    if (balance <= 0) break;
    
    const remaining = parseFloat(debt.remainingAmount?.toString() || "0");
    const payment = Math.min(balance, remaining);
    
    await payUserDebt(debt.id, payment, `WALLET-${Date.now()}`);
    balance -= payment;
    totalPaid += payment;
    
    if (payment >= remaining) debtsCleared++;
  }

  if (totalPaid > 0) {
    // Actualizar balance de billetera
    await updateWalletBalance(userId, balance.toFixed(2));
    
    // Registrar transacción de billetera
    await createWalletTransaction({
      walletId: wallet.id,
      userId,
      type: "OVERSTAY_PENALTY",
      amount: (-totalPaid).toFixed(2),
      balanceBefore: (balance + totalPaid).toFixed(2),
      balanceAfter: balance.toFixed(2),
      description: `Pago de deuda pendiente por ocupación (${debtsCleared} deuda${debtsCleared > 1 ? 's' : ''})`,
      status: "COMPLETED",
    });
  }

  return { totalPaid, debtsCleared };
}

// ============================================================
// SOC ACCURACY LOG - Historial de precisión del SoC manual
// ============================================================
export async function createSocAccuracyLog(data: {
  userId: number;
  transactionId: number;
  vehicleId?: number | null;
  manualSocStart: number;
  manualBatteryCapacityKwh: number;
  realKwhDelivered: number;
  calculatedSocEnd?: number | null;
  chargerSocEnd?: number | null;
  batteryFullDetected?: boolean;
  detectionMethod?: string;
  estimatedErrorKwh?: number | null;
  estimatedErrorSocPct?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const { socAccuracyLog } = await import("../drizzle/schema");
  await db.insert(socAccuracyLog).values({
    ...data,
    batteryFullDetected: data.batteryFullDetected ?? false,
  });
  return true;
}

export async function getSocAccuracyByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const { socAccuracyLog } = await import("../drizzle/schema");
  return db.select().from(socAccuracyLog)
    .where(eq(socAccuracyLog.userId, userId))
    .orderBy(desc(socAccuracyLog.createdAt))
    .limit(limit);
}

export async function getSocAccuracySuggestion(userId: number): Promise<{
  suggestedCapacityKwh: number | null;
  avgErrorKwh: number | null;
  sampleCount: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const { socAccuracyLog } = await import("../drizzle/schema");
  const logs = await db.select().from(socAccuracyLog)
    .where(eq(socAccuracyLog.userId, userId))
    .orderBy(desc(socAccuracyLog.createdAt))
    .limit(10);
  if (logs.length < 2) return { suggestedCapacityKwh: null, avgErrorKwh: null, sampleCount: logs.length };
  // Calcular error promedio
  const errors = logs
    .filter(l => l.estimatedErrorKwh !== null)
    .map(l => l.estimatedErrorKwh as number);
  const avgError = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : null;
  // Sugerir capacidad corregida basada en el error promedio
  const lastCapacity = logs[0].manualBatteryCapacityKwh;
  const suggestedCapacity = avgError && Math.abs(avgError) > 2
    ? Math.round((lastCapacity - avgError) * 10) / 10
    : null;
  return {
    suggestedCapacityKwh: suggestedCapacity,
    avgErrorKwh: avgError ? Math.round(avgError * 10) / 10 : null,
    sampleCount: logs.length,
  };
}


// ============================================================
// ADMIN DEBT MANAGEMENT - Funciones para panel admin de deudas
// ============================================================

/**
 * Obtener todas las deudas del sistema con datos del usuario (para admin)
 */
export async function getAllDebtsAdmin(filters?: {
  status?: string;
  reason?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ debts: any[]; total: number }> {
  const dbInstance = await getDb();
  if (!dbInstance) return { debts: [], total: 0 };

  const conditions: any[] = [];
  
  if (filters?.status && filters.status !== "ALL") {
    conditions.push(eq(userDebts.status, filters.status as any));
  }
  if (filters?.reason && filters.reason !== "ALL") {
    conditions.push(eq(userDebts.reason, filters.reason));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  // Obtener total
  const [countResult] = await dbInstance
    .select({ count: sql<number>`COUNT(*)` })
    .from(userDebts)
    .where(whereClause);
  const total = countResult?.count || 0;

  // Obtener deudas con datos de usuario
  const debts = await dbInstance
    .select({
      id: userDebts.id,
      userId: userDebts.userId,
      transactionId: userDebts.transactionId,
      originalAmount: userDebts.originalAmount,
      remainingAmount: userDebts.remainingAmount,
      reason: userDebts.reason,
      description: userDebts.description,
      status: userDebts.status,
      autoChargeAttempts: userDebts.autoChargeAttempts,
      lastAutoChargeAt: userDebts.lastAutoChargeAt,
      paymentReference: userDebts.paymentReference,
      paidAt: userDebts.paidAt,
      createdAt: userDebts.createdAt,
      updatedAt: userDebts.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
    })
    .from(userDebts)
    .leftJoin(users, eq(userDebts.userId, users.id))
    .where(whereClause)
    .orderBy(desc(userDebts.createdAt))
    .limit(limit)
    .offset(offset);

  // Si there's a search filter, apply it in JS (name/email/phone)
  let filteredDebts = debts;
  if (filters?.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filteredDebts = debts.filter(d => 
      (d.userName && d.userName.toLowerCase().includes(searchLower)) ||
      (d.userEmail && d.userEmail.toLowerCase().includes(searchLower)) ||
      (d.userPhone && d.userPhone.includes(searchLower)) ||
      d.id.toString().includes(searchLower)
    );
  }

  return { debts: filteredDebts, total };
}

/**
 * Obtener estadísticas globales de deudas (para dashboard admin)
 */
export async function getDebtStats(): Promise<{
  totalPending: number;
  totalPaid: number;
  totalWaived: number;
  countPending: number;
  countPaid: number;
  countWaived: number;
  countPartial: number;
  totalAmount: number;
}> {
  const dbInstance = await getDb();
  if (!dbInstance) return {
    totalPending: 0, totalPaid: 0, totalWaived: 0,
    countPending: 0, countPaid: 0, countWaived: 0, countPartial: 0,
    totalAmount: 0,
  };

  const allDebts = await dbInstance.select().from(userDebts);

  let totalPending = 0, totalPaid = 0, totalWaived = 0;
  let countPending = 0, countPaid = 0, countWaived = 0, countPartial = 0;
  let totalAmount = 0;

  for (const d of allDebts) {
    const original = parseFloat(d.originalAmount?.toString() || "0");
    const remaining = parseFloat(d.remainingAmount?.toString() || "0");
    totalAmount += original;

    switch (d.status) {
      case "PENDING":
        totalPending += remaining;
        countPending++;
        break;
      case "PARTIAL":
        totalPending += remaining;
        countPartial++;
        break;
      case "PAID":
        totalPaid += original;
        countPaid++;
        break;
      case "WAIVED":
        totalWaived += original;
        countWaived++;
        break;
    }
  }

  return {
    totalPending: Math.round(totalPending),
    totalPaid: Math.round(totalPaid),
    totalWaived: Math.round(totalWaived),
    countPending: countPending + countPartial,
    countPaid,
    countWaived,
    countPartial,
    totalAmount: Math.round(totalAmount),
  };
}

/**
 * Cobro manual: marcar deuda como pagada por admin (sin descontar billetera)
 */
export async function adminManualPayDebt(debtId: number, paymentReference: string): Promise<void> {
  const dbInstance = await getDb();
  if (!dbInstance) return;

  const [debt] = await dbInstance.select().from(userDebts).where(eq(userDebts.id, debtId)).limit(1);
  if (!debt) throw new Error(`Debt #${debtId} not found`);

  await dbInstance.update(userDebts)
    .set({
      remainingAmount: "0.00",
      status: "PAID",
      paymentReference,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userDebts.id, debtId));

  console.log(`[Debt] Admin manual payment for debt #${debtId}: $${debt.originalAmount} COP (ref: ${paymentReference})`);
}


// ============================================================================
// CROWDFUNDING - FUNCIONES ADICIONALES
// ============================================================================

// Buscar usuarios por nombre o email (para vincular inversionistas)
export async function searchUsers(query: string, limit: number = 10): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const searchTerm = `%${query}%`;
    const results = await db.select().from(users)
      .where(
        or(
          like(users.name, searchTerm),
          like(users.email, searchTerm),
          like(users.phone, searchTerm),
          like(users.idTag, searchTerm),
        )
      )
      .orderBy(asc(users.name))
      .limit(limit);
    return results;
  } catch (error) {
    console.error('[DB] Error searching users:', error);
    return [];
  }
}

// Eliminar participación de crowdfunding
export async function deleteCrowdfundingParticipation(participationId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.execute(sql`
    DELETE FROM crowdfunding_participations WHERE id = ${participationId}
  `);
}

// Eliminar todas las participaciones de un proyecto de crowdfunding
export async function deleteCrowdfundingProjectParticipations(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.execute(sql`
    DELETE FROM crowdfunding_participations WHERE projectId = ${projectId}
  `);
}

// Eliminar un proyecto de crowdfunding
export async function deleteCrowdfundingProject(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.execute(sql`
    DELETE FROM crowdfunding_projects WHERE id = ${projectId}
  `);
}

// Actualizar participación de crowdfunding (campos extendidos: monto, estado, etc.)
export async function updateCrowdfundingParticipationFull(
  participationId: number,
  data: {
    amount?: number;
    participationPercent?: number;
    paymentStatus?: string;
    paymentDate?: Date | null;
    paymentReference?: string;
    investorId?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const setClauses: string[] = [];
  
  if (data.amount !== undefined) {
    setClauses.push(`amount = ${data.amount}`);
  }
  if (data.participationPercent !== undefined) {
    setClauses.push(`participationPercent = ${data.participationPercent}`);
  }
  if (data.paymentStatus !== undefined) {
    setClauses.push(`paymentStatus = '${data.paymentStatus.replace(/'/g, "''")}'`);
  }
  if (data.paymentDate !== undefined) {
    if (data.paymentDate === null) {
      setClauses.push(`paymentDate = NULL`);
    } else {
      setClauses.push(`paymentDate = '${data.paymentDate.toISOString().slice(0, 19).replace('T', ' ')}'`);
    }
  }
  if (data.paymentReference !== undefined) {
    setClauses.push(`paymentReference = '${data.paymentReference.replace(/'/g, "''")}'`);
  }
  if (data.investorId !== undefined) {
    setClauses.push(`investorId = ${data.investorId}`);
  }
  
  if (setClauses.length === 0) return;
  
  await db.execute(sql.raw(`
    UPDATE crowdfunding_participations 
    SET ${setClauses.join(', ')}
    WHERE id = ${participationId}
  `));
}


// ============================================================================
// FINANCIAL SYSTEM - Gastos Fijos, Liquidaciones, Distribución, Métricas SLA
// ============================================================================

// --- STATION FIXED EXPENSES (CRUD) ---

export async function createFixedExpense(data: InsertStationFixedExpense): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(stationFixedExpenses).values(data);
  return Number(result[0].insertId);
}

export async function getFixedExpensesByStation(stationId: number): Promise<StationFixedExpense[]> {
  const db = (await getDb())!;
  return db.select().from(stationFixedExpenses)
    .where(eq(stationFixedExpenses.stationId, stationId))
    .orderBy(asc(stationFixedExpenses.waterfallPriority));
}

export async function getActiveFixedExpensesByStation(stationId: number): Promise<StationFixedExpense[]> {
  const db = (await getDb())!;
  return db.select().from(stationFixedExpenses)
    .where(and(
      eq(stationFixedExpenses.stationId, stationId),
      eq(stationFixedExpenses.isActive, true),
    ))
    .orderBy(asc(stationFixedExpenses.waterfallPriority));
}

export async function updateFixedExpense(id: number, data: Partial<InsertStationFixedExpense>): Promise<void> {
  const db = (await getDb())!;
  await db.update(stationFixedExpenses).set(data).where(eq(stationFixedExpenses.id, id));
}

export async function deleteFixedExpense(id: number): Promise<void> {
  const db = (await getDb())!;
  await db.delete(stationFixedExpenses).where(eq(stationFixedExpenses.id, id));
}

export async function getFixedExpenseById(id: number): Promise<StationFixedExpense | undefined> {
  const db = (await getDb())!;
  const rows = await db.select().from(stationFixedExpenses).where(eq(stationFixedExpenses.id, id));
  return rows[0];
}

// --- FINANCIAL SETTLEMENTS ---

export async function createSettlement(data: InsertFinancialSettlement): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(financialSettlements).values(data);
  return Number(result[0].insertId);
}

export async function getSettlementById(id: number): Promise<FinancialSettlement | undefined> {
  const db = (await getDb())!;
  const rows = await db.select().from(financialSettlements).where(eq(financialSettlements.id, id));
  return rows[0];
}

export async function getSettlementsByStation(stationId: number, limit = 20): Promise<FinancialSettlement[]> {
  const db = (await getDb())!;
  return db.select().from(financialSettlements)
    .where(eq(financialSettlements.stationId, stationId))
    .orderBy(desc(financialSettlements.periodEnd))
    .limit(limit);
}

export async function updateSettlement(id: number, data: Partial<InsertFinancialSettlement>): Promise<void> {
  const db = (await getDb())!;
  await db.update(financialSettlements).set(data).where(eq(financialSettlements.id, id));
}

export async function getSettlementWithDetails(id: number) {
  const db = (await getDb())!;
  const settlement = await db.select().from(financialSettlements).where(eq(financialSettlements.id, id));
  if (!settlement[0]) return null;
  
  const expenses = await db.select().from(settlementExpenseItems)
    .where(eq(settlementExpenseItems.settlementId, id))
    .orderBy(asc(settlementExpenseItems.waterfallPriority));
  
  const shares = await db.select().from(investorSettlementShares)
    .where(eq(investorSettlementShares.settlementId, id));
  
  // Get investor names
  const sharesWithNames = await Promise.all(shares.map(async (share) => {
    const userRows = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, share.investorUserId));
    return {
      ...share,
      investorName: userRows[0]?.name || 'Desconocido',
      investorEmail: userRows[0]?.email || '',
    };
  }));
  
  return {
    ...settlement[0],
    expenseItems: expenses,
    investorShares: sharesWithNames,
  };
}

// --- SETTLEMENT EXPENSE ITEMS ---

export async function createSettlementExpenseItem(data: InsertSettlementExpenseItem): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(settlementExpenseItems).values(data);
  return Number(result[0].insertId);
}

export async function getSettlementExpenseItems(settlementId: number): Promise<SettlementExpenseItem[]> {
  const db = (await getDb())!;
  return db.select().from(settlementExpenseItems)
    .where(eq(settlementExpenseItems.settlementId, settlementId))
    .orderBy(asc(settlementExpenseItems.waterfallPriority));
}

// --- INVESTOR SETTLEMENT SHARES ---

export async function createInvestorShare(data: InsertInvestorSettlementShare): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(investorSettlementShares).values(data);
  return Number(result[0].insertId);
}

export async function getInvestorShares(settlementId: number): Promise<InvestorSettlementShare[]> {
  const db = (await getDb())!;
  return db.select().from(investorSettlementShares)
    .where(eq(investorSettlementShares.settlementId, settlementId));
}

export async function getInvestorSettlementHistory(investorUserId: number, limit = 20) {
  const db = (await getDb())!;
  const shares = await db.select().from(investorSettlementShares)
    .where(eq(investorSettlementShares.investorUserId, investorUserId))
    .orderBy(desc(investorSettlementShares.createdAt))
    .limit(limit);
  
  // Enrich with settlement data
  const enriched = await Promise.all(shares.map(async (share) => {
    const settlement = await db.select().from(financialSettlements)
      .where(eq(financialSettlements.id, share.settlementId));
    const station = settlement[0] ? await db.select({ name: chargingStations.name })
      .from(chargingStations).where(eq(chargingStations.id, settlement[0].stationId)) : [];
    return {
      ...share,
      settlement: settlement[0] || null,
      stationName: station[0]?.name || 'Desconocida',
    };
  }));
  
  return enriched;
}

export async function updateInvestorShare(id: number, data: Partial<InsertInvestorSettlementShare>): Promise<void> {
  const db = (await getDb())!;
  await db.update(investorSettlementShares).set(data).where(eq(investorSettlementShares.id, id));
}

// --- OPERATIONAL METRICS ---

export async function createOperationalMetric(data: InsertOperationalMetric): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(operationalMetrics).values(data);
  return Number(result[0].insertId);
}

export async function getOperationalMetricsByStation(stationId: number, limit = 12): Promise<OperationalMetric[]> {
  const db = (await getDb())!;
  return db.select().from(operationalMetrics)
    .where(eq(operationalMetrics.stationId, stationId))
    .orderBy(desc(operationalMetrics.periodEnd))
    .limit(limit);
}

export async function getLatestOperationalMetric(stationId: number): Promise<OperationalMetric | undefined> {
  const db = (await getDb())!;
  const rows = await db.select().from(operationalMetrics)
    .where(eq(operationalMetrics.stationId, stationId))
    .orderBy(desc(operationalMetrics.periodEnd))
    .limit(1);
  return rows[0];
}

export async function updateOperationalMetric(id: number, data: Partial<InsertOperationalMetric>): Promise<void> {
  const db = (await getDb())!;
  await db.update(operationalMetrics).set(data).where(eq(operationalMetrics.id, id));
}

// --- FINANCIAL AGGREGATION HELPERS ---

/**
 * Get revenue data for a station within a date range (from completed transactions)
 * Now includes breakdown by revenue source: energy, penalties (overstay), reservations
 */
export async function getStationRevenueForPeriod(stationId: number, startDate: Date, endDate: Date) {
  const db = (await getDb())!;
  const startStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
  const endStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

  // 1. Transaction revenue (energy sales + overstay penalties)
  const txResults = await db.execute(sql.raw(`
    SELECT 
      COUNT(*) as totalSessions,
      COALESCE(SUM(CAST(totalCost AS DECIMAL(14,2))), 0) as grossRevenue,
      COALESCE(SUM(CAST(kwhConsumed AS DECIMAL(12,4))), 0) as totalKwh,
      COALESCE(AVG(CAST(appliedPricePerKwh AS DECIMAL(10,2))), 0) as avgPricePerKwh,
      COALESCE(SUM(CAST(energyCost AS DECIMAL(14,2))), 0) as energyRevenue,
      COALESCE(SUM(CAST(overstayCost AS DECIMAL(14,2))), 0) as overstayRevenue,
      COALESCE(SUM(CAST(sessionCost AS DECIMAL(14,2))), 0) as sessionRevenue,
      COALESCE(SUM(CAST(timeCost AS DECIMAL(14,2))), 0) as timeRevenue
    FROM transactions 
    WHERE stationId = ${stationId}
      AND transaction_status = 'COMPLETED'
      AND startTime >= '${startStr}'
      AND startTime < '${endStr}'
  `));
  const txRow = (txResults as any)[0]?.[0] || {};

  // 2. Reservation fees (from reservations that were used or no-show penalized)
  const resResults = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(CAST(reservationFee AS DECIMAL(14,2))), 0) as reservationFeeTotal,
      COALESCE(SUM(CASE WHEN isPenaltyApplied = 1 THEN CAST(noShowPenalty AS DECIMAL(14,2)) ELSE 0 END), 0) as noShowPenaltyTotal
    FROM reservations 
    WHERE stationId = ${stationId}
      AND startTime >= '${startStr}'
      AND startTime < '${endStr}'
  `));
  const resRow = (resResults as any)[0]?.[0] || {};

  // 3. Advertising revenue (from banner views in this period)
  const adResults = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(CAST(b.pricePerView AS DECIMAL(14,2)) * bv.viewCount), 0) as adRevenue
    FROM banner_views bv
    JOIN banners b ON b.id = bv.bannerId
    WHERE bv.stationId = ${stationId}
      AND bv.viewDate >= '${startStr}'
      AND bv.viewDate < '${endStr}'
  `)).catch(() => [[{ adRevenue: 0 }]]);
  const adRow = (adResults as any)[0]?.[0] || {};

  const revenueFromEnergy = Number(txRow.energyRevenue || 0) + Number(txRow.sessionRevenue || 0) + Number(txRow.timeRevenue || 0);
  const revenueFromPenalties = Number(txRow.overstayRevenue || 0) + Number(resRow.noShowPenaltyTotal || 0);
  const revenueFromReservations = Number(resRow.reservationFeeTotal || 0);
  const revenueFromAdvertising = Number(adRow.adRevenue || 0);
  const grossRevenue = revenueFromEnergy + revenueFromPenalties + revenueFromReservations + revenueFromAdvertising;

  return {
    totalSessions: Number(txRow.totalSessions || 0),
    grossRevenue,
    totalKwh: Number(txRow.totalKwh || 0),
    avgPricePerKwh: Number(txRow.avgPricePerKwh || 0),
    // Revenue breakdown by source
    revenueFromEnergy,
    revenueFromPenalties,
    revenueFromReservations,
    revenueFromAdvertising,
  };
}

/**
 * Calculate prorated amount for a fixed expense based on the settlement period
 */
export function prorateExpense(expense: StationFixedExpense, periodStartDate: Date, periodEndDate: Date): number {
  const periodDays = Math.ceil((periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const amount = Number(expense.amountCop);
  
  // Check if expense is active during this period
  const expStart = expense.startDate ? new Date(expense.startDate) : new Date(0);
  const expEnd = expense.endDate ? new Date(expense.endDate) : new Date('2099-12-31');
  
  if (expStart > periodEndDate || expEnd < periodStartDate) return 0;
  
  switch (expense.periodicity) {
    case 'MONTHLY': return amount; // Already monthly
    case 'BIMONTHLY': return amount / 2; // Half per month
    case 'QUARTERLY': return amount / 3;
    case 'SEMIANNUAL': return amount / 6;
    case 'ANNUAL': return amount / 12;
    case 'ONE_TIME': return amount; // Full amount in the period it falls
    default: return amount;
  }
}

/**
 * Get investors and their participation % for a station (from crowdfunding)
 */
export async function getStationInvestors(stationId: number) {
  const db = (await getDb())!;
  // Get the crowdfunding project for this station
  const projects = await db.execute(sql.raw(`
    SELECT id, targetAmount as goalAmount FROM crowdfunding_projects 
    WHERE stationId = ${stationId} AND status IN ('OPEN', 'IN_PROGRESS', 'FUNDED', 'COMPLETED')
    ORDER BY id DESC LIMIT 1
  `));
  const project = (projects as any)[0]?.[0];
  if (!project) return [];
  
  // Get confirmed participations
  const participations = await db.execute(sql.raw(`
    SELECT cp.investorId, cp.amount, u.name, u.email,
      (cp.amount / ${Number(project.goalAmount)}) * 100 as participationPercent
    FROM crowdfunding_participations cp
    JOIN users u ON u.id = cp.investorId
    WHERE cp.projectId = ${project.id}
      AND cp.paymentStatus = 'COMPLETED'
    ORDER BY cp.amount DESC
  `));
  
  return ((participations as any)[0] || []).map((row: any) => ({
    investorId: Number(row.investorId),
    name: row.name || 'Inversionista',
    email: row.email || '',
    amount: Number(row.amount),
    participationPercent: Number(row.participationPercent),
  }));
}

/**
 * Get all settlements for an investor across all stations
 */
export async function getInvestorAllSettlements(investorUserId: number, limit = 50) {
  const db = (await getDb())!;
  const shares = await db.select().from(investorSettlementShares)
    .where(eq(investorSettlementShares.investorUserId, investorUserId))
    .orderBy(desc(investorSettlementShares.createdAt))
    .limit(limit);
  
  if (shares.length === 0) return [];
  
  const enriched = await Promise.all(shares.map(async (share) => {
    const settlement = await db.select().from(financialSettlements)
      .where(eq(financialSettlements.id, share.settlementId));
    if (!settlement[0]) return null;
    
    const station = await db.select({ name: chargingStations.name })
      .from(chargingStations).where(eq(chargingStations.id, settlement[0].stationId));
    
    return {
      ...share,
      periodStart: settlement[0].periodStart,
      periodEnd: settlement[0].periodEnd,
      periodType: settlement[0].periodType,
      grossRevenue: settlement[0].grossRevenue,
      totalFixedExpenses: settlement[0].totalFixedExpenses,
      netRevenue: settlement[0].netRevenue,
      settlementStatus: settlement[0].status,
      stationId: settlement[0].stationId,
      stationName: station[0]?.name || 'Desconocida',
    };
  }));
  
  return enriched.filter(Boolean);
}

/**
 * Get financial summary for an investor (totals across all settlements)
 */
export async function getInvestorFinancialSummary(investorUserId: number) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT 
      COUNT(*) as totalSettlements,
      COALESCE(SUM(grossShare), 0) as totalGrossEarnings,
      COALESCE(SUM(netShare), 0) as totalNetEarnings,
      COALESCE(SUM(expenseShare), 0) as totalExpenseShare
    FROM investor_settlement_shares
    WHERE investorUserId = ${investorUserId}
      AND investor_share_status IN ('CREDITED', 'PAID')
  `));
  const row = (results as any)[0]?.[0] || {};
  
  // Get total invested amount
  const invested = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(amount), 0) as totalInvested
    FROM crowdfunding_participations
    WHERE investorId = ${investorUserId}
      AND paymentStatus = 'COMPLETED'
  `));
  const investedRow = (invested as any)[0]?.[0] || {};
  
  return {
    totalSettlements: Number(row.totalSettlements || 0),
    totalGrossEarnings: Number(row.totalGrossEarnings || 0),
    totalNetEarnings: Number(row.totalNetEarnings || 0),
    totalExpenseShare: Number(row.totalExpenseShare || 0),
    totalInvested: Number(investedRow.totalInvested || 0),
    roi: Number(investedRow.totalInvested) > 0 
      ? (Number(row.totalNetEarnings || 0) / Number(investedRow.totalInvested)) * 100 
      : 0,
  };
}


// --- HOST (ALIADO COMERCIAL) FINANCIAL HELPERS ---

/**
 * Get all stations where a user is the host (Aliado Comercial)
 */
export async function getHostStations(hostUserId: number) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT id, name, city, address, hostSharePercent, energyPurchaseCostPerKwh,
      evgreenSharePercent, investorSharePercent, isOnline
    FROM charging_stations
    WHERE hostUserId = ${hostUserId} AND isActive = 1
    ORDER BY name
  `));
  return ((results as any)[0] || []).map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    city: r.city,
    address: r.address,
    hostSharePercent: Number(r.hostSharePercent || 0),
    energyPurchaseCostPerKwh: Number(r.energyPurchaseCostPerKwh || 850),
    evgreenSharePercent: Number(r.evgreenSharePercent || 30),
    investorSharePercent: Number(r.investorSharePercent || 70),
    isOnline: Boolean(r.isOnline),
  }));
}

/**
 * Get financial summary for a host across all their stations
 */
export async function getHostFinancialSummary(hostUserId: number) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT 
      COUNT(DISTINCT fs.id) as totalSettlements,
      COALESCE(SUM(fs.hostTotalAmount), 0) as totalHostEarnings,
      COALESCE(SUM(fs.grossRevenue), 0) as totalGrossRevenue,
      COALESCE(SUM(fs.totalEnergyCost), 0) as totalEnergyCost,
      COALESCE(SUM(fs.revenueFromEnergy), 0) as totalRevenueFromEnergy,
      COALESCE(SUM(fs.revenueFromPenalties), 0) as totalRevenueFromPenalties,
      COALESCE(SUM(fs.revenueFromReservations), 0) as totalRevenueFromReservations,
      COALESCE(SUM(fs.revenueFromAdvertising), 0) as totalRevenueFromAdvertising,
      COUNT(DISTINCT cs.id) as stationCount
    FROM financial_settlements fs
    JOIN charging_stations cs ON cs.id = fs.stationId
    WHERE cs.hostUserId = ${hostUserId}
      AND fs.status IN ('APPROVED', 'DISTRIBUTED')
  `));
  const row = (results as any)[0]?.[0] || {};
  return {
    totalSettlements: Number(row.totalSettlements || 0),
    totalHostEarnings: Number(row.totalHostEarnings || 0),
    totalGrossRevenue: Number(row.totalGrossRevenue || 0),
    totalEnergyCost: Number(row.totalEnergyCost || 0),
    totalRevenueFromEnergy: Number(row.totalRevenueFromEnergy || 0),
    totalRevenueFromPenalties: Number(row.totalRevenueFromPenalties || 0),
    totalRevenueFromReservations: Number(row.totalRevenueFromReservations || 0),
    totalRevenueFromAdvertising: Number(row.totalRevenueFromAdvertising || 0),
    stationCount: Number(row.stationCount || 0),
  };
}

/**
 * Get settlement history for a host (Aliado Comercial)
 */
export async function getHostSettlementHistory(hostUserId: number, limit = 50) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT fs.*, cs.name as stationName, cs.city as stationCity,
      cs.hostSharePercent as configuredHostPercent
    FROM financial_settlements fs
    JOIN charging_stations cs ON cs.id = fs.stationId
    WHERE cs.hostUserId = ${hostUserId}
    ORDER BY fs.periodEnd DESC
    LIMIT ${limit}
  `));
  return ((results as any)[0] || []).map((r: any) => ({
    id: Number(r.id),
    stationId: Number(r.stationId),
    stationName: r.stationName || 'Estación',
    stationCity: r.stationCity || '',
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    periodType: r.periodType,
    grossRevenue: Number(r.grossRevenue || 0),
    totalEnergyCost: Number(r.totalEnergyCost || 0),
    revenueFromEnergy: Number(r.revenueFromEnergy || 0),
    revenueFromPenalties: Number(r.revenueFromPenalties || 0),
    revenueFromReservations: Number(r.revenueFromReservations || 0),
    revenueFromAdvertising: Number(r.revenueFromAdvertising || 0),
    hostSharePercent: Number(r.hostSharePercent || 0),
    hostTotalAmount: Number(r.hostTotalAmount || 0),
    investorTotalAmount: Number(r.investorTotalAmount || 0),
    platformTotalAmount: Number(r.platformTotalAmount || 0),
    status: r.status,
  }));
}


// --- MAINTENANCE FUND HELPERS ---

/**
 * Get current balance of the maintenance fund for a station
 */
export async function getMaintenanceFundBalance(stationId: number): Promise<number> {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT balanceAfter FROM maintenance_fund_records
    WHERE stationId = ${stationId}
    ORDER BY id DESC LIMIT 1
  `));
  const row = (results as any)[0]?.[0];
  return row ? Number(row.balanceAfter) : 0;
}

/**
 * Create a maintenance fund record (deposit or withdrawal)
 */
export async function createMaintenanceFundRecord(data: {
  stationId: number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  maintenanceType?: string;
  maintenanceDetail?: string;
  technicianName?: string;
  invoiceNumber?: string;
  settlementId?: number;
  balanceAfter: number;
  createdBy?: number;
}): Promise<number> {
  const db = (await getDb())!;
  const result = await db.insert(maintenanceFundRecords).values({
    stationId: data.stationId,
    type: data.type,
    amount: data.amount,
    description: data.description,
    maintenanceType: data.maintenanceType || null,
    maintenanceDetail: data.maintenanceDetail || null,
    technicianName: data.technicianName || null,
    invoiceNumber: data.invoiceNumber || null,
    settlementId: data.settlementId || null,
    balanceAfter: data.balanceAfter,
    createdBy: data.createdBy || null,
  });
  return Number(result[0].insertId);
}

/**
 * Get maintenance fund records for a station (history)
 */
export async function getMaintenanceFundRecords(stationId: number, limit = 50) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT mfr.*, u.name as creatorName
    FROM maintenance_fund_records mfr
    LEFT JOIN users u ON u.id = mfr.createdBy
    WHERE mfr.stationId = ${stationId}
    ORDER BY mfr.id DESC
    LIMIT ${limit}
  `));
  return ((results as any)[0] || []).map((r: any) => ({
    id: Number(r.id),
    stationId: Number(r.stationId),
    type: r.maintenance_fund_type,
    amount: Number(r.amount),
    description: r.description,
    maintenanceType: r.maintenanceType,
    maintenanceDetail: r.maintenanceDetail,
    technicianName: r.technicianName,
    invoiceNumber: r.invoiceNumber,
    settlementId: r.settlementId ? Number(r.settlementId) : null,
    balanceAfter: Number(r.balanceAfter),
    creatorName: r.creatorName || 'Sistema',
    createdAt: r.createdAt,
  }));
}

/**
 * Get maintenance fund summary for a station
 */
export async function getMaintenanceFundSummary(stationId: number) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(CASE WHEN maintenance_fund_type = 'deposit' THEN amount ELSE 0 END), 0) as totalDeposits,
      COALESCE(SUM(CASE WHEN maintenance_fund_type = 'withdrawal' THEN amount ELSE 0 END), 0) as totalWithdrawals,
      COUNT(CASE WHEN maintenance_fund_type = 'deposit' THEN 1 END) as depositCount,
      COUNT(CASE WHEN maintenance_fund_type = 'withdrawal' THEN 1 END) as withdrawalCount
    FROM maintenance_fund_records
    WHERE stationId = ${stationId}
  `));
  const row = (results as any)[0]?.[0] || {};
  const totalDeposits = Number(row.totalDeposits || 0);
  const totalWithdrawals = Number(row.totalWithdrawals || 0);
  return {
    totalDeposits,
    totalWithdrawals,
    currentBalance: totalDeposits - totalWithdrawals,
    depositCount: Number(row.depositCount || 0),
    withdrawalCount: Number(row.withdrawalCount || 0),
  };
}


/**
 * Get monthly trend data for a station's maintenance fund
 * Returns deposits and withdrawals grouped by month for the last N months
 */
export async function getMaintenanceFundMonthlyTrend(stationId: number, months = 12) {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m') as month,
      COALESCE(SUM(CASE WHEN maintenance_fund_type = 'deposit' THEN amount ELSE 0 END), 0) as deposits,
      COALESCE(SUM(CASE WHEN maintenance_fund_type = 'withdrawal' THEN amount ELSE 0 END), 0) as withdrawals,
      COUNT(CASE WHEN maintenance_fund_type = 'deposit' THEN 1 END) as depositCount,
      COUNT(CASE WHEN maintenance_fund_type = 'withdrawal' THEN 1 END) as withdrawalCount
    FROM maintenance_fund_records
    WHERE stationId = ${stationId}
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `));
  return ((results as any)[0] || []).map((r: any) => ({
    month: r.month,
    deposits: Number(r.deposits || 0),
    withdrawals: Number(r.withdrawals || 0),
    depositCount: Number(r.depositCount || 0),
    withdrawalCount: Number(r.withdrawalCount || 0),
    net: Number(r.deposits || 0) - Number(r.withdrawals || 0),
  }));
}

/**
 * Update the maintenance fund alert threshold for a station (in COP)
 */
export async function updateMaintenanceFundAlertThreshold(stationId: number, thresholdCOP: number): Promise<void> {
  const db = (await getDb())!;
  await db.execute(sql.raw(`
    UPDATE charging_stations 
    SET maintenanceFundAlertThreshold = ${thresholdCOP}
    WHERE id = ${stationId}
  `));
}

/**
 * Get consolidated maintenance fund summary across all collective stations
 */
export async function getConsolidatedMaintenanceFundSummary() {
  const db = (await getDb())!;
  const results = await db.execute(sql.raw(`
    SELECT 
      mfr.stationId,
      cs.name as stationName,
      cs.city as stationCity,
      cs.maintenanceFundAlertThreshold as alertThreshold,
      COALESCE(SUM(CASE WHEN mfr.maintenance_fund_type = 'deposit' THEN mfr.amount ELSE 0 END), 0) as totalDeposits,
      COALESCE(SUM(CASE WHEN mfr.maintenance_fund_type = 'withdrawal' THEN mfr.amount ELSE 0 END), 0) as totalWithdrawals,
      COUNT(CASE WHEN mfr.maintenance_fund_type = 'deposit' THEN 1 END) as depositCount,
      COUNT(CASE WHEN mfr.maintenance_fund_type = 'withdrawal' THEN 1 END) as withdrawalCount,
      MAX(mfr.createdAt) as lastMovement
    FROM maintenance_fund_records mfr
    JOIN charging_stations cs ON cs.id = mfr.stationId
    GROUP BY mfr.stationId, cs.name, cs.city, cs.maintenanceFundAlertThreshold
    ORDER BY cs.name ASC
  `));
  return ((results as any)[0] || []).map((r: any) => {
    const totalDeposits = Number(r.totalDeposits || 0);
    const totalWithdrawals = Number(r.totalWithdrawals || 0);
    const currentBalance = totalDeposits - totalWithdrawals;
    const alertThreshold = r.alertThreshold ? Number(r.alertThreshold) : 500000;
    return {
      stationId: Number(r.stationId),
      stationName: r.stationName,
      stationCity: r.stationCity || '',
      totalDeposits,
      totalWithdrawals,
      currentBalance,
      depositCount: Number(r.depositCount || 0),
      withdrawalCount: Number(r.withdrawalCount || 0),
      alertThreshold,
      isLowBalance: currentBalance < alertThreshold,
      lastMovement: r.lastMovement,
    };
  });
}


// ============================================================================
// ENRICHED INVESTOR TRANSACTIONS (with waterfall breakdown per station)
// ============================================================================

export interface InvestorStationInfo {
  stationId: number;
  stationName: string;
  isCollective: boolean;
  investorParticipationPercent: number; // 100% for own stations, proportional for collective
  investorSharePercent: number; // e.g. 70% - investor share of net after host
  evgreenSharePercent: number; // e.g. 30% - evgreen share of net after host
  hostSharePercent: number; // e.g. 10% - host share of gross margin
  energyCostPerKwh: number; // energy purchase cost
}

/**
 * Get station info map for an investor, including participation percentages
 * For own stations: participationPercent = 100%
 * For collective stations: participationPercent = their crowdfunding participation %
 */
export async function getInvestorStationInfoMap(investorId: number): Promise<Map<number, InvestorStationInfo>> {
  const db = await getDb();
  if (!db) return new Map();
  
  const stationMap = new Map<number, InvestorStationInfo>();
  
  // 1. Own stations (100% participation)
  const ownedStations = await db.execute(sql`
    SELECT id, name, investorSharePercent, evgreenSharePercent, hostSharePercent, energyPurchaseCostPerKwh
    FROM charging_stations
    WHERE ownerId = ${investorId} AND isActive = 1
  `);
  
  for (const s of ((ownedStations as any)[0] || []) as any[]) {
    stationMap.set(Number(s.id), {
      stationId: Number(s.id),
      stationName: s.name || `Estación ${s.id}`,
      isCollective: false,
      investorParticipationPercent: 100,
      investorSharePercent: Number(s.investorSharePercent || 70),
      evgreenSharePercent: Number(s.evgreenSharePercent || 30),
      hostSharePercent: Number(s.hostSharePercent || 0),
      energyCostPerKwh: Number(s.energyPurchaseCostPerKwh || 850),
    });
  }
  
  // 2. Collective stations via crowdfunding
  const collectiveStations = await db.execute(sql`
    SELECT 
      cs.id, cs.name, cs.investorSharePercent, cs.evgreenSharePercent, cs.hostSharePercent, cs.energyPurchaseCostPerKwh,
      cp.participationPercent
    FROM crowdfunding_participations cp
    JOIN crowdfunding_projects cfp ON cp.projectId = cfp.id
    JOIN charging_stations cs ON cfp.stationId = cs.id
    WHERE cp.investorId = ${investorId}
      AND cp.paymentStatus = 'COMPLETED'
      AND cfp.stationId IS NOT NULL
      AND cs.isActive = 1
  `);
  
  for (const s of ((collectiveStations as any)[0] || []) as any[]) {
    const stationId = Number(s.id);
    // Don't overwrite if already added as owned station
    if (!stationMap.has(stationId)) {
      stationMap.set(stationId, {
        stationId,
        stationName: s.name || `Estación ${stationId}`,
        isCollective: true,
        investorParticipationPercent: Number(s.participationPercent || 0),
        investorSharePercent: Number(s.investorSharePercent || 70),
        evgreenSharePercent: Number(s.evgreenSharePercent || 30),
        hostSharePercent: Number(s.hostSharePercent || 0),
        energyCostPerKwh: Number(s.energyPurchaseCostPerKwh || 850),
      });
    }
  }
  
  return stationMap;
}

/**
 * Get enriched transactions for an investor with waterfall breakdown
 */
export async function getEnrichedTransactionsByInvestor(
  investorId: number,
  filters?: { startDate?: Date; endDate?: Date; status?: string; stationId?: number; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, stations: [] as InvestorStationInfo[] };
  
  const stationMap = await getInvestorStationInfoMap(investorId);
  const stationIds = Array.from(stationMap.keys());
  
  if (stationIds.length === 0) return { data: [], total: 0, stations: [] as InvestorStationInfo[] };
  
  // Filter by specific station if requested
  const targetIds = filters?.stationId ? [filters.stationId].filter(id => stationIds.includes(id)) : stationIds;
  if (targetIds.length === 0) return { data: [], total: 0, stations: Array.from(stationMap.values()) };
  
  const conditions: any[] = [inArray(transactions.stationId, targetIds)];
  if (filters?.startDate) conditions.push(gte(transactions.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.startTime, filters.endDate));
  if (filters?.status) conditions.push(eq(transactions.status, filters.status as any));
  
  const whereClause = and(...conditions);
  
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(transactions).where(whereClause);
  const total = Number(countResult[0]?.count || 0);
  
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;
  
  const rawData = await db.select().from(transactions).where(whereClause).orderBy(desc(transactions.startTime)).limit(limit).offset(offset);
  
  // Enrich each transaction with waterfall breakdown
  const enrichedData = rawData.map(tx => {
    const stationInfo = stationMap.get(tx.stationId);
    if (!stationInfo) return { ...tx, waterfall: null, stationInfo: null };
    
    const totalCost = Number(tx.totalCost || 0);
    const kwhConsumed = Number(tx.kwhConsumed || 0);
    
    // Revenue source breakdown from transaction fields
    const txEnergyCostField = Number(tx.energyCost || 0); // energy sale revenue (what user paid for energy)
    const txTimeCost = Number(tx.timeCost || 0);
    const txSessionCost = Number(tx.sessionCost || 0);
    const txOverstayCost = Number(tx.overstayCost || 0);
    const revenueFromEnergy = txEnergyCostField + txTimeCost + txSessionCost;
    const revenueFromPenalties = txOverstayCost;
    
    // Waterfall calculation (matching the corrected financial model)
    const grossRevenue = totalCost;
    const energyCostPurchase = kwhConsumed * stationInfo.energyCostPerKwh;
    const grossMargin = Math.max(0, grossRevenue - energyCostPurchase);
    
    // Host gets their % from gross margin FIRST
    const hostAmount = grossMargin * (stationInfo.hostSharePercent / 100);
    
    // Net after host
    const netAfterHost = grossMargin - hostAmount;
    
    // Modelo correcto: (PV - CE) × 90% aliado × 70% tu parte
    // Para colectivas: el 70% ya incluye costos operativos (economías de escala)
    // Para propias: se usa el investorSharePercent de la BD
    const effectiveInvestorPct = stationInfo.isCollective ? 70 : stationInfo.investorSharePercent;
    const effectiveEvgreenPct = stationInfo.isCollective ? 30 : stationInfo.evgreenSharePercent;
    const totalInvestorPool = netAfterHost * (effectiveInvestorPct / 100);
    const evgreenAmount = netAfterHost * (effectiveEvgreenPct / 100);
    
    // For collective stations, investor gets their proportional share of the investor pool
    const myShare = totalInvestorPool * (stationInfo.investorParticipationPercent / 100);
    
    return {
      ...tx,
      stationName: stationInfo.stationName,
      stationInfo: {
        stationId: stationInfo.stationId,
        stationName: stationInfo.stationName,
        isCollective: stationInfo.isCollective,
        investorParticipationPercent: stationInfo.investorParticipationPercent,
        investorSharePercent: stationInfo.investorSharePercent,
        evgreenSharePercent: stationInfo.evgreenSharePercent,
        hostSharePercent: stationInfo.hostSharePercent,
        energyCostPerKwh: stationInfo.energyCostPerKwh,
      },
      waterfall: {
        grossRevenue,
        energyCost: energyCostPurchase,
        grossMargin,
        hostPercent: stationInfo.hostSharePercent,
        hostAmount,
        netAfterHost,
        investorPoolPercent: effectiveInvestorPct,
        totalInvestorPool,
        evgreenPercent: effectiveEvgreenPct,
        evgreenAmount,
        participationPercent: stationInfo.investorParticipationPercent,
        myShare,
        isCollective: stationInfo.isCollective,
        // Revenue source breakdown
        revenueFromEnergy,
        revenueFromPenalties,
      },
    };
  });
  
  return {
    data: enrichedData,
    total,
    stations: Array.from(stationMap.values()),
  };
}


// ============================================================================
// REFUNDS (Historial de reembolsos para auditoría)
// ============================================================================

export async function createRefund(data: InsertRefund): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(refunds).values(data);
  return Number(result[0].insertId);
}

export async function getRefunds(opts: { limit?: number; offset?: number; adminId?: number; userId?: number; transactionId?: number }): Promise<{ data: Refund[]; total: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { eq, and, desc, sql, count } = await import("drizzle-orm");
  
  const conditions: any[] = [];
  if (opts.adminId) conditions.push(eq(refunds.adminId, opts.adminId));
  if (opts.userId) conditions.push(eq(refunds.userId, opts.userId));
  if (opts.transactionId) conditions.push(eq(refunds.transactionId, opts.transactionId));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [data, totalResult] = await Promise.all([
    db.select().from(refunds).where(where).orderBy(desc(refunds.createdAt)).limit(opts.limit || 50).offset(opts.offset || 0),
    db.select({ count: count() }).from(refunds).where(where),
  ]);
  
  return { data, total: totalResult[0]?.count || 0 };
}

export async function getRefundById(id: number): Promise<Refund | null> {
  const db = await getDb();
  if (!db) return null;
  const { eq } = await import("drizzle-orm");
  const result = await db.select().from(refunds).where(eq(refunds.id, id));
  return result[0] || null;
}

// ============================================================================
// CLAIMS (Reclamos de cobro incorrecto)
// ============================================================================

export async function createClaim(data: InsertClaim): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(claims).values(data);
  return Number(result[0].insertId);
}

export async function getClaims(opts: { limit?: number; offset?: number; status?: string; userId?: number }): Promise<{ data: Claim[]; total: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { eq, and, desc, count } = await import("drizzle-orm");
  
  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(claims.status, opts.status));
  if (opts.userId) conditions.push(eq(claims.userId, opts.userId));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [data, totalResult] = await Promise.all([
    db.select().from(claims).where(where).orderBy(desc(claims.createdAt)).limit(opts.limit || 50).offset(opts.offset || 0),
    db.select({ count: count() }).from(claims).where(where),
  ]);
  
  return { data, total: totalResult[0]?.count || 0 };
}

export async function getClaimById(id: number): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  const { eq } = await import("drizzle-orm");
  const result = await db.select().from(claims).where(eq(claims.id, id));
  return result[0] || null;
}

export async function updateClaim(id: number, data: Partial<InsertClaim>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { eq } = await import("drizzle-orm");
  await db.update(claims).set(data).where(eq(claims.id, id));
}

export async function getClaimsByTransactionId(transactionId: number): Promise<Claim[]> {
  const db = await getDb();
  if (!db) return [];
  const { eq, desc } = await import("drizzle-orm");
  return db.select().from(claims).where(eq(claims.transactionId, transactionId)).orderBy(desc(claims.createdAt));
}



// ============================================================
// PENDING CHARGE SESSIONS - Persistencia en BD
// ============================================================
import { pendingChargeSessions } from "../drizzle/schema";

export async function savePendingChargeSession(data: {
  sessionId: string;
  userId: number;
  stationId: number;
  connectorId: number;
  ocppIdentity: string;
  chargeMode: string;
  targetValue: number;
  estimatedCost: number;
  pricePerKwh: number;
}) {
  const db = await getDb();
  if (!db) return;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
  await db.insert(pendingChargeSessions).values({
    sessionId: data.sessionId,
    userId: data.userId,
    stationId: data.stationId,
    connectorId: data.connectorId,
    ocppIdentity: data.ocppIdentity,
    chargeMode: data.chargeMode,
    targetValue: String(data.targetValue),
    estimatedCost: String(data.estimatedCost),
    pricePerKwh: String(data.pricePerKwh),
    expiresAt,
  });
}

export async function findPendingChargeSessionByOcppIdentity(ocppIdentity: string, connectorId?: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  let conditions = [
    eq(pendingChargeSessions.ocppIdentity, ocppIdentity),
    eq(pendingChargeSessions.consumed, false),
    gt(pendingChargeSessions.expiresAt, now),
  ];
  if (connectorId !== undefined) {
    conditions.push(eq(pendingChargeSessions.connectorId, connectorId));
  }
  const results = await db
    .select()
    .from(pendingChargeSessions)
    .where(and(...conditions))
    .orderBy(desc(pendingChargeSessions.createdAt))
    .limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function consumePendingChargeSession(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pendingChargeSessions)
    .set({ consumed: true })
    .where(eq(pendingChargeSessions.sessionId, sessionId));
}

export async function cleanExpiredPendingSessions() {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db
    .delete(pendingChargeSessions)
    .where(and(
      lt(pendingChargeSessions.expiresAt, now),
      eq(pendingChargeSessions.consumed, false)
    ));
}


// ============================================================================
// LOCAL AUTHORIZATION LIST - Funciones para gestión de listas locales RFID
// ============================================================================

/**
 * Obtener o crear la lista local de autorización de una estación
 */
export async function getOrCreateLocalAuthList(stationId: number): Promise<LocalAuthList> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const existing = await database.select().from(localAuthLists)
    .where(eq(localAuthLists.stationId, stationId)).limit(1);
  
  if (existing.length > 0) return existing[0];
  
  // Crear nueva lista
  const result = await database.insert(localAuthLists).values({
    stationId,
    listVersion: 0,
    status: "PENDING",
    entryCount: 0,
  });
  
  const newList = await database.select().from(localAuthLists)
    .where(eq(localAuthLists.id, Number(result[0].insertId))).limit(1);
  return newList[0];
}

/**
 * Obtener la lista local de una estación con sus entradas
 */
export async function getLocalAuthListWithEntries(stationId: number): Promise<{
  list: LocalAuthList;
  entries: LocalAuthEntry[];
}> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const list = await getOrCreateLocalAuthList(stationId);
  const entries = await database.select().from(localAuthEntries)
    .where(eq(localAuthEntries.listId, list.id));
  
  return { list, entries };
}

/**
 * Agregar una entrada a la lista local de una estación
 */
export async function addLocalAuthEntry(data: {
  stationId: number;
  idTag: string;
  isMasterCard?: boolean;
  label?: string;
  expiryDate?: Date;
  addedBy?: number;
}): Promise<LocalAuthEntry> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const list = await getOrCreateLocalAuthList(data.stationId);
  
  // Verificar si ya existe
  const existing = await database.select().from(localAuthEntries)
    .where(and(
      eq(localAuthEntries.listId, list.id),
      eq(localAuthEntries.idTag, data.idTag)
    )).limit(1);
  
  if (existing.length > 0) {
    throw new Error(`El idTag "${data.idTag}" ya existe en la lista local de esta estación`);
  }
  
  // Buscar referencia en tabla id_tags
  const idTagRef = await getIdTag(data.idTag);
  
  const result = await database.insert(localAuthEntries).values({
    listId: list.id,
    stationId: data.stationId,
    idTag: data.idTag,
    idTagRefId: idTagRef?.id || null,
    isMasterCard: data.isMasterCard || false,
    label: data.label || null,
    expiryDate: data.expiryDate || null,
    addedBy: data.addedBy || null,
    authStatus: "Accepted",
  });
  
  // Actualizar conteo y marcar como desactualizada
  await database.update(localAuthLists).set({
    entryCount: list.entryCount + 1,
    listVersion: list.listVersion + 1,
    status: "OUTDATED",
  }).where(eq(localAuthLists.id, list.id));
  
  const newEntry = await database.select().from(localAuthEntries)
    .where(eq(localAuthEntries.id, Number(result[0].insertId))).limit(1);
  return newEntry[0];
}

/**
 * Eliminar una entrada de la lista local
 */
export async function removeLocalAuthEntry(entryId: number, stationId: number): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const entry = await database.select().from(localAuthEntries)
    .where(and(
      eq(localAuthEntries.id, entryId),
      eq(localAuthEntries.stationId, stationId)
    )).limit(1);
  
  if (entry.length === 0) throw new Error("Entrada no encontrada");
  
  await database.delete(localAuthEntries).where(eq(localAuthEntries.id, entryId));
  
  // Actualizar conteo y marcar como desactualizada
  const list = await getOrCreateLocalAuthList(stationId);
  await database.update(localAuthLists).set({
    entryCount: Math.max(0, list.entryCount - 1),
    listVersion: list.listVersion + 1,
    status: "OUTDATED",
  }).where(eq(localAuthLists.id, list.id));
}

/**
 * Marcar la lista como sincronizada después de un SendLocalList exitoso
 */
export async function markLocalAuthListSynced(stationId: number, result: string): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  const list = await getOrCreateLocalAuthList(stationId);
  await database.update(localAuthLists).set({
    status: result === "Accepted" ? "SYNCED" : "FAILED",
    lastSyncAt: new Date(),
    lastSyncResult: result,
    chargerListVersion: result === "Accepted" ? list.listVersion : list.chargerListVersion,
  }).where(eq(localAuthLists.id, list.id));
}

/**
 * Obtener todas las estaciones con su estado de lista local (para admin)
 */
export async function getAllLocalAuthListsStatus(): Promise<LocalAuthList[]> {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(localAuthLists);
}

/**
 * Registrar una transacción offline para reconciliación posterior
 */
export async function createOfflineTransaction(data: InsertOfflineTransaction): Promise<number> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const result = await database.insert(offlineTransactions).values(data);
  return Number(result[0].insertId);
}

/**
 * Obtener transacciones offline pendientes de reconciliación
 */
export async function getPendingOfflineTransactions(stationId?: number): Promise<OfflineTransaction[]> {
  const database = await getDb();
  if (!database) return [];
  
  if (stationId) {
    return database.select().from(offlineTransactions)
      .where(and(
        eq(offlineTransactions.stationId, stationId),
        eq(offlineTransactions.reconciled, false)
      ));
  }
  return database.select().from(offlineTransactions)
    .where(eq(offlineTransactions.reconciled, false));
}

/**
 * Marcar una transacción offline como reconciliada
 */
export async function reconcileOfflineTransaction(
  offlineTxId: number, 
  transactionId?: number, 
  notes?: string
): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(offlineTransactions).set({
    reconciled: true,
    reconciledAt: new Date(),
    reconciledTransactionId: transactionId || null,
    notes: notes || null,
  }).where(eq(offlineTransactions.id, offlineTxId));
}

/**
 * Obtener tarjetas maestras de una estación
 */
export async function getMasterCards(stationId: number): Promise<LocalAuthEntry[]> {
  const database = await getDb();
  if (!database) return [];
  
  const list = await getOrCreateLocalAuthList(stationId);
  return database.select().from(localAuthEntries)
    .where(and(
      eq(localAuthEntries.listId, list.id),
      eq(localAuthEntries.isMasterCard, true)
    ));
}

/**
 * Actualizar política offline de una estación
 */
export async function updateOfflinePolicy(
  stationId: number, 
  policy: "LOCAL_LIST_ONLY" | "FREE_VENDING" | "REJECT_ALL"
): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  const list = await getOrCreateLocalAuthList(stationId);
  await database.update(localAuthLists).set({
    offlinePolicy: policy,
  }).where(eq(localAuthLists.id, list.id));
}

// ============================================================
// OCCUPANCY LIQUIDATIONS - Liquidaciones de tarifa de ocupación para aliados
// ============================================================
import { occupancyLiquidations, InsertOccupancyLiquidation, OccupancyLiquidation } from "../drizzle/schema";

/**
 * Crear un registro de liquidación de ocupación.
 * Se llama desde overstay-monitor cada vez que se cobra al usuario.
 */
export async function createOccupancyLiquidation(data: InsertOccupancyLiquidation): Promise<number | null> {
  const database = await getDb();
  if (!database) return null;
  const now = new Date();
  const result = await database.insert(occupancyLiquidations).values({
    ...data,
    periodYear: data.periodYear ?? now.getFullYear(),
    periodMonth: data.periodMonth ?? (now.getMonth() + 1),
  });
  return (result[0] as any).insertId ?? null;
}

/**
 * Obtener liquidaciones de ocupación por aliado (hostUserId) y período.
 * Usado en el dashboard del aliado y en el admin.
 */
export async function getOccupancyLiquidationsByHost(
  hostUserId: number,
  year?: number,
  month?: number
): Promise<OccupancyLiquidation[]> {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(occupancyLiquidations.hostUserId, hostUserId)];
  if (year) conditions.push(eq(occupancyLiquidations.periodYear, year));
  if (month) conditions.push(eq(occupancyLiquidations.periodMonth, month));
  return database.select().from(occupancyLiquidations)
    .where(and(...conditions))
    .orderBy(desc(occupancyLiquidations.createdAt));
}

/**
 * Obtener liquidaciones de ocupación por estación y período.
 * Usado en el admin para ver detalle por estación.
 */
export async function getOccupancyLiquidationsByStation(
  stationId: number,
  year?: number,
  month?: number
): Promise<OccupancyLiquidation[]> {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(occupancyLiquidations.stationId, stationId)];
  if (year) conditions.push(eq(occupancyLiquidations.periodYear, year));
  if (month) conditions.push(eq(occupancyLiquidations.periodMonth, month));
  return database.select().from(occupancyLiquidations)
    .where(and(...conditions))
    .orderBy(desc(occupancyLiquidations.createdAt));
}

/**
 * Resumen de liquidaciones de ocupación por aliado y período.
 * Devuelve totales agregados: minutos, cobrado al usuario, transferido al aliado, margen EVGreen.
 */
export async function getOccupancyLiquidationSummary(
  hostUserId: number,
  year: number,
  month: number
): Promise<{
  totalMinutes: number;
  totalUserCharge: number;
  totalAllyTransfer: number;
  totalEvgreenMargin: number;
  sessionCount: number;
}> {
  const database = await getDb();
  if (!database) return { totalMinutes: 0, totalUserCharge: 0, totalAllyTransfer: 0, totalEvgreenMargin: 0, sessionCount: 0 };
  const rows = await database.select({
    totalMinutes: sql<number>`COALESCE(SUM(minutesCharged), 0)`,
    totalUserCharge: sql<number>`COALESCE(SUM(userCharge), 0)`,
    totalAllyTransfer: sql<number>`COALESCE(SUM(allyTransfer), 0)`,
    totalEvgreenMargin: sql<number>`COALESCE(SUM(evgreenMargin), 0)`,
    sessionCount: sql<number>`COUNT(*)`,
  }).from(occupancyLiquidations)
    .where(and(
      eq(occupancyLiquidations.hostUserId, hostUserId),
      eq(occupancyLiquidations.periodYear, year),
      eq(occupancyLiquidations.periodMonth, month),
    ));
  const row = rows[0];
  return {
    totalMinutes: Number(row?.totalMinutes ?? 0),
    totalUserCharge: Number(row?.totalUserCharge ?? 0),
    totalAllyTransfer: Number(row?.totalAllyTransfer ?? 0),
    totalEvgreenMargin: Number(row?.totalEvgreenMargin ?? 0),
    sessionCount: Number(row?.sessionCount ?? 0),
  };
}

/**
 * Resumen de liquidaciones de ocupación por admin (todas las estaciones) y período.
 */
export async function getOccupancyLiquidationSummaryAdmin(
  year: number,
  month: number
): Promise<Array<{
  hostUserId: number | null;
  stationId: number;
  totalMinutes: number;
  totalUserCharge: number;
  totalAllyTransfer: number;
  totalEvgreenMargin: number;
  sessionCount: number;
}>> {
  const database = await getDb();
  if (!database) return [];
  return database.select({
    hostUserId: occupancyLiquidations.hostUserId,
    stationId: occupancyLiquidations.stationId,
    totalMinutes: sql<number>`COALESCE(SUM(minutesCharged), 0)`,
    totalUserCharge: sql<number>`COALESCE(SUM(userCharge), 0)`,
    totalAllyTransfer: sql<number>`COALESCE(SUM(allyTransfer), 0)`,
    totalEvgreenMargin: sql<number>`COALESCE(SUM(evgreenMargin), 0)`,
    sessionCount: sql<number>`COUNT(*)`,
  }).from(occupancyLiquidations)
    .where(and(
      eq(occupancyLiquidations.periodYear, year),
      eq(occupancyLiquidations.periodMonth, month),
    ))
    .groupBy(occupancyLiquidations.hostUserId, occupancyLiquidations.stationId);
}

/**
 * Marcar liquidaciones de un aliado como pagadas.
 */
export async function markOccupancyLiquidationsPaid(
  hostUserId: number,
  year: number,
  month: number
): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(occupancyLiquidations)
    .set({ allyPaidAt: new Date() })
    .where(and(
      eq(occupancyLiquidations.hostUserId, hostUserId),
      eq(occupancyLiquidations.periodYear, year),
      eq(occupancyLiquidations.periodMonth, month),
      isNull(occupancyLiquidations.allyPaidAt),
    ));
}


// ─── Alertas de Disponibilidad de Estaciones ──────────────────────────────────
import { stationAvailabilityAlerts, StationAvailabilityAlert } from "../drizzle/schema";

/**
 * Crea una alerta de disponibilidad para una estación.
 * Si ya existe una alerta PENDING del mismo usuario para la misma estación, la reutiliza.
 */
export async function createAvailabilityAlert(data: {
  userId: number;
  stationId: number;
  connectorType?: string;
  stationName?: string;
  userPhone?: string;
  userName?: string;
  sendPush?: boolean;
  sendWhatsapp?: boolean;
}): Promise<StationAvailabilityAlert | null> {
  const database = await getDb();
  if (!database) return null;

  // Verificar si ya existe una alerta PENDING para este usuario+estación
  const existing = await database.select().from(stationAvailabilityAlerts)
    .where(and(
      eq(stationAvailabilityAlerts.userId, data.userId),
      eq(stationAvailabilityAlerts.stationId, data.stationId),
      eq(stationAvailabilityAlerts.status, "PENDING"),
    ))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Calcular expiración: 24 horas desde ahora
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await database.insert(stationAvailabilityAlerts).values({
    userId: data.userId,
    stationId: data.stationId,
    connectorType: data.connectorType,
    stationName: data.stationName,
    userPhone: data.userPhone,
    userName: data.userName,
    sendPush: data.sendPush !== false,
    sendWhatsapp: data.sendWhatsapp !== false,
    status: "PENDING",
    expiresAt,
  });

  const insertId = (result as any).insertId;
  if (!insertId) return null;

  const [created] = await database.select().from(stationAvailabilityAlerts)
    .where(eq(stationAvailabilityAlerts.id, insertId));
  return created || null;
}

/**
 * Obtiene todas las alertas PENDING para una estación específica.
 * Se usa cuando OCPP reporta que un conector quedó AVAILABLE.
 */
export async function getPendingAlertsByStation(stationId: number): Promise<StationAvailabilityAlert[]> {
  const database = await getDb();
  if (!database) return [];

  return database.select().from(stationAvailabilityAlerts)
    .where(and(
      eq(stationAvailabilityAlerts.stationId, stationId),
      eq(stationAvailabilityAlerts.status, "PENDING"),
    ))
    .orderBy(asc(stationAvailabilityAlerts.createdAt));
}

/**
 * Marca una alerta como enviada.
 */
export async function markAlertSent(alertId: number): Promise<void> {
  const database = await getDb();
  if (!database) return;

  await database.update(stationAvailabilityAlerts)
    .set({ status: "SENT", sentAt: new Date() })
    .where(eq(stationAvailabilityAlerts.id, alertId));
}

/**
 * Cancela una alerta (por solicitud del usuario).
 */
export async function cancelAvailabilityAlert(alertId: number, userId: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  await database.update(stationAvailabilityAlerts)
    .set({ status: "CANCELLED" })
    .where(and(
      eq(stationAvailabilityAlerts.id, alertId),
      eq(stationAvailabilityAlerts.userId, userId),
      eq(stationAvailabilityAlerts.status, "PENDING"),
    ));
  return true;
}

/**
 * Obtiene todas las alertas activas (PENDING) de un usuario.
 */
export async function getMyAvailabilityAlerts(userId: number): Promise<StationAvailabilityAlert[]> {
  const database = await getDb();
  if (!database) return [];

  return database.select().from(stationAvailabilityAlerts)
    .where(and(
      eq(stationAvailabilityAlerts.userId, userId),
      eq(stationAvailabilityAlerts.status, "PENDING"),
    ))
    .orderBy(desc(stationAvailabilityAlerts.createdAt));
}

/**
 * Expira alertas vencidas (más de 24 horas sin enviarse).
 */
export async function expireOldAvailabilityAlerts(): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  const [result] = await database.update(stationAvailabilityAlerts)
    .set({ status: "EXPIRED" })
    .where(and(
      eq(stationAvailabilityAlerts.status, "PENDING"),
      lt(stationAvailabilityAlerts.expiresAt, new Date()),
    ));
  return (result as any).affectedRows || 0;
}
