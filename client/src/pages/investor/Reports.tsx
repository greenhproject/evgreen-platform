import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, TrendingUp, Zap, DollarSign, FileText } from "lucide-react";
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
import { toast } from "sonner";

const monthlyData = [
  { name: "Ene", ingresos: 0, energia: 0 },
  { name: "Feb", ingresos: 0, energia: 0 },
  { name: "Mar", ingresos: 0, energia: 0 },
  { name: "Abr", ingresos: 0, energia: 0 },
  { name: "May", ingresos: 0, energia: 0 },
  { name: "Jun", ingresos: 0, energia: 0 },
];

export default function InvestorReports() {
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
          <h1 className="text-2xl font-bold">Mis Reportes</h1>
          <p className="text-muted-foreground">
            Análisis detallado de tus estaciones
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
              <div className="text-sm text-muted-foreground">Mis ingresos (80%)</div>
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
              <div className="text-sm text-muted-foreground">Energía vendida</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Cargas realizadas</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-muted-foreground">Crecimiento</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Ingresos mensuales</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="ingresos"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Energía vendida (kWh)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="energia" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Resumen de distribución */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Distribución de ingresos</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">Ingresos brutos</div>
            <div className="text-xl font-bold">{formatCurrency(0)}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600">Tu parte (80%)</div>
            <div className="text-xl font-bold text-green-700">{formatCurrency(0)}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Fee Green EV (20%)</div>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(0)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
