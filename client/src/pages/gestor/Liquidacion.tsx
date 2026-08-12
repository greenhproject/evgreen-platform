/**
 * Portal Comercial — Liquidación auditable.
 * Distingue la proyección basada en transacciones de la liquidación oficial
 * y permite revisar cada componente del margen distribuible.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowDownRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Info,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";

const formatCop = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
}).format(value);

const localDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

function monthFromDate(date: string) {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

function labelMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export default function GestorLiquidacion() {
  const [view, setView] = useState<"DAY" | "MONTH">("MONTH");
  const [selectedDate, setSelectedDate] = useState(localDateKey);
  const selected = useMemo(() => monthFromDate(selectedDate), [selectedDate]);
  const { data, isLoading, isFetching, refetch } = trpc.gestor.getLiquidacionAuditable.useQuery({
    period: view,
    date: selectedDate,
    month: selected.month,
    year: selected.year,
  });

  const totals = data?.totals;
  const isOfficial = data?.officialStatus === "OFFICIAL";
  const isMixed = data?.officialStatus === "MIXED";
  const periodTitle = view === "DAY" ? selectedDate : labelMonth(selected.year, selected.month);

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-[0.16em]">Trazabilidad financiera</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Liquidación</h1>
          <p className="mt-1 text-sm text-slate-400">Comisión calculada con la facturación de transacciones reales.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Actualizar
        </Button>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-lg bg-slate-950 p-1 sm:w-auto">
            <button type="button" onClick={() => setView("DAY")} className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none ${view === "DAY" ? "bg-emerald-500/15 text-emerald-200" : "text-slate-400 hover:text-slate-200"}`}>Día</button>
            <button type="button" onClick={() => setView("MONTH")} className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none ${view === "MONTH" ? "bg-emerald-500/15 text-emerald-200" : "text-slate-400 hover:text-slate-200"}`}>Mes</button>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-9 max-w-[160px] border-slate-700 bg-slate-950 text-sm text-white [color-scheme:dark]" />
            <span className="hidden text-xs text-slate-500 sm:inline">{view === "MONTH" ? labelMonth(selected.year, selected.month) : "Corte diario Colombia"}</span>
          </div>
        </div>
      </section>

      <Card className={isOfficial ? "border-emerald-500/25 bg-emerald-500/[0.06]" : isMixed ? "border-sky-500/25 bg-sky-500/[0.06]" : "border-amber-500/25 bg-amber-500/[0.06]"}>
        <CardContent className="flex gap-3 p-4">
          {isOfficial ? <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : isMixed ? <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" /> : <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-white">{isOfficial ? "Liquidación oficial disponible" : isMixed ? "Corte con información mixta" : "Corte preliminar de transacciones"}</p>
              <Badge className={isOfficial ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" : isMixed ? "border-sky-500/30 bg-sky-500/15 text-sky-200" : "border-amber-500/30 bg-amber-500/15 text-amber-200"}>{isOfficial ? "Oficial" : isMixed ? "Mixto" : "Devengado"}</Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {isOfficial
                ? "El resultado usa la liquidación financiera emitida para el período. La comisión queda lista para revisión y pago conforme al estado de la liquidación."
                : isMixed
                  ? "Algunas estaciones ya tienen liquidación oficial y otras aún muestran un cálculo preliminar. Revisa el estado de cada estación antes de tomar este total como pago aprobado."
                  : "El valor se calcula en tiempo real con transacciones completadas y costos operativos prorrateados. No representa un pago aprobado hasta que se emita la liquidación oficial."}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={ReceiptText} label="Facturación" value={formatCop(totals?.grossRevenue ?? 0)} accent="text-sky-300" background="bg-sky-500/10" />
        <SummaryCard icon={Zap} label="Energía vendida" value={`${(totals?.totalKwh ?? 0).toFixed(1)} kWh`} accent="text-violet-300" background="bg-violet-500/10" />
        <SummaryCard icon={TrendingUp} label="Margen distribuible" value={formatCop(totals?.netDistributableMargin ?? 0)} accent="text-blue-300" background="bg-blue-500/10" />
        <SummaryCard icon={CircleDollarSign} label={isOfficial ? "Comisión a liquidar" : "Comisión devengada"} value={formatCop(totals?.gestorCommission ?? 0)} accent="text-emerald-300" background="bg-emerald-500/10" />
      </section>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader className="pb-3"><CardTitle className="text-base text-white">Waterfall — {periodTitle}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <WaterfallRow label="Facturación de transacciones completadas" value={totals?.grossRevenue ?? 0} tone="positive" />
          <WaterfallRow label="Costo de energía" value={-(totals?.energyCost ?? 0)} />
          <WaterfallRow label="Gastos operativos prorrateados" value={-(totals?.fixedExpenses ?? 0)} />
          <WaterfallRow label="Participación del aliado comercial" value={-((totals?.grossRevenue ?? 0) - (totals?.energyCost ?? 0) - (totals?.fixedExpenses ?? 0) - (totals?.netDistributableMargin ?? 0))} />
          <WaterfallRow label="Margen distribuible" value={totals?.netDistributableMargin ?? 0} highlight />
          <div className="ml-3 border-l border-slate-700 pl-3 sm:ml-5 sm:pl-4">
            <WaterfallRow label="Bolsa inversionistas" value={totals?.investorPool ?? 0} tone="info" />
            <WaterfallRow label="Bolsa EVGreen" value={totals?.evgreenPool ?? 0} tone="info" />
            <WaterfallRow label="Tu comisión" value={totals?.gestorCommission ?? 0} tone="positive" highlight />
            <WaterfallRow label="EVGreen retenido" value={totals?.evgreenRetained ?? 0} />
          </div>
          <p className="pt-2 text-[11px] leading-relaxed text-slate-500">Fórmula: ingresos cobrados − costo de energía − gastos operativos − participación del aliado = margen distribuible. La comisión comercial se descuenta exclusivamente de la bolsa EVGreen y nunca del porcentaje del inversionista.</p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div><h2 className="font-semibold text-white">Detalle por estación</h2><p className="mt-0.5 text-xs text-slate-500">Cada línea conserva la base de cálculo y su estado de liquidación.</p></div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-emerald-400" /></div>
        ) : !data?.stations.length ? (
          <Card className="border-dashed border-slate-700 bg-slate-900/50"><CardContent className="p-8 text-center"><ReceiptText className="mx-auto mb-3 h-9 w-9 text-slate-600" /><p className="font-medium text-white">Aún no hay estaciones vinculadas</p><p className="mt-1 text-sm text-slate-400">Cuando el administrador vincule una estación a tu usuario comercial, aquí aparecerán sus transacciones y tu comisión.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {data.stations.map((station) => (
              <Card key={station.stationId} className="border-slate-800 bg-slate-900/70">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex items-center gap-2"><p className="font-semibold text-white">{station.stationName}</p><Badge className={station.isOfficial ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-200" : "border-amber-500/25 bg-amber-500/15 text-amber-200"}>{station.isOfficial ? "Oficial" : "Preliminar"}</Badge></div><p className="mt-0.5 text-xs text-slate-400">{station.stationCity} · {station.totalSessions} sesiones · {station.totalKwh.toFixed(1)} kWh</p></div>
                    <div className="sm:text-right"><p className="text-[11px] uppercase tracking-wide text-slate-500">Comisión {station.commissionPercent.toFixed(2)}%</p><p className="text-lg font-bold text-emerald-300">{formatCop(station.gestorCommission)}</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-xs sm:grid-cols-4"><MiniLine label="Facturación" value={formatCop(station.grossRevenue)} /><MiniLine label="Costo energía" value={formatCop(station.energyCost)} /><MiniLine label="Margen distribuible" value={formatCop(station.netDistributableMargin)} /><MiniLine label="EVGreen retenido" value={formatCop(station.evgreenRetained)} /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {(data?.transactions.length ?? 0) > 0 && (
        <details className="group rounded-xl border border-slate-800 bg-slate-900/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-white"><span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-emerald-300" />Auditoría de transacciones ({data?.transactions.length})</span><ArrowDownRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-45" /></summary>
          <div className="space-y-2 border-t border-slate-800 p-3 sm:p-4">
            {data?.transactions.map((transaction) => (
              <div key={transaction.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-slate-950/60 p-3 sm:grid-cols-[1.4fr_repeat(3,auto)] sm:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{transaction.stationName}</p><p className="mt-0.5 text-[11px] text-slate-500">#{transaction.id} · {new Date(transaction.startedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</p></div>
                <div className="text-right"><p className="text-[10px] text-slate-500">kWh</p><p className="text-xs text-slate-300">{transaction.totalKwh.toFixed(2)}</p></div>
                <div className="text-right"><p className="text-[10px] text-slate-500">Cobrado</p><p className="text-xs text-slate-300">{formatCop(transaction.grossRevenue)}</p></div>
                <div className="col-span-2 text-right sm:col-span-1"><p className="text-[10px] text-slate-500">Contribución margen</p><p className="text-xs font-semibold text-emerald-300">{formatCop(transaction.contributionMargin)}</p></div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent, background }: { icon: typeof Zap; label: string; value: string; accent: string; background: string }) {
  return <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-3 sm:p-4"><div className="flex items-start gap-2.5"><div className={`rounded-lg p-2 ${background}`}><Icon className={`h-4 w-4 ${accent}`} /></div><div className="min-w-0"><p className="truncate text-base font-bold text-white sm:text-lg">{value}</p><p className="mt-0.5 text-[11px] leading-tight text-slate-400">{label}</p></div></div></CardContent></Card>;
}

function WaterfallRow({ label, value, tone, highlight = false }: { label: string; value: number; tone?: "positive" | "info"; highlight?: boolean }) {
  const valueClass = tone === "positive" ? "text-emerald-300" : tone === "info" ? "text-sky-300" : value < 0 ? "text-rose-300" : "text-slate-200";
  return <div className={`flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-sm ${highlight ? "bg-slate-800/80" : ""}`}><span className={highlight ? "font-medium text-white" : "text-slate-400"}>{label}</span><span className={`shrink-0 font-semibold ${valueClass}`}>{value < 0 ? "−" : ""}{formatCop(Math.abs(value))}</span></div>;
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 truncate font-medium text-slate-200">{value}</p></div>;
}
