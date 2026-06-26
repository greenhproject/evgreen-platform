/**
 * Org Billing Page - Facturación y liquidaciones del portal de organización
 * Muestra el plan actual, fees acumulados, historial de pagos y permite solicitar cambio de plan
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  ArrowUpRight,
  Zap,
  Building,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OrgBilling() {
  const [showPlanDialog, setShowPlanDialog] = useState(false);

  const { data, isLoading } = (trpc.organizations as any).getMyBilling.useQuery();

  const formatCOP = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
  const formatUSD = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando facturación...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CreditCard className="h-16 w-16 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">No se pudo cargar la información de facturación.</p>
      </div>
    );
  }

  const { org, planDefaults, billingHistory, currentPeriodFees } = data;

  const planColors: Record<string, string> = {
    starter: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  const statusIcon = (status: string) => {
    if (status === "paid") return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-amber-400" />;
    return <AlertCircle className="h-4 w-4 text-red-400" />;
  };

  const statusLabel = (status: string) => {
    if (status === "paid") return "Pagado";
    if (status === "pending") return "Pendiente";
    return "Vencido";
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      setup: "Setup / Activación",
      renewal: "Renovación anual",
      transaction_fee: "Fee de transacciones",
      support: "Soporte integral",
      other: "Otro",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-green-400" />
          Facturación
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu plan, revisa los cargos y el historial de pagos
        </p>
      </div>

      {/* Plan actual + métricas del período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan card */}
        <Card className="bg-card/50 border-border/50 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Plan actual</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className={`text-base px-3 py-1 capitalize ${planColors[org.plan] || ""}`}>
                {org.plan}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup por cargador</span>
                <span className="font-medium">{formatUSD(parseFloat(planDefaults?.setupFeeUsd || "0"))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Renovación anual</span>
                <span className="font-medium">{formatUSD(parseFloat(planDefaults?.annualFeeUsd || "0"))}/cargador</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee de transacción</span>
                <span className="font-medium text-green-400">{currentPeriodFees.feePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cargadores máx.</span>
                <span className="font-medium">{org.maxChargers === 9999 ? "Ilimitados" : org.maxChargers}</span>
              </div>
              {org.nextBillingDate && (
                <div className="flex justify-between pt-2 border-t border-border/30">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Próximo cobro
                  </span>
                  <span className="font-medium text-amber-400">
                    {new Date(org.nextBillingDate).toLocaleDateString("es-CO")}
                  </span>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-4 text-xs gap-1"
              onClick={() => setShowPlanDialog(true)}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Solicitar cambio de plan
            </Button>
          </CardContent>
        </Card>

        {/* Fees del período actual */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Últimos 30 días
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Volumen de transacciones</p>
              <p className="text-xl font-bold text-foreground">{formatCOP(currentPeriodFees.totalVolumeCOP)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fee EVGreen acumulado ({currentPeriodFees.feePercent}%)</p>
              <p className="text-xl font-bold text-green-400">{formatCOP(currentPeriodFees.feeAccruedCOP)}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/30">
              <Zap className="h-3.5 w-3.5" />
              {currentPeriodFees.sessionCount} sesiones completadas
            </div>
          </CardContent>
        </Card>

        {/* Tus ingresos netos */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Ingresos netos (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Ingresos brutos</p>
              <p className="text-xl font-bold">{formatCOP(currentPeriodFees.totalVolumeCOP)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Menos fee EVGreen</p>
              <p className="text-base font-semibold text-red-400">- {formatCOP(currentPeriodFees.feeAccruedCOP)}</p>
            </div>
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">Neto estimado</p>
              <p className="text-xl font-bold text-green-400">
                {formatCOP(currentPeriodFees.totalVolumeCOP - currentPeriodFees.feeAccruedCOP)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de facturación */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-400" />
            Historial de Facturación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingHistory.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground opacity-30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No hay registros de facturación aún</p>
              <p className="text-xs text-muted-foreground mt-1">Los cargos de setup, renovaciones y fees aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-2">
              {billingHistory.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <div className="shrink-0">{statusIcon(record.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{typeLabel(record.type)}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          record.status === "paid"
                            ? "border-green-500/30 text-green-400"
                            : record.status === "pending"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        {statusLabel(record.status)}
                      </Badge>
                    </div>
                    {record.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{record.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(record.createdAt).toLocaleDateString("es-CO", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">
                      {record.currency === "COP"
                        ? formatCOP(parseFloat(record.amount))
                        : formatUSD(parseFloat(record.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">{record.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan change dialog */}
      <PlanChangeDialog
        open={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        currentPlan={org.plan}
      />
    </div>
  );
}

// ==========================================
// Plan Change Request Dialog
// ==========================================
function PlanChangeDialog({
  open,
  onClose,
  currentPlan,
}: {
  open: boolean;
  onClose: () => void;
  currentPlan: string;
}) {
  const [newPlan, setNewPlan] = useState("");
  const [notes, setNotes] = useState("");

  const requestChange = (trpc.organizations as any).requestPlanChange.useMutation({
    onSuccess: () => {
      toast.success("Solicitud enviada. El equipo EVGreen se pondrá en contacto contigo.");
      onClose();
      setNewPlan("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const planInfo: Record<string, { label: string; price: string; color: string }> = {
    starter: { label: "Starter", price: "$500 USD setup · $125/cargador/año", color: "text-gray-300" },
    professional: { label: "Professional", price: "$750 USD setup · $200/cargador/año", color: "text-purple-400" },
    enterprise: { label: "Enterprise", price: "$1,200 USD setup · $350/cargador/año", color: "text-amber-400" },
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-green-400" />
            Solicitar cambio de plan
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
            <p className="text-xs text-muted-foreground">Plan actual</p>
            <p className="font-semibold capitalize mt-0.5">{currentPlan}</p>
          </div>

          <div className="space-y-2">
            <Label>Nuevo plan deseado</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un plan..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(planInfo)
                  .filter(([key]) => key !== currentPlan)
                  .map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <p className={`font-medium ${info.color}`}>{info.label}</p>
                        <p className="text-xs text-muted-foreground">{info.price}</p>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas adicionales (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cuéntanos por qué quieres cambiar de plan o cualquier requerimiento especial..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">
              Tu solicitud será revisada por el equipo EVGreen. Te contactaremos en menos de 24 horas hábiles para coordinar el cambio y la facturación correspondiente.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!newPlan || requestChange.isPending}
              onClick={() => requestChange.mutate({ newPlan: newPlan as any, notes })}
            >
              {requestChange.isPending ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
