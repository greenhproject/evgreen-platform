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

  it("separa cuota contractual, factura solar residual y ahorro posterior de la propuesta OpenSolar", () => {
    const snapshot = buildAllySolarProgram({
      enabled: true,
      currentMonthlyBillCop: 2_184_000,
      energyVsConsumptionPercent: 104.68,
      savingsCoveragePercent: 39.54,
      agreementYears: 6,
      annualCpiPercent: 3,
      usefulLifeYears: 30,
      monthlyFinancingPaymentCop: 2_162_043,
      initialMonthlySolarBillCop: 142_394,
      postAgreementMonthlySolarBillCop: 423_835,
    });

    expect(snapshot?.initialMonthlySavingsCop).toBe(2_041_606);
    expect(snapshot?.initialMonthlyFinancingPaymentCop).toBe(2_162_043);
    expect(snapshot?.initialMonthlyNetCashflowCop).toBe(-120_437);
    expect(snapshot?.postAgreementMonthlyGridBillCop).toBe(2_607_810);
    expect(snapshot?.postAgreementMonthlySolarBillCop).toBe(423_835);
    expect(snapshot?.postAgreementMonthlyNetSavingsCop).toBe(2_183_975);
    expect(snapshot?.assumptions.energyVsConsumptionPercent).toBe(104.68);
    expect(snapshot?.assumptions.financingPaymentSource).toBe("OpenSolar");
    expect(snapshot?.assumptions.solarBillSource).toBe("OpenSolar");
  });

  it("devuelve null cuando el programa está desactivado", () => {
    expect(buildAllySolarProgram({ enabled: false, currentMonthlyBillCop: 15_000_000 })).toBeNull();
  });

  it("exige factura y cobertura cuando el programa está activado", () => {
    expect(() => buildAllySolarProgram({ enabled: true, savingsCoveragePercent: 40 })).toThrow(/factura/i);
    expect(() => buildAllySolarProgram({ enabled: true, currentMonthlyBillCop: 15_000_000, savingsCoveragePercent: 120 })).toThrow(/entre 0 y 100/i);
  });
});
