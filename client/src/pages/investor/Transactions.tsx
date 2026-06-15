import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search, Download, Zap, DollarSign, Calendar, FileSpreadsheet, FileText,
  Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp,
  Users, Building2, Info, PieChart, ArrowDown, Percent, Factory
} from "lucide-react";
import { toast } from "sonner";
import { saveBlobCrossPlatform } from "@/lib/pdf-download";

export default function InvestorTransactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const queryInput = useMemo(() => ({
    limit: pageSize,
    page,
    status: statusFilter !== "all" ? statusFilter : undefined,
    stationId: stationFilter !== "all" ? Number(stationFilter) : undefined,
    startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [page, pageSize, statusFilter, stationFilter, startDate, endDate]);

  const { data: paginatedResult, isLoading } = trpc.transactions.investorTransactionsEnriched.useQuery(queryInput);
  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();

  const transactions = paginatedResult?.data || [];
  const totalPages = paginatedResult?.totalPages || 1;
  const totalCount = paginatedResult?.total || 0;
  const investorStations = paginatedResult?.stations || [];

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
      CANCELED: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      IN_PROGRESS: "En progreso",
      PENDING: "Pendiente",
      FAILED: "Fallida",
      CANCELLED: "Cancelada",
      CANCELED: "Cancelada",
    };
    return <Badge className={styles[status] || "bg-gray-800/50 text-gray-300"}>{labels[status] || status}</Badge>;
  };

  // KPIs calculated from waterfall data
  const completedTx = transactions.filter((t: any) => t.status === "COMPLETED" && t.waterfall);
  const totalGrossRevenue = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.grossRevenue || 0), 0);
  const totalEnergyCost = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.energyCost || 0), 0);
  const totalGrossMargin = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.grossMargin || 0), 0);
  const totalHostAmount = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.hostAmount || 0), 0);
  const totalNetAfterHost = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.netAfterHost || 0), 0);
  const totalMyShare = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.myShare || 0), 0);
  const totalEvgreenAmount = completedTx.reduce((sum: number, t: any) => sum + (t.waterfall?.evgreenAmount || 0), 0);
  const totalEnergy = completedTx.reduce((sum: number, t: any) => sum + parseFloat(t.kwhConsumed || "0"), 0);

  const toggleRow = (txId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const downloadFile = (base64: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    saveBlobCrossPlatform(blob, filename);
  };

  const handleExport = async (format: "excel" | "pdf") => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        format,
        startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
      });
      downloadFile(result.data, result.filename, result.mimeType);
      toast.success(`Reporte ${format.toUpperCase()} descargado exitosamente`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Error al exportar:", error);
      toast.error("Error al generar el reporte. Intenta de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter((tx: any) => {
      const name = tx.stationName || "";
      return tx.id.toString().includes(searchQuery) ||
        tx.stationId.toString().includes(searchQuery) ||
        name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [transactions, searchQuery]);

  const handleStationChange = (value: string) => {
    setStationFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Waterfall visual for a single transaction
  const WaterfallBreakdown = ({ tx }: { tx: any }) => {
    const w = tx.waterfall;
    if (!w) return <div className="text-sm text-muted-foreground">Sin datos de distribución</div>;
    const si = tx.stationInfo;

    return (
      <div className="space-y-4 py-2">
        {/* Station context */}
        {si && (
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            {si.isCollective ? (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                <Users className="w-3 h-3 mr-1" /> Colectiva — Tu participación: {si.investorParticipationPercent.toFixed(1)}%
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <Building2 className="w-3 h-3 mr-1" /> Estación propia
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{si.stationName}</span>
          </div>
        )}

        {/* Waterfall steps */}
        <div className="space-y-1">
          {/* Step 1: Gross revenue */}
          <div className="flex justify-between items-center text-sm py-1.5 px-2 rounded bg-muted/30">
            <span className="flex items-center gap-1.5 font-medium">
              <DollarSign className="w-3.5 h-3.5 text-blue-500" /> Ingreso bruto
            </span>
            <span className="font-bold">{formatCurrency(w.grossRevenue)}</span>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-red-500 ml-1">- Costo energía: {formatCurrency(w.energyCost)}</span>
          </div>

          {/* Step 2: Gross margin */}
          <div className="flex justify-between items-center text-sm py-1.5 px-2 rounded bg-muted/30">
            <span className="flex items-center gap-1.5 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Margen bruto
            </span>
            <span className="font-bold">{formatCurrency(w.grossMargin)}</span>
          </div>

          {/* Arrow - Host deduction */}
          {w.hostPercent > 0 && (
            <>
              <div className="flex items-center justify-center">
                <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-amber-600 ml-1">- Aliado Comercial ({w.hostPercent}%): {formatCurrency(w.hostAmount)}</span>
              </div>

              {/* Step 3: Net after host */}
              <div className="flex justify-between items-center text-sm py-1.5 px-2 rounded bg-muted/30">
                <span className="flex items-center gap-1.5 font-medium">
                  <Factory className="w-3.5 h-3.5 text-cyan-500" /> Neto (después de aliado)
                </span>
                <span className="font-bold">{formatCurrency(w.netAfterHost)}</span>
              </div>
            </>
          )}

          {/* Arrow - Split */}
          <div className="flex items-center justify-center py-1">
            <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground ml-1">Reparto EVGreen / Inversionistas</span>
          </div>

          {/* Step 4: Split */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm py-2 px-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Users className="w-3 h-3" /> Inversionistas ({w.investorPoolPercent}%)
              </div>
              <div className="font-bold text-green-600">{formatCurrency(w.totalInvestorPool)}</div>
              {w.isCollective && (
                <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                  <div className="text-xs text-muted-foreground">Tu parte ({w.participationPercent.toFixed(1)}%)</div>
                  <div className="font-bold text-green-700 dark:text-green-400 text-base">{formatCurrency(w.myShare)}</div>
                </div>
              )}
            </div>
            <div className="text-sm py-2 px-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Zap className="w-3 h-3" /> EVGreen ({w.evgreenPercent}%)
              </div>
              <div className="font-bold text-blue-600">{formatCurrency(w.evgreenAmount)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Selected station info
  const selectedStationInfo = stationFilter !== "all"
    ? investorStations.find((s: any) => s.stationId === Number(stationFilter))
    : null;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de cargas con desglose transparente del modelo financiero
          </p>
        </div>
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-shrink-0">
              <Download className="w-4 h-4 mr-1 sm:mr-2" />
              Exportar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle>Exportar Transacciones</DialogTitle>
              <DialogDescription>
                Selecciona el formato de exportación para descargar el reporte de tus transacciones.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-green-50 hover:border-green-500 dark:hover:bg-green-950 dark:hover:border-green-700"
                onClick={() => handleExport("excel")}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-8 h-8 animate-spin text-green-600" /> : <FileSpreadsheet className="w-8 h-8 text-green-600" />}
                <span className="font-medium">Excel (.xlsx)</span>
                <span className="text-xs text-muted-foreground">Ideal para análisis y filtros</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-red-50 hover:border-red-500 dark:hover:bg-red-950 dark:hover:border-red-700"
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

      {/* Station selector with participation info */}
      {investorStations.length > 1 && (
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
              <Building2 className="w-4 h-4" /> Filtrar por estación:
            </div>
            <Select value={stationFilter} onValueChange={handleStationChange}>
              <SelectTrigger className="w-full sm:w-80 text-sm">
                <SelectValue placeholder="Todas las estaciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las estaciones ({investorStations.length})</SelectItem>
                {investorStations.map((s: any) => (
                  <SelectItem key={s.stationId} value={s.stationId.toString()}>
                    <span className="flex items-center gap-2">
                      {s.isCollective ? (
                        <Users className="w-3 h-3 text-purple-500 flex-shrink-0" />
                      ) : (
                        <Building2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      )}
                      {s.stationName}
                      {s.isCollective && (
                        <span className="text-xs text-purple-500 ml-1">({s.investorParticipationPercent.toFixed(1)}%)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Station info card when a specific station is selected */}
          {selectedStationInfo && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="font-medium flex items-center gap-1">
                    {selectedStationInfo.isCollective ? (
                      <><Users className="w-3 h-3 text-purple-500" /> Colectiva</>
                    ) : (
                      <><Building2 className="w-3 h-3 text-emerald-500" /> Propia</>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tu participación</div>
                  <div className="font-bold text-green-600">{selectedStationInfo.investorParticipationPercent.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Aliado comercial</div>
                  <div className="font-medium text-amber-600">{selectedStationInfo.hostSharePercent}% del margen</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Costo energía</div>
                  <div className="font-medium">{formatCurrency(selectedStationInfo.energyCostPerKwh)}/kWh</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* KPIs with waterfall-based calculations */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate text-green-600">{formatCurrency(totalMyShare)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Tu parte neta</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate">{formatCurrency(totalGrossRevenue)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Ingreso bruto</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate">{totalEnergy.toFixed(1)} kWh</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Energía vendida</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate text-emerald-600">{formatCurrency(totalGrossMargin)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Margen bruto</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Waterfall distribution summary */}
      {totalGrossRevenue > 0 && (
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <PieChart className="w-4 h-4" /> Distribución del período (modelo financiero)
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="text-xs">Flujo: Ingreso bruto → menos costo energía = Margen bruto → menos % aliado comercial = Neto → se reparte entre EVGreen e inversionistas según sus porcentajes. Tu parte es proporcional a tu participación en cada estación.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Waterfall bar */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Ingreso bruto</span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-medium text-foreground">{formatCurrency(totalGrossRevenue)}</span>
            </div>
            <div className="flex h-6 rounded-md overflow-hidden text-[10px] font-medium">
              {totalEnergyCost > 0 && (
                <div className="bg-red-400 dark:bg-red-600 flex items-center justify-center text-white px-1" style={{ width: `${(totalEnergyCost / totalGrossRevenue) * 100}%` }}>
                  {((totalEnergyCost / totalGrossRevenue) * 100).toFixed(0)}%
                </div>
              )}
              {totalHostAmount > 0 && (
                <div className="bg-amber-400 dark:bg-amber-600 flex items-center justify-center text-white px-1" style={{ width: `${(totalHostAmount / totalGrossRevenue) * 100}%` }}>
                  {((totalHostAmount / totalGrossRevenue) * 100).toFixed(0)}%
                </div>
              )}
              <div className="bg-green-500 flex items-center justify-center text-white px-1" style={{ width: `${(totalMyShare / totalGrossRevenue) * 100}%` }}>
                {((totalMyShare / totalGrossRevenue) * 100).toFixed(0)}%
              </div>
              <div className="bg-blue-500 flex items-center justify-center text-white px-1" style={{ width: `${(totalEvgreenAmount / totalGrossRevenue) * 100}%` }}>
                {((totalEvgreenAmount / totalGrossRevenue) * 100).toFixed(0)}%
              </div>
              {/* Remainder for other investors in collective stations */}
              {(totalGrossRevenue - totalEnergyCost - totalHostAmount - totalMyShare - totalEvgreenAmount) > 1 && (
                <div className="bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white px-1" style={{ width: `${((totalGrossRevenue - totalEnergyCost - totalHostAmount - totalMyShare - totalEvgreenAmount) / totalGrossRevenue) * 100}%` }}>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-600 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Costo energía</div>
                <div className="font-medium">{formatCurrency(totalEnergyCost)}</div>
              </div>
            </div>
            {totalHostAmount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Aliado comercial</div>
                  <div className="font-medium text-amber-600">{formatCurrency(totalHostAmount)}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Tu parte neta</div>
                <div className="font-bold text-green-600">{formatCurrency(totalMyShare)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">EVGreen</div>
                <div className="font-medium text-blue-600">{formatCurrency(totalEvgreenAmount)}</div>
              </div>
            </div>
            {(totalGrossRevenue - totalEnergyCost - totalHostAmount - totalMyShare - totalEvgreenAmount) > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-400 dark:bg-gray-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Otros inversionistas</div>
                  <div className="font-medium">{formatCurrency(totalGrossRevenue - totalEnergyCost - totalHostAmount - totalMyShare - totalEvgreenAmount)}</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por estación o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-48 text-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="COMPLETED">Completadas</SelectItem>
                  <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                  <SelectItem value="FAILED">Fallidas</SelectItem>
                  <SelectItem value="CANCELLED">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowDateFilters(!showDateFilters)} className="flex-shrink-0">
                <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Fechas</span>
              </Button>
            </div>
          </div>
          {showDateFilters && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="text-sm" />
              </div>
              <Button size="sm" variant="outline" onClick={handleClearDates} className="flex-shrink-0">Limpiar</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Desktop table with expandable waterfall */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap w-8"></TableHead>
              <TableHead className="whitespace-nowrap">ID</TableHead>
              <TableHead className="whitespace-nowrap">Estación</TableHead>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead className="whitespace-nowrap">Energía</TableHead>
              <TableHead className="whitespace-nowrap">Ingreso bruto</TableHead>
              <TableHead className="whitespace-nowrap">Margen bruto</TableHead>
              <TableHead className="whitespace-nowrap text-green-600">Tu parte neta</TableHead>
              <TableHead className="whitespace-nowrap text-blue-600">EVGreen</TableHead>
              <TableHead className="whitespace-nowrap">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Cargando transacciones...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx: any) => {
                const w = tx.waterfall;
                const isExpanded = expandedRows.has(tx.id);
                return (
                  <>
                    <TableRow key={tx.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(tx.id)}>
                      <TableCell className="w-8 px-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">#{tx.id}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          {tx.stationInfo?.isCollective ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Users className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Colectiva — Tu participación: {tx.stationInfo.investorParticipationPercent.toFixed(1)}%</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{tx.stationName || `ID: ${tx.stationId}`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(tx.startTime)}</TableCell>
                      <TableCell className="whitespace-nowrap">{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(w?.grossRevenue || 0)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(w?.grossMargin || 0)}</TableCell>
                      <TableCell className="text-green-600 font-bold whitespace-nowrap">
                        {formatCurrency(w?.myShare || 0)}
                        {tx.stationInfo?.isCollective && (
                          <span className="text-[10px] text-purple-500 ml-1">({tx.stationInfo.investorParticipationPercent.toFixed(0)}%)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium whitespace-nowrap">
                        {formatCurrency(w?.evgreenAmount || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${tx.id}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/20 p-4">
                          <WaterfallBreakdown tx={tx} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards with waterfall */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Cargando transacciones...</span>
            </div>
          </Card>
        ) : filteredTransactions.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            No hay transacciones registradas
          </Card>
        ) : (
          filteredTransactions.map((tx: any) => {
            const w = tx.waterfall;
            const isExpanded = expandedRows.has(tx.id);
            return (
              <Card key={tx.id} className="p-3">
                <div className="cursor-pointer" onClick={() => toggleRow(tx.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">#{tx.id}</span>
                      {tx.stationInfo?.isCollective ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                          <Users className="w-2.5 h-2.5 mr-0.5" /> {tx.stationInfo.investorParticipationPercent.toFixed(0)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Propia
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(tx.status)}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estación</span>
                      <span className="font-medium truncate ml-2">{tx.stationName || `ID: ${tx.stationId}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Energía</span>
                      <span className="font-medium">{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingreso bruto</span>
                      <span className="font-medium">{formatCurrency(w?.grossRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                      <span className="text-muted-foreground">Tu parte neta</span>
                      <span className="font-bold text-green-600">{formatCurrency(w?.myShare || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha</span>
                      <span className="text-xs text-muted-foreground">{formatDate(tx.startTime)}</span>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <WaterfallBreakdown tx={tx} />
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Transaction detail dialog (for mobile tap) */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Transacción #{selectedTx?.id}
              {selectedTx && getStatusBadge(selectedTx.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedTx?.stationName || `Estación ID: ${selectedTx?.stationId}`} - {formatDate(selectedTx?.startTime)}
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="py-2">
              <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Energía entregada</span>
                  <span className="font-medium">{parseFloat(selectedTx.kwhConsumed || "0").toFixed(2)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precio aplicado</span>
                  <span className="font-medium">{formatCurrency(selectedTx.appliedPricePerKwh || 0)}/kWh</span>
                </div>
              </div>
              <WaterfallBreakdown tx={selectedTx} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} de {totalCount} transacción{totalCount !== 1 ? "es" : ""}
            {statusFilter !== "all" && ` (filtro: ${statusFilter})`}
            {stationFilter !== "all" && ` (estación: ${selectedStationInfo?.stationName || stationFilter})`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Anterior</span>
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Pág.</span>
              <span className="font-medium">{page}</span>
              <span className="text-muted-foreground">de</span>
              <span className="font-medium">{totalPages}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <span className="hidden sm:inline mr-1">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
