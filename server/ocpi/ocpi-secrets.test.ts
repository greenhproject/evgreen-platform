import { describe, expect, it } from "vitest";

process.env.JWT_SECRET = "ocpi-test-key-with-sufficient-length";

describe("secretos OCPI", () => {
  it("cifra y descifra sin exponer el valor enmascarado", async () => {
    const { decryptOcpiSecret, encryptOcpiSecret, maskOcpiSecret } = await import("./ocpi-secrets");
    const encrypted = encryptOcpiSecret("ocpi-token-real-1234");
    expect(encrypted).not.toContain("ocpi-token-real-1234");
    expect(decryptOcpiSecret(encrypted)).toBe("ocpi-token-real-1234");
    expect(maskOcpiSecret("ocpi-token-real-1234")).toBe("••••1234");
  });

  it("solo acepta URLs HTTPS públicas para el endpoint Versions", async () => {
    const { isSafeOcpiVersionsUrl } = await import("./ocpi-secrets");
    expect(isSafeOcpiVersionsUrl("https://sandbox.cargame.example/ocpi/versions")).toBe(true);
    expect(isSafeOcpiVersionsUrl("http://cargame.example/versions")).toBe(false);
    expect(isSafeOcpiVersionsUrl("https://127.0.0.1/versions")).toBe(false);
  });
});
