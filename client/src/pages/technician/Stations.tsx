import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MapPin, Zap, Settings, Eye, Wifi, WifiOff, QrCode, Activity, FileText, Wrench } from "lucide-react";
import { toast } from "sonner";
import { StationQRCode } from "@/components/StationQRCode";

export default function TechnicianStations() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [viewingStation, setViewingStation] = useState<any>(null);
  const [detailsTab, setDetailsTab] = useState("info");
  
  // Obtener todas las estaciones (técnicos pueden ver todas)
  const { data: stations, isLoading } = trpc.stations.listAll.useQuery();
  
  // Obtener conexiones OCPP activas
  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 5000,
  });
  
  // Verificar si una estación está conectada por OCPP
  const isStationConnectedOCPP = (station: any) => {
    if (!ocppConnections) return false;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.some((conn: any) => 
      conn.ocppIdentity === ocppId || 
      conn.stationId === station.id
    );
  };
  
  // Obtener información de conexión OCPP
  const getOCPPConnectionInfo = (station: any) => {
    if (!ocppConnections) return null;
    const ocppId = station.ocppIdentity || station.id?.toString();
    return ocppConnections.find((conn: any) => 
      conn.ocppIdentity === ocppId || 
      conn.stationId === station.id
    );
  };
  
  const getStatusBadge = (station: any) => {
    if (!station.isActive) return <Badge variant="secondary">Inactiva</Badge>;
    
    const isConnected = isStationConnectedOCPP(station);
    
    if (isConnected) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          Conectado
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
        <WifiOff className="w-3 h-3" />
        Desconectado
      </Badge>
    );
  };
  
  const filteredStations = stations?.filter((station) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        station.name.toLowerCase().includes(query) ||
        station.address.toLowerCase().includes(query) ||
        station.city.toLowerCase().includes(query) ||
        (station.ocppIdentity || "").toLowerCase().includes(query)
      );
    }
    return true;
  });
  
  const connectedCount = stations?.filter(s => isStationConnectedOCPP(s)).length || 0;
  const disconnectedCount = (stations?.length || 0) - connectedCount;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Estaciones de Carga</h1>
        <p className="text-muted-foreground">
          Monitoreo y diagnóstico de cargadores
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stations?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{connectedCount}</div>
              <div className="text-sm text-muted-foreground">Conectados</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{disconnectedCount}</div>
              <div className="text-sm text-muted-foreground">Desconectados</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stations?.filter(s => !s.isActive).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Inactivos</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, dirección o ID OCPP..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estación</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Conectores</TableHead>
              <TableHead>Estado OCPP</TableHead>
              <TableHead>Último heartbeat</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Cargando estaciones...
                </TableCell>
              </TableRow>
            ) : filteredStations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay estaciones registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredStations?.map((station) => {
                const connInfo = getOCPPConnectionInfo(station);
                return (
                  <TableRow key={station.id}>
                    <TableCell>
                      <div className="font-medium">{station.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {station.ocppIdentity || `ID: ${station.id}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {station.city}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {station.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{station.evses?.length || 0}</span>
                        <span className="text-muted-foreground ml-1">conectores</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(station)}</TableCell>
                    <TableCell>
                      {connInfo?.lastHeartbeat 
                        ? new Date(connInfo.lastHeartbeat).toLocaleString("es-CO")
                        : "Sin conexión"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Ver detalles"
                          onClick={() => {
                            setViewingStation(station);
                            setShowDetailsDialog(true);
                            setDetailsTab("info");
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Ver logs OCPP"
                          onClick={() => {
                            const ocppId = station.ocppIdentity || station.id;
                            navigate(`/technician/ocpp-monitor?filter=${encodeURIComponent(ocppId)}`);
                          }}
                        >
                          <Activity className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Código QR"
                          onClick={() => {
                            setViewingStation(station);
                            setShowDetailsDialog(true);
                            setDetailsTab("qr");
                          }}
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      
      {/* Modal de detalles con Tabs */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) {
          setViewingStation(null);
          setDetailsTab("info");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {viewingStation?.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span>ID: {viewingStation?.ocppIdentity || 'Sin ID OCPP'}</span>
              {viewingStation && getStatusBadge(viewingStation)}
            </DialogDescription>
          </DialogHeader>

          {viewingStation && (
            <Tabs value={detailsTab} onValueChange={setDetailsTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  Información
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-1">
                  <QrCode className="w-4 h-4" />
                  Código QR
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  Logs OCPP
                </TabsTrigger>
              </TabsList>
              
              {/* Tab de Información */}
              <TabsContent value="info" className="space-y-6 mt-4">
                {/* Estado general */}
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant={viewingStation.isActive ? "default" : "secondary"}>
                    {viewingStation.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                  <Badge variant={viewingStation.isPublic ? "outline" : "secondary"}>
                    {viewingStation.isPublic ? "Pública" : "Privada"}
                  </Badge>
                  {(() => {
                    const connInfo = getOCPPConnectionInfo(viewingStation);
                    if (connInfo) {
                      return (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          OCPP {connInfo.ocppVersion || '1.6'}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Información de ubicación */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Ubicación</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Dirección</p>
                      <p className="font-medium">{viewingStation.address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ciudad</p>
                      <p className="font-medium">{viewingStation.city}, {viewingStation.department}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Coordenadas</p>
                      <p className="font-medium text-sm">
                        {viewingStation.latitude}, {viewingStation.longitude}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ID OCPP</p>
                      <p className="font-medium font-mono">{viewingStation.ocppIdentity || 'Sin asignar'}</p>
                    </div>
                  </div>
                </div>

                {/* Conectores */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Conectores ({viewingStation.evses?.length || 0})
                  </h4>
                  {viewingStation.evses && viewingStation.evses.length > 0 ? (
                    <div className="space-y-2">
                      {viewingStation.evses.map((evse: any, index: number) => (
                        <div 
                          key={evse.id || index} 
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              evse.status === 'AVAILABLE' ? 'bg-green-500/20' : 
                              evse.status === 'CHARGING' ? 'bg-blue-500/20' : 'bg-muted'
                            }`}>
                              <Zap className={`w-5 h-5 ${
                                evse.status === 'AVAILABLE' ? 'text-green-500' : 
                                evse.status === 'CHARGING' ? 'text-blue-500' : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                #{evse.evseIdLocal || index + 1} - {evse.connectorType}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {evse.powerKw} kW • {evse.chargeType}
                              </div>
                            </div>
                          </div>
                          <Badge variant={
                            evse.status === 'AVAILABLE' ? 'default' : 
                            evse.status === 'CHARGING' ? 'secondary' : 'outline'
                          }>
                            {evse.status === 'AVAILABLE' ? 'Disponible' : 
                             evse.status === 'CHARGING' ? 'Cargando' : 
                             evse.status === 'UNAVAILABLE' ? 'No disponible' : evse.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
                      No hay conectores configurados
                    </p>
                  )}
                </div>
              </TabsContent>
              
              {/* Tab de Código QR */}
              <TabsContent value="qr" className="mt-4">
                <StationQRCode 
                  stationCode={viewingStation.ocppIdentity || `ST-${viewingStation.id}`}
                  stationName={viewingStation.name}
                  stationAddress={viewingStation.address}
                />
              </TabsContent>
              
              {/* Tab de Logs OCPP */}
              <TabsContent value="logs" className="space-y-4 mt-4">
                {/* Info de conexión OCPP */}
                {(() => {
                  const connInfo = getOCPPConnectionInfo(viewingStation);
                  if (connInfo) {
                    return (
                      <Card className="bg-green-500/10 border-green-500/30">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Wifi className="w-5 h-5 text-green-500" />
                            <span className="font-semibold text-green-400">Cargador Conectado</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Versión OCPP</p>
                              <p className="font-medium">{connInfo.ocppVersion || '1.6'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Conectado desde</p>
                              <p className="font-medium">
                                {connInfo.connectedAt ? new Date(connInfo.connectedAt).toLocaleString('es-CO') : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Último heartbeat</p>
                              <p className="font-medium">
                                {connInfo.lastHeartbeat ? new Date(connInfo.lastHeartbeat).toLocaleString('es-CO') : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Identidad OCPP</p>
                              <p className="font-medium font-mono text-xs">{connInfo.ocppIdentity}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  }
                  return (
                    <Card className="bg-red-500/10 border-red-500/30">
                      <div className="p-4 flex items-center gap-3">
                        <WifiOff className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="font-semibold text-red-400">Cargador Desconectado</p>
                          <p className="text-sm text-muted-foreground">No hay conexión OCPP activa para este cargador</p>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
                
                {/* Botón para ver logs completos */}
                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full"
                    onClick={() => {
                      const ocppId = viewingStation.ocppIdentity || viewingStation.id;
                      navigate(`/technician/ocpp-monitor?filter=${encodeURIComponent(ocppId)}`);
                      setShowDetailsDialog(false);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver logs completos en Monitor OCPP
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    El monitor OCPP muestra todos los mensajes de comunicación con el cargador
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
