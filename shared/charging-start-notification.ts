import { parseUtcTimestamp } from "./station-timezone";

export interface ChargingStartedNotificationInput {
  transactionId: number;
  userId: number;
  stationName: string;
  connectorId: number | string;
  startTime: Date | string | number;
  appliedPricePerKwh: string | number | null | undefined;
  /** Historical sessions may not have captured this component of the tariff. */
  appliedConnectionFee?: string | number | null;
  timeZone?: string;
}

export interface ChargingStartedNotification {
  title: "Carga iniciada";
  body: string;
  data: Record<string, string>;
}

function snapshotAmount(value: unknown, field: string): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Invalid charging-start snapshot: ${field}`);
  }
  // Never coerce null, empty strings, booleans, or commercial display labels to zero.
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error(`Invalid charging-start snapshot: ${field}`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid charging-start snapshot: ${field}`);
  }
  return amount;
}

/**
 * A charging.started event is built only from the physical session's snapshot.
 * It never looks up current station tariffs and never substitutes the current time.
 */
export function buildChargingStartedNotification({
  transactionId,
  userId,
  stationName,
  connectorId,
  startTime,
  appliedPricePerKwh,
  appliedConnectionFee,
  timeZone = "America/Bogota",
}: ChargingStartedNotificationInput): ChargingStartedNotification {
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0
    || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Invalid charging-start snapshot: transactionId/userId");
  }
  const pricePerKwh = snapshotAmount(appliedPricePerKwh, "appliedPricePerKwh");
  const connectionFee = appliedConnectionFee == null
    ? null
    : snapshotAmount(appliedConnectionFee, "appliedConnectionFee");
  if (!(startTime instanceof Date) && typeof startTime !== "string" && typeof startTime !== "number") {
    throw new Error("Invalid charging-start snapshot: startTime");
  }
  const startedAt = parseUtcTimestamp(startTime);
  if (!Number.isFinite(startedAt.getTime())) {
    throw new Error("Invalid charging-start snapshot: startTime");
  }
  // Explicit IANA zone; no dependency on the server/device's local timezone.
  // Invalid supplied zones intentionally reject rather than silently changing the date.
  const dateParts = new Intl.DateTimeFormat("es-CO", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(startedAt);
  const part = (name: Intl.DateTimeFormatPartTypes) => dateParts.find(item => item.type === name)?.value;
  const localDate = `${part("day")}/${part("month")}/${part("year")}`;
  const localTime = `${part("hour")}:${part("minute")}:${part("second")}`;
  const amountFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 20 });
  const feeLabel = connectionFee === null
    ? "Conexión: no registrada en esta sesión."
    : `Conexión: ${amountFormatter.format(connectionFee)} COP.`;
  const occurredAt = startedAt.toISOString();

  return {
    title: "Carga iniciada",
    body: `${stationName} · Conector ${connectorId} · ${localDate} ${localTime} (${timeZone}). `
      + `Sesión #${transactionId}. Tarifa congelada: ${amountFormatter.format(pricePerKwh)} COP/kWh. ${feeLabel}`,
    data: {
      eventId: `charging.started:${transactionId}`,
      transactionId: String(transactionId),
      pricePerKwh: String(pricePerKwh),
      // Empty means unknown, not free; push providers require string values.
      connectionFee: connectionFee === null ? "" : String(connectionFee),
      occurredAt,
      startTime: occurredAt,
      stationName,
      connectorId: String(connectorId),
      timeZone,
      notificationTag: `charging-started:${userId}`,
    },
  };
}
