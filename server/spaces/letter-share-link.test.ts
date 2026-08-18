import { describe, expect, it } from "vitest";
import { getLetterShareLinkData, getRotatedLetterShareLinkData } from "./spaces-router";

describe("enlace alterno de firma de cartas", () => {
  it("devuelve el enlace canónico de firma solo para una carta enviada pendiente", () => {
    expect(getLetterShareLinkData({
      spaceStatus: "letter_sent",
      letterToken: "token-seguro-123",
      submitterName: "Rafael Farfan",
      spaceName: "EDS Las Palmas",
    })).toEqual({
      acceptUrl: "https://app.evgreen.lat/carta-intencion/token-seguro-123",
      recipientName: "Rafael Farfan",
      spaceName: "EDS Las Palmas",
    });
  });

  it.each([
    { spaceStatus: "approved", letterToken: null },
    { spaceStatus: "letter_accepted", letterToken: "token-ya-usado" },
    { spaceStatus: "letter_sent", letterToken: null },
  ])("no expone el token cuando la carta no es elegible", (state) => {
    expect(() => getLetterShareLinkData({ ...state, submitterName: "Persona", spaceName: "Espacio" }))
      .toThrow("El enlace alterno solo está disponible para cartas enviadas y pendientes de firma.");
  });

  it("entrega una URL distinta al rotar y marca el vínculo anterior como revocado", () => {
    const previousToken = "token-anterior";
    const result = getRotatedLetterShareLinkData({
      spaceStatus: "letter_sent",
      letterToken: previousToken,
      submitterName: "Persona",
      spaceName: "Espacio",
    }, "token-nuevo");

    expect(result).toEqual({ acceptUrl: "https://app.evgreen.lat/carta-intencion/token-nuevo", revokedPreviousLink: true });
    expect(result.acceptUrl).not.toContain(previousToken);
  });

  it("no permite una rotación sin un token nuevo", () => {
    expect(() => getRotatedLetterShareLinkData({ spaceStatus: "letter_sent", letterToken: "token", submitterName: "Persona", spaceName: "Espacio" }, "token"))
      .toThrow("No se pudo rotar el enlace de firma.");
  });
});
