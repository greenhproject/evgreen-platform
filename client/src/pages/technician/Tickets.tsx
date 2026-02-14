import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, Clock, CheckCircle, Wrench, MapPin, User, Calendar,
  Play, XCircle, Loader2, FileText, DollarSign, Package, Timer,
  ChevronRight, Camera, Image, Trash2, X, Upload, Eye,
} from "lucide-react";
import { toast } from "sonner";

interface PhotoAttachment {
  url: string;
  fileKey: string;
  type: "before" | "after" | "evidence";
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
}

export default function TechnicianTickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolution, setResolution] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoType, setPendingPhotoType] = useState<"before" | "after" | "evidence">("evidence");
  const [newTask, setNewTask] = useState({
    title: "", description: "", stationId: "", priority: "MEDIUM" as string, category: "HARDWARE" as string,
  });

  const { data: tickets, isLoading, refetch } = trpc.maintenance.myTickets.useQuery();
  const { data: stations } = trpc.stations.listAll.useQuery();
  const { data: ticketDetail, isLoading: isLoadingDetail, refetch: refetchDetail } = trpc.maintenance.getById.useQuery(
    { id: selectedTicketId! },
    { enabled: !!selectedTicketId && showDetailDialog }
  );

  const createMutation = trpc.maintenance.create.useMutation({
    onSuccess: () => {
      toast.success("Ticket creado exitosamente");
      setIsCreateOpen(false);
      setNewTask({ title: "", description: "", stationId: "", priority: "MEDIUM", category: "HARDWARE" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.maintenance.update.useMutation({
    onSuccess: () => {
      toast.success("Ticket actualizado");
      refetch();
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadPhotoMutation = trpc.maintenance.uploadPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto subida exitosamente");
      refetchDetail();
      setUploadingPhoto(false);
    },
    onError: (err) => {
      toast.error(err.message || "Error al subir la foto");
      setUploadingPhoto(false);
    },
  });

  const deletePhotoMutation = trpc.maintenance.deletePhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto eliminada");
      refetchDetail();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newTask.title.trim()) return toast.error("El título es requerido");
    if (!newTask.stationId) return toast.error("Selecciona una estación");
    createMutation.mutate({
      title: newTask.title,
      description: newTask.description || undefined,
      stationId: parseInt(newTask.stationId),
      priority: newTask.priority as any,
      category: newTask.category,
    });
  };

  const handleStartTicket = (id: number) => {
    updateMutation.mutate({ id, data: { status: "IN_PROGRESS" } });
  };

  const handleResolveTicket = () => {
    if (!selectedTicketId) return;
    if (!resolution.trim()) return toast.error("Debes agregar una descripción de la resolución");
    updateMutation.mutate(
      {
        id: selectedTicketId,
        data: {
          status: "COMPLETED",
          resolution,
          partsUsed: partsUsed ? partsUsed.split(",").map(p => p.trim()).filter(Boolean) : undefined,
          laborCost: laborCost || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowResolveDialog(false);
          setShowDetailDialog(false);
          setResolution("");
          setPartsUsed("");
          setLaborCost("");
          refetch();
        },
      }
    );
  };

  const handleCancelTicket = (id: number) => {
    updateMutation.mutate(
      { id, data: { status: "CANCELLED" } },
      { onSuccess: () => { setShowDetailDialog(false); refetch(); } }
    );
  };

  const handlePhotoUpload = (type: "before" | "after" | "evidence") => {
    setPendingPhotoType(type);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicketId) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Solo se permiten imágenes JPEG, PNG o WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede superar 10MB");
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPhotoMutation.mutate({
        ticketId: selectedTicketId,
        fileName: file.name,
        fileBase64: base64,
        contentType: file.type,
        photoType: pendingPhotoType,
      });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleDeletePhoto = (fileKey: string) => {
    if (!selectedTicketId) return;
    deletePhotoMutation.mutate({ ticketId: selectedTicketId, fileKey });
  };

  const openDetail = (ticketId: number) => {
    setSelectedTicketId(ticketId);
    setShowDetailDialog(true);
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      CRITICAL: { bg: "bg-red-500/20 text-red-400 border-red-500/30", label: "Crítica" },
      HIGH: { bg: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "Alta" },
      MEDIUM: { bg: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Media" },
      LOW: { bg: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Baja" },
    };
    const style = styles[priority] || styles.MEDIUM;
    return <Badge variant="outline" className={style.bg}>{style.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: any; label: string }> = {
      PENDING: { bg: "bg-yellow-500/20 text-yellow-400", icon: Clock, label: "Pendiente" },
      IN_PROGRESS: { bg: "bg-blue-500/20 text-blue-400", icon: Timer, label: "En progreso" },
      COMPLETED: { bg: "bg-green-500/20 text-green-400", icon: CheckCircle, label: "Completado" },
      CANCELLED: { bg: "bg-red-500/20 text-red-400", icon: XCircle, label: "Cancelado" },
    };
    const style = styles[status] || styles.PENDING;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      HARDWARE: "Hardware", SOFTWARE: "Software", CONNECTIVITY: "Conectividad", VANDALISM: "Vandalismo",
    };
    return labels[category] || category;
  };

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      before: { label: "Antes", color: "bg-orange-500/20 text-orange-400" },
      after: { label: "Después", color: "bg-green-500/20 text-green-400" },
      evidence: { label: "Evidencia", color: "bg-blue-500/20 text-blue-400" },
    };
    return labels[type] || labels.evidence;
  };

  const filteredTickets = (tickets || []).filter((ticket: any) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ticket.title?.toLowerCase().includes(q) || String(ticket.stationId).includes(q);
    }
    return true;
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("es-CO", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const getTimeline = (ticket: any) => {
    const events = [];
    events.push({ label: "Ticket creado", date: ticket.createdAt, icon: FileText, color: "text-gray-400", bgColor: "bg-gray-500/20" });
    if (ticket.startedAt) {
      events.push({ label: "Trabajo iniciado", date: ticket.startedAt, icon: Play, color: "text-blue-400", bgColor: "bg-blue-500/20" });
    }
    if (ticket.completedAt) {
      events.push({ label: "Ticket completado", date: ticket.completedAt, icon: CheckCircle, color: "text-green-400", bgColor: "bg-green-500/20" });
    }
    if (ticket.status === "CANCELLED") {
      events.push({ label: "Ticket cancelado", date: ticket.updatedAt, icon: XCircle, color: "text-red-400", bgColor: "bg-red-500/20" });
    }
    return events;
  };

  const attachments: PhotoAttachment[] = (ticketDetail?.attachments as any[]) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileSelected} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tickets de Mantenimiento</h1>
          <p className="text-muted-foreground">Gestiona los tickets asignados</p>
        </div>
        <Button className="gradient-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo ticket
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por título o estación..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="COMPLETED">Completados</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Estación</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Creado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Cargando tickets...
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No hay tickets {statusFilter !== "all" ? "con este filtro" : "asignados"}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket: any) => (
                <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(ticket.id)}>
                  <TableCell className="font-mono text-sm">#{ticket.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{ticket.title}</div>
                    {ticket.category && <span className="text-xs text-muted-foreground">{getCategoryLabel(ticket.category)}</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">{ticket.station?.name || `Est. #${ticket.stationId}`}</span>
                  </TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(ticket.id); }}>
                      Ver detalles <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog: Crear Ticket */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear ticket de mantenimiento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <Input placeholder="Descripción breve del problema" value={newTask.title} onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estación *</label>
              <Select value={newTask.stationId} onValueChange={(v) => setNewTask(prev => ({ ...prev, stationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estación" /></SelectTrigger>
                <SelectContent>
                  {stations?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} - {s.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select value={newTask.category} onValueChange={(v) => setNewTask(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HARDWARE">Hardware</SelectItem>
                    <SelectItem value="SOFTWARE">Software</SelectItem>
                    <SelectItem value="CONNECTIVITY">Conectividad</SelectItem>
                    <SelectItem value="VANDALISM">Vandalismo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Textarea placeholder="Detalles del problema..." value={newTask.description} onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle del Ticket */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setSelectedTicketId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {isLoadingDetail ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-muted-foreground">Cargando detalles...</p>
            </div>
          ) : ticketDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-xl">Ticket #{ticketDetail.id}</DialogTitle>
                  {getStatusBadge(ticketDetail.status)}
                  {getPriorityBadge(ticketDetail.priority || "MEDIUM")}
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Título y descripción */}
                <div>
                  <h3 className="text-lg font-semibold mb-1">{ticketDetail.title}</h3>
                  {ticketDetail.description && <p className="text-muted-foreground">{ticketDetail.description}</p>}
                </div>

                <Separator />

                {/* Info del ticket */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Estación</p>
                      <p className="text-sm text-muted-foreground">{ticketDetail.stationName || `Estación #${ticketDetail.stationId}`}</p>
                      {ticketDetail.stationCity && <p className="text-xs text-muted-foreground">{ticketDetail.stationAddress}, {ticketDetail.stationCity}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Técnico asignado</p>
                      <p className="text-sm text-muted-foreground">{ticketDetail.technicianName || "Sin asignar"}</p>
                      {ticketDetail.technicianEmail && <p className="text-xs text-muted-foreground">{ticketDetail.technicianEmail}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Wrench className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Categoría</p>
                      <p className="text-sm text-muted-foreground">{ticketDetail.category ? getCategoryLabel(ticketDetail.category) : "Sin categoría"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Fecha programada</p>
                      <p className="text-sm text-muted-foreground">{ticketDetail.scheduledDate ? formatDate(ticketDetail.scheduledDate) : "Sin programar"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Galería de Fotos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Fotos ({attachments.length})
                    </h4>
                    {ticketDetail.status !== "COMPLETED" && ticketDetail.status !== "CANCELLED" && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePhotoUpload("before")} disabled={uploadingPhoto}>
                          <Upload className="w-3 h-3 mr-1" /> Antes
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePhotoUpload("after")} disabled={uploadingPhoto}>
                          <Upload className="w-3 h-3 mr-1" /> Después
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePhotoUpload("evidence")} disabled={uploadingPhoto}>
                          <Upload className="w-3 h-3 mr-1" /> Evidencia
                        </Button>
                      </div>
                    )}
                  </div>

                  {uploadingPhoto && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Subiendo foto...
                    </div>
                  )}

                  {attachments.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {attachments.map((photo, idx) => {
                        const typeInfo = getPhotoTypeLabel(photo.type);
                        return (
                          <div key={idx} className="relative group rounded-lg overflow-hidden border border-border">
                            <img
                              src={photo.url}
                              alt={photo.fileName}
                              className="w-full h-32 object-cover cursor-pointer"
                              onClick={() => setLightboxUrl(photo.url)}
                            />
                            <div className="absolute top-2 left-2">
                              <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
                            </div>
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setLightboxUrl(photo.url)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {ticketDetail.status !== "COMPLETED" && ticketDetail.status !== "CANCELLED" && (
                                <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/20" onClick={() => handleDeletePhoto(photo.fileKey)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <div className="p-2 text-xs text-muted-foreground truncate">
                              {photo.uploadedBy} · {new Date(photo.uploadedAt).toLocaleDateString("es-CO")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                      <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay fotos adjuntas</p>
                      {ticketDetail.status !== "COMPLETED" && ticketDetail.status !== "CANCELLED" && (
                        <p className="text-xs mt-1">Usa los botones de arriba para agregar fotos</p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Timeline */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Historial del ticket</h4>
                  <div className="space-y-3">
                    {getTimeline(ticketDetail).map((event, idx) => {
                      const Icon = event.icon;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${event.bgColor} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-4 h-4 ${event.color}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resolución (si existe) */}
                {ticketDetail.resolution && (
                  <>
                    <Separator />
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Resolución
                      </h4>
                      <p className="text-sm">{ticketDetail.resolution}</p>
                      {(() => {
                        const parts = ticketDetail.partsUsed as unknown;
                        if (parts && Array.isArray(parts) && parts.length > 0) {
                          return (
                            <div className="mt-3 flex items-start gap-2">
                              <Package className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Piezas utilizadas</p>
                                <p className="text-sm">{(parts as string[]).join(", ")}</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {ticketDetail.laborCost && (
                        <div className="mt-2 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm">
                            <span className="text-xs text-muted-foreground">Costo mano de obra: </span>
                            ${Number(ticketDetail.laborCost).toLocaleString("es-CO")}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* Acciones */}
                <div className="flex gap-3 flex-wrap">
                  {ticketDetail.status === "PENDING" && (
                    <>
                      <Button onClick={() => handleStartTicket(ticketDetail.id)} disabled={updateMutation.isPending} className="flex-1">
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Iniciar trabajo
                      </Button>
                      <Button variant="destructive" onClick={() => handleCancelTicket(ticketDetail.id)} disabled={updateMutation.isPending}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                    </>
                  )}
                  {ticketDetail.status === "IN_PROGRESS" && (
                    <>
                      <Button onClick={() => setShowResolveDialog(true)} className="flex-1 bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-2" /> Resolver ticket
                      </Button>
                      <Button variant="destructive" onClick={() => handleCancelTicket(ticketDetail.id)} disabled={updateMutation.isPending}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                    </>
                  )}
                  {(ticketDetail.status === "COMPLETED" || ticketDetail.status === "CANCELLED") && (
                    <p className="text-sm text-muted-foreground w-full text-center py-2">
                      Este ticket está {ticketDetail.status === "COMPLETED" ? "completado" : "cancelado"} y no se puede modificar.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No se encontró el ticket</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Resolver Ticket */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Resolver Ticket #{selectedTicketId}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción de la resolución *</label>
              <Textarea placeholder="Describe qué se hizo para resolver el problema..." value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Piezas utilizadas</label>
              <Input placeholder="Ej: Conector tipo 2, Cable 5m, Fusible 30A (separar con comas)" value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} />
              <p className="text-xs text-muted-foreground">Separa las piezas con comas</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Costo de mano de obra (COP)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="number" placeholder="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className="pl-10" />
              </div>
            </div>
            {/* Quick photo upload in resolve dialog */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Agregar foto del resultado</label>
              <Button variant="outline" size="sm" className="w-full" onClick={() => handlePhotoUpload("after")} disabled={uploadingPhoto}>
                {uploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                {uploadingPhoto ? "Subiendo..." : "Adjuntar foto (después)"}
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>Cancelar</Button>
            <Button onClick={handleResolveTicket} disabled={updateMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirmar resolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={() => setLightboxUrl(null)}>
            <X className="w-6 h-6" />
          </Button>
          <img src={lightboxUrl} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
