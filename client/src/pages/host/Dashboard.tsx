/**
 * Dashboard del Aliado Comercial (dueño del espacio)
 * Muestra resumen de ingresos acumulados por fuente, estaciones vinculadas,
 * y liquidaciones pendientes/pagadas.
 * @author Green House Project
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const financialTrpc = trpc.financial as any;

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  DollarSign,
  Zap,
  Ban,
  Ticket,
  Megaphone,
  Receipt,
  Calendar,
  TrendingUp,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Info,
  Bolt,
  MapPin,
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

function formatDate(ts: number | string | null | undefined): string {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function HostDashboard() {
  const { user } = useAuth();

  // Fetch host financial data
  const summaryQuery = financialTrpc.hostSummary.useQuery();
  const settlementsQuery = financialTrpc.hostSettlements.useQuery({ limit: 10 });

  const summary = summaryQuery.data;
  const settlements = settlementsQuery.data || [];

  const isLoading = summaryQuery.isLoading || settlementsQuery.isLoading;

  // Calculate revenue breakdown from settlements
  const revenueBreakdown = useMemo(() => {
    if (!settlements || settlements.length === 0) return null;

    let totalEnergy = 0;
    let totalPenalties = 0;
    let totalReservations = 0;
    let totalAdvertising = 0;
    let totalEnergyCost = 0;
    let totalGross = 0;
    let totalNet = 0;

    settlements.forEach((s: any) => {
      totalEnergy += Number(s.revenueFromEnergy || 0);
      totalPenalties += Number(s.revenueFromPenalties || 0);
      totalReservations += Number(s.revenueFromReservations || 0);
      totalAdvertising += Number(s.revenueFromAdvertising || 0);
      totalEnergyCost += Number(s.totalEnergyCost || 0);
      totalGross += Number(s.grossRevenue || 0);
      totalNet += Number(s.hostAmount || s.hostTotalAmount || 0);
    });

    return {
      totalEnergy,
      totalPenalties,
      totalReservations,
      totalAdvertising,
      totalEnergyCost,
      totalGross,
      totalNet,
    };
  }, [settlements]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
          Bienvenido, {user?.name || "Aliado Comercial"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen financiero de los ingresos generados por las estaciones de carga en tu espacio
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Acumulado</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCOP(summary?.totalDistributed || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pendiente</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCOP(summary?.pendingBalance || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Estaciones</p>
                <p className="text-sm sm:text-lg font-bold">{summary?.totalStations || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Liquidaciones</p>
                <p className="text-sm sm:text-lg font-bold">{summary?.totalSettlements || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown by Source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bolt className="h-5 w-5 text-amber-500" />
            Desglose de Ingresos por Fuente
          </CardTitle>
          <CardDescription>
            Ingresos brutos acumulados de las estaciones en tu espacio, antes de deducciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!revenueBreakdown ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin datos de ingresos aún</p>
              <p className="text-sm mt-1">Los datos se mostrarán cuando se generen liquidaciones</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Revenue sources */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs font-medium text-muted-foreground">Venta de Energía</span>
                  </div>
                  <p className="text-lg font-bold">{formatCOP(revenueBreakdown.totalEnergy)}</p>
                  {revenueBreakdown.totalGross > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {((revenueBreakdown.totalEnergy / revenueBreakdown.totalGross) * 100).toFixed(1)}% del total
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-medium text-muted-foreground">Penalidades</span>
                  </div>
                  <p className="text-lg font-bold">{formatCOP(revenueBreakdown.totalPenalties)}</p>
                  {revenueBreakdown.totalGross > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {((revenueBreakdown.totalPenalties / revenueBreakdown.totalGross) * 100).toFixed(1)}% del total
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Reservas</span>
                  </div>
                  <p className="text-lg font-bold">{formatCOP(revenueBreakdown.totalReservations)}</p>
                  {revenueBreakdown.totalGross > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {((revenueBreakdown.totalReservations / revenueBreakdown.totalGross) * 100).toFixed(1)}% del total
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-medium text-muted-foreground">Publicidad</span>
                  </div>
                  <p className="text-lg font-bold">{formatCOP(revenueBreakdown.totalAdvertising)}</p>
                  {revenueBreakdown.totalGross > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {((revenueBreakdown.totalAdvertising / revenueBreakdown.totalGross) * 100).toFixed(1)}% del total
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Waterfall summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-sm font-medium">Ingreso Bruto Total</span>
                  <span className="font-bold text-emerald-600">{formatCOP(revenueBreakdown.totalGross)}</span>
                </div>
                {revenueBreakdown.totalEnergyCost > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 ml-4">
                    <span className="text-sm">(-) Costo de energía eléctrica</span>
                    <span className="font-medium text-amber-600">- {formatCOP(revenueBreakdown.totalEnergyCost)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-2 border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold">Tu Participación Acumulada</span>
                      <p className="text-xs text-muted-foreground">
                        Según el % configurado por estación
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-amber-600">{formatCOP(summary?.totalDistributed || 0)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Settlements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-500" />
            Últimas Liquidaciones
          </CardTitle>
          <CardDescription>
            Historial de liquidaciones con tu participación como Aliado Comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay liquidaciones registradas</p>
              <p className="text-sm mt-1">Las liquidaciones se generan al cierre de cada período mensual</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s: any) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-colors gap-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {formatDate(s.periodStart)} — {formatDate(s.periodEnd)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Estación: {s.stationName || `#${s.stationId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-amber-600">{formatCOP(s.hostAmount || s.hostTotalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(s.hostSharePercent || 0).toFixed(1)}% del neto
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "DISTRIBUTED" ? "default" : s.status === "APPROVED" ? "secondary" : "outline"}
                      className={s.status === "DISTRIBUTED" ? "bg-amber-500" : ""}
                    >
                      {s.status === "DISTRIBUTED" ? "Pagado" : s.status === "APPROVED" ? "Aprobado" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info note */}
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Info className="h-3 w-3" />
        Los montos reflejan tu participación como dueño del espacio donde operan las estaciones. 
        El porcentaje se configura al momento de crear cada estación y puede variar entre ellas.
      </p>
    </div>
  );
}
