import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { CommercialDistributionEditor } from "../client/src/components/spaces/CommercialDistributionEditor";
import {
  changeCommercialDistributionDraft,
  commercialDistributionChanged,
  commercialDistributionForForm,
  commercialDistributionToDraft,
  parseCommercialPercentage,
  requireCommercialDistribution,
  saveCommercialDistributionBeforePdf,
  suggestedCommercialDistribution,
  validateCommercialDistributionDraft,
  type CommercialDistributionDraft,
} from "../client/src/components/spaces/commercial-distribution-form";
import { buildSpaceTrafficProjection } from "../shared/space-traffic-financial-projection";

const saved = { allySharePercent: 10, investorSharePercent: 70, evgreenSharePercent: 30 };
const draft = () => commercialDistributionToDraft(saved);
const render = (value: CommercialDistributionDraft, extra = {}) => renderToStaticMarkup(React.createElement(CommercialDistributionEditor, {
  value, onChange: vi.fn(), source: "SPACE", spaceType: "parking", ...extra,
}));

describe("Reparto comercial · interacción del borrador sin BD", () => {
  it("conserva borrado, cero y separadores transitorios sin defaults ni modificar otros campos", () => {
    let value = draft();
    for (const text of ["", "0", "3", "3,", "3,7", "3,75", "3.", "3.75"]) {
      value = changeCommercialDistributionDraft(value, "allySharePercent", text);
      expect(value.allySharePercent).toBe(text);
      expect(value.investorSharePercent).toBe("70");
      expect(value.evgreenSharePercent).toBe("30");
      expect(render(value)).toContain(`value="${text}"`);
    }
    expect(requireCommercialDistribution(value).allySharePercent).toBe(3.75);
  });

  it.each(["", " ", "-1", "51", "1.234", "1,234", "1e1", "3,7.5", "NaN", "Infinity", ".5"])("rechaza % aliado inválido %s", text => {
    expect(parseCommercialPercentage(text, 50)).toBeUndefined();
    expect(validateCommercialDistributionDraft({ ...draft(), allySharePercent: text }).values).toBeUndefined();
  });

  it("acepta extremos y suma decimal exacta sin perder ceros", () => {
    expect(requireCommercialDistribution({ allySharePercent: "0", investorSharePercent: "0", evgreenSharePercent: "100" }))
      .toEqual({ allySharePercent: 0, investorSharePercent: 0, evgreenSharePercent: 100 });
    expect(requireCommercialDistribution({ allySharePercent: "50", investorSharePercent: "63,75", evgreenSharePercent: "36.25" }))
      .toEqual({ allySharePercent: 50, investorSharePercent: 63.75, evgreenSharePercent: 36.25 });
  });

  it("no completa automáticamente el reparto neto y bloquea guardado incompleto", () => {
    const edited = changeCommercialDistributionDraft(draft(), "investorSharePercent", "63,75");
    expect(edited.evgreenSharePercent).toBe("30");
    expect(validateCommercialDistributionDraft(edited).errors.total).toContain("100%");
    expect(() => requireCommercialDistribution(edited)).toThrow("100%");
    for (const field of ["allySharePercent", "investorSharePercent", "evgreenSharePercent"] as const) {
      expect(() => requireCommercialDistribution({ ...draft(), [field]: "" })).toThrow("completa");
    }
    expect(validateCommercialDistributionDraft({ ...draft(), investorSharePercent: "100.01", evgreenSharePercent: "0" }).errors.investorSharePercent).toBeTruthy();
  });

  it("rehidrata del reparto resuelto al reabrir y sólo restablece defaults de forma explícita", () => {
    const space = { spaceType: "gas_station", commercialDistribution: { allySharePercent: 0, investorSharePercent: 63.75, evgreenSharePercent: 36.25, source: "PROJECT" as const } };
    let edited = commercialDistributionToDraft(commercialDistributionForForm(space));
    edited = changeCommercialDistributionDraft(edited, "allySharePercent", "");
    expect(edited.allySharePercent).toBe("");
    const reopened = commercialDistributionToDraft(commercialDistributionForForm(space));
    expect(reopened).toEqual({ allySharePercent: "0", investorSharePercent: "63.75", evgreenSharePercent: "36.25" });
    expect(commercialDistributionForForm(space).source).toBe("PROJECT");
    expect(commercialDistributionToDraft(suggestedCommercialDistribution("gas_station")))
      .toEqual({ allySharePercent: "10", investorSharePercent: "60", evgreenSharePercent: "40" });
    expect(suggestedCommercialDistribution("parking")).toMatchObject({ allySharePercent: 10, investorSharePercent: 70, evgreenSharePercent: 30 });
    expect(commercialDistributionChanged({ allySharePercent: "10,00", investorSharePercent: "70.0", evgreenSharePercent: "30" }, saved)).toBe(false);
  });
});

