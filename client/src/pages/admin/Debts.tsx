/**
 * AdminDebts - Panel de gestión de deudas de usuarios
 * 
 * Muestra:
 * - Resumen estadístico (total pendiente, pagado, condonado)
 * - Tabla de deudas con filtros por estado y razón
 * - Acciones: cobro manual, cobro desde billetera, condonar
 * - Búsqueda por nombre, email o teléfono
 */
import { useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  DollarSign,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Wallet,
  CreditCard,
  ShieldOff,
  TrendingUp,
  Clock,
  Hash,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const REASON_LABELS: Record<string, string> = {
  OVERSTAY: "Ocupación",
  INSUFFICIENT_BALANCE: "Saldo insuficiente",
  CANCELLATION_FEE: "Tarifa cancelación",
  NO_SHOW: "No presentado",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagada",
  WAIVED: "Condonada",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-red-500/10 text-red-500 border-red-500/20",
  PARTIAL: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  PAID: "bg-green-500/10 text-green-500 border-green-500/20",
  WAIVED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString("es-CO")} COP`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDebts() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Modal states
  const [manualPayDialog, setManualPayDialog] = useState<{ open: boolean; debtId: number; amount: number } | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [waiveDialog, setWaiveDialog] = useState<{ open: boolean; debtId: number; amount: number; userName: string } | null>(null);
  const [walletChargeDialog, setWalletChargeDialog] = useState<{ open: boolean; debtId: number; amount: number; userName: string } | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.debts.adminStats.useQuery(undefined, {
    staleTime: 30_000,
  });

  const { data: debtsData, isLoading: debtsLoading, refetch } = trpc.debts.adminListAll.useQuery(
    {
      status: statusFilter,
      reason: reasonFilter,
      search,
      limit: pageSize,
      offset: page * pageSize,
    },
    { staleTime: 15_000 }
  );

  // Mutations
  const waiveMutation = trpc.debts.waiveDebt.useMutation({
    onSuccess: () => {
      toast.success("Deuda condonada exitosamente");
      utils.debts.adminListAll.invalidate();
      utils.debts.adminStats.invalidate();
      setWaiveDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const manualPayMutation = trpc.debts.adminManualPay.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.debts.adminListAll.invalidate();
      utils.debts.adminStats.invalidate();
      setManualPayDialog(null);
      setPaymentRef("");
    },
    onError: (err) => toast.error(err.message),
  });

  const walletChargeMutation = trpc.debts.adminChargeFromWallet.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.debts.adminListAll.invalidate();
      utils.debts.adminStats.invalidate();
      setWalletChargeDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const debts = debtsData?.debts || [];
  const total = debtsData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Deudas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra las deudas pendientes de los usuarios por ocupación, saldo insuficiente y penalizaciones.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendiente</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {statsLoading ? "..." : formatCOP(stats?.totalPending || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.countPending || 0} deudas activas
              {(stats?.countPartial || 0) > 0 && ` (${stats?.countPartial} parciales)`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recaudado</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {statsLoading ? "..." : formatCOP(stats?.totalPaid || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.countPaid || 0} deudas pagadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Condonado</CardTitle>
            <ShieldOff className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {statsLoading ? "..." : formatCOP(stats?.totalWaived || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.countWaived || 0} deudas condonadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Histórico</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatCOP(stats?.totalAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.countPending || 0) + (stats?.countPaid || 0) + (stats?.countWaived || 0)} deudas totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="PARTIAL">Parcial</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
                <SelectItem value="WAIVED">Condonada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Razón" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las razones</SelectItem>
                <SelectItem value="OVERSTAY">Ocupación</SelectItem>
                <SelectItem value="INSUFFICIENT_BALANCE">Saldo insuficiente</SelectItem>
                <SelectItem value="CANCELLATION_FEE">Tarifa cancelación</SelectItem>
                <SelectItem value="NO_SHOW">No presentado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Debts Table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {debtsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando deudas...</span>
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No se encontraron deudas con los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">
                      <Hash className="w-3 h-3" />
                    </TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead className="text-right">Monto Original</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Intentos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts.map((debt) => (
                    <TableRow key={debt.id} className={
                      debt.status === "PENDING" || debt.status === "PARTIAL"
                        ? "bg-red-500/5"
                        : ""
                    }>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{debt.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{debt.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{debt.userEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm">{REASON_LABELS[debt.reason] || debt.reason}</span>
                        </div>
                        {debt.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={debt.description}>
                            {debt.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCOP(debt.originalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={debt.remainingAmount > 0 ? "font-bold text-red-500" : "text-muted-foreground"}>
                          {formatCOP(debt.remainingAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[debt.status] || ""}>
                          {STATUS_LABELS[debt.status] || debt.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(debt.createdAt)}
                          </div>
                          {debt.paidAt && (
                            <div className="flex items-center gap-1 text-green-600 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              {formatDate(debt.paidAt)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {debt.autoChargeAttempts > 0 ? (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {debt.autoChargeAttempts} intentos
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(debt.status === "PENDING" || debt.status === "PARTIAL") && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setWalletChargeDialog({
                                open: true,
                                debtId: debt.id,
                                amount: debt.remainingAmount,
                                userName: debt.userName,
                              })}
                              title="Cobrar desde billetera"
                            >
                              <Wallet className="w-3 h-3 mr-1" />
                              Cobrar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setManualPayDialog({
                                  open: true,
                                  debtId: debt.id,
                                  amount: debt.remainingAmount,
                                });
                                setPaymentRef("");
                              }}
                              title="Registrar pago manual"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Manual
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-blue-500 hover:text-blue-600"
                              onClick={() => setWaiveDialog({
                                open: true,
                                debtId: debt.id,
                                amount: debt.remainingAmount,
                                userName: debt.userName,
                              })}
                              title="Condonar deuda"
                            >
                              <ShieldOff className="w-3 h-3 mr-1" />
                              Condonar
                            </Button>
                          </div>
                        )}
                        {debt.status === "PAID" && debt.paymentReference && (
                          <span className="text-xs text-muted-foreground" title={debt.paymentReference}>
                            Ref: {debt.paymentReference.substring(0, 15)}...
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {page + 1} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Cobro desde billetera */}
      <Dialog open={!!walletChargeDialog?.open} onOpenChange={(open) => !open && setWalletChargeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Cobrar desde billetera
            </DialogTitle>
            <DialogDescription>
              Se descontarán <strong>{formatCOP(walletChargeDialog?.amount || 0)}</strong> de la billetera de <strong>{walletChargeDialog?.userName}</strong>.
              Si el usuario no tiene saldo suficiente, la operación fallará.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWalletChargeDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => walletChargeDialog && walletChargeMutation.mutate({ debtId: walletChargeDialog.debtId })}
              disabled={walletChargeMutation.isPending}
            >
              {walletChargeMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              Confirmar cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pago manual */}
      <Dialog open={!!manualPayDialog?.open} onOpenChange={(open) => !open && setManualPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Registrar pago manual
            </DialogTitle>
            <DialogDescription>
              Marca la deuda de <strong>{formatCOP(manualPayDialog?.amount || 0)}</strong> como pagada.
              Ingresa la referencia del pago (transferencia, efectivo, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Referencia de pago</label>
            <Input
              placeholder="Ej: Transferencia Bancolombia #12345, Efectivo, Nequi..."
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualPayDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => manualPayDialog && manualPayMutation.mutate({
                debtId: manualPayDialog.debtId,
                paymentReference: paymentRef,
              })}
              disabled={manualPayMutation.isPending || !paymentRef.trim()}
            >
              {manualPayMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Condonar deuda */}
      <Dialog open={!!waiveDialog?.open} onOpenChange={(open) => !open && setWaiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-blue-500" />
              Condonar deuda
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de condonar la deuda de <strong>{formatCOP(waiveDialog?.amount || 0)}</strong> de <strong>{waiveDialog?.userName}</strong>?
              Esta acción no se puede deshacer. El usuario podrá volver a cargar normalmente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWaiveDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => waiveDialog && waiveMutation.mutate({ debtId: waiveDialog.debtId })}
              disabled={waiveMutation.isPending}
            >
              {waiveMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="w-4 h-4 mr-2" />
              )}
              Sí, condonar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
