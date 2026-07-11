import { useState, useRef } from "react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Image as ImageIcon,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  BarChart3,
  Upload,
  Link,
  Loader2,
  Info,
  X,
  ChevronDown,
  ChevronRight,
  MapPin,
  Car,
  Zap,
  CreditCard,
  Wallet,
  Activity,
  Target,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Constantes ────────────────────────────────────────────────────────────────

const BANNER_TYPES = [
  { value: "SPLASH", label: "Splash Screen (al abrir la app)" },
  { value: "CHARGING", label: "Durante sesión de carga" },
  { value: "MAP", label: "Banner en mapa" },
  { value: "PROMOTIONAL", label: "Promocional" },
  { value: "INFORMATIONAL", label: "Informativo" },
];

const RECOMMENDED_SIZES: Record<string, { width: number; height: number; ratio: string; note: string }> = {
  SPLASH: { width: 1080, height: 1920, ratio: "9:16", note: "Pantalla completa vertical" },
  CHARGING: { width: 1080, height: 600, ratio: "9:5", note: "Banner horizontal durante carga" },
  MAP: { width: 1080, height: 400, ratio: "27:10", note: "Banner compacto sobre el mapa" },
  PROMOTIONAL: { width: 1080, height: 600, ratio: "9:5", note: "Banner promocional estándar" },
  INFORMATIONAL: { width: 1080, height: 600, ratio: "9:5", note: "Banner informativo estándar" },
};

const ROLE_OPTIONS = [
  { value: "user", label: "Usuario final" },
  { value: "investor", label: "Inversionista" },
  { value: "host", label: "Host / Anfitrión" },
  { value: "engineer", label: "Ingeniero" },
  { value: "technician", label: "Técnico" },
  { value: "comercial", label: "Comercial" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrador" },
];

const SUBSCRIPTION_OPTIONS = [
  { value: "FREE", label: "Gratuito" },
  { value: "BASIC", label: "Básico" },
  { value: "PREMIUM", label: "Premium" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const CONNECTOR_OPTIONS = [
  { value: "CCS2", label: "CCS2 (Combo)" },
  { value: "CHAdeMO", label: "CHAdeMO" },
  { value: "Type2", label: "Tipo 2 (AC)" },
  { value: "Type1", label: "Tipo 1 (J1772)" },
  { value: "GBT", label: "GB/T" },
  { value: "NACS", label: "NACS (Tesla)" },
];

const START_METHOD_OPTIONS = [
  { value: "APP", label: "App móvil" },
  { value: "QR", label: "Código QR" },
  { value: "NFC", label: "NFC / Tarjeta" },
  { value: "RFID", label: "RFID" },
  { value: "REMOTE", label: "Remoto" },
];

const ACTIVITY_SEGMENT_OPTIONS = [
  { value: "new", label: "Nuevo (primera carga <30 días)" },
  { value: "active", label: "Activo (cargó en últimos 30 días)" },
  { value: "at_risk", label: "En riesgo (sin carga 30-60 días)" },
  { value: "dormant", label: "Dormido (sin carga >60 días)" },
];

const VEHICLE_BRANDS = [
  "Tesla", "BYD", "Renault", "Chevrolet", "Nissan", "Kia", "Hyundai",
  "BMW", "Audi", "Mercedes-Benz", "Volkswagen", "Peugeot", "Citroën",
  "Volvo", "Porsche", "Rivian", "Lucid", "Chery", "JAC", "GWM",
];

const COLOMBIA_DEPARTMENTS = [
  "Bogotá D.C.", "Antioquia", "Valle del Cauca", "Cundinamarca", "Atlántico",
  "Bolívar", "Santander", "Nariño", "Córdoba", "Cauca", "Tolima",
  "Norte de Santander", "Huila", "Risaralda", "Quindío", "Caldas",
  "Magdalena", "Meta", "Boyacá", "Cesar",
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────

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
  // Segmentación
  targetCities?: string[] | null;
  targetDepartments?: string[] | null;
  targetStationCities?: string[] | null;
  targetStationIds?: number[] | null;
  targetVehicleBrands?: string[] | null;
  targetVehicleModels?: string[] | null;
  targetConnectorTypes?: string[] | null;
  targetBatteryMinKwh?: number | null;
  targetBatteryMaxKwh?: number | null;
  targetMinChargesPerMonth?: number | null;
  targetMaxChargesPerMonth?: number | null;
  targetMinSpendPerMonth?: number | null;
  targetMaxSpendPerMonth?: number | null;
  targetStartMethods?: string[] | null;
  targetChargeHoursStart?: number | null;
  targetChargeHoursEnd?: number | null;
  targetRoles?: string[] | null;
  targetSubscriptionTiers?: string[] | null;
  targetHasCard?: boolean | null;
  targetWalletMinBalance?: number | null;
  targetWalletMaxBalance?: number | null;
  targetMinAvgRecharge?: number | null;
  targetActivitySegments?: string[] | null;
  createdAt: Date;
}

// ─── Componente auxiliar: multi-tag selector ──────────────────────────────────

function TagSelector({
  label,
  options,
  selected,
  onToggle,
  placeholder,
}: {
  label?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}{placeholder ? ` · ${placeholder}` : ""}
        </p>
      )}
    </div>
  );
}

