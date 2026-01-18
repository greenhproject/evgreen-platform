import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, MapPin, Zap, Settings, Eye, Trash2, X } from "lucide-react";
import { toast } from "sonner";

// Tipos de conectores disponibles según OCPI
const CONNECTOR_TYPES = [
  { value: "TYPE_1", label: "Tipo 1 (J1772)", power: "7.4kW AC" },
  { value: "TYPE_2", label: "Tipo 2 (Mennekes)", power: "22kW AC" },
  { value: "CCS_1", label: "CCS Combo 1", power: "50-350kW DC" },
  { value: "CCS_2", label: "CCS Combo 2", power: "50-350kW DC" },
  { value: "CHADEMO", label: "CHAdeMO", power: "50kW DC" },
  { value: "TESLA", label: "Tesla Supercharger", power: "250kW DC" },
];

interface ConnectorConfig {
  id: string;
  type: string;
  powerKw: number;
  quantity: number;
}

export default function AdminStations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    name: "",
    ownerId: "",
    address: "",
    city: "",
    state: "",
    latitude: "4.7110",
    longitude: "-74.0721",
    ocppIdentity: "",
  });
  
  // Estado de conectores
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [newConnector, setNewConnector] = useState({
    type: "",
    powerKw: 22,
    quantity: 1,
  });

  const { data: stations, isLoading, refetch } = trpc.stations.listAll.useQuery();
  const createStationMutation = trpc.stations.create.useMutation({
    onError: (error) => {
      toast.error(`Error al crear estación: ${error.message}`);
    },
  });

  const createEvseMutation = trpc.evses.create.useMutation({
    onError: (error: any) => {
      toast.error(`Error al crear conector: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      ownerId: "",
      address: "",
      city: "",
      state: "",
      latitude: "4.7110",
      longitude: "-74.0721",
      ocppIdentity: "",
    });
    setConnectors([]);
  };

  const addConnector = () => {
    if (!newConnector.type) {
      toast.error("Selecciona un tipo de conector");
      return;
    }
    
    const connectorType = CONNECTOR_TYPES.find(c => c.value === newConnector.type);
    setConnectors([
      ...connectors,
      {
        id: `conn-${Date.now()}`,
        type: newConnector.type,
        powerKw: newConnector.powerKw,
        quantity: newConnector.quantity,
      },
    ]);
    setNewConnector({ type: "", powerKw: 22, quantity: 1 });
  };

  const removeConnector = (id: string) => {
    setConnectors(connectors.filter(c => c.id !== id));
  };

  const handleCreateStation = async () => {
    if (!formData.name || !formData.address || !formData.city) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    if (connectors.length === 0) {
      toast.error("Agrega al menos un conector");
      return;
    }

    try {
      // Primero crear la estación
      const stationResult = await createStationMutation.mutateAsync({
        name: formData.name,
        ownerId: formData.ownerId ? parseInt(formData.ownerId) : 1, // Default owner
        address: formData.address,
        city: formData.city,
        department: formData.state,
        latitude: formData.latitude,
        longitude: formData.longitude,
        ocppIdentity: formData.ocppIdentity || `GEV-${Date.now()}`,
      });
      
      // Luego crear los EVSEs/conectores
      if (stationResult.id) {
        let evseIdLocal = 1;
        for (const connector of connectors) {
          for (let i = 0; i < connector.quantity; i++) {
            await createEvseMutation.mutateAsync({
              stationId: stationResult.id,
              evseIdLocal: evseIdLocal++,
              connectorType: connector.type as "TYPE_2" | "CCS_2" | "CHADEMO" | "TYPE_1",
              chargeType: connector.type.includes("CCS") || connector.type === "CHADEMO" ? "DC" : "AC",
              powerKw: connector.powerKw.toString(),
            });
          }
        }
      }
      
      toast.success("Estación creada exitosamente con " + connectors.reduce((acc, c) => acc + c.quantity, 0) + " conectores");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    } catch (error) {
      // Error manejado en onError
    }
  };

  const getStatusBadge = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactiva</Badge>;
    return isOnline ? (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">En línea</Badge>
    ) : (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Fuera de línea</Badge>
    );
  };

  const getConnectorLabel = (type: string) => {
    return CONNECTOR_TYPES.find(c => c.value === type)?.label || type;
  };

  const filteredStations = stations?.filter((station) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        station.name.toLowerCase().includes(query) ||
        station.address.toLowerCase().includes(query) ||
        station.city.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calcular total de conectores por estación
  const getConnectorCount = (station: any) => {
    if (station.evses && Array.isArray(station.evses)) {
      return station.evses.length;
    }
    return 0;
  };

  // Obtener resumen de tipos de conectores
  const getConnectorSummary = (station: any) => {
    if (!station.evses || !Array.isArray(station.evses) || station.evses.length === 0) {
      return "Sin conectores";
    }
    
    const typeCounts: Record<string, number> = {};
    station.evses.forEach((evse: any) => {
      const type = evse.connectorType || "UNKNOWN";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([type, count]) => `${count}x ${type.replace("_", " ")}`)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estaciones de Carga</h1>
          <p className="text-muted-foreground">
            Gestiona todas las estaciones de la red Green EV
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva estación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear nueva estación</DialogTitle>
            </DialogHeader>
            
            {/* Información básica */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Información Básica
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input 
                    placeholder="Nombre de la estación" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Propietario (ID)</Label>
                  <Input 
                    placeholder="ID del inversionista" 
                    type="number"
                    value={formData.ownerId}
                    onChange={(e) => setFormData({...formData, ownerId: e.target.value})}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Dirección *</Label>
                  <Input 
                    placeholder="Dirección completa" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad *</Label>
                  <Input 
                    placeholder="Ciudad" 
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input 
                    placeholder="Departamento" 
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Latitud</Label>
                  <Input 
                    placeholder="4.7110" 
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitud</Label>
                  <Input 
                    placeholder="-74.0721" 
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Identidad OCPP</Label>
                  <Input 
                    placeholder="Identificador único del cargador (se genera automáticamente si se deja vacío)" 
                    value={formData.ocppIdentity}
                    onChange={(e) => setFormData({...formData, ocppIdentity: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Conectores */}
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Conectores / Puntos de Carga
              </h3>
              
              {/* Lista de conectores agregados */}
              {connectors.length > 0 && (
                <div className="space-y-2">
                  {connectors.map((connector) => (
                    <div 
                      key={connector.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{getConnectorLabel(connector.type)}</div>
                          <div className="text-sm text-muted-foreground">
                            {connector.powerKw} kW × {connector.quantity} unidad(es)
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeConnector(connector.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar nuevo conector */}
              <div className="grid grid-cols-4 gap-3 p-4 border border-dashed rounded-lg">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Conector</Label>
                  <Select 
                    value={newConnector.type} 
                    onValueChange={(value) => {
                      const connType = CONNECTOR_TYPES.find(c => c.value === value);
                      const defaultPower = value.includes("CCS") ? 150 : 
                                          value === "CHADEMO" ? 50 : 
                                          value === "TESLA" ? 250 : 22;
                      setNewConnector({...newConnector, type: value, powerKw: defaultPower});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONNECTOR_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Potencia (kW)</Label>
                  <Input 
                    type="number" 
                    value={newConnector.powerKw}
                    onChange={(e) => setNewConnector({...newConnector, powerKw: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cantidad</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={newConnector.quantity}
                    onChange={(e) => setNewConnector({...newConnector, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={addConnector}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>

              {connectors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Agrega al menos un conector para la estación
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateStation}
                disabled={createStationMutation.isPending}
              >
                {createStationMutation.isPending ? "Creando..." : "Crear estación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stations?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total estaciones</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => s.isOnline).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">En línea</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => !s.isOnline && s.isActive).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Fuera de línea</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter((s) => !s.isActive).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Inactivas</div>
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
              placeholder="Buscar por nombre, dirección o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Tabla de estaciones */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Conectores</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última conexión</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando estaciones...
                </TableCell>
              </TableRow>
            ) : filteredStations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay estaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredStations?.map((station) => (
                <TableRow key={station.id}>
                  <TableCell>
                    <div className="font-medium">{station.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {station.ocppIdentity || station.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {station.city}
                    </div>
                  </TableCell>
                  <TableCell>ID: {station.ownerId || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{getConnectorCount(station)}</span>
                      <span className="text-muted-foreground ml-1">conectores</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getConnectorSummary(station)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(station.isOnline, station.isActive)}</TableCell>
                  <TableCell>
                    {(station as any).lastHeartbeat
                      ? new Date((station as any).lastHeartbeat).toLocaleString("es-CO")
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
