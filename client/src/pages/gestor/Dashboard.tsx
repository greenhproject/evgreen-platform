/** Dashboard principal del Portal Comercial EVGreen. */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  FileCheck2,
  MapPin,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

const formatCop = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

export default function GestorDashboard() {
  const now = new Date();
  const { data: cartera, isLoading: carteraLoading } = trpc.gestor.getCartera.useQuery();
  const { data: settlement, isLoading: settlementLoading } = trpc.gestor.getLiquidacionAuditable.useQuery({
    period: "MONTH",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const loading = carteraLoading || settlementLoading;
  const totals = settlement?.totals;

  if (loading) {
    return <div className="flex min-h-80 items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-emerald-400" /></div>;
  }

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-[0.16em]">Portal Comercial</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Resumen de cartera</h1>
          <p className="mt-1 text-sm text-slate-400">Oportunidades, activos operativos y comisión trazable en un solo lugar.</p>
        </div>
        <Link href="/gestor/cotizaciones" className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">Crear cotización <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={MapPin} value={String(cartera?.spaces.length ?? 0)} label="Oportunidades" color="text-sky-300" bg="bg-sky-500/10" />
        <Metric icon={Zap} value={String(cartera?.summary.activeStations ?? 0)} label="Activos operativos" color="text-emerald-300" bg="bg-emerald-500/10" />
        <Metric icon={TrendingUp} value={formatCop(totals?.grossRevenue ?? 0)} label="Facturación mensual" color="text-violet-300" bg="bg-violet-500/10" compact />
        <Metric icon={CircleDollarSign} value={formatCop(totals?.gestorCommission ?? 0)} label="Comisión devengada" color="text-amber-300" bg="bg-amber-500/10" compact />
      </section>

      <Card className="border-emerald-500/20 bg-emerald-500/[0.05]">
        <CardContent className="flex gap-3 p-4"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="font-medium text-white">Comisión transparente y auditable</p><p className="mt-1 text-xs leading-relaxed text-slate-400">La comisión se calcula sobre el margen distribuible de las transacciones completadas, después de energía, gastos operativos y aliado comercial. Se descuenta de la bolsa EVGreen, sin modificar la participación del inversionista.</p><Link href="/gestor/liquidacion" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">Ver waterfall y auditoría <ArrowRight className="h-3.5 w-3.5" /></Link></div></CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="mb-4 flex items-center justify-between"><div><p className="font-semibold text-white">Oportunidades recientes</p><p className="mt-0.5 text-xs text-slate-500">Espacios vinculados a tu gestión.</p></div><Link href="/gestor/cartera" className="text-xs font-medium text-emerald-300 hover:text-emerald-200">Ver cartera</Link></div>{cartera?.spaces.length ? <div className="space-y-2">{cartera.spaces.slice(0, 4).map((space) => <div key={space.id} className="flex items-center gap-3 rounded-lg bg-slate-950/60 p-3"><div className="rounded-lg bg-sky-500/10 p-2"><MapPin className="h-4 w-4 text-sky-300" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{space.name}</p><p className="truncate text-xs text-slate-500">{space.city} · {space.code}</p></div><p className="text-xs font-medium text-emerald-300">{Number(space.gestorCommissionPercent).toFixed(2)}%</p></div>)}</div> : <Empty icon={Building2} text="Aún no hay oportunidades vinculadas." />}</CardContent></Card>

        <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-4"><div className="mb-4 flex items-center justify-between"><div><p className="font-semibold text-white">Activos operativos</p><p className="mt-0.5 text-xs text-slate-500">Corte del mes en curso.</p></div><Link href="/gestor/liquidacion" className="text-xs font-medium text-emerald-300 hover:text-emerald-200">Auditar</Link></div>{cartera?.stations.length ? <div className="space-y-2">{cartera.stations.slice(0, 4).map((station) => <div key={station.id} className="flex items-center gap-3 rounded-lg bg-slate-950/60 p-3"><div className="rounded-lg bg-emerald-500/10 p-2"><Zap className="h-4 w-4 text-emerald-300" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{station.name}</p><p className="text-xs text-slate-500">{station.month.totalSessions} sesiones · {formatCop(station.month.grossRevenue)}</p></div><div className="text-right"><p className="flex items-center justify-end text-[10px] text-slate-500">{station.isOnline ? <Wifi className="mr-1 h-3 w-3 text-emerald-300" /> : <WifiOff className="mr-1 h-3 w-3" />}{station.isOnline ? "En línea" : "Sin conexión"}</p><p className="mt-0.5 text-xs font-semibold text-emerald-300">{formatCop(station.month.commissionAccrued)}</p></div></div>)}</div> : <Empty icon={Zap} text="Aún no hay estaciones vinculadas a este gestor." />}</CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label, color, bg, compact = false }: { icon: typeof Zap; value: string; label: string; color: string; bg: string; compact?: boolean }) {
  return <Card className="border-slate-800 bg-slate-900/70"><CardContent className="p-3 sm:p-4"><div className="flex gap-2.5"><div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-4 w-4 ${color}`} /></div><div className="min-w-0"><p className={`truncate font-bold text-white ${compact ? "text-base sm:text-lg" : "text-xl"}`}>{value}</p><p className="mt-0.5 text-[11px] text-slate-400">{label}</p></div></div></CardContent></Card>;
}

function Empty({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center text-center"><Icon className="mb-2 h-7 w-7 text-slate-600" /><p className="text-sm text-slate-500">{text}</p></div>;
}
