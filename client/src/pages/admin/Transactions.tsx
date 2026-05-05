import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, Download, Filter, Zap, DollarSign, Clock, Battery, Loader2, Trash2, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar, Eye } from "lucide-react";
import { toast } from "sonner";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";

export default function AdminTransactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  // Filtros de fecha
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);
  // Detalle de transacción
  const [detailTxId, setDetailTxId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.adminMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Construir input para la query paginada
  const queryInput = useMemo(() => ({
    limit: pageSize,
    page,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [page, pageSize, statusFilter, startDate, endDate]);

  const { data: paginatedResult, isLoading: transactionsLoading } = trpc.transactions.listAll.useQuery(queryInput);

  const transactions = paginatedResult?.data || [];
  const totalPages = paginatedResult?.totalPages || 1;
  const totalCount = paginatedResult?.total || 0;

  const formatCurrency = (amount: string | number | null) => {
    const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
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

  const formatDuration = (startTime: string | Date, endTime: string | Date | null) => {
    if (!endTime) return "En progreso";
    const start = new Date(startTime);
    const end = new Date(endTime);
    const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    const labels: Record<string, string> = {
      COMPLETED: "Completada",
      IN_PROGRESS: "En progreso",
      FAILED: "Fallida",
      CANCELLED: "Cancelada",
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{labels[status] || status}</Badge>;
  };

  // Filtro de búsqueda local (sobre los resultados ya paginados del server)
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter((tx: any) => {
      return tx.id.toString().includes(searchQuery) ||
        tx.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.stationName?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [transactions, searchQuery]);

  const cleanupMutation = trpc.transactions.cleanupOrphaned.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.transactions.listAll.invalidate();
      utils.dashboard.adminMetrics.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Error al limpiar transacciones");
    },
  });

  // ========== EXPORT TO CSV ==========
  const handleExport = () => {
    if (!filteredTransactions.length) {
      toast.error("No hay transacciones para exportar");
      return;
    }

    setExporting(true);
    try {
      const headers = [
        "ID",
        "Usuario",
        "Estación",
        "Energía (kWh)",
        "Duración",
        "Total (COP)",
        "Estado",
        "Fecha inicio",
        "Fecha fin",
      ];

      const statusLabels: Record<string, string> = {
        COMPLETED: "Completada",
        IN_PROGRESS: "En progreso",
        FAILED: "Fallida",
        CANCELLED: "Cancelada",
      };

      const rows = filteredTransactions.map((tx: any) => [
        tx.id,
        tx.userName || "N/A",
        tx.stationName || "N/A",
        parseFloat(tx.kwhConsumed || 0).toFixed(2),
        formatDuration(tx.startTime, tx.endTime),
        typeof tx.totalCost === "string" ? parseFloat(tx.totalCost).toFixed(2) : (tx.totalCost || 0).toFixed(2),
        statusLabels[tx.status] || tx.status,
        tx.startTime ? new Date(tx.startTime).toLocaleString("es-CO") : "-",
        tx.endTime ? new Date(tx.endTime).toLocaleString("es-CO") : "-",
      ]);

      // BOM for Excel UTF-8 compatibility
      const BOM = "\uFEFF";
      const csvContent = BOM + [
        headers.join(","),
        ...rows.map((row: any[]) =>
          row.map((cell: any) => {
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      link.href = url;
      link.download = `EVGreen_Transacciones_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${filteredTransactions.length} transacciones exportadas correctamente`);
    } catch (error) {
      toast.error("Error al exportar transacciones");
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  // Resetear a página 1 cuando cambian los filtros
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDateApply = () => {
    setPage(1);
  };

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const isLoading = metricsLoading || transactionsLoading;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona todas las transacciones de carga de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950 text-xs sm:text-sm"
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Limpiar huérfanas</span>
            <span className="sm:hidden">Limpiar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !filteredTransactions.length}
            className="text-xs sm:text-sm"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1 sm:mr-2" />
            )}
            Exportar
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              {metricsLoading ? (
                <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
              ) : (
                <div className="text-lg sm:text-2xl font-bold">{metrics?.today?.transactions || 0}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground">Hoy</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              {metricsLoading ? (
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
              ) : (
                <div className="text-base sm:text-2xl font-bold truncate">{formatCurrency(metrics?.today?.revenue || 0)}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground">Ingresos hoy</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Battery className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              {metricsLoading ? (
                <Skeleton className="h-6 sm:h-8 w-14 sm:w-20" />
              ) : (
                <div className="text-base sm:text-2xl font-bold truncate">{(metrics?.today?.kwhSold || 0).toFixed(1)} kWh</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground">Energía hoy</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              {metricsLoading ? (
                <Skeleton className="h-6 sm:h-8 w-8 sm:w-12" />
              ) : (
                <div className="text-lg sm:text-2xl font-bold">{metrics?.activeTransactions || 0}</div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground">En progreso</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, estación o ID..."
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
                  <SelectItem value="all">Todos los estados</SelectItem>
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

          {/* Filtro de rango de fechas */}
          {showDateFilters && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleDateApply} className="flex-1 sm:flex-none">
                  Aplicar
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearDates} className="flex-1 sm:flex-none">
                  Limpiar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">ID</TableHead>
              <TableHead className="whitespace-nowrap">Usuario</TableHead>
              <TableHead className="whitespace-nowrap">Estación</TableHead>
              <TableHead className="whitespace-nowrap">Energía</TableHead>
              <TableHead className="whitespace-nowrap">Duración</TableHead>
              <TableHead className="whitespace-nowrap">Total</TableHead>
              <TableHead className="whitespace-nowrap">Estado</TableHead>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead className="whitespace-nowrap w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Cargando transacciones...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx: any) => (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer hover:bg-green-900/10 transition-colors"
                  onClick={() => { setDetailTxId(tx.id); setDetailOpen(true); }}
                >
                  <TableCell className="font-mono text-sm">#{tx.id}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{tx.userName || "Usuario"}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{tx.stationName || "Estación"}</TableCell>
                  <TableCell className="whitespace-nowrap">{parseFloat(tx.kwhConsumed || 0).toFixed(2)} kWh</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDuration(tx.startTime, tx.endTime)}</TableCell>
                  <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(tx.totalCost)}</TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(tx.startTime)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-400 hover:text-green-300 hover:bg-green-900/20 p-1 h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDetailTxId(tx.id); setDetailOpen(true); }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {transactionsLoading ? (
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
          filteredTransactions.map((tx: any) => (
            <Card
              key={tx.id}
              className="p-3 cursor-pointer hover:border-green-700/50 transition-colors"
              onClick={() => { setDetailTxId(tx.id); setDetailOpen(true); }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-semibold">#{tx.id}</span>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tx.status)}
                  <Eye className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="font-medium truncate max-w-[60%] text-right">{tx.userName || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estación</span>
                  <span className="font-medium truncate max-w-[60%] text-right">{tx.stationName || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Energía</span>
                  <span className="font-medium">{parseFloat(tx.kwhConsumed || 0).toFixed(2)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duración</span>
                  <span className="font-medium">{formatDuration(tx.startTime, tx.endTime)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-green-500">{formatCurrency(tx.totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="text-xs text-muted-foreground">{formatDate(tx.startTime)}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Paginación */}
      {!transactionsLoading && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} de {totalCount} transacción{totalCount !== 1 ? "es" : ""}
            {statusFilter !== "all" && ` (filtro: ${statusFilter})`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Anterior</span>
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Pág.</span>
              <span className="font-medium">{page}</span>
              <span className="text-muted-foreground">de</span>
              <span className="font-medium">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <span className="hidden sm:inline mr-1">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Modal de detalle */}
      <TransactionDetailModal
        transactionId={detailTxId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
