import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Zap, TrendingUp, Users, Clock } from "lucide-react";

function formatCOP(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function OrgAnalytics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const { data: stats, isLoading } = (trpc.organizations as any).getMyOrgStats.useQuery(
    { period },
    { staleTime: 2 * 60 * 1000 }
  );

  const metrics = [
    {
      label: "Sesiones completadas",
      value: stats?.completedSessions ?? 0,
      icon: <Clock className="h-5 w-5 text-blue-400" />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "kWh entregados",
      value: `${(stats?.totalKwh ?? 0).toFixed(1)} kWh`,
      icon: <Zap className="h-5 w-5 text-yellow-400" />,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Ingresos totales",
      value: formatCOP(stats?.totalRevenue ?? 0),
      icon: <TrendingUp className="h-5 w-5 text-green-400" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Usuarios únicos",
      value: stats?.uniqueUsers ?? 0,
      icon: <Users className="h-5 w-5 text-purple-400" />,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  const derived = [
    {
      label: "Promedio kWh / sesión",
      value: stats?.completedSessions > 0
        ? `${(stats.totalKwh / stats.completedSessions).toFixed(2)} kWh`
        : "—",
    },
    {
      label: "Ingreso promedio / sesión",
      value: stats?.completedSessions > 0
        ? formatCOP(stats.totalRevenue / stats.completedSessions)
        : "—",
    },
    {
      label: "Estaciones online",
      value: `${stats?.onlineStations ?? 0} / ${stats?.totalStations ?? 0}`,
    },
    {
      label: "Disponibilidad",
      value: stats?.totalStations > 0
        ? `${Math.round((stats.onlineStations / stats.totalStations) * 100)}%`
        : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-green-400" /> Analítica Avanzada
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas detalladas de rendimiento de tu red</p>
        </div>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="all">Todo el tiempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center mb-3`}>
                    {m.icon}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Derived metrics */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Métricas derivadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {derived.map((d, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                    <p className="text-lg font-bold mt-1">{d.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Station breakdown */}
          {stats?.stationBreakdown && stats.stationBreakdown.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Rendimiento por estación</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Estación</th>
                        <th className="text-right px-4 py-3 font-medium">Sesiones</th>
                        <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">kWh</th>
                        <th className="text-right px-4 py-3 font-medium">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.stationBreakdown.map((s: any, i: number) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-right">{s.sessions}</td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell text-yellow-400">{parseFloat(s.kwh || 0).toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-green-400 font-semibold">{formatCOP(s.revenue || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
