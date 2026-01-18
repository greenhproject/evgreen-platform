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
  HardDrive, 
  Thermometer, 
  Wifi, 
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Server
} from "lucide-react";
import { toast } from "sonner";

interface DiagnosticResult {
  name: string;
  status: "ok" | "warning" | "error";
  value: string;
  details?: string;
}

export default function TechnicianDiagnostics() {
  const [selectedStation, setSelectedStation] = useState("1");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const tests = [
      { name: "Conexión de red", delay: 500 },
      { name: "Estado del servidor OCPP", delay: 800 },
      { name: "Temperatura del sistema", delay: 600 },
      { name: "Memoria disponible", delay: 400 },
      { name: "Estado de conectores", delay: 700 },
      { name: "Firmware", delay: 500 },
      { name: "Medidor de energía", delay: 600 },
      { name: "Sistema de pago", delay: 800 },
    ];

    for (let i = 0; i < tests.length; i++) {
      await new Promise(resolve => setTimeout(resolve, tests[i].delay));
      setProgress(((i + 1) / tests.length) * 100);
      
      // Simular resultados aleatorios
      const statuses: ("ok" | "warning" | "error")[] = ["ok", "ok", "ok", "warning"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      setResults(prev => [...prev, {
        name: tests[i].name,
        status,
        value: status === "ok" ? "Funcionando correctamente" : 
               status === "warning" ? "Requiere atención" : "Error detectado",
        details: status === "warning" ? "Se recomienda revisión preventiva" : undefined,
      }]);
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
    const styles: Record<string, string> = {
      ok: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      ok: "OK",
      warning: "Advertencia",
      error: "Error",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico de Estaciones</h1>
          <p className="text-muted-foreground">
            Ejecuta pruebas de diagnóstico en las estaciones
          </p>
        </div>
      </div>

      {/* Selector de estación */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Seleccionar estación</label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una estación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Green EV Mosquera - Sede Principal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="gradient-primary"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Iniciar diagnóstico
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Progreso */}
      {isRunning && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Ejecutando diagnóstico...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </Card>
      )}

      {/* Métricas en tiempo real */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conexión</p>
                <p className="text-lg font-bold text-green-500">En línea</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Temperatura</p>
                <p className="text-lg font-bold">42°C</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPU</p>
                <p className="text-lg font-bold">23%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Almacenamiento</p>
                <p className="text-lg font-bold">67%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Resultados del diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.name}</p>
                      {result.details && (
                        <p className="text-sm text-muted-foreground">{result.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{result.value}</span>
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resumen */}
            <div className="mt-6 p-4 rounded-lg bg-muted/30 border">
              <h4 className="font-semibold mb-2">Resumen</h4>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>{results.filter(r => r.status === "ok").length} OK</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span>{results.filter(r => r.status === "warning").length} Advertencias</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>{results.filter(r => r.status === "error").length} Errores</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de diagnósticos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Historial de diagnósticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium">Diagnóstico completo</p>
                  <p className="text-sm text-muted-foreground">Hace 2 días</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-700">8/8 OK</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium">Diagnóstico completo</p>
                  <p className="text-sm text-muted-foreground">Hace 1 semana</p>
                </div>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700">7/8 OK, 1 Advertencia</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
