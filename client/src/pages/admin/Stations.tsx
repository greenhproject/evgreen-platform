import { useState, useEffect, memo, useCallback } from "react";
import { useLocation } from "wouter";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, MapPin, Zap, Settings, Eye, Pencil, Trash2, X, QrCode, FileText, Wifi, WifiOff, ExternalLink, Activity } from "lucide-react";
import { toast } from "sonner";
import { StationQRCode } from "@/components/StationQRCode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos de conectores disponibles según OCPI
const CONNECTOR_TYPES = [
  { value: "TYPE_1", label: "Tipo 1 (J1772)", power: "7.4kW AC" },
  { value: "TYPE_2", label: "Tipo 2 (Mennekes)", power: "22kW AC" },
  { value: "CCS_1", label: "CCS Combo 1", power: "50-350kW DC" },
  { value: "CCS_2", label: "CCS Combo 2", power: "50-350kW DC" },
  { value: "CHADEMO", label: "CHAdeMO", power: "50kW DC" },
  { value: "TESLA", label: "Tesla Supercharger", power: "250kW DC" },
  { value: "GBT_AC", label: "GB/T AC", power: "7-22kW AC" },
  { value: "GBT_DC", label: "GB/T DC", power: "50-250kW DC" },
];

interface ConnectorConfig {
  id: string;
  type: string;
  powerKw: number;
  quantity: number;
}

interface StationFormData {
  name: string;
  description: string;
  ownerId: string;
  address: string;
  city: string;
  department: string;
  latitude: string;
  longitude: string;
  ocppIdentity: string;
  isActive: boolean;
  isPublic: boolean;
}

const initialFormData: StationFormData = {
  name: "",
  description: "",
  ownerId: "",
  address: "",
  city: "",
  department: "",
  latitude: "4.7110",
  longitude: "-74.0721",
  ocppIdentity: "",
  isActive: true,
  isPublic: true,
};

