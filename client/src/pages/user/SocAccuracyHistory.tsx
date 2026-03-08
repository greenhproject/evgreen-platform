import { motion } from "framer-motion";
import UserLayout from "@/layouts/UserLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Info,
  Zap,
  Battery,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

function getAccuracyColor(errorPct: number | null) {
  if (errorPct === null) return "text-muted-foreground";
  const abs = Math.abs(errorPct);
  if (abs <= 5) return "text-green-500";
  if (abs <= 15) return "text-amber-500";
  return "text-red-500";
}

function getAccuracyLabel(errorPct: number | null) {
  if (errorPct === null) return "Sin datos del cargador";
  const abs = Math.abs(errorPct);
  if (abs <= 5) return "Muy preciso";
  if (abs <= 15) return "Aceptable";
  return "Mejorable";
}

function getDetectionMethodLabel(method: string | null) {
  switch (method) {
    case "charger_soc": return "SoC del cargador";
    case "power_drop": return "Detección por potencia";
    case "target_reached": return "Objetivo alcanzado";
    case "user_stop": return "Parada manual";
    default: return method || "Desconocido";
  }
}

export default function SocAccuracyHistory() {
  const [, setLocation] = useLocation();

  const { data: logs, isLoading } = trpc.charging.getSocAccuracyHistory.useQuery(
    { limit: 20 },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: suggestion } = trpc.charging.getSocAccuracySuggestion.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  return (
    <UserLayout title="Precisión de SoC" showBack>
      <div className="p-4 space-y-4 pb-24">
        {/* Resumen general */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-primary/10 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold">Historial de Precisión</h2>
                <p className="text-xs text-muted-foreground">
                  Comparación entre tu SoC manual y los datos reales del cargador
                </p>
              </div>
            </div>

            {suggestion && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-background/60 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{suggestion.sampleCount}</div>
                  <div className="text-xs text-muted-foreground">Cargas registradas</div>
                </div>
                {suggestion.avgErrorKwh !== null ? (
                  <div className="bg-background/60 rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                      Math.abs(suggestion.avgErrorKwh) <= 2 ? "text-green-500" : "text-amber-500"
                    }`}>
                      {suggestion.avgErrorKwh > 0
                        ? <TrendingUp className="w-4 h-4" />
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {Math.abs(suggestion.avgErrorKwh)} kWh
                    </div>
                    <div className="text-xs text-muted-foreground">Error promedio</div>
                  </div>
                ) : (
                  <div className="bg-background/60 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                    <div className="text-xs text-muted-foreground">Sin datos del cargador</div>
                  </div>
                )}
              </div>
            )}

            {/* Mensaje de sugerencia */}
            {suggestion?.message && (
              <div className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
                suggestion.hasSuggestion
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : suggestion.sampleCount >= 2
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-muted/50 border border-border"
              }`}>
                {suggestion.hasSuggestion ? (
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                ) : suggestion.sampleCount >= 2 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
                <span>{suggestion.message}</span>
              </div>
            )}

            {suggestion?.hasSuggestion && suggestion.suggestedCapacityKwh && (
              <Button
                size="sm"
                className="w-full mt-3"
                onClick={() => setLocation("/settings/vehicles")}
              >
                Actualizar capacidad a {suggestion.suggestedCapacityKwh} kWh
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </Card>
        </motion.div>

        {/* Explicación del sistema */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">¿Cómo funciona?</p>
                <p>Cuando ingresas tu SoC inicial manualmente, comparamos la energía que esperabas cargar con la que realmente entregó el cargador. Esto nos ayuda a detectar si tu capacidad de batería registrada es correcta.</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Lista de registros */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
            Registros recientes
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </Card>
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <Card className="p-8 text-center">
              <Battery className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Aún no hay registros de precisión.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ingresa tu SoC manualmente al iniciar una carga para comenzar a registrar.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Carga #{log.transactionId}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getAccuracyColor(log.estimatedErrorSocPct)}`}
                      >
                        {getAccuracyLabel(log.estimatedErrorSocPct)}
                      </Badge>
                    </div>

                    {/* Datos de la carga */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="text-sm font-bold">{log.manualSocStart}%</div>
                        <div className="text-xs text-muted-foreground">SoC inicio</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="text-sm font-bold">{log.realKwhDelivered.toFixed(1)} kWh</div>
                        <div className="text-xs text-muted-foreground">Energía real</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="text-sm font-bold">{log.calculatedSocEnd ?? "—"}%</div>
                        <div className="text-xs text-muted-foreground">SoC calculado</div>
                      </div>
                    </div>

                    {/* Comparación con cargador */}
                    {log.chargerSocEnd !== null && (
                      <div className={`flex items-center justify-between rounded-lg p-2 text-xs ${
                        Math.abs(log.estimatedErrorSocPct ?? 0) <= 5
                          ? "bg-green-500/10"
                          : Math.abs(log.estimatedErrorSocPct ?? 0) <= 15
                          ? "bg-amber-500/10"
                          : "bg-red-500/10"
                      }`}>
                        <span className="text-muted-foreground">SoC real del cargador:</span>
                        <span className="font-semibold">{log.chargerSocEnd}%</span>
                        {log.estimatedErrorSocPct !== null && (
                          <span className={`font-bold ${getAccuracyColor(log.estimatedErrorSocPct)}`}>
                            {log.estimatedErrorSocPct > 0 ? "+" : ""}{log.estimatedErrorSocPct}%
                          </span>
                        )}
                      </div>
                    )}

                    {/* Método de detección y batería llena */}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{getDetectionMethodLabel(log.detectionMethod)}</span>
                      {log.batteryFullDetected && (
                        <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                          <Battery className="w-3 h-3 mr-1" />
                          Batería llena detectada
                        </Badge>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
