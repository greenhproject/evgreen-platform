import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Zap, Settings, Eye, TrendingUp, ExternalLink, Battery, Clock, DollarSign, Sparkles, Brain, Info, ArrowRight, BarChart3, Activity, Download } from "lucide-react";
import { toast } from "sonner";

// Tipo para estación
interface Station {
  id: number;
  name: string;
  ocppIdentity?: string | null;
  address: string;
  city: string;
  department?: string | null;
  latitude: string;
  longitude: string;
  isOnline: boolean;
  isActive: boolean;
  isPublic: boolean;
  description?: string | null;
  evses?: Array<{
    id: number;
    connectorId: number;
    connectorType: string;
    powerKw: string;
    status: string;
  }>;
  tariff?: {
    pricePerKwh: string;
    reservationFee: string;
    idleFeePerMin: string;
    connectionFee: string;
    autoPricing?: boolean;
  };
}

export default function InvestorStations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Configuración de tarifa
  const [pricePerKwh, setPricePerKwh] = useState("");
  const [reservationFee, setReservationFee] = useState("");
  const [idleFee, setIdleFee] = useState("");
  const [connectionFee, setConnectionFee] = useState("");
  const [autoPricing, setAutoPricing] = useState(false);

  const { data: stations, isLoading } = trpc.stations.listOwned.useQuery();
  
  // Query para obtener historial de precios de la estación seleccionada
  const { data: priceHistory } = trpc.tariffs.getPriceHistory.useQuery(
    { stationId: selectedStation?.id || 0, daysBack: 7, granularity: "hour" },
    { enabled: !!selectedStation && showDetailsModal }
  );
  
  // Query para obtener demanda actual de todas las estaciones
  const { data: demandData } = trpc.tariffs.getInvestorDemand.useQuery();
  
  // Query para obtener rangos de precio permitidos
  const { data: priceRanges } = trpc.tariffs.getPriceRanges.useQuery();
  
  // Query para obtener precio sugerido
  const { data: suggestedPriceData, isLoading: isLoadingSuggested } = trpc.tariffs.getSuggestedPrice.useQuery(
    { stationId: selectedStation?.id || 0 },
    { enabled: !!selectedStation && showConfigModal && !autoPricing }
  );
  
  const updateTariff = trpc.tariffs.updateByStation.useMutation({
    onSuccess: () => {
      toast.success("Tarifa actualizada correctamente");
      setShowConfigModal(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al actualizar tarifa");
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactiva</Badge>;
    return isOnline ? (
      <Badge className="bg-green-100 text-green-700">En línea</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700">Fuera de línea</Badge>
    );
  };

  const getConnectorTypeName = (type: string) => {
    const types: Record<string, string> = {
      TYPE_1: "Tipo 1 (J1772)",
      TYPE_2: "Tipo 2 (Mennekes)",
      CCS_1: "CCS Combo 1",
      CCS_2: "CCS Combo 2",
      CHADEMO: "CHAdeMO",
      TESLA: "Tesla",
      GBT_AC: "GB/T AC",
      GBT_DC: "GB/T DC",
    };
    return types[type] || type;
  };

  const getConnectorStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-green-100 text-green-700">Disponible</Badge>;
      case "CHARGING":
        return <Badge className="bg-blue-100 text-blue-700">Cargando</Badge>;
      case "UNAVAILABLE":
        return <Badge variant="secondary">No disponible</Badge>;
      case "FAULTED":
        return <Badge variant="destructive">Con falla</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Función para renderizar mini gráfica de precios (sparkline)
  const renderPriceSparkline = (history: typeof priceHistory) => {
    if (!history || history.length === 0) return null;
    
    const prices = history.slice(-24).map(h => h.avgPrice); // Últimas 24 horas
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    
    return (
      <div className="flex items-end gap-0.5 h-8">
        {prices.map((price, i) => {
          const height = ((price - minPrice) / range) * 100;
          return (
            <div
              key={i}
              className="w-1 bg-primary/60 rounded-t"
              style={{ height: `${Math.max(height, 10)}%` }}
            />
          );
        })}
      </div>
    );
  };

  const getDemandLevelBadge = (level: string) => {
    switch (level) {
      case "LOW":
        return <Badge className="bg-blue-100 text-blue-700">Baja demanda</Badge>;
      case "NORMAL":
        return <Badge className="bg-gray-100 text-gray-700">Demanda normal</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-100 text-orange-700">Alta demanda</Badge>;
      case "SURGE":
        return <Badge className="bg-red-100 text-red-700">Demanda crítica</Badge>;
      default:
        return <Badge variant="secondary">{level}</Badge>;
    }
  };

  // Función para exportar historial de precios a CSV
  const exportPriceHistoryCSV = () => {
    if (!priceHistory || priceHistory.length === 0 || !selectedStation) {
      toast.error("No hay datos para exportar");
      return;
    }

    // Crear encabezados del CSV
    const headers = ["Fecha", "Hora", "Precio (COP/kWh)", "Demanda", "Ocupación (%)"];
    
    // Crear filas de datos
    const rows = priceHistory.map(record => {
      const date = new Date(record.timestamp);
      return [
        date.toLocaleDateString("es-CO"),
        date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
        record.avgPrice.toFixed(0),
        record.demandLevel || "N/A",
        "N/A", // Ocupación no disponible en este endpoint
      ].join(",");
    });

    // Combinar encabezados y filas
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Nombre del archivo con fecha y nombre de estación
    const stationName = selectedStation.name.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    link.download = `historial_precios_${stationName}_${dateStr}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Historial exportado correctamente");
  };

  const handleViewDetails = (station: Station) => {
    setSelectedStation(station);
    setShowDetailsModal(true);
  };

  const handleOpenConfig = (station: Station) => {
    setSelectedStation(station);
    // Cargar valores actuales de tarifa
    if (station.tariff) {
      setPricePerKwh(station.tariff.pricePerKwh);
      setReservationFee(station.tariff.reservationFee);
      setIdleFee(station.tariff.idleFeePerMin);
      setConnectionFee(station.tariff.connectionFee);
      setAutoPricing(station.tariff.autoPricing || false);
    } else {
      setPricePerKwh("1200");
      setReservationFee("5000");
      setIdleFee("500");
      setConnectionFee("2000");
      setAutoPricing(false);
    }
    setShowConfigModal(true);
  };

  const handleSaveTariff = () => {
    if (!selectedStation) return;
    updateTariff.mutate({
      stationId: selectedStation.id,
      pricePerKwh: parseFloat(pricePerKwh) || 1200,
      reservationFee: parseFloat(reservationFee) || 5000,
      idleFeePerMin: parseFloat(idleFee) || 500,
      connectionFee: parseFloat(connectionFee) || 2000,
      autoPricing,
    });
  };

  const handleUseSuggestedPrice = () => {
    if (suggestedPriceData) {
      setPricePerKwh(suggestedPriceData.suggestedPrice.toString());
      toast.success("Precio sugerido aplicado");
    }
  };

  // Filtrar estaciones por búsqueda
  const filteredStations = stations?.filter((station) =>
    station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular estadísticas
  const totalStations = stations?.length || 0;
  const onlineStations = stations?.filter((s) => s.isOnline).length || 0;
  const totalConnectors = 0; // Se calculará cuando se agregue evses a listOwned

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Estaciones</h1>
        <p className="text-muted-foreground">
          Gestiona y monitorea tus estaciones de carga
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalStations}</div>
              <div className="text-sm text-muted-foreground">Estaciones</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{onlineStations}</div>
              <div className="text-sm text-muted-foreground">En línea</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(0)}</div>
              <div className="text-sm text-muted-foreground">Ingresos del mes</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Battery className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalConnectors}</div>
              <div className="text-sm text-muted-foreground">Conectores</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar estación..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Conectores</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Cargando estaciones...
                </TableCell>
              </TableRow>
            ) : filteredStations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No se encontraron estaciones" : "No tienes estaciones registradas"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStations?.map((station) => (
                <TableRow key={station.id}>
                  <TableCell>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {station.ocppIdentity || `GEV-${station.id}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {station.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-muted-foreground" />
                      -
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(station.isOnline, station.isActive)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {station.tariff?.autoPricing ? (
                        <Badge className="bg-purple-100 text-purple-700">
                          <Brain className="w-3 h-3 mr-1" />
                          IA
                        </Badge>
                      ) : (
                        <span className="text-sm">
                          {formatCurrency(parseFloat(station.tariff?.pricePerKwh || "1200"))}/kWh
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(station)}
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenConfig(station)}
                        title="Configurar tarifas"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal de Detalles */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {selectedStation?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedStation?.address}, {selectedStation?.city}
            </DialogDescription>
          </DialogHeader>

          {selectedStation && (
            <div className="space-y-4">
              {/* Estado */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                {getStatusBadge(selectedStation.isOnline, selectedStation.isActive)}
              </div>

              {/* Conectores */}
              <div>
                <Label className="text-muted-foreground">Conectores</Label>
                <div className="mt-2 space-y-2">
                  {selectedStation.evses && selectedStation.evses.length > 0 ? (
                    selectedStation.evses.map((evse) => (
                      <div
                        key={evse.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              #{evse.connectorId} - {getConnectorTypeName(evse.connectorType)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {evse.powerKw} kW • {parseFloat(evse.powerKw) > 22 ? "DC" : "AC"}
                            </div>
                          </div>
                        </div>
                        {getConnectorStatusBadge(evse.status)}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay conectores configurados
                    </p>
                  )}
                </div>
              </div>

              {/* Historial de Precios (si hay datos) */}
              {priceHistory && priceHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Historial de Precios (7 días)
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {priceHistory.length} registros
                    </Badge>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    {/* Mini gráfica sparkline */}
                    <div className="mb-3">
                      {renderPriceSparkline(priceHistory)}
                    </div>
                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground">Mínimo</div>
                        <div className="font-semibold text-green-600">
                          {formatCurrency(Math.min(...priceHistory.map(h => h.avgPrice)))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Promedio</div>
                        <div className="font-semibold">
                          {formatCurrency(
                            priceHistory.reduce((sum, h) => sum + h.avgPrice, 0) / priceHistory.length
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Máximo</div>
                        <div className="font-semibold text-red-600">
                          {formatCurrency(Math.max(...priceHistory.map(h => h.avgPrice)))}
                        </div>
                      </div>
                    </div>
                    {/* Botón de exportar CSV */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportPriceHistoryCSV}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Exportar CSV
                      </Button>
                    </div>
                    {/* Demanda predominante */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">Demanda predominante</div>
                      <div className="flex gap-1">
                        {(() => {
                          const demandCounts = priceHistory.reduce((acc, h) => {
                            acc[h.demandLevel] = (acc[h.demandLevel] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          return Object.entries(demandCounts).map(([level, count]) => (
                            <div key={level} className="flex items-center gap-1">
                              {getDemandLevelBadge(level)}
                              <span className="text-xs text-muted-foreground">({count})</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tarifas */}
              {selectedStation.tariff && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-muted-foreground">Tarifas Actuales</Label>
                    {selectedStation.tariff.autoPricing && (
                      <Badge className="bg-purple-100 text-purple-700">
                        <Brain className="w-3 h-3 mr-1" />
                        Precio Automático IA
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Precio por kWh</div>
                      <div className="font-bold text-lg">
                        {selectedStation.tariff.autoPricing ? (
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Dinámico
                          </span>
                        ) : (
                          formatCurrency(parseFloat(selectedStation.tariff.pricePerKwh))
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Tarifa de reserva</div>
                      <div className="font-bold text-lg">
                        {formatCurrency(parseFloat(selectedStation.tariff.reservationFee))}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Penalización/min</div>
                      <div className="font-bold text-lg">
                        {formatCurrency(parseFloat(selectedStation.tariff.idleFeePerMin))}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Tarifa conexión</div>
                      <div className="font-bold text-lg">
                        {formatCurrency(parseFloat(selectedStation.tariff.connectionFee))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleOpenConfig(selectedStation);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar Tarifas
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => window.open(
                    `https://www.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`,
                    "_blank"
                  )}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver en Mapa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración de Tarifas */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurar Tarifas
            </DialogTitle>
            <DialogDescription>
              {selectedStation?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Toggle Precio Automático IA */}
            <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <Label htmlFor="autoPricing" className="font-semibold cursor-pointer">
                      Precio Automático IA
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      La IA ajusta el precio según demanda y horario
                    </p>
                  </div>
                </div>
                <Switch
                  id="autoPricing"
                  checked={autoPricing}
                  onCheckedChange={setAutoPricing}
                />
              </div>
              
              {autoPricing && (
                <div className="mt-3 p-3 bg-purple-100/50 dark:bg-purple-900/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      El precio se ajustará automáticamente entre <strong>{formatCurrency(priceRanges?.minPrice || 560)} - {formatCurrency(priceRanges?.maxPrice || 2400)}/kWh</strong> basado en:
                      <ul className="mt-1 ml-4 list-disc text-xs">
                        <li>Ocupación de conectores (40%)</li>
                        <li>Horario pico/valle (30%)</li>
                        <li>Día de la semana (15%)</li>
                        <li>Demanda histórica (15%)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Precio sugerido (solo si modo manual) */}
            {!autoPricing && suggestedPriceData && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Precio sugerido por IA
                    </span>
                  </div>
                  {getDemandLevelBadge(suggestedPriceData.demandLevel)}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {formatCurrency(suggestedPriceData.suggestedPrice)}/kWh
                    </div>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                      {suggestedPriceData.explanation}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={handleUseSuggestedPrice}
                  >
                    Usar
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Campos de precio manual */}
            <div className={`space-y-4 transition-opacity ${autoPricing ? "opacity-50 pointer-events-none" : ""}`}>
              <div>
                <Label htmlFor="pricePerKwh">Precio por kWh (COP)</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pricePerKwh"
                    type="number"
                    value={pricePerKwh}
                    onChange={(e) => setPricePerKwh(e.target.value)}
                    className="pl-10"
                    placeholder="1200"
                    disabled={autoPricing}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Precio base por kilovatio-hora
                </p>
              </div>

              <div>
                <Label htmlFor="reservationFee">Tarifa de Reserva (COP)</Label>
                <div className="relative mt-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reservationFee"
                    type="number"
                    value={reservationFee}
                    onChange={(e) => setReservationFee(e.target.value)}
                    className="pl-10"
                    placeholder="5000"
                    disabled={autoPricing}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cargo fijo por reservar un conector
                </p>
              </div>

              <div>
                <Label htmlFor="idleFee">Penalización por Ocupación (COP/min)</Label>
                <div className="relative mt-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="idleFee"
                    type="number"
                    value={idleFee}
                    onChange={(e) => setIdleFee(e.target.value)}
                    className="pl-10"
                    placeholder="500"
                    disabled={autoPricing}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cargo por minuto si el vehículo permanece conectado después de cargar
                </p>
              </div>

              <div>
                <Label htmlFor="connectionFee">Tarifa de Conexión (COP)</Label>
                <div className="relative mt-1">
                  <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="connectionFee"
                    type="number"
                    value={connectionFee}
                    onChange={(e) => setConnectionFee(e.target.value)}
                    className="pl-10"
                    placeholder="2000"
                    disabled={autoPricing}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cargo fijo por iniciar una sesión de carga
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfigModal(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveTariff}
                disabled={updateTariff.isPending}
              >
                {updateTariff.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
