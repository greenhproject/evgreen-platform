import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Percent,
  FileSpreadsheet,
  FileText,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function InvestorEarnings() {
  const [period, setPeriod] = useState("month");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Obtener transacciones reales del inversionista
  const { data: transactions, isLoading } = trpc.transactions.investorTransactions.useQuery();
  
  // Obtener el porcentaje del inversionista desde la configuración
  const { data: platformSettings } = trpc.settings.getInvestorPercentage.useQuery();
  const investorPercentage = platformSettings?.investorPercentage ?? 80;
  const platformFeePercentage = platformSettings?.platformFeePercentage ?? 20;

  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();

  // Calcular fechas según el período seleccionado
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case "today":
        return { start: today, end: now };
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return { start: weekStart, end: now };
      case "month":
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 1);
        return { start: monthStart, end: now };
      case "year":
        const yearStart = new Date(today);
        yearStart.setFullYear(today.getFullYear() - 1);
        return { start: yearStart, end: now };
      default:
        return { start: new Date(0), end: now };
    }
  }, [period]);

  // Filtrar transacciones por período
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.startTime);
      return txDate >= dateRange.start && txDate <= dateRange.end && tx.status === "COMPLETED";
    });
  }, [transactions, dateRange]);

  // Calcular período anterior para comparación
  const previousPeriodTransactions = useMemo(() => {
    if (!transactions) return [];
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const previousStart = new Date(dateRange.start.getTime() - periodLength);
    const previousEnd = new Date(dateRange.start.getTime());
    
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.startTime);
      return txDate >= previousStart && txDate < previousEnd && tx.status === "COMPLETED";
    });
  }, [transactions, dateRange]);

  // Calcular totales del período actual
  const totals = useMemo(() => {
    const totalGross = filteredTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.totalCost || "0"), 0);
    const totalEnergy = filteredTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.kwhConsumed || "0"), 0);
    const totalNet = totalGross * (investorPercentage / 100);
    const totalCommission = totalGross * (platformFeePercentage / 100);
    
    return {
      gross: totalGross,
      net: totalNet,
      commission: totalCommission,
      energy: totalEnergy,
      transactions: filteredTransactions.length,
    };
  }, [filteredTransactions, investorPercentage, platformFeePercentage]);

  // Calcular totales del período anterior para comparación
  const previousTotals = useMemo(() => {
    const totalGross = previousPeriodTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.totalCost || "0"), 0);
    const totalNet = totalGross * (investorPercentage / 100);
    
    return {
      gross: totalGross,
      net: totalNet,
    };
  }, [previousPeriodTransactions, investorPercentage]);

  // Calcular porcentaje de cambio
  const percentageChange = useMemo(() => {
    if (previousTotals.net === 0) return totals.net > 0 ? 100 : 0;
    return ((totals.net - previousTotals.net) / previousTotals.net) * 100;
  }, [totals.net, previousTotals.net]);

  // Agrupar transacciones por día
  const dailyEarnings = useMemo(() => {
    const grouped: Record<string, {
      date: Date;
      stationIds: Set<number>;
      energy: number;
      gross: number;
      transactions: number;
    }> = {};

    filteredTransactions.forEach((tx: any) => {
      const dateKey = new Date(tx.startTime).toISOString().split("T")[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: new Date(tx.startTime),
          stationIds: new Set(),
          energy: 0,
          gross: 0,
          transactions: 0,
        };
      }
      grouped[dateKey].stationIds.add(tx.stationId);
      grouped[dateKey].energy += parseFloat(tx.kwhConsumed || "0");
      grouped[dateKey].gross += parseFloat(tx.totalCost || "0");
      grouped[dateKey].transactions += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((day, index) => ({
        id: index + 1,
        date: day.date,
        stationCount: day.stationIds.size,
        energyKwh: day.energy,
        grossAmount: day.gross,
        commission: day.gross * (platformFeePercentage / 100),
        netAmount: day.gross * (investorPercentage / 100),
        transactions: day.transactions,
      }));
  }, [filteredTransactions, investorPercentage, platformFeePercentage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Función para descargar el archivo
  const downloadFile = (base64: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Función para exportar
  const handleExport = async (format: "excel" | "pdf") => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ format });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Ingresos</h1>
          <p className="text-muted-foreground">
            Detalle de ingresos por estaciones de carga
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
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-red-50 hover:border-red-500"
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
      </div>

      {/* Resumen de ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos netos</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(totals.net)}</p>
                <p className={`text-xs flex items-center mt-1 ${percentageChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {percentageChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                  )}
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
                <p className="text-2xl font-bold">{formatCurrency(totals.gross)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Antes de comisiones
                </p>
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
                <p className="text-sm text-muted-foreground">Comisión plataforma</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.commission)}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <Percent className="w-3 h-3 mr-1" />
                  {platformFeePercentage}% del bruto
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Percent className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Energía vendida</p>
                <p className="text-2xl font-bold">{totals.energy.toFixed(1)} kWh</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.transactions} transacciones
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información del porcentaje */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            Distribución de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tu participación</p>
              <p className="text-2xl font-bold text-green-500">{investorPercentage}%</p>
              <p className="text-xs text-muted-foreground">De cada transacción</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Comisión plataforma</p>
              <p className="text-2xl font-bold text-orange-500">{platformFeePercentage}%</p>
              <p className="text-xs text-muted-foreground">Operación y mantenimiento</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Promedio por transacción</p>
              <p className="text-2xl font-bold">
                {totals.transactions > 0 
                  ? formatCurrency(totals.net / totals.transactions)
                  : "$0"}
              </p>
              <p className="text-xs text-muted-foreground">Ingreso neto promedio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de ingresos diarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Detalle de Ingresos - {getPeriodLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyEarnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones completadas en este período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Fecha</th>
                    <th className="text-right py-3 px-4 font-medium">Estaciones</th>
                    <th className="text-right py-3 px-4 font-medium">Energía</th>
                    <th className="text-right py-3 px-4 font-medium">Transacciones</th>
                    <th className="text-right py-3 px-4 font-medium">Bruto</th>
                    <th className="text-right py-3 px-4 font-medium">Comisión</th>
                    <th className="text-right py-3 px-4 font-medium">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyEarnings.map(record => (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {new Date(record.date).toLocaleDateString("es-CO", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{record.stationCount}</td>
                      <td className="py-3 px-4 text-right">{record.energyKwh.toFixed(1)} kWh</td>
                      <td className="py-3 px-4 text-right">{record.transactions}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(record.grossAmount)}</td>
                      <td className="py-3 px-4 text-right text-orange-500">
                        -{formatCurrency(record.commission)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-500">
                        {formatCurrency(record.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right">-</td>
                    <td className="py-3 px-4 text-right">{totals.energy.toFixed(1)} kWh</td>
                    <td className="py-3 px-4 text-right">{totals.transactions}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(totals.gross)}</td>
                    <td className="py-3 px-4 text-right text-orange-500">
                      -{formatCurrency(totals.commission)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-500">
                      {formatCurrency(totals.net)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
