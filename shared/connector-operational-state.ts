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

function asEpochMilliseconds(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/**
 * La caché OCPP vive sólo dentro del proceso y puede sobrevivir una reconexión
 * transparente. Por eso nunca puede contradecir un estado físico más reciente
 * persistido en la base. Mantiene compatibilidad con integraciones antiguas que
 * todavía no reportan timestamps, pero las nuevas superficies deben enviarlos.
 */
export function isLiveOcppStatusFresh(input: {
  liveOcppStatus?: unknown;
  liveOcppStatusAt?: unknown;
  persistedStatus?: unknown;
  persistedStatusAt?: unknown;
}): boolean {
  if (!normalizeConnectorStatus(input.liveOcppStatus)) return false;
  if (!normalizeConnectorStatus(input.persistedStatus)) return true;

  const liveAt = asEpochMilliseconds(input.liveOcppStatusAt);
  const persistedAt = asEpochMilliseconds(input.persistedStatusAt);
  // Los consumidores previos conservan su contrato hasta que estén enriquecidos
  // con las marcas de tiempo de la conexión OCPP.
  if (liveAt === null || persistedAt === null) return true;
  return liveAt >= persistedAt;
}

export function resolveConnectorOperationalState(input: {
  liveOcppStatus?: unknown;
  liveOcppStatusAt?: unknown;
  persistedStatus?: unknown;
  persistedStatusAt?: unknown;
  activeTransactionId?: number | string | null;
}) {
  const liveStatus = isLiveOcppStatusFresh(input)
    ? normalizeConnectorStatus(input.liveOcppStatus)
    : null;
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

export type ConnectorOperationalInput = {
  id: number | string;
  evseIdLocal?: number | string | null;
  connectorStatus?: unknown;
  connectorStatusUpdatedAt?: unknown;
  activeTransactionId?: number | string | null;
  liveOcppStatus?: unknown;
  liveOcppStatusAt?: unknown;
};

/**
 * Proyecta conectores a su estado operativo único. La transacción activa tiene
 * prioridad sobre una lectura OCPP o persistida que todavía no se haya
 * reconciliado; con ello una UI nunca debe anunciar un conector ocupado como
 * disponible.
 */
export function projectOperationalConnectorStates<T extends ConnectorOperationalInput>(connectors: T[]) {
  return connectors.map((connector) => {
    const operationalState = resolveConnectorOperationalState({
      liveOcppStatus: connector.liveOcppStatus,
      liveOcppStatusAt: connector.liveOcppStatusAt,
      persistedStatus: connector.connectorStatus,
      persistedStatusAt: connector.connectorStatusUpdatedAt,
      activeTransactionId: connector.activeTransactionId,
    });
    return {
      ...connector,
      connectorStatus: operationalState.status ?? "UNAVAILABLE",
      operationalStatus: operationalState.status,
      operationalStatusSource: operationalState.source,
      isAvailable: operationalState.isAvailable,
      isCharging: operationalState.isCharging,
      isPreparing: operationalState.isPreparing,
      isUnavailable: operationalState.isUnavailable,
    };
  });
}

/** Conteo derivado exclusivamente de la proyección canónica de conectores. */
export function summarizeOperationalConnectorAvailability(connectors: ConnectorOperationalInput[]) {
  const projected = projectOperationalConnectorStates(connectors);
  return projected.reduce((summary, connector) => {
    summary.totalConnectors++;
    if (connector.isAvailable) summary.availableConnectors++;
    if (connector.isCharging) summary.chargingConnectors++;
    if (connector.connectorStatus === "RESERVED") summary.reservedConnectors++;
    if (connector.connectorStatus === "FAULTED" || connector.connectorStatus === "UNAVAILABLE") {
      summary.unavailableConnectors++;
    }
    return summary;
  }, {
    totalConnectors: 0,
    availableConnectors: 0,
    chargingConnectors: 0,
    reservedConnectors: 0,
    unavailableConnectors: 0,
  });
}
