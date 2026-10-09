export type TransactionOperationalStateInput = {
  status?: string | null;
  transactionStatus?: string | null;
  endTime?: Date | string | null;
};

/**
 * Una transacción sólo conserva un conector cuando sigue marcada como activa
 * y no existe evidencia de finalización. La segunda condición protege contra
 * registros históricos donde `status` y `transaction_status` quedaron
 * desalineados por escritores heredados.
 */
export function isTransactionOperationallyActive(
  transaction: TransactionOperationalStateInput,
): boolean {
  if (transaction.endTime != null) return false;

  return transaction.status === "IN_PROGRESS"
    || transaction.transactionStatus === "IN_PROGRESS";
}

/** Escritura terminal compatible con las dos columnas históricas. */
export function terminalTransactionStatus(status: "COMPLETED" | "CANCELLED" | "FAILED") {
  return { status, transactionStatus: status } as const;
}
