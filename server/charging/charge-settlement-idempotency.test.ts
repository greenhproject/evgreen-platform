import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createOcpp16StartFingerprint } from "../../shared/ocpp-start-idempotency";

const root = resolve(import.meta.dirname, "../..");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const coreSource = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const dualSource = readFileSync(resolve(root, "server/ocpp/csms-dual.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

describe("idempotencia de cobro y eventos OCPP", () => {
  it("deriva la misma huella para una retransmisión física exacta", () => {
    const original = createOcpp16StartFingerprint({
      stationId: 150001,
      evseId: 150001,
      meterStart: 3592362,
      timestamp: "2026-10-04T01:55:34Z",
    });
    const replay = createOcpp16StartFingerprint({
      stationId: 150001,
      evseId: 150001,
      meterStart: "3592362.0000",
      timestamp: new Date("2026-10-04T01:55:34.000Z"),
    });

    expect(replay).toBe(original);
  });

  it("distingue un nuevo inicio físico de una retransmisión", () => {
    const first = createOcpp16StartFingerprint({
      stationId: 150001,
      evseId: 150001,
      meterStart: 3592362,
      timestamp: "2026-10-04T01:55:34Z",
    });
    const next = createOcpp16StartFingerprint({
      stationId: 150001,
      evseId: 150001,
      meterStart: 3657562,
      timestamp: "2026-10-04T14:10:00Z",
    });

    expect(next).not.toBe(first);
  });

  it("exige claves únicas persistentes para eventos y pagos", () => {
    expect(schemaSource).toContain("ux_transactions_ocpp_start_fingerprint");
    expect(schemaSource).toContain("ux_transactions_ocpp_transaction_id");
    expect(schemaSource).toContain("ux_wallet_transactions_idempotency_key");
    expect(dbSource).toContain("createOcpp16TransactionOnce");
    expect(dbSource).toContain("createTransactionOnceByOcppId");
    expect(dbSource).toContain("deductChargePaymentOnce");
    expect(dbSource).toContain("charge-payment:${input.transactionId}");
  });

  it("protege las rutas OCPP 1.6 y 2.0 antes de efectos financieros", () => {
    expect(coreSource).toContain("createOcpp16TransactionOnce");
    expect(coreSource).toContain("completeTransactionOnce");
    expect(coreSource).toContain("deductChargePaymentOnce");
    expect(dualSource).toContain("createTransactionOnceByOcppId");
    expect(dualSource).toContain("completeTransactionOnce");
    expect(dualSource).toContain("deductChargePaymentOnce");
  });
});
