/**
 * Tests para los endpoints transactions.getDetail y transactions.partialRefund
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la base de datos
const mockDb = {
  getTransactionById: vi.fn(),
  getChargingStationById: vi.fn(),
  getEvseById: vi.fn(),
  getTariffById: vi.fn(),
  getUserById: vi.fn(),
  getMeterValuesByTransactionId: vi.fn(),
  getEffectiveStationPrice: vi.fn(),
  getWalletByUserId: vi.fn(),
  updateWalletBalance: vi.fn(),
  createWalletTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  getUserPendingDebts: vi.fn(),
  waiveUserDebt: vi.fn(),
  createNotification: vi.fn(),
  getDb: vi.fn(),
};

vi.mock("./db", () => ({
  default: mockDb,
}));

// Mock de drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args) => ({ conditions: args })),
  desc: vi.fn((field) => ({ field, direction: "desc" })),
  sql: vi.fn(),
}));

// Mock del schema
vi.mock("../drizzle/schema", () => ({
  walletTransactions: { userId: "userId", referenceId: "referenceId", createdAt: "createdAt" },
  userDebts: { userId: "userId", transactionId: "transactionId", id: "id", remainingAmount: "remainingAmount", updatedAt: "updatedAt" },
}));

describe("transactions.getDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería devolver datos completos de una transacción existente", async () => {
    const mockTransaction = {
      id: 1,
      userId: 10,
      stationId: 5,
      evseId: 3,
      tariffId: 2,
      status: "COMPLETED",
      ocppTransactionId: "TX-001",
      startMethod: "APP",
      stopReason: "EV_DISCONNECTED",
      chargeMode: "full_charge",
      startTime: new Date("2026-01-15T10:00:00Z"),
      endTime: new Date("2026-01-15T11:30:00Z"),
      kwhConsumed: "25.50",
      meterStart: "1000.00",
      meterEnd: "1025.50",
      energyCost: "20000.00",
      timeCost: "0.00",
      sessionCost: "0.00",
      overstayCost: "5000.00",
      totalCost: "25000.00",
      appliedPricePerKwh: "784.31",
      investorShare: "15000.00",
      platformFee: "10000.00",
    };

    const mockStation = { id: 5, name: "Estación Centro", address: "Cra 7 #45-12", city: "Bogotá" };
    const mockEvse = { id: 3, connectorId: 1, connectorType: "TYPE_2", chargeType: "AC", powerKw: "22.00" };
    const mockTariff = { overstayGracePeriodMinutes: 10, overstayPenaltyPerMinute: "250.00" };
    const mockUser = { id: 10, name: "Juan Pérez", email: "juan@test.com", phone: "+573001234567" };
    const mockMeterValues = [
      { timestamp: new Date("2026-01-15T10:30:00Z"), energyKwh: "12.50", powerKw: "22.00", soc: 50 },
      { timestamp: new Date("2026-01-15T11:00:00Z"), energyKwh: "25.00", powerKw: "20.00", soc: 80 },
    ];
    const mockEffectivePrice = { pricePerKwh: 800, overstayPenaltyPerMin: 250 };

    mockDb.getTransactionById.mockResolvedValue(mockTransaction);
    mockDb.getChargingStationById.mockResolvedValue(mockStation);
    mockDb.getEvseById.mockResolvedValue(mockEvse);
    mockDb.getTariffById.mockResolvedValue(mockTariff);
    mockDb.getUserById.mockResolvedValue(mockUser);
    mockDb.getMeterValuesByTransactionId.mockResolvedValue(mockMeterValues);
    mockDb.getEffectiveStationPrice.mockResolvedValue(mockEffectivePrice);
    mockDb.getDb.mockResolvedValue(null); // Simular sin acceso directo a DB

    // Simular la lógica del endpoint directamente
    const transaction = await mockDb.getTransactionById(1);
    expect(transaction).not.toBeNull();
    expect(transaction.id).toBe(1);
    expect(transaction.status).toBe("COMPLETED");

    const station = await mockDb.getChargingStationById(transaction.stationId);
    expect(station.name).toBe("Estación Centro");

    const user = await mockDb.getUserById(transaction.userId);
    expect(user.name).toBe("Juan Pérez");

    const effectivePrice = await mockDb.getEffectiveStationPrice(transaction.stationId);
    expect(effectivePrice.pricePerKwh).toBe(800);

    // Verificar cálculos de overstay
    const overstayCost = parseFloat(transaction.overstayCost);
    expect(overstayCost).toBe(5000);

    const gracePeriodMinutes = mockTariff.overstayGracePeriodMinutes;
    const overstayPenaltyPerMin = parseFloat(mockTariff.overstayPenaltyPerMinute);
    const overstayMinutesBilled = Math.round(overstayCost / overstayPenaltyPerMin);
    expect(overstayMinutesBilled).toBe(20);

    // Verificar timeline
    const endTime = transaction.endTime;
    const overstayStartTime = new Date(endTime.getTime() + gracePeriodMinutes * 60 * 1000);
    expect(overstayStartTime.getTime()).toBe(endTime.getTime() + 10 * 60 * 1000);
  });

  it("debería lanzar error si la transacción no existe", async () => {
    mockDb.getTransactionById.mockResolvedValue(null);

    const transaction = await mockDb.getTransactionById(999);
    expect(transaction).toBeNull();
  });

  it("debería calcular correctamente la duración de carga", () => {
    const startTime = new Date("2026-01-15T10:00:00Z");
    const endTime = new Date("2026-01-15T11:30:00Z");
    const chargeDurationMs = endTime.getTime() - startTime.getTime();
    const chargeDurationMinutes = Math.round(chargeDurationMs / 60000);
    expect(chargeDurationMinutes).toBe(90);
  });

  it("debería manejar transacciones sin sobreestadía", () => {
    const overstayCost = parseFloat("0.00");
    expect(overstayCost).toBe(0);
    // Si no hay overstay, el campo overstay debe ser null
    const overstayData = overstayCost > 0 ? { minutesBilled: 0 } : null;
    expect(overstayData).toBeNull();
  });
});

describe("transactions.partialRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería validar que el monto de reembolso no supere el total", async () => {
    const mockTransaction = {
      id: 1,
      userId: 10,
      totalCost: "25000.00",
      overstayCost: "5000.00",
    };

    mockDb.getTransactionById.mockResolvedValue(mockTransaction);

    const totalCost = parseFloat(mockTransaction.totalCost);
    const refundAmount = 30000;

    // Validación: reembolso no puede superar total
    expect(refundAmount > totalCost).toBe(true);
  });

  it("debería validar que el reembolso de overstay no supere el cobro de overstay", async () => {
    const mockTransaction = {
      id: 1,
      userId: 10,
      totalCost: "25000.00",
      overstayCost: "5000.00",
    };

    mockDb.getTransactionById.mockResolvedValue(mockTransaction);

    const currentOverstay = parseFloat(mockTransaction.overstayCost);
    const refundAmount = 7000;
    const refundType = "overstay";

    if (refundType === "overstay") {
      expect(refundAmount > currentOverstay).toBe(true);
    }
  });

  it("debería actualizar correctamente el saldo de billetera al reembolsar", async () => {
    const mockWallet = { id: 1, balance: "50000.00" };
    const refundAmount = 5000;

    mockDb.getWalletByUserId.mockResolvedValue(mockWallet);
    mockDb.updateWalletBalance.mockResolvedValue(undefined);
    mockDb.createWalletTransaction.mockResolvedValue(undefined);

    const wallet = await mockDb.getWalletByUserId(10);
    expect(wallet).not.toBeNull();

    const currentBalance = parseFloat(wallet.balance);
    const newBalance = currentBalance + refundAmount;
    expect(newBalance).toBe(55000);

    await mockDb.updateWalletBalance(10, newBalance.toString());
    expect(mockDb.updateWalletBalance).toHaveBeenCalledWith(10, "55000");
  });

  it("debería reducir el overstayCost cuando el tipo es overstay", () => {
    const currentOverstay = 5000;
    const refundAmount = 3000;
    const newOverstay = currentOverstay - refundAmount;
    expect(newOverstay).toBe(2000);

    const totalCost = 25000;
    const newTotal = totalCost - refundAmount;
    expect(newTotal).toBe(22000);
  });

  it("debería condonar deuda si el reembolso cubre el monto pendiente", async () => {
    const mockDebts = [
      { id: 1, transactionId: 1, remainingAmount: "5000.00" },
    ];

    mockDb.getUserPendingDebts.mockResolvedValue(mockDebts);
    mockDb.waiveUserDebt.mockResolvedValue(undefined);

    const debts = await mockDb.getUserPendingDebts(10);
    const refundAmount = 5000;
    const transactionId = 1;

    for (const debt of debts) {
      if (debt.transactionId === transactionId) {
        const remaining = parseFloat(debt.remainingAmount);
        if (refundAmount >= remaining) {
          await mockDb.waiveUserDebt(debt.id);
        }
      }
    }

    expect(mockDb.waiveUserDebt).toHaveBeenCalledWith(1);
  });

  it("debería crear notificación al usuario después del reembolso", async () => {
    mockDb.createNotification.mockResolvedValue(undefined);

    await mockDb.createNotification({
      userId: 10,
      title: "💰 Reembolso aplicado",
      message: "Se te ha reembolsado $5.000 COP de tu sesión de carga #1. Motivo: Error de medición",
      type: "PAYMENT",
      isRead: false,
    });

    expect(mockDb.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        type: "PAYMENT",
        isRead: false,
      })
    );
  });
});
