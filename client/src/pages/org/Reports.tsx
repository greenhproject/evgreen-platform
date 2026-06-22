/**
 * Org Reports - Módulo de reportes completamente funcional para el portal de organización
 * Incluye: reporte de rendimiento, por estación, financiero y por hora del día
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, BarChart2, Zap, TrendingUp, Clock,
  ChevronRight, X, Activity, DollarSign, Users, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// ─── Tipos de reporte ─────────────────────────────────────────────────────────
type ReportType = "performance" | "station" | "financial" | "hourly" | null;

export default function OrgReports() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType>(null);

  const { data: stats, isLoading: statsLoading } = (trpc.organizations as any).getMyOrgStats.useQuery(
    { period },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: transactions } = (trpc.organizations as any).getOrgTransactions.useQuery(
    { period, page: 1, limit: 1000 },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: stations } = (trpc.organizations as any).getMyStations.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const txs: any[] = useMemo(() => transactions?.transactions || [], [transactions]);

  // ── Datos para gráficas ──────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    if (!txs.length) return [];
    const map: Record<string, { day: string; sessions: number; kwh: number; revenue: number }> = {};
    txs.forEach((t: any) => {
      if (!t.start_time) return;
      const day = new Date(t.start_time).toLocaleDateString("es-CO", { month: "short", day: "numeric" });
      if (!map[day]) map[day] = { day, sessions: 0, kwh: 0, revenue: 0 };
      map[day].sessions++;
      map[day].kwh += parseFloat(t.energy_kwh || 0);
      map[day].revenue += parseFloat(t.total_cost || 0);
    });
    return Object.values(map).slice(-14);
  }, [txs]);

  const stationData = useMemo(() => {
    if (!txs.length) return [];
    const map: Record<string, { name: string; sessions: number; kwh: number; revenue: number }> = {};
    txs.forEach((t: any) => {
      const name = t.station_name || `#${t.station_id}`;
      if (!map[name]) map[name] = { name, sessions: 0, kwh: 0, revenue: 0 };
      map[name].sessions++;
      map[name].kwh += parseFloat(t.energy_kwh || 0);
      map[name].revenue += parseFloat(t.total_cost || 0);
    });
    return Object.values(map).sort((a, b) => b.sessions - a.sessions).slice(0, 10);
  }, [txs]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, sessions: 0, kwh: 0 }));
    txs.forEach((t: any) => {
      if (!t.start_time) return;
      const h = new Date(t.start_time).getHours();
      hours[h].sessions++;
      hours[h].kwh += parseFloat(t.energy_kwh || 0);
    });
    return hours;
  }, [txs]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    txs.forEach((t: any) => {
      const s = t.status || "UNKNOWN";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [txs]);

  // ── Exportar reporte ─────────────────────────────────────────────────────
  const exportReport = async () => {
    setIsExporting(true);
    try {
      const periodLabel = { "7d": "7 días", "30d": "30 días", "90d": "90 días", "all": "Todo el tiempo" }[period];

      if (format === "csv") {
        const headers = ["ID", "Estación", "Usuario", "Email", "Inicio", "Fin", "kWh", "Total COP", "Estado"];
        const rows = txs.map((t: any) => [
          t.id,
          t.station_name || `#${t.station_id}`,
          t.user_name || "Anónimo",
          t.user_email || "",
          t.start_time ? new Date(t.start_time).toLocaleString("es-CO") : "",
          t.end_time ? new Date(t.end_time).toLocaleString("es-CO") : "",
          parseFloat(t.energy_kwh || 0).toFixed(2),
          parseFloat(t.total_cost || 0).toFixed(0),
          t.status,
        ]);
        const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte-evgreen-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Reporte CSV descargado");
      } else {
        // PDF via print
        const stationRows = stationData.map(s =>
          `<tr><td>${s.name}</td><td>${s.sessions}</td><td>${s.kwh.toFixed(1)}</td><td>${formatCOP(s.revenue)}</td></tr>`
        ).join("");
        const txRows = txs.slice(0, 200).map((t: any) =>
          `<tr>
            <td>${t.id}</td>
            <td>${t.station_name || `#${t.station_id}`}</td>
            <td>${t.user_name || "Anónimo"}</td>
            <td>${t.start_time ? new Date(t.start_time).toLocaleString("es-CO") : "—"}</td>
            <td>${parseFloat(t.energy_kwh || 0).toFixed(2)}</td>
            <td>${formatCOP(parseFloat(t.total_cost || 0))}</td>
            <td>${t.status}</td>
          </tr>`
        ).join("");

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte EVGreen</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
  h1{color:#16a34a;font-size:22px;margin-bottom:2px}
  h2{color:#16a34a;font-size:15px;margin:20px 0 8px}
  .subtitle{color:#666;font-size:12px;margin-bottom:20px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px}
  .kpi-label{font-size:10px;color:#666}
  .kpi-value{font-size:18px;font-weight:bold;color:#16a34a;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px}
  th{background:#f0fdf4;padding:7px;text-align:left;border-bottom:2px solid #bbf7d0}
  td{padding:6px 7px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even){background:#f9fafb}
  .footer{margin-top:20px;font-size:10px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
  @media print{body{padding:16px}}
</style></head><body>
<h1>⚡ Reporte EVGreen</h1>
<p class="subtitle">Período: ${periodLabel} · Generado: ${new Date().toLocaleString("es-CO")}</p>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Sesiones</div><div class="kpi-value">${stats?.totalSessions ?? 0}</div></div>
  <div class="kpi"><div class="kpi-label">kWh entregados</div><div class="kpi-value">${(stats?.totalKwh ?? 0).toFixed(1)}</div></div>
  <div class="kpi"><div class="kpi-label">Ingresos totales</div><div class="kpi-value">${formatCOP(stats?.totalRevenue ?? 0)}</div></div>
  <div class="kpi"><div class="kpi-label">Usuarios únicos</div><div class="kpi-value">${stats?.uniqueUsers ?? 0}</div></div>
</div>
<h2>Resumen por Estación</h2>
<table><thead><tr><th>Estación</th><th>Sesiones</th><th>kWh</th><th>Ingresos</th></tr></thead>
<tbody>${stationRows || '<tr><td colspan="4" style="text-align:center;color:#999">Sin datos</td></tr>'}</tbody></table>
<h2>Detalle de Transacciones (últimas 200)</h2>
<table><thead><tr><th>#</th><th>Estación</th><th>Usuario</th><th>Inicio</th><th>kWh</th><th>Total</th><th>Estado</th></tr></thead>
<tbody>${txRows || '<tr><td colspan="7" style="text-align:center;color:#999">Sin transacciones</td></tr>'}</tbody></table>
<div class="footer">EVGreen Platform · evgreen.lat · evgreen@greenhproject.com</div>
</body></html>`;
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          setTimeout(() => win.print(), 500);
        }
        toast.success("Reporte PDF listo — usa Ctrl+P para guardar como PDF");
      }
    } catch {
      toast.error("Error al generar el reporte");
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypes = [
    {
      id: "performance" as ReportType,
      icon: <BarChart2 className="h-5 w-5 text-blue-400" />,
      title: "Reporte de Rendimiento",
      desc: "Sesiones, kWh e ingresos por día",
      color: "blue",
    },
    {
      id: "station" as ReportType,
      icon: <Zap className="h-5 w-5 text-yellow-400" />,
      title: "Reporte por Estación",
      desc: "Desglose detallado de cada estación",
      color: "yellow",
    },
    {
      id: "financial" as ReportType,
      icon: <TrendingUp className="h-5 w-5 text-green-400" />,
      title: "Reporte Financiero",
      desc: "Ingresos, distribución y tendencias",
      color: "green",
    },
    {
      id: "hourly" as ReportType,
      icon: <Clock className="h-5 w-5 text-purple-400" />,
      title: "Reporte de Uso por Hora",
      desc: "Distribución de sesiones por hora del día",
      color: "purple",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-green-400" /> Reportes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Genera y descarga informes de tu red de carga</p>
      </div>

      {/* Exportar reporte */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-green-400" /> Exportar reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="mt-1 h-9">
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
            <div>
              <Label className="text-xs text-muted-foreground">Formato</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (imprimir)</SelectItem>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPIs resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center animate-pulse">
                  <div className="h-3 bg-muted rounded w-16 mx-auto mb-2" />
                  <div className="h-6 bg-muted rounded w-12 mx-auto" />
                </div>
              ))
            ) : (
              [
                { label: "Sesiones", value: stats?.totalSessions ?? 0 },
                { label: "kWh", value: `${(stats?.totalKwh ?? 0).toFixed(1)}` },
                { label: "Ingresos", value: formatCOP(stats?.totalRevenue ?? 0) },
                { label: "Usuarios únicos", value: stats?.uniqueUsers ?? 0 },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold mt-1">{m.value}</p>
                </div>
              ))
            )}
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700 h-10"
            onClick={exportReport}
            disabled={isExporting}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar reporte {format.toUpperCase()}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Tipos de reporte */}
      {!activeReport && (
        <div className="grid md:grid-cols-2 gap-4">
          {reportTypes.map((r) => (
            <Card
              key={r.id}
              className="bg-card/50 border-border/50 hover:border-green-500/30 transition-colors cursor-pointer"
              onClick={() => setActiveReport(r.id)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                  {r.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vista de reporte activo */}
      {activeReport && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {reportTypes.find(r => r.id === activeReport)?.icon}
              {reportTypes.find(r => r.id === activeReport)?.title}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveReport(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeReport === "performance" && <PerformanceReport dailyData={dailyData} stats={stats} />}
            {activeReport === "station" && <StationReport stationData={stationData} stations={stations} txs={txs} />}
            {activeReport === "financial" && <FinancialReport txs={txs} statusData={statusData} stats={stats} stationData={stationData} />}
            {activeReport === "hourly" && <HourlyReport hourlyData={hourlyData} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Reporte de Rendimiento ───────────────────────────────────────────────────
function PerformanceReport({ dailyData, stats }: { dailyData: any[]; stats: any }) {
  if (!dailyData.length) {
    return <EmptyState message="No hay datos de sesiones en este período" />;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
          <p className="text-xs text-muted-foreground">Promedio kWh/sesión</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{(stats?.avgKwhPerSession ?? 0).toFixed(1)}</p>
        </div>
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-xs text-muted-foreground">Total sesiones</p>
          <p className="text-xl font-bold text-green-400 mt-1">{stats?.totalSessions ?? 0}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Sesiones por día</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#f9fafb" }}
            />
            <Bar dataKey="sessions" fill="#22c55e" radius={[4, 4, 0, 0]} name="Sesiones" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">kWh entregados por día</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${parseFloat(v).toFixed(1)} kWh`, "kWh"]}
            />
            <Line type="monotone" dataKey="kwh" stroke="#3b82f6" strokeWidth={2} dot={false} name="kWh" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Reporte por Estación ─────────────────────────────────────────────────────
function StationReport({ stationData, stations, txs }: { stationData: any[]; stations: any[]; txs: any[] }) {
  if (!stationData.length) {
    return <EmptyState message="No hay datos de estaciones en este período" />;
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Sesiones por estación</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stationData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} width={100} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="sessions" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Sesiones" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Detalle por estación</p>
        {stationData.map((s, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-sm font-medium">{s.name}</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span><span className="font-semibold text-foreground">{s.sessions}</span> sesiones</span>
              <span><span className="font-semibold text-foreground">{s.kwh.toFixed(1)}</span> kWh</span>
              <span className="text-green-400 font-semibold">{formatCOP(s.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reporte Financiero ───────────────────────────────────────────────────────
function FinancialReport({ txs, statusData, stats, stationData }: { txs: any[]; statusData: any[]; stats: any; stationData: any[] }) {
  const revenueByStation = stationData.slice(0, 5).map(s => ({ name: s.name.slice(0, 18), value: s.revenue }));

  if (!txs.length) {
    return <EmptyState message="No hay transacciones en este período" />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Ingresos totales</p>
          <p className="text-xl font-bold text-green-400 mt-1">{formatCOP(stats?.totalRevenue ?? 0)}</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Usuarios únicos</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{stats?.uniqueUsers ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {revenueByStation.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Ingresos por estación</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={revenueByStation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {revenueByStation.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [formatCOP(v), "Ingresos"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {statusData.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Estado de sesiones</p>
            <div className="space-y-2">
              {statusData.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.value / txs.length) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right">{s.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reporte por Hora ─────────────────────────────────────────────────────────
function HourlyReport({ hourlyData }: { hourlyData: any[] }) {
  const maxSessions = Math.max(...hourlyData.map(h => h.sessions), 1);
  const peakHour = hourlyData.reduce((a, b) => (a.sessions > b.sessions ? a : b), hourlyData[0]);

  if (maxSessions === 1) {
    return <EmptyState message="No hay suficientes datos para el análisis por hora" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <Clock className="h-5 w-5 text-purple-400 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Hora pico</p>
          <p className="text-sm font-bold text-purple-400">{peakHour?.hour} — {peakHour?.sessions} sesiones</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Sesiones por hora del día</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="sessions" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Sesiones" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">kWh por hora del día</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={hourlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${parseFloat(v).toFixed(1)} kWh`, "kWh"]}
            />
            <Line type="monotone" dataKey="kwh" stroke="#06b6d4" strokeWidth={2} dot={false} name="kWh" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
      <Activity className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
