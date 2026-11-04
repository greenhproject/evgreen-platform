import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

// No real DB module is imported, including when appRouter builds sibling routers.
vi.mock("../db", () => ({
  getTransactionById: vi.fn(),
  getChargingStationById: vi.fn(),
  getEvseById: vi.fn(),
  getTariffById: vi.fn(),
  getEffectiveStationPrice: vi.fn(),
  getDb: vi.fn(() => {
    throw new Error("This unit test must never open a database connection");
  }),
}));

// Keep appRouter, transactions.getById and auth middleware REAL. These unrelated
// routers/services are isolated to avoid OCPP, push, network and startup jobs.
vi.mock("../_core/auth0", () => ({ deleteAuth0User: vi.fn() }));
vi.mock("../_core/systemRouter", async () => {
  const { router } = await import("../_core/trpc");
  return { systemRouter: router({}) };
});
vi.mock("../financial/financial-router", async () => {
  const { router } = await import("../_core/trpc");
  return { buildFinancialRouter: () => router({}) };
});
vi.mock("../ai/ai-router", async () => {
  const { router } = await import("../_core/trpc");
  return { aiRouter: router({}) };
});
vi.mock("../wompi/router", async () => {
  const { router } = await import("../_core/trpc");
  return { wompiRouter: router({}) };
});
vi.mock("../ocpp/ocpp-router", async () => {
  const { router } = await import("../_core/trpc");
  return { ocppRouter: router({}) };
});
vi.mock("../ocpp/csms-dual", () => ({ dualCSMS: {} }));
vi.mock("../ocpp/connection-manager", () => ({}));
vi.mock("../charging/charging-router", async () => {
  const { router } = await import("../_core/trpc");
  return {
    chargingRouter: router({}),
    getAllActiveSessionsPower: vi.fn(),
    recalibrateManualSocTransaction: vi.fn(),
  };
});
vi.mock("../push/push-router", async () => {
  const { router } = await import("../_core/trpc");
  return { pushRouter: router({}) };
});
vi.mock("../backup/backup-router", async () => {
  const { router } = await import("../_core/trpc");
  return { backupRouter: router({}), startAutomaticBackups: vi.fn() };
});
vi.mock("../reports/export-transactions", () => ({
  generateExcelReport: vi.fn(),
  generatePDFReport: vi.fn(),
}));
vi.mock("../notifications/broadcast-service", () => ({
  sendBroadcastNotification: vi.fn(),
  getNotificationStats: vi.fn(),
  getBroadcastHistory: vi.fn(),
}));
vi.mock("../crowdfunding/progress-notifications", () => ({
  checkAndNotifyMilestones: vi.fn(),
}));
vi.mock("../investor-onboarding/email-service", () => ({
  triggerInvestorWelcome: vi.fn(),
}));
vi.mock("../investor-onboarding/onboarding-router", async () => {
  const { router } = await import("../_core/trpc");
  return { onboardingRouter: router({}) };
});
vi.mock("../event/event-router", async () => {
  const { router } = await import("../_core/trpc");
  return { eventRouter: router({}) };
});
vi.mock("../support/support-router", async () => {
  const { router } = await import("../_core/trpc");
  return { supportRouterV2: router({}) };
});
vi.mock("../quotes/quotes-router", async () => {
  const { router } = await import("../_core/trpc");
  return { quotesRouter: router({}) };
});
vi.mock("../spaces/spaces-router", async () => {
  const { router } = await import("../_core/trpc");
  return { spacesRouter: router({}) };
});
vi.mock("../gestor/gestor-router", async () => {
  const { router } = await import("../_core/trpc");
  return { gestorRouter: router({}) };
});
vi.mock("../partners/partners-router", async () => {
  const { router } = await import("../_core/trpc");
  return { partnersRouter: router({}) };
});
vi.mock("../contact/contact-router", async () => {
  const { router } = await import("../_core/trpc");
  return { contactRouter: router({}) };
});
vi.mock("../banners/campaign-wizard-router", async () => {
  const { router } = await import("../_core/trpc");
  return { campaignWizardRouter: router({}) };
});
vi.mock("../routers/advertiser", async () => {
  const { router } = await import("../_core/trpc");
  return { advertiserRouter: router({}), adminAdvertiserRouter: router({}) };
});
vi.mock("../contracts/contracts-router", async () => {
  const { router } = await import("../_core/trpc");
  return { contractsRouter: router({}) };
});
vi.mock("../reservations/reservation-receipt-pdf", () => ({
  generateReservationReceiptPdf: vi.fn(),
}));

