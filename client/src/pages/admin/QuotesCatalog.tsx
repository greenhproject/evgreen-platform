/**
 * Admin - Catálogo de Cargadores para Cotizaciones
 * Permite configurar los cargadores disponibles para venta con precios
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, Package } from "lucide-react";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ChargerFormData {
  name: string;
  slug: string;
  powerKw: number;
  chargeType: "AC" | "DC";
  connectorType: string;
  price: number;
  description: string;
  features: string[];
  imageUrl: string;
  includesTransformer: boolean;
  cableMetersIncluded: number;
  warrantyYears: number;
  sortOrder: number;
}

const defaultForm: ChargerFormData = {
  name: "",
  slug: "",
  powerKw: 0,
  chargeType: "DC",
  connectorType: "CCS2",
  price: 0,
  description: "",
  features: [],
  imageUrl: "",
  includesTransformer: false,
  cableMetersIncluded: 10,
  warrantyYears: 2,
  sortOrder: 0,
};

export default function QuotesCatalog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ChargerFormData>(defaultForm);
  const [featuresText, setFeaturesText] = useState("");

  const { data: catalog, refetch } = trpc.quotes.catalog.listAll.useQuery();
  const createMutation = trpc.quotes.catalog.create.useMutation({
    onSuccess: () => {
      toast.success("Cargador agregado al catálogo");
      refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.quotes.catalog.update.useMutation({
    onSuccess: () => {
      toast.success("Cargador actualizado");
      refetch();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.quotes.catalog.delete.useMutation({
    onSuccess: () => {
      toast.success("Cargador eliminado del catálogo");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
    setFeaturesText("");
  }

  function openCreate() {
    setForm(defaultForm);
    setFeaturesText("");
    setEditingId(null);
    setIsDialogOpen(true);
  }

  function openEdit(item: any) {
    setForm({
      name: item.name,
      slug: item.slug,
      powerKw: parseFloat(item.powerKw),
      chargeType: item.chargeType,
      connectorType: item.connectorType,
      price: item.price,
      description: item.description || "",
      features: item.features || [],
      imageUrl: item.imageUrl || "",
      includesTransformer: item.includesTransformer || false,
      cableMetersIncluded: item.cableMetersIncluded || 10,
      warrantyYears: item.warrantyYears || 2,
      sortOrder: item.sortOrder || 0,
    });
    setFeaturesText((item.features || []).join("\n"));
    setEditingId(item.id);
    setIsDialogOpen(true);
  }

  function handleSubmit() {
    const features = featuresText.split("\n").filter((f) => f.trim());
    const data = { ...form, features };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Cargadores - Ventas</h1>
          <p className="text-muted-foreground">
            Configura los cargadores disponibles para cotización con precios llave en mano
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Cargador
        </Button>
      </div>

      {/* Lista de cargadores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalog?.map((item: any) => (
          <Card key={item.id} className={`relative ${!item.isActive ? "opacity-50" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${item.chargeType === "DC" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{item.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-primary">{formatCOP(item.price)}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Potencia:</span> {item.powerKw} kW</div>
                <div><span className="text-muted-foreground">Tipo:</span> {item.chargeType}</div>
                <div><span className="text-muted-foreground">Conector:</span> {item.connectorType}</div>
                <div><span className="text-muted-foreground">Garantía:</span> {item.warrantyYears} años</div>
              </div>
              {item.includesTransformer && (
                <div className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded inline-block">
                  Incluye transformador
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Incluye hasta {item.cableMetersIncluded}m de cableado
              </div>
            </CardContent>
          </Card>
        ))}

        {(!catalog || catalog.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">Sin cargadores en el catálogo</h3>
              <p className="text-muted-foreground mt-1">Agrega tu primer cargador para comenzar a generar cotizaciones</p>
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Agregar Cargador
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de creación/edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cargador" : "Nuevo Cargador"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del producto</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Cargador DC 120 kW CCS2"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (identificador)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="dc-120kw"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Potencia (kW)</Label>
                <Input
                  type="number"
                  value={form.powerKw || ""}
                  onChange={(e) => setForm({ ...form, powerKw: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de carga</Label>
                <Select value={form.chargeType} onValueChange={(v: any) => setForm({ ...form, chargeType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AC">AC (Corriente Alterna)</SelectItem>
                    <SelectItem value="DC">DC (Corriente Directa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de conector</Label>
                <Select value={form.connectorType} onValueChange={(v) => setForm({ ...form, connectorType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CCS2">CCS2</SelectItem>
                    <SelectItem value="Type 2">Type 2</SelectItem>
                    <SelectItem value="CCS1">CCS1</SelectItem>
                    <SelectItem value="CHAdeMO">CHAdeMO</SelectItem>
                    <SelectItem value="GBT">GBT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio COP (llave en mano)</Label>
                <Input
                  type="number"
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                  placeholder="85000000"
                />
                {form.price > 0 && (
                  <p className="text-xs text-muted-foreground">{formatCOP(form.price)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Orden de aparición</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción técnica</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Cargador de carga rápida DC con doble pistola CCS2..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Características incluidas (una por línea)</Label>
              <Textarea
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder={"Instalación llave en mano\nTransformador incluido\nHasta 10m de cableado\nGarantía 2 años"}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>URL de imagen del producto</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Metros de cable incluidos</Label>
                <Input
                  type="number"
                  value={form.cableMetersIncluded}
                  onChange={(e) => setForm({ ...form, cableMetersIncluded: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Años de garantía</Label>
                <Input
                  type="number"
                  value={form.warrantyYears}
                  onChange={(e) => setForm({ ...form, warrantyYears: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.includesTransformer}
                  onCheckedChange={(v) => setForm({ ...form, includesTransformer: v })}
                />
                <Label>Incluye transformador</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Guardar Cambios" : "Crear Cargador"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
