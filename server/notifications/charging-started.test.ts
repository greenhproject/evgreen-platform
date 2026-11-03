import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InsertNotification, Transaction } from "../../drizzle/schema";

const dbMocks = vi.hoisted(() => ({
  claimChargingStartedNotification: vi.fn(),
  markChargingStartedPushAccepted: vi.fn(),
}));
const pushMocks = vi.hoisted(() => ({ sendUserPush: vi.fn() }));
// Never load the real DB or push module: QA cannot write rows or send a notification.
vi.mock("../db", () => dbMocks);
vi.mock("../push/unified-push", () => pushMocks);

import { notifyChargingStartedOnce } from "./charging-started";

type ClaimBuilder = (transaction: Transaction) => InsertNotification;
const input = { transactionId: 201, stationName: "EVGreen Diamante", connectorId: 2 };
function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 201,
    userId: 88,
    stationId: 7,
    evseId: 2,
    status: "IN_PROGRESS",
    startTime: "2026-11-02 18:30:00",
    appliedPricePerKwh: "1450.50",
    appliedConnectionFee: "2500.00",
    ...overrides,
  } as Transaction;
}

let lockedTransactions: Map<number, Transaction>;
let inbox: Map<number, InsertNotification>;
let nextId: number;

// Mock only the atomic claim contract. This is not a substitute for DB-lock tests.
function claimWinner(transactionId: number, build: ClaimBuilder) {
  const locked = lockedTransactions.get(transactionId);
  if (!locked) return { created: false, transaction: null, notificationId: null };
  if (inbox.has(transactionId)) return { created: false, transaction: locked, notificationId: 700 + transactionId };
  const row = build(locked);
  inbox.set(transactionId, row);
  return { created: true, transaction: locked, notificationId: nextId++ };
}

