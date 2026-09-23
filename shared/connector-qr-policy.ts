export type ConnectorQrTarget = {
  stationId: number;
  evseId: number;
  connectorId: number;
  stationCode: string;
  stationName: string;
  connectorLabel: string;
};

/** Opaque, URL-safe random token issued by Admin; it never grants charging rights. */
export function isValidConnectorQrToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,80}$/.test(token);
}

export function resolveConnectorQrTarget(input: {
  token: string;
  connector?: {
    id: number;
    stationId: number;
    evseIdLocal?: number | null;
    connectorId?: number | null;
    connectorLabel?: string | null;
    isActive?: number | boolean | null;
  } | null;
  station?: {
    id: number;
    name: string;
    ocppIdentity?: string | null;
    isActive?: number | boolean | null;
  } | null;
}): { ok: true; target: ConnectorQrTarget } | { ok: false; reason: string } {
  if (!isValidConnectorQrToken(input.token)) {
    return { ok: false, reason: "El código QR del conector no es válido." };
  }
  if (!input.connector || input.connector.isActive === 0 || input.connector.isActive === false) {
    return { ok: false, reason: "El código QR del conector no es válido o fue revocado." };
  }
  if (!input.station || input.station.isActive === 0 || input.station.isActive === false || input.station.id !== input.connector.stationId) {
    return { ok: false, reason: "La estación asociada a este código QR no está disponible." };
  }
  const connectorId = input.connector.evseIdLocal || input.connector.connectorId;
  if (!connectorId) {
    return { ok: false, reason: "El conector asociado al código QR no tiene una identidad operativa." };
  }
  return {
    ok: true,
    target: {
      stationId: input.station.id,
      stationCode: input.station.ocppIdentity || String(input.station.id),
      stationName: input.station.name,
      evseId: input.connector.id,
      connectorId,
      connectorLabel: input.connector.connectorLabel || `Conector ${connectorId}`,
    },
  };
}

export function doesConnectorQrMatchStation(target: Pick<ConnectorQrTarget, "stationId">, stationId: number): boolean {
  return target.stationId === stationId;
}
