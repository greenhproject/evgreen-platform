import React, { useMemo } from "react";
import { BarChart3, Calculator, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCrowdfundingProjectionSnapshot,
  CROWDFUNDING_PROJECTION_SCENARIOS,
  type CrowdfundingProjectionInput,
  type CrowdfundingProjectionScenario,
} from "@shared/crowdfunding-financial-projection";

export type CrowdfundingProjectionAssumptions = Omit<CrowdfundingProjectionInput, "investmentCop" | "totalPowerKw">;

type Props = {
  investmentCop: number;
  totalPowerKw: number;
  assumptions: CrowdfundingProjectionAssumptions;
  selectedScenario: CrowdfundingProjectionScenario;
  applied: boolean;
  hasStoredProjection: boolean;
  onAssumptionsChange: (next: CrowdfundingProjectionAssumptions) => void;
  onScenarioChange: (scenario: CrowdfundingProjectionScenario) => void;
  onApply: (roiAnnualPercent: number, paybackMonths: number) => void;
};

const formatCop = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
}).format(value);

export function CrowdfundingProjectionSimulator({
  investmentCop,
  totalPowerKw,
  assumptions,
  selectedScenario,
  applied,
  hasStoredProjection,
  onAssumptionsChange,
  onScenarioChange,
  onApply,
}: Props) {
  const projection = useMemo(() => {
    try {
      return {
        snapshot: buildCrowdfundingProjectionSnapshot({ investmentCop, totalPowerKw, ...assumptions }, selectedScenario),
        error: null,
      };
    } catch (error) {
      return { snapshot: null, error: error instanceof Error ? error.message : "No fue posible calcular los escenarios." };
    }
  }, [assumptions, investmentCop, selectedScenario, totalPowerKw]);

  const selected = projection.snapshot?.scenarios[selectedScenario];
  const updateNumber = (field: keyof CrowdfundingProjectionAssumptions, value: string) => {
    onAssumptionsChange({ ...assumptions, [field]: Number(value) });
  };

  return (
    <section className="space-y-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 sm:p-4" aria-label="Simulador de escenarios financieros">
      <div className="flex items-start gap-3">
        <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
        <div>
          <h4 className="text-sm font-semibold text-cyan-100">Fuente de ROI y payback</h4>
          <p className="mt-1 text-xs text-slate-300">
            El sistema calcula ambos indicadores; no se digitan manualmente. La base es {formatCop(investmentCop)} de inversión y {totalPowerKw || 0} kW instalados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Precio de venta (COP/kWh)</Label>
          <Input type="number" min={1} value={assumptions.salePricePerKwh} onChange={(event) => updateNumber("salePricePerKwh", event.target.value)} />
        </div>
        <div>
          <Label>Costo de energía (COP/kWh)</Label>
          <Input type="number" min={0} value={assumptions.energyCostPerKwh} onChange={(event) => updateNumber("energyCostPerKwh", event.target.value)} />
        </div>
        <div>
          <Label>Eficiencia de carga (%)</Label>
          <Input type="number" min={1} max={100} step="0.1" value={assumptions.efficiencyPercent} onChange={(event) => updateNumber("efficiencyPercent", event.target.value)} />
        </div>
        <div>
          <Label>Gastos fijos mensuales (COP)</Label>
          <Input type="number" min={0} value={assumptions.fixedMonthlyExpenses ?? 0} onChange={(event) => updateNumber("fixedMonthlyExpenses", event.target.value)} />
        </div>
      </div>

      {projection.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{projection.error}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CROWDFUNDING_PROJECTION_SCENARIOS.map((scenario) => {
              const result = projection.snapshot!.scenarios[scenario.key];
              const active = selectedScenario === scenario.key;
              return (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => onScenarioChange(scenario.key)}
                  className={`min-h-[118px] rounded-lg border p-3 text-left transition-colors ${active ? "border-emerald-400 bg-emerald-500/15" : "border-slate-700 bg-slate-950/50 hover:border-slate-500"}`}
                  aria-pressed={active}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                    {scenario.label}
                    {active && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  </span>
                  <span className="mt-2 block text-2xl font-bold text-emerald-300">{result.roiAnnualPercent.toFixed(2)}%</span>
                  <span className="block text-xs text-slate-300">ROI anual · payback {result.paybackMonths.toFixed(1)} meses</span>
                  <span className="mt-2 block text-[11px] text-slate-400">{scenario.hoursPerDay} h/día · {formatCop(result.investorMonthlyCashflow)}/mes al inversionista</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
            <p className="flex items-center gap-2 font-medium text-white"><BarChart3 className="h-4 w-4 text-emerald-300" /> Escenario seleccionado: {selected?.label}</p>
            <p className="mt-1">Venta − energía − gastos fijos = margen bruto; luego se descuenta aliado ({assumptions.hostSharePercent}%) y se distribuye el neto a inversionista ({assumptions.investorSharePercent}%) y EVGreen ({assumptions.evgreenSharePercent}%).</p>
          </div>

          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            onClick={() => selected && onApply(selected.roiAnnualPercent, Math.ceil(selected.paybackMonths))}
          >
            {applied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Calculator className="mr-2 h-4 w-4" />}
            {applied ? "Escenario aplicado" : hasStoredProjection ? "Recalcular y aplicar" : "Aplicar escenario al proyecto"}
          </Button>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        Proyección indicativa basada en supuestos operativos; no constituye garantía de rentabilidad. El snapshot y el escenario aplicado quedan guardados para auditoría.
      </p>
    </section>
  );
}
