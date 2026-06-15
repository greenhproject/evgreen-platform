/**
 * ClaimForm - Formulario de reclamo de cobro incorrecto (usuario)
 * Accesible desde /user/claim/:transactionId
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import UserLayout from "@/layouts/UserLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Zap,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ClaimForm() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const parsedTxId = parseInt(transactionId || "0");

  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Obtener datos de la transacción
  const { data: txData } = trpc.dashboard.userTransactionHistory.useQuery(
    { limit: 100 },
    { enabled: !!user }
  );

  const transaction = txData?.find((t: any) => t.transaction.id === parsedTxId);
  const tx = transaction?.transaction;
  const station = transaction?.station;

  const createClaimMutation = (trpc as any).claims.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Reclamo enviado exitosamente");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al enviar reclamo");
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(num);
  };

  if (submitted) {
    return (
      <UserLayout title="Reclamo enviado">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Reclamo enviado</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Nuestro equipo de soporte revisará tu caso y te notificará la resolución. 
            Tiempo estimado: 24-48 horas.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/user/history")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al historial
            </Button>
            <Button onClick={() => setLocation("/map")} className="bg-emerald-600 hover:bg-emerald-700">
              Ir al mapa
            </Button>
          </div>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title="Reportar cobro">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reportar cobro incorrecto
            </h1>
            <p className="text-sm text-muted-foreground">Transacción #{parsedTxId}</p>
          </div>
        </div>

        {/* Info de la transacción */}
        {tx && (
          <Card className="border-muted">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">{station?.name || "Estación"}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  #{tx.id}
                </Badge>
              </div>
              {station?.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {station.address}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Energía</span>
                  <p className="font-medium">{parseFloat(tx.kwhConsumed || "0").toFixed(2)} kWh</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duración</span>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tx.endTime ? `${Math.round((new Date(tx.endTime).getTime() - new Date(tx.startTime).getTime()) / 60000)} min` : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Total</span>
                  <p className="font-bold text-emerald-600">{formatCurrency(tx.totalCost || 0)}</p>
                </div>
              </div>
              {parseFloat(tx.overstayCost || "0") > 0 && (
                <div className="flex items-center justify-between pt-2 border-t text-sm">
                  <span className="text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Sobreestadía cobrada
                  </span>
                  <span className="font-bold text-red-500">{formatCurrency(tx.overstayCost || 0)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Formulario */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalles del reclamo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Categoría del problema *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="¿Qué tipo de problema tuviste?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overcharge">Cobro excesivo (me cobraron de más)</SelectItem>
                  <SelectItem value="overstay_unfair">Sobreestadía injusta (no pude mover el vehículo)</SelectItem>
                  <SelectItem value="wrong_kwh">kWh registrados incorrectamente</SelectItem>
                  <SelectItem value="double_charge">Cobro doble</SelectItem>
                  <SelectItem value="other">Otro problema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Describe el problema *</Label>
              <Textarea
                placeholder="Explica qué sucedió y por qué consideras que el cobro es incorrecto. Incluye detalles como la hora aproximada, si hubo algún problema con el cargador, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 10 caracteres ({description.length}/10)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" />
                Monto que solicitas de reembolso (opcional)
              </Label>
              <Input
                type="number"
                placeholder="Ej: 5000"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si no estás seguro del monto, déjalo vacío y nuestro equipo evaluará
              </p>
            </div>

            <Button
              className="w-full h-12 bg-red-700 hover:bg-red-600 text-white font-semibold"
              disabled={!category || description.length < 10 || createClaimMutation.isPending}
              onClick={() => {
                createClaimMutation.mutate({
                  transactionId: parsedTxId,
                  category,
                  description,
                  requestedAmount: requestedAmount ? Number(requestedAmount) : undefined,
                });
              }}
            >
              {createClaimMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="w-5 h-5 mr-2" />
              )}
              Enviar reclamo
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Nuestro equipo revisará tu caso en 24-48 horas y te notificará la resolución.
            </p>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  );
}
