import { describe, expect, it } from "vitest";
import {
  VARDI_VEHICLE_BRANDS,
  VEHICLE_BRANDS,
} from "../shared/vehicle-brands";

describe("catálogo de marcas de vehículos", () => {
  it("incluye todas las marcas automotrices verificadas de Grupo Vardí, incluida Chery", () => {
    expect(VARDI_VEHICLE_BRANDS).toEqual([
      "Chery",
      "Changan",
      "Deepal",
      "Farizon",
      "Geely",
      "Mazda",
      "Nissan",
      "Dodge",
      "Fiat",
      "Jeep",
      "RAM",
    ]);
    expect(VEHICLE_BRANDS).toEqual(expect.arrayContaining(VARDI_VEHICLE_BRANDS));
  });

  it("mantiene una única opción por marca y conserva Otro como alternativa final", () => {
    expect(new Set(VEHICLE_BRANDS).size).toBe(VEHICLE_BRANDS.length);
    expect(VEHICLE_BRANDS.at(-1)).toBe("Otro");
    expect(VEHICLE_BRANDS.filter((brand) => brand === "Nissan")).toHaveLength(1);
  });
});
