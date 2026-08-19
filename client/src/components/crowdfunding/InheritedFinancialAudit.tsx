import React from "react";

type Snapshot = Record<string, unknown> | null | undefined;
type Current = Record<string, unknown>;

const rows = [
  { key: "targetAmount", label: "Meta de inversión", kind: "currency" },
  { key: "minimumInvestment", label: "Inversión mínima", kind: "currency" },
  { key: "estimatedRoiPercent", label: "ROI estimado", kind: "percent" },
  { key: "estimatedPaybackMonths", label: "Payback", kind: "months" },
] as const;

function display(value: unknown, kind: (typeof rows)[number]["kind"]) {
  const number = Number(value ?? 0);
  if (kind === "currency") return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(number);
  if (kind === "percent") return `${number.toFixed(2)}%`;
  return `${number} meses`;
}

export function InheritedFinancialAudit({
  snapshot,
  current,
  overrideReason,
  overrideAt,
  overrideByName,
}: {
  snapshot: Snapshot;
  current: Current;
  overrideReason?: string | null;
  overrideAt?: string | Date | null;
  overrideByName?: string | null;
}) {
  if (!snapshot) return null;

  const original = (key: string) => snapshot[key];
  const changed = (key: string) => Number(original(key)) !== Number(current[key]);

  return (
    <section className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3" aria-label="Comparación de proyección heredada">
      <h4 className="text-sm font-semibold text-cyan-100">Fuente: evaluación aprobada en Espacios</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1.5 text-xs">
            <p className="text-slate-400">{row.label}</p>
            <p className="text-cyan-200">Heredado: {display(original(row.key), row.kind)}</p>
            <p className={changed(row.key) ? "font-medium text-amber-300" : "text-slate-300"}>
              Actual: {display(current[row.key], row.kind)}{changed(row.key) ? " · ajustado" : ""}
            </p>
          </div>
        ))}
      </div>
      {overrideReason && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
          <p><strong>Excepción auditada:</strong> {overrideReason}</p>
          <p className="mt-1 text-amber-100/80">{overrideByName || "Administrador"}{overrideAt ? ` · ${new Date(overrideAt).toLocaleString("es-CO")}` : ""}</p>
        </div>
      )}
    </section>
  );
}
