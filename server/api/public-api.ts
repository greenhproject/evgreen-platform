/**
 * ============================================================================
 * EVGreen Platform - API Pública REST v1
 * ============================================================================
 * Endpoints REST para integración con aplicaciones externas.
 * Autenticación: API Key en header "X-API-Key" o query param "api_key"
 * Base URL: /api/v1/
 * 
 * @author Green House Project
 * @version 1.0.0
 * ============================================================================
 */
import { Router, Request, Response, NextFunction } from "express";
import * as db from "../db";
import { getDb } from "../db";
import * as ocppManager from "../ocpp/connection-manager";
import { dualCSMS } from "../ocpp/csms-dual";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ============================================================================
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================================================

interface ApiKeyUser {
  id: number;
  name: string;
  email: string;
  role: string;
  keyName: string;
}

async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "API Key requerida. Incluye el header 'X-API-Key' o el query param 'api_key'.",
      docs: "/api-docs",
    });
  }

  try {
    const database = await getDb();
    if (!database) {
      return res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: "Base de datos no disponible" });
    }

    // Buscar API key en la tabla
    const keysResult = await database.execute(sql`
      SELECT ak.*, u.name as userName, u.email as userEmail, u.role as userRole
      FROM api_keys ak
      JOIN users u ON ak.userId = u.id
      WHERE ak.keyHash = ${hashApiKey(apiKey)}
        AND ak.isActive = 1
        AND (ak.expiresAt IS NULL OR ak.expiresAt > NOW())
    `);

    const keyRows = (keysResult as any)[0] as any[];
    if (!keyRows || keyRows.length === 0) {
      return res.status(401).json({
        error: "INVALID_API_KEY",
        message: "API Key inválida, expirada o desactivada.",
      });
    }

    const keyData = keyRows[0];

    // Actualizar último uso
    await database.execute(sql`
      UPDATE api_keys SET lastUsedAt = NOW(), usageCount = usageCount + 1 WHERE id = ${keyData.id}
    `);

    // Rate limiting por API key (100 requests/minuto)
    const rateLimitKey = `api_v1_${keyData.id}`;
    const now = Date.now();
    if (!apiRateLimits.has(rateLimitKey)) {
      apiRateLimits.set(rateLimitKey, { count: 0, resetAt: now + 60000 });
    }
    const limit = apiRateLimits.get(rateLimitKey)!;
    if (now > limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + 60000;
    }
    limit.count++;
    if (limit.count > 100) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: "Límite de 100 requests por minuto excedido. Intenta de nuevo en 1 minuto.",
        retryAfter: Math.ceil((limit.resetAt - now) / 1000),
      });
    }

    // Adjuntar usuario al request
    (req as any).apiUser = {
      id: keyData.userId,
      name: keyData.userName,
      email: keyData.userEmail,
      role: keyData.userRole,
      keyName: keyData.name,
    } as ApiKeyUser;

    next();
  } catch (error: any) {
    console.error("[API v1] Auth error:", error.message);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error de autenticación" });
  }
}

// Rate limiting store
const apiRateLimits = new Map<string, { count: number; resetAt: number }>();

// Hash simple para API keys (SHA-256)
function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// Generar API key aleatoria
export function generateApiKey(): string {
  const prefix = "evg_";
  const random = crypto.randomBytes(32).toString("base64url");
  return `${prefix}${random}`;
}

// ============================================================================
// APLICAR MIDDLEWARE A TODAS LAS RUTAS
// ============================================================================
router.use(authenticateApiKey);

// ============================================================================
// ENDPOINTS: ESTACIONES
// ============================================================================

/**
 * GET /api/v1/stations
 * Lista todas las estaciones de carga (públicas)
 */
