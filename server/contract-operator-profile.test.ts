import { describe, expect, it } from "vitest";
import {
  contractOperatorProfileFromSettings,
  getContractOperatorProfileStatus,
  mergeTemplateVariableSchema,
} from "./contracts/contract-operator-profile";

describe("perfil legal contractual del operador", () => {
  it("reutiliza la configuración global como respaldo sin inventar representante ni dirección", () => {
    const profile = contractOperatorProfileFromSettings({
      companyName: "Green House Project",
      nit: "901447678-0",
      contactEmail: "info@greenhproject.com",
      supportPhone: "+573001234567",
    });
    expect(profile).toMatchObject({
      legalName: "Green House Project",
      taxId: "901447678-0",
      email: "info@greenhproject.com",
      phone: "+573001234567",
      representativeName: "",
      notificationAddress: "",
    });
  });

  it("solo considera verificado un perfil completo confirmado por un Admin", () => {
    const incomplete = getContractOperatorProfileStatus({ companyName: "Green House Project SAS", nit: "901.447.678-0" });
    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.isVerified).toBe(false);
    expect(incomplete.missingFields).toContain("Representante legal");

    const complete = getContractOperatorProfileStatus({
      contractOperatorLegalName: "Green House Project SAS",
      contractOperatorTaxId: "901.447.678-0",
      contractOperatorRepresentativeName: "Persona confirmada",
      contractOperatorRepresentativeDocument: "1.000.000.000",
      contractOperatorRepresentativeTitle: "Representante legal",
      contractOperatorEmail: "legal@greenhproject.com",
      contractOperatorPhone: "+57 300 000 0000",
      contractOperatorNotificationAddress: "Dirección corporativa confirmada",
      contractOperatorDomicile: "Colombia",
      contractOperatorVerifiedAt: "2026-09-04 21:00:00",
      contractOperatorVerifiedBy: 1,
    });
    expect(complete.missingFields).toEqual([]);
    expect(complete.isVerified).toBe(true);
  });

  it("preserva el mapeo y formato fuente cuando se actualiza o activa una plantilla", () => {
    expect(mergeTemplateVariableSchema({
      sourceFormat: "DOCX",
      mappings: { "Nit-aliado": "ALIADO_NIT" },
      mappingFingerprint: "abc",
    }, ["ALIADO_NIT"])).toEqual({
      sourceFormat: "DOCX",
      mappings: { "Nit-aliado": "ALIADO_NIT" },
      mappingFingerprint: "abc",
      variables: ["ALIADO_NIT"],
      required: ["ALIADO_NIT"],
    });
  });
});
