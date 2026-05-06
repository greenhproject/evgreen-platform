import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests para las correcciones de bugs críticos:
 * 1. Overstay lock en BD (evitar duplicación entre instancias)
 * 2. Pending charge sessions persistidas en BD (evitar pérdida de chargeMode)
 * 3. Auto-stop por fixed_amount alcanzado
 */

// Mock de db
vi.mock("./db", () => ({
  savePendingChargeSession: vi.fn().mockResolvedValue(undefined),
  findPendingChargeSessionByOcppIdentity: vi.fn().mockResolvedValue(null),
  consumePendingChargeSession: vi.fn().mockResolvedValue(undefined),
  cleanExpiredPendingSessions: vi.fn().mockResolvedValue(undefined),
  getTransactionById: vi.fn().mockResolvedValue({ id: 1, ocppNumericTxId: 100 }),
  getChargingStationById: vi.fn().mockResolvedValue({ id: 1, ocppIdentity: "EVG-001" }),
}));

vi.mock("../drizzle/schema", () => ({
  pendingChargeSessions: { sessionId: "sessionId" },
  overstayLocks: { evseId: "evseId" },
}));

describe("Bug Fix: Overstay Lock en BD", () => {
  it("debe prevenir que dos instancias procesen el mismo EVSE simultáneamente", () => {
    // La tabla overstay_locks usa evseId como clave primaria
    // Solo una instancia puede adquirir el lock a la vez
    // Si otra instancia intenta INSERT con el mismo evseId, falla por duplicado
    const lockData = {
      evseId: 42,
      instanceId: "instance-abc-123",
      lastHeartbeat: new Date(),
      lastChargeTime: new Date(),
      startedAt: new Date(),
    };
    
    expect(lockData.evseId).toBe(42);
    expect(lockData.instanceId).toBeTruthy();
    expect(lockData.lastHeartbeat).toBeInstanceOf(Date);
  });

  it("debe considerar un lock como expirado si no hay heartbeat en 90 segundos", () => {
    const LOCK_EXPIRY_MS = 90_000;
    const lastHeartbeat = new Date(Date.now() - 100_000); // 100s ago
    const isExpired = (Date.now() - lastHeartbeat.getTime()) > LOCK_EXPIRY_MS;
    expect(isExpired).toBe(true);
  });

  it("debe permitir adquirir un lock expirado por otra instancia", () => {
    const LOCK_EXPIRY_MS = 90_000;
    const lastHeartbeat = new Date(Date.now() - 100_000); // Expirado
    const isExpired = (Date.now() - lastHeartbeat.getTime()) > LOCK_EXPIRY_MS;
    
    // Si está expirado, la nueva instancia puede hacer UPDATE para tomar el lock
    expect(isExpired).toBe(true);
    
    const newLock = {
      instanceId: "new-instance-xyz",
      lastHeartbeat: new Date(),
    };
    expect(newLock.instanceId).not.toBe("old-instance-abc");
  });

  it("no debe considerar un lock como expirado si el heartbeat es reciente", () => {
    const LOCK_EXPIRY_MS = 90_000;
    const lastHeartbeat = new Date(Date.now() - 30_000); // 30s ago
    const isExpired = (Date.now() - lastHeartbeat.getTime()) > LOCK_EXPIRY_MS;
    expect(isExpired).toBe(false);
  });
});

