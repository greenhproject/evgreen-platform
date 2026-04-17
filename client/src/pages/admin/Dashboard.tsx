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
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  // Datos reales de gráficos desde el backend
  const revenueData = useMemo(() => {
    if (metrics?.revenueChart && metrics.revenueChart.length > 0) {
      return metrics.revenueChart;
    }
    // Fallback: si no hay datos, mostrar meses vacíos
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    return monthNames.map((name) => ({ name, value: 0 }));
  }, [metrics?.revenueChart]);

  const energyData = useMemo(() => {
    if (metrics?.energyChart && metrics.energyChart.length > 0) {
      return metrics.energyChart;
    }
    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    return dayNames.map((name) => ({ name, kwh: 0 }));
  }, [metrics?.energyChart]);

  // Datos de tendencia de usuarios
  const usersData = useMemo(() => {
    if (metrics?.usersChart && metrics.usersChart.length > 0) {
      return metrics.usersChart;
    }
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    return monthNames.map((name) => ({ name, users: 0 }));
  }, [metrics?.usersChart]);

  // Datos de distribución por estación
  const stationDistData = useMemo(() => {
    if (metrics?.stationDistribution && metrics.stationDistribution.length > 0) {
      return metrics.stationDistribution;
    }
    return [];
  }, [metrics?.stationDistribution]);

  // Colores para el pie chart
  const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#14b8a6"];

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
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(value) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                return `$${value}`;
              }} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                labelFormatter={(label) => `Mes: ${label}`}
                contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#22c55e', fontWeight: 'bold' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base">Energía semanal (kWh)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(value) => `${value.toFixed(1)}`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Energía"]}
                labelFormatter={(label) => `Día: ${label}`}
                contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
              />
              <Bar dataKey="kwh" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Gráficas adicionales: Tendencia de usuarios + Distribución por estación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Tendencia de usuarios
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={usersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis allowDecimals={false} stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [`${value} usuarios`, "Registros"]}
                labelFormatter={(label) => `Mes: ${label}`}
                contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
              />
              <defs>
                <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="users"
                stroke="#8b5cf6"
                strokeWidth={3}
                fill="url(#usersGradient)"
                dot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 text-sm sm:text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Distribución de ingresos por estación
          </h3>
          {stationDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stationDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name.length > 15 ? name.slice(0, 15) + '...' : name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#a1a1aa' }}
                >
                  {stationDistData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                  contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No hay datos de distribución
            </div>
          )}
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
                      <p className="text-sm font-medium">{item.user?.name || 'Usuario'}</p>
                      <p className="text-xs text-muted-foreground">{item.station?.name || 'Estación'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(Number(item.transaction.totalCost) || 0)}</p>
                    <Badge variant={
                      item.transaction.status === 'COMPLETED' ? 'default' : 
                      item.transaction.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                    } className="text-xs">
                      {item.transaction.status === 'COMPLETED' ? 'Completada' : 
                       item.transaction.status === 'IN_PROGRESS' ? 'En curso' : item.transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No hay transacciones recientes</p>
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
                <div key={station.id || index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{station.name || 'Estación'}</p>
                      <p className="text-xs text-muted-foreground">{station.city || station.address || ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(Number(station.totalRevenue) || 0)}</p>
                    <p className="text-xs text-muted-foreground">{station.totalTransactions || 0} sesiones</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No hay datos de estaciones</p>
          )}
        </Card>
      </div>
    </div>
  );
}
