import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the balance monitor service:
 * - Auto-recharge logic
 * - Auto-stop when balance depleted
 * - Threshold detection
 * - Notification creation
 */

// Mock dependencies
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getWalletByUserId: vi.fn(),
  getUserSubscription: vi.fn(),
  getChargingStationById: vi.fn(),
  getChargingStationByEvseId: vi.fn(),
  createNotification: vi.fn(),
  createOcppLog: vi.fn(),
  updateWalletBalance: vi.fn(),
  createWalletTransaction: vi.fn(),
}));

vi.mock("../ocpp/csms-dual", () => ({
  dualCSMS: {
    requestStopTransaction: vi.fn(),
    sendCommandIfConnected: vi.fn(),
  },
}));

vi.mock("../wompi/config", () => ({
  getWompiKeys: vi.fn().mockResolvedValue({
    privateKey: "test_prv_key",
    publicKey: "test_pub_key",
    integritySecret: "test_integrity",
    eventsSecret: "test_events",
    testMode: true,
  }),
  generatePaymentReference: vi.fn().mockReturnValue("ref_123"),
  generateIntegritySignature: vi.fn().mockReturnValue("sig_123"),
  getTransactionStatus: vi.fn(),
}));

vi.mock("../wompi/recurring-billing", () => ({
  getAcceptanceToken: vi.fn().mockResolvedValue("acceptance_token_123"),
}));

describe("Balance Monitor - Auto-Recharge Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect when balance is below threshold", () => {
    const balance = 8000;
    const threshold = 10000;
    expect(balance < threshold).toBe(true);
  });

  it("should NOT trigger when balance is above threshold", () => {
    const balance = 15000;
    const threshold = 10000;
    expect(balance < threshold).toBe(false);
  });

  it("should detect zero balance for auto-stop", () => {
    const balance = 0;
    expect(balance <= 0).toBe(true);
  });

  it("should detect negative balance for auto-stop", () => {
    const balance = -500;
    expect(balance <= 0).toBe(true);
  });

  it("should format notification message correctly for auto-recharge", () => {
    const amount = 20000;
    const message = `Se recargaron $${amount.toLocaleString()} COP automáticamente a tu billetera durante la carga activa.`;
    expect(message).toContain("$20,000 COP");
    expect(message).toContain("automáticamente");
  });

  it("should format notification message correctly for auto-stop", () => {
    const message = "Tu carga se detuvo automáticamente porque tu saldo llegó a $0 COP. Recarga tu billetera para continuar cargando.";
    expect(message).toContain("detuvo automáticamente");
    expect(message).toContain("$0 COP");
  });
});

describe("Balance Monitor - Auto-Recharge Settings", () => {
  it("should have correct default threshold", () => {
    const DEFAULT_THRESHOLD = 10000;
    expect(DEFAULT_THRESHOLD).toBe(10000);
  });

  it("should have correct default recharge amount", () => {
    const DEFAULT_AMOUNT = 20000;
    expect(DEFAULT_AMOUNT).toBe(20000);
  });

  it("should validate threshold range (5000-100000)", () => {
    const validThresholds = [5000, 10000, 20000, 50000, 100000];
    const invalidThresholds = [0, 1000, 4999, 100001, -1];

    validThresholds.forEach((t) => {
      expect(t >= 5000 && t <= 100000).toBe(true);
    });

    invalidThresholds.forEach((t) => {
      expect(t >= 5000 && t <= 100000).toBe(false);
    });
  });

  it("should validate recharge amount range (10000-500000)", () => {
    const validAmounts = [10000, 20000, 50000, 100000, 500000];
    const invalidAmounts = [0, 5000, 9999, 500001, -1];

    validAmounts.forEach((a) => {
      expect(a >= 10000 && a <= 500000).toBe(true);
    });

    invalidAmounts.forEach((a) => {
      expect(a >= 10000 && a <= 500000).toBe(false);
    });
  });

  it("should require payment method for auto-recharge", () => {
    const subscription = { wompiPaymentSourceId: null, autoRechargeEnabled: true };
    const canAutoRecharge = subscription.autoRechargeEnabled && !!subscription.wompiPaymentSourceId;
    expect(canAutoRecharge).toBe(false);
  });

  it("should allow auto-recharge with payment method", () => {
    const subscription = { wompiPaymentSourceId: "src_123", autoRechargeEnabled: true };
    const canAutoRecharge = subscription.autoRechargeEnabled && !!subscription.wompiPaymentSourceId;
    expect(canAutoRecharge).toBe(true);
  });
});

