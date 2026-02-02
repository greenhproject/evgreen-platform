import { useState, useEffect } from "react";
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
  DialogFooter,
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
  MapPin,
  Save,
  Loader2
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

interface StationTariff {
  stationId: number;
  stationName: string;
  city: string;
  pricePerKwh: number;
  reservationFee: number;
  overstayPenaltyPerMin: number;
  connectionFee: number;
  tariffId?: number;
}

interface EditTariffForm {
  pricePerKwh: string;
  reservationFee: string;
  overstayPenaltyPerMinute: string;
  pricePerSession: string; // Tarifa de conexión
}

export default function AdminTariffs() {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationTariff | null>(null);
  const [editForm, setEditForm] = useState<EditTariffForm>({
    pricePerKwh: "1200",
    reservationFee: "5000",
    overstayPenaltyPerMinute: "500",
    pricePerSession: "2000",
  });
  const [searchQuery, setSearchQuery] = useState("");
  
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

  // Estado para rangos de precio globales y tarifas
  const [localPriceRanges, setLocalPriceRanges] = useState({ 
    minPrice: 400, 
    maxPrice: 3000,
    defaultReservationFee: 5000,
    defaultOverstayPenaltyPerMin: 500,
    defaultConnectionFee: 2000,
    defaultPricePerKwhAC: 800,
    defaultPricePerKwhDC: 1200,
    enableDifferentiatedPricing: true,
  });
  const [savingPriceRanges, setSavingPriceRanges] = useState(false);

  // Query para obtener rangos de precio actuales
  const { data: priceRanges, refetch: refetchPriceRanges } = trpc.tariffs.getPriceRanges.useQuery();

  // Mutación para actualizar rangos de precio
  const updatePriceRanges = trpc.tariffs.updatePriceRanges.useMutation({
    onSuccess: () => {
      toast.success("Rangos de precio actualizados correctamente");
      refetchPriceRanges();
      setSavingPriceRanges(false);
    },
    onError: (error) => {
      toast.error(`Error al actualizar rangos: ${error.message}`);
      setSavingPriceRanges(false);
    },
  });

  // Sincronizar estado local con datos del servidor
  useEffect(() => {
    if (priceRanges) {
      setLocalPriceRanges({
        minPrice: priceRanges.minPrice,
        maxPrice: priceRanges.maxPrice,
        defaultReservationFee: priceRanges.defaultReservationFee,
        defaultOverstayPenaltyPerMin: priceRanges.defaultOverstayPenaltyPerMin,
        defaultConnectionFee: priceRanges.defaultConnectionFee,
        defaultPricePerKwhAC: priceRanges.defaultPricePerKwhAC,
        defaultPricePerKwhDC: priceRanges.defaultPricePerKwhDC,
        enableDifferentiatedPricing: priceRanges.enableDifferentiatedPricing,
      });
    }
  }, [priceRanges]);

  const handleSavePriceRanges = () => {
    if (localPriceRanges.minPrice >= localPriceRanges.maxPrice) {
      toast.error("El precio mínimo debe ser menor que el máximo");
      return;
    }
    if (localPriceRanges.minPrice < 100) {
      toast.error("El precio mínimo debe ser al menos $100 COP");
      return;
    }
    // Validar que AC sea menor que DC si precios diferenciados están habilitados
    if (localPriceRanges.enableDifferentiatedPricing && localPriceRanges.defaultPricePerKwhAC > localPriceRanges.defaultPricePerKwhDC) {
      toast.error("El precio AC (carga lenta) debe ser menor o igual al precio DC (carga rápida)");
      return;
    }
    setSavingPriceRanges(true);
    updatePriceRanges.mutate({
      minPrice: localPriceRanges.minPrice,
      maxPrice: localPriceRanges.maxPrice,
      enableDynamicPricing: dynamicConfig.enabled,
      defaultReservationFee: localPriceRanges.defaultReservationFee,
      defaultOverstayPenaltyPerMin: localPriceRanges.defaultOverstayPenaltyPerMin,
      defaultConnectionFee: localPriceRanges.defaultConnectionFee,
      defaultPricePerKwhAC: localPriceRanges.defaultPricePerKwhAC,
      defaultPricePerKwhDC: localPriceRanges.defaultPricePerKwhDC,
      enableDifferentiatedPricing: localPriceRanges.enableDifferentiatedPricing,
    });
  };

  // Obtener estaciones para mostrar tarifas
  const { data: stations, refetch: refetchStations } = trpc.stations.listPublic.useQuery({});
  
  // Mutación para crear/actualizar tarifa
  const createTariff = trpc.tariffs.create.useMutation({
    onSuccess: () => {
      toast.success("Tarifa actualizada correctamente");
      setIsEditDialogOpen(false);
      refetchStations();
    },
    onError: (error) => {
      toast.error(`Error al guardar tarifa: ${error.message}`);
    },
  });
  
  const updateTariff = trpc.tariffs.update.useMutation({
    onSuccess: () => {
      toast.success("Tarifa actualizada correctamente");
      setIsEditDialogOpen(false);
      refetchStations();
    },
    onError: (error) => {
      toast.error(`Error al actualizar tarifa: ${error.message}`);
    },
  });

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
    setIsConfigDialogOpen(false);
  };

  const handleEditStation = (station: any) => {
    setSelectedStation({
      stationId: station.id,
      stationName: station.name,
      city: station.city,
      pricePerKwh: parseFloat(station.pricePerKwh || "1200"),
      reservationFee: parseFloat(station.reservationFee || "5000"),
      overstayPenaltyPerMin: parseFloat(station.overstayPenaltyPerMin || "500"),
      connectionFee: parseFloat(station.connectionFee || "2000"),
      tariffId: station.tariffId,
    });
    setEditForm({
      pricePerKwh: station.pricePerKwh?.toString() || "1200",
      reservationFee: station.reservationFee?.toString() || "5000",
      overstayPenaltyPerMinute: station.overstayPenaltyPerMin?.toString() || "500",
      pricePerSession: station.connectionFee?.toString() || "2000",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveTariff = () => {
    if (!selectedStation) return;
    
    // Validar valores
    const pricePerKwh = parseFloat(editForm.pricePerKwh);
    const reservationFee = parseFloat(editForm.reservationFee);
    const overstayPenalty = parseFloat(editForm.overstayPenaltyPerMinute);
    const connectionFee = parseFloat(editForm.pricePerSession);
    
    if (isNaN(pricePerKwh) || pricePerKwh < 0) {
      toast.error("El precio por kWh debe ser un número válido");
      return;
    }
    if (isNaN(reservationFee) || reservationFee < 0) {
      toast.error("La tarifa de reserva debe ser un número válido");
      return;
    }
    if (isNaN(overstayPenalty) || overstayPenalty < 0) {
      toast.error("La penalización por ocupación debe ser un número válido");
      return;
    }
    if (isNaN(connectionFee) || connectionFee < 0) {
      toast.error("La tarifa de conexión debe ser un número válido");
      return;
    }

    // Crear nueva tarifa (esto desactivará las anteriores automáticamente)
    createTariff.mutate({
      stationId: selectedStation.stationId,
      name: `Tarifa ${selectedStation.stationName}`,
      description: `Tarifa actualizada el ${new Date().toLocaleDateString("es-CO")}`,
      pricePerKwh: editForm.pricePerKwh,
      reservationFee: editForm.reservationFee,
      overstayPenaltyPerMinute: editForm.overstayPenaltyPerMinute,
      pricePerSession: editForm.pricePerSession,
    });
  };

  // Filtrar estaciones por búsqueda
  const filteredStations = stations?.filter((station: any) =>
    station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    station.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Tarifas</h1>
          <p className="text-muted-foreground">
            Configura tarifas base y parámetros de pricing dinámico
          </p>
        </div>
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
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
                {dynamicConfig.occupancyWeight + dynamicConfig.timeWeight + dynamicConfig.dayWeight + dynamicConfig.demandWeight !== 100 && (
                  <p className="text-sm text-destructive">
                    Los pesos deben sumar 100% (actual: {dynamicConfig.occupancyWeight + dynamicConfig.timeWeight + dynamicConfig.dayWeight + dynamicConfig.demandWeight}%)
                  </p>
                )}
              </div>

              <Button onClick={handleSaveConfig} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Guardar configuración
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rangos de Precio Globales (Controlados por Admin) */}
      <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Settings className="w-5 h-5" />
            Rangos de Precio Globales
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
              Control de Mercado
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Estos límites aplican a todos los inversionistas. Ningún precio puede estar fuera de este rango para proteger el mercado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Precio Mínimo por kWh
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={localPriceRanges.minPrice}
                  onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, minPrice: parseInt(e.target.value) || 400 }))}
                  className="w-32"
                />
                <span className="text-muted-foreground">COP</span>
                <span className="text-sm text-green-600">
                  ({formatCurrency(localPriceRanges.minPrice)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Evita precios predatorios que dañen la competencia</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-red-600" />
                Precio Máximo por kWh
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={localPriceRanges.maxPrice}
                  onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || 3000 }))}
                  className="w-32"
                />
                <span className="text-muted-foreground">COP</span>
                <span className="text-sm text-red-600">
                  ({formatCurrency(localPriceRanges.maxPrice)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Protege a los usuarios de precios abusivos</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleSavePriceRanges}
              disabled={savingPriceRanges}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {savingPriceRanges ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar Rangos Globales
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Precio actual */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Precio dinámico actual</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{formatCurrency(currentPrice)}</span>
                <span className="text-muted-foreground">/kWh</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={currentMultiplier > 1 ? "destructive" : currentMultiplier < 1 ? "default" : "secondary"}>
                  {currentMultiplier > 1 ? "↑" : currentMultiplier < 1 ? "↓" : "="} {(currentMultiplier * 100 - 100).toFixed(0)}%
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isRushHour ? "Hora pico" : currentHour >= 22 || currentHour < 6 ? "Horario nocturno" : isWeekend ? "Fin de semana" : "Horario normal"}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Precio base</p>
              <p className="text-2xl font-semibold">{formatCurrency(dynamicConfig.basePrice)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Multiplicador: {currentMultiplier.toFixed(2)}x
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de precios por hora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Variación de precios por hora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end gap-1">
            {Array.from({ length: 24 }, (_, hour) => {
              let mult = 1.0;
              const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
              const isNight = hour >= 22 || hour < 6;
              if (isPeak) mult = 1.25;
              else if (isNight) mult = 0.85;
              else if (isWeekend) mult = 0.9;
              
              const height = (mult / dynamicConfig.maxMultiplier) * 100;
              const isCurrentHour = hour === currentHour;
              
              return (
                <div
                  key={hour}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      isCurrentHour
                        ? "bg-primary"
                        : mult > 1
                        ? "bg-orange-500/50"
                        : mult < 1
                        ? "bg-green-500/50"
                        : "bg-muted"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className={`text-[10px] ${isCurrentHour ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {hour}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500/50" />
              <span>Valle (0.85x)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted" />
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
        </CardContent>
      </Card>

      {/* Tarifas Globales Editables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Tarifas Globales por Defecto
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Estas tarifas se aplicarán a todas las estaciones nuevas y a las que no tengan configuración personalizada
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Precio base/kWh - Solo lectura */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Precio base/kWh
              </Label>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-primary">{formatCurrency(dynamicConfig.basePrice)}</div>
              </div>
              <p className="text-xs text-muted-foreground">Controlado por precios dinámicos</p>
            </div>
            
            {/* Fee de reserva - Editable */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Fee de Reserva
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={localPriceRanges.defaultReservationFee}
                  onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, defaultReservationFee: parseInt(e.target.value) || 0 }))}
                  className="w-28"
                  min={0}
                  max={100000}
                />
                <span className="text-muted-foreground">COP</span>
              </div>
              <p className="text-xs text-muted-foreground">Cargo fijo por reservar un conector</p>
            </div>
            
            {/* Penalización por ocupación - Editable */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Penalización/min
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={localPriceRanges.defaultOverstayPenaltyPerMin}
                  onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, defaultOverstayPenaltyPerMin: parseInt(e.target.value) || 0 }))}
                  className="w-28"
                  min={0}
                  max={10000}
                />
                <span className="text-muted-foreground">COP</span>
              </div>
              <p className="text-xs text-muted-foreground">Cargo por minuto si permanece conectado</p>
            </div>
            
            {/* Tarifa de conexión - Editable */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                Tarifa Conexión
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={localPriceRanges.defaultConnectionFee}
                  onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, defaultConnectionFee: parseInt(e.target.value) || 0 }))}
                  className="w-28"
                  min={0}
                  max={50000}
                />
                <span className="text-muted-foreground">COP</span>
              </div>
              <p className="text-xs text-muted-foreground">Cargo fijo por iniciar una carga</p>
            </div>
          </div>
          
          {/* Sección de Tarifas Diferenciadas AC/DC */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Tarifas por Tipo de Conector
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configura precios diferentes para carga lenta (AC) y carga rápida (DC)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="enableDifferentiated" className="text-sm">Habilitar precios diferenciados</Label>
                <Switch
                  id="enableDifferentiated"
                  checked={localPriceRanges.enableDifferentiatedPricing}
                  onCheckedChange={(checked) => setLocalPriceRanges(prev => ({ ...prev, enableDifferentiatedPricing: checked }))}
                />
              </div>
            </div>
            
            {localPriceRanges.enableDifferentiatedPricing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Precio AC (Carga Lenta) */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Label className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded bg-blue-500/20">
                      <Zap className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <span className="font-medium">Precio AC (Carga Lenta)</span>
                      <p className="text-xs text-muted-foreground font-normal">Type 1, Type 2, GBT AC</p>
                    </div>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={localPriceRanges.defaultPricePerKwhAC}
                      onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, defaultPricePerKwhAC: parseInt(e.target.value) || 0 }))}
                      className="w-32"
                      min={100}
                      max={5000}
                    />
                    <span className="text-muted-foreground">COP/kWh</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Carga más lenta, ideal para estacionamientos largos</p>
                </div>
                
                {/* Precio DC (Carga Rápida) */}
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <Label className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded bg-orange-500/20">
                      <Zap className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <span className="font-medium">Precio DC (Carga Rápida)</span>
                      <p className="text-xs text-muted-foreground font-normal">CCS 1, CCS 2, CHAdeMO, GBT DC</p>
                    </div>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={localPriceRanges.defaultPricePerKwhDC}
                      onChange={(e) => setLocalPriceRanges(prev => ({ ...prev, defaultPricePerKwhDC: parseInt(e.target.value) || 0 }))}
                      className="w-32"
                      min={100}
                      max={10000}
                    />
                    <span className="text-muted-foreground">COP/kWh</span>
                  </div>
                  <p className="text-xs text-orange-600 mt-2">Carga rápida, mayor costo por infraestructura</p>
                </div>
              </div>
            )}
            
            {!localPriceRanges.enableDifferentiatedPricing && (
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Cuando los precios diferenciados están deshabilitados, se usa el precio base dinámico para todos los tipos de conector.
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleSavePriceRanges}
              disabled={savingPriceRanges}
              className="bg-green-600 hover:bg-green-700"
            >
              {savingPriceRanges ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar Tarifas Globales
            </Button>
          </div>
        </CardContent>
      </Card>

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
              <Input 
                placeholder="Buscar por estación..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estación</TableHead>
                <TableHead>Precio base/kWh</TableHead>
                <TableHead>Tarifa dinámica</TableHead>
                <TableHead>Fee reserva</TableHead>
                <TableHead>Penalización</TableHead>
                <TableHead>Tarifa conexión</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStations && filteredStations.length > 0 ? (
                filteredStations.map((station: any) => (
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
                    <TableCell>{formatCurrency(station.connectionFee || 2000)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEditStation(station)}
                      >
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

      {/* Modal de edición de tarifa */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editar Tarifa
            </DialogTitle>
          </DialogHeader>
          
          {selectedStation && (
            <div className="space-y-6 py-4">
              {/* Info de la estación */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedStation.stationName}</p>
                <p className="text-sm text-muted-foreground">{selectedStation.city}</p>
              </div>

              {/* Precio por kWh */}
              <div className="space-y-2">
                <Label htmlFor="pricePerKwh">Precio por kWh (COP)</Label>
                <Input
                  id="pricePerKwh"
                  type="number"
                  value={editForm.pricePerKwh}
                  onChange={(e) => setEditForm({ ...editForm, pricePerKwh: e.target.value })}
                  placeholder="1200"
                />
                <p className="text-xs text-muted-foreground">
                  Precio base que se cobra por cada kilovatio-hora consumido
                </p>
              </div>

              {/* Tarifa de reserva */}
              <div className="space-y-2">
                <Label htmlFor="reservationFee">Tarifa de reserva (COP)</Label>
                <Input
                  id="reservationFee"
                  type="number"
                  value={editForm.reservationFee}
                  onChange={(e) => setEditForm({ ...editForm, reservationFee: e.target.value })}
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground">
                  Cargo fijo por realizar una reserva anticipada
                </p>
              </div>

              {/* Penalización por ocupación */}
              <div className="space-y-2">
                <Label htmlFor="overstayPenalty">Penalización por ocupación (COP/min)</Label>
                <Input
                  id="overstayPenalty"
                  type="number"
                  value={editForm.overstayPenaltyPerMinute}
                  onChange={(e) => setEditForm({ ...editForm, overstayPenaltyPerMinute: e.target.value })}
                  placeholder="500"
                />
                <p className="text-xs text-muted-foreground">
                  Cargo por minuto cuando el vehículo permanece conectado después de cargar
                </p>
              </div>

              {/* Tarifa de conexión */}
              <div className="space-y-2">
                <Label htmlFor="connectionFee">Tarifa de conexión (COP)</Label>
                <Input
                  id="connectionFee"
                  type="number"
                  value={editForm.pricePerSession}
                  onChange={(e) => setEditForm({ ...editForm, pricePerSession: e.target.value })}
                  placeholder="2000"
                />
                <p className="text-xs text-muted-foreground">
                  Cargo fijo por cada sesión de carga iniciada
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveTariff}
              disabled={createTariff.isPending}
            >
              {createTariff.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
