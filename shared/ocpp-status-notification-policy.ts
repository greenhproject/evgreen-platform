export function isOcpp16ConnectorZeroStationStatus(connectorId: unknown): boolean {
  return Number(connectorId) === 0;
}

/**
 * OCPP 1.6 connectorId=0 is a charge-point-wide status, not a physical cable
 * event for every output. Some Wallbox firmware emits `Available` here while a
 * real connector is still `Finishing`; that must never release a piston or
 * cancel its occupancy lifecycle.
 */
export function shouldTreatOcpp16AvailableAsPhysicalDisconnect(input: {
  connectorId: unknown;
  status: unknown;
  previousConnectorStatus?: unknown;
}): boolean {
  return !isOcpp16ConnectorZeroStationStatus(input.connectorId)
    && String(input.status ?? "").trim().toUpperCase() === "AVAILABLE"
    && String(input.previousConnectorStatus ?? "").trim().toUpperCase() === "FINISHING";
}

/**
 * A Finishing state should stay occupied until a connector-specific Available,
 * an EVDisconnected stop reason, or a staff recovery action confirms release.
 */
export function shouldAutoReleaseStaleFinishing(): boolean {
  return false;
}
