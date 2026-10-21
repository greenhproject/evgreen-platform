/**
 * EVGreen - Panel de Administración de Espacios Postulados
 * Gestión completa: revisión, evaluación técnica, scoring IA,
 * envío de carta de intención y publicación en crowdfunding
 * 
 * FEATURES: Filtros avanzados, selección múltiple, acciones masivas
 * RESPONSIVE: Optimizado para desktop, tablet y móvil
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ManualFormalizationAudit, ManualFormalizationFields } from "@/components/spaces/ManualFormalizationAudit";
import { SpacePhotoLightbox } from "@/components/spaces/SpacePhotoLightbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getSpacePipelineAction } from "@shared/space-pipeline-actions";
import { getRevenueDistributionForSpaceType, resolveDcInfrastructureRequirement } from "@shared/space-investment-scoring-policy";
import { buildSpaceTrafficProjection } from "@shared/space-traffic-financial-projection";
import { isNetRevenueDistributionValid, parseOptionalBoundedPercentageInput } from "@shared/percentage-input";
import { getPhotoTypeLabel } from "@shared/photo-type-labels";
import { removePendingSpacePhoto, setPendingSpacePhotoCover } from "./space-photo-selection";
import {
  MapPin, Search, Filter, Eye, Zap, Star, Send, Globe, Brain,
  CheckCircle2, XCircle, Clock, FileText, Loader2, ChevronLeft,
  ChevronRight, Building2, Phone, Mail, Camera, BarChart3,
  TrendingUp, DollarSign, ArrowUpRight, ExternalLink, RefreshCw,
  ChevronDown, X, Pencil, Trash2, AlertTriangle, Users, Download,
  CheckSquare, Square, Minus, SlidersHorizontal, Calendar, FileDown, Settings2, Plus, Copy, Link2, MessageCircle,
  Sun,
} from "lucide-react";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock },
  under_review: { label: "En revisión", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Eye },
  approved: { label: "Aprobado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Rechazado", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: XCircle },
  letter_sent: { label: "Carta enviada", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Send },
  letter_accepted: { label: "Carta aceptada", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: FileText },
  published: { label: "Publicado", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: Globe },
  funded: { label: "Fondeado", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: DollarSign },
  in_construction: { label: "En construcción", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: Building2 },
  operational: { label: "Operativo", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: Zap },
};

const SPACE_TYPE_LABELS: Record<string, string> = {
  parking: "Parqueadero", mall: "Centro comercial", gas_station: "Estación de servicio",
  hotel: "Hotel", restaurant: "Restaurante", office_building: "Oficinas",
  residential: "Residencial", supermarket: "Supermercado", hospital: "Hospital",
  university: "Universidad", airport: "Aeropuerto", highway_rest: "Parador", other: "Otro",
};
const SPACE_PHOTO_TYPE_OPTIONS = [
  "general", "electrical_panel", "transformer", "parking_area", "access_road", "surroundings", "other",
] as const;

function coverPhotoActionLabel(isCover: boolean): string {
  return isCover ? "✓ Actual" : "Hacer portada";
}

function conceptualPhotoActionLabel(isConceptual: boolean): string {
  return isConceptual ? "Quitar render" : "Marcar render";
}

const COMMERCIAL_NEXT_STEPS: Partial<Record<string, { status: "funded" | "in_construction" | "operational"; label: string; description: string }>> = {
  published: { status: "funded", label: "Confirmar fondeo", description: "La meta de inversión fue completada para esta oferta." },
  funded: { status: "in_construction", label: "Iniciar construcción", description: "La oferta pasa de fondeada a ejecución de obra." },
  in_construction: { status: "operational", label: "Marcar operativo", description: "La estación queda lista para operación comercial." },
};

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw || !/^[+-]?[\d.,]+$/.test(raw)) return undefined;
  const sign = raw.startsWith("-") ? "-" : raw.startsWith("+") ? "+" : "";
  const unsigned = sign ? raw.slice(1) : raw;
  const commas = [...unsigned.matchAll(/,/g)].map((match) => match.index ?? 0);
  const dots = [...unsigned.matchAll(/\./g)].map((match) => match.index ?? 0);
  let normalized: string;
  if (commas.length && dots.length) {
    const decimalIndex = Math.max(commas.at(-1)!, dots.at(-1)!);
    normalized = `${unsigned.slice(0, decimalIndex).replace(/[.,]/g, "")}.${unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "")}`;
  } else {
    const indexes = commas.length ? commas : dots;
    const lastIndex = indexes.at(-1);
    if (lastIndex === undefined) normalized = unsigned;
    else if (unsigned.length - lastIndex - 1 === 3) normalized = unsigned.replace(/[.,]/g, "");
    else if (indexes.length === 1) normalized = `${unsigned.slice(0, lastIndex)}.${unsigned.slice(lastIndex + 1)}`;
    else return undefined;
  }
  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalInteger(value: unknown): number | undefined {
  const numberValue = toOptionalNumber(value);
  return numberValue !== undefined && Number.isInteger(numberValue) ? numberValue : undefined;
}

function numericInputError(label: string, value: unknown, integer = false): string | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = integer ? toOptionalInteger(value) : toOptionalNumber(value);
  return parsed === undefined ? `${label}: ingresa un número válido. Puedes usar 1.500.000, 1,500,000, 112,5 o 112.5.` : null;
}

function getOperatingHoursPerDay(start: unknown, end: unknown, is24Hours: unknown): number {
  if (Boolean(is24Hours)) return 24;
  const toMinutes = (value: unknown) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ""));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return 16;
  const duration = endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60 - startMinutes) + endMinutes;
  return duration > 0 ? duration / 60 : 16;
}

function humanizeSpaceError(message: string, action: "crear" | "actualizar") {
  if (/out of range|data truncated|value is out of range/i.test(message)) {
    return `Uno de los valores numéricos excede el rango permitido para ${action} el espacio. Verifica importes, porcentajes o potencias e inténtalo de nuevo.`;
  }
  if (/failed query|insert into [`"]?space_submissions|unknown column|incorrect decimal|data truncated/i.test(message)) {
    return `No fue posible ${action} el espacio. Revisa los valores numéricos: puedes usar punto o coma (por ejemplo, 1.500.000 o 112,5) e inténtalo de nuevo.`;
  }
  return message;
}

function parseAiAnalysis(value: string | null | undefined): Record<string, any> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Compress image file using Canvas to reduce size before upload
async function compressImageFile(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("No fue posible leer el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

export default function AdminSpaces() {
  const { user } = useAuth();
  const canManageAdministrativeActions = user?.role === "admin" || user?.role === "staff";
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  // Create manual space dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    spaceName: "", spaceType: "parking", address: "", city: "", department: "",
    submitterName: "", submitterEmail: "", submitterPhone: "",
    submitterCompany: "", latitude: "", longitude: "",
    transformerCapacityKva: "", parkingSpots: "", availableAreaM2: "",
    estimatedDailyVehicles: "", estimatedEvPercent: "5", socioeconomicStratum: "",
    estimatedInvestmentCop: "", estimatedPowerKw: "120", estimatedChargerCount: "1",
    hasSolarPanels: false,
    solarCoveragePercent: "", solarEnergyCostPerKwh: "",
    solarProgramEnabled: false,
    solarProgramCurrentBillCop: "", solarProgramEnergyOffsetPercent: "", solarProgramSavingsCoveragePercent: "",
    solarProgramMonthlyFinancingPaymentCop: "", solarProgramInitialMonthlySolarBillCop: "", solarProgramPostAgreementMonthlySolarBillCop: "",
    solarProgramTotalEnergySavingsCop: "", solarProgramAnnualReturnPercent: "",
    solarProgramAgreementYears: "6", solarProgramAnnualCpiPercent: "3", solarProgramUsefulLifeYears: "30",
    solarSystemPowerKwp: "", solarAnnualGenerationKwh: "", solarSelfConsumptionPercent: "", solarExportPercent: "", solarGridTariffCopPerKwh: "",
    electricalDistance: "",
    hasElectricalPanel: false,
    hasInternet: false,
    operatingHoursStart: "06:00",
    operatingHoursEnd: "22:00",
    is24Hours: false,
    requiresNewTransformer: false,
    proposedTransformerKva: "",
    electricalViability: "",
    investmentType: "individual",
    additionalNotes: "",
    nearbyAttractions: "",
  });
  const [createPhotos, setCreatePhotos] = useState<Array<{ file: File; preview: string; photoType: string; isCover?: boolean; isConceptual?: boolean }>>([]);
  const [createSolarOfferPdf, setCreateSolarOfferPdf] = useState<File | null>(null);
  const [createPreparation, setCreatePreparation] = useState<{ stage: "idle" | "preparing" | "submitting"; completed: number; total: number }>({ stage: "idle", completed: 0, total: 0 });
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "scored" | "unscored">("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkScoreDialog, setShowBulkScoreDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("under_review");
  const [bulkScore, setBulkScore] = useState(50);

  const activeFiltersCount = [cityFilter, typeFilter, dateFrom, dateTo, scoreFilter !== "all" ? scoreFilter : ""].filter(Boolean).length;

  const { data, isLoading, refetch } = trpc.spaces.admin.list.useQuery({
    status: statusFilter,
    search: search || undefined,
    city: cityFilter || undefined,
    spaceType: typeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    hasScore: scoreFilter !== "all" ? scoreFilter : undefined,
    limit,
    offset,
  });

  const bulkDeleteMutation = trpc.spaces.admin.bulkDelete.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deletedCount} espacios eliminados`);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkUpdateStatusMutation = trpc.spaces.admin.bulkUpdateStatus.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.updatedCount} espacios actualizados`);
      setSelectedIds(new Set());
      setShowBulkStatusDialog(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkAssignScoreMutation = trpc.spaces.admin.bulkAssignScore.useMutation({
    onSuccess: (res) => {
      toast.success(`Score asignado a ${res.updatedCount} espacios`);
      setSelectedIds(new Set());
      setShowBulkScoreDialog(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const createSpaceMutation = trpc.spaces.submit.useMutation({
    onSuccess: (res) => {
      toast.success(`Espacio creado: ${res.code}`);
      setCreateSubmitError(null);
      setShowCreateDialog(false);
      setCreateForm({
        spaceName: "", spaceType: "parking", address: "", city: "", department: "",
        submitterName: "", submitterEmail: "", submitterPhone: "",
        submitterCompany: "", latitude: "", longitude: "",
        transformerCapacityKva: "", parkingSpots: "", availableAreaM2: "",
        estimatedDailyVehicles: "", estimatedEvPercent: "5", socioeconomicStratum: "",
        estimatedInvestmentCop: "", estimatedPowerKw: "120", estimatedChargerCount: "1",
        hasSolarPanels: false,
        solarCoveragePercent: "", solarEnergyCostPerKwh: "",
        solarProgramEnabled: false,
        solarProgramCurrentBillCop: "", solarProgramEnergyOffsetPercent: "", solarProgramSavingsCoveragePercent: "",
        solarProgramMonthlyFinancingPaymentCop: "", solarProgramInitialMonthlySolarBillCop: "", solarProgramPostAgreementMonthlySolarBillCop: "",
        solarProgramTotalEnergySavingsCop: "", solarProgramAnnualReturnPercent: "",
        solarProgramAgreementYears: "6", solarProgramAnnualCpiPercent: "3", solarProgramUsefulLifeYears: "30",
        solarSystemPowerKwp: "", solarAnnualGenerationKwh: "", solarSelfConsumptionPercent: "", solarExportPercent: "", solarGridTariffCopPerKwh: "",
        electricalDistance: "",
        hasElectricalPanel: false,
        hasInternet: false,
        operatingHoursStart: "06:00",
        operatingHoursEnd: "22:00",
        is24Hours: false,
        requiresNewTransformer: false,
        proposedTransformerKva: "",
        electricalViability: "",
        investmentType: "individual",
        additionalNotes: "",
        nearbyAttractions: "",
      });
      createPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setCreatePhotos([]);
      setCreateSolarOfferPdf(null);
      refetch();
    },
    onError: (err) => {
      const message = humanizeSpaceError(err.message, "crear");
      setCreateSubmitError(message);
      toast.error(message);
    },
  });

  const submissions = data?.submissions || [];
  const total = data?.total || 0;
  const statusCounts = data?.statusCounts || {};
  const filterOptions = data?.filterOptions || { cities: [], types: [] };

  const allVisibleIds = submissions.map((s: any) => s.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: number) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id: number) => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      const newSet = new Set(selectedIds);
      allVisibleIds.forEach((id: number) => newSet.delete(id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      allVisibleIds.forEach((id: number) => newSet.add(id));
      setSelectedIds(newSet);
    }
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  function clearFilters() {
    setCityFilter("");
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setScoreFilter("all");
    setOffset(0);
  }

  const isCreatingManualSpace = createPreparation.stage !== "idle" || createSpaceMutation.isPending;

  function discardCreatePhotos() {
    createPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setCreatePhotos([]);
  }

  function handleCreateDialogOpenChange(open: boolean) {
    if (!open && isCreatingManualSpace) return;
    if (!open) {
      discardCreatePhotos();
      setCreateSubmitError(null);
    }
    setShowCreateDialog(open);
  }

  function removeCreatePhoto(index: number) {
    setCreatePhotos((previous) => {
      const result = removePendingSpacePhoto(previous, index, { ensureCover: true });
      if (result.removed) URL.revokeObjectURL(result.removed.preview);
      return result.photos;
    });
  }

  async function handleCreateManualSpace() {
    setCreateSubmitError(null);
    if (!createForm.spaceName || !createForm.address || !createForm.city || !createForm.submitterName || !createForm.submitterEmail || !createForm.submitterPhone) {
      const message = "Completa los campos obligatorios (*) antes de crear el espacio.";
      setCreateSubmitError(message);
      toast.error(message);
      return;
    }
    const numericError = [
      numericInputError("Transformador", createForm.transformerCapacityKva),
      numericInputError("Área", createForm.availableAreaM2),
      numericInputError("Parqueos", createForm.parkingSpots, true),
      numericInputError("Vehículos/día", createForm.estimatedDailyVehicles, true),
      numericInputError("% de vehículos EV", createForm.estimatedEvPercent, true),
      numericInputError("Estrato", createForm.socioeconomicStratum, true),
      numericInputError("Latitud", createForm.latitude),
      numericInputError("Longitud", createForm.longitude),
      numericInputError("Distancia al transformador", createForm.electricalDistance, true),
      numericInputError("Transformador propuesto", createForm.proposedTransformerKva),
      numericInputError("Inversión estimada", createForm.estimatedInvestmentCop),
      numericInputError("Potencia DC", createForm.estimatedPowerKw, true),
      numericInputError("Cargadores", createForm.estimatedChargerCount, true),
      numericInputError("Factura solar mensual", createForm.solarProgramCurrentBillCop),
      numericInputError("Energía frente al consumo", createForm.solarProgramEnergyOffsetPercent),
      numericInputError("Cobertura de ahorro solar", createForm.solarProgramSavingsCoveragePercent),
      numericInputError("Cuota solar mensual", createForm.solarProgramMonthlyFinancingPaymentCop),
      numericInputError("Factura solar residual año 1", createForm.solarProgramInitialMonthlySolarBillCop),
      numericInputError("Factura solar residual posterior", createForm.solarProgramPostAgreementMonthlySolarBillCop),
      numericInputError("Ahorro total de energía", createForm.solarProgramTotalEnergySavingsCop),
      numericInputError("Rendimiento anual solar", createForm.solarProgramAnnualReturnPercent),
      numericInputError("Plazo solar", createForm.solarProgramAgreementYears, true),
      numericInputError("IPC solar", createForm.solarProgramAnnualCpiPercent),
      numericInputError("Vida útil solar", createForm.solarProgramUsefulLifeYears, true),
      numericInputError("Potencia solar", createForm.solarSystemPowerKwp),
      numericInputError("Generación solar anual", createForm.solarAnnualGenerationKwh),
      numericInputError("Autoconsumo solar", createForm.solarSelfConsumptionPercent),
      numericInputError("Exportación solar", createForm.solarExportPercent),
      numericInputError("Tarifa de red solar", createForm.solarGridTariffCopPerKwh, true),
    ].find(Boolean);
    if (numericError) {
      setCreateSubmitError(numericError);
      toast.error(numericError);
      return;
    }

    const evPercent = toOptionalInteger(createForm.estimatedEvPercent);
    if (evPercent !== undefined && (evPercent < 0 || evPercent > 100)) {
      const message = "El porcentaje de vehículos EV debe estar entre 0 y 100.";
      setCreateSubmitError(message);
      toast.error(message);
      return;
    }
    if (createPhotos.some(photo => photo.file.size > 10 * 1024 * 1024)) {
      const message = "Cada foto debe pesar máximo 10 MB. Retira o comprime la foto más pesada e inténtalo de nuevo.";
      setCreateSubmitError(message);
      toast.error(message);
      return;
    }
    if (createSolarOfferPdf && createSolarOfferPdf.size > 15 * 1024 * 1024) {
      const message = "La oferta solar PDF debe pesar máximo 15 MB para crear el espacio.";
      setCreateSubmitError(message);
      toast.error(message);
      return;
    }

    let submittedMutation = false;
    try {
      setCreatePreparation({ stage: "preparing", completed: 0, total: createPhotos.length });
      const photosData: Array<{ base64: string; fileName: string; contentType: "image/jpeg"; photoType: any; isCover: boolean; isConceptual: boolean }> = [];
      for (const [index, photo] of createPhotos.entries()) {
        const base64 = await compressImageFile(photo.file, 1200, 0.7);
        photosData.push({
          base64,
          fileName: photo.file.name,
          contentType: "image/jpeg",
          photoType: photo.photoType as any,
          isCover: Boolean(photo.isCover),
          isConceptual: Boolean(photo.isConceptual),
        });
        setCreatePreparation({ stage: "preparing", completed: index + 1, total: createPhotos.length });
      }
      const solarOfferPdf = createSolarOfferPdf
        ? { base64: await readFileAsBase64(createSolarOfferPdf), fileName: createSolarOfferPdf.name, contentType: "application/pdf" as const }
        : undefined;
      const attachmentBase64Bytes = photosData.reduce((total, photo) => total + photo.base64.length, 0) + (solarOfferPdf?.base64.length ?? 0);
      if (attachmentBase64Bytes > 36 * 1024 * 1024) {
        throw new Error("Los adjuntos comprimidos superan el límite seguro de 36 MB. Reduce la cantidad de fotos o adjunta una oferta PDF más liviana.");
      }

      setCreatePreparation({ stage: "submitting", completed: createPhotos.length, total: createPhotos.length });
      submittedMutation = true;
      await createSpaceMutation.mutateAsync({
        spaceName: createForm.spaceName, spaceType: createForm.spaceType as any, address: createForm.address, city: createForm.city,
        department: createForm.department || undefined, submitterName: createForm.submitterName, submitterEmail: createForm.submitterEmail,
        submitterPhone: createForm.submitterPhone, submitterCompany: createForm.submitterCompany || undefined,
        latitude: toOptionalNumber(createForm.latitude)?.toString(), longitude: toOptionalNumber(createForm.longitude)?.toString(),
        transformerCapacityKva: toOptionalNumber(createForm.transformerCapacityKva)?.toString(), availableAreaM2: toOptionalNumber(createForm.availableAreaM2)?.toString(),
        parkingSpots: toOptionalInteger(createForm.parkingSpots), estimatedDailyVehicles: toOptionalInteger(createForm.estimatedDailyVehicles), estimatedEvPercent: evPercent,
        socioeconomicStratum: toOptionalInteger(createForm.socioeconomicStratum), estimatedInvestmentCop: toOptionalNumber(createForm.estimatedInvestmentCop),
        estimatedPowerKw: toOptionalInteger(createForm.estimatedPowerKw), estimatedChargerCount: toOptionalInteger(createForm.estimatedChargerCount),
        hasSolarPanels: createForm.hasSolarPanels, solarCoveragePercent: toOptionalNumber(createForm.solarCoveragePercent), solarEnergyCostPerKwh: toOptionalInteger(createForm.solarEnergyCostPerKwh),
        solarProgramEnabled: createForm.solarProgramEnabled, solarProgramCurrentBillCop: toOptionalNumber(createForm.solarProgramCurrentBillCop),
        solarProgramEnergyOffsetPercent: toOptionalNumber(createForm.solarProgramEnergyOffsetPercent), solarProgramSavingsCoveragePercent: toOptionalNumber(createForm.solarProgramSavingsCoveragePercent),
        solarProgramMonthlyFinancingPaymentCop: toOptionalNumber(createForm.solarProgramMonthlyFinancingPaymentCop), solarProgramInitialMonthlySolarBillCop: toOptionalNumber(createForm.solarProgramInitialMonthlySolarBillCop),
        solarProgramPostAgreementMonthlySolarBillCop: toOptionalNumber(createForm.solarProgramPostAgreementMonthlySolarBillCop), solarProgramTotalEnergySavingsCop: toOptionalNumber(createForm.solarProgramTotalEnergySavingsCop),
        solarProgramAnnualReturnPercent: toOptionalNumber(createForm.solarProgramAnnualReturnPercent), solarProgramAgreementYears: toOptionalInteger(createForm.solarProgramAgreementYears),
        solarProgramAnnualCpiPercent: toOptionalNumber(createForm.solarProgramAnnualCpiPercent), solarProgramUsefulLifeYears: toOptionalInteger(createForm.solarProgramUsefulLifeYears),
        solarSystemPowerKwp: toOptionalNumber(createForm.solarSystemPowerKwp), solarAnnualGenerationKwh: toOptionalNumber(createForm.solarAnnualGenerationKwh),
        solarSelfConsumptionPercent: toOptionalNumber(createForm.solarSelfConsumptionPercent), solarExportPercent: toOptionalNumber(createForm.solarExportPercent), solarGridTariffCopPerKwh: toOptionalInteger(createForm.solarGridTariffCopPerKwh),
        electricalDistance: toOptionalInteger(createForm.electricalDistance), hasElectricalPanel: createForm.hasElectricalPanel, hasInternet: createForm.hasInternet,
        operatingHoursStart: createForm.operatingHoursStart || undefined, operatingHoursEnd: createForm.operatingHoursEnd || undefined, is24Hours: createForm.is24Hours,
        requiresNewTransformer: createForm.requiresNewTransformer, proposedTransformerKva: toOptionalNumber(createForm.proposedTransformerKva),
        electricalViability: (createForm.electricalViability as any) || undefined, investmentType: (createForm.investmentType as any) || "individual",
        nearbyAttractions: createForm.nearbyAttractions.trim() || undefined, additionalNotes: createForm.additionalNotes.trim() || undefined,
        photos: photosData.length > 0 ? photosData : undefined, solarOfferPdf,
      });
    } catch (error) {
      if (!submittedMutation) {
        const message = error instanceof Error ? error.message : "No fue posible preparar los adjuntos para crear el espacio.";
        setCreateSubmitError(message);
        toast.error(message);
      }
    } finally {
      setCreatePreparation({ stage: "idle", completed: 0, total: 0 });
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            Espacios Postulados
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Gestión de postulaciones para cargadores EV
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Plus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Crear</span>
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className={`border-[#374151] text-gray-300 ${showFilters ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : ""}`}
          >
            <SlidersHorizontal className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 bg-emerald-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="border-[#374151] text-gray-300">
            <RefreshCw className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              Filtros Avanzados
            </h3>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 hover:text-white h-7 text-xs">
                <X className="w-3 h-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* City filter */}
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Ciudad</Label>
              <Select value={cityFilter} onValueChange={(v) => { setCityFilter(v === "__all__" ? "" : v); setOffset(0); }}>
                <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white h-9 text-xs">
                  <SelectValue placeholder="Todas las ciudades" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2937] border-[#374151]">
                  <SelectItem value="__all__" className="text-gray-300">Todas las ciudades</SelectItem>
                  {filterOptions.cities.map((city: string) => (
                    <SelectItem key={city} value={city} className="text-gray-300">{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type filter */}
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Tipo</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === "__all__" ? "" : v); setOffset(0); }}>
                <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white h-9 text-xs">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2937] border-[#374151]">
                  <SelectItem value="__all__" className="text-gray-300">Todos los tipos</SelectItem>
                  {filterOptions.types.map((type: string) => (
                    <SelectItem key={type} value={type} className="text-gray-300">{SPACE_TYPE_LABELS[type] || type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
                className="bg-[#0a0f1a] border-[#374151] text-white h-9 text-xs"
              />
            </div>

            {/* Date to */}
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
                className="bg-[#0a0f1a] border-[#374151] text-white h-9 text-xs"
              />
            </div>

            {/* Score filter */}
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Score IA</Label>
              <Select value={scoreFilter} onValueChange={(v: any) => { setScoreFilter(v); setOffset(0); }}>
                <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white h-9 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2937] border-[#374151]">
                  <SelectItem value="all" className="text-gray-300">Todos</SelectItem>
                  <SelectItem value="scored" className="text-gray-300">Con score</SelectItem>
                  <SelectItem value="unscored" className="text-gray-300">Sin calificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {canManageAdministrativeActions && selectedIds.size > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300 font-medium">
              {selectedIds.size} espacio{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white h-6 text-xs px-2">
              <X className="w-3 h-3 mr-1" />
              Deseleccionar
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkStatusDialog(true)}
              className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 h-7 text-xs"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Cambiar Estado
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkScoreDialog(true)}
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 h-7 text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              Asignar Score
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(true)}
              className="border-red-500/30 text-red-300 hover:bg-red-500/10 h-7 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Status tabs - scrollable on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        <button
          onClick={() => { setStatusFilter("all"); setOffset(0); }}
          className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${
            statusFilter === "all"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-[#1f2937] text-gray-400 border border-[#374151] hover:border-[#4b5563]"
          }`}
        >
          Todos ({total})
        </button>
        {Object.entries(STATUS_LABELS).map(([key, { label }]) => {
          const cnt = statusCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setOffset(0); }}
              className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${
                statusFilter === key
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-[#1f2937] text-gray-400 border border-[#374151] hover:border-[#4b5563]"
              }`}
            >
              {label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Buscar por código, nombre, email, ciudad..."
          className="pl-10 bg-[#111827] border-[#374151] text-white placeholder:text-gray-600 text-sm"
        />
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2937]">
                {canManageAdministrativeActions && <th className="text-left px-3 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-emerald-400 transition-colors">
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : someSelected ? (
                      <Minus className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>}
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Código</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Espacio</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Postulante</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Ciudad</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden xl:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Fecha</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canManageAdministrativeActions ? 10 : 9} className="text-center py-12">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={canManageAdministrativeActions ? 10 : 9} className="text-center py-12 text-gray-500">
                    No se encontraron postulaciones
                  </td>
                </tr>
              ) : (
                submissions.map((sub: any) => {
                  const statusInfo = STATUS_LABELS[sub.spaceStatus] || STATUS_LABELS.pending;
                  const StatusIcon = statusInfo.icon;
                  const isSelected = selectedIds.has(sub.id);
                  return (
                    <tr key={sub.id} className={`border-b border-[#1f2937]/50 hover:bg-[#1f2937]/30 transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}>
                      {canManageAdministrativeActions && <td className="px-3 py-3">
                        <button onClick={() => toggleSelect(sub.id)} className="text-gray-400 hover:text-emerald-400 transition-colors">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-emerald-400">{sub.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium text-sm">{sub.spaceName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-gray-300 text-sm">{sub.submitterName}</span>
                          <p className="text-xs text-gray-500 truncate max-w-[180px]">{sub.submitterEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 hidden lg:table-cell">{sub.city}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">{SPACE_TYPE_LABELS[sub.spaceType] || sub.spaceType}</td>
                      <td className="px-4 py-3">
                        {sub.aiScore ? (
                          <span className={`font-bold ${sub.aiScore >= 80 ? "text-emerald-400" : sub.aiScore >= 60 ? "text-yellow-400" : "text-orange-400"}`}>
                            {sub.aiScore}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="hidden xl:inline">{statusInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap hidden lg:table-cell">
                        {formatDate(sub.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(sub.id)}
                          className="border-[#374151] text-gray-300 hover:bg-[#1f2937] h-7 text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1f2937]">
            <span className="text-xs text-gray-500">
              {offset + 1}-{Math.min(offset + limit, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="border-[#374151] text-gray-300 h-7">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="border-[#374151] text-gray-300 h-7">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card List (visible only on mobile) */}
      <div className="md:hidden space-y-3">
        {/* Mobile select all */}
        {canManageAdministrativeActions && <div className="flex items-center justify-between px-1">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-400 hover:text-emerald-400 transition-colors">
            {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
            <span>Seleccionar todos</span>
          </button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-emerald-400">{selectedIds.size} seleccionados</span>
          )}
        </div>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No se encontraron postulaciones
          </div>
        ) : (
          submissions.map((sub: any) => {
            const statusInfo = STATUS_LABELS[sub.spaceStatus] || STATUS_LABELS.pending;
            const StatusIcon = statusInfo.icon;
            const isSelected = selectedIds.has(sub.id);
            return (
              <div
                key={sub.id}
                className={`w-full text-left bg-[#111827] border rounded-xl p-3 transition-colors ${isSelected ? "border-emerald-500/50 bg-emerald-500/5" : "border-[#1f2937]"}`}
              >
                <div className="flex items-start gap-3">
                  {canManageAdministrativeActions && <button onClick={() => toggleSelect(sub.id)} className="mt-0.5 text-gray-400 hover:text-emerald-400 transition-colors flex-shrink-0">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                  </button>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm truncate">{sub.spaceName}</p>
                        <p className="font-mono text-[11px] text-emerald-400 mt-0.5">{sub.code}</p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 mt-2">
                      <span className="flex items-center gap-1 max-w-[45%] truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{sub.submitterName}</span>
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <MapPin className="w-3 h-3" />
                        {sub.city}
                      </span>
                      {sub.aiScore && (
                        <span className={`flex items-center gap-1 flex-shrink-0 font-bold ${sub.aiScore >= 80 ? "text-emerald-400" : sub.aiScore >= 60 ? "text-yellow-400" : "text-orange-400"}`}>
                          <Brain className="w-3 h-3" />
                          {sub.aiScore}
                        </span>
                      )}
                      {sub.spaceType && (
                        <span className="flex items-center gap-1 flex-shrink-0 text-gray-500">
                          {SPACE_TYPE_LABELS[sub.spaceType] || sub.spaceType}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#1f2937] pt-2">
                      <p className="text-[11px] text-gray-600">{formatDateShort(sub.createdAt)}</p>
                      <div className="flex items-center gap-2">
                        {sub.estimatedInvestmentCop && (
                          <span className="text-[11px] text-emerald-400 font-medium">{formatCOP(sub.estimatedInvestmentCop)}</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(sub.id)}
                          className="h-8 border-emerald-500/35 px-2.5 text-xs text-emerald-200 hover:bg-emerald-500/10"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">
              {offset + 1}-{Math.min(offset + limit, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="border-[#374151] text-gray-300 h-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="border-[#374151] text-gray-300 h-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedId && (
        <SpaceDetailDialog
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={() => refetch()}
        />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Eliminar {selectedIds.size} espacio{selectedIds.size !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-300">
            Esta acción es <strong className="text-red-400">irreversible</strong>. Se eliminarán las postulaciones seleccionadas junto con sus fotos y leads de inversionistas asociados.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} className="border-[#374151] text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Eliminar {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Change Dialog */}
      <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-400 flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Cambiar estado de {selectedIds.size} espacio{selectedIds.size !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm text-gray-300">Nuevo estado:</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1f2937] border-[#374151]">
                {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key} className="text-gray-300">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)} className="border-[#374151] text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkStatus as any })}
              disabled={bulkUpdateStatusMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {bulkUpdateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Score Assignment Dialog */}
      <Dialog open={showBulkScoreDialog} onOpenChange={setShowBulkScoreDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Asignar Score a {selectedIds.size} espacio{selectedIds.size !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm text-gray-300">Score técnico (0-100):</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                value={bulkScore}
                onChange={(e) => setBulkScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="bg-[#0a0f1a] border-[#374151] text-white w-24"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={bulkScore}
                onChange={(e) => setBulkScore(parseInt(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              Este score se asignará como puntaje técnico manual a todos los espacios seleccionados.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkScoreDialog(false)} className="border-[#374151] text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => bulkAssignScoreMutation.mutate({ ids: Array.from(selectedIds), technicalScore: bulkScore })}
              disabled={bulkAssignScoreMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {bulkAssignScoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Star className="w-4 h-4 mr-1" />}
              Asignar Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG CREAR ESPACIO MANUAL ===== */}
      <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="!inset-0 !top-0 !left-0 !h-[100dvh] !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none overflow-y-auto overscroll-contain border-[#1f2937] bg-[#111827] p-3 text-white sm:!top-1/2 sm:!left-1/2 sm:!h-auto sm:!max-h-[90vh] sm:!w-[calc(100%-2rem)] sm:!max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:p-6">
          <DialogHeader className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-[#1f2937] bg-[#111827] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-14 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pr-0">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-emerald-400" />
              Crear Espacio Manualmente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Datos del espacio */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-emerald-400 text-xs font-semibold mb-2 uppercase tracking-wide">Datos del Espacio</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 text-xs mb-1 block">Nombre del espacio *</Label>
                  <Input value={createForm.spaceName} onChange={e => setCreateForm(p => ({ ...p, spaceName: e.target.value }))} placeholder="Ej: Centro Comercial Unicentro" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Tipo *</Label>
                  <Select value={createForm.spaceType} onValueChange={v => setCreateForm(p => ({ ...p, spaceType: v }))}>
                    <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      {Object.entries(SPACE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-white">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Ciudad *</Label>
                  <Input value={createForm.city} onChange={e => setCreateForm(p => ({ ...p, city: e.target.value }))} placeholder="Ej: Bogotá" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 text-xs mb-1 block">Dirección *</Label>
                  <Input value={createForm.address} onChange={e => setCreateForm(p => ({ ...p, address: e.target.value }))} placeholder="Ej: Cra 15 #124-30" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Departamento</Label>
                  <Input value={createForm.department} onChange={e => setCreateForm(p => ({ ...p, department: e.target.value }))} placeholder="Ej: Cundinamarca" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Estrato</Label>
                  <Input type="number" min={1} max={6} value={createForm.socioeconomicStratum} onChange={e => setCreateForm(p => ({ ...p, socioeconomicStratum: e.target.value }))} placeholder="1-6" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
            </div>

            {/* Datos técnicos */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-semibold mb-2 uppercase tracking-wide">Datos Técnicos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Transformador (kVA)</Label>
                  <Input value={createForm.transformerCapacityKva} onChange={e => setCreateForm(p => ({ ...p, transformerCapacityKva: e.target.value }))} placeholder="Ej: 112.5" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Parqueos</Label>
                  <Input inputMode="numeric" value={createForm.parkingSpots} onChange={e => setCreateForm(p => ({ ...p, parkingSpots: e.target.value }))} placeholder="Ej: 4" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Área (m²)</Label>
                  <Input value={createForm.availableAreaM2} onChange={e => setCreateForm(p => ({ ...p, availableAreaM2: e.target.value }))} placeholder="Ej: 50" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Vehículos/día</Label>
                  <Input inputMode="numeric" value={createForm.estimatedDailyVehicles} onChange={e => setCreateForm(p => ({ ...p, estimatedDailyVehicles: e.target.value }))} placeholder="Ej: 700, 1.100 o 1.100" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">% de vehículos EV</Label>
                  <Input inputMode="decimal" value={createForm.estimatedEvPercent} onChange={e => setCreateForm(p => ({ ...p, estimatedEvPercent: e.target.value }))} placeholder="Ej: 5" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Latitud</Label>
                  <Input value={createForm.latitude} onChange={e => setCreateForm(p => ({ ...p, latitude: e.target.value }))} placeholder="Ej: 4.7110" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Longitud</Label>
                  <Input value={createForm.longitude} onChange={e => setCreateForm(p => ({ ...p, longitude: e.target.value }))} placeholder="Ej: -74.0721" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Distancia tablero/transformador (m)</Label>
                  <Input inputMode="numeric" value={createForm.electricalDistance} onChange={e => setCreateForm(p => ({ ...p, electricalDistance: e.target.value }))} placeholder="Ej: 25" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Horario inicio</Label>
                  <Input type="time" value={createForm.operatingHoursStart} onChange={e => setCreateForm(p => ({ ...p, operatingHoursStart: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Horario fin</Label>
                  <Input type="time" value={createForm.operatingHoursEnd} onChange={e => setCreateForm(p => ({ ...p, operatingHoursEnd: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={createForm.hasElectricalPanel} onChange={e => setCreateForm(p => ({ ...p, hasElectricalPanel: e.target.checked }))} className="accent-emerald-500" />
                  Tablero eléctrico accesible
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={createForm.hasInternet} onChange={e => setCreateForm(p => ({ ...p, hasInternet: e.target.checked }))} className="accent-emerald-500" />
                  Internet disponible
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={createForm.is24Hours} onChange={e => setCreateForm(p => ({ ...p, is24Hours: e.target.checked }))} className="accent-emerald-500" />
                  Operación 24 horas
                </label>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-xs text-amber-50">
                <input type="checkbox" checked={createForm.hasSolarPanels} onChange={e => setCreateForm(p => ({ ...p, hasSolarPanels: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-amber-400" />
                <span><strong className="block text-amber-200">Incluir sistema solar en el alcance</strong><span className="mt-0.5 block leading-4 text-amber-100/75">Se registrará como alcance técnico. El ahorro, CAPEX y retorno se definen después de factura, consumo y diseño específico.</span></span>
              </label>
              {createForm.hasSolarPanels && (
                <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1 block text-xs text-amber-100">Cobertura solar autoconsumida (%)</Label>
                    <Input inputMode="decimal" min="0" max="100" placeholder="Ej.: 25" value={createForm.solarCoveragePercent} onChange={e => setCreateForm(p => ({ ...p, solarCoveragePercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-amber-100">Costo solar validado (COP/kWh)</Label>
                    <Input inputMode="numeric" min="0" placeholder="Ej.: 180" value={createForm.solarEnergyCostPerKwh} onChange={e => setCreateForm(p => ({ ...p, solarEnergyCostPerKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                  </div>
                  <p className="sm:col-span-2 text-[11px] leading-4 text-amber-100/75">Solo con ambos datos el modelo pondera el costo efectivo: cobertura solar × costo solar + saldo × costo de red. Sin factura, diseño y generación validados, déjalos vacíos: no se reduce la energía de red.</p>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2.5">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-emerald-50">
                  <input type="checkbox" checked={createForm.solarProgramEnabled} onChange={e => setCreateForm(p => ({ ...p, solarProgramEnabled: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                  <span><strong className="block text-emerald-200">Activar programa solar de ahorro para el aliado</strong><span className="mt-0.5 block leading-4 text-emerald-100/75">Modela una sustitución de gasto energético por un plazo configurable, con ajuste anual de referencia. No es ingreso garantizado ni reemplaza el contrato.</span></span>
                </label>
                {createForm.solarProgramEnabled && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura mensual promedio (COP) *</Label><Input inputMode="decimal" placeholder="Ej.: 15.000.000" value={createForm.solarProgramCurrentBillCop} onChange={e => setCreateForm(p => ({ ...p, solarProgramCurrentBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Ahorro sobre factura · año 1 (%) *</Label><Input inputMode="decimal" min="0" max="100" placeholder="Ej.: 93,5" value={createForm.solarProgramSavingsCoveragePercent} onChange={e => setCreateForm(p => ({ ...p, solarProgramSavingsCoveragePercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Energía generada vs consumo (%)</Label><Input inputMode="decimal" min="0" max="1000" placeholder="Ej.: 105" value={createForm.solarProgramEnergyOffsetPercent} onChange={e => setCreateForm(p => ({ ...p, solarProgramEnergyOffsetPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /><p className="mt-1 text-[10px] leading-3 text-emerald-100/65">Indicador técnico OpenSolar; puede superar 100% por excedentes y no se suma dos veces al ahorro.</p></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Plazo del acuerdo (años)</Label><Input inputMode="numeric" min="1" max="30" value={createForm.solarProgramAgreementYears} onChange={e => setCreateForm(p => ({ ...p, solarProgramAgreementYears: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Pago estable de energía con acuerdo solar (COP)</Label><Input inputMode="decimal" placeholder="Sólo si la propuesta lo define" value={createForm.solarProgramMonthlyFinancingPaymentCop} onChange={e => setCreateForm(p => ({ ...p, solarProgramMonthlyFinancingPaymentCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura solar residual año 1 (COP)</Label><Input inputMode="decimal" placeholder="Factura propuesta, no cuota" value={createForm.solarProgramInitialMonthlySolarBillCop} onChange={e => setCreateForm(p => ({ ...p, solarProgramInitialMonthlySolarBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura solar desde año 7 (COP)</Label><Input inputMode="decimal" placeholder="Al terminar el plazo" value={createForm.solarProgramPostAgreementMonthlySolarBillCop} onChange={e => setCreateForm(p => ({ ...p, solarProgramPostAgreementMonthlySolarBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Ahorro total de dinero por energía (COP)</Label><Input inputMode="decimal" placeholder="Valor comercial de la propuesta" value={createForm.solarProgramTotalEnergySavingsCop} onChange={e => setCreateForm(p => ({ ...p, solarProgramTotalEnergySavingsCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Tasa de rendimiento anual (%)</Label><Input inputMode="decimal" placeholder="Ej.: 15,9" value={createForm.solarProgramAnnualReturnPercent} onChange={e => setCreateForm(p => ({ ...p, solarProgramAnnualReturnPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">IPC anual de referencia (%)</Label><Input inputMode="decimal" min="0" max="30" value={createForm.solarProgramAnnualCpiPercent} onChange={e => setCreateForm(p => ({ ...p, solarProgramAnnualCpiPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Vida útil de referencia (años)</Label><Input inputMode="numeric" min="1" max="50" value={createForm.solarProgramUsefulLifeYears} onChange={e => setCreateForm(p => ({ ...p, solarProgramUsefulLifeYears: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Potencia solar (kWp)</Label><Input inputMode="decimal" placeholder="Ej.: 112" value={createForm.solarSystemPowerKwp} onChange={e => setCreateForm(p => ({ ...p, solarSystemPowerKwp: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Generación anual (kWh)</Label><Input inputMode="decimal" placeholder="Ej.: 140.870" value={createForm.solarAnnualGenerationKwh} onChange={e => setCreateForm(p => ({ ...p, solarAnnualGenerationKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Autoconsumo (%)</Label><Input inputMode="decimal" min="0" max="100" placeholder="Ej.: 40" value={createForm.solarSelfConsumptionPercent} onChange={e => setCreateForm(p => ({ ...p, solarSelfConsumptionPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Exportación (%)</Label><Input inputMode="decimal" min="0" max="100" placeholder="Ej.: 60" value={createForm.solarExportPercent} onChange={e => setCreateForm(p => ({ ...p, solarExportPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Tarifa de red (COP/kWh)</Label><Input inputMode="numeric" placeholder="Ej.: 910" value={createForm.solarGridTariffCopPerKwh} onChange={e => setCreateForm(p => ({ ...p, solarGridTariffCopPerKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div className="sm:col-span-2"><Label className="mb-1 block text-xs text-emerald-100">Oferta solar de referencia (PDF, opcional)</Label><Input type="file" accept="application/pdf,.pdf" onChange={e => setCreateSolarOfferPdf(e.target.files?.[0] || null)} className="border-[#374151] bg-[#111827] text-xs text-white file:mr-2 file:rounded file:border-0 file:bg-emerald-600 file:px-2 file:py-1 file:text-xs file:text-white" />{createSolarOfferPdf && <p className="mt-1 truncate text-[11px] text-emerald-200">{createSolarOfferPdf.name}</p>}</div>
                    <p className="sm:col-span-3 text-[11px] leading-4 text-emerald-100/75">La oferta adjunta se conservará como anexo del PDF del aliado. Los datos visibles del resumen deben provenir de factura, propuesta o estudio verificable.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Infraestructura Eléctrica y Viabilidad */}
            <div className="bg-[#0a0f1a] border border-orange-500/30 rounded-lg p-3">
              <p className="text-orange-400 text-xs font-semibold mb-2 uppercase tracking-wide">🔧 Infraestructura Eléctrica</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={createForm.requiresNewTransformer} onChange={e => setCreateForm(p => ({ ...p, requiresNewTransformer: e.target.checked }))} className="accent-orange-500 w-4 h-4" />
                  <span>Requiere instalación de <strong>transformador nuevo</strong></span>
                </label>
                {createForm.requiresNewTransformer && (
                  <div className="ml-6">
                    <Label className="text-gray-300 text-xs mb-1 block">Capacidad propuesta del nuevo transformador (kVA)</Label>
                    <Input inputMode="decimal" placeholder="Ej: 250" value={createForm.proposedTransformerKva} onChange={e => setCreateForm(p => ({ ...p, proposedTransformerKva: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm w-40" />
                  </div>
                )}
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Viabilidad eléctrica preliminar</Label>
                  <Select value={createForm.electricalViability} onValueChange={v => setCreateForm(p => ({ ...p, electricalViability: v }))}>
                    <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                      <SelectValue placeholder="Seleccionar viabilidad..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      <SelectItem value="viable" className="text-green-300">✅ Viable</SelectItem>
                      <SelectItem value="requires_upgrade" className="text-yellow-300">⚠️ Requiere mejora</SelectItem>
                      <SelectItem value="not_viable" className="text-red-300">❌ No viable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">Proyección preliminar (opcional)</p>
              <p className="mb-2 text-[11px] leading-4 text-emerald-100/70">Al guardar, el ROI y el payback se calculan a partir del flujo, adopción EV y el valor de inversión. Después quedan editables en el expediente.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <Label className="mb-1 block text-xs text-gray-300">Inversión estimada (COP)</Label>
                  <Input inputMode="decimal" value={createForm.estimatedInvestmentCop} onChange={e => setCreateForm(p => ({ ...p, estimatedInvestmentCop: e.target.value }))} placeholder="Ej: 90.000.000" className="border-[#374151] bg-[#111827] text-sm text-white" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-gray-300">Potencia DC (kW)</Label>
                  <Input inputMode="numeric" value={createForm.estimatedPowerKw} onChange={e => setCreateForm(p => ({ ...p, estimatedPowerKw: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-gray-300">Cargadores duales</Label>
                  <Input inputMode="numeric" value={createForm.estimatedChargerCount} onChange={e => setCreateForm(p => ({ ...p, estimatedChargerCount: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-gray-300 text-xs mb-1 block">Tipo de inversión</Label>
                <Select value={createForm.investmentType} onValueChange={v => setCreateForm(p => ({ ...p, investmentType: v }))}>
                  <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f2937] border-[#374151]">
                    <SelectItem value="individual" className="text-white">Individual</SelectItem>
                    <SelectItem value="colectiva" className="text-white">Colectiva (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datos del postulante */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Contacto / Postulante</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Nombre *</Label>
                  <Input value={createForm.submitterName} onChange={e => setCreateForm(p => ({ ...p, submitterName: e.target.value }))} placeholder="Nombre del contacto" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Email *</Label>
                  <Input type="email" value={createForm.submitterEmail} onChange={e => setCreateForm(p => ({ ...p, submitterEmail: e.target.value }))} placeholder="email@ejemplo.com" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Teléfono *</Label>
                  <Input value={createForm.submitterPhone} onChange={e => setCreateForm(p => ({ ...p, submitterPhone: e.target.value }))} placeholder="+57 305 412 4009" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Empresa</Label>
                  <Input value={createForm.submitterCompany} onChange={e => setCreateForm(p => ({ ...p, submitterCompany: e.target.value }))} placeholder="Nombre de la empresa" className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
            </div>

            {/* Notas y entorno */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3 space-y-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Notas y Entorno</p>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Puntos de interés cercanos</Label>
                <Textarea value={createForm.nearbyAttractions} onChange={e => setCreateForm(p => ({ ...p, nearbyAttractions: e.target.value }))} rows={2} placeholder="Centros comerciales, vías principales, peajes..." className="bg-[#111827] border-[#374151] text-white text-sm resize-none" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Notas adicionales</Label>
                <Textarea value={createForm.additionalNotes} onChange={e => setCreateForm(p => ({ ...p, additionalNotes: e.target.value }))} rows={2} placeholder="Observaciones técnicas o comerciales..." className="bg-[#111827] border-[#374151] text-white text-sm resize-none" />
              </div>
            </div>

            {/* Registro fotográfico (opcional) */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-blue-400 text-xs font-semibold mb-2 uppercase tracking-wide">Registro Fotográfico (Opcional)</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-2 bg-[#111827] border border-dashed border-[#374151] hover:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-gray-300 transition-colors">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Agregar fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const hasAnyCover = createPhotos.some(p => p.isCover);
                        const newPhotos = files.map((file, fileIdx) => ({
                          file,
                          preview: URL.createObjectURL(file),
                          photoType: "general",
                          isCover: !hasAnyCover && fileIdx === 0,
                          isConceptual: false,
                        }));
                        setCreatePhotos(prev => [...prev, ...newPhotos]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {createPhotos.length > 0 && (
                    <span className="text-xs text-gray-400">{createPhotos.length} foto{createPhotos.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                {createPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {createPhotos.map((photo, idx) => (
                      <div key={idx} className={`relative group rounded-md border p-1 bg-black/40 ${photo.isCover ? "border-amber-400/80 ring-1 ring-amber-400/50" : "border-[#374151]"}`}>
                        <img src={photo.preview} alt={`Foto ${idx + 1}`} className="w-full h-16 sm:h-20 object-cover rounded-md border border-[#374151]" />
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatePhotos(prev => setPendingSpacePhotoCover(prev, idx));
                            }}
                            disabled={photo.isCover}
                            title={photo.isCover ? "Esta foto ya es la portada seleccionada" : "Usar esta foto como portada"}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${photo.isCover ? "cursor-default bg-amber-400/80 text-slate-950 font-bold" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                          >
                            {coverPhotoActionLabel(Boolean(photo.isCover))}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreatePhotos(prev => prev.map((p, i) => i === idx ? { ...p, isConceptual: !p.isConceptual } : p));
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${photo.isConceptual ? "bg-purple-500 text-white font-bold" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            title="Marcar como render o maqueta conceptual 3D"
                          >
                            {conceptualPhotoActionLabel(Boolean(photo.isConceptual))}
                          </button>
                        </div>
                        <select
                          value={photo.photoType}
                          onChange={(e) => {
                            const updated = [...createPhotos];
                            updated[idx] = { ...updated[idx], photoType: e.target.value };
                            setCreatePhotos(updated);
                          }}
                          className="mt-1 w-full bg-[#111827] text-[9px] text-white border border-[#374151] rounded px-1 py-0.5"
                        >
                          <option value="general">General</option>
                          <option value="electrical_panel">Tablero</option>
                          <option value="transformer">Transformador</option>
                          <option value="parking_area">Parqueo</option>
                          <option value="access_road">Acceso</option>
                          <option value="surroundings">Alrededores</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeCreatePhoto(idx)}
                          title={`Quitar foto ${idx + 1} antes de crear el espacio`}
                          aria-label={`Quitar foto ${idx + 1} antes de crear el espacio`}
                          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-red-200/60 bg-red-600 text-white shadow-md transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-500">Máx. 10MB por foto. Tipos: general, tablero eléctrico, transformador, parqueo, acceso, alrededores.</p>
              </div>
            </div>
          </div>
          {createSubmitError && (
            <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-4 text-red-100">
              {createSubmitError}
            </div>
          )}
          {createPreparation.stage !== "idle" && (
            <div aria-live="polite" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs leading-4 text-emerald-100">
              {createPreparation.stage === "preparing"
                ? `Preparando fotos ${createPreparation.completed}/${createPreparation.total}. No cierres esta ventana.`
                : "Creando el espacio y cargando sus adjuntos…"}
            </div>
          )}
          <DialogFooter className="sticky bottom-0 z-10 -mx-3 -mb-3 border-t border-[#1f2937] bg-[#111827] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:flex-row">
            <Button type="button" variant="outline" disabled={isCreatingManualSpace} onClick={() => handleCreateDialogOpenChange(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateManualSpace}
              disabled={isCreatingManualSpace}
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
            >
              {isCreatingManualSpace ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {createPreparation.stage === "preparing" ? `Preparando ${createPreparation.completed}/${createPreparation.total}` : createPreparation.stage === "submitting" || createSpaceMutation.isPending ? "Creando espacio…" : "Crear Espacio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// SPACE DETAIL DIALOG - RESPONSIVE
// ============================================================================

function SpaceDetailDialog({
  id,
  onClose,
  onRefresh,
}: {
  id: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const { data: space, isLoading, refetch } = trpc.spaces.admin.getById.useQuery({ id });
  const { data: calculatorParams } = trpc.settings.getCalculatorParams.useQuery();
  const { data: statusHistory } = trpc.spaces.admin.getStatusHistory.useQuery({ id });
  const { data: solarScopeHistory } = trpc.spaces.admin.getSolarScopeHistory.useQuery({ id });
  const updateStatusMutation = trpc.spaces.admin.updateStatus.useMutation();
  const sendLetterMutation = trpc.spaces.admin.sendLetter.useMutation();
  const getLetterShareLinkMutation = trpc.spaces.admin.getLetterShareLink.useMutation();
  const rotateLetterShareLinkMutation = trpc.spaces.admin.rotateLetterShareLink.useMutation();
  const { data: letterDeliveryHistory } = trpc.spaces.admin.getLetterDeliveryHistory.useQuery({ id });
  const generateAIMutation = trpc.spaces.admin.generateAIScore.useMutation();
  const publishMutation = trpc.spaces.admin.publishToCrowdfunding.useMutation();
  const updateSpaceMutation = trpc.spaces.admin.updateSpace.useMutation();
  const lookupOpenSolarProjectMutation = trpc.spaces.admin.lookupOpenSolarProject.useMutation();
  const deleteSpaceMutation = trpc.spaces.admin.deleteSpace.useMutation();
  const advanceCommercialStageMutation = trpc.spaces.admin.advanceCommercialStage.useMutation();
  const generateProspectoMutation = trpc.spaces.generateProspectoPdf.useMutation();
  const generateAllyPdfMutation = trpc.spaces.generateAllySpacePdf.useMutation();
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPipelineActionDialog, setShowPipelineActionDialog] = useState(false);
  const [showCommercialStageDialog, setShowCommercialStageDialog] = useState(false);
  const [commercialStageNote, setCommercialStageNote] = useState("");
  const [showProspectoDialog, setShowProspectoDialog] = useState(false);
  const [prospectoConfig, setProspectoConfig] = useState<{
    allySharePercent: number | undefined;
    investorSharePercent: number | undefined;
    platformSharePercent: number | undefined;
    installedPowerKw: number | undefined;
    tarifaKwhCop: number | undefined;
    energyCostPerKwhCop: number | undefined;
    fixedMonthlyExpensesCop: number | undefined;
    capexIncludesGridUpgrade: boolean;
    technicalConditionNote: string;
  }>({
    allySharePercent: 10,
    investorSharePercent: 70,
    platformSharePercent: 30,
    installedPowerKw: undefined as number | undefined,
    tarifaKwhCop: 1800,
    energyCostPerKwhCop: 850,
    fixedMonthlyExpensesCop: 0,
    capexIncludesGridUpgrade: false,
    technicalConditionNote: "",
  });
  const [publishAmount, setPublishAmount] = useState("");
  const [manualFormalizationReason, setManualFormalizationReason] = useState("");
  const [manualFormalizationEvidence, setManualFormalizationEvidence] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [photoPendingDeletion, setPhotoPendingDeletion] = useState<{
    id: number;
    label: string;
    url: string;
  } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [chargingSolarLookup, setChargingSolarLookup] = useState<{
    projectTitle: string | null;
    unavailableFields: string[];
    warnings: string[];
    mappedFields: string[];
  } | null>(null);
  const [allySolarLookup, setAllySolarLookup] = useState<{
    projectTitle: string | null;
    unavailableFields: string[];
    warnings: string[];
    mappedFields: string[];
  } | null>(null);
  const [editPhotos, setEditPhotos] = useState<Array<{ file: File; preview: string; photoType: string; isCover?: boolean; isConceptual?: boolean }>>([]);
  const [editSolarOfferPdf, setEditSolarOfferPdf] = useState<File | null>(null);
  const [showGestorDialog, setShowGestorDialog] = useState(false);
  const [letterShareLink, setLetterShareLink] = useState<string | null>(null);
  const addPhotosMutation = trpc.spaces.admin.addPhotos.useMutation();
  const setCoverPhotoMutation = trpc.spaces.admin.setCoverPhoto.useMutation({
    onSuccess: () => { toast.success("Foto principal de portada actualizada"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleConceptualPhotoMutation = trpc.spaces.admin.toggleConceptualPhoto.useMutation({
    onSuccess: () => { toast.success("Etiqueta de render conceptual actualizada"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updatePhotoTypeMutation = trpc.spaces.admin.updatePhotoType.useMutation({
    onSuccess: () => { toast.success("Tipo de foto actualizado"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePhotoMutation = trpc.spaces.admin.deletePhoto.useMutation({
    onSuccess: (result) => {
      if (activePhotoIndex !== null) {
        if (result.remainingPhotoCount === 0) {
          setActivePhotoIndex(null);
        } else {
          setActivePhotoIndex((current) => current === null ? null : Math.min(current, result.remainingPhotoCount - 1));
        }
      }
      setPhotoPendingDeletion(null);
      toast.success(result.remainingPhotoCount === 0
        ? "Foto retirada. El Espacio quedó sin fotografías."
        : "Foto retirada del expediente y de la galería de inversión.");
      refetch();
      onRefresh();
    },
    onError: (error) => toast.error(error.message || "No fue posible retirar la foto."),
  });
  const [gestorForm, setGestorForm] = useState({ gestorId: "", commissionPercent: "3.75" });
  const { data: gestoresData } = trpc.gestor.listarGestores.useQuery();
  const asignarGestorMutation = trpc.gestor.asignarGestorAEspacio.useMutation({
    onSuccess: () => { toast.success("Gestor vinculado correctamente"); setShowGestorDialog(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function discardEditPhotos() {
    editPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setEditPhotos([]);
  }

  function handleEditDialogOpenChange(open: boolean) {
    if (!open) discardEditPhotos();
    setShowEditDialog(open);
  }

  function removeEditPhoto(index: number) {
    setEditPhotos((previous) => {
      const hasPersistedCover = Boolean(space?.photos?.some((photo: any) => photo.isCover));
      const result = removePendingSpacePhoto(previous, index, { ensureCover: !hasPersistedCover });
      if (result.removed) URL.revokeObjectURL(result.removed.preview);
      return result.photos;
    });
  }

  if (isLoading || !space) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusInfo = STATUS_LABELS[space.spaceStatus as string] || STATUS_LABELS.pending;
  const StatusIcon = statusInfo.icon;
  const aiAnalysis = parseAiAnalysis(space.aiAnalysis);
  const commercialNextStep = COMMERCIAL_NEXT_STEPS[space.spaceStatus as string];
  const pipelineAction = getSpacePipelineAction(space.spaceStatus as string);
  const canManageAdministrativeDetails = user?.role === "admin" || user?.role === "staff";
  const suggestedFinancialProjection = (() => {
    const investmentCop = toOptionalNumber(editForm.estimatedInvestmentCop);
    const totalPowerKw = toOptionalInteger(editForm.estimatedPowerKw);
    const dailyVehicles = toOptionalInteger(editForm.estimatedDailyVehicles);
    const evPercent = toOptionalInteger(editForm.estimatedEvPercent);
    const chargerCount = toOptionalInteger(editForm.estimatedChargerCount);
    if (!investmentCop || !totalPowerKw || totalPowerKw < 120 || !dailyVehicles || evPercent === undefined) return null;
    try {
      const snapshot = buildSpaceTrafficProjection({
        investmentCop,
        estimatedDailyVehicles: dailyVehicles,
        estimatedEvPercent: evPercent,
        chargerCount: chargerCount || 1,
        totalPowerKw,
        operatingHoursPerDay: getOperatingHoursPerDay(editForm.operatingHoursStart, editForm.operatingHoursEnd, editForm.is24Hours),
        efficiencyPercent: Number(calculatorParams?.eficienciaCargaDc ?? 92),
        hasSolarPanels: Boolean(editForm.hasSolarPanels),
        solarCoveragePercent: toOptionalNumber(editForm.solarCoveragePercent),
        solarEnergyCostPerKwh: toOptionalInteger(editForm.solarEnergyCostPerKwh),
        spaceType: space.spaceType,
        salePricePerKwh: Number(calculatorParams?.precioVentaDefault ?? 1800),
        energyCostPerKwh: Number(calculatorParams?.costoEnergiaRed ?? 700),
        hostSharePercent: Number(calculatorParams?.hostPercentage ?? 10),
      });
      return {
        snapshot,
        selected: snapshot.scenarios.REALISTIC,
        selectedScenario: "REALISTIC" as const,
      };
    } catch {
      return null;
    }
  })();

  const requestedProspectoPowerKw = prospectoConfig.installedPowerKw || Number(space.estimatedPowerKw || 0);
  const transformerCapacityKva = Number(space.transformerCapacityKva || 0);
  const dcInfrastructure = resolveDcInfrastructureRequirement({
    requestedPowerKw: requestedProspectoPowerKw,
    chargerCount: Number(space.estimatedChargerCount || 1),
    transformerCapacityKva,
  });
  // El tipo actual del espacio gobierna la preconfiguración; un análisis IA
  // histórico no debe sobrescribir el reparto 60/40 propio de una EDS.
  const revenueDistribution = getRevenueDistributionForSpaceType(space.spaceType);
  const prospectoDistributionValid = isNetRevenueDistributionValid(
    prospectoConfig.investorSharePercent,
    prospectoConfig.platformSharePercent,
  );
  const prospectoSharesReady = prospectoConfig.allySharePercent !== undefined && prospectoDistributionValid;
  const prospectoRequiresGridUpgrade = dcInfrastructure.requiresGridUpgrade
    || space.electricalViability === "requires_upgrade"
    || space.electricalViability === "not_viable"
    || (transformerCapacityKva > 0 && requestedProspectoPowerKw > transformerCapacityKva);
  const prospectoTechnicalReady = !prospectoRequiresGridUpgrade
    || (dcInfrastructure.meetsDcMinimum && prospectoConfig.capexIncludesGridUpgrade && prospectoConfig.technicalConditionNote.trim().length >= 10);

  const handleOpenProspectoDialog = () => {
    const distribution = getRevenueDistributionForSpaceType(space.spaceType);
    setProspectoConfig({
      allySharePercent: 10,
      investorSharePercent: distribution.investorSharePercent,
      platformSharePercent: distribution.evgreenSharePercent,
      installedPowerKw: Math.max(120, Number(space.estimatedPowerKw || 0)) || 120,
      tarifaKwhCop: Number(calculatorParams?.precioVentaDefault ?? 1800),
      energyCostPerKwhCop: Number(calculatorParams?.costoEnergiaRed ?? 850),
      fixedMonthlyExpensesCop: 0,
      capexIncludesGridUpgrade: false,
      technicalConditionNote: "",
    });
    setShowProspectoDialog(true);
  };

  const handleLookupOpenSolarProject = async (scope: "charging" | "ally") => {
    const projectId = String(
      scope === "charging"
        ? editForm.chargingSolarOpenSolarProjectId ?? editForm.openSolarProjectId ?? ""
        : editForm.allySolarOpenSolarProjectId ?? "",
    ).trim();
    if (!projectId) {
      toast.error(`Ingresa el ID del proyecto OpenSolar de ${scope === "charging" ? "la electrolinera" : "la EDS o comercio aliado"} antes de consultar.`);
      return;
    }
    try {
      const result = await lookupOpenSolarProjectMutation.mutateAsync({ projectId });
      const project = result.project;
      if (!project) throw new Error("OpenSolar no devolvió datos para el proyecto solicitado.");
      setEditForm((previous) => ({
        ...previous,
        ...(scope === "charging" ? {
          chargingSolarOpenSolarProjectId: project.id,
          chargingSolarOpenSolarProjectTitle: project.title ?? previous.chargingSolarOpenSolarProjectTitle ?? "",
          chargingSolarOpenSolarAnnualConsumptionKwh: project.annualConsumptionKwh ?? previous.chargingSolarOpenSolarAnnualConsumptionKwh ?? "",
          chargingSolarSystemPowerKwp: project.systemPowerKwp ?? previous.chargingSolarSystemPowerKwp ?? "",
          chargingSolarAnnualGenerationKwh: project.annualGenerationKwh ?? previous.chargingSolarAnnualGenerationKwh ?? "",
          chargingSolarSelfConsumptionPercent: project.selfConsumptionPercent ?? previous.chargingSolarSelfConsumptionPercent ?? "",
          chargingSolarExportPercent: project.exportPercent ?? previous.chargingSolarExportPercent ?? "",
          hasSolarPanels: previous.hasSolarPanels || project.systemPowerKwp !== null || project.annualGenerationKwh !== null,
          solarCoveragePercent: project.solarSavingsCoveragePercent ?? previous.solarCoveragePercent ?? "",
        } : {
          allySolarOpenSolarProjectId: project.id,
          allySolarOpenSolarProjectTitle: project.title ?? previous.allySolarOpenSolarProjectTitle ?? "",
          allySolarOpenSolarAnnualConsumptionKwh: project.annualConsumptionKwh ?? previous.allySolarOpenSolarAnnualConsumptionKwh ?? "",
          address: project.address ?? previous.address,
          city: project.locality ?? previous.city,
          department: project.state ?? previous.department,
          latitude: project.latitude ?? previous.latitude,
          longitude: project.longitude ?? previous.longitude,
          solarProgramEnabled: previous.solarProgramEnabled || project.canActivateAllySolarProgram,
          solarProgramCurrentBillCop: project.currentMonthlyBill ?? previous.solarProgramCurrentBillCop ?? "",
          solarProgramEnergyOffsetPercent: project.energyVsConsumptionPercent ?? previous.solarProgramEnergyOffsetPercent ?? "",
          solarProgramSavingsCoveragePercent: project.solarSavingsCoveragePercent ?? previous.solarProgramSavingsCoveragePercent ?? "",
          solarProgramMonthlyFinancingPaymentCop: project.monthlyFinancingPaymentCop ?? previous.solarProgramMonthlyFinancingPaymentCop ?? "",
          solarProgramInitialMonthlySolarBillCop: project.initialMonthlySolarBillCop ?? previous.solarProgramInitialMonthlySolarBillCop ?? "",
          solarProgramPostAgreementMonthlySolarBillCop: project.postAgreementMonthlySolarBillCop ?? previous.solarProgramPostAgreementMonthlySolarBillCop ?? "",
          solarProgramTotalEnergySavingsCop: project.totalEnergySavingsCop ?? previous.solarProgramTotalEnergySavingsCop ?? "",
          solarProgramAnnualReturnPercent: project.annualInvestmentReturnPercent ?? previous.solarProgramAnnualReturnPercent ?? "",
          solarProgramAgreementYears: project.financingAgreementYears ?? previous.solarProgramAgreementYears ?? "6",
          solarSystemPowerKwp: project.systemPowerKwp ?? previous.solarSystemPowerKwp ?? "",
          solarAnnualGenerationKwh: project.annualGenerationKwh ?? previous.solarAnnualGenerationKwh ?? "",
          solarSelfConsumptionPercent: project.selfConsumptionPercent ?? previous.solarSelfConsumptionPercent ?? "",
          solarExportPercent: project.exportPercent ?? previous.solarExportPercent ?? "",
          solarGridTariffCopPerKwh: project.gridTariffCopPerKwh ?? previous.solarGridTariffCopPerKwh ?? "",
        }),
      }));
      const mappedFieldLabels: Record<string, string> = {
        annualConsumptionKwh: "consumo anual",
        currentMonthlyBill: "factura mensual",
        systemPowerKwp: "potencia solar",
        annualGenerationKwh: "generación anual",
        selfConsumptionPercent: "autoconsumo",
        exportPercent: "exportación",
        solarSavingsCoveragePercent: "cobertura de ahorro",
        gridTariffCopPerKwh: "tarifa de red",
        monthlyFinancingPaymentCop: "pago estable de energía",
        initialMonthlySolarBillCop: "factura solar residual año 1",
        postAgreementMonthlySolarBillCop: "factura solar posterior al plazo",
        totalEnergySavingsCop: "ahorro total de dinero por energía",
        annualInvestmentReturnPercent: "tasa de rendimiento anual",
      };
      const lookupSummary = {
        projectTitle: project.title,
        unavailableFields: result.unavailableFields ?? [],
        warnings: result.warnings ?? [],
        mappedFields: Object.keys(project.fieldSources ?? {}).map((field) => mappedFieldLabels[field] ?? field),
      };
      if (scope === "charging") setChargingSolarLookup(lookupSummary);
      else setAllySolarLookup(lookupSummary);
      const commercialSummary = scope === "ally" && project.totalEnergySavingsCop !== null && project.annualInvestmentReturnPercent !== null
        ? ` Ahorro total ${formatCOP(project.totalEnergySavingsCop)} y rendimiento anual ${project.annualInvestmentReturnPercent.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%.`
        : "";
      toast.success(`Datos de OpenSolar de ${scope === "charging" ? "la electrolinera" : "la EDS/comercio aliado"} precargados.${commercialSummary} Revisa y guarda para confirmarlos.`);
    } catch (error: any) {
      toast.error(error.message || "No fue posible consultar el proyecto OpenSolar.");
    }
  };

  const handleGenerateAllyPdf = async () => {
    try {
      const result = await generateAllyPdfMutation.mutateAsync({ submissionId: id });
      const link = document.createElement("a");
      link.href = result.pdfUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Ficha técnica del aliado generada y descargada");
    } catch (err: any) {
      toast.error(err.message || "No fue posible generar la ficha del aliado");
    }
  };

  const handleStatusUpdate = async (status: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: status as any });
      toast.success(`Estado actualizado a: ${STATUS_LABELS[status]?.label || status}`);
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar estado");
    }
  };

  const handleReject = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: "rejected", rejectionReason });
      toast.success("Postulación rechazada");
      setShowRejectDialog(false);
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al rechazar");
    }
  };

  const handleSendLetter = async () => {
    try {
      const result = await sendLetterMutation.mutateAsync({ id });
      setLetterShareLink(result.acceptUrl);
      toast.success("Carta enviada por email. El enlace alterno ya está listo para compartir.");
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar carta");
    }
  };

  const handleResendLetter = async () => {
    try {
      const result = await sendLetterMutation.mutateAsync({ id });
      setLetterShareLink(result.acceptUrl);
      toast.success("Carta reenviada por correo. El enlace anterior fue revocado.");
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "No fue posible reenviar la carta");
    }
  };

  const handleGetLetterShareLink = async () => {
    try {
      const result = await getLetterShareLinkMutation.mutateAsync({ id });
      setLetterShareLink(result.acceptUrl);
      toast.success("Enlace de firma listo para compartir.");
    } catch (err: any) {
      toast.error(err.message || "No fue posible obtener el enlace de firma");
    }
  };

  const handleCopyLetterLink = async () => {
    if (!letterShareLink) return;
    try {
      await navigator.clipboard.writeText(letterShareLink);
      toast.success("Enlace de firma copiado. Compártelo solo con el responsable del espacio.");
    } catch {
      toast.error("No se pudo copiar automáticamente. Inténtalo de nuevo desde un navegador con permisos.");
    }
  };

  const handleWhatsAppShare = () => {
    if (!letterShareLink) return;
    const message = `Hola${space.submitterName ? ` ${space.submitterName}` : ""}, te compartimos la Carta de Intención para el espacio “${space.spaceName}”. Puedes revisarla y firmarla de forma segura aquí: ${letterShareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleRotateLetterShareLink = async () => {
    try {
      const result = await rotateLetterShareLinkMutation.mutateAsync({ id });
      setLetterShareLink(result.acceptUrl);
      toast.success("Enlace rotado. El vínculo anterior dejó de ser válido.");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "No fue posible rotar el enlace de firma");
    }
  };

  const handleGenerateAI = async () => {
    try {
      const result = await generateAIMutation.mutateAsync({ id });
      toast.success(`Score IA generado: ${result.score}/100`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Error al generar scoring IA");
    }
  };

  const handlePublish = async () => {
    const amount = parseInt(publishAmount);
    if (!amount || amount < 1000000) {
      toast.error("La meta de inversión debe ser al menos $1.000.000");
      return;
    }
    const requiresManualFormalization = space.spaceStatus === "letter_sent";
    if (requiresManualFormalization && manualFormalizationReason.trim().length < 15) {
      toast.error("Describe el motivo de la formalización interna (mínimo 15 caracteres).");
      return;
    }
    if (requiresManualFormalization && manualFormalizationEvidence.trim().length < 5) {
      toast.error("Registra una evidencia o referencia de la aprobación interna.");
      return;
    }
    try {
      const result = await publishMutation.mutateAsync({
        id,
        targetAmount: amount,
        ...(requiresManualFormalization ? {
          manualFormalizationReason: manualFormalizationReason.trim(),
          manualFormalizationEvidence: manualFormalizationEvidence.trim(),
        } : {}),
      });
      toast.success(result.manualFormalization
        ? "Espacio formalizado internamente y publicado. La firma externa sigue pendiente."
        : "Espacio publicado en el muro de crowdfunding");
      setShowPublishDialog(false);
      setManualFormalizationReason("");
      setManualFormalizationEvidence("");
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al publicar");
    }
  };

  const handlePipelineAction = () => {
    if (commercialNextStep) {
      setCommercialStageNote("");
      setShowCommercialStageDialog(true);
      return;
    }
    if (pipelineAction) setShowPipelineActionDialog(true);
  };

  const handlePipelineActionConfirmation = async () => {
    if (!pipelineAction) return;
    if (pipelineAction.kind === "send_letter") {
      await handleSendLetter();
      setShowPipelineActionDialog(false);
      return;
    }
    if (pipelineAction.kind === "publish") {
      setShowPipelineActionDialog(false);
      setShowPublishDialog(true);
      return;
    }
    setShowPipelineActionDialog(false);
  };

  const handleCommercialStageAdvance = async () => {
    if (!commercialNextStep) return;
    try {
      await advanceCommercialStageMutation.mutateAsync({
        id,
        targetStatus: commercialNextStep.status,
        note: commercialStageNote.trim(),
      });
      toast.success(`Oferta movida a: ${STATUS_LABELS[commercialNextStep.status].label}`);
      setShowCommercialStageDialog(false);
      setCommercialStageNote("");
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "No fue posible mover la oferta en el pipeline");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="!inset-0 !top-0 !left-0 !h-[100dvh] !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none overflow-y-auto overscroll-contain border-[#1f2937] bg-[#111827] p-3 text-white sm:!top-1/2 sm:!left-1/2 sm:!h-auto sm:!max-h-[90vh] sm:!w-[calc(100%-2rem)] sm:!max-w-4xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:p-6">
          {/* Header */}
          <DialogHeader className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-[#1f2937] bg-[#111827] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-14 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pr-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-mono text-emerald-400 text-base sm:text-lg">{space.code}</span>
              <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 mt-2">
            {/* Action buttons - two rows for mobile visibility */}
            <div className="flex flex-col gap-2">
            {/* Row 1: Status-specific actions */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {canManageAdministrativeDetails && space.spaceStatus === "pending" && (
                <Button size="sm" onClick={() => handleStatusUpdate("under_review")} className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0 text-xs">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Revisar
                </Button>
              )}
              {canManageAdministrativeDetails && (space.spaceStatus === "pending" || space.spaceStatus === "under_review") && (
                <>
                  <Button size="sm" onClick={handleGenerateAI} disabled={generateAIMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0 text-xs">
                    {generateAIMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />}
                    Scoring IA
                  </Button>
                  <Button size="sm" onClick={() => handleStatusUpdate("approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRejectDialog(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0 text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
                  </Button>
                </>
              )}
              {pipelineAction && !commercialNextStep && (
                <Button size="sm" onClick={handlePipelineAction} className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0 text-xs">
                  <Globe className="w-3.5 h-3.5 mr-1" /> Mover en pipeline
                </Button>
              )}
              {commercialNextStep && (
                <Button size="sm" onClick={handlePipelineAction} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0 text-xs">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Mover en pipeline
                </Button>
              )}
              {canManageAdministrativeDetails && space.spaceStatus === "letter_sent" && (
                <Button size="sm" variant="outline" onClick={() => setShowPublishDialog(true)} className="border-amber-400/50 text-amber-200 hover:bg-amber-500/10 flex-shrink-0 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Formalizar y publicar
                </Button>
              )}
            </div>
            {space.spaceStatus === "letter_sent" && (
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-medium text-purple-100">Enlace alterno de firma</p><p className="text-xs text-purple-200/80">Úsalo si el correo no llega. El enlace es único y solo funciona mientras la carta esté pendiente de firma.</p>{(space as any).letterDeliveryStatus && <p className="mt-1 text-xs text-purple-100">Correo: <strong>{({ SENT: "Enviado", DELIVERED: "Entregado", DELAYED: "Con retraso", BOUNCED: "Rebotado", FAILED: "Fallido", OPENED: "Abierto", CLICKED: "Enlace abierto", COMPLAINED: "Marcado como spam", SUPPRESSED: "Suprimido" } as Record<string, string>)[(space as any).letterDeliveryStatus] ?? "En seguimiento"}</strong></p>}</div>
                  {!letterShareLink && <Button size="sm" variant="outline" onClick={handleGetLetterShareLink} disabled={getLetterShareLinkMutation.isPending} className="border-purple-400/50 text-purple-100 hover:bg-purple-500/20">{getLetterShareLinkMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1 h-3.5 w-3.5" />}Obtener enlace</Button>}
                </div>
                {letterShareLink && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={letterShareLink} readOnly className="h-9 border-purple-400/30 bg-slate-950/40 text-xs text-purple-100" /><Button size="sm" variant="outline" onClick={handleCopyLetterLink} className="border-purple-400/50 text-purple-100 hover:bg-purple-500/20"><Copy className="mr-1 h-3.5 w-3.5" />Copiar</Button><Button size="sm" onClick={handleWhatsAppShare} className="bg-emerald-600 text-white hover:bg-emerald-700"><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</Button><Button size="sm" variant="outline" onClick={handleResendLetter} disabled={sendLetterMutation.isPending} className="border-sky-400/50 text-sky-100 hover:bg-sky-500/20">{sendLetterMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}Reenviar</Button><Button size="sm" variant="outline" onClick={handleRotateLetterShareLink} disabled={rotateLetterShareLinkMutation.isPending} className="border-amber-400/50 text-amber-100 hover:bg-amber-500/20">{rotateLetterShareLinkMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Rotar</Button></div>}
                {letterDeliveryHistory && letterDeliveryHistory.length > 0 && <div className="mt-3 border-t border-purple-400/20 pt-2"><p className="text-[11px] font-medium uppercase tracking-wide text-purple-200">Historial de correo</p><div className="mt-1 space-y-1">{letterDeliveryHistory.slice(0, 4).map((event, index) => <div key={`${event.eventType}-${event.occurredAt}-${index}`} className="flex items-center justify-between gap-2 text-xs text-purple-100/90"><span>{({ SENT: "Enviado", DELIVERED: "Entregado", DELAYED: "Con retraso", BOUNCED: "Rebotado", FAILED: "Fallido", OPENED: "Abierto", CLICKED: "Enlace abierto", COMPLAINED: "Marcado como spam", SUPPRESSED: "Suprimido" } as Record<string, string>)[event.deliveryStatus] ?? event.eventType}</span><span className="shrink-0 text-purple-200/65">{new Date(event.occurredAt).toLocaleString("es-CO")}</span></div>)}</div></div>}
              </div>
            )}
            {(space as any).manualFormalizedAt && (space as any).manualFormalizationReason && (space as any).manualFormalizationEvidence && (
              <ManualFormalizationAudit
                formalizedAt={(space as any).manualFormalizedAt}
                reason={(space as any).manualFormalizationReason}
                evidence={(space as any).manualFormalizationEvidence}
              />
            )}
              {/* Row 2: documentos y acciones administrativas */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Button size="sm" onClick={handleOpenProspectoDialog} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs w-full">
                  <FileDown className="w-3.5 h-3.5 mr-1" /> Prospecto PDF
                </Button>
                {canManageAdministrativeDetails && <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateAllyPdf}
                  disabled={generateAllyPdfMutation.isPending}
                  title="Genera una ficha sin CAPEX, ROI, payback ni waterfall"
                  className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 text-xs w-full"
                >
                  {generateAllyPdfMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                  Ficha aliado
                </Button>}
                {canManageAdministrativeDetails && <Button size="sm" variant="outline" onClick={handleGenerateAI} disabled={generateAIMutation.isPending} className="border-[#374151] text-gray-300 text-xs w-full">
                  {generateAIMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />}
                  Re-evaluar IA
                </Button>}
                {canManageAdministrativeDetails && <Button size="sm" variant="outline" onClick={() => {
                    // Pre-poblar con TODOS los datos actuales del espacio
                    const techNotes = (() => { try { return space.technicalNotes ? JSON.parse(space.technicalNotes) : {}; } catch { return {}; } })();
                    const ai = aiAnalysis || {};
                    setEditForm({
                      spaceName: space.spaceName, address: space.address, city: space.city,
                      department: space.department || "",
                      latitude: space.latitude ? String(space.latitude) : "",
                      longitude: space.longitude ? String(space.longitude) : "",
                      submitterName: space.submitterName, submitterEmail: space.submitterEmail,
                      submitterPhone: space.submitterPhone || "", submitterCompany: (space as any).submitterCompany || "",
	                      estimatedInvestmentCop: space.estimatedInvestmentCop || "",
						minimumInvestmentCop: (space as any).minimumInvestmentCop || "",
						estimatedRoiPercent: (space as any).estimatedRoiPercent || "",
						estimatedPaybackMonths: (space as any).estimatedPaybackMonths || "",
	                      estimatedPowerKw: space.estimatedPowerKw || "",
                      estimatedChargerCount: space.estimatedChargerCount || "",
                      additionalNotes: space.additionalNotes || "",
                      nearbyAttractions: (space as any).nearbyAttractions || "",
                      investmentType: (space as any).investmentType || "individual",
                      transformerCapacityKva: space.transformerCapacityKva ? String(space.transformerCapacityKva) : "",
                      electricalDistance: (space as any).electricalDistance ?? (space as any).electricalDistanceM ?? "",
                      availableAreaM2: space.availableAreaM2 ? String(space.availableAreaM2) : "",
                      parkingSpots: (space as any).parkingSpots ?? "",
                      estimatedDailyVehicles: (space as any).estimatedDailyVehicles ?? "",
                      estimatedEvPercent: (space as any).estimatedEvPercent ?? "",
                      socioeconomicStratum: (space as any).socioeconomicStratum ?? "",
                      operatingHoursStart: (space as any).operatingHoursStart || "06:00",
	                      operatingHoursEnd: (space as any).operatingHoursEnd || "22:00",
	                      hasElectricalPanel: !!space.hasElectricalPanel,
	                      hasSolarPanels: !!(space as any).hasSolarPanels,
                      solarCoveragePercent: (space as any).solarCoveragePercent ?? "",
                      solarEnergyCostPerKwh: (space as any).solarEnergyCostPerKwh ?? "",
                      solarProgramEnabled: Number((space as any).solarProgramEnabled) === 1,
                      solarProgramCurrentBillCop: (space as any).solarProgramCurrentBillCop ?? "",
                      solarProgramEnergyOffsetPercent: (space as any).solarProgramEnergyOffsetPercent ?? "",
                      solarProgramSavingsCoveragePercent: (space as any).solarProgramSavingsCoveragePercent ?? "",
                      solarProgramMonthlyFinancingPaymentCop: (space as any).solarProgramMonthlyFinancingPaymentCop ?? "",
                      solarProgramInitialMonthlySolarBillCop: (space as any).solarProgramInitialMonthlySolarBillCop ?? "",
                      solarProgramPostAgreementMonthlySolarBillCop: (space as any).solarProgramPostAgreementMonthlySolarBillCop ?? "",
                      solarProgramTotalEnergySavingsCop: (space as any).solarProgramTotalEnergySavingsCop ?? "",
                      solarProgramAnnualReturnPercent: (space as any).solarProgramAnnualReturnPercent ?? "",
                      solarProgramAgreementYears: (space as any).solarProgramAgreementYears ?? "6",
                      solarProgramAnnualCpiPercent: (space as any).solarProgramAnnualCpiPercent ?? "3",
                      solarProgramUsefulLifeYears: (space as any).solarProgramUsefulLifeYears ?? "30",
                      solarSystemPowerKwp: (space as any).solarSystemPowerKwp ?? "",
                      solarAnnualGenerationKwh: (space as any).solarAnnualGenerationKwh ?? "",
	                      solarSelfConsumptionPercent: (space as any).solarSelfConsumptionPercent ?? "",
	                      solarExportPercent: (space as any).solarExportPercent ?? "",
	                      solarGridTariffCopPerKwh: (space as any).solarGridTariffCopPerKwh ?? "",
	                      openSolarProjectId: (space as any).openSolarProjectId ?? "",
	                      openSolarProjectTitle: (space as any).openSolarProjectTitle ?? "",
	                      openSolarAnnualConsumptionKwh: (space as any).openSolarAnnualConsumptionKwh ?? "",
	                      chargingSolarOpenSolarProjectId: (space as any).chargingSolarOpenSolarProjectId ?? (space as any).openSolarProjectId ?? "",
	                      chargingSolarOpenSolarProjectTitle: (space as any).chargingSolarOpenSolarProjectTitle ?? (space as any).openSolarProjectTitle ?? "",
	                      chargingSolarOpenSolarAnnualConsumptionKwh: (space as any).chargingSolarOpenSolarAnnualConsumptionKwh ?? (space as any).openSolarAnnualConsumptionKwh ?? "",
	                      chargingSolarSystemPowerKwp: (space as any).chargingSolarSystemPowerKwp ?? "",
	                      chargingSolarAnnualGenerationKwh: (space as any).chargingSolarAnnualGenerationKwh ?? "",
	                      chargingSolarSelfConsumptionPercent: (space as any).chargingSolarSelfConsumptionPercent ?? "",
	                      chargingSolarExportPercent: (space as any).chargingSolarExportPercent ?? "",
	                      allySolarOpenSolarProjectId: (space as any).allySolarOpenSolarProjectId ?? "",
	                      allySolarOpenSolarProjectTitle: (space as any).allySolarOpenSolarProjectTitle ?? "",
	                      allySolarOpenSolarAnnualConsumptionKwh: (space as any).allySolarOpenSolarAnnualConsumptionKwh ?? "",
	                      hasInternet: !!space.hasInternet,
                      is24Hours: !!(space as any).is24Hours,
                      electricalViability: (space as any).electricalViability || "",
                      requiresNewTransformer: !!techNotes.requiresNewTransformer,
                      proposedTransformerKva: techNotes.proposedTransformerKva || "",
                      aiScore: space.aiScore || "",
                      aiSummary: ai.summary || "",
                      aiRecommendation: ai.recommendation || "",
                      aiEstimatedChargers: ai.estimatedChargers || "",
                      aiEstimatedPowerKw: ai.estimatedPowerKw || "",
                      aiInvestmentAppeal: ai.investmentAppeal || "",
	                    });
	                    setChargingSolarLookup(null);
	                    setAllySolarLookup(null);
	                    setEditSolarOfferPdf(null);
                    setShowEditDialog(true);
                  }} className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs w-full">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>}
                {canManageAdministrativeDetails && <Button size="sm" variant="outline" onClick={() => setShowDeleteDialog(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs w-full">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                </Button>}
              </div>
            </div>

            <div className="rounded-xl border border-[#374151] bg-[#0a0f1a] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> Historial del pipeline</p>
                <span className="text-[11px] text-gray-500">Últimos movimientos</span>
              </div>
              {statusHistory && statusHistory.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {statusHistory.slice(0, 4).map((event, index) => (
                    <div key={`${event.fromStatus}-${event.toStatus}-${event.createdAt}-${index}`} className="flex flex-col gap-1 border-l-2 border-emerald-500/40 pl-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs text-gray-200">{STATUS_LABELS[event.fromStatus]?.label || event.fromStatus} <span className="text-emerald-400">→</span> {STATUS_LABELS[event.toStatus]?.label || event.toStatus}</p>
                        {event.note && <p className="mt-0.5 text-[11px] text-gray-400">{event.note}</p>}
                      </div>
                      <p className="shrink-0 text-[10px] text-gray-500">{new Date(event.createdAt).toLocaleString("es-CO")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Los próximos movimientos quedarán registrados aquí.</p>
              )}
            </div>

            {/* Content grid - single column on mobile, two columns on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left column */}
              <div className="space-y-4">
                <DetailSection title="Postulante" icon={<Mail className="w-4 h-4 text-emerald-400" />}>
                  <DetailRow label="Nombre" value={space.submitterName} />
                  <DetailRow label="Email" value={space.submitterEmail} />
                  <DetailRow label="Teléfono" value={space.submitterPhone} />
                  {space.submitterCompany && <DetailRow label="Empresa" value={space.submitterCompany} />}
                  {space.submitterDocument && <DetailRow label="CC/NIT" value={space.submitterDocument} />}
                </DetailSection>

                <DetailSection title="Espacio" icon={<MapPin className="w-4 h-4 text-emerald-400" />}>
                  <DetailRow label="Nombre" value={space.spaceName} />
                  <DetailRow label="Tipo" value={SPACE_TYPE_LABELS[space.spaceType] || space.spaceType} />
                  <DetailRow label="Dirección" value={space.address} />
                  <DetailRow label="Ciudad" value={space.city} />
                  {space.department && <DetailRow label="Depto." value={space.department} />}
                  {space.latitude && space.longitude && (
                    <DetailRow label="Coords." value={`${Number(space.latitude).toFixed(4)}, ${Number(space.longitude).toFixed(4)}`} />
                  )}
                </DetailSection>

                <DetailSection title="Técnico" icon={<Zap className="w-4 h-4 text-emerald-400" />}>
                  {space.availableAreaM2 && <DetailRow label="Área" value={`${space.availableAreaM2} m²`} />}
                  {space.parkingSpots && <DetailRow label="Parqueos" value={space.parkingSpots.toString()} />}
	                  {space.transformerCapacityKva && <DetailRow label="Trafo" value={`${space.transformerCapacityKva} kVA`} />}
	                  <DetailRow label="Tablero" value={space.hasElectricalPanel ? "Sí" : "No"} />
	                  <DetailRow label="Sistema solar" value={(space as any).hasSolarPanels ? "Incluido en el alcance" : "No incluido"} />
	                  {(space as any).chargingSolarOpenSolarProjectId && <DetailRow label="Proyecto OpenSolar · electrolinera" value={`${(space as any).chargingSolarOpenSolarProjectTitle || "Proyecto"} · #${(space as any).chargingSolarOpenSolarProjectId}`} />}
	                  {(space as any).chargingSolarOpenSolarAnnualConsumptionKwh && <DetailRow label="Consumo solar · electrolinera" value={`${Number((space as any).chargingSolarOpenSolarAnnualConsumptionKwh).toLocaleString("es-CO")} kWh/año`} />}
	                  {(space as any).hasSolarPanels && <DetailRow label="Costo solar" value={Number((space as any).solarCoveragePercent ?? 0) > 0 && (space as any).solarEnergyCostPerKwh !== null && (space as any).solarEnergyCostPerKwh !== undefined ? `${Number((space as any).solarCoveragePercent).toLocaleString("es-CO")}% a ${formatCOP(Number((space as any).solarEnergyCostPerKwh))}/kWh` : "Pendiente de cobertura y costo validados"} />}
	                  {(space as any).solarProgramEnabled && <DetailRow label="Ahorro solar · año 1" value={`${Number((space as any).solarProgramSavingsCoveragePercent ?? 0).toLocaleString("es-CO")}% de factura · ${Number((space as any).solarProgramAgreementYears ?? 6)} años`} />}
	                  {(space as any).solarProgramEnergyOffsetPercent !== null && (space as any).solarProgramEnergyOffsetPercent !== undefined && <DetailRow label="Energía vs consumo · OpenSolar" value={`${Number((space as any).solarProgramEnergyOffsetPercent).toLocaleString("es-CO", { maximumFractionDigits: 2 })}% · indicador técnico`} />}
	                  {(space as any).allySolarOpenSolarProjectId && <DetailRow label="Proyecto OpenSolar · aliado" value={`${(space as any).allySolarOpenSolarProjectTitle || "Proyecto"} · #${(space as any).allySolarOpenSolarProjectId}`} />}
                  {(space as any).solarOfferPdfUrl && <a href={(space as any).solarOfferPdfUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:underline"><FileText className="h-3.5 w-3.5" /> Ver oferta solar adjunta</a>}
                  {space.electricalDistance && <DetailRow label="Dist. tablero" value={`${space.electricalDistance} m`} />}
                  <DetailRow label="Internet" value={space.hasInternet ? "Sí" : "No"} />
                  <DetailRow label="Horario" value={space.is24Hours ? "24h" : `${space.operatingHoursStart || "—"} - ${space.operatingHoursEnd || "—"}`} />
                </DetailSection>
                {solarScopeHistory && solarScopeHistory.length > 0 && (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-200"><Sun className="h-4 w-4" /> Bitácora de alcance solar</p>
                    <div className="mt-2 space-y-1.5">
                      {solarScopeHistory.slice(0, 2).map((event, index) => (
                        <div key={`${event.createdAt}-${index}`} className="flex flex-col gap-0.5 text-[11px] text-amber-100/80 sm:flex-row sm:items-center sm:justify-between">
                          <span>{event.changeSource === "SUBMISSION" ? "Registro inicial" : "Edición administrativa"}: <strong className="text-amber-100">{Number(event.nextHasSolarPanels) === 1 ? "Solar incluido" : "Solar no incluido"}</strong>{Number(event.nextHasSolarPanels) === 1 && Number(event.nextSolarCoveragePercent ?? 0) > 0 && event.nextSolarEnergyCostPerKwh !== null ? ` · ${Number(event.nextSolarCoveragePercent).toLocaleString("es-CO")}% a ${formatCOP(Number(event.nextSolarEnergyCostPerKwh))}/kWh` : ""}</span>
                          <span className="shrink-0 text-amber-100/55">{new Date(event.createdAt).toLocaleString("es-CO")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <DetailSection title="Contexto" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}>
                  {space.estimatedDailyVehicles && <DetailRow label="Vehículos/día" value={space.estimatedDailyVehicles.toString()} />}
                  {space.estimatedEvPercent && <DetailRow label="% EV" value={`${space.estimatedEvPercent}%`} />}
                  {space.socioeconomicStratum && <DetailRow label="Estrato" value={space.socioeconomicStratum.toString()} />}
                  {space.nearbyAttractions && <DetailRow label="Puntos cercanos" value={space.nearbyAttractions} />}
                  {space.additionalNotes && <DetailRow label="Notas" value={space.additionalNotes} />}
                </DetailSection>

                {/* AI Analysis */}
                {aiAnalysis && (
                  <DetailSection title={`Análisis IA — Score: ${space.aiScore}/100`} icon={<Brain className="w-4 h-4 text-purple-400" />}>
                    <p className="text-xs sm:text-sm text-gray-300 mb-3 leading-relaxed">{aiAnalysis.summary}</p>
                    {aiAnalysis.scoreComponents && (
                      <div className="mb-3 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-5">
                        {[
                          ["Técnica", aiAnalysis.scoreComponents.technical, 25],
                          ["Tráfico", aiAnalysis.scoreComponents.traffic, 30],
                          ["Predio", aiAnalysis.scoreComponents.visualSite, 20],
                          ["Demanda", aiAnalysis.scoreComponents.demandContext, 15],
                          ["Acceso", aiAnalysis.scoreComponents.operatingAccess, 10],
                        ].map(([label, value, maximum]) => (
                          <div key={String(label)} className="rounded-md border border-purple-400/20 bg-purple-500/5 px-2 py-1.5 text-center">
                            <p className="text-purple-200/75">{label}</p>
                            <p className="font-semibold text-purple-100">{String(value)}/{String(maximum)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiAnalysis.strengths?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Fortalezas:</p>
                        {aiAnalysis.strengths.map((s: string, i: number) => (
                          <p key={i} className="text-xs text-emerald-300 ml-2">+ {s}</p>
                        ))}
                      </div>
                    )}
                    {aiAnalysis.weaknesses?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Debilidades:</p>
                        {aiAnalysis.weaknesses.map((s: string, i: number) => (
                          <p key={i} className="text-xs text-red-300 ml-2">- {s}</p>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-[#374151]/50 space-y-1.5">
                      {aiAnalysis.recommendation && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Recomendación:</p>
                          <p className="text-xs text-gray-300 leading-relaxed">{aiAnalysis.recommendation}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <DetailRow label="Cargadores" value={aiAnalysis.estimatedChargers?.toString() || "—"} />
                        <DetailRow label="Potencia" value={aiAnalysis.estimatedPowerKw ? `${aiAnalysis.estimatedPowerKw} kW` : "—"} />
                        <DetailRow label="Inversión" value={aiAnalysis.investmentAppeal || "—"} />
                        <DetailRow label="Viabilidad" value={aiAnalysis.electricalViability || "—"} />
                      </div>
                    </div>
                    {aiAnalysis.visualAnalysis && (
                      <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-500/5 p-2.5">
                        <p className="mb-1.5 text-xs font-medium text-sky-200">Lectura visual del predio <span className="font-normal text-sky-200/65">(confianza {aiAnalysis.visualAnalysis.confidence || "media"})</span></p>
                        <div className="space-y-1 text-[11px] leading-relaxed text-slate-300">
                          <p><span className="text-slate-500">Área:</span> {aiAnalysis.visualAnalysis.usableArea}</p>
                          <p><span className="text-slate-500">Accesos:</span> {aiAnalysis.visualAnalysis.accessRoads}</p>
                          <p><span className="text-slate-500">Circulación:</span> {aiAnalysis.visualAnalysis.circulationSafety}</p>
                          <p><span className="text-slate-500">Evidencia eléctrica:</span> {aiAnalysis.visualAnalysis.electricalEvidence}</p>
                        </div>
                      </div>
                    )}
                    {aiAnalysis.dcInfrastructure && (
                      <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] leading-relaxed text-amber-100">
                        <p className="font-semibold text-amber-200">Diseño técnico EVGreen: DC desde 120 kW</p>
                        <p className="mt-1">{aiAnalysis.dcInfrastructure.estimatedPowerKw || aiAnalysis.estimatedPowerKw} kW DC · transformador dedicado mínimo {aiAnalysis.dcInfrastructure.requiredTransformerKva} kVA (FP {aiAnalysis.dcInfrastructure.transformerPowerFactor}) · ampliación y aprobación del operador de red requeridas.</p>
                      </div>
                    )}
                    {aiAnalysis.revenueDistribution && (
                      <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2.5 text-[11px] text-emerald-100">
                        <p className="font-semibold text-emerald-200">Distribución aplicable sobre margen neto</p>
                        <p className="mt-1">{aiAnalysis.revenueDistribution.summary}</p>
                      </div>
                    )}
                    {aiAnalysis.solarScope?.included && (
                      <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] leading-relaxed text-amber-100">
                        <p className="flex items-center gap-1 font-semibold text-amber-200"><Sun className="h-3.5 w-3.5" /> Alcance solar considerado (+{aiAnalysis.solarScope.technicalScoreBonus || 0} técnico)</p>
                        <p className="mt-1">{aiAnalysis.solarScope.note}</p>
                      </div>
                    )}
                  </DetailSection>
                )}

                {/* Mapa de coordenadas */}
                {(space.latitude && space.longitude) ? (
                  <DetailSection title="Ubicación GPS" icon={<MapPin className="w-4 h-4 text-blue-400" />}>
                    <div className="space-y-2">
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-500">Lat:</span><span className="text-gray-300 font-mono">{space.latitude}</span>
                        <span className="text-gray-500 ml-2">Lng:</span><span className="text-gray-300 font-mono">{space.longitude}</span>
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${space.latitude},${space.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={`https://maps.googleapis.com/maps/api/staticmap?center=${space.latitude},${space.longitude}&zoom=15&size=400x180&maptype=roadmap&markers=color:green%7Clabel:EV%7C${space.latitude},${space.longitude}&key=${(window as any).__VITE_GOOGLE_MAPS_API_KEY__ || ""}`}
                          alt="Mapa"
                          className="w-full rounded-lg border border-[#374151] object-cover"
                          style={{ height: 140 }}
                          onError={e => {
                            // Si falla la imagen del mapa, mostrar enlace de texto
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <p className="text-xs text-blue-400 hover:underline mt-1">📌 Ver en Google Maps</p>
                      </a>
                    </div>
                  </DetailSection>
                ) : (
                  <div className="bg-[#0a0f1a] border border-dashed border-[#374151] rounded-xl p-3 text-center">
                    <MapPin className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Sin coordenadas GPS</p>
                    <button
                      onClick={() => {
                        setEditForm({
                          spaceName: space.spaceName, address: space.address, city: space.city,
                          department: space.department || "", latitude: "", longitude: "",
                        });
                        setShowEditDialog(true);
                      }}
                      className="text-xs text-blue-400 hover:underline mt-1"
                    >
                      + Agregar coordenadas
                    </button>
                  </div>
                )}

                {/* Photos */}
                {space.photos && space.photos.length > 0 && (
                  <DetailSection title={`Fotos (${space.photos.length})`} icon={<Camera className="w-4 h-4 text-emerald-400" />}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {space.photos.map((photo: any, i: number) => (
                        <div key={photo.id ?? i} className={`rounded-lg border p-1.5 ${photo.isCover ? "border-amber-400/80 bg-amber-400/5" : "border-[#374151] bg-black/10"}`}>
                          <button
                            type="button"
                            onClick={() => setActivePhotoIndex(i)}
                            className="block relative group w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
                            aria-label={`Abrir ${photo.caption || `fotografía ${i + 1}`} en la galería`}
                          >
                            <img
                              src={photo.photoUrl}
                              alt={photo.caption || `Foto ${i + 1}`}
                              className="w-full h-20 sm:h-24 object-cover rounded-md group-hover:brightness-110 transition-all"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-md transition-colors flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200">
                              {getPhotoTypeLabel(photo.photoType)}
                            </span>
                            {photo.isCover && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-semibold text-slate-950">Portada</span>}
                            {photo.isConceptual && <span className="rounded bg-purple-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">Render conceptual</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCoverPhotoMutation.mutate({ submissionId: id, photoId: photo.id })}
                              disabled={setCoverPhotoMutation.isPending || !photo.id || Boolean(photo.isCover)}
                              title={photo.isCover ? "Esta foto ya es la portada seleccionada" : "Usar esta foto como portada"}
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${photo.isCover ? "cursor-default bg-amber-400/80 text-slate-950" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            >
                              {coverPhotoActionLabel(Boolean(photo.isCover))}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleConceptualPhotoMutation.mutate({ submissionId: id, photoId: photo.id, isConceptual: !Boolean(photo.isConceptual) })}
                              disabled={toggleConceptualPhotoMutation.isPending || !photo.id}
                              title={photo.isConceptual ? "Quitar la clasificación de render conceptual" : "Marcar como render o maqueta conceptual 3D"}
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${photo.isConceptual ? "bg-purple-500 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            >
                              {conceptualPhotoActionLabel(Boolean(photo.isConceptual))}
                            </button>
                            <select
                              value={photo.photoType || "general"}
                              onChange={(event) => updatePhotoTypeMutation.mutate({ submissionId: id, photoId: photo.id, photoType: event.target.value as any })}
                              disabled={updatePhotoTypeMutation.isPending || !photo.id}
                              className="min-w-0 flex-1 rounded border border-blue-400/30 bg-[#111827] px-1.5 py-0.5 text-[9px] text-blue-100"
                              aria-label={`Tipo de ${photo.caption || `foto ${i + 1}`}`}
                            >
                              {SPACE_PHOTO_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{getPhotoTypeLabel(type)}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setPhotoPendingDeletion({
                                id: photo.id,
                                label: photo.caption || `${getPhotoTypeLabel(photo.photoType)} · foto ${i + 1}`,
                                url: photo.photoUrl,
                              })}
                              disabled={deletePhotoMutation.isPending || !photo.id}
                              title="Quitar esta foto del expediente y la galería de inversión"
                              aria-label={`Quitar ${photo.caption || `foto ${i + 1}`}`}
                              className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-200 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Gestor Comercial */}
                <DetailSection title="Gestor Comercial" icon={<span className="text-emerald-400 text-xs font-bold">%</span>}>
                  {(space as any).gestorId ? (
                    <div className="space-y-2">
                      <DetailRow label="Gestor" value={(space as any).gestorName ?? `ID: ${(space as any).gestorId}`} />
                      <DetailRow label="Comisión" value={`${parseFloat((space as any).gestorCommissionPercent ?? "3.75").toFixed(2)}%`} />
                      <button
                        onClick={() => { setGestorForm({ gestorId: String((space as any).gestorId), commissionPercent: String((space as any).gestorCommissionPercent ?? "3.75") }); setShowGestorDialog(true); }}
                        className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                      >
                        Cambiar gestor / comisión
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-500 text-sm mb-2">Sin gestor asignado</p>
                      <button
                        onClick={() => { setGestorForm({ gestorId: "", commissionPercent: "3.75" }); setShowGestorDialog(true); }}
                        className="text-xs px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30"
                      >
                        + Vincular Gestor
                      </button>
                    </div>
                  )}
                </DetailSection>

                {/* Modal vincular gestor */}
                {showGestorDialog && (
                  <Dialog open onOpenChange={() => setShowGestorDialog(false)}>
                    <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-white">Vincular Gestor Comercial</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="text-sm text-slate-300 block mb-1">Gestor</label>
                          <select
                            value={gestorForm.gestorId}
                            onChange={e => setGestorForm(f => ({ ...f, gestorId: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">-- Seleccionar gestor --</option>
                            {gestoresData?.gestores?.map((g: any) => (
                              <option key={g.id} value={String(g.id)}>{g.name} ({g.email})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-slate-300 block mb-1">Comisión del gestor (%)</label>
                          <input
                            type="number" step="0.01" min="0" max="100"
                            value={gestorForm.commissionPercent}
                            onChange={e => setGestorForm(f => ({ ...f, commissionPercent: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                          />
                          <p className="text-xs text-slate-500 mt-1">Este % sale del 30% de EVGreen. No afecta al inversionista.</p>
                        </div>
                        <div className="flex gap-3 pt-1">
                          <button onClick={() => setShowGestorDialog(false)} className="flex-1 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700">
                            Cancelar
                          </button>
                          <button
                            onClick={() => asignarGestorMutation.mutate({ spaceId: id, gestorId: parseInt(gestorForm.gestorId), commissionPercent: parseFloat(gestorForm.commissionPercent) } as any)}
                            disabled={!gestorForm.gestorId || asignarGestorMutation.isPending}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            {asignarGestorMutation.isPending ? "Guardando..." : "Vincular"}
                          </button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Timeline */}
                <DetailSection title="Historial" icon={<Clock className="w-4 h-4 text-emerald-400" />}>
                  <DetailRow label="Creado" value={formatDate(space.createdAt)} />
                  {space.evaluatedAt && <DetailRow label="Evaluado" value={formatDate(space.evaluatedAt)} />}
                  {space.letterSentAt && <DetailRow label="Carta enviada" value={formatDate(space.letterSentAt)} />}
                  {space.letterAcceptedAt && <DetailRow label="Carta aceptada" value={formatDate(space.letterAcceptedAt)} />}
                  {space.letterSignerName && <DetailRow label="Firmante" value={`${space.letterSignerName} (${space.letterSignerDocument})`} />}
                  {space.letterSignerIp && <DetailRow label="IP de firma" value={space.letterSignerIp} />}
                  {(space as any).signedLetterPdfUrl && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <a
                        href={(space as any).signedLetterPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium transition-all hover:border-emerald-500/50"
                      >
                        <Download className="w-4 h-4" />
                        Descargar Constancia PDF
                      </a>
                      <p className="text-[11px] text-gray-500 mt-1.5 ml-1">Documento legal con firma digital, fecha, IP y hash de verificación</p>
                    </div>
                  )}
                </DetailSection>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SpacePhotoLightbox
        photos={space.photos || []}
        activeIndex={activePhotoIndex}
        onActiveIndexChange={setActivePhotoIndex}
      />

      {/* Confirmación de retiro de una fotografía ya persistida */}
      <Dialog
        open={Boolean(photoPendingDeletion)}
        onOpenChange={(open) => {
          if (!open && !deletePhotoMutation.isPending) setPhotoPendingDeletion(null);
        }}
      >
        <DialogContent className="z-[110] max-w-[calc(100vw-2rem)] border-red-500/30 bg-[#111827] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-200">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              ¿Quitar esta foto?
            </DialogTitle>
          </DialogHeader>
          {photoPendingDeletion && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-[#374151] bg-black/20 p-2.5">
                <img
                  src={photoPendingDeletion.url}
                  alt="Vista previa de la foto a retirar"
                  className="h-16 w-20 rounded-md object-cover"
                />
                <p className="min-w-0 break-words text-sm text-gray-200">{photoPendingDeletion.label}</p>
              </div>
              <p className="text-sm leading-5 text-gray-300">
                La foto se retirará del expediente de este Espacio y, si existe un proyecto asociado, de su galería de inversión. Si era la portada, se seleccionará otra foto automáticamente.
              </p>
              <p className="text-xs leading-4 text-gray-500">
                Esta acción no se puede deshacer desde el historial; podrás cargar una foto corregida después.
              </p>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={deletePhotoMutation.isPending}
              onClick={() => setPhotoPendingDeletion(null)}
              className="w-full border-[#374151] text-gray-300 sm:w-auto"
            >
              Conservar foto
            </Button>
            <Button
              type="button"
              disabled={!photoPendingDeletion || deletePhotoMutation.isPending}
              onClick={() => photoPendingDeletion && deletePhotoMutation.mutate({ submissionId: id, photoId: photoPendingDeletion.id })}
              className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
            >
              {deletePhotoMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Quitar foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar postulación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 mb-1.5 block text-sm">Motivo del rechazo</Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explique el motivo del rechazo..."
                rows={4}
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={updateStatusMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
              {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <XCircle className="w-4 h-4 mr-1.5" />}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCommercialStageDialog} onOpenChange={setShowCommercialStageDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-300"><ArrowUpRight className="w-5 h-5" /> {commercialNextStep?.label || "Mover en pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-300">{commercialNextStep?.description} Este avance queda registrado en el historial comercial.</p>
            <div>
              <Label className="mb-1.5 block text-sm text-gray-300">Nota de gestión *</Label>
              <Textarea value={commercialStageNote} onChange={(event) => setCommercialStageNote(event.target.value)} placeholder="Ej.: Confirmación del comité de inversión recibida el 19 de agosto." rows={4} className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 resize-none text-sm" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCommercialStageDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleCommercialStageAdvance} disabled={advanceCommercialStageMutation.isPending || commercialStageNote.trim().length < 4} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              {advanceCommercialStageMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} Confirmar movimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPipelineActionDialog} onOpenChange={setShowPipelineActionDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-300"><ArrowUpRight className="w-5 h-5" /> {pipelineAction?.title || "Mover en pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-300">{pipelineAction?.description}</p>
            {pipelineAction?.kind === "await_external_signature" && (
              <p className="rounded-lg border border-purple-400/25 bg-purple-500/10 p-3 text-xs text-purple-100">Para apoyar el cierre puedes usar el enlace alterno o reenviar el correo; no se alterará el estado ni se realizará una formalización interna.</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPipelineActionDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handlePipelineActionConfirmation} disabled={sendLetterMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              {sendLetterMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} {pipelineAction?.confirmLabel || "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — EXPANDIDO */}
      <Dialog open={showEditDialog} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="!inset-0 !top-0 !left-0 !flex !h-[100dvh] !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-hidden !rounded-none border-[#1f2937] bg-[#111827] !p-0 text-white sm:!top-1/2 sm:!left-1/2 sm:!h-[calc(100dvh-2rem)] sm:!max-h-[calc(100dvh-2rem)] sm:!w-[calc(100vw-2rem)] sm:!max-w-none sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg xl:!h-[90vh] xl:!max-h-[90vh] xl:!w-[92vw] xl:!max-w-[72rem]">
          <DialogHeader className="z-10 shrink-0 border-b border-[#1f2937] bg-[#111827] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-14 sm:px-6 sm:py-4 sm:pr-14">
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-400" /> Editar espacio — {space.code}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-6 sm:px-6">
            <div className="space-y-4">

            {/* SECCIÓN: Datos básicos */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-emerald-400 text-xs font-semibold mb-2 uppercase tracking-wide">📍 Datos del Espacio</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 text-xs mb-1 block">Nombre del espacio</Label>
                  <Input value={editForm.spaceName || ""} onChange={e => setEditForm(p => ({ ...p, spaceName: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-gray-300 text-xs mb-1 block">Dirección</Label>
                  <Input value={editForm.address || ""} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Ciudad</Label>
                  <Input value={editForm.city || ""} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Departamento</Label>
                  <Input value={editForm.department || ""} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
            </div>

            {/* SECCIÓN: Coordenadas */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-blue-400 text-xs font-semibold mb-2 uppercase tracking-wide">🗺️ Coordenadas GPS</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Latitud</Label>
                  <Input placeholder="Ej: 4.7110" value={editForm.latitude || ""} onChange={e => setEditForm(p => ({ ...p, latitude: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Longitud</Label>
                  <Input placeholder="Ej: -74.0721" value={editForm.longitude || ""} onChange={e => setEditForm(p => ({ ...p, longitude: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
              {editForm.latitude && editForm.longitude && (
                <a href={`https://maps.google.com/?q=${editForm.latitude},${editForm.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 block">
                  📌 Ver en Google Maps
                </a>
              )}
            </div>

            {/* SECCIÓN: Datos técnicos */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-semibold mb-2 uppercase tracking-wide">⚡ Datos Técnicos</p>
              <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5 text-sm text-amber-50">
                <input type="checkbox" checked={!!editForm.hasSolarPanels} onChange={e => setEditForm(p => ({ ...p, hasSolarPanels: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-amber-400" />
                <span><span className="flex items-center gap-1 font-medium text-amber-200"><Sun className="h-3.5 w-3.5" /> Incluir sistema solar en el alcance</span><span className="mt-1 block text-[11px] leading-4 text-amber-100/75">Suma hasta 3 puntos técnicos al re-evaluar con IA. No modifica ahorro, CAPEX, ROI ni payback sin factura, consumo y diseño solar específico.</span></span>
              </label>
	              {editForm.hasSolarPanels && (
	                <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 sm:grid-cols-2">
	                  <div className="sm:col-span-2 rounded-md border border-sky-400/25 bg-sky-400/5 p-2">
	                    <p className="mb-1 text-xs font-semibold text-sky-100">A. Sistema solar de la electrolinera</p>
	                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
	                      <div className="min-w-0 flex-1">
	                        <Label className="mb-1 block text-xs text-sky-100">ID de proyecto OpenSolar de la electrolinera</Label>
	                        <Input
	                          inputMode="numeric"
	                          placeholder="Ej.: 123456"
	                          value={editForm.chargingSolarOpenSolarProjectId ?? ""}
	                          onChange={(event) => {
	                            setEditForm((previous) => ({ ...previous, chargingSolarOpenSolarProjectId: event.target.value }));
	                            setChargingSolarLookup(null);
	                          }}
	                          className="border-[#374151] bg-[#111827] text-sm text-white"
	                        />
	                      </div>
	                      <Button
	                        type="button"
	                        size="sm"
	                        onClick={() => handleLookupOpenSolarProject("charging")}
	                        disabled={lookupOpenSolarProjectMutation.isPending}
	                        className="shrink-0 bg-sky-600 text-white hover:bg-sky-500"
	                      >
	                        {lookupOpenSolarProjectMutation.isPending
	                          ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
	                          : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
	                        Consultar electrolinera
	                      </Button>
	                    </div>
	                    <p className="mt-1.5 text-[11px] leading-4 text-sky-100/75">Este proyecto corresponde al sistema que abastece la carga EV. Sus datos técnicos alimentan únicamente la revisión de costo energético, CAPEX y proyección del proyecto de carga; no activa el programa solar del aliado.</p>
	                    {chargingSolarLookup && (
	                      <div className="mt-2 space-y-1 border-t border-sky-400/15 pt-2 text-[11px] leading-4">
	                        <p className="text-sky-100">Proyecto de electrolinera consultado{chargingSolarLookup.projectTitle ? `: ${chargingSolarLookup.projectTitle}` : ""}.</p>
	                        {chargingSolarLookup.mappedFields.length > 0 && <p className="text-emerald-100/90">Precargado: {chargingSolarLookup.mappedFields.join(", ")}.</p>}
	                        {chargingSolarLookup.unavailableFields.length > 0 && <p className="text-amber-100/90">Pendiente de validar: {chargingSolarLookup.unavailableFields.join(", ")}.</p>}
	                        {chargingSolarLookup.warnings.map((warning) => <p key={warning} className="text-amber-100/90">Aviso: {warning}</p>)}
	                      </div>
	                    )}
	                    {(editForm.chargingSolarSystemPowerKwp !== "" || editForm.chargingSolarAnnualGenerationKwh !== "") && (
	                      <p className="mt-2 text-[11px] text-sky-100/85">Diseño importado: {editForm.chargingSolarSystemPowerKwp !== "" ? `${Number(editForm.chargingSolarSystemPowerKwp).toLocaleString("es-CO")} kWp` : "potencia pendiente"} · {editForm.chargingSolarAnnualGenerationKwh !== "" ? `${Number(editForm.chargingSolarAnnualGenerationKwh).toLocaleString("es-CO")} kWh/año` : "generación pendiente"}.</p>
	                    )}
	                  </div>
	                  <div>
	                    <Label className="mb-1 block text-xs text-amber-100">Cobertura solar autoconsumida (%)</Label>
                    <Input inputMode="decimal" min="0" max="100" placeholder="Ej.: 25" value={editForm.solarCoveragePercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarCoveragePercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-amber-100">Costo solar validado (COP/kWh)</Label>
                    <Input inputMode="numeric" min="0" placeholder="Ej.: 180" value={editForm.solarEnergyCostPerKwh ?? ""} onChange={e => setEditForm(p => ({ ...p, solarEnergyCostPerKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" />
                  </div>
	                  <p className="sm:col-span-2 text-[11px] leading-4 text-amber-100/75">El descuento de energía de la electrolinera se aplica únicamente cuando cobertura y costo solar fueron validados con factura, consumo y diseño de la carga EV. OpenSolar puede precargar la cobertura técnica; el costo solar/LCOE y CAPEX no se inventan. De lo contrario el modelo conserva el costo de red.</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Transformador (kVA)</Label>
                  <Input inputMode="decimal" placeholder="Ej: 112,5 o 112.5" value={editForm.transformerCapacityKva || ""} onChange={e => setEditForm(p => ({ ...p, transformerCapacityKva: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Distancia tablero (m)</Label>
                  <Input inputMode="numeric" value={editForm.electricalDistance ?? ""} onChange={e => setEditForm(p => ({ ...p, electricalDistance: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Área disponible (m²)</Label>
                  <Input inputMode="decimal" placeholder="Ej: 85,5 o 85.5" value={editForm.availableAreaM2 || ""} onChange={e => setEditForm(p => ({ ...p, availableAreaM2: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Puestos de parqueo</Label>
                  <Input inputMode="numeric" value={editForm.parkingSpots ?? ""} onChange={e => setEditForm(p => ({ ...p, parkingSpots: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Vehículos/día</Label>
                  <Input inputMode="numeric" placeholder="Ej: 700 o 1.100" value={editForm.estimatedDailyVehicles ?? ""} onChange={e => setEditForm(p => ({ ...p, estimatedDailyVehicles: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">% EV estimado</Label>
                  <Input inputMode="numeric" value={editForm.estimatedEvPercent ?? ""} onChange={e => setEditForm(p => ({ ...p, estimatedEvPercent: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Estrato</Label>
                  <Input inputMode="numeric" value={editForm.socioeconomicStratum ?? ""} onChange={e => setEditForm(p => ({ ...p, socioeconomicStratum: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Horario inicio</Label>
                  <Input type="time" value={editForm.operatingHoursStart || "06:00"} onChange={e => setEditForm(p => ({ ...p, operatingHoursStart: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Horario fin</Label>
                  <Input type="time" value={editForm.operatingHoursEnd || "22:00"} onChange={e => setEditForm(p => ({ ...p, operatingHoursEnd: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!editForm.hasElectricalPanel} onChange={e => setEditForm(p => ({ ...p, hasElectricalPanel: e.target.checked }))} className="accent-emerald-500" />
                  Tablero eléctrico accesible
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!editForm.hasInternet} onChange={e => setEditForm(p => ({ ...p, hasInternet: e.target.checked }))} className="accent-emerald-500" />
                  Internet disponible
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!editForm.is24Hours} onChange={e => setEditForm(p => ({ ...p, is24Hours: e.target.checked }))} className="accent-emerald-500" />
                  Operación 24 horas
                </label>
              </div>
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2.5">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-emerald-50">
                  <input type="checkbox" checked={!!editForm.solarProgramEnabled} onChange={e => setEditForm(p => ({ ...p, solarProgramEnabled: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                  <span><strong className="block text-emerald-200">B. Programa solar de ahorro para la EDS o comercio aliado</strong><span className="mt-0.5 block leading-4 text-emerald-100/75">Es un proyecto independiente del sistema de la electrolinera. Registra la factura, el ahorro cubierto, el plazo y la oferta para la ficha comercial del aliado.</span></span>
                </label>
                <div className="mt-2 rounded-md border border-emerald-400/25 bg-emerald-400/5 p-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <Label className="mb-1 block text-xs text-emerald-100">ID de proyecto OpenSolar de la EDS o comercio</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="Ej.: 654321"
                        value={editForm.allySolarOpenSolarProjectId ?? ""}
                        onChange={(event) => {
                          setEditForm((previous) => ({ ...previous, allySolarOpenSolarProjectId: event.target.value }));
                          setAllySolarLookup(null);
                        }}
                        className="border-[#374151] bg-[#111827] text-sm text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleLookupOpenSolarProject("ally")}
                      disabled={lookupOpenSolarProjectMutation.isPending}
                      className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      {lookupOpenSolarProjectMutation.isPending
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                      Consultar aliado
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-emerald-100/75">Puede consultar antes de activar el programa. La factura y el consumo validan el beneficio comercial; no modifican el costo de la electrolinera.</p>
                  {allySolarLookup && (
                    <div className="mt-2 space-y-1 border-t border-emerald-400/15 pt-2 text-[11px] leading-4">
                      <p className="text-emerald-100">Proyecto del aliado consultado{allySolarLookup.projectTitle ? `: ${allySolarLookup.projectTitle}` : ""}.</p>
                      {allySolarLookup.mappedFields.length > 0 && <p className="text-emerald-100/90">Precargado: {allySolarLookup.mappedFields.join(", ")}.</p>}
                      {allySolarLookup.unavailableFields.length > 0 && <p className="text-amber-100/90">Pendiente de validar: {allySolarLookup.unavailableFields.join(", ")}.</p>}
                      {allySolarLookup.warnings.map((warning) => <p key={warning} className="text-amber-100/90">Aviso: {warning}</p>)}
                    </div>
                  )}
                </div>
                {!!editForm.solarProgramEnabled && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura mensual promedio (COP) *</Label><Input inputMode="decimal" value={editForm.solarProgramCurrentBillCop ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramCurrentBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Ahorro sobre factura · año 1 (%) *</Label><Input inputMode="decimal" min="0" max="100" value={editForm.solarProgramSavingsCoveragePercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramSavingsCoveragePercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Energía generada vs consumo (%)</Label><Input inputMode="decimal" min="0" max="1000" value={editForm.solarProgramEnergyOffsetPercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramEnergyOffsetPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /><p className="mt-1 text-[10px] leading-3 text-emerald-100/65">Métrica técnica OpenSolar. La suma global usa sólo el ahorro neto posterior para evitar doble conteo.</p></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Plazo del acuerdo (años)</Label><Input inputMode="numeric" min="1" max="30" value={editForm.solarProgramAgreementYears ?? "6"} onChange={e => setEditForm(p => ({ ...p, solarProgramAgreementYears: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Pago estable de energía con acuerdo solar (COP)</Label><Input inputMode="decimal" placeholder="Propuesta comercial" value={editForm.solarProgramMonthlyFinancingPaymentCop ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramMonthlyFinancingPaymentCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura solar residual año 1 (COP)</Label><Input inputMode="decimal" placeholder="Factura propuesta, no cuota" value={editForm.solarProgramInitialMonthlySolarBillCop ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramInitialMonthlySolarBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Factura solar desde año 7 (COP)</Label><Input inputMode="decimal" placeholder="Al terminar el plazo" value={editForm.solarProgramPostAgreementMonthlySolarBillCop ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramPostAgreementMonthlySolarBillCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Ahorro total de dinero por energía (COP)</Label><Input inputMode="decimal" placeholder="Valor comercial de la propuesta" value={editForm.solarProgramTotalEnergySavingsCop ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramTotalEnergySavingsCop: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Tasa de rendimiento anual (%)</Label><Input inputMode="decimal" placeholder="Ej.: 15,9" value={editForm.solarProgramAnnualReturnPercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarProgramAnnualReturnPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">IPC anual de referencia (%)</Label><Input inputMode="decimal" min="0" max="30" value={editForm.solarProgramAnnualCpiPercent ?? "3"} onChange={e => setEditForm(p => ({ ...p, solarProgramAnnualCpiPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Vida útil de referencia (años)</Label><Input inputMode="numeric" min="1" max="50" value={editForm.solarProgramUsefulLifeYears ?? "30"} onChange={e => setEditForm(p => ({ ...p, solarProgramUsefulLifeYears: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Potencia solar (kWp)</Label><Input inputMode="decimal" value={editForm.solarSystemPowerKwp ?? ""} onChange={e => setEditForm(p => ({ ...p, solarSystemPowerKwp: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Generación anual (kWh)</Label><Input inputMode="decimal" value={editForm.solarAnnualGenerationKwh ?? ""} onChange={e => setEditForm(p => ({ ...p, solarAnnualGenerationKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Autoconsumo (%)</Label><Input inputMode="decimal" min="0" max="100" value={editForm.solarSelfConsumptionPercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarSelfConsumptionPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Exportación (%)</Label><Input inputMode="decimal" min="0" max="100" value={editForm.solarExportPercent ?? ""} onChange={e => setEditForm(p => ({ ...p, solarExportPercent: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div><Label className="mb-1 block text-xs text-emerald-100">Tarifa de red (COP/kWh)</Label><Input inputMode="numeric" value={editForm.solarGridTariffCopPerKwh ?? ""} onChange={e => setEditForm(p => ({ ...p, solarGridTariffCopPerKwh: e.target.value }))} className="border-[#374151] bg-[#111827] text-sm text-white" /></div>
                    <div className="sm:col-span-2"><Label className="mb-1 block text-xs text-emerald-100">Reemplazar oferta solar PDF (opcional)</Label><Input type="file" accept="application/pdf,.pdf" onChange={e => setEditSolarOfferPdf(e.target.files?.[0] || null)} className="border-[#374151] bg-[#111827] text-xs text-white file:mr-2 file:rounded file:border-0 file:bg-emerald-600 file:px-2 file:py-1 file:text-xs file:text-white" />{editSolarOfferPdf && <p className="mt-1 truncate text-[11px] text-emerald-200">{editSolarOfferPdf.name}</p>}</div>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN: Transformador nuevo */}
            <div className="bg-[#0a0f1a] border border-orange-500/30 rounded-lg p-3">
              <p className="text-orange-400 text-xs font-semibold mb-2 uppercase tracking-wide">🔧 Infraestructura Eléctrica</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={!!editForm.requiresNewTransformer} onChange={e => setEditForm(p => ({ ...p, requiresNewTransformer: e.target.checked }))} className="accent-orange-500 w-4 h-4" />
                  <span>Requiere instalación de <strong>transformador nuevo</strong></span>
                </label>
                {editForm.requiresNewTransformer && (
                  <div className="ml-6">
                    <Label className="text-gray-300 text-xs mb-1 block">Capacidad propuesta del nuevo transformador (kVA)</Label>
                    <Input inputMode="decimal" placeholder="Ej: 250" value={editForm.proposedTransformerKva || ""} onChange={e => setEditForm(p => ({ ...p, proposedTransformerKva: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm w-40" />
                  </div>
                )}
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Viabilidad eléctrica</Label>
                  <Select value={editForm.electricalViability || ""} onValueChange={v => setEditForm(p => ({ ...p, electricalViability: v }))}>
                    <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      <SelectItem value="viable" className="text-green-300">✅ Viable</SelectItem>
                      <SelectItem value="requires_upgrade" className="text-yellow-300">⚠️ Requiere mejora</SelectItem>
                      <SelectItem value="not_viable" className="text-red-300">❌ No viable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SECCIÓN: Evaluación IA (editable) */}
            <div className="bg-[#0a0f1a] border border-purple-500/30 rounded-lg p-3">
              <p className="text-purple-400 text-xs font-semibold mb-2 uppercase tracking-wide">🤖 Evaluación IA (editable manualmente)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Score IA (0-100)</Label>
                  <Input type="number" min={0} max={100} value={editForm.aiScore ?? ""} onChange={e => setEditForm(p => ({ ...p, aiScore: parseInt(e.target.value) || undefined }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Cargadores estimados</Label>
                  <Input type="number" value={editForm.aiEstimatedChargers ?? ""} onChange={e => setEditForm(p => ({ ...p, aiEstimatedChargers: parseInt(e.target.value) || undefined }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Potencia IA (kW)</Label>
                  <Input type="number" value={editForm.aiEstimatedPowerKw ?? ""} onChange={e => setEditForm(p => ({ ...p, aiEstimatedPowerKw: parseInt(e.target.value) || undefined }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Atractivo inversión</Label>
                  <Select value={editForm.aiInvestmentAppeal || ""} onValueChange={v => setEditForm(p => ({ ...p, aiInvestmentAppeal: v }))}>
                    <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2937] border-[#374151]">
                      <SelectItem value="alto" className="text-green-300">Alto</SelectItem>
                      <SelectItem value="medio" className="text-yellow-300">Medio</SelectItem>
                      <SelectItem value="bajo" className="text-red-300">Bajo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-gray-300 text-xs mb-1 block">Resumen IA</Label>
                <Textarea value={editForm.aiSummary || ""} onChange={e => setEditForm(p => ({ ...p, aiSummary: e.target.value }))} rows={2} placeholder="Resumen del análisis IA..." className="bg-[#111827] border-[#374151] text-white text-sm resize-none" />
              </div>
              <div className="mt-2">
                <Label className="text-gray-300 text-xs mb-1 block">Recomendación IA</Label>
                <Textarea value={editForm.aiRecommendation || ""} onChange={e => setEditForm(p => ({ ...p, aiRecommendation: e.target.value }))} rows={2} placeholder="Recomendación del tipo de cargador..." className="bg-[#111827] border-[#374151] text-white text-sm resize-none" />
              </div>
            </div>

            {/* SECCIÓN: Inversión y comercial */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-emerald-400 text-xs font-semibold mb-2 uppercase tracking-wide">💰 Datos Comerciales</p>
	              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
	                <div>
	                  <Label className="text-gray-300 text-xs mb-1 block">Inversión estimada (COP)</Label>
                  <Input inputMode="decimal" placeholder="Ej: 90.000.000" value={editForm.estimatedInvestmentCop || ""} onChange={e => setEditForm(p => ({ ...p, estimatedInvestmentCop: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
	                </div>
				<div>
				  <Label className="text-gray-300 text-xs mb-1 block">Inversión mínima (COP)</Label>
                  <Input inputMode="decimal" placeholder="Ej: 1.000.000" value={editForm.minimumInvestmentCop || ""} onChange={e => setEditForm(p => ({ ...p, minimumInvestmentCop: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
				</div>
				<div>
				  <Label className="text-gray-300 text-xs mb-1 block">ROI estimado (%)</Label>
                  <Input inputMode="decimal" value={editForm.estimatedRoiPercent || ""} onChange={e => setEditForm(p => ({ ...p, estimatedRoiPercent: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
				</div>
				<div>
				  <Label className="text-gray-300 text-xs mb-1 block">Payback estimado (meses)</Label>
                  <Input inputMode="numeric" value={editForm.estimatedPaybackMonths || ""} onChange={e => setEditForm(p => ({ ...p, estimatedPaybackMonths: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
				</div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Potencia (kW)</Label>
                  <Input inputMode="numeric" value={editForm.estimatedPowerKw || ""} onChange={e => setEditForm(p => ({ ...p, estimatedPowerKw: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Cargadores</Label>
                  <Input inputMode="numeric" value={editForm.estimatedChargerCount || ""} onChange={e => setEditForm(p => ({ ...p, estimatedChargerCount: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
              {suggestedFinancialProjection ? (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-300">Proyección sugerida · escenario {suggestedFinancialProjection.selectedScenario}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-emerald-100/75">
                        Demanda realista: {suggestedFinancialProjection.snapshot.assumptions.estimatedDailyVehicles.toLocaleString("es-CO")} vehículos/día × {suggestedFinancialProjection.snapshot.assumptions.estimatedEvPercent}% EV = {suggestedFinancialProjection.selected.eligibleEvVehiclesPerDay.toLocaleString("es-CO")} sesiones potenciales/día. Se modelan {suggestedFinancialProjection.selected.sessionsPerDay.toLocaleString("es-CO")} según el menor límite: {suggestedFinancialProjection.selected.connectorCapacitySessionsPerDay.toLocaleString("es-CO")} por mangueras y {suggestedFinancialProjection.selected.powerCapacitySessionsPerDay?.toLocaleString("es-CO") ?? "—"} por potencia ({suggestedFinancialProjection.snapshot.assumptions.totalPowerKw?.toLocaleString("es-CO") ?? "—"} kW), a {suggestedFinancialProjection.snapshot.assumptions.benchmarkKwhPerSession} kWh/sesión.
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-amber-100/80">
                        {suggestedFinancialProjection.snapshot.assumptions.solarCostApplied
                          ? `Solar validado: ${suggestedFinancialProjection.snapshot.assumptions.solarCoveragePercent}% de cobertura a ${formatCOP(suggestedFinancialProjection.snapshot.assumptions.solarEnergyCostPerKwh ?? 0)}/kWh; costo energético efectivo ${formatCOP(suggestedFinancialProjection.snapshot.assumptions.effectiveEnergyCostPerKwh)}/kWh (red: ${formatCOP(suggestedFinancialProjection.snapshot.assumptions.energyCostPerKwh)}/kWh).`
                          : editForm.hasSolarPanels
                            ? `Solar incluido en alcance, sin ahorro aplicado: configura cobertura autoconsumida y costo solar validados; mientras tanto se conserva el costo de red de ${formatCOP(suggestedFinancialProjection.snapshot.assumptions.energyCostPerKwh)}/kWh.`
                            : `Costo energético modelado: ${formatCOP(suggestedFinancialProjection.snapshot.assumptions.energyCostPerKwh)}/kWh de red.`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditForm((current) => ({
                        ...current,
                        estimatedRoiPercent: String(suggestedFinancialProjection.selected.roiAnnualPercent.toFixed(1)),
                        estimatedPaybackMonths: String(Math.max(1, Math.round(suggestedFinancialProjection.selected.paybackMonths))),
                      }))}
                      className="shrink-0 border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Aplicar
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div><span className="block text-emerald-100/60">ROI anual</span><strong className="text-emerald-200">{suggestedFinancialProjection.selected.roiAnnualPercent.toFixed(1)}%</strong></div>
                    <div><span className="block text-emerald-100/60">Payback</span><strong className="text-emerald-200">{Math.max(1, Math.round(suggestedFinancialProjection.selected.paybackMonths))} meses</strong></div>
                    <div><span className="block text-emerald-100/60">Sesiones/mes</span><strong className="text-emerald-200">{Math.round(suggestedFinancialProjection.selected.sessionsPerDay * 30).toLocaleString("es-CO")}</strong></div>
                    <div><span className="block text-emerald-100/60">Flujo inversionista/mes</span><strong className="text-emerald-200">{formatCOP(Math.round(suggestedFinancialProjection.selected.investorMonthlyCashflow))}</strong></div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-gray-500">Ingresa inversión y potencia DC (mínimo 120 kW) para recibir un ROI y payback sugeridos. Puedes usar punto o coma en todos los importes.</p>
              )}
              <div className="mt-2">
                <Label className="text-gray-300 text-xs mb-1 block">Tipo de inversión</Label>
                <Select value={editForm.investmentType || "individual"} onValueChange={v => setEditForm(p => ({ ...p, investmentType: v }))}>
                  <SelectTrigger className="bg-[#111827] border-[#374151] text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f2937] border-[#374151]">
                    <SelectItem value="individual" className="text-white">Individual</SelectItem>
                    <SelectItem value="colectiva" className="text-white">Colectiva (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SECCIÓN: Postulante */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3">
              <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">👤 Datos del Postulante</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Nombre</Label>
                  <Input value={editForm.submitterName || ""} onChange={e => setEditForm(p => ({ ...p, submitterName: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Email</Label>
                  <Input value={editForm.submitterEmail || ""} onChange={e => setEditForm(p => ({ ...p, submitterEmail: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Teléfono</Label>
                  <Input value={editForm.submitterPhone || ""} onChange={e => setEditForm(p => ({ ...p, submitterPhone: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Empresa</Label>
                  <Input value={editForm.submitterCompany || ""} onChange={e => setEditForm(p => ({ ...p, submitterCompany: e.target.value }))} className="bg-[#111827] border-[#374151] text-white text-sm" />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Notas adicionales del postulante</Label>
              <Textarea value={editForm.additionalNotes || ""} onChange={e => setEditForm(p => ({ ...p, additionalNotes: e.target.value }))} rows={2} className="bg-[#0a0f1a] border-[#374151] text-white text-sm resize-none" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Puntos de interés cercanos</Label>
              <Textarea value={editForm.nearbyAttractions || ""} onChange={e => setEditForm(p => ({ ...p, nearbyAttractions: e.target.value }))} rows={2} className="bg-[#0a0f1a] border-[#374151] text-white text-sm resize-none" />
            </div>

            {/* Registro fotográfico (opcional) */}
            <div className="bg-[#0a0f1a] border border-[#374151] rounded-lg p-3 mt-3">
              <p className="text-blue-400 text-xs font-semibold mb-2 uppercase tracking-wide">Agregar Fotos (Opcional)</p>
              <div className="space-y-3">
                {/* Fotos existentes */}
                {space.photos && space.photos.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Fotos actuales ({space.photos.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {space.photos.map((photo: any, i: number) => (
                        <div key={photo.id ?? i} className={`rounded-md border p-1 ${photo.isCover ? "border-amber-400/80 bg-amber-400/5" : "border-[#374151]"}`}>
                          <img src={photo.photoUrl} alt={photo.caption || `Foto ${i + 1}`} className="w-full h-14 object-cover rounded" />
                          <span className="mt-1 block truncate rounded bg-blue-500/15 px-1 py-0.5 text-[9px] font-semibold text-blue-200" title={getPhotoTypeLabel(photo.photoType)}>
                            {getPhotoTypeLabel(photo.photoType)}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setCoverPhotoMutation.mutate({ submissionId: id, photoId: photo.id })}
                              disabled={setCoverPhotoMutation.isPending || !photo.id || Boolean(photo.isCover)}
                              title={photo.isCover ? "Esta foto ya es la portada seleccionada" : "Usar esta foto como portada"}
                              className={`rounded px-1 py-0.5 text-[8px] font-semibold ${photo.isCover ? "cursor-default bg-amber-400/80 text-slate-950" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            >
                              {coverPhotoActionLabel(Boolean(photo.isCover))}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleConceptualPhotoMutation.mutate({ submissionId: id, photoId: photo.id, isConceptual: !Boolean(photo.isConceptual) })}
                              disabled={toggleConceptualPhotoMutation.isPending || !photo.id}
                              title={photo.isConceptual ? "Quitar la clasificación de render conceptual" : "Marcar como render o maqueta conceptual 3D"}
                              className={`rounded px-1 py-0.5 text-[8px] font-semibold ${photo.isConceptual ? "bg-purple-500 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            >
                              {conceptualPhotoActionLabel(Boolean(photo.isConceptual))}
                            </button>
                            <select
                              value={photo.photoType || "general"}
                              onChange={(event) => updatePhotoTypeMutation.mutate({ submissionId: id, photoId: photo.id, photoType: event.target.value as any })}
                              disabled={updatePhotoTypeMutation.isPending || !photo.id}
                              className="mt-1 w-full rounded border border-blue-400/30 bg-[#111827] px-1 py-0.5 text-[9px] text-blue-100"
                              aria-label={`Clasificar foto ${i + 1}`}
                            >
                              {SPACE_PHOTO_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{getPhotoTypeLabel(type)}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setPhotoPendingDeletion({
                                id: photo.id,
                                label: photo.caption || `${getPhotoTypeLabel(photo.photoType)} · foto ${i + 1}`,
                                url: photo.photoUrl,
                              })}
                              disabled={deletePhotoMutation.isPending || !photo.id}
                              title="Quitar esta foto del expediente y la galería de inversión"
                              aria-label={`Quitar ${photo.caption || `foto ${i + 1}`}`}
                              className="mt-1 w-full rounded bg-red-500/15 px-1 py-0.5 text-[8px] font-semibold text-red-200 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Quitar foto
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Agregar nuevas fotos */}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-2 bg-[#111827] border border-dashed border-[#374151] hover:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-gray-300 transition-colors">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Agregar nuevas fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const hasCover = Boolean(space.photos?.some((p: any) => p.isCover) || editPhotos.some(p => p.isCover));
                        const newPhotos = files.map((file, fileIdx) => ({
                          file,
                          preview: URL.createObjectURL(file),
                          photoType: "general",
                          isCover: !hasCover && fileIdx === 0,
                          isConceptual: false,
                        }));
                        setEditPhotos(prev => [...prev, ...newPhotos]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {editPhotos.length > 0 && (
                    <span className="text-xs text-gray-400">{editPhotos.length} nueva{editPhotos.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                {editPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {editPhotos.map((photo, idx) => (
                      <div key={idx} className={`relative group rounded-md border p-1 bg-black/40 ${photo.isCover ? "border-amber-400/80 ring-1 ring-amber-400/50" : "border-emerald-500/30"}`}>
                        <img src={photo.preview} alt={`Nueva ${idx + 1}`} className="w-full h-14 sm:h-16 object-cover rounded-md" />
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setEditPhotos(prev => setPendingSpacePhotoCover(prev, idx))}
                            disabled={photo.isCover}
                            title={photo.isCover ? "Esta foto ya es la portada seleccionada" : "Usar esta foto como portada"}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${photo.isCover ? "cursor-default bg-amber-400/80 text-slate-950 font-bold" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                          >
                            {coverPhotoActionLabel(Boolean(photo.isCover))}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPhotos(prev => prev.map((p, i) => i === idx ? { ...p, isConceptual: !p.isConceptual } : p))}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${photo.isConceptual ? "bg-purple-500 text-white font-bold" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                            title={photo.isConceptual ? "Quitar la clasificación de render conceptual" : "Marcar como render o maqueta conceptual 3D"}
                          >
                            {conceptualPhotoActionLabel(Boolean(photo.isConceptual))}
                          </button>
                        </div>
                        <select
                          value={photo.photoType}
                          onChange={(e) => {
                            const updated = [...editPhotos];
                            updated[idx] = { ...updated[idx], photoType: e.target.value };
                            setEditPhotos(updated);
                          }}
                          className="mt-1 w-full bg-[#111827] text-[9px] text-white border border-[#374151] rounded px-1 py-0.5"
                        >
                          <option value="general">General</option>
                          <option value="electrical_panel">Tablero</option>
                          <option value="transformer">Transformador</option>
                          <option value="parking_area">Parqueo</option>
                          <option value="access_road">Acceso</option>
                          <option value="surroundings">Alrededores</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeEditPhoto(idx)}
                          title={`Quitar foto nueva ${idx + 1}`}
                          aria-label={`Quitar foto nueva ${idx + 1}`}
                          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-red-200/60 bg-red-600 text-white shadow-md transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>

          <DialogFooter className="!mt-0 z-10 flex-col-reverse gap-2 border-t border-[#1f2937] bg-[#111827] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-4 sm:pt-3">
            <Button variant="outline" onClick={() => handleEditDialogOpenChange(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={async () => {
              try {
                const numericError = [
                  numericInputError("Latitud", editForm.latitude),
                  numericInputError("Longitud", editForm.longitude),
                  numericInputError("Transformador", editForm.transformerCapacityKva),
                  numericInputError("Distancia al tablero", editForm.electricalDistance, true),
                  numericInputError("Área disponible", editForm.availableAreaM2),
                  numericInputError("Puestos de parqueo", editForm.parkingSpots, true),
                  numericInputError("Vehículos por día", editForm.estimatedDailyVehicles, true),
                  numericInputError("Porcentaje EV", editForm.estimatedEvPercent, true),
                  numericInputError("Estrato", editForm.socioeconomicStratum, true),
                  numericInputError("Transformador propuesto", editForm.proposedTransformerKva),
                  numericInputError("Inversión estimada", editForm.estimatedInvestmentCop),
                  numericInputError("Inversión mínima", editForm.minimumInvestmentCop),
                  numericInputError("ROI", editForm.estimatedRoiPercent),
                  numericInputError("Payback", editForm.estimatedPaybackMonths, true),
                  numericInputError("Potencia", editForm.estimatedPowerKw, true),
                  numericInputError("Cargadores", editForm.estimatedChargerCount, true),
                  numericInputError("Factura solar mensual", editForm.solarProgramCurrentBillCop),
                  numericInputError("Energía frente al consumo", editForm.solarProgramEnergyOffsetPercent),
                  numericInputError("Cobertura de ahorro solar", editForm.solarProgramSavingsCoveragePercent),
                  numericInputError("Cuota solar mensual", editForm.solarProgramMonthlyFinancingPaymentCop),
                  numericInputError("Factura solar residual año 1", editForm.solarProgramInitialMonthlySolarBillCop),
                  numericInputError("Factura solar residual posterior", editForm.solarProgramPostAgreementMonthlySolarBillCop),
                  numericInputError("Ahorro total de energía", editForm.solarProgramTotalEnergySavingsCop),
                  numericInputError("Rendimiento anual solar", editForm.solarProgramAnnualReturnPercent),
                  numericInputError("Plazo solar", editForm.solarProgramAgreementYears, true),
                  numericInputError("IPC solar", editForm.solarProgramAnnualCpiPercent),
                  numericInputError("Vida útil solar", editForm.solarProgramUsefulLifeYears, true),
                  numericInputError("Potencia solar", editForm.solarSystemPowerKwp),
                  numericInputError("Generación solar anual", editForm.solarAnnualGenerationKwh),
                  numericInputError("Autoconsumo solar", editForm.solarSelfConsumptionPercent),
	                  numericInputError("Exportación solar", editForm.solarExportPercent),
	                  numericInputError("Tarifa de red solar", editForm.solarGridTariffCopPerKwh, true),
	                  numericInputError("Consumo anual OpenSolar de la electrolinera", editForm.chargingSolarOpenSolarAnnualConsumptionKwh),
	                  numericInputError("Potencia solar de la electrolinera", editForm.chargingSolarSystemPowerKwp),
	                  numericInputError("Generación solar de la electrolinera", editForm.chargingSolarAnnualGenerationKwh),
	                  numericInputError("Consumo anual OpenSolar del aliado", editForm.allySolarOpenSolarAnnualConsumptionKwh),
                ].find(Boolean);
                if (numericError) throw new Error(numericError);
                const evPercent = toOptionalInteger(editForm.estimatedEvPercent);
                if (evPercent !== undefined && (evPercent < 0 || evPercent > 100)) {
                  throw new Error("El porcentaje de vehículos EV debe estar entre 0 y 100.");
                }
                const stratum = toOptionalInteger(editForm.socioeconomicStratum);
                if (stratum !== undefined && (stratum < 1 || stratum > 6)) {
                  throw new Error("El estrato debe estar entre 1 y 6.");
                }
                const payload: Record<string, any> = { id };
                // Campos básicos
                if (editForm.spaceName !== undefined) payload.spaceName = editForm.spaceName;
                if (editForm.address !== undefined) payload.address = editForm.address;
                if (editForm.city !== undefined) payload.city = editForm.city;
                if (editForm.department !== undefined) payload.department = editForm.department;
                if (editForm.submitterName !== undefined) payload.submitterName = editForm.submitterName;
                if (editForm.submitterEmail !== undefined) payload.submitterEmail = editForm.submitterEmail;
                if (editForm.submitterPhone !== undefined) payload.submitterPhone = editForm.submitterPhone;
                if (editForm.submitterCompany !== undefined) payload.submitterCompany = editForm.submitterCompany;
                if (editForm.additionalNotes !== undefined) payload.additionalNotes = editForm.additionalNotes;
                if (editForm.nearbyAttractions !== undefined) payload.nearbyAttractions = editForm.nearbyAttractions;
                if (editForm.investmentType) payload.investmentType = editForm.investmentType;
                // Coordenadas
                const latitude = toOptionalNumber(editForm.latitude);
                const longitude = toOptionalNumber(editForm.longitude);
                if (latitude !== undefined) payload.latitude = String(latitude);
                if (longitude !== undefined) payload.longitude = String(longitude);
                // Técnicos
                const transformerCapacityKva = toOptionalNumber(editForm.transformerCapacityKva);
                if (transformerCapacityKva !== undefined) payload.transformerCapacityKva = String(transformerCapacityKva);
                const electricalDistance = toOptionalInteger(editForm.electricalDistance);
                if (electricalDistance !== undefined) payload.electricalDistance = electricalDistance;
                const availableAreaM2 = toOptionalNumber(editForm.availableAreaM2);
                if (availableAreaM2 !== undefined) payload.availableAreaM2 = String(availableAreaM2);
                const parkingSpots = toOptionalInteger(editForm.parkingSpots);
                if (parkingSpots !== undefined) payload.parkingSpots = parkingSpots;
                const estimatedDailyVehicles = toOptionalInteger(editForm.estimatedDailyVehicles);
                if (estimatedDailyVehicles !== undefined) payload.estimatedDailyVehicles = estimatedDailyVehicles;
                if (evPercent !== undefined) payload.estimatedEvPercent = evPercent;
                if (stratum !== undefined) payload.socioeconomicStratum = stratum;
                if (editForm.operatingHoursStart) payload.operatingHoursStart = editForm.operatingHoursStart;
                if (editForm.operatingHoursEnd) payload.operatingHoursEnd = editForm.operatingHoursEnd;
                if (editForm.hasElectricalPanel !== undefined) payload.hasElectricalPanel = editForm.hasElectricalPanel;
                if (editForm.hasSolarPanels !== undefined) payload.hasSolarPanels = editForm.hasSolarPanels;
                const solarCoveragePercent = toOptionalNumber(editForm.solarCoveragePercent);
                const solarEnergyCostPerKwh = toOptionalInteger(editForm.solarEnergyCostPerKwh);
                if (solarCoveragePercent !== undefined) payload.solarCoveragePercent = solarCoveragePercent;
                if (solarEnergyCostPerKwh !== undefined) payload.solarEnergyCostPerKwh = solarEnergyCostPerKwh;
                payload.solarProgramEnabled = Boolean(editForm.solarProgramEnabled);
                payload.solarProgramCurrentBillCop = toOptionalNumber(editForm.solarProgramCurrentBillCop);
                payload.solarProgramEnergyOffsetPercent = toOptionalNumber(editForm.solarProgramEnergyOffsetPercent);
                payload.solarProgramSavingsCoveragePercent = toOptionalNumber(editForm.solarProgramSavingsCoveragePercent);
                payload.solarProgramMonthlyFinancingPaymentCop = toOptionalNumber(editForm.solarProgramMonthlyFinancingPaymentCop);
                payload.solarProgramInitialMonthlySolarBillCop = toOptionalNumber(editForm.solarProgramInitialMonthlySolarBillCop);
                payload.solarProgramPostAgreementMonthlySolarBillCop = toOptionalNumber(editForm.solarProgramPostAgreementMonthlySolarBillCop);
                payload.solarProgramTotalEnergySavingsCop = toOptionalNumber(editForm.solarProgramTotalEnergySavingsCop);
                payload.solarProgramAnnualReturnPercent = toOptionalNumber(editForm.solarProgramAnnualReturnPercent);
                payload.solarProgramAgreementYears = toOptionalInteger(editForm.solarProgramAgreementYears);
                payload.solarProgramAnnualCpiPercent = toOptionalNumber(editForm.solarProgramAnnualCpiPercent);
                payload.solarProgramUsefulLifeYears = toOptionalInteger(editForm.solarProgramUsefulLifeYears);
                payload.solarSystemPowerKwp = toOptionalNumber(editForm.solarSystemPowerKwp);
                payload.solarAnnualGenerationKwh = toOptionalNumber(editForm.solarAnnualGenerationKwh);
                payload.solarSelfConsumptionPercent = toOptionalNumber(editForm.solarSelfConsumptionPercent);
	                payload.solarExportPercent = toOptionalNumber(editForm.solarExportPercent);
	                payload.solarGridTariffCopPerKwh = toOptionalInteger(editForm.solarGridTariffCopPerKwh);
	                if (editForm.chargingSolarOpenSolarProjectId !== undefined) payload.chargingSolarOpenSolarProjectId = String(editForm.chargingSolarOpenSolarProjectId).trim();
	                if (editForm.chargingSolarOpenSolarProjectTitle !== undefined) payload.chargingSolarOpenSolarProjectTitle = String(editForm.chargingSolarOpenSolarProjectTitle).trim();
	                const chargingSolarOpenSolarAnnualConsumptionKwh = toOptionalNumber(editForm.chargingSolarOpenSolarAnnualConsumptionKwh);
	                if (chargingSolarOpenSolarAnnualConsumptionKwh !== undefined) payload.chargingSolarOpenSolarAnnualConsumptionKwh = chargingSolarOpenSolarAnnualConsumptionKwh;
	                payload.chargingSolarSystemPowerKwp = toOptionalNumber(editForm.chargingSolarSystemPowerKwp);
	                payload.chargingSolarAnnualGenerationKwh = toOptionalNumber(editForm.chargingSolarAnnualGenerationKwh);
	                payload.chargingSolarSelfConsumptionPercent = toOptionalNumber(editForm.chargingSolarSelfConsumptionPercent);
	                payload.chargingSolarExportPercent = toOptionalNumber(editForm.chargingSolarExportPercent);
	                if (editForm.allySolarOpenSolarProjectId !== undefined) payload.allySolarOpenSolarProjectId = String(editForm.allySolarOpenSolarProjectId).trim();
	                if (editForm.allySolarOpenSolarProjectTitle !== undefined) payload.allySolarOpenSolarProjectTitle = String(editForm.allySolarOpenSolarProjectTitle).trim();
	                const allySolarOpenSolarAnnualConsumptionKwh = toOptionalNumber(editForm.allySolarOpenSolarAnnualConsumptionKwh);
	                if (allySolarOpenSolarAnnualConsumptionKwh !== undefined) payload.allySolarOpenSolarAnnualConsumptionKwh = allySolarOpenSolarAnnualConsumptionKwh;
	                if (editForm.hasInternet !== undefined) payload.hasInternet = editForm.hasInternet;
                if (editForm.is24Hours !== undefined) payload.is24Hours = editForm.is24Hours;
                if (editForm.electricalViability) payload.electricalViability = editForm.electricalViability;
                // Transformador nuevo
                if (editForm.requiresNewTransformer !== undefined) payload.requiresNewTransformer = editForm.requiresNewTransformer;
                const proposedTransformerKva = toOptionalNumber(editForm.proposedTransformerKva);
                if (proposedTransformerKva !== undefined) payload.proposedTransformerKva = proposedTransformerKva;
                // Comerciales
                const estimatedInvestmentCop = toOptionalNumber(editForm.estimatedInvestmentCop);
                const minimumInvestmentCop = toOptionalNumber(editForm.minimumInvestmentCop);
                const estimatedRoiPercent = toOptionalNumber(editForm.estimatedRoiPercent);
                const estimatedPaybackMonths = toOptionalInteger(editForm.estimatedPaybackMonths);
                const estimatedPowerKw = toOptionalInteger(editForm.estimatedPowerKw);
                const estimatedChargerCount = toOptionalInteger(editForm.estimatedChargerCount);
                if (estimatedInvestmentCop !== undefined) payload.estimatedInvestmentCop = estimatedInvestmentCop;
                if (minimumInvestmentCop !== undefined) payload.minimumInvestmentCop = minimumInvestmentCop;
                if (estimatedRoiPercent !== undefined) payload.estimatedRoiPercent = estimatedRoiPercent;
                if (estimatedPaybackMonths !== undefined) payload.estimatedPaybackMonths = estimatedPaybackMonths;
                if (estimatedPowerKw !== undefined) payload.estimatedPowerKw = estimatedPowerKw;
                if (estimatedChargerCount !== undefined) payload.estimatedChargerCount = estimatedChargerCount;
                // IA manual
                if (editForm.aiScore !== undefined) payload.aiScore = editForm.aiScore;
                // Construir aiAnalysis actualizado si se editaron campos de IA
                const hasAiEdits = editForm.aiSummary !== undefined || editForm.aiRecommendation !== undefined ||
                  editForm.aiEstimatedChargers !== undefined || editForm.aiEstimatedPowerKw !== undefined ||
                  editForm.aiInvestmentAppeal !== undefined;
                if (hasAiEdits) {
                  const existingAi = space.aiAnalysis ? JSON.parse(space.aiAnalysis) : {};
                  const updatedAi = {
                    ...existingAi,
                    ...(editForm.aiSummary !== undefined ? { summary: editForm.aiSummary } : {}),
                    ...(editForm.aiRecommendation !== undefined ? { recommendation: editForm.aiRecommendation } : {}),
                    ...(editForm.aiEstimatedChargers !== undefined ? { estimatedChargers: editForm.aiEstimatedChargers } : {}),
                    ...(editForm.aiEstimatedPowerKw !== undefined ? { estimatedPowerKw: editForm.aiEstimatedPowerKw } : {}),
                    ...(editForm.aiInvestmentAppeal !== undefined ? { investmentAppeal: editForm.aiInvestmentAppeal } : {}),
                    ...(editForm.aiScore !== undefined ? { score: editForm.aiScore } : {}),
                  };
                  payload.aiAnalysis = JSON.stringify(updatedAi);
                }
                if (editSolarOfferPdf) {
                  if (editSolarOfferPdf.size > 20 * 1024 * 1024) throw new Error("La oferta solar PDF no puede superar 20 MB.");
                  payload.solarOfferPdf = {
                    base64: await readFileAsBase64(editSolarOfferPdf),
                    fileName: editSolarOfferPdf.name,
                    contentType: "application/pdf",
                  };
                }
                await updateSpaceMutation.mutateAsync(payload as any);
                // Upload new photos if any
                if (editPhotos.length > 0) {
                  const photosData = await Promise.all(
                    editPhotos.map(async (photo) => {
                      const base64 = await compressImageFile(photo.file, 1200, 0.7);
                      return {
                        base64,
                        fileName: photo.file.name,
                        contentType: "image/jpeg",
                        photoType: photo.photoType as any,
                        isCover: Boolean(photo.isCover),
                        isConceptual: Boolean(photo.isConceptual),
                      };
                    })
                  );
                  try {
                    await addPhotosMutation.mutateAsync({ id, photos: photosData });
                  } catch (photoErr: any) {
                    console.error("Error uploading photos:", photoErr);
                    toast.error("Error al subir algunas fotos");
                  }
                }
                toast.success("Espacio actualizado correctamente");
                setShowEditDialog(false);
                editPhotos.forEach(p => URL.revokeObjectURL(p.preview));
                setEditPhotos([]);
                setEditSolarOfferPdf(null);
                refetch();
                onRefresh();
              } catch (err: any) {
                toast.error(humanizeSpaceError(err.message || "Error al actualizar", "actualizar"));
              }
            }} disabled={updateSpaceMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              {updateSpaceMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Pencil className="w-4 h-4 mr-1.5" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Eliminar espacio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              ¿Estás seguro de que deseas eliminar <strong className="text-white">"{space.spaceName}"</strong>?
            </p>
            <p className="text-xs text-gray-500">
              Esta acción eliminará permanentemente la postulación, sus fotos y todos los leads asociados. No se puede deshacer.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={async () => {
              try {
                await deleteSpaceMutation.mutateAsync({ id });
                toast.success("Espacio eliminado correctamente");
                setShowDeleteDialog(false);
                onClose();
                onRefresh();
              } catch (err: any) {
                toast.error(err.message || "Error al eliminar");
              }
            }} disabled={deleteSpaceMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
              {deleteSpaceMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Eliminar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publicar en Crowdfunding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-gray-400">
              Al publicar, este espacio aparecerá en el muro de crowdfunding para que inversionistas puedan financiar la instalación.
            </p>
            {space.spaceStatus === "letter_sent" && (
              <ManualFormalizationFields
                reason={manualFormalizationReason}
                evidence={manualFormalizationEvidence}
                onReasonChange={setManualFormalizationReason}
                onEvidenceChange={setManualFormalizationEvidence}
              />
            )}
            <div>
              <Label className="text-gray-300 mb-1.5 block text-sm">Meta de inversión (COP) *</Label>
              <Input
                type="number"
                value={publishAmount}
                onChange={e => setPublishAmount(e.target.value)}
                placeholder="Ej: 150000000"
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                {publishAmount ? formatCOP(parseInt(publishAmount) || 0) : "Ingrese el monto total"}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPublishDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Globe className="w-4 h-4 mr-1.5" />}
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL PROSPECTO DE INVERSIÓN ===== */}
      <Dialog open={showProspectoDialog} onOpenChange={setShowProspectoDialog}>
        <DialogContent className="!inset-0 !top-0 !left-0 !h-[100dvh] !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none overflow-y-auto overscroll-contain border-[#1f2937] bg-[#111827] p-3 text-white sm:!top-1/2 sm:!left-1/2 sm:!h-auto sm:!max-h-[90dvh] sm:!w-[calc(100vw-1rem)] sm:!max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:p-6">
          <DialogHeader className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-[#1f2937] bg-[#111827] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-14 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pr-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <FileDown className="w-5 h-5 text-emerald-400" />
              Generar Prospecto de Inversión
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-gray-400 text-sm leading-relaxed">
              El prospecto usa la tarifa, costo de energía y eficiencia vigentes de la plataforma. ROI y payback se calculan desde el waterfall; no se ingresan manualmente.
            </p>

            {/* Reparto */}
            <div className="bg-[#1f2937] rounded-lg p-4 space-y-3">
              <h4 className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Modelo de Reparto de Ingresos
              </h4>
              <p className="text-gray-500 text-xs leading-relaxed">Ingreso bruto − energía − gastos fijos = margen bruto. El aliado participa sobre ese margen; Inversor y EVGreen se reparten exclusivamente el margen neto resultante.</p>
              <p className="rounded-md border border-emerald-400/20 bg-emerald-500/5 px-2.5 py-2 text-xs leading-relaxed text-emerald-100">Preconfiguración: <strong>{revenueDistribution.investorSharePercent}% inversionista / {revenueDistribution.evgreenSharePercent}% EVGreen</strong> sobre margen neto ({revenueDistribution.basis === "EDS" ? "EDS" : "otros negocios"}). Puedes ajustarla para este acuerdo; inversionista y EVGreen deben sumar 100%. La comisión del dueño del sitio se mantiene separada sobre el margen bruto.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Aliado (% margen bruto)</Label>
                  <Input
                    type="number" min={0} max={50} step={1} inputMode="numeric"
                    value={prospectoConfig.allySharePercent ?? ""}
                    onChange={e => {
                      const v = parseOptionalBoundedPercentageInput(e.target.value, 50);
                      setProspectoConfig(c => ({ ...c, allySharePercent: v }));
                    }}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                  <p className="mt-1 text-[11px] leading-snug text-gray-500">Use 0% cuando el dueño del espacio sea el mismo inversionista y no aplique una comisión independiente.</p>
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Inversor (% neto)</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={prospectoConfig.investorSharePercent ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, investorSharePercent: parseOptionalBoundedPercentageInput(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">EVGreen (% neto)</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={prospectoConfig.platformSharePercent ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, platformSharePercent: parseOptionalBoundedPercentageInput(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                </div>
              </div>
              {!prospectoSharesReady && <p className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-xs text-amber-100">Completa Aliado, Inversor y EVGreen con valores entre 0% y 100%. Inversor y EVGreen deben sumar exactamente 100% antes de generar el prospecto.</p>}
              {/* Barra visual del reparto neto: el aliado se descuenta antes. */}
              {(() => {
                const allyPct = prospectoConfig.allySharePercent ?? 0;
                const invNetPct = prospectoConfig.investorSharePercent ?? 0;
                const platformNetPct = prospectoConfig.platformSharePercent ?? 0;
                return (
                  <>
                    <div className="w-full h-3 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${invNetPct}%` }} />
                      <div className="bg-gray-500 flex-1" />
                    </div>
                    <p className="text-gray-500 text-xs text-center leading-relaxed">
                      <span className="text-blue-400">Aliado {allyPct}% del margen bruto</span><span className="hidden sm:inline"> · </span><br className="sm:hidden" /> <span className="text-emerald-400">Inversor {invNetPct}%</span><span className="hidden sm:inline"> · </span><br className="sm:hidden" /> <span className="text-gray-400">EVGreen {platformNetPct}%</span> <span className="text-gray-600">(sobre margen neto)</span>
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Proyección financiera */}
            <div className="bg-[#1f2937] rounded-lg p-4 space-y-3">
              <h4 className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Parámetros de Proyección
              </h4>
              <p className="text-xs text-gray-400 -mt-1 leading-relaxed">Escenarios de horas equivalentes de entrega a potencia proyectada: Pesimista 4 h/día, Realista 6 h/día y Optimista 9 h/día.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Potencia instalada (kW)</Label>
                  <Input
                    type="number" min={1}
                    placeholder="Auto (del espacio)"
                    value={prospectoConfig.installedPowerKw ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, installedPowerKw: toOptionalNumber(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Tarifa (COP/kWh)</Label>
                  <Input
                    type="number" min={500}
                    value={prospectoConfig.tarifaKwhCop ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, tarifaKwhCop: toOptionalNumber(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Costo energía (COP/kWh)</Label>
                  <Input
                    type="number" min={0}
                    value={prospectoConfig.energyCostPerKwhCop ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, energyCostPerKwhCop: toOptionalNumber(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Gastos fijos mensuales (COP)</Label>
                  <Input
                    type="number" min={0}
                    value={prospectoConfig.fixedMonthlyExpensesCop ?? ""}
                    onChange={e => setProspectoConfig(c => ({ ...c, fixedMonthlyExpensesCop: toOptionalNumber(e.target.value) }))}
                    className="bg-[#111827] border-[#374151] text-white h-8 text-sm"
                  />
                  <p className="mt-1 text-[11px] leading-snug text-gray-500">Incluya seguros, fiducia u otros costos recurrentes cuando apliquen.</p>
                </div>
              </div>
            </div>

            {prospectoRequiresGridUpgrade && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 space-y-3">
                <div className="flex gap-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">La potencia proyectada requiere ampliación eléctrica</p>
                    <p className="text-xs leading-relaxed text-amber-100/80 mt-1">
                      {requestedProspectoPowerKw} kW DC proyectados requieren un transformador dedicado de al menos {dcInfrastructure.requiredTransformerKva} kVA con factor de potencia de {dcInfrastructure.transformerPowerFactor}. {transformerCapacityKva > 0 ? `El transformador declarado es de ${transformerCapacityKva} kVA y no se presume capacidad libre.` : "No hay transformador declarado."} El PDF solo mostrará ROI y payback como escenario condicionado si el CAPEX total incorpora la ampliación.
                    </p>
                    {!dcInfrastructure.meetsDcMinimum && <p className="mt-2 text-xs font-medium text-amber-200">EVGreen solo proyecta cargadores rápidos DC desde 120 kW. Ajusta la potencia para continuar.</p>}
                  </div>
                </div>
                <label className="flex items-start gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prospectoConfig.capexIncludesGridUpgrade}
                    onChange={e => setProspectoConfig(c => ({ ...c, capexIncludesGridUpgrade: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  <span>Confirmo que la inversión total contempla la ampliación de red requerida o que existe soporte técnico y presupuestal vigente.</span>
                </label>
                <Textarea
                  value={prospectoConfig.technicalConditionNote}
                  onChange={e => setProspectoConfig(c => ({ ...c, technicalConditionNote: e.target.value }))}
                  placeholder="Soporte técnico, alcance de la ampliación y/o referencia del presupuesto. Mínimo 10 caracteres."
                  className="min-h-[84px] bg-[#111827] border-amber-400/30 text-white placeholder:text-gray-600 text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter className="sticky bottom-0 z-10 -mx-3 -mb-3 border-t border-[#1f2937] bg-[#111827] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button variant="outline" onClick={() => setShowProspectoDialog(false)} className="w-full border-[#374151] text-gray-300 sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!prospectoSharesReady || prospectoConfig.allySharePercent === undefined || prospectoConfig.investorSharePercent === undefined || prospectoConfig.platformSharePercent === undefined) {
                  toast.error("Completa el reparto: Inversor y EVGreen deben sumar exactamente 100% del margen neto.");
                  return;
                }
                try {
                  const result = await generateProspectoMutation.mutateAsync({
                    submissionId: id,
                    allySharePercent: prospectoConfig.allySharePercent,
                    investorSharePercent: prospectoConfig.investorSharePercent,
                    platformSharePercent: prospectoConfig.platformSharePercent,
                    installedPowerKw: prospectoConfig.installedPowerKw,
                    tarifaKwhCop: prospectoConfig.tarifaKwhCop,
                    energyCostPerKwhCop: prospectoConfig.energyCostPerKwhCop,
                    fixedMonthlyExpensesCop: prospectoConfig.fixedMonthlyExpensesCop ?? 0,
                    capexIncludesGridUpgrade: prospectoConfig.capexIncludesGridUpgrade,
                    technicalConditionNote: prospectoConfig.technicalConditionNote.trim() || undefined,
                  });
                  if (result.pdfUrl) {
                    // Usar elemento <a> para compatibilidad con Android WebView
                    const link = document.createElement("a");
                    link.href = result.pdfUrl;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.download = `prospecto-${space.code}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success("✅ Prospecto generado exitosamente");
                    setShowProspectoDialog(false);
                  }
                } catch (err: any) {
                  toast.error(err.message || "Error al generar el prospecto");
                }
              }}
              disabled={generateProspectoMutation.isPending || !prospectoTechnicalReady || !prospectoSharesReady}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {generateProspectoMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando PDF...</>
              ) : (
                <><FileDown className="w-4 h-4 mr-2" /> Generar y Descargar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-3 sm:p-4">
      <h4 className="text-xs sm:text-sm font-medium text-white flex items-center gap-2 mb-2 sm:mb-3">
        {icon}
        {title}
      </h4>
      <div className="space-y-1.5 sm:space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const isLong = value.length > 50;
  if (isLong) {
    return (
      <div className="text-xs sm:text-sm">
        <span className="text-gray-500 block mb-0.5">{label}</span>
        <span className="text-gray-300 break-words leading-relaxed">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between text-xs sm:text-sm gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-300 text-right break-words min-w-0">{value}</span>
    </div>
  );
}
