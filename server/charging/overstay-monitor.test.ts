import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getEvsesByStationId: vi.fn(),
  getWalletByUserId: vi.fn(),
  createWalletTransaction: vi.fn(),
  createUserDebt: vi.fn(),
  createNotification: vi.fn(),
  lockDelete: vi.fn(),
  lockWhere: vi.fn(),
}));

vi.mock("../db", () => dbMocks);
vi.mock("../push/unified-push", () => ({ sendUserPush: vi.fn() }));
vi.mock("../whatsapp/whatsapp-service", () => ({ sendWhatsAppTemplate: vi.fn(), WA_TEMPLATE_NAMES: {} }));
vi.mock("../wompi/auto-charge", () => ({ autoChargeIfNeeded: vi.fn() }));

import { __overstayTestHooks, onCableDisconnected, onStationReportedAvailable } from "./overstay-monitor";
import { reconcileOverstayAfterStopTransaction } from "./overstay-stop-reconciliation";

function createDeleteDb() {
  dbMocks.lockWhere.mockResolvedValue(undefined);
  dbMocks.lockDelete.mockReturnValue({ where: dbMocks.lockWhere });
  return { delete: dbMocks.lockDelete };
}

describe("monitor real de sobretiempo al desconectar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __overstayTestHooks.reset();
    dbMocks.getDb.mockResolvedValue(createDeleteDb());
  });

  it("Available por conector limpia sesión y lock sin generar cobros, deudas ni notificaciones", async () => {
    __overstayTestHooks.seedSession({ evseId: 41, stationId: 7, accumulatedCost: 0 });

    await onCableDisconnected(41);

    expect(__overstayTestHooks.activeSessionCount()).toBe(0);
    expect(dbMocks.lockDelete).toHaveBeenCalledTimes(1);
    expect(dbMocks.lockWhere).toHaveBeenCalledTimes(1);
    expect(dbMocks.getWalletByUserId).not.toHaveBeenCalled();
    expect(dbMocks.createWalletTransaction).not.toHaveBeenCalled();
    expect(dbMocks.createUserDebt).not.toHaveBeenCalled();
    expect(dbMocks.createNotification).not.toHaveBeenCalled();
  });

  it("Available de connectorId=0 limpia todas las sesiones y locks de la estación", async () => {
    __overstayTestHooks.seedSession({ evseId: 51, stationId: 8, accumulatedCost: 0 });
    __overstayTestHooks.seedSession({ evseId: 52, stationId: 8, accumulatedCost: 0 });
    dbMocks.getEvsesByStationId.mockResolvedValue([{ id: 51 }, { id: 52 }]);

    await onStationReportedAvailable(8);

    expect(__overstayTestHooks.activeSessionCount()).toBe(0);
    expect(dbMocks.getEvsesByStationId).toHaveBeenCalledWith(8);
    expect(dbMocks.lockDelete).toHaveBeenCalledTimes(2);
    expect(dbMocks.lockWhere).toHaveBeenCalledTimes(2);
    expect(dbMocks.createWalletTransaction).not.toHaveBeenCalled();
    expect(dbMocks.createUserDebt).not.toHaveBeenCalled();
    expect(dbMocks.createNotification).not.toHaveBeenCalled();
  });

  it("StopTransaction EVDisconnected seguido de Available no deja sesión, lock ni cobros tardíos", async () => {
    __overstayTestHooks.seedSession({ evseId: 61, stationId: 9, accumulatedCost: 0 });
    const markEvseAvailable = vi.fn().mockResolvedValue(undefined);

    const cancelled = await reconcileOverstayAfterStopTransaction({
      stopReason: "EVDisconnected",
      evseId: 61,
      markEvseAvailable,
      cancelOverstay: onCableDisconnected,
    });

    expect(cancelled).toBe(true);
    expect(markEvseAvailable).toHaveBeenCalledWith(61);
    expect(__overstayTestHooks.activeSessionCount()).toBe(0);
    expect(dbMocks.lockDelete).toHaveBeenCalledTimes(1);
    expect(dbMocks.lockWhere).toHaveBeenCalledTimes(1);
    expect(dbMocks.createWalletTransaction).not.toHaveBeenCalled();
    expect(dbMocks.createUserDebt).not.toHaveBeenCalled();
    expect(dbMocks.createNotification).not.toHaveBeenCalled();
  });
});
