import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  CreditCard,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Crown,
  Star,
  XCircle,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PRESET_AMOUNTS = [20000, 50000, 100000];

export default function UserWallet() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50000);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [location] = useLocation();

  // Verificar si Wompi está configurado
  const { data: wompiConfig } = trpc.wompi.isConfigured.useQuery();
  const hasPaymentMethod = wompiConfig?.configured;

  // Obtener billetera
  const { data: wallet, isLoading, refetch: refetchWallet } = trpc.wallet.getMyWallet.useQuery();

  // Obtener historial de transacciones
  const { data: transactions, refetch: refetchTransactions } = trpc.wallet.getTransactions.useQuery({ limit: 20 });

  // Obtener suscripción actual
  const { data: subscription, refetch: refetchSubscription } = trpc.wompi.getMySubscription.useQuery();

  // Mutation para crear checkout de recarga con Wompi
  const createWompiRecharge = trpc.wompi.createWalletRecharge.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirigiendo a Wompi para completar el pago...");
        window.open(data.checkoutUrl, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar el pago");
      setIsProcessing(false);
    },
  });

  // Mutation para crear checkout de suscripción
  const createSubscriptionPayment = trpc.wompi.createSubscriptionPayment.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirigiendo a Wompi para completar la suscripción...");
        window.open(data.checkoutUrl, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar la suscripción");
      setIsProcessing(false);
    },
  });

  // Mutation para verificar pago después de redirección
  const verifyPayment = trpc.wompi.verifyAndProcessPayment.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchWallet();
        refetchTransactions();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Error verificando el pago");
    },
  });

  // Mutation para verificar y activar suscripción
  const verifySubscription = trpc.wompi.verifyAndActivateSubscription.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchSubscription();
        refetchTransactions();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Error verificando la suscripción");
    },
  });

  // Mutation para cancelar suscripción
  const cancelSubscription = trpc.wompi.cancelSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchSubscription();
    },
    onError: (error) => {
      toast.error(error.message || "Error cancelando la suscripción");
    },
  });

  // Verificar parámetros de URL para confirmación de pago Wompi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const reference = params.get("reference");
    const type = params.get("type");
    const plan = params.get("plan");

    if (payment === "wompi" && reference) {
      if (type === "subscription" && plan) {
        toast.info("Verificando suscripción...");
        verifySubscription.mutate({
          reference,
          planId: plan as "basic" | "premium",
        });
      } else {
        toast.info("Verificando pago...");
        verifyPayment.mutate({
          reference,
          type: "wallet_recharge",
        });
      }
      // Limpiar URL
      window.history.replaceState({}, "", "/wallet");
    } else if (params.get("success") === "true") {
      toast.success("¡Pago completado exitosamente!");
      refetchWallet();
      refetchTransactions();
      refetchSubscription();
      window.history.replaceState({}, "", "/wallet");
    } else if (params.get("canceled") === "true") {
      toast.info("Pago cancelado");
      window.history.replaceState({}, "", "/wallet");
    }
  }, [location]);

  const handleRecharge = () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!amount || amount < 10000) {
      toast.error("El monto mínimo de recarga es $10,000 COP");
      return;
    }
    if (amount > 50000000) {
      toast.error("El monto máximo de recarga es $50,000,000 COP");
      return;
    }

    if (!hasPaymentMethod) {
      toast.error("Los pagos están siendo configurados. Intenta de nuevo en unos minutos.");
      return;
    }

    setIsProcessing(true);
    createWompiRecharge.mutate({ amount });
  };

  const handleSubscribe = (planId: "basic" | "premium") => {
    if (!hasPaymentMethod) {
      toast.error("Los pagos están siendo configurados. Intenta de nuevo en unos minutos.");
      return;
    }

    // Si ya tiene ese plan activo, no hacer nada
    if (subscription?.isActive && subscription?.tier === (planId === "premium" ? "PREMIUM" : "BASIC")) {
      toast.info("Ya tienes este plan activo");
      return;
    }

    setIsProcessing(true);
    createSubscriptionPayment.mutate({ planId });
  };

  const handleCancelSubscription = () => {
    if (confirm("¿Estás seguro de cancelar tu suscripción? Perderás los beneficios inmediatamente.")) {
      cancelSubscription.mutate();
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "RECHARGE":
      case "STRIPE_PAYMENT":
      case "WOMPI_RECHARGE":
        return <ArrowDownLeft className="w-4 h-4 text-primary" />;
      case "CHARGE":
      case "CHARGE_PAYMENT":
        return <Zap className="w-4 h-4 text-orange-500" />;
      case "REFUND":
        return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isSubscriptionActive = subscription?.isActive && subscription?.tier !== "FREE";

  return (
    <UserLayout title="Billetera" showBack>
      <div className="p-4 space-y-6 pb-24">
        {/* Tarjeta de saldo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4 sm:p-6 gradient-primary text-white rounded-2xl shadow-glow">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-white/80 text-sm sm:text-base">Saldo actual</span>
              {isSubscriptionActive && (
                <Badge className="bg-white/20 text-white border-0">
                  <Crown className="w-3 h-3 mr-1" />
                  {subscription.tier}
                </Badge>
              )}
            </div>
            <div className="text-2xl sm:text-4xl font-bold mb-2">
              {isLoading ? "..." : formatCurrency(wallet?.balance || 0)}
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Wallet className="w-4 h-4" />
              EVGreen Wallet
            </div>
          </Card>
        </motion.div>

        {/* Tabs de recarga, suscripción y tarjetas */}
        <Tabs defaultValue="recharge" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="recharge">Recargar</TabsTrigger>
            <TabsTrigger value="subscription">Planes</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="recharge" className="mt-4 space-y-4">
            {/* Estado de pagos */}
            {!hasPaymentMethod && (
              <Card className="p-4 bg-amber-950/20 border-amber-800/30">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Pagos en configuración. Pronto podrás recargar tu billetera.</span>
                </div>
              </Card>
            )}

            {/* Montos predefinidos */}
            <div className="grid grid-cols-3 gap-3">
              {PRESET_AMOUNTS.map((amount) => (
                <motion.button
                  key={amount}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    selectedAmount === amount && !customAmount
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-lg font-semibold text-primary">
                    {formatCurrency(amount)}
                  </div>
                  {selectedAmount === amount && !customAmount && (
                    <CheckCircle className="w-4 h-4 text-primary absolute top-2 right-2" />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Monto personalizado */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                $
              </span>
              <Input
                type="number"
                placeholder="Otro monto (mín. 10,000)"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(null);
                }}
                className="pl-8 h-14 text-lg rounded-xl"
              />
            </div>

            {/* Botón de recarga */}
            <Button
              size="lg"
              className="w-full h-14 text-lg gradient-primary text-white rounded-xl"
              onClick={handleRecharge}
              disabled={isProcessing || !hasPaymentMethod}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Recargar Billetera
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Pago seguro. Acepta tarjetas internacionales, PSE, Nequi, Bancolombia QR y Efecty.
            </p>
          </TabsContent>

          <TabsContent value="subscription" className="mt-4 space-y-4">
            {/* Plan actual activo */}
            {isSubscriptionActive && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Plan {subscription.tier}</span>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary">
                    Activo
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Descuento del {subscription.discountPercentage}% en todas tus cargas</p>
                  {subscription.cardLastFour && (
                    <p className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      {subscription.cardBrand || "Tarjeta"} terminada en {subscription.cardLastFour}
                    </p>
                  )}
                  {subscription.nextBillingDate && (
                    <p className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Próximo cobro: {new Date(subscription.nextBillingDate).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleCancelSubscription}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1" />
                  )}
                  Cancelar suscripción
                </Button>
              </Card>
            )}

            {/* Planes disponibles */}
            <div className="grid gap-4">
              {/* Plan Básico */}
              <Card className={`p-4 border-2 transition-all ${
                isSubscriptionActive && subscription?.tier === "BASIC"
                  ? "border-blue-500 bg-blue-500/5"
                  : "hover:border-blue-500/50"
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Star className="w-4 h-4 text-blue-500" />
                      Plan Básico
                    </h4>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(18900)}<span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>
                  <Badge variant="secondary">3% kWh + 10% ocup.</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>✓ 3% de descuento en el kWh</li>
                  <li>✓ 10% descuento en tarifa de ocupación</li>
                  <li>✓ 15 min rango extendido en reservas</li>
                  <li>✓ Soporte prioritario</li>
                </ul>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSubscribe("basic")}
                  disabled={isProcessing || (isSubscriptionActive && subscription?.tier === "BASIC")}
                >
                  {isProcessing && createSubscriptionPayment.variables?.planId === "basic" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                  ) : isSubscriptionActive && subscription?.tier === "BASIC" ? (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Plan actual</>
                  ) : isSubscriptionActive && subscription?.tier === "PREMIUM" ? (
                    "Cambiar a Básico"
                  ) : (
                    "Suscribirse"
                  )}
                </Button>
              </Card>

              {/* Plan Premium */}
              <Card className={`p-4 border-2 transition-all ${
                isSubscriptionActive && subscription?.tier === "PREMIUM"
                  ? "border-primary bg-primary/5"
                  : "border-primary/30 bg-primary/5"
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      Plan Premium
                    </h4>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(33900)}<span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>
                  <Badge className="bg-primary text-white">5% kWh + 15% ocup.</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>✓ 5% de descuento en el kWh</li>
                  <li>✓ 15% descuento en tarifa de ocupación</li>
                  <li>✓ 20 min rango extendido en reservas</li>
                  <li>✓ Soporte prioritario</li>
                  <li>✓ Tarjeta física personalizada</li>
                </ul>
                <Button
                  className="w-full gradient-primary text-white"
                  onClick={() => handleSubscribe("premium")}
                  disabled={isProcessing || (isSubscriptionActive && subscription?.tier === "PREMIUM")}
                >
                  {isProcessing && createSubscriptionPayment.variables?.planId === "premium" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                  ) : isSubscriptionActive && subscription?.tier === "PREMIUM" ? (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Plan actual</>
                  ) : isSubscriptionActive && subscription?.tier === "BASIC" ? (
                    "Mejorar a Premium"
                  ) : (
                    "Suscribirse"
                  )}
                </Button>
              </Card>
            </div>

            {!hasPaymentMethod && (
              <Card className="p-4 bg-amber-950/20 border-amber-800/30">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Pagos en configuración. Las suscripciones estarán disponibles pronto.</span>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {transactions?.length === 0 ? (
              <Card className="p-6 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Sin movimientos aún</p>
              </Card>
            ) : (
              transactions?.map((tx) => (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      ["RECHARGE", "STRIPE_PAYMENT", "WOMPI_RECHARGE"].includes(tx.type) ? "bg-primary/10" : "bg-orange-100"
                    }`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{tx.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      ["RECHARGE", "STRIPE_PAYMENT", "WOMPI_RECHARGE"].includes(tx.type) ? "text-primary" : "text-foreground"
                    }`}>
                      {["RECHARGE", "STRIPE_PAYMENT", "WOMPI_RECHARGE"].includes(tx.type) ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Información de prueba */}
        {wompiConfig?.configured && wompiConfig?.testMode && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-2">
              <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Modo de prueba (Sandbox)</p>
                <p className="text-xs text-blue-600">
                  Usa la tarjeta 4242 4242 4242 4242 para probar pagos con Wompi
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </UserLayout>
  );
}
