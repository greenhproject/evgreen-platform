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

  /**
   * Busca la conexión OCPP activa para una estación.
   * Intenta hacer match por stationId (numérico) Y por ocppIdentity (string).
   * El backend puede devolver stationId como number o como string, así que
   * comparamos ambos. También comparamos con el ocppIdentity de la estación.
   */
  const getStationOCPPInfo = (stationId: number) => {
    if (!ocppConnections) return null;
    
    // Obtener la estación para saber su ocppIdentity
    const station = stations?.find((s: any) => s.id === stationId);
    const stationOcppIdentity = station?.ocppIdentity;
    
    // Buscar por stationId (comparando como string y como number)
    let conn = ocppConnections.find((c: any) => {
      if (c.stationId === stationId) return true;
      if (c.stationId && String(c.stationId) === String(stationId)) return true;
      return false;
    });
    
    // Si no se encontró por stationId, buscar por ocppIdentity
    if (!conn && stationOcppIdentity) {
      conn = ocppConnections.find((c: any) => 
        c.ocppIdentity === stationOcppIdentity
      );
    }
    
    return conn || null;
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
          const vendor = ocppInfo.bootInfo?.vendor || ocppInfo.vendor || "N/A";
          const model = ocppInfo.bootInfo?.model || ocppInfo.model || "N/A";
          return { status: "ok" as const, value: `Conectado (OCPP ${ocppInfo.ocppVersion || "1.6"})`, details: `Vendor: ${vendor}, Model: ${model}` };
        }
      },
      { 
        name: "Último heartbeat", 
        delay: 600,
        check: () => {
          if (!ocppInfo?.lastHeartbeat) return { status: "warning" as const, value: "Sin datos", details: "No se ha recibido heartbeat" };
          const diff = Date.now() - new Date(ocppInfo.lastHeartbeat).getTime();
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor(diff / 1000);
          if (seconds < 60) return { status: "ok" as const, value: `Hace ${seconds}s`, details: `Último: ${new Date(ocppInfo.lastHeartbeat).toLocaleString("es-CO")}` };
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
          const fw = ocppInfo.bootInfo?.firmwareVersion || ocppInfo.firmwareVersion || "Versión actual";
          const serial = ocppInfo.bootInfo?.serialNumber || ocppInfo.serialNumber || "N/A";
          return { status: "ok" as const, value: fw, details: `Serial: ${serial}` };
        }
      },
      { 
        name: "Configuración de red", 
        delay: 700,
        check: () => {
          if (!ocppInfo) return { status: "error" as const, value: "Sin conexión", details: "El cargador no está conectado al servidor OCPP" };
          const cpId = ocppInfo.ocppIdentity || ocppInfo.chargePointId || station?.ocppIdentity || "N/A";
          return { status: "ok" as const, value: "Conectado", details: `ChargePoint ID: ${cpId}` };
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Diagnóstico</h1>
        <p className="text-sm text-muted-foreground">
          Ejecuta diagnósticos en las estaciones de carga
        </p>
      </div>

      {/* Selector de estación y botón */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
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
            className="gradient-primary w-full sm:w-auto"
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{okCount}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Correctos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{warningCount}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Advertencias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{errorCount}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Errores</p>
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
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              Resultados del diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              {results.map((result, index) => (
                <div key={index} className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="shrink-0 mt-0.5 sm:mt-0">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm sm:text-base">{result.name}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground truncate">{result.value}</div>
                    {result.details && (
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">{result.details}</div>
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
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Server className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-sm sm:text-base">Sin diagnósticos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Selecciona una estación y ejecuta un diagnóstico para ver los resultados
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
