import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  CheckCircle2,
  DollarSign,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
  Target,
} from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function EventStats() {
  const statsQuery = trpc.event.getEventStats.useQuery();
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

  const PACKAGE_NAMES: Record<string, string> = {
    AC: "AC Básico",
    DC_INDIVIDUAL: "DC Individual",
    COLECTIVO: "Colectivo",
  };

  const PACKAGE_AMOUNTS: Record<string, number> = {
    AC: 8500000,
    DC_INDIVIDUAL: 85000000,
    COLECTIVO: 200000000,
  };

  // Calcular inversión potencial
  const potentialInvestment = packageDist.reduce((acc, p) => {
    const pkg = p.package || "AC";
    return acc + (PACKAGE_AMOUNTS[pkg] || 0) * p.count;
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-green-500" />
          Estadísticas del Evento
        </h1>
        <p className="text-muted-foreground text-sm">
          Resumen en tiempo real del evento de lanzamiento EVGreen
        </p>
      </div>

      {/* Cupos Fundadores */}
      <Card className="border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-500" />
                Cupos Fundadores
              </h2>
              <p className="text-sm text-muted-foreground">
                {guestStats?.founderSlotsUsed || 0} de 30 cupos asignados
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-400">
                {guestStats?.founderSlotsAvailable || 30}
              </p>
              <p className="text-xs text-muted-foreground">disponibles</p>
            </div>
          </div>
          <div className="w-full bg-green-500/10 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-600 to-green-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${((guestStats?.founderSlotsUsed || 0) / 30) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {Math.round(((guestStats?.founderSlotsUsed || 0) / 30) * 100)}% de cupos asignados
          </p>
        </CardContent>
      </Card>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40">
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <p className="text-3xl font-bold">{guestStats?.total || 0}</p>
            <p className="text-sm text-muted-foreground">Total Invitados</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-green-400">{guestStats?.checkedIn || 0}</p>
            <p className="text-sm text-muted-foreground">Check-in</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(paymentStats?.totalPaid || 0)}
            </p>
            <p className="text-sm text-muted-foreground">Recaudado</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 text-center">
            <Target className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-400">
              {formatCurrency(potentialInvestment)}
            </p>
            <p className="text-sm text-muted-foreground">Inversión Potencial</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de estados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estado de Invitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                Invitados
              </span>
              <span className="font-bold">{guestStats?.invited || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                Confirmados
              </span>
              <span className="font-bold">{guestStats?.confirmed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                Registrados (Check-in)
              </span>
              <span className="font-bold">{guestStats?.checkedIn || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                Cancelados
              </span>
              <span className="font-bold">{guestStats?.cancelled || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribución por Paquete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {packageDist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin datos de paquetes aún
              </p>
            ) : (
              packageDist.map((p) => (
                <div key={p.package} className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Zap className="h-3 w-3 text-green-400" />
                    {PACKAGE_NAMES[p.package || ""] || p.package}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{p.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatCurrency((PACKAGE_AMOUNTS[p.package || ""] || 0) * p.count)})
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pagos */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Resumen de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xl font-bold text-green-400">
                {paymentStats?.paidCount || 0}
              </p>
              <p className="text-xs text-muted-foreground">Pagos Confirmados</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-yellow-400">
                {paymentStats?.pendingCount || 0}
              </p>
              <p className="text-xs text-muted-foreground">Pagos Pendientes</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(paymentStats?.totalPaid || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Recaudado</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-yellow-400">
                {formatCurrency(paymentStats?.totalPending || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Pendiente por Cobrar</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
