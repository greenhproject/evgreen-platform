/**
 * TransactionDetailModal
 * 
 * Modal de detalle de transacción para admin/soporte.
 * Muestra desglose completo de cobros, timeline visual con horas exactas,
 * y botón de reembolso parcial directo.
 * 
 * Diseño: dark luxe tech (fondo oscuro, acentos verdes neón)
 * Idioma: Español (Colombia)
 * Moneda: COP
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Clock,
  MapPin,
  User,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  Timer,
  Battery,
  Loader2,
  Wallet,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

interface TransactionDetailModalProps {
  transactionId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailModal({
  transactionId,
  open,
  onOpenChange,
}: TransactionDetailModalProps) {
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundType, setRefundType] = useState<"overstay" | "energy" | "general">("general");

  const utils = trpc.useUtils();

  const { data: detail, isLoading, error } = trpc.transactions.getDetail.useQuery(
    { transactionId: transactionId! },
    { enabled: !!transactionId && open }
  );

  const refundMutation = trpc.transactions.partialRefund.useMutation({
    onSuccess: (data) => {
      toast.success(`Reembolso de $${data.refundedAmount.toLocaleString("es-CO")} COP aplicado exitosamente`);
      setShowRefundForm(false);
      setRefundAmount("");
      setRefundReason("");
      utils.transactions.getDetail.invalidate({ transactionId: transactionId! });
      utils.transactions.listAll.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Error al aplicar reembolso");
    },
  });

  const handleRefund = () => {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (refundReason.length < 3) {
      toast.error("Ingresa un motivo (mínimo 3 caracteres)");
      return;
    }
    refundMutation.mutate({
      transactionId: transactionId!,
      refundAmount: amount,
      reason: refundReason,
      refundType,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string; icon: any }> = {
      COMPLETED: { label: "Completada", className: "bg-green-900/40 text-green-400 border-green-700", icon: CheckCircle2 },
      IN_PROGRESS: { label: "En progreso", className: "bg-blue-900/40 text-blue-400 border-blue-700", icon: Loader2 },
      FAILED: { label: "Fallida", className: "bg-red-900/40 text-red-400 border-red-700", icon: XCircle },
      CANCELLED: { label: "Cancelada", className: "bg-gray-800 text-gray-400 border-gray-600", icon: XCircle },
      PENDING: { label: "Pendiente", className: "bg-yellow-900/40 text-yellow-400 border-yellow-700", icon: Timer },
    };
    return configs[status] || configs.PENDING;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[oklch(0.14_0.01_250)] border-[oklch(0.25_0.01_250)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-green-400" />
            Detalle de Transacción
            {detail && (
              <span className="font-mono text-muted-foreground text-sm">#{detail.id}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-400">
            <XCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error.message}</p>
          </div>
        )}

        {detail && (
          <div className="space-y-4">
            {/* ===== HEADER: Estado + Info básica ===== */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)]">
              <Badge className={`${getStatusConfig(detail.status).className} border px-3 py-1`}>
                {getStatusConfig(detail.status).label}
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{detail.station.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{detail.user.name}</span>
                {detail.user.phone && (
                  <button
                    onClick={() => copyToClipboard(detail.user.phone)}
                    className="text-green-400 hover:text-green-300 ml-1"
                    title="Copiar teléfono"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
              {detail.connector.chargeType && (
                <Badge variant="outline" className="text-xs border-green-700 text-green-400">
                  {detail.connector.chargeType} {detail.connector.powerKw}kW
                </Badge>
              )}
            </div>

            {/* ===== TIMELINE VISUAL ===== */}
            <div className="p-4 rounded-lg bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)]">
              <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timeline de la sesión
              </h3>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-500 via-green-600 to-red-500 rounded-full" />

                <div className="space-y-4 pl-8">
                  {/* Inicio de carga */}
                  <div className="relative">
                    <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500/30" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="text-xs font-mono text-green-400 min-w-[100px]">
                        {formatTime(detail.startTime)}
                      </span>
                      <span className="text-sm font-medium">Inicio de carga</span>
                      <span className="text-xs text-muted-foreground">
                        Método: {detail.startMethod}
                      </span>
                    </div>
                  </div>

                  {/* Fin de carga */}
                  {detail.endTime && (
                    <div className="relative">
                      <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="text-xs font-mono text-blue-400 min-w-[100px]">
                          {formatTime(detail.endTime)}
                        </span>
                        <span className="text-sm font-medium">Fin de carga</span>
                        <span className="text-xs text-muted-foreground">
                          {detail.chargeDurationMinutes} min — {detail.kwhConsumed.toFixed(2)} kWh
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Fin de gracia (si hay overstay) */}
                  {detail.overstay && (
                    <>
                      <div className="relative">
                        <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-yellow-500 ring-2 ring-yellow-500/30" />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="text-xs font-mono text-yellow-400 min-w-[100px]">
                            {formatTime(detail.overstay.gracePeriodEnd)}
                          </span>
                          <span className="text-sm font-medium">Fin del período de gracia</span>
                          <span className="text-xs text-muted-foreground">
                            ({detail.gracePeriodMinutes} min de gracia)
                          </span>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/30" />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="text-xs font-mono text-red-400 min-w-[100px]">
                            {formatTime(detail.overstay.overstayStartTime)}
                          </span>
                          <span className="text-sm font-medium text-red-400">Inicio cobro sobreestadía</span>
                          <span className="text-xs text-muted-foreground">
                            {detail.overstay.minutesBilled} min × {formatCurrency(detail.overstay.ratePerMinute)}/min
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ===== DESGLOSE DE COSTOS ===== */}
            <div className="p-4 rounded-lg bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)]">
              <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Desglose de cobros
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-green-400" />
                    <span>Energía ({detail.kwhConsumed.toFixed(2)} kWh × {formatCurrency(detail.appliedPricePerKwh)}/kWh)</span>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(detail.energyCost)}</span>
                </div>

                {detail.timeCost > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Tiempo de uso</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(detail.timeCost)}</span>
                  </div>
                )}

                {detail.sessionCost > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Battery className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cargo por sesión</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(detail.sessionCost)}</span>
                  </div>
                )}

                {detail.overstayCost > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400">
                        Sobreestadía ({detail.overstay?.minutesBilled || 0} min × {formatCurrency(detail.overstay?.ratePerMinute || 0)}/min)
                      </span>
                    </div>
                    <span className="font-mono font-medium text-red-400">{formatCurrency(detail.overstayCost)}</span>
                  </div>
                )}

                <Separator className="my-2 bg-[oklch(0.25_0.01_250)]" />

                <div className="flex justify-between items-center text-base font-bold">
                  <span>Total cobrado</span>
                  <span className="text-green-400 font-mono">{formatCurrency(detail.totalCost)}</span>
                </div>
              </div>
            </div>

            {/* ===== DEUDAS PENDIENTES ===== */}
            {detail.debts.length > 0 && (
              <div className="p-4 rounded-lg bg-red-950/30 border border-red-800/50">
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Deudas asociadas
                </h3>
                {detail.debts.map((debt) => (
                  <div key={debt.id} className="flex justify-between items-center text-sm py-1">
                    <div>
                      <span className="text-muted-foreground">{debt.reason}</span>
                      <Badge variant="outline" className="ml-2 text-xs border-red-700 text-red-400">
                        {debt.status}
                      </Badge>
                    </div>
                    <span className="font-mono text-red-400">
                      {formatCurrency(debt.remainingAmount)} pendiente
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ===== MOVIMIENTOS DE BILLETERA ===== */}
            {detail.walletMovements.length > 0 && (
              <div className="p-4 rounded-lg bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)]">
                <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Movimientos de billetera
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detail.walletMovements.map((wm) => (
                    <div key={wm.id} className="flex justify-between items-center text-xs py-1 border-b border-[oklch(0.22_0.01_250)] last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground truncate block">{wm.description}</span>
                        <span className="text-[10px] text-muted-foreground/60">{formatDateTime(wm.createdAt)}</span>
                      </div>
                      <span className={`font-mono ml-2 ${wm.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {wm.amount >= 0 ? "+" : ""}{formatCurrency(wm.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== INFO ADICIONAL ===== */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)]">
                <div className="text-muted-foreground mb-1">Estación</div>
                <div className="font-medium">{detail.station.name}</div>
                <div className="text-muted-foreground">{detail.station.address}</div>
                <div className="text-muted-foreground">{detail.station.city}</div>
              </div>
              <div className="p-3 rounded-lg bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)]">
                <div className="text-muted-foreground mb-1">Usuario</div>
                <div className="font-medium">{detail.user.name}</div>
                <div className="text-muted-foreground">{detail.user.email}</div>
                {detail.user.phone && (
                  <div className="text-muted-foreground flex items-center gap-1">
                    {detail.user.phone}
                    <button onClick={() => copyToClipboard(detail.user.phone)} className="text-green-400">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ===== DISTRIBUCIÓN DE INGRESOS ===== */}
            {(detail.investorShare > 0 || detail.platformFee > 0) && (
              <div className="flex gap-3 text-xs">
                <div className="flex-1 p-2 rounded bg-[oklch(0.18_0.01_250)] text-center">
                  <div className="text-muted-foreground">Inversionista</div>
                  <div className="font-mono font-medium text-green-400">{formatCurrency(detail.investorShare)}</div>
                </div>
                <div className="flex-1 p-2 rounded bg-[oklch(0.18_0.01_250)] text-center">
                  <div className="text-muted-foreground">Plataforma</div>
                  <div className="font-mono font-medium text-blue-400">{formatCurrency(detail.platformFee)}</div>
                </div>
              </div>
            )}

            <Separator className="bg-[oklch(0.25_0.01_250)]" />

            {/* ===== BOTÓN DE REEMBOLSO ===== */}
            {!showRefundForm ? (
              <Button
                variant="outline"
                className="w-full border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 hover:text-yellow-300"
                onClick={() => setShowRefundForm(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Aplicar reembolso parcial
              </Button>
            ) : (
              <div className="p-4 rounded-lg bg-yellow-950/20 border border-yellow-800/50 space-y-3">
                <h4 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Reembolso parcial
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Monto (COP)</label>
                    <Input
                      type="number"
                      placeholder="Ej: 5000"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="bg-[oklch(0.14_0.01_250)] border-[oklch(0.3_0.01_250)]"
                    />
                    {detail.overstayCost > 0 && (
                      <button
                        className="text-xs text-yellow-400 hover:text-yellow-300 mt-1"
                        onClick={() => setRefundAmount(detail.overstayCost.toString())}
                      >
                        Usar total sobreestadía: {formatCurrency(detail.overstayCost)}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                    <Select value={refundType} onValueChange={(v) => setRefundType(v as any)}>
                      <SelectTrigger className="bg-[oklch(0.14_0.01_250)] border-[oklch(0.3_0.01_250)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="overstay">Sobreestadía</SelectItem>
                        <SelectItem value="energy">Energía</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Motivo</label>
                  <Input
                    placeholder="Ej: Cliente reportó cobro excesivo, se verificó error en medición"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="bg-[oklch(0.14_0.01_250)] border-[oklch(0.3_0.01_250)]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleRefund}
                    disabled={refundMutation.isPending}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                  >
                    {refundMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Confirmar reembolso
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRefundForm(false);
                      setRefundAmount("");
                      setRefundReason("");
                    }}
                    className="border-[oklch(0.3_0.01_250)]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