describe("Editor reutilizable · render responsivo y bases económicas", () => {
  it("separa base bruta/neto, explica fórmula y no inventa un ejemplo numérico sin calculadora", () => {
    const markup = render(draft());
    expect((markup.match(/type="text"/g) ?? []).length).toBe(3);
    expect((markup.match(/inputMode="decimal"/g) ?? []).length).toBe(3);
    expect(markup).toContain("base: margen bruto");
    expect(markup).toContain("base: margen neto distribuible");
    expect(markup).toContain("ingreso bruto − energía − gastos fijos");
    expect(markup).toContain("canon no es un cuarto reparto");
    expect(markup).toContain("grid-cols-1");
    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain("Restablecer reparto sugerido");
    expect(markup).toContain("No se presumen importes");
    expect(markup).not.toContain("1.800");
  });

  it("usa precios/costos reales y el waterfall canónico para ilustración sin gastos inventados", () => {
    const markup = render(draft(), { example: { salePricePerKwh: 2150, energyCostPerKwh: 925 } });
    expect(markup).toContain("2.150");
    expect(markup).toContain("925");
    expect(markup).toContain("1.225");
    expect(markup).toContain("122,5");
    expect(markup).toContain("771,75");
    expect(markup).toContain("330,75");
    expect(markup).toContain("sin gastos fijos");
    expect(markup).toContain("no es una promesa de retorno");
  });

  it("muestra fuente heredada, cambios pendientes y campos accesibles con errores", () => {
    const markup = render({ ...draft(), allySharePercent: "" }, { source: "PROJECT", dirty: true });
    expect(markup).toContain("Heredado del proyecto vinculado");
    expect(markup).toContain("cambios sin guardar");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("Aliado: completa un valor entre 0 y 50%");
    expect(markup).not.toContain("reparto válido");
    const readOnly = render(draft(), { readOnly: true });
    expect(readOnly).toContain("readOnly");
    expect(readOnly).not.toContain("Restablecer reparto sugerido");
  });
});

describe("PDF y proyección · contratos UI sin llamadas externas", () => {
  it("guarda los tres porcentajes antes de generar y no envía overrides legacy al PDF", async () => {
    const order: string[] = [];
    const save = vi.fn(async values => { order.push("save"); expect(values).toEqual({ allySharePercent: 0, investorSharePercent: 63.75, evgreenSharePercent: 36.25 }); });
    const generate = vi.fn(async () => { order.push("pdf"); return "documento"; });
    const result = await saveCommercialDistributionBeforePdf({ draft: { allySharePercent: "0", investorSharePercent: "63,75", evgreenSharePercent: "36.25" }, saved, save, generate });
    expect(result).toBe("documento");
    expect(order).toEqual(["save", "pdf"]);
    expect(generate).toHaveBeenCalledWith();
  });

  it("no genera si falla guardar o si los campos están vacíos", async () => {
    const generate = vi.fn();
    const save = vi.fn(async () => { throw new Error("falló guardar"); });
    await expect(saveCommercialDistributionBeforePdf({ draft: { ...draft(), allySharePercent: "0" }, saved, save, generate })).rejects.toThrow("falló guardar");
    expect(generate).not.toHaveBeenCalled();
    save.mockClear();
    await expect(saveCommercialDistributionBeforePdf({ draft: { ...draft(), allySharePercent: "" }, saved, save, generate })).rejects.toThrow("completa");
    expect(save).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("no guarda de nuevo el mismo reparto, ni pierde guardado si falla luego el PDF", async () => {
    const save = vi.fn(async () => undefined);
    const generate = vi.fn(async () => "pdf");
    await saveCommercialDistributionBeforePdf({ draft: draft(), saved, save, generate });
    expect(save).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledOnce();
    const failPdf = vi.fn(async () => { throw new Error("falló PDF"); });
    await expect(saveCommercialDistributionBeforePdf({ draft: { ...draft(), allySharePercent: "0" }, saved, save, generate: failPdf })).rejects.toThrow("falló PDF");
    expect(save).toHaveBeenCalledOnce();
  });

  it("el ROI sugerido recibe el canon y ambos porcentajes editados, no defaults globales", () => {
    const custom = requireCommercialDistribution({ allySharePercent: "0", investorSharePercent: "63,75", evgreenSharePercent: "36.25" });
    const input = { investmentCop: 90000000, estimatedDailyVehicles: 700, estimatedEvPercent: 5, chargerCount: 1, totalPowerKw: 120, operatingHoursPerDay: 16, efficiencyPercent: 92, salePricePerKwh: 1800, energyCostPerKwh: 850, spaceType: "gas_station" };
    const projection = buildSpaceTrafficProjection({ ...input, hostSharePercent: custom.allySharePercent, investorSharePercent: custom.investorSharePercent, evgreenSharePercent: custom.evgreenSharePercent });
    expect(projection.assumptions).toMatchObject({ hostSharePercent: 0, investorSharePercent: 63.75, evgreenSharePercent: 36.25 });
    const defaultProjection = buildSpaceTrafficProjection(input);
    expect(projection.scenarios.REALISTIC.investorMonthlyCashflow).not.toBe(defaultProjection.scenarios.REALISTIC.investorMonthlyCashflow);
  });

  it("integra un mismo editor en los cuatro flujos y el prospecto sólo lee reparto persistido", () => {
    const source = readFileSync(new URL("../client/src/pages/admin/Spaces.tsx", import.meta.url), "utf8");
    expect((source.match(/<CommercialDistributionEditor/g) ?? []).length).toBe(4);
    expect(source).toContain("setEditDistributionDraft(commercialDistributionToDraft(savedDistribution))");
    expect(source).toContain("setPublishDistributionDraft(commercialDistributionToDraft(savedDistribution))");
    expect(source).toContain("setProspectoDistributionDraft(commercialDistributionToDraft(savedDistribution))");
    expect(source).toContain("hostSharePercent: editDistribution.allySharePercent");
    expect(source).toContain("investorSharePercent: editDistribution.investorSharePercent");
    expect(source).toContain("evgreenSharePercent: editDistribution.evgreenSharePercent");
    const pdfCall = source.slice(source.indexOf("generate: () => generateProspectoMutation.mutateAsync({"), source.indexOf("if (result.pdfUrl)"));
    expect(pdfCall).not.toContain("SharePercent");
    expect(source).toContain("const payload: Record<string, any> = { id, ...distribution }");
  });
});
