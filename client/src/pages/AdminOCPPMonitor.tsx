import { useState, useMemo, Fragment } from "react";
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
// CHARGER GRID VIEW - Vista principal con tarjetas de cargadores
// ============================================================================

function ChargerGridView({ onSelectCharger }: { onSelectCharger: (id: string) => void }) {
  const { data: diagnostics, refetch: refetchDiag } = trpc.ocpp.getDiagnostics.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: stats } = trpc.ocpp.getConnectionStats.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: allStations } = trpc.ocpp.getChargePointIds.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Combinar cargadores conectados + registrados en BD
  const chargers = useMemo(() => {
    const map = new Map<string, any>();

    // Primero: cargadores registrados en BD (pueden estar offline)
    if (allStations) {
      for (const cpId of allStations) {
        if (cpId) {
          map.set(cpId, {
            ocppIdentity: cpId,
            isConnected: false,
            stationName: cpId,
            connectors: [],
          });
        }
      }
    }

    // Luego: sobrescribir con datos de diagnóstico en tiempo real
    if (diagnostics) {
      for (const diag of diagnostics) {
        map.set(diag.ocppIdentity, {
          ...diag,
          isConnected: true,
        });
      }
    }

    return Array.from(map.values());
  }, [diagnostics, allStations]);

  const connectedCount = chargers.filter(c => c.isConnected).length;
  const offlineCount = chargers.filter(c => !c.isConnected).length;

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Terminal className="h-6 w-6" />
            Monitor OCPP
          </h1>
          <p className="text-muted-foreground">
            Seleccione un cargador para ver su detalle y opciones de control
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchDiag()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* WebSocket URL Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">URL de Conexión OCPP WebSocket</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Use esta URL para configurar cargadores. Reemplace <code className="bg-muted px-1 rounded">{'{ID}'}</code> con el identificador del cargador.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2">
              <code className="text-sm font-mono text-primary select-all">
                wss://www.evgreen.lat/api/ocpp/ws/{'{CHARGE_POINT_ID}'}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText('wss://www.evgreen.lat/api/ocpp/ws/');
                  toast.success('URL copiada al portapapeles');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{chargers.length}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conectados</p>
                <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Desconectados</p>
                <p className="text-2xl font-bold text-gray-600">{offlineCount}</p>
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
                <p className="text-2xl font-bold text-emerald-600">
                  {diagnostics?.filter(d => d.isHealthy).length || 0}
                </p>
              </div>
              <Heart className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charger Cards Grid */}
      {chargers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chargers
            .sort((a, b) => (b.isConnected ? 1 : 0) - (a.isConnected ? 1 : 0))
            .map((charger) => (
            <Card
              key={charger.ocppIdentity}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] ${
                charger.isConnected
                  ? charger.isHealthy
                    ? 'border-green-500/50 hover:border-green-500'
                    : 'border-yellow-500/50 hover:border-yellow-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => onSelectCharger(charger.ocppIdentity)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {charger.isConnected ? (
                      charger.isHealthy ? (
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                        </span>
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-gray-400" />
                    )}
                    <Zap className="h-4 w-4 text-primary" />
                    {charger.ocppIdentity}
                  </CardTitle>
                  {charger.isConnected && (
                    <Badge variant="outline" className="text-xs">
                      OCPP {charger.ocppVersion || '1.6'}
                    </Badge>
                  )}
                </div>
                {charger.stationName && charger.stationName !== charger.ocppIdentity && (
                  <CardDescription className="text-xs truncate">
                    {charger.stationName}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Manufacturer/Model */}
                {charger.manufacturer && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Cpu className="h-3 w-3" />
                    {charger.manufacturer} {charger.model || ''}
                  </div>
                )}

                {/* Address */}
                {charger.address && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {charger.address}
                  </div>
                )}

                {/* Connection info */}
                {charger.isConnected ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Uptime: {formatUptime(charger.uptimeSeconds || 0)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      HB: {charger.heartbeatAgeSeconds != null ? `${charger.heartbeatAgeSeconds}s` : '-'}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Monitor className="h-3 w-3" />
                      WS: <Badge variant={charger.wsReadyState === 1 ? "default" : "destructive"} className="text-[10px] px-1 py-0 h-4">
                        {charger.wsReadyStateLabel || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Send className="h-3 w-3" />
                      Pending: {charger.pendingCallsCount || 0}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    Sin conexión WebSocket activa
                  </div>
                )}

                {/* Connectors */}
                {charger.connectors && charger.connectors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {charger.connectors.map((conn: any) => (
                      <Badge
                        key={conn.connectorId}
                        variant="outline"
                        className={`text-[10px] ${getConnectorStatusColor(conn.status)} text-white border-0`}
                      >
                        <Plug className="h-2.5 w-2.5 mr-0.5" />
                        #{conn.connectorId} {conn.status} {conn.powerKw ? `(${conn.powerKw}kW)` : ''}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Click hint */}
                <div className="flex items-center justify-end text-xs text-muted-foreground pt-1">
                  <Eye className="h-3 w-3 mr-1" />
                  Ver detalle
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay cargadores registrados</h3>
            <p className="text-muted-foreground">
              Los cargadores aparecerán aquí cuando se conecten al servidor OCPP o se registren en la plataforma
            </p>
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
    <div className="space-y-6">
      {/* Header con botón volver */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              {station?.name || ocppIdentity}
              {isConnected ? (
                conn?.isHealthy ? (
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">WebSocket</p>
            <Badge variant={conn?.wsReadyState === 1 ? "default" : "destructive"} className="mt-1">
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="monitor">
            <Monitor className="h-4 w-4 mr-2" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="commands">
            <Send className="h-4 w-4 mr-2" />
            Comandos
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
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
                      className={`flex items-center gap-2 text-xs font-mono py-1.5 px-2 rounded ${
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
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{log.messageType}</Badge>
                      <span className="truncate text-muted-foreground">
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

          {/* Tabla de Logs */}
          <Card>
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {logFilters.offset + 1} - {Math.min(logFilters.offset + logFilters.limit, logsData.total)} de {logsData.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logFilters.offset === 0}
                  onClick={() => setLogFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logFilters.offset + logFilters.limit >= logsData.total}
                  onClick={() => setLogFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                >
                  Siguiente
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

          <div className="grid gap-4 md:grid-cols-2">
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
      </Tabs>
    </div>
  );
}
