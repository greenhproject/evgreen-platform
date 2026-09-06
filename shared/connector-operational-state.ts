export type CanonicalConnectorStatus =
  | "AVAILABLE"
  | "PREPARING"
  | "CHARGING"
  | "SUSPENDED_EVSE"
  | "SUSPENDED_EV"
  | "FINISHING"
  | "RESERVED"
  | "UNAVAILABLE"
  | "FAULTED";

export type ConnectorStatusSource =
  | "active_transaction"
  | "ocpp_memory"
  | "database"
  | "none";

const STATUS_ALIASES: Record<string, CanonicalConnectorStatus> = {
  AVAILABLE: "AVAILABLE",
  PREPARING: "PREPARING",
  CHARGING: "CHARGING",
  OCCUPIED: "CHARGING",
  SUSPENDEDEVSE: "SUSPENDED_EVSE",
  SUSPENDED_EVSE: "SUSPENDED_EVSE",
  SUSPENDEDEV: "SUSPENDED_EV",
  SUSPENDED_EV: "SUSPENDED_EV",
  FINISHING: "FINISHING",
  RESERVED: "RESERVED",
  UNAVAILABLE: "UNAVAILABLE",
  FAULTED: "FAULTED",
};

export function normalizeConnectorStatus(status: unknown): CanonicalConnectorStatus | null {
  if (typeof status !== "string") return null;
  return STATUS_ALIASES[status.trim().toUpperCase()] ?? null;
}

export function resolveConnectorOperationalState(input: {
  liveOcppStatus?: unknown;
  persistedStatus?: unknown;
  activeTransactionId?: number | string | null;
}) {
  const liveStatus = normalizeConnectorStatus(input.liveOcppStatus);
  const persistedStatus = normalizeConnectorStatus(input.persistedStatus);
  const hasActiveTransaction = input.activeTransactionId !== null
    && input.activeTransactionId !== undefined
    && String(input.activeTransactionId).trim() !== "";

  // Una transacción IN_PROGRESS es la evidencia operativa más fuerte y además
  // persiste entre instancias/reinicios donde la memoria OCPP puede estar vacía.
  const status: CanonicalConnectorStatus | null = hasActiveTransaction
    ? "CHARGING"
    : liveStatus ?? persistedStatus;
  const source: ConnectorStatusSource = hasActiveTransaction
    ? "active_transaction"
    : liveStatus
      ? "ocpp_memory"
      : persistedStatus
        ? "database"
        : "none";

  return {
    status,
    source,
    hasActiveTransaction,
    isCharging: status === "CHARGING" || status === "SUSPENDED_EV" || status === "SUSPENDED_EVSE",
    isAvailable: status === "AVAILABLE",
    isPreparing: status === "PREPARING",
    isUnavailable: status === "UNAVAILABLE" || status === "FAULTED",
  };
}
