import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, MapPin, Zap, Settings, Eye, TrendingUp, ExternalLink, Battery, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

// Tipo para estación
interface Station {
  id: number;
  name: string;
  ocppIdentity?: string;
  address: string;
  city: string;
  department?: string | null;
  latitude: string;
  longitude: string;
  isOnline: boolean;
  isActive: boolean;
  isPublic: boolean;
  description?: string;
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

  const { data: stations, isLoading } = trpc.stations.listOwned.useQuery();
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
    } else {
      setPricePerKwh("1200");
      setReservationFee("5000");
      setIdleFee("500");
      setConnectionFee("2000");
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
    });
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
              <TableHead>Ingresos del mes</TableHead>
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
                  <TableCell>{formatCurrency(0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleViewDetails(station as Station)}
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenConfig(station as Station)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {selectedStation?.name}
            </DialogTitle>
            <DialogDescription>
              ID: {selectedStation?.ocppIdentity || `GEV-${selectedStation?.id}`}
            </DialogDescription>
          </DialogHeader>

          {selectedStation && (
            <div className="space-y-6">
              {/* Estado y ubicación */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedStation.isOnline, selectedStation.isActive)}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Visibilidad</Label>
                  <div className="mt-1">
                    <Badge variant={selectedStation.isPublic ? "default" : "secondary"}>
                      {selectedStation.isPublic ? "Pública" : "Privada"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <Label className="text-muted-foreground">Dirección</Label>
                <p className="mt-1">{selectedStation.address}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedStation.city}, {selectedStation.department || 'Colombia'}
                </p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={() => window.open(
                    `https://www.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`,
                    "_blank"
                  )}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Ver en Google Maps
                </Button>
              </div>

              {/* Descripción */}
              {selectedStation.description && (
                <div>
                  <Label className="text-muted-foreground">Descripción</Label>
                  <p className="mt-1 text-sm">{selectedStation.description}</p>
                </div>
              )}

              {/* Conectores */}
              <div>
                <Label className="text-muted-foreground">
                  Conectores ({selectedStation.evses?.length || 0})
                </Label>
                <div className="mt-2 space-y-2">
                  {selectedStation.evses?.length ? (
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

              {/* Tarifas */}
              {selectedStation.tariff && (
                <div>
                  <Label className="text-muted-foreground">Tarifas Actuales</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">Precio por kWh</div>
                      <div className="font-bold text-lg">
                        {formatCurrency(parseFloat(selectedStation.tariff.pricePerKwh))}
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
        <DialogContent>
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
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cargo fijo por iniciar una sesión de carga
              </p>
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