describe("notifyChargingStartedOnce", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lockedTransactions = new Map([[201, transaction()]]);
    inbox = new Map();
    nextId = 901;
    dbMocks.claimChargingStartedNotification.mockImplementation(claimWinner);
    dbMocks.markChargingStartedPushAccepted.mockResolvedValue(undefined);
    pushMocks.sendUserPush.mockResolvedValue(true);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("crea el inbox desde el snapshot locked y envía exactamente ese aviso sin emoji ni entrega ficticia", async () => {
    const result = await notifyChargingStartedOnce(input);
    expect(result).toEqual({ created: true, notificationId: 901, pushAccepted: true });
    expect(dbMocks.claimChargingStartedNotification).toHaveBeenCalledWith(201, expect.any(Function));
    const row = inbox.get(201)!;
    expect(row).toMatchObject({
      userId: 88,
      title: "Carga iniciada",
      type: "CHARGE_START",
      referenceId: 201,
      referenceType: "transaction",
      pushSent: 0,
      pushSentAt: null,
    });
    expect(row.message).toContain("02/11/2026 13:30:00 (America/Bogota)");
    expect(JSON.parse(row.data!)).toMatchObject({ pricePerKwh: "1450.5", connectionFee: "2500", eventId: "charging.started:201" });
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
    expect(pushMocks.sendUserPush).toHaveBeenCalledWith(88, {
      type: "charging_started",
      title: "Carga iniciada",
      body: row.message,
      clickAction: "/charging-monitor",
      data: JSON.parse(row.data!),
    });
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledWith(901, true);
    expect(row).not.toHaveProperty("delivered");
    expect(result).not.toHaveProperty("delivered");
  });

  it("reintentos secuenciales de la misma transacción no envían de nuevo", async () => {
    await notifyChargingStartedOnce(input);
    const duplicate = await notifyChargingStartedOnce(input);
    expect(duplicate).toMatchObject({ created: false, pushAccepted: null });
    expect(inbox.size).toBe(1);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
  });

  it("reclamos concurrentes simulados tienen un solo ganador y un solo envío", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => notifyChargingStartedOnce(input)));
    expect(dbMocks.claimChargingStartedNotification).toHaveBeenCalledTimes(12);
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(inbox.size).toBe(1);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
  });

  it("sesiones separadas 2/11 y 3/11 del mismo usuario conservan sus respectivos snapshots", async () => {
    lockedTransactions.set(202, transaction({
      id: 202,
      startTime: "2026-11-03 18:30:00",
      appliedPricePerKwh: "1800.00",
      appliedConnectionFee: "3000.00",
    }));
    await Promise.all([
      notifyChargingStartedOnce(input),
      notifyChargingStartedOnce({ ...input, transactionId: 202 }),
    ]);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(2);
    const previous = pushMocks.sendUserPush.mock.calls.find(([, payload]) => payload.data.transactionId === "201")![1];
    const current = pushMocks.sendUserPush.mock.calls.find(([, payload]) => payload.data.transactionId === "202")![1];
    expect(previous.body).toContain("02/11/2026");
    expect(current.body).toContain("03/11/2026");
    expect(previous.data).toMatchObject({ pricePerKwh: "1450.5", connectionFee: "2500", eventId: "charging.started:201" });
    expect(current.data).toMatchObject({ pricePerKwh: "1800", connectionFee: "3000", eventId: "charging.started:202" });
    expect(previous.data.notificationTag).toBe(current.data.notificationTag);
  });

  it("push usa el payload capturado bajo lock, no una reconstrucción de la fila retornada", async () => {
    dbMocks.claimChargingStartedNotification.mockImplementation((id: number, build: ClaimBuilder) => {
      const claimed = claimWinner(id, build);
      return { ...claimed, transaction: transaction({ startTime: "2026-11-03 18:30:00", appliedPricePerKwh: "9999.00" }) };
    });
    await notifyChargingStartedOnce(input);
    const payload = pushMocks.sendUserPush.mock.calls[0][1];
    expect(payload.body).toBe(inbox.get(201)!.message);
    expect(payload.data.pricePerKwh).toBe("1450.5");
    expect(payload.body).toContain("02/11/2026");
  });

  it("proveedor que devuelve false deja la traza durable y aceptación false, sin reintento", async () => {
    pushMocks.sendUserPush.mockResolvedValue(false);
    expect(await notifyChargingStartedOnce(input)).toMatchObject({ created: true, pushAccepted: false });
    expect(inbox.size).toBe(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledWith(901, false);
    await notifyChargingStartedOnce(input);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
  });

  it("excepción del proveedor conserva stack/traza e inbox, registra false y no marca delivered", async () => {
    const failure = new Error("FCM provider unavailable");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    pushMocks.sendUserPush.mockRejectedValue(failure);
    expect(await notifyChargingStartedOnce(input)).toEqual({ created: true, notificationId: 901, pushAccepted: false });
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("transaction 201, notification 901"), failure);
    expect(inbox.has(201)).toBe(true);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledWith(901, false);
    await notifyChargingStartedOnce(input);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
  });

  it("transacción inexistente o claim ya tomado no envía ni actualiza aceptación", async () => {
    lockedTransactions.clear();
    expect(await notifyChargingStartedOnce(input)).toEqual({ created: false, notificationId: null, pushAccepted: null });
    expect(pushMocks.sendUserPush).not.toHaveBeenCalled();
    expect(dbMocks.markChargingStartedPushAccepted).not.toHaveBeenCalled();
  });

  it.each([null, "", "invalid", "-1"])("rechaza snapshot de energía %s sin insertar ni enviar", async appliedPricePerKwh => {
    lockedTransactions.set(201, transaction({ appliedPricePerKwh }));
    await expect(notifyChargingStartedOnce(input)).rejects.toThrow("appliedPricePerKwh");
    expect(inbox.size).toBe(0);
    expect(pushMocks.sendUserPush).not.toHaveBeenCalled();
    expect(dbMocks.markChargingStartedPushAccepted).not.toHaveBeenCalled();
  });

  it("tarifa cero y conexión cero se notifican como valores válidos", async () => {
    lockedTransactions.set(201, transaction({ appliedPricePerKwh: "0.00", appliedConnectionFee: "0.00" }));
    await notifyChargingStartedOnce(input);
    expect(pushMocks.sendUserPush.mock.calls[0][1].data).toMatchObject({ pricePerKwh: "0", connectionFee: "0" });
  });

  it("fila histórica sin conexión no inventa cero y respeta zona explícita", async () => {
    lockedTransactions.set(201, transaction({ appliedConnectionFee: null }));
    await notifyChargingStartedOnce({ ...input, timeZone: "UTC" });
    const payload = pushMocks.sendUserPush.mock.calls[0][1];
    expect(payload.body).toContain("Conexión: no registrada en esta sesión");
    expect(payload.body).toContain("02/11/2026 18:30:00 (UTC)");
    expect(payload.data.connectionFee).toBe("");
  });

  it("claim fallido no llega al proveedor", async () => {
    dbMocks.claimChargingStartedNotification.mockRejectedValue(new Error("database unavailable"));
    await expect(notifyChargingStartedOnce(input)).rejects.toThrow("database unavailable");
    expect(pushMocks.sendUserPush).not.toHaveBeenCalled();
    expect(dbMocks.markChargingStartedPushAccepted).not.toHaveBeenCalled();
  });

  it("error registrando aceptación no libera el claim ni provoca otro envío", async () => {
    dbMocks.markChargingStartedPushAccepted.mockRejectedValueOnce(new Error("acceptance write failed"));
    await expect(notifyChargingStartedOnce(input)).rejects.toThrow("acceptance write failed");
    expect(inbox.size).toBe(1);
    await notifyChargingStartedOnce(input);
    expect(pushMocks.sendUserPush).toHaveBeenCalledTimes(1);
    expect(dbMocks.markChargingStartedPushAccepted).toHaveBeenCalledTimes(1);
  });
});
