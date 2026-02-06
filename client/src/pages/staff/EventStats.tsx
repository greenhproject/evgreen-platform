import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CheckCircle2,
  DollarSign,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
  Target,
  Mail,
  MailCheck,
  PieChart,
  CreditCard,
  Banknote,
  ArrowUpRight,
  Activity,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number): string {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

const PACKAGE_NAMES: Record<string, string> = {
  AC: "AC Básico",
  DC_INDIVIDUAL: "DC Individual 120kW",
  COLECTIVO: "Estación Premium",
};

const PACKAGE_AMOUNTS: Record<string, number> = {
  AC: 8500000,
  DC_INDIVIDUAL: 85000000,
  COLECTIVO: 200000000,
};

const PACKAGE_COLORS: Record<string, string> = {
  AC: "#3b82f6",
  DC_INDIVIDUAL: "#22c55e",
  COLECTIVO: "#f59e0b",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  NEQUI: "Nequi",
  CARD: "Tarjeta",
  WOMPI: "Wompi",
};

const METHOD_COLORS: Record<string, string> = {
  CASH: "#22c55e",
  TRANSFER: "#3b82f6",
  NEQUI: "#a855f7",
  CARD: "#f59e0b",
  WOMPI: "#ec4899",
};

// Simple SVG Donut Chart component
function DonutChart({
  data,
  size = 180,
  strokeWidth = 28,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <p className="text-sm text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const segmentLength = (d.value / total) * circumference;
        const dashArray = `${segmentLength} ${circumference - segmentLength}`;
        const dashOffset = -offset;
        offset += segmentLength;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ opacity: 0.85 }}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        fill="white"
        fontSize="24"
        fontWeight="bold"
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        fill="#a0a0a0"
        fontSize="12"
      >
        total
      </text>
    </svg>
  );
}