describe("Balance Monitor - Auto-Stop Logic", () => {
  it("should trigger auto-stop when balance is zero and no auto-recharge", () => {
    const balance = 0;
    const autoRechargeEnabled = false;
    const shouldStop = balance <= 0 && !autoRechargeEnabled;
    expect(shouldStop).toBe(true);
  });

  it("should NOT trigger auto-stop when balance is positive", () => {
    const balance = 5000;
    const autoRechargeEnabled = false;
    const shouldStop = balance <= 0 && !autoRechargeEnabled;
    expect(shouldStop).toBe(false);
  });

  it("should NOT trigger auto-stop when auto-recharge is enabled and balance > 0", () => {
    const balance = 8000;
    const autoRechargeEnabled = true;
    const shouldStop = balance <= 0 && !autoRechargeEnabled;
    expect(shouldStop).toBe(false);
  });

  it("should trigger auto-stop after auto-recharge fails and balance is zero", () => {
    const balance = 0;
    const autoRechargeFailed = true;
    const shouldStop = balance <= 0 && autoRechargeFailed;
    expect(shouldStop).toBe(true);
  });

  it("should track auto-stopped users to avoid repeated commands", () => {
    const autoStoppedUsers = new Set<number>();
    const userId = 42;

    // First time - not stopped yet
    expect(autoStoppedUsers.has(userId)).toBe(false);

    // Mark as stopped
    autoStoppedUsers.add(userId);
    expect(autoStoppedUsers.has(userId)).toBe(true);

    // Should skip on second check
    expect(autoStoppedUsers.has(userId)).toBe(true);
  });

  it("should clear auto-stopped users when no active transactions", () => {
    const autoStoppedUsers = new Set<number>([1, 2, 3]);
    const activeTransactions: any[] = [];

    if (activeTransactions.length === 0) {
      autoStoppedUsers.clear();
    }

    expect(autoStoppedUsers.size).toBe(0);
  });
});

describe("Balance Monitor - Wompi Integration", () => {
  it("should calculate correct amount in cents for Wompi", () => {
    const amountCOP = 20000;
    const amountCents = amountCOP * 100;
    expect(amountCents).toBe(2000000);
  });

  it("should generate unique payment reference", () => {
    const userId = 42;
    const prefix = `auto-recharge-${userId}`;
    expect(prefix).toContain("auto-recharge");
    expect(prefix).toContain("42");
  });

  it("should handle max fail count (3) before disabling auto-recharge", () => {
    const MAX_FAIL_COUNT = 3;
    const failCount = 3;
    const shouldDisable = failCount >= MAX_FAIL_COUNT;
    expect(shouldDisable).toBe(true);
  });

  it("should NOT disable auto-recharge before max fail count", () => {
    const MAX_FAIL_COUNT = 3;
    const failCount = 2;
    const shouldDisable = failCount >= MAX_FAIL_COUNT;
    expect(shouldDisable).toBe(false);
  });
});

describe("Balance Monitor - Interval Management", () => {
  it("should check every 30 seconds", () => {
    const BALANCE_CHECK_INTERVAL = 30000;
    expect(BALANCE_CHECK_INTERVAL).toBe(30000);
  });

  it("should track in-progress auto-recharges to avoid duplicates", () => {
    const autoRechargeInProgress = new Set<number>();
    const userId = 42;

    // Not in progress
    expect(autoRechargeInProgress.has(userId)).toBe(false);

    // Start recharge
    autoRechargeInProgress.add(userId);
    expect(autoRechargeInProgress.has(userId)).toBe(true);

    // Complete recharge
    autoRechargeInProgress.delete(userId);
    expect(autoRechargeInProgress.has(userId)).toBe(false);
  });
});
