import { describe, expect, it } from "vitest";

process.env.JWT_SECRET = "opensolar-test-key-with-sufficient-length";

describe("secretos OpenSolar", () => {
  it("cifra el token sin conservar su texto plano", async () => {
    const { decryptOpenSolarSecret, encryptOpenSolarSecret } = await import("./opensolar-secrets");
    const token = "opensolar-real-token-for-test";
    const encrypted = encryptOpenSolarSecret(token);

    expect(encrypted).not.toContain(token);
    expect(decryptOpenSolarSecret(encrypted)).toBe(token);
  });
});
