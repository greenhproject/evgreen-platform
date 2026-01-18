import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock all database functions used in routers
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getAllChargingStations: vi.fn().mockResolvedValue([]),
    getChargingStationById: vi.fn().mockResolvedValue(null),
    getNearbyStations: vi.fn().mockResolvedValue([]),
    getUserTransactions: vi.fn().mockResolvedValue([]),
    getTransactionById: vi.fn().mockResolvedValue(null),
    getUserReservations: vi.fn().mockResolvedValue([]),
    getWalletByUserId: vi.fn().mockResolvedValue({ id: 1, userId: 1, balance: "0", currency: "COP" }),
    getWalletTransactions: vi.fn().mockResolvedValue([]),
    getMaintenanceTickets: vi.fn().mockResolvedValue([]),
    getAllUsers: vi.fn().mockResolvedValue([]),
    getAllTariffs: vi.fn().mockResolvedValue([]),
    getActiveBanners: vi.fn().mockResolvedValue([]),
    getOcppLogs: vi.fn().mockResolvedValue([]),
    getMeterValues: vi.fn().mockResolvedValue([]),
    createWallet: vi.fn().mockResolvedValue({ id: 1 }),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: "user" | "admin" | "investor" | "technician" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth router", () => {
  describe("me", () => {
    it("returns null for anonymous user", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });

    it("returns user data for authenticated user", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(result?.role).toBe("user");
    });
  });

  describe("logout", () => {
    it("clears session cookie and returns success", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(ctx.res.clearCookie).toHaveBeenCalled();
    });
  });
});

describe("stations router", () => {
  describe("listAll", () => {
    it("returns empty array when no stations exist", async () => {
      const ctx = createMockContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.stations.listAll();

      expect(result).toEqual([]);
    });

    it("requires admin role", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.stations.listAll()).rejects.toThrow();
    });
  });

  describe("listOwned", () => {
    it("returns empty array for investor with no stations", async () => {
      const ctx = createMockContext("investor");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.stations.listOwned();

      expect(result).toEqual([]);
    });

    it("requires investor role", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.stations.listOwned()).rejects.toThrow();
    });
  });

  describe("listPublic", () => {
    it("returns empty array when no stations exist", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.stations.listPublic();

      expect(result).toEqual([]);
    });

    it("is accessible without authentication", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.stations.listPublic();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("wallet router", () => {
  describe("getMyWallet", () => {
    it("requires authentication", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.wallet.getMyWallet()).rejects.toThrow();
    });

    it("returns wallet for authenticated user", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.wallet.getMyWallet();

      // Should return null or wallet object
      expect(result === null || typeof result === "object").toBe(true);
    });
  });
});

describe("transactions router", () => {
  describe("myTransactions", () => {
    it("requires authentication", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.transactions.myTransactions()).rejects.toThrow();
    });

    it("returns transactions for authenticated user", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.transactions.myTransactions();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("reservations router", () => {
  describe("myReservations", () => {
    it("requires authentication", async () => {
      const ctx = createAnonymousContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.reservations.myReservations()).rejects.toThrow();
    });

    it("returns reservations for authenticated user", async () => {
      const ctx = createMockContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.reservations.myReservations();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("role-based access control", () => {
  it("admin can access admin procedures", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    await expect(caller.stations.listAll()).resolves.toBeDefined();
  });

  it("investor can access investor procedures", async () => {
    const ctx = createMockContext("investor");
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    await expect(caller.stations.listOwned()).resolves.toBeDefined();
  });

  it("technician can access technician procedures", async () => {
    const ctx = createMockContext("technician");
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    await expect(caller.maintenance.myTickets()).resolves.toBeDefined();
  });

  it("regular user cannot access admin procedures", async () => {
    const ctx = createMockContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.stations.listAll()).rejects.toThrow();
  });
});
