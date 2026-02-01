import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Wrench, AlertTriangle, CheckCircle, Clock, MapPin, Zap, Activity } from "lucide-react";
import { Link } from "wouter";

export default function TechnicianDashboard() {
  // Obtener tickets de mantenimiento
  const { data: tickets } = trpc.maintenance.myTickets.useQuery();
  
  // Obtener estaciones asignadas
  const { data: stations } = trpc.stations.listAll.useQuery();
  
  // Obtener conexiones OCPP activas
  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Calcular métricas
  const pendingTickets = tickets?.filter((t: any) => t.status === "PENDING").length || 0;
  const inProgressTickets = tickets?.filter((t: any) => t.status === "IN_PROGRESS").length || 0;
  const resolvedToday = tickets?.filter((t: any) => {
    if (t.status !== "RESOLVED") return false;
    const today = new Date();
    const resolved = new Date(t.updatedAt);
    return resolved.toDateString() === today.toDateString();
  }).length || 0;
  
  const assignedStations = stations?.length || 0;
  const onlineStations = stations?.filter((s: any) => s.isOnline).length || 0;
  
  // Estaciones con alertas (offline o con errores)
  const stationsWithIssues = stations?.filter((s: any) => !s.isOnline) || [];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Técnico</h1>
        <p className="text-muted-foreground">
          Gestiona el mantenimiento de las estaciones
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{pendingTickets}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Tickets pendientes</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{inProgressTickets}</div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">En progreso</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold">{resolvedToday}</div>
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
            {ocppConnections.slice(0, 5).map((conn: any) => (
              <div key={conn.chargePointId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">{conn.chargePointId}</div>
                    <div className="text-xs text-muted-foreground">
                      {conn.vendor} {conn.model} - OCPP {conn.ocppVersion}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-green-100 text-green-700">Conectado</Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {conn.connectors?.length || 0} conectores
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay cargadores conectados
          </div>
        )}
      </Card>

      {/* Tickets urgentes */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Tickets urgentes
        </h3>
        {tickets && tickets.filter((t: any) => t.priority === "HIGH" && t.status !== "RESOLVED").length > 0 ? (
          <div className="space-y-3">
            {tickets
              .filter((t: any) => t.priority === "HIGH" && t.status !== "RESOLVED")
              .slice(0, 5)
              .map((ticket: any) => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <div className="font-medium">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {(ticket as any).station?.name || `Estación #${ticket.stationId}`}
                    </div>
                  </div>
                  <Badge variant="destructive">Urgente</Badge>
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
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Estaciones que requieren atención
        </h3>
        {stationsWithIssues.length > 0 ? (
          <div className="space-y-3">
            {stationsWithIssues.map((station: any) => (
              <div key={station.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <div className="font-medium">{station.name}</div>
                  <div className="text-sm text-muted-foreground">{station.city}</div>
                </div>
                <Badge className="bg-red-100 text-red-700">Fuera de línea</Badge>
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