import * as db from "../db";
import { appRouter } from "../routers";

type Transaction = NonNullable<Awaited<ReturnType<typeof db.getTransactionById>>>;

// Values describe an in-memory regression fixture only, NOT production records.
const transactionFixture = {
  id: 1170006,
  userId: 570001,
  stationId: 91,
  evseId: 92,
  tariffId: 93,
  startTime: "2026-11-04 01:48:15",
  endTime: "2026-11-04 08:26:17",
  kwhConsumed: "31.9220",
  appliedPricePerKwh: "1103.92",
  energyCost: "35200.89",
  timeCost: "0.00",
  sessionCost: "2000.00",
  overstayCost: "41.00",
  totalCost: "37241.89",
  investorShare: "29793.51",
  platformFee: "7448.38",
  status: "COMPLETED",
  chargeMode: "full_charge",
  targetValue: "0.00",
  startMethod: "APP",
  stopReason: "REMOTE",
} satisfies Partial<Transaction>;

function context(userId: number | null = transactionFixture.userId): TrpcContext {
  return {
    user: userId === null ? null : ({
      id: userId,
      openId: `charging-summary-fixture-${userId}`,
      name: "Synthetic receipt owner",
      email: "charging-summary@example.invalid",
      role: "user",
      loginMethod: "fixture",
      createdAt: "2026-11-04 00:00:00",
      updatedAt: "2026-11-04 00:00:00",
      lastSignedIn: "2026-11-04 00:00:00",
    } as NonNullable<TrpcContext["user"]>),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function mockTransaction(overrides: Partial<Transaction> = {}) {
  const transaction = { ...transactionFixture, ...overrides } as Transaction;
  vi.mocked(db.getTransactionById).mockResolvedValue(transaction);
  return transaction;
}

function expectNoReceiptLookups() {
  expect(db.getChargingStationById).not.toHaveBeenCalled();
  expect(db.getEvseById).not.toHaveBeenCalled();
  expect(db.getTariffById).not.toHaveBeenCalled();
  expect(db.getEffectiveStationPrice).not.toHaveBeenCalled();
}

describe("transactions.getById: real charging summary query", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Exercise SQL strings under a non-UTC server timezone, not just by chance
    // on UTC CI. Date serialization must explicitly interpret persistence as UTC.
    vi.stubEnv("TZ", "America/Bogota");
    vi.mocked(db.getDb).mockImplementation(() => {
      throw new Error("This unit test must never open a database connection");
    });
    mockTransaction();
    vi.mocked(db.getChargingStationById).mockResolvedValue({
      id: 91, name: "Synthetic station", address: "Fixture address", city: "Bogotá",
    } as Awaited<ReturnType<typeof db.getChargingStationById>>);
    vi.mocked(db.getEvseById).mockResolvedValue({
      id: 92, connectorId: 2, connectorType: "TYPE_2", chargeType: "AC",
    } as Awaited<ReturnType<typeof db.getEvseById>>);
    // Reference prices deliberately differ from the persisted billing snapshot.
    vi.mocked(db.getTariffById).mockResolvedValue({
      id: 93, pricePerKwh: "1500.00",
    } as Awaited<ReturnType<typeof db.getTariffById>>);
    vi.mocked(db.getEffectiveStationPrice).mockResolvedValue({
      pricePerKwh: 1800,
      connectionFee: 2500,
      overstayPenaltyPerMin: 100,
      reservationFee: 0,
      tariffId: 93,
      autoPricing: false,
      source: "station",
    });
  });

  afterEach(() => {
    expect(db.getDb).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns exact UTC ISO dates, 398 minutes, rounded kWh and unchanged billed total for Drizzle strings", async () => {
    const original = mockTransaction();
    const caller = appRouter.createCaller(context());

    const result = await caller.transactions.getById({ id: 1170006 });

    expect(result).toMatchObject({
      id: 1170006,
      startTime: "2026-11-04T01:48:15.000Z",
      endTime: "2026-11-04T08:26:17.000Z",
      durationMinutes: 398,
      kwhConsumed: "31.92",
      totalCost: 37241.89,
      status: "COMPLETED",
    });
    expect(original).toMatchObject(transactionFixture);
    expect(db.getTransactionById).toHaveBeenCalledTimes(1);
    expect(db.getTransactionById).toHaveBeenCalledWith(1170006);
    expect(db.getChargingStationById).toHaveBeenCalledTimes(1);
    expect(db.getChargingStationById).toHaveBeenCalledWith(91);
    expect(db.getEvseById).toHaveBeenCalledTimes(1);
    expect(db.getEvseById).toHaveBeenCalledWith(92);
    expect(db.getTariffById).toHaveBeenCalledTimes(1);
    expect(db.getTariffById).toHaveBeenCalledWith(93);
    expect(db.getEffectiveStationPrice).toHaveBeenCalledTimes(1);
    expect(db.getEffectiveStationPrice).toHaveBeenCalledWith(91);
  });

  it("preserves applied price and every cost snapshot instead of recalculating using current tariffs", async () => {
    const result = await appRouter.createCaller(context()).transactions.getById({ id: 1170006 });

    expect(result).toMatchObject({
      appliedPricePerKwh: 1103.92,
      pricePerKwh: 1500,
      energyCost: 35200.89,
      timeCost: 0,
      sessionCost: 2000,
      overstayCost: 41,
      totalCost: 37241.89,
      investorShare: 29793.51,
      platformFee: 7448.38,
      connectionFee: 2500,
      overstayPenaltyPerMin: 100,
      chargeMode: "full_charge",
      targetValue: 0,
      startMethod: "APP",
      stopReason: "REMOTE",
      paymentMethod: "wallet",
    });
  });

  it("includes zero-valued applied price and cost snapshots without falling back to a nonzero tariff", async () => {
    mockTransaction({
      appliedPricePerKwh: "0.00",
      energyCost: "0.00",
      timeCost: "0.00",
      sessionCost: "0.00",
      overstayCost: "0.00",
      totalCost: "0.00",
      investorShare: "0.00",
      platformFee: "0.00",
    });

    const result = await appRouter.createCaller(context()).transactions.getById({ id: 1170006 });

    expect(result).toMatchObject({
      appliedPricePerKwh: 0,
      pricePerKwh: 1500,
      energyCost: 0,
      timeCost: 0,
      sessionCost: 0,
      overstayCost: 0,
      totalCost: 0,
      investorShare: 0,
      platformFee: 0,
    });
  });

  it("keeps null endTime for IN_PROGRESS and calculates elapsed minutes from a fixed clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T08:26:17.000Z"));
    mockTransaction({ endTime: null, status: "IN_PROGRESS" });

    try {
      const result = await appRouter.createCaller(context()).transactions.getById({ id: 1170006 });
      expect(result).toMatchObject({
        startTime: "2026-11-04T01:48:15.000Z",
        endTime: null,
        durationMinutes: 398,
        status: "IN_PROGRESS",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("remains compatible with legacy Date instances from a different driver", async () => {
    mockTransaction({
      startTime: new Date("2026-11-04T01:48:15.000Z") as any,
      endTime: new Date("2026-11-04T08:26:17.000Z") as any,
    });

    const result = await appRouter.createCaller(context()).transactions.getById({ id: 1170006 });

    expect(result).toMatchObject({
      startTime: "2026-11-04T01:48:15.000Z",
      endTime: "2026-11-04T08:26:17.000Z",
      durationMinutes: 398,
      kwhConsumed: "31.92",
      totalCost: 37241.89,
    });
  });

  it("returns NOT_FOUND for an absent transaction before querying receipt details", async () => {
    vi.mocked(db.getTransactionById).mockResolvedValue(undefined);

    await expect(appRouter.createCaller(context()).transactions.getById({ id: 1170006 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.getTransactionById).toHaveBeenCalledTimes(1);
    expect(db.getTransactionById).toHaveBeenCalledWith(1170006);
    expectNoReceiptLookups();
  });

  it("returns FORBIDDEN to another owner before querying receipt details", async () => {
    await expect(appRouter.createCaller(context(570002)).transactions.getById({ id: 1170006 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.getTransactionById).toHaveBeenCalledTimes(1);
    expect(db.getTransactionById).toHaveBeenCalledWith(1170006);
    expectNoReceiptLookups();
  });

  it("runs the real auth middleware and returns UNAUTHORIZED without looking up a transaction", async () => {
    await expect(appRouter.createCaller(context(null)).transactions.getById({ id: 1170006 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(db.getTransactionById).not.toHaveBeenCalled();
    expectNoReceiptLookups();
  });
});
