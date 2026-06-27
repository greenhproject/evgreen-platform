import { useState, useEffect, memo, useCallback, useRef } from "react";
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
import { Search, Plus, MapPin, Zap, Settings, Eye, Pencil, Trash2, X, QrCode, FileText, Wifi, WifiOff, ExternalLink, Activity, Crown, DollarSign, Clock, Cpu, ImagePlus, Loader2, Map, List } from "lucide-react";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { StationQRCode } from "@/components/StationQRCode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Zonas premium con fee adicional
const PREMIUM_ZONES = [
  { value: "A", label: "Zona Premium A", description: "Usaquén, Chapinero, Zona T", fee: 5000000 },
  { value: "B", label: "Zona Premium B", description: "Suba Norte, Cedritos, Santa Bárbara", fee: 3000000 },
  { value: "C", label: "Zona Estándar", description: "Otras zonas de la ciudad", fee: 0 },
];

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
  premiumZone: string;
  operatingHours: Record<string, { open: string; close: string; closed?: boolean }>;
  imageUrl: string;
  // Modelo financiero configurable
  evgreenSharePercent: string;
  investorSharePercent: string;
  hostSharePercent: string;
  energyPurchaseCostPerKwh: string;
  hostName: string;
  hostUserId: string;
  parkingRatePerMinute: string;
  occupancyRatePerMinute: string;
  timezone: string;
  country: string;
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
  premiumZone: "C",
  imageUrl: "",
  // Modelo financiero configurable
  evgreenSharePercent: "30",
  investorSharePercent: "70",
  hostSharePercent: "0",
  energyPurchaseCostPerKwh: "850",
  hostName: "",
  hostUserId: "",
  parkingRatePerMinute: "0",
  occupancyRatePerMinute: "0",
  timezone: "America/Bogota",
  country: "Colombia",
  operatingHours: {
    monday: { open: "06:00", close: "22:00" },
    tuesday: { open: "06:00", close: "22:00" },
    wednesday: { open: "06:00", close: "22:00" },
    thursday: { open: "06:00", close: "22:00" },
    friday: { open: "06:00", close: "22:00" },
    saturday: { open: "07:00", close: "20:00" },
    sunday: { open: "08:00", close: "18:00" },
  },
};

