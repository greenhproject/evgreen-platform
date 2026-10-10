import { describe, expect, it, vi } from "vitest";
import {
  notifyOwner,
  shouldSuppressOwnerNotification,
} from "./notification";

describe("notification owner dispatch policy", () => {
  it("suprime avisos externos desde Vitest", () => {
    expect(shouldSuppressOwnerNotification({ VITEST: "true" })).toBe(true);
  });

  it("suprime avisos externos desde NODE_ENV=test", () => {
    expect(shouldSuppressOwnerNotification({ NODE_ENV: "test" })).toBe(true);
  });

  it("mantiene habilitado el aviso en runtime normal", () => {
    expect(
      shouldSuppressOwnerNotification({
        NODE_ENV: "production",
        VITEST: undefined,
      }),
    ).toBe(false);
  });

  it("no invoca el canal externo mientras corre Vitest", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      notifyOwner({
        title: "Nueva postulación de espacio: fixture",
        content: "Este aviso no debe salir de la ejecución de pruebas.",
      }),
    ).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
