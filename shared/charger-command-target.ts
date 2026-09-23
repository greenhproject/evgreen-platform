export type ChargerCommandConnector = {
  id: number;
  connectorId?: number | null;
  evseIdLocal?: number | null;
};

/**
 * OCPP 1.6 addresses the socket connector; OCPP 2.0.1 addresses the EVSE.
 * The database primary EVSE id remains the client/server selection key and is
 * intentionally not sent on the wire.
 */
export function resolveOcppCommandTarget(
  connector: ChargerCommandConnector,
  ocppVersion?: string | null,
  fallbackConnectorId?: number,
): number {
  if (ocppVersion?.startsWith("2")) {
    return connector.evseIdLocal || connector.connectorId || fallbackConnectorId || 0;
  }
  return connector.connectorId || connector.evseIdLocal || fallbackConnectorId || 0;
}
