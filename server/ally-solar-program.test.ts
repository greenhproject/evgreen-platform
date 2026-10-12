import { describe, expect, it } from "vitest";
import { buildAllySolarProgram } from "../shared/ally-solar-program";

describe("ally solar program", () => {
  it("calcula ahorro mensual, cuota de sustitución, IPC y beneficio posterior al plazo", () => {
    const snapshot = buildAllySolarProgram({
      enabled: true,
      currentMonthlyBillCop: 15_000_000,
      savingsCoveragePercent: 40,
      agreementYears: 6,
      annualCpiPercent: 3,
      usefulLifeYears: 30,
      systemPowerKwp: 112,
      annualGenerationKwh: 140_870,
      selfConsumptionPercent: 40,
      exportPercent: 60,
      gridTariffCopPerKwh: 910,
    });

    expect(snapshot?.initialMonthlySavingsCop).toBe(6_000_000);
    expect(snapshot?.initialAnnualSavingsCop).toBe(72_000_000);
    expect(snapshot?.initialMonthlyReplacementQuotaCop).toBe(9_000_000);
    expect(snapshot?.assumptions.agreementYears).toBe(6);
    expect(snapshot?.assumptions.usefulLifeYears).toBe(30);
    expect(snapshot?.agreementSavingsCop).toBeGreaterThan(6 * 72_000_000);
    expect(snapshot?.postAgreementAnnualSavingsCop).toBeGreaterThan(72_000_000);
    expect(snapshot?.totalReferenceSavingsCop).toBeGreaterThan(snapshot?.agreementSavingsCop ?? 0);
  });

  it("devuelve null cuando el programa está desactivado", () => {
    expect(buildAllySolarProgram({ enabled: false, currentMonthlyBillCop: 15_000_000 })).toBeNull();
  });

  it("exige factura y cobertura cuando el programa está activado", () => {
    expect(() => buildAllySolarProgram({ enabled: true, savingsCoveragePercent: 40 })).toThrow(/factura/i);
    expect(() => buildAllySolarProgram({ enabled: true, currentMonthlyBillCop: 15_000_000, savingsCoveragePercent: 120 })).toThrow(/entre 0 y 100/i);
  });
});
