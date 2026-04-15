import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Star,
  Pause,
  Play,
  X,
  ListChecks,
  BarChart3,
  Calendar as CalendarIcon,
} from "lucide-react";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  one_time: "Una vez",
};

const MAINTENANCE_TYPES = [
  { value: "preventivo", label: "Preventivo General" },
  { value: "inspección", label: "Inspección" },
  { value: "limpieza", label: "Limpieza" },
  { value: "calibración", label: "Calibración" },
  { value: "actualización_firmware", label: "Actualización Firmware" },
  { value: "revisión_eléctrica", label: "Revisión Eléctrica" },
  { value: "revisión_conectores", label: "Revisión Conectores" },
  { value: "prueba_carga", label: "Prueba de Carga" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock },
  in_progress: { label: "En Progreso", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Wrench },
  completed: { label: "Completada", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  overdue: { label: "Vencida", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertTriangle },
  cancelled: { label: "Cancelada", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: X },
};

const SCHEDULE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  paused: { label: "Pausado", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  completed: { label: "Completado", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  cancelled: { label: "Cancelado", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PreventiveMaintenance() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-7 w-7 text-blue-500" />
            Mantenimiento Preventivo
          </h1>
          <p className="text-muted-foreground mt-1">
            Programa y gestiona mantenimientos preventivos para todas las estaciones
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calendario</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Programas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardView />
        </TabsContent>
        <TabsContent value="calendar" className="mt-6">
          <CalendarView />
        </TabsContent>
        <TabsContent value="schedules" className="mt-6">
          <SchedulesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================
function DashboardView() {
  const { data: stats, isLoading } = trpc.maintenanceSchedule.dashboardStats.useQuery();
  const { data: tasksData } = trpc.maintenanceSchedule.listTasks.useQuery({
    status: "pending" as const,
    limit: 10,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-8 bg-muted rounded w-12 mb-2" />
              <div className="h-4 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: "Programas Activos", value: stats?.activeSchedules ?? 0, icon: CalendarClock, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Tareas Pendientes", value: stats?.pendingTasks ?? 0, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "Vencidas", value: stats?.overdueTasks ?? 0, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Próximos 7 días", value: stats?.upcomingTasks ?? 0, icon: CalendarIcon, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Completadas (mes)", value: stats?.completedThisMonth ?? 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Próximas Tareas Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tasksData?.tasks?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay tareas pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasksData.tasks.map((task) => {
                const isOverdue = new Date(task.dueDate) < new Date();
                const statusCfg = isOverdue ? STATUS_CONFIG.overdue : STATUS_CONFIG[task.status];
                const StatusIcon = statusCfg?.icon || Clock;
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isOverdue ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
                        <StatusIcon className={`h-4 w-4 ${isOverdue ? "text-red-500" : "text-yellow-500"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.stationName} · {task.technicianName || "Sin asignar"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                        {formatDate(task.dueDate)}
                      </p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${statusCfg?.color || ""}`}>
                        {isOverdue ? "Vencida" : statusCfg?.label || task.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// CALENDAR VIEW
// ============================================================================
function CalendarView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const { data: stationsData } = trpc.maintenanceSchedule.getStations.useQuery();

  const startOfMonth = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d;
  }, [currentDate]);

  const endOfMonth = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    return d;
  }, [currentDate]);

  const { data: calendarData } = trpc.maintenanceSchedule.calendarView.useQuery({
    startDate: startOfMonth.toISOString(),
    endDate: endOfMonth.toISOString(),
    stationId: selectedStation !== "all" ? Number(selectedStation) : undefined,
  });

  const daysInMonth = endOfMonth.getDate();
  const firstDayOfWeek = startOfMonth.getDay(); // 0=Sunday
  const today = new Date();

  const tasksByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    calendarData?.tasks?.forEach((task: any) => {
      const day = new Date(task.dueDate).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(task);
    });
    return map;
  }, [calendarData]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthName = currentDate.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center">{monthName}</h2>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={selectedStation} onValueChange={setSelectedStation}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas las estaciones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las estaciones</SelectItem>
            {stationsData?.stations?.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] rounded-lg bg-muted/20" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
              const dayTasks = tasksByDay[day] || [];

              return (
                <div
                  key={day}
                  className={`min-h-[80px] sm:min-h-[100px] rounded-lg border p-1 sm:p-2 transition-colors ${
                    isToday ? "border-blue-500 bg-blue-500/5" : "border-border/50 hover:bg-muted/30"
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-blue-500" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((task: any) => {
                      const isOverdue = new Date(task.dueDate) < today && task.status === "pending";
                      return (
                        <div
                          key={task.id}
                          className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate ${
                            task.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : isOverdue
                              ? "bg-red-500/10 text-red-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                          title={`${task.title} - ${task.stationName}`}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayTasks.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Pendiente</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Completada</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Vencida</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// SCHEDULES VIEW
// ============================================================================
function SchedulesView() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const utils = trpc.useUtils();
  const { data: schedulesData, isLoading } = trpc.maintenanceSchedule.list.useQuery({
    status: statusFilter as any,
    limit: 50,
  });
  const { data: stationsData } = trpc.maintenanceSchedule.getStations.useQuery();
  const { data: techniciansData } = trpc.maintenanceSchedule.getTechnicians.useQuery();

  const cancelMutation = trpc.maintenanceSchedule.cancel.useMutation({
    onSuccess: () => {
      toast.success("Programa cancelado");
      utils.maintenanceSchedule.list.invalidate();
      utils.maintenanceSchedule.dashboardStats.invalidate();
    },
  });

  const updateMutation = trpc.maintenanceSchedule.update.useMutation({
    onSuccess: () => {
      toast.success("Programa actualizado");
      utils.maintenanceSchedule.list.invalidate();
    },
  });

  // If a schedule is selected, show its tasks
  if (selectedScheduleId) {
    return (
      <ScheduleTasksView
        scheduleId={selectedScheduleId}
        onBack={() => setSelectedScheduleId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Mantenimiento Programado</DialogTitle>
            </DialogHeader>
            <CreateScheduleForm
              stations={stationsData?.stations || []}
              technicians={techniciansData?.technicians || []}
              onSuccess={() => {
                setShowCreateDialog(false);
                utils.maintenanceSchedule.list.invalidate();
                utils.maintenanceSchedule.dashboardStats.invalidate();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Schedules List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4 pb-4">
                <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !schedulesData?.schedules?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No hay programas de mantenimiento {statusFilter !== "active" ? `con estado "${SCHEDULE_STATUS_CONFIG[statusFilter]?.label}"` : ""}</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer programa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedulesData.schedules.map((schedule) => {
            const statusCfg = SCHEDULE_STATUS_CONFIG[schedule.status];
            const isOverdue = schedule.status === "active" && new Date(schedule.nextDueDate) < new Date();

            return (
              <Card
                key={schedule.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setSelectedScheduleId(schedule.id)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{schedule.title}</h3>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg?.color || ""}`}>
                          {statusCfg?.label || schedule.status}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20 shrink-0">
                            Vencido
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {schedule.stationName} · {MAINTENANCE_TYPES.find(t => t.value === schedule.maintenanceType)?.label || schedule.maintenanceType}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Próximo: {formatDate(schedule.nextDueDate)}
                        </span>
                        {schedule.technicianName && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {schedule.technicianName}
                          </span>
                        )}
                        {schedule.estimatedCostCop ? (
                          <span>{formatCOP(schedule.estimatedCostCop)}</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {schedule.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Pausar"
                          onClick={() => updateMutation.mutate({ id: schedule.id, status: "paused" })}
                        >
                          <Pause className="h-4 w-4 text-yellow-500" />
                        </Button>
                      )}
                      {schedule.status === "paused" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Reanudar"
                          onClick={() => updateMutation.mutate({ id: schedule.id, status: "active" })}
                        >
                          <Play className="h-4 w-4 text-emerald-500" />
                        </Button>
                      )}
                      {(schedule.status === "active" || schedule.status === "paused") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Cancelar"
                          onClick={() => {
                            if (confirm("¿Cancelar este programa de mantenimiento?")) {
                              cancelMutation.mutate({ id: schedule.id });
                            }
                          }}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCHEDULE TASKS VIEW
// ============================================================================
function ScheduleTasksView({ scheduleId, onBack }: { scheduleId: number; onBack: () => void }) {
  const utils = trpc.useUtils();

  const { data: tasksData, isLoading } = trpc.maintenanceSchedule.listTasks.useQuery({
    scheduleId,
    limit: 50,
  });

  const completeMutation = trpc.maintenanceSchedule.completeTask.useMutation({
    onSuccess: () => {
      toast.success("Tarea completada");
      utils.maintenanceSchedule.listTasks.invalidate();
      utils.maintenanceSchedule.dashboardStats.invalidate();
      utils.maintenanceSchedule.list.invalidate();
    },
  });

  const rateMutation = trpc.maintenanceSchedule.rateTask.useMutation({
    onSuccess: () => {
      toast.success("Calificación registrada");
      utils.maintenanceSchedule.listTasks.invalidate();
    },
  });

  const [completeDialog, setCompleteDialog] = useState<{ taskId: number; title: string } | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [rateDialog, setRateDialog] = useState<{ taskId: number; title: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingNotes, setRatingNotes] = useState("");

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ChevronLeft className="h-4 w-4" />
        Volver a programas
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de Tareas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !tasksData?.tasks?.length ? (
            <p className="text-center text-muted-foreground py-8">No hay tareas registradas</p>
          ) : (
            <div className="space-y-3">
              {tasksData.tasks.map((task) => {
                const isOverdue = task.status === "pending" && new Date(task.dueDate) < new Date();
                const effectiveStatus = isOverdue ? "overdue" : task.status;
                const statusCfg = STATUS_CONFIG[effectiveStatus];
                const StatusIcon = statusCfg?.icon || Clock;

                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        effectiveStatus === "completed" ? "bg-emerald-500/10" :
                        effectiveStatus === "overdue" ? "bg-red-500/10" : "bg-yellow-500/10"
                      }`}>
                        <StatusIcon className={`h-4 w-4 ${
                          effectiveStatus === "completed" ? "text-emerald-500" :
                          effectiveStatus === "overdue" ? "text-red-500" : "text-yellow-500"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.stationName} · Vence: {formatDate(task.dueDate)}
                          {task.technicianName ? ` · ${task.technicianName}` : ""}
                        </p>
                        {task.completedDate && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            Completada: {formatDateTime(task.completedDate)}
                            {task.actualCostCop ? ` · Costo: ${formatCOP(task.actualCostCop)}` : ""}
                          </p>
                        )}
                        {task.qualityRating && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${i < task.qualityRating! ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {(task.status === "pending" || task.status === "in_progress") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            setCompleteDialog({ taskId: task.id, title: task.title });
                            setCompletionNotes("");
                            setActualCost("");
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completar
                        </Button>
                      )}
                      {task.status === "completed" && !task.qualityRating && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            setRateDialog({ taskId: task.id, title: task.title });
                            setRating(5);
                            setRatingNotes("");
                          }}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Calificar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Task Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={(open) => !open && setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Tarea: {completeDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notas de completación</Label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Descripción del trabajo realizado..."
                rows={3}
              />
            </div>
            <div>
              <Label>Costo real (COP)</Label>
              <Input
                type="number"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (!completeDialog) return;
                completeMutation.mutate({
                  taskId: completeDialog.taskId,
                  completionNotes,
                  actualCostCop: Number(actualCost) || 0,
                });
                setCompleteDialog(null);
              }}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como Completada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate Task Dialog */}
      <Dialog open={!!rateDialog} onOpenChange={(open) => !open && setRateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calificar: {rateDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Calificación</Label>
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className="focus:outline-none"
                  >
                    <Star className={`h-8 w-8 transition-colors ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300 hover:text-yellow-300"}`} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
              </div>
            </div>
            <div>
              <Label>Comentarios (opcional)</Label>
              <Textarea
                value={ratingNotes}
                onChange={(e) => setRatingNotes(e.target.value)}
                placeholder="Observaciones sobre la calidad del trabajo..."
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!rateDialog) return;
                rateMutation.mutate({
                  taskId: rateDialog.taskId,
                  qualityRating: rating,
                  ratingNotes,
                });
                setRateDialog(null);
              }}
              disabled={rateMutation.isPending}
            >
              <Star className="h-4 w-4 mr-2" />
              Guardar Calificación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// CREATE SCHEDULE FORM
// ============================================================================
function CreateScheduleForm({
  stations,
  technicians,
  onSuccess,
}: {
  stations: { id: number; name: string; city: string }[];
  technicians: { id: number; name: string | null; role: string }[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    stationId: "",
    title: "",
    description: "",
    maintenanceType: "",
    frequency: "monthly",
    nextDueDate: "",
    preferredTimeStart: "08:00",
    preferredTimeEnd: "17:00",
    assignedTechnicianId: "",
    estimatedCostCop: "",
    reminderDaysBefore: "3",
    notes: "",
  });

  const createMutation = trpc.maintenanceSchedule.create.useMutation({
    onSuccess: () => {
      toast.success("Programa creado exitosamente");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.stationId || !form.title || !form.maintenanceType || !form.nextDueDate) {
      toast.error("Completa estación, título, tipo y fecha");
      return;
    }

    createMutation.mutate({
      stationId: Number(form.stationId),
      title: form.title,
      description: form.description || undefined,
      maintenanceType: form.maintenanceType,
      frequency: form.frequency as any,
      nextDueDate: new Date(form.nextDueDate).toISOString(),
      preferredTimeStart: form.preferredTimeStart,
      preferredTimeEnd: form.preferredTimeEnd,
      assignedTechnicianId: form.assignedTechnicianId ? Number(form.assignedTechnicianId) : undefined,
      estimatedCostCop: Number(form.estimatedCostCop) || 0,
      reminderDaysBefore: Number(form.reminderDaysBefore) || 3,
      notes: form.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Estación *</Label>
          <Select value={form.stationId} onValueChange={(v) => setForm({ ...form, stationId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estación" />
            </SelectTrigger>
            <SelectContent>
              {stations.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name} ({s.city})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>Título *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Revisión mensual de conectores"
          />
        </div>

        <div>
          <Label>Tipo de Mantenimiento *</Label>
          <Select value={form.maintenanceType} onValueChange={(v) => setForm({ ...form, maintenanceType: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {MAINTENANCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Frecuencia</Label>
          <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Fecha Inicio *</Label>
          <Input
            type="date"
            value={form.nextDueDate}
            onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
          />
        </div>

        <div>
          <Label>Técnico Asignado</Label>
          <Select value={form.assignedTechnicianId} onValueChange={(v) => setForm({ ...form, assignedTechnicianId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name || "Sin nombre"} ({t.role === "support_lead" ? "Ingeniero" : "Técnico"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Hora Inicio</Label>
          <Input
            type="time"
            value={form.preferredTimeStart}
            onChange={(e) => setForm({ ...form, preferredTimeStart: e.target.value })}
          />
        </div>

        <div>
          <Label>Hora Fin</Label>
          <Input
            type="time"
            value={form.preferredTimeEnd}
            onChange={(e) => setForm({ ...form, preferredTimeEnd: e.target.value })}
          />
        </div>

        <div>
          <Label>Costo Estimado (COP)</Label>
          <Input
            type="number"
            value={form.estimatedCostCop}
            onChange={(e) => setForm({ ...form, estimatedCostCop: e.target.value })}
            placeholder="0"
          />
        </div>

        <div>
          <Label>Recordatorio (días antes)</Label>
          <Input
            type="number"
            value={form.reminderDaysBefore}
            onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })}
            min="1"
            max="30"
          />
        </div>

        <div className="col-span-2">
          <Label>Descripción</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Detalle del mantenimiento a realizar..."
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label>Notas adicionales</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Observaciones, herramientas necesarias, etc."
            rows={2}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? "Creando..." : "Crear Programa de Mantenimiento"}
      </Button>
    </form>
  );
}
