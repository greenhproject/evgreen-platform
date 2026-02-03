import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  CreditCard,
  Building,
  Calendar,
  FileText,
  Loader2,
  XCircle,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function InvestorSettlements() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountType, setAccountType] = useState<"AHORROS" | "CORRIENTE">("AHORROS");
  const [notes, setNotes] = useState("");

  // Obtener balance y datos reales
  // @ts-ignore - payouts router exists
  const { data: balanceData, isLoading: loadingBalance, refetch: refetchBalance } = trpc.payouts.getMyBalance.useQuery();
  // @ts-ignore - payouts router exists
  const { data: payouts, isLoading: loadingPayouts, refetch: refetchPayouts } = trpc.payouts.getMyPayouts.useQuery();

  // Mutación para solicitar pago
  // @ts-ignore - payouts router exists
  const requestPayoutMutation = trpc.payouts.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Solicitud de pago enviada exitosamente. Se procesará en 24-48 horas.");
      setIsDialogOpen(false);
      setRequestAmount("");
      setNotes("");
      refetchBalance();
      refetchPayouts();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al solicitar el pago");
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

  const handleRequestPayout = () => {
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (!bankName || !bankAccount || !accountHolder) {
      toast.error("Completa todos los datos bancarios");
      return;
    }
    if (amount > (balanceData?.pendingBalance || 0)) {
      toast.error("El monto excede tu balance disponible");
      return;
    }

    requestPayoutMutation.mutate({
      amount,
      bankName,
      bankAccount,
      accountHolder,
      accountType,
      notes: notes || undefined,
    });
  };

  const pendingBalance = balanceData?.pendingBalance || 0;
  const totalPaid = balanceData?.totalPaid || 0;
  const investorPercentage = balanceData?.investorPercentage || 80;
  const pendingRequested = balanceData?.pendingRequested || 0;

  // Calcular próxima liquidación (próximo lunes)
  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday;
  };

  const nextSettlementDate = getNextMonday();

  if (loadingBalance || loadingPayouts) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones</h1>
          <p className="text-muted-foreground">
            Historial de pagos y liquidaciones de tus estaciones
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary" disabled={pendingBalance === 0}>
              <Wallet className="w-4 h-4 mr-2" />
              Solicitar pago
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Solicitar Liquidación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground">Balance disponible</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(pendingBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tu porcentaje: {investorPercentage}%
                </p>
              </div>

              <div className="space-y-2">
                <Label>Monto a solicitar *</Label>
                <Input
                  type="number"
                  placeholder="Ej: 500000"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  max={pendingBalance}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: {formatCurrency(pendingBalance)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                    <SelectItem value="Davivienda">Davivienda</SelectItem>
                    <SelectItem value="BBVA">BBVA</SelectItem>
                    <SelectItem value="Banco de Bogotá">Banco de Bogotá</SelectItem>
                    <SelectItem value="Banco de Occidente">Banco de Occidente</SelectItem>
                    <SelectItem value="Banco Popular">Banco Popular</SelectItem>
                    <SelectItem value="Banco AV Villas">Banco AV Villas</SelectItem>
                    <SelectItem value="Banco Caja Social">Banco Caja Social</SelectItem>
                    <SelectItem value="Scotiabank Colpatria">Scotiabank Colpatria</SelectItem>
                    <SelectItem value="Banco Falabella">Banco Falabella</SelectItem>
                    <SelectItem value="Nequi">Nequi</SelectItem>
                    <SelectItem value="Daviplata">Daviplata</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Número de cuenta *</Label>
                <Input
                  placeholder="Ej: 123456789012"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Titular de la cuenta *</Label>
                <Input
                  placeholder="Nombre completo del titular"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de cuenta *</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as "AHORROS" | "CORRIENTE")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AHORROS">Cuenta de Ahorros</SelectItem>
                    <SelectItem value="CORRIENTE">Cuenta Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  placeholder="Información adicional..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 inline mr-1" />
                  El pago se procesará en 24-48 horas hábiles después de la aprobación
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={handleRequestPayout}
                disabled={requestPayoutMutation.isPending}
              >
                {requestPayoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar solicitud"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balance disponible</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(pendingBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disponible para solicitar
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solicitudes pendientes</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(pendingRequested)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  En proceso de aprobación
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total pagado</p>
                <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pagos completados
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tu porcentaje</p>
                <p className="text-2xl font-bold">{investorPercentage}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  De los ingresos brutos
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próxima liquidación */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Próxima fecha de liquidación</p>
                <p className="text-xl font-bold">
                  {nextSettlementDate.toLocaleDateString("es-CO", { 
                    weekday: "short", 
                    day: "numeric", 
                    month: "short" 
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Las liquidaciones se procesan semanalmente
                </p>
              </div>
            </div>
            {pendingBalance > 0 && (
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Wallet className="w-4 h-4 mr-2" />
                Solicitar ahora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historial de liquidaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historial de Liquidaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tienes liquidaciones registradas</p>
              <p className="text-sm">Solicita tu primer pago cuando tengas balance disponible</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout: any) => (
                <div 
                  key={payout.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      payout.status === "PAID" ? "bg-green-500/20" :
                      payout.status === "REJECTED" ? "bg-red-500/20" :
                      payout.status === "REQUESTED" || payout.status === "APPROVED" ? "bg-blue-500/20" :
                      "bg-yellow-500/20"
                    }`}>
                      <DollarSign className={`w-5 h-5 ${
                        payout.status === "PAID" ? "text-green-500" :
                        payout.status === "REJECTED" ? "text-red-500" :
                        payout.status === "REQUESTED" || payout.status === "APPROVED" ? "text-blue-500" :
                        "text-yellow-500"
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {formatCurrency(payout.investorShare)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payout.periodStart).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                        {" - "}
                        {new Date(payout.periodEnd).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {payout.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          Pagado el {new Date(payout.paidAt).toLocaleDateString("es-CO")}
                        </p>
                      )}
                      {payout.requestedAt && payout.status === "REQUESTED" && (
                        <p className="text-xs text-muted-foreground">
                          Solicitado el {new Date(payout.requestedAt).toLocaleDateString("es-CO")}
                        </p>
                      )}
                      {payout.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">
                          Motivo: {payout.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Bruto: {formatCurrency(payout.totalRevenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Comisión: {formatCurrency(payout.platformFee)}
                      </p>
                    </div>
                    {getStatusBadge(payout.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de cuenta bancaria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Información de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Los datos bancarios se solicitan al momento de cada solicitud de pago.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Asegúrate de ingresar correctamente tu información bancaria para evitar retrasos.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
