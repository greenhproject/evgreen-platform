import { describe, expect, it } from "vitest";
import { matchesNavigationQuery, normalizeNavigationQuery } from "../shared/admin-menu-search";

describe("búsqueda de navegación administrativa", () => {
  it("normaliza acentos y separadores para una búsqueda tolerante", () => {
    expect(normalizeNavigationQuery("  Ocupación / Parqueadero  ")).toBe("ocupacion parqueadero");
  });

  it("encuentra módulos por etiqueta, ruta y términos alternativos", () => {
    const impact = {
      label: "Impacto y Bonos",
      path: "/admin/carbon",
      keywords: ["carbono", "ambiental", "sostenibilidad"],
    };
    const parking = {
      label: "Ocupación Parqueadero",
      path: "/admin/occupancy-liquidations",
      keywords: ["sobreestadía", "parking"],
    };

    expect(matchesNavigationQuery(impact, "bonos carbono")).toBe(true);
    expect(matchesNavigationQuery(parking, "ocupacion")).toBe(true);
    expect(matchesNavigationQuery(parking, "sobreestadia")).toBe(true);
    expect(matchesNavigationQuery(impact, "tarifas")).toBe(false);
  });

  it("mantiene todos los módulos visibles cuando la búsqueda está vacía", () => {
    expect(matchesNavigationQuery({ label: "Dashboard", path: "/admin" }, "   ")).toBe(true);
  });
});
