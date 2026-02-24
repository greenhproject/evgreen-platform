/**
 * OverstayMonitor - Pantalla dedicada de penalización por ocupación post-carga
 * 
 * Muestra en tiempo real:
 * - Estado actual (período de gracia / penalización activa)
 * - Contador de penalización minuto a minuto
 * - Detalles de la estación y la carga completada
 * - Instrucciones para desconectar el vehículo
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Timer,
  Unplug,
  MapPin,
  Zap,
  Clock,
  DollarSign,
  Battery,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Plug,
  Shield,
} from "lucide-react";

function formatCurrency(amount: number) {
  return `$${Math.round(amount).toLocaleString("es-CO")}`;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function OverstayMonitor() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [localElapsed, setLocalElapsed] = useState(0);
  const lastCostRef = useRef(0);

  // Polling cada 5 segundos para datos frescos
  const { data: overstayStatus, isLoading } = trpc.overstay.getMyStatus.useQuery(
    undefined,
    { 
      refetchInterval: 5000,
      enabled: !!user,
    }
  );

  // Contador local que se actualiza cada segundo para UI fluida
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sincronizar con datos del servidor
  const serverElapsed = overstayStatus && 'elapsedMinutes' in overstayStatus ? overstayStatus.elapsedMinutes : 0;
  useEffect(() => {
    if (serverElapsed) {
      setLocalElapsed(serverElapsed * 60);
    }
  }, [serverElapsed]);

  // Redirigir si no hay overstay
  useEffect(() => {
    if (!isLoading && !overstayStatus) {
      setLocation("/map");
    }
  }, [isLoading, overstayStatus, setLocation]);

  if (isLoading) {
    return (
      <UserLayout showHeader={false} showBottomNav={false}>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando estado...</p>
          </div>
        </div>
      </UserLayout>
    );
  }

  if (!overstayStatus) return null;

  const isPenalty = overstayStatus.status === "penalty";
  const isGrace = overstayStatus.status === "grace" || overstayStatus.status === "finishing";
  const penaltyPerMinute = overstayStatus.penaltyPerMinute || 500;
  const accumulatedCost = ('accumulatedCost' in overstayStatus ? overstayStatus.accumulatedCost : 0) || 0;
  const gracePeriodMinutes = ('gracePeriodMinutes' in overstayStatus ? overstayStatus.gracePeriodMinutes : 10) || 10;
  const graceRemaining = ('graceRemaining' in overstayStatus ? overstayStatus.graceRemaining : 0) || 0;
  const elapsedMinutes = ('elapsedMinutes' in overstayStatus ? overstayStatus.elapsedMinutes : 0) || 0;
  const penaltyMinutes = ('penaltyMinutes' in overstayStatus ? overstayStatus.penaltyMinutes : 0) || 0;

  // Datos de la estación
  const stationName = ('stationName' in overstayStatus ? overstayStatus.stationName : null) || "Estación";
  const stationAddress = ('stationAddress' in overstayStatus ? overstayStatus.stationAddress : null) || "";
  const connectorType = ('connectorType' in overstayStatus ? overstayStatus.connectorType : null) || "TYPE_2";
  const powerKw = ('powerKw' in overstayStatus ? overstayStatus.powerKw : null) || 7;
  const evseIdLocal = ('evseIdLocal' in overstayStatus ? overstayStatus.evseIdLocal : null) || 1;
  const kwhConsumed = ('kwhConsumed' in overstayStatus ? overstayStatus.kwhConsumed : null) || 0;
  const totalChargeCost = ('totalChargeCost' in overstayStatus ? overstayStatus.totalChargeCost : null) || 0;
  const chargeEndTime = ('chargeEndTime' in overstayStatus ? overstayStatus.chargeEndTime : null) || null;

  // Calcular progreso del período de gracia
  const graceProgress = isGrace 
    ? Math.min(100, ((gracePeriodMinutes - graceRemaining) / gracePeriodMinutes) * 100)
    : 100;

  // Costo total estimado (carga + overstay)
  const grandTotal = totalChargeCost + accumulatedCost;

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header con gradiente */}
        <div className={`relative overflow-hidden ${
          isPenalty 
            ? "bg-gradient-to-b from-red-950 via-red-900/80 to-background" 
            : "bg-gradient-to-b from-amber-950 via-amber-900/80 to-background"
        }`}>
          {/* Botón atrás */}
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40"
              onClick={() => setLocation("/map")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          {/* Icono principal animado */}
          <div className="pt-16 pb-8 text-center">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mx-auto mb-5"
            >
              <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center ${
                isPenalty 
                  ? "bg-red-500/20 ring-2 ring-red-500/40" 
                  : "bg-amber-500/20 ring-2 ring-amber-500/40"
              }`}>
                {isPenalty ? (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <AlertTriangle className="w-14 h-14 text-red-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Timer className="w-14 h-14 text-amber-400" />
                  </motion.div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl font-bold text-white mb-1">
                {isPenalty ? "Tarifa de ocupación activa" : "Período de gracia"}
              </h1>
              <p className="text-white/60 text-sm px-8">
                {isPenalty 
                  ? "Se está cobrando por mantener el vehículo conectado"
                  : "Desconecta tu vehículo antes de que inicie la penalización"
                }
              </p>
            </motion.div>
          </div>
        </div>

        <div className="px-4 -mt-2 pb-8 space-y-4">
          {/* CARD PRINCIPAL: Penalización o Gracia */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isPenalty ? (
              <Card className="overflow-hidden border-red-500/30">
                <div className="bg-red-500/5 p-6">
                  {/* Costo acumulado grande */}
                  <div className="text-center mb-4">
                    <p className="text-xs uppercase tracking-wider text-red-400/80 mb-1">Penalización acumulada</p>
                    <motion.div
                      key={accumulatedCost}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="text-5xl font-bold text-red-400 tabular-nums">
                        {formatCurrency(accumulatedCost)}
                      </span>
                    </motion.div>
                    <p className="text-red-400/60 text-sm mt-1">COP</p>
                  </div>

                  {/* Métricas de penalización */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-red-500/10">
                      <DollarSign className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-300 tabular-nums">{formatCurrency(penaltyPerMinute)}</p>
                      <p className="text-[10px] text-red-400/60 uppercase">por minuto</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-500/10">
                      <Clock className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-300 tabular-nums">{penaltyMinutes} min</p>
                      <p className="text-[10px] text-red-400/60 uppercase">en penalización</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-500/10">
                      <Timer className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-300 tabular-nums">{elapsedMinutes} min</p>
                      <p className="text-[10px] text-red-400/60 uppercase">total ocupación</p>
                    </div>
                  </div>
                </div>

                {/* Pulso de alerta */}
                <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-xs text-red-400">Cobro activo — desconecta tu vehículo</span>
                </div>
              </Card>
            ) : (
              <Card className="overflow-hidden border-amber-500/30">
                <div className="bg-amber-500/5 p-6">
                  {/* Tiempo restante grande */}
                  <div className="text-center mb-4">
                    <p className="text-xs uppercase tracking-wider text-amber-400/80 mb-1">Tiempo restante</p>
                    <motion.div
                      key={Math.floor(graceRemaining)}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                    >
                      <span className="text-5xl font-bold text-amber-400 tabular-nums">
                        {graceRemaining > 0 ? `${Math.ceil(graceRemaining)} min` : "0 min"}
                      </span>
                    </motion.div>
                    <p className="text-amber-400/60 text-sm mt-1">para desconectar sin costo</p>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-4">
                    <div className="h-3 rounded-full bg-amber-900/30 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${graceProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-amber-400/50">
                      <span>Carga completada</span>
                      <span>Inicio penalización</span>
                    </div>
                  </div>

                  {/* Info de penalización próxima */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10">
                    <Shield className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-300">
                        Después: {formatCurrency(penaltyPerMinute)}/min
                      </p>
                      <p className="text-xs text-amber-400/60">
                        Se cobrará automáticamente de tu billetera
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>

          {/* RESUMEN DE LA CARGA COMPLETADA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Resumen de carga</h3>
                <Badge variant="outline" className="ml-auto text-[10px]">Completada</Badge>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Energía entregada</span>
                  <span className="font-semibold tabular-nums">{kwhConsumed.toFixed(2)} kWh</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costo de carga</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(totalChargeCost)}</span>
                </div>
                {isPenalty && accumulatedCost > 0 && (
                  <div className="flex justify-between items-center text-red-400">
                    <span className="text-sm">Penalización por ocupación</span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(accumulatedCost)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* DATOS DE LA ESTACIÓN */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Punto de carga</h3>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estación</span>
                  <span className="font-medium text-sm truncate max-w-[200px]">{stationName}</span>
                </div>
                {stationAddress && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Dirección</span>
                    <span className="text-sm truncate max-w-[200px]">{stationAddress}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conector</span>
                  <span className="text-sm">{connectorType.replace("_", " ")} #{evseIdLocal} — {powerKw}kW</span>
                </div>
                {chargeEndTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Carga terminó</span>
                    <span className="text-sm">
                      {new Date(chargeEndTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* ACCIÓN: Desconectar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className={`flex items-start gap-3 p-4 rounded-2xl ${
              isPenalty 
                ? "bg-red-500/5 border border-red-500/20" 
                : "bg-primary/5 border border-primary/20"
            }`}>
              <Unplug className={`w-6 h-6 shrink-0 mt-0.5 ${isPenalty ? "text-red-400" : "text-primary"}`} />
              <div>
                <p className={`text-sm font-semibold ${isPenalty ? "text-red-300" : "text-foreground"}`}>
                  Desconecta tu vehículo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPenalty 
                    ? "Al desconectar el cable, se detendrá el cobro de penalización automáticamente."
                    : "Desconecta el cable de carga para liberar el punto y evitar la tarifa de ocupación."
                  }
                </p>
              </div>
            </div>
          </motion.div>

          {/* Botón volver */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base rounded-xl"
              onClick={() => setLocation("/map")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver al mapa
            </Button>
          </motion.div>
        </div>
      </div>
    </UserLayout>
  );
}
