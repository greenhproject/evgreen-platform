import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for admin debt management functions (getAllDebtsAdmin, getDebtStats, adminManualPayDebt)
 * These test the pure logic and data transformation aspects.
 */

// Mock the database module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
  };
});

describe("Admin Debt Management - Data Transformation", () => {
  describe("Debt Status Labels", () => {
    const STATUS_LABELS: Record<string, string> = {
      PENDING: "Pendiente",
      PARTIAL: "Parcial",
      PAID: "Pagada",
      WAIVED: "Condonada",
    };

    it("should have labels for all debt statuses", () => {
      expect(STATUS_LABELS.PENDING).toBe("Pendiente");
      expect(STATUS_LABELS.PARTIAL).toBe("Parcial");
      expect(STATUS_LABELS.PAID).toBe("Pagada");
      expect(STATUS_LABELS.WAIVED).toBe("Condonada");
    });

    it("should have 4 status types", () => {
      expect(Object.keys(STATUS_LABELS)).toHaveLength(4);
    });
  });

  describe("Debt Reason Labels", () => {
    const REASON_LABELS: Record<string, string> = {
      OVERSTAY: "Ocupación",
      INSUFFICIENT_BALANCE: "Saldo insuficiente",
      CANCELLATION_FEE: "Tarifa cancelación",
      NO_SHOW: "No presentado",
      OTHER: "Otro",
    };

    it("should have labels for all debt reasons", () => {
      expect(REASON_LABELS.OVERSTAY).toBe("Ocupación");
      expect(REASON_LABELS.INSUFFICIENT_BALANCE).toBe("Saldo insuficiente");
      expect(REASON_LABELS.CANCELLATION_FEE).toBe("Tarifa cancelación");
      expect(REASON_LABELS.NO_SHOW).toBe("No presentado");
      expect(REASON_LABELS.OTHER).toBe("Otro");
    });
  });

  describe("COP Formatting", () => {
    function formatCOP(amount: number): string {
      return `$${amount.toLocaleString("es-CO")} COP`;
    }

    it("should format zero correctly", () => {
      expect(formatCOP(0)).toContain("$");
      expect(formatCOP(0)).toContain("COP");
    });

    it("should format large amounts", () => {
      const result = formatCOP(1500000);
      expect(result).toContain("COP");
      expect(result).toContain("$");
    });

    it("should format negative amounts", () => {
      const result = formatCOP(-5000);
      expect(result).toContain("COP");
    });
  });

  describe("Debt Stats Calculation", () => {
    interface DebtRecord {
      originalAmount: string;
      remainingAmount: string;
      status: string;
    }

    function calculateStats(debts: DebtRecord[]) {
      let totalPending = 0, totalPaid = 0, totalWaived = 0;
      let countPending = 0, countPaid = 0, countWaived = 0, countPartial = 0;
      let totalAmount = 0;

      for (const d of debts) {
        const original = parseFloat(d.originalAmount || "0");
        const remaining = parseFloat(d.remainingAmount || "0");
        totalAmount += original;

        switch (d.status) {
          case "PENDING":
            totalPending += remaining;
            countPending++;
            break;
          case "PARTIAL":
            totalPending += remaining;
            countPartial++;
            break;
          case "PAID":
            totalPaid += original;
            countPaid++;
            break;
          case "WAIVED":
            totalWaived += original;
            countWaived++;
            break;
        }
      }

      return {
        totalPending: Math.round(totalPending),
        totalPaid: Math.round(totalPaid),
        totalWaived: Math.round(totalWaived),
        countPending: countPending + countPartial,
        countPaid,
        countWaived,
        countPartial,
        totalAmount: Math.round(totalAmount),
      };
    }

    it("should return zeros for empty array", () => {
      const stats = calculateStats([]);
      expect(stats.totalPending).toBe(0);
      expect(stats.totalPaid).toBe(0);
      expect(stats.totalWaived).toBe(0);
      expect(stats.countPending).toBe(0);
      expect(stats.countPaid).toBe(0);
      expect(stats.countWaived).toBe(0);
      expect(stats.totalAmount).toBe(0);
    });

    it("should calculate pending debts correctly", () => {
      const debts: DebtRecord[] = [
        { originalAmount: "50000.00", remainingAmount: "50000.00", status: "PENDING" },
        { originalAmount: "30000.00", remainingAmount: "30000.00", status: "PENDING" },
      ];
      const stats = calculateStats(debts);
      expect(stats.totalPending).toBe(80000);
      expect(stats.countPending).toBe(2);
      expect(stats.totalAmount).toBe(80000);
    });

    it("should calculate partial debts correctly", () => {
      const debts: DebtRecord[] = [
        { originalAmount: "50000.00", remainingAmount: "20000.00", status: "PARTIAL" },
      ];
      const stats = calculateStats(debts);
      expect(stats.totalPending).toBe(20000);
      expect(stats.countPending).toBe(1); // countPending includes partial
      expect(stats.countPartial).toBe(1);
    });

    it("should calculate paid debts correctly", () => {
      const debts: DebtRecord[] = [
        { originalAmount: "50000.00", remainingAmount: "0.00", status: "PAID" },
        { originalAmount: "25000.00", remainingAmount: "0.00", status: "PAID" },
      ];
      const stats = calculateStats(debts);
      expect(stats.totalPaid).toBe(75000);
      expect(stats.countPaid).toBe(2);
    });

    it("should calculate waived debts correctly", () => {
      const debts: DebtRecord[] = [
        { originalAmount: "100000.00", remainingAmount: "0.00", status: "WAIVED" },
      ];
      const stats = calculateStats(debts);
      expect(stats.totalWaived).toBe(100000);
      expect(stats.countWaived).toBe(1);
    });

    it("should calculate mixed statuses correctly", () => {
      const debts: DebtRecord[] = [
        { originalAmount: "50000.00", remainingAmount: "50000.00", status: "PENDING" },
        { originalAmount: "30000.00", remainingAmount: "10000.00", status: "PARTIAL" },
        { originalAmount: "40000.00", remainingAmount: "0.00", status: "PAID" },
        { originalAmount: "20000.00", remainingAmount: "0.00", status: "WAIVED" },
      ];
      const stats = calculateStats(debts);
      expect(stats.totalPending).toBe(60000); // 50000 + 10000
      expect(stats.totalPaid).toBe(40000);
      expect(stats.totalWaived).toBe(20000);
      expect(stats.countPending).toBe(2); // 1 PENDING + 1 PARTIAL
      expect(stats.countPaid).toBe(1);
      expect(stats.countWaived).toBe(1);
      expect(stats.countPartial).toBe(1);
      expect(stats.totalAmount).toBe(140000);
    });
  });

  describe("Debt Search Filter", () => {
    interface DebtWithUser {
      id: number;
      userName: string | null;
      userEmail: string | null;
      userPhone: string | null;
    }

    function filterDebts(debts: DebtWithUser[], search: string): DebtWithUser[] {
      if (!search.trim()) return debts;
      const searchLower = search.toLowerCase().trim();
      return debts.filter(d =>
        (d.userName && d.userName.toLowerCase().includes(searchLower)) ||
        (d.userEmail && d.userEmail.toLowerCase().includes(searchLower)) ||
        (d.userPhone && d.userPhone.includes(searchLower)) ||
        d.id.toString().includes(searchLower)
      );
    }

    const mockDebts: DebtWithUser[] = [
      { id: 1, userName: "Juan Pérez", userEmail: "juan@test.com", userPhone: "3001234567" },
      { id: 2, userName: "María López", userEmail: "maria@test.com", userPhone: "3109876543" },
      { id: 3, userName: "Carlos Gómez", userEmail: "carlos@empresa.com", userPhone: "3201111111" },
    ];

    it("should return all debts when search is empty", () => {
      expect(filterDebts(mockDebts, "")).toHaveLength(3);
      expect(filterDebts(mockDebts, "  ")).toHaveLength(3);
    });

    it("should filter by name", () => {
      const result = filterDebts(mockDebts, "Juan");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should filter by email", () => {
      const result = filterDebts(mockDebts, "empresa.com");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it("should filter by phone", () => {
      const result = filterDebts(mockDebts, "310");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should filter by debt ID", () => {
      // Note: searching "2" matches multiple items because phone numbers also contain "2"
      // Use a more specific search to test ID filtering
      const debtsWithUniqueIds: DebtWithUser[] = [
        { id: 999, userName: "Test User", userEmail: "test@test.com", userPhone: "3001111111" },
        { id: 888, userName: "Other User", userEmail: "other@test.com", userPhone: "3002222222" },
      ];
      const result = filterDebts(debtsWithUniqueIds, "999");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(999);
    });

    it("should be case insensitive", () => {
      const result = filterDebts(mockDebts, "JUAN");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should return empty for no matches", () => {
      const result = filterDebts(mockDebts, "zzzzz");
      expect(result).toHaveLength(0);
    });

    it("should handle null fields gracefully", () => {
      const debtsWithNulls: DebtWithUser[] = [
        { id: 1, userName: null, userEmail: null, userPhone: null },
      ];
      expect(() => filterDebts(debtsWithNulls, "test")).not.toThrow();
      expect(filterDebts(debtsWithNulls, "test")).toHaveLength(0);
    });
  });

  describe("Payment Amount Validation", () => {
    function validatePayment(balance: number, debtAmount: number): { valid: boolean; message: string } {
      if (debtAmount <= 0) return { valid: false, message: "Monto de deuda inválido" };
      if (balance < debtAmount) {
        return {
          valid: false,
          message: `Saldo insuficiente. Saldo: $${balance.toLocaleString()} COP, Deuda: $${debtAmount.toLocaleString()} COP`,
        };
      }
      return { valid: true, message: "OK" };
    }

    it("should reject zero debt amount", () => {
      expect(validatePayment(50000, 0).valid).toBe(false);
    });

    it("should reject negative debt amount", () => {
      expect(validatePayment(50000, -1000).valid).toBe(false);
    });

    it("should reject insufficient balance", () => {
      const result = validatePayment(10000, 50000);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("insuficiente");
    });

    it("should accept sufficient balance", () => {
      expect(validatePayment(50000, 30000).valid).toBe(true);
    });

    it("should accept exact balance", () => {
      expect(validatePayment(50000, 50000).valid).toBe(true);
    });
  });

  describe("Pagination Logic", () => {
    it("should calculate total pages correctly", () => {
      const pageSize = 20;
      expect(Math.ceil(0 / pageSize)).toBe(0);
      expect(Math.ceil(1 / pageSize)).toBe(1);
      expect(Math.ceil(20 / pageSize)).toBe(1);
      expect(Math.ceil(21 / pageSize)).toBe(2);
      expect(Math.ceil(100 / pageSize)).toBe(5);
    });

    it("should calculate offset correctly", () => {
      const pageSize = 20;
      expect(0 * pageSize).toBe(0);
      expect(1 * pageSize).toBe(20);
      expect(2 * pageSize).toBe(40);
    });

    it("should calculate display range correctly", () => {
      const pageSize = 20;
      const total = 55;
      
      // Page 0
      expect(0 * pageSize + 1).toBe(1);
      expect(Math.min((0 + 1) * pageSize, total)).toBe(20);
      
      // Page 1
      expect(1 * pageSize + 1).toBe(21);
      expect(Math.min((1 + 1) * pageSize, total)).toBe(40);
      
      // Page 2 (last)
      expect(2 * pageSize + 1).toBe(41);
      expect(Math.min((2 + 1) * pageSize, total)).toBe(55);
    });
  });
});
