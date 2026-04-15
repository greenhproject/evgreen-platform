import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DollarSign, 
  TrendingUp, 
  Zap,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
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

// ─── Helpers ─────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);

const formatPct = (pct: number) => `${pct.toFixed(1)}%`;

// ─── Component ───────────────────────────────────────────────────
export default function InvestorEarnings() {
  const [period, setPeriod] = useState("month");
  const [stationTab, setStationTab] = useState("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedStation, setExpandedStation] = useState<number | null>(null);

  // Date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
      case "today": return { start: today, end: now };
      case "week": {
        const s = new Date(today); s.setDate(today.getDate() - 7); return { start: s, end: now };
      }
      case "month": {
        const s = new Date(today); s.setMonth(today.getMonth() - 1); return { start: s, end: now };
      }
      case "year": {
        const s = new Date(today); s.setFullYear(today.getFullYear() - 1); return { start: s, end: now };
      }
      default: return { start: new Date(0), end: now };
    }
  }, [period]);

  // Fetch enriched transactions (large limit to get all for aggregation)
  const { data: txResult, isLoading } = trpc.transactions.investorTransactionsEnriched.useQuery({
    limit: 100,
    page: 1,
    startDate: dateRange.start,
    endDate: dateRange.end,
    status: "COMPLETED",
  });

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const len = dateRange.end.getTime() - dateRange.start.getTime();
    return { start: new Date(dateRange.start.getTime() - len), end: new Date(dateRange.start.getTime()) };
  }, [dateRange]);

  const { data: prevResult } = trpc.transactions.investorTransactionsEnriched.useQuery({
    limit: 100,
    page: 1,
    startDate: prevRange.start,
    endDate: prevRange.end,
    status: "COMPLETED",
  });

  const allTransactions = (txResult?.data || []) as EnrichedTransaction[];
  const prevTransactions = (prevResult?.data || []) as EnrichedTransaction[];
  const stations = (txResult?.stations || []) as StationInfo[];

  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();

  // ─── Aggregate KPIs across ALL stations ────────────────────────
  const aggregatedKPIs = useMemo(() => {
    let totalMyShare = 0;
    let totalGrossRevenue = 0;
    let totalEnergyCost = 0;
    let totalHostAmount = 0;
    let totalEvgreenAmount = 0;
    let totalEnergy = 0;
    let txCount = 0;

    allTransactions.forEach(tx => {
      if (tx.waterfall) {
        totalMyShare += tx.waterfall.myShare;
        totalGrossRevenue += tx.waterfall.grossRevenue;
        totalEnergyCost += tx.waterfall.energyCost;
        totalHostAmount += tx.waterfall.hostAmount;
        totalEvgreenAmount += tx.waterfall.evgreenAmount;
      }
      totalEnergy += Number(tx.kwhConsumed || 0);
      txCount++;
    });

    return {
      myShare: totalMyShare,
      grossRevenue: totalGrossRevenue,
      energyCost: totalEnergyCost,
      hostAmount: totalHostAmount,
      evgreenAmount: totalEvgreenAmount,
      energy: totalEnergy,
      transactions: txCount,
    };
  }, [allTransactions]);

  // Previous period KPIs for comparison
  const prevKPIs = useMemo(() => {
    let totalMyShare = 0;
    prevTransactions.forEach(tx => {
      if (tx.waterfall) totalMyShare += tx.waterfall.myShare;
    });
    return { myShare: totalMyShare };
  }, [prevTransactions]);

  const percentageChange = useMemo(() => {
    if (prevKPIs.myShare === 0) return aggregatedKPIs.myShare > 0 ? 100 : 0;
    return ((aggregatedKPIs.myShare - prevKPIs.myShare) / prevKPIs.myShare) * 100;
  }, [aggregatedKPIs.myShare, prevKPIs.myShare]);

  // ─── Per-station breakdown ─────────────────────────────────────
  const stationBreakdown = useMemo(() => {
    const map = new Map<number, {
      station: StationInfo;
      myShare: number;
      grossRevenue: number;
      energyCost: number;
      grossMargin: number;
      hostAmount: number;
      netAfterHost: number;
      evgreenAmount: number;
      investorPool: number;
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
        existing.energyCost += tx.waterfall.energyCost;
        existing.grossMargin += tx.waterfall.grossMargin;
        existing.hostAmount += tx.waterfall.hostAmount;
        existing.netAfterHost += tx.waterfall.netAfterHost;
        existing.evgreenAmount += tx.waterfall.evgreenAmount;
        existing.investorPool += tx.waterfall.totalInvestorPool;
        existing.energy += Number(tx.kwhConsumed || 0);
        existing.txCount++;
      } else {
        map.set(sid, {
          station: tx.stationInfo,
          myShare: tx.waterfall.myShare,
          grossRevenue: tx.waterfall.grossRevenue,
          energyCost: tx.waterfall.energyCost,
          grossMargin: tx.waterfall.grossMargin,
          hostAmount: tx.waterfall.hostAmount,
          netAfterHost: tx.waterfall.netAfterHost,
          evgreenAmount: tx.waterfall.evgreenAmount,
          investorPool: tx.waterfall.totalInvestorPool,
          energy: Number(tx.kwhConsumed || 0),
          txCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.myShare - a.myShare);
  }, [allTransactions]);

  // Filter stations by tab
  const filteredStations = useMemo(() => {
    if (stationTab === "own") return stationBreakdown.filter(s => !s.station.isCollective);
    if (stationTab === "collective") return stationBreakdown.filter(s => s.station.isCollective);
    return stationBreakdown;
  }, [stationBreakdown, stationTab]);

  const ownCount = stationBreakdown.filter(s => !s.station.isCollective).length;
  const collectiveCount = stationBreakdown.filter(s => s.station.isCollective).length;

  // ─── Daily earnings grouped ────────────────────────────────────
  const dailyEarnings = useMemo(() => {
    const grouped: Record<string, {
      date: Date;
      stationIds: Set<number>;
      energy: number;
      grossRevenue: number;
      energyCost: number;
      hostAmount: number;
      myShare: number;
      evgreenAmount: number;
      txCount: number;
    }> = {};

    allTransactions.forEach(tx => {
      if (!tx.waterfall) return;
      const dateKey = new Date(tx.startTime).toISOString().split("T")[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: new Date(tx.startTime),
          stationIds: new Set(),
          energy: 0,
          grossRevenue: 0,
          energyCost: 0,
          hostAmount: 0,
          myShare: 0,
          evgreenAmount: 0,
          txCount: 0,
        };
      }
      grouped[dateKey].stationIds.add(tx.stationId);
      grouped[dateKey].energy += Number(tx.kwhConsumed || 0);
      grouped[dateKey].grossRevenue += tx.waterfall.grossRevenue;
      grouped[dateKey].energyCost += tx.waterfall.energyCost;
      grouped[dateKey].hostAmount += tx.waterfall.hostAmount;
      grouped[dateKey].myShare += tx.waterfall.myShare;
      grouped[dateKey].evgreenAmount += tx.waterfall.evgreenAmount;
      grouped[dateKey].txCount++;
    });

    return Object.values(grouped).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions]);

  // ─── Export handler ────────────────────────────────────────────
  const handleExport = async (format: "excel" | "pdf") => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ format });
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });
      saveBlobCrossPlatform(blob, result.filename);
      toast.success(`Reporte ${format.toUpperCase()} descargado exitosamente`);
      setExportDialogOpen(false);
    } catch {
      toast.error("Error al generar el reporte. Intenta de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today": return "hoy";
      case "week": return "esta semana";
      case "month": return "este mes";
      case "year": return "este año";
      default: return "";
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Ingresos</h1>
          <p className="text-muted-foreground">
            Ingresos consolidados de {stations.length} estacion{stations.length !== 1 ? "es" : ""} ({ownCount} propia{ownCount !== 1 ? "s" : ""}, {collectiveCount} colectiva{collectiveCount !== 1 ? "s" : ""})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Exportar Ingresos</DialogTitle>
                <DialogDescription>
                  Selecciona el formato de exportación para descargar el reporte de tus ingresos.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-green-50 hover:border-green-500"
                  onClick={() => handleExport("excel")}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-8 h-8 animate-spin text-green-600" /> : <FileSpreadsheet className="w-8 h-8 text-green-600" />}
                  <span className="font-medium">Excel (.xlsx)</span>
                  <span className="text-xs text-muted-foreground">Ideal para análisis y filtros</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-red-50 hover:border-red-500"
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-8 h-8 animate-spin text-red-600" /> : <FileText className="w-8 h-8 text-red-600" />}
                  <span className="font-medium">PDF</span>
                  <span className="text-xs text-muted-foreground">Ideal para impresión y archivo</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Aggregated KPIs (all stations) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tu ingreso neto total</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(aggregatedKPIs.myShare)}</p>
                <p className={`text-xs flex items-center mt-1 ${percentageChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {percentageChange >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                  {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(1)}% vs periodo anterior
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos brutos</p>
                <p className="text-2xl font-bold">{formatCurrency(aggregatedKPIs.grossRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Recaudo total de cargas</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Costo energía</p>
                <p className="text-2xl font-bold text-orange-500">{formatCurrency(aggregatedKPIs.energyCost)}</p>
                <p className="text-xs text-muted-foreground mt-1">Compra al operador de red</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Energía vendida</p>
                <p className="text-2xl font-bold">{aggregatedKPIs.energy.toFixed(1)} kWh</p>
                <p className="text-xs text-muted-foreground mt-1">{aggregatedKPIs.transactions} transacciones</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Waterfall Distribution Bar ───────────────────────────── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            Distribución del período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual waterfall bar */}
          {aggregatedKPIs.grossRevenue > 0 && (
            <div className="space-y-2">
              <div className="flex h-6 rounded-full overflow-hidden bg-muted">
                {aggregatedKPIs.energyCost > 0 && (
                  <div
                    className="bg-gray-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(aggregatedKPIs.energyCost / aggregatedKPIs.grossRevenue) * 100}%` }}
                    title={`Costo energía: ${formatCurrency(aggregatedKPIs.energyCost)}`}
                  />
                )}
                {aggregatedKPIs.hostAmount > 0 && (
                  <div
                    className="bg-amber-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(aggregatedKPIs.hostAmount / aggregatedKPIs.grossRevenue) * 100}%` }}
                    title={`Aliado comercial: ${formatCurrency(aggregatedKPIs.hostAmount)}`}
                  />
                )}
                <div
                  className="bg-green-500 flex items-center justify-center text-[10px] text-white font-medium"
                  style={{ width: `${(aggregatedKPIs.myShare / aggregatedKPIs.grossRevenue) * 100}%` }}
                  title={`Tu ingreso: ${formatCurrency(aggregatedKPIs.myShare)}`}
                />
                <div
                  className="bg-blue-500 flex items-center justify-center text-[10px] text-white font-medium"
                  style={{ width: `${(aggregatedKPIs.evgreenAmount / aggregatedKPIs.grossRevenue) * 100}%` }}
                  title={`EVGreen: ${formatCurrency(aggregatedKPIs.evgreenAmount)}`}
                />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />
                  Costo energía: {formatCurrency(aggregatedKPIs.energyCost)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  Aliado comercial: {formatCurrency(aggregatedKPIs.hostAmount)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  <strong>Tu ingreso: {formatCurrency(aggregatedKPIs.myShare)}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  EVGreen: {formatCurrency(aggregatedKPIs.evgreenAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Margen bruto</p>
              <p className="text-lg font-bold">{formatCurrency(aggregatedKPIs.grossRevenue - aggregatedKPIs.energyCost)}</p>
              <p className="text-[10px] text-muted-foreground">Bruto - Costo energía</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aliado comercial</p>
              <p className="text-lg font-bold text-amber-500">-{formatCurrency(aggregatedKPIs.hostAmount)}</p>
              <p className="text-[10px] text-muted-foreground">% del margen bruto</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tu ingreso neto</p>
              <p className="text-lg font-bold text-green-500">{formatCurrency(aggregatedKPIs.myShare)}</p>
              <p className="text-[10px] text-muted-foreground">Proporcional a tu participación</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Promedio por transacción</p>
              <p className="text-lg font-bold">
                {aggregatedKPIs.transactions > 0 ? formatCurrency(aggregatedKPIs.myShare / aggregatedKPIs.transactions) : "$0"}
              </p>
              <p className="text-[10px] text-muted-foreground">Tu ingreso neto promedio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Station Breakdown by Type ────────────────────────────── */}
      <Tabs value={stationTab} onValueChange={setStationTab}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ingresos por Estación</h2>
          <TabsList>
            <TabsTrigger value="all">Todas ({stationBreakdown.length})</TabsTrigger>
            <TabsTrigger value="own">
              <Building2 className="w-3.5 h-3.5 mr-1" />
              Propias ({ownCount})
            </TabsTrigger>
            <TabsTrigger value="collective">
              <Users className="w-3.5 h-3.5 mr-1" />
              Colectivas ({collectiveCount})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={stationTab} className="mt-0">
          {filteredStations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay estaciones {stationTab === "own" ? "propias" : stationTab === "collective" ? "colectivas" : ""} con transacciones en este período
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredStations.map(s => {
                const isExpanded = expandedStation === s.station.stationId;
                return (
                  <Card key={s.station.stationId} className="overflow-hidden">
                    {/* Station header - clickable */}
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedStation(isExpanded ? null : s.station.stationId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.station.isCollective ? "bg-purple-500/20" : "bg-blue-500/20"}`}>
                            {s.station.isCollective ? <Users className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-blue-500" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{s.station.stationName}</span>
                              <Badge variant={s.station.isCollective ? "secondary" : "outline"} className="text-[10px]">
                                {s.station.isCollective ? "Colectiva" : "Propia"}
                              </Badge>
                              {s.station.isCollective && (
                                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-500">
                                  Tu participación: {formatPct(s.station.investorParticipationPercent)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.txCount} transacciones · {s.energy.toFixed(1)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-500">{formatCurrency(s.myShare)}</p>
                            <p className="text-[10px] text-muted-foreground">Tu ingreso neto</p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t px-4 pb-4 pt-3 bg-muted/10 space-y-4">
                        {/* Model info */}
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs">
                          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium mb-1">Modelo financiero de esta estación</p>
                            <p className="text-muted-foreground">
                              Costo energía: {formatCurrency(s.station.energyCostPerKwh)}/kWh · 
                              Aliado: {formatPct(s.station.hostSharePercent)} del margen bruto · 
                              Inversionista: {formatPct(s.station.investorSharePercent)} del neto · 
                              EVGreen: {formatPct(s.station.evgreenSharePercent)} del neto
                              {s.station.isCollective && ` · Tu participación: ${formatPct(s.station.investorParticipationPercent)} del pool inversionista`}
                            </p>
                          </div>
                        </div>

                        {/* Waterfall breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">Ingreso bruto</p>
                            <p className="text-sm font-bold">{formatCurrency(s.grossRevenue)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">Costo energía</p>
                            <p className="text-sm font-bold text-gray-500">-{formatCurrency(s.energyCost)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">Margen bruto</p>
                            <p className="text-sm font-bold">{formatCurrency(s.grossMargin)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">Aliado ({formatPct(s.station.hostSharePercent)})</p>
                            <p className="text-sm font-bold text-amber-500">-{formatCurrency(s.hostAmount)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/20">
                            <p className="text-[10px] text-muted-foreground">
                              {s.station.isCollective ? `Pool inv. (${formatPct(s.station.investorSharePercent)})` : `Tu parte (${formatPct(s.station.investorSharePercent)})`}
                            </p>
                            <p className="text-sm font-bold">{formatCurrency(s.investorPool)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <p className="text-[10px] text-muted-foreground">
                              {s.station.isCollective ? `Tu parte (${formatPct(s.station.investorParticipationPercent)})` : "Tu ingreso neto"}
                            </p>
                            <p className="text-sm font-bold text-green-500">{formatCurrency(s.myShare)}</p>
                          </div>
                        </div>

                        {/* Visual bar for this station */}
                        {s.grossRevenue > 0 && (
                          <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                            <div className="bg-gray-500" style={{ width: `${(s.energyCost / s.grossRevenue) * 100}%` }} title="Costo energía" />
                            <div className="bg-amber-500" style={{ width: `${(s.hostAmount / s.grossRevenue) * 100}%` }} title="Aliado" />
                            <div className="bg-green-500" style={{ width: `${(s.myShare / s.grossRevenue) * 100}%` }} title="Tu ingreso" />
                            <div className="bg-blue-500" style={{ width: `${(s.evgreenAmount / s.grossRevenue) * 100}%` }} title="EVGreen" />
                            {s.station.isCollective && s.investorPool - s.myShare > 0 && (
                              <div className="bg-purple-400" style={{ width: `${((s.investorPool - s.myShare) / s.grossRevenue) * 100}%` }} title="Otros inversionistas" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Daily Earnings Table ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Detalle de Ingresos Diarios - {getPeriodLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyEarnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones completadas en este período
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 font-medium text-sm">Fecha</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Estaciones</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Energía</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Tx</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Bruto</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Costo energía</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">Aliado</th>
                      <th className="text-right py-3 px-3 font-medium text-sm">EVGreen</th>
                      <th className="text-right py-3 px-3 font-medium text-sm text-green-500">Tu ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyEarnings.map((day, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {new Date(day.date).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">{day.stationIds.size}</td>
                        <td className="py-3 px-3 text-right">{day.energy.toFixed(1)} kWh</td>
                        <td className="py-3 px-3 text-right">{day.txCount}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(day.grossRevenue)}</td>
                        <td className="py-3 px-3 text-right text-gray-500">-{formatCurrency(day.energyCost)}</td>
                        <td className="py-3 px-3 text-right text-amber-500">-{formatCurrency(day.hostAmount)}</td>
                        <td className="py-3 px-3 text-right text-blue-500">-{formatCurrency(day.evgreenAmount)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-green-500">{formatCurrency(day.myShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-3 px-3">Total</td>
                      <td className="py-3 px-3 text-right">-</td>
                      <td className="py-3 px-3 text-right">{aggregatedKPIs.energy.toFixed(1)} kWh</td>
                      <td className="py-3 px-3 text-right">{aggregatedKPIs.transactions}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(aggregatedKPIs.grossRevenue)}</td>
                      <td className="py-3 px-3 text-right text-gray-500">-{formatCurrency(aggregatedKPIs.energyCost)}</td>
                      <td className="py-3 px-3 text-right text-amber-500">-{formatCurrency(aggregatedKPIs.hostAmount)}</td>
                      <td className="py-3 px-3 text-right text-blue-500">-{formatCurrency(aggregatedKPIs.evgreenAmount)}</td>
                      <td className="py-3 px-3 text-right text-green-500">{formatCurrency(aggregatedKPIs.myShare)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {dailyEarnings.map((day, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {new Date(day.date).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <span className="font-bold text-green-500">{formatCurrency(day.myShare)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Bruto</p>
                        <p className="font-medium">{formatCurrency(day.grossRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Energía</p>
                        <p className="font-medium">{day.energy.toFixed(1)} kWh</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tx</p>
                        <p className="font-medium">{day.txCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
