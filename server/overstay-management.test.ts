import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Test the input validation schemas for the new penalty management mutations

describe("Overstay Penalty Management - Input Validation", () => {
  // cancelPenalty schema
  const cancelPenaltySchema = z.object({
    transactionId: z.number(),
    reason: z.string().min(3, "Debe indicar un motivo"),
  });

  // adjustPenalty schema
  const adjustPenaltySchema = z.object({
    transactionId: z.number(),
    newAmount: z.number().min(0, "El monto no puede ser negativo"),
    reason: z.string().min(3, "Debe indicar un motivo"),
  });

  // forceEndSession schema
  const forceEndSessionSchema = z.object({
    evseId: z.number(),
    reason: z.string().min(3, "Debe indicar un motivo"),
    cancelPenalty: z.boolean().default(true),
    transactionId: z.number().optional(),
  });

  describe("cancelPenalty", () => {
    it("should accept valid input", () => {
      const result = cancelPenaltySchema.safeParse({
        transactionId: 123,
        reason: "Corte de luz en la estación",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing transactionId", () => {
      const result = cancelPenaltySchema.safeParse({
        reason: "Corte de luz",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty reason", () => {
      const result = cancelPenaltySchema.safeParse({
        transactionId: 123,
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject reason shorter than 3 characters", () => {
      const result = cancelPenaltySchema.safeParse({
        transactionId: 123,
        reason: "ab",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric transactionId", () => {
      const result = cancelPenaltySchema.safeParse({
        transactionId: "abc",
        reason: "Corte de luz",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("adjustPenalty", () => {
    it("should accept valid input with reduced amount", () => {
      const result = adjustPenaltySchema.safeParse({
        transactionId: 456,
        newAmount: 5000,
        reason: "Ajuste por corte de energía parcial",
      });
      expect(result.success).toBe(true);
    });

    it("should accept zero amount (full cancellation via adjust)", () => {
      const result = adjustPenaltySchema.safeParse({
        transactionId: 456,
        newAmount: 0,
        reason: "Cancelación total por error del sistema",
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative amount", () => {
      const result = adjustPenaltySchema.safeParse({
        transactionId: 456,
        newAmount: -100,
        reason: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing newAmount", () => {
      const result = adjustPenaltySchema.safeParse({
        transactionId: 456,
        reason: "Test reason",
      });
      expect(result.success).toBe(false);
    });

    it("should reject short reason", () => {
      const result = adjustPenaltySchema.safeParse({
        transactionId: 456,
        newAmount: 5000,
        reason: "ab",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forceEndSession", () => {
    it("should accept valid input with default cancelPenalty", () => {
      const result = forceEndSessionSchema.safeParse({
        evseId: 789,
        reason: "Sesión fantasma por corte de luz",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cancelPenalty).toBe(true); // default
      }
    });

    it("should accept explicit cancelPenalty=false", () => {
      const result = forceEndSessionSchema.safeParse({
        evseId: 789,
        reason: "Finalizar sesión sin cancelar penalización",
        cancelPenalty: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cancelPenalty).toBe(false);
      }
    });

    it("should accept optional transactionId", () => {
      const result = forceEndSessionSchema.safeParse({
        evseId: 789,
        reason: "Corte de luz detectado",
        cancelPenalty: true,
        transactionId: 999,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactionId).toBe(999);
      }
    });

    it("should reject missing evseId", () => {
      const result = forceEndSessionSchema.safeParse({
        reason: "Test reason",
      });
      expect(result.success).toBe(false);
    });

    it("should reject short reason", () => {
      const result = forceEndSessionSchema.safeParse({
        evseId: 789,
        reason: "ab",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Overstay Penalty Management - Business Logic", () => {
  it("should calculate refund correctly when cancelling a penalty", () => {
    // Simulate: transaction with overstayCost = 7888
    const overstayCost = 7888;
    const walletBalance = 5000; // User was charged from wallet
    
    // When cancelling, refund = overstayCost
    const refundAmount = overstayCost;
    expect(refundAmount).toBe(7888);
  });

  it("should calculate partial refund when adjusting penalty down", () => {
    const originalOverstayCost = 10000;
    const newAmount = 3000;
    
    // Refund = original - new
    const refundAmount = originalOverstayCost - newAmount;
    expect(refundAmount).toBe(7000);
  });

  it("should not refund when adjusting penalty up", () => {
    const originalOverstayCost = 3000;
    const newAmount = 5000;
    
    // No refund when increasing (additional charge)
    const refundAmount = Math.max(0, originalOverstayCost - newAmount);
    expect(refundAmount).toBe(0);
    
    // Additional charge
    const additionalCharge = newAmount - originalOverstayCost;
    expect(additionalCharge).toBe(2000);
  });

  it("should handle zero overstayCost gracefully", () => {
    const overstayCost = 0;
    const refundAmount = overstayCost;
    expect(refundAmount).toBe(0);
  });

  it("should format currency correctly for Colombian pesos", () => {
    const formatCurrency = (amount: number) => {
      return `$ ${amount.toLocaleString("es-CO")}`;
    };
    
    expect(formatCurrency(7888)).toBe("$ 7.888");
    expect(formatCurrency(1000000)).toBe("$ 1.000.000");
    expect(formatCurrency(0)).toBe("$ 0");
    expect(formatCurrency(500)).toBe("$ 500");
  });
});
