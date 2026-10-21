export type OcppMeterValuesScope = {
  stationId: number;
  evseId: number;
  ocppNumericTxId: number;
};

export type OcppTransactionScope = {
  stationId: number;
  evseId: number;
  ocppNumericTxId: number | null | undefined;
  endTime?: Date | string | null;
  status?: string | null;
  transactionStatus?: string | null;
};

/**
 * Verifica que una transacción encontrada por caché aún corresponde al mismo
 * gabinete, conector y transactionId OCPP. Un ID OCPP numérico no es global:
 * puede reiniciarse en el cargador o reaparecer tras una reconexión.
 */
export function matchesOcppMeterValuesScope(
  transaction: OcppTransactionScope | null | undefined,
  scope: OcppMeterValuesScope,
): boolean {
  if (!transaction || transaction.endTime != null) return false;
  if (transaction.stationId !== scope.stationId || transaction.evseId !== scope.evseId) return false;
  if (transaction.ocppNumericTxId !== scope.ocppNumericTxId) return false;

  return transaction.status === "IN_PROGRESS" || transaction.transactionStatus === "IN_PROGRESS";
}
