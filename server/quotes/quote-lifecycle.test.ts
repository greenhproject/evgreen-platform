import { describe, expect, it } from "vitest";
import {
  canDecideQuote,
  canSendQuoteEmail,
  canTransitionQuoteStatus,
  isQuoteEditable,
  isQuoteStatus,
} from "../../shared/quote-lifecycle";

describe("ciclo de vida de cotizaciones", () => {
  it("reconoce únicamente estados de cotización persistidos", () => {
    expect(isQuoteStatus("DRAFT")).toBe(true);
    expect(isQuoteStatus("ACCEPTED")).toBe(true);
    expect(isQuoteStatus("status")).toBe(false);
    expect(isQuoteStatus(undefined)).toBe(false);
  });

  it("permite editar y enviar borradores o cotizaciones enviadas", () => {
    expect(isQuoteEditable("DRAFT")).toBe(true);
    expect(isQuoteEditable("SENT")).toBe(true);
    expect(isQuoteEditable("VIEWED")).toBe(false);
    expect(canSendQuoteEmail("DRAFT")).toBe(true);
    expect(canSendQuoteEmail("SENT")).toBe(true);
    expect(canSendQuoteEmail("ACCEPTED")).toBe(false);
  });

  it("permite decisiones sólo antes del cierre comercial", () => {
    expect(canDecideQuote("DRAFT")).toBe(true);
    expect(canDecideQuote("VIEWED")).toBe(true);
    expect(canDecideQuote("ACCEPTED")).toBe(false);
    expect(canTransitionQuoteStatus("VIEWED", "ACCEPTED")).toBe(true);
    expect(canTransitionQuoteStatus("SENT", "REJECTED")).toBe(true);
    expect(canTransitionQuoteStatus("REJECTED", "ACCEPTED")).toBe(false);
  });
});
