import React, { useState, useEffect, useRef } from "react";
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
  const [showRemoveCard, setShowRemoveCard] = useState(false);
  const [isQuickRecharging, setIsQuickRecharging] = useState(false);
  const [location] = useLocation();

  // Card form states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [isTokenizing, setIsTokenizing] = useState(false);

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

  // Estado para polling de transacciones pendientes
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);
  const utils = trpc.useUtils();

  // Polling robusto con setInterval - consulta Wompi cada 3s hasta APPROVED o timeout
  useEffect(() => {
    if (!pendingReference) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      pollingCountRef.current = 0;
      return;
    }

    const pollStatus = async () => {
      pollingCountRef.current += 1;
      console.log(`[Polling] Intento ${pollingCountRef.current} para ${pendingReference}`);

      try {
        const result = await utils.wompi.checkQuickRechargeStatus.fetch({ reference: pendingReference });
        console.log(`[Polling] Resultado:`, result);

        if (result.status === "APPROVED" && result.credited) {
          toast.success("\u00a1Recarga exitosa! Tu billetera ha sido actualizada.");
          setPendingReference(null);
          refetchWallet();
          refetchTransactions();
          return;
        }

        if (result.status === "DECLINED" || result.status === "ERROR" || result.status === "VOIDED") {
          toast.error(`El cobro fue ${result.status === "DECLINED" ? "rechazado" : "cancelado"}. Intenta de nuevo.`);
          setPendingReference(null);
          return;
        }

        // Timeout después de 20 intentos (60 segundos)
        if (pollingCountRef.current >= 20) {
          toast.info("El cobro sigue en proceso. Tu billetera se actualizar\u00e1 autom\u00e1ticamente cuando se confirme.");
          setPendingReference(null);
          return;
        }
      } catch (err) {
        console.warn("[Polling] Error consultando estado:", err);
        if (pollingCountRef.current >= 20) {
          toast.info("No pudimos verificar el estado del cobro. Tu billetera se actualizar\u00e1 cuando se confirme.");
          setPendingReference(null);
        }
      }
    };

    // Primera consulta inmediata
    pollStatus();
    // Luego cada 3 segundos
    pollingRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pendingReference]);

  // Mutation para recarga rápida con tarjeta inscrita
  const quickRecharge = trpc.wompi.quickRecharge.useMutation({
    onSuccess: (data) => {
      setIsQuickRecharging(false);
      if (data.success && data.status === "APPROVED") {
        toast.success(data.message);
        refetchWallet();
        refetchTransactions();
      } else if (data.status === "PENDING") {
        toast.info("Procesando cobro... Tu billetera se actualizará en unos momentos.");
        // Iniciar polling
        if (data.reference) {
          setPendingReference(data.reference);
          pollingCountRef.current = 0;
        }
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      setIsQuickRecharging(false);
      toast.error(error.message || "Error en la recarga rápida");
    },
  });

  // Query para obtener acceptance token de Wompi
  const { data: acceptanceData } = trpc.wompi.getAcceptanceToken.useQuery(undefined, {
    enabled: !!wompiConfig?.configured,
  });

  // Mutation para tokenizar tarjeta y crear payment source
  const tokenizeCard = trpc.wompi.tokenizeCard.useMutation({
    onSuccess: (data) => {
      setIsTokenizing(false);
      if (data.success) {
        toast.success("¡Tarjeta inscrita exitosamente!");
        refetchSubscription();
        setShowAddCard(false);
        // Reset form
        setCardNumber("");
        setCardExpMonth("");
        setCardExpYear("");
        setCardCvc("");
        setCardHolder("");
      }
    },
    onError: (error) => {
      setIsTokenizing(false);
      toast.error(error.message || "Error inscribiendo la tarjeta");
    },
  });

  // Mutation para eliminar tarjeta
  const removeCard = trpc.wompi.removeCard.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchSubscription();
      setShowRemoveCard(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error eliminando la tarjeta");
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

  const hasPaymentSource = !!subscription?.wompiPaymentSourceId;

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

    // Si tiene tarjeta inscrita con payment source, usar recarga rápida
    if (hasSavedCard && hasPaymentSource) {
      setIsQuickRecharging(true);
      quickRecharge.mutate({ amount });
    } else {
      setIsProcessing(true);
      createWompiRecharge.mutate({ amount });
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
            {pendingReference ? (
              <div className="flex items-center gap-2 text-emerald-300 text-xs mt-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Procesando recarga... Tu saldo se actualizará en unos momentos</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Wallet className="w-3.5 h-3.5" />
                EVGreen Wallet
              </div>
            )}
          </Card>
        </motion.div>

        {/* ================================================================ */}
        {/* TARJETA DE CRÉDITO INSCRITA (CENTRO DE LA BILLETERA) */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Mi tarjeta</h3>
            {hasSavedCard && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7 px-2"
                  onClick={() => setShowAddCard(true)}
                >
                  Cambiar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                  onClick={() => setShowRemoveCard(true)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </Button>
              </div>
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
              disabled={isProcessing || isQuickRecharging || !!pendingReference || !hasPaymentMethod}
            >
              {isProcessing || isQuickRecharging || pendingReference ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {pendingReference ? "Verificando pago..." : isQuickRecharging ? "Cobrando..." : "Procesando..."}
                </>
              ) : hasSavedCard && hasPaymentSource ? (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Recarga rápida con ····{subscription?.cardLastFour}
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

            {/* Indicador de recarga instantánea */}
            {hasSavedCard && hasPaymentSource && (
              <p className="text-[10px] text-center text-primary/70 flex items-center justify-center gap-1">
                <Zap className="w-3 h-3" />
                Recarga instantánea – sin salir de la app
              </p>
            )}

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
        {/* DIÁLOGO: AGREGAR / CAMBIAR TARJETA (TOKENIZACIÓN DIRECTA) */}
        {/* ================================================================ */}
        <Dialog open={showAddCard} onOpenChange={(open) => {
          setShowAddCard(open);
          if (!open) {
            setCardNumber("");
            setCardExpMonth("");
            setCardExpYear("");
            setCardCvc("");
            setCardHolder("");
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {hasSavedCard ? "Cambiar tarjeta" : "Inscribir tarjeta"}
              </DialogTitle>
              <DialogDescription>
                {hasSavedCard
                  ? "Al inscribir una nueva tarjeta, se reemplazará la actual."
                  : "Inscribe tu tarjeta para recargar tu billetera con un solo clic."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Información de seguridad */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pago 100% seguro</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tus datos son tokenizados directamente por Wompi (PCI DSS Nivel 1).
                    EVGreen nunca almacena los datos completos de tu tarjeta.
                  </p>
                </div>
              </div>

              {/* Formulario de tarjeta */}
              <div className="space-y-3">
                {/* Nombre del titular */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre del titular</label>
                  <Input
                    placeholder="Como aparece en la tarjeta"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    className="h-11"
                    maxLength={50}
                  />
                </div>

                {/* Número de tarjeta */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Número de tarjeta</label>
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                      setCardNumber(formatted);
                    }}
                    className="h-11 font-mono tracking-wider"
                    inputMode="numeric"
                  />
                </div>

                {/* Fecha de vencimiento + CVV */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Mes</label>
                    <Input
                      placeholder="MM"
                      value={cardExpMonth}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setCardExpMonth(val);
                      }}
                      className="h-11 text-center font-mono"
                      inputMode="numeric"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Año</label>
                    <Input
                      placeholder="AA"
                      value={cardExpYear}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setCardExpYear(val);
                      }}
                      className="h-11 text-center font-mono"
                      inputMode="numeric"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">CVV</label>
                    <Input
                      placeholder="123"
                      type="password"
                      value={cardCvc}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCardCvc(val);
                      }}
                      className="h-11 text-center font-mono"
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              {/* Aceptación de términos */}
              {acceptanceData?.permalink && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Al inscribir tu tarjeta, aceptas los{" "}
                  <a
                    href={acceptanceData.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    términos y condiciones de Wompi
                  </a>
                  .
                </p>
              )}

              {/* Botón de inscripción */}
              <Button
                className="w-full h-12 gradient-primary text-white"
                onClick={async () => {
                  // Validaciones
                  const cleanNumber = cardNumber.replace(/\s/g, "");
                  if (!cardHolder.trim()) {
                    toast.error("Ingresa el nombre del titular");
                    return;
                  }
                  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
                    toast.error("Número de tarjeta inválido");
                    return;
                  }
                  const month = parseInt(cardExpMonth);
                  if (!month || month < 1 || month > 12) {
                    toast.error("Mes de vencimiento inválido");
                    return;
                  }
                  const year = parseInt(cardExpYear);
                  if (!year || year < 24) {
                    toast.error("Año de vencimiento inválido");
                    return;
                  }
                  if (cardCvc.length < 3) {
                    toast.error("CVV inválido");
                    return;
                  }
                  if (!publicKey) {
                    toast.error("Error de configuración. Intenta de nuevo.");
                    return;
                  }
                  if (!acceptanceData?.acceptanceToken) {
                    toast.error("Error obteniendo tokens de aceptación. Intenta de nuevo.");
                    return;
                  }

                  setIsTokenizing(true);

                  try {
                    // Paso 1: Tokenizar tarjeta directamente con Wompi API
                    const apiUrl = publicKey.startsWith("pub_test_")
                      ? "https://sandbox.wompi.co/v1"
                      : "https://production.wompi.co/v1";

                    const tokenResponse = await fetch(`${apiUrl}/tokens/cards`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${publicKey}`,
                      },
                      body: JSON.stringify({
                        number: cleanNumber,
                        cvc: cardCvc,
                        exp_month: cardExpMonth.padStart(2, "0"),
                        exp_year: cardExpYear.padStart(2, "0"),
                        card_holder: cardHolder.trim(),
                      }),
                    });

                    if (!tokenResponse.ok) {
                      const errBody = await tokenResponse.text();
                      console.error("[Wompi] Error tokenizando:", errBody);
                      throw new Error("No se pudo tokenizar la tarjeta. Verifica los datos.");
                    }

                    const tokenResult = await tokenResponse.json();
                    const cardToken = tokenResult.data?.id;

                    if (!cardToken) {
                      throw new Error("No se recibió token de la tarjeta.");
                    }

                    // Detectar marca de tarjeta por BIN (primeros dígitos)
                    const bin = cleanNumber.substring(0, 6);
                    let detectedBrand = "CARD";
                    if (/^4/.test(bin)) detectedBrand = "VISA";
                    else if (/^5[1-5]/.test(bin) || /^2[2-7]/.test(bin)) detectedBrand = "MASTERCARD";
                    else if (/^3[47]/.test(bin)) detectedBrand = "AMEX";
                    else if (/^6(?:011|5)/.test(bin)) detectedBrand = "DISCOVER";
                    else if (/^3(?:0[0-5]|[68])/.test(bin)) detectedBrand = "DINERS";

                    // Paso 2: Enviar token al backend para crear payment source
                    tokenizeCard.mutate({
                      cardToken,
                      acceptanceToken: acceptanceData.acceptanceToken,
                      personalAuthToken: acceptanceData.personalAuthToken || undefined,
                      cardLastFour: cleanNumber.slice(-4),
                      cardBrand: detectedBrand,
                      cardHolderName: cardHolder.trim(),
                    });
                  } catch (error: any) {
                    setIsTokenizing(false);
                    toast.error(error.message || "Error inscribiendo la tarjeta");
                  }
                }}
                disabled={isTokenizing || !hasPaymentMethod}
              >
                {isTokenizing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Inscribiendo tarjeta...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    Inscribir tarjeta de forma segura
                  </>
                )}
              </Button>

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

        {/* ================================================================ */}
        {/* DIÁLOGO: CONFIRMAR ELIMINACIÓN DE TARJETA */}
        {/* ================================================================ */}
        <Dialog open={showRemoveCard} onOpenChange={setShowRemoveCard}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-5 h-5" />
                Eliminar tarjeta
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas desvincular tu tarjeta
                {subscription?.cardBrand ? ` ${subscription.cardBrand}` : ""}
                {subscription?.cardLastFour ? ` ****${subscription.cardLastFour}` : ""}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">Acción irreversible</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Al eliminar la tarjeta, no podrás hacer recargas rápidas.
                    Tendrás que inscribir una nueva tarjeta para volver a usar esta función.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRemoveCard(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => removeCard.mutate()}
                  disabled={removeCard.isPending}
                >
                  {removeCard.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Sí, eliminar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  );
}
