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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  AlertTriangle,
  Activity,
  Bookmark,
  Megaphone,
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

// ─── Helpers ─────────────────────────────────────────────────────
const formatCOP = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

  // Fetch enriched transactions
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
    let totalRevenueFromEnergy = 0;
    let totalRevenueFromPenalties = 0;

    allTransactions.forEach(tx => {
      if (tx.waterfall) {
        totalMyShare += tx.waterfall.myShare;
        totalGrossRevenue += tx.waterfall.grossRevenue;
        totalEnergyCost += tx.waterfall.energyCost;
        totalHostAmount += tx.waterfall.hostAmount;
        totalEvgreenAmount += tx.waterfall.evgreenAmount;
        totalRevenueFromEnergy += tx.waterfall.revenueFromEnergy || 0;
        totalRevenueFromPenalties += tx.waterfall.revenueFromPenalties || 0;
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
      revenueFromEnergy: totalRevenueFromEnergy,
      revenueFromPenalties: totalRevenueFromPenalties,
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
      revenueFromEnergy: number;
      revenueFromPenalties: number;
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
        existing.revenueFromEnergy += tx.waterfall.revenueFromEnergy || 0;
        existing.revenueFromPenalties += tx.waterfall.revenueFromPenalties || 0;
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
          revenueFromEnergy: tx.waterfall.revenueFromEnergy || 0,
          revenueFromPenalties: tx.waterfall.revenueFromPenalties || 0,
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

  // ─── Weighted average distribution percentages ─────────────────
  const weightedDistribution = useMemo(() => {
    if (stationBreakdown.length === 0) return null;
    
    // If only one station or all have same config, show exact percentages
    if (stationBreakdown.length === 1) {
      const s = stationBreakdown[0].station;
      return {
        hostPct: s.hostSharePercent,
        investorPct: s.investorSharePercent,
        evgreenPct: s.evgreenSharePercent,
        isUniform: true,
      };
    }
    
    // Check if all stations have same config
    const first = stationBreakdown[0].station;
    const allSame = stationBreakdown.every(s => 
      s.station.hostSharePercent === first.hostSharePercent &&
      s.station.investorSharePercent === first.investorSharePercent &&
      s.station.evgreenSharePercent === first.evgreenSharePercent
    );
    
    if (allSame) {
      return {
        hostPct: first.hostSharePercent,
        investorPct: first.investorSharePercent,
        evgreenPct: first.evgreenSharePercent,
        isUniform: true,
      };
    }
    
    // Weighted average by gross revenue
    const totalGross = stationBreakdown.reduce((s, st) => s + st.grossRevenue, 0);
    if (totalGross === 0) return null;
    
    let wHost = 0, wInv = 0, wEvg = 0;
    stationBreakdown.forEach(st => {
      const weight = st.grossRevenue / totalGross;
      wHost += st.station.hostSharePercent * weight;
      wInv += st.station.investorSharePercent * weight;
      wEvg += st.station.evgreenSharePercent * weight;
    });
    
    return {
      hostPct: wHost,
      investorPct: wInv,
      evgreenPct: wEvg,
      isUniform: false,
    };
  }, [stationBreakdown]);

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
      toast.success(`Reporte ${format.toUpperCase()} descargado`);
      setExportDialogOpen(false);
    } catch {
      toast.error("Error al generar el reporte");
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

  const grossMargin = aggregatedKPIs.grossRevenue - aggregatedKPIs.energyCost;

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mis Ingresos</h1>
            <p className="text-sm text-muted-foreground">
              {stations.length} estacion{stations.length !== 1 ? "es" : ""} · {ownCount} propia{ownCount !== 1 ? "s" : ""} · {collectiveCount} colectiva{collectiveCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36">
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
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1.5" />
                  Exportar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Exportar Ingresos</DialogTitle>
                  <DialogDescription>Selecciona el formato de exportación</DialogDescription>
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

        {/* ─── KPIs Row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tu ingreso neto</p>
                  <p className="text-xl md:text-2xl font-bold text-green-500">{formatCOP(aggregatedKPIs.myShare)}</p>
                  <p className={`text-[11px] flex items-center mt-0.5 ${percentageChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {percentageChange >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(1)}% vs anterior
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
                  <p className="text-xs text-muted-foreground">Margen bruto</p>
                  <p className="text-xl md:text-2xl font-bold">{formatCOP(grossMargin)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Después de costo energía</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Energía vendida</p>
                  <p className="text-xl md:text-2xl font-bold">{aggregatedKPIs.energy.toFixed(1)} kWh</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{aggregatedKPIs.transactions} transacciones</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Promedio / carga</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {aggregatedKPIs.transactions > 0 ? formatCOP(aggregatedKPIs.myShare / aggregatedKPIs.transactions) : "$0"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tu ingreso neto</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Waterfall + Revenue Sources (side by side on desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Waterfall Distribution - 3 columns */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Distribución del Waterfall
                {weightedDistribution && !weightedDistribution.isUniform && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-[10px] ml-1">Promedio ponderado</Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">Los porcentajes son un promedio ponderado por ingresos brutos de cada estación. Expande cada estación para ver su configuración individual.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Visual waterfall bar */}
              {aggregatedKPIs.grossRevenue > 0 && (
                <div className="space-y-2">
                  <div className="flex h-5 rounded-full overflow-hidden bg-muted">
                    {aggregatedKPIs.energyCost > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gray-500 transition-all"
                            style={{ width: `${(aggregatedKPIs.energyCost / aggregatedKPIs.grossRevenue) * 100}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent><p>Costo energía: {formatCOP(aggregatedKPIs.energyCost)}</p></TooltipContent>
                      </Tooltip>
                    )}
                    {aggregatedKPIs.hostAmount > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-amber-500 transition-all"
                            style={{ width: `${(aggregatedKPIs.hostAmount / aggregatedKPIs.grossRevenue) * 100}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent><p>Aliado comercial: {formatCOP(aggregatedKPIs.hostAmount)}</p></TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="bg-green-500 transition-all"
                          style={{ width: `${(aggregatedKPIs.myShare / aggregatedKPIs.grossRevenue) * 100}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent><p>Tu ingreso: {formatCOP(aggregatedKPIs.myShare)}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="bg-blue-500 transition-all"
                          style={{ width: `${(aggregatedKPIs.evgreenAmount / aggregatedKPIs.grossRevenue) * 100}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent><p>EVGreen: {formatCOP(aggregatedKPIs.evgreenAmount)}</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /> Costo energía</span>
                    {aggregatedKPIs.hostAmount > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Aliado</span>}
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> <strong>Tu ingreso</strong></span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> EVGreen</span>
                  </div>
                </div>
              )}

              {/* Summary stats - dynamic per station config */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Ingreso bruto</p>
                  <p className="text-base font-bold">{formatCOP(aggregatedKPIs.grossRevenue)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Costo energía</p>
                  <p className="text-base font-bold text-gray-500">-{formatCOP(aggregatedKPIs.energyCost)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">
                    Aliado{weightedDistribution ? ` (${formatPct(weightedDistribution.hostPct)})` : ""}
                  </p>
                  <p className="text-base font-bold text-amber-500">-{formatCOP(aggregatedKPIs.hostAmount)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-[10px] text-muted-foreground">
                    Tu ingreso{weightedDistribution ? ` (${formatPct(weightedDistribution.investorPct)})` : ""}
                  </p>
                  <p className="text-base font-bold text-green-500">{formatCOP(aggregatedKPIs.myShare)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Sources - 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Fuentes de Ingreso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* Energy sales */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Venta de energía</span>
                </div>
                <span className="font-bold text-sm">{formatCOP(aggregatedKPIs.revenueFromEnergy || aggregatedKPIs.grossRevenue)}</span>
              </div>
              
              {/* Penalties */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Penalidades</span>
                </div>
                <span className={`font-bold text-sm ${aggregatedKPIs.revenueFromPenalties > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {formatCOP(aggregatedKPIs.revenueFromPenalties)}
                </span>
              </div>
              
              {/* Reservations - placeholder */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Reservas</span>
                </div>
                <span className="font-bold text-sm text-muted-foreground">{formatCOP(0)}</span>
              </div>
              
              {/* Advertising - placeholder */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Publicidad</span>
                </div>
                <span className="font-bold text-sm text-muted-foreground">{formatCOP(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Station Breakdown by Type ────────────────────────────── */}
        <Tabs value={stationTab} onValueChange={setStationTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">Ingresos por Estación</h2>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">Todas ({stationBreakdown.length})</TabsTrigger>
              <TabsTrigger value="own" className="text-xs px-3">
                <Building2 className="w-3 h-3 mr-1" />
                Propias ({ownCount})
              </TabsTrigger>
              <TabsTrigger value="collective" className="text-xs px-3">
                <Users className="w-3 h-3 mr-1" />
                Colectivas ({collectiveCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={stationTab} className="mt-0">
            {filteredStations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Sin transacciones en este período
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {filteredStations.map(s => {
                  const isExpanded = expandedStation === s.station.stationId;
                  return (
                    <Card key={s.station.stationId} className="overflow-hidden">
                      {/* Station header */}
                      <div
                        className="p-3 md:p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedStation(isExpanded ? null : s.station.stationId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.station.isCollective ? "bg-purple-500/20" : "bg-blue-500/20"}`}>
                              {s.station.isCollective ? <Users className="w-4 h-4 text-purple-500" /> : <Building2 className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm">{s.station.stationName}</span>
                                <Badge variant={s.station.isCollective ? "secondary" : "outline"} className="text-[9px] px-1.5 py-0">
                                  {s.station.isCollective ? `Colectiva · ${formatPct(s.station.investorParticipationPercent)}` : "Propia"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {s.txCount} tx · {s.energy.toFixed(1)} kWh · Inv: {formatPct(s.station.investorSharePercent)} · Host: {formatPct(s.station.hostSharePercent)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-base font-bold text-green-500">{formatCOP(s.myShare)}</p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t px-3 md:px-4 pb-3 pt-3 bg-muted/10 space-y-3">
                          {/* Waterfall breakdown */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            <div className="p-2 rounded-lg bg-muted/20">
                              <p className="text-[9px] text-muted-foreground">Bruto</p>
                              <p className="text-xs font-bold">{formatCOP(s.grossRevenue)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/20">
                              <p className="text-[9px] text-muted-foreground">Costo energía</p>
                              <p className="text-xs font-bold text-gray-500">-{formatCOP(s.energyCost)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/20">
                              <p className="text-[9px] text-muted-foreground">Margen</p>
                              <p className="text-xs font-bold">{formatCOP(s.grossMargin)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/20">
                              <p className="text-[9px] text-muted-foreground">Aliado ({formatPct(s.station.hostSharePercent)})</p>
                              <p className="text-xs font-bold text-amber-500">-{formatCOP(s.hostAmount)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/20">
                              <p className="text-[9px] text-muted-foreground">
                                {s.station.isCollective ? `Pool inv.` : `Inv.`} ({formatPct(s.station.investorSharePercent)})
                              </p>
                              <p className="text-xs font-bold">{formatCOP(s.investorPool)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                              <p className="text-[9px] text-muted-foreground">
                                {s.station.isCollective ? `Tu parte (${formatPct(s.station.investorParticipationPercent)})` : "Tu ingreso"}
                              </p>
                              <p className="text-xs font-bold text-green-500">{formatCOP(s.myShare)}</p>
                            </div>
                          </div>

                          {/* Revenue sources for this station */}
                          {(s.revenueFromPenalties > 0 || s.revenueFromEnergy > 0) && (
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
                                Energía: {formatCOP(s.revenueFromEnergy)}
                              </span>
                              {s.revenueFromPenalties > 0 && (
                                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500">
                                  Penalidades: {formatCOP(s.revenueFromPenalties)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Visual bar for this station */}
                          {s.grossRevenue > 0 && (
                            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                              <div className="bg-gray-500" style={{ width: `${(s.energyCost / s.grossRevenue) * 100}%` }} />
                              {s.hostAmount > 0 && <div className="bg-amber-500" style={{ width: `${(s.hostAmount / s.grossRevenue) * 100}%` }} />}
                              <div className="bg-green-500" style={{ width: `${(s.myShare / s.grossRevenue) * 100}%` }} />
                              <div className="bg-blue-500" style={{ width: `${(s.evgreenAmount / s.grossRevenue) * 100}%` }} />
                              {s.station.isCollective && s.investorPool - s.myShare > 0 && (
                                <div className="bg-purple-400" style={{ width: `${((s.investorPool - s.myShare) / s.grossRevenue) * 100}%` }} />
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
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Detalle Diario — {getPeriodLabel()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyEarnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Sin transacciones en este período
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2.5 px-2 font-medium">Fecha</th>
                        <th className="text-right py-2.5 px-2 font-medium">Est.</th>
                        <th className="text-right py-2.5 px-2 font-medium">kWh</th>
                        <th className="text-right py-2.5 px-2 font-medium">Tx</th>
                        <th className="text-right py-2.5 px-2 font-medium">Bruto</th>
                        <th className="text-right py-2.5 px-2 font-medium">Energía</th>
                        <th className="text-right py-2.5 px-2 font-medium">Aliado</th>
                        <th className="text-right py-2.5 px-2 font-medium">EVGreen</th>
                        <th className="text-right py-2.5 px-2 font-medium text-green-500">Tu ingreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyEarnings.map((day, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {new Date(day.date).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right">{day.stationIds.size}</td>
                          <td className="py-2.5 px-2 text-right">{day.energy.toFixed(1)}</td>
                          <td className="py-2.5 px-2 text-right">{day.txCount}</td>
                          <td className="py-2.5 px-2 text-right">{formatCOP(day.grossRevenue)}</td>
                          <td className="py-2.5 px-2 text-right text-gray-500">-{formatCOP(day.energyCost)}</td>
                          <td className="py-2.5 px-2 text-right text-amber-500">-{formatCOP(day.hostAmount)}</td>
                          <td className="py-2.5 px-2 text-right text-blue-500">-{formatCOP(day.evgreenAmount)}</td>
                          <td className="py-2.5 px-2 text-right font-semibold text-green-500">{formatCOP(day.myShare)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-semibold">
                        <td className="py-2.5 px-2">Total</td>
                        <td className="py-2.5 px-2 text-right">-</td>
                        <td className="py-2.5 px-2 text-right">{aggregatedKPIs.energy.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right">{aggregatedKPIs.transactions}</td>
                        <td className="py-2.5 px-2 text-right">{formatCOP(aggregatedKPIs.grossRevenue)}</td>
                        <td className="py-2.5 px-2 text-right text-gray-500">-{formatCOP(aggregatedKPIs.energyCost)}</td>
                        <td className="py-2.5 px-2 text-right text-amber-500">-{formatCOP(aggregatedKPIs.hostAmount)}</td>
                        <td className="py-2.5 px-2 text-right text-blue-500">-{formatCOP(aggregatedKPIs.evgreenAmount)}</td>
                        <td className="py-2.5 px-2 text-right text-green-500">{formatCOP(aggregatedKPIs.myShare)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {dailyEarnings.map((day, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {new Date(day.date).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                        </div>
                        <span className="font-bold text-green-500 text-sm">{formatCOP(day.myShare)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-muted-foreground">Bruto</p>
                          <p className="font-medium">{formatCOP(day.grossRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">kWh</p>
                          <p className="font-medium">{day.energy.toFixed(1)}</p>
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
    </TooltipProvider>
  );
}
