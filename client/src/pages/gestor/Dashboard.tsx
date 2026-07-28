/**
 * Portal del Gestor Comercial — Dashboard principal
 * Muestra métricas clave: espacios postulados, estaciones activas y comisiones acumuladas.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MapPin,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",   color: "bg-yellow-500/20 text-yellow-400" },
  reviewing:  { label: "En revisión", color: "bg-blue-500/20 text-blue-400" },
  approved:   { label: "Aprobado",    color: "bg-green-500/20 text-green-400" },
  rejected:   { label: "Rechazado",   color: "bg-red-500/20 text-red-400" },
  active:     { label: "Activo",      color: "bg-emerald-500/20 text-emerald-400" },
  contracted: { label: "Contratado",  color: "bg-purple-500/20 text-purple-400" },
};

export default function GestorDashboard() {
  const { user } = useAuth();
  const now = new Date();

  const { data: espaciosData } = trpc.gestor.getMisEspacios.useQuery({ page: 1, limit: 5 });
  const { data: estacionesData } = trpc.gestor.getMisEstaciones.useQuery();
  const { data: gananciasData } = trpc.gestor.getMisGanancias.useQuery({ year: now.getFullYear() });
  const { data: liquidacionData } = trpc.gestor.getLiquidacionMensual.useQuery({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const totalEspacios = espaciosData?.total ?? 0;
  const totalEstaciones = estacionesData?.stations.length ?? 0;
  const totalComision = gananciasData?.totalCommission ?? 0;
  const comisionMes = liquidacionData?.totalCommission ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Bienvenido, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Panel de Gestor Comercial — EVGreen
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <MapPin className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalEspacios}</p>
                <p className="text-xs text-slate-400">Espacios postulados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Zap className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalEstaciones}</p>
                <p className="text-xs text-slate-400">Estaciones activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{fmt(comisionMes)}</p>
                <p className="text-xs text-slate-400">Comisión este mes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{fmt(totalComision)}</p>
                <p className="text-xs text-slate-400">Comisión acumulada</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Últimos espacios */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Mis Espacios Recientes</CardTitle>
              <Link href="/gestor/espacios" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!espaciosData?.spaces.length ? (
              <p className="text-slate-500 text-sm text-center py-4">
                No has postulado espacios aún.{" "}
                <Link href="/gestor/postular" className="text-green-400 hover:underline">
                  Postula uno ahora
                </Link>
              </p>
            ) : (
              espaciosData.spaces.map((s) => {
                const st = STATUS_LABELS[s.spaceStatus ?? "pending"] ?? STATUS_LABELS.pending;
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{s.spaceName}</p>
                      <p className="text-xs text-slate-400">{s.city}{s.department ? `, ${s.department}` : ""}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Estaciones activas */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Mis Estaciones</CardTitle>
              <Link href="/gestor/estaciones" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!estacionesData?.stations.length ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Aún no tienes estaciones activas vinculadas.
              </p>
            ) : (
              estacionesData.stations.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {s.isOnline ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.city}</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">
                    {parseFloat(s.gestorCommissionPercent as string).toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Liquidación del mes */}
      {(liquidacionData?.lines?.length ?? 0) > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">
                Liquidación — {now.toLocaleString("es-CO", { month: "long", year: "numeric" })}
              </CardTitle>
              <Link href="/gestor/liquidacion" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                Ver detalle <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700">
                    <th className="text-left pb-2">Estación</th>
                    <th className="text-right pb-2">kWh</th>
                    <th className="text-right pb-2">Margen Neto</th>
                    <th className="text-right pb-2">Tu Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacionData?.lines?.map((l, i) => l && (
                    <tr key={i} className="border-b border-slate-700/40 last:border-0">
                      <td className="py-2 text-white">{l.stationName}</td>
                      <td className="py-2 text-right text-slate-300">{l.totalKwhSold.toFixed(1)}</td>
                      <td className="py-2 text-right text-slate-300">{fmt(l.netMargin)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-400">{fmt(l.gestorCommission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-600">
                    <td colSpan={3} className="pt-2 text-slate-400 font-medium">Total a liquidar</td>
                    <td className="pt-2 text-right font-bold text-emerald-400 text-base">
                      {fmt(liquidacionData?.totalCommission ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
