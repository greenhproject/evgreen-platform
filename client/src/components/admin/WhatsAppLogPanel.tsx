import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
} from "lucide-react";

const EVENT_TYPE_LABELS: Record<string, string> = {
  charge_start: "Inicio de carga",
  charge_end: "Fin de carga",
  charge_reminder: "Recordatorio carga",
  penalty: "Penalización overstay",
  low_balance: "Saldo bajo",
  payment: "Pago",
  welcome: "Bienvenida",
  reservation: "Reserva",
  test: "Prueba",
};

const STATUS_CONFIG = {
  sent: { label: "Enviado", icon: CheckCircle2, variant: "default" as const, color: "text-green-500" },
  delivered: { label: "Entregado", icon: CheckCircle2, variant: "default" as const, color: "text-blue-500" },
  read: { label: "Leído", icon: Eye, variant: "default" as const, color: "text-purple-500" },
  failed: { label: "Error", icon: XCircle, variant: "destructive" as const, color: "text-red-500" },
};

function formatPhone(phone: string) {
  if (phone.startsWith("57") && phone.length === 12) {
    return `+57 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return `+${phone}`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function extractTemplateName(messageBody: string) {
  const match = messageBody.match(/\[template:([^\]]+)\]/);
  return match ? match[1] : null;
}

function extractParams(messageBody: string) {
  const withoutTemplate = messageBody.replace(/\[template:[^\]]+\]\s*/, "");
  return withoutTemplate.split(" | ").filter(Boolean);
}

export function WhatsAppLogPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [eventType, setEventType] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "sent" | "failed" | "delivered" | "read">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch, isFetching } = trpc.settings.getWhatsAppLog.useQuery(
    {
      page,
      pageSize: 50,
      search: search || undefined,
      eventType: eventType !== "all" ? eventType : undefined,
      status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { keepPreviousData: true } as any
  );

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleClearFilters() {
    setSearch("");
    setSearchInput("");
    setEventType("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* Estadísticas rápidas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.sent.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Enviados</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.delivered.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Entregados</div>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.read.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Leídos</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Errores</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1 flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por teléfono o contenido..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-9"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-9 px-3">
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los eventos</SelectItem>
            {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
            <SelectItem value="read">Leído</SelectItem>
            <SelectItem value="failed">Error</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 w-36"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={handleClearFilters} className="h-9 text-muted-foreground">
          Limpiar
        </Button>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-9">
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="w-36">Teléfono</TableHead>
              <TableHead className="w-32">Evento</TableHead>
              <TableHead>Template / Parámetros</TableHead>
              <TableHead className="w-24 text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando historial...
                </TableCell>
              </TableRow>
            ) : !data?.logs.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No hay registros con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              data.logs.map((log) => {
                const statusCfg = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.sent;
                const StatusIcon = statusCfg.icon;
                const templateName = extractTemplateName(log.messageBody);
                const params = extractParams(log.messageBody);
                const eventLabel = EVENT_TYPE_LABELS[log.eventType] ?? log.eventType;

                return (
                  <TableRow key={log.id} className="text-sm">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      {log.userName ? (
                        <div>
                          <div className="font-medium">{log.userName}</div>
                          {log.userEmail && (
                            <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">ID {log.userId ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPhone(log.toPhone)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {eventLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="max-w-xs cursor-default">
                              {templateName && (
                                <div className="font-mono text-xs text-muted-foreground mb-0.5">
                                  {templateName}
                                </div>
                              )}
                              <div className="text-xs truncate">
                                {params.slice(0, 3).join(" · ")}
                                {params.length > 3 && (
                                  <span className="text-muted-foreground"> +{params.length - 3} más</span>
                                )}
                              </div>
                              {log.status === "failed" && log.errorMessage && (
                                <div className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                                  <AlertCircle className="w-3 h-3" />
                                  {log.errorMessage.slice(0, 60)}
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm">
                            <div className="space-y-1">
                              {templateName && (
                                <div className="font-mono text-xs font-bold">{templateName}</div>
                              )}
                              {params.map((p, i) => (
                                <div key={i} className="text-xs">
                                  <span className="text-muted-foreground">P{i + 1}:</span> {p}
                                </div>
                              ))}
                              {log.wamid && (
                                <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                                  WAMID: {log.wamid}
                                </div>
                              )}
                              {log.referenceId && (
                                <div className="text-xs text-muted-foreground">
                                  Ref: {log.referenceType} #{log.referenceId}
                                </div>
                              )}
                              {log.status === "failed" && log.errorMessage && (
                                <div className="text-xs text-red-500 border-t pt-1 mt-1">
                                  Error: {log.errorMessage}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusCfg.variant} className="text-xs gap-1">
                        <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} de{" "}
            {data.total.toLocaleString()} registros
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2">
              Pág. {page} / {data.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages || isFetching}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
