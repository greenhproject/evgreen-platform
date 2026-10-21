import {
  autoResolveNoTelemetryAlertsForTransaction,
  getActiveAcTransactionTelemetrySnapshots,
} from "../db";
import { handleActiveChargeWithoutTelemetry } from "../ocpp/alerts-service";

const INITIAL_GRACE_MS = 5 * 60_000;
const WARNING_AFTER_MS = 10 * 60_000;
const CRITICAL_AFTER_MS = 30 * 60_000;

export type AcTelemetrySnapshot = {
  transactionId: number;
  stationId: number;
  evseId: number | null;
  startedAt: Date | string;
  stationName: string | null;
  ocppIdentity: string | null;
  connectorId: number | null;
  connectorLabel: string | null;
  lastMeterAt: Date | string | null;
  lastEnergyKwh: string | null;
};

export type AcTelemetryState = "GRACE" | "FRESH" | "WARNING" | "CRITICAL";

export function resolveAcTelemetryState(
  snapshot: Pick<AcTelemetrySnapshot, "startedAt" | "lastMeterAt">,
  now = new Date(),
): { state: AcTelemetryState; referenceAt: Date; staleForMs: number } {
  const startedAt = new Date(snapshot.startedAt);
  const validStart = Number.isNaN(startedAt.getTime()) ? now : startedAt;
  const meterAt = snapshot.lastMeterAt ? new Date(snapshot.lastMeterAt) : null;
  const validMeterAt = meterAt && !Number.isNaN(meterAt.getTime()) ? meterAt : null;
  const referenceAt = validMeterAt || validStart;
  const staleForMs = Math.max(0, now.getTime() - referenceAt.getTime());

  if (!validMeterAt && staleForMs < INITIAL_GRACE_MS) {
    return { state: "GRACE", referenceAt, staleForMs };
  }
  if (staleForMs < WARNING_AFTER_MS) {
    return { state: "FRESH", referenceAt, staleForMs };
  }
  return {
    state: staleForMs >= CRITICAL_AFTER_MS ? "CRITICAL" : "WARNING",
    referenceAt,
    staleForMs,
  };
}

export interface AcTelemetryWatchdogResult {
  inspected: number;
  inGrace: number;
  fresh: number;
  warning: number;
  critical: number;
  resolved: number;
  errors: number;
}

/**
 * Vigila únicamente cargas AC abiertas. No altera el cargador, ni cambia la
 * sesión o sus importes: genera una alerta deduplicada por transacción cuando
 * falta la telemetría y la cierra automáticamente al recuperarse una lectura.
 */
export async function runAcTelemetryWatchdog(now = new Date()): Promise<AcTelemetryWatchdogResult> {
  const result: AcTelemetryWatchdogResult = {
    inspected: 0,
    inGrace: 0,
    fresh: 0,
    warning: 0,
    critical: 0,
    resolved: 0,
    errors: 0,
  };
  const snapshots = await getActiveAcTransactionTelemetrySnapshots();
  result.inspected = snapshots.length;

  for (const row of snapshots as AcTelemetrySnapshot[]) {
    try {
      const telemetry = resolveAcTelemetryState(row, now);
      if (telemetry.state === "GRACE") {
        result.inGrace++;
        continue;
      }
      if (telemetry.state === "FRESH") {
        result.fresh++;
        result.resolved += await autoResolveNoTelemetryAlertsForTransaction(row.transactionId);
        continue;
      }

      const severity = telemetry.state === "CRITICAL" ? "critical" : "warning";
      result[telemetry.state === "CRITICAL" ? "critical" : "warning"]++;
      await handleActiveChargeWithoutTelemetry({
        transactionId: row.transactionId,
        evseId: row.evseId || 0,
        stationId: row.stationId,
        ocppIdentity: row.ocppIdentity,
        stationName: row.stationName,
        connectorLabel: row.connectorLabel || (row.connectorId ? `Conector ${row.connectorId}` : null),
        minutesWithoutTelemetry: telemetry.staleForMs / 60_000,
        severity,
        lastMeterAt: row.lastMeterAt,
      });
    } catch (error) {
      result.errors++;
      console.error("[AcTelemetryWatchdog] Error vigilando sesión AC", {
        transactionId: row.transactionId,
        error,
      });
    }
  }

  return result;
}
