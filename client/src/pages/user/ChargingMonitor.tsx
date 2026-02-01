/**
 * ChargingMonitor - Pantalla de monitoreo de carga en tiempo real
 * 
 * Muestra:
 * - Indicador gauge circular con porcentaje
 * - kWh consumidos
 * - Costo acumulado
 * - Tiempo transcurrido
 * - Botón para detener carga
 * - Banner publicitario
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChargingGauge } from "@/components/ChargingGauge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Clock, 
  DollarSign, 
  Battery, 
  MapPin,
  StopCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Componente de banner publicitario durante la carga
function ChargingBanner() {
  const { data: banners } = trpc.banners.getActive.useQuery({ 
    type: "charging_session" 
  });
  
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 10000); // Rotar cada 10 segundos
    
    return () => clearInterval(interval);
  }, [banners]);
  
  if (!banners || banners.length === 0) {
    // Banner por defecto si no hay banners configurados
    return (
      <div className="w-full rounded-xl overflow-hidden shadow-lg mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
        <div className="text-center text-white">
          <p className="font-bold text-lg">Cargando tu vehículo con energía limpia</p>
          <p className="text-sm opacity-90">EVGreen - Movilidad sostenible</p>
        </div>
      </div>
    );
  }
  
  const banner = banners[currentBannerIndex];
  
  return (
    <div className="w-full rounded-xl overflow-hidden shadow-lg mb-4">
      {banner.imageUrl ? (
        <img 
          src={banner.imageUrl} 
          alt={banner.title}
          className="w-full h-24 object-cover"
        />
      ) : (
        <div className="w-full h-24 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center p-4">
          <div className="text-center text-white">
            <p className="font-bold text-lg">{banner.title}</p>
            {banner.description && (
              <p className="text-sm opacity-90">{banner.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Formatear tiempo transcurrido
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

// Formatear moneda COP
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ChargingMonitor() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Obtener sesión activa
  const { data: session, isLoading, refetch } = trpc.charging.getActiveSession.useQuery(
    undefined,
    { 
      refetchInterval: 5000, // Actualizar cada 5 segundos
      enabled: !!user,
    }
  );
  
  // Mutation para detener carga
  const stopChargeMutation = trpc.charging.stopCharge.useMutation({
    onSuccess: (data) => {
      toast.success("Carga detenida exitosamente");
      // Redirigir al resumen
      setLocation(`/charging-summary/${(data as { transactionId?: number }).transactionId || 0}`);
    },
    onError: (error) => {
      toast.error(`Error al detener la carga: ${error.message}`);
    },
  });
  
  // Actualizar tiempo transcurrido
  useEffect(() => {
    if (!session?.startTime) return;
    
    const startTime = new Date(session.startTime).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    
    return () => clearInterval(interval);
  }, [session?.startTime]);
  
  // Si no hay sesión activa, redirigir
  useEffect(() => {
    if (!isLoading && !session) {
      toast.info("No hay una carga activa");
      setLocation("/map");
    }
  }, [isLoading, session, setLocation]);
  
  // Detectar cuando la simulación se completa
  useEffect(() => {
    if (session) {
      const simStatus = (session as any).simulationStatus;
      const progress = (session as any).progress;
      const isSimulation = (session as any).isSimulation;
      
      // Verificar si la simulación terminó por estado o por progreso al 100%
      if (simStatus === "completed" || simStatus === "finishing" || (isSimulation && progress >= 100)) {
        // La simulación terminó, redirigir al resumen
        toast.success("¡Carga completada!");
        setLocation(`/charging-summary/${session.transactionId}`);
        return;
      }
    }
  }, [session, setLocation]);
  
  // Verificar si la transacción ya está completada en la BD
  useEffect(() => {
    if (session && session.status === "COMPLETED") {
      toast.success("¡Carga completada!");
      setLocation(`/charging-summary/${session.transactionId}`);
    }
  }, [session?.status, session?.transactionId, setLocation]);
  
  const handleStopCharge = () => {
    if (!session) return;
    
    stopChargeMutation.mutate({
      transactionId: session.transactionId,
    });
    setShowStopDialog(false);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información...</p>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return null;
  }
  
  // Calcular porcentaje de progreso
  const chargeMode = session.chargeMode as string;
  
  // Usar el progreso de la simulación si está disponible
  const simulationProgress = (session as any).progress;
  let progressPercentage = 0;
  
  if (typeof simulationProgress === 'number' && !isNaN(simulationProgress)) {
    // Si es simulación, usar el progreso directo
    progressPercentage = simulationProgress;
  } else if (session.estimatedKwh > 0) {
    // Calcular basado en kWh
    const kwhProgress = (session.currentKwh / session.estimatedKwh) * 100;
    progressPercentage = Math.min(100, Math.max(0, kwhProgress));
  } else if (session.targetAmount > 0) {
    // Calcular basado en costo
    const costProgress = (session.currentCost / session.targetAmount) * 100;
    progressPercentage = Math.min(100, Math.max(0, costProgress));
  }
  
  // Asegurar que nunca sea NaN
  if (isNaN(progressPercentage)) {
    progressPercentage = 0;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-4 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            <Zap className="w-3 h-3 mr-1" />
            Carga en progreso
          </Badge>
          <Badge variant="outline" className="border-white/30 text-white">
            {chargeMode === "fixed_amount" ? "Valor fijo" : 
             chargeMode === "percentage" ? "Por porcentaje" : "Carga completa"}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{session.stationName}</span>
        </div>
        <p className="text-white/60 text-xs mt-1">
          Conector {session.connectorId} • {session.connectorType}
        </p>
      </div>
      
      {/* Gauge principal */}
      <div className="flex justify-center -mt-4">
        <div className="bg-background rounded-full p-4 shadow-xl">
          <ChargingGauge
            percentage={progressPercentage}
            targetPercentage={chargeMode === "percentage" ? session.targetPercentage : 100}
            size={260}
            strokeWidth={18}
            isCharging={true}
          />
        </div>
      </div>
      
      {/* Métricas en tiempo real */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-3">
          {/* kWh consumidos */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Battery className="w-4 h-4" />
                <span className="text-xs font-medium">Energía</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {session.currentKwh.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
              </p>
              <p className="text-xs text-muted-foreground">
                de {session.estimatedKwh.toFixed(1)} kWh estimados
              </p>
            </CardContent>
          </Card>
          
          {/* Costo acumulado */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">Costo</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(session.currentCost)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tarifa: {formatCurrency(session.pricePerKwh)}/kWh
              </p>
            </CardContent>
          </Card>
          
          {/* Tiempo transcurrido */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">Tiempo</span>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatDuration(elapsedSeconds)}
              </p>
              <p className="text-xs text-muted-foreground">
                Est: {session.estimatedMinutes} min
              </p>
            </CardContent>
          </Card>
          
          {/* Potencia actual */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Potencia</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {session.currentPower?.toFixed(1) || session.powerKw}
                <span className="text-sm font-normal text-muted-foreground ml-1">kW</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Máx: {session.powerKw} kW
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Banner publicitario */}
        <div className="mt-6">
          <ChargingBanner />
        </div>
        
        {/* Información adicional */}
        <Card className="mt-4 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Carga en progreso</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tu vehículo se está cargando. Puedes cerrar la app y te notificaremos cuando termine.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Botón de detener carga */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full mt-6 h-14 text-lg font-semibold"
          onClick={() => setShowStopDialog(true)}
          disabled={stopChargeMutation.isPending}
        >
          {stopChargeMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Deteniendo...
            </>
          ) : (
            <>
              <StopCircle className="w-5 h-5 mr-2" />
              Detener Carga
            </>
          )}
        </Button>
      </div>
      
      {/* Diálogo de confirmación */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              ¿Detener la carga?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se detendrá la carga y se te cobrará por la energía consumida hasta el momento:
              <br />
              <span className="font-semibold text-foreground">
                {session.currentKwh.toFixed(2)} kWh = {formatCurrency(session.currentCost)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStopCharge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, detener carga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
