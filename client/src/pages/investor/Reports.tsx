import { useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Download, 
  TrendingUp, 
  TrendingDown,
  Zap, 
  DollarSign, 
  Clock,
  Calendar,
  MapPin,
  Activity,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Loader2,
  Building2,
  Users,
  Battery,
  AlertTriangle,
  Bookmark,
  Megaphone,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { saveBlobCrossPlatform } from "@/lib/pdf-download";

// ─── Types ───────────────────────────────────────────────────────
interface StationInfo {
  stationId: number;
  stationName: string;
  isCollective: boolean;
  investorParticipationPercent: number;
  investorSharePercent: number;
  evgreenSharePercent: number;
  hostSharePercent: number;
  energyCostPerKwh: number;
}

interface Waterfall {
  grossRevenue: number;
  energyCost: number;
  grossMargin: number;
  hostPercent: number;
  hostAmount: number;
  netAfterHost: number;
  investorPoolPercent: number;
  totalInvestorPool: number;
  evgreenPercent: number;
  evgreenAmount: number;
  participationPercent: number;
  myShare: number;
  isCollective: boolean;
  revenueFromEnergy?: number;
  revenueFromPenalties?: number;
}

interface EnrichedTransaction {
  id: number;
  stationId: number;
  startTime: Date | string;
  totalCost: string | number;
  kwhConsumed: string | number;
  status: string;
  stationName?: string;
  stationInfo?: StationInfo | null;
  waterfall?: Waterfall | null;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

const formatCOP = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatPct = (pct: number) => `${pct.toFixed(1)}%`;

export default function InvestorReports() {
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("month");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Date filter
  const dateFilter = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateRange) {
      case "week": { const s = new Date(today); s.setDate(today.getDate() - 7); return { start: s, end: now }; }
      case "month": { const s = new Date(today); s.setMonth(today.getMonth() - 1); return { start: s, end: now }; }
      case "quarter": { const s = new Date(today); s.setMonth(today.getMonth() - 3); return { start: s, end: now }; }
      case "year": { const s = new Date(today); s.setFullYear(today.getFullYear() - 1); return { start: s, end: now }; }
      default: return { start: new Date(0), end: now };
    }
  }, [dateRange]);

  // Use the SAME enriched endpoint as Earnings for consistent data
  const { data: txResult, isLoading } = trpc.transactions.investorTransactionsEnriched.useQuery({
    limit: 100,
    page: 1,
    startDate: dateFilter.start,
    endDate: dateFilter.end,
    status: "COMPLETED",
    stationId: selectedStation !== "all" ? Number(selectedStation) : undefined,
  });

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const len = dateFilter.end.getTime() - dateFilter.start.getTime();
    return { start: new Date(dateFilter.start.getTime() - len), end: new Date(dateFilter.start.getTime()) };
  }, [dateFilter]);

  const { data: prevResult } = trpc.transactions.investorTransactionsEnriched.useQuery({
    limit: 100,
    page: 1,
    startDate: prevRange.start,
    endDate: prevRange.end,
    status: "COMPLETED",
    stationId: selectedStation !== "all" ? Number(selectedStation) : undefined,
  });

  const allTransactions = (txResult?.data || []) as EnrichedTransaction[];
  const prevTransactions = (prevResult?.data || []) as EnrichedTransaction[];
  const stations = (txResult?.stations || []) as StationInfo[];

  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();

  // ─── Aggregated metrics using waterfall ────────────────────────
  const metrics = useMemo(() => {
    let totalMyShare = 0, totalGrossRevenue = 0, totalEnergyCostPurchase = 0;
    let totalHostAmount = 0, totalEvgreenAmount = 0;
    let totalEnergy = 0, txCount = 0;
    let totalRevenueFromEnergy = 0, totalRevenueFromPenalties = 0;

    allTransactions.forEach(tx => {
      if (tx.waterfall) {
        totalMyShare += tx.waterfall.myShare;
        totalGrossRevenue += tx.waterfall.grossRevenue;
        totalEnergyCostPurchase += tx.waterfall.energyCost;
        totalHostAmount += tx.waterfall.hostAmount;
        totalEvgreenAmount += tx.waterfall.evgreenAmount;
        totalRevenueFromEnergy += tx.waterfall.revenueFromEnergy || 0;
        totalRevenueFromPenalties += tx.waterfall.revenueFromPenalties || 0;
      }
      totalEnergy += Number(tx.kwhConsumed || 0);
      txCount++;
    });

    // Previous period
    let prevMyShare = 0, prevEnergy = 0;
    prevTransactions.forEach(tx => {
      if (tx.waterfall) prevMyShare += tx.waterfall.myShare;
      prevEnergy += Number(tx.kwhConsumed || 0);
    });

    const growthRevenue = prevMyShare > 0 ? ((totalMyShare - prevMyShare) / prevMyShare) * 100 : (totalMyShare > 0 ? 100 : 0);
    const growthEnergy = prevEnergy > 0 ? ((totalEnergy - prevEnergy) / prevEnergy) * 100 : (totalEnergy > 0 ? 100 : 0);

    return {
      totalMyShare,
      totalGrossRevenue,
      totalEnergyCostPurchase,
      totalHostAmount,
      totalEvgreenAmount,
      totalEnergy,
      txCount,
      growthRevenue,
      growthEnergy,
      avgPerTransaction: txCount > 0 ? totalMyShare / txCount : 0,
      avgEnergyPerCharge: txCount > 0 ? totalEnergy / txCount : 0,
      revenueFromEnergy: totalRevenueFromEnergy,
      revenueFromPenalties: totalRevenueFromPenalties,
    };
  }, [allTransactions, prevTransactions]);

  // ─── Per-station breakdown ─────────────────────────────────────
  const stationBreakdown = useMemo(() => {
    const map = new Map<number, {
      station: StationInfo;
      myShare: number;
      grossRevenue: number;
      energy: number;
      txCount: number;
    }>();

    allTransactions.forEach(tx => {
      if (!tx.stationInfo || !tx.waterfall) return;
      const sid = tx.stationId;
      const existing = map.get(sid);
      if (existing) {
        existing.myShare += tx.waterfall.myShare;
        existing.grossRevenue += tx.waterfall.grossRevenue;
        existing.energy += Number(tx.kwhConsumed || 0);
        existing.txCount++;
      } else {
        map.set(sid, {
          station: tx.stationInfo,
          myShare: tx.waterfall.myShare,
          grossRevenue: tx.waterfall.grossRevenue,
          energy: Number(tx.kwhConsumed || 0),
          txCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.myShare - a.myShare);
  }, [allTransactions]);

  // ─── Dynamic distribution for pie chart ────────────────────────
  const revenueDistribution = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    
    if (metrics.totalMyShare > 0) {
      items.push({ name: "Tu parte", value: metrics.totalMyShare });
    }
    if (metrics.totalEvgreenAmount > 0) {
      items.push({ name: "EVGreen", value: metrics.totalEvgreenAmount });
    }
    if (metrics.totalHostAmount > 0) {
      items.push({ name: "Aliado Comercial", value: metrics.totalHostAmount });
    }
    if (metrics.totalEnergyCostPurchase > 0) {
      items.push({ name: "Costo Energía", value: metrics.totalEnergyCostPurchase });
    }
    
    return items;
  }, [metrics]);

  // ─── Daily trend data using waterfall ──────────────────────────
  const dailyTrendData = useMemo(() => {
    const grouped: Record<string, { date: string; ingresos: number; energia: number; cargas: number }> = {};
    
    allTransactions.forEach((tx) => {
      if (!tx.waterfall) return;
      const dateKey = new Date(tx.startTime).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, ingresos: 0, energia: 0, cargas: 0 };
      }
      grouped[dateKey].ingresos += tx.waterfall.myShare;
      grouped[dateKey].energia += Number(tx.kwhConsumed || 0);
      grouped[dateKey].cargas += 1;
    });
    
    return Object.values(grouped);
  }, [allTransactions]);

  // ─── Hourly analysis ──────────────────────────────────────────
  const hourlyAnalysis = useMemo(() => {
    const hours: Record<number, { hour: number; cargas: number; energia: number }> = {};
    for (let i = 0; i < 24; i++) hours[i] = { hour: i, cargas: 0, energia: 0 };
    
    allTransactions.forEach((tx) => {
      const hour = new Date(tx.startTime).getHours();
      hours[hour].cargas += 1;
      hours[hour].energia += Number(tx.kwhConsumed || 0);
    });
    
    return Object.values(hours).map(h => ({ ...h, label: `${h.hour}:00` }));
  }, [allTransactions]);

  // ─── Weekday analysis ─────────────────────────────────────────
  const weekdayAnalysis = useMemo(() => {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weekdays: Record<number, { day: string; cargas: number; ingresos: number }> = {};
    for (let i = 0; i < 7; i++) weekdays[i] = { day: days[i], cargas: 0, ingresos: 0 };
    
    allTransactions.forEach((tx) => {
      if (!tx.waterfall) return;
      const dayOfWeek = new Date(tx.startTime).getDay();
      weekdays[dayOfWeek].cargas += 1;
      weekdays[dayOfWeek].ingresos += tx.waterfall.myShare;
    });
    
    return Object.values(weekdays);
  }, [allTransactions]);

  // Peak hour and day
  const peakHour = useMemo(() => hourlyAnalysis.reduce((max, h) => h.cargas > max.cargas ? h : max, hourlyAnalysis[0]), [hourlyAnalysis]);
  const peakDay = useMemo(() => weekdayAnalysis.reduce((max, d) => d.cargas > max.cargas ? d : max, weekdayAnalysis[0]), [weekdayAnalysis]);

  // Export
  const handleExport = async (format: "excel" | "pdf") => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ format });
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });
      saveBlobCrossPlatform(blob, result.filename);
      toast.success(`Reporte ${format.toUpperCase()} descargado`);
      setExportDialogOpen(false);
    } catch {
      toast.error("Error al generar el reporte");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mis Reportes</h1>
            <p className="text-sm text-muted-foreground">Análisis de rendimiento de tus estaciones</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="w-48">
                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue placeholder="Estación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las estaciones</SelectItem>
                {stations.map((station) => (
                  <SelectItem key={station.stationId} value={station.stationId.toString()}>
                    <span className="flex items-center gap-1.5">
                      {station.stationName}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                        {station.isCollective ? `Col. ${formatPct(station.investorParticipationPercent)}` : "Propia"}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último año</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1.5" />
                  Exportar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Exportar Reporte</DialogTitle>
                  <DialogDescription>Descarga un reporte completo</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1" onClick={() => handleExport("excel")} disabled={isExporting}>
                    {isExporting ? <Loader2 className="w-6 h-6 animate-spin text-green-600" /> : <FileSpreadsheet className="w-6 h-6 text-green-600" />}
                    <span className="font-medium text-sm">Excel (.xlsx)</span>
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1" onClick={() => handleExport("pdf")} disabled={isExporting}>
                    {isExporting ? <Loader2 className="w-6 h-6 animate-spin text-red-600" /> : <FileText className="w-6 h-6 text-red-600" />}
                    <span className="font-medium text-sm">PDF</span>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ─── KPIs ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos netos</p>
                  <p className="text-xl md:text-2xl font-bold text-green-500">{formatCOP(metrics.totalMyShare)}</p>
                  <p className={`text-[11px] flex items-center mt-0.5 ${metrics.growthRevenue >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {metrics.growthRevenue >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {metrics.growthRevenue >= 0 ? "+" : ""}{metrics.growthRevenue.toFixed(1)}%
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Energía vendida</p>
                  <p className="text-xl md:text-2xl font-bold">{metrics.totalEnergy.toFixed(1)} kWh</p>
                  <p className={`text-[11px] flex items-center mt-0.5 ${metrics.growthEnergy >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {metrics.growthEnergy >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {metrics.growthEnergy >= 0 ? "+" : ""}{metrics.growthEnergy.toFixed(1)}%
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total cargas</p>
                  <p className="text-xl md:text-2xl font-bold">{metrics.txCount}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{metrics.avgEnergyPerCharge.toFixed(1)} kWh/carga</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Battery className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ingreso promedio</p>
                  <p className="text-xl md:text-2xl font-bold">{formatCOP(metrics.avgPerTransaction)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Por transacción</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Insights de ocupación ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hora pico</p>
                  <p className="text-lg font-bold">{peakHour?.label || "N/A"}</p>
                  <p className="text-[11px] text-muted-foreground">{peakHour?.cargas || 0} cargas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Día más activo</p>
                  <p className="text-lg font-bold">{peakDay?.day || "N/A"}</p>
                  <p className="text-[11px] text-muted-foreground">{peakDay?.cargas || 0} cargas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estaciones activas</p>
                  <p className="text-lg font-bold">{stationBreakdown.filter(s => s.txCount > 0).length}</p>
                  <p className="text-[11px] text-muted-foreground">de {stations.length} totales</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Charts Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" />
                Tendencia de Ingresos Netos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrendData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} className="text-xs" tick={{ fontSize: 11 }} width={55} />
                    <RechartsTooltip formatter={(value: number) => [formatCOP(value), "Tu ingreso neto"]} labelFormatter={(label) => `${label}`} />
                    <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Weekday */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" />
                Cargas por Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weekdayAnalysis} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} width={35} />
                  <RechartsTooltip formatter={(value: number, name: string) => [name === "cargas" ? `${value} cargas` : formatCOP(value), name === "cargas" ? "Cargas" : "Ingresos"]} />
                  <Bar dataKey="cargas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ─── Hourly + Distribution ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hourly */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4" />
                Ocupación por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourlyAnalysis} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} width={35} />
                  <RechartsTooltip formatter={(value: number) => [`${value} cargas`, "Cargas"]} labelFormatter={(label) => `Hora: ${label}`} />
                  <Bar dataKey="cargas" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dynamic distribution pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-4 h-4" />
                Distribución Real del Ingreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueDistribution.length === 0 || metrics.totalGrossRevenue === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={revenueDistribution}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={false}
                    >
                      {revenueDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatCOP(value)} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => {
                        const item = revenueDistribution.find(d => d.name === value);
                        const total = revenueDistribution.reduce((s, d) => s + d.value, 0);
                        const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                        return `${value} (${pct}%)`;
                      }}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Revenue Sources ────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4" />
              Fuentes de Ingreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">Venta de Energía</span>
                  </div>
                  <p className="text-base font-bold">{formatCOP(metrics.revenueFromEnergy || metrics.totalGrossRevenue)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">Penalidades</span>
                  </div>
                  <p className={`text-base font-bold ${metrics.revenueFromPenalties > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {formatCOP(metrics.revenueFromPenalties)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bookmark className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">Reservas</span>
                  </div>
                  <p className="text-base font-bold text-muted-foreground">{formatCOP(0)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Megaphone className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">Publicidad</span>
                  </div>
                  <p className="text-base font-bold text-muted-foreground">{formatCOP(0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Station Performance Table ──────────────────────────── */}
        {stationBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4" />
                Rendimiento por Estación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2.5 px-3 font-medium">Estación</th>
                      <th className="text-center py-2.5 px-3 font-medium">Tipo</th>
                      <th className="text-right py-2.5 px-3 font-medium">Cargas</th>
                      <th className="text-right py-2.5 px-3 font-medium">kWh</th>
                      <th className="text-right py-2.5 px-3 font-medium">Tu Ingreso Neto</th>
                      <th className="text-right py-2.5 px-3 font-medium">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationBreakdown.map((s, index) => (
                      <tr key={s.station.stationId} className="border-b hover:bg-muted/50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-5 h-5 rounded-full flex items-center justify-center p-0 text-[10px]">
                              {index + 1}
                            </Badge>
                            <span>{s.station.stationName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={s.station.isCollective ? "secondary" : "outline"} className="text-[9px] px-1.5 py-0">
                            {s.station.isCollective ? (
                              <span className="flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" />
                                {formatPct(s.station.investorParticipationPercent)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5">
                                <Building2 className="w-2.5 h-2.5" />
                                Propia
                              </span>
                            )}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">{s.txCount}</td>
                        <td className="py-2.5 px-3 text-right">{s.energy.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-green-500">{formatCOP(s.myShare)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant={index === 0 ? "default" : "secondary"} className="text-[10px]">
                            {metrics.totalMyShare > 0 ? ((s.myShare / metrics.totalMyShare) * 100).toFixed(1) : 0}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-2.5 px-3">Total</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right">{metrics.txCount}</td>
                      <td className="py-2.5 px-3 text-right">{metrics.totalEnergy.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right text-green-500">{formatCOP(metrics.totalMyShare)}</td>
                      <td className="py-2.5 px-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
