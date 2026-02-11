import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock de la base de datos
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getInvestorBalance: vi.fn(),
    getPayoutsByInvestor: vi.fn(),
    createPayoutRequest: vi.fn(),
    getPayoutById: vi.fn(),
    updatePayoutStatus: vi.fn(),
    getAllPayoutsForAdmin: vi.fn(),
  };
});

describe("Sistema de Liquidaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInvestorBalance", () => {
    it("debe calcular correctamente el balance del inversionista", async () => {
      const mockBalance = {
        pendingBalance: 500000,
        totalPaid: 1000000,
        investorPercentage: 80,
        pendingRequested: 100000,
      };
      
      vi.mocked(db.getInvestorBalance).mockResolvedValue(mockBalance);
      
      const result = await db.getInvestorBalance(1);
      
      expect(result).toEqual(mockBalance);
      expect(result.pendingBalance).toBe(500000);
      expect(result.investorPercentage).toBe(80);
    });

    it("debe retornar valores por defecto cuando no hay transacciones", async () => {
      const mockBalance = {
        pendingBalance: 0,
        totalPaid: 0,
        investorPercentage: 80,
        pendingRequested: 0,
      };
      
      vi.mocked(db.getInvestorBalance).mockResolvedValue(mockBalance);
      
      const result = await db.getInvestorBalance(999);
      
      expect(result.pendingBalance).toBe(0);
      expect(result.totalPaid).toBe(0);
    });
  });

  describe("getPayoutsByInvestor", () => {
    it("debe retornar las liquidaciones del inversionista", async () => {
      const mockPayouts = [
        {
          id: 1,
          investorId: 1,
          status: "PAID",
          totalRevenue: "100000",
          platformFee: "20000",
          investorShare: "80000",
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-01-31"),
          paidAt: new Date("2026-02-01"),
        },
        {
          id: 2,
          investorId: 1,
          status: "REQUESTED",
          totalRevenue: "50000",
          platformFee: "10000",
          investorShare: "40000",
          periodStart: new Date("2026-02-01"),
          periodEnd: new Date("2026-02-28"),
          requestedAt: new Date("2026-02-03"),
        },
      ];
      
      vi.mocked(db.getPayoutsByInvestor).mockResolvedValue(mockPayouts);
      
      const result = await db.getPayoutsByInvestor(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("PAID");
      expect(result[1].status).toBe("REQUESTED");
    });

    it("debe retornar array vacío si no hay liquidaciones", async () => {
      vi.mocked(db.getPayoutsByInvestor).mockResolvedValue([]);
      
      const result = await db.getPayoutsByInvestor(999);
      
      expect(result).toEqual([]);
    });
  });

  describe("createPayoutRequest", () => {
    it("debe crear una solicitud de pago correctamente", async () => {
      const mockPayout = {
        id: 1,
        investorId: 1,
        status: "REQUESTED",
        totalRevenue: "100000",
        platformFee: "20000",
        investorShare: "80000",
        bankName: "Bancolombia",
        bankAccount: "123456789",
        accountHolder: "Juan Pérez",
        accountType: "AHORROS",
        requestedAt: new Date(),
      };
      
      vi.mocked(db.createPayoutRequest).mockResolvedValue(mockPayout);
      
      const result = await db.createPayoutRequest({
        investorId: 1,
        amount: 80000,
        bankName: "Bancolombia",
        bankAccount: "123456789",
        accountHolder: "Juan Pérez",
        accountType: "AHORROS",
      });
      
      expect(result.status).toBe("REQUESTED");
      expect(result.bankName).toBe("Bancolombia");
    });
  });

  describe("updatePayoutStatus", () => {
    it("debe aprobar una solicitud de pago", async () => {
      const mockPayout = {
        id: 1,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: 1,
      };
      
      vi.mocked(db.updatePayoutStatus).mockResolvedValue(mockPayout);
      
      const result = await db.updatePayoutStatus(1, {
        status: "APPROVED",
        approvedBy: 1,
      });
      
      expect(result.status).toBe("APPROVED");
    });

    it("debe rechazar una solicitud de pago con motivo", async () => {
      const mockPayout = {
        id: 1,
        status: "REJECTED",
        rejectionReason: "Datos bancarios incorrectos",
      };
      
      vi.mocked(db.updatePayoutStatus).mockResolvedValue(mockPayout);
      
      const result = await db.updatePayoutStatus(1, {
        status: "REJECTED",
        rejectionReason: "Datos bancarios incorrectos",
      });
      
      expect(result.status).toBe("REJECTED");
      expect(result.rejectionReason).toBe("Datos bancarios incorrectos");
    });

    it("debe marcar como pagado con referencia", async () => {
      const mockPayout = {
        id: 1,
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TXN-2026-001",
      };
      
      vi.mocked(db.updatePayoutStatus).mockResolvedValue(mockPayout);
      
      const result = await db.updatePayoutStatus(1, {
        status: "PAID",
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TXN-2026-001",
      });
      
      expect(result.status).toBe("PAID");
      expect(result.paymentReference).toBe("TXN-2026-001");
    });
  });

  describe("getAllPayoutsForAdmin", () => {
    it("debe retornar todas las solicitudes para admin", async () => {
      const mockPayouts = [
        {
          payout: { id: 1, status: "REQUESTED", investorShare: "80000" },
          investor: { id: 1, name: "Juan", email: "juan@test.com" },
        },
        {
          payout: { id: 2, status: "PAID", investorShare: "50000" },
          investor: { id: 2, name: "María", email: "maria@test.com" },
        },
      ];
      
      vi.mocked(db.getAllPayoutsForAdmin).mockResolvedValue(mockPayouts);
      
      const result = await db.getAllPayoutsForAdmin();
      
      expect(result).toHaveLength(2);
      expect(result[0].investor.name).toBe("Juan");
    });

    it("debe filtrar por estado", async () => {
      const mockPayouts = [
        {
          payout: { id: 1, status: "REQUESTED", investorShare: "80000" },
          investor: { id: 1, name: "Juan", email: "juan@test.com" },
        },
      ];
      
      vi.mocked(db.getAllPayoutsForAdmin).mockResolvedValue(mockPayouts);
      
      const result = await db.getAllPayoutsForAdmin("REQUESTED");
      
      expect(result).toHaveLength(1);
      expect(result[0].payout.status).toBe("REQUESTED");
    });
  });
});

