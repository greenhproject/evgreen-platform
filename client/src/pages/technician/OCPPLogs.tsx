import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Download, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Terminal,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export default function TechnicianOCPPLogs() {
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [logFilters, setLogFilters] = useState({
    ocppIdentity: "",
    messageType: "",
    direction: "" as "" | "IN" | "OUT" | undefined,
    limit: 50,
    offset: 0,
  });

  // Datos reales desde la API
  const { data: logsData, refetch: refetchLogs } = trpc.ocpp.getLogs.useQuery({
    ...logFilters,
    direction: logFilters.direction || undefined,
  }, {
    refetchInterval: 10000,
  });

  const { data: messageTypes } = trpc.ocpp.getMessageTypes.useQuery();

  const handleExport = () => {
    if (!logsData?.logs?.length) {
      toast.error("No hay logs para exportar");
      return;
    }
    const lines = logsData.logs.map((log: any) => {
      const date = new Date(log.createdAt).toLocaleString('es-CO');
      const dir = log.direction === 'IN' ? '← IN ' : '→ OUT';
      let payloadStr = '';
      try {
        payloadStr = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload, null, 2);
      } catch { payloadStr = String(log.payload); }
      return `[${date}] ${dir} | ${log.ocppIdentity} | ${log.messageType}\n${payloadStr}`;
    });
    const content = `=== EVGreen OCPP Logs (Técnico) ===\nExportado: ${new Date().toLocaleString('es-CO')}\nTotal: ${logsData.logs.length} registros\n${'='.repeat(60)}\n\n${lines.join('\n\n' + '-'.repeat(60) + '\n\n')}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocpp-logs-tecnico-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${logsData.logs.length} logs exportados correctamente`);
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
          <Button variant="outline" onClick={() => refetchLogs()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Descargar Logs
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {logsData?.logs?.filter((l: any) => l.direction === "IN").length || 0}
                </p>
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
                <p className="text-2xl font-bold">
                  {logsData?.logs?.filter((l: any) => l.direction === "OUT").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Salientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logsData?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              value={logFilters.messageType || "all"}
              onValueChange={(v) => setLogFilters(prev => ({ ...prev, messageType: v === "all" ? "" : v, offset: 0 }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de mensaje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {messageTypes?.map((type: string) => (
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
              <Input
                placeholder="Buscar en payload..."
                className="flex-1"
                onChange={(e) => {
                  // Client-side search hint
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Mensajes OCPP
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Haz clic en una fila para ver el payload completo)
            </span>
          </CardTitle>
        </CardHeader>
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
                  logsData.logs.map((log: any) => {
                    const isExpanded = expandedLogId === log.id;
                    let formattedPayload = '';
                    try {
                      const parsed = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                      formattedPayload = JSON.stringify(parsed, null, 2);
                    } catch {
                      formattedPayload = String(log.payload);
                    }
                    const shortPayload = JSON.stringify(log.payload);
                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        >
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
                          <TableCell className="max-w-[400px]">
                            <div className="flex items-center gap-2">
                              <pre className="text-xs overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                                {shortPayload}
                              </pre>
                              {shortPayload.length > 40 && (
                                isExpanded
                                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${log.id}-expanded`}>
                            <TableCell colSpan={5} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Payload completo
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(formattedPayload);
                                      toast.success("Payload copiado al portapapeles");
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
                      </>
                    );
                  })
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
    </div>
  );
}
