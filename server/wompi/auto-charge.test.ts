import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de db
vi.mock("../db", () => ({
  getWalletByUserId: vi.fn(),
  getUserSubscription: vi.fn(),
  getUserById: vi.fn(),
  updateWalletBalance: vi.fn(),
  createWalletTransaction: vi.fn(),
  createWompiTransaction: vi.fn(),
  updateWompiTransactionByReference: vi.fn(),
  createNotification: vi.fn(),
}));

// Mock de config
vi.mock("./config", () => ({
  getWompiKeys: vi.fn(),
  generatePaymentReference: vi.fn().mockReturnValue("ATC-TEST-123"),
  generateIntegritySignature: vi.fn().mockReturnValue("test-signature-hash"),
}));

// Mock de recurring-billing (getAcceptanceToken)
vi.mock("./recurring-billing", () => ({
  getAcceptanceToken: vi.fn().mockResolvedValue({
    acceptanceToken: "test-acceptance-token",
    personalAuthToken: "test-personal-auth-token",
    permalink: "https://wompi.co/terms",
  }),
}));

// Mock de fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { autoChargeIfNeeded } from "./auto-charge";
import * as db from "../db";
import { getWompiKeys } from "./config";
import { getAcceptanceToken } from "./recurring-billing";

describe("autoChargeIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock for getAcceptanceToken
    vi.mocked(getAcceptanceToken).mockResolvedValue({
      acceptanceToken: "test-acceptance-token",
      personalAuthToken: "test-personal-auth-token",
      permalink: "https://wompi.co/terms",
    });
  });

  it("should return null if wallet has sufficient balance", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "50000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await autoChargeIfNeeded(1, 30000);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return null if user has no wallet", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue(null as any);

    const result = await autoChargeIfNeeded(1, 30000);
    expect(result).toBeNull();
  });

  it("should return null if user has no saved card (no payment source)", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "FREE",
      wompiPaymentSourceId: null,
      cardLastFour: null,
    } as any);

    const result = await autoChargeIfNeeded(1, 30000);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return null if Wompi is not configured", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue(null);

    const result = await autoChargeIfNeeded(1, 30000);
    expect(result).toBeNull();
  });

  it("should charge the card and return success when balance is insufficient", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "tx-wompi-auto-001",
            status: "APPROVED",
            payment_method_type: "CARD",
          },
        }),
    });

    vi.mocked(db.createWompiTransaction).mockResolvedValue(1 as any);
    vi.mocked(db.updateWompiTransactionByReference).mockResolvedValue(undefined as any);
    vi.mocked(db.updateWalletBalance).mockResolvedValue(undefined as any);
    vi.mocked(db.createWalletTransaction).mockResolvedValue(undefined as any);
    vi.mocked(db.createNotification).mockResolvedValue(undefined as any);

    const result = await autoChargeIfNeeded(1, 30000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    // Deficit is 25000, + 5000 margin = 30000, rounded up to nearest 1000 = 30000
    expect(result!.amountCharged).toBe(30000);
    expect(result!.newBalance).toBe(35000); // 5000 + 30000
    expect(result!.reference).toBe("ATC-TEST-123");

    // Verify acceptance token was obtained
    expect(getAcceptanceToken).toHaveBeenCalled();

    // Verify Wompi API was called with acceptance_token and signature
    expect(mockFetch).toHaveBeenCalledWith(
      "https://sandbox.wompi.co/v1/transactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer prv_test_123",
        }),
      })
    );

    // Verify the body includes acceptance_token and signature
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.acceptance_token).toBe("test-acceptance-token");
    expect(body.signature).toBe("test-signature-hash");
    expect(body.payment_method.type).toBe("CARD");

    // Verify wallet was updated
    expect(db.updateWalletBalance).toHaveBeenCalledWith(1, "35000");

    // Verify notification was created
    expect(db.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        title: "Auto-recarga exitosa",
        type: "PAYMENT",
      })
    );
  });

  it("should enforce minimum charge of $10,000", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "9000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "tx-wompi-auto-002",
            status: "APPROVED",
            payment_method_type: "CARD",
          },
        }),
    });

    vi.mocked(db.createWompiTransaction).mockResolvedValue(1 as any);
    vi.mocked(db.updateWompiTransactionByReference).mockResolvedValue(undefined as any);
    vi.mocked(db.updateWalletBalance).mockResolvedValue(undefined as any);
    vi.mocked(db.createWalletTransaction).mockResolvedValue(undefined as any);
    vi.mocked(db.createNotification).mockResolvedValue(undefined as any);

    const result = await autoChargeIfNeeded(1, 10000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    // Deficit is 1000, + 5000 margin = 6000, but minimum is 10000
    expect(result!.amountCharged).toBe(10000);
    expect(result!.newBalance).toBe(19000); // 9000 + 10000
  });

  it("should return failure when Wompi API returns error", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve("Invalid payment source"),
    });

    const result = await autoChargeIfNeeded(1, 30000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.amountCharged).toBe(0);
    expect(result!.newBalance).toBe(5000);
    expect(result!.error).toContain("422");
  });

  it("should handle DECLINED transaction status", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "tx-wompi-auto-003",
            status: "DECLINED",
            payment_method_type: "CARD",
          },
        }),
    });

    vi.mocked(db.createWompiTransaction).mockResolvedValue(1 as any);
    vi.mocked(db.updateWompiTransactionByReference).mockResolvedValue(undefined as any);

    const result = await autoChargeIfNeeded(1, 30000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain("DECLINED");
    // Wallet should NOT be updated
    expect(db.updateWalletBalance).not.toHaveBeenCalled();
  });

  it("should handle PENDING transaction status", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "tx-wompi-auto-004",
            status: "PENDING",
            payment_method_type: "CARD",
          },
        }),
    });

    vi.mocked(db.createWompiTransaction).mockResolvedValue(1 as any);
    vi.mocked(db.updateWompiTransactionByReference).mockResolvedValue(undefined as any);

    const result = await autoChargeIfNeeded(1, 30000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain("pendiente");
    // Wallet should NOT be updated for pending
    expect(db.updateWalletBalance).not.toHaveBeenCalled();
  });

  it("should return failure when acceptance token cannot be obtained", async () => {
    vi.mocked(db.getWalletByUserId).mockResolvedValue({
      id: 1,
      userId: 1,
      balance: "5000",
      currency: "COP",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(db.getUserSubscription).mockResolvedValue({
      id: 1,
      userId: 1,
      tier: "BASIC",
      wompiPaymentSourceId: "ps_123",
      cardLastFour: "4242",
    } as any);

    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "user@test.com",
    } as any);

    vi.mocked(getWompiKeys).mockResolvedValue({
      publicKey: "pub_test_123",
      privateKey: "prv_test_123",
      integritySecret: "test_integrity",
      eventsSecret: "test_events",
      testMode: true,
      apiUrl: "https://sandbox.wompi.co/v1",
    });

    // Mock getAcceptanceToken to return null
    vi.mocked(getAcceptanceToken).mockResolvedValue(null as any);

    const result = await autoChargeIfNeeded(1, 30000);

    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain("token de aceptación");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
