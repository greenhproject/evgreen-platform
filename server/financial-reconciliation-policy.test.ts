import { describe, expect, it } from "vitest";
import { summarizeFinancialReconciliations } from "../shared/financial-reconciliation-policy";

describe("financial reconciliation audit policy", () => {
  it("groups approved wallet adjustments by immutable transaction reference", () => {
    const report = summarizeFinancialReconciliations(
      [
        {
          id: 10,
          walletId: 10,
          userId: 7,
          type: "CHARGE_PAYMENT",
          amount: "-77436.40",
          balanceBefore: "77436.40",
          balanceAfter: "0",
          referenceId: 1140031,
          referenceType: "TRANSACTION",
          idempotencyKey: null,
          paymentStatus: "PENDING",
          description: "Cobro físico original",
          createdAt: "2026-10-04T13:32:20.000Z",
        },
        {
          id: 11,
          walletId: 11,
          userId: 65,
          type: "EARNING",
          amount: "54205.48",
          balanceBefore: "0",
          balanceAfter: "54205.48",
          referenceId: 1140031,
          referenceType: "TRANSACTION",
          idempotencyKey: null,
          paymentStatus: "PENDING",
          description: "Distribución original",
          createdAt: "2026-10-04T13:32:20.000Z",
        },
        {
          id: 12,
          walletId: 10,
          userId: 7,
          type: "ADMIN_REFUND",
          amount: "77436.00",
          balanceBefore: "0",
          balanceAfter: "77436.00",
          referenceId: 1140031,
          referenceType: "TRANSACTION",
          idempotencyKey: null,
          paymentStatus: "COMPLETED",
          description: "Reembolso administrativo inicial",
          createdAt: "2026-10-04T13:43:34.000Z",
        },
        {
          id: 1,
          walletId: 10,
          userId: 7,
          type: "ADMIN_REFUND",
          amount: "0.40",
          balanceBefore: "100",
          balanceAfter: "100.40",
          referenceId: 1140031,
          referenceType: "TRANSACTION",
          idempotencyKey: "admin-refund:duplicate-ocpp-1140031:user-7",
          paymentStatus: "COMPLETED",
          description: "Reembolso aprobado",
          createdAt: "2026-10-04T14:28:05.000Z",
        },
        {
          id: 2,
          walletId: 11,
          userId: 65,
          type: "ADMIN_REVERSAL",
          amount: "-54205.48",
          balanceBefore: "5000000",
          balanceAfter: "4945794.52",
          referenceId: 1140031,
          referenceType: "TRANSACTION",
          idempotencyKey: "admin-reversal:duplicate-ocpp-1140031:investor-65",
          paymentStatus: "COMPLETED",
          description: "Reverso aprobado",
          createdAt: "2026-10-04T14:28:05.000Z",
        },
      ],
      [{
        id: 1140031,
        userId: 7,
        stationId: 3,
        status: "CANCELLED",
        startTime: "2026-10-04T00:00:00.000Z",
        endTime: "2026-10-04T11:00:00.000Z",
        totalCost: "0",
      }],
      [{ id: 7, name: "Olga López", email: "olga@example.com" }],
      [{ id: 3, name: "EVG Diamante" }],
    );

    expect(report).toEqual([
      expect.objectContaining({
        transactionId: 1140031,
        adjustmentCount: 3,
        ledgerEntryCount: 5,
        refundedToUser: 77436.4,
        reversedFromInvestor: 54205.48,
        netLedgerImpact: 0,
        user: { id: 7, name: "Olga López" },
        station: { id: 3, name: "EVG Diamante" },
      }),
    ]);
    expect(report[0].ledgerEntries).toHaveLength(5);
  });

  it("excludes wallet movements that are not transaction reconciliations", () => {
    const report = summarizeFinancialReconciliations(
      [{
        id: 3,
        walletId: 10,
        userId: 7,
        type: "ADMIN_REFUND",
        amount: "10",
        balanceBefore: "0",
        balanceAfter: "10",
        referenceId: 22,
        referenceType: "RESERVATION",
        idempotencyKey: "reservation-refund-22",
        paymentStatus: "COMPLETED",
        description: "No debe aparecer",
        createdAt: "2026-10-04T14:28:05.000Z",
      }],
      [],
      [],
      [],
    );

    expect(report).toEqual([]);
  });
});
