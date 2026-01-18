import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Download,
  CreditCard,
  Building,
  Calendar,
  ArrowRight,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface Settlement {
  id: number;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  commission: number;
  netAmount: number;
  status: "pending" | "processing" | "completed" | "failed";
  paidAt?: Date;
  transactionId?: string;
}

// Datos de ejemplo
const mockSettlements: Settlement[] = [
  {
    id: 1,
    period: "Enero 2026 - Semana 3",
    periodStart: new Date(2026, 0, 13),
    periodEnd: new Date(2026, 0, 19),
    grossAmount: 1242480,
    commission: 248496,
    netAmount: 993984,
    status: "pending",
  },
  {
    id: 2,
    period: "Enero 2026 - Semana 2",
    periodStart: new Date(2026, 0, 6),
    periodEnd: new Date(2026, 0, 12),
    grossAmount: 1456200,
    commission: 291240,
    netAmount: 1164960,
    status: "completed",
    paidAt: new Date(2026, 0, 14),
    transactionId: "TXN-2026-0114-001",
  },
  {
    id: 3,
    period: "Enero 2026 - Semana 1",
    periodStart: new Date(2026, 0, 1),
    periodEnd: new Date(2026, 0, 5),
    grossAmount: 892560,
    commission: 178512,
    netAmount: 714048,
    status: "completed",
    paidAt: new Date(2026, 0, 7),
    transactionId: "TXN-2026-0107-001",
  },
  {
    id: 4,
    period: "Diciembre 2025 - Semana 4",
    periodStart: new Date(2025, 11, 23),
    periodEnd: new Date(2025, 11, 31),
    grossAmount: 1678400,
    commission: 335680,
    netAmount: 1342720,
    status: "completed",
    paidAt: new Date(2026, 0, 2),
    transactionId: "TXN-2026-0102-001",
  },
];

export default function InvestorSettlements() {
  const [settlements] = useState<Settlement[]>(mockSettlements);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const pendingAmount = settlements
    .filter(s => s.status === "pending")
    .reduce((sum, s) => sum + s.netAmount, 0);

  const totalPaid = settlements
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + s.netAmount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; label: string; icon: any }> = {
      pending: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pendiente", icon: Clock },
      processing: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Procesando", icon: Clock },
      completed: { bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Pagado", icon: CheckCircle },
      failed: { bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Fallido", icon: AlertCircle },
    };
    const style = styles[status];
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  const handleRequestPayout = () => {
    toast.success("Solicitud de pago enviada. Se procesará en 24-48 horas.");
    setIsDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones</h1>
          <p className="text-muted-foreground">
            Historial de pagos y liquidaciones de tus estaciones
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary" disabled={pendingAmount === 0}>
              <Wallet className="w-4 h-4 mr-2" />
              Solicitar pago
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Liquidación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground">Monto disponible</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(pendingAmount)}</p>
              </div>
              <div className="space-y-2">
                <Label>Cuenta bancaria</Label>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Bancolombia ****4521</p>
                    <p className="text-sm text-muted-foreground">Cuenta de ahorros</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tiempo estimado</Label>
                <p className="text-sm text-muted-foreground">
                  El pago se procesará en 24-48 horas hábiles
                </p>
              </div>
              <Button className="w-full" onClick={handleRequestPayout}>
                Confirmar solicitud
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendiente de pago</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(pendingAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {settlements.filter(s => s.status === "pending").length} liquidación(es)
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total pagado</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {settlements.filter(s => s.status === "completed").length} pagos completados
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Próxima liquidación</p>
                <p className="text-2xl font-bold">Lun 20 Ene</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Liquidación semanal
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cuenta bancaria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Cuenta de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold">Bancolombia</p>
                <p className="text-sm text-muted-foreground">Cuenta de ahorros ****4521</p>
                <p className="text-xs text-muted-foreground">Titular: Green House Project S.A.S</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Cambiar cuenta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historial de liquidaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historial de Liquidaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settlements.map(settlement => (
              <div 
                key={settlement.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    settlement.status === "completed" ? "bg-green-500/20" :
                    settlement.status === "pending" ? "bg-yellow-500/20" :
                    "bg-blue-500/20"
                  }`}>
                    <DollarSign className={`w-5 h-5 ${
                      settlement.status === "completed" ? "text-green-500" :
                      settlement.status === "pending" ? "text-yellow-500" :
                      "text-blue-500"
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold">{settlement.period}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(settlement.periodStart).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                      {" - "}
                      {new Date(settlement.periodEnd).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </p>
                    {settlement.paidAt && (
                      <p className="text-xs text-muted-foreground">
                        Pagado el {new Date(settlement.paidAt).toLocaleDateString("es-CO")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(settlement.netAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Bruto: {formatCurrency(settlement.grossAmount)}
                    </p>
                  </div>
                  {getStatusBadge(settlement.status)}
                  {settlement.status === "completed" && (
                    <Button variant="ghost" size="icon">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información sobre liquidaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Información sobre Liquidaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ciclo de liquidación
              </h4>
              <p className="text-sm text-muted-foreground">
                Las liquidaciones se generan semanalmente (lunes a domingo) y se procesan 
                el siguiente día hábil. Los pagos se realizan dentro de 24-48 horas hábiles.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Monto mínimo
              </h4>
              <p className="text-sm text-muted-foreground">
                El monto mínimo para solicitar un pago es de $50,000 COP. Si tu saldo 
                es menor, se acumulará para la siguiente liquidación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
