import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CreditCard, Plus, Trash2, Check, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface PaymentMethod {
  id: number;
  type: "card" | "pse";
  last4?: string;
  brand?: string;
  bankName?: string;
  isDefault: boolean;
}

export default function PaymentMethods() {
  const [, setLocation] = useLocation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddCard = () => {
    // En producción, esto integraría con Stripe o similar
    const newCard: PaymentMethod = {
      id: Date.now(),
      type: "card",
      last4: "4242",
      brand: "Visa",
      isDefault: methods.length === 0,
    };
    setMethods(prev => [...prev, newCard]);
    setIsDialogOpen(false);
    toast.success("Tarjeta agregada correctamente");
  };

  const handleDelete = (id: number) => {
    setMethods(prev => prev.filter(m => m.id !== id));
    toast.success("Método de pago eliminado");
  };

  const handleSetDefault = (id: number) => {
    setMethods(prev => prev.map(m => ({
      ...m,
      isDefault: m.id === id,
    })));
    toast.success("Método de pago predeterminado actualizado");
  };

  return (
    <UserLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setLocation("/profile")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold">Métodos de Pago</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Agregar método de pago</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Card 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={handleAddCard}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Tarjeta de crédito/débito</p>
                        <p className="text-sm text-muted-foreground">Visa, Mastercard, American Express</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:border-primary transition-colors opacity-50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">PSE</p>
                        <p className="text-sm text-muted-foreground">Débito bancario (Próximamente)</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Información */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <p className="text-sm">
                <strong>Nota:</strong> Los métodos de pago se utilizan para recargar tu billetera Green EV. 
                Tus datos están protegidos con encriptación de nivel bancario.
              </p>
            </CardContent>
          </Card>

          {methods.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Sin métodos de pago</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agrega una tarjeta para recargar tu billetera fácilmente
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar método de pago
                </Button>
              </div>
            </Card>
          ) : (
            methods.map(method => (
              <Card key={method.id} className={method.isDefault ? "border-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        {method.type === "card" ? (
                          <CreditCard className="w-6 h-6 text-primary" />
                        ) : (
                          <Building2 className="w-6 h-6 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {method.type === "card" 
                            ? `${method.brand} •••• ${method.last4}`
                            : method.bankName
                          }
                        </CardTitle>
                        <CardDescription>
                          {method.type === "card" ? "Tarjeta" : "PSE"}
                        </CardDescription>
                      </div>
                    </div>
                    {method.isDefault && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Predeterminado
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Usar por defecto
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </UserLayout>
  );
}
