export type ReconciliationAdjustmentRow = {
  id: number;
  walletId: number;
  userId: number;
  type: string;
  amount: string | number;
  balanceBefore: string | number;
  balanceAfter: string | number;
  referenceId: number | null;
  referenceType: string | null;
  idempotencyKey: string | null;
  paymentStatus: string | null;
  description: string | null;
  createdAt: string | Date;
};

export type ReconciliationSessionRow = {
  id: number;
  userId: number;
  stationId: number;
  status: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  totalCost: string | number | null;
};

export type ReconciliationIdentity = {
  id: number;
  name: string | null;
  email?: string | null;
};

export type ReconciliationStation = {
  id: number;
  name: string | null;
};

function asAmount(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Consolida el libro financiero completo de cada transacción que recibió una
 * conciliación administrativa. No infiere movimientos: expone los asientos
 * realmente persistidos y distingue el libro original de los ajustes.
 */
export function summarizeFinancialReconciliations(
  adjustments: ReconciliationAdjustmentRow[],
  sessions: ReconciliationSessionRow[],
  people: ReconciliationIdentity[],
  stations: ReconciliationStation[],
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const personById = new Map(people.map((person) => [person.id, person]));
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const groups = new Map<number, ReconciliationAdjustmentRow[]>();

  for (const adjustment of adjustments) {
    if (adjustment.referenceType !== "TRANSACTION" || !adjustment.referenceId) continue;
    const existing = groups.get(adjustment.referenceId) ?? [];
    existing.push(adjustment);
    groups.set(adjustment.referenceId, existing);
  }

  return [...groups.entries()]
    .filter(([, entries]) => entries.some((entry) => entry.type === "ADMIN_REFUND" || entry.type === "ADMIN_REVERSAL"))
    .map(([transactionId, entries]) => {
      const transaction = sessionById.get(transactionId) ?? null;
      const primaryPerson = transaction ? personById.get(transaction.userId) : undefined;
      const station = transaction ? stationById.get(transaction.stationId) : undefined;
      const refundedToUser = roundCurrency(entries
        .filter((entry) => entry.type === "ADMIN_REFUND")
        .reduce((total, entry) => total + Math.max(0, asAmount(entry.amount)), 0));
      const reversedFromInvestor = roundCurrency(entries
        .filter((entry) => entry.type === "ADMIN_REVERSAL")
        .reduce((total, entry) => total + Math.abs(Math.min(0, asAmount(entry.amount))), 0));
      const netLedgerImpact = roundCurrency(entries.reduce((total, entry) => total + asAmount(entry.amount), 0));
      const adjustmentCount = entries.filter((entry) => entry.type === "ADMIN_REFUND" || entry.type === "ADMIN_REVERSAL").length;
      const completedAt = entries.reduce<string | Date | null>((latest, entry) => {
        if (!latest) return entry.createdAt;
        return new Date(entry.createdAt).getTime() > new Date(latest).getTime() ? entry.createdAt : latest;
      }, null);

      return {
        transactionId,
        transaction: transaction
          ? {
              id: transaction.id,
              status: transaction.status,
              startTime: transaction.startTime,
              endTime: transaction.endTime,
              totalCost: asAmount(transaction.totalCost),
            }
          : null,
        user: transaction
          ? {
              id: transaction.userId,
              name: primaryPerson?.name || primaryPerson?.email || `Usuario #${transaction.userId}`,
            }
          : null,
        station: transaction
          ? {
              id: transaction.stationId,
              name: station?.name || `Estación #${transaction.stationId}`,
            }
          : null,
        adjustmentCount,
        ledgerEntryCount: entries.length,
        refundedToUser,
        reversedFromInvestor,
        netLedgerImpact,
        completedAt,
        ledgerEntries: entries.map((entry) => ({
          id: entry.id,
          walletId: entry.walletId,
          userId: entry.userId,
          type: entry.type,
          amount: asAmount(entry.amount),
          balanceBefore: asAmount(entry.balanceBefore),
          balanceAfter: asAmount(entry.balanceAfter),
          idempotencyKey: entry.idempotencyKey,
          paymentStatus: entry.paymentStatus,
          description: entry.description,
          createdAt: entry.createdAt,
        })),
      };
    })
    .sort((left, right) => new Date(right.completedAt ?? 0).getTime() - new Date(left.completedAt ?? 0).getTime());
}
