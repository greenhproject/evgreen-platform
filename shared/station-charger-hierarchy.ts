export type ChargerOperationalStatus = "AVAILABLE" | "PREPARING" | "CHARGING" | "SUSPENDED_EVSE" | "SUSPENDED_EV" | "FINISHING" | "RESERVED" | "UNAVAILABLE" | "FAULTED";

export type ChargerHierarchyAsset = {
  id: number;
  chargerCode?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  model?: string | null;
  maxConcurrentSessions?: number | null;
};

export type ConnectorHierarchyAsset = {
  id: number;
  chargerId?: number | null;
  connectorId?: number | null;
  connectorLabel?: string | null;
  connectorType: string;
  powerKw?: string | number | null;
  connectorStatus: ChargerOperationalStatus | string;
  isActive?: number | boolean | null;
};

export type StationChargerGroup = ChargerHierarchyAsset & {
  key: string;
  label: string;
  isLegacyUnassigned: boolean;
  connectors: Array<ConnectorHierarchyAsset & { label: string }>;
  concurrentCapacity: number;
  occupiedOrHeldSlots: number;
  availableSlots: number;
  supportsIndependentSessions: boolean;
};

export type PhysicalStationOccupancy = {
  totalConnectorOutputs: number;
  totalConcurrentCapacity: number;
  occupiedOrHeldCapacity: number;
  availableConcurrentCapacity: number;
};

const OCCUPYING_STATUSES = new Set<ChargerOperationalStatus>([
  "PREPARING",
  "CHARGING",
  "SUSPENDED_EVSE",
  "SUSPENDED_EV",
  "FINISHING",
  "RESERVED",
]);

export function getChargerLabel(charger: ChargerHierarchyAsset, ordinal: number): string {
  const configured = charger.displayName?.trim() || charger.chargerCode?.trim();
  return configured || `Cargador ${String(ordinal).padStart(2, "0")}`;
}

export function getConnectorLabel(connector: ConnectorHierarchyAsset, ordinal: number): string {
  const configured = connector.connectorLabel?.trim();
  if (configured) return configured;
  const identifier = connector.connectorId ?? ordinal;
  return `Conector ${identifier}`;
}

export function resolveChargerConcurrentCapacity(
  charger: ChargerHierarchyAsset,
  connectorCount: number,
): number {
  // No se permite asignar más sesiones de las salidas físicas. El valor 2 para
  // Liboltek habilita las dos pistolas de forma independiente; en equipos no
  // simultáneos se configura 1 desde administración.
  const configured = Number(charger.maxConcurrentSessions ?? 1);
  const normalizedConfigured = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 1;
  return Math.min(Math.max(1, connectorCount), normalizedConfigured);
}

export function isConnectorOccupyingCapacity(status: string): boolean {
  return OCCUPYING_STATUSES.has(status.toUpperCase() as ChargerOperationalStatus);
}

