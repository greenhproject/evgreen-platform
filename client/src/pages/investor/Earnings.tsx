import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Percent
} from "lucide-react";

interface EarningRecord {
  id: number;
  date: Date;
  stationName: string;
  energyKwh: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  transactions: number;
}

// Datos de ejemplo
const mockEarnings: EarningRecord[] = [
  {
    id: 1,
    date: new Date(2026, 0, 17),
    stationName: "Green EV Mosquera",
    energyKwh: 245.5,
    grossAmount: 294600,
    commission: 58920,
    netAmount: 235680,
    transactions: 12,
  },
  {
    id: 2,
    date: new Date(2026, 0, 16),
    stationName: "Green EV Mosquera",
    energyKwh: 312.8,
    grossAmount: 375360,
    commission: 75072,
    netAmount: 300288,
    transactions: 15,
  },
  {
    id: 3,
    date: new Date(2026, 0, 15),
    stationName: "Green EV Mosquera",
    energyKwh: 198.2,
    grossAmount: 237840,
    commission: 47568,
    netAmount: 190272,
    transactions: 9,
  },
  {
    id: 4,
    date: new Date(2026, 0, 14),
    stationName: "Green EV Mosquera",
    energyKwh: 278.9,
    grossAmount: 334680,
    commission: 66936,
    netAmount: 267744,
    transactions: 14,
  },
];

export default function InvestorEarnings() {
  const [period, setPeriod] = useState("week");
  const [earnings] = useState<EarningRecord[]>(mockEarnings);

  const totalGross = earnings.reduce((sum, e) => sum + e.grossAmount, 0);
  const totalNet = earnings.reduce((sum, e) => sum + e.netAmount, 0);
  const totalCommission = earnings.reduce((sum, e) => sum + e.commission, 0);
  const totalEnergy = earnings.reduce((sum, e) => sum + e.energyKwh, 0);
  const totalTransactions = earnings.reduce((sum, e) => sum + e.transactions, 0);

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
          <h1 className="text-2xl font-bold">Mis Ingresos</h1>
          <p className="text-muted-foreground">
            Detalle de ingresos por estaciones de carga
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Resumen de ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos netos</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(totalNet)}</p>
                <p className="text-xs text-green-500 flex items-center mt-1">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +12% vs periodo anterior
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos brutos</p>
                <p className="text-2xl font-bold">{formatCurrency(totalGross)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Antes de comisiones
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comisión plataforma</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCommission)}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <Percent className="w-3 h-3 mr-1" />
                  20% del bruto
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Percent className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Energía vendida</p>
                <p className="text-2xl font-bold">{totalEnergy.toFixed(1)} kWh</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalTransactions} transacciones
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarifa dinámica actual */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            Tarifa Dinámica Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Precio base por kWh</p>
              <p className="text-2xl font-bold">$1,200 COP</p>
              <p className="text-xs text-muted-foreground">Tarifa configurada</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Multiplicador actual</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-green-500">0.95x</p>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Demanda baja
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Basado en ocupación y horario</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Precio efectivo</p>
              <p className="text-2xl font-bold">$1,140 COP/kWh</p>
              <p className="text-xs text-muted-foreground">Tu ganancia: $912 COP/kWh (80%)</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-background/50 rounded-lg">
            <p className="text-sm">
              <strong>¿Cómo funciona?</strong> El precio del kWh se ajusta automáticamente según la demanda, 
              ocupación de la zona y horario. Esto optimiza tus ingresos y atrae más usuarios en horas valle.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de ingresos diarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Detalle de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium">Estación</th>
                  <th className="text-right py-3 px-4 font-medium">Energía</th>
                  <th className="text-right py-3 px-4 font-medium">Transacciones</th>
                  <th className="text-right py-3 px-4 font-medium">Bruto</th>
                  <th className="text-right py-3 px-4 font-medium">Comisión</th>
                  <th className="text-right py-3 px-4 font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map(record => (
                  <tr key={record.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {new Date(record.date).toLocaleDateString("es-CO", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">{record.stationName}</td>
                    <td className="py-3 px-4 text-right">{record.energyKwh.toFixed(1)} kWh</td>
                    <td className="py-3 px-4 text-right">{record.transactions}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(record.grossAmount)}</td>
                    <td className="py-3 px-4 text-right text-orange-500">
                      -{formatCurrency(record.commission)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-green-500">
                      {formatCurrency(record.netAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-3 px-4" colSpan={2}>Total</td>
                  <td className="py-3 px-4 text-right">{totalEnergy.toFixed(1)} kWh</td>
                  <td className="py-3 px-4 text-right">{totalTransactions}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totalGross)}</td>
                  <td className="py-3 px-4 text-right text-orange-500">
                    -{formatCurrency(totalCommission)}
                  </td>
                  <td className="py-3 px-4 text-right text-green-500">
                    {formatCurrency(totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Información sobre comisiones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Estructura de Comisiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Tu participación (80%)</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Ingresos por venta de energía
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Beneficio de tarifa dinámica
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Tarifa de conexión
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Comisión plataforma (20%)</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  Procesamiento de pagos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  Soporte técnico 24/7
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  Mantenimiento de plataforma
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
