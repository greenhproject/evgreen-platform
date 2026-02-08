import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Trash2, Check, Building2, Smartphone, QrCode, Banknote, Loader2, Shield, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function PaymentMethods() {
  const [, setLocation] = useLocation();

  // Verificar si Wompi está configurado
  const { data: wompiConfig, isLoading: loadingConfig } = trpc.wompi.isConfigured.useQuery();

  // Obtener métodos de pago disponibles en Wompi
  const { data: paymentMethods } = trpc.wompi.getPaymentMethods.useQuery();

  // Obtener suscripción actual (tiene datos de tarjeta guardada)
  const { data: subscription } = trpc.wompi.getMySubscription.useQuery();

  // Obtener historial de transacciones recientes
  const { data: recentTransactions } = trpc.wompi.myTransactions.useQuery({ limit: 10, offset: 0 });

  const getMethodIcon = (id: string) => {
    switch (id) {
      case "CARD": return <CreditCard className="w-6 h-6 text-primary" />;
      case "PSE": return <Building2 className="w-6 h-6 text-blue-500" />;
      case "NEQUI": return <Smartphone className="w-6 h-6 text-purple-500" />;
      case "BANCOLOMBIA_QR": return <QrCode className="w-6 h-6 text-yellow-500" />;
      case "EFECTY": return <Banknote className="w-6 h-6 text-green-500" />;
      default: return <CreditCard className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getMethodBgColor = (id: string) => {
    switch (id) {
      case "CARD": return "bg-primary/10";
      case "PSE": return "bg-blue-500/10";
      case "NEQUI": return "bg-purple-500/10";
      case "BANCOLOMBIA_QR": return "bg-yellow-500/10";
      case "EFECTY": return "bg-green-500/10";
      default: return "bg-muted";
    }
  };

  const handleSelectMethod = (methodId: string) => {
    toast.info(`Puedes usar ${methodId === "CARD" ? "tarjeta" : methodId} al recargar tu billetera o activar una suscripción.`);
    setLocation("/wallet");
  };

  const hasSavedCard = subscription?.cardLastFour && subscription?.cardBrand;

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/profile")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Métodos de Pago</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Estado de Wompi */}
          {loadingConfig ? (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Verificando sistema de pagos...</span>
              </div>
            </Card>
          ) : !wompiConfig?.configured ? (
            <Card className="p-4 bg-amber-950/20 border-amber-800/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Pagos en configuración</p>
                  <p className="text-xs text-amber-400/60 mt-1">
                    El sistema de pagos está siendo configurado. Pronto podrás usar todos los métodos de pago disponibles.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm"><strong>Pagos seguros con Wompi</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todos los métodos de pago están disponibles al recargar tu billetera o activar una suscripción.
                      Tus datos están protegidos con encriptación de nivel bancario.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tarjeta guardada para cobros recurrentes */}
          {hasSavedCard && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tarjeta guardada</h3>
              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {subscription.cardBrand} •••• {subscription.cardLastFour}
                        </CardTitle>
                        <CardDescription>Tarjeta para cobros recurrentes de suscripción</CardDescription>
                      </div>
                    </div>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Activa
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Métodos de pago disponibles */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Métodos disponibles</h3>
            <p className="text-xs text-muted-foreground">
              Estos métodos están disponibles al realizar pagos en la plataforma.
            </p>
          </div>

          {paymentMethods?.map((method) => (
            <Card
              key={method.id}
              className={`transition-colors ${method.enabled ? "hover:border-primary/50 cursor-pointer" : "opacity-50"}`}
              onClick={() => method.enabled && handleSelectMethod(method.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`w-12 h-12 rounded-xl ${getMethodBgColor(method.id)} flex items-center justify-center flex-shrink-0`}>
                  {getMethodIcon(method.id)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{method.name}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
                {method.enabled && (
                  <div className="flex-shrink-0">
                    <Check className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Transacciones recientes */}
          {recentTransactions && recentTransactions.length > 0 && (
            <div className="space-y-2 mt-6">
              <h3 className="text-sm font-medium text-muted-foreground">Pagos recientes</h3>
              {recentTransactions.slice(0, 5).map((tx) => (
                <Card key={tx.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.status === "APPROVED" ? "bg-green-500/10" :
                        tx.status === "PENDING" ? "bg-yellow-500/10" : "bg-red-500/10"
                      }`}>
                        <CreditCard className={`w-4 h-4 ${
                          tx.status === "APPROVED" ? "text-green-500" :
                          tx.status === "PENDING" ? "text-yellow-500" : "text-red-500"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.paymentMethodType || "Pendiente"} · {new Date(tx.createdAt).toLocaleDateString("es-CO")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${(tx.amountInCents / 100).toLocaleString("es-CO")}</p>
                      <p className={`text-xs ${
                        tx.status === "APPROVED" ? "text-green-500" :
                        tx.status === "PENDING" ? "text-yellow-500" : "text-red-500"
                      }`}>
                        {tx.status === "APPROVED" ? "Aprobado" :
                         tx.status === "PENDING" ? "Pendiente" :
                         tx.status === "DECLINED" ? "Rechazado" : tx.status}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setLocation("/wallet")}>
                Ver todo el historial →
              </Button>
            </div>
          )}

          {/* Información de seguridad */}
          <Card className="p-4 bg-muted/30 mt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Seguridad de tus pagos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  EVGreen no almacena los datos de tu tarjeta. Todos los pagos son procesados de forma segura
                  por Wompi, certificado PCI DSS Nivel 1. Tus datos financieros nunca pasan por nuestros servidores.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </UserLayout>
  );
}
