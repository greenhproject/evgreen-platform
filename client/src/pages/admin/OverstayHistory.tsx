/**
 * OverstayHistory - Panel de historial y monitoreo de penalizaciones por ocupación (overstay)
 * 
 * Muestra:
 * - Resumen estadístico (total recaudado, transacciones, promedio)
 * - Sesiones de overstay activas en tiempo real
 * - Historial de transacciones con penalización
 * - Filtros por estación, usuario, y rango de fechas
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  Timer,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Activity,
  Search,
  RefreshCw,
  MapPin,
  User,
  Calendar,
  Loader2,
  Zap,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export default function OverstayHistory() {
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  // Calcular fechas según el rango seleccionado
  const dateFilters = useMemo(() => {
    const now = new Date();
    let startDate: Date | undefined;
    switch (dateRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = undefined;
    }
    return { startDate, endDate: undefined };
  }, [dateRange]);

  // Queries
  const { data: summary, isLoading: loadingSummary } = trpc.overstay.getSummary.useQuery({
    startDate: dateFilters.startDate,
  });

  const { data: activeSessions, isLoading: loadingActive, refetch: refetchActive } = trpc.overstay.getActiveSessions.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = trpc.overstay.getHistory.useQuery({
    stationId: stationFilter !== "all" ? parseInt(stationFilter) : undefined,
    startDate: dateFilters.startDate,
    limit: 200,
  });

  // Obtener lista de estaciones para el filtro
  const { data: stations } = trpc.stations.listPublic.useQuery();

  // Filtrar por búsqueda
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(
      (tx) =>
        tx.userName.toLowerCase().includes(term) ||
        tx.stationName.toLowerCase().includes(term) ||
        tx.id.toString().includes(term)
    );
  }, [history, searchTerm]);

  const handleRefresh = () => {
    refetchActive();
    refetchHistory();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="w-7 h-7 text-amber-500" />
            Penalizaciones por Ocupación
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo y historial de tarifas de ocupación (overstay fees)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Resumen estadístico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total recaudado</p>
                <p className="text-xl font-bold">
                  {loadingSummary ? "..." : formatCurrency(summary?.totalPenalties || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transacciones con overstay</p>
                <p className="text-xl font-bold">
                  {loadingSummary ? "..." : summary?.totalTransactions || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Penalización promedio</p>
                <p className="text-xl font-bold">
                  {loadingSummary ? "..." : formatCurrency(summary?.avgPenalty || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Activity className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sesiones activas ahora</p>
                <p className="text-xl font-bold">
                  {loadingActive ? "..." : activeSessions?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sesiones activas en tiempo real */}
      {activeSessions && activeSessions.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Sesiones de Overstay Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeSessions.map((session: any) => (
                <div
                  key={session.evseId}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{session.stationName}</p>
                      <p className="text-xs text-muted-foreground">
                        <User className="w-3 h-3 inline mr-1" />
                        {session.userName} · Conector {session.connectorId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">
                      {formatCurrency(session.accumulatedCost || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(session.elapsedMinutes || 0)} · {formatCurrency(session.penaltyPerMinute || 0)}/min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desglose por estación */}
      {summary?.byStation && summary.byStation.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Desglose por Estación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.byStation.map((s) => (
                <div key={s.stationId} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{s.stationName}</p>
                    <p className="text-xs text-muted-foreground">{s.count} penalizaciones</p>
                  </div>
                  <p className="font-bold text-amber-600">{formatCurrency(s.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, estación o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={stationFilter} onValueChange={setStationFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas las estaciones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las estaciones</SelectItem>
            {stations?.map((s: any) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="all">Todo el historial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de historial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Historial de Penalizaciones
            {filteredHistory.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredHistory.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <Timer className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No se encontraron penalizaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajusta los filtros o el rango de fechas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estación</TableHead>
                    <TableHead className="text-right">Energía</TableHead>
                    <TableHead className="text-right">Costo energía</TableHead>
                    <TableHead className="text-right">Penalización</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">#{tx.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{tx.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-emerald-500" />
                          <span className="text-sm">{tx.stationName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {tx.kwhConsumed.toFixed(2)} kWh
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(tx.energyCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-red-600">
                          {formatCurrency(tx.overstayCost)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(tx.totalCost)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(tx.endTime)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.status === "COMPLETED" ? "default" : "secondary"}
                          className={tx.status === "COMPLETED" ? "bg-emerald-600" : ""}
                        >
                          {tx.status === "COMPLETED" ? "Completada" : tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
