import { and, desc, eq } from "drizzle-orm";
import { ocppLogs, transactions } from "../drizzle/schema.ts";
import { getDb, getRecentMeterValuesByTransactionId } from "../server/db.ts";
import {
  estimatePowerFromEnergySamples,
  resolveChargingTelemetryFreshness,
} from "../shared/charging-telemetry.ts";

const transactionId = Number(process.argv[2] || 1140020);

async function main() {
  const database = await getDb();
  if (!database) throw new Error("DB no disponible");

  const [transaction] = await database
    .select({
      id: transactions.id,
      status: transactions.status,
      meterStart: transactions.meterStart,
      meterEnd: transactions.meterEnd,
      kwhConsumed: transactions.kwhConsumed,
      startTime: transactions.startTime,
      endTime: transactions.endTime,
      updatedAt: transactions.updatedAt,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!transaction) throw new Error(`Transacción ${transactionId} no encontrada`);

  const samples = await getRecentMeterValuesByTransactionId(transactionId, 120);
  if (samples.length < 2) throw new Error("No hay suficientes MeterValues para validar");

  const current = samples.at(-1);
  const previous = samples.at(-2);
  if (!current?.energyKwh || !previous?.energyKwh) {
    throw new Error("Las dos últimas muestras no contienen energía acumulada");
  }

  const estimatedPowerKw = estimatePowerFromEnergySamples({
    previousEnergyKwh: Number(previous.energyKwh),
    currentEnergyKwh: Number(current.energyKwh),
    previousSampleAt: previous.timestamp,
    currentSampleAt: current.timestamp,
  });

  const rawLogs = await database
    .select({ payload: ocppLogs.payload, receivedAt: ocppLogs.createdAt })
    .from(ocppLogs)
    .where(and(eq(ocppLogs.ocppIdentity, "EVG001"), eq(ocppLogs.messageType, "MeterValues")))
    .orderBy(desc(ocppLogs.createdAt))
    .limit(120);

  const rawSamples = rawLogs.flatMap(log => {
    const meterValueItems = Array.isArray(log.payload?.meterValue) ? log.payload.meterValue : [];
    return meterValueItems.flatMap(meterValue => {
      const sampledValues = Array.isArray(meterValue?.sampledValue) ? meterValue.sampledValue : [];
      const energySample = sampledValues.find(sample =>
        sample?.measurand === "Energy.Active.Import.Register" || sample?.measurand === undefined
      );
      const sampleAt = meterValue?.timestamp ? new Date(meterValue.timestamp) : null;
      const rawValue = Number(energySample?.value);
      if (!sampleAt || Number.isNaN(sampleAt.getTime()) || !Number.isFinite(rawValue)) return [];
      const energyKwh = energySample?.unit === "Wh" || rawValue > 10_000 ? rawValue / 1000 : rawValue;
      return [{ sampleAt, receivedAt: new Date(log.receivedAt), energyKwh }];
    });
  })
    .filter(sample => sample.sampleAt >= new Date(transaction.startTime) && (!transaction.endTime || sample.sampleAt <= new Date(transaction.endTime)))
    .sort((left, right) => left.sampleAt.getTime() - right.sampleAt.getTime());

  const rawCurrent = rawSamples.at(-1);
  const rawPrevious = rawSamples.at(-2);
  if (!rawCurrent || !rawPrevious) throw new Error("No hay dos muestras OCPP crudas dentro de la transacción");
  const rawEstimatedPowerKw = estimatePowerFromEnergySamples({
    previousEnergyKwh: rawPrevious.energyKwh,
    currentEnergyKwh: rawCurrent.energyKwh,
    previousSampleAt: rawPrevious.sampleAt,
    currentSampleAt: rawCurrent.sampleAt,
  });
  if (rawEstimatedPowerKw === null || rawEstimatedPowerKw > 15) {
    throw new Error(`Potencia OCPP cruda fuera de rango para Wallbox 7 kW: ${rawEstimatedPowerKw}`);
  }
  const freshness = resolveChargingTelemetryFreshness({ sampleAt: rawCurrent.sampleAt });

  if (estimatedPowerKw === null || estimatedPowerKw < 0 || estimatedPowerKw > 150) {
    throw new Error(`Potencia estimada inválida: ${estimatedPowerKw}`);
  }

  const persistedMeterEnergyKwh = Number(current.energyKwh);
  const meterStartKwh = Number(transaction.meterStart || 0) / 1000;
  const meterStopKwh = Number(transaction.meterEnd || 0) / 1000;
  const finalMeterEnergyKwh = Math.max(persistedMeterEnergyKwh, meterStopKwh);
  const persistedSessionEnergyKwh = Math.max(0, finalMeterEnergyKwh - meterStartKwh);
  const transactionEnergyKwh = Number(transaction.kwhConsumed || 0);
  if (Math.abs(persistedSessionEnergyKwh - transactionEnergyKwh) > 0.02) {
    throw new Error(`La energía final no coincide: muestra=${persistedSessionEnergyKwh}, transacción=${transactionEnergyKwh}`);
  }

  console.log(JSON.stringify({
    readOnly: true,
    transaction,
    sampleCount: samples.length,
    previousSample: {
      timestamp: previous.timestamp,
      energyKwh: Number(previous.energyKwh),
    },
    currentSample: {
      timestamp: current.timestamp,
      meterEnergyKwh: persistedMeterEnergyKwh,
      sessionEnergyKwh: Number(persistedSessionEnergyKwh.toFixed(4)),
      storedPowerKw: Number(current.powerKw || 0),
    },
    stopTransaction: {
      meterStopKwh,
      finalSessionEnergyKwh: Number(persistedSessionEnergyKwh.toFixed(4)),
    },
    legacyEstimateFromPersistedReceiptTimestampsKw: Number(estimatedPowerKw.toFixed(3)),
    rawOcppSamples: {
      previous: {
        sampleAt: rawPrevious.sampleAt.toISOString(),
        receivedAt: rawPrevious.receivedAt.toISOString(),
        energyKwh: rawPrevious.energyKwh,
      },
      current: {
        sampleAt: rawCurrent.sampleAt.toISOString(),
        receivedAt: rawCurrent.receivedAt.toISOString(),
        energyKwh: rawCurrent.energyKwh,
      },
      estimatedPowerFromTrueSampleTimestampsKw: Number(rawEstimatedPowerKw.toFixed(3)),
    },
    freshness,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
