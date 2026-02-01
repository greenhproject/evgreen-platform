import { useState, useEffect } from "react";
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
  Calendar
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

// Registrar componentes de Chart.js
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

export default function AdminOCPPMonitor() {
  const [selectedCharger, setSelectedCharger] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState({
    ocppIdentity: "",
    messageType: "",
    direction: "" as "" | "IN" | "OUT" | undefined,
    limit: 50,
    offset: 0,
  });

  // Queries
  const { data: connections, refetch: refetchConnections } = trpc.ocpp.getActiveConnections.useQuery(
    undefined,
    { refetchInterval: 5000 } // Actualizar cada 5 segundos
  );
  
  const { data: stats, refetch: refetchStats } = trpc.ocpp.getConnectionStats.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );
  
  const { data: logsData, refetch: refetchLogs } = trpc.ocpp.getLogs.useQuery({
    ...logFilters,
    direction: logFilters.direction || undefined,
  }, {
    refetchInterval: 10000,
  });
  
  const { data: messageTypes } = trpc.ocpp.getMessageTypes.useQuery();

  // Mutations
  const resetMutation = trpc.ocpp.sendReset.useMutation({
    onSuccess: () => {
      toast.success("Comando Reset enviado");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  const unlockMutation = trpc.ocpp.sendUnlockConnector.useMutation({
    onSuccess: () => {
      toast.success("Comando UnlockConnector enviado");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerMutation = trpc.ocpp.sendTriggerMessage.useMutation({
    onSuccess: () => {
      toast.success("Comando TriggerMessage enviado");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeAvailabilityMutation = trpc.ocpp.sendChangeAvailability.useMutation({
    onSuccess: () => {
      toast.success("Comando ChangeAvailability enviado");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  const getConfigMutation = trpc.ocpp.sendGetConfiguration.useMutation({
    onSuccess: () => {
      toast.success("Comando GetConfiguration enviado. Revise los logs para ver la respuesta.");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeConfigMutation = trpc.ocpp.sendChangeConfiguration.useMutation({
    onSuccess: () => {
      toast.success("Comando ChangeConfiguration enviado");
      refetchLogs();
    },
    onError: (err) => toast.error(err.message),
  });

  // Estado para configuración remota
  const [configCharger, setConfigCharger] = useState<string>("");
  const [configKey, setConfigKey] = useState<string>("");
  const [configValue, setConfigValue] = useState<string>("");

  // Estado para métricas históricas
  const [metricsRange, setMetricsRange] = useState<"24h" | "7d" | "30d">("24h");
  const [metricsGranularity, setMetricsGranularity] = useState<"hour" | "day">("hour");

  // Calcular fechas para métricas
  const getMetricsDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    switch (metricsRange) {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
    }
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  const metricsDates = getMetricsDates();

  // Query para métricas de conexiones
  const { data: connectionMetrics } = trpc.ocpp.getConnectionMetrics.useQuery({
    startDate: metricsDates.startDate,
    endDate: metricsDates.endDate,
    granularity: metricsRange === "24h" ? "hour" : "day",
  }, {
    refetchInterval: 60000, // Actualizar cada minuto
  });

  // Query para métricas de transacciones
  const { data: transactionMetrics } = trpc.ocpp.getTransactionMetrics.useQuery({
    startDate: metricsDates.startDate,
    endDate: metricsDates.endDate,
    granularity: metricsRange === "24h" ? "hour" : "day",
  }, {
    refetchInterval: 60000,
  });

  // Formatear tiempo relativo
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  };

  // Obtener color del estado del conector
  const getConnectorStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "available": return "bg-green-500";
      case "preparing": return "bg-yellow-500";
      case "charging": return "bg-blue-500";
      case "suspendedev":
      case "suspendedevse": return "bg-orange-500";
      case "finishing": return "bg-purple-500";
      case "reserved": return "bg-cyan-500";
      case "unavailable": return "bg-gray-500";
      case "faulted": return "bg-red-500";
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
            Monitoreo en tiempo real de cargadores conectados
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchConnections();
            refetchStats();
            refetchLogs();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* WebSocket URL Card - Para soporte y configuración */}
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
            <div className="flex flex-col sm:flex-row gap-2">
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
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Protocolos soportados:</p>
                <p className="mt-1">OCPP 1.6J (ocpp1.6) y OCPP 2.0.1 (ocpp2.0.1)</p>
                <p className="mt-2"><strong>Ejemplo:</strong> Para un cargador con ID "CP001", la URL sería: <code className="bg-background px-1 rounded">wss://www.evgreen.lat/api/ocpp/ws/CP001</code></p>
              </div>
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
                <p className="text-sm text-muted-foreground">Conectados</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.connectedCount || 0}
                </p>
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
                <p className="text-2xl font-bold text-gray-600">
                  {stats?.disconnectedCount || 0}
                </p>
              </div>
              <WifiOff className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">OCPP 1.6</p>
                <p className="text-2xl font-bold">
                  {stats?.byVersion?.["1.6"] || 0}
                </p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">OCPP 2.0.1</p>
                <p className="text-2xl font-bold">
                  {stats?.byVersion?.["2.0.1"] || 0}
                </p>
              </div>
              <Server className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="connections">
            <Wifi className="h-4 w-4 mr-2" />
            Conexiones
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </TabsTrigger>
        </TabsList>

        {/* Conexiones Activas */}
        <TabsContent value="connections" className="space-y-4">
          {connections && connections.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map((conn) => (
                <Card key={conn.ocppIdentity} className={`${conn.isConnected ? 'border-green-500/50' : 'border-gray-300'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {conn.isConnected ? (
                          <Wifi className="h-5 w-5 text-green-500" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-gray-400" />
                        )}
                        {conn.ocppIdentity}
                      </CardTitle>
                      <Badge variant={conn.isConnected ? "default" : "secondary"}>
                        OCPP {conn.ocppVersion}
                      </Badge>
                    </div>
                    {conn.bootInfo && (
                      <CardDescription>
                        {conn.bootInfo.vendor} - {conn.bootInfo.model}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Conectado: {formatRelativeTime(conn.connectedAt)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        Heartbeat: {formatRelativeTime(conn.lastHeartbeat)}
                      </div>
                    </div>

                    {/* Connector Statuses */}
                    {Object.keys(conn.connectorStatuses).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Conectores:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(conn.connectorStatuses || {}).map(([id, statusVal]) => {
                            const status = String(statusVal);
                            return (
                              <Badge 
                                key={id} 
                                variant="outline"
                                className={`text-xs ${getConnectorStatusColor(status)} text-white border-0`}
                              >
                                #{id}: {status}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {conn.isConnected && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Power className="h-3 w-3 mr-1" />
                              Reset
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reiniciar Cargador</DialogTitle>
                              <DialogDescription>
                                Enviar comando Reset a {conn.ocppIdentity}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => resetMutation.mutate({ 
                                  ocppIdentity: conn.ocppIdentity, 
                                  type: "Soft" 
                                })}
                                disabled={resetMutation.isPending}
                              >
                                Soft Reset
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => resetMutation.mutate({ 
                                  ocppIdentity: conn.ocppIdentity, 
                                  type: "Hard" 
                                })}
                                disabled={resetMutation.isPending}
                              >
                                Hard Reset
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerMutation.mutate({
                            ocppIdentity: conn.ocppIdentity,
                            requestedMessage: "StatusNotification",
                            connectorId: 1,
                          })}
                          disabled={triggerMutation.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Status
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unlockMutation.mutate({
                            ocppIdentity: conn.ocppIdentity,
                            connectorId: 1,
                          })}
                          disabled={unlockMutation.isPending}
                        >
                          <Unlock className="h-3 w-3 mr-1" />
                          Unlock
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay cargadores conectados</h3>
                <p className="text-muted-foreground">
                  Los cargadores aparecerán aquí cuando se conecten al servidor OCPP
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Endpoint: wss://www.evgreen.lat/api/ocpp/ws/&#123;chargePointId&#125;
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Logs OCPP */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Charge Point ID"
                  value={logFilters.ocppIdentity}
                  onChange={(e) => setLogFilters(prev => ({ ...prev, ocppIdentity: e.target.value, offset: 0 }))}
                />
                <Select
                  value={logFilters.messageType}
                  onValueChange={(v) => setLogFilters(prev => ({ ...prev, messageType: v === "all" ? "" : v, offset: 0 }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de mensaje" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
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
                <Button variant="outline" onClick={() => refetchLogs()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
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
                      <TableHead className="w-[100px]">Dirección</TableHead>
                      <TableHead className="w-[120px]">Charge Point</TableHead>
                      <TableHead className="w-[150px]">Mensaje</TableHead>
                      <TableHead>Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.logs && logsData.logs.length > 0 ? (
                      logsData.logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs font-mono">
                            {new Date(log.createdAt).toLocaleString('es-CO', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.direction === "IN" ? "default" : "secondary"}>
                              {log.direction === "IN" ? "← IN" : "→ OUT"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ocppIdentity}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.messageType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <pre className="text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                              {JSON.stringify(log.payload)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay logs que mostrar
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

        {/* Configuración Remota */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* GetConfiguration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Obtener Configuración
                </CardTitle>
                <CardDescription>
                  Solicita la configuración actual del cargador. La respuesta aparecerá en los logs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargador</label>
                  <Select
                    value={configCharger}
                    onValueChange={setConfigCharger}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cargador conectado" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections?.filter(c => c.isConnected).map((conn) => (
                        <SelectItem key={conn.ocppIdentity} value={conn.ocppIdentity}>
                          {conn.ocppIdentity} - {conn.bootInfo?.vendor || 'Desconocido'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Claves específicas (opcional)</label>
                  <Input
                    placeholder="HeartbeatInterval, MeterValueSampleInterval, ..."
                    value={configKey}
                    onChange={(e) => setConfigKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deje vacío para obtener toda la configuración, o ingrese claves separadas por coma.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!configCharger) {
                      toast.error("Seleccione un cargador");
                      return;
                    }
                    const keys = configKey.trim() ? configKey.split(',').map(k => k.trim()) : undefined;
                    getConfigMutation.mutate({
                      ocppIdentity: configCharger,
                      keys,
                    });
                  }}
                  disabled={getConfigMutation.isPending || !configCharger}
                >
                  {getConfigMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Obtener Configuración
                </Button>
              </CardContent>
            </Card>

            {/* ChangeConfiguration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Cambiar Configuración
                </CardTitle>
                <CardDescription>
                  Modifica un parámetro de configuración del cargador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargador</label>
                  <Select
                    value={configCharger}
                    onValueChange={setConfigCharger}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cargador conectado" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections?.filter(c => c.isConnected).map((conn) => (
                        <SelectItem key={conn.ocppIdentity} value={conn.ocppIdentity}>
                          {conn.ocppIdentity} - {conn.bootInfo?.vendor || 'Desconocido'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Clave de configuración</label>
                  <Select
                    value={configKey}
                    onValueChange={setConfigKey}
                  >
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
                      <SelectItem value="StopTransactionOnInvalidId">StopTransactionOnInvalidId</SelectItem>
                      <SelectItem value="UnlockConnectorOnEVSideDisconnect">UnlockConnectorOnEVSideDisconnect</SelectItem>
                      <SelectItem value="WebSocketPingInterval">WebSocketPingInterval</SelectItem>
                      <SelectItem value="TransactionMessageAttempts">TransactionMessageAttempts</SelectItem>
                      <SelectItem value="TransactionMessageRetryInterval">TransactionMessageRetryInterval</SelectItem>
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
                    if (!configCharger || !configKey || !configValue) {
                      toast.error("Complete todos los campos");
                      return;
                    }
                    changeConfigMutation.mutate({
                      ocppIdentity: configCharger,
                      key: configKey,
                      value: configValue,
                    });
                  }}
                  disabled={changeConfigMutation.isPending || !configCharger || !configKey || !configValue}
                >
                  {changeConfigMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Cambiar Configuración
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Referencia de parámetros comunes */}
          <Card>
            <CardHeader>
              <CardTitle>Referencia de Parámetros OCPP</CardTitle>
              <CardDescription>
                Parámetros de configuración comunes soportados por la mayoría de cargadores OCPP 1.6
              </CardDescription>
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
                    <TableRow>
                      <TableCell className="font-mono">HeartbeatInterval</TableCell>
                      <TableCell>Integer</TableCell>
                      <TableCell>Intervalo entre heartbeats (segundos)</TableCell>
                      <TableCell>60</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">MeterValueSampleInterval</TableCell>
                      <TableCell>Integer</TableCell>
                      <TableCell>Intervalo de muestreo de valores de medición (segundos)</TableCell>
                      <TableCell>60</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">MeterValuesSampledData</TableCell>
                      <TableCell>CSL</TableCell>
                      <TableCell>Valores a muestrear (Energy.Active.Import.Register, Power.Active.Import, etc.)</TableCell>
                      <TableCell>Energy.Active.Import.Register</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">ConnectionTimeOut</TableCell>
                      <TableCell>Integer</TableCell>
                      <TableCell>Tiempo máximo de espera para conexión de vehículo (segundos)</TableCell>
                      <TableCell>30</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">LocalPreAuthorize</TableCell>
                      <TableCell>Boolean</TableCell>
                      <TableCell>Permitir autorización local antes de enviar al servidor</TableCell>
                      <TableCell>true</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">StopTransactionOnEVSideDisconnect</TableCell>
                      <TableCell>Boolean</TableCell>
                      <TableCell>Detener transacción cuando el vehículo se desconecta</TableCell>
                      <TableCell>true</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">UnlockConnectorOnEVSideDisconnect</TableCell>
                      <TableCell>Boolean</TableCell>
                      <TableCell>Desbloquear conector cuando el vehículo se desconecta</TableCell>
                      <TableCell>true</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">WebSocketPingInterval</TableCell>
                      <TableCell>Integer</TableCell>
                      <TableCell>Intervalo de ping WebSocket (segundos)</TableCell>
                      <TableCell>30</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Métricas Históricas */}
        <TabsContent value="metrics" className="space-y-6">
          {/* Selector de rango */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Métricas Históricas
              </h3>
              <p className="text-sm text-muted-foreground">Tendencias de conexiones y transacciones</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={metricsRange === "24h" ? "default" : "outline"}
                size="sm"
                onClick={() => setMetricsRange("24h")}
              >
                24 horas
              </Button>
              <Button
                variant={metricsRange === "7d" ? "default" : "outline"}
                size="sm"
                onClick={() => setMetricsRange("7d")}
              >
                7 días
              </Button>
              <Button
                variant={metricsRange === "30d" ? "default" : "outline"}
                size="sm"
                onClick={() => setMetricsRange("30d")}
              >
                30 días
              </Button>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Gráfico de Conexiones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Conexiones OCPP
                </CardTitle>
                <CardDescription>
                  Número de conexiones activas por {metricsRange === "24h" ? "hora" : "día"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {connectionMetrics && connectionMetrics.length > 0 ? (
                  <div className="h-[300px]">
                    <Line
                      data={{
                        labels: connectionMetrics.map((m: any) => {
                          const date = new Date(m.period);
                          return metricsRange === "24h"
                            ? date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                            : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
                        }),
                        datasets: [
                          {
                            label: "Conexiones",
                            data: connectionMetrics.map((m: any) => m.count),
                            borderColor: "rgb(34, 197, 94)",
                            backgroundColor: "rgba(34, 197, 94, 0.1)",
                            fill: true,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay datos de conexiones en este período</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Transacciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Transacciones de Carga
                </CardTitle>
                <CardDescription>
                  Transacciones completadas por {metricsRange === "24h" ? "hora" : "día"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionMetrics && transactionMetrics.length > 0 ? (
                  <div className="h-[300px]">
                    <Bar
                      data={{
                        labels: transactionMetrics.map((m: any) => {
                          const date = new Date(m.period);
                          return metricsRange === "24h"
                            ? date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                            : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
                        }),
                        datasets: [
                          {
                            label: "Transacciones",
                            data: transactionMetrics.map((m: any) => m.count),
                            backgroundColor: "rgba(59, 130, 246, 0.8)",
                            borderRadius: 4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay transacciones en este período</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Energía */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Energía Entregada (kWh)
                </CardTitle>
                <CardDescription>
                  Total de kWh entregados por {metricsRange === "24h" ? "hora" : "día"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionMetrics && transactionMetrics.length > 0 ? (
                  <div className="h-[300px]">
                    <Line
                      data={{
                        labels: transactionMetrics.map((m: any) => {
                          const date = new Date(m.period);
                          return metricsRange === "24h"
                            ? date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                            : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
                        }),
                        datasets: [
                          {
                            label: "kWh",
                            data: transactionMetrics.map((m: any) => Number(m.totalKwh || 0).toFixed(2)),
                            borderColor: "rgb(168, 85, 247)",
                            backgroundColor: "rgba(168, 85, 247, 0.1)",
                            fill: true,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay datos de energía en este período</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Ingresos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Ingresos (COP)
                </CardTitle>
                <CardDescription>
                  Ingresos totales por {metricsRange === "24h" ? "hora" : "día"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionMetrics && transactionMetrics.length > 0 ? (
                  <div className="h-[300px]">
                    <Bar
                      data={{
                        labels: transactionMetrics.map((m: any) => {
                          const date = new Date(m.period);
                          return metricsRange === "24h"
                            ? date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
                            : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
                        }),
                        datasets: [
                          {
                            label: "Ingresos",
                            data: transactionMetrics.map((m: any) => Number(m.totalRevenue || 0)),
                            backgroundColor: "rgba(34, 197, 94, 0.8)",
                            borderRadius: 4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => `$${Number(value).toLocaleString()}`,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay datos de ingresos en este período</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumen de métricas */}
          {transactionMetrics && transactionMetrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen del Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {transactionMetrics.reduce((sum: number, m: any) => sum + (m.count || 0), 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Transacciones</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {transactionMetrics.reduce((sum: number, m: any) => sum + Number(m.totalKwh || 0), 0).toFixed(1)} kWh
                    </p>
                    <p className="text-sm text-muted-foreground">Energía Entregada</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      ${transactionMetrics.reduce((sum: number, m: any) => sum + Number(m.totalRevenue || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {connectionMetrics ? connectionMetrics.reduce((sum: number, m: any) => sum + (m.count || 0), 0) : 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Conexiones Totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