export function buildStationChargerHierarchy(
  chargers: ChargerHierarchyAsset[],
  connectors: ConnectorHierarchyAsset[],
): StationChargerGroup[] {
  const activeConnectors = connectors.filter((connector) => connector.isActive !== 0 && connector.isActive !== false);
  const byCharger = new Map<number, ConnectorHierarchyAsset[]>();
  const legacy: ConnectorHierarchyAsset[] = [];

  for (const connector of activeConnectors) {
    if (connector.chargerId) {
      const current = byCharger.get(connector.chargerId) ?? [];
      current.push(connector);
      byCharger.set(connector.chargerId, current);
    } else {
      legacy.push(connector);
    }
  }

  const groups: StationChargerGroup[] = chargers.map((charger, index) => {
    const groupConnectors = (byCharger.get(charger.id) ?? [])
      .sort((a, b) => (a.connectorId ?? a.id) - (b.connectorId ?? b.id));
    const concurrentCapacity = resolveChargerConcurrentCapacity(charger, groupConnectors.length);
    const occupiedOrHeldSlots = groupConnectors.filter((connector) => isConnectorOccupyingCapacity(connector.connectorStatus)).length;

    return {
      ...charger,
      key: `charger-${charger.id}`,
      label: getChargerLabel(charger, index + 1),
      isLegacyUnassigned: false,
      connectors: groupConnectors.map((connector, connectorIndex) => ({
        ...connector,
        label: getConnectorLabel(connector, connectorIndex + 1),
      })),
      concurrentCapacity,
      occupiedOrHeldSlots,
      availableSlots: Math.max(0, concurrentCapacity - occupiedOrHeldSlots),
      supportsIndependentSessions: concurrentCapacity > 1,
    };
  });

  if (legacy.length > 0) {
    const sortedLegacy = [...legacy].sort((a, b) => (a.connectorId ?? a.id) - (b.connectorId ?? b.id));
    const occupiedOrHeldSlots = sortedLegacy.filter((connector) => isConnectorOccupyingCapacity(connector.connectorStatus)).length;
    groups.push({
      id: 0,
      key: "legacy-unassigned",
      label: "Conectores sin cargador asignado",
      isLegacyUnassigned: true,
      connectors: sortedLegacy.map((connector, index) => ({
        ...connector,
        label: getConnectorLabel(connector, index + 1),
      })),
      concurrentCapacity: sortedLegacy.length,
      occupiedOrHeldSlots,
      availableSlots: Math.max(0, sortedLegacy.length - occupiedOrHeldSlots),
      supportsIndependentSessions: false,
    });
  }

  return groups;
}

/**
 * Computes the station-wide usable capacity from physical charger cabinets.
 * A dual-output Liboltek configured with a capacity of 2 contributes two
 * concurrent sessions; a two-output model configured with capacity 1 only
 * contributes one. Legacy EVSEs remain one independent capacity each so no
 * existing station is made unavailable while it is being organized.
 */
export function calculatePhysicalStationOccupancy(
  chargers: ChargerHierarchyAsset[],
  connectors: ConnectorHierarchyAsset[],
): PhysicalStationOccupancy {
  const groups = buildStationChargerHierarchy(chargers, connectors);
  return groups.reduce<PhysicalStationOccupancy>((total, group) => {
    const occupied = Math.min(group.concurrentCapacity, group.occupiedOrHeldSlots);
    total.totalConnectorOutputs += group.connectors.length;
    total.totalConcurrentCapacity += group.concurrentCapacity;
    total.occupiedOrHeldCapacity += occupied;
    total.availableConcurrentCapacity += Math.max(0, group.concurrentCapacity - occupied);
    return total;
  }, {
    totalConnectorOutputs: 0,
    totalConcurrentCapacity: 0,
    occupiedOrHeldCapacity: 0,
    availableConcurrentCapacity: 0,
  });
}

export function canStartOnConnectorWithinCharger(
  charger: ChargerHierarchyAsset,
  connectors: ConnectorHierarchyAsset[],
  selectedConnectorId: number,
): { allowed: boolean; reason?: string } {
  const selected = connectors.find((connector) => connector.id === selectedConnectorId);
  if (!selected) return { allowed: false, reason: "El conector seleccionado no pertenece a este cargador." };
  if (!["AVAILABLE", "PREPARING", "RESERVED"].includes(selected.connectorStatus.toUpperCase())) {
    return { allowed: false, reason: "El conector seleccionado no está disponible." };
  }

  const capacity = resolveChargerConcurrentCapacity(charger, connectors.length);
  const occupiedOtherSlots = connectors.filter(
    (connector) => connector.id !== selectedConnectorId && isConnectorOccupyingCapacity(connector.connectorStatus),
  ).length;
  if (occupiedOtherSlots >= capacity) {
    return {
      allowed: false,
      reason: `El cargador alcanzó su límite operativo de ${capacity} sesión${capacity === 1 ? "" : "es"} simultánea${capacity === 1 ? "" : "s"}.`,
    };
  }

  return { allowed: true };
}
