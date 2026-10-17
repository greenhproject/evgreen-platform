import { describe, expect, it } from "vitest";
import { matchesContractSearch, normalizeContractSearch } from "../shared/contract-search";

describe("búsqueda contractual", () => {
  it("normaliza acentos, separadores y mayúsculas", () => {
    expect(normalizeContractSearch("  EDS Téxaco — Ibagué  ")).toBe("eds texaco ibague");
  });

  it("encuentra un expediente por términos en distinto orden", () => {
    expect(matchesContractSearch("cali evg con 2026", ["EVG-CON-2026-AB12", "EDS Texaco Ibagué", "Cali"])).toBe(true);
  });

  it("encuentra un pendiente por empresa, código o ciudad", () => {
    const fields = ["SPE-2026-0014", "Pepinos Restaurante SAS", "Puerto Salgar"];
    expect(matchesContractSearch("pepinos", fields)).toBe(true);
    expect(matchesContractSearch("spe 0014", fields)).toBe(true);
    expect(matchesContractSearch("puerto salgar", fields)).toBe(true);
  });

  it("no devuelve coincidencias parciales cuando falta un término", () => {
    expect(matchesContractSearch("texaco medellin", ["EDS Texaco Ibagué", "Cali"])).toBe(false);
  });
});
