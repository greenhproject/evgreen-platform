export type InitialMeterValuesTrigger = {
  requestedMessage: "MeterValues";
  connectorId?: number;
  evse?: { id: number; connectorId: number };
};

/** Solicita una primera lectura real sin inventar telemetría en el cliente. */
export function buildInitialMeterValuesTrigger(input: {
  ocppVersion: "1.6" | "2.0.1";
  evseId: number;
  connectorId: number;
}): InitialMeterValuesTrigger {
  if (input.ocppVersion === "2.0.1") {
    return {
      requestedMessage: "MeterValues",
      evse: { id: input.evseId, connectorId: input.connectorId },
    };
  }

  return {
    requestedMessage: "MeterValues",
    connectorId: input.connectorId,
  };
}
