import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Star,
  Zap,
  Shield,
  Clock,
  CreditCard,
  CheckCircle,
  ChevronRight,
  Loader2,
  Sparkles,
  Timer,
  Percent,
  Headphones,
  BadgeCheck,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Definición de planes
const PLANS = {
  free: {
    id: "free" as const,
    name: "Sin Plan",
    price: 0,
    color: "from-gray-600 to-gray-700",
    accentColor: "text-gray-400",
    borderColor: "border-gray-700",
    bgColor: "bg-gray-800/30",
    icon: Zap,
    benefits: [
      { icon: Zap, text: "Acceso a la red de cargadores EVGreen", included: true },
      { icon: Percent, text: "Tarifa estándar sin descuentos", included: true },
      { icon: Clock, text: "Reservas con tiempo estándar", included: true },
      { icon: Headphones, text: "Soporte por chat", included: true },
      { icon: Timer, text: "Rango extendido en reservas", included: false },
      { icon: Percent, text: "Descuento en kWh", included: false },
      { icon: Percent, text: "Descuento en tarifa de ocupación", included: false },
      { icon: Shield, text: "Soporte prioritario", included: false },
      { icon: CreditCard, text: "Tarjeta física personalizada", included: false },
    ],
  },
  basic: {
    id: "basic" as const,
    name: "Plan Básico",
    price: 18900,
    color: "from-blue-600 to-cyan-600",
    accentColor: "text-blue-400",
    borderColor: "border-blue-500/50",
    bgColor: "bg-blue-900/20",
    icon: Star,
    benefits: [
      { icon: Zap, text: "Acceso a la red de cargadores EVGreen", included: true },
      { icon: Percent, text: "3% de descuento en el kWh", included: true, highlight: true },
      { icon: Percent, text: "10% de descuento en tarifa de ocupación", included: true, highlight: true },
      { icon: Timer, text: "15 min de rango extendido en reservas", included: true, highlight: true },
      { icon: Headphones, text: "Soporte prioritario en estaciones", included: true, highlight: true },
      { icon: CreditCard, text: "Tarjeta física personalizada", included: false },
    ],
  },
  premium: {
    id: "premium" as const,
    name: "Plan Premium",
    price: 33900,
    color: "from-emerald-500 to-green-600",
    accentColor: "text-emerald-400",
    borderColor: "border-emerald-500/50",
    bgColor: "bg-emerald-900/20",
    icon: Crown,
    popular: true,
    benefits: [
      { icon: Zap, text: "Acceso a la red de cargadores EVGreen", included: true },
      { icon: Percent, text: "5% de descuento en el kWh", included: true, highlight: true },
      { icon: Percent, text: "15% de descuento en tarifa de ocupación", included: true, highlight: true },
      { icon: Timer, text: "20 min de rango extendido en reservas", included: true, highlight: true },
      { icon: Headphones, text: "Soporte prioritario en estaciones", included: true, highlight: true },
      { icon: CreditCard, text: "Tarjeta física personalizada", included: true, highlight: true },
    ],
  },
};

type PlanId = "free" | "basic" | "premium";

