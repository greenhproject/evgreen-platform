import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, TrendingUp, Zap, DollarSign } from "lucide-react";
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

const monthlyData = [
  { name: "Ene", ingresos: 0, energia: 0 },
  { name: "Feb", ingresos: 0, energia: 0 },
  { name: "Mar", ingresos: 0, energia: 0 },
  { name: "Abr", ingresos: 0, energia: 0 },
  { name: "May", ingresos: 0, energia: 0 },
  { name: "Jun", ingresos: 0, energia: 0 },
];

const revenueDistribution = [
  { name: "Inversionistas (80%)", value: 80, color: "#22c55e" },
  { name: "Green EV (20%)", value: 20, color: "#3b82f6" },
];

export default function AdminReports() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
          <Select defaultValue="month">
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
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(0)}</div>
              <div className="text-sm text-muted-foreground">Ingresos totales</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(0)}</div>
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
              <div className="text-2xl font-bold">0 kWh</div>
              <div className="text-sm text-muted-foreground">Energía total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Transacciones</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2 p-6">
          <h3 className="font-semibold mb-4">Tendencia de ingresos y energía</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
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
                label
              >
                {revenueDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {revenueDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
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
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground">Último reporte</div>
            <div className="font-medium">Hace 0 segundos</div>
          </Card>
          <Card className="p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground">Reportes hoy</div>
            <div className="font-medium">0</div>
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