router.get("/stations", async (req: Request, res: Response) => {
  try {
    const { city, active, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    let query = `
      SELECT cs.id, cs.name, cs.address, cs.city, cs.department, cs.country,
             cs.latitude, cs.longitude, cs.isOnline, cs.isActive, cs.isPublic,
             cs.manufacturer, cs.model, cs.imageUrl, cs.thumbnailUrl,
             cs.operatingHours, cs.amenities, cs.createdAt
      FROM charging_stations cs
      WHERE cs.isPublic = 1
    `;
    const params: any[] = [];

    if (city) {
      query += ` AND cs.city = ?`;
      params.push(city);
    }
    if (active === "true") {
      query += ` AND cs.isActive = 1`;
    }

    query += ` ORDER BY cs.createdAt DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const stationResult = await database.execute(sql.raw(query));
    const stationRows = (stationResult as any)[0] as any[];

    // Enriquecer con estado OCPP en tiempo real
    const stations = stationRows.map(station => {
      const ocppId = station.ocppIdentity;
      const connections = ocppManager.getAllConnections();
      const isConnected = connections.some((c: any) => c.stationId === station.id);

      return {
        id: station.id,
        name: station.name,
        address: station.address,
        city: station.city,
        department: station.department,
        country: station.country,
        location: {
          latitude: parseFloat(station.latitude),
          longitude: parseFloat(station.longitude),
        },
        status: isConnected ? "ONLINE" : (station.isOnline ? "ONLINE" : "OFFLINE"),
        isActive: !!station.isActive,
        manufacturer: station.manufacturer,
        model: station.model,
        imageUrl: station.imageUrl,
        thumbnailUrl: station.thumbnailUrl,
        operatingHours: station.operatingHours,
        amenities: station.amenities,
        createdAt: station.createdAt,
      };
    });

    res.json({
      success: true,
      data: stations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: stations.length,
      },
    });
  } catch (error: any) {
    console.error("[API v1] GET /stations error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * GET /api/v1/stations/:id
 * Detalle de una estación con conectores y estado en tiempo real
 */
router.get("/stations/:id", async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: "INVALID_PARAM", message: "ID de estación inválido" });
    }

    const station = await db.getChargingStationById(stationId);
    if (!station) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Estación no encontrada" });
    }

    const evses = await db.getEvsesByStationId(stationId);
    const connections = ocppManager.getAllConnections();
    const isConnected = connections.some((c: any) => c.stationId === stationId);

    // Obtener tarifa
    const database = await getDb();
    let tariff = null;
    if (database) {
      const tariffResult = await database.execute(sql`
        SELECT pricePerKwh, pricePerSession, overstayPenaltyPerMinute, overstayGracePeriodMinutes, autoPricing
        FROM tariffs WHERE stationId = ${stationId} LIMIT 1
      `);
      const tariffRows = (tariffResult as any)[0] as any[];
      if (tariffRows.length > 0) {
        tariff = tariffRows[0];
      }
    }

    res.json({
      success: true,
      data: {
        id: station.id,
        name: station.name,
        address: station.address,
        city: station.city,
        department: station.department,
        location: {
          latitude: parseFloat(station.latitude || "0"),
          longitude: parseFloat(station.longitude || "0"),
        },
        status: isConnected ? "ONLINE" : "OFFLINE",
        isActive: !!station.isActive,
        manufacturer: station.manufacturer,
        model: station.model,
        imageUrl: station.imageUrl,
        connectors: evses.map(e => ({
          id: e.id,
          connectorId: e.connectorId,
          connectorType: e.connectorType,
          chargeType: e.chargeType,
          powerKw: parseFloat(e.powerKw?.toString() || "0"),
          status: e.status,
          isActive: !!e.isActive,
        })),
        tariff: tariff ? {
          pricePerKwh: parseFloat(tariff.pricePerKwh?.toString() || "0"),
          connectionFee: parseFloat(tariff.pricePerSession?.toString() || "0"),
          overstayPenaltyPerMin: parseFloat(tariff.overstayPenaltyPerMinute?.toString() || "0"),
          overstayGracePeriodMin: tariff.overstayGracePeriodMinutes || 10,
          currency: "COP",
        } : null,
        operatingHours: station.operatingHours,
        amenities: station.amenities,
      },
    });
  } catch (error: any) {
    console.error("[API v1] GET /stations/:id error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * GET /api/v1/stations/:id/status
 * Estado en tiempo real de una estación (conectores, energía, sesiones activas)
 */
router.get("/stations/:id/status", async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: "INVALID_PARAM", message: "ID de estación inválido" });
    }

    const station = await db.getChargingStationById(stationId);
    if (!station) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Estación no encontrada" });
    }

    const connections = ocppManager.getAllConnections();
    const conn = connections.find((c: any) => c.stationId === stationId);
    const evses = await db.getEvsesByStationId(stationId);

    // Sesiones activas
    const database = await getDb();
    let activeSessions: any[] = [];
    if (database) {
      const sessionsResult = await database.execute(sql`
        SELECT id, connectorId, startTime, energyDeliveredKwh, currentPowerKw, status
        FROM charging_transactions
        WHERE stationId = ${stationId} AND status = 'IN_PROGRESS'
      `);
      activeSessions = ((sessionsResult as any)[0] as any[]) || [];
    }

    res.json({
      success: true,
      data: {
        stationId,
        stationName: station.name,
        connectionStatus: conn ? "CONNECTED" : "DISCONNECTED",
        ocppVersion: conn ? (conn as any).ocppVersion : null,
        lastHeartbeat: conn ? (conn as any).lastHeartbeat : null,
        connectors: evses.map(e => ({
          connectorId: e.connectorId,
          type: e.connectorType,
          powerKw: parseFloat(e.powerKw?.toString() || "0"),
          status: e.status,
        })),
        activeSessions: activeSessions.map(s => ({
          sessionId: s.id,
          connectorId: s.connectorId,
          startTime: s.startTime,
          energyKwh: parseFloat(s.energyDeliveredKwh?.toString() || "0"),
          currentPowerKw: parseFloat(s.currentPowerKw?.toString() || "0"),
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API v1] GET /stations/:id/status error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// ============================================================================
// ENDPOINTS: TRANSACCIONES / SESIONES DE CARGA
// ============================================================================

/**
 * GET /api/v1/transactions
 * Historial de transacciones de carga
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { stationId, status, from, to, page = "1", limit = "20" } = req.query;
    const user = (req as any).apiUser as ApiKeyUser;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    // Solo admin/staff ven todas, inversionistas ven sus estaciones, usuarios ven las suyas
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (user.role === "user") {
      whereClause += ` AND ct.userId = ?`;
      params.push(user.id);
    } else if (user.role === "investor") {
      whereClause += ` AND cs.ownerId = ?`;
      params.push(user.id);
    }

    if (stationId) {
      whereClause += ` AND ct.stationId = ?`;
      params.push(parseInt(stationId as string));
    }
    if (status) {
      whereClause += ` AND ct.status = ?`;
      params.push(status);
    }
    if (from) {
      whereClause += ` AND ct.startTime >= ?`;
      params.push(from);
    }
    if (to) {
      whereClause += ` AND ct.startTime <= ?`;
      params.push(to);
    }

    const query = `
      SELECT ct.id, ct.stationId, ct.connectorId, ct.userId, ct.status,
             ct.startTime, ct.endTime, ct.energyDeliveredKwh, ct.totalCost,
             ct.pricePerKwh, ct.currentPowerKw, ct.batteryPercent,
             cs.name as stationName, u.name as userName
      FROM charging_transactions ct
      LEFT JOIN charging_stations cs ON ct.stationId = cs.id
      LEFT JOIN users u ON ct.userId = u.id
      ${whereClause}
      ORDER BY ct.startTime DESC
      LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}
    `;

    const txListResult = await database.execute(sql.raw(query));
    const txListRows = (txListResult as any)[0] as any[];

    const transactions = txListRows.map(t => ({
      id: t.id,
      stationId: t.stationId,
      stationName: t.stationName,
      connectorId: t.connectorId,
      userId: t.userId,
      userName: t.userName,
      status: t.status,
      startTime: t.startTime,
      endTime: t.endTime,
      energyKwh: parseFloat(t.energyDeliveredKwh?.toString() || "0"),
      totalCost: parseFloat(t.totalCost?.toString() || "0"),
      pricePerKwh: parseFloat(t.pricePerKwh?.toString() || "0"),
      currentPowerKw: parseFloat(t.currentPowerKw?.toString() || "0"),
      batteryPercent: t.batteryPercent,
      currency: "COP",
    }));

    res.json({
      success: true,
      data: transactions,
      pagination: { page: pageNum, limit: limitNum, total: transactions.length },
    });
  } catch (error: any) {
    console.error("[API v1] GET /transactions error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * GET /api/v1/transactions/:id
 * Detalle de una transacción específica
 */
router.get("/transactions/:id", async (req: Request, res: Response) => {
  try {
    const txId = parseInt(req.params.id);
    if (isNaN(txId)) {
      return res.status(400).json({ error: "INVALID_PARAM", message: "ID de transacción inválido" });
    }

    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    const txResult = await database.execute(sql`
      SELECT ct.*, cs.name as stationName, u.name as userName, u.email as userEmail
      FROM charging_transactions ct
      LEFT JOIN charging_stations cs ON ct.stationId = cs.id
      LEFT JOIN users u ON ct.userId = u.id
      WHERE ct.id = ${txId}
    `);

    const txRows = (txResult as any)[0] as any[];
    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Transacción no encontrada" });
    }

    const t = txRows[0];
    res.json({
      success: true,
      data: {
        id: t.id,
        stationId: t.stationId,
        stationName: t.stationName,
        connectorId: t.connectorId,
        userId: t.userId,
        userName: t.userName,
        userEmail: t.userEmail,
        status: t.status,
        startTime: t.startTime,
        endTime: t.endTime,
        energyKwh: parseFloat(t.energyDeliveredKwh?.toString() || "0"),
        totalCost: parseFloat(t.totalCost?.toString() || "0"),
        pricePerKwh: parseFloat(t.pricePerKwh?.toString() || "0"),
        connectionFee: parseFloat(t.connectionFee?.toString() || "0"),
        overstayFee: parseFloat(t.overstayFee?.toString() || "0"),
        currentPowerKw: parseFloat(t.currentPowerKw?.toString() || "0"),
        batteryPercent: t.batteryPercent,
        meterStart: t.meterStart,
        meterStop: t.meterStop,
        stopReason: t.stopReason,
        currency: "COP",
      },
    });
  } catch (error: any) {
    console.error("[API v1] GET /transactions/:id error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// ============================================================================
// ENDPOINTS: COMANDOS REMOTOS (Solo admin/staff)
// ============================================================================

/**
 * POST /api/v1/stations/:id/start
 * Iniciar carga remota en un conector
 */
router.post("/stations/:id/start", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Solo administradores pueden iniciar cargas remotas" });
    }

    const stationId = parseInt(req.params.id);
    const { connectorId, idTag } = req.body;

    if (!connectorId || !idTag) {
      return res.status(400).json({
        error: "MISSING_PARAMS",
        message: "Se requiere 'connectorId' y 'idTag' en el body",
      });
    }

    const station = await db.getChargingStationById(stationId);
    if (!station) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Estación no encontrada" });
    }

    const ocppIdentity = station.ocppIdentity;
    if (!ocppIdentity) {
      return res.status(400).json({ error: "NO_OCPP", message: "Estación sin identidad OCPP configurada" });
    }

    // Enviar comando RemoteStartTransaction via OCPP
    const result = await dualCSMS.sendGenericCommand(ocppIdentity, "RemoteStartTransaction", {
      connectorId: parseInt(connectorId),
      idTag: idTag,
    });

    res.json({
      success: true,
      data: {
        stationId,
        connectorId: parseInt(connectorId),
        idTag,
        commandResult: result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API v1] POST /stations/:id/start error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * POST /api/v1/stations/:id/stop
 * Detener carga remota
 */
router.post("/stations/:id/stop", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Solo administradores pueden detener cargas remotas" });
    }

    const stationId = parseInt(req.params.id);
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        error: "MISSING_PARAMS",
        message: "Se requiere 'transactionId' en el body",
      });
    }

    const station = await db.getChargingStationById(stationId);
    if (!station) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Estación no encontrada" });
    }

    const ocppIdentity = station.ocppIdentity;
    if (!ocppIdentity) {
      return res.status(400).json({ error: "NO_OCPP", message: "Estación sin identidad OCPP configurada" });
    }

    const result = await dualCSMS.sendGenericCommand(ocppIdentity, "RemoteStopTransaction", {
      transactionId: parseInt(transactionId),
    });

    res.json({
      success: true,
      data: {
        stationId,
        transactionId: parseInt(transactionId),
        commandResult: result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API v1] POST /stations/:id/stop error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// ============================================================================
// ENDPOINTS: ESTADÍSTICAS
// ============================================================================

/**
 * GET /api/v1/stats/overview
 * Resumen general de la plataforma (según rol del usuario)
 */
router.get("/stats/overview", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    let stationFilter = "";
    const params: any[] = [];

    if (user.role === "investor") {
      stationFilter = "WHERE cs.ownerId = ?";
      params.push(user.id);
    }

    // Total estaciones
    const stationResult = await database.execute(
      sql.raw(`SELECT COUNT(*) as total FROM charging_stations cs ${stationFilter}`)
    );

    // Total energía entregada (últimos 30 días)
    const energyResult = await database.execute(sql`
      SELECT COALESCE(SUM(energyDeliveredKwh), 0) as totalKwh,
             COALESCE(SUM(totalCost), 0) as totalRevenue,
             COUNT(*) as totalSessions
      FROM charging_transactions
      WHERE status = 'COMPLETED'
        AND startTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Estaciones online
    const connections = ocppManager.getAllConnections();

    const stats = ((stationResult as any)[0] as any[])[0];
    const energy = ((energyResult as any)[0] as any[])[0];

    res.json({
      success: true,
      data: {
        stations: {
          total: stats?.total || 0,
          online: connections.length,
        },
        last30Days: {
          totalEnergyKwh: parseFloat(energy?.totalKwh?.toString() || "0"),
          totalRevenueCOP: parseFloat(energy?.totalRevenue?.toString() || "0"),
          totalSessions: energy?.totalSessions || 0,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[API v1] GET /stats/overview error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * GET /api/v1/stats/energy
 * Estadísticas de energía por período
 */
router.get("/stats/energy", async (req: Request, res: Response) => {
  try {
    const { period = "daily", days = "30", stationId } = req.query;
    const daysNum = Math.min(365, Math.max(1, parseInt(days as string) || 30));
    
    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    let groupBy = "DATE(startTime)";
    if (period === "hourly") groupBy = "DATE_FORMAT(startTime, '%Y-%m-%d %H:00')";
    if (period === "weekly") groupBy = "YEARWEEK(startTime)";
    if (period === "monthly") groupBy = "DATE_FORMAT(startTime, '%Y-%m')";

    let stationFilter = "";
    if (stationId) stationFilter = `AND stationId = ${parseInt(stationId as string)}`;

    const energyRows = await database.execute(sql.raw(`
      SELECT ${groupBy} as period,
             SUM(energyDeliveredKwh) as energyKwh,
             SUM(totalCost) as revenue,
             COUNT(*) as sessions,
             AVG(energyDeliveredKwh) as avgEnergyPerSession
      FROM charging_transactions
      WHERE status = 'COMPLETED'
        AND startTime >= DATE_SUB(NOW(), INTERVAL ${daysNum} DAY)
        ${stationFilter}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `));
    const rows = (energyRows as any)[0] as any[];

    res.json({
      success: true,
      data: rows.map(r => ({
        period: r.period,
        energyKwh: parseFloat(r.energyKwh?.toString() || "0"),
        revenueCOP: parseFloat(r.revenue?.toString() || "0"),
        sessions: r.sessions,
        avgEnergyPerSession: parseFloat(r.avgEnergyPerSession?.toString() || "0"),
      })),
    });
  } catch (error: any) {
    console.error("[API v1] GET /stats/energy error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// ============================================================================
// ENDPOINTS: USUARIOS (Solo admin)
// ============================================================================

/**
 * GET /api/v1/users
 * Lista de usuarios (solo admin/staff)
 */
router.get("/users", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Solo administradores" });
    }

    const { role, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));

    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    let whereClause = "WHERE 1=1";
    if (role) whereClause += ` AND role = '${role}'`;

    const result = await database.execute(sql.raw(`
      SELECT id, name, email, phone, role, isActive, city, createdAt
      FROM users
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}
    `));
    const rows = (result as any)[0] as any[];

    res.json({
      success: true,
      data: rows.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: !!u.isActive,
        city: u.city,
        createdAt: u.createdAt,
      })),
      pagination: { page: pageNum, limit: limitNum },
    });
  } catch (error: any) {
    console.error("[API v1] GET /users error:", error.message);
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// ============================================================================
// ENDPOINT: WEBHOOKS (Configurar notificaciones externas)
// ============================================================================

/**
 * GET /api/v1/webhooks
 * Lista webhooks configurados para esta API key
 */
router.get("/webhooks", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    const result = await database.execute(sql`
      SELECT id, url, events, isActive, createdAt, lastTriggeredAt, failCount
      FROM api_webhooks
      WHERE userId = ${user.id} AND isActive = 1
    `);
    const rows = (result as any)[0] as any[];

    res.json({
      success: true,
      data: rows.map(w => ({
        id: w.id,
        url: w.url,
        events: w.events,
        isActive: !!w.isActive,
        createdAt: w.createdAt,
        lastTriggeredAt: w.lastTriggeredAt,
        failCount: w.failCount,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

/**
 * POST /api/v1/webhooks
 * Registrar un webhook para recibir eventos
 */
router.post("/webhooks", async (req: Request, res: Response) => {
  try {
    const user = (req as any).apiUser as ApiKeyUser;
    const { url, events } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        error: "MISSING_PARAMS",
        message: "Se requiere 'url' (string) y 'events' (array de strings)",
        validEvents: [
          "charging.started",
          "charging.completed",
          "charging.failed",
          "station.online",
          "station.offline",
          "alert.created",
        ],
      });
    }

    const database = await getDb();
    if (!database) return res.status(503).json({ error: "SERVICE_UNAVAILABLE" });

    await database.execute(sql`
      INSERT INTO api_webhooks (userId, url, events, isActive, createdAt)
      VALUES (${user.id}, ${url}, ${JSON.stringify(events)}, 1, NOW())
    `);

    res.status(201).json({
      success: true,
      message: "Webhook registrado exitosamente",
      data: { url, events },
    });
  } catch (error: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

export default router;
export { hashApiKey };
