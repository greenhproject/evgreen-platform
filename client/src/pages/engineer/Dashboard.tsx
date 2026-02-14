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
  XCircle,
  Wifi,
  WifiOff,
  Activity,
  RefreshCw,
  Radio,
  ShieldAlert
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { StationHealthMap } from "@/components/StationHealthMap";

export default function EngineerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.maintenance.operationsStats.useQuery();
  const { data: allTickets } = trpc.maintenance.listAll.useQuery();
  const { data: stationHealth, isLoading: healthLoading, refetch: refetchHealth } = trpc.ocpp.getStationHealth.useQuery();
  const { data: alertStats } = trpc.ocpp.getAlertStats.useQuery();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAlerts = trpc.ocpp.generateOfflineAlerts.useMutation({
    onSuccess: (data) => {
      if (data.alertsGenerated > 0) {
        toast.success(`Se generaron ${data.alertsGenerated} alertas de estaciones offline`);
      } else {
        toast.info("Todas las estaciones offline ya tienen alertas recientes");
      }
      refetchHealth();
    },
    onError: () => {
      toast.error("Error al generar alertas");
    },
    onSettled: () => setIsGenerating(false),
  });

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

  const healthStatusColors: Record<string, string> = {
    healthy: "text-green-500",
    warning: "text-yellow-500",
    critical: "text-red-500",
    offline: "text-gray-500",
  };

  const healthStatusLabels: Record<string, string> = {
    healthy: "En línea",
    warning: "Advertencia",
    critical: "Crítico",
    offline: "Offline",
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

      {/* Alertas críticas de estaciones */}
      {stationHealth && stationHealth.critical > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-500">
                {stationHealth.critical} estación{stationHealth.critical > 1 ? "es" : ""} en estado crítico
              </span>
            </div>
            <button
              onClick={() => {
                setIsGenerating(true);
                generateAlerts.mutate();
              }}
              disabled={isGenerating}
              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`} />
              Generar alertas
            </button>
          </div>
          <div className="space-y-2">
            {stationHealth.stations
              .filter(s => s.healthStatus === "critical")
              .map((s) => (
                <div key={s.stationId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-foreground">{s.stationName}</span>
                  </div>
                  <span className="text-xs text-red-400">{s.issue}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Alertas críticas de tickets */}
      {criticalTickets.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-orange-500">
              {criticalTickets.length} ticket{criticalTickets.length > 1 ? "s" : ""} crítico{criticalTickets.length > 1 ? "s" : ""} abierto{criticalTickets.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {criticalTickets.slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">#{t.id} - {t.title}</span>
                <button 
                  onClick={() => setLocation("/engineer/tickets")}
                  className="text-orange-500 hover:underline text-xs"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado de Estaciones + KPIs de Tickets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Estado de estaciones */}
        <div className="bg-card border rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-sm text-muted-foreground">Estaciones</span>
          </div>
          {healthLoading ? (
            <div className="h-8 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-500">{stationHealth?.online || 0}</span>
                <span className="text-lg text-muted-foreground">/</span>
                <span className="text-lg text-muted-foreground">{stationHealth?.totalActive || 0}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {(stationHealth?.online || 0) > 0 && (
                  <span className="text-xs text-green-500 flex items-center gap-0.5">
                    <Wifi className="h-3 w-3" /> {stationHealth?.online} online
                  </span>
                )}
                {(stationHealth?.offline || 0) > 0 && (
                  <span className="text-xs text-red-500 flex items-center gap-0.5">
                    <WifiOff className="h-3 w-3" /> {stationHealth?.offline} offline
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* KPIs de tickets */}
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
            <span className="text-sm text-muted-foreground">Tiempo Prom.</span>
          </div>
          <p className="text-3xl font-bold">{stats?.avgResolutionHours || 0}h</p>
          <p className="text-xs text-muted-foreground mt-1">resolución promedio</p>
        </div>
      </div>

      {/* Estado de Estaciones detallado */}
      {stationHealth && stationHealth.stations.length > 0 && (
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              Estado de Estaciones en Tiempo Real
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchHealth()}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Actualizar
              </button>
              <button 
                onClick={() => setLocation("/engineer/stations")}
                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="divide-y">
            {stationHealth.stations.map((station) => (
              <div key={station.stationId} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    station.healthStatus === "healthy" ? "bg-green-500/10" :
                    station.healthStatus === "warning" ? "bg-yellow-500/10" :
                    "bg-red-500/10"
                  }`}>
                    {station.isOnline ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className={`h-4 w-4 ${station.healthStatus === "critical" ? "text-red-500" : "text-yellow-500"}`} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{station.stationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.ocppIdentity || "Sin ID OCPP"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    station.healthStatus === "healthy" ? "bg-green-500/10 text-green-500" :
                    station.healthStatus === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-red-500/10 text-red-500"
                  }`}>
                    {healthStatusLabels[station.healthStatus] || station.healthStatus}
                  </span>
                  {station.issue && (
                    <p className="text-xs text-muted-foreground mt-1">{station.issue}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapa de Estaciones */}
      {stationHealth && stationHealth.stations.length > 0 && (
        <StationHealthMap stations={stationHealth.stations} />
      )}

      {/* Alertas OCPP + Tickets recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas OCPP recientes */}
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alertas del Sistema
            </h2>
            <div className="flex items-center gap-3">
              {alertStats && (
                <span className="text-xs text-muted-foreground">
                  {alertStats.unacknowledged} sin reconocer
                </span>
              )}
              <button 
                onClick={() => setLocation("/engineer/alerts")}
                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {alertStats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-red-500/5 rounded-lg">
                  <p className="text-2xl font-bold text-red-500">
                    {alertStats.bySeverity?.critical || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Críticas</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/5 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-500">
                    {alertStats.bySeverity?.warning || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Advertencias</p>
                </div>
                <div className="text-center p-3 bg-blue-500/5 rounded-lg">
                  <p className="text-2xl font-bold text-blue-500">
                    {alertStats.bySeverity?.info || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Informativas</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                Cargando estadísticas...
              </div>
            )}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total de alertas</span>
                <span className="font-semibold">{alertStats?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Sin reconocer</span>
                <span className="font-semibold text-orange-500">{alertStats?.unacknowledged || 0}</span>
              </div>
            </div>
          </div>
        </div>

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
      </div>

      {/* Rendimiento del equipo */}
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
