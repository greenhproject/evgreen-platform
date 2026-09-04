import { describe, expect, it } from "vitest";
import { getContractSpaceEligibility } from "./contracts/contract-space-eligibility";

describe("elegibilidad de espacios para contratos", () => {
  it("incluye una carta firmada aunque el espacio haya avanzado a published", () => {
    expect(getContractSpaceEligibility({ letterAcceptedAt: "2026-05-26 18:52:17" })).toMatchObject({
      isFormalized: true,
      formalizationSource: "DIGITAL_LETTER",
      canCreateContract: true,
    });
  });

  it("incluye una formalización manual auditable sin exigir letterAcceptedAt", () => {
    expect(getContractSpaceEligibility({ manualFormalizedAt: "2026-08-19 06:16:44" })).toMatchObject({
      isFormalized: true,
      formalizationSource: "MANUAL_FORMALIZATION",
      canCreateContract: true,
    });
  });

  it("bloquea espacios sin evidencia de formalización", () => {
    expect(getContractSpaceEligibility({})).toMatchObject({
      isFormalized: false,
      canCreateContract: false,
    });
  });

  it("mantiene visible pero no seleccionable un espacio con expediente vigente", () => {
    expect(getContractSpaceEligibility(
      { letterAcceptedAt: "2026-08-20 19:10:39" },
      { id: 21, contractNumber: "EVG-2026-000021", status: "READY" },
    )).toMatchObject({
      isFormalized: true,
      canCreateContract: false,
      existingContractId: 21,
      existingContractNumber: "EVG-2026-000021",
      existingContractStatus: "READY",
    });
  });
});
