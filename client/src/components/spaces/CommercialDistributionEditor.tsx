import React, { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateFinancialWaterfall } from "@shared/financial-waterfall";
import {
  changeCommercialDistributionDraft,
  commercialDistributionToDraft,
  suggestedCommercialDistribution,
  validateCommercialDistributionDraft,
  type CommercialDistributionDraft,
  type CommercialDistributionSource,
} from "./commercial-distribution-form";

const SOURCE_LABELS: Record<CommercialDistributionSource, string> = {
  SPACE: "Guardado en este espacio",
  PROJECT: "Heredado del proyecto vinculado",
  DEFAULT: "Sugerido por tipo de espacio · aún sin acuerdo propio",
};
const percentage = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const currency = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });

export type CommercialDistributionEditorProps = {
  value: CommercialDistributionDraft;
  onChange?: (value: CommercialDistributionDraft) => void;
  spaceType?: string | null;
  source: CommercialDistributionSource;
  dirty?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  saveExplanation?: string;
  example?: { salePricePerKwh: number; energyCostPerKwh: number };
};

/** Un único editor para crear, editar, publicar y preparar documentos del espacio. */
export function CommercialDistributionEditor({
  value, onChange, spaceType, source, dirty = false, readOnly = false, disabled = false, saveExplanation, example,
}: CommercialDistributionEditorProps) {
  const id = useId();
  const validation = validateCommercialDistributionDraft(value);
  const suggested = suggestedCommercialDistribution(spaceType);
  const values = validation.values;
  const exampleAvailable = example && Number.isFinite(example.salePricePerKwh) && example.salePricePerKwh > 0
    && Number.isFinite(example.energyCostPerKwh) && example.energyCostPerKwh >= 0;
  const illustrative = values && exampleAvailable ? calculateFinancialWaterfall({
    grossRevenue: example.salePricePerKwh,
    totalKwh: 1,
    energyCostPerKwh: example.energyCostPerKwh,
    fixedExpenses: 0,
    hostSharePercent: values.allySharePercent,
    investorSharePercent: values.investorSharePercent,
    evgreenSharePercent: values.evgreenSharePercent,
  }) : null;

  const field = (name: keyof CommercialDistributionDraft, label: string, maximum: number) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`${id}-${name}`} className="block text-xs text-gray-200">{label}</Label>
      <div className="relative">
        <Input
          id={`${id}-${name}`}
          type="text"
          inputMode="decimal"
          value={value[name]}
          readOnly={readOnly}
          disabled={disabled}
          aria-invalid={Boolean(validation.errors[name])}
          aria-describedby={`${id}-${name}-help${validation.errors[name] ? ` ${id}-${name}-error` : ""}`}
          onChange={event => onChange?.(changeCommercialDistributionDraft(value, name, event.target.value))}
          className="h-10 border-[#374151] bg-[#111827] pr-8 text-sm text-white"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 text-xs text-gray-400">%</span>
      </div>
      <p id={`${id}-${name}-help`} className="text-[11px] text-gray-400">0–{maximum}% · hasta 2 decimales, punto o coma</p>
      {validation.errors[name] && <p id={`${id}-${name}-error`} className="text-xs leading-4 text-amber-200">{validation.errors[name]}</p>}
    </div>
  );

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-3 rounded-lg border border-emerald-400/25 bg-[#0a0f1a] p-3 sm:p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <h4 id={`${id}-title`} className="text-sm font-semibold text-emerald-300">Reparto económico del espacio</h4>
        <span className="text-[11px] leading-4 text-gray-300">{SOURCE_LABELS[source]}{dirty ? " · cambios sin guardar" : ""}</span>
      </div>
      {saveExplanation && <p className="text-xs leading-5 text-gray-300">{saveExplanation}</p>}
      <div className="rounded-lg border border-sky-400/25 bg-sky-500/5 p-3">
        <p className="mb-2 text-xs font-medium text-sky-200">1. Aliado · base: margen bruto</p>
        {field("allySharePercent", "Aliado (% del margen bruto)", 50)}
        <p className="mt-2 text-[11px] leading-4 text-sky-100/80">El canon del aliado se descuenta primero. Si el acuerdo no contempla canon independiente, configura 0%. El canon no es un cuarto reparto ni un gasto fijo adicional.</p>
      </div>
      <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-3">
        <p className="mb-2 text-xs font-medium text-emerald-200">2. Inversionista y EVGreen · base: margen neto distribuible</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("investorSharePercent", "Inversionista (% del margen neto)", 100)}
          {field("evgreenSharePercent", "EVGreen (% del margen neto)", 100)}
        </div>
        {validation.errors.total
          ? <p role="status" className="mt-2 text-xs text-amber-200">{validation.errors.total}</p>
          : values && <p className="mt-2 text-xs text-emerald-200">Suma neta: {percentage(values.investorSharePercent + values.evgreenSharePercent)}% · reparto válido</p>}
      </div>
      <div className="space-y-1 rounded-md border border-[#374151] p-2.5 text-xs leading-5 text-gray-300">
        <p><strong className="text-white">Fórmula:</strong> ingreso bruto − energía − gastos fijos = margen bruto (mínimo 0).</p>
        <p>Canon aliado = margen bruto × % aliado. Margen neto = margen bruto − canon aliado.</p>
        <p>Inversionista = margen neto × % inversionista. EVGreen = margen neto × % EVGreen.</p>
        {illustrative ? <p className="border-t border-[#374151] pt-2 text-gray-200">
          <strong>Ejemplo ilustrativo por 1 kWh, sin gastos fijos:</strong> tarifa {currency(example!.salePricePerKwh)} − energía {currency(example!.energyCostPerKwh)} = margen bruto {currency(illustrative.grossMargin)}. Canon aliado ({percentage(values!.allySharePercent)}%): {currency(illustrative.hostPayout)}. Neto: {currency(illustrative.netDistributableMargin)} → inversionista {currency(illustrative.investorPool)} y EVGreen {currency(illustrative.evgreenPool)}. Usa parámetros vigentes de la calculadora; no es una promesa de retorno.
        </p> : <p className="border-t border-[#374151] pt-2 text-gray-400">Ejemplo general: primero se calcula el canon sobre el margen bruto; sólo el saldo neto se divide entre inversionista y EVGreen. No se presumen importes, gastos ni acuerdos.</p>}
      </div>
      {!readOnly && onChange && <div className="space-y-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(commercialDistributionToDraft(suggested))} className="h-auto min-h-9 w-full whitespace-normal border-emerald-400/35 text-xs text-emerald-200 sm:w-auto">
          Restablecer reparto sugerido
        </Button>
        <p className="text-[11px] leading-4 text-gray-400">Sugerencia {spaceType === "gas_station" ? "EDS" : "otros negocios"}: aliado 10% del bruto; inversionista {suggested.investorSharePercent}% / EVGreen {suggested.evgreenSharePercent}% del neto. Cambiar un campo no modifica los demás.</p>
      </div>}
    </section>
  );
}
