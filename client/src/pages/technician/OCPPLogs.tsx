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
  Search, 
  Download, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Filter,
  Terminal
} from "lucide-react";
import { toast } from "sonner";

interface OCPPLog {
  id: number;
  timestamp: Date;
  direction: "in" | "out";
  messageType: string;
  action: string;
  stationId: string;
  payload: string;
  status: "success" | "error" | "pending";
}

// Datos de ejemplo
const mockLogs: OCPPLog[] = [
  {
    id: 1,
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
    direction: "in",
    messageType: "CALL",
    action: "Heartbeat",
    stationId: "GEV-MOSQUERA-001",
    payload: "{}",
    status: "success",
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    direction: "out",
    messageType: "CALLRESULT",
    action: "Heartbeat",
    stationId: "GEV-MOSQUERA-001",
    payload: '{"currentTime": "2026-01-18T05:52:00Z"}',
    status: "success",
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    direction: "in",
    messageType: "CALL",
    action: "StatusNotification",
    stationId: "GEV-MOSQUERA-001",
    payload: '{"connectorId": 1, "status": "Available", "errorCode": "NoError"}',
    status: "success",
  },
  {
    id: 4,
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
    direction: "in",
    messageType: "CALL",
    action: "MeterValues",
    stationId: "GEV-MOSQUERA-001",
    payload: '{"connectorId": 1, "meterValue": [{"timestamp": "2026-01-18T05:45:00Z", "sampledValue": [{"value": "0", "unit": "Wh"}]}]}',
    status: "success",
  },
  {
    id: 5,
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    direction: "out",
    messageType: "CALL",
    action: "RemoteStartTransaction",
    stationId: "GEV-MOSQUERA-001",
    payload: '{"connectorId": 1, "idTag": "USER123"}',
    status: "pending",
  },
];

export default function TechnicianOCPPLogs() {
  const [logs, setLogs] = useState<OCPPLog[]>(mockLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [isLive, setIsLive] = useState(false);

  const getDirectionIcon = (direction: string) => {
    return direction === "in" ? (
      <ArrowDownLeft className="w-4 h-4 text-blue-500" />
    ) : (
      <ArrowUpRight className="w-4 h-4 text-green-500" />
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  const filteredLogs = logs.filter(log => {
    if (directionFilter !== "all" && log.direction !== directionFilter) return false;
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (searchQuery && !log.payload.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !log.action.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  const handleExport = () => {
    toast.success("Logs exportados correctamente");
  };

  const toggleLive = () => {
    setIsLive(!isLive);
    toast.info(isLive ? "Modo en vivo desactivado" : "Modo en vivo activado");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs OCPP</h1>
          <p className="text-muted-foreground">
            Monitorea la comunicación OCPP con las estaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isLive ? "default" : "outline"}
            onClick={toggleLive}
            className={isLive ? "bg-green-500 hover:bg-green-600" : ""}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLive ? "animate-spin" : ""}`} />
            {isLive ? "En vivo" : "Activar en vivo"}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.direction === "in").length}</p>
                <p className="text-sm text-muted-foreground">Entrantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.direction === "out").length}</p>
                <p className="text-sm text-muted-foreground">Salientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.status === "success").length}</p>
                <p className="text-sm text-muted-foreground">Exitosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.status === "error").length}</p>
                <p className="text-sm text-muted-foreground">Errores</p>
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
              placeholder="Buscar en logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Dirección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="in">Entrantes</SelectItem>
              <SelectItem value="out">Salientes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Mensajes OCPP
            {isLive && (
              <Badge className="bg-green-500 text-white animate-pulse ml-2">
                En vivo
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            {filteredLogs.map(log => (
              <div 
                key={log.id}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  {getDirectionIcon(log.direction)}
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.timestamp).toLocaleTimeString("es-CO")}
                  </span>
                  <Badge variant="outline">{log.messageType}</Badge>
                  <span className="font-semibold">{log.action}</span>
                  <span className="text-muted-foreground text-xs">{log.stationId}</span>
                  <div className="ml-auto">
                    {getStatusBadge(log.status)}
                  </div>
                </div>
                <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(JSON.parse(log.payload), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