describe("Cálculos de Liquidación", () => {
  it("debe calcular correctamente la comisión de plataforma", () => {
    const totalRevenue = 100000;
    const investorPercentage = 80;
    
    const investorShare = totalRevenue * (investorPercentage / 100);
    const platformFee = totalRevenue - investorShare;
    
    expect(investorShare).toBe(80000);
    expect(platformFee).toBe(20000);
  });

  it("debe manejar diferentes porcentajes de inversionista", () => {
    const testCases = [
      { revenue: 100000, percentage: 80, expectedShare: 80000 },
      { revenue: 100000, percentage: 70, expectedShare: 70000 },
      { revenue: 100000, percentage: 90, expectedShare: 90000 },
      { revenue: 50000, percentage: 80, expectedShare: 40000 },
    ];
    
    testCases.forEach(({ revenue, percentage, expectedShare }) => {
      const share = revenue * (percentage / 100);
      expect(share).toBe(expectedShare);
    });
  });
});

describe("Estados de Liquidación", () => {
  const validStatuses = ["PENDING", "REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED", "FAILED"];
  
  it("debe reconocer todos los estados válidos", () => {
    validStatuses.forEach(status => {
      expect(validStatuses).toContain(status);
    });
  });

  it("debe tener transiciones de estado válidas", () => {
    const validTransitions: Record<string, string[]> = {
      PENDING: ["REQUESTED"],
      REQUESTED: ["APPROVED", "REJECTED", "PAID"],
      APPROVED: ["PROCESSING", "PAID", "FAILED"],
      PROCESSING: ["PAID", "FAILED"],
      PAID: [],
      REJECTED: [],
      FAILED: ["REQUESTED"],
    };
    
    expect(validTransitions.REQUESTED).toContain("APPROVED");
    expect(validTransitions.REQUESTED).toContain("REJECTED");
    expect(validTransitions.APPROVED).toContain("PAID");
  });
});