// ─── Componente auxiliar: sección colapsable de segmentación ──────────────────

function SegmentSection({
  icon: Icon,
  title,
  color,
  activeCount,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{title}</span>
            {activeCount > 0 && (
              <Badge className="bg-primary/20 text-primary border-0 text-xs h-5">
                {activeCount} activo{activeCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-3 rounded-lg bg-muted/20 border border-border/50 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminBanners() {
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageMode, setImageMode] = useState<"url" | "upload">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Estado del formulario ──────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    // Básico
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
    // Segmentación D1: Geografía
    targetCities: [] as string[],
    targetDepartments: [] as string[],
    targetStationCities: [] as string[],
    targetStationIdsText: "", // CSV de IDs
    // Segmentación D2: Vehículo
    targetVehicleBrands: [] as string[],
    targetVehicleModelsText: "", // CSV de modelos
    targetConnectorTypes: [] as string[],
    targetBatteryMinKwh: "",
    targetBatteryMaxKwh: "",
    // Segmentación D3: Comportamiento
    targetMinChargesPerMonth: "",
    targetMaxChargesPerMonth: "",
    targetMinSpendPerMonth: "",
    targetMaxSpendPerMonth: "",
    targetStartMethods: [] as string[],
    targetChargeHoursStart: "",
    targetChargeHoursEnd: "",
    // Segmentación D4: Suscripción y rol
    targetRoles: [] as string[],
    targetSubscriptionTiers: [] as string[],
    targetHasCard: "" as "" | "true" | "false",
    // Segmentación D5: Perfil financiero
    targetWalletMinBalance: "",
    targetWalletMaxBalance: "",
    targetMinAvgRecharge: "",
    // Segmentación D7: Actividad RFM
    targetActivitySegments: [] as string[],
  });

  const { data: banners, isLoading, refetch } = trpc.banners.list.useQuery();

  const uploadImageMutation = trpc.banners.uploadImage.useMutation({
    onError: (error: any) => {
      toast.error(`Error subiendo imagen: ${error.message}`);
      setIsUploading(false);
    },
  });

  const createMutation = trpc.banners.create.useMutation({
    onSuccess: () => {
      toast.success("Banner creado exitosamente");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error(`Error: ${error.message}`),
  });

  const updateMutation = trpc.banners.update.useMutation({
    onSuccess: () => {
      toast.success("Banner actualizado");
      setEditingBanner(null);
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.banners.delete.useMutation({
    onSuccess: () => { toast.success("Banner eliminado"); refetch(); },
    onError: (error: any) => toast.error(`Error: ${error.message}`),
  });

  const toggleActiveMutation = trpc.banners.toggleStatus.useMutation({
    onSuccess: () => refetch(),
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      title: "", subtitle: "", description: "", imageUrl: "", linkUrl: "",
      ctaText: "", type: "PROMOTIONAL", priority: 1, startDate: "", endDate: "",
      advertiserName: "", advertiserContact: "",
      targetCities: [], targetDepartments: [], targetStationCities: [],
      targetStationIdsText: "", targetVehicleBrands: [], targetVehicleModelsText: "",
      targetConnectorTypes: [], targetBatteryMinKwh: "", targetBatteryMaxKwh: "",
      targetMinChargesPerMonth: "", targetMaxChargesPerMonth: "",
      targetMinSpendPerMonth: "", targetMaxSpendPerMonth: "",
      targetStartMethods: [], targetChargeHoursStart: "", targetChargeHoursEnd: "",
      targetRoles: [], targetSubscriptionTiers: [], targetHasCard: "",
      targetWalletMinBalance: "", targetWalletMaxBalance: "", targetMinAvgRecharge: "",
      targetActivitySegments: [],
    });
    setUploadedFileName("");
    setImageMode("upload");
  };

  const toggleTag = (field: keyof typeof formData, value: string) => {
    const current = formData[field] as string[];
    setFormData(prev => ({
      ...prev,
      [field]: current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value],
    }));
  };

  const buildSegmentationPayload = () => ({
    targetCities: formData.targetCities.length > 0 ? formData.targetCities : undefined,
    targetDepartments: formData.targetDepartments.length > 0 ? formData.targetDepartments : undefined,
    targetStationCities: formData.targetStationCities.length > 0 ? formData.targetStationCities : undefined,
    targetStationIds: formData.targetStationIdsText
      ? formData.targetStationIdsText.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : undefined,
    targetVehicleBrands: formData.targetVehicleBrands.length > 0 ? formData.targetVehicleBrands : undefined,
    targetVehicleModels: formData.targetVehicleModelsText
      ? formData.targetVehicleModelsText.split(",").map(s => s.trim()).filter(Boolean)
      : undefined,
    targetConnectorTypes: formData.targetConnectorTypes.length > 0 ? formData.targetConnectorTypes : undefined,
    targetBatteryMinKwh: formData.targetBatteryMinKwh ? parseFloat(formData.targetBatteryMinKwh) : undefined,
    targetBatteryMaxKwh: formData.targetBatteryMaxKwh ? parseFloat(formData.targetBatteryMaxKwh) : undefined,
    targetMinChargesPerMonth: formData.targetMinChargesPerMonth ? parseInt(formData.targetMinChargesPerMonth) : undefined,
    targetMaxChargesPerMonth: formData.targetMaxChargesPerMonth ? parseInt(formData.targetMaxChargesPerMonth) : undefined,
    targetMinSpendPerMonth: formData.targetMinSpendPerMonth ? parseFloat(formData.targetMinSpendPerMonth) : undefined,
    targetMaxSpendPerMonth: formData.targetMaxSpendPerMonth ? parseFloat(formData.targetMaxSpendPerMonth) : undefined,
    targetStartMethods: formData.targetStartMethods.length > 0 ? formData.targetStartMethods : undefined,
    targetChargeHoursStart: formData.targetChargeHoursStart !== "" ? parseInt(formData.targetChargeHoursStart) : undefined,
    targetChargeHoursEnd: formData.targetChargeHoursEnd !== "" ? parseInt(formData.targetChargeHoursEnd) : undefined,
    targetRoles: formData.targetRoles.length > 0 ? formData.targetRoles : undefined,
    targetSubscriptionTiers: formData.targetSubscriptionTiers.length > 0 ? formData.targetSubscriptionTiers : undefined,
    targetHasCard: formData.targetHasCard === "true" ? true : formData.targetHasCard === "false" ? false : undefined,
    targetWalletMinBalance: formData.targetWalletMinBalance ? parseFloat(formData.targetWalletMinBalance) : undefined,
    targetWalletMaxBalance: formData.targetWalletMaxBalance ? parseFloat(formData.targetWalletMaxBalance) : undefined,
    targetMinAvgRecharge: formData.targetMinAvgRecharge ? parseFloat(formData.targetMinAvgRecharge) : undefined,
    targetActivitySegments: formData.targetActivitySegments.length > 0 ? formData.targetActivitySegments : undefined,
  });

  const countActiveSegments = () => {
    const seg = buildSegmentationPayload();
    return Object.values(seg).filter(v => v !== undefined).length;
  };

  // ─── Contadores por sección ─────────────────────────────────────────────────

  const geoCount = [
    formData.targetCities.length, formData.targetDepartments.length,
    formData.targetStationCities.length, formData.targetStationIdsText ? 1 : 0,
  ].filter(n => n > 0).length;

  const vehicleCount = [
    formData.targetVehicleBrands.length, formData.targetVehicleModelsText ? 1 : 0,
    formData.targetConnectorTypes.length,
    formData.targetBatteryMinKwh ? 1 : 0, formData.targetBatteryMaxKwh ? 1 : 0,
  ].filter(n => n > 0).length;

  const behaviorCount = [
    formData.targetMinChargesPerMonth, formData.targetMaxChargesPerMonth,
    formData.targetMinSpendPerMonth, formData.targetMaxSpendPerMonth,
    formData.targetStartMethods.length > 0 ? "x" : "",
    formData.targetChargeHoursStart, formData.targetChargeHoursEnd,
  ].filter(Boolean).length;

  const subCount = [
    formData.targetRoles.length, formData.targetSubscriptionTiers.length,
    formData.targetHasCard ? 1 : 0,
  ].filter(n => n > 0).length;

  const financeCount = [
    formData.targetWalletMinBalance, formData.targetWalletMaxBalance, formData.targetMinAvgRecharge,
  ].filter(Boolean).length;

  const rfmCount = formData.targetActivitySegments.length;

  // ─── File upload ────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) { toast.error("Solo se permiten imágenes (JPEG, PNG, WebP, GIF, SVG)"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5MB"); return; }
    setIsUploading(true);
    setUploadedFileName(file.name);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadImageMutation.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
      setFormData(prev => ({ ...prev, imageUrl: result.url }));
      toast.success("Imagen subida exitosamente");
    } catch { setUploadedFileName(""); }
    finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── CRUD handlers ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formData.title || !formData.imageUrl) { toast.error("Título e imagen son obligatorios"); return; }
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
      ...buildSegmentationPayload(),
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
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split("T")[0] : "",
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "",
      advertiserName: banner.advertiserName || "",
      advertiserContact: "",
      // Segmentación
      targetCities: (banner.targetCities as string[]) || [],
      targetDepartments: (banner.targetDepartments as string[]) || [],
      targetStationCities: (banner.targetStationCities as string[]) || [],
      targetStationIdsText: (banner.targetStationIds as number[] || []).join(", "),
      targetVehicleBrands: (banner.targetVehicleBrands as string[]) || [],
      targetVehicleModelsText: (banner.targetVehicleModels as string[] || []).join(", "),
      targetConnectorTypes: (banner.targetConnectorTypes as string[]) || [],
      targetBatteryMinKwh: banner.targetBatteryMinKwh != null ? String(banner.targetBatteryMinKwh) : "",
      targetBatteryMaxKwh: banner.targetBatteryMaxKwh != null ? String(banner.targetBatteryMaxKwh) : "",
      targetMinChargesPerMonth: banner.targetMinChargesPerMonth != null ? String(banner.targetMinChargesPerMonth) : "",
      targetMaxChargesPerMonth: banner.targetMaxChargesPerMonth != null ? String(banner.targetMaxChargesPerMonth) : "",
      targetMinSpendPerMonth: banner.targetMinSpendPerMonth != null ? String(banner.targetMinSpendPerMonth) : "",
      targetMaxSpendPerMonth: banner.targetMaxSpendPerMonth != null ? String(banner.targetMaxSpendPerMonth) : "",
      targetStartMethods: (banner.targetStartMethods as string[]) || [],
      targetChargeHoursStart: banner.targetChargeHoursStart != null ? String(banner.targetChargeHoursStart) : "",
      targetChargeHoursEnd: banner.targetChargeHoursEnd != null ? String(banner.targetChargeHoursEnd) : "",
      targetRoles: (banner.targetRoles as string[]) || [],
      targetSubscriptionTiers: (banner.targetSubscriptionTiers as string[]) || [],
      targetHasCard: banner.targetHasCard === true ? "true" : banner.targetHasCard === false ? "false" : "",
      targetWalletMinBalance: banner.targetWalletMinBalance != null ? String(banner.targetWalletMinBalance) : "",
      targetWalletMaxBalance: banner.targetWalletMaxBalance != null ? String(banner.targetWalletMaxBalance) : "",
      targetMinAvgRecharge: banner.targetMinAvgRecharge != null ? String(banner.targetMinAvgRecharge) : "",
      targetActivitySegments: (banner.targetActivitySegments as string[]) || [],
    });
    setImageMode("url");
    setUploadedFileName("");
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
        ...buildSegmentationPayload(),
      },
    });
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Estás seguro de eliminar este banner?")) await deleteMutation.mutateAsync({ id });
  };

  // ─── UI helpers ─────────────────────────────────────────────────────────────

  const getTypeLabel = (type: string) => BANNER_TYPES.find(t => t.value === type)?.label || type;
  const getCTR = (impressions: number, clicks: number) =>
    impressions === 0 ? "0%" : ((clicks / impressions) * 100).toFixed(2) + "%";
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE": return <Badge className="bg-green-500">Activo</Badge>;
      case "PAUSED": return <Badge variant="secondary">Pausado</Badge>;
      case "DRAFT": return <Badge variant="outline">Borrador</Badge>;
      case "EXPIRED": return <Badge variant="destructive">Expirado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const recommendedSize = RECOMMENDED_SIZES[formData.type] || RECOMMENDED_SIZES.PROMOTIONAL;
  const totalActiveSegments = countActiveSegments();

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Banners</h1>
          <p className="text-muted-foreground">
            Administra los banners publicitarios con segmentación avanzada de audiencia
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) { setEditingBanner(null); resetForm(); }
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
              {/* ── Datos básicos ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input placeholder="Título del banner" value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de banner</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BANNER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Input placeholder="Subtítulo opcional" value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea placeholder="Descripción opcional del banner" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* ── Imagen ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Imagen del banner *</Label>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    {(["upload", "url"] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => setImageMode(mode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          imageMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {mode === "upload" ? <><Upload className="w-3.5 h-3.5" />Subir archivo</> : <><Link className="w-3.5 h-3.5" />Pegar URL</>}
                      </button>
                    ))}
                  </div>
                </div>

                {imageMode === "upload" ? (
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isUploading ? "border-primary/50 bg-primary/5 cursor-wait"
                      : formData.imageUrl && uploadedFileName ? "border-green-500/50 bg-green-500/5"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <input ref={fileInputRef} type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      onChange={handleFileSelect} className="hidden" />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Subiendo {uploadedFileName}...</p>
                      </div>
                    ) : formData.imageUrl && uploadedFileName ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-green-600">{uploadedFileName}</p>
                        <Button type="button" variant="ghost" size="sm"
                          className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setFormData(p => ({ ...p, imageUrl: "" })); setUploadedFileName(""); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Haz clic para seleccionar una imagen</p>
                        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF o SVG (máx. 5MB)</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Input placeholder="https://ejemplo.com/imagen.jpg" value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} />
                )}

                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-400/80">
                    <span className="font-medium text-blue-400">Tamaño recomendado: </span>
                    {recommendedSize.width} × {recommendedSize.height}px ({recommendedSize.ratio}) — {recommendedSize.note}
                  </p>
                </div>
              </div>

              {/* ── Link y CTA ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL de destino</Label>
                  <Input placeholder="https://ejemplo.com/promo" value={formData.linkUrl}
                    onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Texto del botón (CTA)</Label>
                  <Input placeholder="Ver más" value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })} />
                </div>
              </div>

              {/* ── Configuración ── */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Input type="number" min="1" value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input type="date" value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del anunciante</Label>
                  <Input placeholder="Empresa anunciante" value={formData.advertiserName}
                    onChange={(e) => setFormData({ ...formData, advertiserName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contacto del anunciante</Label>
                  <Input placeholder="email@empresa.com" value={formData.advertiserContact}
                    onChange={(e) => setFormData({ ...formData, advertiserContact: e.target.value })} />
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* SEGMENTACIÓN AVANZADA                                         */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <Target className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">Segmentación de audiencia</Label>
                  {totalActiveSegments > 0 && (
                    <Badge className="bg-primary/20 text-primary border-0 text-xs">
                      {totalActiveSegments} filtro{totalActiveSegments !== 1 ? "s" : ""} activo{totalActiveSegments !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sin filtros = todos los usuarios. Cada filtro activo restringe la audiencia.
                </p>

                <div className="space-y-2 pt-1">

                  {/* D1: Geografía */}
                  <SegmentSection icon={MapPin} title="Geografía" color="bg-blue-500/10 text-blue-400" activeCount={geoCount}>
                    <TagSelector
                      label="Ciudad de residencia del usuario"
                      options={[
                        "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena",
                        "Bucaramanga", "Manizales", "Pereira", "Armenia", "Ibagué",
                        "Villavicencio", "Cúcuta", "Pasto", "Montería", "Santa Marta",
                      ].map(c => ({ value: c, label: c }))}
                      selected={formData.targetCities}
                      onToggle={(v) => toggleTag("targetCities", v)}
                      placeholder="vacío = todas las ciudades"
                    />
                    <TagSelector
                      label="Departamento"
                      options={COLOMBIA_DEPARTMENTS.map(d => ({ value: d, label: d }))}
                      selected={formData.targetDepartments}
                      onToggle={(v) => toggleTag("targetDepartments", v)}
                    />
                    <TagSelector
                      label="Ciudad de la estación de carga"
                      options={[
                        "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena",
                        "Bucaramanga", "Manizales", "Pereira", "Armenia",
                      ].map(c => ({ value: c, label: c }))}
                      selected={formData.targetStationCities}
                      onToggle={(v) => toggleTag("targetStationCities", v)}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">IDs de estaciones específicas (separados por coma)</Label>
                      <Input
                        placeholder="ej: 101, 205, 318"
                        value={formData.targetStationIdsText}
                        onChange={(e) => setFormData({ ...formData, targetStationIdsText: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </SegmentSection>

                  {/* D2: Vehículo */}
                  <SegmentSection icon={Car} title="Vehículo" color="bg-green-500/10 text-green-400" activeCount={vehicleCount}>
                    <TagSelector
                      label="Marca del vehículo"
                      options={VEHICLE_BRANDS.map(b => ({ value: b, label: b }))}
                      selected={formData.targetVehicleBrands}
                      onToggle={(v) => toggleTag("targetVehicleBrands", v)}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Modelos específicos (separados por coma)</Label>
                      <Input
                        placeholder="ej: Model 3, Dolphin, Zoe"
                        value={formData.targetVehicleModelsText}
                        onChange={(e) => setFormData({ ...formData, targetVehicleModelsText: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <TagSelector
                      label="Tipo de conector"
                      options={CONNECTOR_OPTIONS}
                      selected={formData.targetConnectorTypes}
                      onToggle={(v) => toggleTag("targetConnectorTypes", v)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Batería mínima (kWh)</Label>
                        <Input type="number" placeholder="ej: 40" value={formData.targetBatteryMinKwh}
                          onChange={(e) => setFormData({ ...formData, targetBatteryMinKwh: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Batería máxima (kWh)</Label>
                        <Input type="number" placeholder="ej: 100" value={formData.targetBatteryMaxKwh}
                          onChange={(e) => setFormData({ ...formData, targetBatteryMaxKwh: e.target.value })} className="text-sm" />
                      </div>
                    </div>
                  </SegmentSection>

                  {/* D3: Comportamiento */}
                  <SegmentSection icon={Zap} title="Comportamiento de carga" color="bg-yellow-500/10 text-yellow-400" activeCount={behaviorCount}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cargas/mes mínimo</Label>
                        <Input type="number" placeholder="ej: 4" value={formData.targetMinChargesPerMonth}
                          onChange={(e) => setFormData({ ...formData, targetMinChargesPerMonth: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cargas/mes máximo</Label>
                        <Input type="number" placeholder="ej: 20" value={formData.targetMaxChargesPerMonth}
                          onChange={(e) => setFormData({ ...formData, targetMaxChargesPerMonth: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Gasto/mes mínimo (COP)</Label>
                        <Input type="number" placeholder="ej: 50000" value={formData.targetMinSpendPerMonth}
                          onChange={(e) => setFormData({ ...formData, targetMinSpendPerMonth: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Gasto/mes máximo (COP)</Label>
                        <Input type="number" placeholder="ej: 500000" value={formData.targetMaxSpendPerMonth}
                          onChange={(e) => setFormData({ ...formData, targetMaxSpendPerMonth: e.target.value })} className="text-sm" />
                      </div>
                    </div>
                    <TagSelector
                      label="Método de inicio de carga"
                      options={START_METHOD_OPTIONS}
                      selected={formData.targetStartMethods}
                      onToggle={(v) => toggleTag("targetStartMethods", v)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Hora típica desde (0-23)</Label>
                        <Input type="number" min="0" max="23" placeholder="ej: 8" value={formData.targetChargeHoursStart}
                          onChange={(e) => setFormData({ ...formData, targetChargeHoursStart: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Hora típica hasta (0-23)</Label>
                        <Input type="number" min="0" max="23" placeholder="ej: 18" value={formData.targetChargeHoursEnd}
                          onChange={(e) => setFormData({ ...formData, targetChargeHoursEnd: e.target.value })} className="text-sm" />
                      </div>
                    </div>
                  </SegmentSection>

                  {/* D4: Suscripción y rol */}
                  <SegmentSection icon={CreditCard} title="Suscripción y rol" color="bg-purple-500/10 text-purple-400" activeCount={subCount}>
                    <TagSelector
                      label="Rol del usuario"
                      options={ROLE_OPTIONS}
                      selected={formData.targetRoles}
                      onToggle={(v) => toggleTag("targetRoles", v)}
                    />
                    <TagSelector
                      label="Tier de suscripción"
                      options={SUBSCRIPTION_OPTIONS}
                      selected={formData.targetSubscriptionTiers}
                      onToggle={(v) => toggleTag("targetSubscriptionTiers", v)}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tarjeta registrada</Label>
                      <Select value={formData.targetHasCard} onValueChange={(v: any) => setFormData({ ...formData, targetHasCard: v })}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Sin filtro" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin filtro</SelectItem>
                          <SelectItem value="true">Solo con tarjeta</SelectItem>
                          <SelectItem value="false">Solo sin tarjeta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </SegmentSection>

                  {/* D5: Perfil financiero */}
                  <SegmentSection icon={Wallet} title="Perfil financiero" color="bg-orange-500/10 text-orange-400" activeCount={financeCount}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Saldo billetera mínimo (COP)</Label>
                        <Input type="number" placeholder="ej: 10000" value={formData.targetWalletMinBalance}
                          onChange={(e) => setFormData({ ...formData, targetWalletMinBalance: e.target.value })} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Saldo billetera máximo (COP)</Label>
                        <Input type="number" placeholder="ej: 1000000" value={formData.targetWalletMaxBalance}
                          onChange={(e) => setFormData({ ...formData, targetWalletMaxBalance: e.target.value })} className="text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Monto promedio de recarga mínimo (COP)</Label>
                      <Input type="number" placeholder="ej: 50000" value={formData.targetMinAvgRecharge}
                        onChange={(e) => setFormData({ ...formData, targetMinAvgRecharge: e.target.value })} className="text-sm" />
                    </div>
                  </SegmentSection>

                  {/* D7: Actividad RFM */}
                  <SegmentSection icon={Activity} title="Actividad del usuario (RFM)" color="bg-red-500/10 text-red-400" activeCount={rfmCount}>
                    <TagSelector
                      label="Segmento de actividad"
                      options={ACTIVITY_SEGMENT_OPTIONS}
                      selected={formData.targetActivitySegments}
                      onToggle={(v) => toggleTag("targetActivitySegments", v)}
                      placeholder="vacío = todos los segmentos"
                    />
                    <div className="p-2.5 rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">¿Cómo se calcula?</p>
                      <p><span className="text-green-400">Activo:</span> última carga hace menos de 30 días</p>
                      <p><span className="text-yellow-400">En riesgo:</span> sin carga entre 30 y 60 días</p>
                      <p><span className="text-red-400">Dormido:</span> sin carga hace más de 60 días</p>
                      <p><span className="text-blue-400">Nuevo:</span> cuenta creada hace menos de 30 días sin cargas</p>
                    </div>
                  </SegmentSection>

                </div>
              </div>

              {/* ── Vista previa ── */}
              {formData.imageUrl && (
                <div className="space-y-2">
                  <Label>Vista previa</Label>
                  <div className="border rounded-lg overflow-hidden bg-muted/50">
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-40 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x400?text=Imagen+no+disponible"; }} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingBanner(null); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={editingBanner ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending || isUploading}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</>
                ) : editingBanner ? "Guardar cambios" : "Crear banner"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{banners?.filter((b: any) => b.status === "ACTIVE").length || 0}</div>
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

      {/* ── Tabla ── */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Segmentación</TableHead>
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
              <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando banners...</TableCell></TableRow>
            ) : !banners || banners.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay banners registrados</TableCell></TableRow>
            ) : (
              banners.map((banner: any) => {
                const segCount = [
                  banner.targetCities, banner.targetDepartments, banner.targetStationCities,
                  banner.targetStationIds, banner.targetVehicleBrands, banner.targetVehicleModels,
                  banner.targetConnectorTypes, banner.targetRoles, banner.targetSubscriptionTiers,
                  banner.targetActivitySegments, banner.targetStartMethods,
                ].filter((v: any) => Array.isArray(v) ? v.length > 0 : v != null).length +
                [
                  banner.targetBatteryMinKwh, banner.targetBatteryMaxKwh,
                  banner.targetMinChargesPerMonth, banner.targetMaxChargesPerMonth,
                  banner.targetMinSpendPerMonth, banner.targetMaxSpendPerMonth,
                  banner.targetWalletMinBalance, banner.targetWalletMaxBalance,
                  banner.targetMinAvgRecharge, banner.targetChargeHoursStart,
                  banner.targetHasCard,
                ].filter((v: any) => v != null).length;

                return (
                  <TableRow key={banner.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                          <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/64x40?text=..."; }} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{banner.title}</div>
                          <div className="text-xs text-muted-foreground">Prioridad: {banner.priority}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{getTypeLabel(banner.type)}</Badge></TableCell>
                    <TableCell>
                      {segCount > 0 ? (
                        <Badge className="bg-primary/15 text-primary border-0 text-xs">
                          <Target className="w-3 h-3 mr-1" />
                          {segCount} filtro{segCount !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Todos</span>
                      )}
                    </TableCell>
                    <TableCell>{(banner.impressions || 0).toLocaleString()}</TableCell>
                    <TableCell>{(banner.clicks || 0).toLocaleString()}</TableCell>
                    <TableCell>{getCTR(banner.impressions || 0, banner.clicks || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(banner.status)}
                        <Switch checked={banner.status === "ACTIVE"}
                          onCheckedChange={() => toggleActiveMutation.mutate({ id: banner.id })} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {banner.startDate || banner.endDate ? (
                        <div className="text-xs">
                          {banner.startDate && new Date(banner.startDate).toLocaleDateString("es-CO")}
                          {banner.startDate && banner.endDate && " - "}
                          {banner.endDate && new Date(banner.endDate).toLocaleDateString("es-CO")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin límite</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Ver analytics"
                          onClick={() => setLocation(`/admin/banners/${banner.id}/analytics`)}
                          className="text-cyan-500 hover:text-cyan-400">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(banner)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(banner.id)}
                          className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
