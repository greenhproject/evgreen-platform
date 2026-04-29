import { useState, useMemo, useEffect, Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  Zap,
  Clock,
  Server,
  Terminal,
  Play,
  Square,
  Unlock,
  Power,
  Settings,
  Send,
  ChevronLeft,
  ChevronRight,
  Filter,
  Copy,
  Link,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  Monitor,
  X,
  ArrowLeft,
  Heart,
  AlertTriangle,
  Cpu,
  Plug,
  MapPin,
  Info,
  Wrench,
  Shield,
  Timer,
  Signal,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminOCPPMonitor() {
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);

  return selectedCharger ? (
    <ChargerDetailView
      ocppIdentity={selectedCharger}
      onBack={() => setSelectedCharger(null)}
    />
  ) : (
    <ChargerGridView onSelectCharger={setSelectedCharger} />
  );
}

// ============================================================================
// CHARGER GRID VIEW - Vista principal con cargadores registrados en BD
// ============================================================================

function ChargerGridView({ onSelectCharger }: { onSelectCharger: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "disconnected">("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "lastActivity">("status");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ocppEndpoints, setOcppEndpoints] = useState<{primary: string, alternative: string} | null>(null);

  // Fetch real OCPP WebSocket URL from server
  useEffect(() => {
    fetch('/api/ocpp/status')
      .then(r => r.json())
      .then(data => {
        if (data?.endpoints) setOcppEndpoints(data.endpoints);
      })
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, refetch, isLoading } = trpc.ocpp.getRegisteredChargers.useQuery(
    { search: debouncedSearch || undefined, status: statusFilter, sortBy },
    { refetchInterval: 5000 }
  );

  const chargers = data?.chargers || [];
  const stats = data?.stats || { total: 0, connected: 0, disconnected: 0, healthy: 0 };

  const formatTimeAgo = (isoDate: string | null) => {
    if (!isoDate) return "Sin actividad";
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return `hace ${diff}s`;
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const getConnectionBadge = (charger: any) => {
    if (charger.connectionSource === "websocket") {
      return <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4">WebSocket</Badge>;
    }
    if (charger.connectionSource === "recent_log") {
      return <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0 h-4">Log reciente</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Desconectado</Badge>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Terminal className="h-5 w-5 sm:h-6 sm:w-6" />
            Monitor OCPP
          </h1>
          <p className="text-muted-foreground">
            Cargadores registrados en la plataforma con estado en tiempo real
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* WebSocket URL Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">URL de Conexión OCPP WebSocket</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Use esta URL para configurar cargadores. Reemplace <code className="bg-muted px-1 rounded">{'{CHARGE_POINT_ID}'}</code> con el identificador del cargador.
                </p>
              </div>
            </div>
            
            {/* URL Principal - Cloud Run directa (funciona con WebSocket) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 text-xs">Recomendada</Badge>
                <span className="text-xs text-muted-foreground">Conexión directa (WebSocket funcional)</span>
              </div>
              <div className="flex items-center gap-2 bg-background border border-green-500/30 rounded-lg px-3 py-2">
                <code className="text-[10px] sm:text-sm font-mono text-primary select-all break-all">
                  {ocppEndpoints?.primary || 'Cargando...'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    const url = ocppEndpoints?.primary?.replace('{chargePointId}', '') || '';
                    navigator.clipboard.writeText(url);
                    toast.success('URL directa copiada al portapapeles');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* URL Alternativa */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Alternativa</Badge>
                <span className="text-xs text-muted-foreground">Ruta /api/ (si la primaria falla)</span>
              </div>
              <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2">
                <code className="text-[10px] sm:text-sm font-mono text-muted-foreground select-all break-all">
                  {ocppEndpoints?.alternative || 'Cargando...'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    const url = ocppEndpoints?.alternative?.replace('{chargePointId}', '') || '';
                    navigator.clipboard.writeText(url);
                    toast.success('URL alternativa copiada al portapapeles');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              El dominio evgreen.lat pasa por Cloudflare que no soporta WebSocket. Use la URL directa de Cloud Run.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registrados</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === "connected" ? "ring-2 ring-green-500" : ""}
              onClick={() => setStatusFilter(statusFilter === "connected" ? "all" : "connected")}
              style={{ cursor: "pointer" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conectados</p>
                <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === "disconnected" ? "ring-2 ring-gray-500" : ""}
              onClick={() => setStatusFilter(statusFilter === "disconnected" ? "all" : "disconnected")}
              style={{ cursor: "pointer" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Desconectados</p>
                <p className="text-2xl font-bold text-gray-600">{stats.disconnected}</p>
              </div>
              <WifiOff className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saludables</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.healthy}</p>
              </div>
              <Heart className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, OCPP ID o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Estado (conectados primero)</SelectItem>
            <SelectItem value="lastActivity">Última actividad</SelectItem>
            <SelectItem value="name">Nombre A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stability Overview */}
      <ConnectionStabilityOverview formatUptime={formatUptime} />

      {/* Charger List */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Cargando estaciones...</p>
        </div>
      ) : chargers.length > 0 ? (
        <div className="space-y-2">
          {chargers.map((charger: any) => (
            <Card
              key={charger.ocppIdentity}
              className={`cursor-pointer transition-all hover:shadow-md ${
                charger.isConnected
                  ? charger.connectionSource === "websocket"
                    ? 'border-l-4 border-l-green-500 hover:border-l-green-600'
                    : 'border-l-4 border-l-yellow-500 hover:border-l-yellow-600'
                  : 'border-l-4 border-l-gray-300 hover:border-l-gray-400'
              }`}
              onClick={() => onSelectCharger(charger.ocppIdentity)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div className="shrink-0">
                    {charger.isConnected ? (
                      charger.connectionSource === "websocket" ? (
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                        </span>
                      ) : (
                        <span className="relative flex h-3 w-3">
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
                        </span>
                      )
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-gray-400 block" />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{charger.name}</h3>
                      <Badge variant="outline" className="text-[10px] font-mono">{charger.ocppIdentity}</Badge>
                      {getConnectionBadge(charger)}
                      {charger.ocppVersion && (
                        <Badge variant="outline" className="text-[10px]">OCPP {charger.ocppVersion}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {charger.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {charger.address}, {charger.city}
                        </span>
                      )}
                      {charger.manufacturer && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Cpu className="h-3 w-3" />
                          {charger.manufacturer} {charger.model || ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: connection details */}
                  <div className="hidden md:flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
                    {charger.isConnected && charger.connectionSource === "websocket" ? (
                      <>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider">Uptime</p>
                          <p className="font-medium text-foreground">{formatUptime(charger.uptimeSeconds || 0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider">Heartbeat</p>
                          <p className="font-medium text-foreground">{charger.lastHeartbeat ? formatTimeAgo(charger.lastHeartbeat) : '-'}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider">Pending</p>
                          <p className="font-medium text-foreground">{charger.pendingCallsCount}</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-wider">Última actividad</p>
                        <p className="font-medium text-foreground">{formatTimeAgo(charger.lastActivity)}</p>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              {search || statusFilter !== "all" ? "No se encontraron cargadores" : "No hay cargadores registrados"}
            </h3>
            <p className="text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Intente con otros filtros o términos de búsqueda"
                : "Los cargadores aparecerán aquí cuando se registren en la plataforma"}
            </p>
            {(search || statusFilter !== "all") && (
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// CHARGER DETAIL VIEW - Vista de detalle con tabs por cargador
// ============================================================================

function ChargerDetailView({
  ocppIdentity,
  onBack,
}: {
  ocppIdentity: string;
  onBack: () => void;
}) {
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [logFilters, setLogFilters] = useState({
    ocppIdentity,
    messageType: "",
    direction: "" as "" | "IN" | "OUT" | undefined,
    limit: 50,
    offset: 0,
  });

  // Datos del cargador en tiempo real
  const { data: chargerDetail, refetch: refetchDetail } = trpc.ocpp.getChargerDetail.useQuery(
    { ocppIdentity },
    { refetchInterval: 3000 }
  );

  // Logs del cargador
  const { data: logsData, refetch: refetchLogs } = trpc.ocpp.getLogs.useQuery({
    ...logFilters,
    direction: logFilters.direction || undefined,
  }, {
    refetchInterval: 5000,
  });

  const { data: messageTypes } = trpc.ocpp.getMessageTypes.useQuery();

  // Mutations
  const resetMutation = trpc.ocpp.sendReset.useMutation({
    onSuccess: () => { toast.success("Comando Reset enviado"); refetchLogs(); refetchDetail(); },
    onError: (err) => toast.error(err.message),
  });
  const unlockMutation = trpc.ocpp.sendUnlockConnector.useMutation({
    onSuccess: () => { toast.success("Comando UnlockConnector enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const triggerMutation = trpc.ocpp.sendTriggerMessage.useMutation({
    onSuccess: () => { toast.success("Comando TriggerMessage enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const changeAvailabilityMutation = trpc.ocpp.sendChangeAvailability.useMutation({
    onSuccess: () => { toast.success("Comando ChangeAvailability enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const getConfigMutation = trpc.ocpp.sendGetConfiguration.useMutation({
    onSuccess: () => { toast.success("GetConfiguration enviado. Revise los logs."); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const changeConfigMutation = trpc.ocpp.sendChangeConfiguration.useMutation({
    onSuccess: () => { toast.success("ChangeConfiguration enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const remoteStartMutation = trpc.ocpp.sendRemoteStart.useMutation({
    onSuccess: () => { toast.success("RemoteStartTransaction enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });
  const remoteStopMutation = trpc.ocpp.sendRemoteStop.useMutation({
    onSuccess: () => { toast.success("RemoteStopTransaction enviado"); refetchLogs(); },
    onError: (err) => toast.error(err.message),
  });

  // Config state
  const [configKey, setConfigKey] = useState("");
  const [configValue, setConfigValue] = useState("");
  const [remoteStartConnector, setRemoteStartConnector] = useState("1");
  const [remoteStartIdTag, setRemoteStartIdTag] = useState("ADMIN");
  const [remoteStopTxId, setRemoteStopTxId] = useState("");

  const isConnected = chargerDetail?.isConnected ?? false;
  const conn = chargerDetail?.connection;
  const station = chargerDetail?.station;

  const getConnectorStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "AVAILABLE": return "bg-green-500";
      case "CHARGING": return "bg-blue-500";
      case "RESERVED": return "bg-cyan-500";
      case "UNAVAILABLE": return "bg-gray-500";
      case "FAULTED": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header con botón volver */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="break-all">{station?.name || ocppIdentity}</span>
              {isConnected ? (
                conn?.isReconnecting ? (
                  <Badge className="bg-yellow-500 text-white animate-pulse">Reconectando</Badge>
                ) : conn?.wsReadyState === 1 ? (
                  <Badge className="bg-green-500 text-white">Conectado</Badge>
                ) : (
                  <Badge className="bg-yellow-500 text-white">Degradado</Badge>
                )
              ) : (
                <Badge variant="secondary">Desconectado</Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              {station?.address ? `${station.address}, ${station.city}` : `OCPP Identity: ${ocppIdentity}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => { refetchDetail(); refetchLogs(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">WebSocket</p>
            <Badge 
              variant={conn?.wsReadyState === 1 ? "default" : conn?.isReconnecting ? "outline" : "destructive"} 
              className={`mt-1 ${conn?.isReconnecting ? 'border-yellow-500 text-yellow-500 animate-pulse' : ''}`}
            >
              {conn?.wsReadyStateLabel || 'CLOSED'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Uptime</p>
            <p className="text-lg font-bold">{conn ? formatUptime(conn.uptimeSeconds) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Heartbeat</p>
            <p className="text-lg font-bold">{conn ? `${conn.heartbeatAgeSeconds}s` : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Pending Calls</p>
            <p className="text-lg font-bold">{conn?.pendingCallsCount ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Protocolo</p>
            <p className="text-lg font-bold">OCPP {conn?.ocppVersion || '1.6'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Connectors row */}
      {chargerDetail?.connectors && chargerDetail.connectors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Conectores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {chargerDetail.connectors.map((c: any) => (
                <div key={c.connectorId} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${getConnectorStatusColor(c.status)}`}>
                    #{c.connectorId}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{c.connectorType || 'Desconocido'}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.status} {c.powerKw ? `· ${c.powerKw} kW` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="monitor" className="text-xs sm:text-sm">
            <Monitor className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Monitor</span>
            <span className="sm:hidden">Mon.</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs sm:text-sm">
            <Terminal className="h-4 w-4 mr-1 sm:mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="commands" className="text-xs sm:text-sm">
            <Send className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Comandos</span>
            <span className="sm:hidden">Cmd</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Configuración</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="stability" className="text-xs sm:text-sm">
            <Signal className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Estabilidad</span>
            <span className="sm:hidden">Estab.</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB: MONITOR ==================== */}
        <TabsContent value="monitor" className="space-y-4">
          {/* Station info from DB */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Información de la Estación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">OCPP Identity</span>
                    <span className="font-mono font-medium">{ocppIdentity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fabricante</span>
                    <span>{station?.manufacturer || conn?.ocppVersion === '2.0.1' ? 'N/A' : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Modelo</span>
                    <span>{station?.model || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Serial</span>
                    <span className="font-mono text-xs">{station?.serialNumber || '-'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Firmware</span>
                    <span>{station?.firmwareVersion || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Último Boot</span>
                    <span className="text-xs">{station?.lastBootNotification ? new Date(station.lastBootNotification).toLocaleString('es-CO') : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Conectado desde</span>
                    <span className="text-xs">{conn?.connectedAt ? new Date(conn.connectedAt).toLocaleString('es-CO') : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total logs</span>
                    <span>{chargerDetail?.totalLogs || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live activity - últimos mensajes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Actividad Reciente
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                </CardTitle>
                <Badge variant="outline" className="text-xs">Auto-refresh 3s</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {chargerDetail?.recentLogs && chargerDetail.recentLogs.length > 0 ? (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {chargerDetail.recentLogs.slice(0, 20).map((log: any) => (
                    <div
                      key={log.id}
                      className={`flex flex-wrap items-center gap-1 sm:gap-2 text-xs font-mono py-1.5 px-2 rounded ${
                        log.direction === 'IN'
                          ? 'bg-green-500/5 text-green-700 dark:text-green-400'
                          : 'bg-blue-500/5 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      <Badge
                        variant={log.direction === 'IN' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                      >
                        {log.direction === 'IN' ? '← IN' : '→ OUT'}
                      </Badge>
                      <span className="text-muted-foreground shrink-0 text-[10px] sm:text-xs">
                        {new Date(log.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{log.messageType}</Badge>
                      <span className="truncate text-muted-foreground w-full sm:w-auto">
                        {typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay actividad reciente para este cargador</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB: LOGS ==================== */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros de Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  value={logFilters.messageType || "all"}
                  onValueChange={(v) => setLogFilters(prev => ({ ...prev, messageType: v === "all" ? "" : v, offset: 0 }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de mensaje" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {messageTypes?.map((type) => (
                      <SelectItem key={type} value={type || ""}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={logFilters.direction || "all"}
                  onValueChange={(v) => setLogFilters(prev => ({ ...prev, direction: v === "all" ? "" : v as "IN" | "OUT", offset: 0 }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dirección" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="IN">Entrante (IN)</SelectItem>
                    <SelectItem value="OUT">Saliente (OUT)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => refetchLogs()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!logsData?.logs?.length) { toast.error("No hay logs"); return; }
                      const lines = logsData.logs.map((log: any) => {
                        const date = new Date(log.createdAt).toLocaleString('es-CO');
                        const dir = log.direction === 'IN' ? '← IN ' : '→ OUT';
                        let payloadStr = '';
                        try { payloadStr = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload, null, 2); } catch { payloadStr = String(log.payload); }
                        return `[${date}] ${dir} | ${log.messageType}\n${payloadStr}`;
                      });
                      const content = `=== EVGreen OCPP Logs - ${ocppIdentity} ===\nExportado: ${new Date().toLocaleString('es-CO')}\nTotal: ${logsData.logs.length} registros\n${'='.repeat(60)}\n\n${lines.join('\n\n' + '-'.repeat(60) + '\n\n')}`;
                      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `ocpp-logs-${ocppIdentity}-${new Date().toISOString().slice(0,10)}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`${logsData.logs.length} logs exportados`);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs - Mobile card view */}
          <div className="sm:hidden space-y-2">
            {logsData?.logs && logsData.logs.length > 0 ? (
              logsData.logs.map((log: any) => {
                const isExpanded = expandedLogId === log.id;
                let formattedPayload = '';
                try {
                  const parsed = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                  formattedPayload = JSON.stringify(parsed, null, 2);
                } catch { formattedPayload = String(log.payload); }
                return (
                  <Card key={log.id} className="cursor-pointer" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.direction === "IN" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {log.direction === "IN" ? "← IN" : "→ OUT"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{log.messageType}</Badge>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('es-CO', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </span>
                      </div>
                      <pre className="text-[10px] font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(log.payload)}
                      </pre>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Payload</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(formattedPayload); toast.success("Copiado"); }}>
                              <Copy className="h-3 w-3 mr-1" /> Copiar
                            </Button>
                          </div>
                          <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                            {formattedPayload}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay logs para este cargador
                </CardContent>
              </Card>
            )}
          </div>

          {/* Logs - Desktop table view */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Fecha/Hora</TableHead>
                      <TableHead className="w-[80px]">Dir</TableHead>
                      <TableHead className="w-[150px]">Mensaje</TableHead>
                      <TableHead>Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.logs && logsData.logs.length > 0 ? (
                      logsData.logs.map((log: any) => {
                        const isExpanded = expandedLogId === log.id;
                        let formattedPayload = '';
                        try {
                          const parsed = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                          formattedPayload = JSON.stringify(parsed, null, 2);
                        } catch { formattedPayload = String(log.payload); }
                        const shortPayload = JSON.stringify(log.payload);
                        return (
                          <Fragment key={log.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            >
                              <TableCell className="text-xs font-mono">
                                {new Date(log.createdAt).toLocaleString('es-CO', {
                                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                                })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={log.direction === "IN" ? "default" : "secondary"}>
                                  {log.direction === "IN" ? "← IN" : "→ OUT"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.messageType}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[400px]">
                                <div className="flex items-center gap-2">
                                  <pre className="text-xs overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                                    {shortPayload}
                                  </pre>
                                  {shortPayload.length > 40 && (
                                    isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/30 p-0">
                                  <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payload completo</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(formattedPayload);
                                          toast.success("Payload copiado");
                                        }}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copiar
                                      </Button>
                                    </div>
                                    <pre className="text-xs font-mono bg-background rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border">
                                      {formattedPayload}
                                    </pre>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No hay logs para este cargador
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Paginación */}
          {logsData && logsData.total > logFilters.limit && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {logFilters.offset + 1}-{Math.min(logFilters.offset + logFilters.limit, logsData.total)} de {logsData.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logFilters.offset === 0}
                  onClick={() => setLogFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logFilters.offset + logFilters.limit >= logsData.total}
                  onClick={() => setLogFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB: COMMANDS ==================== */}
        <TabsContent value="commands" className="space-y-4">
          {!isConnected && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <p className="text-sm">Este cargador no está conectado. Los comandos no se enviarán hasta que se reconecte.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {/* Reset */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Reset
                </CardTitle>
                <CardDescription>Reiniciar el cargador (Soft o Hard)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => resetMutation.mutate({ ocppIdentity, type: "Soft" })}
                    disabled={resetMutation.isPending || !isConnected}
                  >
                    Soft Reset
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => resetMutation.mutate({ ocppIdentity, type: "Hard" })}
                    disabled={resetMutation.isPending || !isConnected}
                  >
                    Hard Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Unlock Connector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Unlock className="h-4 w-4" />
                  Desbloquear Conector
                </CardTitle>
                <CardDescription>Desbloquea un conector específico</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {(chargerDetail?.connectors || [{ connectorId: 1 }]).map((c: any) => (
                    <Button
                      key={c.connectorId}
                      variant="outline"
                      className="flex-1"
                      onClick={() => unlockMutation.mutate({ ocppIdentity, connectorId: c.connectorId })}
                      disabled={unlockMutation.isPending || !isConnected}
                    >
                      <Unlock className="h-3 w-3 mr-1" />
                      Conector #{c.connectorId}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trigger Message */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Trigger Message
                </CardTitle>
                <CardDescription>Solicitar un mensaje específico al cargador</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {(["StatusNotification", "Heartbeat", "MeterValues", "BootNotification"] as const).map((msg) => (
                    <Button
                      key={msg}
                      variant="outline"
                      size="sm"
                      onClick={() => triggerMutation.mutate({ ocppIdentity, requestedMessage: msg, connectorId: 1 })}
                      disabled={triggerMutation.isPending || !isConnected}
                    >
                      {msg.replace(/([A-Z])/g, ' $1').trim()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Change Availability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Cambiar Disponibilidad
                </CardTitle>
                <CardDescription>Cambiar estado de disponibilidad del conector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => changeAvailabilityMutation.mutate({ ocppIdentity, connectorId: 1, type: "Operative" })}
                    disabled={changeAvailabilityMutation.isPending || !isConnected}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Operativo
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => changeAvailabilityMutation.mutate({ ocppIdentity, connectorId: 1, type: "Inoperative" })}
                    disabled={changeAvailabilityMutation.isPending || !isConnected}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Inoperativo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Remote Start Transaction */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  RemoteStartTransaction
                </CardTitle>
                <CardDescription>Iniciar una transacción de carga remotamente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Conector</label>
                    <Input
                      value={remoteStartConnector}
                      onChange={(e) => setRemoteStartConnector(e.target.value)}
                      type="number"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">idTag</label>
                    <Input
                      value={remoteStartIdTag}
                      onChange={(e) => setRemoteStartIdTag(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => remoteStartMutation.mutate({
                    ocppIdentity,
                    connectorId: parseInt(remoteStartConnector) || 1,
                    idTag: remoteStartIdTag || "ADMIN",
                  })}
                  disabled={remoteStartMutation.isPending || !isConnected}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Carga
                </Button>
              </CardContent>
            </Card>

            {/* Remote Stop Transaction */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Square className="h-4 w-4" />
                  RemoteStopTransaction
                </CardTitle>
                <CardDescription>Detener una transacción de carga en curso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Transaction ID</label>
                  <Input
                    value={remoteStopTxId}
                    onChange={(e) => setRemoteStopTxId(e.target.value)}
                    type="number"
                    placeholder="ID de la transacción"
                  />
                </div>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={() => {
                    if (!remoteStopTxId) { toast.error("Ingrese el Transaction ID"); return; }
                    remoteStopMutation.mutate({
                      ocppIdentity,
                      transactionId: parseInt(remoteStopTxId),
                    });
                  }}
                  disabled={remoteStopMutation.isPending || !isConnected || !remoteStopTxId}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Detener Carga
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== TAB: CONFIG ==================== */}
        <TabsContent value="config" className="space-y-4">
          {!isConnected && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <p className="text-sm">Este cargador no está conectado. Los comandos de configuración no se enviarán hasta que se reconecte.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* GetConfiguration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Obtener Configuración
                </CardTitle>
                <CardDescription>
                  La respuesta aparecerá en los logs del cargador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Claves específicas (opcional)</label>
                  <Input
                    placeholder="HeartbeatInterval, MeterValueSampleInterval, ..."
                    value={configKey}
                    onChange={(e) => setConfigKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deje vacío para obtener toda la configuración.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    const keys = configKey.trim() ? configKey.split(',').map(k => k.trim()) : undefined;
                    getConfigMutation.mutate({ ocppIdentity, keys });
                  }}
                  disabled={getConfigMutation.isPending || !isConnected}
                >
                  {getConfigMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Obtener Configuración
                </Button>
              </CardContent>
            </Card>

            {/* ChangeConfiguration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Cambiar Configuración
                </CardTitle>
                <CardDescription>
                  Modifica un parámetro de configuración del cargador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parámetro</label>
                  <Select value={configKey} onValueChange={setConfigKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar parámetro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HeartbeatInterval">HeartbeatInterval</SelectItem>
                      <SelectItem value="MeterValueSampleInterval">MeterValueSampleInterval</SelectItem>
                      <SelectItem value="MeterValuesSampledData">MeterValuesSampledData</SelectItem>
                      <SelectItem value="ClockAlignedDataInterval">ClockAlignedDataInterval</SelectItem>
                      <SelectItem value="ConnectionTimeOut">ConnectionTimeOut</SelectItem>
                      <SelectItem value="LocalPreAuthorize">LocalPreAuthorize</SelectItem>
                      <SelectItem value="LocalAuthorizeOffline">LocalAuthorizeOffline</SelectItem>
                      <SelectItem value="AuthorizeRemoteTxRequests">AuthorizeRemoteTxRequests</SelectItem>
                      <SelectItem value="StopTransactionOnEVSideDisconnect">StopTransactionOnEVSideDisconnect</SelectItem>
                      <SelectItem value="UnlockConnectorOnEVSideDisconnect">UnlockConnectorOnEVSideDisconnect</SelectItem>
                      <SelectItem value="WebSocketPingInterval">WebSocketPingInterval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nuevo valor</label>
                  <Input
                    placeholder="Ingrese el nuevo valor"
                    value={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!configKey || !configValue) { toast.error("Complete todos los campos"); return; }
                    changeConfigMutation.mutate({ ocppIdentity, key: configKey, value: configValue });
                  }}
                  disabled={changeConfigMutation.isPending || !isConnected || !configKey || !configValue}
                >
                  {changeConfigMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Cambiar Configuración
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Referencia de parámetros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referencia de Parámetros OCPP</CardTitle>
              <CardDescription>Parámetros comunes soportados por cargadores OCPP 1.6</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parámetro</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Valor típico</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: "HeartbeatInterval", type: "Integer", desc: "Intervalo entre heartbeats (segundos)", val: "60" },
                      { key: "MeterValueSampleInterval", type: "Integer", desc: "Intervalo de muestreo de medición (segundos)", val: "60" },
                      { key: "MeterValuesSampledData", type: "CSL", desc: "Valores a muestrear", val: "Energy.Active.Import.Register" },
                      { key: "ConnectionTimeOut", type: "Integer", desc: "Tiempo máximo espera conexión vehículo (s)", val: "30" },
                      { key: "StopTransactionOnEVSideDisconnect", type: "Boolean", desc: "Detener al desconectar vehículo", val: "true" },
                      { key: "UnlockConnectorOnEVSideDisconnect", type: "Boolean", desc: "Desbloquear al desconectar vehículo", val: "true" },
                      { key: "WebSocketPingInterval", type: "Integer", desc: "Intervalo de ping WebSocket (s)", val: "30" },
                    ].map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="font-mono text-xs">{p.key}</TableCell>
                        <TableCell className="text-xs">{p.type}</TableCell>
                        <TableCell className="text-xs">{p.desc}</TableCell>
                        <TableCell className="text-xs">{p.val}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB: ESTABILIDAD ==================== */}
        <TabsContent value="stability" className="space-y-4">
          <ConnectionStabilityTab ocppIdentity={ocppIdentity} formatUptime={formatUptime} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


// ============================================================================
// CONNECTION STABILITY TAB - Monitoreo de estabilidad de conexión
// ============================================================================

function ConnectionStabilityTab({ 
  ocppIdentity, 
  formatUptime 
}: { 
  ocppIdentity: string; 
  formatUptime: (s: number) => string;
}) {
  // Reporte de estabilidad general (incluye esta estación)
  const { data: stabilityReport, isLoading: loadingReport } = trpc.ocpp.getConnectionStability.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );

  // Historial de sesiones de conexión de esta estación
  const { data: connectionHistory, isLoading: loadingHistory } = trpc.ocpp.getConnectionHistory.useQuery(
    { ocppIdentity },
    { refetchInterval: 10000 }
  );

  const stationData = stabilityReport?.find((s: any) => s.ocppIdentity === ocppIdentity);

  const getStabilityColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getStabilityBadge = (score: number) => {
    if (score >= 90) return { label: "Excelente", className: "bg-green-500 text-white" };
    if (score >= 70) return { label: "Buena", className: "bg-green-400 text-white" };
    if (score >= 50) return { label: "Regular", className: "bg-yellow-500 text-white" };
    if (score >= 30) return { label: "Inestable", className: "bg-orange-500 text-white" };
    return { label: "Crítica", className: "bg-red-500 text-white" };
  };

  const getCloseCodeLabel = (code: number | null) => {
    if (!code) return "Desconocido";
    switch (code) {
      case 1000: return "Normal";
      case 1001: return "Going Away";
      case 1002: return "Protocol Error";
      case 1003: return "Unsupported Data";
      case 1005: return "No Status";
      case 1006: return "Abnormal Closure";
      case 1007: return "Invalid Data";
      case 1008: return "Policy Violation";
      case 1009: return "Message Too Big";
      case 1010: return "Extension Required";
      case 1011: return "Internal Error";
      case 1012: return "Service Restart";
      case 1013: return "Try Again Later";
      case 1015: return "TLS Handshake Fail";
      default: return `Code ${code}`;
    }
  };

  if (loadingReport || loadingHistory) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando datos de estabilidad...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score de Estabilidad */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Estabilidad de Conexión
          </CardTitle>
          <CardDescription>
            Monitoreo de la calidad y estabilidad de la conexión WebSocket OCPP
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stationData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Score */}
              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Score de Estabilidad</p>
                <p className={`text-4xl font-bold ${getStabilityColor(stationData.stabilityScore)}`}>
                  {stationData.stabilityScore}
                </p>
                <Badge className={`mt-2 ${getStabilityBadge(stationData.stabilityScore).className}`}>
                  {getStabilityBadge(stationData.stabilityScore).label}
                </Badge>
              </div>

              {/* Uptime actual */}
              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Uptime Continuo</p>
                <p className="text-2xl font-bold">
                  {(stationData.isConnected || stationData.isReconnecting) 
                    ? formatUptime(stationData.currentUptimeSeconds) 
                    : '-'}
                </p>
                <Badge 
                  variant={stationData.isConnected ? "default" : stationData.isReconnecting ? "outline" : "secondary"} 
                  className={`mt-2 ${stationData.isReconnecting ? 'border-yellow-500 text-yellow-500 animate-pulse' : ''}`}
                >
                  {stationData.isConnected ? "Conectado" : stationData.isReconnecting ? "Reconectando..." : "Desconectado"}
                </Badge>
              </div>

              {/* Reconexiones seamless vs reales */}
              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Desconexiones Reales (24h)</p>
                <p className={`text-2xl font-bold ${stationData.reconnectionCount24h > 2 ? 'text-red-500' : stationData.reconnectionCount24h > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {stationData.reconnectionCount24h}
                </p>
                {stationData.seamlessReconnections > 0 && (
                  <p className="text-xs text-green-500 mt-2">
                    ⚡ {stationData.seamlessReconnections} reconexiones transparentes
                  </p>
                )}
                {stationData.reconnectionCount24h === 0 && stationData.seamlessReconnections === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Sin desconexiones</p>
                )}
              </div>

              {/* Duración promedio */}
              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Duración Promedio</p>
                <p className="text-2xl font-bold">
                  {stationData.avgSessionDurationSeconds > 0 
                    ? formatUptime(stationData.avgSessionDurationSeconds) 
                    : '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Máx: {stationData.longestSessionSeconds > 0 ? formatUptime(stationData.longestSessionSeconds) : '-'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Signal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay datos de estabilidad disponibles para esta estación.</p>
              <p className="text-xs mt-1">Los datos se generan cuando la estación se conecta al servidor OCPP.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas adicionales */}
      {stationData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Sesión más larga</p>
              </div>
              <p className="text-xl font-bold">
                {stationData.longestSessionSeconds > 0 
                  ? formatUptime(stationData.longestSessionSeconds) 
                  : 'Sin datos'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Sesión más corta</p>
              </div>
              <p className={`text-xl font-bold ${stationData.shortestSessionSeconds > 0 && stationData.shortestSessionSeconds < 300 ? 'text-red-500' : ''}`}>
                {stationData.shortestSessionSeconds > 0 
                  ? formatUptime(stationData.shortestSessionSeconds) 
                  : 'Sin datos'}
              </p>
              {stationData.shortestSessionSeconds > 0 && stationData.shortestSessionSeconds < 300 && (
                <p className="text-xs text-red-400 mt-1">Sesiones menores a 5 min indican inestabilidad</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Última desconexión</p>
              </div>
              <p className="text-sm font-bold">
                {stationData.lastDisconnection 
                  ? new Date(stationData.lastDisconnection).toLocaleString('es-CO')
                  : 'Nunca'}
              </p>
              {stationData.lastCloseCode && (
                <p className="text-xs text-muted-foreground mt-1">
                  Código: {getCloseCodeLabel(stationData.lastCloseCode)} ({stationData.lastCloseCode})
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historial de sesiones de conexión */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Historial de Sesiones de Conexión
          </CardTitle>
          <CardDescription>
            Últimas {connectionHistory?.length || 0} sesiones registradas (máximo 50)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionHistory && connectionHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Conectado</TableHead>
                    <TableHead>Desconectado</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Código Cierre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...connectionHistory].reverse().map((session: any, idx: number) => (
                    <TableRow key={idx} className={session.wasSeamless ? 'opacity-60' : ''}>
                      <TableCell>
                        {session.wasSeamless ? (
                          <Badge variant="outline" className="text-xs border-green-500 text-green-500">
                            ⚡ Transparente
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            ❌ Real
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(session.connectedAt).toLocaleString('es-CO')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {session.disconnectedAt 
                          ? new Date(session.disconnectedAt).toLocaleString('es-CO')
                          : <Badge variant="default" className="text-xs">Activa</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${
                          session.wasSeamless 
                            ? 'text-green-500' 
                            : session.durationSeconds !== null && session.durationSeconds < 300 
                              ? 'text-red-500 font-bold' 
                              : session.durationSeconds !== null && session.durationSeconds > 3600
                                ? 'text-green-500'
                                : ''
                        }`}>
                          {session.durationSeconds !== null ? formatUptime(session.durationSeconds) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          session.wasSeamless ? "outline" :
                          session.closeCode === 1000 ? "default" : 
                          session.closeCode === 1006 ? "destructive" : 
                          "secondary"
                        } className={`text-xs ${session.wasSeamless ? 'border-green-500/50 text-green-500' : ''}`}>
                          {session.wasSeamless ? 'Proxy Cycle' : getCloseCodeLabel(session.closeCode)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay historial de sesiones registrado.</p>
              <p className="text-xs mt-1">El historial se genera automáticamente cuando la estación se conecta y desconecta.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================================
// CONNECTION STABILITY OVERVIEW - Vista global de estabilidad en la grid
// ============================================================================

function ConnectionStabilityOverview({ formatUptime }: { formatUptime: (s: number) => string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: stabilityReport, isLoading } = trpc.ocpp.getConnectionStability.useQuery(
    undefined,
    { refetchInterval: 15000 }
  );

  if (isLoading || !stabilityReport || stabilityReport.length === 0) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500/10";
    if (score >= 50) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  // Calcular promedios globales
  const avgScore = Math.round(
    stabilityReport.reduce((acc: number, s: any) => acc + s.stabilityScore, 0) / stabilityReport.length
  );
  const totalRealReconnections = stabilityReport.reduce((acc: number, s: any) => acc + s.reconnectionCount24h, 0);
  const totalSeamless = stabilityReport.reduce((acc: number, s: any) => acc + (s.seamlessReconnections || 0), 0);
  const unstableStations = stabilityReport.filter((s: any) => s.stabilityScore < 50);
  const reconnectingStations = stabilityReport.filter((s: any) => s.isReconnecting);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm sm:text-base">Estabilidad de Conexiones</CardTitle>
            <Badge variant="outline" className="ml-1 sm:ml-2 text-xs">
              {stabilityReport.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Score:</span>
              <span className={`font-bold text-sm ${getScoreColor(avgScore)}`}>{avgScore}/100</span>
            </div>
            {totalSeamless > 0 && (
              <Badge variant="outline" className="text-[10px] sm:text-xs border-green-500 text-green-500">
                ⚡ {totalSeamless}
              </Badge>
            )}
            {totalRealReconnections > 0 && (
              <Badge variant={totalRealReconnections > 5 ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
                {totalRealReconnections} desc.
              </Badge>
            )}
            {reconnectingStations.length > 0 && (
              <Badge variant="outline" className="text-[10px] sm:text-xs border-yellow-500 text-yellow-500 animate-pulse">
                {reconnectingStations.length} reconect.
              </Badge>
            )}
            {unstableStations.length > 0 && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs">
                {unstableStations.length} inestable{unstableStations.length > 1 ? 's' : ''}
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estación</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Uptime</TableHead>
                  <TableHead className="text-center">Reconexiones (24h)</TableHead>
                  <TableHead className="text-center">Duración Promedio</TableHead>
                  <TableHead className="text-center">Última Desconexión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stabilityReport.map((station: any) => (
                  <TableRow key={station.ocppIdentity}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{station.stationName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{station.ocppIdentity}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={station.isConnected ? "default" : station.isReconnecting ? "outline" : "secondary"} 
                        className={`text-xs ${station.isReconnecting ? 'border-yellow-500 text-yellow-500 animate-pulse' : ''}`}
                      >
                        {station.isConnected ? "Conectado" : station.isReconnecting ? "Reconectando" : "Desconectado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center w-12 h-8 rounded font-bold text-sm ${getScoreBg(station.stabilityScore)} ${getScoreColor(station.stabilityScore)}`}>
                        {station.stabilityScore}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {station.isConnected ? formatUptime(station.currentUptimeSeconds) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div>
                        <span className={`font-bold ${station.reconnectionCount24h > 2 ? 'text-red-500' : station.reconnectionCount24h > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {station.reconnectionCount24h}
                        </span>
                        {station.seamlessReconnections > 0 && (
                          <span className="text-xs text-green-500 ml-1" title="Reconexiones transparentes">
                            (⚡{station.seamlessReconnections})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {station.avgSessionDurationSeconds > 0 
                        ? formatUptime(station.avgSessionDurationSeconds) 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {station.lastDisconnection 
                        ? new Date(station.lastDisconnection).toLocaleString('es-CO', { 
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                          })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
