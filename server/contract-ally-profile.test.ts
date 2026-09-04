import { describe, expect, it } from "vitest";
import { getContractAllyPrefill, requireValidContractAlly } from "./contracts/contract-ally-profile";

const signedSpace = {
  submitterName: "Persona postulante",
  submitterCompany: "EDS Aliada SAS",
  submitterEmail: "firma@aliada.co",
  submitterPhone: "3001234567",
  submitterDocument: null,
  letterSignerName: "Representante que firmó",
  letterSignerDocument: "19318145",
  address: "Calle 10 # 20-30",
  city: "Bogotá",
  country: "Colombia",
};

describe("perfil contractual del aliado", () => {
  it("prioriza el nombre y documento verificados en la firma de la carta", () => {
    const result = getContractAllyPrefill(signedSpace);
    expect(result.representativeName).toBe("Representante que firmó");
    expect(result.representativeDocument).toBe("19318145");
    expect(result.domicile).toBe("Bogotá, Colombia");
  });

  it("completa datos vacíos enviados por el cliente con la evidencia de la carta", () => {
    const result = requireValidContractAlly({ legalName: "EDS Aliada SAS", taxId: "901000000-1", representativeName: "", representativeDocument: "", email: "firma@aliada.co", notificationAddress: "Calle 10 # 20-30" }, signedSpace);
    expect(result.representativeName).toBe("Representante que firmó");
    expect(result.representativeDocument).toBe("19318145");
  });

  it("devuelve un mensaje de negocio y no el JSON interno de Zod cuando faltan datos", () => {
    expect(() => requireValidContractAlly({ legalName: "", taxId: "", representativeName: "", representativeDocument: "", email: "", notificationAddress: "" }, { submitterName: "Persona" })).toThrow("Complete los datos obligatorios del aliado");
  });
});
