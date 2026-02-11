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
  PieChart,
  FileSpreadsheet,
  FileText,
  Loader2,
  Users,
  Battery
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function InvestorReports() {
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("month");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Obtener estaciones del inversionista
  const { data: stations } = trpc.stations.listOwned.useQuery();
  
  // Obtener transacciones del inversionista
  const { data: transactions, isLoading } = trpc.transactions.investorTransactions.useQuery();
  
  // Obtener configuración de porcentajes
  const { data: platformSettings } = trpc.settings.getInvestorPercentage.useQuery();
  const investorPercentage = platformSettings?.investorPercentage ?? 80;
  const platformFeePercentage = platformSettings?.platformFeePercentage ?? 20;

  const exportMutation = trpc.transactions.exportInvestorTransactions.useMutation();

  // Calcular rango de fechas
  const dateFilter = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return { start: weekStart, end: now };
      case "month":
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 1);
        return { start: monthStart, end: now };
      case "quarter":
        const quarterStart = new Date(today);
        quarterStart.setMonth(today.getMonth() - 3);
        return { start: quarterStart, end: now };
      case "year":
        const yearStart = new Date(today);
        yearStart.setFullYear(today.getFullYear() - 1);
        return { start: yearStart, end: now };
      default:
        return { start: new Date(0), end: now };
    }
  }, [dateRange]);

  // Filtrar transacciones por estación y fecha
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.startTime);
      const matchesDate = txDate >= dateFilter.start && txDate <= dateFilter.end;
      const matchesStation = selectedStation === "all" || tx.stationId.toString() === selectedStation;
      return matchesDate && matchesStation && tx.status === "COMPLETED";
    });
  }, [transactions, dateFilter, selectedStation]);

  // Calcular período anterior para comparación
  const previousPeriodTransactions = useMemo(() => {
    if (!transactions) return [];
    const periodLength = dateFilter.end.getTime() - dateFilter.start.getTime();
    const previousStart = new Date(dateFilter.start.getTime() - periodLength);
    const previousEnd = new Date(dateFilter.start.getTime());
    
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.startTime);
      const matchesDate = txDate >= previousStart && txDate < previousEnd;
      const matchesStation = selectedStation === "all" || tx.stationId.toString() === selectedStation;
      return matchesDate && matchesStation && tx.status === "COMPLETED";
    });
  }, [transactions, dateFilter, selectedStation]);

  // Calcular métricas principales
  const metrics = useMemo(() => {
    const totalGross = filteredTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.totalCost || "0"), 0);
    const totalEnergy = filteredTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.kwhConsumed || "0"), 0);
    const totalNet = totalGross * (investorPercentage / 100);
    
    const prevGross = previousPeriodTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.totalCost || "0"), 0);
    const prevEnergy = previousPeriodTransactions.reduce((sum: number, tx: any) => 
      sum + parseFloat(tx.kwhConsumed || "0"), 0);
    
    const growthRevenue = prevGross > 0 ? ((totalGross - prevGross) / prevGross) * 100 : 0;
    const growthEnergy = prevEnergy > 0 ? ((totalEnergy - prevEnergy) / prevEnergy) * 100 : 0;
    
    // Promedio por transacción
    const avgPerTransaction = filteredTransactions.length > 0 
      ? totalGross / filteredTransactions.length : 0;
    
    // Promedio de energía por carga
    const avgEnergyPerCharge = filteredTransactions.length > 0 
      ? totalEnergy / filteredTransactions.length : 0;

    return {
      totalGross,
      totalNet,
      totalEnergy,
      totalTransactions: filteredTransactions.length,
      growthRevenue,
      growthEnergy,
      avgPerTransaction,
      avgEnergyPerCharge,
    };
  }, [filteredTransactions, previousPeriodTransactions, investorPercentage]);

  // Datos para gráfica de tendencia diaria
  const dailyTrendData = useMemo(() => {
    const grouped: Record<string, { date: string; ingresos: number; energia: number; cargas: number }> = {};
    
    filteredTransactions.forEach((tx: any) => {
      const dateKey = new Date(tx.startTime).toLocaleDateString("es-CO", { 
        day: "2-digit", 
        month: "short" 
      });
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, ingresos: 0, energia: 0, cargas: 0 };
      }
      grouped[dateKey].ingresos += parseFloat(tx.totalCost || "0") * (investorPercentage / 100);
      grouped[dateKey].energia += parseFloat(tx.kwhConsumed || "0");
      grouped[dateKey].cargas += 1;
    });
    
    return Object.values(grouped).sort((a, b) => {
      // Ordenar por fecha
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [filteredTransactions, investorPercentage]);

  // Análisis por hora del día (ocupación)
  const hourlyAnalysis = useMemo(() => {
    const hours: Record<number, { hour: number; cargas: number; energia: number }> = {};
    
    for (let i = 0; i < 24; i++) {
      hours[i] = { hour: i, cargas: 0, energia: 0 };
    }
    
    filteredTransactions.forEach((tx: any) => {
      const hour = new Date(tx.startTime).getHours();
      hours[hour].cargas += 1;
      hours[hour].energia += parseFloat(tx.kwhConsumed || "0");
    });
    
    return Object.values(hours).map(h => ({
      ...h,
      label: `${h.hour}:00`,
    }));
  }, [filteredTransactions]);

  // Análisis por día de la semana
  const weekdayAnalysis = useMemo(() => {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weekdays: Record<number, { day: string; cargas: number; ingresos: number }> = {};
    
    for (let i = 0; i < 7; i++) {
      weekdays[i] = { day: days[i], cargas: 0, ingresos: 0 };
    }
    
    filteredTransactions.forEach((tx: any) => {
      const dayOfWeek = new Date(tx.startTime).getDay();
      weekdays[dayOfWeek].cargas += 1;
      weekdays[dayOfWeek].ingresos += parseFloat(tx.totalCost || "0") * (investorPercentage / 100);
    });
    
    return Object.values(weekdays);
  }, [filteredTransactions, investorPercentage]);

  // Rendimiento por estación
  const stationPerformance = useMemo(() => {
    if (!stations) return [];
    
    const stationMap: Record<number, { 
      id: number; 
      name: string; 
      cargas: number; 
      ingresos: number; 
      energia: number 
    }> = {};
    
    stations.forEach((station: any) => {
      stationMap[station.id] = {
        id: station.id,
        name: station.name,
        cargas: 0,
        ingresos: 0,
        energia: 0,
      };
    });
    
    // Solo filtrar por fecha, no por estación seleccionada
    const allTransactionsInPeriod = transactions?.filter((tx: any) => {
      const txDate = new Date(tx.startTime);
      return txDate >= dateFilter.start && txDate <= dateFilter.end && tx.status === "COMPLETED";
    }) || [];
    
    allTransactionsInPeriod.forEach((tx: any) => {
      if (stationMap[tx.stationId]) {
        stationMap[tx.stationId].cargas += 1;
        stationMap[tx.stationId].ingresos += parseFloat(tx.totalCost || "0") * (investorPercentage / 100);
        stationMap[tx.stationId].energia += parseFloat(tx.kwhConsumed || "0");
      }
    });
    
    return Object.values(stationMap).sort((a, b) => b.ingresos - a.ingresos);
  }, [stations, transactions, dateFilter, investorPercentage]);

  // Distribución de ingresos para pie chart
  const revenueDistribution = useMemo(() => {
    return [
      { name: `Tu parte (${investorPercentage}%)`, value: metrics.totalNet },
      { name: `Plataforma (${platformFeePercentage}%)`, value: metrics.totalGross - metrics.totalNet },
    ];
  }, [metrics, investorPercentage, platformFeePercentage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Encontrar hora pico
  const peakHour = useMemo(() => {
    const maxHour = hourlyAnalysis.reduce((max, h) => h.cargas > max.cargas ? h : max, hourlyAnalysis[0]);
    return maxHour;
  }, [hourlyAnalysis]);

  // Encontrar día más activo
  const peakDay = useMemo(() => {
    const maxDay = weekdayAnalysis.reduce((max, d) => d.cargas > max.cargas ? d : max, weekdayAnalysis[0]);
    return maxDay;
  }, [weekdayAnalysis]);

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

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Reportes</h1>
          <p className="text-muted-foreground">
            Análisis detallado de rendimiento de tus estaciones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="w-48">
              <MapPin className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Estación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las estaciones</SelectItem>
              {stations?.map((station: any) => (
                <SelectItem key={station.id} value={station.id.toString()}>
                  {station.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
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
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Exportar Reporte</DialogTitle>
                <DialogDescription>
                  Descarga un reporte completo con todos los análisis.
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
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos netos</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(metrics.totalNet)}</p>
                <p className={`text-xs flex items-center mt-1 ${metrics.growthRevenue >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {metrics.growthRevenue >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {metrics.growthRevenue >= 0 ? "+" : ""}{metrics.growthRevenue.toFixed(1)}%
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
                <p className="text-sm text-muted-foreground">Energía vendida</p>
                <p className="text-2xl font-bold">{metrics.totalEnergy.toFixed(1)} kWh</p>
                <p className={`text-xs flex items-center mt-1 ${metrics.growthEnergy >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {metrics.growthEnergy >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {metrics.growthEnergy >= 0 ? "+" : ""}{metrics.growthEnergy.toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total cargas</p>
                <p className="text-2xl font-bold">{metrics.totalTransactions}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio: {metrics.avgEnergyPerCharge.toFixed(1)} kWh/carga
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Battery className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingreso promedio</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.avgPerTransaction * (investorPercentage / 100))}</p>
                <p className="text-xs text-muted-foreground mt-1">Por transacción</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights de ocupación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hora pico</p>
                <p className="text-xl font-bold">{peakHour?.label || "N/A"}</p>
                <p className="text-xs text-muted-foreground">{peakHour?.cargas || 0} cargas en este horario</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Día más activo</p>
                <p className="text-xl font-bold">{peakDay?.day || "N/A"}</p>
                <p className="text-xs text-muted-foreground">{peakDay?.cargas || 0} cargas promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estaciones activas</p>
                <p className="text-xl font-bold">{stationPerformance.filter(s => s.cargas > 0).length}</p>
                <p className="text-xs text-muted-foreground">de {stations?.length || 0} totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia de ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Tendencia de Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrendData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No hay datos para el período seleccionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="ingresos"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribución por día de la semana */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Cargas por Día de la Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weekdayAnalysis}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === "cargas" ? `${value} cargas` : formatCurrency(value),
                    name === "cargas" ? "Cargas" : "Ingresos"
                  ]}
                />
                <Bar dataKey="cargas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análisis por hora y distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ocupación por hora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Ocupación por Hora del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyAnalysis}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  className="text-xs"
                  interval={2}
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => [`${value} cargas`, "Cargas"]}
                  labelFormatter={(label) => `Hora: ${label}`}
                />
                <Bar dataKey="cargas" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución de ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Distribución de Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={revenueDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rendimiento por estación */}
      {stationPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Rendimiento por Estación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Estación</th>
                    <th className="text-right py-3 px-4 font-medium">Cargas</th>
                    <th className="text-right py-3 px-4 font-medium">Energía (kWh)</th>
                    <th className="text-right py-3 px-4 font-medium">Ingresos Netos</th>
                    <th className="text-right py-3 px-4 font-medium">% del Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stationPerformance.map((station, index) => (
                    <tr key={station.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                            {index + 1}
                          </Badge>
                          {station.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{station.cargas}</td>
                      <td className="py-3 px-4 text-right">{station.energia.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-500">
                        {formatCurrency(station.ingresos)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={station.ingresos === Math.max(...stationPerformance.map(s => s.ingresos)) ? "default" : "secondary"}>
                          {metrics.totalNet > 0 
                            ? ((station.ingresos / metrics.totalNet) * 100).toFixed(1)
                            : 0}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right">{metrics.totalTransactions}</td>
                    <td className="py-3 px-4 text-right">{metrics.totalEnergy.toFixed(1)}</td>
                    <td className="py-3 px-4 text-right text-green-500">{formatCurrency(metrics.totalNet)}</td>
                    <td className="py-3 px-4 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
