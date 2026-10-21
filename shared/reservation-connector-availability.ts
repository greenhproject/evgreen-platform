/**
 * Una reserva vigente bloquea el conector para terceros, pero habilita al
 * titular a seleccionar exactamente esa manguera durante su ventana.
 */
export function isConnectorSelectableForReservationOwner(
  connectorStatus: string | null | undefined,
  isReservationOwner: boolean,
): boolean {
  const status = String(connectorStatus || "").toUpperCase();
  return status === "AVAILABLE" || (status === "RESERVED" && isReservationOwner);
}
