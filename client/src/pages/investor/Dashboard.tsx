import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  MapPin,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
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

// Datos de ejemplo para gráficos
const revenueData = [
  { name: "Lun", value: 0 },
  { name: "Mar", value: 0 },
  { name: "Mié", value: 0 },
  { name: "Jue", value: 0 },
  { name: "Vie", value: 0 },
  { name: "Sáb", value: 0 },
  { name: "Dom", value: 0 },
];

const energyData = [
  { name: "00:00", kwh: 0 },
  { name: "04:00", kwh: 0 },
  { name: "08:00", kwh: 0 },
  { name: "12:00", kwh: 0 },
  { name: "16:00", kwh: 0 },
  { name: "20:00", kwh: 0 },
];

export default function InvestorDashboard() {
  const { data: stations } = trpc.stations.listOwned.useQuery();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const onlineStations = stations?.filter((s) => s.isOnline).length || 0;
  const totalStations = stations?.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Dashboard</h1>
        <p className="text-muted-foreground">
          Monitorea el rendimiento de tus estaciones en tiempo real
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mis ingresos (80%)</p>
              <h3 className="text-2xl font-bold mt-1">{formatCurrency(0)}</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                Este mes
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Energía vendida</p>
              <h3 className="text-2xl font-bold mt-1">0 kWh</h3>
              <p className="text-xs text-muted-foreground mt-1">Este mes</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estaciones</p>
              <h3 className="text-2xl font-bold mt-1">
                {onlineStations} / {totalStations}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">En línea</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cargas hoy</p>
              <h3 className="text-2xl font-bold mt-1">0</h3>
              <p className="text-xs text-muted-foreground mt-1">Sesiones</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Ingresos de la semana</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
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

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Consumo de energía hoy</h3>
          <ResponsiveContainer width="100%" height={250}>
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
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
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
            Cargas en progreso
          </h3>
          <div className="text-center py-8 text-muted-foreground">
            No hay cargas activas en este momento
          </div>
        </Card>
      </div>

      {/* Insights de IA */}
      <InvestorInsights stationIds={stations?.map(s => s.id)} />
    </div>
  );
}
