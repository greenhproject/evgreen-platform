import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
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
  Loader2
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

  const stopMutation = trpc.transactions.stopChargingSession.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setTimeout(() => {
        setLocation("/history");
      }, 2000);
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

  // Si no hay sesión activa
  if (!activeSession) {
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
        {/* Header */}
        <div className="text-center py-8">
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
