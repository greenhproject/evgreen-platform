/**
 * Planificador de Viajes con IA
 * Permite planificar rutas con paradas de carga optimizadas
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Navigation,
  MapPin,
  Battery,
  Clock,
  DollarSign,
  Zap,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Car,
  Route,
  Flag,
} from "lucide-react";

// ============================================================================
// TIPOS
// ============================================================================

interface TripStop {
  type: "origin" | "charging" | "destination";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  stationId?: number;
  chargingDuration?: number;
  estimatedCost?: number;
  batteryOnArrival?: number;
  batteryOnDeparture?: number;
}

interface TripPlan {
  totalDistance: number;
  totalDuration: number;
  totalChargingTime: number;
  totalChargingCost: number;
  stops: TripStop[];
  warnings: string[];
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function TripPlanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"input" | "result">("input");
  
  // Formulario
  const [originAddress, setOriginAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [vehicleRange, setVehicleRange] = useState(300);
  const [currentBattery, setCurrentBattery] = useState(80);
  const [minBatteryAtDestination, setMinBatteryAtDestination] = useState(20);
  
  // Resultado
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);

  // Mutation
  const planTrip = trpc.ai.planTrip.useMutation({
    onSuccess: (data) => {
      setTripPlan(data);
      setStep("result");
    },
    onError: (error) => {
      toast.error(error.message || "Error al planificar el viaje");
    },
  });

  const handlePlanTrip = useCallback(async () => {
    if (!originAddress || !destinationAddress) {
      toast.error("Ingresa origen y destino");
      return;
    }

    // En una implementación real, aquí se usaría geocoding
    // Por ahora usamos coordenadas de ejemplo para Colombia
    planTrip.mutate({
      origin: {
        latitude: 4.7110,
        longitude: -74.0721,
        address: originAddress,
      },
      destination: {
        latitude: 6.2442,
        longitude: -75.5812,
        address: destinationAddress,
      },
      vehicleRange,
      currentBatteryLevel: currentBattery,
      minimumBatteryAtDestination: minBatteryAtDestination,
    });
  }, [originAddress, destinationAddress, vehicleRange, currentBattery, minBatteryAtDestination, planTrip]);

  const handleReset = () => {
    setStep("input");
    setTripPlan(null);
    setOriginAddress("");
    setDestinationAddress("");
  };

  const getStopIcon = (type: string) => {
    switch (type) {
      case "origin":
        return <MapPin className="h-5 w-5 text-green-500" />;
      case "charging":
        return <Zap className="h-5 w-5 text-yellow-500" />;
      case "destination":
        return <Flag className="h-5 w-5 text-red-500" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  const getBatteryColor = (level: number) => {
    if (level >= 60) return "text-green-500";
    if (level >= 30) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Navigation className="h-4 w-4" />
          Planificar viaje
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Planificador de Viajes EV
          </DialogTitle>
          <DialogDescription>
            Planifica tu viaje con paradas de carga optimizadas por IA
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {step === "input" ? (
            <div className="space-y-6 py-4">
              {/* Origen y Destino */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="origin">Origen</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    <Input
                      id="origin"
                      placeholder="Ej: Bogotá, Colombia"
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination">Destino</Label>
                  <div className="relative">
                    <Flag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                    <Input
                      id="destination"
                      placeholder="Ej: Medellín, Colombia"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Configuración del vehículo */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Configuración del vehículo
                </h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Autonomía del vehículo</Label>
                    <span className="text-sm font-medium">{vehicleRange} km</span>
                  </div>
                  <Slider
                    value={[vehicleRange]}
                    onValueChange={([v]) => setVehicleRange(v)}
                    min={100}
                    max={600}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Batería actual</Label>
                    <span className={`text-sm font-medium ${getBatteryColor(currentBattery)}`}>
                      {currentBattery}%
                    </span>
                  </div>
                  <Slider
                    value={[currentBattery]}
                    onValueChange={([v]) => setCurrentBattery(v)}
                    min={5}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Batería mínima al llegar</Label>
                    <span className="text-sm font-medium">{minBatteryAtDestination}%</span>
                  </div>
                  <Slider
                    value={[minBatteryAtDestination]}
                    onValueChange={([v]) => setMinBatteryAtDestination(v)}
                    min={10}
                    max={50}
                    step={5}
                  />
                </div>
              </div>

              <Button
                onClick={handlePlanTrip}
                disabled={planTrip.isPending}
                className="w-full"
                size="lg"
              >
                {planTrip.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Planificando con IA...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Planificar viaje
                  </>
                )}
              </Button>
            </div>
          ) : tripPlan ? (
            <div className="space-y-6 py-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Route className="h-4 w-4" />
                      Distancia total
                    </div>
                    <p className="text-2xl font-bold">{tripPlan.totalDistance} km</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      Duración total
                    </div>
                    <p className="text-2xl font-bold">
                      {Math.floor(tripPlan.totalDuration / 60)}h {tripPlan.totalDuration % 60}m
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Zap className="h-4 w-4" />
                      Tiempo de carga
                    </div>
                    <p className="text-2xl font-bold">{tripPlan.totalChargingTime} min</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="h-4 w-4" />
                      Costo de carga
                    </div>
                    <p className="text-2xl font-bold">
                      ${tripPlan.totalChargingCost.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Advertencias */}
              {tripPlan.warnings.length > 0 && (
                <div className="space-y-2">
                  {tripPlan.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Paradas */}
              <div className="space-y-4">
                <h4 className="font-medium">Ruta planificada</h4>
                <div className="space-y-0">
                  {tripPlan.stops.map((stop, index) => (
                    <div key={index} className="relative">
                      {/* Línea conectora */}
                      {index < tripPlan.stops.length - 1 && (
                        <div className="absolute left-[14px] top-10 w-0.5 h-[calc(100%-20px)] bg-border" />
                      )}

                      <div className="flex gap-4 pb-6">
                        <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {getStopIcon(stop.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{stop.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {stop.address}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1">
                                <Battery className={`h-4 w-4 ${getBatteryColor(stop.batteryOnArrival || 0)}`} />
                                <span className={`text-sm font-medium ${getBatteryColor(stop.batteryOnArrival || 0)}`}>
                                  {stop.batteryOnArrival || 0}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {stop.type === "charging" && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {stop.chargingDuration} min
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <DollarSign className="h-3 w-3 mr-1" />
                                ${stop.estimatedCost?.toLocaleString()}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-green-600">
                                <Battery className="h-3 w-3 mr-1" />
                                → {stop.batteryOnDeparture}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Nuevo viaje
                </Button>
                <Button className="flex-1" onClick={() => setIsOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default TripPlanner;
