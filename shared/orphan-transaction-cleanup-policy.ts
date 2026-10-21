export type OrphanTransactionCleanupProtectionInput = {
  transactionId: number | string;
  connectorStatus?: string | null;
  currentTransactionId?: number | string | null;
};

const PHYSICALLY_ACTIVE_CONNECTOR_STATUSES = new Set([
  "CHARGING",
  "PREPARING",
  "SUSPENDED_EV",
  "SUSPENDED_EVSE",
]);

/**
 * Una limpieza basada únicamente en el tiempo no puede cancelar una sesión
 * cuando el conector todavía la identifica explícitamente como su transacción
 * actual y sigue en un estado de carga física.
 *
 * La coincidencia de ID es deliberada: un estado CHARGING desfasado o una nueva
 * sesión en el mismo conector no debe impedir la limpieza de un registro viejo.
 */
export function isTransactionProtectedFromOrphanCleanup(
  input: OrphanTransactionCleanupProtectionInput,
): boolean {
  const connectorTransactionId = input.currentTransactionId;
  const sameTransaction = connectorTransactionId !== null
    && connectorTransactionId !== undefined
    && String(connectorTransactionId) === String(input.transactionId);

  const normalizedStatus = input.connectorStatus?.trim().toUpperCase() ?? "";
  return sameTransaction && PHYSICALLY_ACTIVE_CONNECTOR_STATUSES.has(normalizedStatus);
}
