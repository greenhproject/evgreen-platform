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
import { Search, Download, Zap, DollarSign, Calendar, FileSpreadsheet, FileText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { saveBlobCrossPlatform } from "@/lib/pdf-download";

export default function InvestorTransactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  // Filtros de fecha
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);

  // Construir input para la query paginada
  const queryInput = useMemo(() => ({
    limit: pageSize,
    page,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate ? new Date(startDate + "T00:00:00") : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
  }), [page, pageSize, statusFilter, startDate, endDate]);

  const { data: paginatedResult, isLoading } = trpc.transactions.investorTransactions.useQuery(queryInput);
  const { data: platformSettings } = trpc.settings.getInvestorPercentage.useQuery();
  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();
  
  const investorPercentage = platformSettings?.investorPercentage ?? 80;

  const transactions = paginatedResult?.data || [];
  const totalPages = paginatedResult?.totalPages || 1;
  const totalCount = paginatedResult?.total || 0;

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

  // Calcular KPIs sobre la página actual (los totales globales vendrán del server)
  const pageRevenue = transactions.reduce((sum: number, t: any) => {
    if (t.status === "COMPLETED") {
      return sum + parseFloat(t.totalCost || "0");
    }
    return sum;
  }, 0);

  const myShare = pageRevenue * (investorPercentage / 100);
  const pageEnergy = transactions.reduce((sum: number, t: any) => {
    if (t.status === "COMPLETED") {
      return sum + parseFloat(t.kwhConsumed || "0");
    }
    return sum;
  }, 0);

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

  // Filtro de búsqueda local sobre resultados paginados
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter((tx: any) => {
      return tx.id.toString().includes(searchQuery) ||
        tx.stationId.toString().includes(searchQuery);
    });
  }, [transactions, searchQuery]);

  // Resetear a página 1 cuando cambian los filtros
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleClearDates = () => {
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de cargas en tus estaciones
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
                {isExporting ? (
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                ) : (
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                )}
                <span className="font-medium">Excel (.xlsx)</span>
                <span className="text-xs text-muted-foreground">Ideal para análisis y filtros</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-red-50 hover:border-red-500 dark:hover:bg-red-950 dark:hover:border-red-700"
                onClick={() => handleExport("pdf")}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                ) : (
                  <FileText className="w-8 h-8 text-red-600" />
                )}
                <span className="font-medium">PDF</span>
                <span className="text-xs text-muted-foreground">Ideal para impresión y archivo</span>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              El reporte incluye todas las transacciones con el logo de EVGreen
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate">{formatCurrency(myShare)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Mis ingresos ({investorPercentage}%)</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate">{formatCurrency(pageRevenue)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Ingresos brutos</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-2xl font-bold truncate">{pageEnergy.toFixed(1)} kWh</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Energía vendida</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg sm:text-2xl font-bold">{totalCount}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total cargas</div>
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

          {/* Filtro de rango de fechas */}
          {showDateFilters && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="text-sm"
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleClearDates} className="flex-shrink-0">
                Limpiar
              </Button>
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
              <TableHead className="whitespace-nowrap">Estación</TableHead>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead className="whitespace-nowrap">Energía</TableHead>
              <TableHead className="whitespace-nowrap">Monto bruto</TableHead>
              <TableHead className="whitespace-nowrap">Mi parte ({investorPercentage}%)</TableHead>
              <TableHead className="whitespace-nowrap">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Cargando transacciones...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay transacciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-sm">#{tx.id}</TableCell>
                  <TableCell className="max-w-[150px] truncate">ID: {tx.stationId}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(tx.startTime)}</TableCell>
                  <TableCell className="whitespace-nowrap">{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(tx.totalCost || 0)}</TableCell>
                  <TableCell className="text-green-500 font-medium whitespace-nowrap">
                    {formatCurrency(parseFloat(tx.totalCost || "0") * (investorPercentage / 100))}
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
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
          filteredTransactions.map((tx: any) => (
            <Card key={tx.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-semibold">#{tx.id}</span>
                {getStatusBadge(tx.status)}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estación</span>
                  <span className="font-medium">ID: {tx.stationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Energía</span>
                  <span className="font-medium">{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto bruto</span>
                  <span className="font-medium">{formatCurrency(tx.totalCost || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">Mi parte ({investorPercentage}%)</span>
                  <span className="font-bold text-green-500">
                    {formatCurrency(parseFloat(tx.totalCost || "0") * (investorPercentage / 100))}
                  </span>
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
      {!isLoading && totalCount > 0 && (
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
    </div>
  );
}
