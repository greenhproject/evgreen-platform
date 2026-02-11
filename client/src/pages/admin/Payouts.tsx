import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  Check,
  X,
  CreditCard,
  Building,
  User,
  Calendar,
  ArrowUpRight,
  Search,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AdminPayouts() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "STRIPE" | "WOMPI" | "OTHER">("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");

  // @ts-ignore - payouts router exists
  const { data: payouts, isLoading, refetch } = trpc.payouts.getAllPayouts.useQuery({ status: statusFilter });

  // @ts-ignore - payouts router exists
  const approveMutation = trpc.payouts.approvePayout.useMutation({
    onSuccess: () => {
      toast.success("Solicitud aprobada exitosamente");
      setIsApproveOpen(false);
      setAdminNotes("");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aprobar la solicitud");
    },
  });

  // @ts-ignore - payouts router exists
  const rejectMutation = trpc.payouts.rejectPayout.useMutation({
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      setIsRejectOpen(false);
      setRejectionReason("");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al rechazar la solicitud");
    },
  });

  // @ts-ignore - payouts router exists
  const markPaidMutation = trpc.payouts.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Pago registrado exitosamente");
      setIsMarkPaidOpen(false);
      setPaymentReference("");
      setAdminNotes("");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar el pago");
    },
  });

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; label: string; icon: any }> = {
      PENDING: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pendiente", icon: Clock },
      REQUESTED: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Solicitado", icon: ArrowUpRight },
      APPROVED: { bg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", label: "Aprobado", icon: CheckCircle },
      PROCESSING: { bg: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", label: "Procesando", icon: Loader2 },
      PAID: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Pagado", icon: CheckCircle },
      REJECTED: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Rechazado", icon: XCircle },
      FAILED: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Fallido", icon: AlertCircle },
    };
    const style = styles[status] || styles.PENDING;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const handleApprove = () => {
    if (!selectedPayout) return;
    approveMutation.mutate({
      payoutId: selectedPayout.payout.id,
      adminNotes: adminNotes || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedPayout || !rejectionReason) {
      toast.error("Debes ingresar un motivo de rechazo");
      return;
    }
    rejectMutation.mutate({
      payoutId: selectedPayout.payout.id,
      rejectionReason,
    });
  };

  const handleMarkPaid = () => {
    if (!selectedPayout || !paymentReference) {
      toast.error("Debes ingresar la referencia del pago");
      return;
    }
    markPaidMutation.mutate({
      payoutId: selectedPayout.payout.id,
      paymentMethod,
      paymentReference,
      adminNotes: adminNotes || undefined,
    });
  };

  const filteredPayouts = payouts?.filter((item: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.investor.name?.toLowerCase().includes(search) ||
      item.investor.email?.toLowerCase().includes(search) ||
      item.payout.bankName?.toLowerCase().includes(search) ||
      item.payout.bankAccount?.includes(search)
    );
  }) || [];

  // Estadísticas
  const stats = {
    pending: payouts?.filter((p: any) => p.payout.status === "REQUESTED" || p.payout.status === "APPROVED").length || 0,
    pendingAmount: payouts?.filter((p: any) => p.payout.status === "REQUESTED" || p.payout.status === "APPROVED")
      .reduce((sum: number, p: any) => sum + parseFloat(p.payout.investorShare || 0), 0) || 0,
    paid: payouts?.filter((p: any) => p.payout.status === "PAID").length || 0,
    paidAmount: payouts?.filter((p: any) => p.payout.status === "PAID")
      .reduce((sum: number, p: any) => sum + parseFloat(p.payout.investorShare || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Liquidaciones</h1>
        <p className="text-muted-foreground">
          Administra las solicitudes de pago de los inversionistas
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solicitudes pendientes</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monto pendiente</p>
                <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagos completados</p>
                <p className="text-2xl font-bold text-green-500">{stats.paid}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total pagado</p>
                <p className="text-2xl font-bold text-emerald-500">{formatCurrency(stats.paidAmount)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o cuenta bancaria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="REQUESTED">Solicitados</SelectItem>
                  <SelectItem value="APPROVED">Aprobados</SelectItem>
                  <SelectItem value="PAID">Pagados</SelectItem>
                  <SelectItem value="REJECTED">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de solicitudes */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay solicitudes de pago</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Fecha solicitud</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((item: any) => (
                    <TableRow key={item.payout.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{item.investor.name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{item.investor.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{formatCurrency(item.payout.investorShare)}</p>
                        <p className="text-xs text-muted-foreground">
                          Bruto: {formatCurrency(item.payout.totalRevenue)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{item.payout.bankName || "-"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.payout.bankAccount ? `****${item.payout.bankAccount.slice(-4)}` : "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {item.payout.requestedAt ? (
                          <p className="text-sm">
                            {new Date(item.payout.requestedAt).toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.payout.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayout(item);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {item.payout.status === "REQUESTED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedPayout(item);
                                  setIsApproveOpen(true);
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedPayout(item);
                                  setIsRejectOpen(true);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(item.payout.status === "APPROVED" || item.payout.status === "REQUESTED") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPayout(item);
                                setIsMarkPaidOpen(true);
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud</DialogTitle>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{selectedPayout.investor.name || "Sin nombre"}</p>
                  <p className="text-sm text-muted-foreground">{selectedPayout.investor.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Monto solicitado</p>
                  <p className="text-xl font-bold text-green-500">
                    {formatCurrency(selectedPayout.payout.investorShare)}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Ingreso bruto</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(selectedPayout.payout.totalRevenue)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Datos bancarios</Label>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{selectedPayout.payout.bankName || "-"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cuenta: {selectedPayout.payout.bankAccount || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Titular: {selectedPayout.payout.accountHolder || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {selectedPayout.payout.accountType === "AHORROS" ? "Cuenta de Ahorros" : "Cuenta Corriente"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {selectedPayout.payout.periodStart ? new Date(selectedPayout.payout.periodStart).toLocaleDateString("es-CO") : "N/A"} -{" "}
                  {selectedPayout.payout.periodEnd ? new Date(selectedPayout.payout.periodEnd).toLocaleDateString("es-CO") : "N/A"}
                </div>
              </div>

              {selectedPayout.payout.investorNotes && (
                <div className="space-y-2">
                  <Label>Notas del inversionista</Label>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    {selectedPayout.payout.investorNotes}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">Estado:</span>
                {getStatusBadge(selectedPayout.payout.status)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de aprobar */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              ¿Estás seguro de aprobar esta solicitud de pago por{" "}
              <span className="font-semibold text-green-500">
                {selectedPayout && formatCurrency(selectedPayout.payout.investorShare)}
              </span>
              ?
            </p>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Agregar notas administrativas..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de rechazar */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              ¿Estás seguro de rechazar esta solicitud de pago?
            </p>
            <div className="space-y-2">
              <Label>Motivo del rechazo *</Label>
              <Textarea
                placeholder="Explica el motivo del rechazo..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de marcar como pagado */}
      <Dialog open={isMarkPaidOpen} onOpenChange={setIsMarkPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-muted-foreground">Monto a pagar</p>
              <p className="text-2xl font-bold text-green-500">
                {selectedPayout && formatCurrency(selectedPayout.payout.investorShare)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Transferencia Bancaria</SelectItem>
                  <SelectItem value="WOMPI">Wompi</SelectItem>
                  <SelectItem value="STRIPE">Stripe</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Referencia del pago *</Label>
              <Input
                placeholder="Ej: TXN-2026-0203-001"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Agregar notas administrativas..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMarkPaidOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
