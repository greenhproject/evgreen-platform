import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  ClipboardList,
  Timer,
  User
} from "lucide-react";
import { toast } from "sonner";

interface MaintenanceTask {
  id: number;
  title: string;
  description: string;
  stationId: number;
  stationName: string;
  type: "preventive" | "corrective" | "inspection";
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  scheduledDate: Date;
  completedDate?: Date;
  assignedTo: string;
  notes?: string;
}

// Datos de ejemplo
const mockTasks: MaintenanceTask[] = [
  {
    id: 1,
    title: "Inspección mensual de conectores",
    description: "Verificar estado físico de conectores y cables",
    stationId: 1,
    stationName: "Green EV Mosquera",
    type: "inspection",
    priority: "medium",
    status: "pending",
    scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    assignedTo: "Técnico 1",
  },
  {
    id: 2,
    title: "Limpieza de filtros de ventilación",
    description: "Mantenimiento preventivo del sistema de enfriamiento",
    stationId: 1,
    stationName: "Green EV Mosquera",
    type: "preventive",
    priority: "low",
    status: "in_progress",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
    assignedTo: "Técnico 1",
  },
  {
    id: 3,
    title: "Reparación de pantalla táctil",
    description: "La pantalla no responde correctamente al tacto",
    stationId: 1,
    stationName: "Green EV Mosquera",
    type: "corrective",
    priority: "high",
    status: "completed",
    scheduledDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    completedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    assignedTo: "Técnico 1",
    notes: "Se reemplazó el panel táctil completo",
  },
];

export default function TechnicianMaintenance() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>(mockTasks);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getTypeBadge = (type: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      preventive: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Preventivo" },
      corrective: { bg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", label: "Correctivo" },
      inspection: { bg: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", label: "Inspección" },
    };
    const style = styles[type];
    return <Badge className={style.bg}>{style.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      low: { bg: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", label: "Baja" },
      medium: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Media" },
      high: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Alta" },
    };
    const style = styles[priority];
    return <Badge className={style.bg}>{style.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; label: string; icon: any }> = {
      pending: { bg: "bg-gray-100 text-gray-700 dark:bg-gray-900/30", label: "Pendiente", icon: Clock },
      in_progress: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30", label: "En progreso", icon: Timer },
      completed: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30", label: "Completado", icon: CheckCircle },
    };
    const style = styles[status];
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const handleStartTask = (id: number) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: "in_progress" as const } : t
    ));
    toast.success("Tarea iniciada");
  };

  const handleCompleteTask = (id: number) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: "completed" as const, completedDate: new Date() } : t
    ));
    toast.success("Tarea completada");
  };

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    return true;
  });

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const completionRate = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimiento</h1>
          <p className="text-muted-foreground">
            Gestiona las tareas de mantenimiento programadas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nueva tarea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Programar mantenimiento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input placeholder="Descripción breve de la tarea" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventivo</SelectItem>
                    <SelectItem value="corrective">Correctivo</SelectItem>
                    <SelectItem value="inspection">Inspección</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea placeholder="Detalles de la tarea..." />
              </div>
              <Button className="w-full" onClick={() => {
                toast.success("Tarea programada");
                setIsDialogOpen(false);
              }}>
                Programar tarea
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
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de tareas */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">Sin tareas</h3>
              <p className="text-sm text-muted-foreground">
                No hay tareas de mantenimiento programadas
              </p>
            </div>
          </Card>
        ) : (
          filteredTasks.map(task => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    task.type === "corrective" ? "bg-orange-100 dark:bg-orange-900/30" :
                    task.type === "preventive" ? "bg-blue-100 dark:bg-blue-900/30" :
                    "bg-purple-100 dark:bg-purple-900/30"
                  }`}>
                    <Wrench className={`w-5 h-5 ${
                      task.type === "corrective" ? "text-orange-500" :
                      task.type === "preventive" ? "text-blue-500" :
                      "text-purple-500"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold">{task.title}</h3>
                      {getTypeBadge(task.type)}
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{task.stationName}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.scheduledDate).toLocaleDateString("es-CO")}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assignedTo}
                      </span>
                    </div>
                    {task.notes && (
                      <p className="text-sm mt-2 p-2 bg-muted/50 rounded">
                        <strong>Notas:</strong> {task.notes}
                      </p>
                    )}
                  </div>
                  {task.status !== "completed" && (
                    <div className="flex gap-2">
                      {task.status === "pending" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleStartTask(task.id)}
                        >
                          Iniciar
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <Button 
                          size="sm"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          Completar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
