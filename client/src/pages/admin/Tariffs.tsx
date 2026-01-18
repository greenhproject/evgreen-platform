import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Zap,
  Settings,
  Info,
  Edit,
  Trash2,
  Activity,
  Calendar,
  Users,
  MapPin
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DynamicPricingConfig {
  enabled: boolean;
  basePrice: number;
  minMultiplier: number;
  maxMultiplier: number;
  occupancyWeight: number;
  timeWeight: number;
  dayWeight: number;
  demandWeight: number;
}

export default function AdminTariffs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dynamicConfig, setDynamicConfig] = useState<DynamicPricingConfig>({
    enabled: true,
    basePrice: 1200,
    minMultiplier: 0.8,
    maxMultiplier: 1.5,
    occupancyWeight: 40,
    timeWeight: 30,
    dayWeight: 15,
    demandWeight: 15,
  });

  // Obtener estaciones para mostrar tarifas
  const { data: stations } = trpc.stations.listPublic.useQuery({});

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Calcular precio dinámico actual (simulación)
  const currentHour = new Date().getHours();
  const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 20);
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  
  let currentMultiplier = 1.0;
  if (isRushHour && !isWeekend) currentMultiplier = 1.25;
  else if (isWeekend) currentMultiplier = 0.9;
  else if (currentHour >= 22 || currentHour < 6) currentMultiplier = 0.85;

  const currentPrice = Math.round(dynamicConfig.basePrice * currentMultiplier);

  const handleSaveConfig = () => {
    toast.success("Configuración de tarifa dinámica guardada");
    setIsDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Tarifas</h1>
          <p className="text-muted-foreground">
            Configura tarifas base y parámetros de pricing dinámico
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Settings className="w-4 h-4 mr-2" />
              Configurar Tarifa Dinámica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configuración de Tarifa Dinámica</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Estado de tarifa dinámica */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Tarifa Dinámica</p>
                    <p className="text-sm text-muted-foreground">
                      Ajusta precios automáticamente según demanda
                    </p>
                  </div>
                </div>
                <Switch
                  checked={dynamicConfig.enabled}
                  onCheckedChange={(checked) =>
                    setDynamicConfig({ ...dynamicConfig, enabled: checked })
                  }
                />
              </div>

              {/* Precio base */}
              <div className="space-y-2">
                <Label>Precio base por kWh</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={dynamicConfig.basePrice}
                    onChange={(e) =>
                      setDynamicConfig({
                        ...dynamicConfig,
                        basePrice: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-32"
                  />
                  <span className="text-muted-foreground">COP</span>
                </div>
              </div>

              {/* Rango de multiplicadores */}
              <div className="space-y-4">
                <Label>Rango de multiplicadores</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Mínimo</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        value={dynamicConfig.minMultiplier}
                        onChange={(e) =>
                          setDynamicConfig({
                            ...dynamicConfig,
                            minMultiplier: parseFloat(e.target.value) || 0.5,
                          })
                        }
                        className="w-24"
                      />
                      <span className="text-muted-foreground">x</span>
                      <span className="text-sm text-green-500">
                        ({formatCurrency(dynamicConfig.basePrice * dynamicConfig.minMultiplier)})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Máximo</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        value={dynamicConfig.maxMultiplier}
                        onChange={(e) =>
                          setDynamicConfig({
                            ...dynamicConfig,
                            maxMultiplier: parseFloat(e.target.value) || 2.0,
                          })
                        }
                        className="w-24"
                      />
                      <span className="text-muted-foreground">x</span>
                      <span className="text-sm text-red-500">
                        ({formatCurrency(dynamicConfig.basePrice * dynamicConfig.maxMultiplier)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pesos de factores */}
              <div className="space-y-4">
                <Label>Pesos de factores (deben sumar 100%)</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Ocupación de zona</span>
                      </div>
                      <span className="text-sm font-medium">{dynamicConfig.occupancyWeight}%</span>
                    </div>
                    <Slider
                      value={[dynamicConfig.occupancyWeight]}
                      max={100}
                      step={5}
                      onValueChange={([value]) =>
                        setDynamicConfig({ ...dynamicConfig, occupancyWeight: value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Horario del día</span>
                      </div>
                      <span className="text-sm font-medium">{dynamicConfig.timeWeight}%</span>
                    </div>
                    <Slider
                      value={[dynamicConfig.timeWeight]}
                      max={100}
                      step={5}
                      onValueChange={([value]) =>
                        setDynamicConfig({ ...dynamicConfig, timeWeight: value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Día de la semana</span>
                      </div>
                      <span className="text-sm font-medium">{dynamicConfig.dayWeight}%</span>
                    </div>
                    <Slider
                      value={[dynamicConfig.dayWeight]}
                      max={100}
                      step={5}
                      onValueChange={([value]) =>
                        setDynamicConfig({ ...dynamicConfig, dayWeight: value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Demanda histórica</span>
                      </div>
                      <span className="text-sm font-medium">{dynamicConfig.demandWeight}%</span>
                    </div>
                    <Slider
                      value={[dynamicConfig.demandWeight]}
                      max={100}
                      step={5}
                      onValueChange={([value]) =>
                        setDynamicConfig({ ...dynamicConfig, demandWeight: value })
                      }
                    />
                  </div>
                </div>
                <p className={`text-sm ${
                  dynamicConfig.occupancyWeight + dynamicConfig.timeWeight + 
                  dynamicConfig.dayWeight + dynamicConfig.demandWeight === 100
                    ? "text-green-500"
                    : "text-red-500"
                }`}>
                  Total: {dynamicConfig.occupancyWeight + dynamicConfig.timeWeight + 
                  dynamicConfig.dayWeight + dynamicConfig.demandWeight}%
                </p>
              </div>

              <Button onClick={handleSaveConfig} className="w-full">
                Guardar configuración
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tarifa dinámica actual */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Tarifa Dinámica en Tiempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Precio base</p>
              <p className="text-2xl font-bold">{formatCurrency(dynamicConfig.basePrice)}</p>
              <p className="text-xs text-muted-foreground">Por kWh</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Multiplicador actual</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${
                  currentMultiplier > 1 ? "text-orange-500" : 
                  currentMultiplier < 1 ? "text-green-500" : ""
                }`}>
                  {currentMultiplier.toFixed(2)}x
                </p>
                <Badge className={
                  currentMultiplier > 1.2 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                  currentMultiplier > 1 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                  currentMultiplier < 0.9 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }>
                  {currentMultiplier > 1.2 ? "Surge" :
                   currentMultiplier > 1 ? "Alta demanda" :
                   currentMultiplier < 0.9 ? "Baja demanda" : "Normal"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Precio efectivo</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(currentPrice)}</p>
              <p className="text-xs text-muted-foreground">Por kWh ahora</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Condición actual</p>
              <div className="space-y-1">
                <p className="text-sm">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {isRushHour ? "Hora pico" : "Hora normal"}
                </p>
                <p className="text-sm">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {isWeekend ? "Fin de semana" : "Día laboral"}
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico de precios por hora */}
          <div className="mt-6 p-4 bg-background/50 rounded-lg">
            <p className="text-sm font-medium mb-3">Variación de precios durante el día</p>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 24 }, (_, hour) => {
                const isHourRush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
                const isNight = hour >= 22 || hour < 6;
                const mult = isHourRush ? 1.25 : isNight ? 0.85 : 1.0;
                const height = (mult / 1.5) * 100;
                const isCurrent = hour === currentHour;
                return (
                  <div
                    key={hour}
                    className={`flex-1 rounded-t transition-all ${
                      isCurrent ? "bg-primary" :
                      mult > 1 ? "bg-orange-500/50" :
                      mult < 1 ? "bg-green-500/50" : "bg-blue-500/50"
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${hour}:00 - ${formatCurrency(dynamicConfig.basePrice * mult)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0:00</span>
              <span>6:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500/50" />
                <span>Valle (0.85x)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/50" />
                <span>Normal (1.0x)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-500/50" />
                <span>Pico (1.25x)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary" />
                <span>Hora actual</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(dynamicConfig.basePrice)}</div>
              <div className="text-sm text-muted-foreground">Precio base/kWh</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(5000)}</div>
              <div className="text-sm text-muted-foreground">Fee de reserva</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(500)}</div>
              <div className="text-sm text-muted-foreground">Penalización/min</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(2000)}</div>
              <div className="text-sm text-muted-foreground">Tarifa conexión</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla de tarifas por estación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Tarifas por Estación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por estación..." className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => toast.info("Crear tarifa personalizada próximamente")}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva tarifa
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estación</TableHead>
                <TableHead>Precio base/kWh</TableHead>
                <TableHead>Tarifa dinámica</TableHead>
                <TableHead>Fee reserva</TableHead>
                <TableHead>Penalización</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations && stations.length > 0 ? (
                stations.map((station: any) => (
                  <TableRow key={station.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">{station.city}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(station.pricePerKwh || 1200)}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Activa
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(station.reservationFee || 5000)}</TableCell>
                    <TableCell>{formatCurrency(station.overstayPenaltyPerMin || 500)}/min</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Activa
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => toast.info("Editar tarifa próximamente")}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay estaciones configuradas. Crea una estación primero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Información sobre tarifas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Cómo funciona la Tarifa Dinámica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Factores que afectan el precio</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Ocupación de zona ({dynamicConfig.occupancyWeight}%):</strong> Si hay muchos cargadores ocupados en la zona, el precio sube para incentivar el uso de otras ubicaciones.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Horario del día ({dynamicConfig.timeWeight}%):</strong> Precios más altos en horas pico (7-9am, 5-8pm) y más bajos en la noche.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Día de la semana ({dynamicConfig.dayWeight}%):</strong> Fines de semana suelen tener menor demanda, por lo que los precios bajan.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Demanda histórica ({dynamicConfig.demandWeight}%):</strong> Basado en patrones de uso anteriores en la misma ubicación y horario.
                  </div>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Beneficios</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Optimiza la distribución de usuarios entre estaciones
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Maximiza ingresos en horas de alta demanda
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Incentiva el uso en horas valle con descuentos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Reduce congestión en estaciones populares
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Transparencia total para usuarios sobre precios
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
