import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CreditCard,
  DollarSign,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Banknote,
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PACKAGE_INFO: Record<string, { name: string; amount: number }> = {
  AC: { name: "AC Básico", amount: 8500000 },
  DC_INDIVIDUAL: { name: "DC Individual 120kW", amount: 85000000 },
  COLECTIVO: { name: "Estación Premium Colectiva", amount: 200000000 },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WOMPI: "Wompi (Online)",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  NEQUI: "Nequi",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Payments() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<number | null>(null);
  const [searchGuest, setSearchGuest] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    amount: 1000000,
    selectedPackage: "AC" as string,
    paymentMethod: "CASH" as string,
    paymentReference: "",
  });

  const utils = trpc.useUtils();

  const paymentsQuery = trpc.event.listPayments.useQuery();
  const guestsQuery = trpc.event.listGuests.useQuery({ search: searchGuest || undefined });

  const registerPaymentMutation = trpc.event.registerPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`Pago registrado. Ref: ${data.reference}`);
      setShowPaymentDialog(false);
      setSelectedGuestId(null);
      setPaymentForm({ amount: 1000000, selectedPackage: "AC", paymentMethod: "CASH", paymentReference: "" });
      utils.event.listPayments.invalidate();
      utils.event.listGuests.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createWompiCheckoutMutation = trpc.event.createReservationCheckout.useMutation({
    onSuccess: (data) => {
      toast.success("Redirigiendo a Wompi...");
      window.open(data.checkoutUrl, "_blank");
      utils.event.listPayments.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const payments = paymentsQuery.data?.payments || [];
  const paymentStats = paymentsQuery.data?.stats;
  const isGlobalView = paymentsQuery.data?.isGlobalView || false;
  const guests = guestsQuery.data?.guests || [];

  const exportExcelMutation = trpc.event.exportPaymentsExcel.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel de pagos descargado");
    },
    onError: (error) => toast.error(error.message),
  });

  const exportPDFMutation = trpc.event.exportPaymentsPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF de pagos descargado");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleRegisterPayment = () => {
    if (!selectedGuestId) {
      toast.error("Selecciona un invitado");
      return;
    }

    if (paymentForm.paymentMethod === "WOMPI") {
      createWompiCheckoutMutation.mutate({
        guestId: selectedGuestId,
        amount: paymentForm.amount,
        selectedPackage: paymentForm.selectedPackage as any,
      });
    } else {
      registerPaymentMutation.mutate({
        guestId: selectedGuestId,
        amount: paymentForm.amount,
        selectedPackage: paymentForm.selectedPackage as any,
        paymentMethod: paymentForm.paymentMethod as any,
        paymentReference: paymentForm.paymentReference || undefined,
      });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Vista indicator */}
      {isGlobalView && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <Eye className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-400 font-medium">
            Vista Global — Viendo pagos de todos los aliados
          </span>
        </div>
      )}
      {!isGlobalView && !paymentsQuery.isLoading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">
            Mis Pagos — Solo ves pagos de tus invitados
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos de Reserva</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los pagos de reserva de los inversionistas
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportExcelMutation.isPending || exportPDFMutation.isPending}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportExcelMutation.mutate()}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
                Descargar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPDFMutation.mutate()}>
                <FileText className="mr-2 h-4 w-4 text-red-500" />
                Descargar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Pago de Reserva</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Buscar invitado */}
              <div>
                <Label>Buscar Invitado *</Label>
                <Input
                  placeholder="Nombre o email del invitado..."
                  value={searchGuest}
                  onChange={(e) => setSearchGuest(e.target.value)}
                />
                {searchGuest && guests.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md">
                    {guests.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setSelectedGuestId(g.id);
                          setSearchGuest(g.fullName);
                          if (g.investmentPackage) {
                            setPaymentForm((prev) => ({
                              ...prev,
                              selectedPackage: g.investmentPackage!,
                            }));
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                          selectedGuestId === g.id ? "bg-green-500/10" : ""
                        }`}
                      >
                        <div className="font-medium">{g.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.email} {g.founderSlot ? `• Cupo #${g.founderSlot}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedGuestId && (
                  <p className="text-xs text-green-400 mt-1">
                    Invitado seleccionado: {guests.find((g) => g.id === selectedGuestId)?.fullName}
                  </p>
                )}
              </div>

              {/* Paquete */}
              <div>
                <Label>Paquete de Inversión *</Label>
                <Select
                  value={paymentForm.selectedPackage}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, selectedPackage: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AC">AC Básico - $8.500.000</SelectItem>
                    <SelectItem value="DC_INDIVIDUAL">DC Individual 120kW - $85.000.000</SelectItem>
                    <SelectItem value="COLECTIVO">Estación Premium Colectiva - $200.000.000</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Inversión total del paquete: {formatCurrency(PACKAGE_INFO[paymentForm.selectedPackage]?.amount || 0)}
                </p>
              </div>

              {/* Monto */}
              <div>
                <Label>Monto del Abono *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseInt(e.target.value) || 0 })}
                  min={1000000}
                  step={100000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo: $1.000.000 COP (reserva de cupo). Puede abonar un monto superior.
                </p>
              </div>

              {/* Método de pago */}
              <div>
                <Label>Método de Pago *</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia Bancaria</SelectItem>
                    <SelectItem value="CARD">Tarjeta (Datáfono)</SelectItem>
                    <SelectItem value="NEQUI">Nequi</SelectItem>
                    <SelectItem value="WOMPI">Wompi (Pago Online)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Referencia */}
              {paymentForm.paymentMethod !== "WOMPI" && paymentForm.paymentMethod !== "CASH" && (
                <div>
                  <Label>Referencia de Pago</Label>
                  <Input
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                    placeholder="Número de referencia o comprobante"
                  />
                </div>
              )}

              {/* Resumen */}
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="p-3 space-y-1">
                  <p className="text-sm font-medium">Resumen del Pago</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Abono:</span>
                    <span className="font-bold text-green-400">{formatCurrency(paymentForm.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paquete:</span>
                    <span>{PACKAGE_INFO[paymentForm.selectedPackage]?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo pendiente:</span>
                    <span>{formatCurrency((PACKAGE_INFO[paymentForm.selectedPackage]?.amount || 0) - paymentForm.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Método:</span>
                    <span>{PAYMENT_METHOD_LABELS[paymentForm.paymentMethod]}</span>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleRegisterPayment}
                disabled={registerPaymentMutation.isPending || createWompiCheckoutMutation.isPending || !selectedGuestId}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {paymentForm.paymentMethod === "WOMPI" ? (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar con Wompi
                  </>
                ) : (
                  <>
                    <Banknote className="mr-2 h-4 w-4" />
                    Registrar Pago
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats de pagos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-500/20">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">
              {formatCurrency(paymentStats?.totalAmount || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Recaudado</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold">{paymentStats?.totalPayments || 0}</p>
            <p className="text-xs text-muted-foreground">Total Pagos</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{paymentStats?.paidCount || 0}</p>
            <p className="text-xs text-muted-foreground">Pagados</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-400">{paymentStats?.pendingCount || 0}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de pagos */}
      <div className="space-y-3">
        {paymentsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay pagos registrados</p>
            </CardContent>
          </Card>
        ) : (
          payments.map((p) => (
            <Card key={p.payment.id} className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{p.guestName}</h3>
                      <Badge
                        className={
                          p.payment.paymentStatus === "PAID"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }
                      >
                        {p.payment.paymentStatus === "PAID" ? "Pagado" : "Pendiente"}
                      </Badge>
                      {p.founderSlot && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Cupo #{p.founderSlot}
                        </Badge>
                      )}
                      {isGlobalView && (p as any).staffName && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                          Aliado: {(p as any).staffName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span>{p.guestEmail}</span>
                      {p.guestCompany && <span>• {p.guestCompany}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-muted-foreground">
                      <span>Paquete: {p.payment.selectedPackage ? PACKAGE_INFO[p.payment.selectedPackage]?.name : 'N/A'}</span>
                      <span>Método: {p.payment.paymentMethod ? PAYMENT_METHOD_LABELS[p.payment.paymentMethod] || p.payment.paymentMethod : 'N/A'}</span>
                      <span>Ref: {p.payment.paymentReference}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-green-400">
                      {formatCurrency(p.payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.payment.paidAt
                        ? new Date(p.payment.paidAt).toLocaleDateString("es-CO")
                        : "Pendiente"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
