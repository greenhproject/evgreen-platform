import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CrowdfundingProjectionSimulator } from "../client/src/components/crowdfunding/CrowdfundingProjectionSimulator";

describe("CrowdfundingProjectionSimulator", () => {
  it("renderiza los tres escenarios y explica la fuente calculada de ROI/payback", () => {
    const markup = renderToStaticMarkup(React.createElement(CrowdfundingProjectionSimulator, {
      investmentCop: 90_000_000,
      totalPowerKw: 120,
      assumptions: {
        salePricePerKwh: 1800,
        energyCostPerKwh: 850,
        hostSharePercent: 10,
        investorSharePercent: 70,
        evgreenSharePercent: 30,
        efficiencyPercent: 92,
        fixedMonthlyExpenses: 0,
      },
      selectedScenario: "REALISTIC",
      applied: false,
      hasStoredProjection: false,
      onAssumptionsChange: vi.fn(),
      onScenarioChange: vi.fn(),
      onApply: vi.fn(),
    }));

    expect(markup).toContain("Fuente de ROI y payback");
    expect(markup).toContain("Pesimista");
    expect(markup).toContain("Realista");
    expect(markup).toContain("Optimista");
    expect(markup).toContain("Aplicar escenario al proyecto");
    expect(markup).toContain("no constituye garantía de rentabilidad");
    expect(markup).toContain("grid-cols-1");
    expect(markup).toContain("sm:grid-cols-3");
  });
});
