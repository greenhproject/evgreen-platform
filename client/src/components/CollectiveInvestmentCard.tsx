/**
 * Componente para mostrar las participaciones colectivas del inversionista
 * Muestra datos REALES proporcionales según el % de participación en cada estación
 * Incluye indicadores financieros y operativos del centro financiero
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Zap,
  MapPin,
  Sun,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
} from "lucide-react";

const financialTrpc = trpc.financial as any;

export function CollectiveInvestmentCard() {
  const { data: participations, isLoading } = trpc.crowdfunding.getMyParticipations.useQuery();
  const { data: financialSummary } = financialTrpc.mySummary.useQuery();

  const formatCOP = (valor: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const formatCOPShort = (valor: number) => {
    if (valor >= 1000000000) {
      return `$${(valor / 1000000000).toFixed(1)}MM`;
    }
    if (valor >= 1000000) {
      return `$${(valor / 1000000).toFixed(1)}M`;
    }
    if (valor >= 1000) {
      return `$${(valor / 1000).toFixed(0)}K`;
    }
    return formatCOP(valor);
  };

  // Compute aggregated financial metrics
  const metrics = useMemo(() => {
    if (!participations || participations.length === 0) return null;

    const totalInvertido = participations.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const totalEarningsNet = participations.reduce((sum: number, p: any) => sum + (p.realEarnings?.totalNet || 0), 0);
    const totalEarningsGross = participations.reduce((sum: number, p: any) => sum + (p.realEarnings?.totalGross || 0), 0);
    const totalTx = participations.reduce((sum: number, p: any) => sum + (p.realEarnings?.txCount || 0), 0);
    const totalKwh = participations.reduce((sum: number, p: any) => sum + (p.realEarnings?.totalKwh || 0), 0);
    const participacionesActivas = participations.filter((p: any) => p.paymentStatus === 'COMPLETED');

    // Financial indicators from financial center
    const totalDistributed = Number(financialSummary?.totalNetEarnings || 0);
    const roiAccumulated = totalInvertido > 0 ? ((totalDistributed / totalInvertido) * 100) : 0;
    const pendingBalance = Math.max(0, totalInvertido - totalDistributed);

    return {
      totalInvertido,
      totalEarningsNet,
      totalEarningsGross,
      totalTx,
      totalKwh,
      participacionesActivas: participacionesActivas.length,
      totalDistributed,
      roiAccumulated,
      pendingBalance,
    };
  }, [participations, financialSummary]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!participations || participations.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-orange-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-amber-500" />
          Mis Inversiones Colectivas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* KPI Summary Row */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Capital Invertido</p>
              </div>
              <p className="text-lg font-bold text-amber-400">{formatCOPShort(metrics.totalInvertido)}</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ingresos Netos</p>
              </div>
              <p className="text-lg font-bold text-emerald-400">{formatCOPShort(metrics.totalEarningsNet)}</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">ROI Acumulado</p>
              </div>
              <p className="text-lg font-bold text-blue-400">{metrics.roiAccumulated.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Sesiones</p>
              </div>
              <p className="text-lg font-bold text-cyan-400">{metrics.totalTx.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Participations List */}
        <div className="space-y-4">
          {participations.map((participation: any) => {
            const porcentaje = Number(participation.participationPercent);
            const monto = Number(participation.amount);
            const isPending = participation.paymentStatus === 'PENDING';
            const station = participation.station;
            const realEarnings = participation.realEarnings || { totalGross: 0, totalNet: 0, txCount: 0, totalKwh: 0 };
            
            // Real station status
            const isOnline = station?.isOnline || false;
            const isActive = station?.isActive || false;
            
            // Status badge logic
            let statusLabel = 'Sin vincular';
            let statusColor = 'bg-gray-500/20 text-gray-400';
            if (isPending) {
              statusLabel = 'Pago pendiente';
              statusColor = 'bg-yellow-500/20 text-yellow-400';
            } else if (!isActive) {
              statusLabel = 'Inactiva';
              statusColor = 'bg-red-500/20 text-red-400';
            } else if (isOnline) {
              statusLabel = 'En línea';
              statusColor = 'bg-emerald-500/20 text-emerald-400';
            } else {
              statusLabel = 'Desconectada';
              statusColor = 'bg-orange-500/20 text-orange-400';
            }

            // Real ROI
            const roiReal = monto > 0 ? ((realEarnings.totalNet / monto) * 100) : 0;

            // Distribution config - Fórmula correcta del modelo colectivo:
            // Margen = (PV - CE) × 90% (después aliado) × 70% (tu parte)
            const hostPct = station?.hostSharePercent || 10;
            const afterHostPct = 100 - hostPct; // 90%
            const investorModelPct = 70; // Fijo del modelo colectivo (incluye costos op)
            const evgreenModelPct = 30; // Fijo del modelo colectivo

            return (
              <div 
                key={participation.id} 
                className={`rounded-xl border overflow-hidden ${
                  isPending 
                    ? 'border-yellow-500/20 bg-yellow-950/10' 
                    : isOnline 
                      ? 'border-emerald-500/20 bg-emerald-950/10' 
                      : 'border-orange-500/20 bg-orange-950/10'
                }`}
              >
                {/* Header */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-sm block truncate">
                        {station?.name || participation.project?.name || 'Estación'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {participation.project?.city || ''}{participation.project?.zone ? ` / ${participation.project.zone}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOnline ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-orange-400" />
                    )}
                    <Badge className={`text-[10px] ${statusColor}`}>
                      {statusLabel}
                    </Badge>
                  </div>
                </div>

                {/* Participation bar */}
                <div className="px-4 pb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Tu participación en ingresos</span>
                    <span className="font-bold text-amber-400">{porcentaje.toFixed(1)}%</span>
                  </div>
                  <Progress value={porcentaje} className="h-1.5" />
                </div>

                <Separator className="opacity-10" />

                {/* Financial Indicators Grid */}
                <div className="px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invertido</p>
                      <p className="text-sm font-bold mt-0.5">{formatCOPShort(monto)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tu Ingreso Neto</p>
                      <p className="text-sm font-bold mt-0.5 text-emerald-400">
                        {realEarnings.totalNet > 0 ? formatCOPShort(realEarnings.totalNet) : '$0'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ROI Real</p>
                      <p className={`text-sm font-bold mt-0.5 flex items-center gap-0.5 ${roiReal > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {roiReal > 0 && <ArrowUpRight className="w-3 h-3" />}
                        {roiReal.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Energía (kWh)</p>
                      <p className="text-sm font-bold mt-0.5 text-cyan-400">
                        {realEarnings.totalKwh > 0 ? `${realEarnings.totalKwh.toFixed(1)}` : '0'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Waterfall del Modelo - Fórmula real */}
                {!isPending && (
                  <>
                    <Separator className="opacity-10" />
                    <div className="px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <PieChart className="w-3 h-3" />
                        Fórmula del modelo
                      </p>
                      <div className="space-y-1.5">
                        {/* Step 1: Gross margin */}
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-4 text-center">1.</span>
                          <span className="text-white/80">Ingreso bruto − Costo energía</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="text-emerald-400 font-medium">Margen bruto</span>
                        </div>
                        {/* Step 2: After host */}
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-4 text-center">2.</span>
                          <span className="text-white/80">Margen bruto × {afterHostPct}%</span>
                          <span className="text-muted-foreground">(aliado {hostPct}%)</span>
                        </div>
                        {/* Step 3: Investor share */}
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-4 text-center">3.</span>
                          <span className="text-white/80">× {investorModelPct}%</span>
                          <span className="text-emerald-400 font-medium">= Tu parte</span>
                          <span className="text-muted-foreground">(costos op. incluidos)</span>
                        </div>
                      </div>
                      {/* Visual bar */}
                      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mt-2">
                        <div className="bg-amber-500/70 rounded-l-full" style={{ width: `${hostPct}%` }} title={`Aliado: ${hostPct}%`} />
                        <div className="bg-emerald-500" style={{ width: `${investorModelPct * afterHostPct / 100}%` }} title={`Tu parte: ${investorModelPct}%`} />
                        <div className="bg-blue-500 rounded-r-full" style={{ width: `${evgreenModelPct * afterHostPct / 100}%` }} title={`EVGreen: ${evgreenModelPct}%`} />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 inline-block" />
                          Aliado {hostPct}%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Tu parte {investorModelPct}%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                          EVGreen {evgreenModelPct}%
                        </span>
                      </div>
                      {/* Fixed costs note */}
                      <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-white/5">
                        <Shield className="w-3 h-3 text-amber-400/60 mt-0.5 flex-shrink-0" />
                        <p className="text-[9px] text-amber-300/50 leading-relaxed">
                          Gastos fijos (pólizas, fiduciario) se descuentan en liquidación mensual, cubiertos dentro del {evgreenModelPct}% EVGreen.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Solar badge */}
                {participation.project?.hasSolarPanels && (
                  <>
                    <Separator className="opacity-10" />
                    <div className="px-4 py-2 flex items-center gap-2 text-xs text-amber-400">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Estación con energía solar</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Recovery indicator */}
        {metrics && metrics.pendingBalance > 0 && (
          <div className="p-3 rounded-lg bg-black/20 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-muted-foreground font-medium">Recuperación de Capital</p>
              </div>
              <p className="text-xs font-bold text-amber-400">
                {metrics.totalInvertido > 0 
                  ? `${((metrics.totalDistributed / metrics.totalInvertido) * 100).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
            <Progress 
              value={metrics.totalInvertido > 0 ? Math.min((metrics.totalDistributed / metrics.totalInvertido) * 100, 100) : 0} 
              className="h-1.5" 
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Pendiente: {formatCOPShort(metrics.pendingBalance)} de {formatCOPShort(metrics.totalInvertido)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
