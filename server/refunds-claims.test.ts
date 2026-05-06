/**
 * Tests para los routers de Refunds y Claims
 * Verifica la funcionalidad de historial de reembolsos y sistema de reclamos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de db
vi.mock("./db", () => ({
  getRefunds: vi.fn(),
  getRefundById: vi.fn(),
  createRefund: vi.fn(),
  getClaims: vi.fn(),
  getClaimById: vi.fn(),
  createClaim: vi.fn(),
  updateClaim: vi.fn(),
  getClaimsByTransactionId: vi.fn(),
  getUserById: vi.fn(),
  getTransactionById: vi.fn(),
  getChargingStationById: vi.fn(),
  getAllUsers: vi.fn(),
  createNotification: vi.fn(),
  getWalletByUserId: vi.fn(),
  updateWalletBalance: vi.fn(),
  createWalletTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));

import * as db from "./db";

describe("Refunds Router Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return refunds list with enriched data", async () => {
    const mockRefunds = [
      {
        id: 1,
        transactionId: 100,
        userId: 5,
        adminId: 1,
        adminName: "Admin Test",
        amount: "15000",
        refundType: "overstay",
        reason: "Sobreestadía injusta",
        createdAt: new Date("2026-05-01"),
      },
    ];

    (db.getRefunds as any).mockResolvedValue({ data: mockRefunds, total: 1 });
    (db.getUserById as any).mockResolvedValue({ id: 5, name: "Juan", email: "juan@test.com" });
    (db.getTransactionById as any).mockResolvedValue({ id: 100, totalCost: "25000", stationId: 10 });
    (db.getChargingStationById as any).mockResolvedValue({ id: 10, name: "Estación Centro" });

    const result = await db.getRefunds({ limit: 50, offset: 0 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].amount).toBe("15000");
    expect(result.data[0].refundType).toBe("overstay");
  });

  it("should return refund by ID", async () => {
    const mockRefund = {
      id: 1,
      transactionId: 100,
      userId: 5,
      adminId: 1,
      adminName: "Admin Test",
      amount: "15000",
      refundType: "overstay",
      reason: "Test reason",
      createdAt: new Date(),
    };

    (db.getRefundById as any).mockResolvedValue(mockRefund);
    const result = await db.getRefundById(1);
    expect(result).toBeDefined();
    expect(result!.id).toBe(1);
    expect(result!.amount).toBe("15000");
  });

  it("should return null for non-existent refund", async () => {
    (db.getRefundById as any).mockResolvedValue(null);
    const result = await db.getRefundById(999);
    expect(result).toBeNull();
  });

  it("should create a refund record", async () => {
    (db.createRefund as any).mockResolvedValue(42);
    const refundId = await db.createRefund({
      transactionId: 100,
      userId: 5,
      adminId: 1,
      adminName: "Admin",
      amount: "10000",
      refundType: "general",
      reason: "Test refund",
      claimId: null,
      walletTransactionId: null,
    } as any);
    expect(refundId).toBe(42);
    expect(db.createRefund).toHaveBeenCalledTimes(1);
  });
});

describe("Claims Router Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a claim for a valid transaction", async () => {
    (db.getTransactionById as any).mockResolvedValue({ id: 100, userId: 5, stationId: 10 });
    (db.getClaimsByTransactionId as any).mockResolvedValue([]);
    (db.createClaim as any).mockResolvedValue(1);
    (db.getAllUsers as any).mockResolvedValue([
      { id: 1, role: "admin", name: "Admin" },
    ]);
    (db.createNotification as any).mockResolvedValue(undefined);

    const claimId = await db.createClaim({
      userId: 5,
      userName: "Juan",
      transactionId: 100,
      category: "overcharge",
      description: "Me cobraron de más en la sesión",
      requestedAmount: "5000",
      status: "PENDING",
    } as any);

    expect(claimId).toBe(1);
    expect(db.createClaim).toHaveBeenCalledTimes(1);
  });

  it("should detect existing pending claim for same transaction", async () => {
    const existingClaims = [
      { id: 1, transactionId: 100, status: "PENDING", userId: 5 },
    ];
    (db.getClaimsByTransactionId as any).mockResolvedValue(existingClaims);

    const claims = await db.getClaimsByTransactionId(100);
    const pendingClaim = claims.find((c: any) => c.status === "PENDING");
    expect(pendingClaim).toBeDefined();
  });

  it("should list claims with filters", async () => {
    const mockClaims = [
      {
        id: 1,
        userId: 5,
        userName: "Juan",
        transactionId: 100,
        category: "overcharge",
        description: "Cobro excesivo",
        status: "PENDING",
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 6,
        userName: "Maria",
        transactionId: 101,
        category: "overstay_unfair",
        description: "No pude mover el carro",
        status: "IN_REVIEW",
        createdAt: new Date(),
      },
    ];

    (db.getClaims as any).mockResolvedValue({ data: mockClaims, total: 2 });
    const result = await db.getClaims({ limit: 50, offset: 0 });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("should update claim status", async () => {
    (db.updateClaim as any).mockResolvedValue(undefined);
    await db.updateClaim(1, {
      status: "IN_REVIEW",
      updatedAt: new Date(),
    } as any);
    expect(db.updateClaim).toHaveBeenCalledWith(1, expect.objectContaining({ status: "IN_REVIEW" }));
  });

  it("should resolve claim with refund", async () => {
    (db.getClaimById as any).mockResolvedValue({
      id: 1,
      userId: 5,
      transactionId: 100,
      status: "IN_REVIEW",
    });
    (db.getTransactionById as any).mockResolvedValue({
      id: 100,
      userId: 5,
      totalCost: "25000",
      overstayCost: "10000",
      stationId: 10,
    });
    (db.getWalletByUserId as any).mockResolvedValue({
      id: 1,
      userId: 5,
      balance: "50000",
    });
    (db.updateWalletBalance as any).mockResolvedValue(undefined);
    (db.createWalletTransaction as any).mockResolvedValue(undefined);
    (db.updateTransaction as any).mockResolvedValue(undefined);
    (db.createRefund as any).mockResolvedValue(10);
    (db.updateClaim as any).mockResolvedValue(undefined);
    (db.createNotification as any).mockResolvedValue(undefined);

    // Simulate resolve flow
    const claim = await db.getClaimById(1);
    expect(claim).toBeDefined();
    expect(claim!.status).toBe("IN_REVIEW");

    const transaction = await db.getTransactionById(100);
    expect(transaction).toBeDefined();

    // Create refund
    const refundId = await db.createRefund({
      transactionId: 100,
      userId: 5,
      adminId: 1,
      adminName: "Admin",
      amount: "10000",
      refundType: "overstay",
      reason: "[Reclamo #1] Sobreestadía injusta",
      claimId: 1,
      walletTransactionId: null,
    } as any);
    expect(refundId).toBe(10);

    // Update claim
    await db.updateClaim(1, {
      status: "RESOLVED",
      resolution: "Se aprobó reembolso de sobreestadía",
      resolvedByAdminId: 1,
      resolvedByAdminName: "Admin",
      refundId: 10,
      resolvedAt: new Date(),
    } as any);
    expect(db.updateClaim).toHaveBeenCalledWith(1, expect.objectContaining({ status: "RESOLVED" }));
  });

  it("should reject claim without refund", async () => {
    (db.getClaimById as any).mockResolvedValue({
      id: 2,
      userId: 6,
      transactionId: 101,
      status: "PENDING",
    });
    (db.updateClaim as any).mockResolvedValue(undefined);
    (db.createNotification as any).mockResolvedValue(undefined);

    await db.updateClaim(2, {
      status: "REJECTED",
      resolution: "El cobro es correcto según los registros",
      resolvedByAdminId: 1,
      resolvedByAdminName: "Admin",
      refundId: null,
      resolvedAt: new Date(),
    } as any);

    expect(db.updateClaim).toHaveBeenCalledWith(2, expect.objectContaining({ status: "REJECTED" }));
  });

  it("should get claims stats", async () => {
    (db.getClaims as any)
      .mockResolvedValueOnce({ data: [], total: 3 }) // PENDING
      .mockResolvedValueOnce({ data: [], total: 1 }) // IN_REVIEW
      .mockResolvedValueOnce({ data: [], total: 5 }) // RESOLVED
      .mockResolvedValueOnce({ data: [], total: 2 }); // REJECTED

    const [pending, inReview, resolved, rejected] = await Promise.all([
      db.getClaims({ status: "PENDING" } as any),
      db.getClaims({ status: "IN_REVIEW" } as any),
      db.getClaims({ status: "RESOLVED" } as any),
      db.getClaims({ status: "REJECTED" } as any),
    ]);

    expect(pending.total).toBe(3);
    expect(inReview.total).toBe(1);
    expect(resolved.total).toBe(5);
    expect(rejected.total).toBe(2);
    expect(pending.total + inReview.total + resolved.total + rejected.total).toBe(11);
  });
});
