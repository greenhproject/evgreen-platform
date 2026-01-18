import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter,
  Zap,
  Thermometer,
  Wifi,
  BatteryWarning,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: number;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  stationId: number;
  stationName: string;
  connectorId?: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

// Datos de ejemplo
const mockAlerts: Alert[] = [
  {
    id: 1,
    type: "critical",
    title: "Sobrecalentamiento detectado",
    description: "Temperatura del conector superior a 80°C",
    stationId: 1,
    stationName: "Green EV Mosquera",
    connectorId: 1,
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    acknowledged: false,
  },
  {
    id: 2,
    type: "warning",
    title: "Conexión intermitente",
    description: "La estación ha perdido conexión 3 veces en la última hora",
    stationId: 1,
    stationName: "Green EV Mosquera",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    acknowledged: true,
  },
  {
    id: 3,
    type: "info",
    title: "Actualización de firmware disponible",
    description: "Nueva versión v2.1.0 disponible para instalación",
    stationId: 1,
    stationName: "Green EV Mosquera",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    acknowledged: true,
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60),
  },
];

export default function TechnicianAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <Bell className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getAlertBadge = (type: string) => {
    const styles: Record<string, string> = {
      critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    const labels: Record<string, string> = {
      critical: "Crítica",
      warning: "Advertencia",
      info: "Información",
    };
    return <Badge className={styles[type]}>{labels[type]}</Badge>;
  };

  const handleAcknowledge = (id: number) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, acknowledged: true } : a
    ));
    toast.success("Alerta reconocida");
  };

  const handleResolve = (id: number) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, resolvedAt: new Date() } : a
    ));
    toast.success("Alerta resuelta");
  };

  const filteredAlerts = alerts.filter(alert => {
    if (typeFilter !== "all" && alert.type !== typeFilter) return false;
    if (statusFilter === "active" && alert.resolvedAt) return false;
    if (statusFilter === "resolved" && !alert.resolvedAt) return false;
    if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeCount = alerts.filter(a => !a.resolvedAt).length;
  const criticalCount = alerts.filter(a => a.type === "critical" && !a.resolvedAt).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Alertas</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona alertas de las estaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white animate-pulse">
              {criticalCount} crítica{criticalCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Badge variant="outline">{activeCount} activa{activeCount !== 1 ? "s" : ""}</Badge>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.type === "critical").length}</p>
                <p className="text-sm text-muted-foreground">Críticas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.type === "warning").length}</p>
                <p className="text-sm text-muted-foreground">Advertencias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.type === "info").length}</p>
                <p className="text-sm text-muted-foreground">Informativas</p>
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
                <p className="text-2xl font-bold">{alerts.filter(a => a.resolvedAt).length}</p>
                <p className="text-sm text-muted-foreground">Resueltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar alertas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="critical">Críticas</SelectItem>
              <SelectItem value="warning">Advertencias</SelectItem>
              <SelectItem value="info">Informativas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="resolved">Resueltas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="font-semibold">Sin alertas</h3>
              <p className="text-sm text-muted-foreground">
                No hay alertas que coincidan con los filtros
              </p>
            </div>
          </Card>
        ) : (
          filteredAlerts.map(alert => (
            <Card key={alert.id} className={`${alert.type === "critical" && !alert.resolvedAt ? "border-red-500" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    alert.type === "critical" ? "bg-red-100 dark:bg-red-900/30" :
                    alert.type === "warning" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                    "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{alert.title}</h3>
                      {getAlertBadge(alert.type)}
                      {alert.resolvedAt && (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resuelta
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{alert.stationName}</span>
                      {alert.connectorId && <span>Conector #{alert.connectorId}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                  {!alert.resolvedAt && (
                    <div className="flex gap-2">
                      {!alert.acknowledged && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Reconocer
                        </Button>
                      )}
                      <Button 
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                      >
                        Resolver
                      </Button>
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
