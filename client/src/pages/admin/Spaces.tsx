/**
 * EVGreen - Panel de Administración de Espacios Postulados
 * Gestión completa: revisión, evaluación técnica, scoring IA,
 * envío de carta de intención y publicación en crowdfunding
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-400" />
            Espacios Postulados
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gestión de postulaciones de espacios para cargadores EV
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="border-[#374151] text-gray-300">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Actualizar
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => { setStatusFilter("all"); setOffset(0); }}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
          placeholder="Buscar por código, nombre, postulante o ciudad..."
          className="pl-10 bg-[#111827] border-[#374151] text-white placeholder:text-gray-600"
        />
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2937]">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Código</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Espacio</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Postulante</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Ciudad</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Score IA</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
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
                        <span className="text-white font-medium">{sub.spaceName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-gray-300">{sub.submitterName}</span>
                          <p className="text-xs text-gray-500">{sub.submitterEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{sub.city}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{SPACE_TYPE_LABELS[sub.spaceType] || sub.spaceType}</td>
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
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
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
              Mostrando {offset + 1}-{Math.min(offset + limit, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-[#374151] text-gray-300 h-7"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="border-[#374151] text-gray-300 h-7"
              >
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
// SPACE DETAIL DIALOG
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

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishAmount, setPublishAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  if (isLoading || !space) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-4xl">
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
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-emerald-400">{space.code}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusInfo.label}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Action buttons based on status */}
            <div className="flex items-center gap-2 flex-wrap">
              {space.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => handleStatusUpdate("under_review")} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Eye className="w-4 h-4 mr-1.5" /> Iniciar revisión
                  </Button>
                </>
              )}
              {(space.status === "pending" || space.status === "under_review") && (
                <>
                  <Button size="sm" onClick={handleGenerateAI} disabled={generateAIMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                    {generateAIMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Brain className="w-4 h-4 mr-1.5" />}
                    Scoring IA
                  </Button>
                  <Button size="sm" onClick={() => handleStatusUpdate("approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRejectDialog(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <XCircle className="w-4 h-4 mr-1.5" /> Rechazar
                  </Button>
                </>
              )}
              {space.status === "approved" && (
                <Button size="sm" onClick={handleSendLetter} disabled={sendLetterMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {sendLetterMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Enviar carta de intención
                </Button>
              )}
              {space.status === "letter_accepted" && (
                <Button size="sm" onClick={() => setShowPublishDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Globe className="w-4 h-4 mr-1.5" /> Publicar en Crowdfunding
                </Button>
              )}
              {!["pending", "under_review"].includes(space.status) && (
                <Button size="sm" variant="outline" onClick={handleGenerateAI} disabled={generateAIMutation.isPending} className="border-[#374151] text-gray-300">
                  {generateAIMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Brain className="w-4 h-4 mr-1.5" />}
                  Re-evaluar IA
                </Button>
              )}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Submitter & Space info */}
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
                  {space.department && <DetailRow label="Departamento" value={space.department} />}
                  {space.latitude && space.longitude && (
                    <DetailRow label="Coordenadas" value={`${space.latitude}, ${space.longitude}`} />
                  )}
                </DetailSection>

                <DetailSection title="Técnico" icon={<Zap className="w-4 h-4 text-emerald-400" />}>
                  {space.availableAreaM2 && <DetailRow label="Área" value={`${space.availableAreaM2} m²`} />}
                  {space.parkingSpots && <DetailRow label="Parqueos" value={space.parkingSpots.toString()} />}
                  {space.transformerCapacityKva && <DetailRow label="Transformador" value={`${space.transformerCapacityKva} kVA`} />}
                  <DetailRow label="Tablero eléctrico" value={space.hasElectricalPanel ? "Sí" : "No"} />
                  {space.electricalDistance && <DetailRow label="Distancia tablero" value={`${space.electricalDistance} m`} />}
                  <DetailRow label="Internet" value={space.hasInternet ? "Sí" : "No"} />
                  <DetailRow label="Horario" value={space.is24Hours ? "24 horas" : `${space.operatingHoursStart} - ${space.operatingHoursEnd}`} />
                </DetailSection>
              </div>

              {/* Right: Context, AI, Photos */}
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
                    <p className="text-sm text-gray-300 mb-3">{aiAnalysis.summary}</p>
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
                    <DetailRow label="Recomendación" value={aiAnalysis.recommendation || "—"} />
                    <DetailRow label="Cargadores sugeridos" value={aiAnalysis.estimatedChargers?.toString() || "—"} />
                    <DetailRow label="Potencia sugerida" value={aiAnalysis.estimatedPowerKw ? `${aiAnalysis.estimatedPowerKw} kW` : "—"} />
                    <DetailRow label="Atractivo inversión" value={aiAnalysis.investmentAppeal || "—"} />
                    <DetailRow label="Viabilidad eléctrica" value={aiAnalysis.electricalViability || "—"} />
                  </DetailSection>
                )}

                {/* Photos */}
                {space.photos && space.photos.length > 0 && (
                  <DetailSection title={`Fotos (${space.photos.length})`} icon={<Camera className="w-4 h-4 text-emerald-400" />}>
                    <div className="grid grid-cols-2 gap-2">
                      {space.photos.map((photo: any, i: number) => (
                        <a key={i} href={photo.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={photo.photoUrl}
                            alt={photo.caption || `Foto ${i + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-[#374151] hover:border-emerald-500/30 transition-colors"
                          />
                          {photo.caption && (
                            <p className="text-xs text-gray-500 mt-1 truncate">{photo.caption}</p>
                          )}
                        </a>
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
                </DetailSection>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar postulación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 mb-1.5 block">Motivo del rechazo</Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explique el motivo del rechazo..."
                rows={4}
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="border-[#374151] text-gray-300">
              Cancelar
            </Button>
            <Button onClick={handleReject} disabled={updateStatusMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <XCircle className="w-4 h-4 mr-1.5" />}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="bg-[#111827] border-[#1f2937] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Publicar en Crowdfunding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Al publicar, este espacio aparecerá en el muro de crowdfunding para que inversionistas puedan financiar la instalación del cargador.
            </p>
            <div>
              <Label className="text-gray-300 mb-1.5 block">Meta de inversión (COP) *</Label>
              <Input
                type="number"
                value={publishAmount}
                onChange={e => setPublishAmount(e.target.value)}
                placeholder="Ej: 150000000"
                className="bg-[#0a0f1a] border-[#374151] text-white placeholder:text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                {publishAmount ? formatCOP(parseInt(publishAmount) || 0) : "Ingrese el monto total de inversión"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)} className="border-[#374151] text-gray-300">
              Cancelar
            </Button>
            <Button onClick={handlePublish} disabled={publishMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
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
    <div className="bg-[#0a0f1a] border border-[#374151] rounded-xl p-4">
      <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-300 text-right">{value}</span>
    </div>
  );
}
