import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Car, Plus, Trash2, Battery, Zap, Edit, Star, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const connectorTypes = [
  { value: "TYPE_1", label: "Tipo 1 (AC)" },
  { value: "TYPE_2", label: "Tipo 2 (AC)" },
  { value: "CCS_1", label: "CCS1 (DC)" },
  { value: "CCS_2", label: "CCS2 (DC)" },
  { value: "CHADEMO", label: "CHAdeMO (DC)" },
  { value: "TESLA", label: "Tesla (NACS)" },
  { value: "GBT_AC", label: "GB/T (AC)" },
  { value: "GBT_DC", label: "GB/T (DC)" },
] as const;

type ConnectorTypeValue = typeof connectorTypes[number]["value"];

const evBrands = [
  "Tesla", "BYD", "Renault", "Nissan", "Chevrolet", "BMW", "Mercedes-Benz",
  "Audi", "Volkswagen", "Hyundai", "Kia", "Ford", "Volvo", "Porsche", "Otro"
];

interface FormData {
  brand: string;
  model: string;
  year: string;
  batteryCapacity: string;
  connectorTypes: ConnectorTypeValue[];
  licensePlate: string;
  nickname: string;
}

const emptyForm: FormData = {
  brand: "",
  model: "",
  year: "",
  batteryCapacity: "",
  connectorTypes: [],
  licensePlate: "",
  nickname: "",
};

export default function Vehicles() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });

  const utils = trpc.useUtils();

  // Queries
  const { data: vehicles = [], isLoading } = trpc.vehicles.list.useQuery();

  // Mutations
  const createMutation = trpc.vehicles.create.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      toast.success("Vehículo registrado exitosamente");
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message || "Error al registrar el vehículo");
    },
  });

  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      toast.success("Vehículo actualizado exitosamente");
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message || "Error al actualizar el vehículo");
    },
  });

  const deleteMutation = trpc.vehicles.delete.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      toast.success("Vehículo eliminado");
    },
    onError: (err) => {
      toast.error(err.message || "Error al eliminar el vehículo");
    },
  });

  const setDefaultMutation = trpc.vehicles.setDefault.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      toast.success("Vehículo predeterminado actualizado");
    },
    onError: (err) => {
      toast.error(err.message || "Error al actualizar");
    },
  });

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setEditingVehicleId(null);
    setIsDialogOpen(false);
  };

  const handleChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleConnector = (connValue: ConnectorTypeValue) => {
    setFormData(prev => {
      const current = prev.connectorTypes;
      if (current.includes(connValue)) {
        return { ...prev, connectorTypes: current.filter(c => c !== connValue) };
      } else {
        return { ...prev, connectorTypes: [...current, connValue] };
      }
    });
  };

  const handleSave = () => {
    if (!formData.brand || !formData.model || formData.connectorTypes.length === 0) {
      toast.error("Por favor completa los campos requeridos (marca, modelo y al menos un conector)");
      return;
    }

    const payload = {
      brand: formData.brand,
      model: formData.model,
      year: formData.year ? parseInt(formData.year) : undefined,
      batteryCapacityKwh: formData.batteryCapacity ? parseFloat(formData.batteryCapacity) : undefined,
      connectorTypes: formData.connectorTypes,
      licensePlate: formData.licensePlate || undefined,
      nickname: formData.nickname || undefined,
    };

    if (editingVehicleId) {
      updateMutation.mutate({ id: editingVehicleId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (vehicle: typeof vehicles[number]) => {
    setEditingVehicleId(vehicle.id);
    const vehicleConnectors = (vehicle.connectorTypes as string[]) || [];
    setFormData({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year?.toString() || "",
      batteryCapacity: vehicle.batteryCapacityKwh?.toString() || "",
      connectorTypes: vehicleConnectors as ConnectorTypeValue[],
      licensePlate: vehicle.licensePlate || "",
      nickname: vehicle.nickname || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  const handleSetDefault = (id: number) => {
    setDefaultMutation.mutate({ id });
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setLocation("/profile")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Mis Vehículos</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingVehicleId ? "Editar vehículo" : "Agregar vehículo"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Marca *</Label>
                    <Select value={formData.brand} onValueChange={(v) => handleChange("brand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {evBrands.map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo *</Label>
                    <Input
                      value={formData.model}
                      onChange={(e) => handleChange("model", e.target.value)}
                      placeholder="Ej: Model 3, Zoe, Leaf"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apodo (opcional)</Label>
                    <Input
                      value={formData.nickname}
                      onChange={(e) => handleChange("nickname", e.target.value)}
                      placeholder="Ej: Mi Tesla, El Eléctrico"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Input
                        value={formData.year}
                        onChange={(e) => handleChange("year", e.target.value)}
                        placeholder="2024"
                        type="number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Batería (kWh)</Label>
                      <Input
                        value={formData.batteryCapacity}
                        onChange={(e) => handleChange("batteryCapacity", e.target.value)}
                        placeholder="52"
                        type="number"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipos de conector compatibles *</Label>
                    <p className="text-xs text-muted-foreground">Selecciona todos los conectores que acepta tu vehículo</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {connectorTypes.map(type => (
                        <label
                          key={type.value}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            formData.connectorTypes.includes(type.value)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Checkbox
                            checked={formData.connectorTypes.includes(type.value)}
                            onCheckedChange={() => toggleConnector(type.value)}
                          />
                          <span className="text-sm">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Placa</Label>
                    <Input
                      value={formData.licensePlate}
                      onChange={(e) => handleChange("licensePlate", e.target.value.toUpperCase())}
                      placeholder="ABC123"
                    />
                  </div>
                  <Button
                    className="w-full gradient-primary"
                    onClick={handleSave}
                    disabled={isMutating}
                  >
                    {isMutating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingVehicleId ? "Guardar cambios" : "Agregar vehículo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Cargando vehículos...</p>
            </div>
          ) : vehicles.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Car className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Sin vehículos registrados</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agrega tu vehículo eléctrico para obtener recomendaciones personalizadas
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar vehículo
                </Button>
              </div>
            </Card>
          ) : (
            vehicles.map(vehicle => {
              const vehicleConnectors = (vehicle.connectorTypes as string[]) || [];
              return (
                <Card key={vehicle.id} className={vehicle.isDefault ? "border-primary" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Car className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}
                          </CardTitle>
                          <CardDescription>
                            {vehicle.brand} {vehicle.model}
                            {vehicle.year ? ` • ${vehicle.year}` : ""}
                            {vehicle.licensePlate ? ` • ${vehicle.licensePlate}` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      {vehicle.isDefault && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Predeterminado
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                      {vehicle.batteryCapacityKwh && (
                        <div className="flex items-center gap-1">
                          <Battery className="w-4 h-4" />
                          {vehicle.batteryCapacityKwh} kWh
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Zap className="w-4 h-4 shrink-0" />
                        {vehicleConnectors.map((ct, i) => {
                          const label = connectorTypes.find(t => t.value === ct)?.label || ct;
                          return (
                            <span key={ct} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!vehicle.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSetDefault(vehicle.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          Usar por defecto
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vehicle)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(vehicle.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </UserLayout>
  );
}
