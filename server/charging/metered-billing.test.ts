import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import { getMeteredBillingResolution } from "./metered-billing";
import { dualCSMS } from "../ocpp/csms-dual";
import { getActiveSessionById, removeActiveSession, setActiveSession } from "./charging-router";
import { buildPowerHistoryFromMeterValues } from "../../shared/charging-telemetry";

vi.mock("../db", () => ({
  getMeterValuesByTransactionId: vi.fn(), getEvseById: vi.fn(),
  getEvsesByStationId: vi.fn(), getTransactionByOcppId: vi.fn(),
  createMeterValue: vi.fn(), updateTransaction: vi.fn(), getTariffById: vi.fn(),
}));
const transaction = {
  id: 880001, evseId: 701, stationId: 702, userId: 42,
  status: "IN_PROGRESS", transactionStatus: "IN_PROGRESS", endTime: null,
  startTime: "2026-11-03 18:13:06", meterStart: "3678619", ocppNumericTxId: 774,
  appliedPricePerKwh: "1349", appliedConnectionFee: "2000", tariffId: 1,
};
const series = [
  ["2026-11-03T18:13:09Z", "3678.619"], ["2026-11-03T18:18:08Z", "3670.719"],
  ["2026-11-03T18:23:07Z", "3671.223"], ["2026-11-03T18:28:08Z", "3671.729"],
  ["2026-11-03T18:33:08Z", "3672.233"], ["2026-11-03T18:38:08Z", "3672.635"],
  ["2026-11-03T18:43:08Z", "3673.035"],
].map(([timestamp, energyKwh]) => ({ timestamp, energyKwh, evseId: transaction.evseId, powerKw: null, measurand: "Energy.Active.Import.Register" }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getEvseById).mockResolvedValue({ id: 701, powerKw: "7" } as any);
  vi.mocked(db.getMeterValuesByTransactionId).mockResolvedValue([...series] as any);
});

describe("reconstrucción comercial autoritativa", () => {
  it("recupera energía y costo de la sesión sin cambiar medidor, precio ni registros", async () => {
    const result = await getMeteredBillingResolution(transaction);
    expect(result).toMatchObject({ kwh: 2.316, reference: "observed_segments", resetCount: 1 });
    expect(result.kwh! * Number(transaction.appliedPricePerKwh) + Number(transaction.appliedConnectionFee)).toBeCloseTo(5124.284, 3);
    expect(db.createMeterValue).not.toHaveBeenCalled();
    expect(db.updateTransaction).not.toHaveBeenCalled();
    expect(transaction.meterStart).toBe("3678619");
  });
  it("no incluye energía de otro conector, exportación o antes de la sesión", async () => {
    vi.mocked(db.getMeterValuesByTransactionId).mockResolvedValue([
      ...series,
      { evseId: 999, timestamp: "2026-11-03T18:44:08Z", energyKwh: "5000" },
      { evseId: 701, timestamp: "2026-11-03T18:44:08Z", energyKwh: "1", measurand: "Energy.Active.Export.Register" },
      { evseId: 701, timestamp: "2026-11-02T18:44:08Z", energyKwh: "1" },
    ] as any);
    expect((await getMeteredBillingResolution(transaction)).kwh).toBe(2.316);
  });
  it("el cierre incluye únicamente el último incremento válido", async () => {
    expect((await getMeteredBillingResolution(transaction, [
      { timestamp: "2026-11-03T18:48:08Z", energyKwh: 3673.535 },
    ])).kwh).toBe(2.816);
    expect((await getMeteredBillingResolution(transaction, [
      { timestamp: "2026-11-03T18:43:10Z", energyKwh: 3678.619 },
    ])).kwh).toBe(2.316);
  });
  it("la curva y la liquidación usan los mismos incrementos medidos", async () => {
    const result = await getMeteredBillingResolution(transaction);
    const chart = buildPowerHistoryFromMeterValues(series, Number(transaction.meterStart), { startTime: transaction.startTime, maxPowerKw: 7 });
    expect(chart.at(-1)?.energy).toBe(result.kwh);
    expect(chart.at(-1)?.power).toBeCloseTo(4.8, 5);
    expect(chart[1]?.energy).toBe(0);
  });
  it("rehidrata el mismo resultado después de un reinicio o reenvío duplicado", async () => {
    const first = await getMeteredBillingResolution(transaction);
    vi.mocked(db.getMeterValuesByTransactionId).mockResolvedValue([...series].reverse().concat(series) as any);
    const afterRestart = await getMeteredBillingResolution(transaction);
    expect(afterRestart.kwh).toBe(first.kwh);
  });
  it("el handler OCPP persiste consumo y tarifa congelada al crecer la energía tras el retroceso", async () => {
    const readings: any[] = [];
    vi.mocked(db.getMeterValuesByTransactionId).mockImplementation(async () => [...readings]);
    vi.mocked(db.createMeterValue).mockImplementation(async value => { readings.push(value); });
    vi.mocked(db.getEvsesByStationId).mockResolvedValue([{ id: 701, evseIdLocal: 1 }] as any);
    vi.mocked(db.getTransactionByOcppId).mockResolvedValue(transaction as any);
    vi.mocked(db.getTariffById).mockResolvedValue({ pricePerKwh: "9999", pricePerMinute: "0", pricePerSession: "9999" } as any);
    setActiveSession(transaction.id, {
      transactionId: transaction.id, userId: 42, stationId: transaction.stationId, connectorId: 1,
      chargeMode: "full_charge", targetValue: 100, startTime: new Date("2026-11-03T18:13:06Z"),
      currentKwh: 0, currentCost: 2000, pricePerKwh: 9999, currentPower: 0,
      soc: null, voltage: null, current: null, lastMeterUpdate: null, powerHistory: [],
      socTargetNotified: false, manualSoc: null, manualBatteryCapacityKwh: null,
      lowPowerSince: null, chargeCompleteDetected: false, chargeCompleteNotified: false,
      autoStopSent: false, energyBasedSoc: null,
    });
    (dualCSMS as any).ocpp16Transactions.set(774, "unit-test-transaction");
    try {
      const handler = (dualCSMS as any).handleOCPP16MeterValues.bind(dualCSMS);
      for (const sample of series) await handler({ stationId: transaction.stationId, ocppIdentity: "OFFLINE-UNIT-TEST" }, {
        connectorId: 1, transactionId: 774,
        meterValue: [{ timestamp: sample.timestamp, sampledValue: [{ measurand: "Energy.Active.Import.Register", unit: "Wh", value: String(Number(sample.energyKwh) * 1000) }] }],
      });
      expect(db.updateTransaction).toHaveBeenLastCalledWith(transaction.id, expect.objectContaining({
        kwhConsumed: "2.3160", energyCost: "3124.28", sessionCost: "2000.00", totalCost: "5124",
      }));
      expect(getActiveSessionById(transaction.id)?.currentKwh).toBe(2.316);
      expect(getActiveSessionById(transaction.id)?.powerHistory.at(-1)?.energy).toBe(2.316);
      expect(readings.every(point => point.powerKw === null)).toBe(true);
    } finally {
      removeActiveSession(transaction.id);
      (dualCSMS as any).ocpp16Transactions.delete(774);
    }
  });
});
