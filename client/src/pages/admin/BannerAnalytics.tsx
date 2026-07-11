/**
 * BannerAnalytics - Dashboard de analytics de campaña publicitaria
 * Métricas profesionales: impresiones, clics, CTR, alcance, dwell time, perfil de audiencia
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  MousePointerClick,
  Eye,
  Users,
  Clock,
  BarChart3,
  Download,
  RefreshCw,
  MapPin,
  Smartphone,
  Car,
  Zap,
  Loader2,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { toast } from "sonner";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Paleta de colores EVGreen
const COLORS = {
  primary: "#10b981",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  muted: "rgba(16,185,129,0.15)",
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "text-emerald-400",
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className="bg-gray-900/60 border-gray-700/50">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">{title}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
            {trend && (
              <p className={`text-xs mt-1 ${trend.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-gray-800/80 ${color} flex-shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BannerAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const bannerId = parseInt(id || "0");
  const [daysBack, setDaysBack] = useState(30);

  const { data: analytics, isLoading: loadingAnalytics, refetch: refetchAnalytics } =
    trpc.banners.getCampaignAnalytics.useQuery({ bannerId }, { enabled: !!bannerId });

  const { data: dailyStats, isLoading: loadingDaily, refetch: refetchDaily } =
    trpc.banners.getDailyStats.useQuery({ bannerId, daysBack }, { enabled: !!bannerId });

  const { data: audience, isLoading: loadingAudience, refetch: refetchAudience } =
    trpc.banners.getAudienceProfile.useQuery({ bannerId }, { enabled: !!bannerId });

  const exportMutation = trpc.banners.exportCampaignReport.useMutation({
    onSuccess: (result) => {
      const byteArray = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Reporte ${result.filename.endsWith(".pdf") ? "PDF" : "Excel"} descargado`);
    },
    onError: () => toast.error("Error al generar el reporte"),
  });

  const handleRefresh = () => {
    refetchAnalytics();
    refetchDaily();
    refetchAudience();
    toast.success("Datos actualizados");
  };

  // Gráfica de línea: impresiones y clics por día
  const lineChartData = {
    labels: dailyStats?.map((d) => {
      const date = new Date(d.date + "T00:00:00");
      return date.toLocaleDateString("es-CO", { month: "short", day: "numeric" });
    }) ?? [],
    datasets: [
      {
        label: "Impresiones",
        data: dailyStats?.map((d) => d.impressions) ?? [],
        borderColor: COLORS.primary,
        backgroundColor: COLORS.muted,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: "Clics",
        data: dailyStats?.map((d) => d.clicks) ?? [],
        borderColor: COLORS.accent,
        backgroundColor: "rgba(245,158,11,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#9ca3af", font: { size: 12 } } },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { ticks: { color: "#6b7280", maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
    },
  };

  // Gráfica de barras: horas pico
  const hourData = Array(24).fill(0);
  audience?.byHour.forEach((h) => { hourData[h.hour] = h.views; });

  const barChartData = {
    labels: HOUR_LABELS,
    datasets: [
      {
        label: "Vistas",
        data: hourData,
        backgroundColor: hourData.map((v) => {
          const max = Math.max(...hourData);
          const ratio = max > 0 ? v / max : 0;
          return ratio > 0.7 ? COLORS.primary : ratio > 0.4 ? COLORS.secondary : "rgba(107,114,128,0.4)";
        }),
        borderRadius: 4,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.raw} vistas` } },
    },
    scales: {
      x: { ticks: { color: "#6b7280", font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
    },
  };

  // Gráfica de dona: ciudades
  const topCities = audience?.byCity.slice(0, 6) ?? [];
  const cityColors = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.purple, COLORS.danger, "#ec4899"];
  const doughnutData = {
    labels: topCities.map((c) => c.city),
    datasets: [
      {
        data: topCities.map((c) => c.views),
        backgroundColor: cityColors,
        borderColor: "transparent",
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: "#9ca3af", font: { size: 11 }, padding: 12 } },
    },
    cutout: "65%",
  };

  if (!bannerId) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Banner no encontrado.</p>
        <Button variant="ghost" onClick={() => setLocation("/admin/banners")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const summary = analytics?.summary;
  const banner = analytics?.banner;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/admin/banners")}
          className="text-gray-400 hover:text-white w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Publicidad
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Analytics de Campaña</h1>
            {banner && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  banner.status === "ACTIVE"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-gray-600 text-gray-400"
                }`}
              >
                {banner.status}
              </Badge>
            )}
          </div>
          {banner && (
            <p className="text-gray-400 text-sm mt-0.5 truncate max-w-lg">
              {banner.title}
              {banner.advertiserName && (
                <span className="text-gray-500"> · {banner.advertiserName}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-gray-700 text-gray-300 hover:text-white h-8"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => exportMutation.mutate({ bannerId, format: "pdf", daysBack })}
            disabled={exportMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
          >
            {exportMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportMutation.mutate({ bannerId, format: "excel", daysBack })}
            disabled={exportMutation.isPending}
            className="border-gray-700 text-gray-300 hover:text-white h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingAnalytics ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="bg-gray-900/60 border-gray-700/50 animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <KPICard
            title="Impresiones"
            value={summary?.impressions.toLocaleString("es-CO") ?? "0"}
            subtitle="Total de veces mostrado"
            icon={Eye}
            color="text-emerald-400"
          />
          <KPICard
            title="Clics"
            value={summary?.clicks.toLocaleString("es-CO") ?? "0"}
            subtitle="Interacciones directas"
            icon={MousePointerClick}
            color="text-amber-400"
          />
          <KPICard
            title="CTR"
            value={`${summary?.ctr ?? 0}%`}
            subtitle="Clics / Impresiones"
            icon={TrendingUp}
            color="text-cyan-400"
          />
          <KPICard
            title="Alcance"
            value={summary?.reach.toLocaleString("es-CO") ?? "0"}
            subtitle="Usuarios únicos"
            icon={Users}
            color="text-purple-400"
          />
          <KPICard
            title="Frecuencia"
            value={summary?.frequency ?? "0"}
            subtitle="Vistas por usuario"
            icon={BarChart3}
            color="text-rose-400"
          />
          <KPICard
            title="Dwell Time"
            value={formatDuration(summary?.avgDwellSeconds ?? 0)}
            subtitle={`${summary?.totalDwellMinutes ?? 0} min totales`}
            icon={Clock}
            color="text-orange-400"
          />
        </div>
      )}

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Línea: tendencia diaria */}
        <Card className="xl:col-span-2 bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Tendencia diaria — últimos {daysBack} días
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingDaily ? (
              <div className="h-52 flex items-center justify-center text-gray-500 text-sm">Cargando...</div>
            ) : (dailyStats?.length ?? 0) === 0 ? (
              <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
                Sin datos en este período
              </div>
            ) : (
              <div style={{ height: 210 }}>
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dona: ciudades */}
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Distribución por ciudad
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingAudience ? (
              <div className="h-52 flex items-center justify-center text-gray-500 text-sm">Cargando...</div>
            ) : topCities.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
                Sin datos de ciudad
              </div>
            ) : (
              <div style={{ height: 210 }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Horas pico */}
      <Card className="bg-gray-900/60 border-gray-700/50 mb-4">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Distribución por hora del día (horas pico)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loadingAudience ? (
            <div className="h-36 flex items-center justify-center text-gray-500 text-sm">Cargando...</div>
          ) : (
            <div style={{ height: 150 }}>
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perfil de audiencia: tablas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Top ciudades */}
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Top ciudades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingAudience ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />)}
              </div>
            ) : audience?.byCity.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {audience?.byCity.map((c, i) => {
                  const total = audience.byCity.reduce((s, x) => s + x.views, 0);
                  const pct = total > 0 ? Math.round((c.views / total) * 100) : 0;
                  const ctr = c.views > 0 ? Math.round((c.clicks / c.views) * 10000) / 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: cityColors[i % cityColors.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-300 truncate">{c.city}</span>
                          <span className="text-xs text-gray-500 ml-1 flex-shrink-0">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1 mt-0.5">
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: cityColors[i % cityColors.length] }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{c.views} vistas · CTR {ctr}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tipos de vehículo */}
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Car className="w-4 h-4 text-purple-400" />
              Tipos de vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingAudience ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />)}
              </div>
            ) : (audience?.byVehicle.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {audience?.byVehicle.map((v, i) => {
                  const total = audience.byVehicle.reduce((s, x) => s + x.views, 0);
                  const pct = total > 0 ? Math.round((v.views / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-300 truncate">{v.vehicleType}</span>
                          <span className="text-xs text-gray-500 ml-1 flex-shrink-0">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1 mt-0.5">
                          <div className="h-1 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{v.views} vistas</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dispositivos */}
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-rose-400" />
              Dispositivos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingAudience ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />)}
              </div>
            ) : (audience?.byDevice.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {audience?.byDevice.map((d, i) => {
                  const total = audience.byDevice.reduce((s, x) => s + x.views, 0);
                  const pct = total > 0 ? Math.round((d.views / total) * 100) : 0;
                  const colors = ["text-rose-400 bg-rose-500", "text-blue-400 bg-blue-500"];
                  const [textColor, bgColor] = colors[i % colors.length].split(" ");
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg bg-gray-800 ${textColor}`}>
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">{d.deviceType}</span>
                          <span className="text-sm font-semibold text-white">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                          <div className={`h-1.5 rounded-full ${bgColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{d.views.toLocaleString("es-CO")} vistas</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nota sobre dwell time */}
      <div className="mt-4 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
        <p className="text-xs text-emerald-400 font-medium">
          Ventaja competitiva EVGreen
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          El Dwell Time promedio de {formatDuration(summary?.avgDwellSeconds ?? 0)} representa el tiempo real que cada usuario estuvo expuesto al anuncio mientras esperaba que su vehículo cargara.
          Esto es significativamente mayor que cualquier banner digital tradicional (promedio 3-5 segundos).
          Los {summary?.totalDwellMinutes ?? 0} minutos totales de exposición son un indicador de alto valor para el anunciante.
        </p>
      </div>
    </div>
  );
}
