import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Wrench, AlertTriangle, CheckCircle, Clock, MapPin, Zap, Activity, Timer, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function TechnicianDashboard() {
  // Obtener estadísticas del técnico desde el backend
  const { data: stats } = trpc.techConfig.getStats.useQuery();
  
  // Obtener tickets de mantenimiento
  const { data: tickets } = trpc.maintenance.myTickets.useQuery();
  
  // Obtener estaciones asignadas
  const { data: stations } = trpc.stations.listAll.useQuery();
  
  // Obtener conexiones OCPP activas
  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Obtener alertas OCPP
  const { data: alertData } = trpc.ocpp.getAlertStats.useQuery();

  const assignedStations = stations?.length || 0;
  
  // Helper: verificar si una estación está conectada por OCPP (match por stationId O ocppIdentity)
  const isStationConnected = (station: any) => {
    if (!ocppConnections) return false;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.some((conn: any) => 
      (conn.stationId != null && conn.stationId === station.id) ||
      conn.ocppIdentity === ocppId
    );
  };
  
  const onlineStations = stations?.filter((s: any) => isStationConnected(s)).length || 0;
  
  // Estaciones con problemas (activas pero no conectadas por OCPP)
  const stationsWithIssues = stations?.filter((s: any) => s.isActive && !isStationConnected(s)) || [];

  // Formatear tiempo promedio de resolución
  const formatAvgTime = (ms: number) => {
    if (!ms || ms === 0) return "N/A";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Técnico</h1>
        <p className="text-muted-foreground">
          Gestiona el mantenimiento de las estaciones
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.pending ?? 0}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Pendientes</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.inProgress ?? 0}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">En progreso</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.completedToday ?? 0}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Resueltos hoy</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{onlineStations}/{assignedStations}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Estaciones en línea</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Métricas secundarias */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.critical ?? 0}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Tickets críticos</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{formatAvgTime(stats?.avgResolutionTimeMs ?? 0)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Tiempo promedio</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.completedTotal ?? 0}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Total completados</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Conexiones OCPP activas */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            Cargadores conectados
          </h3>
          <Link href="/technician/ocpp-monitor">
            <Button variant="outline" size="sm">Ver monitor OCPP</Button>
          </Link>
        </div>
        {ocppConnections && ocppConnections.length > 0 ? (
          <div className="space-y-3">
            {ocppConnections.filter((c: any) => c.isConnected).slice(0, 5).map((conn: any) => {
              // Buscar nombre de estación desde la lista de estaciones
              const matchedStation = stations?.find((s: any) => 
                (conn.stationId != null && conn.stationId === s.id) ||
                conn.ocppIdentity === s.ocppIdentity
              );
              return (
                <div key={conn.ocppIdentity} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium">{matchedStation?.name || conn.ocppIdentity}</div>
                      <div className="text-xs text-muted-foreground">
                        {conn.ocppIdentity} - OCPP {conn.ocppVersion || '1.6'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Conectado</Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {conn.lastHeartbeat ? new Date(conn.lastHeartbeat).toLocaleString('es-CO') : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay cargadores conectados
          </div>
        )}
      </Card>

      {/* Tickets urgentes (CRITICAL y HIGH) */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Tickets urgentes
          </h3>
          <Link href="/technician/tickets">
            <Button variant="outline" size="sm">Ver todos</Button>
          </Link>
        </div>
        {tickets && tickets.filter((t: any) => (t.priority === "HIGH" || t.priority === "CRITICAL") && t.status !== "COMPLETED" && t.status !== "CANCELLED").length > 0 ? (
          <div className="space-y-3">
            {tickets
              .filter((t: any) => (t.priority === "HIGH" || t.priority === "CRITICAL") && t.status !== "COMPLETED" && t.status !== "CANCELLED")
              .slice(0, 5)
              .map((ticket: any) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div>
                    <div className="font-medium">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.station?.name || `Estación #${ticket.stationId}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={ticket.priority === "CRITICAL" ? "bg-red-500 text-white" : "bg-orange-500 text-white"}>
                      {ticket.priority === "CRITICAL" ? "Crítico" : "Urgente"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ticket.status === "PENDING" ? "Pendiente" : ticket.status === "IN_PROGRESS" ? "En progreso" : ticket.status}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay tickets urgentes
          </div>
        )}
      </Card>

      {/* Estaciones con problemas */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Estaciones que requieren atención
          </h3>
          <Link href="/technician/stations">
            <Button variant="outline" size="sm">Ver estaciones</Button>
          </Link>
        </div>
        {stationsWithIssues.length > 0 ? (
          <div className="space-y-3">
            {stationsWithIssues.slice(0, 5).map((station: any) => (
              <div key={station.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div>
                  <div className="font-medium">{station.name}</div>
                  <div className="text-sm text-muted-foreground">{station.city} - {station.address}</div>
                </div>
                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Sin conexión OCPP</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Todas las estaciones funcionan correctamente
          </div>
        )}
      </Card>
    </div>
  );
}
