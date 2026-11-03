import * as db from "../db";
import { resolveMeteredEnergySegments } from "../../shared/metered-energy-segments";

/** Read-only reconstruction. Never edits the raw meter, wallet or past invoices. */
export async function getMeteredBillingResolution(
  transaction: { id: number; evseId: number; meterStart: number | string | null; startTime: Date | string },
  additionalSamples: Array<{ timestamp: Date | string | number; energyKwh?: number | string | null }> = [],
) {
  const [storedSamples, evse] = await Promise.all([
    db.getMeterValuesByTransactionId(transaction.id),
    db.getEvseById(transaction.evseId),
  ]);
  const nominalPower = Number(evse?.powerKw);
  const samples = storedSamples.filter(sample => sample.evseId === transaction.evseId
    && (!sample.measurand || sample.measurand === "Energy.Active.Import.Register"));
  const resolution = resolveMeteredEnergySegments({
    meterStartWh: transaction.meterStart,
    startTime: transaction.startTime,
    samples: [...samples, ...additionalSamples],
    // The registered EVSE supplies the physical plausibility bound.
    maxPowerKw: Number.isFinite(nominalPower) && nominalPower > 0 ? nominalPower : undefined,
  });
  return { ...resolution, samples };
}
