import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Star, Zap, Shield, Clock, CreditCard, CheckCircle, ChevronRight,
  Loader2, Sparkles, Timer, Percent, Headphones, BadgeCheck, ArrowRight, X, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PLANS = {
  basic: {
    id: "basic" as const,
    name: "Plan Básico",
    price: 18900,
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
    icon: Crown,
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

export default function UserSubscription() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "premium" | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [location] = useLocation();

  const { data: wompiConfig, isLoading: loadingConfig } = trpc.wompi.isConfigured.useQuery();
  const { data: subscription, refetch: refetchSubscription } = trpc.wompi.getMySubscription.useQuery();

  const createSubscription = trpc.wompi.createSubscriptionPayment.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirigiendo a Wompi para completar el pago...");
        window.open(data.checkoutUrl, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar la suscripción");
      setIsProcessing(false);
    },
  });

  const verifySubscription = trpc.wompi.verifyAndActivateSubscription.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "¡Suscripción activada exitosamente! 🎉");
        refetchSubscription();
      } else {
        toast.error(data.message || "El pago no fue aprobado");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Error verificando el pago");
    },
  });

  const cancelSub = trpc.wompi.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Suscripción cancelada exitosamente");
      refetchSubscription();
    },
    onError: (error) => {
      toast.error(error.message || "Error al cancelar la suscripción");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const reference = params.get("reference");
    const type = params.get("type");
    const plan = params.get("plan");

    if (payment === "wompi" && reference && type === "subscription" && plan) {
      verifySubscription.mutate({ reference, planId: plan as "basic" | "premium" });
      window.history.replaceState({}, "", "/subscription");
    }
  }, [location]);

  const handleSubscribe = (planId: "basic" | "premium") => {
    if (!wompiConfig?.configured) {
      toast.error("Los pagos están siendo configurados. Intenta de nuevo en unos minutos.");
      return;
    }
    setIsProcessing(true);
    setSelectedPlan(planId);
    createSubscription.mutate({ planId });
  };

  const handleCancel = () => {
    if (confirm("¿Estás seguro de que deseas cancelar tu suscripción? Perderás todos los beneficios de tu plan.")) {
      cancelSub.mutate();
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount);

  const currentTier = subscription?.tier?.toLowerCase() || "free";

  return (
    <UserLayout title="Membresía" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Header con estado actual */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${
            currentTier === "premium" ? "from-emerald-900 via-green-800 to-emerald-900" :
            currentTier === "basic" ? "from-blue-900 via-blue-800 to-cyan-900" :
            "from-gray-800 via-gray-700 to-gray-800"
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                {currentTier === "premium" ? <Crown className="w-8 h-8 text-emerald-400" /> :
                 currentTier === "basic" ? <Star className="w-8 h-8 text-blue-400" /> :
                 <Zap className="w-8 h-8 text-gray-400" />}
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {currentTier === "premium" ? "Plan Premium" :
                     currentTier === "basic" ? "Plan Básico" : "Sin Plan Activo"}
                  </h2>
                  <p className="text-white/60 text-sm">
                    {currentTier !== "free" ? "Tu membresía está activa" : "Activa un plan y ahorra en cada carga"}
                  </p>
                </div>
              </div>

              {currentTier !== "free" && subscription && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <Percent className="w-4 h-4 text-white/70" />
                      <span className="text-white text-sm font-medium">{subscription.discountPercentage}% desc. kWh</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <Shield className="w-4 h-4 text-white/70" />
                      <span className="text-white text-sm font-medium">Soporte prioritario</span>
                    </div>
                  </div>

                  {subscription.cardLastFour && (
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <CreditCard className="w-4 h-4 text-white/70" />
                      <span className="text-white text-sm">{subscription.cardBrand} •••• {subscription.cardLastFour}</span>
                    </div>
                  )}

                  {subscription.nextBillingDate && (
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <Clock className="w-4 h-4 text-white/70" />
                      <span className="text-white text-sm">
                        Próximo cobro: {new Date(subscription.nextBillingDate).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
                      </span>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 mt-2"
                    onClick={handleCancel} disabled={cancelSub.isPending}>
                    {cancelSub.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</> : "Cancelar suscripción"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Alerta si Wompi no está configurado */}
        {!loadingConfig && !wompiConfig?.configured && (
          <Card className="p-4 bg-amber-950/20 border-amber-800/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Pagos en configuración</p>
                <p className="text-xs text-amber-400/60 mt-0.5">El administrador está configurando el sistema de pagos. Pronto podrás activar tu plan.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Planes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Planes disponibles</h3>
            <button onClick={() => setShowComparison(!showComparison)} className="text-sm text-primary flex items-center gap-1">
              {showComparison ? "Ocultar" : "Comparar planes"}
              <ChevronRight className={`w-4 h-4 transition-transform ${showComparison ? "rotate-90" : ""}`} />
            </button>
          </div>

          {!showComparison && (
            <div className="space-y-4">
              {/* Plan Básico */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <Card className={`relative overflow-hidden p-5 ${
                  currentTier === "basic" ? "border-blue-500 bg-blue-950/30" : "border-border hover:border-blue-500/50 transition-colors"
                }`}>
                  {currentTier === "basic" && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">Plan actual</div>
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
                        <span className={`text-sm ${benefit.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>{benefit.text}</span>
                      </div>
                    ))}
                    {PLANS.basic.benefits.filter(b => !b.included).map((benefit, i) => (
                      <div key={`no-${i}`} className="flex items-center gap-2.5 opacity-40">
                        <X className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground line-through">{benefit.text}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-5" variant={currentTier === "basic" ? "outline" : "default"}
                    disabled={isProcessing || currentTier === "basic" || (!wompiConfig?.configured && currentTier !== "basic")}
                    onClick={() => handleSubscribe("basic")}>
                    {isProcessing && selectedPlan === "basic" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> :
                     currentTier === "basic" ? <><BadgeCheck className="w-4 h-4 mr-2" /> Plan actual</> :
                     <><ArrowRight className="w-4 h-4 mr-2" /> Activar Plan Básico</>}
                  </Button>
                </Card>
              </motion.div>

              {/* Plan Premium */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Card className={`relative overflow-hidden p-5 ${
                  currentTier === "premium" ? "border-emerald-500 bg-emerald-950/30" : "border-emerald-500/30 hover:border-emerald-500/60 transition-colors"
                }`}>
                  {currentTier === "premium" ? (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">Plan actual</div>
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
                    {PLANS.premium.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${benefit.highlight ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span className={`text-sm ${benefit.highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>{benefit.text}</span>
                      </div>
                    ))}
                  </div>
                  <Button className={`w-full mt-5 ${currentTier !== "premium" ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white" : ""}`}
                    variant={currentTier === "premium" ? "outline" : "default"}
                    disabled={isProcessing || currentTier === "premium" || (!wompiConfig?.configured && currentTier !== "premium")}
                    onClick={() => handleSubscribe("premium")}>
                    {isProcessing && selectedPlan === "premium" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> :
                     currentTier === "premium" ? <><BadgeCheck className="w-4 h-4 mr-2" /> Plan actual</> :
                     <><Crown className="w-4 h-4 mr-2" /> Activar Plan Premium</>}
                  </Button>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Vista comparativa */}
          <AnimatePresence>
            {showComparison && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-medium text-muted-foreground">Beneficio</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">Sin Plan</th>
                          <th className="text-center p-3 font-medium text-blue-400">Básico</th>
                          <th className="text-center p-3 font-medium text-emerald-400 relative">Premium
                            <Badge className="absolute -top-1 right-1 bg-emerald-500/20 text-emerald-400 text-[10px] px-1 py-0">TOP</Badge>
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

        {/* FAQ */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Preguntas frecuentes</h3>
          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Puedo cancelar en cualquier momento?</h4>
            <p className="text-sm text-muted-foreground">Sí, puedes cancelar tu suscripción cuando quieras. Tu plan seguirá activo hasta el final del período de facturación.</p>
          </Card>
          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Qué métodos de pago aceptan?</h4>
            <p className="text-sm text-muted-foreground">Aceptamos tarjetas de crédito/débito (Visa, Mastercard, American Express), PSE, Nequi, Bancolombia QR y Efecty a través de Wompi.</p>
          </Card>
          <Card className="p-4">
            <h4 className="font-medium text-sm mb-1">¿Cómo funciona el cobro recurrente?</h4>
            <p className="text-sm text-muted-foreground">Al activar un plan, se realiza el primer cobro. Los siguientes cobros se procesan automáticamente cada mes a través de Wompi.</p>
          </Card>
        </div>

        {/* Nota de seguridad */}
        {wompiConfig?.configured && (
          <Card className="p-4 bg-emerald-950/30 border-emerald-800/50">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Pagos seguros con Wompi</p>
                <p className="text-xs text-emerald-400/70">
                  Todos los pagos son procesados de forma segura por Wompi, certificado PCI DSS.
                  Aceptamos tarjetas, PSE, Nequi, Bancolombia QR y Efecty.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </UserLayout>
  );
}
