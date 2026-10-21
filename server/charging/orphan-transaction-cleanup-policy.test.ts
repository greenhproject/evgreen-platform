import { describe, expect, it } from "vitest";
import { isTransactionProtectedFromOrphanCleanup } from "../../shared/orphan-transaction-cleanup-policy";

describe("orphan transaction cleanup protection", () => {
  it("conserva una sesión que el conector identifica como propia y físicamente activa", () => {
    expect(isTransactionProtectedFromOrphanCleanup({
      transactionId: 1140168,
      connectorStatus: "CHARGING",
      currentTransactionId: 1140168,
    })).toBe(true);
  });

  it("también protege los estados físicos de preparación o suspensión", () => {
    for (const connectorStatus of ["PREPARING", "SUSPENDED_EV", "SUSPENDED_EVSE"]) {
      expect(isTransactionProtectedFromOrphanCleanup({
        transactionId: 77,
        connectorStatus,
        currentTransactionId: 77,
      })).toBe(true);
    }
  });

  it("no deja que un estado antiguo o una sesión distinta bloquee la limpieza", () => {
    expect(isTransactionProtectedFromOrphanCleanup({
      transactionId: 77,
      connectorStatus: "CHARGING",
      currentTransactionId: 78,
    })).toBe(false);

    expect(isTransactionProtectedFromOrphanCleanup({
      transactionId: 77,
      connectorStatus: "AVAILABLE",
      currentTransactionId: 77,
    })).toBe(false);
  });
});
