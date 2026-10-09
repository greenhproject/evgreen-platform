import { describe, expect, it } from "vitest";
import {
  isTransactionOperationallyActive,
  terminalTransactionStatus,
} from "../../shared/transaction-operational-state";

describe("transaction operational state", () => {
  it("nunca bloquea un conector por una sesión ya finalizada aunque un campo legado siga IN_PROGRESS", () => {
    expect(isTransactionOperationallyActive({
      status: "CANCELLED",
      transactionStatus: "IN_PROGRESS",
      endTime: "2026-10-04T15:52:59.000Z",
    })).toBe(false);
  });

  it("mantiene activa una sesión abierta si cualquiera de las columnas históricas aún indica progreso", () => {
    expect(isTransactionOperationallyActive({
      status: "PENDING",
      transactionStatus: "IN_PROGRESS",
      endTime: null,
    })).toBe(true);

    expect(isTransactionOperationallyActive({
      status: "IN_PROGRESS",
      transactionStatus: "PENDING",
      endTime: null,
    })).toBe(true);
  });

  it("siempre cierra ambas columnas históricas de forma consistente", () => {
    expect(terminalTransactionStatus("CANCELLED")).toEqual({
      status: "CANCELLED",
      transactionStatus: "CANCELLED",
    });
    expect(terminalTransactionStatus("COMPLETED")).toEqual({
      status: "COMPLETED",
      transactionStatus: "COMPLETED",
    });
  });
});
