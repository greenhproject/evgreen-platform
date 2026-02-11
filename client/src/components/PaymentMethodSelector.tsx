/**
 * Componente de selección de método de pago
 * Usa Wompi como pasarela de pagos para Colombia
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, 
  Building2, 
  Smartphone, 
  QrCode, 
  Banknote,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PaymentMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  type: "wallet_recharge" | "charging_payment";
  transactionId?: string;
  onSuccess?: () => void;
}

type PaymentProvider = "stripe" | "wompi";
type WompiMethod = "CARD" | "PSE" | "NEQUI" | "BANCOLOMBIA_QR" | "EFECTY";

const wompiMethods = [
  {
    id: "CARD" as WompiMethod,
    name: "Tarjeta de Crédito/Débito",
    description: "Visa, Mastercard, American Express",
    icon: CreditCard,
  },
  {
    id: "PSE" as WompiMethod,
    name: "PSE",
    description: "Transferencia desde tu banco",
    icon: Building2,
  },
  {
    id: "NEQUI" as WompiMethod,
    name: "Nequi",
    description: "Paga desde tu cuenta Nequi",
    icon: Smartphone,
  },
  {
    id: "BANCOLOMBIA_QR" as WompiMethod,
    name: "Bancolombia QR",
    description: "Escanea con tu app Bancolombia",
    icon: QrCode,
  },
  {
    id: "EFECTY" as WompiMethod,
    name: "Efecty",
    description: "Paga en efectivo en puntos Efecty",
    icon: Banknote,
  },
];

export function PaymentMethodSelector({
  open,
  onOpenChange,
  amount,
  type,
  transactionId,
  onSuccess,
}: PaymentMethodSelectorProps) {
  const [step, setStep] = useState<"provider" | "method" | "amount">("amount");
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [wompiMethod, setWompiMethod] = useState<WompiMethod | null>(null);
  const [customAmount, setCustomAmount] = useState(amount.toString());
  const [isLoading, setIsLoading] = useState(false);

  // Verificar si Wompi está configurado
  const { data: wompiConfig } = trpc.wompi.isConfigured.useQuery();

  // Mutation para crear sesión de pago con Wompi
  const createWompiSession = trpc.wompi.createWalletRecharge.useMutation();

  const handleProviderSelect = () => {
    setProvider("wompi");
    setStep("method");
  };

  const handleWompiPayment = async () => {
    setIsLoading(true);
    try {
      const finalAmount = parseFloat(customAmount);
      if (isNaN(finalAmount) || finalAmount < 10000) {
        toast.error("El monto mínimo es $10,000 COP");
        setIsLoading(false);
        return;
      }

      const result = await createWompiSession.mutateAsync({
        amount: finalAmount,
      });

      if (result.checkoutUrl) {
        toast.info("Redirigiendo a Wompi...");
        window.open(result.checkoutUrl, "_blank");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      toast.error(error.message || "Error al crear sesión de pago");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "method") {
      setStep("provider");
      setProvider(null);
    } else if (step === "provider") {
      setStep("amount");
    }
  };

  const resetState = () => {
    setStep("amount");
    setProvider(null);
    setWompiMethod(null);
    setCustomAmount(amount.toString());
    setIsLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "amount" && "Recargar Billetera"}
            {step === "provider" && "Selecciona método de pago"}
            {step === "method" && "Métodos de pago Colombia"}
          </DialogTitle>
          <DialogDescription>
            {step === "amount" && "Ingresa el monto que deseas recargar"}
            {step === "provider" && "Elige cómo deseas pagar"}
            {step === "method" && "Selecciona tu método de pago preferido"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Monto */}
        {step === "amount" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto a recargar (COP)</Label>
              <Input
                id="amount"
                type="number"
                min="10000"
                max="50000000"
                step="1000"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo: $10,000 COP | Máximo: $50,000,000 COP
              </p>
            </div>

            {/* Montos rápidos */}
            <div className="grid grid-cols-3 gap-2">
              {[50000, 100000, 200000].map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomAmount(quickAmount.toString())}
                  className={customAmount === quickAmount.toString() ? "border-primary" : ""}
                >
                  {formatCurrency(quickAmount)}
                </Button>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() => setStep("provider")}
              disabled={!customAmount || parseFloat(customAmount) < 10000}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 2: Selección de proveedor */}
        {step === "provider" && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(parseFloat(customAmount))}
              </p>
            </div>

            <div className="grid gap-3">
              {/* Opción Wompi - todos los métodos */}
              <button
                onClick={() => handleProviderSelect()}
                disabled={!wompiConfig?.configured || isLoading}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                  !wompiConfig?.configured
                    ? "opacity-50 cursor-not-allowed border-muted"
                    : "hover:border-primary cursor-pointer border-border"
                }`}
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Métodos de Pago</h3>
                  <p className="text-sm text-muted-foreground">
                    Tarjetas, PSE, Nequi, Bancolombia QR, Efecty
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pagos seguros con Wompi
                  </p>
                </div>
              </button>
            </div>

            <Button variant="ghost" onClick={handleBack} className="w-full">
              Volver
            </Button>
          </div>
        )}

        {/* Step 3: Métodos de Wompi */}
        {step === "method" && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(parseFloat(customAmount))}
              </p>
            </div>

            <RadioGroup
              value={wompiMethod || ""}
              onValueChange={(value) => setWompiMethod(value as WompiMethod)}
              className="space-y-2"
            >
              {wompiMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div
                    key={method.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      wompiMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setWompiMethod(method.id)}
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor={method.id} className="cursor-pointer font-medium">
                        {method.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {method.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Volver
              </Button>
              <Button
                onClick={handleWompiPayment}
                disabled={!wompiMethod || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Pagar"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
