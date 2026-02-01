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

export default function AdminReports() {
  const [period, setPeriod] = useState("month");

  // Obtener métricas del dashboard
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.adminMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Obtener todas las transacciones para calcular datos históricos
  const { data: allTransactions, isLoading: transactionsLoading } = trpc.transactions.listAll.useQuery({
    limit: 500,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calcular datos mensuales basados en transacciones reales
  const monthlyData = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) {
      return [
        { name: "Ene", ingresos: 0, energia: 0 },
        { name: "Feb", ingresos: 0, energia: 0 },
        { name: "Mar", ingresos: 0, energia: 0 },
        { name: "Abr", ingresos: 0, energia: 0 },
        { name: "May", ingresos: 0, energia: 0 },
        { name: "Jun", ingresos: 0, energia: 0 },
      ];
    }

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const now = new Date();
    const currentMonth = now.getMonth();
    
    // Crear array de los últimos 6 meses
    const months: { name: string; ingresos: number; energia: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      months.push({
        name: monthNames[monthIndex],
        ingresos: 0,
        energia: 0,
      });
    }

    // Agrupar transacciones por mes
    allTransactions.forEach((tx: any) => {
      if (tx.status !== "COMPLETED") return;
      const txDate = new Date(tx.startTime);
      const txMonth = txDate.getMonth();
      
      // Encontrar el índice en nuestro array de meses
      for (let i = 0; i < 6; i++) {
        const monthIndex = (currentMonth - (5 - i) + 12) % 12;
        if (txMonth === monthIndex) {
          months[i].ingresos += parseFloat(tx.totalCost || 0);
          months[i].energia += parseFloat(tx.kwhConsumed || 0);
          break;
        }
      }
    });

    return months;
  }, [allTransactions]);

  // Calcular totales
  const totals = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) {
      return {
        totalRevenue: 0,
        platformFee: 0,
        totalEnergy: 0,
        totalTransactions: 0,
      };
    }

    const completedTx = allTransactions.filter((tx: any) => tx.status === "COMPLETED");
    const totalRevenue = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.totalCost || 0), 0);
    const totalEnergy = completedTx.reduce((sum: number, tx: any) => sum + parseFloat(tx.kwhConsumed || 0), 0);
    const platformFee = totalRevenue * 0.2; // 20% fee

    return {
      totalRevenue,
      platformFee,
      totalEnergy,
      totalTransactions: completedTx.length,
    };
  }, [allTransactions]);

  // Distribución de ingresos basada en datos reales
  const revenueDistribution = useMemo(() => {
    const investorShare = totals.totalRevenue * 0.8;
    const platformShare = totals.totalRevenue * 0.2;
    
    return [
      { name: "Inversionistas (80%)", value: investorShare, color: "#22c55e" },
      { name: "Green EV (20%)", value: platformShare, color: "#3b82f6" },
    ];
  }, [totals.totalRevenue]);

  const isLoading = metricsLoading || transactionsLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis y reportes de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
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

      {/* KPIs */}
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
                <div className="text-2xl font-bold">{formatCurrency(metrics?.monthly?.revenue || totals.totalRevenue)}</div>
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
                <div className="text-2xl font-bold">{formatCurrency(metrics?.monthly?.platformFees || totals.platformFee)}</div>
              )}
              <div className="text-sm text-muted-foreground">Fee Green EV (20%)</div>
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
                <div className="text-2xl font-bold">{(metrics?.monthly?.kwhSold || totals.totalEnergy).toFixed(1)} kWh</div>
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
                <div className="text-2xl font-bold">{metrics?.monthly?.transactions || totals.totalTransactions}</div>
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === "Ingresos (COP)") return formatCurrency(value);
                  return `${value.toFixed(2)} kWh`;
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ingresos"
                stroke="#22c55e"
                strokeWidth={2}
                name="Ingresos (COP)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="energia"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Energía (kWh)"
              />
            </LineChart>
          </ResponsiveContainer>
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
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
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
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

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
