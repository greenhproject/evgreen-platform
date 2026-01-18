import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
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

// Datos de ejemplo para gráficos
const revenueData = [
  { name: "Ene", value: 0 },
  { name: "Feb", value: 0 },
  { name: "Mar", value: 0 },
  { name: "Abr", value: 0 },
  { name: "May", value: 0 },
  { name: "Jun", value: 0 },
];

const energyData = [
  { name: "Lun", kwh: 0 },
  { name: "Mar", kwh: 0 },
  { name: "Mié", kwh: 0 },
  { name: "Jue", kwh: 0 },
  { name: "Vie", kwh: 0 },
  { name: "Sáb", kwh: 0 },
  { name: "Dom", kwh: 0 },
];

export default function AdminDashboard() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la plataforma Green EV
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Ingresos del mes</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1 truncate">{formatCurrency(0)}</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">+0% vs mes anterior</span>
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Energía entregada</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">0 kWh</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">+0% vs mes anterior</span>
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Estaciones activas</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">0 / 0</h3>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                0 en línea ahora
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Usuarios activos</p>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">0</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">+0 esta semana</span>
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
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
              <YAxis />
              <Tooltip />
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

      {/* Estado del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
            <Activity className="w-4 h-4" />
            Estado del sistema
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Servidor CSMS</span>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Operativo
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Reporte UPME</span>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Activo
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
          <div className="text-center py-8 text-muted-foreground">
            No hay cargas activas
          </div>
        </Card>
      </div>
    </div>
  );
}
