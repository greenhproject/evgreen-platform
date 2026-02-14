import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  Plus,
  ClipboardList,
  Timer,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function TechnicianMaintenance() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resolution, setResolution] = useState("");

  // Formulario de nueva tarea
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    stationId: "",
    priority: "MEDIUM" as string,
    category: "HARDWARE" as string,
  });

  // Datos reales
  const { data: tickets, isLoading, refetch } = trpc.maintenance.myTickets.useQuery();
  const { data: stations } = trpc.stations.listAll.useQuery();

  const createMutation = trpc.maintenance.create.useMutation({
    onSuccess: () => {
      toast.success("Ticket de mantenimiento creado");
      setIsDialogOpen(false);
      setNewTask({ title: "", description: "", stationId: "", priority: "MEDIUM", category: "HARDWARE" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.maintenance.update.useMutation({
    onSuccess: () => {
      toast.success("Ticket actualizado");
      refetch();
      setShowDetailDialog(false);
      setResolution("");
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

  const handleStartTask = (id: number) => {
    updateMutation.mutate({ id, data: { status: "IN_PROGRESS" } });
  };

  const handleCompleteTask = (id: number) => {
    updateMutation.mutate({ id, data: { status: "COMPLETED", resolution: resolution || undefined } });
  };

  const handleCancelTask = (id: number) => {
    updateMutation.mutate({ id, data: { status: "CANCELLED" } });
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      LOW: { bg: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", label: "Baja" },
      MEDIUM: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Media" },
      HIGH: { bg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", label: "Alta" },
      CRITICAL: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Crítica" },
    };
    const style = styles[priority] || styles.MEDIUM;
    return <Badge className={style.bg}>{style.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; label: string; icon: any }> = {
      PENDING: { bg: "bg-gray-100 text-gray-700 dark:bg-gray-900/30", label: "Pendiente", icon: Clock },
      IN_PROGRESS: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30", label: "En progreso", icon: Timer },
      COMPLETED: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30", label: "Completado", icon: CheckCircle },
      CANCELLED: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30", label: "Cancelado", icon: AlertTriangle },
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

  const filteredTickets = (tickets || []).filter((ticket: any) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    return true;
  });

  const pendingCount = (tickets || []).filter((t: any) => t.status === "PENDING").length;
  const inProgressCount = (tickets || []).filter((t: any) => t.status === "IN_PROGRESS").length;
  const completedCount = (tickets || []).filter((t: any) => t.status === "COMPLETED").length;
  const totalCount = (tickets || []).length;
  const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimiento</h1>
          <p className="text-muted-foreground">
            Gestiona las tareas de mantenimiento
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear ticket de mantenimiento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título *</label>
                <Input 
                  placeholder="Descripción breve del problema" 
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Estación *</label>
                <Select value={newTask.stationId} onValueChange={(v) => setNewTask(prev => ({ ...prev, stationId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estación" />
                  </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                <Textarea 
                  placeholder="Detalles del problema..." 
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Timer className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-sm text-muted-foreground">En progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Tasa de cumplimiento</p>
                <p className="text-lg font-bold">{Math.round(completionRate)}%</p>
              </div>
              <Progress value={completionRate} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
              <SelectItem value="COMPLETED">Completadas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de tickets */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Cargando tickets...</p>
            </div>
          </Card>
        ) : filteredTickets.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">Sin tickets</h3>
              <p className="text-sm text-muted-foreground">
                No hay tickets de mantenimiento
              </p>
            </div>
          </Card>
        ) : (
          filteredTickets.map((ticket: any) => (
            <Card key={ticket.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    ticket.priority === "CRITICAL" ? "bg-red-100 dark:bg-red-900/30" :
                    ticket.priority === "HIGH" ? "bg-orange-100 dark:bg-orange-900/30" :
                    "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    <Wrench className={`w-5 h-5 ${
                      ticket.priority === "CRITICAL" ? "text-red-500" :
                      ticket.priority === "HIGH" ? "text-orange-500" :
                      "text-blue-500"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold">{ticket.title}</h3>
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                      {ticket.category && (
                        <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                      )}
                    </div>
                    {ticket.description && (
                      <p className="text-sm text-muted-foreground mb-2">{ticket.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>{ticket.station?.name || `Estación #${ticket.stationId}`}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.createdAt).toLocaleDateString("es-CO")}
                      </span>
                      {ticket.startedAt && (
                        <span>Iniciado: {new Date(ticket.startedAt).toLocaleDateString("es-CO")}</span>
                      )}
                      {ticket.completedAt && (
                        <span>Completado: {new Date(ticket.completedAt).toLocaleDateString("es-CO")}</span>
                      )}
                    </div>
                    {ticket.resolution && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                        <span className="font-medium">Resolución:</span> {ticket.resolution}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {ticket.status === "PENDING" && (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => handleStartTask(ticket.id)}
                          disabled={updateMutation.isPending}
                        >
                          Iniciar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCancelTask(ticket.id)}
                          disabled={updateMutation.isPending}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {ticket.status === "IN_PROGRESS" && (
                      <Button 
                        size="sm"
                        onClick={() => {
                          setDetailTicket(ticket);
                          setShowDetailDialog(true);
                        }}
                      >
                        Completar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog para completar ticket con resolución */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar ticket: {detailTicket?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolución / Notas</label>
              <Textarea 
                placeholder="Describe qué se hizo para resolver el problema..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                onClick={() => detailTicket && handleCompleteTask(detailTicket.id)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Marcar como completado
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowDetailDialog(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
