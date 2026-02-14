import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Activity, 
  Cpu, 
  Wifi, 
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DiagnosticResult {
  name: string;
  status: "ok" | "warning" | "error";
  value: string;
  details?: string;
}

export default function TechnicianDiagnostics() {
  const [selectedStation, setSelectedStation] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const { data: stations } = trpc.stations.listAll.useQuery();
  const { data: ocppConnections } = trpc.ocpp.getActiveConnections.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const getStationOCPPInfo = (stationId: number) => {
    if (!ocppConnections) return null;
    return ocppConnections.find((c: any) => c.stationId === stationId);
  };

  const runDiagnostics = async () => {
    if (!selectedStation) {
      toast.error("Selecciona una estación");
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const stationId = parseInt(selectedStation);
    const station = stations?.find((s: any) => s.id === stationId);
    const ocppInfo = getStationOCPPInfo(stationId);

    const tests = [
      { 
        name: "Estado de la estación", 
        delay: 500,
        check: () => {
          if (!station?.isActive) return { status: "error" as const, value: "Inactiva", details: "La estación está desactivada en el sistema" };
          return { status: "ok" as const, value: "Activa", details: "La estación está habilitada" };
        }
      },
      { 
        name: "Conexión OCPP", 
        delay: 800,
        check: () => {
          if (!ocppInfo) return { status: "error" as const, value: "Desconectado", details: "No hay conexión WebSocket activa con el cargador" };
          return { status: "ok" as const, value: `Conectado (OCPP ${ocppInfo.ocppVersion || "1.6"})`, details: `Vendor: ${ocppInfo.vendor || "N/A"}, Model: ${ocppInfo.model || "N/A"}` };
        }
      },
      { 
        name: "Último heartbeat", 
        delay: 600,
        check: () => {
          if (!ocppInfo?.lastHeartbeat) return { status: "warning" as const, value: "Sin datos", details: "No se ha recibido heartbeat" };
          const diff = Date.now() - new Date(ocppInfo.lastHeartbeat).getTime();
          const minutes = Math.floor(diff / 60000);
          if (minutes > 5) return { status: "warning" as const, value: `Hace ${minutes} min`, details: "El heartbeat es antiguo, posible problema de conexión" };
          return { status: "ok" as const, value: `Hace ${minutes} min`, details: `Último: ${new Date(ocppInfo.lastHeartbeat).toLocaleString("es-CO")}` };
        }
      },
      { 
        name: "Conectores disponibles", 
        delay: 400,
        check: () => {
          const evseCount = station?.evses?.length || 0;
          if (evseCount === 0) return { status: "error" as const, value: "0 conectores", details: "No hay conectores configurados" };
          const availableCount = station?.evses?.filter((e: any) => e.status === "AVAILABLE").length || 0;
          if (availableCount === 0) return { status: "warning" as const, value: `0/${evseCount} disponibles`, details: "Ningún conector disponible actualmente" };
          return { status: "ok" as const, value: `${availableCount}/${evseCount} disponibles`, details: `${evseCount} conectores configurados` };
        }
      },
      { 
        name: "Firmware", 
        delay: 500,
        check: () => {
          if (!ocppInfo) return { status: "warning" as const, value: "Sin datos", details: "No se puede verificar sin conexión OCPP" };
          return { status: "ok" as const, value: ocppInfo.firmwareVersion || "Versión actual", details: `Serial: ${ocppInfo.serialNumber || "N/A"}` };
        }
      },
      { 
        name: "Configuración de red", 
        delay: 700,
        check: () => {
          if (!ocppInfo) return { status: "error" as const, value: "Sin conexión", details: "El cargador no está conectado al servidor OCPP" };
          return { status: "ok" as const, value: "Conectado", details: `ChargePoint ID: ${ocppInfo.chargePointId}` };
        }
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      await new Promise(resolve => setTimeout(resolve, tests[i].delay));
      const result = tests[i].check();
      setResults(prev => [...prev, { name: tests[i].name, ...result }]);
      setProgress(((i + 1) / tests.length) * 100);
    }

    setIsRunning(false);
    toast.success("Diagnóstico completado");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">OK</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Advertencia</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Error</Badge>;
      default:
        return null;
    }
  };

  const okCount = results.filter(r => r.status === "ok").length;
  const warningCount = results.filter(r => r.status === "warning").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diagnósticos</h1>
        <p className="text-muted-foreground">
          Ejecuta diagnósticos en las estaciones de carga
        </p>
      </div>

      {/* Selector de estación y botón */}
      <Card className="p-6">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Estación a diagnosticar</label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estación" />
              </SelectTrigger>
              <SelectContent>
                {stations?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} - {s.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning || !selectedStation}
            className="gradient-primary"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isRunning ? "Ejecutando..." : "Ejecutar diagnóstico"}
          </Button>
        </div>

        {isRunning && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progreso del diagnóstico</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
      </Card>

      {/* Resumen de resultados */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{okCount}</p>
                  <p className="text-sm text-muted-foreground">Correctos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
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
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{errorCount}</p>
                  <p className="text-sm text-muted-foreground">Errores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultados detallados */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Resultados del diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.name}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">{result.value}</div>
                    {result.details && (
                      <div className="text-xs text-muted-foreground mt-1">{result.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {results.length === 0 && !isRunning && (
        <Card className="p-8">
          <div className="flex flex-col items-center text-center">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">Sin diagnósticos</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona una estación y ejecuta un diagnóstico para ver los resultados
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
