/**
 * Componente para mostrar las participaciones colectivas del inversionista
 * Muestra datos proporcionales según el % de participación en cada estación
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Zap,
  MapPin,
  PieChart,
  Sun
} from "lucide-react";

export function CollectiveInvestmentCard() {
  const { data: participations, isLoading } = trpc.crowdfunding.getMyParticipations.useQuery();

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
      return `$${(valor / 1000000).toFixed(0)}M`;
    }
    return formatCOP(valor);
  };

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
    return null; // No mostrar si no hay participaciones colectivas
  }

  // Calcular totales
  const totalInvertido = participations.reduce((sum, p) => sum + Number(p.amount), 0);
  const participacionesActivas = participations.filter(p => p.paymentStatus === 'COMPLETED');

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-900/10 to-orange-900/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-amber-500" />
          Mis Inversiones Colectivas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen total */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-black/20">
            <p className="text-xs text-muted-foreground">Total Invertido</p>
            <p className="text-xl font-bold text-amber-400">{formatCOPShort(totalInvertido)}</p>
          </div>
          <div className="p-4 rounded-lg bg-black/20">
            <p className="text-xs text-muted-foreground">Participaciones</p>
            <p className="text-xl font-bold text-white">{participacionesActivas.length}</p>
          </div>
        </div>

        {/* Lista de participaciones */}
        <div className="space-y-4">
          {participations.map((participation) => {
            const porcentaje = Number(participation.participationPercent);
            const monto = Number(participation.amount);
            const isPending = participation.paymentStatus === 'PENDING';
            
            // Calcular ingresos proporcionales (estimados)
            // Asumiendo 480kW total, 6h uso, $1800/kWh, 70% inversionista, 85% eficiencia
            const potenciaTotal = 480;
            const horasUso = 6;
            const precioKwh = 1800;
            const costoKwh = 250; // Con solar
            const eficiencia = 0.92;
            const porcentajeInversionista = 0.70;
            const costosOperativos = 0.15;
            
            const energiaDiaria = potenciaTotal * horasUso * eficiencia;
            const margenBrutoDiario = energiaDiaria * (precioKwh - costoKwh);
            const margenNetoDistribuible = margenBrutoDiario * (1 - costosOperativos);
            const ingresoInversionistaDiario = margenNetoDistribuible * porcentajeInversionista;
            
            // Ingreso proporcional según participación
            const ingresoMensualProporcional = (ingresoInversionistaDiario * 30) * (porcentaje / 100);
            const ingresoAnualProporcional = (ingresoInversionistaDiario * 365) * (porcentaje / 100);
            const roiAnual = (ingresoAnualProporcional / monto) * 100;

            return (
              <div 
                key={participation.id} 
                className={`p-4 rounded-lg border ${
                  isPending 
                    ? 'border-yellow-500/30 bg-yellow-900/10' 
                    : 'border-green-500/30 bg-green-900/10'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span className="font-medium">
                      {(participation as any).project?.city || 'Estación'} - {(participation as any).project?.zone || ''}
                    </span>
                  </div>
                  <Badge className={isPending ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}>
                    {isPending ? 'Pendiente' : 'Activa'}
                  </Badge>
                </div>

                {/* Barra de participación */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Tu participación</span>
                    <span className="font-bold text-amber-400">{porcentaje.toFixed(1)}%</span>
                  </div>
                  <Progress value={porcentaje} className="h-2" />
                </div>

                {/* Detalles de inversión */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-muted-foreground text-xs">Invertido</p>
                      <p className="font-medium">{formatCOPShort(monto)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-muted-foreground text-xs">Tu potencia</p>
                      <p className="font-medium">{(potenciaTotal * porcentaje / 100).toFixed(0)}kW</p>
                    </div>
                  </div>
                </div>

                {/* Proyección de ingresos (solo para activas) */}
                {!isPending && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Proyección de ingresos (proporcional a tu {porcentaje.toFixed(1)}%)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded bg-black/20">
                        <p className="text-xs text-muted-foreground">Mensual</p>
                        <p className="font-bold text-green-400 text-sm">{formatCOPShort(ingresoMensualProporcional)}</p>
                      </div>
                      <div className="text-center p-2 rounded bg-black/20">
                        <p className="text-xs text-muted-foreground">Anual</p>
                        <p className="font-bold text-green-400 text-sm">{formatCOPShort(ingresoAnualProporcional)}</p>
                      </div>
                      <div className="text-center p-2 rounded bg-black/20">
                        <p className="text-xs text-muted-foreground">ROI</p>
                        <p className="font-bold text-amber-400 text-sm">{roiAnual.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info de solar si aplica */}
                {(participation as any).project?.hasSolarPanels && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                    <Sun className="w-3 h-3" />
                    <span>Estación con energía solar - Mayor rentabilidad</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota informativa */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-200">
            <strong>Nota:</strong> Los ingresos mostrados son proyecciones basadas en 6 horas de uso diario 
            con energía solar. Los ingresos reales pueden variar según el uso de la estación.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
