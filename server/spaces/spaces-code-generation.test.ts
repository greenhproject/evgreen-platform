import { describe, expect, it, vi } from "vitest";
import { generateSubmissionCode, insertSubmissionWithCodeRetry } from "./spaces-router";

const prefix = `SPE-${new Date().getFullYear()}-`;

function databaseWithCodes(codeBatches: string[][], values: ReturnType<typeof vi.fn>) {
  let readIndex = 0;
  const where = vi.fn(async () => (codeBatches[Math.min(readIndex++, codeBatches.length - 1)] ?? []).map(code => ({ code })));
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
    insert: vi.fn(() => ({ values })),
  };
}

describe("códigos de postulación de espacios", () => {
  it("ignora registros heredados inválidos y conserva el formato oficial de cuatro dígitos", async () => {
    const values = vi.fn();
    const db = databaseWithCodes([
      [`${prefix}0NaN`, `${prefix}764057`, `${prefix}0001`, `${prefix}0003`],
    ], values);

    await expect(generateSubmissionCode(db)).resolves.toBe(`${prefix}0002`);
  });

  it("regenera el código y crea la postulación cuando la primera inserción colisiona", async () => {
    const values = vi.fn()
      .mockRejectedValueOnce(new Error("Duplicate entry for key 'space_submissions_code_unique'"))
      .mockResolvedValueOnce([{ insertId: 99 }]);
    const db = databaseWithCodes([[], [`${prefix}0001`]], values);

    await expect(insertSubmissionWithCodeRetry(db, code => ({ code, spaceName: "Espacio de prueba" }))).resolves.toEqual({
      code: `${prefix}0002`,
      result: { insertId: 99 },
    });
    expect(values).toHaveBeenNthCalledWith(1, expect.objectContaining({ code: `${prefix}0001` }));
    expect(values).toHaveBeenNthCalledWith(2, expect.objectContaining({ code: `${prefix}0002` }));
  });
});
