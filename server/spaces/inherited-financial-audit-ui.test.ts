import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InheritedFinancialAudit } from "../../client/src/components/crowdfunding/InheritedFinancialAudit";

describe("InheritedFinancialAudit", () => {
  it("muestra valor heredado, ajuste y auditoría completa de una excepción", () => {
    const markup = renderToStaticMarkup(
      React.createElement(InheritedFinancialAudit, {
        snapshot: {
          targetAmount: 900000000,
          minimumInvestment: 10000000,
          estimatedRoiPercent: "76.25",
          estimatedPaybackMonths: 22,
        },
        current: {
          targetAmount: 950000000,
          minimumInvestment: 10000000,
          estimatedRoiPercent: "76.25",
          estimatedPaybackMonths: 22,
        },
        overrideReason: "Cotización actualizada con potencia validada durante la visita técnica.",
        overrideByName: "Laura Admin",
        overrideAt: "2026-08-18T20:43:00.000Z",
      }),
    );

    expect(markup).toContain("Heredado:");
    expect(markup).toContain("Actual:");
    expect(markup).toContain("ajustado");
    expect(markup).toContain("Excepción auditada:");
    expect(markup).toContain("Laura Admin");
    expect(markup).toContain("Cotización actualizada");
  });
});
