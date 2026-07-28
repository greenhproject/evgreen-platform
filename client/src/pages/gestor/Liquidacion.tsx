/**
 * Portal del Gestor Comercial — Liquidación mensual detallada
 * Muestra el desglose de comisiones por estación y mes.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Zap, DollarSign, Info } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  calculating: "Calculando",
  closed: "Cerrado",
  distributed: "Distribuido",
  cancelled: "Cancelado",
};

export default function GestorLiquidacion() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = trpc.gestor.getLiquidacionMensual.useQuery({ month, year });
  const { data: gananciasData } = trpc.gestor.getMisGanancias.useQuery({ year });

  const years = [2024, 2025, 2026, 2027];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Liquidación de Comisiones</h1>
          <p className="text-slate-400 text-sm">Transparencia total en tu participación por cada estación</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
            <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)} className="text-white">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-24 bg-slate-800 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {years.map(y => (
                <SelectItem key={y} value={String(y)} className="text-white">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fórmula explicativa */}
      <Card className="bg-blue-900/20 border-blue-700/40">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <p className="font-semibold text-blue-300 mb-1">Cómo se calcula tu comisión</p>
              <p className="text-slate-400">
                <strong className="text-white">Margen Neto</strong> = (Precio Venta kWh − Costo Energía) − 10% Aliado EDS
              </p>
              <p className="text-slate-400 mt-0.5">
                <strong className="text-white">Tu Comisión</strong> = Margen Neto × Tu % negociado (sale del 30% EVGreen, sin afectar al inversionista)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{fmt(data?.totalCommission ?? 0)}</p>
                <p className="text-xs text-slate-400">A liquidar este mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Zap className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {(data?.lines?.reduce((a, l) => a + (l?.totalKwhSold ?? 0), 0) ?? 0).toFixed(1)} kWh
                </p>
                <p className="text-xs text-slate-400">kWh vendidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 col-span-2 md:col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{fmt(gananciasData?.totalCommission ?? 0)}</p>
                <p className="text-xs text-slate-400">Comisión acumulada {year}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalle por estación */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">
            Detalle — {MONTHS[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
          ) : !data?.lines?.length ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No hay datos de facturación para este período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left pb-3">Estación</th>
                    <th className="text-right pb-3">kWh Vendidos</th>
                    <th className="text-right pb-3">Ingreso Bruto</th>
                    <th className="text-right pb-3">Costo Energía</th>
                    <th className="text-right pb-3">Pago ADE</th>
                    <th className="text-right pb-3">Margen Neto</th>
                    <th className="text-right pb-3">Tu %</th>
                    <th className="text-right pb-3 text-emerald-400">Tu Comisión</th>
                    <th className="text-center pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => l && (
                    <tr key={i} className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20">
                      <td className="py-3">
                        <p className="font-medium text-white">{l.stationName}</p>
                        <p className="text-xs text-slate-500">{l.stationCity}</p>
                      </td>
                      <td className="py-3 text-right text-slate-300">{l.totalKwhSold.toFixed(2)}</td>
                      <td className="py-3 text-right text-slate-300">{fmt(l.grossRevenue)}</td>
                      <td className="py-3 text-right text-red-400">{fmt(l.totalEnergyCost)}</td>
                      <td className="py-3 text-right text-orange-400">{fmt(l.hostPayout)}</td>
                      <td className="py-3 text-right text-blue-300 font-medium">{fmt(l.netMargin)}</td>
                      <td className="py-3 text-right text-slate-400">{l.gestorCommissionPercent.toFixed(2)}%</td>
                      <td className="py-3 text-right font-bold text-emerald-400">{fmt(l.gestorCommission)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          l.status === "distributed" ? "bg-green-500/20 text-green-400" :
                          l.status === "closed" ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {STATUS_LABELS[l.status] ?? l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600">
                    <td colSpan={7} className="pt-3 text-slate-300 font-semibold">
                      Total a liquidar — {MONTHS[month - 1]} {year}
                    </td>
                    <td className="pt-3 text-right font-bold text-emerald-400 text-base">
                      {fmt(data.totalCommission)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial anual */}
      {(gananciasData?.summary?.length ?? 0) > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Historial Anual {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left pb-2">Período</th>
                    <th className="text-left pb-2">Estación</th>
                    <th className="text-right pb-2">kWh</th>
                    <th className="text-right pb-2">Margen Neto</th>
                    <th className="text-right pb-2">Comisión</th>
                    <th className="text-center pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {gananciasData?.summary?.map((s, i) => s && (
                    <tr key={i} className="border-b border-slate-700/40 last:border-0">
                      <td className="py-2 text-slate-300">{s.periodLabel}</td>
                      <td className="py-2 text-white">{s.stationName}</td>
                      <td className="py-2 text-right text-slate-300">{s.totalKwhSold.toFixed(1)}</td>
                      <td className="py-2 text-right text-slate-300">{fmt(s.netMargin)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-400">{fmt(s.gestorCommission)}</td>
                      <td className="py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "distributed" ? "bg-green-500/20 text-green-400" :
                          s.status === "closed" ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
