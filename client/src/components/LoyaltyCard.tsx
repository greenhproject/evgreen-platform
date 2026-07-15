/**
 * LoyaltyCard - Tarjeta virtual de puntos EVGreen
 * Muestra el saldo de puntos, nivel, progreso y opciones de redención
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, Gift, Zap, ExternalLink, ChevronRight, Trophy, Sparkles, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Niveles de fidelización ────────────────────────────────────────────────
const LEVELS = [
  { name: "Básico", minPoints: 0, color: "#6b7280", gradient: "from-gray-500 to-gray-600", icon: "⚡" },
  { name: "Plata", minPoints: 100, color: "#94a3b8", gradient: "from-slate-400 to-slate-500", icon: "🥈" },
  { name: "Oro", minPoints: 500, color: "#f59e0b", gradient: "from-amber-400 to-yellow-500", icon: "🥇" },
  { name: "Platino", minPoints: 1500, color: "#10b981", gradient: "from-emerald-400 to-green-500", icon: "💎" },
];

function getLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return { level: LEVELS[i], index: i };
  }
  return { level: LEVELS[0], index: 0 };
}

function getNextLevel(currentIndex: number) {
  return currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;
}

export function LoyaltyCard() {
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(100);

  const { data: summary, refetch } = (trpc as any).loyalty?.getBalance?.useQuery?.() ?? { data: null, refetch: () => {} };
  const { data: config } = (trpc as any).loyalty?.getConfig?.useQuery?.() ?? { data: null };
  const redeemMutation = (trpc as any).loyalty?.redeem?.useMutation?.({
    onSuccess: (result: any) => {
      toast.success(`¡${result.pointsRedeemed} puntos redimidos! Descuento aplicado en tu próxima carga.`);
      setShowRedeemDialog(false);
      refetch?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al redimir puntos");
    },
  }) ?? { mutate: () => {}, isPending: false };

  const points = summary?.balance ?? 0;
  const totalEarned = 0; // Se calcula desde historial si se necesita
  const totalRedeemed = 0;
  const { level, index: levelIndex } = getLevel(points);
  const nextLevel = getNextLevel(levelIndex);
  const progressToNext = nextLevel
    ? Math.min(100, ((points - level.minPoints) / (nextLevel.minPoints - level.minPoints)) * 100)
    : 100;

  const pointValue = config?.pointValueCop ?? 50;
  const minRedeem = config?.minRedemptionPoints ?? 100;
  const marketplaceUrl = config?.marketplaceUrl;

  const canRedeem = points >= minRedeem;
  const redeemValue = Math.floor(redeemAmount * pointValue);

  if (summary === null && !config) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        {/* Tarjeta virtual estilo crédito */}
        <div
          className="relative rounded-2xl overflow-hidden p-5 text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #10b981 100%)`,
            minHeight: 160,
          }}
        >
          {/* Patrón decorativo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white translate-y-1/2 -translate-x-1/2" />
          </div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" fill="currentColor" />
                </div>
                <span className="font-bold text-sm tracking-wide">EVGreen Rewards</span>
              </div>
              <Badge
                className="text-xs font-bold px-2 py-0.5 border-0"
                style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              >
                {level.icon} {level.name}
              </Badge>
            </div>

            {/* Puntos */}
            <div className="mb-3">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">{points.toLocaleString()}</span>
                <span className="text-emerald-200 text-sm mb-1">puntos disponibles</span>
              </div>
              <p className="text-emerald-200/70 text-xs mt-0.5">
                ≈ ${(points * pointValue).toLocaleString("es-CO")} COP en descuentos
              </p>
            </div>

            {/* Progreso al siguiente nivel */}
            {nextLevel && (
              <div>
                <div className="flex justify-between text-xs text-emerald-200/80 mb-1">
                  <span>{level.name}</span>
                  <span>{nextLevel.icon} {nextLevel.name} en {(nextLevel.minPoints - points).toLocaleString()} pts</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressToNext}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                  />
                </div>
              </div>
            )}
            {!nextLevel && (
              <div className="flex items-center gap-1 text-xs text-emerald-200">
                <Trophy className="w-3 h-3" />
                <span>¡Nivel máximo alcanzado!</span>
              </div>
            )}
          </div>
        </div>

        {/* Estadísticas y acciones */}
        <Card className="mt-3 p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{totalEarned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Ganados</div>
            </div>
            <div className="text-center border-x">
              <div className="text-xl font-bold text-orange-500">{totalRedeemed.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Redimidos</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600">{points.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Disponibles</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mb-4 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <span>Ganas <strong>1 punto por cada kWh</strong> cargado. Redime desde {minRedeem} puntos.</span>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 h-10"
              disabled={!canRedeem}
              onClick={() => setShowRedeemDialog(true)}
              style={canRedeem ? { background: "linear-gradient(135deg, #059669, #10b981)" } : {}}
            >
              <Gift className="w-4 h-4 mr-2" />
              {canRedeem ? "Redimir puntos" : `Faltan ${minRedeem - points} pts`}
            </Button>

            {marketplaceUrl && (
              <Button
                variant="outline"
                className="h-10 px-3"
                onClick={() => window.open(marketplaceUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Dialog de redención */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-500" />
              Redimir puntos
            </DialogTitle>
            <DialogDescription>
              Convierte tus puntos en descuento para tu próxima carga
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">{redeemAmount} pts</div>
              <div className="text-sm text-muted-foreground mt-1">
                = ${redeemValue.toLocaleString("es-CO")} COP de descuento
              </div>
            </div>

            {/* Selector de cantidad */}
            <div className="grid grid-cols-3 gap-2">
              {[minRedeem, Math.min(500, points), Math.min(1000, points)].filter((v, i, arr) => arr.indexOf(v) === i && v <= points).map((amt) => (
                <button
                  key={amt}
                  onClick={() => setRedeemAmount(amt)}
                  className={`rounded-lg p-2 text-sm font-medium border transition-colors ${
                    redeemAmount === amt
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {amt} pts
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Disponibles: <strong>{points.toLocaleString()} puntos</strong>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRedeemDialog(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={redeemMutation.isPending || redeemAmount > points}
                onClick={() => redeemMutation.mutate({ points: redeemAmount })}
                style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
              >
                {redeemMutation.isPending ? "Procesando..." : "Confirmar"}
              </Button>
            </div>

            {marketplaceUrl && (
              <button
                onClick={() => window.open(marketplaceUrl, "_blank")}
                className="w-full flex items-center justify-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver marketplace de beneficios
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default LoyaltyCard;
