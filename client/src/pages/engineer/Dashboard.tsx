import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Zap,
  ArrowRight,
  Timer,
  XCircle
} from "lucide-react";
import { useLocation } from "wouter";

export default function EngineerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.maintenance.operationsStats.useQuery();
  const { data: allTickets } = trpc.maintenance.listAll.useQuery();

  // Tickets recientes (últimos 5)
  const recentTickets = allTickets
    ?.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5) || [];

  // Tickets críticos abiertos
  const criticalTickets = allTickets?.filter(
    (t: any) => t.priority === "CRITICAL" && t.status !== "COMPLETED" && t.status !== "CANCELLED"
  ) || [];

  const priorityColors: Record<string, string> = {
    CRITICAL: "text-red-500 bg-red-500/10",
    HIGH: "text-orange-500 bg-orange-500/10",
    MEDIUM: "text-yellow-500 bg-yellow-500/10",
    LOW: "text-green-500 bg-green-500/10",
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Centro de Operaciones
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido, Ing. {user?.name || "Ingeniero"}. Panel de control del área técnica.
        </p>
      </div>

      {/* Alertas críticas */}
      {criticalTickets.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-red-500">
              {criticalTickets.length} ticket{criticalTickets.length > 1 ? "s" : ""} crítico{criticalTickets.length > 1 ? "s" : ""} abierto{criticalTickets.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {criticalTickets.slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">#{t.id} - {t.title}</span>
                <button 
                  onClick={() => setLocation("/engineer/tickets")}
                  className="text-red-500 hover:underline text-xs"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <span className="text-sm text-muted-foreground">Pendientes</span>
          </div>
          <p className="text-3xl font-bold">{stats?.pending || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">tickets por atender</p>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">En Progreso</span>
          </div>
          <p className="text-3xl font-bold">{stats?.inProgress || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">tickets activos</p>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Completados</span>
          </div>
          <p className="text-3xl font-bold">{stats?.completed || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">
            tasa: {stats?.completionRate || 0}%
          </p>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Tiempo Promedio</span>
          </div>
          <p className="text-3xl font-bold">{stats?.avgResolutionHours || 0}h</p>
          <p className="text-xs text-muted-foreground mt-1">resolución promedio</p>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets recientes */}
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              Tickets Recientes
            </h2>
            <button 
              onClick={() => setLocation("/engineer/tickets")}
              className="text-sm text-blue-500 hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y">
            {recentTickets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay tickets registrados
              </div>
            ) : (
              recentTickets.map((t: any) => (
                <div key={t.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">#{t.id} - {t.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(t.createdAt).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[t.priority] || "text-gray-500 bg-gray-500/10"}`}>
                        {t.priority || "N/A"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] || ""}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rendimiento por técnico */}
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Rendimiento del Equipo
            </h2>
            <button 
              onClick={() => setLocation("/engineer/technicians")}
              className="text-sm text-blue-500 hover:underline flex items-center gap-1"
            >
              Gestionar <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y">
            {(!stats?.byTechnician || stats.byTechnician.length === 0) ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay técnicos con tickets asignados
              </div>
            ) : (
              stats.byTechnician.map((tech: any) => (
                <div key={tech.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{tech.name}</span>
                    <span className="text-xs text-muted-foreground">{tech.count} tickets</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle className="h-3 w-3" /> {tech.completed} completados
                    </span>
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Clock className="h-3 w-3" /> {tech.pending} pendientes
                    </span>
                  </div>
                  {tech.count > 0 && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(tech.completed / tech.count) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats?.critical || 0}</p>
            <p className="text-xs text-muted-foreground">Críticos</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats?.high || 0}</p>
            <p className="text-xs text-muted-foreground">Alta prioridad</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
            <XCircle className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats?.cancelled || 0}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total tickets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
