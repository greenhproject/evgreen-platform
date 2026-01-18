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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la plataforma Green EV
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ingresos del mes</p>
              <h3 className="text-2xl font-bold mt-1">{formatCurrency(0)}</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                +0% vs mes anterior
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
              <p className="text-sm text-muted-foreground">Energía entregada</p>
              <h3 className="text-2xl font-bold mt-1">0 kWh</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                +0% vs mes anterior
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estaciones activas</p>
              <h3 className="text-2xl font-bold mt-1">0 / 0</h3>
              <p className="text-xs text-muted-foreground mt-1">
                0 en línea ahora
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Usuarios activos</p>
              <h3 className="text-2xl font-bold mt-1">0</h3>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                +0 esta semana
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Ingresos mensuales</h3>
          <ResponsiveContainer width="100%" height={250}>
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

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Energía semanal (kWh)</h3>
          <ResponsiveContainer width="100%" height={250}>
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
      <div className="grid grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
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

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
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
