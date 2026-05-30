/**
 * EVGreen - Panel de Administración de Espacios Postulados
 * Gestión completa: revisión, evaluación técnica, scoring IA,
 * envío de carta de intención y publicación en crowdfunding
 * 
 * RESPONSIVE: Optimizado para desktop, tablet y móvil
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MapPin, Search, Filter, Eye, Zap, Star, Send, Globe, Brain,
  CheckCircle2, XCircle, Clock, FileText, Loader2, ChevronLeft,
  ChevronRight, Building2, Phone, Mail, Camera, BarChart3,
  TrendingUp, DollarSign, ArrowUpRight, ExternalLink, RefreshCw,
  ChevronDown, X, Pencil, Trash2, AlertTriangle, Users, Download,
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminSpaces() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const { data, isLoading, refetch } = trpc.spaces.admin.list.useQuery({
    status: statusFilter,
    search: search || undefined,
    limit,
    offset,
  });

  const submissions = data?.submissions || [];
  const total = data?.total || 0;
  const statusCounts = data?.statusCounts || {};

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
        <Button onClick={() => refetch()} variant="outline" size="sm" className="border-[#374151] text-gray-300 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Actualizar
        </Button>
      </div>

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
          placeholder="Buscar por código, nombre, ciudad..."
          className="pl-10 bg-[#111827] border-[#374151] text-white placeholder:text-gray-600 text-sm"
        />
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2937]">
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
                  <td colSpan={9} className="text-center py-12">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">
                    No se encontraron postulaciones
                  </td>
                </tr>
              ) : (
                submissions.map((sub: any) => {
                  const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.pending;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={sub.id} className="border-b border-[#1f2937]/50 hover:bg-[#1f2937]/30 transition-colors">
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
            const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedId(sub.id)}
                className="w-full text-left bg-[#111827] border border-[#1f2937] rounded-xl p-4 hover:border-emerald-500/30 transition-colors active:bg-[#1f2937]/50"
              >
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-gray-600">{formatDateShort(sub.createdAt)}</p>
                  {sub.estimatedInvestmentCop && (
                    <span className="text-[11px] text-emerald-400 font-medium">{formatCOP(sub.estimatedInvestmentCop)}</span>
                  )}
                </div>
              </button>
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
  const { data: space, isLoading, refetch } = trpc.spaces.admin.getById.useQuery({ id });
  const updateStatusMutation = trpc.spaces.admin.updateStatus.useMutation();
  const sendLetterMutation = trpc.spaces.admin.sendLetter.useMutation();
  const generateAIMutation = trpc.spaces.admin.generateAIScore.useMutation();
  const publishMutation = trpc.spaces.admin.publishToCrowdfunding.useMutation();
  const updateSpaceMutation = trpc.spaces.admin.updateSpace.useMutation();
  const deleteSpaceMutation = trpc.spaces.admin.deleteSpace.useMutation();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishAmount, setPublishAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

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

  const statusInfo = STATUS_LABELS[space.status] || STATUS_LABELS.pending;
  const StatusIcon = statusInfo.icon;
  const aiAnalysis = space.aiAnalysis ? JSON.parse(space.aiAnalysis) : null;

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
      await sendLetterMutation.mutateAsync({ id });
      toast.success("Carta de intención enviada por email");
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar carta");
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
    try {
      await publishMutation.mutateAsync({ id, targetAmount: amount });
      toast.success("Espacio publicado en el muro de crowdfunding");
      setShowPublishDialog(false);
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al publicar");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          {/* Header */}
          <DialogHeader className="pb-2">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-mono text-emerald-400 text-base sm:text-lg">{space.code}</span>
              <span className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 mt-2">
            {/* Action buttons - scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {space.status === "pending" && (
                <Button size="sm" onClick={() => handleStatusUpdate("under_review")} className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0 text-xs">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Revisar
                </Button>
              )}
              {(space.status === "pending" || space.status === "under_review") && (
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
              {space.status === "approved" && (
                <Button size="sm" onClick={handleSendLetter} disabled={sendLetterMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0 text-xs">
                  {sendLetterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  Enviar carta
                </Button>
              )}
              {space.status === "letter_accepted" && (
                <Button size="sm" onClick={() => setShowPublishDialog(true)} className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0 text-xs">
                  <Globe className="w-3.5 h-3.5 mr-1" /> Publicar
                </Button>
              )}
              {!["pending", "under_review"].includes(space.status) && (
                <Button size="sm" variant="outline" onClick={handleGenerateAI} disabled={generateAIMutation.isPending} className="border-[#374151] text-gray-300 flex-shrink-0 text-xs">
                  {generateAIMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />}
                  Re-evaluar IA
                </Button>
              )}
              {/* Edit & Delete */}
              <Button size="sm" variant="outline" onClick={() => { setEditForm({ spaceName: space.spaceName, address: space.address, city: space.city, department: space.department || "", submitterName: space.submitterName, submitterEmail: space.submitterEmail, submitterPhone: space.submitterPhone || "", estimatedInvestmentCop: space.estimatedInvestmentCop || "", estimatedPowerKw: space.estimatedPowerKw || "", estimatedChargerCount: space.estimatedChargerCount || "", additionalNotes: space.additionalNotes || "", investmentType: (space as any).investmentType || "individual" }); setShowEditDialog(true); }} className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-shrink-0 text-xs">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowDeleteDialog(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0 text-xs">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
              </Button>
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
                  {space.electricalDistance && <DetailRow label="Dist. tablero" value={`${space.electricalDistance} m`} />}
                  <DetailRow label="Internet" value={space.hasInternet ? "Sí" : "No"} />
                  <DetailRow label="Horario" value={space.is24Hours ? "24h" : `${space.operatingHoursStart || "—"} - ${space.operatingHoursEnd || "—"}`} />
                </DetailSection>
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
                  </DetailSection>
                )}

                {/* Photos */}
                {space.photos && space.photos.length > 0 && (
                  <DetailSection title={`Fotos (${space.photos.length})`} icon={<Camera className="w-4 h-4 text-emerald-400" />}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {space.photos.map((photo: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => setExpandedPhoto(photo.photoUrl)}
                          className="block relative group"
                        >
                          <img
                            src={photo.photoUrl}
                            alt={photo.caption || `Foto ${i + 1}`}
                            className="w-full h-16 sm:h-20 object-cover rounded-lg border border-[#374151] group-hover:border-emerald-500/30 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </DetailSection>
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

      {/* Photo Lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <button
            onClick={() => setExpandedPhoto(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={expandedPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-400" /> Editar espacio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Nombre del espacio</Label>
              <Input value={editForm.spaceName || ""} onChange={e => setEditForm(p => ({ ...p, spaceName: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Dirección</Label>
                <Input value={editForm.address || ""} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Ciudad</Label>
                <Input value={editForm.city || ""} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Departamento</Label>
                <Input value={editForm.department || ""} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Postulante</Label>
                <Input value={editForm.submitterName || ""} onChange={e => setEditForm(p => ({ ...p, submitterName: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Email postulante</Label>
                <Input value={editForm.submitterEmail || ""} onChange={e => setEditForm(p => ({ ...p, submitterEmail: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Teléfono</Label>
                <Input value={editForm.submitterPhone || ""} onChange={e => setEditForm(p => ({ ...p, submitterPhone: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Inversión estimada (COP)</Label>
                <Input type="number" value={editForm.estimatedInvestmentCop || ""} onChange={e => setEditForm(p => ({ ...p, estimatedInvestmentCop: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Potencia (kW)</Label>
                <Input type="number" value={editForm.estimatedPowerKw || ""} onChange={e => setEditForm(p => ({ ...p, estimatedPowerKw: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Cargadores</Label>
                <Input type="number" value={editForm.estimatedChargerCount || ""} onChange={e => setEditForm(p => ({ ...p, estimatedChargerCount: e.target.value }))} className="bg-[#0a0f1a] border-[#374151] text-white text-sm" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Tipo de inversión</Label>
                <Select value={editForm.investmentType || "individual"} onValueChange={v => setEditForm(p => ({ ...p, investmentType: v }))}>
                  <SelectTrigger className="bg-[#0a0f1a] border-[#374151] text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f2937] border-[#374151]">
                    <SelectItem value="individual" className="text-white">Individual</SelectItem>
                    <SelectItem value="colectiva" className="text-white">Colectiva (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Notas adicionales</Label>
              <Textarea value={editForm.additionalNotes || ""} onChange={e => setEditForm(p => ({ ...p, additionalNotes: e.target.value }))} rows={3} className="bg-[#0a0f1a] border-[#374151] text-white text-sm resize-none" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-[#374151] text-gray-300 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={async () => {
              try {
                const payload: Record<string, any> = { id };
                if (editForm.spaceName) payload.spaceName = editForm.spaceName;
                if (editForm.address) payload.address = editForm.address;
                if (editForm.city) payload.city = editForm.city;
                if (editForm.department) payload.department = editForm.department;
                if (editForm.submitterName) payload.submitterName = editForm.submitterName;
                if (editForm.submitterEmail) payload.submitterEmail = editForm.submitterEmail;
                if (editForm.submitterPhone) payload.submitterPhone = editForm.submitterPhone;
                if (editForm.estimatedInvestmentCop) payload.estimatedInvestmentCop = parseInt(editForm.estimatedInvestmentCop);
                if (editForm.estimatedPowerKw) payload.estimatedPowerKw = parseInt(editForm.estimatedPowerKw);
                if (editForm.estimatedChargerCount) payload.estimatedChargerCount = parseInt(editForm.estimatedChargerCount);
                if (editForm.additionalNotes !== undefined) payload.additionalNotes = editForm.additionalNotes;
                if (editForm.investmentType) payload.investmentType = editForm.investmentType;
                await updateSpaceMutation.mutateAsync(payload as any);
                toast.success("Espacio actualizado correctamente");
                setShowEditDialog(false);
                refetch();
                onRefresh();
              } catch (err: any) {
                toast.error(err.message || "Error al actualizar");
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
