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
  Plus,
  CreditCard,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Crown,
  Star
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PRESET_AMOUNTS = [20000, 50000, 100000];

export default function UserWallet() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50000);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [location] = useLocation();

  // Verificar si Stripe está configurado
  const { data: stripeConfig } = trpc.stripe.isConfigured.useQuery();
  
  // Obtener billetera
  const { data: wallet, isLoading, refetch: refetchWallet } = trpc.wallet.getMyWallet.useQuery();
  
  // Obtener historial de transacciones
  const { data: transactions, refetch: refetchTransactions } = trpc.wallet.getTransactions.useQuery({ limit: 20 });

  // Obtener suscripción actual
  const { data: subscription } = trpc.stripe.getMySubscription.useQuery();

  // Mutation para crear checkout de recarga
  const createRecharge = trpc.stripe.createWalletRecharge.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirigiendo a la página de pago...");
        window.open(data.url, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar el pago");
      setIsProcessing(false);
    },
  });

  // Mutation para crear checkout de suscripción
  const createSubscription = trpc.stripe.createSubscription.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirigiendo a la página de suscripción...");
        window.open(data.url, "_blank");
      }
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar la suscripción");
      setIsProcessing(false);
    },
  });

  // Verificar parámetros de URL para confirmación de pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("¡Pago completado exitosamente!");
      refetchWallet();
      refetchTransactions();
      // Limpiar URL
      window.history.replaceState({}, "", "/wallet");
    } else if (params.get("canceled") === "true") {
      toast.info("Pago cancelado");
      window.history.replaceState({}, "", "/wallet");
    }
  }, [location]);

  const handleRecharge = () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!amount || amount < 20000) {
      toast.error("El monto mínimo de recarga es $20,000 COP");
      return;
    }
    if (amount > 1000000) {
      toast.error("El monto máximo de recarga es $1,000,000 COP");
      return;
    }

    if (!stripeConfig?.configured) {
      toast.error("El sistema de pagos no está disponible en este momento");
      return;
    }

    setIsProcessing(true);
    createRecharge.mutate({ amount });
  };

  const handleSubscribe = (planId: "basic" | "premium") => {
    if (!stripeConfig?.configured) {
      toast.error("El sistema de pagos no está disponible en este momento");
      return;
    }

    setIsProcessing(true);
    createSubscription.mutate({ planId });
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
              {subscription && subscription.tier !== "FREE" && (
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
            {/* Estado de Stripe */}
            {!stripeConfig?.configured && (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">Sistema de pagos en configuración</span>
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
                placeholder="Otro monto (mín. 20,000)"
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
              disabled={isProcessing || !stripeConfig?.configured}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Recargar con Stripe
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Pago seguro procesado por Stripe. Acepta tarjetas de crédito y débito.
            </p>
          </TabsContent>

          <TabsContent value="subscription" className="mt-4 space-y-4">
            {/* Plan actual */}
            {subscription && subscription.tier !== "FREE" && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    <span className="font-medium">Plan {subscription.tier}</span>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary">
                    Activo
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Descuento del {subscription.discountPercentage}% en todas tus cargas
                </p>
              </Card>
            )}

            {/* Planes disponibles */}
            <div className="grid gap-4">
              {/* Plan Básico */}
              <Card className="p-4 border-2 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Star className="w-4 h-4 text-blue-500" />
                      Plan Básico
                    </h4>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(29900)}<span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>
                  <Badge variant="secondary">10% descuento</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>✓ 10% de descuento en todas las cargas</li>
                  <li>✓ 2 reservas gratis al mes</li>
                  <li>✓ Soporte prioritario</li>
                </ul>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => handleSubscribe("basic")}
                  disabled={isProcessing || subscription?.tier === "BASIC"}
                >
                  {subscription?.tier === "BASIC" ? "Plan actual" : "Suscribirse"}
                </Button>
              </Card>

              {/* Plan Premium */}
              <Card className="p-4 border-2 border-primary bg-primary/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      Plan Premium
                    </h4>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(59900)}<span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>
                  <Badge className="bg-primary text-white">20% descuento</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  <li>✓ 20% de descuento en todas las cargas</li>
                  <li>✓ Reservas ilimitadas</li>
                  <li>✓ Soporte VIP 24/7</li>
                  <li>✓ Acceso prioritario a cargadores</li>
                </ul>
                <Button 
                  className="w-full gradient-primary text-white"
                  onClick={() => handleSubscribe("premium")}
                  disabled={isProcessing || subscription?.tier === "PREMIUM"}
                >
                  {subscription?.tier === "PREMIUM" ? "Plan actual" : "Suscribirse"}
                </Button>
              </Card>
            </div>
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
                      tx.type === "RECHARGE" || tx.type === "STRIPE_PAYMENT" ? "bg-primary/10" : "bg-orange-100"
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
                      tx.type === "RECHARGE" || tx.type === "STRIPE_PAYMENT" ? "text-primary" : "text-foreground"
                    }`}>
                      {tx.type === "RECHARGE" || tx.type === "STRIPE_PAYMENT" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Información de prueba */}
        {stripeConfig?.configured && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-2">
              <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Modo de prueba</p>
                <p className="text-xs text-blue-600">
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
