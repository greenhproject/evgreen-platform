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
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

export default function ChargingSession() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCharging, setIsCharging] = useState(true);

  // Simular datos de carga en tiempo real
  const [chargingData, setChargingData] = useState({
    energyDelivered: 0,
    currentPower: 0,
    batteryLevel: 45,
    estimatedCost: 0,
    estimatedTimeRemaining: 45,
  });

  // Timer para simular carga
  useEffect(() => {
    if (!isCharging) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
      setChargingData((prev) => ({
        energyDelivered: Math.min(prev.energyDelivered + 0.15, 50),
        currentPower: 22 + Math.random() * 3,
        batteryLevel: Math.min(prev.batteryLevel + 0.3, 100),
        estimatedCost: prev.estimatedCost + 12,
        estimatedTimeRemaining: Math.max(prev.estimatedTimeRemaining - 0.5, 0),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isCharging]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStopCharging = () => {
    setIsCharging(false);
    toast.success("Carga detenida correctamente");
    setTimeout(() => {
      setLocation("/history");
    }, 2000);
  };

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
            <Zap className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">
            {isCharging ? "Cargando..." : "Carga completada"}
          </h1>
          <p className="text-muted-foreground">Estación Green EV - Conector 1</p>
        </div>

        {/* Indicador de batería */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Battery className="w-6 h-6 text-primary" />
                <span className="font-medium">Nivel de batería</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {chargingData.batteryLevel.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={chargingData.batteryLevel} 
              className="h-4 bg-muted"
            />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </Card>
        </motion.div>

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
                {chargingData.currentPower.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">kW actual</div>
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
                {chargingData.energyDelivered.toFixed(2)}
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
                ${chargingData.estimatedCost.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Costo actual</div>
            </Card>
          </motion.div>
        </div>

        {/* Tiempo restante */}
        {isCharging && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Tiempo restante estimado</span>
                </div>
                <span className="font-semibold">
                  ~{Math.ceil(chargingData.estimatedTimeRemaining)} min
                </span>
              </div>
            </Card>
          </motion.div>
        )}

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
            >
              <StopCircle className="w-6 h-6 mr-2" />
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

        {/* Animación de carga */}
        {isCharging && (
          <div className="mt-8 flex justify-center">
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
