import { describe, expect, it } from "vitest";
import { assertCommercialTransition, getCommercialNextStatus } from "./pipeline-transitions";

describe("pipeline comercial de espacios", () => {
  it("expone únicamente el siguiente hito posterior a la publicación", () => {
    expect(getCommercialNextStatus("published")).toBe("funded");
    expect(getCommercialNextStatus("funded")).toBe("in_construction");
    expect(getCommercialNextStatus("in_construction")).toBe("operational");
    expect(getCommercialNextStatus("approved")).toBeNull();
  });

  it("acepta avances secuenciales y bloquea saltos o retrocesos", () => {
    expect(() => assertCommercialTransition("published", "funded")).not.toThrow();
    expect(() => assertCommercialTransition("published", "operational")).toThrow("siguiente hito");
    expect(() => assertCommercialTransition("funded", "published")).toThrow("siguiente hito");
  });
});
