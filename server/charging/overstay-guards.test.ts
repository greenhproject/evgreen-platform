import { describe, expect, it } from "vitest";
import { getOverstayStatusAction, shouldCancelOverstayFromStopReason, shouldStartOverstayFromStopTransaction } from "./overstay-guards";

describe("reglas de seguridad de sobretiempo", () => {
  it("solo inicia sobretiempo ante FINISHING confirmado por OCPP", () => {
    expect(getOverstayStatusAction("Finishing")).toBe("START");
    expect(getOverstayStatusAction("finishing")).toBe("START");
  });

  it("cancela el monitor al recibir Available", () => {
    expect(getOverstayStatusAction("Available")).toBe("CANCEL");
  });

  it("no inicia sobretiempo desde StopTransaction", () => {
    expect(shouldStartOverstayFromStopTransaction()).toBe(false);
  });

  it("cancela explícitamente cuando StopTransaction confirma EVDisconnected", () => {
    expect(shouldCancelOverstayFromStopReason("EVDisconnected")).toBe(true);
    expect(shouldCancelOverstayFromStopReason("Remote")).toBe(false);
  });

  it("no infiere sobretiempo de estados no concluyentes", () => {
    expect(getOverstayStatusAction("Charging")).toBe("NONE");
    expect(getOverstayStatusAction("SuspendedEV")).toBe("NONE");
    expect(getOverstayStatusAction(undefined)).toBe("NONE");
  });
});
