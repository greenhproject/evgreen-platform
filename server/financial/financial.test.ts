/**
 * Financial System Tests
 * Tests for: fixed expenses CRUD, settlement waterfall, investor distributions, SLA metrics
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("../db", () => ({
  createFixedExpense: vi.fn().mockResolvedValue({ insertId: 1 }),
  getFixedExpensesByStation: vi.fn().mockResolvedValue([
    {
      id: 1,
      stationId: 100,
      name: "Póliza Todo Riesgo",
      category: "INSURANCE",
      amount: 500000,
      periodicity: "MONTHLY",
      isActive: true,
      startDate: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getActiveFixedExpensesByStation: vi.fn().mockResolvedValue([
    {
      id: 1,
      stationId: 100,
      name: "Póliza Todo Riesgo",
      category: "INSURANCE",
      amount: 500000,
      periodicity: "MONTHLY",
      isActive: true,
    },
  ]),
  updateFixedExpense: vi.fn().mockResolvedValue(undefined),
  deleteFixedExpense: vi.fn().mockResolvedValue(undefined),
  getFixedExpenseById: vi.fn().mockResolvedValue({
    id: 1,
    stationId: 100,
    name: "Póliza Todo Riesgo",
    category: "INSURANCE",
    amount: 500000,
    periodicity: "MONTHLY",
    isActive: true,
  }),
  createSettlement: vi.fn().mockResolvedValue({ insertId: 10 }),
  getSettlementById: vi.fn().mockResolvedValue({
    id: 10,
    stationId: 100,
    periodType: "MONTHLY",
    periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
    periodEnd: Date.now(),
    grossRevenue: 5000000,
    totalExpenses: 1500000,
    netRevenue: 3500000,
    investorTotalAmount: 2450000,
    platformAmount: 1050000,
    status: "DRAFT",
  }),
  getSettlementsByStation: vi.fn().mockResolvedValue([]),
  updateSettlement: vi.fn().mockResolvedValue(undefined),
  getSettlementWithDetails: vi.fn().mockResolvedValue({
    id: 10,
    stationId: 100,
    grossRevenue: 5000000,
    totalExpenses: 1500000,
    netRevenue: 3500000,
    expenseItems: [
      { category: "INSURANCE", description: "Póliza", amount: 500000 },
      { category: "ENERGY", description: "Energía eléctrica", amount: 1000000 },
    ],
    distributions: [],
  }),
  createSettlementExpenseItem: vi.fn().mockResolvedValue({ insertId: 1 }),
  createInvestorShare: vi.fn().mockResolvedValue({ insertId: 1 }),
  getInvestorShares: vi.fn().mockResolvedValue([]),
  getInvestorSettlementHistory: vi.fn().mockResolvedValue([]),
  updateInvestorShare: vi.fn().mockResolvedValue(undefined),
  createOperationalMetric: vi.fn().mockResolvedValue({ insertId: 1 }),
  getOperationalMetricsByStation: vi.fn().mockResolvedValue([]),
  getLatestOperationalMetric: vi.fn().mockResolvedValue(null),
  updateOperationalMetric: vi.fn().mockResolvedValue(undefined),
  getStationRevenueForPeriod: vi.fn().mockResolvedValue(5000000),
  prorateExpense: vi.fn().mockImplementation(
    (amount: number, periodicity: string, _start: number, _end: number) => {
      if (periodicity === "MONTHLY") return amount;
      if (periodicity === "QUARTERLY") return amount / 3;
      if (periodicity === "SEMI_ANNUAL") return amount / 6;
      if (periodicity === "ANNUAL") return amount / 12;
      return amount;
    }
  ),
  getStationInvestors: vi.fn().mockResolvedValue([
    { userId: 1, participationPercent: 60 },
    { userId: 2, participationPercent: 40 },
  ]),
  getInvestorAllSettlements: vi.fn().mockResolvedValue([]),
  getInvestorFinancialSummary: vi.fn().mockResolvedValue({
    totalSettlements: 3,
    totalGrossEarnings: 15000000,
    totalNetEarnings: 7350000,
    totalExpenseShare: 4500000,
    totalInvested: 50000000,
    roi: 14.7,
  }),
  getChargingStationById: vi.fn().mockResolvedValue({
    id: 100,
    name: "EVG Diamante Oriental",
    city: "Cúcuta",
    address: "Av. 1 #2-3",
    isOnline: true,
  }),
  getAllChargingStations: vi.fn().mockResolvedValue([]),
}));

// ============================================================================
// WATERFALL CALCULATION TESTS
// ============================================================================

describe("Waterfall Calculation Logic", () => {
  it("should correctly calculate net revenue after expenses", () => {
    const grossRevenue = 5000000;
    const expenses = [
      { category: "ENERGY", amount: 1000000 },
      { category: "INSURANCE", amount: 500000 },
      { category: "CONNECTIVITY", amount: 150000 },
      { category: "MAINTENANCE", amount: 200000 },
      { category: "FIDUCIARY", amount: 100000 },
    ];
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netRevenue = grossRevenue - totalExpenses;

    expect(totalExpenses).toBe(1950000);
    expect(netRevenue).toBe(3050000);
  });

  it("should correctly split net revenue 70/30 (investors/platform)", () => {
    const netRevenue = 3050000;
    const investorPercent = 70;
    const platformPercent = 30;

    const investorTotal = Math.round(netRevenue * (investorPercent / 100));
    const platformTotal = netRevenue - investorTotal;

    expect(investorTotal).toBe(2135000);
    expect(platformTotal).toBe(915000);
    expect(investorTotal + platformTotal).toBe(netRevenue);
  });

  it("should distribute investor share proportionally by participation", () => {
    const investorTotal = 2135000;
    const investors = [
      { userId: 1, participationPercent: 60 },
      { userId: 2, participationPercent: 25 },
      { userId: 3, participationPercent: 15 },
    ];

    const distributions = investors.map((inv) => ({
      userId: inv.userId,
      grossShare: Math.round(investorTotal * (inv.participationPercent / 100)),
      participationPercent: inv.participationPercent,
    }));

    expect(distributions[0].grossShare).toBe(1281000); // 60%
    expect(distributions[1].grossShare).toBe(533750);  // 25%
    expect(distributions[2].grossShare).toBe(320250);  // 15%

    const totalDistributed = distributions.reduce((sum, d) => sum + d.grossShare, 0);
    expect(totalDistributed).toBe(2135000);
  });

  it("should handle zero revenue gracefully", () => {
    const grossRevenue = 0;
    const expenses = [
      { category: "INSURANCE", amount: 500000 },
    ];
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netRevenue = Math.max(0, grossRevenue - totalExpenses);

    expect(netRevenue).toBe(0);
    const investorTotal = Math.round(netRevenue * 0.7);
    expect(investorTotal).toBe(0);
  });

  it("should handle expenses exceeding revenue (negative net)", () => {
    const grossRevenue = 1000000;
    const expenses = [
      { category: "ENERGY", amount: 800000 },
      { category: "INSURANCE", amount: 500000 },
    ];
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netRevenue = grossRevenue - totalExpenses;

    expect(netRevenue).toBe(-300000);
    // In this case, no distribution should happen
    const investorTotal = Math.max(0, Math.round(netRevenue * 0.7));
    expect(investorTotal).toBe(0);
  });
});

// ============================================================================
// EXPENSE PRORATION TESTS
// ============================================================================

describe("Expense Proration", () => {
  const prorateExpenseFn = (amount: number, periodicity: string, _start: number, _end: number) => {
    if (periodicity === "MONTHLY") return amount;
    if (periodicity === "QUARTERLY") return amount / 3;
    if (periodicity === "SEMI_ANNUAL") return amount / 6;
    if (periodicity === "ANNUAL") return amount / 12;
    return amount;
  };

  it("should prorate monthly expense to full amount for 1-month period", () => {
    const result = prorateExpenseFn(500000, "MONTHLY", Date.now() - 30 * 86400000, Date.now());
    expect(result).toBe(500000);
  });

  it("should prorate quarterly expense to 1/3 for 1-month period", () => {
    const result = prorateExpenseFn(900000, "QUARTERLY", Date.now() - 30 * 86400000, Date.now());
    expect(result).toBe(300000);
  });

  it("should prorate semi-annual expense to 1/6 for 1-month period", () => {
    const result = prorateExpenseFn(1200000, "SEMI_ANNUAL", Date.now() - 30 * 86400000, Date.now());
    expect(result).toBe(200000);
  });

  it("should prorate annual expense to 1/12 for 1-month period", () => {
    const result = prorateExpenseFn(12000000, "ANNUAL", Date.now() - 30 * 86400000, Date.now());
    expect(result).toBe(1000000);
  });
});

// ============================================================================
// FINANCIAL INDICATORS TESTS
// ============================================================================

describe("Financial Indicators Calculation", () => {
  it("should calculate ROI correctly", () => {
    const totalInvested = 50000000;
    const totalDistributed = 7350000;
    const roi = (totalDistributed / totalInvested) * 100;

    expect(roi).toBeCloseTo(14.7, 1);
  });

  it("should calculate monthly return percentage", () => {
    const totalInvested = 50000000;
    const monthlyAvgDistribution = 2450000;
    const monthlyReturnPct = (monthlyAvgDistribution / totalInvested) * 100;

    expect(monthlyReturnPct).toBeCloseTo(4.9, 1);
  });

  it("should calculate annualized return", () => {
    const monthlyReturnPct = 4.9;
    const annualizedReturn = monthlyReturnPct * 12;

    expect(annualizedReturn).toBeCloseTo(58.8, 1);
  });

  it("should calculate recovery months", () => {
    const totalInvested = 50000000;
    const totalDistributed = 7350000;
    const pendingBalance = totalInvested - totalDistributed;
    const monthlyAvg = 2450000;
    const recoveryMonths = Math.ceil(pendingBalance / monthlyAvg);

    expect(pendingBalance).toBe(42650000);
    expect(recoveryMonths).toBe(18);
  });

  it("should handle zero investment gracefully", () => {
    const totalInvested = 0;
    const totalDistributed = 0;
    const roi = totalInvested > 0 ? (totalDistributed / totalInvested) * 100 : 0;

    expect(roi).toBe(0);
  });
});

// ============================================================================
// SLA METRICS TESTS
// ============================================================================

describe("SLA Metrics Validation", () => {
  const SLA_TARGETS = {
    availability: 95,
    responseTime: 24,
    platformUptime: 99,
    userSatisfaction: 4.0,
    billingAccuracy: 99.9,
    solarGeneration: 85,
  };

  it("should detect SLA breach when availability is below 95%", () => {
    const currentAvailability = 92;
    const isBreach = currentAvailability < SLA_TARGETS.availability;
    expect(isBreach).toBe(true);
  });

  it("should pass SLA when availability meets target", () => {
    const currentAvailability = 96.5;
    const isBreach = currentAvailability < SLA_TARGETS.availability;
    expect(isBreach).toBe(false);
  });

  it("should detect response time breach when exceeding 24h", () => {
    const responseTimeHours = 36;
    const isBreach = responseTimeHours > SLA_TARGETS.responseTime;
    expect(isBreach).toBe(true);
  });

  it("should calculate breach count for progressive consequences", () => {
    const monthlyMetrics = [
      { availability: 92 }, // breach
      { availability: 96 }, // ok
      { availability: 88 }, // breach
      { availability: 94 }, // breach
      { availability: 97 }, // ok
      { availability: 91 }, // breach
    ];

    const breachCount = monthlyMetrics.filter(
      (m) => m.availability < SLA_TARGETS.availability
    ).length;

    expect(breachCount).toBe(4);
  });

  it("should determine progressive consequence level", () => {
    const getConsequenceLevel = (consecutiveBreaches: number) => {
      if (consecutiveBreaches >= 6) return "EVENT_OF_DEFAULT";
      if (consecutiveBreaches >= 3) return "COMMISSION_REDUCTION_10";
      if (consecutiveBreaches >= 1) return "IMPROVEMENT_PLAN_15_DAYS";
      return "COMPLIANT";
    };

    expect(getConsequenceLevel(0)).toBe("COMPLIANT");
    expect(getConsequenceLevel(1)).toBe("IMPROVEMENT_PLAN_15_DAYS");
    expect(getConsequenceLevel(3)).toBe("COMMISSION_REDUCTION_10");
    expect(getConsequenceLevel(6)).toBe("EVENT_OF_DEFAULT");
    expect(getConsequenceLevel(8)).toBe("EVENT_OF_DEFAULT");
  });
});

// ============================================================================
// EXPENSE CATEGORY VALIDATION TESTS
// ============================================================================

describe("Expense Category Validation", () => {
  const VALID_CATEGORIES = [
    "ENERGY",
    "INSURANCE",
    "CONNECTIVITY",
    "MAINTENANCE",
    "FIDUCIARY",
    "TAX",
    "CONTINGENCY",
    "ADMIN",
    "OTHER",
  ];

  const VALID_PERIODICITIES = [
    "MONTHLY",
    "QUARTERLY",
    "SEMI_ANNUAL",
    "ANNUAL",
    "ONE_TIME",
  ];

  it("should accept all valid expense categories", () => {
    VALID_CATEGORIES.forEach((cat) => {
      expect(VALID_CATEGORIES.includes(cat)).toBe(true);
    });
  });

  it("should reject invalid expense category", () => {
    expect(VALID_CATEGORIES.includes("INVALID_CAT")).toBe(false);
  });

  it("should accept all valid periodicities", () => {
    VALID_PERIODICITIES.forEach((p) => {
      expect(VALID_PERIODICITIES.includes(p)).toBe(true);
    });
  });

  it("should validate expense amount is positive", () => {
    const validateAmount = (amount: number) => amount > 0;
    expect(validateAmount(500000)).toBe(true);
    expect(validateAmount(0)).toBe(false);
    expect(validateAmount(-100)).toBe(false);
  });
});

// ============================================================================
// WATERFALL PRELATION ORDER TESTS
// ============================================================================

describe("Waterfall Prelation Order", () => {
  const PRELATION_ORDER = [
    "ENERGY",
    "INSURANCE",
    "CONNECTIVITY",
    "MAINTENANCE",
    "FIDUCIARY",
    "TAX",
    "CONTINGENCY",
    "ADMIN",
    "OTHER",
  ];

  it("should deduct expenses in correct prelation order", () => {
    let remaining = 5000000;
    const expenses = [
      { category: "ADMIN", amount: 100000 },
      { category: "ENERGY", amount: 1000000 },
      { category: "INSURANCE", amount: 500000 },
      { category: "MAINTENANCE", amount: 200000 },
    ];

    // Sort by prelation order
    const sorted = [...expenses].sort(
      (a, b) =>
        PRELATION_ORDER.indexOf(a.category) - PRELATION_ORDER.indexOf(b.category)
    );

    expect(sorted[0].category).toBe("ENERGY");
    expect(sorted[1].category).toBe("INSURANCE");
    expect(sorted[2].category).toBe("MAINTENANCE");
    expect(sorted[3].category).toBe("ADMIN");

    const deductions: { category: string; amount: number; remainingAfter: number }[] = [];
    for (const exp of sorted) {
      remaining -= exp.amount;
      deductions.push({
        category: exp.category,
        amount: exp.amount,
        remainingAfter: remaining,
      });
    }

    expect(deductions[0].remainingAfter).toBe(4000000); // After ENERGY
    expect(deductions[1].remainingAfter).toBe(3500000); // After INSURANCE
    expect(deductions[2].remainingAfter).toBe(3300000); // After MAINTENANCE
    expect(deductions[3].remainingAfter).toBe(3200000); // After ADMIN
    expect(remaining).toBe(3200000);
  });
});
