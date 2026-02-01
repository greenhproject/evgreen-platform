import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Zap,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Battery,
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
} from "recharts";

export default function AdminDashboard() {
  // Obtener métricas del dashboard
  const { data: metrics, isLoading } = trpc.dashboard.adminMetrics.useQuery(undefined, {
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });
  
  // Obtener transacciones recientes
  const { data: recentTransactions } = trpc.dashboard.recentTransactions.useQuery({ limit: 5 });
  
  // Obtener top estaciones
  const { data: topStations } = trpc.dashboard.topStationsByRevenue.useQuery({ limit: 5 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Datos de ejemplo para gráficos (se pueden reemplazar con datos reales)
  const revenueData = [
    { name: "Ene", value: 0 },
    { name: "Feb", value: 0 },
    { name: "Mar", value: 0 },
    { name: "Abr", value: 0 },
    { name: "May", value: 0 },
    { name: "Jun", value: metrics?.monthly?.revenue || 0 },
  ];

  const energyData = [
    { name: "Lun", kwh: 0 },
    { name: "Mar", kwh: 0 },
    { name: "Mié", kwh: 0 },
    { name: "Jue", kwh: 0 },
    { name: "Vie", kwh: 0 },
    { name: "Sáb", kwh: 0 },
    { name: "Dom", kwh: metrics?.today?.kwhSold || 0 },
  ];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la plataforma EVGreen
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Ingresos del mes</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1 truncate">
                {formatCurrency(metrics?.monthly?.revenue || 0)}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className="truncate">
                  Fee plataforma: {formatCurrency(metrics?.monthly?.platformFees || 0)}
                </span>
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Energía del mes</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {(metrics?.monthly?.kwhSold || 0).toFixed(1)} kWh
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className="truncate">
                  Hoy: {(metrics?.today?.kwhSold || 0).toFixed(1)} kWh
                </span>
              </p>
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
                {metrics?.stations?.online || 0} / {metrics?.stations?.total || 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {metrics?.stations?.online || 0} en línea
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Usuarios</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">{metrics?.users?.total || 0}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className="truncate">Usuarios registrados</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Métricas secundarias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Battery className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sesiones del mes</p>
              <p className="text-lg font-bold">{metrics?.monthly?.transactions || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sesiones hoy</p>
              <p className="text-lg font-bold">{metrics?.today?.transactions || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos hoy</p>
              <p className="text-lg font-bold">{formatCurrency(metrics?.today?.revenue || 0)}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total transacciones</p>
              <p className="text-lg font-bold">{metrics?.totalTransactions || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">Ingresos mensuales</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">Energía semanal (kWh)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tablas de datos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Transacciones recientes */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Activity className="w-4 h-4" />
            Transacciones recientes
          </h3>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((item: any) => (
                <div key={item.transaction.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.transaction.status === 'COMPLETED' ? 'bg-green-100' : 
                      item.transaction.status === 'IN_PROGRESS' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Zap className={`w-4 h-4 ${
                        item.transaction.status === 'COMPLETED' ? 'text-green-600' : 
                        item.transaction.status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.user.name}</p>
                      <p className="text-xs text-muted-foreground">{item.station.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(parseFloat(item.transaction.totalCost || '0'))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(item.transaction.kwhConsumed || '0').toFixed(2)} kWh
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones recientes
            </div>
          )}
        </Card>

        {/* Top estaciones */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <MapPin className="w-4 h-4" />
            Top estaciones por ingresos
          </h3>
          {topStations && topStations.length > 0 ? (
            <div className="space-y-3">
              {topStations.map((station: any, index: number) => (
                <div key={station.stationId} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{station.stationName}</p>
                      <p className="text-xs text-muted-foreground">{station.city}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(station.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.transactionCount} sesiones
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay datos de estaciones
            </div>
          )}
        </Card>
      </div>

      {/* Estado del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Activity className="w-4 h-4" />
            Estado del sistema
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Servidor OCPP</span>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Operativo
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Base de datos</span>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Activa
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pasarela de pagos</span>
              <Badge className="bg-yellow-100 text-yellow-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Pendiente
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <AlertTriangle className="w-4 h-4" />
            Alertas recientes
          </h3>
          <div className="text-center py-8 text-muted-foreground">
            No hay alertas pendientes
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Cargas en progreso
          </h3>
          {metrics?.activeTransactions && metrics.activeTransactions > 0 ? (
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {metrics.activeTransactions}
              </div>
              <p className="text-sm text-muted-foreground">sesiones activas</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay cargas activas
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