export default function AdminStations() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
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
  
  // Estado de marca/modelo de cargador
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  
  // Estado de imagen de estación
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Estado de conectores
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [newConnector, setNewConnector] = useState({
    type: "",
    powerKw: 22,
    quantity: 1,
  });

  const { data: stations, isLoading, refetch } = trpc.stations.listAll.useQuery();
  
  // Obtener perfiles de marca de cargador
  const { data: chargerBrands } = trpc.chargerBrands.list.useQuery();
  
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

  const uploadImageMutation = trpc.stations.uploadImage.useMutation({
    onError: (error: any) => {
      toast.error(`Error al subir imagen: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setConnectors([]);
    setSelectedBrandId(null);
    setImageFile(null);
    setImagePreview(null);
  };
  
  // Autoconfigurar estación al seleccionar marca de cargador
  const handleBrandSelect = (brandId: string) => {
    if (brandId === "none") {
      setSelectedBrandId(null);
      return;
    }
    const id = parseInt(brandId);
    setSelectedBrandId(id);
    const brand = chargerBrands?.find((b: any) => b.id === id);
    if (!brand) return;
    
    // Autoconfigurar conectores según la marca
    const supportedConnectors = brand.supportedConnectors ? 
      (typeof brand.supportedConnectors === 'string' ? JSON.parse(brand.supportedConnectors) : brand.supportedConnectors) : [];
    const defaultPower = parseFloat(brand.defaultPowerKw || '7');
    
    if (supportedConnectors.length > 0) {
      const autoConnectors: ConnectorConfig[] = supportedConnectors.map((connType: string, idx: number) => ({
        id: `brand-${idx}-${Date.now()}`,
        type: connType,
        powerKw: defaultPower,
        quantity: 1,
      }));
      setConnectors(autoConnectors);
    }
    
    // Actualizar potencia del nuevo conector por defecto
    setNewConnector(prev => ({
      ...prev,
      powerKw: defaultPower,
      type: supportedConnectors[0] || prev.type,
    }));
    
    toast.success(`Configuración de ${brand.displayName} aplicada: ${brand.chargeType} ${defaultPower} kW`);
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
      premiumZone: station.premiumZone || "C",
      imageUrl: station.imageUrl || "",
      // Modelo financiero
      evgreenSharePercent: station.evgreenSharePercent?.toString() || "30",
      investorSharePercent: station.investorSharePercent?.toString() || "70",
      hostSharePercent: station.hostSharePercent?.toString() || "0",
      energyPurchaseCostPerKwh: station.energyPurchaseCostPerKwh?.toString() || "850",
      hostName: station.hostName || "",
      hostUserId: station.hostUserId?.toString() || "",
      parkingRatePerMinute: (station.parkingRatePerMinute ?? 0).toString(),
      occupancyRatePerMinute: (station.occupancyRatePerMinute ?? 0).toString(),
      timezone: station.timezone || "America/Bogota",
      country: station.country || "Colombia",
      operatingHours: station.operatingHours && typeof station.operatingHours === 'object' 
        ? station.operatingHours as any 
        : initialFormData.operatingHours,
    });
    // Mostrar imagen existente como preview
    if (station.imageUrl) {
      setImagePreview(station.imageUrl);
    } else {
      setImagePreview(null);
    }
    setImageFile(null);
    
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
        operatingHours: formData.operatingHours as any,
        chargerBrandId: selectedBrandId || undefined,
        // Modelo financiero
        evgreenSharePercent: formData.evgreenSharePercent || "30",
        investorSharePercent: formData.investorSharePercent || "70",
        hostSharePercent: formData.hostSharePercent || "0",
        energyPurchaseCostPerKwh: formData.energyPurchaseCostPerKwh || "850",
        hostName: formData.hostName || undefined,
        hostUserId: formData.hostUserId ? parseInt(formData.hostUserId) : undefined,
        parkingRatePerMinute: parseInt(formData.parkingRatePerMinute || "0"),
        occupancyRatePerMinute: parseInt(formData.occupancyRatePerMinute || "0"),
        timezone: formData.timezone || "America/Bogota",
        country: formData.country || "Colombia",
      });
      
      // Si hay imagen seleccionada, subirla
      if (stationResult.id && imageFile) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(imageFile);
          });
          await uploadImageMutation.mutateAsync({
            stationId: stationResult.id,
            fileName: imageFile.name,
            fileBase64: base64,
            contentType: imageFile.type,
          });
        } catch (imgErr) {
          toast.error("Estación creada pero falló la subida de imagen");
        }
      }
      
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
          operatingHours: formData.operatingHours as any,
          // Modelo financiero
          evgreenSharePercent: formData.evgreenSharePercent || "30",
          investorSharePercent: formData.investorSharePercent || "70",
          hostSharePercent: formData.hostSharePercent || "0",
          energyPurchaseCostPerKwh: formData.energyPurchaseCostPerKwh || "850",
          hostName: formData.hostName || undefined,
          hostUserId: formData.hostUserId ? parseInt(formData.hostUserId) : undefined,
          parkingRatePerMinute: parseInt(formData.parkingRatePerMinute || "0"),
          occupancyRatePerMinute: parseInt(formData.occupancyRatePerMinute || "0"),
          timezone: formData.timezone || "America/Bogota",
          country: formData.country || "Colombia",
        },
      });

      // Si hay imagen seleccionada pendiente de subir, subirla automáticamente
      if (imageFile) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(imageFile);
          });
          const imgResult = await uploadImageMutation.mutateAsync({
            stationId: editingStation.id,
            fileName: imageFile.name,
            fileBase64: base64,
            contentType: imageFile.type,
          });
          toast.success(`Foto optimizada: ${imgResult.originalSizeKB}KB → ${imgResult.compressedSizeKB}KB (${imgResult.savings} menos)`);
          setImageFile(null);
          setImagePreview(null);
        } catch (imgErr) {
          toast.error("Estación actualizada pero falló la subida de imagen");
        }
      }

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
      {/* Perfil de Cargador */}
      {!isEdit && chargerBrands && chargerBrands.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Marca / Modelo del Cargador
          </h3>
          <Select
            value={selectedBrandId?.toString() || "none"}
            onValueChange={handleBrandSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona marca y modelo (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin perfil específico (Genérico)</SelectItem>
              {chargerBrands.map((brand: any) => (
                <SelectItem key={brand.id} value={brand.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{brand.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {brand.chargeType} · {brand.defaultPowerKw} kW · OCPP {brand.ocppVersion}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBrandId && (() => {
            const brand = chargerBrands.find((b: any) => b.id === selectedBrandId);
            if (!brand) return null;
            const measurands = brand.supportedMeasurands ? 
              (typeof brand.supportedMeasurands === 'string' ? JSON.parse(brand.supportedMeasurands) : brand.supportedMeasurands) : [];
            return (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{brand.displayName}</p>
                    <p className="text-xs text-muted-foreground">{brand.brand} · {brand.model}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    OCPP {brand.ocppVersion}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-background rounded">
                    <p className="text-muted-foreground">Potencia</p>
                    <p className="font-medium">{brand.defaultPowerKw} kW {brand.chargeType}</p>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <p className="text-muted-foreground">Fases</p>
                    <p className="font-medium">{brand.phases || 1} fase(s)</p>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <p className="text-muted-foreground">SoC</p>
                    <p className="font-medium">{brand.supportsSoC ? '✅ Soportado' : '❌ No soportado'}</p>
                  </div>
                  <div className="p-2 bg-background rounded">
                    <p className="text-muted-foreground">Medición Potencia</p>
                    <p className="font-medium">{brand.supportsPowerMeasurement ? '✅ Sí' : '❌ Solo energía'}</p>
                  </div>
                </div>
                {measurands.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Measurands:</span> {measurands.join(', ')}
                  </div>
                )}
                {brand.notes && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">⚠️ {brand.notes}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

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
            <Label>País</Label>
            <Input 
              placeholder="Colombia" 
              value={formData.country}
              onChange={(e) => setFormData({...formData, country: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              🌐 Zona Horaria
            </Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
            >
              <option value="America/Bogota">🇨🇴 Colombia (UTC-5)</option>
              <option value="America/New_York">🇺🇸 USA Este (UTC-5/-4)</option>
              <option value="America/Chicago">🇺🇸 USA Central (UTC-6/-5)</option>
              <option value="America/Los_Angeles">🇺🇸 USA Pacífico (UTC-8/-7)</option>
              <option value="America/Mexico_City">🇲🇽 México (UTC-6)</option>
              <option value="America/Argentina/Buenos_Aires">🇦🇷 Argentina (UTC-3)</option>
              <option value="America/Santiago">🇨🇱 Chile (UTC-4/-3)</option>
              <option value="America/Lima">🇵🇪 Perú (UTC-5)</option>
              <option value="America/Caracas">🇻🇪 Venezuela (UTC-4)</option>
              <option value="America/Guayaquil">🇪🇨 Ecuador (UTC-5)</option>
              <option value="America/Sao_Paulo">🇧🇷 Brasil (UTC-3)</option>
              <option value="Europe/Madrid">🇪🇸 España (UTC+1/+2)</option>
              <option value="UTC">🌍 UTC</option>
            </select>
          </div>
          
          {/* Selector de Zona Premium */}
          <div className="space-y-2 col-span-2">
            <Label className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              Zona de Ubicación
            </Label>
            <Select
              value={formData.premiumZone}
              onValueChange={(value) => setFormData({...formData, premiumZone: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la zona" />
              </SelectTrigger>
              <SelectContent>
                {PREMIUM_ZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{zone.label}</span>
                      {zone.fee > 0 && (
                        <span className="ml-2 text-xs text-yellow-600">+${(zone.fee / 1000000).toFixed(0)}M</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.premiumZone && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {PREMIUM_ZONES.find(z => z.value === formData.premiumZone)?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PREMIUM_ZONES.find(z => z.value === formData.premiumZone)?.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Fee adicional</p>
                    <p className="font-semibold text-yellow-600">
                      {(() => {
                        const fee = PREMIUM_ZONES.find(z => z.value === formData.premiumZone)?.fee || 0;
                        return fee > 0 ? `$${fee.toLocaleString('es-CO')} COP` : 'Sin costo adicional';
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}
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

      {/* Foto de la estación */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <ImagePlus className="w-4 h-4" />
          Foto de la Estación
        </h3>
        <div className="space-y-3">
          {(imagePreview || formData.imageUrl) && (
            <div className="relative w-full max-w-md mx-auto">
              <img 
                src={imagePreview || formData.imageUrl} 
                alt="Vista previa" 
                className="w-full h-48 object-cover rounded-lg border border-border"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                  setFormData({...formData, imageUrl: ""});
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error("La imagen no puede superar 10MB");
                    return;
                  }
                  setImageFile(file);
                  const url = URL.createObjectURL(file);
                  setImagePreview(url);
                }}
              />
              <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {imagePreview || formData.imageUrl ? "Cambiar foto" : "Seleccionar foto de la estación"}
                </span>
              </div>
            </label>
            {isEdit && imageFile && (
              <Button
                size="sm"
                disabled={uploadImageMutation.isPending}
                onClick={async () => {
                  if (!imageFile || !editingStation) return;
                  try {
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve) => {
                      reader.onload = () => {
                        const result = reader.result as string;
                        resolve(result.split(',')[1]);
                      };
                      reader.readAsDataURL(imageFile);
                    });
                    const result = await uploadImageMutation.mutateAsync({
                      stationId: editingStation.id,
                      fileName: imageFile.name,
                      fileBase64: base64,
                      contentType: imageFile.type,
                    });
                    setFormData({...formData, imageUrl: result.imageUrl});
                    setImageFile(null);
                    setImagePreview(null);
                    toast.success(`Foto optimizada y subida: ${result.originalSizeKB}KB → ${result.compressedSizeKB}KB (${result.savings} menos)`);
                  } catch (err) {
                    toast.error("Error al subir la imagen");
                  }
                }}
              >
                {uploadImageMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Subiendo...</>
                ) : "Subir foto"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Formatos: JPEG, PNG, WebP. Máximo 10MB. La foto ayuda a los usuarios a identificar la estación.</p>
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

      {/* Horario de Operación */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Horario de Operación
        </h3>
        <div className="space-y-2">
          {[
            { key: 'monday', label: 'Lunes' },
            { key: 'tuesday', label: 'Martes' },
            { key: 'wednesday', label: 'Miércoles' },
            { key: 'thursday', label: 'Jueves' },
            { key: 'friday', label: 'Viernes' },
            { key: 'saturday', label: 'Sábado' },
            { key: 'sunday', label: 'Domingo' },
          ].map(({ key, label }) => {
            const dayData = formData.operatingHours[key] || { open: '06:00', close: '22:00' };
            const isClosed = dayData.closed || false;
            return (
              <div key={key} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                <span className="w-24 text-sm font-medium">{label}</span>
                <Switch
                  checked={!isClosed}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      operatingHours: {
                        ...formData.operatingHours,
                        [key]: checked
                          ? { open: dayData.open || '06:00', close: dayData.close || '22:00' }
                          : { open: '00:00', close: '00:00', closed: true },
                      },
                    });
                  }}
                />
                {!isClosed ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={dayData.open}
                      onChange={(e) => setFormData({
                        ...formData,
                        operatingHours: {
                          ...formData.operatingHours,
                          [key]: { ...dayData, open: e.target.value },
                        },
                      })}
                      className="w-28 h-8 text-xs"
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={dayData.close}
                      onChange={(e) => setFormData({
                        ...formData,
                        operatingHours: {
                          ...formData.operatingHours,
                          [key]: { ...dayData, close: e.target.value },
                        },
                      })}
                      className="w-28 h-8 text-xs"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const allDay = {
              monday: { open: '00:00', close: '23:59' },
              tuesday: { open: '00:00', close: '23:59' },
              wednesday: { open: '00:00', close: '23:59' },
              thursday: { open: '00:00', close: '23:59' },
              friday: { open: '00:00', close: '23:59' },
              saturday: { open: '00:00', close: '23:59' },
              sunday: { open: '00:00', close: '23:59' },
            };
            setFormData({ ...formData, operatingHours: allDay });
          }}
        >
          Configurar como 24/7
        </Button>
      </div>

      {/* Modelo Financiero Configurable */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Modelo Financiero
        </h3>
        <p className="text-xs text-muted-foreground">
          Modelo: Ingresos - Costo energía = Margen bruto → Aliado Comercial (% del margen) → Neto → EVGreen + Inversionista (deben sumar 100% entre ellos).
        </p>
        
        {/* EVGreen + Inversionista = 100% del neto (después del aliado) */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 mb-2">
          <p className="text-xs font-semibold text-blue-400 mb-1">Reparto del Neto (EVGreen + Inversionista = 100%)</p>
          <p className="text-[10px] text-muted-foreground">Estos porcentajes se aplican sobre el neto después de descontar el aliado comercial.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">% EVGreen (Gestor)</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.evgreenSharePercent}
                onChange={(e) => {
                  const val = e.target.value;
                  const remaining = 100 - parseFloat(val || "0");
                  setFormData({...formData, evgreenSharePercent: val, investorSharePercent: Math.max(0, remaining).toFixed(2)});
                }}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">% Inversionista</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={formData.investorSharePercent}
                onChange={(e) => {
                  const val = e.target.value;
                  const remaining = 100 - parseFloat(val || "0");
                  setFormData({...formData, investorSharePercent: val, evgreenSharePercent: Math.max(0, remaining).toFixed(2)});
                }}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Aliado Comercial - % separado sobre margen bruto */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-2 mt-4">
          <p className="text-xs font-semibold text-amber-400 mb-1">% Aliado Comercial (sobre Margen Bruto)</p>
          <p className="text-[10px] text-muted-foreground">Este porcentaje se descuenta primero del margen bruto (ingresos - costo energía). El restante se reparte entre EVGreen e Inversionista.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">% Aliado Comercial</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={formData.hostSharePercent}
                onChange={(e) => setFormData({...formData, hostSharePercent: e.target.value})}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        
        {/* Validación visual de porcentajes */}
        {(() => {
          const evInvTotal = parseFloat(formData.evgreenSharePercent || "0") + parseFloat(formData.investorSharePercent || "0");
          const hostPct = parseFloat(formData.hostSharePercent || "0");
          const isEvInvValid = Math.abs(evInvTotal - 100) < 0.1;
          const isHostValid = hostPct >= 0 && hostPct <= 50;
          const isValid = isEvInvValid && isHostValid;
          return (
            <div className={`p-3 rounded-lg text-xs space-y-1 ${isValid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              <div className="flex items-center justify-between">
                <span>EVGreen + Inversionista: {evInvTotal.toFixed(1)}%</span>
                <span>{isEvInvValid ? '✓ Suma 100%' : '✗ Deben sumar 100%'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aliado Comercial: {hostPct.toFixed(1)}% (sobre margen bruto)</span>
                <span>{isHostValid ? '✓ Válido (0-50%)' : '✗ Máximo 50%'}</span>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Costo compra energía (COP/kWh)</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="10"
                value={formData.energyPurchaseCostPerKwh}
                onChange={(e) => setFormData({...formData, energyPurchaseCostPerKwh: e.target.value})}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">COP/kWh</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Costo promedio de compra de energía de red para calcular la factura eléctrica</p>
          </div>
        </div>

        {/* Aliado Comercial (dueño del espacio) */}
        {parseFloat(formData.hostSharePercent || "0") > 0 && (
          <div className="space-y-3 p-4 border border-dashed rounded-lg">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Datos del Aliado Comercial</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Nombre del Aliado</Label>
                <Input
                  placeholder="Ej: Centro Comercial Andino"
                  value={formData.hostName}
                  onChange={(e) => setFormData({...formData, hostName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">ID de Usuario (si tiene cuenta)</Label>
                <Input
                  type="number"
                  placeholder="ID del usuario host"
                  value={formData.hostUserId}
                  onChange={(e) => setFormData({...formData, hostUserId: e.target.value})}
                />
              </div>
            </div>

            {/* Tarifas de ocupación para parqueaderos */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-3">
                <span className="font-medium text-foreground">Modelo de liquidación de ocupación</span> — Cuando el EV ocupa el slot post-carga, EVGreen cobra al usuario la tarifa app y transfiere al aliado la tarifa de parqueadero. El diferencial queda para EVGreen.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tarifa parqueadero aliado (COP/min)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ej: 230"
                    value={formData.parkingRatePerMinute}
                    onChange={(e) => setFormData({...formData, parkingRatePerMinute: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">Lo que el aliado cobra en su parqueadero</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tarifa ocupación app EVGreen (COP/min)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ej: 500"
                    value={formData.occupancyRatePerMinute}
                    onChange={(e) => setFormData({...formData, occupancyRatePerMinute: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">Lo que EVGreen cobra al usuario (≥ tarifa aliado)</p>
                </div>
              </div>
              {parseInt(formData.parkingRatePerMinute || "0") > 0 && parseInt(formData.occupancyRatePerMinute || "0") > 0 && (
                <div className="mt-2 p-2 bg-green-500/10 rounded text-xs text-green-600 dark:text-green-400">
                  Margen EVGreen por ocupación: <strong>${(parseInt(formData.occupancyRatePerMinute) - parseInt(formData.parkingRatePerMinute)).toLocaleString("es-CO")} COP/min</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
        <div className="flex items-center gap-3">
          {/* Toggle Lista / Mapa */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="h-3.5 w-3.5" /> Mapa
            </button>
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
      </div>

      {/* Estadísticas - Usando estado real de conexión OCPP */}
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
                {stations?.filter((s) => s.isActive && isStationConnectedOCPP(s)).length || 0}
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
                {stations?.filter((s) => s.isActive && !isStationConnectedOCPP(s)).length || 0}
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

      {/* Filtros - solo en vista lista */}
      {viewMode === "list" && (
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
      )}

      {/* Vista de Mapa */}
      {viewMode === "map" && (
        <Card className="border-border/50 overflow-hidden">
          <div className="h-[560px] relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Cargando mapa...</div>
            ) : !stations || stations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MapPin className="h-12 w-12 opacity-30" />
                <p>No hay estaciones para mostrar en el mapa</p>
              </div>
            ) : (
              <AdminStationsMap
                stations={stations}
                ocppConnections={ocppConnections || []}
                onEdit={loadStationForEdit}
                onView={(station: any) => { setViewingStation(station); setShowDetailsDialog(true); }}
              />
            )}
          </div>
        </Card>
      )}

      {/* Tabla de estaciones - solo en vista lista */}
      {viewMode === "list" && (
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
                    {(() => {
                      // Prioridad: 1) lastHeartbeat del backend (OCPP real), 2) connInfo del query OCPP, 3) lastBootNotification
                      const connInfo = getOCPPConnectionInfo(station);
                      const lastActivity = (station as any).lastHeartbeat
                        || connInfo?.lastHeartbeat
                        || connInfo?.lastMessage
                        || (station as any).lastBootNotification;
                      return lastActivity
                        ? new Date(lastActivity).toLocaleString("es-CO")
                        : "Nunca";
                    })()}
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
      )}

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

              {/* Conectores - Con estado OCPP en tiempo real */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Conectores ({viewingStation.evses?.length || 0})
                </h4>
                {viewingStation.evses && viewingStation.evses.length > 0 ? (
                  <div className="space-y-2">
                    {viewingStation.evses.map((evse: any, index: number) => {
                      // Obtener estado OCPP en tiempo real si está conectado
                      const connInfo = getOCPPConnectionInfo(viewingStation);
                      const ocppStatus = connInfo?.connectorStatuses?.[evse.evseIdLocal] || null;
                      // Usar estado OCPP si está disponible, sino usar estado de BD
                      const realStatus = ocppStatus || evse.status;
                      const isAvailable = realStatus === 'Available' || realStatus === 'AVAILABLE';
                      const isCharging = realStatus === 'Charging' || realStatus === 'CHARGING' || realStatus === 'Occupied';
                      const isPreparing = realStatus === 'Preparing' || realStatus === 'PREPARING';
                      const isUnavailable = realStatus === 'Unavailable' || realStatus === 'UNAVAILABLE' || realStatus === 'Faulted';
                      
                      return (
                      <div 
                        key={evse.id || index} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isAvailable ? 'bg-green-500/20' : 
                            isCharging ? 'bg-blue-500/20' : 
                            isPreparing ? 'bg-yellow-500/20' : 'bg-muted'
                          }`}>
                            <Zap className={`w-5 h-5 ${
                              isAvailable ? 'text-green-500' : 
                              isCharging ? 'text-blue-500' : 
                              isPreparing ? 'text-yellow-500' : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              #{evse.evseIdLocal || index + 1} - {getConnectorLabel(evse.connectorType)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {evse.powerKw} kW • {evse.chargeType}
                              {ocppStatus && <span className="ml-2 text-primary">• OCPP: {ocppStatus}</span>}
                            </div>
                          </div>
                        </div>
                        <Badge className={
                          isAvailable ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                          isCharging ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 
                          isPreparing ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          isUnavailable ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''
                        }>
                          {isAvailable ? 'Disponible' : 
                           isCharging ? 'Cargando' : 
                           isPreparing ? 'Preparando' :
                           isUnavailable ? 'No disponible' : realStatus}
                        </Badge>
                      </div>
                    );})}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
                    No hay conectores configurados
                  </p>
                )}
              </div>

              {/* Estadísticas rápidas - Con estado OCPP en tiempo real */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Estadísticas</h4>
                {(() => {
                  const connInfo = getOCPPConnectionInfo(viewingStation);
                  const evses = viewingStation.evses || [];
                  
                  // Calcular estadísticas usando estado OCPP si está disponible
                  let availableCount = 0;
                  let chargingCount = 0;
                  
                  evses.forEach((evse: any) => {
                    const ocppStatus = connInfo?.connectorStatuses?.[evse.evseIdLocal];
                    const realStatus = ocppStatus || evse.status;
                    if (realStatus === 'Available' || realStatus === 'AVAILABLE') availableCount++;
                    if (realStatus === 'Charging' || realStatus === 'CHARGING' || realStatus === 'Occupied') chargingCount++;
                  });
                  
                  return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">
                      {availableCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Disponibles</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {chargingCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Cargando</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold">
                      {evses.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {evses.filter((e: any) => e.chargeType === 'DC').length}
                    </p>
                    <p className="text-xs text-muted-foreground">DC Rápidos</p>
                  </div>
                </div>
                  );
                })()}
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

// ─── Admin Stations Map Component ─────────────────────────────────────────────
function AdminStationsMap({ stations, ocppConnections, onEdit, onView }: {
  stations: any[];
  ocppConnections: any[];
  onEdit: (station: any) => void;
  onView: (station: any) => void;
}) {
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const getOCPPInfo = (station: any) => {
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.find(
      (conn: any) => conn.ocppIdentity === ocppId || conn.stationId === station.id
    );
  };

  const handleMapReady = (map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
    infoWindowRef.current = new google.maps.InfoWindow();

    stations.forEach((station: any) => {
      const lat = parseFloat(station.latitude);
      const lng = parseFloat(station.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      hasValidCoords = true;
      const position = { lat, lng };
      bounds.extend(position);

      const connInfo = getOCPPInfo(station);
      const isOnline = !!connInfo || station.isOnline;
      const isActive = station.isActive;
      const statusColor = !isActive ? "#6b7280" : isOnline ? "#22c55e" : "#ef4444";

      const svgMarker = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
            <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${statusColor}"/>
            <circle cx="18" cy="18" r="11" fill="white" fill-opacity="0.2"/>
            <path d="M20 8l-7 11h6l-3 9 8-13h-6l2-7z" fill="white"/>
          </svg>`
        )}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };

      const marker = new google.maps.Marker({
        position,
        map,
        title: station.name,
        icon: svgMarker,
      });

      marker.addListener("click", () => {
        map.panTo(position);

        const statusLabel = !isActive ? "Inactiva" : isOnline ? "Conectada" : "Desconectada";
        const statusDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px;"></span>`;
        const connectorCount = station.evses?.length || 0;

        const content = `
          <div style="font-family:system-ui;min-width:240px;padding:4px 2px;">
            <div style="font-size:15px;font-weight:700;margin-bottom:6px;">${station.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📍 ${station.address || ""}, ${station.city || ""}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">⚡ ${connectorCount} conector${connectorCount !== 1 ? "es" : ""}</div>
            <div style="font-size:12px;margin-bottom:10px;">${statusDot}${statusLabel}</div>
            <div style="display:flex;gap:8px;">
              <button id="admin-view-btn-${station.id}" style="flex:1;background:#1e293b;color:white;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">
                👁 Ver detalles
              </button>
              <button id="admin-edit-btn-${station.id}" style="flex:1;background:#16a34a;color:white;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">
                ✏️ Editar
              </button>
            </div>
          </div>`;

        infoWindowRef.current!.setContent(content);
        infoWindowRef.current!.open(map, marker);

        setTimeout(() => {
          const viewBtn = document.getElementById(`admin-view-btn-${station.id}`);
          const editBtn = document.getElementById(`admin-edit-btn-${station.id}`);
          if (viewBtn) viewBtn.addEventListener("click", () => {
            infoWindowRef.current!.close();
            onView(station);
          });
          if (editBtn) editBtn.addEventListener("click", () => {
            infoWindowRef.current!.close();
            onEdit(station);
          });
        }, 100);
      });

      markersRef.current.push(marker);
    });

    if (hasValidCoords) {
      map.fitBounds(bounds);
      if (stations.length === 1) map.setZoom(15);
    } else {
      map.setCenter({ lat: 4.711, lng: -74.0721 });
      map.setZoom(6);
    }
  };

  return (
    <MapView
      onMapReady={handleMapReady}
      className="w-full h-full"
      initialCenter={{ lat: 4.711, lng: -74.0721 }}
      initialZoom={6}
    />
  );
}
