import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function TechnicianAlerts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Datos reales de alertas OCPP
  const { data: alertsData, isLoading, refetch } = trpc.ocpp.getAlerts.useQuery({
    limit: 100,
    offset: 0,
  });

  const { data: alertStats } = trpc.ocpp.getAlertStats.useQuery();

  const acknowledgeMutation = trpc.ocpp.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta reconocida");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const alerts = alertsData || [];

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "MEDIUM":
        return <Bell className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getAlertBadge = (severity: string) => {
    const styles: Record<string, string> = {
      CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      LOW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    const labels: Record<string, string> = {
      CRITICAL: "Crítica",
      HIGH: "Alta",
      MEDIUM: "Media",
      LOW: "Baja",
    };
    return <Badge className={styles[severity] || styles.LOW}>{labels[severity] || severity}</Badge>;
  };

  const handleAcknowledge = (alertId: number) => {
    acknowledgeMutation.mutate({ alertId });
  };

  const filteredAlerts = alerts.filter((alert: any) => {
    if (typeFilter !== "all") {
      const severity = alert.severity || alert.type || "";
      if (severity !== typeFilter) return false;
    }
    if (statusFilter === "active" && alert.acknowledgedAt) return false;
    if (statusFilter === "acknowledged" && !alert.acknowledgedAt) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = (alert.title || alert.alertType || "").toLowerCase().includes(query);
      const matchesDesc = (alert.description || alert.message || "").toLowerCase().includes(query);
      const matchesStation = (alert.stationName || alert.ocppIdentity || "").toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc && !matchesStation) return false;
    }
    return true;
  });

  const activeCount = alerts.filter((a: any) => !a.acknowledgedAt).length;
  const criticalCount = alerts.filter((a: any) => (a.severity === "CRITICAL" || a.severity === "HIGH") && !a.acknowledgedAt).length;

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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
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
                <p className="text-2xl font-bold">{alertStats?.bySeverity?.CRITICAL || 0}</p>
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
                <p className="text-2xl font-bold">{alertStats?.bySeverity?.MEDIUM || 0}</p>
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
                <p className="text-2xl font-bold">{alertStats?.bySeverity?.LOW || 0}</p>
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
                <p className="text-2xl font-bold">{(alertStats?.total || 0) - (alertStats?.unacknowledged || 0)}</p>
                <p className="text-sm text-muted-foreground">Reconocidas</p>
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
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CRITICAL">Críticas</SelectItem>
              <SelectItem value="HIGH">Altas</SelectItem>
              <SelectItem value="MEDIUM">Medias</SelectItem>
              <SelectItem value="LOW">Bajas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="acknowledged">Reconocidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="p-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Cargando alertas...</p>
            </div>
          </Card>
        ) : filteredAlerts.length === 0 ? (
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
          filteredAlerts.map((alert: any) => {
            const severity = alert.severity || "LOW";
            return (
              <Card key={alert.id} className={`${severity === "CRITICAL" && !alert.acknowledgedAt ? "border-red-500" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      severity === "CRITICAL" || severity === "HIGH" ? "bg-red-100 dark:bg-red-900/30" :
                      severity === "MEDIUM" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                      "bg-blue-100 dark:bg-blue-900/30"
                    }`}>
                      {getAlertIcon(severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{alert.title || alert.alertType || "Alerta"}</h3>
                        {getAlertBadge(severity)}
                        {alert.acknowledgedAt && (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Reconocida
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description || alert.message || "Sin descripción"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{alert.stationName || alert.ocppIdentity || `Estación #${alert.stationId}`}</span>
                        {alert.connectorId && <span>Conector #{alert.connectorId}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.createdAt).toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>
                    {!alert.acknowledgedAt && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button 
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          {acknowledgeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Reconocer"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