// Simple horizontal bar chart
function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  suffix,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold" style={{ color }}>
          {suffix || value}
        </span>
      </div>
      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function EventStats() {
  const statsQuery = trpc.event.getEventStats.useQuery(undefined, {
    refetchInterval: 15000, // Refrescar cada 15s
  });
  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const guestStats = stats?.guests;
  const paymentStats = stats?.payments;
  const packageDist = stats?.packageDistribution || [];
  const methodDist = stats?.paymentMethodDistribution || [];
  const recentPayments = stats?.recentPayments || [];

  // Datos para donut de paquetes
  const packageDonutData = packageDist.map((p) => ({
    label: PACKAGE_NAMES[p.package || ""] || p.package || "Otro",
    value: p.count,
    color: PACKAGE_COLORS[p.package || ""] || "#666",
  }));

  // Datos para donut de estados
  const statusDonutData = [
    { label: "Invitados", value: guestStats?.invited || 0, color: "#3b82f6" },
    { label: "Confirmados", value: guestStats?.confirmed || 0, color: "#eab308" },
    { label: "Check-in", value: guestStats?.checkedIn || 0, color: "#22c55e" },
    { label: "Cancelados", value: guestStats?.cancelled || 0, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // Max para barras de métodos de pago
  const maxMethodTotal = Math.max(...methodDist.map((m) => m.total), 1);

  // Tasa de conversión
  const conversionRate =
    (guestStats?.total || 0) > 0
      ? Math.round(
          ((paymentStats?.paidCount || 0) / (guestStats?.total || 1)) * 100
        )
      : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-green-500" />
            Resumen Ejecutivo
          </h1>
          <p className="text-muted-foreground text-sm">
            Dashboard en tiempo real del evento de lanzamiento EVGreen
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-green-500/30 text-green-400 gap-1"
        >
          <Activity className="h-3 w-3" />
          En vivo
        </Badge>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN 1: Progreso de Recaudación y Cupos */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Progreso de Recaudación */}
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              Meta de Recaudación (Reservas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-3xl font-bold text-green-400">
                  {formatCurrency(paymentStats?.totalPaid || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  de {formatCurrency(paymentStats?.reservationGoal || 30000000)}{" "}
                  meta
                </p>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {paymentStats?.goalProgress || 0}%
              </p>
            </div>
            <div className="w-full bg-white/5 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-green-600 to-green-400 relative"
                style={{
                  width: `${paymentStats?.goalProgress || 0}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/10 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">
                  {paymentStats?.paidCount || 0}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pagos confirmados
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">
                  {paymentStats?.pendingCount || 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Pendientes</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400">
                  {formatCompact(paymentStats?.averagePayment || 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pago promedio
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cupos Fundadores */}
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              Cupos Fundadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-3xl font-bold text-white">
                  {guestStats?.founderSlotsUsed || 0}
                  <span className="text-lg text-muted-foreground font-normal">
                    {" "}/ 30
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">cupos asignados</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">
                  {guestStats?.founderSlotsAvailable || 30}
                </p>
                <p className="text-xs text-muted-foreground">disponibles</p>
              </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-green-600 to-emerald-400"
                style={{
                  width: `${((guestStats?.founderSlotsUsed || 0) / 30) * 100}%`,
                }}
              />
            </div>

            {/* Invitaciones */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <MailCheck className="h-4 w-4 text-green-400" />
                <div>
                  <p className="text-sm font-bold">{guestStats?.invitationsSent || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Invitaciones enviadas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <Mail className="h-4 w-4 text-yellow-400" />
                <div>
                  <p className="text-sm font-bold">{guestStats?.invitationsPending || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Por enviar</p>
                </div>
              </div>
            </div>

            {/* Tasa de conversión */}
            <div className="mt-4 p-3 rounded-lg bg-white/5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Tasa de Conversión</p>
              <p className="text-2xl font-bold text-green-400">{conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">invitados que pagaron reserva</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN 2: KPIs Principales */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <Users className="h-6 w-6 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{guestStats?.total || 0}</p>
            <p className="text-[11px] text-muted-foreground">Total Invitados</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-400">{guestStats?.checkedIn || 0}</p>
            <p className="text-[11px] text-muted-foreground">Check-in</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-6 w-6 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{formatCompact(paymentStats?.totalPaid || 0)}</p>
            <p className="text-[11px] text-muted-foreground">Recaudado</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-6 w-6 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-400">{formatCompact(paymentStats?.potentialInvestment || 0)}</p>
            <p className="text-[11px] text-muted-foreground">Inv. Potencial</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <ArrowUpRight className="h-6 w-6 text-purple-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-400">{conversionRate}%</p>
            <p className="text-[11px] text-muted-foreground">Conversión</p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN 3: Gráficos de Distribución */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Distribución por Paquete */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4 text-green-500" />
              Distribución por Paquete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <DonutChart data={packageDonutData} size={160} strokeWidth={24} />
              <div className="mt-4 space-y-2 w-full">
                {packageDist.map((p) => (
                  <div key={p.package} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PACKAGE_COLORS[p.package || ""] || "#666" }}
                      />
                      <span className="text-muted-foreground">
                        {PACKAGE_NAMES[p.package || ""] || p.package}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{p.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({formatCompact((PACKAGE_AMOUNTS[p.package || ""] || 0) * p.count)})
                      </span>
                    </div>
                  </div>
                ))}
                {packageDist.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Sin datos aún</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estado de Invitados */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Estado de Invitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <DonutChart data={statusDonutData} size={160} strokeWidth={24} />
              <div className="mt-4 space-y-2 w-full">
                {statusDonutData.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-muted-foreground">{d.label}</span>
                    </div>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              Métodos de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {methodDist.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Sin pagos registrados aún
                </p>
              ) : (
                methodDist.map((m) => (
                  <HorizontalBar
                    key={m.method}
                    label={METHOD_LABELS[m.method || ""] || m.method || "Otro"}
                    value={m.total}
                    maxValue={maxMethodTotal}
                    color={METHOD_COLORS[m.method || ""] || "#666"}
                    suffix={`${m.count} (${formatCompact(m.total)})`}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN 4: Inversión Potencial por Paquete */}
      {/* ============================================================ */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4 text-green-500" />
            Inversión Potencial por Paquete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {packageDist.map((p) => {
              const pkgAmount = PACKAGE_AMOUNTS[p.package || ""] || 0;
              const totalPkg = pkgAmount * p.count;
              const maxPotential = Math.max(
                ...packageDist.map((x) => (PACKAGE_AMOUNTS[x.package || ""] || 0) * x.count),
                1
              );
              return (
                <HorizontalBar
                  key={p.package}
                  label={`${PACKAGE_NAMES[p.package || ""] || p.package} (${p.count} inv.)`}
                  value={totalPkg}
                  maxValue={maxPotential}
                  color={PACKAGE_COLORS[p.package || ""] || "#666"}
                  suffix={formatCurrency(totalPkg)}
                />
              );
            })}
            {packageDist.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin datos aún</p>
            )}
            {packageDist.length > 0 && (
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-sm font-semibold">Total Inversión Potencial</span>
                <span className="text-lg font-bold text-green-400">
                  {formatCurrency(paymentStats?.potentialInvestment || 0)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECCIÓN 5: Actividad Reciente */}
      {/* ============================================================ */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            Actividad Reciente de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay pagos registrados aún
            </p>
          ) : (
            <div className="space-y-2">
              {recentPayments.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        p.paymentStatus === "PAID" ? "bg-green-400" : "bg-yellow-400"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{p.guestName || "Invitado"}</p>
                      <p className="text-xs text-muted-foreground">
                        {PACKAGE_NAMES[p.selectedPackage || ""] || p.selectedPackage}
                        {" - "}
                        {METHOD_LABELS[p.paymentMethod || ""] || p.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(p.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.paidAt
                        ? new Date(p.paidAt).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Pendiente"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
