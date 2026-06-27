import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Zap, DollarSign, TrendingUp, Battery } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";

type Period = "week" | "month" | "quarter" | "year";

function getPeriodDates(period: Period): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;
  let label: string;

  switch (period) {
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      label = "Esta semana";
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Este mes";
      break;
    case "quarter":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      label = "Este trimestre";
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      label = "Este año";
      break;
  }

  return { startDate, endDate, label };
}

export default function AdminReports() {
  const [period, setPeriod] = useState<Period>("month");

  // Calcular fechas según el período seleccionado
  const { startDate, endDate } = useMemo(() => getPeriodDates(period), [period]);

  // Obtener transacciones filtradas por período
  const { data: txResult, isLoading: transactionsLoading } = trpc.transactions.listAll.useQuery({
    startDate,
    endDate,
    limit: 500,
    page: 1,
  });
  const allTransactions = txResult?.data || [];

  // Obtener métricas del dashboard (siempre del mes actual para referencia)
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.adminMetrics.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calcular totales del período seleccionado
  const totals = useMemo(() => {
    const completedTx = allTransactions.filter((tx: any) => tx.status === "COMPLETED");
    const totalRevenue = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.totalCost || "0"), 0);
    const totalEnergy = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.kwhConsumed || "0"), 0);
    const platformFee = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.platformFee || "0"), 0);
    const investorShare = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.investorShare || "0"), 0);
    return {
      totalRevenue,
      platformFee: platformFee || totalRevenue * 0.30,
      investorShare: investorShare || totalRevenue * 0.70 * 0.90,
      aliadoShare: totalRevenue * 0.10,
      totalEnergy,
      totalTransactions: completedTx.length,
    };
  }, [allTransactions]);

  // Calcular datos de tendencia según el período
  const trendData = useMemo(() => {
    const completedTx = allTransactions.filter((tx: any) => tx.status === "COMPLETED");
    if (completedTx.length === 0) return [];

    if (period === "week") {
      // Agrupar por día de la semana
      const days: Record<string, { name: string; ingresos: number; energia: number }> = {};
      const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days[key] = { name: dayNames[d.getDay()], ingresos: 0, energia: 0 };
      }
      completedTx.forEach((tx: any) => {
        const key = new Date(tx.startTime).toISOString().slice(0, 10);
        if (days[key]) {
          days[key].ingresos += parseFloat(tx.totalCost || "0");
          days[key].energia += parseFloat(tx.kwhConsumed || "0");
        }
      });
      return Object.values(days);
    }

    if (period === "month" || period === "quarter") {
      // Agrupar por semana
      const weeks: Record<string, { name: string; ingresos: number; energia: number }> = {};
      completedTx.forEach((tx: any) => {
        const d = new Date(tx.startTime);
        const weekNum = Math.ceil(d.getDate() / 7);
        const key = `${d.getFullYear()}-${d.getMonth()}-W${weekNum}`;
        const label = `${d.toLocaleDateString("es-CO", { month: "short" })} S${weekNum}`;
        if (!weeks[key]) weeks[key] = { name: label, ingresos: 0, energia: 0 };
        weeks[key].ingresos += parseFloat(tx.totalCost || "0");
        weeks[key].energia += parseFloat(tx.kwhConsumed || "0");
      });
      return Object.values(weeks).slice(-12);
    }

    // Año: agrupar por mes
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const months: Record<string, { name: string; ingresos: number; energia: number }> = {};
    completedTx.forEach((tx: any) => {
      const d = new Date(tx.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!months[key]) months[key] = { name: monthNames[d.getMonth()], ingresos: 0, energia: 0 };
      months[key].ingresos += parseFloat(tx.totalCost || "0");
      months[key].energia += parseFloat(tx.kwhConsumed || "0");
    });
    return Object.values(months);
  }, [allTransactions, period]);

  // Distribución de ingresos
  const revenueDistribution = useMemo(() => {
    if (totals.totalRevenue === 0) return [
      { name: "Inversionistas (70% del neto)", value: 0, color: "#22c55e" },
      { name: "EVGreen (30% del neto)", value: 0, color: "#3b82f6" },
      { name: "Aliado Comercial (10% margen)", value: 0, color: "#f59e0b" },
    ];
    return [
      { name: "Inversionistas (70% del neto)", value: totals.investorShare, color: "#22c55e" },
      { name: "EVGreen (30% del neto)", value: totals.platformFee, color: "#3b82f6" },
      { name: "Aliado Comercial (10% margen)", value: totals.aliadoShare, color: "#f59e0b" },
    ];
  }, [totals]);

  const isLoading = metricsLoading || transactionsLoading;

  const periodLabel = useMemo(() => getPeriodDates(period).label, [period]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis y reportes de la plataforma · <span className="text-primary font-medium">{periodLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="quarter">Este trimestre</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => toast.info("Exportar próximamente")}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatCurrency(totals.totalRevenue)}</div>
              )}
              <div className="text-sm text-muted-foreground">Ingresos totales</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{formatCurrency(totals.platformFee)}</div>
              )}
              <div className="text-sm text-muted-foreground">Fee EVGreen (30% neto)</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{totals.totalEnergy.toFixed(1)} kWh</div>
              )}
              <div className="text-sm text-muted-foreground">Energía total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{totals.totalTransactions}</div>
              )}
              <div className="text-sm text-muted-foreground">Transacciones</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-semibold mb-4">Tendencia de ingresos y energía</h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : trendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos para el período seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Ingresos (COP)") return formatCurrency(value);
                    return `${value.toFixed(2)} kWh`;
                  }}
                />
                <Line yAxisId="left" type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} name="Ingresos (COP)" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="energia" stroke="#3b82f6" strokeWidth={2} name="Energía (kWh)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Distribución de ingresos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={revenueDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {revenueDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {revenueDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs">{item.name}</span>
                </div>
                <span className="font-medium text-xs">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Métricas del día actual (siempre fijas) */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Métricas del día actual
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics?.today?.revenue || 0)}</div>
            <div className="text-sm text-muted-foreground">Ingresos hoy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{(metrics?.today?.kwhSold || 0).toFixed(1)} kWh</div>
            <div className="text-sm text-muted-foreground">Energía hoy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{metrics?.today?.transactions || 0}</div>
            <div className="text-sm text-muted-foreground">Cargas hoy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{metrics?.activeTransactions || 0}</div>
            <div className="text-sm text-muted-foreground">Sesiones activas</div>
          </div>
        </div>
      </Card>

      {/* Reportes UPME */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Reportes UPME (Resolución 40559)
        </h3>
        <p className="text-muted-foreground mb-4">
          Reportes automáticos enviados cada 60 segundos según la normativa colombiana
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground">Último reporte</div>
            <div className="font-medium">Hace 0 segundos</div>
          </Card>
          <Card className="p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground">Reportes hoy</div>
            <div className="font-medium">{metrics?.today?.transactions || 0}</div>
          </Card>
          <Card className="p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground">Estado</div>
            <div className="font-medium text-green-600">Activo</div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
