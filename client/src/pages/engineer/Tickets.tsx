import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { 
  ClipboardList, Search, Filter, User, ArrowUpDown,
  AlertTriangle, Clock, CheckCircle, XCircle, Zap,
  ChevronDown, Eye, UserPlus, Flag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const priorityColors: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-500/10 border-red-500/30",
  HIGH: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  MEDIUM: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-green-500 bg-green-500/10 border-green-500/30",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const statusColors: Record<string, string> = {
  PENDING: "text-yellow-500 bg-yellow-500/10",
  IN_PROGRESS: "text-blue-500 bg-blue-500/10",
  COMPLETED: "text-green-500 bg-green-500/10",
  CANCELLED: "text-gray-500 bg-gray-500/10",
};

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  IN_PROGRESS: Zap,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
};

export default function EngineerTickets() {

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTicketId, setAssignTicketId] = useState<number | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>("");
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [priorityTicketId, setPriorityTicketId] = useState<number | null>(null);
  const [newPriority, setNewPriority] = useState<string>("");

  const { data: allTickets, isLoading, refetch } = trpc.maintenance.listAll.useQuery();
  const { data: technicians } = trpc.maintenance.listTechnicians.useQuery();
  const { data: ticketDetail } = trpc.maintenance.getById.useQuery(
    { id: selectedTicket?.id },
    { enabled: !!selectedTicket }
  );

  const assignMutation = trpc.maintenance.assignTechnician.useMutation({
    onSuccess: () => {
      toast.success("Técnico asignado correctamente");
      setAssignDialogOpen(false);
      setSelectedTechId("");
      refetch();
    },
    onError: (err) => toast.error(err.message || "Error"),
  });

  const priorityMutation = trpc.maintenance.updatePriority.useMutation({
    onSuccess: () => {
      toast.success("Prioridad actualizada");
      setPriorityDialogOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message || "Error"),
  });

  const filteredTickets = useMemo(() => {
    if (!allTickets) return [];
    return allTickets.filter((t: any) => {
      const matchSearch = !search || 
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.id?.toString().includes(search);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [allTickets, search, statusFilter, priorityFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-500" />
            Gestión de Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra todos los tickets del área técnica. Asigna, prioriza y supervisa.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredTickets.length} de {allTickets?.length || 0} tickets
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título o #ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="CRITICAL">Crítica</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Media</SelectItem>
            <SelectItem value="LOW">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de tickets */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">#ID</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Título</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Prioridad</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Técnico</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No se encontraron tickets
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t: any) => {
                  const StatusIcon = statusIcons[t.status] || Clock;
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm font-mono">#{t.id}</td>
                      <td className="p-3">
                        <p className="text-sm font-medium truncate max-w-[200px]">{t.title}</p>
                        {t.category && (
                          <p className="text-xs text-muted-foreground">{t.category}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${priorityColors[t.priority] || "text-gray-500 bg-gray-500/10"}`}>
                          {t.priority || "N/A"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit ${statusColors[t.status] || ""}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusLabels[t.status] || t.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {t.technicianId ? (
                          <span className="text-sm text-foreground">
                            {(t as any).technicianName || `Técnico #${t.technicianId}`}
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTicket(t)}
                            className="h-8 w-8 p-0"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAssignTicketId(t.id);
                              setSelectedTechId(t.technicianId?.toString() || "");
                              setAssignDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0"
                            title="Asignar técnico"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPriorityTicketId(t.id);
                              setNewPriority(t.priority || "MEDIUM");
                              setPriorityDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0"
                            title="Cambiar prioridad"
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog: Detalle del ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              Ticket #{selectedTicket?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedTicket.title}</h3>
                {selectedTicket.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedTicket.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${statusColors[selectedTicket.status]}`}>
                    {statusLabels[selectedTicket.status]}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prioridad:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs border ${priorityColors[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoría:</span>
                  <span className="ml-2">{selectedTicket.category || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Estación:</span>
                  <span className="ml-2">#{selectedTicket.stationId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Creado:</span>
                  <span className="ml-2">{new Date(selectedTicket.createdAt).toLocaleString("es-CO")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Técnico:</span>
                  <span className="ml-2">
                    {selectedTicket.technicianId 
                      ? (selectedTicket as any).technicianName || `#${selectedTicket.technicianId}`
                      : "Sin asignar"}
                  </span>
                </div>
              </div>

              {/* Fotos */}
              {ticketDetail?.attachments && (ticketDetail.attachments as any[]).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Fotos adjuntas</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(ticketDetail.attachments as any[]).map((att: any, i: number) => (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={att.url} 
                          alt={att.type}
                          className="w-full h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolución */}
              {selectedTicket.resolution && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-green-500 mb-1">Resolución</h4>
                  <p className="text-sm">{selectedTicket.resolution}</p>
                </div>
              )}

              {/* Acciones rápidas */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTicket(null);
                    setAssignTicketId(selectedTicket.id);
                    setSelectedTechId(selectedTicket.technicianId?.toString() || "");
                    setAssignDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Asignar técnico
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTicket(null);
                    setPriorityTicketId(selectedTicket.id);
                    setNewPriority(selectedTicket.priority || "MEDIUM");
                    setPriorityDialogOpen(true);
                  }}
                >
                  <Flag className="h-4 w-4 mr-1" />
                  Cambiar prioridad
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Asignar técnico */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Asignar Técnico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona el técnico que se encargará del ticket #{assignTicketId}
            </p>
            <Select value={selectedTechId} onValueChange={setSelectedTechId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar técnico..." />
              </SelectTrigger>
              <SelectContent>
                {technicians?.map((tech: any) => (
                  <SelectItem key={tech.id} value={tech.id.toString()}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>{tech.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({tech.role === "engineer" ? "Ingeniero" : "Técnico"})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (assignTicketId && selectedTechId) {
                    assignMutation.mutate({
                      ticketId: assignTicketId,
                      technicianId: parseInt(selectedTechId),
                    });
                  }
                }}
                disabled={!selectedTechId || assignMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {assignMutation.isPending ? "Asignando..." : "Asignar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cambiar prioridad */}
      <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-blue-500" />
              Cambiar Prioridad
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Actualiza la prioridad del ticket #{priorityTicketId}
            </p>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> Baja
                  </span>
                </SelectItem>
                <SelectItem value="MEDIUM">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" /> Media
                  </span>
                </SelectItem>
                <SelectItem value="HIGH">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-500" /> Alta
                  </span>
                </SelectItem>
                <SelectItem value="CRITICAL">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> Crítica
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPriorityDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (priorityTicketId && newPriority) {
                    priorityMutation.mutate({
                      ticketId: priorityTicketId,
                      priority: newPriority as any,
                    });
                  }
                }}
                disabled={priorityMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {priorityMutation.isPending ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