export default function UserSubscription() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [location] = useLocation();

  // Verificar si Stripe está configurado
  const { data: stripeConfig } = trpc.stripe.isConfigured.useQuery();

  // Obtener suscripción actual
  const { data: subscription, refetch: refetchSubscription } = trpc.stripe.getMySubscription.useQuery();

  // Mutation para crear checkout de suscripción
  const createSubscription = trpc.stripe.createSubscription.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirigiendo a la página de pago...");
        window.open(data.url, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar la suscripción");
      setIsProcessing(false);
    },
  });

  // Verificar parámetros de URL para confirmación
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("¡Suscripción activada exitosamente! 🎉");
      refetchSubscription();
      window.history.replaceState({}, "", "/subscription");
    } else if (params.get("canceled") === "true") {
      toast.info("Suscripción cancelada");
      window.history.replaceState({}, "", "/subscription");
    }
  }, [location]);

  const handleSubscribe = (planId: "basic" | "premium") => {
    if (!stripeConfig?.configured) {
      toast.error("El sistema de pagos no está disponible en este momento");
      return;
    }
    setIsProcessing(true);
    setSelectedPlan(planId);
    createSubscription.mutate({ planId });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const currentTier = subscription?.tier?.toLowerCase() || "free";

  return (
    <UserLayout title="Membresía" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Header con estado actual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${
            currentTier === "premium" ? "from-emerald-900 via-green-800 to-emerald-900" :
            currentTier === "basic" ? "from-blue-900 via-blue-800 to-cyan-900" :
            "from-gray-800 via-gray-700 to-gray-800"
          }`}>
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                {currentTier === "premium" ? (
                  <Crown className="w-8 h-8 text-emerald-400" />
                ) : currentTier === "basic" ? (
                  <Star className="w-8 h-8 text-blue-400" />
                ) : (
                  <Zap className="w-8 h-8 text-gray-400" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {currentTier === "premium" ? "Plan Premium" :
                     currentTier === "basic" ? "Plan Básico" :
                     "Sin Plan Activo"}
                  </h2>
                  <p className="text-white/60 text-sm">
                    {currentTier !== "free" 
                      ? "Tu membresía está activa" 
                      : "Activa un plan y ahorra en cada carga"}
                  </p>
                </div>
              </div>

              {currentTier !== "free" && subscription && (
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <Percent className="w-4 h-4 text-white/70" />
                    <span className="text-white text-sm font-medium">
                      {subscription.discountPercentage}% desc. kWh
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <Shield className="w-4 h-4 text-white/70" />
                    <span className="text-white text-sm font-medium">
                      Soporte prioritario
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Ahorro estimado */}
        {currentTier !== "free" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ahorro estimado mensual</p>
                  <p className="text-lg font-bold text-primary">
                    {currentTier === "premium" ? "Hasta $37,800 COP" : "Hasta $23,400 COP"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Basado en consumo promedio de 300 kWh/mes
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Planes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Planes disponibles</h3>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="text-sm text-primary flex items-center gap-1"
            >
              {showComparison ? "Ocultar" : "Comparar planes"}
              <ChevronRight className={`w-4 h-4 transition-transform ${showComparison ? "rotate-90" : ""}`} />
            </button>
          </div>

          {/* Vista de tarjetas de planes */}
          {!showComparison && (
            <div className="space-y-4">
              {/* Plan Básico */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className={`relative overflow-hidden p-5 ${
                  currentTier === "basic" 
                    ? "border-blue-500 bg-blue-950/30" 
                    : "border-border hover:border-blue-500/50 transition-colors"
                }`}>
                  {currentTier === "basic" && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                      Plan actual
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <Star className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">Plan Básico</h4>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold">{formatCurrency(18900)}</span>
                        <span className="text-sm text-muted-foreground">/mes</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {PLANS.basic.benefits.filter(b => b.included).map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${benefit.highlight ? "text-blue-400" : "text-muted-foreground"}`} />
                        <span className={`text-sm ${benefit.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {benefit.text}
                        </span>
                      </div>
                    ))}
                    {PLANS.basic.benefits.filter(b => !b.included).map((benefit, i) => (
                      <div key={`no-${i}`} className="flex items-center gap-2.5 opacity-40">
                        <X className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground line-through">{benefit.text}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full mt-5"
                    variant={currentTier === "basic" ? "outline" : "default"}
                    disabled={isProcessing || currentTier === "basic"}
                    onClick={() => handleSubscribe("basic")}
                  >
                    {isProcessing && selectedPlan === "basic" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : currentTier === "basic" ? (
                      <><BadgeCheck className="w-4 h-4 mr-2" /> Plan actual</>
                    ) : currentTier === "premium" ? (
                      "Cambiar a Básico"
                    ) : (
                      <><ArrowRight className="w-4 h-4 mr-2" /> Activar Plan Básico</>
                    )}
                  </Button>
                </Card>
              </motion.div>

              {/* Plan Premium */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className={`relative overflow-hidden p-5 ${
                  currentTier === "premium" 
                    ? "border-emerald-500 bg-emerald-950/30" 
                    : "border-emerald-500/30 hover:border-emerald-500/60 transition-colors"
                }`}>
                  {currentTier === "premium" ? (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                      Plan actual
                    </div>
                  ) : (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Recomendado
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">Plan Premium</h4>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold">{formatCurrency(33900)}</span>
                        <span className="text-sm text-muted-foreground">/mes</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {PLANS.premium.benefits.filter(b => b.included).map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${benefit.highlight ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span className={`text-sm ${benefit.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {benefit.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full mt-5 ${currentTier !== "premium" ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white" : ""}`}
                    variant={currentTier === "premium" ? "outline" : "default"}
                    disabled={isProcessing || currentTier === "premium"}
                    onClick={() => handleSubscribe("premium")}
                  >
                    {isProcessing && selectedPlan === "premium" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : currentTier === "premium" ? (
                      <><BadgeCheck className="w-4 h-4 mr-2" /> Plan actual</>
                    ) : (
                      <><Crown className="w-4 h-4 mr-2" /> Activar Plan Premium</>
                    )}
                  </Button>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Vista comparativa */}
          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-medium text-muted-foreground">Beneficio</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">Sin Plan</th>
                          <th className="text-center p-3 font-medium text-blue-400">Básico</th>
                          <th className="text-center p-3 font-medium text-emerald-400 relative">
                            Premium
                            <Badge className="absolute -top-1 right-1 bg-emerald-500/20 text-emerald-400 text-[10px] px-1 py-0">
                              TOP
                            </Badge>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="p-3 font-medium">Precio mensual</td>
                          <td className="p-3 text-center text-muted-foreground">Gratis</td>
                          <td className="p-3 text-center font-semibold text-blue-400">$18,900</td>
                          <td className="p-3 text-center font-semibold text-emerald-400">$33,900</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-3">Descuento en kWh</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center font-medium">3%</td>
                          <td className="p-3 text-center font-medium text-emerald-400">5%</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-3">Desc. tarifa ocupación</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center font-medium">10%</td>
                          <td className="p-3 text-center font-medium text-emerald-400">15%</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-3">Rango extendido reservas</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center font-medium">+15 min</td>
                          <td className="p-3 text-center font-medium text-emerald-400">+20 min</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-3">Soporte prioritario</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center"><CheckCircle className="w-4 h-4 text-blue-400 mx-auto" /></td>
                          <td className="p-3 text-center"><CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="p-3">Tarjeta física</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center"><CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium">Ahorro estimado/mes</td>
                          <td className="p-3 text-center text-muted-foreground">$0</td>
                          <td className="p-3 text-center font-semibold text-blue-400">~$23,400</td>
                          <td className="p-3 text-center font-semibold text-emerald-400">~$37,800</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 bg-muted/30 text-xs text-center text-muted-foreground">
                    * Ahorro estimado basado en consumo promedio de 300 kWh/mes y 8 sesiones mensuales
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FAQ rápido */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Preguntas frecuentes</h3>
          
          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Puedo cancelar en cualquier momento?</h4>
            <p className="text-sm text-muted-foreground">
              Sí, puedes cancelar tu suscripción cuando quieras. Tu plan seguirá activo hasta el final del período de facturación.
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Qué es la tarjeta física personalizada?</h4>
            <p className="text-sm text-muted-foreground">
              Es una tarjeta NFC con tu nombre que te permite iniciar la carga simplemente acercándola al cargador, sin necesidad de abrir la app.
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Cómo funciona el rango extendido en reservas?</h4>
            <p className="text-sm text-muted-foreground">
              Al reservar un cargador, tu ventana de tiempo se extiende automáticamente {currentTier === "premium" ? "20" : "15"} minutos adicionales sin costo extra por ocupación.
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Puedo cambiar de plan?</h4>
            <p className="text-sm text-muted-foreground">
              Sí, puedes subir o bajar de plan en cualquier momento. El cambio se aplica al inicio del siguiente período de facturación.
            </p>
          </Card>
        </div>

        {/* Nota de prueba */}
        {stripeConfig?.configured && (
          <Card className="p-4 bg-blue-950/30 border-blue-800/50">
            <div className="flex items-start gap-2">
              <CreditCard className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-300">Modo de prueba</p>
                <p className="text-xs text-blue-400/70">
                  Usa la tarjeta 4242 4242 4242 4242 para probar pagos
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </UserLayout>
  );
}
