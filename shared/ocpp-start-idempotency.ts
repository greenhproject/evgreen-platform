export type Ocpp16StartFingerprintInput = {
  stationId: number;
  evseId: number;
  meterStart: number | string;
  timestamp: string | Date;
};

/**
 * Identifica de forma estable el StartTransaction físico de OCPP 1.6.
 *
 * Algunos equipos retransmiten exactamente el mismo StartTransaction después de
 * una reconexión. El contador de transacciones del servidor es efímero, por lo
 * que no puede ser la clave de idempotencia. La combinación de ubicación,
 * salida física, medidor inicial y timestamp original sí describe el hecho
 * físico reportado por el cargador.
 */
export function createOcpp16StartFingerprint(input: Ocpp16StartFingerprintInput): string {
  const timestamp = new Date(input.timestamp).toISOString();
  const meterStart = Number(input.meterStart).toFixed(4);

  return [
    "ocpp16-start",
    input.stationId,
    input.evseId,
    meterStart,
    timestamp,
  ].join(":");
}
