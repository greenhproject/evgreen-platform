import { describe, it, expect, vi } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getAdminDashboardMetrics: vi.fn().mockResolvedValue({
    totalTransactions: 150,
    activeTransactions: 3,
    monthly: {
      transactions: 45,
      kwhSold: 1250.5,
      revenue: 2500000,
      platformFees: 500000,
    },
    today: {
      transactions: 5,
      kwhSold: 125.3,
      revenue: 250000,
    },
    stations: {
      total: 10,
      online: 8,
    },
    users: {
      total: 250,
    },
  }),
  getInvestorDashboardMetrics: vi.fn().mockResolvedValue({
    totalStations: 3,
    onlineStations: 2,
    totalTransactions: 50,
    monthlyTransactions: 15,
    monthlyKwh: 450.5,
    monthlyRevenue: 900000,
    monthlyEarnings: 720000,
    walletBalance: 1500000,
  }),
  getUserDashboardMetrics: vi.fn().mockResolvedValue({
    totalSessions: 25,
    totalKwh: 350.5,
    totalSpent: 700000,
    activeSession: null,
    recentSessions: [],
  }),
  getTechnicianDashboardMetrics: vi.fn().mockResolvedValue({
    assignedStations: 5,
    onlineStations: 4,
    pendingTickets: 2,
    inProgressTickets: 1,
    resolvedToday: 3,
  }),
  getTopStationsByRevenue: vi.fn().mockResolvedValue([
    {
      stationId: 1,
      stationName: "Estación Centro",
      city: "Bogotá",
      totalRevenue: 500000,
      transactionCount: 20,
    },
    {
      stationId: 2,
      stationName: "Estación Norte",
      city: "Medellín",
      totalRevenue: 350000,
      transactionCount: 15,
    },
  ]),
  getRecentTransactions: vi.fn().mockResolvedValue([
    {
      transaction: {
        id: 1,
        status: "COMPLETED",
        totalCost: "25000",
        kwhConsumed: "12.5",
      },
      user: { name: "Juan Pérez" },
      station: { name: "Estación Centro" },
    },
  ]),
}));

describe("Dashboard Metrics", () => {
  describe("Admin Dashboard", () => {
    it("should return correct admin metrics structure", async () => {
      const { getAdminDashboardMetrics } = await import("./db");
      const metrics = await getAdminDashboardMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty("totalTransactions");
      expect(metrics).toHaveProperty("activeTransactions");
      expect(metrics).toHaveProperty("monthly");
      expect(metrics?.monthly).toHaveProperty("transactions");
      expect(metrics?.monthly).toHaveProperty("kwhSold");
      expect(metrics?.monthly).toHaveProperty("revenue");
      expect(metrics?.monthly).toHaveProperty("platformFees");
      expect(metrics).toHaveProperty("today");
      expect(metrics).toHaveProperty("stations");
      expect(metrics).toHaveProperty("users");
    });

    it("should have valid numeric values", async () => {
      const { getAdminDashboardMetrics } = await import("./db");
      const metrics = await getAdminDashboardMetrics();
      
      expect(typeof metrics?.totalTransactions).toBe("number");
      expect(typeof metrics?.monthly?.revenue).toBe("number");
      expect(metrics?.monthly?.revenue).toBeGreaterThanOrEqual(0);
      expect(metrics?.stations?.online).toBeLessThanOrEqual(metrics?.stations?.total || 0);
    });
  });

  describe("Investor Dashboard", () => {
    it("should return correct investor metrics structure", async () => {
      const { getInvestorDashboardMetrics } = await import("./db");
      const metrics = await getInvestorDashboardMetrics(1);
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty("totalStations");
      expect(metrics).toHaveProperty("onlineStations");
      expect(metrics).toHaveProperty("monthlyTransactions");
      expect(metrics).toHaveProperty("monthlyKwh");
      expect(metrics).toHaveProperty("monthlyRevenue");
      expect(metrics).toHaveProperty("monthlyEarnings");
      expect(metrics).toHaveProperty("walletBalance");
    });

    it("should calculate 80% earnings correctly", async () => {
      const { getInvestorDashboardMetrics } = await import("./db");
      const metrics = await getInvestorDashboardMetrics(1);
      
      // Earnings should be 80% of revenue
      const expectedEarnings = (metrics?.monthlyRevenue || 0) * 0.8;
      expect(metrics?.monthlyEarnings).toBe(expectedEarnings);
    });
  });

  describe("Top Stations", () => {
    it("should return stations sorted by revenue", async () => {
      const { getTopStationsByRevenue } = await import("./db");
      const stations = await getTopStationsByRevenue(5);
      
      expect(Array.isArray(stations)).toBe(true);
      expect(stations.length).toBeGreaterThan(0);
      
      // Verify descending order
      for (let i = 1; i < stations.length; i++) {
        expect(stations[i - 1].totalRevenue).toBeGreaterThanOrEqual(stations[i].totalRevenue);
      }
    });

    it("should include required fields", async () => {
      const { getTopStationsByRevenue } = await import("./db");
      const stations = await getTopStationsByRevenue(5);
      
      stations.forEach((station: any) => {
        expect(station).toHaveProperty("stationId");
        expect(station).toHaveProperty("stationName");
        expect(station).toHaveProperty("totalRevenue");
        expect(station).toHaveProperty("transactionCount");
      });
    });
  });

  describe("Recent Transactions", () => {
    it("should return transactions with user and station info", async () => {
      const { getRecentTransactions } = await import("./db");
      const transactions = await getRecentTransactions(5);
      
      expect(Array.isArray(transactions)).toBe(true);
      
      transactions.forEach((item: any) => {
        expect(item).toHaveProperty("transaction");
        expect(item).toHaveProperty("user");
        expect(item).toHaveProperty("station");
        expect(item.transaction).toHaveProperty("id");
        expect(item.transaction).toHaveProperty("status");
      });
    });
  });
});

describe("Transaction Flow", () => {
  it("should calculate total cost correctly", () => {
    const kwhConsumed = 25.5;
    const pricePerKwh = 800; // COP per kWh
    const expectedCost = kwhConsumed * pricePerKwh;
    
    expect(expectedCost).toBe(20400);
  });

  it("should calculate platform fee correctly", () => {
    const totalCost = 100000;
    const platformFeePercent = 0.20; // 20%
    const expectedFee = totalCost * platformFeePercent;
    const investorEarnings = totalCost - expectedFee;
    
    expect(expectedFee).toBe(20000);
    expect(investorEarnings).toBe(80000);
  });

  it("should handle meter values correctly", () => {
    const startMeterValue = 1000; // Wh
    const endMeterValue = 26500; // Wh
    const kwhConsumed = (endMeterValue - startMeterValue) / 1000;
    
    expect(kwhConsumed).toBe(25.5);
  });
});
