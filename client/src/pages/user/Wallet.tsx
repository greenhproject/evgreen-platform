import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  Shield,
  Smartphone,
  Building2,
  QrCode,
  Banknote,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PRESET_AMOUNTS = [20000, 50000, 100000];

// Mapeo de marcas de tarjeta a colores
const CARD_BRAND_COLORS: Record<string, { bg: string; accent: string }> = {
  VISA: { bg: "from-blue-600 to-blue-800", accent: "text-blue-200" },
  MASTERCARD: { bg: "from-red-600 to-orange-700", accent: "text-orange-200" },
  AMEX: { bg: "from-slate-600 to-slate-800", accent: "text-slate-200" },
  DEFAULT: { bg: "from-emerald-600 to-emerald-800", accent: "text-emerald-200" },
};

export default function UserWallet() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50000);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [location] = useLocation();

  // Verificar si Wompi está configurado
  const { data: wompiConfig } = trpc.wompi.isConfigured.useQuery();
  const hasPaymentMethod = wompiConfig?.configured;

  // Obtener llave pública de Wompi
  const { data: publicKey } = trpc.wompi.getPublicKey.useQuery();

  // Obtener billetera
  const { data: wallet, isLoading, refetch: refetchWallet } = trpc.wallet.getMyWallet.useQuery();

  // Obtener historial de transacciones
  const { data: transactions, refetch: refetchTransactions } = trpc.wallet.getTransactions.useQuery({ limit: 20 });

  // Obtener suscripción actual (tiene datos de tarjeta guardada)
  const { data: subscription, refetch: refetchSubscription } = trpc.wompi.getMySubscription.useQuery();

  // Obtener transacciones de Wompi
  const { data: wompiTransactions } = trpc.wompi.myTransactions.useQuery({ limit: 5, offset: 0 });

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

  const hasSavedCard = subscription?.cardLastFour && subscription?.cardBrand;
  const cardBrand = (subscription?.cardBrand || "DEFAULT").toUpperCase();
  const cardColors = CARD_BRAND_COLORS[cardBrand] || CARD_BRAND_COLORS.DEFAULT;
  const isSubscriptionActive = subscription?.isActive && subscription?.tier !== "FREE";

  return (
    <UserLayout title="Billetera" showBack>
      <div className="p-4 space-y-5 pb-24">
        {/* ================================================================ */}
        {/* TARJETA DE SALDO + PLAN */}
        {/* ================================================================ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5 gradient-primary text-white rounded-2xl shadow-glow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 text-sm">Saldo disponible</span>
              {isSubscriptionActive && (
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  {subscription.tier}
                </Badge>
              )}
            </div>
            <div className="text-3xl font-bold mb-1">
              {isLoading ? "..." : formatCurrency(wallet?.balance || 0)}
            </div>
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Wallet className="w-3.5 h-3.5" />
              EVGreen Wallet
            </div>
          </Card>
        </motion.div>

        {/* ================================================================ */}
        {/* TARJETA DE CRÉDITO INSCRITA (CENTRO DE LA BILLETERA) */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Mi tarjeta</h3>
            {hasSavedCard && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={() => setShowAddCard(true)}
              >
                Cambiar
              </Button>
            )}
          </div>

          {hasSavedCard ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              {/* Tarjeta visual estilo billetera */}
              <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cardColors.bg} p-5 shadow-lg`}>
                {/* Patrón decorativo */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-10 translate-x-10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-8 -translate-x-8" />

                <div className="relative z-10">
                  {/* Header: chip + marca */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-10 h-7 rounded bg-yellow-400/80 flex items-center justify-center">
                      <div className="w-6 h-4 rounded-sm border border-yellow-600/40" />
                    </div>
                    <span className={`text-sm font-bold tracking-wider ${cardColors.accent}`}>
                      {subscription.cardBrand || "CARD"}
                    </span>
                  </div>

                  {/* Número de tarjeta */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-white/40 text-lg tracking-widest">••••</span>
                    <span className="text-white/40 text-lg tracking-widest">••••</span>
                    <span className="text-white/40 text-lg tracking-widest">••••</span>
                    <span className="text-white text-lg font-semibold tracking-widest">
                      {subscription.cardLastFour}
                    </span>
                  </div>

                  {/* Footer: titular + estado */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-wider">Titular</p>
                      <p className="text-white text-sm font-medium">
                        {subscription.cardHolderName || "Tarjeta registrada"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-300 text-xs font-medium">Activa</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Indicador de seguridad */}
              <div className="flex items-center gap-1.5 mt-2 px-1">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Protegida con encriptación PCI DSS · Wompi
                </span>
              </div>
            </motion.div>
          ) : (
            /* Sin tarjeta inscrita - CTA para agregar */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <button
                onClick={() => {
                  if (!hasPaymentMethod) {
                    toast.info("Los pagos están siendo configurados. Pronto podrás inscribir tu tarjeta.");
                    return;
                  }
                  setShowAddCard(true);
                }}
                className="w-full border-2 border-dashed border-primary/30 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Inscribe tu tarjeta</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agrega una tarjeta de crédito o débito para recargar tu billetera con un solo clic
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <img src="https://cdn.worldvectorlogo.com/logos/visa-2.svg" alt="Visa" className="h-5 object-contain opacity-50" />
                  <img src="https://cdn.worldvectorlogo.com/logos/mastercard-2.svg" alt="Mastercard" className="h-5 object-contain opacity-50" />
                  <span className="text-[10px] text-muted-foreground">y más</span>
                </div>
              </button>
            </motion.div>
          )}
        </div>

        {/* ================================================================ */}
        {/* TABS: RECARGAR / HISTORIAL */}
        {/* ================================================================ */}
        <Tabs defaultValue="recharge" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="recharge">Recargar</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* TAB: RECARGAR */}
          <TabsContent value="recharge" className="mt-4 space-y-4">
            {/* Alerta si no hay pagos configurados */}
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
                  className={`relative p-3 rounded-xl border-2 transition-all ${
                    selectedAmount === amount && !customAmount
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-base font-semibold text-primary">
                    {formatCurrency(amount)}
                  </div>
                  {selectedAmount === amount && !customAmount && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Monto personalizado */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                placeholder="Otro monto (mín. 10,000)"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(null);
                }}
                className="pl-8 h-12 text-lg rounded-xl"
              />
            </div>

            {/* Botón de recarga principal */}
            <Button
              size="lg"
              className="w-full h-14 text-base gradient-primary text-white rounded-xl"
              onClick={handleRecharge}
              disabled={isProcessing || !hasPaymentMethod}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : hasSavedCard ? (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Recargar con {subscription?.cardBrand} ····{subscription?.cardLastFour}
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Recargar Billetera
                </>
              )}
            </Button>

            {/* Otros métodos de pago */}
            <button
              onClick={() => setShowOtherMethods(!showOtherMethods)}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              <span>Otros métodos de pago</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showOtherMethods ? "rotate-90" : ""}`} />
            </button>

            <AnimatePresence>
              {showOtherMethods && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  {[
                    { id: "PSE", name: "PSE", desc: "Transferencia bancaria", icon: <Building2 className="w-5 h-5 text-blue-500" />, color: "bg-blue-500/10" },
                    { id: "NEQUI", name: "Nequi", desc: "Desde tu cuenta Nequi", icon: <Smartphone className="w-5 h-5 text-purple-500" />, color: "bg-purple-500/10" },
                    { id: "BANCOLOMBIA_QR", name: "Bancolombia QR", desc: "Escanea con tu app", icon: <QrCode className="w-5 h-5 text-yellow-500" />, color: "bg-yellow-500/10" },
                    { id: "EFECTY", name: "Efecty", desc: "Paga en efectivo", icon: <Banknote className="w-5 h-5 text-green-500" />, color: "bg-green-500/10" },
                  ].map((method) => (
                    <Card
                      key={method.id}
                      className="p-3 hover:border-primary/30 cursor-pointer transition-colors"
                      onClick={handleRecharge}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${method.color} flex items-center justify-center flex-shrink-0`}>
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{method.name}</p>
                          <p className="text-xs text-muted-foreground">{method.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Card>
                  ))}
                  <p className="text-[10px] text-center text-muted-foreground pt-1">
                    Al seleccionar un método alterno, serás redirigido a Wompi para completar el pago.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* TAB: HISTORIAL */}
          <TabsContent value="history" className="mt-4 space-y-3">
            {transactions?.length === 0 ? (
              <Card className="p-6 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Sin movimientos aún</p>
                <p className="text-xs text-muted-foreground mt-1">Tus recargas y pagos aparecerán aquí</p>
              </Card>
            ) : (
              transactions?.map((tx) => (
                <Card key={tx.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      ["RECHARGE", "STRIPE_PAYMENT", "WOMPI_RECHARGE"].includes(tx.type) ? "bg-primary/10" : "bg-orange-500/10"
                    }`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${
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
          <Card className="p-3 bg-blue-950/20 border-blue-800/30">
            <div className="flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-blue-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-300">Modo Sandbox</p>
                <p className="text-[10px] text-blue-400/60">
                  Usa la tarjeta 4242 4242 4242 4242 para probar pagos
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ================================================================ */}
        {/* DIÁLOGO: AGREGAR / CAMBIAR TARJETA */}
        {/* ================================================================ */}
        <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {hasSavedCard ? "Cambiar tarjeta" : "Inscribir tarjeta"}
              </DialogTitle>
              <DialogDescription>
                {hasSavedCard
                  ? "Al inscribir una nueva tarjeta, se reemplazará la actual."
                  : "Inscribe tu tarjeta de crédito o débito para recargar con un solo clic."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Información de seguridad */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pago 100% seguro</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tus datos son procesados directamente por Wompi (certificado PCI DSS Nivel 1).
                    EVGreen nunca almacena los datos completos de tu tarjeta.
                  </p>
                </div>
              </div>

              {/* Botón para abrir checkout de Wompi */}
              <Button
                className="w-full h-12 gradient-primary text-white"
                onClick={() => {
                  // Crear una recarga mínima para inscribir la tarjeta
                  // Wompi guarda la tarjeta durante el checkout
                  setShowAddCard(false);
                  setSelectedAmount(20000);
                  setCustomAmount("");
                  handleRecharge();
                  toast.info("Al completar la recarga, tu tarjeta quedará inscrita para futuros pagos.");
                }}
                disabled={!hasPaymentMethod}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Inscribir con recarga de {formatCurrency(20000)}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                Realiza una recarga mínima de $20,000 para inscribir tu tarjeta.
                Los datos de tu tarjeta serán guardados de forma segura por Wompi
                para futuras recargas con un solo clic.
              </p>

              {/* Marcas aceptadas */}
              <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-5 rounded bg-blue-600 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">VISA</span>
                  </div>
                  <div className="w-8 h-5 rounded bg-red-600 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">MC</span>
                  </div>
                  <div className="w-8 h-5 rounded bg-slate-600 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">AMEX</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">Tarjetas internacionales aceptadas</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  );
}
