import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  MapPin,
  DollarSign,
  TrendingUp,
  Activity,
  Wallet,
} from "lucide-react";
import { InvestorInsights } from "@/components/InvestorInsights";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export default function InvestorDashboard() {
  const { data: stations } = trpc.stations.listOwned.useQuery();
  const { data: metrics, isLoading } = trpc.dashboard.investorMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });
  
  // Obtener el porcentaje del inversionista desde la configuración
  const { data: platformSettings } = trpc.settings.getInvestorPercentage.useQuery();
  const investorPercentage = platformSettings?.investorPercentage ?? 80;
  const platformFeePercentage = platformSettings?.platformFeePercentage ?? 20;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Datos de ejemplo para gráficos (se pueden reemplazar con datos reales)
  const revenueData = [
    { name: "Lun", value: 0 },
    { name: "Mar", value: 0 },
    { name: "Mié", value: 0 },
    { name: "Jue", value: 0 },
    { name: "Vie", value: 0 },
    { name: "Sáb", value: 0 },
    { name: "Dom", value: metrics?.monthlyEarnings || 0 },
  ];

  const energyData = [
    { name: "00:00", kwh: 0 },
    { name: "04:00", kwh: 0 },
    { name: "08:00", kwh: 0 },
    { name: "12:00", kwh: 0 },
    { name: "16:00", kwh: 0 },
    { name: "20:00", kwh: metrics?.monthlyKwh || 0 },
  ];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mi Dashboard</h1>
          <p className="text-muted-foreground">Cargando métricas...</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 sm:p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Dashboard</h1>
        <p className="text-muted-foreground">
          Monitorea el rendimiento de tus estaciones en tiempo real
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Mis ingresos ({investorPercentage}%)</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1 truncate">
                {formatCurrency(metrics?.monthlyEarnings || 0)}
              </h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Este mes</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Energía vendida</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {(metrics?.monthlyKwh || 0).toFixed(1)} kWh
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Este mes</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Estaciones</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {metrics?.onlineStations || 0} / {metrics?.totalStations || 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">En línea</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Sesiones del mes</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">{metrics?.monthlyTransactions || 0}</h3>
              <p className="text-xs text-muted-foreground mt-1">Cargas completadas</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Balance de billetera */}
      <Card className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponible para retiro</p>
            <h2 className="text-3xl font-bold text-primary mt-1">
              {formatCurrency(metrics?.walletBalance || 0)}
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              Total histórico: {formatCurrency(metrics?.totalTransactions || 0)} en {metrics?.totalTransactions || 0} transacciones
            </p>
          </div>
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
        </div>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">Ingresos de la semana</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">Energía vendida (kWh)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="kwh"
                stroke="#22c55e"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Estado de estaciones y cargas activas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <MapPin className="w-4 h-4" />
            Mis estaciones
          </h3>
          {stations?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tienes estaciones registradas
            </div>
          ) : (
            <div className="space-y-3">
              {stations?.slice(0, 5).map((station) => (
                <div
                  key={station.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-muted-foreground">{station.city}</div>
                  </div>
                  <Badge
                    className={
                      station.isOnline
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }
                  >
                    {station.isOnline ? "En línea" : "Fuera de línea"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Resumen de ingresos
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm">Ingresos brutos del mes</span>
              <span className="font-bold text-green-700">
                {formatCurrency(metrics?.monthlyRevenue || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
              <span className="text-sm">Tu parte ({investorPercentage}%)</span>
              <span className="font-bold text-primary">
                {formatCurrency(metrics?.monthlyEarnings || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Fee plataforma ({platformFeePercentage}%)</span>
              <span className="font-medium text-muted-foreground">
                {formatCurrency((metrics?.monthlyRevenue || 0) - (metrics?.monthlyEarnings || 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Insights de IA */}
      <InvestorInsights stationIds={stations?.map(s => s.id)} />
    </div>
  );
}
