import { describe, expect, it, vi } from "vitest";
import { createOverstayLifecycle, getOverstayChargeDecision } from "./overstay-lifecycle";

describe("ciclo de vida de sobretiempo ante desconexión", () => {
  it("no permite ningún cobro ni notificación después de Available", async () => {
    const lifecycle = createOverstayLifecycle();
    const financialWrite = vi.fn();
    const notificationWrite = vi.fn();

    lifecycle.markFinishing(10);
    lifecycle.markDisconnected(10); // StatusNotification Available

    if (lifecycle.getChargeDecision(10, "AVAILABLE") === "ALLOW") {
      financialWrite();
      notificationWrite();
    }

    expect(financialWrite).not.toHaveBeenCalled();
    expect(notificationWrite).not.toHaveBeenCalled();
  });

  it("bloquea el cron aun si conserva un estado FINISHING rezagado", () => {
    const lifecycle = createOverstayLifecycle();
    lifecycle.markFinishing(11);
    lifecycle.markDisconnected(11);

    expect(lifecycle.getChargeDecision(11, "FINISHING")).toBe("CANCEL");
  });

  it("cancela todas las mangueras cuando OCPP 1.6 reporta Available en connectorId=0", () => {
    const lifecycle = createOverstayLifecycle();
    lifecycle.markFinishing(21);
    lifecycle.markFinishing(22);
    lifecycle.markStationDisconnected([21, 22]);

    expect(lifecycle.isCancelled(21)).toBe(true);
    expect(lifecycle.isCancelled(22)).toBe(true);
    expect(lifecycle.getChargeDecision(21, "FINISHING")).toBe("CANCEL");
  });

  it("solo permite cobrar mientras FINISHING siga vigente y no exista desconexión", () => {
    expect(getOverstayChargeDecision({ isCancelled: false, connectorStatus: "FINISHING" })).toBe("ALLOW");
    expect(getOverstayChargeDecision({ isCancelled: false, connectorStatus: "AVAILABLE" })).toBe("CANCEL");
  });
});
