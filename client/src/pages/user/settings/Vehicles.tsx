import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Car, Plus, Trash2, Battery, Zap, Edit } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Vehicle {
  id: number;
  brand: string;
  model: string;
  year: string;
  batteryCapacity: string;
  connectorType: string;
  licensePlate: string;
  isDefault: boolean;
}

const connectorTypes = [
  { value: "TYPE_2", label: "Tipo 2 (AC)" },
  { value: "CCS_2", label: "CCS2 (DC)" },
  { value: "CHADEMO", label: "CHAdeMO (DC)" },
  { value: "TYPE_1", label: "Tipo 1 (AC)" },
];

const evBrands = [
  "Tesla", "BYD", "Renault", "Nissan", "Chevrolet", "BMW", "Mercedes-Benz", 
  "Audi", "Volkswagen", "Hyundai", "Kia", "Ford", "Volvo", "Porsche", "Otro"
];

export default function Vehicles() {
  const [, setLocation] = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 1,
      brand: "Renault",
      model: "Zoe",
      year: "2023",
      batteryCapacity: "52",
      connectorType: "TYPE_2",
      licensePlate: "ABC123",
      isDefault: true,
    }
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    year: "",
    batteryCapacity: "",
    connectorType: "",
    licensePlate: "",
  });

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.brand || !formData.model || !formData.connectorType) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    if (editingVehicle) {
      setVehicles(prev => prev.map(v => 
        v.id === editingVehicle.id 
          ? { ...v, ...formData }
          : v
      ));
      toast.success("Vehículo actualizado");
    } else {
      const newVehicle: Vehicle = {
        id: Date.now(),
        ...formData,
        isDefault: vehicles.length === 0,
      };
      setVehicles(prev => [...prev, newVehicle]);
      toast.success("Vehículo agregado");
    }

    setFormData({
      brand: "",
      model: "",
      year: "",
      batteryCapacity: "",
      connectorType: "",
      licensePlate: "",
    });
    setEditingVehicle(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      batteryCapacity: vehicle.batteryCapacity,
      connectorType: vehicle.connectorType,
      licensePlate: vehicle.licensePlate,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    toast.success("Vehículo eliminado");
  };

  const handleSetDefault = (id: number) => {
    setVehicles(prev => prev.map(v => ({
      ...v,
      isDefault: v.id === id,
    })));
    toast.success("Vehículo predeterminado actualizado");
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingVehicle ? "Editar vehículo" : "Agregar vehículo"}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Input
                        value={formData.year}
                        onChange={(e) => handleChange("year", e.target.value)}
                        placeholder="2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Batería (kWh)</Label>
                      <Input
                        value={formData.batteryCapacity}
                        onChange={(e) => handleChange("batteryCapacity", e.target.value)}
                        placeholder="52"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de conector *</Label>
                    <Select value={formData.connectorType} onValueChange={(v) => handleChange("connectorType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona conector" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectorTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Placa</Label>
                    <Input
                      value={formData.licensePlate}
                      onChange={(e) => handleChange("licensePlate", e.target.value.toUpperCase())}
                      placeholder="ABC123"
                    />
                  </div>
                  <Button className="w-full gradient-primary" onClick={handleSave}>
                    {editingVehicle ? "Guardar cambios" : "Agregar vehículo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {vehicles.length === 0 ? (
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
            vehicles.map(vehicle => (
              <Card key={vehicle.id} className={vehicle.isDefault ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Car className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {vehicle.brand} {vehicle.model}
                        </CardTitle>
                        <CardDescription>
                          {vehicle.year} • {vehicle.licensePlate}
                        </CardDescription>
                      </div>
                    </div>
                    {vehicle.isDefault && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Predeterminado
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Battery className="w-4 h-4" />
                      {vehicle.batteryCapacity} kWh
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {connectorTypes.find(t => t.value === vehicle.connectorType)?.label || vehicle.connectorType}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!vehicle.isDefault && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSetDefault(vehicle.id)}
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
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </UserLayout>
  );
}
