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
  Filter
} from "lucide-react";

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
        <TabsList>
          <TabsTrigger value="connections">
            <Wifi className="h-4 w-4 mr-2" />
            Conexiones Activas
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Terminal className="h-4 w-4 mr-2" />
            Logs OCPP
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
                          {Object.entries(conn.connectorStatuses).map(([id, status]) => (
                            <Badge 
                              key={id} 
                              variant="outline"
                              className={`text-xs ${getConnectorStatusColor(status)} text-white border-0`}
                            >
                              #{id}: {status}
                            </Badge>
                          ))}
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
      </Tabs>
    </div>
  );
}
