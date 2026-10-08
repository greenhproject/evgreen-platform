import { describe, expect, it } from "vitest";
import { hasCrowdfundingFinancialChanges } from "../shared/crowdfunding-financial-changes";

describe("hasCrowdfundingFinancialChanges", () => {
  const current = {
    targetAmount: 1_000_000_000,
    minimumInvestment: 50_000_000,
    totalPowerKw: 22,
    chargerCount: 2,
    chargerPowerKw: 11,
    estimatedRoiPercent: "85.00",
    estimatedPaybackMonths: 14,
  };

  it("no confunde el snapshot heredado con el valor actual al abrir y guardar sin cambios", () => {
    expect(hasCrowdfundingFinancialChanges(current, {
      targetAmount: 1_000_000_000,
      minimumInvestment: 50_000_000,
      totalPowerKw: 22,
      chargerCount: 2,
      chargerPowerKw: 11,
      estimatedRoiPercent: 85,
      estimatedPaybackMonths: 14,
    })).toBe(false);
  });

  it("detecta el ajuste real aunque el nuevo valor coincida con una cifra heredada de Espacios", () => {
    expect(hasCrowdfundingFinancialChanges(current, {
      targetAmount: 90_000_000,
      totalPowerKw: 120,
      chargerCount: 1,
      chargerPowerKw: 120,
      estimatedRoiPercent: 40,
      estimatedPaybackMonths: 24,
    })).toBe(true);
  });
});
