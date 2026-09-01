import { describe, expect, it } from "vitest";
import { decryptResendWebhookSecret, encryptResendWebhookSecret } from "./resend-webhook-secret";

describe("secreto cifrado de webhook Resend", () => {
  it("cifra de forma no determinista y descifra la clave sin exponerla", () => {
    const secret = "whsec_prueba_configuracion_admin";
    const encryptedA = encryptResendWebhookSecret(secret);
    const encryptedB = encryptResendWebhookSecret(secret);

    expect(encryptedA).not.toContain(secret);
    expect(encryptedB).not.toContain(secret);
    expect(encryptedA).not.toBe(encryptedB);
    expect(decryptResendWebhookSecret(encryptedA)).toBe(secret);
    expect(decryptResendWebhookSecret(encryptedB)).toBe(secret);
  });
});