export default function AdminStations() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [stationToDelete, setStationToDelete] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [viewingStation, setViewingStation] = useState<any>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrStation, setQrStation] = useState<any>(null);
  const [detailsTab, setDetailsTab] = useState("info");
  
  // Estado del formulario
  const [formData, setFormData] = useState<StationFormData>(initialFormData);
  
  // Estado de conectores
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [newConnector, setNewConnector] = useState({
    type: "",
    powerKw: 22,
    quantity: 1,
  });

  const { data: stations, isLoading, refetch } = trpc.stations.listAll.useQuery();
  
  // Obtener conexiones OCPP activas para mostrar estado real
  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });
  
  // Función para verificar si una estación está conectada por OCPP
  const isStationConnectedOCPP = (station: any) => {
    if (!ocppConnections) return false;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.some((conn: any) => 
      conn.ocppIdentity === ocppId || 
      conn.stationId === station.id
    );
  };
  
  // Obtener información de conexión OCPP de una estación
  const getOCPPConnectionInfo = (station: any) => {
    if (!ocppConnections) return null;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.find((conn: any) => 
      conn.ocppIdentity === ocppId || 
      conn.stationId === station.id
    );
  };
  
  const createStationMutation = trpc.stations.create.useMutation({
    onError: (error) => {
      toast.error(`Error al crear estación: ${error.message}`);
    },
  });

  const updateStationMutation = trpc.stations.update.useMutation({
    onSuccess: () => {
      toast.success("Estación actualizada exitosamente");
      setShowEditDialog(false);
      setEditingStation(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Error al actualizar estación: ${error.message}`);
    },
  });

  const createEvseMutation = trpc.evses.create.useMutation({
    onError: (error: any) => {
      toast.error(`Error al crear conector: ${error.message}`);
    },
  });

  const updateEvseMutation = trpc.evses.update.useMutation({
    onSuccess: () => {
      toast.success("Conector actualizado");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar conector: ${error.message}`);
    },
  });

  const deleteEvseMutation = trpc.evses.delete.useMutation({
    onSuccess: () => {
      toast.success("Conector eliminado");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar conector: ${error.message}`);
    },
  });

  const deleteStationMutation = trpc.stations.delete.useMutation({
    onSuccess: () => {
      toast.success("Estación eliminada exitosamente");
      setShowDeleteConfirm(false);
      setStationToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Error al eliminar estación: ${error.message}`);
    },
  });

  const handleDeleteStation = async () => {
    if (!stationToDelete) return;
    await deleteStationMutation.mutateAsync({ id: stationToDelete.id });
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setConnectors([]);
  };

  // Cargar datos de estación para editar
  const loadStationForEdit = (station: any) => {
    setEditingStation(station);
    setFormData({
      name: station.name || "",
      description: station.description || "",
      ownerId: station.ownerId?.toString() || "",
      address: station.address || "",
      city: station.city || "",
      department: station.department || "",
      latitude: station.latitude?.toString() || "4.7110",
      longitude: station.longitude?.toString() || "-74.0721",
      ocppIdentity: station.ocppIdentity || "",
      isActive: station.isActive ?? true,
      isPublic: station.isPublic ?? true,
    });
    
    // Cargar conectores existentes
    if (station.evses && Array.isArray(station.evses)) {
      const existingConnectors: ConnectorConfig[] = [];
      const typeCounts: Record<string, { powerKw: number; count: number }> = {};
      
      station.evses.forEach((evse: any) => {
        const type = evse.connectorType || "TYPE_2";
        const power = parseFloat(evse.powerKw) || 22;
        const key = `${type}-${power}`;
        
        if (typeCounts[key]) {
          typeCounts[key].count++;
        } else {
          typeCounts[key] = { powerKw: power, count: 1 };
        }
      });
      
      Object.entries(typeCounts).forEach(([key, value]) => {
        const [type] = key.split("-");
        existingConnectors.push({
          id: `existing-${key}`,
          type,
          powerKw: value.powerKw,
          quantity: value.count,
        });
      });
      
      setConnectors(existingConnectors);
    } else {
      setConnectors([]);
    }
    
    setShowEditDialog(true);
  };

  const addConnector = () => {
    if (!newConnector.type) {
      toast.error("Selecciona un tipo de conector");
      return;
    }
    
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
      const stationResult = await createStationMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        ownerId: formData.ownerId ? parseInt(formData.ownerId) : 1,
        address: formData.address,
        city: formData.city,
        department: formData.department || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        ocppIdentity: formData.ocppIdentity || `GEV-${Date.now()}`,
      });
      
      if (stationResult.id) {
        let evseIdLocal = 1;
        for (const connector of connectors) {
          for (let i = 0; i < connector.quantity; i++) {
            await createEvseMutation.mutateAsync({
              stationId: stationResult.id,
              evseIdLocal: evseIdLocal++,
              connectorType: connector.type as "TYPE_1" | "TYPE_2" | "CCS_1" | "CCS_2" | "CHADEMO" | "TESLA" | "GBT_AC" | "GBT_DC",
              chargeType: connector.type.includes("CCS") || connector.type === "CHADEMO" || connector.type === "TESLA" || connector.type === "GBT_DC" ? "DC" : "AC",
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

  const handleUpdateStation = async () => {
    if (!editingStation || !formData.name || !formData.address || !formData.city) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    try {
      // Actualizar datos de la estación
      await updateStationMutation.mutateAsync({
        id: editingStation.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          address: formData.address,
          city: formData.city,
          department: formData.department || undefined,
          latitude: formData.latitude,
          longitude: formData.longitude,
          isActive: formData.isActive,
          isPublic: formData.isPublic,
        },
      });

      // Crear nuevos conectores si hay alguno agregado
      const newConnectors = connectors.filter(c => c.id.startsWith('conn-'));
      if (newConnectors.length > 0) {
        // Obtener el último evseIdLocal existente
        const existingEvses = editingStation.evses || [];
        let evseIdLocal = existingEvses.length > 0 
          ? Math.max(...existingEvses.map((e: any) => e.evseIdLocal || 0)) + 1 
          : 1;
        
        for (const connector of newConnectors) {
          for (let i = 0; i < connector.quantity; i++) {
            await createEvseMutation.mutateAsync({
              stationId: editingStation.id,
              evseIdLocal: evseIdLocal++,
              connectorType: connector.type as "TYPE_1" | "TYPE_2" | "CCS_1" | "CCS_2" | "CHADEMO" | "TESLA" | "GBT_AC" | "GBT_DC",
              chargeType: connector.type.includes("CCS") || connector.type === "CHADEMO" || connector.type === "TESLA" || connector.type === "GBT_DC" ? "DC" : "AC",
              powerKw: connector.powerKw.toString(),
            });
          }
        }
        toast.success(`${newConnectors.reduce((acc, c) => acc + c.quantity, 0)} conector(es) agregado(s)`);
      }
    } catch (error) {
      // Error manejado en onError
    }
  };

  // Badge de estado mejorado con conexión OCPP real
  const getStatusBadge = (station: any) => {
    if (!station.isActive) return <Badge variant="secondary">Inactiva</Badge>;
    
    const isConnectedOCPP = isStationConnectedOCPP(station);
    const connInfo = getOCPPConnectionInfo(station);
    
    if (isConnectedOCPP) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          Conectado
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
        <WifiOff className="w-3 h-3" />
        Desconectado
      </Badge>
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

  const getConnectorCount = (station: any) => {
    if (station.evses && Array.isArray(station.evses)) {
      return station.evses.length;
    }
    return 0;
  };

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

  // Renderizar formulario inline para evitar pérdida de foco
  const renderStationForm = (isEdit: boolean) => (
    <div className="space-y-6">
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
              disabled={isEdit}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Descripción</Label>
            <Textarea 
              placeholder="Descripción de la estación (opcional)" 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
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
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
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
          <div className="space-y-2">
            <Label>Identidad OCPP</Label>
            <Input 
              placeholder="Identificador único del cargador" 
              value={formData.ocppIdentity}
              onChange={(e) => setFormData({...formData, ocppIdentity: e.target.value})}
              disabled={isEdit}
            />
          </div>
        </div>
      </div>

      {/* Estado (solo en edición) */}
      {isEdit && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Estado
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>Estación Activa</Label>
                <p className="text-xs text-muted-foreground">Habilitar o deshabilitar la estación</p>
              </div>
              <Switch 
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>Estación Pública</Label>
                <p className="text-xs text-muted-foreground">Visible para todos los usuarios</p>
              </div>
              <Switch 
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({...formData, isPublic: checked})}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conectores (solo en creación) */}
      {!isEdit && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Conectores / Puntos de Carga
          </h3>
          
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

          <div className="grid grid-cols-4 gap-3 p-4 border border-dashed rounded-lg">
            <div className="space-y-2">
              <Label className="text-xs">Tipo de Conector</Label>
              <Select 
                value={newConnector.type} 
                onValueChange={(value) => {
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
      )}

      {/* Conectores en edición */}
      {isEdit && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Conectores / Puntos de Carga
          </h3>
          
          {/* Conectores existentes */}
          {editingStation?.evses && editingStation.evses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Conectores existentes ({editingStation.evses.length}):</p>
              {editingStation.evses.map((evse: any, index: number) => (
                <div 
                  key={evse.id || index} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-2"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        #{evse.evseIdLocal || index + 1} - {getConnectorLabel(evse.connectorType)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {evse.powerKw} kW • {evse.chargeType}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={evse.status}
                      onValueChange={async (newStatus) => {
                        await updateEvseMutation.mutateAsync({
                          id: evse.id,
                          data: { status: newStatus as "AVAILABLE" | "UNAVAILABLE" | "FAULTED" }
                        });
                        // Actualizar estado local
                        setEditingStation((prev: any) => ({
                          ...prev,
                          evses: prev.evses.map((e: any) => 
                            e.id === evse.id ? { ...e, status: newStatus } : e
                          )
                        }));
                      }}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AVAILABLE">Disponible</SelectItem>
                        <SelectItem value="UNAVAILABLE">No disponible</SelectItem>
                        <SelectItem value="FAULTED">Con falla</SelectItem>
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar conector</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de eliminar el conector #{evse.evseIdLocal || index + 1} ({getConnectorLabel(evse.connectorType)})? Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              await deleteEvseMutation.mutateAsync({ id: evse.id });
                              // Actualizar estado local
                              setEditingStation((prev: any) => ({
                                ...prev,
                                evses: prev.evses.filter((e: any) => e.id !== evse.id)
                              }));
                            }}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nuevos conectores a agregar */}
          {connectors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-green-500">Nuevos conectores a agregar:</p>
              {connectors.filter(c => c.id.startsWith('conn-')).map((connector) => (
                <div 
                  key={connector.id} 
                  className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="font-medium text-green-400">{getConnectorLabel(connector.type)}</div>
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

          {/* Formulario para agregar nuevos conectores */}
          <div className="p-4 border border-dashed border-green-500/50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Conector</Label>
                <Select 
                  value={newConnector.type} 
                  onValueChange={(value) => {
                    const defaultPower = value.includes("CCS") ? 150 : 
                                        value === "CHADEMO" ? 50 : 
                                        value === "TESLA" ? 250 :
                                        value === "GBT_DC" ? 150 : 22;
                    setNewConnector({...newConnector, type: value, powerKw: defaultPower});
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTOR_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} ({type.power})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Potencia (kW)</Label>
                  <Input 
                    type="number" 
                    value={newConnector.powerKw}
                    onChange={(e) => setNewConnector({...newConnector, powerKw: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cantidad</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={newConnector.quantity}
                    onChange={(e) => setNewConnector({...newConnector, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full border-green-500/50 text-green-500 hover:bg-green-500/10"
              onClick={addConnector}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Conector
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Los nuevos conectores se agregarán al guardar los cambios
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estaciones de Carga</h1>
          <p className="text-muted-foreground">
            Gestiona todas las estaciones de la red Green EV
          </p>
        </div>
        
        {/* Diálogo de Crear */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetForm();
        }}>
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
            
            {renderStationForm(false)}

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

        {/* Diálogo de Editar */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingStation(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar estación: {editingStation?.name}</DialogTitle>
            </DialogHeader>
            
            {renderStationForm(true)}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => {
                setShowEditDialog(false);
                setEditingStation(null);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateStation}
                disabled={updateStationMutation.isPending}
              >
                {updateStationMutation.isPending ? "Guardando..." : "Guardar cambios"}
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
              <TableHead className="text-right">Acciones</TableHead>
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
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {station.address}
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
                  <TableCell>{getStatusBadge(station)}</TableCell>
                  <TableCell>
                    {(station as any).lastHeartbeat
                      ? new Date((station as any).lastHeartbeat).toLocaleString("es-CO")
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => loadStationForEdit(station)}
                        title="Editar estación"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Ver detalles"
                        onClick={() => {
                          setViewingStation(station);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          setStationToDelete(station);
                          setShowDeleteConfirm(true);
                        }}
                        title="Eliminar estación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar estación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la estación <strong>{stationToDelete?.name}</strong>?
              Esta acción no se puede deshacer y eliminará también todos los conectores asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStationToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeleteStation}
              disabled={deleteStationMutation.isPending}
            >
              {deleteStationMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de ver detalles de estación con Tabs */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) {
          setViewingStation(null);
          setDetailsTab("info");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {viewingStation?.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span>ID: {viewingStation?.ocppIdentity || 'Sin ID OCPP'}</span>
              {viewingStation && getStatusBadge(viewingStation)}
            </DialogDescription>
          </DialogHeader>

          {viewingStation && (
            <Tabs value={detailsTab} onValueChange={setDetailsTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  Información
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-1">
                  <QrCode className="w-4 h-4" />
                  Código QR
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  Logs OCPP
                </TabsTrigger>
              </TabsList>
              
              {/* Tab de Información */}
              <TabsContent value="info" className="space-y-6 mt-4">
                {/* Estado general */}
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant={viewingStation.isActive ? "default" : "secondary"}>
                    {viewingStation.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                  <Badge variant={viewingStation.isPublic ? "outline" : "secondary"}>
                    {viewingStation.isPublic ? "Pública" : "Privada"}
                  </Badge>
                  {(() => {
                    const connInfo = getOCPPConnectionInfo(viewingStation);
                    if (connInfo) {
                      return (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          OCPP {connInfo.ocppVersion || '1.6'}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>

              {/* Información de ubicación */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Ubicación</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="font-medium">{viewingStation.address}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ciudad</p>
                    <p className="font-medium">{viewingStation.city}, {viewingStation.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coordenadas</p>
                    <p className="font-medium text-sm">
                      {viewingStation.latitude}, {viewingStation.longitude}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Propietario ID</p>
                    <p className="font-medium">{viewingStation.ownerId || 'Sin asignar'}</p>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              {viewingStation.description && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Descripción</h4>
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                    {viewingStation.description}
                  </p>
                </div>
              )}

              {/* Conectores */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Conectores ({viewingStation.evses?.length || 0})
                </h4>
                {viewingStation.evses && viewingStation.evses.length > 0 ? (
                  <div className="space-y-2">
                    {viewingStation.evses.map((evse: any, index: number) => (
                      <div 
                        key={evse.id || index} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            evse.status === 'AVAILABLE' ? 'bg-green-500/20' : 
                            evse.status === 'CHARGING' ? 'bg-blue-500/20' : 'bg-muted'
                          }`}>
                            <Zap className={`w-5 h-5 ${
                              evse.status === 'AVAILABLE' ? 'text-green-500' : 
                              evse.status === 'CHARGING' ? 'text-blue-500' : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              #{evse.evseIdLocal || index + 1} - {getConnectorLabel(evse.connectorType)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {evse.powerKw} kW • {evse.chargeType}
                            </div>
                          </div>
                        </div>
                        <Badge variant={
                          evse.status === 'AVAILABLE' ? 'default' : 
                          evse.status === 'CHARGING' ? 'secondary' : 'outline'
                        }>
                          {evse.status === 'AVAILABLE' ? 'Disponible' : 
                           evse.status === 'CHARGING' ? 'Cargando' : 
                           evse.status === 'UNAVAILABLE' ? 'No disponible' : evse.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
                    No hay conectores configurados
                  </p>
                )}
              </div>

              {/* Estadísticas rápidas */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Estadísticas</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">
                      {viewingStation.evses?.filter((e: any) => e.status === 'AVAILABLE').length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Disponibles</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {viewingStation.evses?.filter((e: any) => e.status === 'CHARGING').length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Cargando</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold">
                      {viewingStation.evses?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {viewingStation.evses?.filter((e: any) => e.chargeType === 'DC').length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">DC Rápidos</p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    loadStationForEdit(viewingStation);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar estación
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    window.open(`https://www.google.com/maps?q=${viewingStation.latitude},${viewingStation.longitude}`, '_blank');
                  }}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Ver en mapa
                </Button>
              </div>
              </TabsContent>
              
              {/* Tab de Código QR */}
              <TabsContent value="qr" className="mt-4">
                <StationQRCode 
                  stationCode={viewingStation.ocppIdentity || `ST-${viewingStation.id}`}
                  stationName={viewingStation.name}
                  stationAddress={viewingStation.address}
                />
              </TabsContent>
              
              {/* Tab de Logs OCPP */}
              <TabsContent value="logs" className="space-y-4 mt-4">
                {/* Info de conexión OCPP */}
                {(() => {
                  const connInfo = getOCPPConnectionInfo(viewingStation);
                  if (connInfo) {
                    return (
                      <Card className="bg-green-500/10 border-green-500/30">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Wifi className="w-5 h-5 text-green-500" />
                            <span className="font-semibold text-green-400">Cargador Conectado</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Versión OCPP</p>
                              <p className="font-medium">{connInfo.ocppVersion || '1.6'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Conectado desde</p>
                              <p className="font-medium">
                                {connInfo.connectedAt ? new Date(connInfo.connectedAt).toLocaleString('es-CO') : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Último heartbeat</p>
                              <p className="font-medium">
                                {connInfo.lastHeartbeat ? new Date(connInfo.lastHeartbeat).toLocaleString('es-CO') : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Identidad OCPP</p>
                              <p className="font-medium font-mono text-xs">{connInfo.ocppIdentity}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  }
                  return (
                    <Card className="bg-red-500/10 border-red-500/30">
                      <div className="p-4 flex items-center gap-3">
                        <WifiOff className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="font-semibold text-red-400">Cargador Desconectado</p>
                          <p className="text-sm text-muted-foreground">No hay conexión OCPP activa para este cargador</p>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
                
                {/* Botón para ver logs completos */}
                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full"
                    onClick={() => {
                      const ocppId = viewingStation.ocppIdentity || viewingStation.id;
                      navigate(`/admin/ocpp-monitor?filter=${encodeURIComponent(ocppId)}`);
                      setShowDetailsDialog(false);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver logs completos en Monitor OCPP
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    El monitor OCPP muestra todos los mensajes de comunicación con el cargador
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
