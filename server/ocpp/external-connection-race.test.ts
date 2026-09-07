import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { dualCSMS } from "./csms-dual";

describe("CSMS dual external connection race", () => {
  const identity = "QA-WALLBOX-RACE";

  beforeEach(() => {
    const manager = dualCSMS as any;
    manager.connections.delete(identity);
    manager.gracePeriodStates.delete(identity);
    const timer = manager.gracePeriodTimers.get(identity);
    if (timer) clearTimeout(timer);
    manager.gracePeriodTimers.delete(identity);
  });

  it("conserva estación y estado Charging cuando el socket nuevo reemplaza al anterior", () => {
    const oldWs = { readyState: WebSocket.OPEN, send: vi.fn() } as any;
    const newWs = { readyState: WebSocket.OPEN, send: vi.fn() } as any;

    dualCSMS.registerExternalConnection(identity, oldWs, "1.6", 150001);
    const original = (dualCSMS as any).connections.get(identity);
    original.connectorStatuses.set(1, "Charging");
    original.bootInfo = { vendor: "Wallbox", model: "Pulsar Max" };

    dualCSMS.registerExternalConnection(identity, newWs, "1.6", null);
    dualCSMS.removeExternalConnection(identity, oldWs);

    const active = (dualCSMS as any).connections.get(identity);
    expect(active.ws).toBe(newWs);
    expect(active.stationId).toBe(150001);
    expect(active.connectorStatuses.get(1)).toBe("Charging");
    expect(active.bootInfo).toEqual({ vendor: "Wallbox", model: "Pulsar Max" });
    expect(active.seamlessReconnections).toBe(1);
  });
});
