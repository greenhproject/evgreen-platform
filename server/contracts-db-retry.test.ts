import { describe, expect, it } from "vitest";
import { withRetry } from "./db";

describe("reintentos del centro contractual", () => {
  it("recupera una consulta con un fallo transitorio ETIMEDOUT", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts === 1) {
        const error: any = new Error("timeout");
        error.code = "ETIMEDOUT";
        throw error;
      }
      return "ok";
    }, "contracts.test", 2);

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});