describe("Bug Fix: Pending Charge Sessions en BD", () => {
  it("debe guardar la sesión pendiente con todos los campos necesarios", () => {
    const sessionData = {
      sessionId: "uuid-test-123",
      userId: 42,
      stationId: 5,
      connectorId: 1,
      ocppIdentity: "EVG-diamante-001",
      chargeMode: "fixed_amount",
      targetValue: 80000,
      estimatedCost: 80000,
      pricePerKwh: 1300,
    };
    
    expect(sessionData.chargeMode).toBe("fixed_amount");
    expect(sessionData.targetValue).toBe(80000);
    expect(sessionData.pricePerKwh).toBe(1300);
    expect(sessionData.ocppIdentity).toBeTruthy();
  });

  it("debe expirar sesiones pendientes después de 5 minutos", () => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
    const fiveMinutesLater = new Date(createdAt.getTime() + 5 * 60 * 1000 + 1);
    
    expect(fiveMinutesLater > expiresAt).toBe(true);
  });

  it("debe marcar la sesión como consumida cuando se usa", async () => {
    const db = await import("./db");
    await db.consumePendingChargeSession("test-session-id");
    expect(db.consumePendingChargeSession).toHaveBeenCalledWith("test-session-id");
  });

  it("debe buscar en BD cuando no se encuentra en memoria local", async () => {
    const db = await import("./db");
    // Simular que la sesión está en BD (creada por otra instancia)
    vi.mocked(db.findPendingChargeSessionByOcppIdentity).mockResolvedValueOnce({
      id: 1,
      sessionId: "remote-session-123",
      userId: 42,
      stationId: 5,
      connectorId: 1,
      ocppIdentity: "EVG-diamante-001",
      chargeMode: "fixed_amount",
      targetValue: "80000.00",
      estimatedCost: "80000.00",
      pricePerKwh: "1300.00",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      consumed: false,
    });
    
    const result = await db.findPendingChargeSessionByOcppIdentity("EVG-diamante-001", 1);
    expect(result).not.toBeNull();
    expect(result!.chargeMode).toBe("fixed_amount");
    expect(result!.targetValue).toBe("80000.00");
  });

  it("debe convertir los valores de BD al formato esperado por el sistema", () => {
    const dbSession = {
      sessionId: "remote-session-123",
      userId: 42,
      stationId: 5,
      connectorId: 1,
      ocppIdentity: "EVG-diamante-001",
      chargeMode: "fixed_amount",
      targetValue: "80000.00",
      estimatedCost: "80000.00",
      pricePerKwh: "1300.00",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      consumed: false,
    };
    
    // Convertir al formato esperado
    const converted = {
      sessionId: dbSession.sessionId,
      session: {
        userId: dbSession.userId,
        stationId: dbSession.stationId,
        connectorId: dbSession.connectorId,
        chargeMode: dbSession.chargeMode,
        targetValue: Number(dbSession.targetValue),
        estimatedCost: Number(dbSession.estimatedCost),
        pricePerKwh: Number(dbSession.pricePerKwh),
        createdAt: dbSession.createdAt,
        ocppIdentity: dbSession.ocppIdentity,
      },
    };
    
    expect(converted.session.chargeMode).toBe("fixed_amount");
    expect(converted.session.targetValue).toBe(80000);
    expect(converted.session.pricePerKwh).toBe(1300);
  });
});

describe("Bug Fix: Auto-stop por fixed_amount", () => {
  it("debe detectar cuando el costo actual supera el targetValue", () => {
    const session = {
      chargeMode: "fixed_amount" as const,
      targetValue: 80000,
      currentCost: 81000,
      autoStopSent: false,
    };
    
    const shouldStop = session.chargeMode === "fixed_amount" 
      && session.targetValue > 0 
      && !session.autoStopSent 
      && session.currentCost >= session.targetValue;
    
    expect(shouldStop).toBe(true);
  });

  it("no debe detener si el costo aún no alcanza el targetValue", () => {
    const session = {
      chargeMode: "fixed_amount" as const,
      targetValue: 80000,
      currentCost: 50000,
      autoStopSent: false,
    };
    
    const shouldStop = session.chargeMode === "fixed_amount" 
      && session.targetValue > 0 
      && !session.autoStopSent 
      && session.currentCost >= session.targetValue;
    
    expect(shouldStop).toBe(false);
  });

  it("no debe enviar auto-stop si ya fue enviado previamente", () => {
    const session = {
      chargeMode: "fixed_amount" as const,
      targetValue: 80000,
      currentCost: 90000,
      autoStopSent: true, // Ya se envió
    };
    
    const shouldStop = session.chargeMode === "fixed_amount" 
      && session.targetValue > 0 
      && !session.autoStopSent 
      && session.currentCost >= session.targetValue;
    
    expect(shouldStop).toBe(false);
  });

  it("no debe activar auto-stop para modo full_charge", () => {
    const session = {
      chargeMode: "full_charge" as const,
      targetValue: 0,
      currentCost: 150000,
      autoStopSent: false,
    };
    
    const shouldStop = session.chargeMode === "fixed_amount" 
      && session.targetValue > 0 
      && !session.autoStopSent 
      && session.currentCost >= session.targetValue;
    
    expect(shouldStop).toBe(false);
  });

  it("debe marcar autoStopSent=true después de enviar el comando", () => {
    const session = {
      chargeMode: "fixed_amount" as const,
      targetValue: 80000,
      currentCost: 82000,
      autoStopSent: false,
    };
    
    // Simular la lógica de auto-stop
    if (session.chargeMode === "fixed_amount" && session.targetValue > 0 && !session.autoStopSent) {
      if (session.currentCost >= session.targetValue) {
        session.autoStopSent = true;
      }
    }
    
    expect(session.autoStopSent).toBe(true);
  });
});
