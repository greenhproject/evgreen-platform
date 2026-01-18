import { useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const PRESET_AMOUNTS = [20000, 40000, 100000];

export default function UserWallet() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(20000);
  const [customAmount, setCustomAmount] = useState("");

  // Obtener billetera
  const { data: wallet, isLoading } = trpc.wallet.getMyWallet.useQuery();
  
  // Obtener historial de transacciones
  const { data: transactions } = trpc.wallet.getTransactions.useQuery({ limit: 20 });

  const handleRecharge = () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!amount || amount < 10000) {
      toast.error("El monto mínimo de recarga es $10,000 COP");
      return;
    }
    // TODO: Integrar con Stripe
    toast.info("Funcionalidad de pago próximamente disponible");
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
        return <ArrowDownLeft className="w-4 h-4 text-primary" />;
      case "CHARGE":
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
          <Card className="p-6 gradient-primary text-white rounded-2xl shadow-glow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/80">Saldo actual</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <Clock className="w-4 h-4 mr-2" />
                Historial
              </Button>
            </div>
            <div className="text-4xl font-bold mb-2">
              {isLoading ? "..." : formatCurrency(wallet?.balance || 0)}
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Wallet className="w-4 h-4" />
              Green EV Wallet
            </div>
          </Card>
        </motion.div>

        {/* Tabs de recarga y tarjetas */}
        <Tabs defaultValue="recharge" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="recharge">Recargar</TabsTrigger>
            <TabsTrigger value="cards">Mis tarjetas</TabsTrigger>
          </TabsList>

          <TabsContent value="recharge" className="mt-4 space-y-4">
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
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedAmount === amount && !customAmount
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-lg font-semibold text-primary">
                    {formatCurrency(amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    precio {formatCurrency(amount)}
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
                placeholder="Otro monto"
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
            >
              Recargar Ahora
            </Button>
          </TabsContent>

          <TabsContent value="cards" className="mt-4 space-y-4">
            {/* Lista de tarjetas */}
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No tienes tarjetas guardadas
              </p>
              <Button variant="outline" className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Nueva Tarjeta
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Historial de transacciones */}
        <div>
          <h3 className="font-semibold mb-4">Movimientos recientes</h3>
          <div className="space-y-3">
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
                      tx.type === "RECHARGE" ? "bg-primary/10" : "bg-orange-100"
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
                      tx.type === "RECHARGE" ? "text-primary" : "text-foreground"
                    }`}>
                      {tx.type === "RECHARGE" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
