/**
 * ChargingMonitor - Pantalla de monitoreo de carga en tiempo real
 * 
 * Muestra datos REALES del cargador vía MeterValues OCPP:
 * - SoC (State of Charge) real del vehículo
 * - Potencia real de carga (kW)
 * - kWh consumidos en tiempo real
 * - Costo acumulado (energía + tiempo + tarifa de conexión)
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
  Loader2,
  Gauge,
  Plug,
  Edit3,
  Check,
  BatteryCharging
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { PowerChart } from "@/components/PowerChart";
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
    }, 10000);
    
    return () => clearInterval(interval);
  }, [banners]);
  
  if (!banners || banners.length === 0) {
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
  const [socTargetNotified, setSocTargetNotified] = useState(false);
  
  // Estado para SoC manual
  const [showSocInput, setShowSocInput] = useState(false);
  const [manualSocInput, setManualSocInput] = useState("");
  const [manualCapacityInput, setManualCapacityInput] = useState("60");
  
  // Mutation para enviar SoC manual
  const setManualSocMutation = trpc.charging.setManualSoc.useMutation({
    onSuccess: () => {
      toast.success("SoC actualizado correctamente");
      setShowSocInput(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });
  
  // Obtener sesión activa - polling cada 3 segundos para datos más frescos
  const { data: session, isLoading, refetch } = trpc.charging.getActiveSession.useQuery(
    undefined,
    { 
      refetchInterval: 3000, // Actualizar cada 3 segundos (era 5s)
      enabled: !!user,
    }
  );
  
  // Mutation para detener carga
  const stopChargeMutation = trpc.charging.stopCharge.useMutation({
    onSuccess: (data) => {
      toast.success("Carga detenida exitosamente");
      const txId = (data as { transactionId?: number }).transactionId;
      if (txId) {
        setLocation(`/charging-summary/${txId}`);
      } else if (session?.transactionId) {
        // Fallback: usar el transactionId de la sesión activa
        setLocation(`/charging-summary/${session.transactionId}`);
      } else {
        toast.info("Redirigiendo al historial...");
        setLocation("/charging-history");
      }
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
  
  // Estado para controlar la redirección
  const [redirecting, setRedirecting] = useState(false);
  const [completedTransactionId, setCompletedTransactionId] = useState<number | null>(null);
  
  // Hook para sonidos de notificación
  const { playChargingCompleteSound } = useNotificationSound();
  
  // Detectar cuando la carga se completa
  useEffect(() => {
    if (redirecting) return;
    
    if (session) {
      const simStatus = (session as any).simulationStatus;
      const progress = (session as any).progress;
      const isSimulation = (session as any).isSimulation;
      const status = session.status;
      
      const isCompleted = 
        status === "COMPLETED" ||
        simStatus === "completed" || 
        simStatus === "finishing" || 
        (isSimulation && progress >= 100);
      
      if (isCompleted && session.transactionId > 0) {
        setRedirecting(true);
        setCompletedTransactionId(session.transactionId);
        playChargingCompleteSound();
        toast.success("¡Carga completada!");
        setTimeout(() => {
          setLocation(`/charging-summary/${session.transactionId}`);
        }, 800);
      }
    }
  }, [session, redirecting, setLocation, playChargingCompleteSound]);
  
  // Si no hay sesión activa, ir al mapa
  useEffect(() => {
    if (!isLoading && !session && !redirecting && !completedTransactionId) {
      toast.info("No hay una carga activa");
      setLocation("/map");
    }
  }, [isLoading, session, redirecting, completedTransactionId, setLocation]);
  
  // Notificación cuando SoC alcanza el objetivo
  useEffect(() => {
    if (!session || socTargetNotified) return;
    
    const soc = (session as any).soc;
    const chargeMode = session.chargeMode as string;
    const targetPct = chargeMode === "percentage" ? (session.targetPercentage || 100) : 100;
    
    if (soc !== null && soc !== undefined && soc >= targetPct) {
      setSocTargetNotified(true);
      toast.success(
        `🔋 ¡Batería al ${Math.round(soc)}%! Tu objetivo de ${targetPct}% fue alcanzado.`,
        { duration: 10000 }
      );
    }
  }, [session, socTargetNotified]);
  
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
  
  // === CALCULAR PORCENTAJE PARA EL GAUGE ===
  const chargeMode = session.chargeMode as string;
  const isSimulation = (session as any).isSimulation;
  const simulationProgress = (session as any).progress;
  const realSoc = (session as any).soc; // SoC del vehículo (real o estimado desde manual)
  const hasRealData = (session as any).hasRealMeterData;
  const socSource = (session as any).socSource as string | undefined; // "charger" | "manual" | "none"
  const serverManualSoc = (session as any).manualSoc as number | null;
  const serverBatteryCapacity = (session as any).manualBatteryCapacityKwh as number | null;
  
  let progressPercentage = 0;
  
  if (realSoc !== null && realSoc !== undefined) {
    // PRIORIDAD: Usar SoC real del vehículo reportado por el cargador
    progressPercentage = realSoc;
  } else if (isSimulation && typeof simulationProgress === 'number') {
    // Simulación: usar progreso del simulador
    const startBattery = session.startPercentage || 20;
    if (chargeMode === "percentage") {
      const targetBattery = session.targetPercentage || 100;
      const batteryRange = targetBattery - startBattery;
      progressPercentage = startBattery + (batteryRange * (simulationProgress / 100));
    } else if (chargeMode === "full_charge") {
      const batteryRange = 100 - startBattery;
      progressPercentage = startBattery + (batteryRange * (simulationProgress / 100));
    } else if (chargeMode === "fixed_amount") {
      const batteryCapacity = 60;
      const kwhDelivered = session.currentKwh || 0;
      const percentAdded = (kwhDelivered / batteryCapacity) * 100;
      progressPercentage = startBattery + percentAdded;
    } else {
      progressPercentage = simulationProgress;
    }
  } else {
    // Sin SoC real y sin simulación: estimar basado en kWh
    const startBattery = session.startPercentage || 20;
    const batteryCapacity = 60; // kWh estimado
    const kwhDelivered = session.currentKwh || 0;
    const percentAdded = (kwhDelivered / batteryCapacity) * 100;
    progressPercentage = startBattery + percentAdded;
  }
  
  // Asegurar rango válido
  if (isNaN(progressPercentage)) progressPercentage = 0;
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));
  
  // Detectar cuando SoC alcanza el objetivo y mostrar toast
  const targetPercentage = chargeMode === "percentage" ? (session.targetPercentage || 100) : 100;
  
  // Costo total incluyendo tarifa de conexión
  const connectionFee = (session as any).connectionFee || 0;
  const displayCost = session.currentCost || 0;
  
  // Potencia real vs nominal
  const realPower = session.currentPower || 0;
  const nominalPower = session.powerKw || 7;
  const displayPower = realPower > 0 ? realPower : 0;
  const hasPowerData = realPower > 0;
  
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
            {chargeMode === "fixed_amount" 
              ? `$${session.targetAmount?.toLocaleString() || 0}` 
              : chargeMode === "percentage" 
                ? `${session.targetPercentage}%`
                : "Carga completa"}
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
            targetPercentage={
              chargeMode === "percentage" 
                ? (session.targetPercentage || 100)
                : chargeMode === "fixed_amount"
                  ? Math.min(100, (session.startPercentage || 20) + ((session.estimatedKwh / 60) * 100))
                  : 100
            }
            size={260}
            strokeWidth={18}
            isCharging={true}
          />
        </div>
      </div>
      
      {/* Indicador de fuente de datos + Input SoC manual */}
      {socSource === "charger" ? (
        <div className="flex justify-center mt-1">
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
            <Battery className="w-3 h-3 mr-1" />
            SoC real del vehículo
          </Badge>
        </div>
      ) : socSource === "manual" ? (
        <div className="flex justify-center mt-1 gap-2">
          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
            <BatteryCharging className="w-3 h-3 mr-1" />
            SoC manual: {serverManualSoc}% • Batería: {serverBatteryCapacity} kWh
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-xs text-blue-600"
            onClick={() => {
              setManualSocInput(String(serverManualSoc || ""));
              setManualCapacityInput(String(serverBatteryCapacity || 60));
              setShowSocInput(true);
            }}
          >
            <Edit3 className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="flex justify-center mt-1">
          {hasRealData ? (
            <Badge 
              variant="outline" 
              className="text-xs text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={() => setShowSocInput(true)}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Ingresar % batería manualmente
            </Badge>
          ) : !isSimulation ? (
            <Badge 
              variant="outline" 
              className="text-xs text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={() => setShowSocInput(true)}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Ingresar % batería manualmente
            </Badge>
          ) : null}
        </div>
      )}
      
      {/* Formulario de SoC manual */}
      {showSocInput && (
        <div className="px-4 mt-3">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BatteryCharging className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-foreground">Ingresa el estado de tu batería</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Tu cargador no reporta el SoC. Ingresa el porcentaje actual de tu vehículo para cálculos más precisos.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">% Batería actual</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="78"
                      value={manualSocInput}
                      onChange={(e) => setManualSocInput(e.target.value)}
                      className="h-10 text-lg font-bold text-center"
                    />
                    <span className="text-sm font-medium text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Capacidad batería</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="10"
                      max="200"
                      placeholder="60"
                      value={manualCapacityInput}
                      onChange={(e) => setManualCapacityInput(e.target.value)}
                      className="h-10 text-lg font-bold text-center"
                    />
                    <span className="text-sm font-medium text-muted-foreground">kWh</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowSocInput(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!manualSocInput || setManualSocMutation.isPending}
                  onClick={() => {
                    const socVal = parseInt(manualSocInput);
                    const capVal = parseFloat(manualCapacityInput) || 60;
                    if (isNaN(socVal) || socVal < 0 || socVal > 100) {
                      toast.error("Ingresa un porcentaje válido (0-100)");
                      return;
                    }
                    if (capVal < 10 || capVal > 200) {
                      toast.error("Capacidad debe ser entre 10 y 200 kWh");
                      return;
                    }
                    setManualSocMutation.mutate({
                      soc: socVal,
                      batteryCapacityKwh: capVal,
                    });
                  }}
                >
                  {setManualSocMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
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
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {session.currentKwh.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {session.estimatedKwh > 0 
                  ? `de ${session.estimatedKwh.toFixed(1)} kWh estimados`
                  : "Acumulando..."}
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
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(displayCost)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tarifa: {formatCurrency(session.pricePerKwh)}/kWh
                {connectionFee > 0 && (
                  <span className="block">+ {formatCurrency(connectionFee)} conexión</span>
                )}
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
                {hasPowerData && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {hasPowerData ? displayPower.toFixed(1) : (
                  <span className="text-muted-foreground text-lg">---</span>
                )}
                {hasPowerData && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">kW</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasPowerData 
                  ? `Máx: ${nominalPower} kW`
                  : `Nominal: ${nominalPower} kW`}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Datos técnicos adicionales (voltaje, corriente) si están disponibles */}
        {((session as any).voltage || (session as any).currentAmp) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {(session as any).voltage && (
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-cyan-600 mb-1">
                    <Gauge className="w-3 h-3" />
                    <span className="text-xs font-medium">Voltaje</span>
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {(session as any).voltage.toFixed(0)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">V</span>
                  </p>
                </CardContent>
              </Card>
            )}
            {(session as any).currentAmp && (
              <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-rose-600 mb-1">
                    <Plug className="w-3 h-3" />
                    <span className="text-xs font-medium">Corriente</span>
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {(session as any).currentAmp.toFixed(1)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">A</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Gráfico de potencia en tiempo real */}
        {(session as any).powerHistory && (session as any).powerHistory.length >= 2 && (
          <Card className="mt-4 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-foreground">Potencia en tiempo real</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-auto" />
              </div>
              <div style={{ height: "200px" }}>
                <PowerChart
                  powerHistory={(session as any).powerHistory}
                  startTime={session.startTime}
                  nominalPower={session.powerKw}
                />
              </div>
            </CardContent>
          </Card>
        )}
        
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
            <AlertDialogDescription asChild>
              <div>
                <p>Se detendrá la carga y se te cobrará:</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Energía ({session.currentKwh.toFixed(2)} kWh):</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(session.currentKwh * session.pricePerKwh)}
                    </span>
                  </div>
                  {connectionFee > 0 && (
                    <div className="flex justify-between">
                      <span>Tarifa de conexión:</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(connectionFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(displayCost)}
                    </span>
                  </div>
                </div>
              </div>
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
