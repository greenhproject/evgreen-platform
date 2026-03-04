import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  Battery,
  Clock,
  DollarSign,
  StopCircle,
  Activity,
  TrendingUp,
  MapPin,
  Loader2,
  AlertTriangle,
  Timer,
  Unplug,
  Map,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { ChargingBanner } from "@/components/ChargingBanner";

export default function ChargingSession() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Obtener transacción activa del usuario
  const { data: activeSession, isLoading, refetch } = trpc.dashboard.userActiveTransaction.useQuery(
    undefined,
    { refetchInterval: 5000 } // Actualizar cada 5 segundos
  );

  // Obtener estado de overstay
  const { data: overstayStatus } = trpc.overstay.getMyStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const stopMutation = trpc.transactions.stopChargingSession.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      // No redirigir inmediatamente - quedarse para mostrar overstay si aplica
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Calcular tiempo transcurrido
  useEffect(() => {
    if (!activeSession?.transaction?.startTime) return;

    const startTime = new Date(activeSession.transaction.startTime).getTime();
    
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.transaction?.startTime]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStopCharging = () => {
    if (!activeSession?.transaction?.id) return;
    stopMutation.mutate({ transactionId: activeSession.transaction.id });
  };

  // Si está cargando
  if (isLoading) {
    return (
      <UserLayout showHeader={false} showBottomNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </UserLayout>
    );
  }

  // Si hay overstay activo pero no hay sesión IN_PROGRESS, mostrar pantalla de overstay
  if (overstayStatus && !activeSession) {
    return (
      <UserLayout showHeader={false} showBottomNav={false}>
        <OverstayScreen overstayStatus={overstayStatus} onGoBack={() => setLocation("/map")} />
      </UserLayout>
    );
  }

  // Si no hay sesión activa ni overstay
  if (!activeSession) {
    // Verificar si hay overstay
    if (overstayStatus) {
      return (
        <UserLayout showHeader={false} showBottomNav={false}>
          <OverstayScreen overstayStatus={overstayStatus} onGoBack={() => setLocation("/map")} />
        </UserLayout>
      );
    }
    return (
      <UserLayout showHeader={false} showBottomNav={false}>
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
            <Zap className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Sin sesión activa</h1>
          <p className="text-muted-foreground text-center mb-6">
            No tienes ninguna sesión de carga en progreso
          </p>
          <Button onClick={() => setLocation("/map")} className="gradient-primary text-white">
            Buscar estación
          </Button>
        </div>
      </UserLayout>
    );
  }

  const { transaction, station, evse } = activeSession;
  const kwhConsumed = parseFloat(transaction.kwhConsumed?.toString() || "0");
  const totalCost = parseFloat(transaction.totalCost?.toString() || "0");
  const isCharging = transaction.status === "IN_PROGRESS";

  // Estimar potencia basada en kWh y tiempo
  const currentPower = elapsedTime > 0 ? (kwhConsumed / (elapsedTime / 3600)) : 0;

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background p-4">
        {/* Botón volver al mapa */}
        <div className="flex items-center pt-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => setLocation("/map")}
          >
            <ArrowLeft className="w-4 h-4" />
            <Map className="w-4 h-4" />
            <span className="text-sm">Mapa</span>
          </Button>
        </div>

        {/* Header */}
        <div className="text-center py-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center shadow-glow"
          >
            {isCharging ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Zap className="w-12 h-12 text-white" />
              </motion.div>
            ) : (
              <Zap className="w-12 h-12 text-white" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">
            {isCharging ? "Cargando..." : "Carga completada"}
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{station.name} - Conector {evse.evseIdLocal}</span>
          </div>
        </div>

        {/* Banner de overstay si aplica */}
        <AnimatePresence>
          {overstayStatus && (
            <OverstayBanner overstayStatus={overstayStatus} />
          )}
        </AnimatePresence>

        {/* Métricas en tiempo real */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 text-center">
              <Activity className="w-6 h-6 text-secondary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {currentPower.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">kW promedio</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4 text-center">
              <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {kwhConsumed.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">kWh entregados</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 text-center">
              <Clock className="w-6 h-6 text-accent-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold">{formatTime(elapsedTime)}</div>
              <div className="text-sm text-muted-foreground">Tiempo de carga</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4 text-center">
              <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">
                ${totalCost.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-muted-foreground">Costo actual</div>
            </Card>
          </motion.div>
        </div>

        {/* Información de la estación */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estación</span>
                <span className="font-medium">{station.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dirección</span>
                <span className="font-medium truncate max-w-[200px]">{station.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conector</span>
                <span className="font-medium">{evse.connectorType} - {evse.powerKw}kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Transacción</span>
                <span className="font-mono text-xs">{transaction.ocppTransactionId || transaction.id}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Botón de detener */}
        {isCharging ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Button
              size="lg"
              variant="destructive"
              className="w-full h-14 text-lg rounded-xl"
              onClick={handleStopCharging}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              ) : (
                <StopCircle className="w-6 h-6 mr-2" />
              )}
              Detener carga
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              size="lg"
              className="w-full h-14 text-lg rounded-xl gradient-primary text-white"
              onClick={() => setLocation("/history")}
            >
              Ver resumen
            </Button>
          </motion.div>
        )}

        {/* Banner publicitario durante la carga */}
        {isCharging && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4"
          >
            <ChargingBanner />
          </motion.div>
        )}

        {/* Animación de carga */}
        {isCharging && (
          <div className="mt-6 flex justify-center">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-8 bg-primary rounded-full"
                  animate={{
                    scaleY: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}

// ============================================================================
// OVERSTAY BANNER (shown inline during charging session)
// ============================================================================

function OverstayBanner({ overstayStatus }: { overstayStatus: any }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (overstayStatus.status === "finishing" || overstayStatus.status === "grace") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
      >
        <div className="flex items-start gap-3">
          <Timer className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-400 text-sm">Período de gracia</p>
            <p className="text-xs text-muted-foreground mt-1">
              Desconecta tu vehículo en los próximos {overstayStatus.gracePeriodMinutes || 10} minutos
              para evitar la tarifa de ocupación de ${(overstayStatus.penaltyPerMinute || 500).toLocaleString()}/min.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (overstayStatus.status === "penalty") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-400 text-sm">Tarifa de ocupación activa</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                ${(overstayStatus.penaltyPerMinute || 500).toLocaleString()}/min
              </span>
              <span className="text-lg font-bold text-red-400">
                ${Math.round(overstayStatus.accumulatedCost || 0).toLocaleString()} COP
              </span>
            </div>
            <p className="text-xs text-red-400/70 mt-1">
              Desconecta tu vehículo para detener el cobro
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}

// ============================================================================
// OVERSTAY FULL SCREEN (shown when no active charging session)
// ============================================================================

function OverstayScreen({ overstayStatus, onGoBack }: { overstayStatus: any; onGoBack: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPenalty = overstayStatus.status === "penalty";
  const isGrace = overstayStatus.status === "grace" || overstayStatus.status === "finishing";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background p-4">
      {/* Header */}
      <div className="text-center py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isPenalty 
              ? "bg-red-500/20 border-2 border-red-500/50" 
              : "bg-amber-500/20 border-2 border-amber-500/50"
          }`}
        >
          {isPenalty ? (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Timer className="w-12 h-12 text-amber-500" />
            </motion.div>
          )}
        </motion.div>

        <h1 className="text-2xl font-bold mb-2">
          {isPenalty ? "Tarifa de ocupación activa" : "Carga completada"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isPenalty 
            ? "Tu vehículo sigue conectado y se está cobrando penalización"
            : "Desconecta tu vehículo para liberar el punto de carga"
          }
        </p>
      </div>

      {/* Estado principal */}
      {isPenalty && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="p-6 mb-4 border-red-500/30 bg-red-500/5">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Penalización acumulada</p>
              <motion.p 
                className="text-4xl font-bold text-red-400"
                key={overstayStatus.accumulatedCost}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                ${Math.round(overstayStatus.accumulatedCost || 0).toLocaleString()}
              </motion.p>
              <p className="text-sm text-red-400/70 mt-1">COP</p>
            </div>
            <div className="mt-4 pt-4 border-t border-red-500/20 flex justify-between text-sm">
              <span className="text-muted-foreground">Tarifa</span>
              <span className="font-medium text-red-400">
                ${(overstayStatus.penaltyPerMinute || 500).toLocaleString()}/min
              </span>
            </div>
            {overstayStatus.elapsedMinutes != null && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Tiempo de ocupación</span>
                <span className="font-medium">
                  {Math.round(overstayStatus.elapsedMinutes)} min
                </span>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {isGrace && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="p-6 mb-4 border-amber-500/30 bg-amber-500/5">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Período de gracia</p>
              <p className="text-4xl font-bold text-amber-400">
                {overstayStatus.gracePeriodMinutes || 10} min
              </p>
              <p className="text-sm text-amber-400/70 mt-1">para desconectar</p>
            </div>
            <div className="mt-4 pt-4 border-t border-amber-500/20 text-sm text-center text-muted-foreground">
              Después se cobrará ${(overstayStatus.penaltyPerMinute || 500).toLocaleString()}/min
            </div>
          </Card>
        </motion.div>
      )}

      {/* Acción */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Unplug className="w-6 h-6 text-primary shrink-0" />
          <p className="text-sm">
            Desconecta el cable de carga de tu vehículo para liberar el punto de carga y detener la penalización.
          </p>
        </div>

        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 text-lg rounded-xl"
          onClick={onGoBack}
        >
          Volver al mapa
        </Button>
      </motion.div>

      {/* Pulso de alerta */}
      {isPenalty && (
        <div className="mt-8 flex justify-center">
          <motion.div
            className="w-4 h-4 rounded-full bg-red-500"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          />
        </div>
      )}
    </div>
  );
}
