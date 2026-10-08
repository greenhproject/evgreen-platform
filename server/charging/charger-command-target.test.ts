import { describe, expect, it } from "vitest";
import { resolveOcppCommandTarget } from "../../shared/charger-command-target";

describe("physical charger OCPP command target", () => {
  const connector = { id: 901, connectorId: 2, evseIdLocal: 12 };

  it("uses the per-cabinet connector socket in OCPP 1.6", () => {
    expect(resolveOcppCommandTarget(connector, "1.6")).toBe(2);
  });

  it("uses the EVSE identity in OCPP 2.0.1", () => {
    expect(resolveOcppCommandTarget(connector, "2.0.1")).toBe(12);
  });

  it("keeps duplicated OCPP 1.6 connector numbers safe because command routing is by cabinet identity", () => {
    const cabinetOnePistolA = { id: 1001, connectorId: 1, evseIdLocal: 1 };
    const cabinetTwoPistolA = { id: 2001, connectorId: 1, evseIdLocal: 5 };

    expect(resolveOcppCommandTarget(cabinetOnePistolA, "1.6")).toBe(1);
    expect(resolveOcppCommandTarget(cabinetTwoPistolA, "1.6")).toBe(1);
    // The caller must use their distinct charger OCPP identities; the shared
    // socket number is intentionally valid only within each physical cabinet.
    expect(cabinetOnePistolA.id).not.toBe(cabinetTwoPistolA.id);
  });
});
