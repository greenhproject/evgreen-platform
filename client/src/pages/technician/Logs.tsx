import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Activity, AlertTriangle, Info, CheckCircle, Clock, RefreshCw, Loader2, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LogEntry {
  id: string;
  type: "ERROR" | "WARNING" | "INFO" | "SUCCESS";
  message: string;
  source: string;
  stationName?: string;
  timestamp: Date;
  details?: string;
}

export default function TechnicianLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");

  // Datos reales
  const { data: tickets } = trpc.maintenance.myTickets.useQuery();
  const { data: alertsData } = trpc.ocpp.getAlerts.useQuery({ limit: 50, offset: 0 });
  const { data: ocppConnections, refetch, isLoading } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const { data: stations } = trpc.stations.listAll.useQuery();

  // Combinar datos en logs unificados
  const logs: LogEntry[] = useMemo(() => {
    const entries: LogEntry[] = [];

    // Alertas OCPP → logs
    (alertsData || []).forEach((alert: any) => {
      const severity = alert.severity || "LOW";
      entries.push({
        id: `alert-${alert.id}`,
        type: severity === "CRITICAL" || severity === "HIGH" ? "ERROR" : severity === "MEDIUM" ? "WARNING" : "INFO",
        message: alert.title || alert.alertType || "Alerta OCPP",
        source: "OCPP",
        stationName: alert.stationName || alert.ocppIdentity || `Estación #${alert.stationId}`,
        timestamp: new Date(alert.createdAt),
        details: alert.description || alert.message,
      });
    });

    // Tickets de mantenimiento → logs
    (tickets || []).forEach((ticket: any) => {
      if (ticket.status === "COMPLETED") {
        entries.push({
          id: `ticket-done-${ticket.id}`,
          type: "SUCCESS",
          message: `Ticket completado: ${ticket.title}`,
          source: "Mantenimiento",
          stationName: ticket.station?.name || `Estación #${ticket.stationId}`,
          timestamp: new Date(ticket.completedAt || ticket.updatedAt),
          details: ticket.resolution,
        });
      } else if (ticket.status === "IN_PROGRESS") {
        entries.push({
          id: `ticket-prog-${ticket.id}`,
          type: "INFO",
          message: `Ticket en progreso: ${ticket.title}`,
          source: "Mantenimiento",
          stationName: ticket.station?.name || `Estación #${ticket.stationId}`,
          timestamp: new Date(ticket.startedAt || ticket.updatedAt),
        });
      } else if (ticket.priority === "CRITICAL" || ticket.priority === "HIGH") {
        entries.push({
          id: `ticket-urg-${ticket.id}`,
          type: "WARNING",
          message: `Ticket urgente pendiente: ${ticket.title}`,
          source: "Mantenimiento",
          stationName: ticket.station?.name || `Estación #${ticket.stationId}`,
          timestamp: new Date(ticket.createdAt),
        });
      }
    });

    // Conexiones OCPP → logs de conexión
    (ocppConnections || []).forEach((conn: any) => {
      entries.push({
        id: `conn-${conn.chargePointId}`,
        type: "SUCCESS",
        message: `Cargador conectado: ${conn.chargePointId}`,
        source: "OCPP",
        stationName: conn.chargePointId,
        timestamp: new Date(conn.connectedAt || Date.now()),
        details: `${conn.vendor || "N/A"} ${conn.model || ""} - OCPP ${conn.ocppVersion || "1.6"}`,
      });
    });

    // Ordenar por timestamp descendente
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return entries;
  }, [alertsData, tickets, ocppConnections]);

  // Filtrar logs
  const filteredLogs = logs.filter((log) => {
    if (typeFilter !== "all" && log.type !== typeFilter) return false;
    if (stationFilter !== "all" && log.stationName !== stationFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!log.message.toLowerCase().includes(q) && !(log.details || "").toLowerCase().includes(q) && !(log.stationName || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Estaciones únicas para filtro
  const uniqueStations = useMemo(() => {
    const names = new Set<string>();
    logs.forEach(l => { if (l.stationName) names.add(l.stationName); });
    return Array.from(names).sort();
  }, [logs]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case "ERROR": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "WARNING": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "SUCCESS": return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogBadge = (type: string) => {
    const styles: Record<string, string> = {
      ERROR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      WARNING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      INFO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      SUCCESS: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
    const labels: Record<string, string> = {
      ERROR: "Error",
      WARNING: "Advertencia",
      INFO: "Info",
      SUCCESS: "Éxito",
    };
    return <Badge className={styles[type] || styles.INFO}>{labels[type] || type}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs del Sistema</h1>
          <p className="text-muted-foreground">
            Monitorea los eventos y diagnósticos de las estaciones
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-lg font-bold">{logs.filter(l => l.type === "ERROR").length}</span>
            <span className="text-xs text-muted-foreground">Errores</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-lg font-bold">{logs.filter(l => l.type === "WARNING").length}</span>
            <span className="text-xs text-muted-foreground">Advertencias</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-lg font-bold">{logs.filter(l => l.type === "INFO").length}</span>
            <span className="text-xs text-muted-foreground">Info</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-lg font-bold">{logs.filter(l => l.type === "SUCCESS").length}</span>
            <span className="text-xs text-muted-foreground">Éxito</span>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ERROR">Errores</SelectItem>
              <SelectItem value="WARNING">Advertencias</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="SUCCESS">Éxito</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stationFilter} onValueChange={setStationFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las estaciones</SelectItem>
              {uniqueStations.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de logs */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4" />
          <h3 className="font-semibold">Eventos recientes</h3>
          <Badge variant="outline">{filteredLogs.length}</Badge>
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Cargando logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay logs que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="mt-0.5">{getLogIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{log.message}</span>
                    {getLogBadge(log.type)}
                    <Badge variant="outline" className="text-xs">{log.source}</Badge>
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {log.stationName && <span>{log.stationName}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.timestamp.toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
