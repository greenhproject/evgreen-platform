import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Image as ImageIcon, 
  Eye, 
  Pencil, 
  Trash2,
  ExternalLink,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

// Tipos de banners según el esquema
const BANNER_TYPES = [
  { value: "SPLASH", label: "Splash Screen (al abrir la app)" },
  { value: "CHARGING", label: "Durante sesión de carga" },
  { value: "MAP", label: "Banner en mapa" },
  { value: "PROMOTIONAL", label: "Promocional" },
  { value: "INFORMATIONAL", label: "Informativo" },
];

interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  type: string;
  linkUrl: string | null;
  ctaText: string | null;
  priority: number;
  status: string;
  impressions: number;
  clicks: number;
  uniqueViews: number;
  startDate: Date | null;
  endDate: Date | null;
  advertiserName: string | null;
  createdAt: Date;
}

export default function AdminBanners() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    ctaText: "",
    type: "PROMOTIONAL" as "SPLASH" | "CHARGING" | "MAP" | "PROMOTIONAL" | "INFORMATIONAL",
    priority: 1,
    startDate: "",
    endDate: "",
    advertiserName: "",
    advertiserContact: "",
  });

  const { data: banners, isLoading, refetch } = trpc.banners.list.useQuery();
  
  const createMutation = trpc.banners.create.useMutation({
    onSuccess: () => {
      toast.success("Banner creado exitosamente");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateMutation = trpc.banners.update.useMutation({
    onSuccess: () => {
      toast.success("Banner actualizado");
      setEditingBanner(null);
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.banners.delete.useMutation({
    onSuccess: () => {
      toast.success("Banner eliminado");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const toggleActiveMutation = trpc.banners.toggleActive.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      subtitle: "",
      description: "",
      imageUrl: "",
      linkUrl: "",
      ctaText: "",
      type: "PROMOTIONAL",
      priority: 1,
      startDate: "",
      endDate: "",
      advertiserName: "",
      advertiserContact: "",
    });
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.imageUrl) {
      toast.error("Título e imagen son obligatorios");
      return;
    }

    await createMutation.mutateAsync({
      title: formData.title,
      subtitle: formData.subtitle || undefined,
      description: formData.description || undefined,
      imageUrl: formData.imageUrl,
      linkUrl: formData.linkUrl || undefined,
      ctaText: formData.ctaText || undefined,
      type: formData.type,
      priority: formData.priority,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      advertiserName: formData.advertiserName || undefined,
      advertiserContact: formData.advertiserContact || undefined,
    });
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "",
      ctaText: banner.ctaText || "",
      type: banner.type as any,
      priority: banner.priority,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split('T')[0] : "",
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split('T')[0] : "",
      advertiserName: banner.advertiserName || "",
      advertiserContact: "",
    });
    setShowCreateDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingBanner) return;
    
    await updateMutation.mutateAsync({
      id: editingBanner.id,
      data: {
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        description: formData.description || undefined,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl || undefined,
        ctaText: formData.ctaText || undefined,
        type: formData.type,
        priority: formData.priority,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        advertiserName: formData.advertiserName || undefined,
        advertiserContact: formData.advertiserContact || undefined,
      },
    });
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Estás seguro de eliminar este banner?")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const getTypeLabel = (type: string) => {
    return BANNER_TYPES.find(t => t.value === type)?.label || type;
  };

  const getCTR = (impressions: number, clicks: number) => {
    if (impressions === 0) return "0%";
    return ((clicks / impressions) * 100).toFixed(2) + "%";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-500">Activo</Badge>;
      case "PAUSED":
        return <Badge variant="secondary">Pausado</Badge>;
      case "DRAFT":
        return <Badge variant="outline">Borrador</Badge>;
      case "EXPIRED":
        return <Badge variant="destructive">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Banners</h1>
          <p className="text-muted-foreground">
            Administra los banners publicitarios y promocionales de la plataforma
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingBanner(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? "Editar banner" : "Crear nuevo banner"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input 
                    placeholder="Título del banner" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de banner</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: any) => setFormData({...formData, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANNER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Input 
                  placeholder="Subtítulo opcional"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea 
                  placeholder="Descripción opcional del banner"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>URL de la imagen *</Label>
                <Input 
                  placeholder="https://ejemplo.com/imagen.jpg" 
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL de destino (al hacer clic)</Label>
                  <Input 
                    placeholder="https://ejemplo.com/promocion" 
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({...formData, linkUrl: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Texto del botón (CTA)</Label>
                  <Input 
                    placeholder="Ver más" 
                    value={formData.ctaText}
                    onChange={(e) => setFormData({...formData, ctaText: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input 
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input 
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del anunciante</Label>
                  <Input 
                    placeholder="Empresa anunciante"
                    value={formData.advertiserName}
                    onChange={(e) => setFormData({...formData, advertiserName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contacto del anunciante</Label>
                  <Input 
                    placeholder="email@empresa.com"
                    value={formData.advertiserContact}
                    onChange={(e) => setFormData({...formData, advertiserContact: e.target.value})}
                  />
                </div>
              </div>

              {formData.imageUrl && (
                <div className="space-y-2">
                  <Label>Vista previa</Label>
                  <div className="border rounded-lg overflow-hidden bg-muted/50">
                    <img 
                      src={formData.imageUrl} 
                      alt="Preview" 
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x400?text=Imagen+no+disponible";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setEditingBanner(null);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={editingBanner ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingBanner ? "Guardar cambios" : "Crear banner"}
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
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{banners?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total banners</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {banners?.filter((b: any) => b.status === "ACTIVE").length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Activos</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {banners?.reduce((acc: number, b: any) => acc + (b.impressions || 0), 0).toLocaleString() || 0}
              </div>
              <div className="text-sm text-muted-foreground">Impresiones totales</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {banners?.reduce((acc: number, b: any) => acc + (b.clicks || 0), 0).toLocaleString() || 0}
              </div>
              <div className="text-sm text-muted-foreground">Clics totales</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla de banners */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Impresiones</TableHead>
              <TableHead>Clics</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Cargando banners...
                </TableCell>
              </TableRow>
            ) : !banners || banners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay banners registrados
                </TableCell>
              </TableRow>
            ) : (
              banners.map((banner: any) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                        <img 
                          src={banner.imageUrl} 
                          alt={banner.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://via.placeholder.com/64x40?text=...";
                          }}
                        />
                      </div>
                      <div>
                        <div className="font-medium">{banner.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Prioridad: {banner.priority}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(banner.type)}</Badge>
                  </TableCell>
                  <TableCell>{(banner.impressions || 0).toLocaleString()}</TableCell>
                  <TableCell>{(banner.clicks || 0).toLocaleString()}</TableCell>
                  <TableCell>{getCTR(banner.impressions || 0, banner.clicks || 0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(banner.status)}
                      <Switch 
                        checked={banner.status === "ACTIVE"}
                        onCheckedChange={() => toggleActiveMutation.mutate({ id: banner.id })}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {banner.startDate || banner.endDate ? (
                      <div className="text-sm">
                        {banner.startDate && new Date(banner.startDate).toLocaleDateString("es-CO")}
                        {banner.startDate && banner.endDate && " - "}
                        {banner.endDate && new Date(banner.endDate).toLocaleDateString("es-CO")}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin límite</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(banner)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(banner.id)}
                        className="text-red-500 hover:text-red-600"
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
    </div>
  );
}
