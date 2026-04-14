/**
 * Centro Financiero del Inversionista
 * 3 Tabs: Liquidaciones/Waterfall | Indicadores Financieros | Indicadores Operativos SLA
 * @author Green House Project
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const financialTrpc = trpc.financial as any;

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveBlobCrossPlatform } from "@/lib/pdf-download";
import {
  ArrowDownUp,
  TrendingUp,
  Activity,
  DollarSign,
  Gauge,
  Clock,
  Star,
  Wifi,
  Receipt,
  Sun,
  Shield,
  ChevronRight,
  Eye,
  Download,
  Calendar,
  Percent,
  BarChart3,
  Target,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Zap,
} from "lucide-react";

// ============================================================================
// HELPERS
// ============================================================================

function formatCOP(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercent(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `${num.toFixed(1)}%`;
}

function formatDate(ts: number | string | null | undefined): string {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Tab = "waterfall" | "financial" | "operational";

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function InvestorFinancialPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("waterfall");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const exportMutation = financialTrpc.exportFinancialReport.useMutation({
    onSuccess: (data: { filename: string; mimeType: string; data: string }) => {
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      saveBlobCrossPlatform(blob, data.filename);
      toast.success(`Reporte ${exporting === "pdf" ? "PDF" : "Excel"} descargado exitosamente`);
      setExporting(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al generar el reporte");
      setExporting(null);
    },
  });

  const handleExport = (format: "pdf" | "excel") => {
    setExporting(format);
    exportMutation.mutate({ format });
  };

  const tabs = [
    { id: "waterfall" as Tab, label: "Liquidaciones", icon: ArrowDownUp },
    { id: "financial" as Tab, label: "Indicadores Financieros", icon: TrendingUp },
    { id: "operational" as Tab, label: "Indicadores Operativos", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-500" />
            Centro Financiero
          </h1>
          <p className="text-muted-foreground mt-1">
            Transparencia total sobre tus inversiones, liquidaciones y rendimiento operativo
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!!exporting}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            {exporting === "pdf" ? "Generando..." : "PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={!!exporting}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            {exporting === "excel" ? "Generando..." : "Excel"}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "waterfall" && <WaterfallTab />}
      {activeTab === "financial" && <FinancialIndicatorsTab />}
      {activeTab === "operational" && <OperationalSLATab />}
    </div>
  );
}

// ============================================================================
// TAB 1: LIQUIDACIONES / WATERFALL
// ============================================================================

function WaterfallTab() {
  const [selectedSettlement, setSelectedSettlement] = useState<number | null>(null);

  const settlementsQuery = financialTrpc.mySettlements.useQuery({ limit: 20 });
  const summaryQuery = financialTrpc.mySummary.useQuery();
  const settlements = settlementsQuery.data || [];
  const summary = summaryQuery.data;

  if (settlementsQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <PiggyBank className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Capital Invertido</p>
                  <p className="text-lg font-bold">{formatCOP(summary.totalInvested)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Distribuido</p>
                  <p className="text-lg font-bold">{formatCOP(summary.totalDistributed)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Saldo Pendiente</p>
                  <p className="text-lg font-bold">{formatCOP(summary.pendingBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Liquidaciones</p>
                  <p className="text-lg font-bold">{summary.totalSettlements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settlements List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Historial de Liquidaciones
          </CardTitle>
          <CardDescription>
            Detalle de cada período de liquidación con desglose waterfall
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowDownUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay liquidaciones registradas</p>
              <p className="text-sm mt-1">Las liquidaciones aparecerán aquí cuando se generen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedSettlement(s.settlementId || s.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {s.periodType || "Mensual"} — {formatDate(s.periodStart)} a {formatDate(s.periodEnd)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Estación: {s.stationName || `#${s.stationId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">{formatCOP(s.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.ownershipPercent ? `${Number(s.ownershipPercent).toFixed(1)}% participación` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "DISTRIBUTED" ? "default" : s.status === "APPROVED" ? "secondary" : "outline"}
                      className={s.status === "DISTRIBUTED" ? "bg-emerald-500" : ""}
                    >
                      {s.status === "DISTRIBUTED" ? "Pagado" : s.status === "APPROVED" ? "Aprobado" : "Pendiente"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Detail Dialog */}
      {selectedSettlement && (
        <SettlementDetailDialog
          settlementId={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SETTLEMENT DETAIL DIALOG (Waterfall Visual)
// ============================================================================

function SettlementDetailDialog({
  settlementId,
  onClose,
}: {
  settlementId: number;
  onClose: () => void;
}) {
  const detailQuery = financialTrpc.mySettlementDetail.useQuery({ settlementId });
  const detail = detailQuery.data;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-emerald-500" />
            Detalle de Liquidación — Waterfall
          </DialogTitle>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !detail ? (
          <p className="text-muted-foreground text-center py-8">No se encontró el detalle</p>
        ) : (
          <div className="space-y-6">
            {/* Period Info */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  {formatDate(detail.periodStart)} — {formatDate(detail.periodEnd)}
                </p>
                <p className="text-xs text-muted-foreground">{detail.periodType}</p>
              </div>
              <Badge
                variant={detail.status === "DISTRIBUTED" ? "default" : "secondary"}
                className={detail.status === "DISTRIBUTED" ? "bg-emerald-500" : ""}
              >
                {detail.status === "DISTRIBUTED" ? "Distribuido" : detail.status}
              </Badge>
            </div>

            {/* Waterfall Visual */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-500" />
                Cascada de Pagos (Waterfall)
              </h3>

              {/* Gross Revenue */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Ingreso Bruto (Venta de Energía)</span>
                </div>
                <span className="font-bold text-emerald-500">{formatCOP(detail.grossRevenue)}</span>
              </div>

              {/* Expense Lines */}
              {detail.expenseLines?.map((line: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10 ml-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-sm">{line.description || line.category}</span>
                  </div>
                  <span className="text-sm font-medium text-red-500">- {formatCOP(line.amount)}</span>
                </div>
              ))}

              {/* Total Expenses */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium">Total Gastos Operativos</span>
                </div>
                <span className="font-bold text-red-500">- {formatCOP(detail.totalExpenses)}</span>
              </div>

              <Separator />

              {/* Net Revenue */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Ingreso Neto</span>
                </div>
                <span className="font-bold text-blue-500">{formatCOP(detail.netRevenue)}</span>
              </div>

              {/* Distribution Split */}
              <div className="grid grid-cols-2 gap-2 ml-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <span className="text-xs">Inversionistas (70%)</span>
                  <span className="text-sm font-bold text-emerald-500">{formatCOP(detail.investorTotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <span className="text-xs">Gestor GHP (30%)</span>
                  <span className="text-sm font-bold text-amber-500">{formatCOP(detail.platformAmount)}</span>
                </div>
              </div>

              <Separator />

              {/* Your Share */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-sm font-bold">Tu Distribución</span>
                    <p className="text-xs text-muted-foreground">
                      Proporcional a tu participación
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-500">{formatCOP(detail.myShare || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TAB 2: INDICADORES FINANCIEROS
// ============================================================================

function FinancialIndicatorsTab() {
  const summaryQuery = financialTrpc.mySummary.useQuery();
  const settlementsQuery = financialTrpc.mySettlements.useQuery({ limit: 50 });
  const summary = summaryQuery.data;
  const settlements = settlementsQuery.data || [];

  // Calculate financial metrics
  const metrics = useMemo(() => {
    if (!summary || settlements.length === 0) return null;

    const totalInvested = Number(summary.totalInvested || 0);
    const totalDistributed = Number(summary.totalDistributed || 0);
    const pendingBalance = Number(summary.pendingBalance || 0);

    // ROI acumulado
    const roiAccumulated = totalInvested > 0 ? ((totalDistributed / totalInvested) * 100) : 0;

    // Rentabilidad mensual promedio
    const distributedSettlements = settlements.filter((s: any) => s.status === "DISTRIBUTED");
    const monthlyAvg = distributedSettlements.length > 0
      ? distributedSettlements.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0) / distributedSettlements.length
      : 0;

    // Rentabilidad mensual como % del capital
    const monthlyReturnPct = totalInvested > 0 ? ((monthlyAvg / totalInvested) * 100) : 0;

    // Rentabilidad anualizada estimada
    const annualizedReturn = monthlyReturnPct * 12;

    // Tiempo estimado de recuperación (meses)
    const recoveryMonths = monthlyAvg > 0 ? Math.ceil(pendingBalance / monthlyAvg) : 0;

    // Valorización (total distribuido + valor de participación restante)
    const currentValue = totalDistributed + totalInvested; // Simplified: investment still holds its value
    const appreciation = totalInvested > 0 ? (((currentValue - totalInvested) / totalInvested) * 100) : 0;

    // Último mes vs anterior
    const lastMonth = distributedSettlements[0];
    const prevMonth = distributedSettlements[1];
    const monthOverMonth = lastMonth && prevMonth
      ? ((Number(lastMonth.amount) - Number(prevMonth.amount)) / Number(prevMonth.amount)) * 100
      : 0;

    return {
      totalInvested,
      totalDistributed,
      pendingBalance,
      roiAccumulated,
      monthlyAvg,
      monthlyReturnPct,
      annualizedReturn,
      recoveryMonths,
      appreciation,
      monthOverMonth,
      distributedCount: distributedSettlements.length,
    };
  }, [summary, settlements]);

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin datos financieros disponibles</p>
        <p className="text-sm mt-1">Los indicadores se calcularán cuando haya liquidaciones distribuidas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ROI Acumulado */}
        <Card className="border-emerald-500/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ROI Acumulado</p>
                <p className="text-3xl font-bold mt-1 text-emerald-500">{metrics.roiAccumulated.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCOP(metrics.totalDistributed)} de {formatCOP(metrics.totalInvested)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
            <Progress value={Math.min(metrics.roiAccumulated, 100)} className="mt-3 h-2" />
          </CardContent>
        </Card>

        {/* Rentabilidad Mensual */}
        <Card className="border-blue-500/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rentabilidad Mensual</p>
                <p className="text-3xl font-bold mt-1 text-blue-500">{metrics.monthlyReturnPct.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio: {formatCOP(metrics.monthlyAvg)}/mes
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Percent className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-xs">
              {metrics.monthOverMonth >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={metrics.monthOverMonth >= 0 ? "text-emerald-500" : "text-red-500"}>
                {Math.abs(metrics.monthOverMonth).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Rentabilidad Anualizada */}
        <Card className="border-purple-500/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rentabilidad Anualizada</p>
                <p className="text-3xl font-bold mt-1 text-purple-500">{metrics.annualizedReturn.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Proyección basada en promedio mensual
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tiempo de Recuperación */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">Tiempo Estimado de Recuperación</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold">{metrics.recoveryMonths}</p>
                  <p className="text-sm text-muted-foreground">meses restantes</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo pendiente: {formatCOP(metrics.pendingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valorización */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <PiggyBank className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">Valorización de Inversión</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-emerald-500">+{metrics.appreciation.toFixed(1)}%</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Capital original + retornos acumulados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Estado de Pérdidas y Ganancias (Simplificado)
          </CardTitle>
          <CardDescription>
            Resumen acumulado de tu participación en el proyecto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5">
              <span className="text-sm font-medium">Capital Invertido</span>
              <span className="font-bold">{formatCOP(metrics.totalInvested)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5">
              <span className="text-sm font-medium">Total Distribuido (Ingresos)</span>
              <span className="font-bold text-emerald-500">+ {formatCOP(metrics.totalDistributed)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm font-medium">Saldo Pendiente por Recuperar</span>
              <span className="font-bold text-amber-500">{formatCOP(metrics.pendingBalance)}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <span className="text-sm font-bold">Ganancia/Pérdida Neta</span>
              <span className={`text-xl font-bold ${metrics.totalDistributed - metrics.totalInvested >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {metrics.totalDistributed - metrics.totalInvested >= 0 ? "+" : ""}{formatCOP(metrics.totalDistributed - metrics.totalInvested)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Los valores reflejan las liquidaciones distribuidas hasta la fecha. Datos actualizados en cada período de liquidación.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// TAB 3: INDICADORES OPERATIVOS SLA
// ============================================================================

function OperationalSLATab() {
  const summaryQuery = financialTrpc.mySummary.useQuery();
  const summary = summaryQuery.data;

  // Get metrics for each station the investor owns
  const stationIds: number[] = summary?.stationIds || [];

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (stationIds.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin estaciones vinculadas</p>
        <p className="text-sm mt-1">Los indicadores operativos se mostrarán cuando tengas estaciones asignadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Explanation Card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Acuerdo de Nivel de Servicio (SLA) — Anexo 10</p>
              <p className="text-xs text-muted-foreground mt-1">
                Estos indicadores miden el cumplimiento operativo de GHP según el contrato V3.4. 
                El incumplimiento sostenido activa consecuencias progresivas: Plan de Mejora (15 días) → 
                Reducción 10% Comisión → Evento de Incumplimiento (&gt;6 meses).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Station Metrics */}
      {stationIds.map((stationId) => (
        <StationSLACard key={stationId} stationId={stationId} />
      ))}
    </div>
  );
}

function StationSLACard({ stationId }: { stationId: number }) {
  const metricsQuery = financialTrpc.getMetrics.useQuery({ stationId, limit: 1 });
  const latestQuery = financialTrpc.getLatestMetric.useQuery({ stationId });
  const latest = latestQuery.data;

  const SLA_TARGETS = [
    {
      key: "availability",
      label: "Disponibilidad Operativa",
      target: "≥ 95%",
      icon: Gauge,
      value: latest ? formatPercent(latest.availabilityPercent) : "—",
      numValue: Number(latest?.availabilityPercent || 0),
      threshold: 95,
      description: "Cargadores activos / año",
      color: "emerald",
    },
    {
      key: "response",
      label: "Respuesta Fallas Críticas",
      target: "≤ 24h",
      icon: Clock,
      value: latest ? `${Number(latest.avgCriticalResponseHours).toFixed(1)}h` : "—",
      numValue: Number(latest?.avgCriticalResponseHours || 0),
      threshold: 24,
      isInverse: true,
      description: "Tiempo máximo de atención",
      color: "blue",
    },
    {
      key: "platform",
      label: "Uptime Plataforma",
      target: "≥ 99%",
      icon: Wifi,
      value: latest ? formatPercent(latest.platformUptimePercent) : "—",
      numValue: Number(latest?.platformUptimePercent || 0),
      threshold: 99,
      description: "Disponibilidad mensual EVGREEN",
      color: "purple",
    },
    {
      key: "satisfaction",
      label: "Satisfacción del Usuario",
      target: "≥ 4.0/5",
      icon: Star,
      value: latest ? `${Number(latest.userSatisfactionScore).toFixed(1)}/5` : "—",
      numValue: Number(latest?.userSatisfactionScore || 0),
      threshold: 4.0,
      description: "Encuesta trimestral NPS",
      color: "amber",
    },
    {
      key: "billing",
      label: "Precisión Facturación",
      target: "≥ 99.9%",
      icon: Receipt,
      value: latest ? formatPercent(latest.billingAccuracyPercent) : "—",
      numValue: Number(latest?.billingAccuracyPercent || 0),
      threshold: 99.9,
      description: "Exactitud en cobros de energía",
      color: "cyan",
    },
    {
      key: "solar",
      label: "Generación Solar",
      target: "≥ 85%",
      icon: Sun,
      value: latest ? formatPercent(latest.solarGenerationPercent) : "—",
      numValue: Number(latest?.solarGenerationPercent || 0),
      threshold: 85,
      description: "Rendimiento vs. capacidad instalada",
      color: "yellow",
    },
  ];

  const getStatusIcon = (metric: typeof SLA_TARGETS[0]) => {
    if (!latest) return <Info className="h-4 w-4 text-muted-foreground" />;
    const isInverse = metric.isInverse;
    const passes = isInverse
      ? metric.numValue <= metric.threshold
      : metric.numValue >= metric.threshold;
    return passes
      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      : <AlertTriangle className="h-4 w-4 text-amber-500" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-500" />
          Estación #{stationId}
          {latest && (
            <Badge
              variant={latest.slaStatus === "COMPLIANT" ? "default" : "destructive"}
              className={latest.slaStatus === "COMPLIANT" ? "bg-emerald-500 ml-2" : "ml-2"}
            >
              {latest.slaStatus === "COMPLIANT" ? "Cumple SLA" : "Incumplimiento"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Período: {latest ? formatDate(latest.periodStart) + " — " + formatDate(latest.periodEnd) : "Sin datos"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!latest ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay métricas registradas para esta estación</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SLA_TARGETS.map((metric) => (
              <div
                key={metric.key}
                className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20"
              >
                <div className={`h-10 w-10 rounded-lg bg-${metric.color}-500/10 flex items-center justify-center shrink-0`}>
                  <metric.icon className={`h-5 w-5 text-${metric.color}-500`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate">{metric.label}</p>
                    {getStatusIcon(metric)}
                  </div>
                  <p className="text-lg font-bold mt-0.5">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground">Meta: {metric.target}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Consequences Timeline */}
        {latest && latest.slaStatus !== "COMPLIANT" && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs font-medium text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Consecuencias Progresivas por Incumplimiento
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <Badge variant="outline" className="text-[10px]">Plan de Mejora (15 días)</Badge>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">Reducción 10% Comisión</Badge>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">Evento de Incumplimiento (&gt;6 meses)</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
