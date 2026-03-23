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
  RefreshCw,
  History,
  Zap,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Mapeo de severidad del backend (lowercase) a labels y estilos del frontend
const SEVERITY_CONFIG: Record<string, {
  label: string;
  icon: string;
  badgeClass: string;
  bgClass: string;
  iconColor: string;
}> = {
  critical: {
    label: "Crítica",
    icon: "alert-triangle",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-500",
  },
  warning: {
    label: "Advertencia",
    icon: "bell",
    badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-500",
  },
  info: {
    label: "Informativa",
    icon: "bell",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-500",
  },
};

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity?.toLowerCase()] || SEVERITY_CONFIG.info;
}

export default function TechnicianAlerts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  // Datos reales de alertas OCPP activas
  const { data: alertsData, isLoading, refetch } = trpc.ocpp.getAlerts.useQuery({
    limit: 100,
    offset: 0,
    includeAcknowledged: activeTab === "active" ? false : true,
  });

  // Historial de alertas resueltas
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = trpc.ocpp.getAlertHistory.useQuery({
    limit: 100,
    offset: 0,
  });

  const { data: alertStats, refetch: refetchStats } = trpc.ocpp.getAlertStats.useQuery();

  const acknowledgeMutation = trpc.ocpp.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta reconocida");
      refetch();
      refetchStats();
      refetchHistory();
    },
    onError: (err) => toast.error(err.message),
  });

  const currentAlerts = activeTab === "active" ? (alertsData || []) : (historyData || []);
  const currentLoading = activeTab === "active" ? isLoading : historyLoading;

  const getAlertIcon = (severity: string) => {
    const config = getSeverityConfig(severity);
    if (config.iconColor === "text-red-500") {
      return <AlertTriangle className={`w-5 h-5 ${config.iconColor}`} />;
    }
    return <Bell className={`w-5 h-5 ${config.iconColor}`} />;
  };

  const getAlertBadge = (severity: string) => {
    const config = getSeverityConfig(severity);
    return <Badge className={config.badgeClass}>{config.label}</Badge>;
  };

  const handleAcknowledge = (alertId: number) => {
    acknowledgeMutation.mutate({ alertId });
  };

  const handleRefresh = () => {
    refetch();
    refetchHistory();
    refetchStats();
    toast.success("Alertas actualizadas");
  };

  const filteredAlerts = currentAlerts.filter((alert: any) => {
    if (severityFilter !== "all") {
      const severity = (alert.severity || "").toLowerCase();
      if (severity !== severityFilter) return false;
    }
    if (activeTab === "active") {
      if (statusFilter === "active" && alert.acknowledgedAt) return false;
      if (statusFilter === "acknowledged" && !alert.acknowledgedAt) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = (alert.title || alert.alertType || "").toLowerCase().includes(query);
      const matchesDesc = (alert.description || alert.message || "").toLowerCase().includes(query);
      const matchesStation = (alert.stationName || alert.ocppIdentity || "").toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc && !matchesStation) return false;
    }
    return true;
  });

  // Contadores usando valores lowercase del backend
  const activeCount = (alertsData || []).filter((a: any) => !a.acknowledgedAt && !a.resolvedAt).length;
  const criticalCount = alertStats?.bySeverity?.critical || 0;
  const warningCount = alertStats?.bySeverity?.warning || 0;
  const infoCount = alertStats?.bySeverity?.info || 0;
  const autoResolvedCount = alertStats?.autoResolved || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Alertas</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona alertas de las estaciones OCPP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
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

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
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
                <p className="text-2xl font-bold">{warningCount}</p>
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
                <p className="text-2xl font-bold">{infoCount}</p>
                <p className="text-sm text-muted-foreground">Informativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{autoResolvedCount}</p>
                <p className="text-sm text-muted-foreground">Auto-resueltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Activas / Historial */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "active" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("active")}
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          Alertas Activas
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">{activeCount}</Badge>
          )}
        </Button>
        <Button
          variant={activeTab === "history" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("history")}
          className="gap-2"
        >
          <History className="w-4 h-4" />
          Historial
        </Button>
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
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Críticas</SelectItem>
              <SelectItem value="warning">Advertencias</SelectItem>
              <SelectItem value="info">Informativas</SelectItem>
            </SelectContent>
          </Select>
          {activeTab === "active" && (
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
          )}
        </div>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-4">
        {currentLoading ? (
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
              <h3 className="font-semibold">
                {activeTab === "active" ? "Sin alertas activas" : "Sin historial"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "active" 
                  ? "No hay alertas que coincidan con los filtros" 
                  : "No hay alertas resueltas en el historial"}
              </p>
            </div>
          </Card>
        ) : (
          filteredAlerts.map((alert: any) => {
            const severity = (alert.severity || "info").toLowerCase();
            const config = getSeverityConfig(severity);
            const isAutoResolved = alert.autoResolved;
            const isResolved = !!alert.resolvedAt;
            
            return (
              <Card 
                key={alert.id} 
                className={`transition-all ${
                  severity === "critical" && !alert.acknowledgedAt && !isResolved
                    ? "border-red-500 border-l-4" 
                    : isResolved 
                      ? "opacity-80 border-l-4 border-green-500" 
                      : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isResolved ? "bg-green-100 dark:bg-green-900/30" : config.bgClass
                    }`}>
                      {isResolved ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        getAlertIcon(severity)
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{alert.title || alert.alertType || "Alerta"}</h3>
                        {getAlertBadge(severity)}
                        {isAutoResolved && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto-resuelta
                          </Badge>
                        )}
                        {alert.acknowledgedAt && !isAutoResolved && (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Reconocida
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description || alert.message || "Sin descripción"}
                      </p>
                      {isAutoResolved && alert.resolvedReason && (
                        <p className="text-xs text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {alert.resolvedReason}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{alert.stationName || alert.ocppIdentity || `Estación #${alert.stationId}`}</span>
                        {alert.alertType && (
                          <Badge variant="secondary" className="text-xs">{alert.alertType}</Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.createdAt).toLocaleString("es-CO")}
                        </span>
                        {alert.resolvedAt && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Resuelta: {new Date(alert.resolvedAt).toLocaleString("es-CO")}
                          </span>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledgedAt && !isResolved && (
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
