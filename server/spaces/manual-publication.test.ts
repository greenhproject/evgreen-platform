import { describe, expect, it } from "vitest";
import { getCrowdfundingPublicationDecision } from "./spaces-router";

describe("formalización interna manual de espacios", () => {
  it("permite publicar una carta pendiente solo con un motivo auditable", () => {
    expect(getCrowdfundingPublicationDecision(
      "letter_sent",
      "Acuerdo comercial confirmado por aprobación interna documentada.",
      "Acta del Comité Comercial 2026-08-18.",
    )).toEqual({
      isManualFormalization: true,
      reason: "Acuerdo comercial confirmado por aprobación interna documentada.",
      evidence: "Acta del Comité Comercial 2026-08-18.",
    });
  });

  it("rechaza motivos ausentes o insuficientes y no trata la carta como firma externa", () => {
    expect(() => getCrowdfundingPublicationDecision("letter_sent", "OK", "Acta interna")).toThrow(
      "se requiere un motivo",
    );
    expect(() => getCrowdfundingPublicationDecision("letter_sent", "Aprobación interna debidamente documentada.", "Acta")).toThrow(
      "se requiere evidencia",
    );
    expect(getCrowdfundingPublicationDecision("letter_accepted")).toEqual({
      isManualFormalization: false,
      reason: null,
      evidence: null,
    });
  });

  it("rechaza estados no aptos para publicación excepcional", () => {
    expect(() => getCrowdfundingPublicationDecision("pending", "Aprobación interna documentada.", "Acta interna")).toThrow(
      "Solo se pueden publicar espacios",
    );
  });
});
