import { describe, expect, it } from "vitest";
import { isRejectedSessionMessage } from "@shared/auth-session-recovery";

describe("recuperación de sesión rechazada", () => {
  it("detecta la respuesta autenticada estándar sin depender de una página específica", () => {
    expect(isRejectedSessionMessage("Please login (10001)")).toBe(true);
    expect(isRejectedSessionMessage("Invalid session cookie")).toBe(true);
    expect(isRejectedSessionMessage("UNAUTHORIZED")).toBe(true);
  });

  it("no confunde fallos de negocio o red con un rechazo de sesión", () => {
    expect(isRejectedSessionMessage("El contrato no puede emitirse en este estado")).toBe(false);
    expect(isRejectedSessionMessage("Network request failed")).toBe(false);
    expect(isRejectedSessionMessage(null)).toBe(false);
  });
});
