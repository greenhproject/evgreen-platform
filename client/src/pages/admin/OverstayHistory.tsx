/**
 * OverstayHistory - Panel de historial y gestión de penalizaciones por ocupación (overstay)
 * 
 * Muestra:
 * - Resumen estadístico (total recaudado, transacciones, promedio)
 * - Sesiones de overstay activas en tiempo real con opción de finalizar remotamente
 * - Historial de transacciones con penalización
 * - Acciones: cancelar penalización, ajustar monto, finalizar sesión fantasma
 * - Filtros por estación, usuario, y rango de fechas
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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
  MoreHorizontal,
  XCircle,
  Edit3,
  Power,
  Ban,
  RotateCcw,
  Shield,
  AlertTriangle,
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

type HistoryItem = {
  id: number;
  userId: number;
  userName: string;
  stationId: number;
  stationName: string;
  startTime: any;
  endTime: any;
  kwhConsumed: number;
  energyCost: number;
  overstayCost: number;
  totalCost: number;
  status: string;
};

export default function OverstayHistory() {
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");


  // Dialog states
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; tx: HistoryItem | null }>({ open: false, tx: null });
  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; tx: HistoryItem | null }>({ open: false, tx: null });
  const [forceEndDialog, setForceEndDialog] = useState<{ open: boolean; session: any | null }>({ open: false, session: null });
  const [cancelReason, setCancelReason] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [forceEndReason, setForceEndReason] = useState("");
  const [forceEndCancelPenalty, setForceEndCancelPenalty] = useState(true);

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

  const { data: stations } = trpc.stations.listPublic.useQuery();

  // Mutations
  // @ts-ignore - mutations added dynamically
  const cancelPenalty = (trpc.overstay as any).cancelPenalty.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Penalización cancelada. Se reembolsaron ${formatCurrency(data.refundedAmount)} al usuario.`);
      setCancelDialog({ open: false, tx: null });
      setCancelReason("");
      refetchHistory();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al cancelar penalización");
    },
  });

  // @ts-ignore - mutations added dynamically
  const adjustPenalty = (trpc.overstay as any).adjustPenalty.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Penalización ajustada: ${formatCurrency(data.previousAmount)} → ${formatCurrency(data.newAmount)}. Reembolso: ${formatCurrency(data.refundedAmount)}`);
      setAdjustDialog({ open: false, tx: null });
      setAdjustReason("");
      setAdjustAmount("");
      refetchHistory();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al ajustar penalización");
    },
  });

  // @ts-ignore - mutations added dynamically
  const forceEndSession = (trpc.overstay as any).forceEndSession.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Sesión finalizada remotamente: ${data.actions.join(". ")}`);
      setForceEndDialog({ open: false, session: null });
      setForceEndReason("");
      refetchActive();
      refetchHistory();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al finalizar sesión");
    },
  });

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
            Monitoreo, gestión y resolución de tarifas de ocupación (overstay fees)
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
              <Badge variant="destructive" className="ml-2">{activeSessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeSessions.map((session: any) => (
                <div
                  key={session.evseId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-background border gap-3"
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
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-600">
                        {formatCurrency(session.accumulatedCost || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(session.elapsedMinutes || 0)} · {formatCurrency(session.penaltyPerMinute || 0)}/min
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setForceEndDialog({ open: true, session });
                        setForceEndReason("");
                        setForceEndCancelPenalty(true);
                      }}
                    >
                      <Power className="w-4 h-4 mr-1" />
                      Finalizar
                    </Button>
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
                    <TableHead className="w-[60px] text-center">Acciones</TableHead>
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
                        <span className={`font-semibold ${tx.overstayCost > 0 ? "text-red-600" : "text-muted-foreground line-through"}`}>
                          {formatCurrency(tx.overstayCost)}
                        </span>
                        {tx.overstayCost === 0 && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 text-green-600 border-green-600/30">
                            Cancelada
                          </Badge>
                        )}
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
                      <TableCell className="text-center">
                        {tx.overstayCost > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setCancelDialog({ open: true, tx });
                                  setCancelReason("");
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Cancelar penalización
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setAdjustDialog({ open: true, tx });
                                  setAdjustReason("");
                                  setAdjustAmount("");
                                }}
                              >
                                <Edit3 className="w-4 h-4 mr-2 text-amber-500" />
                                Ajustar monto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== DIALOG: Cancelar Penalización ========== */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open, tx: open ? cancelDialog.tx : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Cancelar Penalización
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Se cancelará la penalización de <strong className="text-red-600">{formatCurrency(cancelDialog.tx?.overstayCost || 0)}</strong> para
                  el usuario <strong>{cancelDialog.tx?.userName}</strong> (Tx #{cancelDialog.tx?.id}).
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    El monto será reembolsado a la billetera del usuario y las deudas asociadas serán condonadas.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Motivo de la cancelación *</Label>
                  <Textarea
                    id="cancel-reason"
                    placeholder="Ej: Corte de energía en la estación, falso positivo por reconexión..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelReason.length < 3 || cancelPenalty.isPending}
              onClick={() => {
                if (cancelDialog.tx) {
                  cancelPenalty.mutate({
                    transactionId: cancelDialog.tx.id,
                    reason: cancelReason,
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelPenalty.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Cancelar y Reembolsar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== DIALOG: Ajustar Penalización ========== */}
      <Dialog open={adjustDialog.open} onOpenChange={(open) => setAdjustDialog({ open, tx: open ? adjustDialog.tx : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-500" />
              Ajustar Penalización
            </DialogTitle>
            <DialogDescription>
              Reducir el monto de la penalización para el usuario {adjustDialog.tx?.userName} (Tx #{adjustDialog.tx?.id}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Monto actual:</span>
              <span className="font-bold text-red-600">{formatCurrency(adjustDialog.tx?.overstayCost || 0)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-amount">Nuevo monto (COP) *</Label>
              <Input
                id="new-amount"
                type="number"
                min={0}
                max={(adjustDialog.tx?.overstayCost || 0) - 1}
                placeholder="Ej: 3000"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
              {adjustAmount && adjustDialog.tx && (
                <p className="text-xs text-muted-foreground">
                  Reembolso: <strong className="text-green-600">{formatCurrency(adjustDialog.tx.overstayCost - Number(adjustAmount))}</strong>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Motivo del ajuste *</Label>
              <Textarea
                id="adjust-reason"
                placeholder="Ej: Corte parcial de energía, tiempo de gracia insuficiente..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog({ open: false, tx: null })}>
              Cancelar
            </Button>
            <Button
              disabled={
                !adjustAmount ||
                Number(adjustAmount) < 0 ||
                Number(adjustAmount) >= (adjustDialog.tx?.overstayCost || 0) ||
                adjustReason.length < 3 ||
                adjustPenalty.isPending
              }
              onClick={() => {
                if (adjustDialog.tx) {
                  adjustPenalty.mutate({
                    transactionId: adjustDialog.tx.id,
                    newOverstayCost: Number(adjustAmount),
                    reason: adjustReason,
                  });
                }
              }}
            >
              {adjustPenalty.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Edit3 className="w-4 h-4 mr-2" />
              )}
              Ajustar y Reembolsar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DIALOG: Finalizar Sesión Remotamente ========== */}
      <AlertDialog open={forceEndDialog.open} onOpenChange={(open) => setForceEndDialog({ open, session: open ? forceEndDialog.session : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-red-500" />
              Finalizar Sesión Remotamente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Se finalizará la sesión de overstay en <strong>{forceEndDialog.session?.stationName}</strong> (Conector {forceEndDialog.session?.connectorId}).
                </p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Usuario:</span>
                    <span className="font-medium">{forceEndDialog.session?.userName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Penalización acumulada:</span>
                    <span className="font-bold text-red-600">{formatCurrency(forceEndDialog.session?.accumulatedCost || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tiempo en overstay:</span>
                    <span>{formatDuration(forceEndDialog.session?.elapsedMinutes || 0)}</span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                    Se enviará RemoteStop + Reset al cargador, se liberará el conector y se marcará como disponible.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="cancel-penalty-check"
                    checked={forceEndCancelPenalty}
                    onChange={(e) => setForceEndCancelPenalty(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="cancel-penalty-check" className="text-sm font-normal cursor-pointer">
                    Cancelar penalización y reembolsar al usuario (recomendado para cortes de luz)
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="force-end-reason">Motivo *</Label>
                  <Textarea
                    id="force-end-reason"
                    placeholder="Ej: Corte de energía, cargador colgado, sesión fantasma por reconexión..."
                    value={forceEndReason}
                    onChange={(e) => setForceEndReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={forceEndReason.length < 3 || forceEndSession.isPending}
              onClick={() => {
                if (forceEndDialog.session) {
                  forceEndSession.mutate({
                    evseId: forceEndDialog.session.evseId,
                    transactionId: forceEndDialog.session.transactionId,
                    reason: forceEndReason,
                    cancelPenalty: forceEndCancelPenalty,
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {forceEndSession.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Power className="w-4 h-4 mr-2" />
              )}
              Finalizar Sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
